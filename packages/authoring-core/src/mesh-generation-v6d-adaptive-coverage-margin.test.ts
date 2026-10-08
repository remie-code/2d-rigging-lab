import { describe, expect, it } from "vitest";

import {
  ADAPTIVE_CONTOUR_MASK_EXPANSION_PIXELS,
  ADAPTIVE_CONTOUR_VIRTUAL_PADDING_PIXELS
} from "./mesh-generation-v6d-adaptive-contour-constrainautor.js";

// ---------------------------------------------------------------------------
// v6d-adaptive covering margin — natural (unbound) values (Wave108 D-gen,
// Option E)
//
// v6d pushes vertices outward via a texture-size-independent mask expansion.
// Under Option E the generator radius is NOT bound to any coverage constant;
// the transparent padding baked at import time (maxCoverageMarginSourcePixels)
// covers the ~2..3px overshoot. These tests pin the natural values and the
// structural relation (virtual padding must contain the mask expansion).
// ---------------------------------------------------------------------------

describe("v6d-adaptive covering margin natural values", () => {
  it("keeps the outward mask expansion at its natural 2px (unbound)", () => {
    expect(ADAPTIVE_CONTOUR_MASK_EXPANSION_PIXELS).toBe(2);
  });

  it("keeps the virtual padding at its natural 4px", () => {
    expect(ADAPTIVE_CONTOUR_VIRTUAL_PADDING_PIXELS).toBe(4);
  });

  it("keeps the virtual padding buffer >= the mask expansion it must contain", () => {
    expect(ADAPTIVE_CONTOUR_VIRTUAL_PADDING_PIXELS).toBeGreaterThanOrEqual(
      ADAPTIVE_CONTOUR_MASK_EXPANSION_PIXELS
    );
  });
});
