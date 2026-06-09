import {
  ISO_TILE_W,
  ISO_TILE_H,
  isoToScreen,
  screenToIso,
  isoOriginX,
  isoDepthKey,
  isoDiamondPoints,
} from "shared/lib/entities/isoUtils";

describe("ISO_TILE constants", () => {
  test("ISO_TILE_W is 32", () => expect(ISO_TILE_W).toBe(32));
  test("ISO_TILE_H is 16", () => expect(ISO_TILE_H).toBe(16));
});

describe("isoToScreen", () => {
  test("origin tile (0,0) maps to (0,0)", () => {
    expect(isoToScreen(0, 0)).toEqual({ x: 0, y: 0 });
  });

  test("tile (1,0) moves right and down", () => {
    const { x, y } = isoToScreen(1, 0);
    expect(x).toBe(ISO_TILE_W / 2);   // 16
    expect(y).toBe(ISO_TILE_H / 2);   // 8
  });

  test("tile (0,1) moves left and down", () => {
    const { x, y } = isoToScreen(0, 1);
    expect(x).toBe(-ISO_TILE_W / 2);  // -16
    expect(y).toBe(ISO_TILE_H / 2);   // 8
  });

  test("isoZ raises entity upward", () => {
    const base = isoToScreen(2, 2, 0);
    const raised = isoToScreen(2, 2, 1);
    expect(raised.x).toBe(base.x);
    expect(raised.y).toBe(base.y - ISO_TILE_H);
  });
});

describe("screenToIso", () => {
  test("round-trips through isoToScreen", () => {
    const cases: [number, number][] = [[0, 0], [3, 0], [0, 3], [4, 7]];
    for (const [tx, ty] of cases) {
      const { x, y } = isoToScreen(tx, ty, 0);
      const result = screenToIso(x, y);
      expect(result.tileX).toBeCloseTo(tx, 5);
      expect(result.tileY).toBeCloseTo(ty, 5);
    }
  });
});

describe("isoOriginX", () => {
  test("centres a map of width 10", () => {
    expect(isoOriginX(10)).toBe(10 * ISO_TILE_W / 2);
  });
});

describe("isoDepthKey", () => {
  test("is sum of coords", () => {
    expect(isoDepthKey(3, 4, 0)).toBe(7);
  });

  test("isoZ raises depth key", () => {
    expect(isoDepthKey(1, 1, 2)).toBe(4);
  });

  test("higher depth should be drawn later", () => {
    const front = isoDepthKey(5, 5, 0);
    const back  = isoDepthKey(2, 2, 0);
    expect(front).toBeGreaterThan(back);
  });
});

describe("isoDiamondPoints", () => {
  test("returns a valid SVG points string (4 pairs)", () => {
    const pts = isoDiamondPoints(100, 50);
    // e.g. "116,58 100,66 84,58 100,50"
    const pairs = pts.trim().split(/\s+/);
    expect(pairs).toHaveLength(4);
    pairs.forEach((pair) => {
      const [x, y] = pair.split(",");
      expect(Number.isFinite(parseFloat(x))).toBe(true);
      expect(Number.isFinite(parseFloat(y))).toBe(true);
    });
  });
});
