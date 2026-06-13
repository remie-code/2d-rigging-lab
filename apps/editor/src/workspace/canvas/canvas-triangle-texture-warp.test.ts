import { describe, expect, it } from "vitest";

import { resolveTriangleTextureWarpTransform } from "./canvas-triangle-texture-warp";

describe("canvas triangle texture warp", () => {
  it("creates an affine transform from source texture triangle to destination canvas triangle", () => {
    const transform = resolveTriangleTextureWarpTransform({
      source: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 }
      ],
      destination: [
        { x: 20, y: 30 },
        { x: 60, y: 30 },
        { x: 20, y: 80 }
      ]
    });

    expect(transform).toEqual({
      a: 4,
      b: 0,
      c: 0,
      d: 5,
      e: 20,
      f: 30
    });
  });

  it("rejects degenerate triangles instead of producing an invalid transform", () => {
    expect(
      resolveTriangleTextureWarpTransform({
        source: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 10, y: 10 }
        ],
        destination: [
          { x: 20, y: 30 },
          { x: 60, y: 30 },
          { x: 20, y: 80 }
        ]
      })
    ).toBeUndefined();

    expect(
      resolveTriangleTextureWarpTransform({
        source: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 0, y: 10 }
        ],
        destination: [
          { x: 20, y: 30 },
          { x: 20, y: 30 },
          { x: 20, y: 30 }
        ]
      })
    ).toBeUndefined();
  });
});
