import { describe, expect, it } from "vitest";

import {
  readFinishCalibrationRequest,
  readSetActiveProfileRequest,
  readStartCalibrationRequest
} from "./input-profile-bridge-request-validation";

describe("input profile bridge request validation", () => {
  it("normalizes optional calibration display names", () => {
    expect(readStartCalibrationRequest(undefined)).toEqual({
      displayName: "iFacialMocap Profile",
      mode: "full"
    });
    expect(
      readFinishCalibrationRequest({ displayName: "  Remie / desk " })
    ).toEqual({
      displayName: "Remie / desk"
    });
  });

  it("rejects malformed calibration requests", () => {
    expect(() => readStartCalibrationRequest("bad")).toThrow(
      "Start calibration request must be an object."
    );
    expect(() =>
      readFinishCalibrationRequest({ displayName: 123 })
    ).toThrow("Input profile display name must be a string.");
  });

  it("validates calibration mode and section requests", () => {
    expect(
      readStartCalibrationRequest({
        displayName: "Desk",
        mode: "missing-only"
      })
    ).toEqual({
      displayName: "Desk",
      mode: "missing-only"
    });
    expect(
      readStartCalibrationRequest({
        mode: "section",
        section: "head-position"
      })
    ).toEqual({
      displayName: "iFacialMocap Profile",
      mode: "section",
      section: "head-position"
    });
    expect(() => readStartCalibrationRequest({ mode: "bad" })).toThrow(
      "Input profile calibration mode is unsupported."
    );
    expect(() =>
      readStartCalibrationRequest({ mode: "section" })
    ).toThrow("Section calibration request must include a section.");
    expect(() =>
      readStartCalibrationRequest({
        mode: "missing-only",
        section: "head-position"
      })
    ).toThrow("Calibration section can only be used with section mode.");
  });

  it("requires a non-empty active profile id", () => {
    expect(
      readSetActiveProfileRequest({ profileId: " profile_one " })
    ).toEqual({
      profileId: "profile_one"
    });
    expect(() => readSetActiveProfileRequest({ profileId: "" })).toThrow(
      "Input profile id must be a non-empty string."
    );
  });
});
