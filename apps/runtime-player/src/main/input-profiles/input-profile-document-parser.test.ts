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

  it("loads valid head position calibration when present", () => {
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
