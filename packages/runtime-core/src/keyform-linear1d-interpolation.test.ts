import { describe, expect, it } from "vitest";

import { interpolateLinear1dKeyform } from "./keyform-linear1d-interpolation.js";

describe("linear 1d keyform interpolation", () => {
  it("samples exact keys, interpolates Vec2 arrays, and clamps endpoints deterministically", () => {
    const keys = [
      { value: -1, statePatch: [{ x: -2, y: 0 }] },
      { value: 1, statePatch: [{ x: 2, y: 4 }] }
    ];

    expect(interpolateLinear1dKeyform({ keys, parameterValue: -1 })).toMatchObject({
      ok: true,
      sampledValue: -1,
      source: "exact",
      statePatch: [{ x: -2, y: 0 }]
    });
    expect(interpolateLinear1dKeyform({ keys, parameterValue: 0 })).toMatchObject({
      ok: true,
      sampledValue: 0,
      source: "interpolated",
      statePatch: [{ x: 0, y: 2 }]
    });
    expect(interpolateLinear1dKeyform({ keys, parameterValue: 5 })).toMatchObject({
      ok: true,
      sampledValue: 1,
      source: "clamped-max",
      statePatch: [{ x: 2, y: 4 }]
    });
  });

  it("reports unsupported and incompatible patch shapes", () => {
    expect(
      interpolateLinear1dKeyform({
        keys: [
          { value: 0, statePatch: "hidden" },
          { value: 1, statePatch: "visible" }
        ],
        parameterValue: 0
      })
    ).toMatchObject({
      ok: false,
      code: "keyform.unsupportedPatchShape"
    });

    expect(
      interpolateLinear1dKeyform({
        keys: [
          { value: 0, statePatch: 0 },
          { value: 1, statePatch: { x: 1, y: 1 } }
        ],
        parameterValue: 0.5
      })
    ).toMatchObject({
      ok: false,
      code: "keyform.incompatiblePatchShape"
    });
  });
});
