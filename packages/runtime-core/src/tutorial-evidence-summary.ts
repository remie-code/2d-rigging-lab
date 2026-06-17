import type {
  RuntimeDiffDto,
  RuntimeStateArtifactRef,
  RuntimeStateSequenceArtifactRef
} from "@private-2d-rigging-lab/contracts";

import type {
  RuntimeMeshEditEvidenceDto
} from "./mesh-evidence.js";
import {
  RuntimeMeshEditEvidenceSchema
} from "./mesh-evidence.js";
import type {
  RuntimeEvidenceResult
} from "./runtime-evidence.js";
import type {
  RuntimeSnapshotDto
} from "./snapshot.js";
import type {
  ViewerRuntimeEvaluationResult
} from "./viewer-evaluation.js";
import {
  TUTORIAL_REQUIRED_SLICE_IDS,
  TutorialDrawableLayerEvidenceRefSchema,
  TutorialDynamicsEvidenceRefSchema,
  TutorialMaskRelationEvidenceRefSchema,
  TutorialMeshEditEvidenceRefSchema,
  TutorialMeshEvidenceRefSchema,
  TutorialOpacityEvidenceRefSchema,
  TutorialPartEvidenceRefSchema,
  TutorialRigControlEvidenceRefSchema,
  TutorialRigControlKeyformEvidenceRefSchema,
  TutorialRuntimeViewerEvidenceSummarySchema,
  TutorialSemanticReadinessSummarySchema,
  TutorialSliceStatusSchema,
  TutorialSnapshotEvidenceSummarySchema
} from "./tutorial-evidence-summary-schema.js";
import type {
  TutorialDrawableLayerEvidenceRefDto,
  TutorialDynamicsEvidenceRefDto,
  TutorialEvidenceSliceId,
  TutorialEvidenceSurface,
  TutorialMaskRelationEvidenceRefDto,
  TutorialMeshEditEvidenceRefDto,
  TutorialMeshEvidenceRefDto,
  TutorialOpacityEvidenceRefDto,
  TutorialPackageRefDto,
  TutorialPartEvidenceRefDto,
  TutorialRenderedCorrectnessBoundaryDto,
  TutorialRigControlEvidenceRefDto,
  TutorialRigControlKeyformEvidenceRefDto,
  TutorialRuntimeViewerEvidenceSummaryDto,
  TutorialSemanticReadinessSummaryDto,
  TutorialSliceStatusDto,
  TutorialSnapshotEvidenceRefsDto,
  TutorialSnapshotEvidenceSummaryDto
} from "./tutorial-evidence-summary-schema.js";

export * from "./tutorial-evidence-summary-schema.js";

