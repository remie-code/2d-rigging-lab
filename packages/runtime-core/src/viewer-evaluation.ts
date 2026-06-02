import {
  DrawableIdSchema,
  ParameterIdSchema,
  RuntimeEvaluationContextSchema,
  RuntimeEvaluationStrictnessSchema,
  RuntimeResetReasonSchema,
  RuntimeStateArtifactRefSchema,
  RuntimeStateDtoSchema,
  RuntimeSnapshotIdSchema,
  PartIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  RuntimeDiffDto,
  RuntimeStateArtifactRef,
  RuntimeStateDto
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import {
  evaluateRuntimeFrame
} from "./runtime-core.js";
import type { RuntimeComparisonResult } from "./snapshot-comparison.js";
import {
  compareRuntimeSnapshots
} from "./snapshot-comparison.js";
import type { RuntimeSnapshotDto } from "./snapshot.js";
import {
  EvaluatedMaskRelationSchema
} from "./mask-relation-evidence.js";
import {
  createRuntimeMeshEditEvidence,
  RuntimeMeshEditEvidenceSchema
} from "./mesh-evidence.js";
import {
  EvaluatedPartSchema
} from "./layer-tree-evidence.js";
import {
  createTutorialSnapshotEvidenceSummary,
  TutorialSnapshotEvidenceSummarySchema
} from "./tutorial-evidence-summary.js";
import {
  RuntimeEvaluationInputSchema
} from "./runtime-input.js";
import {
  defaultRuntimeEvaluationOptions,
  RuntimeEvaluationOptionsSchema
} from "./runtime-options.js";
import type {
  RuntimeEvaluationOptionsDto
} from "./runtime-options.js";
import {
  createInitialRuntimeState
} from "./initial-state.js";
import {
  createRuntimeStateArtifactRef
} from "./runtime-state-artifacts.js";

export const ViewerParameterOverrideSchema = z.record(ParameterIdSchema, z.number().finite());
export type ViewerParameterOverrideInput = z.input<typeof ViewerParameterOverrideSchema>;
export type ViewerParameterOverrideDto = z.infer<typeof ViewerParameterOverrideSchema>;

export const ViewerRuntimeEvaluationRequestSchema = z.object({
  schemaVersion: z.literal("viewer-runtime-evaluation-request-v1").default("viewer-runtime-evaluation-request-v1"),
  baselineFrameIndex: z.number().int().nonnegative().default(0),
  frameIndex: z.number().int().nonnegative().default(1),
  deltaTimeMs: z.number().finite().nonnegative().default(0),
  resetReasons: z.array(RuntimeResetReasonSchema).default(["packageLoad"]),
  baselineParameterOverrides: ViewerParameterOverrideSchema.default({}),
  parameterOverrides: ViewerParameterOverrideSchema.default({}),
  baselineState: RuntimeStateDtoSchema.optional(),
  previousState: RuntimeStateDtoSchema.optional(),
  targetIds: z.array(z.string()).default([]),
  options: RuntimeEvaluationOptionsSchema.default(defaultRuntimeEvaluationOptions()),
  strictness: RuntimeEvaluationStrictnessSchema.default("interactive"),
  operationId: z.string().optional()
});
export type ViewerRuntimeEvaluationRequestInput = z.input<typeof ViewerRuntimeEvaluationRequestSchema>;
export type ViewerRuntimeEvaluationRequestDto = z.infer<typeof ViewerRuntimeEvaluationRequestSchema>;

export const ViewerRuntimeEvaluationEvidenceSchema = z.object({
  schemaVersion: z.literal("viewer-runtime-evaluation-evidence-v1"),
  surface: z.literal("viewer"),
  packageId: z.string(),
  packageRevision: z.number().int().nonnegative(),
  packageHash: z.string().optional(),
  baselineSnapshotId: RuntimeSnapshotIdSchema,
  snapshotId: RuntimeSnapshotIdSchema,
  finalRuntimeStateRef: RuntimeStateArtifactRefSchema,
  parameterOverrides: z.array(
    z.object({
      parameterId: ParameterIdSchema,
      value: z.number().finite()
    })
  ),
  baselineParameterOverrides: z.array(
    z.object({
      parameterId: ParameterIdSchema,
      value: z.number().finite()
    })
  ),
  targetIds: z.array(z.string()),
  maskRelationEvidence: z.array(EvaluatedMaskRelationSchema).default([]),
  partHierarchyEvidence: z.array(EvaluatedPartSchema).default([]),
  drawableLayerEvidence: z
    .array(
      z.object({
        drawableId: DrawableIdSchema,
        partId: PartIdSchema.optional(),
        runtimeVisible: z.boolean(),
        textureStatus: z.enum(["resolved", "missing", "not_materialized"]),
        textureId: TextureIdSchema.optional()
      })
    )
    .default([]),
  drawableOpacityEvidence: z
    .array(
      z.object({
        drawableId: DrawableIdSchema,
        opacity: z.number().min(0).max(1),
        visible: z.boolean()
      })
    )
    .default([]),
  drawableRuntimeStateChanges: z
    .array(
      z.object({
        drawableId: DrawableIdSchema,
        opacityBefore: z.number().min(0).max(1),
        opacityAfter: z.number().min(0).max(1),
        visibleBefore: z.boolean(),
        visibleAfter: z.boolean(),
        baseDrawOrderBefore: z.number().int(),
        baseDrawOrderAfter: z.number().int(),
        evaluatedDrawOrderBefore: z.number().int(),
        evaluatedDrawOrderAfter: z.number().int()
      })
    )
    .default([]),
  meshEditEvidence: RuntimeMeshEditEvidenceSchema.optional(),
  tutorialEvidenceSummary: TutorialSnapshotEvidenceSummarySchema,
  runtimeDiffEquivalent: z.boolean(),
  runtimeEvaluationContext: RuntimeEvaluationContextSchema
});
export type ViewerRuntimeEvaluationEvidenceDto = z.infer<typeof ViewerRuntimeEvaluationEvidenceSchema>;

export interface ViewerRuntimeEvaluationResult {
  readonly baselineSnapshot: RuntimeSnapshotDto;
  readonly snapshot: RuntimeSnapshotDto;
  readonly previousState: RuntimeStateDto;
  readonly nextState: RuntimeStateDto;
  readonly runtimeComparison: RuntimeComparisonResult;
  readonly runtimeDiff: RuntimeDiffDto;
  readonly evidence: ViewerRuntimeEvaluationEvidenceDto;
}

export const evaluateViewerRuntimeSnapshot = (
  graph: NormalizedRuntimeGraph,
  requestInput: ViewerRuntimeEvaluationRequestInput = {}
): ViewerRuntimeEvaluationResult => {
  const request = ViewerRuntimeEvaluationRequestSchema.parse(requestInput);
  const options = RuntimeEvaluationOptionsSchema.parse(request.options);
  const context = RuntimeEvaluationContextSchema.parse({
    source: {
      surface: "viewer",
      ...(request.operationId === undefined ? {} : { operationId: request.operationId })
    },
    policy: {
      strictness: request.strictness
    }
  });
  const baselineState = request.baselineState ?? createViewerInitialState({
    graph,
    frameIndex: request.baselineFrameIndex,
    parameterOverrides: request.baselineParameterOverrides,
    resetReasons: request.resetReasons
  });
  const previousState = request.previousState ?? createViewerInitialState({
    graph,
    frameIndex: request.frameIndex === 0 ? 0 : request.frameIndex - 1,
    parameterOverrides: request.parameterOverrides,
    resetReasons: request.resetReasons
  });
  const baselineSnapshot = evaluateViewerFrame({
    graph,
    frameIndex: request.baselineFrameIndex,
    deltaTimeMs: request.deltaTimeMs,
    resetReasons: request.resetReasons,
    parameterOverrides: request.baselineParameterOverrides,
    targetIds: request.targetIds,
    previousState: baselineState,
    options,
    context
  }).snapshot;
  const result = evaluateViewerFrame({
    graph,
    frameIndex: request.frameIndex,
    deltaTimeMs: request.deltaTimeMs,
    resetReasons: request.resetReasons,
    parameterOverrides: request.parameterOverrides,
    targetIds: request.targetIds,
    previousState,
    options,
    context
  });
  const runtimeComparison = compareRuntimeSnapshots(
    baselineSnapshot,
    result.snapshot,
    options.epsilonPolicy
  );
  const finalRuntimeStateRef = createRuntimeStateArtifactRef({
    graph,
    state: result.nextState,
    label: "viewer"
  });

  return {
    baselineSnapshot,
    snapshot: result.snapshot,
    previousState,
    nextState: result.nextState,
    runtimeComparison,
    runtimeDiff: runtimeComparison.diff,
    evidence: createViewerRuntimeEvaluationEvidence({
      graph,
      baselineSnapshot,
      snapshot: result.snapshot,
      finalRuntimeStateRef,
      baselineParameterOverrides: request.baselineParameterOverrides,
      parameterOverrides: request.parameterOverrides,
      targetIds: request.targetIds,
      runtimeComparison,
      comparisonPolicy: options.epsilonPolicy,
      context
    })
  };
};

const evaluateViewerFrame = (input: {
  readonly graph: NormalizedRuntimeGraph;
  readonly frameIndex: number;
  readonly deltaTimeMs: number;
  readonly resetReasons: readonly z.infer<typeof RuntimeResetReasonSchema>[];
  readonly parameterOverrides: ViewerParameterOverrideDto;
  readonly targetIds: readonly string[];
  readonly previousState: RuntimeStateDto;
  readonly options: RuntimeEvaluationOptionsDto;
  readonly context: z.infer<typeof RuntimeEvaluationContextSchema>;
}): {
  readonly snapshot: RuntimeSnapshotDto;
  readonly nextState: RuntimeStateDto;
} =>
  evaluateRuntimeFrame(
    input.graph,
    RuntimeEvaluationInputSchema.parse({
      schemaVersion: "runtime-evaluation-input-v1",
      frameIndex: input.frameIndex,
      deltaTimeMs: input.deltaTimeMs,
      resetReasons: input.resetReasons,
      authoredParameterValues: input.parameterOverrides,
      targetIds: input.targetIds
    }),
    input.previousState,
    input.options,
    input.context
  );

const createViewerInitialState = (input: {
  readonly graph: NormalizedRuntimeGraph;
  readonly frameIndex: number;
  readonly parameterOverrides: ViewerParameterOverrideDto;
  readonly resetReasons: readonly z.infer<typeof RuntimeResetReasonSchema>[];
}): RuntimeStateDto =>
  createInitialRuntimeState(input.graph, {
    packageId: input.graph.packageId,
    packageRevision: input.graph.packageRevision,
    ...(input.graph.packageHash === undefined ? {} : { packageHash: input.graph.packageHash }),
    frameIndex: input.frameIndex,
    authoredParameterValues: input.parameterOverrides,
    resetReasons: input.resetReasons.length === 0 ? ["packageLoad"] : [...input.resetReasons]
  });

const createViewerRuntimeEvaluationEvidence = (input: {
  readonly graph: NormalizedRuntimeGraph;
  readonly baselineSnapshot: RuntimeSnapshotDto;
  readonly snapshot: RuntimeSnapshotDto;
  readonly finalRuntimeStateRef: RuntimeStateArtifactRef;
  readonly baselineParameterOverrides: ViewerParameterOverrideDto;
  readonly parameterOverrides: ViewerParameterOverrideDto;
  readonly targetIds: readonly string[];
  readonly runtimeComparison: RuntimeComparisonResult;
  readonly comparisonPolicy: RuntimeEvaluationOptionsDto["epsilonPolicy"];
  readonly context: z.infer<typeof RuntimeEvaluationContextSchema>;
}): ViewerRuntimeEvaluationEvidenceDto => {
  const meshEditEvidence = createRuntimeMeshEditEvidence({
    baselineSnapshot: input.baselineSnapshot,
    candidateSnapshot: input.snapshot,
    comparisonPolicy: input.comparisonPolicy
  });

  return ViewerRuntimeEvaluationEvidenceSchema.parse({
    schemaVersion: "viewer-runtime-evaluation-evidence-v1",
    surface: "viewer",
    packageId: input.graph.packageId,
    packageRevision: input.graph.packageRevision,
    ...(input.graph.packageHash === undefined ? {} : { packageHash: input.graph.packageHash }),
    baselineSnapshotId: input.baselineSnapshot.snapshotId,
    snapshotId: input.snapshot.snapshotId,
    finalRuntimeStateRef: input.finalRuntimeStateRef,
    baselineParameterOverrides: toSortedOverrideEntries(input.baselineParameterOverrides),
    parameterOverrides: toSortedOverrideEntries(input.parameterOverrides),
    targetIds: [...input.targetIds],
    maskRelationEvidence: [...input.snapshot.masks].sort((left, right) =>
      left.maskRelationId.localeCompare(right.maskRelationId)
    ),
    partHierarchyEvidence: [...(input.snapshot.parts ?? [])].sort((left, right) =>
      left.hierarchyPath.join("/").localeCompare(right.hierarchyPath.join("/")) ||
      left.partId.localeCompare(right.partId)
    ),
    drawableLayerEvidence: input.snapshot.drawables
      .map((drawable) => ({
        drawableId: drawable.drawableId,
        ...(drawable.partId === undefined ? {} : { partId: drawable.partId }),
        runtimeVisible: drawable.visible,
        textureStatus: drawable.texture?.status ?? "missing",
        ...(drawable.texture?.textureId === undefined ? {} : { textureId: drawable.texture.textureId })
      }))
      .sort((left, right) => left.drawableId.localeCompare(right.drawableId)),
    drawableOpacityEvidence: input.snapshot.drawables
      .map((drawable) => ({
        drawableId: drawable.drawableId,
        opacity: drawable.opacity,
        visible: drawable.visible
      }))
      .sort((left, right) => left.drawableId.localeCompare(right.drawableId)),
    drawableRuntimeStateChanges: [...input.runtimeComparison.diff.drawableRuntimeStateChanges].sort((left, right) =>
      left.drawableId.localeCompare(right.drawableId)
    ),
    meshEditEvidence,
    tutorialEvidenceSummary: createTutorialSnapshotEvidenceSummary({
      source: "viewer",
      snapshot: input.snapshot,
      baselineSnapshotId: input.baselineSnapshot.snapshotId,
      candidateSnapshotId: input.snapshot.snapshotId,
      finalRuntimeStateRef: input.finalRuntimeStateRef,
      runtimeDiff: input.runtimeComparison.diff,
      meshEditEvidence
    }),
    runtimeDiffEquivalent: input.runtimeComparison.equivalent,
    runtimeEvaluationContext: input.context
  });
};

const toSortedOverrideEntries = (
  overrides: ViewerParameterOverrideDto
): readonly { readonly parameterId: string; readonly value: number }[] =>
  Object.entries(overrides)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([parameterId, value]) => ({
      parameterId,
      value
    }));
