#include "engine.h"
#include "gba_system.h"
#include "vm.h"
#include <stddef.h>

// ---------------------------------------------------------------------------
// GBA Studio engine - Phase 1
//
// Boots the GBA and renders a single tiled background (Mode 0) the size of one
// GBA screen (30x20 tiles / 240x160px). This is the foundation the VM port
// builds on: the palette / tile / tilemap loading here is the same path real
// compiled scene data will use once the compiler->engine bridge lands.
// ---------------------------------------------------------------------------

// VRAM layout (Mode 0)
#define CHARBLOCK(n) ((volatile uint16_t *)(0x06000000 + (n) * 0x4000))
#define SCREENBLOCK(n) ((volatile uint16_t *)(0x06000000 + (n) * 0x0800))

#define TILE_CHARBLOCK 0
#define MAP_SCREENBLOCK 28

// Map area is a single visible screen
#define SCENE_W MAP_WIDTH  // 30
#define SCENE_H MAP_HEIGHT // 20

// Tile indices in our minimal tileset
#define TILE_BACKDROP 0
#define TILE_FILL 1   // light interior
#define TILE_BORDER 2 // dark edge
#define MAX_ACTORS 16

static scene_t current_scene;
static actor_t actors[MAX_ACTORS];
static bool engine_running = true;

// 16-colour background palette (bank 0). Mirrors the gba-blank template look:
// dark border + light fill, on the classic GB green ramp.
static const uint16_t bg_palette[8] = {
    RGB15(1, 3, 4),    // 0 backdrop  (#071821-ish)
    RGB15(28, 31, 25), // 1 light     (#e0f8cf-ish)
    RGB15(6, 13, 10),  // 2 dark      (#306850-ish)
    RGB15(16, 24, 13), // 3 mid       (#86c06c-ish)
    0, 0, 0, 0,
};

// One 4bpp tile = 8x8 px, 4 bits/pixel = 32 bytes = 16 uint16 words.
// A solid tile of palette index p has every nibble = p.
static void load_solid_tile(uint16_t tile_index, uint8_t pal_index) {
  volatile uint16_t *tile = CHARBLOCK(TILE_CHARBLOCK) + tile_index * 16;
  uint16_t word = (pal_index << 12) | (pal_index << 8) | (pal_index << 4) |
                  pal_index;
  for (int i = 0; i < 16; i++) {
    tile[i] = word;
  }
}

static void set_map_entry(uint16_t x, uint16_t y, uint16_t tile_index) {
  // Base map is 32x32 tiles regardless of visible area.
  SCREENBLOCK(MAP_SCREENBLOCK)[y * 32 + x] = tile_index;
}

static void render_scene(void) {
  load_palette(bg_palette, 0, 8);

  load_solid_tile(TILE_BACKDROP, 0);
  load_solid_tile(TILE_FILL, 1);
  load_solid_tile(TILE_BORDER, 2);

  // BG0: charblock 0, screenblock 28, 4bpp, 32x32, priority 0.
  REG_BG0CNT = (TILE_CHARBLOCK << 2) | (MAP_SCREENBLOCK << 8);

  for (uint16_t y = 0; y < 32; y++) {
    for (uint16_t x = 0; x < 32; x++) {
      uint16_t tile = TILE_BACKDROP;
      if (x < SCENE_W && y < SCENE_H) {
        bool edge = (x == 0 || y == 0 || x == SCENE_W - 1 || y == SCENE_H - 1);
        tile = edge ? TILE_BORDER : TILE_FILL;
      }
      set_map_entry(x, y, tile);
    }
  }
}

static void init_scene_state(void) {
  current_scene.width = MAP_WIDTH;
  current_scene.height = MAP_HEIGHT;
  current_scene.type = 0;
  current_scene.num_actors = 0;
  current_scene.num_triggers = 0;
  current_scene.num_projectiles = 0;
  current_scene.background_index = 0;
  current_scene.palette_index = 0;
  current_scene.actors = actors;

  for (uint8_t i = 0; i < MAX_ACTORS; i++) {
    actors[i].active = false;
  }
}

void engine_init(void) {
  gba_init(); // Mode 0, BG0 enabled, VRAM/palette cleared
  init_scene_state();
  script_runner_init(true);
  render_scene();
  REG_DISPCNT = MODE_0 | BG0_ENABLE;
}

void engine_update(void) {
  // Phase 1: input is read so the edge-detection HAL is exercised; scripted
  // behaviour arrives with the VM port.
  (void)get_keys();
  (void)script_runner_update();

  for (uint8_t i = 0; i < current_scene.num_actors; i++) {
    actor_t *actor = &actors[i];
    if (!actor->active || actor->disabled) {
      continue;
    }

    actor->x += actor->vel_x;
    actor->y += actor->vel_y;

    if (actor->anim_speed > 0) {
      actor->anim_tick++;
      if (actor->anim_tick >= actor->anim_speed) {
        actor->anim_tick = 0;
        actor->anim_frame++;
      }
    }
  }
}

void engine_render(void) { wait_vblank(); }

void engine_run(void) {
  engine_init();
  while (engine_running) {
    engine_update();
    engine_render();
  }
}

void load_scene(uint8_t scene_index) {
  current_scene.background_index = scene_index;
  current_scene.num_actors = 0;

  for (uint8_t i = 0; i < MAX_ACTORS; i++) {
    actors[i].active = false;
  }

  render_scene();
}

actor_t *spawn_actor(uint8_t sprite_index, uint16_t x, uint16_t y) {
  for (uint8_t i = 0; i < MAX_ACTORS; i++) {
    actor_t *actor = &actors[i];
    if (actor->active) {
      continue;
    }

    actor->active = true;
    actor->pinned = false;
    actor->hidden = false;
    actor->disabled = false;
    actor->anim_noloop = false;
    actor->collision_enabled = true;
    actor->movement_interrupt = false;
    actor->persistent = false;
    actor->sprite_index = sprite_index;
    actor->palette_index = 0;
    actor->x = x;
    actor->y = y;
    actor->vel_x = 0;
    actor->vel_y = 0;
    actor->anim_frame = 0;
    actor->anim_speed = 0;
    actor->anim_tick = 0;
    actor->collision_group = COLLISION_GROUP_NONE;
    actor->movement_type = 0;
    actor->bounds_x = x;
    actor->bounds_y = y;
    actor->bounds_w = TILE_WIDTH;
    actor->bounds_h = TILE_HEIGHT;

    if (i >= current_scene.num_actors) {
      current_scene.num_actors = i + 1;
    }

    return actor;
  }

  return NULL;
}

void destroy_actor(actor_t *actor) {
  if (actor == NULL) {
    return;
  }

  actor->active = false;
  while (current_scene.num_actors > 0 &&
         !actors[current_scene.num_actors - 1].active) {
    current_scene.num_actors--;
  }
}
