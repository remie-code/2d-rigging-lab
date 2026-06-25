import {
  DiagnosticSchema,
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ParameterIdSchema,
  RectDtoSchema,
  RuntimeEvaluationContextSchema,
  RuntimeResetReasonSchema,
  RuntimeSnapshotIdSchema,
  Vec2DtoSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  DrawableId,
  DiagnosticDto,
  ParameterId,
  RuntimeEvaluationContextDto,
  RuntimeStateDto,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import {
  createEvaluatedParts,
  EvaluatedPartSchema
} from "./layer-tree-evidence.js";
import { KeyformSampleSchema } from "./keyform-evaluation-types.js";
import {
  createEvaluatedMaskRelations,
  EvaluatedMaskRelationSchema
} from "./mask-relation-evidence.js";
import {
  createEvaluatedDrawableMeshEvidence,
  EvaluatedDrawableMeshEvidenceSchema,
  shouldEmitDrawableMeshEvidence
} from "./mesh-evidence.js";
import { applyKeyformTargetPatches } from "./keyform-target-application.js";
import type { RuntimeKeyformSample } from "./keyform-sampling.js";
import { sampleRuntimeKeyforms } from "./keyform-sampling.js";
import {
  computeDynamicsOutputOffsets,
  computeDynamicsSourceSample
} from "./dynamics-evaluation.js";
import type { NormalizedDrawable, NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import { resolveEffectiveParameterValues } from "./parameter-resolution.js";
import type { EffectiveParameterResolution } from "./parameter-resolution.js";
import { EvaluatedRigControlSchema, evaluateRigControlHierarchy } from "./rig-control-evaluation.js";
import type { RuntimeEvaluationOptionsDto } from "./runtime-options.js";
import type { RuntimeEvaluationInputDto } from "./runtime-input.js";
import type {
  RuntimeCoreEvaluationProfiler,
  RuntimeCoreEvaluationProfilePhaseKey
} from "./runtime-profiling.js";
import { createStableVertexHash as createStableGeometryVertexHash } from "./drawable-geometry.js";
import {
  createEvaluatedDrawableTexture,
  EvaluatedDrawableTextureSchema,
  omitTextureProjectionCoordinates
} from "./texture-projection.js";

export {
  EvaluatedMaskRelationSchema
} from "./mask-relation-evidence.js";
export type {
  EvaluatedMaskRelationDto
} from "./mask-relation-evidence.js";

export const EvaluatedParameterSchema = z.object({
  parameterId: ParameterIdSchema,
  valueSource: z.enum(["authoredInput", "computedDynamics", "debugOverride"]),
  authoredValue: z.number().finite().optional(),
  baseValue: z.number().finite(),
  dynamicsOffset: z.number().finite().optional(),
  effectiveValue: z.number().finite(),
  clamped: z.boolean(),
  source: z.enum([
    "default",
    "viewerOverride",
    "editorPreviewOverride",
    "operationDryRun",
    "dynamicsAdditive",
    "debugOverride"
  ])
});
export type EvaluatedParameterDto = z.infer<typeof EvaluatedParameterSchema>;

export const EvaluatedDrawableSchema = z.object({
  drawableId: DrawableIdSchema,
  meshId: MeshIdSchema,
  partId: PartIdSchema.optional(),
  texture: EvaluatedDrawableTextureSchema.optional(),
  visible: z.boolean(),
  opacity: z.number().min(0).max(1),
  baseDrawOrder: z.number().int(),
  evaluatedDrawOrder: z.number().int(),
  bounds: RectDtoSchema,
  vertexCount: z.number().int().nonnegative(),
  vertexHash: z.string(),
  vertices: z.array(Vec2DtoSchema).optional(),
  mesh: EvaluatedDrawableMeshEvidenceSchema.optional(),
  diagnostics: z.array(DiagnosticSchema).default([])
});
export type EvaluatedDrawableDto = z.infer<typeof EvaluatedDrawableSchema>;

export const EvaluatedDynamicsGroupSchema = z.object({
  dynamicsGroupId: DynamicsGroupIdSchema,
  enabled: z.boolean(),
  solverKind: z.literal("additivePendulumV0"),
  inputValues: z.record(ParameterIdSchema, z.number().finite()),
  outputParameterId: ParameterIdSchema,
  outputOffset: z.number().finite(),
  effectiveOutputValue: z.number().finite(),
  stateSummary: z.object({
    angle: z.number().finite(),
    angularVelocity: z.number().finite(),
    previousSource: z.number().finite(),
    previousSourceVelocity: z.number().finite()
  }),
  tick: z.number().int().nonnegative(),
  fixedStepMs: z.number().positive(),
  resetCounter: z.number().int().nonnegative(),
  debug: z
    .object({
      rawTarget: z.number().finite().optional(),
      source: z.number().finite().optional(),
      rawOffset: z.number().finite().optional(),
      outputClamped: z.boolean().optional(),
      resetApplied: z.boolean().optional(),
      resetReasons: z.array(RuntimeResetReasonSchema).default([])
    })
    .optional(),
  diagnostics: z.array(DiagnosticSchema).default([])
});
export type EvaluatedDynamicsGroupDto = z.infer<typeof EvaluatedDynamicsGroupSchema>;

export const RuntimeSnapshotSchema = z.object({
  schemaVersion: z.literal("runtime-snapshot-v1"),
  runtimeCoreVersion: z.string(),
  snapshotId: RuntimeSnapshotIdSchema,
  context: RuntimeEvaluationContextSchema,
  packageId: PackageIdSchema,
  packageRevision: z.number().int().nonnegative(),
  packageHash: z.string().optional(),
  authoringRevision: z.number().int().nonnegative().optional(),
  dirty: z.boolean(),
  evaluation: z.object({
    snapshotDetail: z.enum(["summary", "targeted", "full"]),
    evaluatorVersions: z.record(z.string(), z.string())
  }),
  parameters: z.array(EvaluatedParameterSchema),
  dynamics: z.array(EvaluatedDynamicsGroupSchema).default([]),
  keyformSamples: z.array(KeyformSampleSchema).default([]),
  rigControls: z.array(EvaluatedRigControlSchema).default([]),
  parts: z.array(EvaluatedPartSchema).optional(),
  drawables: z.array(EvaluatedDrawableSchema),
  masks: z.array(EvaluatedMaskRelationSchema),
  drawList: z.array(DrawableIdSchema),
  disabledFutureLayers: z.array(z.string()).default([]),
  diagnostics: z.array(DiagnosticSchema),
  trace: z
    .object({
      phases: z.array(z.string()),
      evaluatorVersionSummary: z.record(z.string(), z.string())
    })
    .passthrough()
    .optional()
});
export type RuntimeSnapshotDto = z.infer<typeof RuntimeSnapshotSchema>;

export const createRuntimeSnapshot = (input: {
  readonly graph: NormalizedRuntimeGraph;
  readonly evaluationInput: RuntimeEvaluationInputDto;
  readonly state: RuntimeStateDto;
  readonly options: RuntimeEvaluationOptionsDto;
  readonly context: RuntimeEvaluationContextDto;
  readonly diagnostics: readonly DiagnosticDto[];
  readonly profiling?: RuntimeCoreEvaluationProfiler;
}): RuntimeSnapshotDto => {
  const measure = <TValue>(
    phase: RuntimeCoreEvaluationProfilePhaseKey,
    evaluate: () => TValue
  ): TValue =>
    input.profiling === undefined
      ? evaluate()
      : input.profiling.measure(phase, evaluate);
  const parameterResolution = measure(
    "parameterResolutionDurationMs",
    () => resolveEffectiveParameterValues({
      graph: input.graph,
      authoredParameterValues: input.evaluationInput.authoredParameterValues,
      state: input.state
    })
  );
  const keyformSampling = measure(
    "keyformSamplingDurationMs",
    () => sampleRuntimeKeyformsInEvaluationOrder({
      graph: input.graph,
      effectiveParameterValues: parameterResolution.effectiveParameterValues
    })
  );
  const baseDrawables = measure(
    "drawableSnapshotCreationDurationMs",
    () => createEvaluatedDrawables({
      graph: input.graph,
      options: input.options,
      includeVertices:
        keyformSampling.samples.length > 0 || input.graph.rigControls.size > 0
    })
  );
  const referenceVerticesByDrawableId = measure(
    "drawableSnapshotCreationDurationMs",
    () => createReferenceVerticesByDrawableId(input.graph)
  );
  const appliedKeyforms = measure(
    "keyformApplicationDurationMs",
    () => applySamplesInEvaluationOrder({
      drawables: baseDrawables,
      samples: keyformSampling.samples.filter(
        (sample) => sample.targetMetadata.targetKind !== "rigControl"
      ),
      hashPrecisionDecimals: input.options.epsilonPolicy.hashPrecisionDecimals
    })
  );
  const rigControlEvaluation = measure(
    "deformerHierarchyEvaluationDurationMs",
    () => evaluateRigControlHierarchy({
      graph: input.graph,
      drawables: appliedKeyforms.drawables,
      referenceVerticesByDrawableId,
      samples: keyformSampling.samples.filter(
        (sample) => sample.targetMetadata.targetKind === "rigControl"
      ),
      hashPrecisionDecimals: input.options.epsilonPolicy.hashPrecisionDecimals,
      ...(input.profiling === undefined ? {} : { profiling: input.profiling })
    })
  );
  const drawables = measure(
    "drawableSnapshotCreationDurationMs",
    () => finalizeDrawablesForDetail(
      rigControlEvaluation.drawables,
      input.options,
      input.graph
    )
  );
  const masks = measure(
    "maskEvaluationDurationMs",
    () => createEvaluatedMaskRelations(input.graph)
  );
  const drawList = measure(
    "visibilityDrawOrderEvaluationDurationMs",
    () => drawables
      .filter((drawable) => drawable.visible)
      .map((drawable) => drawable.drawableId)
  );

  return measure("snapshotValidationDurationMs", () =>
    RuntimeSnapshotSchema.parse({
      schemaVersion: "runtime-snapshot-v1",
      runtimeCoreVersion: "wave2-foundation",
      snapshotId: RuntimeSnapshotIdSchema.parse(`snap_${input.graph.packageId.replace(/^pkg_/, "")}_${input.evaluationInput.frameIndex}`),
      context: input.context,
      packageId: input.graph.packageId,
      packageRevision: input.graph.packageRevision,
      ...(input.graph.packageHash === undefined ? {} : { packageHash: input.graph.packageHash }),
      dirty: false,
      evaluation: {
        snapshotDetail: input.options.snapshotDetail,
        evaluatorVersions: input.options.evaluatorVersions
      },
      parameters: createEvaluatedParameters(parameterResolution),
      dynamics: createEvaluatedDynamics(
        input.graph,
        input.evaluationInput,
        input.state,
        input.options,
        parameterResolution
      ),
      keyformSamples: keyformSampling.samples,
      rigControls: rigControlEvaluation.rigControls,
      parts: createEvaluatedParts(input.graph),
      drawables,
      masks,
      drawList,
      disabledFutureLayers: input.graph.disabledFutureLayers.map((layer) => layer.layerId),
      diagnostics: [
        ...input.diagnostics,
        ...keyformSampling.diagnostics,
        ...appliedKeyforms.diagnostics,
        ...rigControlEvaluation.diagnostics
      ],
      ...(input.options.includeTrace
        ? {
            trace: {
              phases: [
                "parameter_resolution",
                "dynamics_evaluation",
                "keyform_sampling",
                "rigControl_evaluation",
                "mesh_evaluation",
                "opacity_visibility",
                "mask_resolution",
                "draw_order_resolution",
                "render_preparation"
              ],
              evaluatorVersionSummary: input.options.evaluatorVersions
            }
          }
        : {})
    }));
};

const createEvaluatedParameters = (resolution: EffectiveParameterResolution): EvaluatedParameterDto[] =>
  resolution.values.map((parameter) => EvaluatedParameterSchema.parse(parameter));

const createEvaluatedDynamics = (
  graph: NormalizedRuntimeGraph,
  input: RuntimeEvaluationInputDto,
  state: RuntimeStateDto,
  options: RuntimeEvaluationOptionsDto,
  parameterResolution: EffectiveParameterResolution
): EvaluatedDynamicsGroupDto[] =>
  [...graph.dynamicsGroups.values()]
    .filter((group) => group.enabled)
    .map((group) => {
      const groupState = state.dynamicsGroups[group.dynamicsGroupId];
      const source = computeDynamicsSourceSample(graph, group, input.authoredParameterValues);
      const resetState = {
        angle: source.source,
        angularVelocity: 0,
        previousSource: source.source,
        previousSourceVelocity: 0,
        tick: 0,
        resetCounter: 0
      };
      const stateSummary = groupState ?? resetState;
      const output = group.outputs[0];
      const outputOffset = computeDynamicsOutputOffsets(group, stateSummary)[0];
      const evaluatedOutputParameter = output === undefined
        ? undefined
        : parameterResolution.values.find((parameter) => parameter.parameterId === output.parameterId);

      return EvaluatedDynamicsGroupSchema.parse({
        dynamicsGroupId: group.dynamicsGroupId,
        enabled: group.enabled,
        solverKind: "additivePendulumV0",
        inputValues: source.inputValues,
        outputParameterId: outputOffset?.outputParameterId ?? output?.parameterId,
        outputOffset: outputOffset?.offset ?? 0,
        effectiveOutputValue: evaluatedOutputParameter?.effectiveValue ?? 0,
        stateSummary: {
          angle: stateSummary.angle,
          angularVelocity: stateSummary.angularVelocity,
          previousSource: stateSummary.previousSource,
          previousSourceVelocity: stateSummary.previousSourceVelocity
        },
        tick: stateSummary.tick,
        fixedStepMs: state.fixedStepMs,
        resetCounter: stateSummary.resetCounter,
        ...(options.snapshotDetail === "summary"
          ? {}
          : {
              debug: {
                rawTarget: source.rawSource,
                source: source.source,
                rawOffset: outputOffset?.rawOffset ?? 0,
                outputClamped: outputOffset?.outputClamped ?? false,
                resetApplied: input.resetReasons.length > 0,
                resetReasons: input.resetReasons
              }
            }),
        diagnostics: []
      });
    });

const createEvaluatedDrawables = (input: {
  readonly graph: NormalizedRuntimeGraph;
  readonly options: RuntimeEvaluationOptionsDto;
  readonly includeVertices: boolean;
}): EvaluatedDrawableDto[] => {
  const { graph, options } = input;
  const explicitOrder = new Map(graph.drawOrder.map((entry) => [entry.drawableId, entry.drawOrder]));
  return [...graph.drawables.values()]
    .map((drawable) =>
      EvaluatedDrawableSchema.parse({
        drawableId: drawable.drawableId,
        meshId: drawable.meshId,
        ...(drawable.partId === undefined ? {} : { partId: drawable.partId }),
        ...(drawable.texture === undefined
          ? {}
          : {
              texture: createEvaluatedDrawableTexture({
                texture: drawable.texture,
                vertexCount: drawable.vertexCount,
                includeUvCoordinates: options.snapshotDetail === "full"
              })
            }),
        visible: drawable.visible,
        opacity: clamp(drawable.opacity, 0, 1),
        baseDrawOrder: drawable.baseDrawOrder,
        evaluatedDrawOrder: explicitOrder.get(drawable.drawableId) ?? drawable.baseDrawOrder,
        bounds: drawable.bounds,
        vertexCount: drawable.vertexCount,
        vertexHash: drawable.vertexHash ?? createDrawableVertexHash(drawable, options.epsilonPolicy.hashPrecisionDecimals),
        ...((options.snapshotDetail === "full" || input.includeVertices) && drawable.vertices !== undefined
          ? { vertices: drawable.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y })) }
          : {}),
        diagnostics: []
      })
    )
    .sort((left, right) => left.evaluatedDrawOrder - right.evaluatedDrawOrder || left.drawableId.localeCompare(right.drawableId));
};

