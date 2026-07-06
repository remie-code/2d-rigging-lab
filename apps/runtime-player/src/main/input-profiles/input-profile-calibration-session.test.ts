import { describe, expect, it } from "vitest";

import type {
  RuntimePlayerInputCalibrationPromptKey
} from "../../preload/input-profile-bridge-contract";
import type { TrackingFrame } from "../../preload/input-tracking-frame-contract";
import { createTemporaryDefaultInputProfile } from "./input-profile-defaults";
import { InputProfileCalibrationSession } from "./input-profile-calibration-session";

describe("InputProfileCalibrationSession", () => {
  it("records guided prompt ranges and learned signs", () => {
    const session = new InputProfileCalibrationSession({
      sessionId: "calibration_test",
      displayName: "Desk",
      startedAtMs: 0
    });

    recordCurrentPrompt(session, "look-forward");
    recordCurrentPrompt(session, "face-left");
    recordCurrentPrompt(session, "face-right");
    recordCurrentPrompt(session, "look-up");
    recordCurrentPrompt(session, "look-down");
    recordCurrentPrompt(session, "tilt-left");
    recordCurrentPrompt(session, "tilt-right");
    recordCurrentPrompt(session, "eyes-left");
    recordCurrentPrompt(session, "eyes-right");
    recordCurrentPrompt(session, "eyes-up");
    recordCurrentPrompt(session, "eyes-down");
    recordCurrentPrompt(session, "blink");
    recordCurrentPrompt(session, "open-mouth");
    recordCurrentPrompt(session, "smile");
    recordCurrentPrompt(session, "head-position-left");
    recordCurrentPrompt(session, "head-position-right");
    recordCurrentPrompt(session, "head-position-near");
    recordCurrentPrompt(session, "head-position-far");
    recordCurrentPrompt(session, "vowel-neutral");
    recordCurrentPrompt(session, "vowel-a");
    recordCurrentPrompt(session, "vowel-i");
    recordCurrentPrompt(session, "vowel-u");
    recordCurrentPrompt(session, "vowel-e");
    recordCurrentPrompt(session, "vowel-o");

    expect(session.getSnapshot().canFinish).toBe(true);

    const profile = session.createProfile({
      profileId: "profile_desk",
      displayName: "Desk",
      createdAtIso: "2026-06-22T00:00:00.000Z"
    });

    expect(profile.calibration.headRotationEulerDeg.min).toMatchObject({
      x: -12,
      y: -16,
      z: -9
    });
    expect(profile.calibration.headRotationEulerDeg.max).toMatchObject({
      x: 11,
      y: 14,
      z: 8
    });
    expect(profile.calibration.headRotationEulerDeg.learnedSigns).toEqual({
      faceLeft: { axis: "y", direction: 1 },
      faceRight: { axis: "y", direction: -1 },
      lookUp: { axis: "x", direction: 1 },
      lookDown: { axis: "x", direction: -1 },
      tiltLeft: { axis: "z", direction: 1 },
      tiltRight: { axis: "z", direction: -1 }
    });
    expect(profile.calibration.eyes.learnedSigns).toEqual({
      eyesLeft: { axis: "y", direction: 1 },
      eyesRight: { axis: "y", direction: -1 },
      eyesUp: { axis: "x", direction: 1 },
      eyesDown: { axis: "x", direction: -1 }
    });
    expect(profile.calibration.eyes.blinkLeftMax).toBe(0.8);
    expect(profile.calibration.eyes.blinkRightMax).toBe(0.75);
    expect(profile.calibration.mouth.jawOpenMax).toBe(0.7);
    expect(profile.calibration.mouth.smileMax).toBe(0.6);
    expect(profile.calibration.headPositionRaw).toEqual({
      neutral: { x: 0, y: 0, z: 0 },
      min: { x: -0.18, y: 0, z: -0.28 },
      max: { x: 0.34, y: 0, z: 0.22 },
      learnedSigns: {
        bodyLeft: { axis: "x", direction: -1 },
        bodyRight: { axis: "x", direction: 1 },
        bodyNear: { axis: "z", direction: -1 },
        bodyFar: { axis: "z", direction: 1 }
      }
    });
    expect(profile.calibration.vowels?.windowFrameCount).toBe(8);
    expect(profile.calibration.vowels?.samples.a?.jawOpen).toBe(0.6);
    expect(profile.calibration.vowels?.samples.neutral?.jawOpen).toBe(0.05);
    expect(profile.calibration.vowels?.samples.o?.jawOpen).toBe(0.27);
  });

  it("advances the vowel section prompts through waiting -> ok and enables finish", () => {
    const session = new InputProfileCalibrationSession({
      sessionId: "calibration_test",
      displayName: "Desk",
      mode: "section",
      section: "vowels",
      targetProfileId: "profile_desk",
      promptKeys: [
        "look-forward",
        "vowel-neutral",
        "vowel-a",
        "vowel-i",
        "vowel-u",
        "vowel-e",
        "vowel-o"
      ],
      startedAtMs: 0
    });

    recordCurrentPrompt(session, "look-forward");

    // The vowel prompt starts waiting and needs a window of frames before "ok".
    expect(session.getSnapshot().currentPrompt?.key).toBe("vowel-neutral");
    expect(session.getSnapshot().currentPrompt?.status).toBe("waiting");

    const partial = session.recordSample(createFrame("vowel-neutral"));
    expect(partial.recorded).toBe(false);
    expect(partial.snapshot.currentPrompt?.status).toBe("needs-more");
    expect(partial.snapshot.currentPrompt?.sampleCount).toBe(1);

    const required =
      session.getSnapshot().currentPrompt?.requiredSampleCount ?? 0;
    for (let index = 1; index < required; index += 1) {
      session.recordSample(createFrame("vowel-neutral"));
    }
    expect(session.getSnapshot().currentPrompt?.status).toBe("ok");
    session.advancePrompt();

    recordCurrentPrompt(session, "vowel-a");
    recordCurrentPrompt(session, "vowel-i");
    recordCurrentPrompt(session, "vowel-u");
    recordCurrentPrompt(session, "vowel-e");
    recordCurrentPrompt(session, "vowel-o");

    expect(session.getSnapshot().canFinish).toBe(true);
  });

  it("does not complete a directional prompt until stable samples match", () => {
    const session = new InputProfileCalibrationSession({
      sessionId: "calibration_test",
      displayName: "Desk",
      startedAtMs: 0
    });
    recordCurrentPrompt(session, "look-forward");

    const first = session.recordSample(createFrame("face-left"));

    expect(first.snapshot.currentPrompt?.status).toBe("needs-more");
    expect(first.snapshot.currentPrompt?.sampleCount).toBe(1);

    const second = session.recordSample(createFrame("face-right"));

    expect(second.snapshot.currentPrompt?.status).toBe("needs-more");
    expect(second.snapshot.currentPrompt?.sampleCount).toBe(1);

    const third = session.recordSample(createFrame("face-right"));

    expect(third.snapshot.currentPrompt?.status).toBe("ok");
    expect(third.snapshot.currentPrompt?.sampleCount).toBe(2);
  });

  it("updates only the head position section for section calibration", () => {
    const session = new InputProfileCalibrationSession({
      sessionId: "calibration_test",
      displayName: "Desk",
      mode: "section",
      section: "head-position-left-right",
      targetProfileId: "profile_desk",
      promptKeys: [
        "look-forward",
        "head-position-left",
        "head-position-right"
      ],
      startedAtMs: 0
    });
    const baseProfile = {
      ...createTemporaryDefaultInputProfile("2026-06-22T00:00:00.000Z"),
      profileId: "profile_desk",
      displayName: "Desk"
    };

    expect(session.getSnapshot()).toMatchObject({
      mode: "section",
      section: "head-position-left-right",
      targetProfileId: "profile_desk",
      totalPromptCount: 3
    });

    recordCurrentPrompt(session, "look-forward");
    recordCurrentPrompt(session, "head-position-left");
    recordCurrentPrompt(session, "head-position-right");

    const updated = session.createUpdatedProfile({
      profile: baseProfile,
      updatedAtIso: "2026-06-23T00:00:00.000Z"
    });

    expect(updated.profileId).toBe("profile_desk");
    expect(updated.displayName).toBe("Desk");
    expect(updated.createdAtIso).toBe("2026-06-22T00:00:00.000Z");
    expect(updated.updatedAtIso).toBe("2026-06-23T00:00:00.000Z");
    expect(updated.calibration.headRotationEulerDeg).toEqual(
      baseProfile.calibration.headRotationEulerDeg
    );
    expect(updated.calibration.headPositionRaw?.learnedSigns).toEqual({
      bodyLeft: { axis: "x", direction: -1 },
      bodyRight: { axis: "x", direction: 1 }
    });
  });

  it("updates only near/far while preserving existing left/right calibration", () => {
    const session = new InputProfileCalibrationSession({
      sessionId: "calibration_test",
      displayName: "Desk",
      mode: "missing-only",
      section: "head-position-near-far",
      targetProfileId: "profile_desk",
      promptKeys: [
        "look-forward",
        "head-position-near",
        "head-position-far"
      ],
      startedAtMs: 0
    });
    const baseProfile = createProfileWithLateralHeadPosition();

    recordCurrentPrompt(session, "look-forward");
    recordCurrentPrompt(session, "head-position-near");
    recordCurrentPrompt(session, "head-position-far");

    const updated = session.createUpdatedProfile({
      profile: baseProfile,
      updatedAtIso: "2026-06-23T00:00:00.000Z"
    });

    expect(updated.calibration.headPositionRaw).toEqual({
      neutral: { x: 0, y: 0, z: 0 },
      min: { x: -0.18, y: 0, z: -0.28 },
      max: { x: 0.34, y: 0, z: 0.22 },
      learnedSigns: {
        bodyLeft: { axis: "x", direction: -1 },
        bodyRight: { axis: "x", direction: 1 },
        bodyNear: { axis: "z", direction: -1 },
        bodyFar: { axis: "z", direction: 1 }
      }
    });
  });

  it("supports missing-only left/right and near/far head position prompts", () => {
    const session = new InputProfileCalibrationSession({
      sessionId: "calibration_test",
      displayName: "Desk",
      mode: "missing-only",
      targetProfileId: "profile_desk",
      promptKeys: [
        "look-forward",
        "head-position-left",
        "head-position-right",
        "head-position-near",
        "head-position-far"
      ],
      startedAtMs: 0
    });

    expect(session.getSnapshot()).toMatchObject({
      mode: "missing-only",
      targetProfileId: "profile_desk",
      currentPrompt: {
        key: "look-forward"
      },
      totalPromptCount: 5
    });

    recordCurrentPrompt(session, "look-forward");
    recordCurrentPrompt(session, "head-position-left");
    recordCurrentPrompt(session, "head-position-right");
    recordCurrentPrompt(session, "head-position-near");
    recordCurrentPrompt(session, "head-position-far");

    expect(session.getSnapshot().canFinish).toBe(true);
  });
});

