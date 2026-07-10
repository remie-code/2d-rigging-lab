import type { RuntimePlayerInputSessionNeutralSnapshot } from "../../preload/input-profile-bridge-contract";
import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type { RuntimePlayerMappingSlot } from "../../preload/model-mapping-bridge-contract";
import type { TrackingFrame, TrackingVector3 } from "../../preload/input-tracking-frame-contract";
import type {
  InputProfile,
  InputProfileCalibration,
  InputProfileLearnedSign
} from "../input-profiles/input-profile-document";
import {
  findSemanticSlotDefinition,
  type SemanticSlotDefinition
} from "./semantic-slot-definitions";
import type { RuntimePlayerBodyFollowState } from "./body-follow-state";
import { resolveSemanticSlotParameterValues } from "./headless-slot-resolver";
import {
  defaultVowelReferenceVectors,
  extractVowelFeatureVector,
  RuntimePlayerVowelLipsyncState,
  type VowelEstimate,
  type VowelLabel
} from "./vowel-lipsync-estimator";
import { convertInputProfileVowelCalibrationToReferences } from "../input-profiles/input-profile-vowel-references";

export type CreateRuntimeParameterFrameInput = {
  readonly runtimeExportPayload: RuntimeExportLoadedPayload;
  readonly trackingFrame: TrackingFrame;
  readonly sessionNeutral: RuntimePlayerInputSessionNeutralSnapshot | null;
  readonly inputProfile: InputProfile;
  readonly slots: readonly RuntimePlayerMappingSlot[];
  readonly sequence: number;
  readonly producedAtMs?: number;
  readonly bodyFollowState?: RuntimePlayerBodyFollowState;
  /**
   * Whether vowel lipsync is enabled for the active model (design §3.2). When
   * false (or omitted) the estimator is short-circuited and no vowel
   * parameterId is emitted. Defaults to false to keep callers that never opt in
   * on the mouth-open-only path.
   */
  readonly vowelLipsyncEnabled?: boolean;
  readonly vowelLipsyncState?: RuntimePlayerVowelLipsyncState;
};

