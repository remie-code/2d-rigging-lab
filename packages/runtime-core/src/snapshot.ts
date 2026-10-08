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
  DiagnosticDto,
  DrawableId,
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
  computeDynamicsOutputOffsetsWithAnchor,
  computeDynamicsSourceSample,
  createResetDynamicsState
} from "./dynamics-evaluation.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import { resolveEffectiveParameterValues } from "./parameter-resolution.js";
import type { EffectiveParameterResolution } from "./parameter-resolution.js";
import {
  EvaluatedRigControlSchema,
  evaluateRigControlHierarchy,
  type RigControlEvaluationResult
} from "./rig-control-evaluation.js";
import type { RigControlTopologyEvaluation } from "./rig-control-hierarchy.js";
import type { RuntimeEvaluationOptionsDto } from "./runtime-options.js";
import type { RuntimeEvaluationInputDto } from "./runtime-input.js";
import type {
  RuntimeCoreEvaluationProfiler,
  RuntimeCoreEvaluationProfilePhaseKey
} from "./runtime-profiling.js";
import {
  EvaluatedDrawableTextureSchema,
  omitTextureProjectionCoordinates
} from "./texture-projection.js";
import {
  compileRuntimeDrawableSnapshotTemplates,
  compileRuntimeMaskRelationTemplates,
  compileRuntimeReferenceVerticesByDrawableId,
  materializeRuntimeDrawableSnapshots,
  materializeRuntimeRenderFrameDrawables,
  materializeRuntimeMaskRelations,
  type RuntimeSnapshotStaticTemplates
} from "./snapshot-static-templates.js";
import type { RuntimeDrawableEvaluationBase } from "./runtime-drawable-evaluation.js";

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
  solverKind: z.literal("worldFrameChainV1"),
  inputValues: z.record(ParameterIdSchema, z.number().finite()),
  outputParameterId: ParameterIdSchema,
  outputOffset: z.number().finite(),
  effectiveOutputValue: z.number().finite(),
  // World-frame chain state summary (design §5): particle count, max particle speed [cm/s], and the
  // tip segment's local angle [deg].
  stateSummary: z.object({
    particleCount: z.number().int().nonnegative(),
    maxParticleSpeed: z.number().finite(),
    tipAngleLocalDeg: z.number().finite()
  }),
  tick: z.number().int().nonnegative(),
  fixedStepMs: z.number().positive(),
  resetCounter: z.number().int().nonnegative(),
  debug: z
    .object({
      // World-frame anchor pose (§3.2): head-frame rotation [deg] and kinematic pin position [cm].
      anchorPhiDeg: z.number().finite().optional(),
      pinX: z.number().finite().optional(),
      pinY: z.number().finite().optional(),
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
export type RuntimeSnapshotValidationMode = "schema" | "skip";

export interface RuntimeRenderDrawableEvaluationDto {
  readonly drawableId: DrawableId;
  readonly vertices?: readonly Vec2Dto[];
  readonly opacity: number;
  readonly evaluatedDrawOrder: number;
  readonly visible: boolean;
}

export const createRuntimeSnapshot = (input: {
  readonly graph: NormalizedRuntimeGraph;
  readonly evaluationInput: RuntimeEvaluationInputDto;
  readonly state: RuntimeStateDto;
  readonly options: RuntimeEvaluationOptionsDto;
  readonly context: RuntimeEvaluationContextDto;
  readonly diagnostics: readonly DiagnosticDto[];
  readonly snapshotStaticTemplates?: RuntimeSnapshotStaticTemplates;
  readonly rigControlTopology?: RigControlTopologyEvaluation;
  readonly profiling?: RuntimeCoreEvaluationProfiler;
  readonly snapshotValidationMode?: RuntimeSnapshotValidationMode;
}): RuntimeSnapshotDto => {
  const measure = <TValue>(
    phase: RuntimeCoreEvaluationProfilePhaseKey,
    evaluate: () => TValue
  ): TValue =>
    input.profiling === undefined
      ? evaluate()
      : input.profiling.measure(phase, evaluate);
  input.profiling?.recordPublicSnapshotMaterialization();
  const drawableEvaluation = evaluateRuntimeDrawableFrame<EvaluatedDrawableDto>({
    graph: input.graph,
    evaluationInput: input.evaluationInput,
    state: input.state,
    options: input.options,
    ...(input.snapshotStaticTemplates === undefined
      ? {}
      : { snapshotStaticTemplates: input.snapshotStaticTemplates }),
    ...(input.rigControlTopology === undefined
      ? {}
      : { rigControlTopology: input.rigControlTopology }),
    ...(input.profiling === undefined ? {} : { profiling: input.profiling }),
    includeRigControls: true,
    createBaseDrawables: ({ drawableTemplates, keyformSampling }) =>
      materializeRuntimeDrawableSnapshots({
        templates: drawableTemplates,
        options: input.options,
        includeVertices:
          keyformSampling.samples.length > 0 || input.graph.rigControls.size > 0
      })
  });
  const parameterResolution = drawableEvaluation.parameterResolution;
  const keyformSampling = drawableEvaluation.keyformSampling;
  const appliedKeyforms = drawableEvaluation.appliedKeyforms;
  const rigControlEvaluation = drawableEvaluation.rigControlEvaluation;
  const drawables = measure(
    "drawableSnapshotCreationDurationMs",
    () => finalizeDrawablesForDetail(
      rigControlEvaluation.drawables,
      input.options,
      input.graph
    )
  );
  const maskTemplates =
    input.snapshotStaticTemplates?.masks ??
    measure(
      "maskEvaluationDurationMs",
      () => compileRuntimeMaskRelationTemplates(input.graph)
    );
  const masks = measure(
    "maskEvaluationDurationMs",
    () => materializeRuntimeMaskRelations(maskTemplates)
  );
  const drawList = measure(
    "visibilityDrawOrderEvaluationDurationMs",
    () => drawables
      .filter((drawable) => drawable.visible)
      .map((drawable) => drawable.drawableId)
  );

  const snapshot = {
    schemaVersion: "runtime-snapshot-v1",
    runtimeCoreVersion: "wave2-foundation",
    snapshotId: RuntimeSnapshotIdSchema.parse(`snap_${input.graph.packageId.replace(/^pkg_/, "")}_${input.evaluationInput.frameIndex}`),
    context: input.context,
    packageId: PackageIdSchema.parse(input.graph.packageId),
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
  } as unknown as RuntimeSnapshotDto;

  if (input.snapshotValidationMode === "skip") {
    return snapshot;
  }

  return measure("snapshotValidationDurationMs", () =>
    RuntimeSnapshotSchema.parse(snapshot));
};

export const evaluateRuntimeRenderDrawables = (input: {
  readonly graph: NormalizedRuntimeGraph;
  readonly evaluationInput: RuntimeEvaluationInputDto;
  readonly state: RuntimeStateDto;
  readonly options: RuntimeEvaluationOptionsDto;
  readonly snapshotStaticTemplates?: RuntimeSnapshotStaticTemplates;
  readonly rigControlTopology?: RigControlTopologyEvaluation;
  readonly profiling?: RuntimeCoreEvaluationProfiler;
}): readonly RuntimeRenderDrawableEvaluationDto[] => {
  const evaluation = evaluateRuntimeDrawableFrame<RuntimeDrawableEvaluationBase>({
    graph: input.graph,
    evaluationInput: input.evaluationInput,
    state: input.state,
    options: input.options,
    ...(input.snapshotStaticTemplates === undefined
      ? {}
      : { snapshotStaticTemplates: input.snapshotStaticTemplates }),
    ...(input.rigControlTopology === undefined
      ? {}
      : { rigControlTopology: input.rigControlTopology }),
    ...(input.profiling === undefined ? {} : { profiling: input.profiling }),
    includeRigControls: false,
    createBaseDrawables: ({ drawableTemplates }) =>
      materializeRuntimeRenderFrameDrawables({
        templates: drawableTemplates
      })
  });

  return evaluation.rigControlEvaluation.drawables.map((drawable) => ({
    drawableId: drawable.drawableId,
    ...(drawable.vertices === undefined ? {} : { vertices: drawable.vertices }),
    opacity: drawable.opacity,
    evaluatedDrawOrder: drawable.evaluatedDrawOrder,
    visible: drawable.visible
  }));
};

const evaluateRuntimeDrawableFrame = <
  TDrawable extends RuntimeDrawableEvaluationBase
>(input: {
  readonly graph: NormalizedRuntimeGraph;
  readonly evaluationInput: RuntimeEvaluationInputDto;
  readonly state: RuntimeStateDto;
  readonly options: RuntimeEvaluationOptionsDto;
  readonly snapshotStaticTemplates?: RuntimeSnapshotStaticTemplates;
  readonly rigControlTopology?: RigControlTopologyEvaluation;
  readonly profiling?: RuntimeCoreEvaluationProfiler;
  readonly includeRigControls: boolean;
  readonly createBaseDrawables: (input: {
    readonly drawableTemplates: readonly RuntimeSnapshotStaticTemplates["drawables"][number][];
    readonly keyformSampling: {
      readonly samples: readonly RuntimeKeyformSample[];
      readonly diagnostics: readonly DiagnosticDto[];
    };
  }) => readonly TDrawable[];
}): {
  readonly parameterResolution: EffectiveParameterResolution;
  readonly keyformSampling: {
    readonly samples: readonly RuntimeKeyformSample[];
    readonly diagnostics: readonly DiagnosticDto[];
  };
  readonly appliedKeyforms: {
    readonly drawables: readonly TDrawable[];
    readonly diagnostics: readonly DiagnosticDto[];
  };
  readonly rigControlEvaluation: RigControlEvaluationResult<TDrawable>;
} => {
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
  const drawableTemplates =
    input.snapshotStaticTemplates?.drawables ??
    measure(
      "drawableSnapshotCreationDurationMs",
      () => compileRuntimeDrawableSnapshotTemplates(input.graph)
    );
  const baseDrawables = measure(
    "drawableSnapshotCreationDurationMs",
    () => input.createBaseDrawables({
      drawableTemplates,
      keyformSampling
    })
  );
  const referenceVerticesByDrawableId =
    input.snapshotStaticTemplates?.referenceVerticesByDrawableId ??
    measure(
      "drawableSnapshotCreationDurationMs",
      () => compileRuntimeReferenceVerticesByDrawableId(input.graph)
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
      ...(input.rigControlTopology === undefined
        ? {}
        : { topology: input.rigControlTopology }),
      ...(input.profiling === undefined ? {} : { profiling: input.profiling }),
      includeRigControls: input.includeRigControls
    })
  );

  return {
    parameterResolution,
    keyformSampling,
    appliedKeyforms,
    rigControlEvaluation
  };
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
      const stateSummary =
        groupState ?? createResetDynamicsState(group, source.anchor, 0, false);
      const output = group.outputs[0];
      const outputOffsets = computeDynamicsOutputOffsetsWithAnchor(group, stateSummary, source.anchor);
      const outputOffset = outputOffsets[0];
      const evaluatedOutputParameter = output === undefined
        ? undefined
        : parameterResolution.values.find((parameter) => parameter.parameterId === output.parameterId);

      const dtSeconds = state.fixedStepMs / 1000;
      const maxParticleSpeed = stateSummary.particles.reduce((maxSpeed, particle) => {
        const speed = Math.hypot(particle.x - particle.px, particle.y - particle.py) / dtSeconds;
        return Math.max(maxSpeed, speed);
      }, 0);
      const tipOffset = outputOffsets[outputOffsets.length - 1];

      return EvaluatedDynamicsGroupSchema.parse({
        dynamicsGroupId: group.dynamicsGroupId,
        enabled: group.enabled,
        solverKind: "worldFrameChainV1",
        inputValues: source.inputValues,
        outputParameterId: outputOffset?.outputParameterId ?? output?.parameterId,
        outputOffset: outputOffset?.offset ?? 0,
        effectiveOutputValue: evaluatedOutputParameter?.effectiveValue ?? 0,
        stateSummary: {
          particleCount: stateSummary.particles.length,
          maxParticleSpeed,
          tipAngleLocalDeg: tipOffset?.thetaLocalDeg ?? 0
        },
        tick: stateSummary.tick,
        fixedStepMs: state.fixedStepMs,
        resetCounter: stateSummary.resetCounter,
        ...(options.snapshotDetail === "summary"
          ? {}
          : {
              debug: {
                anchorPhiDeg: source.anchor.phiDeg,
                pinX: source.anchor.pin.x,
                pinY: source.anchor.pin.y,
                rawOffset: outputOffset?.rawOffset ?? 0,
                outputClamped: outputOffset?.outputClamped ?? false,
                resetApplied: input.resetReasons.length > 0,
                resetReasons: input.resetReasons
              }
            }),
        diagnostics: []
      });
    });

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

const applySamplesInEvaluationOrder = <
  TDrawable extends RuntimeDrawableEvaluationBase
>(input: {
  readonly drawables: readonly TDrawable[];
  readonly samples: readonly RuntimeKeyformSample[];
  readonly hashPrecisionDecimals: number;
}): {
  readonly drawables: readonly TDrawable[];
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
