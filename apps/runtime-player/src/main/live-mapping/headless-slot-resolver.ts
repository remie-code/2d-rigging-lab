import type { RuntimePlayerMappingSlot } from "../../preload/model-mapping-bridge-contract";
import type { RuntimePlayerBodyFollowState } from "./body-follow-state";
import {
  findSemanticSlotDefinition,
  type SemanticSlotDefinition
} from "./semantic-slot-definitions";

/**
 * Headless semantic-slot resolver (C2 Domain A). This is the "写像" (mapping)
 * transform stage lifted out of createRuntimeParameterFrame so that BOTH the
 * tracking path and the autonomous generator drive the same slot→parameter
 * knowledge through one door (ユーザー裁定1: "まぶたの解決" の知識は一箇所).
 *
 * The resolver is head-less: it depends on neither TrackingFrame nor
 * InputProfile nor calibration. Every per-slot scalar is supplied from the
 * outside via {@link SemanticSlotActivations}. What a scalar means is fixed by
 * the slot's sourceKind and mirrors the exact scalar the tracking path already
 * feeds into the transform stage:
 *  - weight slots (blink-left/right, mouth-open, mouth-smile): activation in 0..1
 *  - centered slots (head-centered, gaze-centered, body-x, body-z): normalized in -1..1
 *  - mouth-vowel: the pre-blended activation (s × normalized per-vowel weight)
 *
 * A `null`/`undefined`/non-finite scalar, a disabled slot, or a slot with no
 * target is dropped silently (its parameterId is never written) — the same
 * "failure is silence" contract the tracking path has always had.
 */
export type SemanticSlotActivations = Readonly<
  Record<string, number | null | undefined>
>;

export type ResolveSemanticSlotParameterValuesInput = {
  readonly slots: readonly RuntimePlayerMappingSlot[];
  readonly activations: SemanticSlotActivations;
  /**
   * Stateful lag accumulator for body slots. Not TrackingFrame/calibration —
   * it is a smoothing memory keyed by slotId. Omitted by drivers (e.g. the
   * blink generator) that never touch body slots; then body slots that happen
   * to be present resolve to their un-smoothed target value.
   */
  readonly bodyFollowState?: RuntimePlayerBodyFollowState;
};

/**
 * Resolve `{ slotId → scalar } + slots` into sanitized `parameterValues`. The
 * output is byte-for-byte identical to the value createRuntimeParameterFrame
 * used to compute inline (guarded by the equivalence battery).
 */
export function resolveSemanticSlotParameterValues(
  input: ResolveSemanticSlotParameterValuesInput
): Record<string, number> {
  const parameterValues: Record<string, number> = {};

  for (const slot of input.slots) {
    if (!slot.enabled || slot.target === null) {
      continue;
    }

    const definition = findSemanticSlotDefinition(slot.slotId);
    const activation = input.activations[slot.slotId] ?? null;

    const value = resolveSlotValue({
      definition,
      slot,
      activation,
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

  return parameterValues;
}

function resolveSlotValue(input: {
  readonly definition: SemanticSlotDefinition;
  readonly slot: RuntimePlayerMappingSlot;
  readonly activation: number | null;
  readonly bodyFollowState?: RuntimePlayerBodyFollowState;
}): number | null {
  switch (input.definition.sourceKind) {
    case "head-centered":
    case "gaze-centered":
      return createCenteredTargetValue({
        slot: input.slot,
        normalized: input.activation,
        invert: input.slot.invert,
        strength: input.slot.strength
      });
    case "blink-left":
    case "blink-right":
    case "mouth-open":
    case "mouth-smile":
      return createWeightValue({
        slot: input.slot,
        activation: input.activation
      });
    case "mouth-vowel":
      return createVowelTargetValue({
        slot: input.slot,
        activation: input.activation
      });
    case "body-x":
      return applyBodySmoothing(
        input.slot,
        createCenteredTargetValue({
          slot: input.slot,
          normalized: input.activation,
          invert: input.slot.invert,
          strength: input.slot.strength
        }),
        input.bodyFollowState
      );
    case "body-z":
      return applyBodySmoothing(
        input.slot,
        createCenteredTargetValue({
          slot: input.slot,
          normalized: input.activation,
          invert: false,
          strength: 1
        }),
        input.bodyFollowState
      );
  }
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

/**
 * Vowel target mapping (design vowel-lipsync-shape-blend §2.1). Deliberately
 * NOT createWeightValue: the per-vowel strength was already folded into the
 * incoming activation (s × weight) as a pre-normalization bias, so the tail
 * strength multiply is skipped (double-count invariant §3.2 C); and the
 * target.default pivot is skipped so activation maps linearly across
 * target.min..max.
 */
function createVowelTargetValue(input: {
  readonly slot: RuntimePlayerMappingSlot;
  readonly activation: number | null;
}): number | null {
  if (input.activation === null || input.slot.target === null) {
    return null;
  }

  const targetActivation = input.slot.invert
    ? 1 - input.activation
    : input.activation;

  return (
    input.slot.target.min +
    targetActivation * (input.slot.target.max - input.slot.target.min)
  );
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