export function createRuntimeParameterFrame(
  input: CreateRuntimeParameterFrameInput
): RuntimePlayerLiveParameterFrame {
  const vowelLipsyncEnabled = input.vowelLipsyncEnabled ?? false;

  // Per-vowel strength is a normalization-stage bias (design §2.3): gather the
  // five mouth-vowel slots' strengths once so the estimator can fold them into
  // the blend BEFORE normalizing. Applied here means it must NOT be reapplied at
  // the tail (see the resolver's createVowelTargetValue) — that would
  // double-count strength.
  const vowelStrengthByVowel = collectVowelStrengths(input.slots);

  // Shared vowel estimator: run at most once per frame and memoize, so the five
  // vowel slots read a single classification result (design §3 "共有推定器").
  // When disabled the estimator is never invoked (short-circuit, zero cost).
  let vowelEstimate: VowelEstimate | null = null;
  const readVowelEstimate = (): VowelEstimate => {
    if (vowelEstimate === null) {
      const state = input.vowelLipsyncState ?? new RuntimePlayerVowelLipsyncState();
      vowelEstimate = state.estimate({
        features: extractVowelFeatureVector(input.trackingFrame),
        references:
          input.inputProfile.calibration.vowels === undefined
            ? defaultVowelReferenceVectors
            : convertInputProfileVowelCalibrationToReferences(
                input.inputProfile.calibration.vowels
              ),
        strengthByVowel: vowelStrengthByVowel
      });
    }

    return vowelEstimate;
  };

  // Stage 1 — activation: turn TrackingFrame + calibration (and the shared vowel
  // estimate / body-smoothing memory) into one scalar per slot. The scalar is
  // exactly what the transform stage used to receive inline; the head-less
  // resolver (stage 2) is agnostic to how it was produced, which is what lets
  // the autonomous generator reuse the same mapping knowledge.
  const activations: Record<string, number | null> = {};
  for (const slot of input.slots) {
    if (!slot.enabled || slot.target === null) {
      continue;
    }

    const definition = findSemanticSlotDefinition(slot.slotId);

    // Toggle OFF: do not emit any vowel parameterId (design §3.2 — keys are not
    // published rather than published as 0), and never run the estimator.
    if (definition.sourceKind === "mouth-vowel" && !vowelLipsyncEnabled) {
      continue;
    }

    activations[slot.slotId] = computeSlotActivation({
      definition,
      slot,
      trackingFrame: input.trackingFrame,
      sessionNeutral: input.sessionNeutral,
      calibration: input.inputProfile.calibration,
      ...(definition.sourceKind === "mouth-vowel" ||
      (definition.sourceKind === "mouth-open" && vowelLipsyncEnabled)
        ? { readVowelEstimate }
        : {})
    });
  }

  // Stage 2 — resolve: shared head-less slot→parameter transform.
  const parameterValues = resolveSemanticSlotParameterValues({
    slots: input.slots,
    activations,
    ...(input.bodyFollowState === undefined
      ? {}
      : { bodyFollowState: input.bodyFollowState })
  });

  const producedAtMs = input.producedAtMs ?? Date.now();

  return {
    schemaVersion: "runtime-player-live-parameter-frame-v1",
    runtimeExport: {
      packageId: input.runtimeExportPayload.summary.packageId,
      packageRevision: input.runtimeExportPayload.summary.packageRevision,
      loadedAtIso: input.runtimeExportPayload.loadedAtIso
    },
    sequence: input.sequence,
    producedAtIso: new Date(producedAtMs).toISOString(),
    sourceFrameTimestampMs: input.trackingFrame.timestampMs,
    parameterValues
  };
}

/**
 * Stage 1 dispatch. Returns the per-slot scalar the resolver consumes: an
 * activation (0..1) for weight/vowel kinds, a normalized value (-1..1) for
 * centered/body kinds, or `null` when the source is missing/non-finite. The
 * transform, invert/strength application, body smoothing, and clamp all live in
 * the resolver — this stage only reads the tracking signal.
 */
function computeSlotActivation(input: {
  readonly definition: SemanticSlotDefinition;
  readonly slot: RuntimePlayerMappingSlot;
  readonly trackingFrame: TrackingFrame;
  readonly sessionNeutral: RuntimePlayerInputSessionNeutralSnapshot | null;
  readonly calibration: InputProfileCalibration;
  readonly readVowelEstimate?: () => VowelEstimate;
}): number | null {
  switch (input.definition.sourceKind) {
    case "head-centered":
    case "body-x":
      // body-x shares head-rotation normalization with head-centered; the two
      // diverge only in the transform (body-x adds smoothing, done in stage 2).
      return computeHeadRotationNormalized(input);
    case "gaze-centered":
      return computeGazeNormalized(input);
    case "blink-left":
      return readRangeActivation(
        input.trackingFrame.blendshapes.eyeBlink_L,
        input.calibration.eyes.blinkLeftMin,
        input.calibration.eyes.blinkLeftMax
      );
    case "blink-right":
      return readRangeActivation(
        input.trackingFrame.blendshapes.eyeBlink_R,
        input.calibration.eyes.blinkRightMin,
        input.calibration.eyes.blinkRightMax
      );
    case "mouth-open":
      // Design vowel-lipsync-shape-blend §2.4 (generalizes Wave22): when vowel
      // lipsync is enabled+supported (signalled by readVowelEstimate being wired
      // in for this case), the box opening is driven by the blend intensity s so
      // it matches how the vowel shapes are authored ("開き切り前提"). A closed
      // vowel like "い" (low jawOpen) still opens the box because s ≈ 1 for a
      // well-formed vowel. When the gate is closed the activation is 0 (box
      // closes, s = 0). Otherwise (disabled/unsupported) keep the legacy jawOpen
      // normalization as a fallback.
      if (input.readVowelEstimate !== undefined) {
        return input.readVowelEstimate().s;
      }
      return readRangeActivation(
        input.trackingFrame.blendshapes.jawOpen,
        input.sessionNeutral?.jawOpen ?? input.calibration.mouth.jawOpenMin,
        input.calibration.mouth.jawOpenMax
      );
    case "mouth-smile":
      return readRangeActivation(
        readMouthSmile(input.trackingFrame),
        input.sessionNeutral?.mouthSmile ?? input.calibration.mouth.smileMin,
        input.calibration.mouth.smileMax
      );
    case "mouth-vowel":
      return computeVowelActivation(input);
    case "body-z":
      return computeBodyZNormalized(input);
  }
}

