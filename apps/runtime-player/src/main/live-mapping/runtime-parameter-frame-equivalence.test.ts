import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type {
  RuntimePlayerMappingSlot,
  RuntimePlayerMappingTarget
} from "../../preload/model-mapping-bridge-contract";
import type { TrackingFrame } from "../../preload/input-tracking-frame-contract";
import type { RuntimePlayerInputSessionNeutralSnapshot } from "../../preload/input-profile-bridge-contract";
import type { InputProfile } from "../input-profiles/input-profile-document";
import { createTemporaryDefaultInputProfile } from "../input-profiles/input-profile-defaults";
import { RuntimePlayerBodyFollowState } from "./body-follow-state";
import { RuntimePlayerVowelLipsyncState } from "./vowel-lipsync-estimator";
import { createRuntimeParameterFrame } from "./runtime-parameter-frame";
import vowelCaptures from "../../../../../test_data/iFaceMocap/vowels/vowel-captures.json";

// Equivalence guard for the C2 Domain A headless-resolver extraction. The golden
// map below is captured (UPDATE_RESOLVER_GOLDEN=1) from the PRE-refactor
// implementation of createRuntimeParameterFrame; after the transform stage is
// lifted into the shared headless resolver, this battery must reproduce byte-for
// -byte identical `parameterValues` for every representative tracking input.
// A single deviation here means the non-destructive extraction changed behavior.
const goldenPath = fileURLToPath(
  new URL("./runtime-parameter-frame-equivalence.golden.json", import.meta.url)
);

type Scenario = {
  readonly name: string;
  readonly run: () => Record<string, number>;
};

