import { describe, expect, it } from "vitest";

import { ADAPTIVE_CONTOUR_MASK_EXPANSION_PIXELS } from "./mesh-generation-v6d-adaptive-contour-constrainautor.js";
import {
  COVERAGE_MARGIN_SOFT_ALPHA_MASK_BLUR_PIXELS,
  maxCoverageMarginSourcePixels
} from "./mesh-generation-coverage-margin.js";
import {
  V7_MARGIN_RADIUS_MAX_PIXELS,
  V7_MARGIN_RADIUS_MIN_PIXELS,
  V7_MARGIN_RADIUS_TEXTURE_FRACTION
} from "./mesh-generation-v7-parameters.js";

// ---------------------------------------------------------------------------
// maxCoverageMarginSourcePixels — size-dependent covering-margin upper bound
// (Wave108 D-gen, Option E)
//
// The padding baked downstream is a function of layer size: the widest outward
// overshoot any live generator can produce. v7's r = clamp(0.012·longEdge,4,16)
// is that bound (it dominates v6d's constant ~2..3px at every size); the soft
// alpha-mask bleed (~1px) is added on top and the result is rounded up.
// ---------------------------------------------------------------------------

const blur = COVERAGE_MARGIN_SOFT_ALPHA_MASK_BLUR_PIXELS;

const expected = (longEdge: number): number =>
  Math.ceil(
    Math.min(
      Math.max(V7_MARGIN_RADIUS_TEXTURE_FRACTION * longEdge, V7_MARGIN_RADIUS_MIN_PIXELS),
      V7_MARGIN_RADIUS_MAX_PIXELS
    ) + blur
  );

describe("maxCoverageMarginSourcePixels", () => {
  it("saturates at the floor (ceil(4 + blur)) for tiny layers", () => {
    // 0.012 × 100 = 1.2 < MIN(4), so the clamp pins to 4; result = ceil(4 + 1).
    expect(maxCoverageMarginSourcePixels(100)).toBe(Math.ceil(V7_MARGIN_RADIUS_MIN_PIXELS + blur));
    expect(maxCoverageMarginSourcePixels(100)).toBe(5);
    expect(maxCoverageMarginSourcePixels(16)).toBe(5);
  });

  it("saturates at the ceiling (ceil(16 + blur)) for huge layers", () => {
    // 0.012 × 4096 = 49.15 > MAX(16), so the clamp pins to 16; result = ceil(16 + 1).
    expect(maxCoverageMarginSourcePixels(4096)).toBe(Math.ceil(V7_MARGIN_RADIUS_MAX_PIXELS + blur));
    expect(maxCoverageMarginSourcePixels(4096)).toBe(17);
    expect(maxCoverageMarginSourcePixels(2000)).toBe(17);
  });

  it("is long-edge-proportional between the clamp endpoints", () => {
    // 0.012 × 1000 = 12 (within [4,16]); result = ceil(12 + 1) = 13.
    expect(maxCoverageMarginSourcePixels(1000)).toBe(13);
    // Monotonic non-decreasing in the proportional band.
    expect(maxCoverageMarginSourcePixels(500)).toBeLessThanOrEqual(maxCoverageMarginSourcePixels(1000));
    expect(maxCoverageMarginSourcePixels(1000)).toBeLessThanOrEqual(maxCoverageMarginSourcePixels(1200));
  });

  it("matches the reference formula ceil(clamp(0.012·L,4,16)+blur) across sizes", () => {
    for (const longEdge of [16, 100, 333, 500, 1000, 1333, 2000, 4096]) {
      expect(maxCoverageMarginSourcePixels(longEdge)).toBe(expected(longEdge));
    }
  });

  it("always exceeds v6d's constant outward margin (~2..3px)", () => {
    // v6d's mask expansion (~2px, plus soft-mask spread ~3px) must stay strictly
    // inside the reserved padding at every size. The floor alone (5) beats 3.
    const v6dOutwardWorstCase = ADAPTIVE_CONTOUR_MASK_EXPANSION_PIXELS + 1; // ~3px
    for (const longEdge of [16, 100, 500, 1000, 4096]) {
      expect(maxCoverageMarginSourcePixels(longEdge)).toBeGreaterThan(v6dOutwardWorstCase);
    }
  });
});
