import { describe, expect, it } from "vitest";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type {
  RuntimePlayerMappingSlot,
  RuntimePlayerMappingTarget
} from "../../preload/model-mapping-bridge-contract";
import type { TrackingFrame } from "../../preload/input-tracking-frame-contract";
import type { InputProfile } from "../input-profiles/input-profile-document";
import { createTemporaryDefaultInputProfile } from "../input-profiles/input-profile-defaults";
import { RuntimePlayerBodyFollowState } from "./body-follow-state";
import { createRuntimeParameterFrame } from "./runtime-parameter-frame";

describe("Runtime Player parameter frame mapping", () => {
  it("creates finite sanitized values from tracking frame, neutral, profile, and slots", () => {
    const frame = createRuntimeParameterFrame({
      runtimeExportPayload: createPayload(),
      trackingFrame: createTrackingFrame({
        headY: -15,
        eyeY: -7.5,
        eyeBlinkLeft: 1,
        jawOpen: 0.4,
        mouthSmile: 0.35
      }),
      sessionNeutral: {
        capturedAtIso: "2026-06-22T00:00:01.000Z",
        frameTimestampMs: 900,
        headRotationEulerDeg: { x: 0, y: 0, z: 0 },
        leftEyeEulerDeg: { x: 0, y: 0, z: 0 },
        rightEyeEulerDeg: { x: 0, y: 0, z: 0 },
        jawOpen: 0,
        mouthSmile: 0
      },
      inputProfile: createTemporaryDefaultInputProfile(),
      slots: [
        createSlot("head-horizontal", target("param_face_angle_x", -30, 30, 0)),
        createSlot("gaze-horizontal", target("param_eyeball_x", -1, 1, 0)),
        createSlot("eye-blink-left", target("param_eye_left_open", 0, 1, 1), {
          invert: true
        }),
        createSlot("mouth-open", target("param_mouth_open", 0, 1, 0)),
        createSlot("mouth-smile", target("param_mouth_smile", 0, 1, 0))
      ],
      sequence: 1,
      producedAtMs: 1000
    });

    expect(frame).toEqual({
      schemaVersion: "runtime-player-live-parameter-frame-v1",
      runtimeExport: {
        packageId: "pkg_parameter_frame_test",
        packageRevision: 1,
        loadedAtIso: "2026-06-22T00:00:00.000Z"
      },
      sequence: 1,
      producedAtIso: "1970-01-01T00:00:01.000Z",
      sourceFrameTimestampMs: 950,
      parameterValues: {
        param_face_angle_x: 15,
        param_eyeball_x: 0.5,
        param_eye_left_open: 0,
        param_mouth_open: 0.5,
        param_mouth_smile: 0.5
      }
    });
  });

  it("applies invert, strength, disabled slots, and target clamps", () => {
    const frame = createRuntimeParameterFrame({
      runtimeExportPayload: createPayload(),
      trackingFrame: createTrackingFrame({
        headY: -999,
        jawOpen: 0.8
      }),
      sessionNeutral: null,
      inputProfile: createTemporaryDefaultInputProfile(),
      slots: [
        createSlot("head-horizontal", target("param_face_angle_x", -30, 30, 0), {
          invert: true,
          strength: 0.5
        }),
        createSlot("mouth-open", target("param_mouth_open", 0, 1, 0), {
          enabled: false
        })
      ],
      sequence: 2,
      producedAtMs: 1100
    });

    expect(frame.parameterValues).toEqual({
      param_face_angle_x: -15
    });
  });

  it("uses custom learned signs and profile ranges for centered values", () => {
    const frame = createRuntimeParameterFrame({
      runtimeExportPayload: createPayload(),
      trackingFrame: {
        ...createTrackingFrame({}),
        head: {
          rotationEulerDeg: {
            x: 15,
            y: 0,
            z: 0
          }
        }
      },
      sessionNeutral: null,
      inputProfile: createCustomSignProfile(),
      slots: [
        createSlot("head-horizontal", target("param_face_angle_x", -30, 30, 0))
      ],
      sequence: 3,
      producedAtMs: 1200
    });

    expect(frame.parameterValues).toEqual({
      param_face_angle_x: 15
    });
  });

  it("skips missing and non-finite source values without leaking invalid output", () => {
    const frame = createRuntimeParameterFrame({
      runtimeExportPayload: createPayload(),
      trackingFrame: {
        source: "ifacialmocap",
        timestampMs: 960,
        transport: "udp",
        blendshapes: {
          eyeBlink_L: Number.POSITIVE_INFINITY,
          jawOpen: Number.NaN,
          mouthSmile_L: Number.NaN,
          mouthSmile_R: 0.2
        },
        head: {}
      },
      sessionNeutral: null,
      inputProfile: createInvalidRangeProfile(),
      slots: [
        createSlot("head-horizontal", target("param_face_angle_x", -30, 30, 0)),
        createSlot("gaze-horizontal", target("param_eyeball_x", -1, 1, 0)),
        createSlot("eye-blink-left", target("param_eye_left_open", 0, 1, 1), {
          invert: true
        }),
        createSlot("mouth-open", target("param_mouth_open", 0, 1, 0)),
        createSlot("mouth-smile", target("param_mouth_smile", 0, 1, 0))
      ],
      sequence: 4,
      producedAtMs: 1300
    });

    expect(frame.parameterValues).toEqual({});
    expect(Object.values(frame.parameterValues).every(Number.isFinite)).toBe(true);
  });

  it("creates body x and body z values from calibrated head rotation and head position", () => {
    const bodyFollowState = new RuntimePlayerBodyFollowState();
    const frame = createRuntimeParameterFrame({
      runtimeExportPayload: createPayload(),
      trackingFrame: createTrackingFrame({
        headY: -30,
        headZ: -15,
        headPositionX: 0.2
      }),
      sessionNeutral: {
        capturedAtIso: "2026-06-22T00:00:01.000Z",
        frameTimestampMs: 900,
        headRotationEulerDeg: { x: 0, y: 0, z: 0 },
        headPositionRaw: { x: 0, y: 0, z: 0 }
      },
      inputProfile: createBodyPositionProfile(),
      slots: [
        createSlot("body-x", target("param_body_angle_x", -10, 10, 0), {
          strength: 0.35,
          smoothing: 0.75
        }),
        createSlot("body-z", target("param_body_angle_z", -10, 10, 0), {
          bodyRotationStrength: 0.25,
          bodyPositionStrength: 0.4,
          smoothing: 0.75
        })
      ],
      sequence: 5,
      producedAtMs: 1400,
      bodyFollowState
    });

    expect(frame.parameterValues).toEqual({
      param_body_angle_x: 3.5,
      param_body_angle_z: 6.5
    });
  });

  it("applies body z component strengths and component inversion", () => {
    const frame = createRuntimeParameterFrame({
      runtimeExportPayload: createPayload(),
      trackingFrame: createTrackingFrame({
        headZ: -15,
        headPositionX: 0.2
      }),
      sessionNeutral: {
        capturedAtIso: "2026-06-22T00:00:01.000Z",
        frameTimestampMs: 900,
        headRotationEulerDeg: { x: 0, y: 0, z: 0 },
        headPositionRaw: { x: 0, y: 0, z: 0 }
      },
      inputProfile: createBodyPositionProfile(),
      slots: [
        createSlot("body-z", target("param_body_angle_z", -10, 10, 0), {
          bodyRotationStrength: 0.5,
          bodyPositionStrength: 0.25,
          bodyRotationInvert: true,
          bodyPositionInvert: false
        })
      ],
      sequence: 6,
      producedAtMs: 1500
    });

    expect(frame.parameterValues).toEqual({
      param_body_angle_z: -2.5
    });
  });

  it("clamps body values and keeps all emitted body values finite", () => {
    const frame = createRuntimeParameterFrame({
      runtimeExportPayload: createPayload(),
      trackingFrame: createTrackingFrame({
        headY: -999,
        headZ: -999,
        headPositionX: 999
      }),
      sessionNeutral: null,
      inputProfile: createBodyPositionProfile(),
      slots: [
        createSlot("body-x", target("param_body_angle_x", -10, 10, 0), {
          strength: 2
        }),
        createSlot("body-z", target("param_body_angle_z", -10, 10, 0), {
          bodyRotationStrength: 2,
          bodyPositionStrength: 2
        })
      ],
      sequence: 7,
      producedAtMs: 1600
    });

    expect(frame.parameterValues).toEqual({
      param_body_angle_x: 10,
      param_body_angle_z: 10
    });
    expect(Object.values(frame.parameterValues).every(Number.isFinite)).toBe(true);
  });

  it("uses body z rotation when head position calibration is missing without blocking other slots", () => {
    const frame = createRuntimeParameterFrame({
      runtimeExportPayload: createPayload(),
      trackingFrame: createTrackingFrame({
        headY: -15,
        headZ: -15,
        jawOpen: 0.4
      }),
      sessionNeutral: null,
      inputProfile: createTemporaryDefaultInputProfile(),
      slots: [
        createSlot("head-horizontal", target("param_face_angle_x", -30, 30, 0)),
        createSlot("mouth-open", target("param_mouth_open", 0, 1, 0)),
        createSlot("body-z", target("param_body_angle_z", -10, 10, 0), {
          bodyRotationStrength: 0.25,
          bodyPositionStrength: 0.4
        })
      ],
      sequence: 8,
      producedAtMs: 1700
    });

    expect(frame.parameterValues).toEqual({
      param_face_angle_x: 15,
      param_mouth_open: 0.5,
      param_body_angle_z: 2.5
    });
  });

  it("smooths body follow values and reset removes stale lag state", () => {
    const bodyFollowState = new RuntimePlayerBodyFollowState();
    const runtimeExportPayload = createPayload();
    const inputProfile = createTemporaryDefaultInputProfile();
    const slots = [
      createSlot("body-x", target("param_body_angle_x", -10, 10, 0), {
        strength: 0.35,
        smoothing: 0.5
      })
    ];

    createRuntimeParameterFrame({
      runtimeExportPayload,
      trackingFrame: createTrackingFrame({ headY: 0 }),
      sessionNeutral: null,
      inputProfile,
      slots,
      sequence: 9,
      producedAtMs: 1800,
      bodyFollowState
    });
    const laggedFrame = createRuntimeParameterFrame({
      runtimeExportPayload,
      trackingFrame: createTrackingFrame({ headY: -30 }),
      sessionNeutral: null,
      inputProfile,
      slots,
      sequence: 10,
      producedAtMs: 1900,
      bodyFollowState
    });

    bodyFollowState.reset();
    const resetFrame = createRuntimeParameterFrame({
      runtimeExportPayload,
      trackingFrame: createTrackingFrame({ headY: -30 }),
      sessionNeutral: null,
      inputProfile,
      slots,
      sequence: 11,
      producedAtMs: 2000,
      bodyFollowState
    });

    expect(laggedFrame.parameterValues).toEqual({
      param_body_angle_x: 1.75
    });
    expect(resetFrame.parameterValues).toEqual({
      param_body_angle_x: 3.5
    });
  });
});

