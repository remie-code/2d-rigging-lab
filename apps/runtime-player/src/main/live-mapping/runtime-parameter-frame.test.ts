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
import { RuntimePlayerVowelLipsyncState } from "./vowel-lipsync-estimator";
import { createRuntimeParameterFrame } from "./runtime-parameter-frame";
import vowelCaptures from "../../../../../test_data/iFaceMocap/vowels/vowel-captures.json";

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

  it("emits all five vowels as s × normalized weight when vowel lipsync is enabled", () => {
    const frame = createRuntimeParameterFrame({
      runtimeExportPayload: createPayload(),
      trackingFrame: createVowelTrackingFrame("a"),
      sessionNeutral: null,
      inputProfile: createTemporaryDefaultInputProfile(),
      slots: [
        createSlot("mouth-open", target("param_mouth_open", 0, 1, 0)),
        ...createVowelSlots()
      ],
      sequence: 20,
      producedAtMs: 2000,
      vowelLipsyncEnabled: true,
      vowelLipsyncState: new RuntimePlayerVowelLipsyncState()
    });

    const vowelKeys = [
      "param_mouth_vowel_a",
      "param_mouth_vowel_i",
      "param_mouth_vowel_u",
      "param_mouth_vowel_e",
      "param_mouth_vowel_o"
    ] as const;

    // cp17 lifted: every vowel is now published (convex blend, softmax never
    // exactly 0). "a" dominates at its own reference.
    for (const key of vowelKeys) {
      expect(frame.parameterValues[key]).toBeGreaterThan(0);
    }
    const aValue = frame.parameterValues.param_mouth_vowel_a ?? 0;
    for (const key of vowelKeys) {
      if (key !== "param_mouth_vowel_a") {
        expect(aValue).toBeGreaterThan(frame.parameterValues[key] ?? 0);
      }
    }

    // Σ over vowels = s = mouth-open (each vowel = s × weight, Σ weight = 1).
    const vowelSum = vowelKeys.reduce(
      (total, key) => total + (frame.parameterValues[key] ?? 0),
      0
    );
    expect(vowelSum).toBeCloseTo(frame.parameterValues.param_mouth_open ?? 0, 6);
  });

  it("does not emit any vowel parameterId when vowel lipsync is disabled", () => {
    const frame = createRuntimeParameterFrame({
      runtimeExportPayload: createPayload(),
      trackingFrame: createVowelTrackingFrame("a"),
      sessionNeutral: null,
      inputProfile: createTemporaryDefaultInputProfile(),
      slots: createVowelSlots(),
      sequence: 21,
      producedAtMs: 2100,
      vowelLipsyncEnabled: false,
      vowelLipsyncState: new RuntimePlayerVowelLipsyncState()
    });

    expect(frame.parameterValues.param_mouth_vowel_a).toBeUndefined();
    expect(frame.parameterValues.param_mouth_vowel_i).toBeUndefined();
    expect(frame.parameterValues.param_mouth_vowel_u).toBeUndefined();
    expect(frame.parameterValues.param_mouth_vowel_e).toBeUndefined();
    expect(frame.parameterValues.param_mouth_vowel_o).toBeUndefined();
  });

  it("applies per-vowel strength as a pre-normalization bias without double-applying", () => {
    const trackingFrame = createVowelTrackingFrame("a");
    const inputProfile = createTemporaryDefaultInputProfile();
    const vowelKeys = [
      "param_mouth_vowel_a",
      "param_mouth_vowel_i",
      "param_mouth_vowel_u",
      "param_mouth_vowel_e",
      "param_mouth_vowel_o"
    ] as const;
    const run = (
      slots: readonly RuntimePlayerMappingSlot[],
      sequence: number
    ) =>
      createRuntimeParameterFrame({
        runtimeExportPayload: createPayload(),
        trackingFrame,
        sessionNeutral: null,
        inputProfile,
        slots: [createSlot("mouth-open", target("param_mouth_open", 0, 1, 0)), ...slots],
        sequence,
        producedAtMs: 2200 + sequence,
        vowelLipsyncEnabled: true,
        vowelLipsyncState: new RuntimePlayerVowelLipsyncState()
      });

    const baseline = run(createVowelSlots(), 22);
    // Boost "i" strength: its relative share must rise (pre-normalization bias).
    const boosted = run(
      [
        createSlot("mouth-vowel-a", target("param_mouth_vowel_a", 0, 1, 0)),
        createSlot("mouth-vowel-i", target("param_mouth_vowel_i", 0, 1, 0), {
          strength: 3
        }),
        createSlot("mouth-vowel-u", target("param_mouth_vowel_u", 0, 1, 0)),
        createSlot("mouth-vowel-e", target("param_mouth_vowel_e", 0, 1, 0)),
        createSlot("mouth-vowel-o", target("param_mouth_vowel_o", 0, 1, 0))
      ],
      23
    );

    expect(boosted.parameterValues.param_mouth_vowel_i ?? 0).toBeGreaterThan(
      baseline.parameterValues.param_mouth_vowel_i ?? 0
    );

    // Double-apply pin: strength is folded into the blend once. Σ vowels stays
    // = s (= mouth-open) even with a non-uniform strength. Were strength also
    // reapplied at the tail, Σ would be s × Σ(weight × strength) ≠ s.
    const sum = (values: Record<string, number>) =>
      vowelKeys.reduce((total, key) => total + (values[key] ?? 0), 0);
    expect(sum(baseline.parameterValues)).toBeCloseTo(
      baseline.parameterValues.param_mouth_open ?? 0,
      6
    );
    expect(sum(boosted.parameterValues)).toBeCloseTo(
      boosted.parameterValues.param_mouth_open ?? 0,
      6
    );
    // s itself is strength-independent, so mouth-open is unchanged by the boost.
    expect(boosted.parameterValues.param_mouth_open).toBeCloseTo(
      baseline.parameterValues.param_mouth_open ?? 0,
      6
    );
  });

  it("drops a vowel from the blend when its per-slot strength is 0", () => {
    const frame = createRuntimeParameterFrame({
      runtimeExportPayload: createPayload(),
      trackingFrame: createVowelTrackingFrame("a"),
      sessionNeutral: null,
      inputProfile: createTemporaryDefaultInputProfile(),
      slots: [
        createSlot("mouth-open", target("param_mouth_open", 0, 1, 0)),
        createSlot("mouth-vowel-a", target("param_mouth_vowel_a", 0, 1, 0)),
        createSlot("mouth-vowel-i", target("param_mouth_vowel_i", 0, 1, 0)),
        createSlot("mouth-vowel-u", target("param_mouth_vowel_u", 0, 1, 0)),
        createSlot("mouth-vowel-e", target("param_mouth_vowel_e", 0, 1, 0), {
          strength: 0
        }),
        createSlot("mouth-vowel-o", target("param_mouth_vowel_o", 0, 1, 0))
      ],
      sequence: 29,
      producedAtMs: 2900,
      vowelLipsyncEnabled: true,
      vowelLipsyncState: new RuntimePlayerVowelLipsyncState()
    });

    // "e" excluded from the blend (weight 0 → emitted 0); the rest still sum to s.
    expect(frame.parameterValues.param_mouth_vowel_e).toBe(0);
    const others = [
      "param_mouth_vowel_a",
      "param_mouth_vowel_i",
      "param_mouth_vowel_u",
      "param_mouth_vowel_o"
    ].reduce((total, key) => total + (frame.parameterValues[key] ?? 0), 0);
    expect(others).toBeCloseTo(frame.parameterValues.param_mouth_open ?? 0, 6);
  });

  it("drives mouth-open from the blend intensity s when vowel lipsync is enabled", () => {
    // For every vowel the capture-mean frame reproduces that vowel's reference, so
    // d_min ≈ 0 and s ≈ 1. The box therefore opens fully even for the closed vowel
    // "i" (jawOpen ≈ 0.11) — mouth_open = s (design vowel-lipsync-shape-blend §2.4).
    for (const label of ["a", "i"] as const) {
      const frame = createRuntimeParameterFrame({
        runtimeExportPayload: createPayload(),
        trackingFrame: createVowelTrackingFrame(label),
        sessionNeutral: null,
        inputProfile: createTemporaryDefaultInputProfile(),
        slots: [createSlot("mouth-open", target("param_mouth_open", 0, 1, 0))],
        sequence: 24,
        producedAtMs: 2400,
        vowelLipsyncEnabled: true,
        vowelLipsyncState: new RuntimePlayerVowelLipsyncState()
      });

      // s ≈ 1 for the capture mean; assert it clearly opens (well above the raw
      // jawOpen normalization the fallback would produce, see the "i" case below).
      expect(frame.parameterValues.param_mouth_open).toBeGreaterThan(0.9);
    }
  });

  it("opens the mouth-open box for the closed vowel 'i' far beyond the jawOpen fallback", () => {
    const trackingFrame = createVowelTrackingFrame("i");
    const inputProfile = createTemporaryDefaultInputProfile();
    const slots = [createSlot("mouth-open", target("param_mouth_open", 0, 1, 0))];

    const enabled = createRuntimeParameterFrame({
      runtimeExportPayload: createPayload(),
      trackingFrame,
      sessionNeutral: null,
      inputProfile,
      slots,
      sequence: 25,
      producedAtMs: 2500,
      vowelLipsyncEnabled: true,
      vowelLipsyncState: new RuntimePlayerVowelLipsyncState()
    });
    const disabled = createRuntimeParameterFrame({
      runtimeExportPayload: createPayload(),
      trackingFrame,
      sessionNeutral: null,
      inputProfile,
      slots,
      sequence: 26,
      producedAtMs: 2600,
      vowelLipsyncEnabled: false,
      vowelLipsyncState: new RuntimePlayerVowelLipsyncState()
    });

    // Enabled: s-driven → box wide open.
    expect(enabled.parameterValues.param_mouth_open).toBeGreaterThan(0.5);
    // Disabled: legacy jawOpen normalization → (jawOpen - jawOpenMin) / (max - min)
    // = 0.1102 / 0.8, box nearly closed. This gap is the whole point of Wave22.
    const jawOpenMean = readVowelJawOpenMean("i");
    const expectedFallback = jawOpenMean / inputProfile.calibration.mouth.jawOpenMax;
    expect(disabled.parameterValues.param_mouth_open).toBeCloseTo(expectedFallback, 5);
    expect(disabled.parameterValues.param_mouth_open).toBeLessThan(0.2);
    expect(enabled.parameterValues.param_mouth_open ?? 0).toBeGreaterThan(
      disabled.parameterValues.param_mouth_open ?? 0
    );
  });

  it("falls back to jawOpen normalization for mouth-open when vowel lipsync is disabled", () => {
    const frame = createRuntimeParameterFrame({
      runtimeExportPayload: createPayload(),
      trackingFrame: createTrackingFrame({ jawOpen: 0.4 }),
      sessionNeutral: null,
      inputProfile: createTemporaryDefaultInputProfile(),
      slots: [createSlot("mouth-open", target("param_mouth_open", 0, 1, 0))],
      sequence: 27,
      producedAtMs: 2700
      // vowelLipsyncEnabled omitted → defaults to false.
    });

    // jawOpen 0.4 over [0, 0.8] → 0.5, unchanged legacy behavior.
    expect(frame.parameterValues.param_mouth_open).toBeCloseTo(0.5, 6);
  });

  it("closes the mouth-open box (activation 0) when enabled but the vowel gate is closed", () => {
    const frame = createRuntimeParameterFrame({
      runtimeExportPayload: createPayload(),
      trackingFrame: createVowelTrackingFrame("neutral"),
      sessionNeutral: null,
      inputProfile: createTemporaryDefaultInputProfile(),
      slots: [
        createSlot("mouth-open", target("param_mouth_open", 0, 1, 0)),
        ...createVowelSlots()
      ],
      sequence: 28,
      producedAtMs: 2800,
      vowelLipsyncEnabled: true,
      vowelLipsyncState: new RuntimePlayerVowelLipsyncState()
    });

    // neutral activity (~0.0001) is below the gate → { s: 0, weightByVowel: 0… } →
    // activation 0. mouth-open never returns null, so a finite 0 is emitted.
    expect(frame.parameterValues.param_mouth_open).toBe(0);

    // cp17 lifted: with the gate closed the five vowel params must still each be
    // emitted as a finite 0 (not undefined). s = 0 → every activation 0 →
    // target.min (= 0). This pins that output-contract change at the mapping layer.
    for (const key of [
      "param_mouth_vowel_a",
      "param_mouth_vowel_i",
      "param_mouth_vowel_u",
      "param_mouth_vowel_e",
      "param_mouth_vowel_o"
    ] as const) {
      expect(key in frame.parameterValues).toBe(true);
      expect(frame.parameterValues[key]).toBe(0);
    }
  });

  it("shifts the dominant vowel immediately when the input vowel changes (no hysteresis)", () => {
    const state = new RuntimePlayerVowelLipsyncState();
    const inputProfile = createTemporaryDefaultInputProfile();
    const slots = [
      createSlot("mouth-open", target("param_mouth_open", 0, 1, 0)),
      ...createVowelSlots()
    ];
    let sequence = 30;
    const runFrame = (label: string) =>
      createRuntimeParameterFrame({
        runtimeExportPayload: createPayload(),
        trackingFrame: createVowelTrackingFrame(label),
        sessionNeutral: null,
        inputProfile,
        slots,
        sequence: sequence++,
        producedAtMs: 3000 + sequence,
        vowelLipsyncEnabled: true,
        vowelLipsyncState: state
      });

    // "i" input → "i" dominates the blend.
    const iFrame = runFrame("i");
    const iValue = iFrame.parameterValues.param_mouth_vowel_i ?? 0;
    expect(iValue).toBeGreaterThan(iFrame.parameterValues.param_mouth_vowel_a ?? 0);
    expect(iFrame.parameterValues.param_mouth_open).toBeGreaterThan(0.9);

    // A single "a" frame flips dominance immediately — no hysteresis debounce.
    const aFrame = runFrame("a");
    const aValue = aFrame.parameterValues.param_mouth_vowel_a ?? 0;
    expect(aValue).toBeGreaterThan(aFrame.parameterValues.param_mouth_vowel_i ?? 0);
    expect(aFrame.parameterValues.param_mouth_open).toBeGreaterThan(0.9);
  });

  it("emits mouth-open and the full vowel blend together (Σ vowels = s)", () => {
    const frame = createRuntimeParameterFrame({
      runtimeExportPayload: createPayload(),
      trackingFrame: createVowelTrackingFrame("a"),
      sessionNeutral: null,
      inputProfile: createTemporaryDefaultInputProfile(),
      slots: [
        createSlot("mouth-open", target("param_mouth_open", 0, 1, 0)),
        ...createVowelSlots()
      ],
      sequence: 40,
      producedAtMs: 3200,
      vowelLipsyncEnabled: true,
      vowelLipsyncState: new RuntimePlayerVowelLipsyncState()
    });

    // Box opens (s-driven); "a" dominates and every vowel is published (blend).
    expect(frame.parameterValues.param_mouth_open).toBeGreaterThan(0.9);
    const aValue = frame.parameterValues.param_mouth_vowel_a ?? 0;
    expect(aValue).toBeGreaterThan(0.5);
    const vowelSum = [
      "param_mouth_vowel_a",
      "param_mouth_vowel_i",
      "param_mouth_vowel_u",
      "param_mouth_vowel_e",
      "param_mouth_vowel_o"
    ].reduce((total, key) => total + (frame.parameterValues[key] ?? 0), 0);
    for (const key of [
      "param_mouth_vowel_i",
      "param_mouth_vowel_u",
      "param_mouth_vowel_e",
      "param_mouth_vowel_o"
    ]) {
      expect(aValue).toBeGreaterThan(frame.parameterValues[key] ?? 0);
    }
    expect(vowelSum).toBeCloseTo(frame.parameterValues.param_mouth_open ?? 0, 6);
  });
});

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

function readVowelJawOpenMean(label: string): number {
  const source = (
    vowelCaptures.labels as Readonly<
      Record<string, { readonly blendshapes: Record<string, { mean: number }> }>
    >
  )[label];
  if (source === undefined || source.blendshapes.jawOpen === undefined) {
    throw new Error(`Missing jawOpen mean for capture label: ${label}`);
  }

  return source.blendshapes.jawOpen.mean;
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