function recordCurrentPrompt(
  session: InputProfileCalibrationSession,
  promptKey: RuntimePlayerInputCalibrationPromptKey
): void {
  const current = session.getSnapshot().currentPrompt;
  expect(current?.key).toBe(promptKey);

  const sampleCount = current?.requiredSampleCount ?? 1;

  for (let index = 0; index < sampleCount; index += 1) {
    session.recordSample(createFrame(promptKey));
  }

  expect(session.getSnapshot().currentPrompt?.status).toBe("ok");
  session.advancePrompt();
}

function createFrame(
  promptKey: RuntimePlayerInputCalibrationPromptKey
): TrackingFrame {
  return {
    source: "ifacialmocap",
    transport: "udp",
    timestampMs: 1000,
    blendshapes: createBlendshapes(promptKey),
    head: {
      rotationEulerDeg: createHeadRotation(promptKey),
      positionRaw: createHeadPosition(promptKey)
    },
    eyes: {
      leftEulerDeg: createEyeRotation(promptKey),
      rightEulerDeg: createEyeRotation(promptKey)
    }
  };
}

function createProfileWithLateralHeadPosition() {
  const profile = {
    ...createTemporaryDefaultInputProfile("2026-06-22T00:00:00.000Z"),
    profileId: "profile_desk",
    displayName: "Desk"
  };

  return {
    ...profile,
    calibration: {
      ...profile.calibration,
      headPositionRaw: {
        neutral: { x: 0, y: 0, z: 0 },
        min: { x: -0.18, y: 0, z: 0 },
        max: { x: 0.34, y: 0, z: 0 },
        learnedSigns: {
          bodyLeft: { axis: "x", direction: -1 },
          bodyRight: { axis: "x", direction: 1 }
        }
      } as const
    }
  };
}