export const createTutorialSnapshotEvidenceSummary = (input: {
  readonly source: TutorialEvidenceSurface;
  readonly snapshot: RuntimeSnapshotDto;
  readonly baselineSnapshotId?: string;
  readonly candidateSnapshotId?: string;
  readonly generatedRuntimeSnapshotIds?: readonly string[];
  readonly generatedRuntimeStateRefs?: readonly RuntimeStateArtifactRef[];
  readonly generatedRuntimeStateSequenceRefs?: readonly RuntimeStateSequenceArtifactRef[];
  readonly finalRuntimeStateRef?: RuntimeStateArtifactRef;
  readonly runtimeDiff?: RuntimeDiffDto;
  readonly meshEditEvidence?: RuntimeMeshEditEvidenceDto;
}): TutorialSnapshotEvidenceSummaryDto => {
  const parts = createPartRefs(input.snapshot);
  const layers = createDrawableLayerRefs(input.snapshot);
  const drawables = createDrawableRefs(input.snapshot);
  const meshes = createMeshRefs(input.snapshot);
  const meshEdits = createMeshEditRefs(input.meshEditEvidence);
  const maskRelations = createMaskRelationRefs(input.snapshot);
  const opacityRefs = createOpacityRefs(input.snapshot);
  const nonDefaultOpacityDrawableIds = opacityRefs
    .filter((opacity) => opacity.opacity !== 1)
    .map((opacity) => opacity.drawableId)
    .sort(compareStrings);
  const rigControls = createRigControlRefs(input.snapshot);
  const rigControlKeyforms = createRigControlKeyformRefs(input.snapshot);
  const dynamics = createDynamicsRefs(input.snapshot);
  const sliceStatus = createSliceStatus({
    parts,
    layers,
    drawables,
    meshes,
    meshEdits,
    maskRelations,
    nonDefaultOpacityDrawableIds,
    rigControls,
    rigControlKeyforms,
    dynamics
  });

  return TutorialSnapshotEvidenceSummarySchema.parse({
    schemaVersion: "tutorial-snapshot-evidence-summary-v1",
    source: input.source,
    packageRef: createPackageRef(input.snapshot),
    evidenceRefs: {
      snapshotId: input.snapshot.snapshotId,
      ...(input.baselineSnapshotId === undefined ? {} : { baselineSnapshotId: input.baselineSnapshotId }),
      ...(input.candidateSnapshotId === undefined ? {} : { candidateSnapshotId: input.candidateSnapshotId }),
      generatedRuntimeSnapshotIds: [...(input.generatedRuntimeSnapshotIds ?? [])],
      generatedRuntimeStateRefs: [...(input.generatedRuntimeStateRefs ?? [])],
      generatedRuntimeStateSequenceRefs: [...(input.generatedRuntimeStateSequenceRefs ?? [])],
      ...(input.finalRuntimeStateRef === undefined ? {} : { finalRuntimeStateRef: input.finalRuntimeStateRef }),
      ...(input.runtimeDiff === undefined ? {} : { runtimeDiff: summarizeRuntimeDiff(input.runtimeDiff) })
    },
    semanticReadiness: createSemanticReadiness(sliceStatus),
    renderedCorrectness: createRenderedCorrectnessBoundary(),
    parts: {
      present: parts.length > 0,
      count: parts.length,
      refs: parts
    },
    layers: {
      present: layers.length > 0,
      count: layers.length,
      refs: layers
    },
    drawables: {
      present: drawables.length > 0,
      count: drawables.length,
      visibleCount: input.snapshot.drawables.filter((drawable) => drawable.visible).length,
      refs: drawables
    },
    meshes: {
      present: meshes.length > 0,
      count: meshes.length,
      refs: meshes
    },
    meshEdits: {
      present: meshEdits.length > 0,
      count: meshEdits.length,
      refs: meshEdits
    },
    maskOpacity: {
      present: maskRelations.length > 0 || nonDefaultOpacityDrawableIds.length > 0,
      maskRelationCount: maskRelations.length,
      opacityEvidenceCount: opacityRefs.length,
      nonDefaultOpacityDrawableIds,
      maskRelationRefs: maskRelations,
      opacityRefs
    },
    rigControls: {
      present: rigControls.length > 0,
      count: rigControls.length,
      refs: rigControls
    },
    rigControlKeyforms: {
      present: rigControlKeyforms.length > 0,
      count: rigControlKeyforms.length,
      refs: rigControlKeyforms
    },
    dynamics: {
      present: dynamics.length > 0,
      count: dynamics.length,
      refs: dynamics
    }
  });
};

export const createTutorialRuntimeViewerEvidenceSummary = (input: {
  readonly runtimeEvidence: RuntimeEvidenceResult;
  readonly viewerResult: ViewerRuntimeEvaluationResult;
}): TutorialRuntimeViewerEvidenceSummaryDto => {
  const runtimeSummary = createTutorialSnapshotEvidenceSummary({
    source: "runtime",
    snapshot: input.runtimeEvidence.candidateSnapshot,
    baselineSnapshotId: input.runtimeEvidence.baselineSnapshot.snapshotId,
    candidateSnapshotId: input.runtimeEvidence.candidateSnapshot.snapshotId,
    generatedRuntimeSnapshotIds: input.runtimeEvidence.generatedRuntimeSnapshotIds,
    generatedRuntimeStateRefs: input.runtimeEvidence.generatedRuntimeStateRefs,
    generatedRuntimeStateSequenceRefs: input.runtimeEvidence.generatedRuntimeStateSequenceRefs,
    finalRuntimeStateRef: input.runtimeEvidence.finalRuntimeStateRef,
    runtimeDiff: input.runtimeEvidence.runtimeDiff,
    meshEditEvidence: input.runtimeEvidence.meshEditEvidence
  });
  const viewerSummary = createTutorialSnapshotEvidenceSummary({
    source: "viewer",
    snapshot: input.viewerResult.snapshot,
    baselineSnapshotId: input.viewerResult.baselineSnapshot.snapshotId,
    candidateSnapshotId: input.viewerResult.snapshot.snapshotId,
    generatedRuntimeStateRefs: [input.viewerResult.evidence.finalRuntimeStateRef],
    finalRuntimeStateRef: input.viewerResult.evidence.finalRuntimeStateRef,
    runtimeDiff: input.viewerResult.runtimeDiff,
    ...(input.viewerResult.evidence.meshEditEvidence === undefined
      ? {}
      : { meshEditEvidence: input.viewerResult.evidence.meshEditEvidence })
  });
  const semanticReadiness = combineSemanticReadiness([
    runtimeSummary.semanticReadiness,
    viewerSummary.semanticReadiness
  ]);

  return TutorialRuntimeViewerEvidenceSummarySchema.parse({
    schemaVersion: "tutorial-runtime-viewer-evidence-summary-v1",
    packageRef: runtimeSummary.packageRef,
    runtimeSummary,
    viewerSummary,
    semanticReadiness,
    renderedCorrectness: createRenderedCorrectnessBoundary()
  });
};

