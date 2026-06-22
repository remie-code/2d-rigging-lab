import { describe, expect, it } from "vitest";

import type {
  RuntimePlayerInputCalibrationPromptKey
} from "../../preload/input-profile-bridge-contract";
import type { TrackingFrame } from "../../preload/input-tracking-frame-contract";
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
});

function recordCurrentPrompt(
  session: InputProfileCalibrationSession,
  promptKey: RuntimePlayerInputCalibrationPromptKey
): void {
  expect(session.getSnapshot().currentPrompt?.key).toBe(promptKey);

  const sampleCount = promptKey === "look-forward" ? 1 : 2;

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
      rotationEulerDeg: createHeadRotation(promptKey)
    },
    eyes: {
      leftEulerDeg: createEyeRotation(promptKey),
      rightEulerDeg: createEyeRotation(promptKey)
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
  return {
    eyeBlink_L: promptKey === "blink" ? 0.8 : 0,
    eyeBlink_R: promptKey === "blink" ? 0.75 : 0,
    jawOpen: promptKey === "open-mouth" ? 0.7 : 0,
    mouthSmile_L: promptKey === "smile" ? 0.6 : 0,
    mouthSmile_R: promptKey === "smile" ? 0.6 : 0
  };
}
