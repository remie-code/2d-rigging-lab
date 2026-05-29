import type {
  DiagnosticDto,
  DrawableId,
  ParameterId,
  RigControlId,
  Severity,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import { createRuntimeDiagnostic } from "./diagnostics.js";
import { interpolateGrid2dKeyform } from "./keyform-grid2d-interpolation.js";
import type { Grid2dCoordinate } from "./keyform-grid2d-interpolation.js";
import {
  interpolateLinear1dKeyform
} from "./keyform-linear1d-interpolation.js";
import type { SampledStatePatch } from "./keyform-linear1d-interpolation.js";
import type {
  KeyformBinding,
  Linear1dKeyformBinding,
  NormalizedRuntimeGraph,
  ParameterGrid2dKeyformBinding
} from "./normalized-runtime-graph.js";

export interface RuntimeKeyformSampleTarget {
  readonly targetId: string;
  readonly targetKind: KeyformBinding["targetKind"];
  readonly targetProperty: string;
}

export interface RuntimeKeyformSample {
  readonly keyformSetId: KeyformBinding["keyformSetId"];
  readonly evaluator: KeyformBinding["evaluator"];
  readonly sampledCoordinates: Readonly<Record<string, number>>;
  readonly target: string;
  readonly targetMetadata: RuntimeKeyformSampleTarget;
  readonly compositionMode: KeyformBinding["compositionMode"];
  readonly compositionOrder: number;
  readonly statePatch: SampledStatePatch;
  readonly samplingStatus: string;
}

export interface RuntimeKeyformSamplingResult {
  readonly samples: readonly RuntimeKeyformSample[];
  readonly diagnostics: readonly DiagnosticDto[];
}

export const sampleRuntimeKeyforms = (input: {
  readonly graph: NormalizedRuntimeGraph;
  readonly effectiveParameterValues: ReadonlyMap<ParameterId, number>;
}): RuntimeKeyformSamplingResult => {
  const samples: RuntimeKeyformSample[] = [];
  const diagnostics: DiagnosticDto[] = [];

  for (const binding of sortBindings(input.graph.keyformBindings)) {
    const targetDiagnostic = validateBindingTarget(input.graph, binding);
    if (targetDiagnostic !== undefined) {
      diagnostics.push(targetDiagnostic);
      continue;
    }

    if (binding.evaluator === "linear-1d-v1") {
      sampleLinear1dBinding({
        binding,
        effectiveParameterValues: input.effectiveParameterValues,
        samples,
        diagnostics
      });
      continue;
    }

    if (binding.evaluator === "parameter-grid-2d-v1") {
      sampleGrid2dBinding({
        graph: input.graph,
        binding,
        effectiveParameterValues: input.effectiveParameterValues,
        samples,
        diagnostics
      });
      continue;
    }

    diagnostics.push(
      createKeyformDiagnostic({
        binding,
        checkId: "keyform.unsupportedEvaluator",
        severity: "error",
        message: `Unsupported keyform evaluator ${(binding as { readonly evaluator?: string }).evaluator ?? "unknown"}.`
      })
    );
  }

  return {
    samples,
    diagnostics
  };
};

const sampleLinear1dBinding = (input: {
  readonly binding: Linear1dKeyformBinding;
  readonly effectiveParameterValues: ReadonlyMap<ParameterId, number>;
  readonly samples: RuntimeKeyformSample[];
  readonly diagnostics: DiagnosticDto[];
}): void => {
  const parameterValue = input.effectiveParameterValues.get(input.binding.parameterId);
  if (parameterValue === undefined) {
    input.diagnostics.push(
      createKeyformDiagnostic({
        binding: input.binding,
        checkId: "keyform.missingParameter",
        severity: "error",
        message: `Missing effective parameter value for ${input.binding.parameterId}.`,
        evidence: [`parameterId=${input.binding.parameterId}`]
      })
    );
    return;
  }

  const result = interpolateLinear1dKeyform({
    keys: input.binding.keys,
    parameterValue
  });

  if (result.duplicateKeyValues.length > 0) {
    input.diagnostics.push(
      createKeyformDiagnostic({
        binding: input.binding,
        checkId: "keyform.linear1dDuplicateKey",
        severity: "warning",
        message: `Duplicate linear key values were ignored deterministically for ${input.binding.keyformSetId}.`,
        evidence: result.duplicateKeyValues.map((value) => `value=${value}`)
      })
    );
  }

  if (!result.ok) {
    input.diagnostics.push(
      createKeyformDiagnostic({
        binding: input.binding,
        checkId: result.code,
        severity: result.code === "keyform.unsupportedPatchShape" ? "warning" : "error",
        message: `Could not sample linear keyform ${input.binding.keyformSetId}: ${result.code}.`
      })
    );
    return;
  }

  input.samples.push(
    createSample({
      binding: input.binding,
      sampledCoordinates: {
        [input.binding.parameterId]: result.sampledValue
      },
      statePatch: result.statePatch,
      samplingStatus: result.source
    })
  );
};

const sampleGrid2dBinding = (input: {
  readonly graph: NormalizedRuntimeGraph;
  readonly binding: ParameterGrid2dKeyformBinding;
  readonly effectiveParameterValues: ReadonlyMap<ParameterId, number>;
  readonly samples: RuntimeKeyformSample[];
  readonly diagnostics: DiagnosticDto[];
}): void => {
  const parameterX = input.graph.parameters.get(input.binding.parameterX);
  const parameterY = input.graph.parameters.get(input.binding.parameterY);
  const rawX = input.effectiveParameterValues.get(input.binding.parameterX);
  const rawY = input.effectiveParameterValues.get(input.binding.parameterY);

  if (parameterX === undefined || parameterY === undefined || rawX === undefined || rawY === undefined) {
    input.diagnostics.push(
      createKeyformDiagnostic({
        binding: input.binding,
        checkId: "keyform.missingParameter",
        severity: "error",
        message: `Missing grid parameter definition or effective value for ${input.binding.keyformSetId}.`,
        evidence: [
          `parameterX=${input.binding.parameterX}`,
          `parameterY=${input.binding.parameterY}`,
          `hasParameterX=${parameterX !== undefined}`,
          `hasParameterY=${parameterY !== undefined}`,
          `hasValueX=${rawX !== undefined}`,
          `hasValueY=${rawY !== undefined}`
        ]
      })
    );
    return;
  }

  const clampedX = clamp(rawX, parameterX.min, parameterX.max);
  const clampedY = clamp(rawY, parameterY.min, parameterY.max);
  if (clampedX !== rawX || clampedY !== rawY) {
    input.diagnostics.push(
      createKeyformDiagnostic({
        binding: input.binding,
        checkId: "keyform.grid2dCoordinateClamped",
        severity: "warning",
        message: `Grid keyform coordinates were clamped to parameter range for ${input.binding.keyformSetId}.`,
        evidence: [
          `rawX=${rawX}`,
          `rawY=${rawY}`,
          `clampedX=${clampedX}`,
          `clampedY=${clampedY}`,
          `parameterXRange=${parameterX.min}..${parameterX.max}`,
          `parameterYRange=${parameterY.min}..${parameterY.max}`
        ]
      })
    );
  }

  const result = interpolateGrid2dKeyform({
    keys: input.binding.keys,
    x: clampedX,
    y: clampedY
  });

  if (result.duplicateCoordinates.length > 0) {
    input.diagnostics.push(
      createKeyformDiagnostic({
        binding: input.binding,
        checkId: "keyform.grid2dDuplicateKey",
        severity: "error",
        message: `Duplicate grid coordinates were ignored deterministically for ${input.binding.keyformSetId}.`,
        evidence: result.duplicateCoordinates.map(formatCoordinateEvidence)
      })
    );
  }

  if (result.clampedToKeyRange) {
    input.diagnostics.push(
      createKeyformDiagnostic({
        binding: input.binding,
        checkId: "keyform.grid2dCoordinateClamped",
        severity: "warning",
        message: `Grid keyform coordinates were clamped to available key range for ${input.binding.keyformSetId}.`,
        evidence:
          result.sampledCoordinates === undefined ? [] : [formatCoordinateEvidence(result.sampledCoordinates)]
      })
    );
  }

  if (!result.ok) {
    input.diagnostics.push(
      createKeyformDiagnostic({
        binding: input.binding,
        checkId: result.code,
        severity: result.code === "keyform.unsupportedPatchShape" ? "warning" : "error",
        message: `Could not sample grid keyform ${input.binding.keyformSetId}: ${result.code}.`,
        evidence: result.missingCoordinates.map(formatCoordinateEvidence)
      })
    );
    return;
  }

  input.samples.push(
    createSample({
      binding: input.binding,
      sampledCoordinates: {
        [input.binding.parameterX]: result.sampledCoordinates.x,
        [input.binding.parameterY]: result.sampledCoordinates.y
      },
      statePatch: result.statePatch,
      samplingStatus: result.source
    })
  );
};

const sortBindings = (bindings: readonly KeyformBinding[]): readonly KeyformBinding[] =>
  [...bindings].sort(
    (left, right) =>
      left.compositionOrder - right.compositionOrder ||
      left.keyformSetId.localeCompare(right.keyformSetId) ||
      left.targetId.localeCompare(right.targetId) ||
      left.targetProperty.localeCompare(right.targetProperty)
  );

const createSample = (input: {
  readonly binding: KeyformBinding;
  readonly sampledCoordinates: Readonly<Record<string, number>>;
  readonly statePatch: SampledStatePatch;
  readonly samplingStatus: string;
}): RuntimeKeyformSample => ({
  keyformSetId: input.binding.keyformSetId,
  evaluator: input.binding.evaluator,
  sampledCoordinates: input.sampledCoordinates,
  target: createTargetKey(input.binding),
  targetMetadata: {
    targetId: input.binding.targetId,
    targetKind: input.binding.targetKind,
    targetProperty: input.binding.targetProperty
  },
  compositionMode: input.binding.compositionMode,
  compositionOrder: input.binding.compositionOrder,
  statePatch: input.statePatch,
  samplingStatus: input.samplingStatus
});

const validateBindingTarget = (graph: NormalizedRuntimeGraph, binding: KeyformBinding): DiagnosticDto | undefined => {
  if (binding.targetKind === "drawable") {
    return graph.drawables.has(binding.targetId as DrawableId) ? undefined : createMissingTargetDiagnostic(binding);
  }

  if (binding.targetKind === "mesh") {
    return [...graph.drawables.values()].some((drawable) => drawable.meshId === binding.targetId)
      ? undefined
      : createMissingTargetDiagnostic(binding);
  }

  if (binding.targetKind === "rigControl") {
    return graph.rigControls.has(binding.targetId as RigControlId) ? undefined : createMissingTargetDiagnostic(binding);
  }

  return createKeyformDiagnostic({
    binding,
    checkId: "keyform.unsupportedTarget",
    severity: "error",
    message: `Unsupported keyform target kind ${(binding as { readonly targetKind?: string }).targetKind ?? "unknown"}.`
  });
};

const createMissingTargetDiagnostic = (binding: KeyformBinding): DiagnosticDto =>
  createKeyformDiagnostic({
    binding,
    checkId: "keyform.targetMissing",
    severity: "error",
    message: `Missing keyform target ${createTargetKey(binding)} for ${binding.keyformSetId}.`,
    evidence: [`target=${createTargetKey(binding)}`]
  });

const createKeyformDiagnostic = (input: {
  readonly binding: Pick<KeyformBinding, "keyformSetId">;
  readonly checkId: string;
  readonly severity: Severity;
  readonly message: string;
  readonly evidence?: readonly string[];
}): DiagnosticDto =>
  createRuntimeDiagnostic({
    checkId: input.checkId,
    severity: input.severity,
    phase: "keyform_sampling",
    target: createKeyformTargetRef(input.binding),
    message: input.message,
    ...(input.evidence === undefined ? {} : { evidence: input.evidence })
  });

const createKeyformTargetRef = (binding: Pick<KeyformBinding, "keyformSetId">): TargetRefDto => ({
  kind: "keyformSet",
  id: binding.keyformSetId
});

const createTargetKey = (binding: KeyformBinding): string =>
  `${binding.targetKind}:${binding.targetId}.${binding.targetProperty}`;

const formatCoordinateEvidence = (coordinate: Grid2dCoordinate): string => `x=${coordinate.x},y=${coordinate.y}`;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
