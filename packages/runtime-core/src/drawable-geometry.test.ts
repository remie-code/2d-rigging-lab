import { describe, expect, it } from "vitest";

import { computeBoundsFromVertices, createStableVertexHash } from "./drawable-geometry.js";

describe("drawable geometry helpers", () => {
  it("computes deterministic bounds from vertices", () => {
    expect(
      computeBoundsFromVertices([
        { x: 2, y: 5 },
        { x: -1, y: 4 },
        { x: 3, y: -2 }
      ])
    ).toEqual({
      x: -1,
      y: -2,
      width: 4,
      height: 7
    });
  });

  it("creates a stable precision-aware vertex hash without Node crypto", () => {
    const firstHash = createStableVertexHash(
      [
        { x: 1.000004, y: -0 },
        { x: 2, y: 3 }
      ],
      { hashPrecisionDecimals: 5 }
    );
    const secondHash = createStableVertexHash(
      [
        { x: 1, y: 0 },
        { x: 2, y: 3 }
      ],
      { hashPrecisionDecimals: 5 }
    );

    expect(firstHash).toBe(secondHash);
    expect(firstHash).toMatch(/^vhash_[0-9a-f]{8}_2$/);
  });

  it("normalizes values that round to negative zero before hashing", () => {
    const firstHash = createStableVertexHash([{ x: -0.000004, y: 0 }], { hashPrecisionDecimals: 5 });
    const secondHash = createStableVertexHash([{ x: 0, y: 0 }], { hashPrecisionDecimals: 5 });

    expect(firstHash).toBe(secondHash);
  });
});
