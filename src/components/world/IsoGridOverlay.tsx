import React, { memo } from "react";
import {
  isoToScreen,
  isoDiamondPoints,
  isoOriginX,
  ISO_TILE_H,
} from "shared/lib/entities/isoUtils";

interface IsoGridOverlayProps {
  /** Scene width in grid tiles. */
  mapWidth: number;
  /** Scene height in grid tiles. */
  mapHeight: number;
}

/**
 * SVG overlay that draws the isometric diamond grid for a scene in the editor.
 * Rendered as a transparent overlay on top of the background image.
 */
const IsoGridOverlay = memo(({ mapWidth, mapHeight }: IsoGridOverlayProps) => {
  const originX = isoOriginX(mapWidth);
  // Canvas height needed to fit the full diamond grid
  const canvasHeight = (mapWidth + mapHeight) * (ISO_TILE_H / 2);

  const polygons: JSX.Element[] = [];
  for (let ty = 0; ty < mapHeight; ty++) {
    for (let tx = 0; tx < mapWidth; tx++) {
      const { x, y } = isoToScreen(tx, ty);
      const sx = originX + x;
      const sy = y;
      polygons.push(
        <polygon
          key={`${tx}-${ty}`}
          points={isoDiamondPoints(sx, sy)}
          fill="none"
          stroke="rgba(100, 180, 255, 0.35)"
          strokeWidth={0.5}
        />,
      );
    }
  }

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: canvasHeight,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {polygons}
    </svg>
  );
});

IsoGridOverlay.displayName = "IsoGridOverlay";

export default IsoGridOverlay;
