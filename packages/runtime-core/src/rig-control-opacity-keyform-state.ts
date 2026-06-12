import type { DiagnosticDto } from "@private-2d-rigging-lab/contracts";

import { createRuntimeDiagnostic } from "./diagnostics.js";
import type { RuntimeKeyformSample } from "./keyform-sampling.js";
import type { NormalizedRigControlNode } from "./normalized-runtime-graph.js";

export const applyRigControlOpacityMultiplierSamples = (input: {
  readonly rigControl: NormalizedRigControlNode;
  readonly baseOpacityMultiplier: number;
  readonly samples: readonly RuntimeKeyformSample[];
  readonly diagnostics: DiagnosticDto[];
}): number => {
  let opacityMultiplier = clamp(input.baseOpacityMultiplier, 0, 1);

  for (const sample of input.samples) {
    const parsed = parseOpacityMultiplierPatch(sample.statePatch);
    if (!parsed.ok) {
      input.diagnostics.push(
        createOpacityMultiplierDiagnostic(input.rigControl, sample, parsed.checkId, parsed.evidence)
      );
      continue;
    }

    const applied = applyOpacityMultiplierComposition(
      opacityMultiplier,
      parsed.value,
      sample.compositionMode
    );
    if (!applied.ok) {
      input.diagnostics.push(
        createOpacityMultiplierDiagnostic(input.rigControl, sample, applied.checkId, applied.evidence)
      );
      continue;
    }

    opacityMultiplier = clamp(applied.value, 0, 1);
  }

  return opacityMultiplier;
};

const parseOpacityMultiplierPatch = (
  value: unknown
):
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly checkId: string; readonly evidence: readonly string[] } => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { ok: true, value };
  }

  if (isFiniteNumberRecord(value) && typeof value.opacityMultiplier === "number") {
    return { ok: true, value: value.opacityMultiplier };
  }

  return {
    ok: false,
    checkId: "rigControl.invalidPatchShape",
    evidence: ["targetProperty=opacityMultiplier", "expected=finiteNumber"]
  };
};

const applyOpacityMultiplierComposition = (
  current: number,
  patch: number,
  compositionMode: string
):
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly checkId: string; readonly evidence: readonly string[] } => {
  if (compositionMode === "replace") {
    return { ok: true, value: patch };
  }

  if (compositionMode === "additiveDelta") {
    return { ok: true, value: current + patch };
  }

  if (compositionMode === "multiplyOpacity") {
    return { ok: true, value: current * patch };
  }

  return {
    ok: false,
    checkId: "rigControl.unsupportedCompositionMode",
    evidence: [`compositionMode=${compositionMode}`, "targetProperty=opacityMultiplier"]
  };
};

const createOpacityMultiplierDiagnostic = (
  rigControl: NormalizedRigControlNode,
  sample: RuntimeKeyformSample,
  checkId: string,
  evidence: readonly string[]
): DiagnosticDto =>
  createRuntimeDiagnostic({
    checkId,
    severity: "error",
    phase: "rigControl_evaluation",
    target: { kind: "rigControl", id: rigControl.rigControlId },
    message: `Rig control opacityMultiplier keyform patch could not be applied for ${rigControl.rigControlId}.`,
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

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