function computeHeadRotationNormalized(input: {
  readonly definition: SemanticSlotDefinition;
  readonly trackingFrame: TrackingFrame;
  readonly sessionNeutral: RuntimePlayerInputSessionNeutralSnapshot | null;
  readonly calibration: InputProfileCalibration;
}): number | null {
  const rotation = input.trackingFrame.head.rotationEulerDeg;
  if (rotation === undefined) {
    return null;
  }

  const sign = getHeadPositiveSign(input.definition, input.calibration);
  return readCenteredNormalizedValue({
    current: rotation[sign.axis],
    sessionNeutral: input.sessionNeutral?.headRotationEulerDeg?.[sign.axis],
    profileNeutral: input.calibration.headRotationEulerDeg.neutral[sign.axis],
    profileMin: input.calibration.headRotationEulerDeg.min[sign.axis],
    profileMax: input.calibration.headRotationEulerDeg.max[sign.axis],
    positiveDirection: sign.direction
  });
}

function computeGazeNormalized(input: {
  readonly definition: SemanticSlotDefinition;
  readonly trackingFrame: TrackingFrame;
  readonly sessionNeutral: RuntimePlayerInputSessionNeutralSnapshot | null;
  readonly calibration: InputProfileCalibration;
}): number | null {
  const sign = getGazePositiveSign(input.definition, input.calibration);
  const current = averageAxis([
    input.trackingFrame.eyes?.leftEulerDeg,
    input.trackingFrame.eyes?.rightEulerDeg
  ], sign.axis);

  if (current === null) {
    return null;
  }

  const sessionNeutral = averageAxis([
    input.sessionNeutral?.leftEyeEulerDeg,
    input.sessionNeutral?.rightEyeEulerDeg
  ], sign.axis);

  return readCenteredNormalizedValue({
    current,
    sessionNeutral,
    profileNeutral: input.calibration.eyes.neutral[sign.axis],
    profileMin: input.calibration.eyes.min[sign.axis],
    profileMax: input.calibration.eyes.max[sign.axis],
    positiveDirection: sign.direction
  });
}

function computeVowelActivation(input: {
  readonly definition: SemanticSlotDefinition;
  readonly readVowelEstimate?: () => VowelEstimate;
}): number | null {
  const vowelLabel = input.definition.vowelLabel;
  if (vowelLabel === undefined || input.readVowelEstimate === undefined) {
    return null;
  }

  const estimate = input.readVowelEstimate();

  // Convex-blend structure (design vowel-lipsync-shape-blend §2.1, cp17 lifted):
  // every vowel emits `s × normalized weight` (Σ over vowels = s). Per-vowel
  // strength was already folded into weightByVowel as a pre-normalization bias,
  // so it is NOT reapplied here (that would double-count strength — invariant
  // §3.2 C). The resolver maps this activation linearly across target.min..max.
  return estimate.s * estimate.weightByVowel[vowelLabel];
}