function createHeadRotation(
  promptKey: RuntimePlayerInputCalibrationPromptKey
) {
  switch (promptKey) {
    case "face-left":
      return { x: 0, y: 14, z: 0 };
    case "face-right":
      return { x: 0, y: -16, z: 0 };
    case "look-up":
      return { x: 11, y: 0, z: 0 };
    case "look-down":
      return { x: -12, y: 0, z: 0 };
    case "tilt-left":
      return { x: 0, y: 0, z: 8 };
    case "tilt-right":
      return { x: 0, y: 0, z: -9 };
    default:
      return { x: 0, y: 0, z: 0 };
  }
}

function createHeadPosition(
  promptKey: RuntimePlayerInputCalibrationPromptKey
) {
  switch (promptKey) {
    case "head-position-left":
      return { x: -0.18, y: 0, z: 0 };
    case "head-position-right":
      return { x: 0.34, y: 0, z: 0 };
    case "head-position-near":
      return { x: 0, y: 0, z: -0.28 };
    case "head-position-far":
      return { x: 0, y: 0, z: 0.22 };
    default:
      return { x: 0, y: 0, z: 0 };
  }
}

function createEyeRotation(
  promptKey: RuntimePlayerInputCalibrationPromptKey
) {
  switch (promptKey) {
    case "eyes-left":
      return { x: 0, y: 7, z: 0 };
    case "eyes-right":
      return { x: 0, y: -6, z: 0 };
    case "eyes-up":
      return { x: 5, y: 0, z: 0 };
    case "eyes-down":
      return { x: -5, y: 0, z: 0 };
    default:
      return { x: 0, y: 0, z: 0 };
  }
}

function createBlendshapes(
  promptKey: RuntimePlayerInputCalibrationPromptKey
): Record<string, number> {
  const vowelJawOpen = vowelJawOpenFor(promptKey);

  return {
    eyeBlink_L: promptKey === "blink" ? 0.8 : 0,
    eyeBlink_R: promptKey === "blink" ? 0.75 : 0,
    jawOpen:
      promptKey === "open-mouth"
        ? 0.7
        : vowelJawOpen !== null
          ? vowelJawOpen
          : 0,
    mouthSmile_L: promptKey === "smile" ? 0.6 : 0,
    mouthSmile_R: promptKey === "smile" ? 0.6 : 0
  };
}

function vowelJawOpenFor(
  promptKey: RuntimePlayerInputCalibrationPromptKey
): number | null {
  switch (promptKey) {
    case "vowel-neutral":
      return 0.05;
    case "vowel-a":
      return 0.6;
    case "vowel-i":
      return 0.11;
    case "vowel-u":
      return 0.15;
    case "vowel-e":
      return 0.24;
    case "vowel-o":
      return 0.27;
    default:
      return null;
  }
}
