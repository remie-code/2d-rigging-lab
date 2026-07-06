import { describe, expect, it } from "vitest";

import { createTemporaryDefaultInputProfile } from "./input-profile-defaults";
import { parseInputProfileDocument } from "./input-profile-document-parser";

describe("parseInputProfileDocument", () => {
  it("loads old profiles without head position calibration", () => {
    const oldProfile = createTemporaryDefaultInputProfile(
      "2026-06-22T00:00:00.000Z"
    );
    const result = parseInputProfileDocument({
      schemaVersion: "runtime-player-input-profiles-v1",
      activeProfileId: oldProfile.profileId,
      profiles: [oldProfile]
    });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.document.profiles[0]?.calibration : null)
      .toMatchObject({
        headRotationEulerDeg: oldProfile.calibration.headRotationEulerDeg,
        eyes: oldProfile.calibration.eyes,
        mouth: oldProfile.calibration.mouth
      });
    expect(
      result.ok
        ? result.document.profiles[0]?.calibration.headPositionRaw
        : null
    ).toBeUndefined();
  });

  it("loads valid lateral-only head position calibration when present", () => {
    const profile = {
      ...createTemporaryDefaultInputProfile("2026-06-22T00:00:00.000Z"),
      calibration: {
        ...createTemporaryDefaultInputProfile("2026-06-22T00:00:00.000Z")
          .calibration,
        headPositionRaw: {
          neutral: { x: 0.05, y: 0, z: -0.7 },
          min: { x: -0.18, y: 0, z: -0.7 },
          max: { x: 0.34, y: 0, z: -0.7 },
          learnedSigns: {
            bodyLeft: { axis: "x", direction: -1 },
            bodyRight: { axis: "x", direction: 1 }
          }
        }
      }
    };
    const result = parseInputProfileDocument({
      schemaVersion: "runtime-player-input-profiles-v1",
      activeProfileId: profile.profileId,
      profiles: [profile]
    });

    expect(result.ok).toBe(true);
    expect(
      result.ok
        ? result.document.profiles[0]?.calibration.headPositionRaw
        : null
    ).toEqual(profile.calibration.headPositionRaw);
  });

  it("loads valid near/far head position calibration when present", () => {
    const profile = {
      ...createTemporaryDefaultInputProfile("2026-06-22T00:00:00.000Z"),
      calibration: {
        ...createTemporaryDefaultInputProfile("2026-06-22T00:00:00.000Z")
          .calibration,
        headPositionRaw: {
          neutral: { x: 0.05, y: 0, z: -0.7 },
          min: { x: -0.18, y: 0, z: -0.9 },
          max: { x: 0.34, y: 0, z: -0.4 },
          learnedSigns: {
            bodyLeft: { axis: "x", direction: -1 },
            bodyRight: { axis: "x", direction: 1 },
            bodyNear: { axis: "z", direction: 1 },
            bodyFar: { axis: "z", direction: -1 }
          }
        }
      }
    };
    const result = parseInputProfileDocument({
      schemaVersion: "runtime-player-input-profiles-v1",
      activeProfileId: profile.profileId,
      profiles: [profile]
    });

    expect(result.ok).toBe(true);
    expect(
      result.ok
        ? result.document.profiles[0]?.calibration.headPositionRaw
        : null
    ).toEqual(profile.calibration.headPositionRaw);
  });

  it("skips profiles with invalid head position calibration", () => {
    const profile = {
      ...createTemporaryDefaultInputProfile("2026-06-22T00:00:00.000Z"),
      calibration: {
        ...createTemporaryDefaultInputProfile("2026-06-22T00:00:00.000Z")
          .calibration,
        headPositionRaw: {
          neutral: { x: "bad", y: 0, z: 0 },
          min: { x: -0.1, y: 0, z: 0 },
          max: { x: 0.1, y: 0, z: 0 },
          learnedSigns: {}
        }
      }
    };
    const result = parseInputProfileDocument({
      schemaVersion: "runtime-player-input-profiles-v1",
      activeProfileId: profile.profileId,
      profiles: [profile]
    });

    expect(result).toMatchObject({
      ok: true,
      document: {
        profiles: []
      },
      warningMessages: [
        `Input profile ${profile.profileId} has invalid calibration data and was skipped.`,
        `Active input profile ${profile.profileId} was not found and was ignored.`
      ]
    });
  });

  it("skips profiles with missing head position learned signs", () => {
    const profile = createProfileWithHeadPositionRaw({
      learnedSigns: {
        bodyLeft: { axis: "x", direction: -1 }
      }
    });
    const result = parseInputProfileDocument({
      schemaVersion: "runtime-player-input-profiles-v1",
      activeProfileId: profile.profileId,
      profiles: [profile]
    });

    expect(result).toMatchObject({
      ok: true,
      document: {
        profiles: []
      },
      warningMessages: [
        `Input profile ${profile.profileId} has invalid calibration data and was skipped.`,
        `Active input profile ${profile.profileId} was not found and was ignored.`
      ]
    });
  });

  it("loads a profile with vowel calibration and preserves it verbatim", () => {
    const vowels = createVowelCalibration();
    const profile = {
      ...createTemporaryDefaultInputProfile("2026-06-22T00:00:00.000Z"),
      calibration: {
        ...createTemporaryDefaultInputProfile("2026-06-22T00:00:00.000Z")
          .calibration,
        vowels
      }
    };
    const result = parseInputProfileDocument({
      schemaVersion: "runtime-player-input-profiles-v1",
      activeProfileId: profile.profileId,
      profiles: [profile]
    });

    expect(result.ok).toBe(true);
    expect(
      result.ok ? result.document.profiles[0]?.calibration.vowels : null
    ).toEqual(vowels);
  });

  it("loads an old profile without vowel calibration (backward compatible)", () => {
    const oldProfile = createTemporaryDefaultInputProfile(
      "2026-06-22T00:00:00.000Z"
    );
    const result = parseInputProfileDocument({
      schemaVersion: "runtime-player-input-profiles-v1",
      activeProfileId: oldProfile.profileId,
      profiles: [oldProfile]
    });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.document.profiles.length : 0).toBe(1);
    expect(
      result.ok ? result.document.profiles[0]?.calibration.vowels : "unset"
    ).toBeUndefined();
  });

  it("drops malformed vowel calibration while keeping the rest of the profile", () => {
    const base = createTemporaryDefaultInputProfile(
      "2026-06-22T00:00:00.000Z"
    );
    const profile = {
      ...base,
      calibration: {
        ...base.calibration,
        // Missing the "o" label -> vowels dropped, profile still loads.
        vowels: {
          samples: {
            neutral: { jawOpen: 0.05 },
            a: { jawOpen: 0.6 },
            i: { jawOpen: 0.11 },
            u: { jawOpen: 0.15 },
            e: { jawOpen: 0.24 }
          }
        }
      }
    };
    const result = parseInputProfileDocument({
      schemaVersion: "runtime-player-input-profiles-v1",
      activeProfileId: profile.profileId,
      profiles: [profile]
    });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.document.profiles.length : 0).toBe(1);
    expect(
      result.ok ? result.document.profiles[0]?.calibration.vowels : "unset"
    ).toBeUndefined();
    expect(
      result.ok ? result.document.profiles[0]?.calibration.mouth : null
    ).toEqual(base.calibration.mouth);
  });

  it("skips profiles with invalid head position learned signs", () => {
    const profile = createProfileWithHeadPositionRaw({
      learnedSigns: {
        bodyLeft: { axis: "bad", direction: -1 },
        bodyRight: { axis: "x", direction: 1 }
      }
    });
    const result = parseInputProfileDocument({
      schemaVersion: "runtime-player-input-profiles-v1",
      activeProfileId: profile.profileId,
      profiles: [profile]
    });

    expect(result).toMatchObject({
      ok: true,
      document: {
        profiles: []
      },
      warningMessages: [
        `Input profile ${profile.profileId} has invalid calibration data and was skipped.`,
        `Active input profile ${profile.profileId} was not found and was ignored.`
      ]
    });
  });
});

