/**
 * Isometric coordinate utilities for GBA Studio.
 *
 * The editor uses a standard 2:1 isometric projection:
 *
 *   screen_x = (tile_x - tile_y) * (ISO_TILE_W / 2)
 *   screen_y = (tile_x + tile_y) * (ISO_TILE_H / 2)
 *
 * Tile sizes are intentionally double the base GBA tile so that one
 * isometric grid cell covers the same visual area as one 8 px screen tile
 * in a standard top-down scene.
 */

/** Width of one isometric tile in screen pixels (editor projection). */
export const ISO_TILE_W = 32;

/** Height of one isometric tile in screen pixels (editor projection). */
export const ISO_TILE_H = 16;

/** Half-width used in transform calculations. */
const HW = ISO_TILE_W / 2;

/** Half-height used in transform calculations. */
const HH = ISO_TILE_H / 2;

/**
 * Convert isometric grid coordinates to editor screen pixel coordinates.
 * The result is the top-left corner of the diamond tile.
 *
 * @param tileX  - horizontal grid index (increases to the right on the ground)
 * @param tileY  - depth grid index (increases away from viewer)
 * @param isoZ   - height layer (0 = ground; positive values raise the tile)
 */
export function isoToScreen(
  tileX: number,
  tileY: number,
  isoZ = 0,
): { x: number; y: number } {
  return {
    x: (tileX - tileY) * HW,
    y: (tileX + tileY) * HH - isoZ * ISO_TILE_H,
  };
}

/**
 * Convert an editor screen pixel position back to the nearest isometric grid
 * tile. Inverse of isoToScreen (always on the ground plane, isoZ = 0).
 *
 * @param screenX - pixel x relative to the scene's isometric origin
 * @param screenY - pixel y relative to the scene's isometric origin
 */
export function screenToIso(
  screenX: number,
  screenY: number,
): { tileX: number; tileY: number } {
  // Solve the 2x2 linear system derived from isoToScreen:
  //   screenX = (tx - ty) * HW   →  tx - ty = screenX / HW
  //   screenY = (tx + ty) * HH   →  tx + ty = screenY / HH
  const sum = screenY / HH;
  const diff = screenX / HW;
  return {
    tileX: Math.round((sum + diff) / 2),
    tileY: Math.round((sum - diff) / 2),
  };
}

/**
 * Isometric origin offset within the scene canvas so that tile (0,0) appears
 * at the top-centre of the diamond grid rather than at the canvas origin.
 *
 * @param mapWidth  - scene width in tiles
 */
export function isoOriginX(mapWidth: number): number {
  return (mapWidth * ISO_TILE_W) / 2;
}

/**
 * Depth-sort key for isometric actors.
 * Higher values are drawn later (in front).
 *
 * @param tileX - actor's horizontal grid index
 * @param tileY - actor's depth grid index
 * @param isoZ  - actor's height layer
 */
export function isoDepthKey(tileX: number, tileY: number, isoZ = 0): number {
  return tileX + tileY + isoZ;
}

/**
 * Build the four corner points (screen-px) of a diamond tile for an SVG
 * `<polygon points="...">` attribute.
 *
 * @param screenX - screen x of the tile origin returned by isoToScreen
 * @param screenY - screen y of the tile origin returned by isoToScreen
 */
export function isoDiamondPoints(screenX: number, screenY: number): string {
  const top = `${screenX},${screenY}`;
  const right = `${screenX + HW},${screenY + HH}`;
  const bottom = `${screenX},${screenY + ISO_TILE_H}`;
  const left = `${screenX - HW},${screenY + HH}`;
  return `${top} ${right} ${bottom} ${left}`;
}