const createReferenceVerticesByDrawableId = (
  graph: NormalizedRuntimeGraph
): ReadonlyMap<DrawableId, readonly Vec2Dto[]> =>
  new Map(
    [...graph.drawables.values()]
      .filter((drawable): drawable is NormalizedDrawable & { readonly vertices: readonly Vec2Dto[] } => drawable.vertices !== undefined)
      .map((drawable) => [
        drawable.drawableId,
        drawable.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y }))
      ] as const)
  );

const sampleRuntimeKeyformsInEvaluationOrder = (input: {
  readonly graph: NormalizedRuntimeGraph;
  readonly effectiveParameterValues: ReadonlyMap<ParameterId, number>;
}): {
  readonly samples: readonly RuntimeKeyformSample[];
  readonly diagnostics: readonly DiagnosticDto[];
} => {
  const samples: RuntimeKeyformSample[] = [];
  const diagnostics: DiagnosticDto[] = [];

  for (const binding of [...input.graph.keyformBindings]
    .map((binding, index) => ({ binding, index }))
    .sort((left, right) => left.binding.compositionOrder - right.binding.compositionOrder || left.index - right.index)) {
    const result = sampleRuntimeKeyforms({
      graph: {
        ...input.graph,
        keyformBindings: [binding.binding]
      },
      effectiveParameterValues: input.effectiveParameterValues
    });
    samples.push(...result.samples);
    diagnostics.push(...result.diagnostics);
  }

  return {
    samples,
    diagnostics
  };
};