const createPackageRef = (snapshot: RuntimeSnapshotDto): TutorialPackageRefDto => ({
  packageId: snapshot.packageId,
  packageRevision: snapshot.packageRevision,
  ...(snapshot.packageHash === undefined ? {} : { packageHash: snapshot.packageHash })
});

const createPartRefs = (snapshot: RuntimeSnapshotDto): readonly TutorialPartEvidenceRefDto[] =>
  [...(snapshot.parts ?? [])]
    .map((part) =>
      TutorialPartEvidenceRefSchema.parse({
        partId: part.partId,
        displayName: part.displayName,
        ...(part.parentPartId === undefined ? {} : { parentPartId: part.parentPartId }),
        childPartIds: [...part.childPartIds].sort(compareStrings),
        drawableIds: [...part.drawableIds].sort(compareStrings),
        hierarchyPath: [...part.hierarchyPath],
        depth: part.depth,
        runtimeVisibleDrawableCount: part.runtimeVisibleDrawableCount
      })
    )
    .sort((left, right) => left.hierarchyPath.join("/").localeCompare(right.hierarchyPath.join("/")) || left.partId.localeCompare(right.partId));

const createDrawableLayerRefs = (snapshot: RuntimeSnapshotDto): readonly TutorialDrawableLayerEvidenceRefDto[] =>
  snapshot.drawables
    .map((drawable) =>
      TutorialDrawableLayerEvidenceRefSchema.parse({
        drawableId: drawable.drawableId,
        meshId: drawable.meshId,
        ...(drawable.partId === undefined ? {} : { partId: drawable.partId }),
        runtimeVisible: drawable.visible,
        opacity: drawable.opacity,
        baseDrawOrder: drawable.baseDrawOrder,
        evaluatedDrawOrder: drawable.evaluatedDrawOrder,
        textureStatus: drawable.texture?.status ?? "missing",
        ...(drawable.texture?.textureId === undefined ? {} : { textureId: drawable.texture.textureId })
      })
    )
    .sort((left, right) => left.evaluatedDrawOrder - right.evaluatedDrawOrder || left.drawableId.localeCompare(right.drawableId));

const createDrawableRefs = (snapshot: RuntimeSnapshotDto): readonly string[] =>
  snapshot.drawables.map((drawable) => drawable.drawableId).sort(compareStrings);

const createMeshRefs = (snapshot: RuntimeSnapshotDto): readonly TutorialMeshEvidenceRefDto[] =>
  snapshot.drawables
    .filter((drawable) => drawable.vertexCount > 0 || drawable.mesh !== undefined)
    .map((drawable) =>
      TutorialMeshEvidenceRefSchema.parse({
        drawableId: drawable.drawableId,
        meshId: drawable.meshId,
        vertexCount: drawable.vertexCount,
        vertexHash: drawable.vertexHash,
        ...(drawable.mesh === undefined ? {} : { topology: drawable.mesh.topology })
      })
    )
    .sort((left, right) => left.meshId.localeCompare(right.meshId));

const createMeshEditRefs = (
  meshEditEvidence: RuntimeMeshEditEvidenceDto | undefined
): readonly TutorialMeshEditEvidenceRefDto[] => {
  const parsed = meshEditEvidence === undefined ? undefined : RuntimeMeshEditEvidenceSchema.parse(meshEditEvidence);
  return (parsed?.drawables ?? [])
    .filter((drawable) => drawable.boundsChanged || drawable.vertexHashChanged || drawable.movedVertexRefs.length > 0)
    .map((drawable) =>
      TutorialMeshEditEvidenceRefSchema.parse({
        drawableId: drawable.drawableId,
        meshId: drawable.meshId,
        boundsChanged: drawable.boundsChanged,
        vertexHashChanged: drawable.vertexHashChanged,
        movedVertexRefs: drawable.movedVertexRefs.map((vertex) => vertex.vertexRef).sort(compareStrings)
      })
    )
    .sort((left, right) => left.meshId.localeCompare(right.meshId));
};

