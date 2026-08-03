import React, { memo } from "react";

interface TileGridOverlayProps {
  width: number;
  height: number;
}

const TileGridOverlay = memo(({ width, height }: TileGridOverlayProps) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: width * 8,
        height: height * 8,
        pointerEvents: "none",
        backgroundImage: `linear-gradient(to right, rgba(0, 0, 0, 0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 0, 0, 0.25) 1px, transparent 1px)`,
        backgroundSize: "8px 8px",
      }}
    />
  );
});

TileGridOverlay.displayName = "TileGridOverlay";

export default TileGridOverlay;
