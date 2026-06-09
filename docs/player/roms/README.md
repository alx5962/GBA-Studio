# Demo ROMs

Place compiled `.gba` demo ROMs here.

## How to add a demo

1. Build your GBA Studio project: **Build → Build ROM** (or `Run` to build + launch).
2. The `.gba` file lands in `<project>/build/gba/rom.gba`.
3. Rename it descriptively, e.g. `iso-village.gba`, and copy it here.
4. In `docs/player/index.html`, add an entry to the `DEMOS` array:

```js
{
  title: "Isometric Village",
  desc:  "Walk around the starter iso world from the GBA Studio template.",
  tag:   "Isometric",
  url:   "roms/iso-village.gba",
}
```

5. Commit and push — GitHub Pages picks it up automatically.

## Licensing

Only commit ROMs you have rights to distribute.
GBA Studio template ROMs are released under CC0 1.0 (see `appData/templates/*/assets/ASSET_CREDITS.md`).