function createPayload(): RuntimeExportLoadedPayload {
  return {
    summary: {
      packageId: "pkg_parameter_frame_test",
      packageRevision: 1
    },
    loadedAtIso: "2026-06-22T00:00:00.000Z"
  } as unknown as RuntimeExportLoadedPayload;
}

function createTrackingFrame(input: {
  readonly headX?: number;
  readonly headY?: number;
  readonly headZ?: number;
  readonly headPositionX?: number;
  readonly eyeY?: number;
  readonly eyeBlinkLeft?: number;
  readonly jawOpen?: number;
  readonly mouthSmile?: number;
}): TrackingFrame {
  const frame: TrackingFrame = {
    source: "ifacialmocap",
    timestampMs: 950,
    sequence: 3,
    transport: "udp",
    blendshapes: {
      ...(input.eyeBlinkLeft === undefined ? {} : { eyeBlink_L: input.eyeBlinkLeft }),
      ...(input.jawOpen === undefined ? {} : { jawOpen: input.jawOpen }),
      ...(input.mouthSmile === undefined
        ? {}
        : {
            mouthSmile_L: input.mouthSmile,
            mouthSmile_R: input.mouthSmile
          })
    },
    head: {
      rotationEulerDeg: {
        x: input.headX ?? 0,
        y: input.headY ?? 0,
        z: input.headZ ?? 0
      },
      ...(input.headPositionX === undefined
        ? {}
        : { positionRaw: { x: input.headPositionX, y: 0, z: 0 } })
    }
  };

  if (input.eyeY === undefined) {
    return frame;
  }

  return {
    ...frame,
    eyes: {
      leftEulerDeg: { x: 0, y: input.eyeY, z: 0 },
      rightEulerDeg: { x: 0, y: input.eyeY, z: 0 }
    }
  };
}

