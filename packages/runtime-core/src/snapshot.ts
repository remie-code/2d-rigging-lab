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
  RuntimeEvaluationContextDto,
  RuntimeStateDto
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
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
  keyformSamples: z.array(z.object({}).passthrough()).default([]),
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
  const drawables = createEvaluatedDrawables(input.graph, input.options);

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
    parameters: createEvaluatedParameters(input.graph, input.evaluationInput, input.state),
    dynamics: createEvaluatedDynamics(input.graph, input.evaluationInput, input.state, input.options),
    keyformSamples: [],
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
    diagnostics: [...input.diagnostics],
    ...(input.options.includeTrace
      ? {
          trace: {
            phases: ["parameter_resolution", "dynamics_evaluation", "draw_order_resolution", "render_preparation"],
            evaluatorVersionSummary: input.options.evaluatorVersions
          }
        }
      : {})
  });
};

const createEvaluatedParameters = (
  graph: NormalizedRuntimeGraph,
  input: RuntimeEvaluationInputDto,
  state: RuntimeStateDto
): EvaluatedParameterDto[] =>
  [...graph.parameters.values()].map((parameter) => {
    const authoredValue = input.authoredParameterValues[parameter.id];
    const authoredOrDefault = authoredValue ?? parameter.default;
    const clampedAuthored = clamp(authoredOrDefault, parameter.min, parameter.max);
    const dynamicsGroup = [...graph.dynamicsGroups.values()].find(
      (group) => group.output.targetParameterId === parameter.id && group.enabled
    );
    const computedValue =
      dynamicsGroup === undefined ? undefined : state.dynamicsGroups[dynamicsGroup.dynamicsGroupId]?.position;
    const effectiveValue = parameter.valueSource === "computedDynamics" ? computedValue ?? parameter.default : clampedAuthored;

    return EvaluatedParameterSchema.parse({
      parameterId: parameter.id,
      valueSource: parameter.valueSource,
      ...(authoredValue === undefined ? {} : { authoredValue }),
      ...(computedValue === undefined ? {} : { computedValue }),
      effectiveValue,
      clamped: authoredOrDefault !== clampedAuthored,
      source:
        parameter.valueSource === "computedDynamics"
          ? "dynamicsComputed"
          : authoredValue === undefined
            ? "default"
            : "viewerOverride"
    });
  });

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

const createEvaluatedDrawables = (
  graph: NormalizedRuntimeGraph,
  options: RuntimeEvaluationOptionsDto
): EvaluatedDrawableDto[] => {
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
        ...(options.snapshotDetail === "full" && drawable.vertices !== undefined ? { vertices: [...drawable.vertices] } : {}),
        diagnostics: []
      })
    )
    .sort((left, right) => left.evaluatedDrawOrder - right.evaluatedDrawOrder || left.drawableId.localeCompare(right.drawableId));
};

const createStableVertexHash = (drawableId: string, vertexCount: number): string => `hash_${drawableId}_${vertexCount}`;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