function computeBodyZNormalized(input: {
  readonly definition: SemanticSlotDefinition;
  readonly slot: RuntimePlayerMappingSlot;
  readonly trackingFrame: TrackingFrame;
  readonly sessionNeutral: RuntimePlayerInputSessionNeutralSnapshot | null;
  readonly calibration: InputProfileCalibration;
}): number | null {
  const rotationComponent = readBodyZRotationComponent(input);
  const positionComponent = readBodyZPositionComponent(input);

  if (rotationComponent === null && positionComponent === null) {
    return null;
  }

  return clamp(
    (rotationComponent ?? 0) + (positionComponent ?? 0),
    -1,
    1
  );
}

function readCenteredNormalizedValue(input: {
  readonly current: number;
  readonly sessionNeutral: number | null | undefined;
  readonly profileNeutral: number;
  readonly profileMin: number;
  readonly profileMax: number;
  readonly positiveDirection: -1 | 1;
}): number | null {
  if (
    !Number.isFinite(input.current) ||
    !Number.isFinite(input.profileNeutral) ||
    !Number.isFinite(input.profileMin) ||
    !Number.isFinite(input.profileMax) ||
    (
      input.sessionNeutral !== null &&
      input.sessionNeutral !== undefined &&
      !Number.isFinite(input.sessionNeutral)
    )
  ) {
    return null;
  }

  const neutral = input.sessionNeutral ?? input.profileNeutral;
  const signedCurrent = (input.current - neutral) * input.positiveDirection;
  const signedProfileMin =
    (input.profileMin - input.profileNeutral) * input.positiveDirection;
  const signedProfileMax =
    (input.profileMax - input.profileNeutral) * input.positiveDirection;
  const positiveRange = Math.max(
    0.0001,
    ...[signedProfileMin, signedProfileMax].filter(Number.isFinite)
  );
  const negativeRange = Math.max(
    0.0001,
    ...[-signedProfileMin, -signedProfileMax].filter(Number.isFinite)
  );
  const normalized = signedCurrent >= 0
    ? signedCurrent / positiveRange
    : signedCurrent / negativeRange;

  return clamp(normalized, -1, 1);
}

/**
 * Gather the per-vowel strength bias from the five mouth-vowel slots so the
 * estimator can apply it once, before normalizing the blend (design §2.3). A
 * vowel with no enabled/targeted slot defaults to strength 1 (neutral bias);
 * `strength = 0` drops that vowel from the blend. This must run before any
 * readVowelEstimate() call, since mouth-open may trigger the estimate before the
 * vowel slots are reached in the main loop.
 */
function collectVowelStrengths(
  slots: readonly RuntimePlayerMappingSlot[]
): Record<VowelLabel, number> {
  const strengths: Record<VowelLabel, number> = {
    a: 1,
    i: 1,
    u: 1,
    e: 1,
    o: 1
  };

  for (const slot of slots) {
    if (!slot.enabled || slot.target === null) {
      continue;
    }

    const definition = findSemanticSlotDefinition(slot.slotId);
    if (
      definition.sourceKind === "mouth-vowel" &&
      definition.vowelLabel !== undefined
    ) {
      strengths[definition.vowelLabel] = slot.strength;
    }
  }

  return strengths;
}

function readBodyZRotationComponent(input: {
  readonly definition: SemanticSlotDefinition;
  readonly slot: RuntimePlayerMappingSlot;
  readonly trackingFrame: TrackingFrame;
  readonly sessionNeutral: RuntimePlayerInputSessionNeutralSnapshot | null;
  readonly calibration: InputProfileCalibration;
}): number | null {
  const rotation = input.trackingFrame.head.rotationEulerDeg;
  if (rotation === undefined) {
    return null;
  }

  const sign = getHeadPositiveSign(input.definition, input.calibration);
  const normalized = readCenteredNormalizedValue({
    current: rotation[sign.axis],
    sessionNeutral: input.sessionNeutral?.headRotationEulerDeg?.[sign.axis],
    profileNeutral: input.calibration.headRotationEulerDeg.neutral[sign.axis],
    profileMin: input.calibration.headRotationEulerDeg.min[sign.axis],
    profileMax: input.calibration.headRotationEulerDeg.max[sign.axis],
    positiveDirection: sign.direction
  });

  if (normalized === null) {
    return null;
  }

  return normalized *
    (input.slot.bodyRotationInvert === true ? -1 : 1) *
    (input.slot.bodyRotationStrength ?? 0);
}

