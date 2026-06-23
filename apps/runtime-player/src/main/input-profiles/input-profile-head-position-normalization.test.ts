import { describe, expect, it } from "vitest";

import { normalizeInputProfileHeadPositionDepth } from "./input-profile-head-position-normalization";

describe("normalizeInputProfileHeadPositionDepth", () => {
  it("returns positive values for the learned near z direction", () => {
    const calibration = {
      neutral: { x: 0, y: 0, z: 0 },
      min: { x: -0.2, y: 0, z: -0.5 },
      max: { x: 0.2, y: 0, z: 0.25 },
      learnedSigns: {
        bodyLeft: { axis: "x", direction: -1 },
        bodyRight: { axis: "x", direction: 1 },
        bodyNear: { axis: "z", direction: -1 },
        bodyFar: { axis: "z", direction: 1 }
      }
    } as const;

    expect(
      normalizeInputProfileHeadPositionDepth({
        current: { x: 0, y: 0, z: -0.25 },
        sessionNeutral: null,
        calibration
      })
    ).toBeCloseTo(0.5);
    expect(
      normalizeInputProfileHeadPositionDepth({
        current: { x: 0, y: 0, z: 0.25 },
        sessionNeutral: null,
        calibration
      })
    ).toBeCloseTo(-1);
  });

  it("supports reversed raw z direction and session neutral", () => {
    const calibration = {
      neutral: { x: 0, y: 0, z: 0 },
      min: { x: -0.2, y: 0, z: -0.25 },
      max: { x: 0.2, y: 0, z: 0.5 },
      learnedSigns: {
        bodyLeft: { axis: "x", direction: -1 },
        bodyRight: { axis: "x", direction: 1 },
        bodyNear: { axis: "z", direction: 1 },
        bodyFar: { axis: "z", direction: -1 }
      }
    } as const;

    expect(
      normalizeInputProfileHeadPositionDepth({
        current: { x: 0, y: 0, z: 0.35 },
        sessionNeutral: {
          capturedAtIso: "2026-06-23T00:00:00.000Z",
          frameTimestampMs: 1000,
          headPositionRaw: { x: 0, y: 0, z: 0.1 }
        },
        calibration
      })
    ).toBeCloseTo(0.5);
  });

  it("returns null until near/far signs are calibrated", () => {
    expect(
      normalizeInputProfileHeadPositionDepth({
        current: { x: 0, y: 0, z: -0.25 },
        sessionNeutral: null,
        calibration: {
          neutral: { x: 0, y: 0, z: 0 },
          min: { x: -0.2, y: 0, z: -0.5 },
          max: { x: 0.2, y: 0, z: 0.25 },
          learnedSigns: {
            bodyLeft: { axis: "x", direction: -1 },
            bodyRight: { axis: "x", direction: 1 }
          }
        } as const
      })
    ).toBeNull();
  });
});
