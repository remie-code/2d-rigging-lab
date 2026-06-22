import { describe, expect, it } from "vitest";

import { createTemporaryDefaultInputProfile } from "./input-profile-defaults";
import {
  createInputProfileCalibrationSectionStatuses,
  getCalibrationPromptKeysForSections,
  getMissingInputProfileCalibrationSections
} from "./input-profile-calibration-sections";

describe("input profile calibration sections", () => {
  it("marks old profiles as missing only head position", () => {
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
        key: "head-position",
        label: "Head position left/right",
        status: "missing"
      }
    ]);
    expect(getMissingInputProfileCalibrationSections(profile.calibration))
      .toEqual(["head-position"]);
  });

  it("uses only neutral and head position prompts for head position section", () => {
    expect(getCalibrationPromptKeysForSections(["head-position"])).toEqual([
      "look-forward",
      "head-position-left",
      "head-position-right"
    ]);
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
        .find((section) => section.key === "head-position")
    ).toEqual({
      key: "head-position",
      label: "Head position left/right",
      status: "missing"
    });
  });

  it("marks head position ready only when both lateral learned signs exist", () => {
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
        .find((section) => section.key === "head-position")
    ).toEqual({
      key: "head-position",
      label: "Head position left/right",
      status: "ready"
    });
  });
});
