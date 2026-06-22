import { describe, expect, it } from "vitest";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type {
  RuntimePlayerMappingSlot,
  RuntimePlayerMappingTarget
} from "../../preload/model-mapping-bridge-contract";
import type { TrackingFrame } from "../../preload/input-tracking-frame-contract";
import type { InputProfile } from "../input-profiles/input-profile-document";
import { createTemporaryDefaultInputProfile } from "../input-profiles/input-profile-defaults";
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
  readonly headY?: number;
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
        x: 0,
        y: input.headY ?? 0,
        z: 0
      }
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
    "enabled" | "invert" | "strength"
  >> = {}
): RuntimePlayerMappingSlot {
  return {
    slotId,
    label: slotId,
    group: slotId.startsWith("mouth")
      ? "mouth"
      : slotId.startsWith("eye") || slotId.startsWith("gaze")
        ? "eyes"
        : "head",
    target: mappingTarget,
    enabled: options.enabled ?? true,
    invert: options.invert ?? false,
    strength: options.strength ?? 1,
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