const createMaskRelationRefs = (snapshot: RuntimeSnapshotDto): readonly TutorialMaskRelationEvidenceRefDto[] =>
  snapshot.masks
    .map((mask) =>
      TutorialMaskRelationEvidenceRefSchema.parse({
        maskRelationId: mask.maskRelationId,
        sourceDrawableIds: [...mask.sourceDrawableIds].sort(compareStrings),
        targetDrawableIds: [...mask.targetDrawableIds].sort(compareStrings),
        resolved: mask.resolved
      })
    )
    .sort((left, right) => left.maskRelationId.localeCompare(right.maskRelationId));

const createOpacityRefs = (snapshot: RuntimeSnapshotDto): readonly TutorialOpacityEvidenceRefDto[] =>
  snapshot.drawables
    .map((drawable) =>
      TutorialOpacityEvidenceRefSchema.parse({
        drawableId: drawable.drawableId,
        opacity: drawable.opacity,
        visible: drawable.visible
      })
    )
    .sort((left, right) => left.drawableId.localeCompare(right.drawableId));

const createRigControlRefs = (snapshot: RuntimeSnapshotDto): readonly TutorialRigControlEvidenceRefDto[] =>
  snapshot.rigControls
    .map((rigControl) =>
      TutorialRigControlEvidenceRefSchema.parse({
        rigControlId: rigControl.rigControlId,
        kind: rigControl.kind,
        enabled: rigControl.enabled,
        evaluationStatus: rigControl.evaluationStatus,
        childDrawableIds: [...rigControl.childDrawableIds].sort(compareStrings),
        affectedDrawableIds: [...rigControl.affectedDrawableIds].sort(compareStrings)
      })
    )
    .sort((left, right) => left.rigControlId.localeCompare(right.rigControlId));

const createRigControlKeyformRefs = (snapshot: RuntimeSnapshotDto): readonly TutorialRigControlKeyformEvidenceRefDto[] =>
  snapshot.keyformSamples
    .filter((sample) => sample.target.startsWith("rigControl:"))
    .map((sample) =>
      TutorialRigControlKeyformEvidenceRefSchema.parse({
        keyformSetId: sample.keyformSetId,
        evaluator: sample.evaluator,
        target: sample.target,
        sampledCoordinates: sample.sampledCoordinates
      })
    )
    .sort((left, right) => left.keyformSetId.localeCompare(right.keyformSetId) || left.target.localeCompare(right.target));

const createDynamicsRefs = (snapshot: RuntimeSnapshotDto): readonly TutorialDynamicsEvidenceRefDto[] =>
  snapshot.dynamics
    .map((dynamics) =>
      TutorialDynamicsEvidenceRefSchema.parse({
        dynamicsGroupId: dynamics.dynamicsGroupId,
        enabled: dynamics.enabled,
        solverKind: dynamics.solverKind,
        inputParameterIds: Object.keys(dynamics.inputValues).sort(compareStrings),
        outputParameterId: dynamics.outputParameterId,
        outputOffset: dynamics.outputOffset,
        effectiveOutputValue: dynamics.effectiveOutputValue,
        tick: dynamics.tick,
        resetCounter: dynamics.resetCounter
      })
    )
    .sort((left, right) => left.dynamicsGroupId.localeCompare(right.dynamicsGroupId));

const createSliceStatus = (input: {
  readonly parts: readonly TutorialPartEvidenceRefDto[];
  readonly layers: readonly TutorialDrawableLayerEvidenceRefDto[];
  readonly drawables: readonly string[];
  readonly meshes: readonly TutorialMeshEvidenceRefDto[];
  readonly meshEdits: readonly TutorialMeshEditEvidenceRefDto[];
  readonly maskRelations: readonly TutorialMaskRelationEvidenceRefDto[];
  readonly nonDefaultOpacityDrawableIds: readonly string[];
  readonly rigControls: readonly TutorialRigControlEvidenceRefDto[];
  readonly rigControlKeyforms: readonly TutorialRigControlKeyformEvidenceRefDto[];
  readonly dynamics: readonly TutorialDynamicsEvidenceRefDto[];
}): readonly TutorialSliceStatusDto[] =>
  [
    createSliceStatusEntry("parts", input.parts.map((part) => `part:${part.partId}`)),
    createSliceStatusEntry("layers", input.layers.map((layer) => `layer:${layer.drawableId}`)),
    createSliceStatusEntry("drawables", input.drawables.map((drawableId) => `drawable:${drawableId}`)),
    createSliceStatusEntry("meshes", input.meshes.map((mesh) => `mesh:${mesh.meshId}`)),
    createSliceStatusEntry("meshEdits", input.meshEdits.flatMap(createMeshEditSliceEvidenceRefs)),
    createSliceStatusEntry("maskOpacity", [
      ...input.maskRelations.map((mask) => `maskRelation:${mask.maskRelationId}`),
      ...input.nonDefaultOpacityDrawableIds.map((drawableId) => `opacity:${drawableId}`)
    ]),
    createSliceStatusEntry("rigControls", input.rigControls.map((rigControl) => `rigControl:${rigControl.rigControlId}`)),
    createSliceStatusEntry("rigControlKeyforms", input.rigControlKeyforms.map((keyform) => `keyformSet:${keyform.keyformSetId}`)),
    createSliceStatusEntry("dynamics", input.dynamics.map((dynamics) => `dynamicsGroup:${dynamics.dynamicsGroupId}`))
  ];