const scenarios: readonly Scenario[] = [
  {
    name: "blink-both-eyes-partial-and-full",
    run: () =>
      runFrame({
        trackingFrame: createTrackingFrame({
          eyeBlinkLeft: 1,
          eyeBlinkRight: 0.4
        }),
        slots: [
          createSlot("eye-blink-left", target("param_eye_left_open", 0, 1, 1), {
            invert: true
          }),
          createSlot("eye-blink-right", target("param_eye_right_open", 0, 1, 1), {
            invert: true
          })
        ]
      }).parameterValues
  },
  {
    name: "blink-open-eyes-zero-activation",
    run: () =>
      runFrame({
        trackingFrame: createTrackingFrame({
          eyeBlinkLeft: 0,
          eyeBlinkRight: 0
        }),
        slots: [
          createSlot("eye-blink-left", target("param_eye_left_open", 0, 1, 1), {
            invert: true
          }),
          createSlot("eye-blink-right", target("param_eye_right_open", 0, 1, 1), {
            invert: true
          })
        ]
      }).parameterValues
  },
  {
    name: "head-and-gaze-centered-with-session-neutral",
    run: () =>
      runFrame({
        trackingFrame: createTrackingFrame({
          headX: 5,
          headY: -15,
          headZ: -10,
          eyeY: -7.5
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
        slots: [
          createSlot("head-horizontal", target("param_face_angle_x", -30, 30, 0)),
          createSlot("head-vertical", target("param_face_angle_y", -30, 30, 0)),
          createSlot("head-tilt", target("param_face_angle_z", -30, 30, 0)),
          createSlot("gaze-vertical", target("param_eyeball_y", -1, 1, 0))
        ]
      }).parameterValues
  },
  {
    name: "head-centered-invert-strength-clamp",
    run: () =>
      runFrame({
        trackingFrame: createTrackingFrame({ headY: -999 }),
        slots: [
          createSlot("head-horizontal", target("param_face_angle_x", -30, 30, 0), {
            invert: true,
            strength: 0.5
          })
        ]
      }).parameterValues
  },
  {
    name: "custom-learned-signs-and-ranges",
    run: () =>
      runFrame({
        trackingFrame: {
          ...createTrackingFrame({}),
          head: { rotationEulerDeg: { x: 15, y: 0, z: 0 } }
        },
        inputProfile: createCustomSignProfile(),
        slots: [
          createSlot("head-horizontal", target("param_face_angle_x", -30, 30, 0))
        ]
      }).parameterValues
  },
  {
    name: "mouth-open-jawopen-fallback",
    run: () =>
      runFrame({
        trackingFrame: createTrackingFrame({ jawOpen: 0.4 }),
        slots: [createSlot("mouth-open", target("param_mouth_open", 0, 1, 0))]
      }).parameterValues
  },
  {
    name: "mouth-smile-averaged",
    run: () =>
      runFrame({
        trackingFrame: createTrackingFrame({ mouthSmile: 0.35 }),
        sessionNeutral: {
          capturedAtIso: "2026-06-22T00:00:01.000Z",
          frameTimestampMs: 900,
          headRotationEulerDeg: { x: 0, y: 0, z: 0 },
          jawOpen: 0,
          mouthSmile: 0
        },
        slots: [createSlot("mouth-smile", target("param_mouth_smile", 0, 1, 0))]
      }).parameterValues
  },
  {
    name: "mixed-face-eyes-mouth-slots",
    run: () =>
      runFrame({
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
        slots: [
          createSlot("head-horizontal", target("param_face_angle_x", -30, 30, 0)),
          createSlot("gaze-horizontal", target("param_eyeball_x", -1, 1, 0)),
          createSlot("eye-blink-left", target("param_eye_left_open", 0, 1, 1), {
            invert: true
          }),
          createSlot("mouth-open", target("param_mouth_open", 0, 1, 0)),
          createSlot("mouth-smile", target("param_mouth_smile", 0, 1, 0))
        ]
      }).parameterValues
  },
  {
    name: "disabled-slot-and-clamped-target",
    run: () =>
      runFrame({
        trackingFrame: createTrackingFrame({ headY: -999, jawOpen: 0.8 }),
        slots: [
          createSlot("head-horizontal", target("param_face_angle_x", -30, 30, 0), {
            invert: true,
            strength: 0.5
          }),
          createSlot("mouth-open", target("param_mouth_open", 0, 1, 0), {
            enabled: false
          })
        ]
      }).parameterValues
  },
  {
    name: "nan-infinity-invalid-range-silence",
    run: () =>
      runFrame({
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
        inputProfile: createInvalidRangeProfile(),
        slots: [
          createSlot("head-horizontal", target("param_face_angle_x", -30, 30, 0)),
          createSlot("gaze-horizontal", target("param_eyeball_x", -1, 1, 0)),
          createSlot("eye-blink-left", target("param_eye_left_open", 0, 1, 1), {
            invert: true
          }),
          createSlot("mouth-open", target("param_mouth_open", 0, 1, 0)),
          createSlot("mouth-smile", target("param_mouth_smile", 0, 1, 0))
        ]
      }).parameterValues
  },
  {
    name: "body-x-and-body-z-calibrated",
    run: () => {
      const bodyFollowState = new RuntimePlayerBodyFollowState();
      return runFrame({
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
        bodyFollowState
      }).parameterValues;
    }
  },
  {
    name: "body-z-component-strengths-and-inversion",
    run: () =>
      runFrame({
        trackingFrame: createTrackingFrame({ headZ: -15, headPositionX: 0.2 }),
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
        ]
      }).parameterValues
  },
  {
    name: "body-clamp-extremes",
    run: () =>
      runFrame({
        trackingFrame: createTrackingFrame({
          headY: -999,
          headZ: -999,
          headPositionX: 999
        }),
        inputProfile: createBodyPositionProfile(),
        slots: [
          createSlot("body-x", target("param_body_angle_x", -10, 10, 0), {
            strength: 2
          }),
          createSlot("body-z", target("param_body_angle_z", -10, 10, 0), {
            bodyRotationStrength: 2,
            bodyPositionStrength: 2
          })
        ]
      }).parameterValues
  },
  {
    name: "body-z-rotation-only-missing-position-calibration",
    run: () =>
      runFrame({
        trackingFrame: createTrackingFrame({
          headY: -15,
          headZ: -15,
          jawOpen: 0.4
        }),
        slots: [
          createSlot("head-horizontal", target("param_face_angle_x", -30, 30, 0)),
          createSlot("mouth-open", target("param_mouth_open", 0, 1, 0)),
          createSlot("body-z", target("param_body_angle_z", -10, 10, 0), {
            bodyRotationStrength: 0.25,
            bodyPositionStrength: 0.4
          })
        ]
      }).parameterValues
  },
  {
    name: "body-smoothing-lag-across-frames",
    run: () => {
      const bodyFollowState = new RuntimePlayerBodyFollowState();
      const inputProfile = createTemporaryDefaultInputProfile();
      const slots = [
        createSlot("body-x", target("param_body_angle_x", -10, 10, 0), {
          strength: 0.35,
          smoothing: 0.5
        })
      ];
      runFrame({
        trackingFrame: createTrackingFrame({ headY: 0 }),
        inputProfile,
        slots,
        bodyFollowState
      });
      return runFrame({
        trackingFrame: createTrackingFrame({ headY: -30 }),
        inputProfile,
        slots,
        bodyFollowState
      }).parameterValues;
    }
  },
  {
    name: "vowel-blend-enabled-a",
    run: () =>
      runFrame({
        trackingFrame: createVowelTrackingFrame("a"),
        slots: [
          createSlot("mouth-open", target("param_mouth_open", 0, 1, 0)),
          ...createVowelSlots()
        ],
        vowelLipsyncEnabled: true,
        vowelLipsyncState: new RuntimePlayerVowelLipsyncState()
      }).parameterValues
  },
  {
    name: "vowel-blend-enabled-i-with-strength-boost",
    run: () =>
      runFrame({
        trackingFrame: createVowelTrackingFrame("i"),
        slots: [
          createSlot("mouth-open", target("param_mouth_open", 0, 1, 0)),
          createSlot("mouth-vowel-a", target("param_mouth_vowel_a", 0, 1, 0)),
          createSlot("mouth-vowel-i", target("param_mouth_vowel_i", 0, 1, 0), {
            strength: 3
          }),
          createSlot("mouth-vowel-u", target("param_mouth_vowel_u", 0, 1, 0)),
          createSlot("mouth-vowel-e", target("param_mouth_vowel_e", 0, 1, 0), {
            strength: 0
          }),
          createSlot("mouth-vowel-o", target("param_mouth_vowel_o", 0, 1, 0))
        ],
        vowelLipsyncEnabled: true,
        vowelLipsyncState: new RuntimePlayerVowelLipsyncState()
      }).parameterValues
  },
  {
    name: "vowel-gate-closed-neutral",
    run: () =>
      runFrame({
        trackingFrame: createVowelTrackingFrame("neutral"),
        slots: [
          createSlot("mouth-open", target("param_mouth_open", 0, 1, 0)),
          ...createVowelSlots()
        ],
        vowelLipsyncEnabled: true,
        vowelLipsyncState: new RuntimePlayerVowelLipsyncState()
      }).parameterValues
  },
  {
    name: "vowel-disabled-drops-vowel-keys",
    run: () =>
      runFrame({
        trackingFrame: createVowelTrackingFrame("a"),
        slots: [
          createSlot("mouth-open", target("param_mouth_open", 0, 1, 0)),
          ...createVowelSlots()
        ],
        vowelLipsyncEnabled: false,
        vowelLipsyncState: new RuntimePlayerVowelLipsyncState()
      }).parameterValues
  },
  {
    name: "no-session-neutral-uses-profile-neutral",
    run: () =>
      runFrame({
        trackingFrame: createTrackingFrame({ headY: -15, jawOpen: 0.4 }),
        sessionNeutral: null,
        slots: [
          createSlot("head-horizontal", target("param_face_angle_x", -30, 30, 0)),
          createSlot("mouth-open", target("param_mouth_open", 0, 1, 0))
        ]
      }).parameterValues
  }
];

describe("headless resolver extraction equivalence", () => {
  const golden: Record<string, Record<string, number>> = existsSync(goldenPath)
    ? (JSON.parse(readFileSync(goldenPath, "utf8")) as Record<
        string,
        Record<string, number>
      >)
    : {};

  if (process.env.UPDATE_RESOLVER_GOLDEN === "1") {
    it("captures golden parameterValues from the current implementation", () => {
      const captured: Record<string, Record<string, number>> = {};
      for (const scenario of scenarios) {
        captured[scenario.name] = scenario.run();
      }
      writeFileSync(goldenPath, `${JSON.stringify(captured, null, 2)}\n`);
      expect(Object.keys(captured).length).toBe(scenarios.length);
    });
  } else {
    for (const scenario of scenarios) {
      it(`preserves parameterValues for ${scenario.name}`, () => {
        expect(scenario.name in golden).toBe(true);
        expect(scenario.run()).toEqual(golden[scenario.name]);
      });
    }
  }
});

function runFrame(input: {
  readonly trackingFrame: TrackingFrame;
  readonly sessionNeutral?: RuntimePlayerInputSessionNeutralSnapshot | null;
  readonly inputProfile?: InputProfile;
  readonly slots: readonly RuntimePlayerMappingSlot[];
  readonly bodyFollowState?: RuntimePlayerBodyFollowState;
  readonly vowelLipsyncEnabled?: boolean;
  readonly vowelLipsyncState?: RuntimePlayerVowelLipsyncState;
}) {
  return createRuntimeParameterFrame({
    runtimeExportPayload: createPayload(),
    trackingFrame: input.trackingFrame,
    sessionNeutral: input.sessionNeutral ?? null,
    inputProfile: input.inputProfile ?? createTemporaryDefaultInputProfile(),
    slots: input.slots,
    sequence: 1,
    producedAtMs: 1000,
    ...(input.bodyFollowState === undefined
      ? {}
      : { bodyFollowState: input.bodyFollowState }),
    ...(input.vowelLipsyncEnabled === undefined
      ? {}
      : { vowelLipsyncEnabled: input.vowelLipsyncEnabled }),
    ...(input.vowelLipsyncState === undefined
      ? {}
      : { vowelLipsyncState: input.vowelLipsyncState })
  });
}

function createVowelTrackingFrame(label: string): TrackingFrame {
  const source = (
    vowelCaptures.labels as Readonly<
      Record<string, { readonly blendshapes: Record<string, { mean: number }> }>
    >
  )[label];
  if (source === undefined) {
    throw new Error(`Missing capture label: ${label}`);
  }

  const blendshapes: Record<string, number> = {};
  for (const [name, value] of Object.entries(source.blendshapes)) {
    blendshapes[name] = value.mean;
  }

  return {
    source: "ifacialmocap",
    timestampMs: 970,
    transport: "udp",
    blendshapes,
    head: {}
  };
}

function createVowelSlots(): readonly RuntimePlayerMappingSlot[] {
  return [
    createSlot("mouth-vowel-a", target("param_mouth_vowel_a", 0, 1, 0)),
    createSlot("mouth-vowel-i", target("param_mouth_vowel_i", 0, 1, 0)),
    createSlot("mouth-vowel-u", target("param_mouth_vowel_u", 0, 1, 0)),
    createSlot("mouth-vowel-e", target("param_mouth_vowel_e", 0, 1, 0)),
    createSlot("mouth-vowel-o", target("param_mouth_vowel_o", 0, 1, 0))
  ];
}

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
  readonly eyeBlinkRight?: number;
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
      ...(input.eyeBlinkRight === undefined
        ? {}
        : { eyeBlink_R: input.eyeBlinkRight }),
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
  options: Partial<
    Pick<
      RuntimePlayerMappingSlot,
      | "enabled"
      | "invert"
      | "strength"
      | "smoothing"
      | "bodyRotationStrength"
      | "bodyPositionStrength"
      | "bodyRotationInvert"
      | "bodyPositionInvert"
    >
  > = {}
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
