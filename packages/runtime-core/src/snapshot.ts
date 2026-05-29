import {
  DiagnosticSchema,
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  MeshIdSchema,
  MaskRelationIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  RectDtoSchema,
  RigControlIdSchema,
  RuntimeEvaluationContextSchema,
  RuntimeResetReasonSchema,
  RuntimeSnapshotIdSchema,
  Vec2DtoSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  DiagnosticDto,
  ParameterId,
  RuntimeEvaluationContextDto,
  RuntimeStateDto
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import { KeyformSampleSchema } from "./keyform-evaluation-types.js";
import { applyKeyformTargetPatches } from "./keyform-target-application.js";
import type { RuntimeKeyformSample } from "./keyform-sampling.js";
import { sampleRuntimeKeyforms } from "./keyform-sampling.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import { resolveEffectiveParameterValues } from "./parameter-resolution.js";
import type { EffectiveParameterResolution } from "./parameter-resolution.js";
import type { RuntimeEvaluationOptionsDto } from "./runtime-options.js";
import type { RuntimeEvaluationInputDto } from "./runtime-input.js";

export const EvaluatedParameterSchema = z.object({
  parameterId: ParameterIdSchema,
  valueSource: z.enum(["authoredInput", "computedDynamics", "debugOverride"]),
  authoredValue: z.number().finite().optional(),
  computedValue: z.number().finite().optional(),
  effectiveValue: z.number().finite(),
  clamped: z.boolean(),
  source: z.enum([
    "default",
    "viewerOverride",
    "editorPreviewOverride",
    "operationDryRun",
    "dynamicsComputed",
    "debugOverride"
  ])
});
export type EvaluatedParameterDto = z.infer<typeof EvaluatedParameterSchema>;

export const EvaluatedDrawableSchema = z.object({
  drawableId: DrawableIdSchema,
  meshId: MeshIdSchema,
  visible: z.boolean(),
  opacity: z.number().min(0).max(1),
  baseDrawOrder: z.number().int(),
  evaluatedDrawOrder: z.number().int(),
  bounds: RectDtoSchema,
  vertexCount: z.number().int().nonnegative(),
  vertexHash: z.string(),
  vertices: z.array(Vec2DtoSchema).optional(),
  diagnostics: z.array(DiagnosticSchema).default([])
});
export type EvaluatedDrawableDto = z.infer<typeof EvaluatedDrawableSchema>;

export const EvaluatedDynamicsGroupSchema = z.object({
  dynamicsGroupId: DynamicsGroupIdSchema,
  enabled: z.boolean(),
  solverKind: z.literal("scalarDampedFollowV1"),
  driverValues: z.record(ParameterIdSchema, z.number().finite()),
  outputParameterId: ParameterIdSchema,
  outputValue: z.number().finite(),
  stateSummary: z.object({
    position: z.number().finite(),
    velocity: z.number().finite()
  }),
  tick: z.number().int().nonnegative(),
  fixedStepMs: z.number().positive(),
  resetCounter: z.number().int().nonnegative(),
  debug: z
    .object({
      rawTarget: z.number().finite().optional(),
      clampedTarget: z.number().finite().optional(),
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
  rigControls: z
    .array(
      z.object({
        rigControlId: RigControlIdSchema,
        kind: z.enum(["rotation2d", "warpLattice2d"]),
        enabled: z.boolean(),
        parentId: RigControlIdSchema.optional(),
        bounds: RectDtoSchema.optional()
      })
    )
    .default([]),
  drawables: z.array(EvaluatedDrawableSchema),
  masks: z.array(
    z.object({
      maskRelationId: MaskRelationIdSchema,
      targetDrawableIds: z.array(DrawableIdSchema),
      resolved: z.boolean()
    })
  ),
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
}): RuntimeSnapshotDto => {
  const parameterResolution = resolveEffectiveParameterValues({
    graph: input.graph,
    authoredParameterValues: input.evaluationInput.authoredParameterValues,
    state: input.state
  });
  const keyformSampling = sampleRuntimeKeyformsInEvaluationOrder({
    graph: input.graph,
    effectiveParameterValues: parameterResolution.effectiveParameterValues
  });
  const baseDrawables = createEvaluatedDrawables({
    graph: input.graph,
    options: input.options,
    includeVertices: keyformSampling.samples.length > 0
  });
  const appliedKeyforms = applySamplesInEvaluationOrder({
    drawables: baseDrawables,
    samples: keyformSampling.samples,
    hashPrecisionDecimals: input.options.epsilonPolicy.hashPrecisionDecimals
  });
  const drawables = finalizeDrawablesForDetail(appliedKeyforms.drawables, input.options);

  return RuntimeSnapshotSchema.parse({
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
    dynamics: createEvaluatedDynamics(input.graph, input.evaluationInput, input.state, input.options),
    keyformSamples: keyformSampling.samples,
    rigControls: [...input.graph.rigControls.values()].map((rigControl) => ({
      rigControlId: rigControl.rigControlId,
      kind: rigControl.kind,
      enabled: rigControl.enabled,
      ...(rigControl.parentId === undefined ? {} : { parentId: rigControl.parentId }),
      ...(rigControl.kind === "warpLattice2d" ? { bounds: rigControl.domainBounds } : {})
    })),
    drawables,
    masks: input.graph.masks.map((mask) => ({
      maskRelationId: mask.maskRelationId,
      targetDrawableIds: [...mask.targetDrawableIds],
      resolved: true
    })),
    drawList: drawables.filter((drawable) => drawable.visible).map((drawable) => drawable.drawableId),
    disabledFutureLayers: input.graph.disabledFutureLayers.map((layer) => layer.layerId),
    diagnostics: [...input.diagnostics, ...keyformSampling.diagnostics, ...appliedKeyforms.diagnostics],
    ...(input.options.includeTrace
      ? {
          trace: {
            phases: [
              "parameter_resolution",
              "dynamics_evaluation",
              "keyform_sampling",
              "mesh_evaluation",
              "opacity_visibility",
              "draw_order_resolution",
              "render_preparation"
            ],
            evaluatorVersionSummary: input.options.evaluatorVersions
          }
        }
      : {})
  });
};

const createEvaluatedParameters = (resolution: EffectiveParameterResolution): EvaluatedParameterDto[] =>
  resolution.values.map((parameter) => EvaluatedParameterSchema.parse(parameter));

const createEvaluatedDynamics = (
  graph: NormalizedRuntimeGraph,
  input: RuntimeEvaluationInputDto,
  state: RuntimeStateDto,
  options: RuntimeEvaluationOptionsDto
): EvaluatedDynamicsGroupDto[] =>
  [...graph.dynamicsGroups.values()]
    .filter((group) => group.enabled)
    .map((group) => {
      const groupState = state.dynamicsGroups[group.dynamicsGroupId];
      const outputValue = groupState?.position ?? 0;
      const driverValues = Object.fromEntries(
        group.drivers.map((driver) => {
          const parameterDefault = graph.parameters.get(driver.sourceParameterId)?.default ?? 0;
          return [driver.sourceParameterId, input.authoredParameterValues[driver.sourceParameterId] ?? parameterDefault];
        })
      );

      return EvaluatedDynamicsGroupSchema.parse({
        dynamicsGroupId: group.dynamicsGroupId,
        enabled: group.enabled,
        solverKind: group.solverKind,
        driverValues,
        outputParameterId: group.output.targetParameterId,
        outputValue,
        stateSummary: {
          position: outputValue,
          velocity: groupState?.velocity ?? 0
        },
        tick: groupState?.tick ?? 0,
        fixedStepMs: state.fixedStepMs,
        resetCounter: groupState?.resetCounter ?? 0,
        ...(options.snapshotDetail === "summary"
          ? {}
          : {
              debug: {
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
        visible: drawable.visible,
        opacity: clamp(drawable.opacity, 0, 1),
        baseDrawOrder: drawable.baseDrawOrder,
        evaluatedDrawOrder: explicitOrder.get(drawable.drawableId) ?? drawable.baseDrawOrder,
        bounds: drawable.bounds,
        vertexCount: drawable.vertexCount,
        vertexHash: drawable.vertexHash ?? createStableVertexHash(drawable.drawableId, drawable.vertexCount),
        ...((options.snapshotDetail === "full" || input.includeVertices) && drawable.vertices !== undefined
          ? { vertices: drawable.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y })) }
          : {}),
        diagnostics: []
      })
    )
    .sort((left, right) => left.evaluatedDrawOrder - right.evaluatedDrawOrder || left.drawableId.localeCompare(right.drawableId));
};

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
  options: RuntimeEvaluationOptionsDto
): readonly EvaluatedDrawableDto[] => {
  if (options.snapshotDetail === "full") {
    return drawables;
  }

  return drawables.map((drawable) => {
    const { vertices, ...withoutVertices } = drawable;
    void vertices;
    return withoutVertices;
  });
};

const createStableVertexHash = (drawableId: string, vertexCount: number): string => `hash_${drawableId}_${vertexCount}`;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
