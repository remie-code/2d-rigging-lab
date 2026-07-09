import type { RectDto } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import {
  mapV6ContourPointToStagePoint,
  mapV6ContourPointToUv
} from "./mesh-generation-v6-contour-pipeline.js";

// ---------------------------------------------------------------------------
// Shared v6 contour UV mapping: non-clamp + stage/UV symmetry (Wave108 D-gen)
//
// mapV6ContourPointToUv is the single UV helper the whole v6d family shares
// (v6d-contour-constrainautor, band-support-rings, adaptive-staggered-band, v6e,
// v6f). Wave108 D-gen drops its [0,1] clamp so covering-margin vertices pushed
// outside the texture spill past [0,1] into the transparent gutter, symmetric
// with the (already unclamped) stage mapping.
// ---------------------------------------------------------------------------

describe("mapV6ContourPointToUv (non-clamp)", () => {
  // Frozen-case shape (mouth_u): 17x16 texture, boundary vertices outside it.
  const textureWidth = 17;
  const textureHeight = 16;
  const bounds: RectDto = { x: 992, y: 519, width: 17, height: 16 };

  it("does NOT clamp UV to [0,1] for out-of-texture (overshoot) pixels", () => {
    for (const point of [
      { x: -3, y: -2 },
      { x: 20, y: 19 }
    ] as const) {
      const uv = mapV6ContourPointToUv(point, textureWidth, textureHeight);
      // Straight pixel/size, no clamp.
      expect(uv.x).toBeCloseTo(point.x / textureWidth, 6);
      expect(uv.y).toBeCloseTo(point.y / textureHeight, 6);
      expect(uv.x < 0 || uv.x > 1 || uv.y < 0 || uv.y > 1).toBe(true);
    }
  });

  it("maps stage and UV on the SAME pixel/size basis (stage = origin + size*ratio, uv = ratio)", () => {
    for (const point of [
      { x: -3, y: -2 },
      { x: 20, y: 19 },
      { x: 8, y: 8 }
    ] as const) {
      const ratioX = point.x / textureWidth;
      const ratioY = point.y / textureHeight;
      const uv = mapV6ContourPointToUv(point, textureWidth, textureHeight);
      const stage = mapV6ContourPointToStagePoint(point, bounds, textureWidth, textureHeight);
      expect(uv.x).toBeCloseTo(ratioX, 6);
      expect(uv.y).toBeCloseTo(ratioY, 6);
      expect(stage.x).toBeCloseTo(bounds.x + bounds.width * ratioX, 6);
      expect(stage.y).toBeCloseTo(bounds.y + bounds.height * ratioY, 6);
    }
  });

  it("keeps stage vertices unclamped: out-of-texture pixels extend outside bounds", () => {
    const below = mapV6ContourPointToStagePoint({ x: -3, y: -2 }, bounds, textureWidth, textureHeight);
    const above = mapV6ContourPointToStagePoint({ x: 20, y: 19 }, bounds, textureWidth, textureHeight);
    expect(below.x).toBeLessThan(bounds.x);
    expect(below.y).toBeLessThan(bounds.y);
    expect(above.x).toBeGreaterThan(bounds.x + bounds.width);
    expect(above.y).toBeGreaterThan(bounds.y + bounds.height);
  });

  it("leaves matching (in-texture) UV inside [0,1] — no regression when there is no overshoot", () => {
    for (const point of [
      { x: 0, y: 0 },
      { x: 8, y: 8 },
      { x: 17, y: 16 }
    ] as const) {
      const uv = mapV6ContourPointToUv(point, textureWidth, textureHeight);
      expect(uv.x).toBeGreaterThanOrEqual(0);
      expect(uv.x).toBeLessThanOrEqual(1);
      expect(uv.y).toBeGreaterThanOrEqual(0);
      expect(uv.y).toBeLessThanOrEqual(1);
    }
  });
});