function createVowelCalibration() {
  return {
    samples: {
      neutral: { jawOpen: 0.05, mouthFunnel: 0.02 },
      a: { jawOpen: 0.6, mouthLowerDown_L: 0.6, mouthLowerDown_R: 0.6 },
      i: { jawOpen: 0.11, mouthSmile_L: 0.12, mouthSmile_R: 0.12 },
      u: { jawOpen: 0.15, mouthFunnel: 0.46, mouthPucker: 0.4 },
      e: { jawOpen: 0.24, mouthLowerDown_L: 0.3, mouthLowerDown_R: 0.3 },
      o: { jawOpen: 0.27, mouthClose: 0.22, mouthPucker: 0.19 }
    },
    capturedAtIso: "2026-07-06T00:00:00.000Z",
    windowFrameCount: 8
  } as const;
}

function createProfileWithHeadPositionRaw(
  headPositionRaw: Record<string, unknown>
) {
  const profile = createTemporaryDefaultInputProfile(
    "2026-06-22T00:00:00.000Z"
  );

  return {
    ...profile,
    calibration: {
      ...profile.calibration,
      headPositionRaw: {
        neutral: { x: 0.05, y: 0, z: -0.7 },
        min: { x: -0.18, y: 0, z: -0.7 },
        max: { x: 0.34, y: 0, z: -0.7 },
        ...headPositionRaw
      }
    }
  };
}
