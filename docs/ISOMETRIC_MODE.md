# GBA Studio — Isometric Mode

GBA Studio 4.3.1 introduces **Isometric Mode**, a new scene type that lets you
build games with a classic 2:1 isometric perspective.

---

## Table of contents

1. [Quick start](#quick-start)
2. [How it works](#how-it-works)
3. [Scene editor](#scene-editor)
4. [Actors](#actors)
5. [Triggers](#triggers)
6. [Collision maps](#collision-maps)
7. [Depth sorting](#depth-sorting)
8. [Compiling to GBA](#compiling-to-gba)
9. [Migration from earlier versions](#migration-from-earlier-versions)
10. [Example project](#example-project)

---

## Quick start

1. Open the **New Project** wizard.
2. Choose the **GBA Isometric Adventure** template.
3. Open the project — you will see a 20×15 isometric scene called *Iso Village*.
4. Explore the diamond grid, the NPC actor, and the triggers in the scene editor.
5. Compile and run on mGBA to see the isometric runtime in action.

To add isometric scenes to an existing project, set the **Scene type** dropdown
to **ISOMETRIC** in the scene properties panel.

---

## How it works

Isometric scenes use a 2:1 diamond projection.  Two constants define the tile
size in the editor preview:

| Constant | Value | Meaning |
|---|---|---|
| `ISO_TILE_W` | 32 px | Projected tile width |
| `ISO_TILE_H` | 16 px | Projected tile height |

The projection formula is:

```
screen_x = (tile_x - tile_y) * (ISO_TILE_W / 2)
screen_y = (tile_x + tile_y) * (ISO_TILE_H / 2) - iso_z * ISO_TILE_H
```

A horizontal origin offset is applied so that tile (0, 0) appears at the
top-centre of the canvas rather than the top-left corner:

```
canvas_x = scene_width * ISO_TILE_W / 2 + screen_x
```

---

## Scene editor

When a scene's type is `ISOMETRIC` the editor overlays a **diamond grid** on
the background image.  Each grid cell corresponds to one isometric tile.

- The grid is rendered as an SVG overlay (`IsoGridOverlay`) and is purely
  visual — it does not affect collision data.
- Panning, zoom, and the select/draw tools work the same as in top-down scenes.

---

## Actors

Actors placed in isometric scenes use **tile-grid coordinates**.  The `x` and
`y` fields store column and row indices, not screen pixels.

An additional optional field **`isoZ`** controls the height layer:

| `isoZ` | Meaning |
|---|---|
| `0` (default) | Ground level |
| `1` | One tile height above ground |
| `2+` | Further elevated |

`isoZ` affects both the screen position (entities appear higher) and the
depth-sort order.

**Actor screen position calculation:**

```
canvas_x = origin_x + (tile_x - tile_y) * 16
canvas_y = (tile_x + tile_y) * 8 - iso_z * 16
```

---

## Triggers

Triggers in isometric scenes use the same `x`, `y`, `width`, `height` fields
as top-down triggers, but all values are **grid coordinates**.

In the editor each trigger is rendered as a set of SVG diamond polygons (one
per covered tile) in a translucent orange colour.  The hit-target for
mouse interaction is placed at the first tile of the trigger.

---

## Collision maps

Collision data is a flat byte array indexed `[y * width + x]`.  Non-zero bytes
mark a tile as impassable.  The format is identical to top-down scenes.

The editor will warn in the build console if the collision map length does not
match `scene.width × scene.height`.

---

## Depth sorting

Entities (actors) in an isometric scene are depth-sorted so that tiles closer
to the viewer appear in front.  The sort key is:

```
depthKey = tile_x + tile_y + iso_z
```

Entities with a lower `depthKey` are drawn first (behind).  The editor
re-sorts the actor list whenever the scene or actor data changes.

---

## Compiling to GBA

Isometric scenes emit a `gba_iso_scene_def_t` struct instead of the standard
`gba_scene_def_t`.  See [ISOMETRIC_SCENE_FORMAT.md](ISOMETRIC_SCENE_FORMAT.md)
for the full struct contract.

Key differences from top-down:

- Actor `x`/`y` are grid indices (not pixel coordinates × 8).
- Trigger `x`/`y`/`w`/`h` are grid indices.
- Two extra fields `iso_tile_w` and `iso_tile_h` carry the projection
  constants (default 32 and 16).
- Scene type id = `6`.

---

## Migration from earlier versions

When opening a project created before GBA Studio 4.3.1, the migration
`420r3 → 431r1` runs automatically.  It adds `isoZ: 0` to every actor in
every scene.  Actors that already have an `isoZ` value are left unchanged.

---

## Example project

A complete walkthrough project is in `examples/isometric-adventure/`.  It
contains:

- An isometric scene (20×15 tiles)
- A player actor at tile (5, 5)
- An NPC actor at tile (8, 4) with dialogue
- A 3×3 dialogue trigger zone around the NPC
- A scene-exit trigger at tile (0, 0)
