import { describe, expect, it } from "vitest";

import { interpolateGrid2dKeyform } from "./keyform-grid2d-interpolation.js";

describe("grid 2d keyform interpolation", () => {
  it("samples exact keys and bilinearly interpolates numeric patches", () => {
    const keys = [
      { x: -1, y: -1, statePatch: 0 },
      { x: 1, y: -1, statePatch: 10 },
      { x: -1, y: 1, statePatch: 20 },
      { x: 1, y: 1, statePatch: 30 }
    ];

    expect(interpolateGrid2dKeyform({ keys, x: -1, y: -1 })).toMatchObject({
      ok: true,
      source: "exact",
      sampledCoordinates: { x: -1, y: -1 },
      statePatch: 0
    });
    expect(interpolateGrid2dKeyform({ keys, x: 0, y: 0 })).toMatchObject({
      ok: true,
      source: "interpolated",
      sampledCoordinates: { x: 0, y: 0 },
      statePatch: 15
    });
  });

  it("bilinearly interpolates Vec2 array patches", () => {
    const keys = [
      { x: 0, y: 0, statePatch: [{ x: 0, y: 0 }] },
      { x: 1, y: 0, statePatch: [{ x: 2, y: 0 }] },
      { x: 0, y: 1, statePatch: [{ x: 0, y: 2 }] },
      { x: 1, y: 1, statePatch: [{ x: 2, y: 2 }] }
    ];

    expect(interpolateGrid2dKeyform({ keys, x: 0.25, y: 0.75 })).toMatchObject({
      ok: true,
      statePatch: [{ x: 0.5, y: 1.5 }]
    });
  });

  it("reports missing surrounding keys", () => {
    expect(
      interpolateGrid2dKeyform({
        keys: [
          { x: 0, y: 0, statePatch: 0 },
          { x: 1, y: 0, statePatch: 1 },
          { x: 0, y: 1, statePatch: 2 }
        ],
        x: 0.5,
        y: 0.5
      })
    ).toMatchObject({
      ok: false,
      code: "keyform.grid2dMissingKey",
      missingCoordinates: [{ x: 1, y: 1 }]
    });
  });
});