function createBodyPositionProfile(): InputProfile {
  const profile = createTemporaryDefaultInputProfile();

  return {
    ...profile,
    calibration: {
      ...profile.calibration,
      headPositionRaw: {
        neutral: { x: 0, y: 0, z: 0 },
        min: { x: -0.2, y: 0, z: 0 },
        max: { x: 0.2, y: 0, z: 0 },
        learnedSigns: {
          bodyLeft: { axis: "x", direction: -1 },
          bodyRight: { axis: "x", direction: 1 }
        }
      }
    }
  };
}

function createCustomSignProfile(): InputProfile {
  const profile = createTemporaryDefaultInputProfile();

  return {
    ...profile,
    calibration: {
      ...profile.calibration,
      headRotationEulerDeg: {
        ...profile.calibration.headRotationEulerDeg,
        neutral: { x: 0, y: 0, z: 0 },
        min: { x: -10, y: -20, z: -15 },
        max: { x: 30, y: 20, z: 15 },
        learnedSigns: {
          ...profile.calibration.headRotationEulerDeg.learnedSigns,
          faceRight: { axis: "x", direction: 1 }
        }
      }
    }
  };
}

function createInvalidRangeProfile(): InputProfile {
  const profile = createTemporaryDefaultInputProfile();

  return {
    ...profile,
    calibration: {
      ...profile.calibration,
      eyes: {
        ...profile.calibration.eyes,
        blinkLeftMin: 1,
        blinkLeftMax: 1
      },
      mouth: {
        ...profile.calibration.mouth,
        jawOpenMin: 0.5,
        jawOpenMax: 0.5,
        smileMin: 0.25,
        smileMax: 0.25
      }
    }
  };
}

