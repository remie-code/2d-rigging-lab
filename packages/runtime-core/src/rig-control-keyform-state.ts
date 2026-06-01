import type {
  DiagnosticDto,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";

import { createRuntimeDiagnostic } from "./diagnostics.js";
import type { RuntimeKeyformSample } from "./keyform-sampling.js";
import type { NormalizedRotation2dRigControl } from "./normalized-runtime-graph.js";

export interface Rotation2dLocalState {
  readonly pivot: Vec2Dto;
  readonly angleDegrees: number;
  readonly translation: Vec2Dto;
  readonly scale: Vec2Dto;
}

export const applyRotation2dSamples = (input: {
  readonly rigControl: NormalizedRotation2dRigControl;
  readonly samples: readonly RuntimeKeyformSample[];
  readonly diagnostics: DiagnosticDto[];
}): Rotation2dLocalState => {
  let localState: Rotation2dLocalState = {
    pivot: cloneVec2(input.rigControl.pivot),
    angleDegrees: input.rigControl.restAngleDegrees,
    translation: cloneVec2(input.rigControl.restTranslation),
    scale: cloneVec2(input.rigControl.restScale)
  };

  for (const sample of input.samples) {
    const nextState = applyRotation2dSample(localState, input.rigControl, sample);
    if ("diagnostic" in nextState) {
      input.diagnostics.push(nextState.diagnostic);
      continue;
    }

    localState = nextState.localState;
  }

  return localState;
};

const applyRotation2dSample = (
  localState: Rotation2dLocalState,
  rigControl: NormalizedRotation2dRigControl,
  sample: RuntimeKeyformSample
):
  | { readonly localState: Rotation2dLocalState }
  | { readonly diagnostic: DiagnosticDto } => {
  const targetProperty = sample.targetMetadata.targetProperty;
  if (targetProperty === "angleDegrees" || targetProperty === "restAngleDegrees") {
    const parsed = parseNumericPatch(sample.statePatch, targetProperty);
    if (!parsed.ok) {
      return { diagnostic: createRigControlPatchDiagnostic(rigControl, sample, parsed.checkId, parsed.evidence) };
    }

    const applied = applyNumericComposition(localState.angleDegrees, parsed.value, sample.compositionMode, targetProperty);
    if (!applied.ok) {
      return { diagnostic: createRigControlPatchDiagnostic(rigControl, sample, applied.checkId, applied.evidence) };
    }

    return {
      localState: {
        ...localState,
        angleDegrees: applied.value
      }
    };
  }

  if (targetProperty === "translation" || targetProperty === "restTranslation") {
    const parsed = parseVec2Patch(sample.statePatch, targetProperty);
    if (!parsed.ok) {
      return { diagnostic: createRigControlPatchDiagnostic(rigControl, sample, parsed.checkId, parsed.evidence) };
    }

    const applied = applyVec2Composition(localState.translation, parsed.value, sample.compositionMode, targetProperty);
    if (!applied.ok) {
      return { diagnostic: createRigControlPatchDiagnostic(rigControl, sample, applied.checkId, applied.evidence) };
    }

    return {
      localState: {
        ...localState,
        translation: applied.value
      }
    };
  }

  if (targetProperty === "scale" || targetProperty === "restScale") {
    const parsed = parseVec2Patch(sample.statePatch, targetProperty);
    if (!parsed.ok) {
      return { diagnostic: createRigControlPatchDiagnostic(rigControl, sample, parsed.checkId, parsed.evidence) };
    }

    const applied = applyVec2Composition(localState.scale, parsed.value, sample.compositionMode, targetProperty);
    if (!applied.ok) {
      return { diagnostic: createRigControlPatchDiagnostic(rigControl, sample, applied.checkId, applied.evidence) };
    }

    return {
      localState: {
        ...localState,
        scale: applied.value
      }
    };
  }

  return {
    diagnostic: createRigControlPatchDiagnostic(
      rigControl,
      sample,
      "rigControl.unsupportedTargetProperty",
      [`targetProperty=${targetProperty}`]
    )
  };
};

const parseNumericPatch = (
  value: unknown,
  targetProperty: string
): { readonly ok: true; readonly value: number } | { readonly ok: false; readonly checkId: string; readonly evidence: readonly string[] } => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { ok: true, value };
  }

  if (isFiniteNumberRecord(value) && typeof value[targetProperty] === "number") {
    return { ok: true, value: value[targetProperty] };
  }

  return {
    ok: false,
    checkId: "rigControl.invalidPatchShape",
    evidence: [`targetProperty=${targetProperty}`, "expected=finiteNumber"]
  };
};

