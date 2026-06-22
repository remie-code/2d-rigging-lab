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

export type CreateRuntimeParameterFrameInput = {
  readonly runtimeExportPayload: RuntimeExportLoadedPayload;
  readonly trackingFrame: TrackingFrame;
  readonly sessionNeutral: RuntimePlayerInputSessionNeutralSnapshot | null;
  readonly inputProfile: InputProfile;
  readonly slots: readonly RuntimePlayerMappingSlot[];
  readonly sequence: number;
  readonly producedAtMs?: number;
  readonly bodyFollowState?: RuntimePlayerBodyFollowState;
};

export function createRuntimeParameterFrame(
  input: CreateRuntimeParameterFrameInput
): RuntimePlayerLiveParameterFrame {
  const parameterValues: Record<string, number> = {};

  for (const slot of input.slots) {
    if (!slot.enabled || slot.target === null) {
      continue;
    }

    const definition = findSemanticSlotDefinition(slot.slotId);
    const value = createSlotParameterValue({
      definition,
      slot,
      trackingFrame: input.trackingFrame,
      sessionNeutral: input.sessionNeutral,
      calibration: input.inputProfile.calibration,
      ...(input.bodyFollowState === undefined
        ? {}
        : { bodyFollowState: input.bodyFollowState })
    });

    if (value === null || !Number.isFinite(value)) {
      continue;
    }

    parameterValues[slot.target.parameterId] = clamp(
      value,
      slot.target.min,
      slot.target.max
    );
  }

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

function createSlotParameterValue(input: {
  readonly definition: SemanticSlotDefinition;
  readonly slot: RuntimePlayerMappingSlot;
  readonly trackingFrame: TrackingFrame;
  readonly sessionNeutral: RuntimePlayerInputSessionNeutralSnapshot | null;
  readonly calibration: InputProfileCalibration;
  readonly bodyFollowState?: RuntimePlayerBodyFollowState;
}): number | null {
  switch (input.definition.sourceKind) {
    case "head-centered":
      return createHeadCenteredValue(input);
    case "gaze-centered":
      return createGazeCenteredValue(input);
    case "blink-left":
      return createWeightValue({
        slot: input.slot,
        activation: readRangeActivation(
          input.trackingFrame.blendshapes.eyeBlink_L,
          input.calibration.eyes.blinkLeftMin,
          input.calibration.eyes.blinkLeftMax
        )
      });
    case "blink-right":
      return createWeightValue({
        slot: input.slot,
        activation: readRangeActivation(
          input.trackingFrame.blendshapes.eyeBlink_R,
          input.calibration.eyes.blinkRightMin,
          input.calibration.eyes.blinkRightMax
        )
      });
    case "mouth-open":
      return createWeightValue({
        slot: input.slot,
        activation: readRangeActivation(
          input.trackingFrame.blendshapes.jawOpen,
          input.sessionNeutral?.jawOpen ?? input.calibration.mouth.jawOpenMin,
          input.calibration.mouth.jawOpenMax
        )
      });
    case "mouth-smile":
      return createWeightValue({
        slot: input.slot,
        activation: readRangeActivation(
          readMouthSmile(input.trackingFrame),
          input.sessionNeutral?.mouthSmile ?? input.calibration.mouth.smileMin,
          input.calibration.mouth.smileMax
        )
      });
    case "body-x":
      return createBodyXValue(input);
    case "body-z":
      return createBodyZValue(input);
  }
}

function createHeadCenteredValue(input: {
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
  return createCenteredTargetValue({
    slot: input.slot,
    normalized: readCenteredNormalizedValue({
      current: rotation[sign.axis],
      sessionNeutral: input.sessionNeutral?.headRotationEulerDeg?.[sign.axis],
      profileNeutral: input.calibration.headRotationEulerDeg.neutral[sign.axis],
      profileMin: input.calibration.headRotationEulerDeg.min[sign.axis],
      profileMax: input.calibration.headRotationEulerDeg.max[sign.axis],
      positiveDirection: sign.direction
    }),
    invert: input.slot.invert,
    strength: input.slot.strength
  });
}

function createGazeCenteredValue(input: {
  readonly definition: SemanticSlotDefinition;
  readonly slot: RuntimePlayerMappingSlot;
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

  return createCenteredTargetValue({
    slot: input.slot,
    normalized: readCenteredNormalizedValue({
      current,
      sessionNeutral,
      profileNeutral: input.calibration.eyes.neutral[sign.axis],
      profileMin: input.calibration.eyes.min[sign.axis],
      profileMax: input.calibration.eyes.max[sign.axis],
      positiveDirection: sign.direction
    }),
    invert: input.slot.invert,
    strength: input.slot.strength
  });
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

function createCenteredTargetValue(input: {
  readonly slot: RuntimePlayerMappingSlot;
  readonly normalized: number | null;
  readonly invert: boolean;
  readonly strength: number;
}): number | null {
  if (input.slot.target === null || input.normalized === null) {
    return null;
  }

  const adjusted = clamp(input.normalized, -1, 1) *
    (input.invert ? -1 : 1);
  const targetValue = adjusted >= 0
    ? input.slot.target.default +
      adjusted * (input.slot.target.max - input.slot.target.default)
    : input.slot.target.default +
      adjusted * (input.slot.target.default - input.slot.target.min);

  return input.slot.target.default +
    (targetValue - input.slot.target.default) * input.strength;
}

function createWeightValue(input: {
  readonly slot: RuntimePlayerMappingSlot;
  readonly activation: number | null;
}): number | null {
  if (input.activation === null || input.slot.target === null) {
    return null;
  }

  const targetActivation = input.slot.invert
    ? 1 - input.activation
    : input.activation;
  const targetValue = input.slot.target.min +
    targetActivation * (input.slot.target.max - input.slot.target.min);

  return input.slot.target.default +
    (targetValue - input.slot.target.default) * input.slot.strength;
}

function createBodyXValue(input: {
  readonly definition: SemanticSlotDefinition;
  readonly slot: RuntimePlayerMappingSlot;
  readonly trackingFrame: TrackingFrame;
  readonly sessionNeutral: RuntimePlayerInputSessionNeutralSnapshot | null;
  readonly calibration: InputProfileCalibration;
  readonly bodyFollowState?: RuntimePlayerBodyFollowState;
}): number | null {
  const rotation = input.trackingFrame.head.rotationEulerDeg;
  if (rotation === undefined) {
    return null;
  }

  const sign = getHeadPositiveSign(input.definition, input.calibration);
  const targetValue = createCenteredTargetValue({
    slot: input.slot,
    normalized: readCenteredNormalizedValue({
      current: rotation[sign.axis],
      sessionNeutral: input.sessionNeutral?.headRotationEulerDeg?.[sign.axis],
      profileNeutral: input.calibration.headRotationEulerDeg.neutral[sign.axis],
      profileMin: input.calibration.headRotationEulerDeg.min[sign.axis],
      profileMax: input.calibration.headRotationEulerDeg.max[sign.axis],
      positiveDirection: sign.direction
    }),
    invert: input.slot.invert,
    strength: input.slot.strength
  });

  return applyBodySmoothing(input.slot, targetValue, input.bodyFollowState);
}

function createBodyZValue(input: {
  readonly definition: SemanticSlotDefinition;
  readonly slot: RuntimePlayerMappingSlot;
  readonly trackingFrame: TrackingFrame;
  readonly sessionNeutral: RuntimePlayerInputSessionNeutralSnapshot | null;
  readonly calibration: InputProfileCalibration;
  readonly bodyFollowState?: RuntimePlayerBodyFollowState;
}): number | null {
  const rotationComponent = readBodyZRotationComponent(input);
  const positionComponent = readBodyZPositionComponent(input);

  if (rotationComponent === null && positionComponent === null) {
    return null;
  }

  const normalized = clamp(
    (rotationComponent ?? 0) + (positionComponent ?? 0),
    -1,
    1
  );
  const targetValue = createCenteredTargetValue({
    slot: input.slot,
    normalized,
    invert: false,
    strength: 1
  });

  return applyBodySmoothing(input.slot, targetValue, input.bodyFollowState);
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

function applyBodySmoothing(
  slot: RuntimePlayerMappingSlot,
  targetValue: number | null,
  bodyFollowState: RuntimePlayerBodyFollowState | undefined
): number | null {
  if (targetValue === null) {
    return null;
  }

  return bodyFollowState?.apply({
    slotId: slot.slotId,
    targetValue,
    smoothing: slot.smoothing ?? 0
  }) ?? targetValue;
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
