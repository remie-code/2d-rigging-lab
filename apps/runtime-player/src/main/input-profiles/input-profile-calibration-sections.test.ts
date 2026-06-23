import { describe, expect, it } from "vitest";

import { createTemporaryDefaultInputProfile } from "./input-profile-defaults";
import {
  createInputProfileCalibrationSectionStatuses,
  getCalibrationPromptKeysForSections,
  getMissingInputProfileCalibrationSections
} from "./input-profile-calibration-sections";

describe("input profile calibration sections", () => {
  it("marks old profiles as missing both head position sections", () => {
    const profile = createTemporaryDefaultInputProfile(
      "2026-06-22T00:00:00.000Z"
    );

    expect(
      createInputProfileCalibrationSectionStatuses(profile.calibration)
    ).toEqual([
      {
        key: "head-rotation",
        label: "Head rotation",
        status: "ready"
      },
      {
        key: "eyes-mouth",
        label: "Eyes / mouth",
        status: "ready"
      },
      {
        key: "head-position-left-right",
        label: "Head position left/right",
        status: "missing"
      },
      {
        key: "head-position-near-far",
        label: "Head position near/far",
        status: "missing"
      }
    ]);
    expect(getMissingInputProfileCalibrationSections(profile.calibration))
      .toEqual(["head-position-left-right", "head-position-near-far"]);
  });

  it("uses only neutral and lateral prompts for left/right section", () => {
    expect(
      getCalibrationPromptKeysForSections(["head-position-left-right"])
    ).toEqual(["look-forward", "head-position-left", "head-position-right"]);
  });

  it("uses only neutral and depth prompts for near/far section", () => {
    expect(
      getCalibrationPromptKeysForSections(["head-position-near-far"])
    ).toEqual(["look-forward", "head-position-near", "head-position-far"]);
  });

  it("marks present head position without complete learned signs as missing", () => {
    const profile = createTemporaryDefaultInputProfile(
      "2026-06-22T00:00:00.000Z"
    );
    const calibration = {
      ...profile.calibration,
      headPositionRaw: {
        neutral: { x: 0, y: 0, z: 0 },
        min: { x: -0.1, y: 0, z: 0 },
        max: { x: 0.1, y: 0, z: 0 },
        learnedSigns: {
          bodyLeft: { axis: "x", direction: -1 }
        }
      } as const
    };

    expect(
      createInputProfileCalibrationSectionStatuses(calibration)
        .find((section) => section.key === "head-position-left-right")
    ).toEqual({
      key: "head-position-left-right",
      label: "Head position left/right",
      status: "missing"
    });
  });

  it("marks left/right ready and near/far missing for old lateral calibration", () => {
    const profile = createTemporaryDefaultInputProfile(
      "2026-06-22T00:00:00.000Z"
    );
    const calibration = {
      ...profile.calibration,
      headPositionRaw: {
        neutral: { x: 0, y: 0, z: 0 },
        min: { x: -0.1, y: 0, z: 0 },
        max: { x: 0.1, y: 0, z: 0 },
        learnedSigns: {
          bodyLeft: { axis: "x", direction: -1 },
          bodyRight: { axis: "x", direction: 1 }
        }
      } as const
    };

    expect(
      createInputProfileCalibrationSectionStatuses(calibration)
        .filter((section) => section.key.startsWith("head-position"))
    ).toEqual([
      {
        key: "head-position-left-right",
        label: "Head position left/right",
        status: "ready"
      },
      {
        key: "head-position-near-far",
        label: "Head position near/far",
        status: "missing"
      }
    ]);
  });

  it("marks both head position sections ready when depth signs exist", () => {
    const profile = createTemporaryDefaultInputProfile(
      "2026-06-22T00:00:00.000Z"
    );
    const calibration = {
      ...profile.calibration,
      headPositionRaw: {
        neutral: { x: 0, y: 0, z: 0 },
        min: { x: -0.1, y: 0, z: -0.2 },
        max: { x: 0.1, y: 0, z: 0.3 },
        learnedSigns: {
          bodyLeft: { axis: "x", direction: -1 },
          bodyRight: { axis: "x", direction: 1 },
          bodyNear: { axis: "z", direction: -1 },
          bodyFar: { axis: "z", direction: 1 }
        }
      } as const
    };

    expect(
      createInputProfileCalibrationSectionStatuses(calibration)
        .filter((section) => section.key.startsWith("head-position"))
    ).toEqual([
      {
        key: "head-position-left-right",
        label: "Head position left/right",
        status: "ready"
      },
      {
        key: "head-position-near-far",
        label: "Head position near/far",
        status: "ready"
      }
    ]);
  });
});