const createMeshEditSliceEvidenceRefs = (
  meshEdit: TutorialMeshEditEvidenceRefDto
): readonly string[] =>
  meshEdit.movedVertexRefs.length > 0
    ? meshEdit.movedVertexRefs.map((vertexRef) => `meshEdit:${vertexRef}`)
    : [`meshEdit:${meshEdit.meshId}`];

const createSliceStatusEntry = (
  sliceId: TutorialEvidenceSliceId,
  evidenceRefs: readonly string[]
): TutorialSliceStatusDto =>
  TutorialSliceStatusSchema.parse({
    sliceId,
    present: evidenceRefs.length > 0,
    evidenceRefs: [...evidenceRefs].sort(compareStrings)
  });

const createSemanticReadiness = (
  sliceStatus: readonly TutorialSliceStatusDto[]
): TutorialSemanticReadinessSummaryDto => {
  const bySlice = new Map(sliceStatus.map((slice) => [slice.sliceId, slice]));
  const normalizedSliceStatus = TUTORIAL_REQUIRED_SLICE_IDS.map((sliceId) => bySlice.get(sliceId) ?? createSliceStatusEntry(sliceId, []));
  const presentSlices = normalizedSliceStatus
    .filter((slice) => slice.present)
    .map((slice) => slice.sliceId);
  const missingSlices = normalizedSliceStatus
    .filter((slice) => !slice.present)
    .map((slice) => slice.sliceId);

  return TutorialSemanticReadinessSummarySchema.parse({
    status: missingSlices.length === 0 ? "ready" : "incomplete",
    ready: missingSlices.length === 0,
    presentSlices,
    missingSlices,
    sliceStatus: normalizedSliceStatus
  });
};

const combineSemanticReadiness = (
  summaries: readonly TutorialSemanticReadinessSummaryDto[]
): TutorialSemanticReadinessSummaryDto => {
  const combined = TUTORIAL_REQUIRED_SLICE_IDS.map((sliceId) => {
    const evidenceRefs = summaries.flatMap((summary) =>
      summary.sliceStatus.find((slice) => slice.sliceId === sliceId)?.evidenceRefs ?? []
    );
    return createSliceStatusEntry(sliceId, evidenceRefs);
  });
  return createSemanticReadiness(combined);
};

const createRenderedCorrectnessBoundary = (): TutorialRenderedCorrectnessBoundaryDto => ({
  status: "not_evaluated",
  fullRenderer: false,
  pixelOracle: false,
  textureSamplingCorrectness: false,
  basis: "semanticRuntimeEvidenceOnly"
});

const summarizeRuntimeDiff = (runtimeDiff: RuntimeDiffDto): TutorialSnapshotEvidenceRefsDto["runtimeDiff"] => ({
  beforeSnapshotId: runtimeDiff.beforeSnapshotId,
  afterSnapshotId: runtimeDiff.afterSnapshotId,
  parameterChangeCount: runtimeDiff.parameterChanges.length,
  dynamicsChangeCount: runtimeDiff.dynamicsChanges.length,
  drawableGeometryChangeCount: runtimeDiff.drawableChanges.length,
  drawableRuntimeStateChangeCount: runtimeDiff.drawableRuntimeStateChanges.length,
  drawListChangeCount: runtimeDiff.drawListChanges.length,
  diagnosticDeltaCount: runtimeDiff.diagnosticDelta.length
});

const compareStrings = (left: string, right: string): number => left.localeCompare(right);