const parseVec2Patch = (
  value: unknown,
  targetProperty: string
): { readonly ok: true; readonly value: Vec2Dto } | { readonly ok: false; readonly checkId: string; readonly evidence: readonly string[] } => {
  if (isVec2(value)) {
    return {
      ok: true,
      value: cloneVec2(value)
    };
  }

  return {
    ok: false,
    checkId: "rigControl.invalidPatchShape",
    evidence: [`targetProperty=${targetProperty}`, "expected=vec2"]
  };
};

const applyNumericComposition = (
  current: number,
  patch: number,
  compositionMode: string,
  targetProperty: string
): { readonly ok: true; readonly value: number } | { readonly ok: false; readonly checkId: string; readonly evidence: readonly string[] } => {
  if (compositionMode === "replace") {
    return { ok: true, value: patch };
  }

  if (compositionMode === "additiveDelta") {
    return { ok: true, value: current + patch };
  }

  return unsupportedComposition(compositionMode, targetProperty);
};

const applyVec2Composition = (
  current: Vec2Dto,
  patch: Vec2Dto,
  compositionMode: string,
  targetProperty: string
): { readonly ok: true; readonly value: Vec2Dto } | { readonly ok: false; readonly checkId: string; readonly evidence: readonly string[] } => {
  if (compositionMode === "replace") {
    return { ok: true, value: cloneVec2(patch) };
  }

  if (compositionMode === "additiveDelta") {
    return {
      ok: true,
      value: {
        x: current.x + patch.x,
        y: current.y + patch.y
      }
    };
  }

  return unsupportedComposition(compositionMode, targetProperty);
};

const unsupportedComposition = (
  compositionMode: string,
  targetProperty: string
): { readonly ok: false; readonly checkId: string; readonly evidence: readonly string[] } => ({
  ok: false,
  checkId: "rigControl.unsupportedCompositionMode",
  evidence: [`compositionMode=${compositionMode}`, `targetProperty=${targetProperty}`]
});

const createRigControlPatchDiagnostic = (
  rigControl: NormalizedRotation2dRigControl,
  sample: RuntimeKeyformSample,
  checkId: string,
  evidence: readonly string[]
): DiagnosticDto =>
  createRuntimeDiagnostic({
    checkId,
    severity: "error",
    phase: "rigControl_evaluation",
    target: { kind: "rigControl", id: rigControl.rigControlId },
    message: `Rig control keyform patch could not be applied for ${rigControl.rigControlId}.`,
    evidence: [
      `keyformSetId=${sample.keyformSetId}`,
      `targetProperty=${sample.targetMetadata.targetProperty}`,
      `compositionMode=${sample.compositionMode}`,
      ...evidence
    ]
  });

const isFiniteNumberRecord = (value: unknown): value is Record<string, number> =>
  typeof value === "object" &&
  value !== null &&
  Object.values(value).every((candidate) => typeof candidate === "number" && Number.isFinite(candidate));

const isVec2 = (value: unknown): value is Vec2Dto =>
  typeof value === "object" &&
  value !== null &&
  "x" in value &&
  "y" in value &&
  typeof (value as { readonly x: unknown }).x === "number" &&
  Number.isFinite((value as { readonly x: number }).x) &&
  typeof (value as { readonly y: unknown }).y === "number" &&
  Number.isFinite((value as { readonly y: number }).y);

const cloneVec2 = (value: Vec2Dto): Vec2Dto => ({
  x: value.x,
  y: value.y
});