const applySamplesInEvaluationOrder = (input: {
  readonly drawables: readonly EvaluatedDrawableDto[];
  readonly samples: readonly RuntimeKeyformSample[];
  readonly hashPrecisionDecimals: number;
}): {
  readonly drawables: readonly EvaluatedDrawableDto[];
  readonly diagnostics: readonly DiagnosticDto[];
} => {
  let drawables = input.drawables;
  const diagnostics: DiagnosticDto[] = [];

  for (const sample of input.samples) {
    const result = applyKeyformTargetPatches({
      drawables,
      patches: [sample],
      hashPrecisionDecimals: input.hashPrecisionDecimals
    });
    drawables = result.drawables;
    diagnostics.push(...result.diagnostics);
  }

  return {
    drawables,
    diagnostics
  };
};

const finalizeDrawablesForDetail = (
  drawables: readonly EvaluatedDrawableDto[],
  options: RuntimeEvaluationOptionsDto,
  graph: NormalizedRuntimeGraph
): readonly EvaluatedDrawableDto[] => {
  const drawablesWithMeshEvidence = drawables.map((drawable) => {
    const graphDrawable = graph.drawables.get(drawable.drawableId);
    if (graphDrawable === undefined || !shouldEmitDrawableMeshEvidence(graphDrawable)) {
      return drawable;
    }

    return {
      ...drawable,
      mesh: createEvaluatedDrawableMeshEvidence({
        drawable: {
          ...graphDrawable,
          bounds: drawable.bounds,
          vertexHash: drawable.vertexHash,
          vertexCount: drawable.vertexCount,
          ...(drawable.vertices === undefined ? {} : { vertices: drawable.vertices })
        },
        includeVertices: options.snapshotDetail === "full" && drawable.vertices !== undefined
      })
    };
  });

  if (options.snapshotDetail === "full") {
    return drawablesWithMeshEvidence;
  }

  return drawablesWithMeshEvidence.map((drawable) => {
    const { vertices, ...withoutVertices } = drawable;
    void vertices;
    return {
      ...withoutVertices,
      ...(drawable.texture === undefined ? {} : { texture: omitTextureProjectionCoordinates(drawable.texture) })
    };
  });
};

const createDrawableVertexHash = (
  drawable: NormalizedDrawable,
  hashPrecisionDecimals: number
): string => {
  if (drawable.vertices === undefined) {
    return `hash_${drawable.drawableId}_${drawable.vertexCount}`;
  }

  return createStableGeometryVertexHash(drawable.vertices, { hashPrecisionDecimals });
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
