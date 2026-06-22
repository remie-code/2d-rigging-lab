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

export type CreateRuntimeParameterFrameInput = {
  readonly runtimeExportPayload: RuntimeExportLoadedPayload;
  readonly trackingFrame: TrackingFrame;
  readonly sessionNeutral: RuntimePlayerInputSessionNeutralSnapshot | null;
  readonly inputProfile: InputProfile;
  readonly slots: readonly RuntimePlayerMappingSlot[];
  readonly sequence: number;
  readonly producedAtMs?: number;
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
      calibration: input.inputProfile.calibration
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
  return createCenteredValue({
    slot: input.slot,
    current: rotation[sign.axis],
    sessionNeutral: input.sessionNeutral?.headRotationEulerDeg?.[sign.axis],
    profileNeutral: input.calibration.headRotationEulerDeg.neutral[sign.axis],
    profileMin: input.calibration.headRotationEulerDeg.min[sign.axis],
    profileMax: input.calibration.headRotationEulerDeg.max[sign.axis],
    positiveDirection: sign.direction
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

  return createCenteredValue({
    slot: input.slot,
    current,
    sessionNeutral,
    profileNeutral: input.calibration.eyes.neutral[sign.axis],
    profileMin: input.calibration.eyes.min[sign.axis],
    profileMax: input.calibration.eyes.max[sign.axis],
    positiveDirection: sign.direction
  });
}

function createCenteredValue(input: {
  readonly slot: RuntimePlayerMappingSlot;
  readonly current: number;
  readonly sessionNeutral: number | null | undefined;
  readonly profileNeutral: number;
  readonly profileMin: number;
  readonly profileMax: number;
  readonly positiveDirection: -1 | 1;
}): number {
  const neutral = input.sessionNeutral ?? input.profileNeutral;
  const signedCurrent = (input.current - neutral) * input.positiveDirection;
  const signedProfileMin =
    (input.profileMin - input.profileNeutral) * input.positiveDirection;
  const signedProfileMax =
    (input.profileMax - input.profileNeutral) * input.positiveDirection;
  const positiveRange = Math.max(0.0001, signedProfileMin, signedProfileMax);
  const negativeRange = Math.max(0.0001, -signedProfileMin, -signedProfileMax);
  const normalized = signedCurrent >= 0
    ? signedCurrent / positiveRange
    : signedCurrent / negativeRange;
  const adjusted = clamp(normalized, -1, 1) * (input.slot.invert ? -1 : 1);

  return applyCenteredTargetValue(input.slot, adjusted);
}

function applyCenteredTargetValue(
  slot: RuntimePlayerMappingSlot,
  normalized: number
): number {
  if (slot.target === null) {
    return 0;
  }

  const targetValue = normalized >= 0
    ? slot.target.default + normalized * (slot.target.max - slot.target.default)
    : slot.target.default + normalized * (slot.target.default - slot.target.min);

  return slot.target.default +
    (targetValue - slot.target.default) * slot.strength;
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

function getHeadPositiveSign(
  definition: SemanticSlotDefinition,
  calibration: InputProfileCalibration
): InputProfileLearnedSign {
  if (definition.slotId === "head-horizontal") {
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