function readBodyZPositionComponent(input: {
  readonly slot: RuntimePlayerMappingSlot;
  readonly trackingFrame: TrackingFrame;
  readonly sessionNeutral: RuntimePlayerInputSessionNeutralSnapshot | null;
  readonly calibration: InputProfileCalibration;
}): number | null {
  const position = input.trackingFrame.head.positionRaw;
  const positionCalibration = input.calibration.headPositionRaw;
  const sign = positionCalibration?.learnedSigns.bodyRight;

  if (
    position === undefined ||
    positionCalibration === undefined ||
    sign === undefined
  ) {
    return null;
  }

  const normalized = readCenteredNormalizedValue({
    current: position[sign.axis],
    sessionNeutral: input.sessionNeutral?.headPositionRaw?.[sign.axis],
    profileNeutral: positionCalibration.neutral[sign.axis],
    profileMin: positionCalibration.min[sign.axis],
    profileMax: positionCalibration.max[sign.axis],
    positiveDirection: sign.direction
  });

  if (normalized === null) {
    return null;
  }

  return normalized *
    (input.slot.bodyPositionInvert === true ? -1 : 1) *
    (input.slot.bodyPositionStrength ?? 0);
}

function getHeadPositiveSign(
  definition: SemanticSlotDefinition,
  calibration: InputProfileCalibration
): InputProfileLearnedSign {
  if (
    definition.slotId === "head-horizontal" ||
    definition.slotId === "body-x"
  ) {
    return calibration.headRotationEulerDeg.learnedSigns.faceRight ??
      definition.fallbackPositiveSign!;
  }
  if (definition.slotId === "head-vertical") {
    return calibration.headRotationEulerDeg.learnedSigns.lookUp ??
      definition.fallbackPositiveSign!;
  }

  return calibration.headRotationEulerDeg.learnedSigns.tiltRight ??
    definition.fallbackPositiveSign!;
}

function getGazePositiveSign(
  definition: SemanticSlotDefinition,
  calibration: InputProfileCalibration
): InputProfileLearnedSign {
  if (definition.slotId === "gaze-horizontal") {
    return calibration.eyes.learnedSigns.eyesRight ??
      definition.fallbackPositiveSign!;
  }

  return calibration.eyes.learnedSigns.eyesUp ??
    definition.fallbackPositiveSign!;
}

function readRangeActivation(
  value: number | undefined,
  min: number,
  max: number
): number | null {
  if (value === undefined || !Number.isFinite(value)) {
    return null;
  }

  const range = max - min;
  if (!Number.isFinite(range) || Math.abs(range) < 0.0001) {
    return null;
  }

  return clamp((value - min) / range, 0, 1);
}

function readMouthSmile(frame: TrackingFrame): number | undefined {
  const left = frame.blendshapes.mouthSmile_L;
  const right = frame.blendshapes.mouthSmile_R;

  if (left !== undefined && right !== undefined) {
    return (left + right) / 2;
  }

  return left ?? right;
}

function averageAxis(
  values: readonly (TrackingVector3 | undefined)[],
  axis: keyof TrackingVector3
): number | null {
  const axisValues = values
    .map((value) => value?.[axis])
    .filter((value): value is number =>
      value !== undefined && Number.isFinite(value)
    );

  if (axisValues.length === 0) {
    return null;
  }

  return axisValues.reduce((sum, value) => sum + value, 0) / axisValues.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
