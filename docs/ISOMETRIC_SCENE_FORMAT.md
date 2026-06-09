# GBA Studio — Isometric Scene Compiler Contract

This document describes the exact C structures emitted by the GBA Studio
compiler for scenes whose `type` is `"ISOMETRIC"`.  The gba-engine runtime
must declare matching structures in `include/gba_scene.h`.

---

## Scene mode identifier

Scene type `ISOMETRIC` maps to integer `6` in the `sceneTypeIds` table
(`src/lib/compiler/compileData.ts`).

---

## C structures

### `gba_iso_scene_def_t`

```c
typedef struct gba_iso_scene_def_t {
  gba_scene_def_t base;   // Inherits all top-down fields (see gba_scene.h)
  uint8_t iso_tile_w;     // Projected tile width in screen pixels  (default 32)
  uint8_t iso_tile_h;     // Projected tile height in screen pixels (default 16)
} gba_iso_scene_def_t;
```

The `base` field is a fully-populated `gba_scene_def_t` (see
`appData/engine/gbavm/include/gba_scene.h`).  The runtime can safely cast
a `gba_iso_scene_def_t *` to `gba_scene_def_t *` when the projection fields
are not needed.

### Emitted example

```c
/* Isometric scene: actors/triggers use tile-grid coordinates.
 * iso_tile_w=32 iso_tile_h=16 */
static const gba_iso_scene_def_t scene_iso_village = {
  .base = {
    .width          = 16,
    .height         = 16,
    .type           = 6,          /* SCENE_TYPE_ISOMETRIC */
    .player_sprite_index = 0,
    .actor_count    = 2,
    .trigger_count  = 1,
    .tileset_len    = 512,
    .tileset        = scene_iso_village_tileset,
    .tilemap        = scene_iso_village_tilemap,
    .tilemap_attr   = NULL,
    .bg_palette     = scene_iso_village_bg_palette,
    .sprite_palette = scene_iso_village_sprite_palette,
    .collisions     = scene_iso_village_collisions,
    .actors         = scene_iso_village_actors,
    .sprite_count   = 1,
    .sprites        = scene_iso_village_sprites,
    .triggers       = scene_iso_village_triggers,
  },
  .iso_tile_w = 32,
  .iso_tile_h = 16,
};
```

---

## Coordinate model

### Grid coordinates

Isometric scenes use a **tile-grid** coordinate system.

| Field | Meaning |
|---|---|
| `x` | Column index, increases to the right on the ground plane |
| `y` | Row index, increases away from the viewer (depth) |
| `isoZ` | Height layer, 0 = ground; positive raises the entity upward |

Actor and trigger coordinates stored in `.gbsres` files are grid indices,
**not** screen pixels.

### Screen projection (editor preview)

```
screen_x = (tile_x - tile_y) * (iso_tile_w / 2)
screen_y = (tile_x + tile_y) * (iso_tile_h / 2) - iso_z * iso_tile_h
```

A horizontal origin offset is applied so tile (0, 0) appears at the top-centre
of the canvas:

```
canvas_x = scene_width * iso_tile_w / 2 + screen_x
canvas_y = screen_y
```

### Depth sorting (draw order)

Entities are depth-sorted by `tile_x + tile_y + iso_z` in ascending order
(lowest drawn first).  This matches the runtime's `iso_world_render()`.

---

## Actor fields

Actors in isometric scenes use the same `gba_actor_def_t` as top-down scenes.
The `x` and `y` fields carry **grid coordinates** (not pixel coordinates).
The optional `isoZ` editor field is stored in the project and compiled into
the `z` field of any extended runtime struct; the base struct ignores it
(defaults to 0).

---

## Trigger fields

Triggers use the same `gba_trigger_def_t`.  `x`, `y`, `w`, `h` are all
**grid coordinates**.  The runtime is responsible for converting them to screen
bounds using the projection above.

---

## Collision map

The collision map is a flat byte array of length `width × height`, indexed
`[y * width + x]`.  Non-zero bytes mark a tile as impassable.

---

## Runtime integration

The runtime should check `scene->type == SCENE_TYPE_ISOMETRIC` and, if true,
cast to `gba_iso_scene_def_t *` to access `iso_tile_w`/`iso_tile_h`.

```c
void load_iso_scene(const gba_scene_def_t *def) {
  if (def->type == SCENE_TYPE_ISOMETRIC) {
    const gba_iso_scene_def_t *iso = (const gba_iso_scene_def_t *)def;
    iso_world_init(def, iso->iso_tile_w, iso->iso_tile_h);
  }
}
```

---

## Version history

| Version | Change |
|---|---|
| 4.3.1 | Initial isometric scene format |