function createSlot(
  slotId: RuntimePlayerMappingSlot["slotId"],
  mappingTarget: RuntimePlayerMappingTarget,
  options: Partial<Pick<
    RuntimePlayerMappingSlot,
    | "enabled"
    | "invert"
    | "strength"
    | "smoothing"
    | "bodyRotationStrength"
    | "bodyPositionStrength"
    | "bodyRotationInvert"
    | "bodyPositionInvert"
  >> = {}
): RuntimePlayerMappingSlot {
  return {
    slotId,
    label: slotId,
    group: slotId.startsWith("body")
      ? "body"
      : slotId.startsWith("mouth")
      ? "mouth"
      : slotId.startsWith("eye") || slotId.startsWith("gaze")
        ? "eyes"
        : "head",
    target: mappingTarget,
    enabled: options.enabled ?? true,
    invert: options.invert ?? false,
    strength: options.strength ?? 1,
    ...(options.smoothing === undefined ? {} : { smoothing: options.smoothing }),
    ...(options.bodyRotationStrength === undefined
      ? {}
      : { bodyRotationStrength: options.bodyRotationStrength }),
    ...(options.bodyPositionStrength === undefined
      ? {}
      : { bodyPositionStrength: options.bodyPositionStrength }),
    ...(options.bodyRotationInvert === undefined
      ? {}
      : { bodyRotationInvert: options.bodyRotationInvert }),
    ...(options.bodyPositionInvert === undefined
      ? {}
      : { bodyPositionInvert: options.bodyPositionInvert }),
    status: options.enabled === false ? "disabled" : "mapped",
    warningMessages: []
  };
}

function target(
  parameterId: string,
  min: number,
  max: number,
  defaultValue: number
): RuntimePlayerMappingTarget {
  return {
    parameterId,
    displayName: parameterId,
    min,
    max,
    default: defaultValue
  };
}
