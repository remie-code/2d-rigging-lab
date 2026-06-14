import {
  createDryRunAuthoringSession,
  createGeneratedMeshForDrawable,
  getDrawableById,
  getMeshById,
  isGeneratedMeshPreviewCommitMethod,
  replaceDrawableMesh
} from "@private-2d-rigging-lab/authoring-core";
import type {
  AuthoringSession,
  MeshGenerationFallbackStep,
  MeshGenerationQualityMetrics
} from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  ModelDiffDto,
  OperationId,
  ProvenanceId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import { createProvenanceId } from "../operation-ids.js";
import type { OperationRequestDto } from "../operation-request.js";
import type { OperationResultDto } from "../operation-result.js";
import { OperationResultSchema } from "../operation-result.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";
import { toModelDiffJsonValue } from "./model-diff-json-value.js";

export const generateMeshOperationHandler: OperationHandler = {
  operationType: "generateMesh",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyGenerateMesh(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyGenerateMesh(session, request, operationId, "committed");
  }
};

const applyGenerateMesh = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "generateMesh") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.generateMesh.unsupportedPayload",
            message: `generateMesh handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const drawable = getDrawableById(session.graph, request.payload.drawableId);
  const existingMesh = drawable === undefined ? undefined : getMeshById(session.graph, drawable.meshId);
  const targetIds = [request.payload.drawableId, drawable?.meshId ?? request.payload.drawableId];
  const preconditionDiagnostics = evaluateGenerateMeshPreconditions({
    request,
    drawableMissing: drawable === undefined,
    meshMissing: drawable !== undefined && existingMesh === undefined
  });
  if (drawable !== undefined && existingMesh !== undefined) {
    preconditionDiagnostics.push(
      ...evaluatePreviewMeshPreconditions({
        previewMesh: request.payload.previewMesh,
        drawableId: drawable.drawableId,
        meshId: existingMesh.meshId,
        method: request.payload.method
      })
    );
  }

  if (preconditionDiagnostics.length > 0 || drawable === undefined || existingMesh === undefined) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics: preconditionDiagnostics }),
      targetIds,
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;
  const provenanceId = createProvenanceId(operationId);
  let mesh: Parameters<typeof replaceDrawableMesh>[1];
  let generatedSource: string | undefined;
  let previewSource: string | undefined;
  let fallbackReason: string | undefined;
  let fallbackSteps: readonly MeshGenerationFallbackStep[] | undefined;
  let qualityMetrics: MeshGenerationQualityMetrics | undefined;
  if (request.payload.previewMesh !== undefined) {
    mesh = {
      ...structuredClone(request.payload.previewMesh),
      generationProvenanceId: provenanceId
    };
    generatedSource = "previewMesh";
    previewSource = request.payload.previewProvenance?.source;
    fallbackReason = request.payload.previewProvenance?.fallbackReason;
    fallbackSteps = request.payload.previewProvenance?.fallbackSteps;
    qualityMetrics = request.payload.previewProvenance?.qualityMetrics;
  } else {
    const generated = createGeneratedMeshForDrawable({
      session,
      drawableId: drawable.drawableId,
      provenanceId,
      method: request.payload.method,
      ...(request.payload.densityHint === undefined ? {} : { densityHint: request.payload.densityHint })
    });
    if (generated === undefined) {
      return {
        result: createRejectedOperationResult({
          operationId,
          diagnostics: [
            createOperationDiagnostic({
              checkId: "operation.generateMesh.missingMesh",
              message: `Drawable ${request.payload.drawableId} references a missing mesh.`,
              target: { kind: "drawable", id: request.payload.drawableId, path: "/meshId" }
            })
          ]
        }),
        targetIds,
        candidateSession: session
      };
    }

    mesh = generated.mesh;
    generatedSource = generated.source;
    fallbackReason = generated.fallbackReason;
    fallbackSteps = generated.fallbackSteps;
    qualityMetrics = generated.qualityMetrics;
  }

  const provenanceRecord = createMeshProvenanceRecord({
    operationId,
    provenanceId,
    meshId: mesh.meshId,
    actor: request.actor,
    method: request.payload.method,
    ...(generatedSource === undefined ? {} : { generatedSource }),
    ...(previewSource === undefined ? {} : { previewSource }),
    ...(fallbackReason === undefined ? {} : { fallbackReason }),
    ...(fallbackSteps === undefined ? {} : { fallbackSteps }),
    ...(qualityMetrics === undefined ? {} : { qualityMetrics })
  });
  const mutation = replaceDrawableMesh(session, mesh, provenanceRecord);

  return {
    result: createGenerateMeshResult({
      operationId,
      status,
      baseRevision,
      candidateRevision: mutation.authoringRevision,
      meshBefore: existingMesh,
      meshAfter: mutation.mesh
    }),
    targetIds,
    candidateSession: session
  };
};

const evaluateGenerateMeshPreconditions = (input: {
  readonly request: Extract<OperationRequestDto, { operationType: "generateMesh" }>;
  readonly drawableMissing: boolean;
  readonly meshMissing: boolean;
}): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [];

  if (input.drawableMissing) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.generateMesh.missingDrawable",
        message: `Drawable does not exist: ${input.request.payload.drawableId}.`,
        target: { kind: "drawable", id: input.request.payload.drawableId }
      })
    );
  }

  if (input.meshMissing) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.generateMesh.missingMesh",
        message: `Drawable ${input.request.payload.drawableId} references a missing mesh.`,
        target: { kind: "drawable", id: input.request.payload.drawableId, path: "/meshId" }
      })
    );
  }

  return diagnostics;
};

const evaluatePreviewMeshPreconditions = (input: {
  readonly previewMesh: Extract<OperationRequestDto, { operationType: "generateMesh" }>["payload"]["previewMesh"];
  readonly drawableId: string;
  readonly meshId: string;
  readonly method: Extract<OperationRequestDto, { operationType: "generateMesh" }>["payload"]["method"];
}): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [];

  if (input.previewMesh === undefined) {
    return diagnostics;
  }
  const previewMesh = input.previewMesh;

  if (!isGeneratedMeshPreviewCommitMethod(input.method)) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.generateMesh.previewMeshUnsupportedMethod",
        message: "previewMesh commits are only supported for generated mesh drafts.",
        target: { kind: "drawable", id: input.drawableId, path: "/payload/method" }
      })
    );
  }

  if (previewMesh.drawableId !== input.drawableId) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.generateMesh.previewMeshDrawableMismatch",
        message: `Preview mesh drawable ${previewMesh.drawableId} does not match target drawable ${input.drawableId}.`,
        target: { kind: "drawable", id: previewMesh.drawableId, path: "/payload/previewMesh/drawableId" }
      })
    );
  }

  if (previewMesh.meshId !== input.meshId) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.generateMesh.previewMeshIdMismatch",
        message: `Preview mesh ${previewMesh.meshId} does not match target mesh ${input.meshId}.`,
        target: { kind: "mesh", id: previewMesh.meshId, path: "/payload/previewMesh/meshId" }
      })
    );
  }

  if (
    previewMesh.vertices.length !== previewMesh.uvs.length ||
    previewMesh.vertices.length !== previewMesh.vertexStableIds.length
  ) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.generateMesh.previewMeshVertexCardinalityMismatch",
        message: "Preview mesh vertices, uvs, and vertexStableIds must have matching lengths.",
        target: { kind: "mesh", id: previewMesh.meshId, path: "/payload/previewMesh" }
      })
    );
  }

  if (
    previewMesh.triangleStableIds !== undefined &&
    previewMesh.triangleStableIds.length !== previewMesh.triangles.length
  ) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.generateMesh.previewMeshTriangleCardinalityMismatch",
        message: "Preview mesh triangles and triangleStableIds must have matching lengths.",
        target: { kind: "mesh", id: previewMesh.meshId, path: "/payload/previewMesh" }
      })
    );
  }

  previewMesh.triangles.forEach((triangle, triangleIndex) => {
    const [a, b, c] = triangle;
    const path = `/payload/previewMesh/triangles/${triangleIndex}`;

    if (
      a >= previewMesh.vertices.length ||
      b >= previewMesh.vertices.length ||
      c >= previewMesh.vertices.length
    ) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.generateMesh.previewMeshTriangleIndexOutOfRange",
          message: `Preview mesh triangle ${triangleIndex} references a vertex outside the vertex array.`,
          target: { kind: "mesh", id: previewMesh.meshId, path }
        })
      );
    }

    if (a === b || a === c || b === c) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.generateMesh.previewMeshDegenerateTriangle",
          message: `Preview mesh triangle ${triangleIndex} repeats a vertex index.`,
          target: { kind: "mesh", id: previewMesh.meshId, path }
        })
      );
    }
  });

  return diagnostics;
};

const createMeshProvenanceRecord = (input: {
  readonly operationId: OperationId;
  readonly provenanceId: ProvenanceId;
  readonly meshId: string;
  readonly actor: string;
  readonly method: string;
  readonly generatedSource?: string;
  readonly previewSource?: string;
  readonly fallbackReason?: string;
  readonly fallbackSteps?: readonly MeshGenerationFallbackStep[];
  readonly qualityMetrics?: MeshGenerationQualityMetrics;
}): ProvenanceRecord => ({
  provenanceId: input.provenanceId,
  assetId: input.meshId,
  assetKind: "generatedFixture",
  filePath: `model/meshes/${input.meshId}.generated.json`,
  creator: input.actor,
  license: "internal-authoring-generated",
  redistributionAllowed: false,
  aiUsed: input.actor === "ai",
  transformHistory: [
    `generateMesh:${input.method}`,
    ...(input.generatedSource === undefined ? [] : [`meshSource:${input.generatedSource}`]),
    ...(input.previewSource === undefined ? [] : [`previewMeshSource:${input.previewSource}`]),
    ...(input.fallbackSteps === undefined
      ? input.fallbackReason === undefined
        ? []
        : [`fallback:${input.fallbackReason}`]
      : input.fallbackSteps.map((step) => `fallback:${step.method}:${step.reason}`)),
    ...formatQualityMetricsForTransformHistory(input.qualityMetrics)
  ],
  relatedOperationIds: [input.operationId]
});

type ProvenanceRecord = AuthoringSession["graph"]["provenanceRecords"][number];

const formatQualityMetricsForTransformHistory = (
  metrics: MeshGenerationQualityMetrics | undefined
): readonly string[] => {
  if (metrics === undefined) {
    return [];
  }

  return [
    `meshQuality:maxEdgeLength=${formatMetric(metrics.maxEdgeLength)}`,
    `meshQuality:maxTriangleArea=${formatMetric(metrics.maxTriangleArea)}`,
    `meshQuality:minAngleDegrees=${formatMetric(metrics.minAngleDegrees)}`,
    `meshQuality:maxVertexValence=${metrics.maxVertexValence}`,
    `meshQuality:refinementIterations=${metrics.refinementIterationCount}`,
    ...(metrics.triangulationMode === undefined
      ? []
      : [`meshQuality:triangulationMode=${metrics.triangulationMode}`]),
    ...formatEnvelopeMetricsForTransformHistory(metrics),
    ...formatSoftBoundaryMetricsForTransformHistory(metrics),
    ...formatSoftApronMetricsForTransformHistory(metrics),
    ...formatContourBandMetricsForTransformHistory(metrics),
    ...formatV6MetricsForTransformHistory(metrics)
  ];
};

const formatEnvelopeMetricsForTransformHistory = (
  metrics: MeshGenerationQualityMetrics
): readonly string[] => {
  const envelope = metrics.envelopeMetrics;
  if (envelope === undefined) {
    return [];
  }

  return [
    `meshQuality:envelopeAlgorithm=${envelope.algorithmId}`,
    `meshQuality:envelopePreset=${envelope.preset}`,
    `meshQuality:envelopePadding=${formatMetric(envelope.padding)}`,
    `meshQuality:envelopeAreaRatio=${formatMetric(envelope.envelopeAreaRatio)}`,
    `meshQuality:envelopeBoundaryVertices=${envelope.envelopeBoundaryVertexCount}`,
    `meshQuality:envelopeSupportRings=${envelope.supportRingCount}`,
    `meshQuality:envelopeInteriorPoints=${envelope.interiorPointCount}`,
    `meshQuality:envelopeTransparentSamples=${envelope.transparentSampleCount}`,
    `meshQuality:envelopeOutsideSamples=${envelope.outsideTriangleSampleCount}`,
    `meshQuality:envelopeCleanup=${envelope.cleanupMode}`,
    `meshQuality:envelopeProvenance=${envelope.provenance.join(">")}`,
    ...(envelope.fallbackReason === undefined
      ? []
      : [`meshQuality:envelopeFallback=${envelope.fallbackReason}`])
  ];
};

const formatSoftBoundaryMetricsForTransformHistory = (
  metrics: MeshGenerationQualityMetrics
): readonly string[] => {
  const softBoundary = metrics.softBoundaryMetrics;
  if (softBoundary === undefined) {
    return [];
  }

  return [
    `meshQuality:softBoundaryAlgorithm=${softBoundary.algorithmId}`,
    `meshQuality:softBoundaryPreset=${softBoundary.preset}`,
    `meshQuality:softBoundaryPadding=${formatMetric(softBoundary.padding)}`,
    `meshQuality:softBoundaryTransparentAllowance=${formatMetric(softBoundary.transparentAllowance)}`,
    `meshQuality:softBoundaryAreaRatio=${formatMetric(softBoundary.softBoundaryAreaRatio)}`,
    `meshQuality:softBoundaryVertices=${softBoundary.softBoundaryVertexCount}`,
    `meshQuality:softBoundaryInteriorPoints=${softBoundary.interiorPointCount}`,
    `meshQuality:softBoundaryTransparentSamples=${softBoundary.transparentSampleCount}`,
    `meshQuality:softBoundaryOutsideSamples=${softBoundary.outsideTriangleSampleCount}`,
    `meshQuality:softBoundaryFarTransparentSamples=${softBoundary.farTransparentSampleCount}`,
    `meshQuality:softBoundaryRejectedOutsideTriangles=${softBoundary.rejectedOutsideSoftBoundaryTriangleCount}`,
    `meshQuality:softBoundaryRejectedFarTransparentTriangles=${softBoundary.rejectedFarTransparentTriangleCount}`,
    `meshQuality:softBoundaryProvenance=${softBoundary.provenance.join(">")}`,
    ...(softBoundary.fallbackReason === undefined
      ? []
      : [`meshQuality:softBoundaryFallback=${softBoundary.fallbackReason}`])
  ];
};

const formatSoftApronMetricsForTransformHistory = (
  metrics: MeshGenerationQualityMetrics
): readonly string[] => {
  const softApron = metrics.softApronMetrics;
  if (softApron === undefined) {
    return [];
  }

  return [
    `meshQuality:softApronAlgorithm=${softApron.algorithmId}`,
    `meshQuality:softApronBaseAlgorithm=${softApron.baseAlgorithmId}`,
    `meshQuality:softApronPreset=${softApron.preset}`,
    `meshQuality:softApronPadding=${formatMetric(softApron.apronPadding)}`,
    `meshQuality:softApronPaddingRatio=${formatMetric(softApron.apronPaddingRatio)}`,
    `meshQuality:softApronBoundaryAreaRatio=${formatMetric(softApron.apronBoundaryAreaRatio)}`,
    `meshQuality:softApronRings=${softApron.apronRingCount}`,
    `meshQuality:softApronVertices=${softApron.apronVertexCount}`,
    `meshQuality:softApronTriangles=${softApron.apronTriangleCount}`,
    `meshQuality:softApronTriangleIncreaseRatio=${formatMetric(softApron.triangleCountIncreaseRatio)}`,
    `meshQuality:softApronBoundaryToApronEdge=${formatMetric(softApron.maxBoundaryToApronEdgeLength)}`,
    `meshQuality:softApronMaxEdge=${formatMetric(softApron.maxApronEdgeLength)}`,
    `meshQuality:softApronFanTriangles=${softApron.maxApronFanTriangleCount}`,
    `meshQuality:softApronLongEdges=${softApron.longApronEdgeCount}`,
    `meshQuality:softApronSkinnyTriangles=${softApron.skinnyApronTriangleCount}`,
    `meshQuality:softApronRejectedLongTriangles=${softApron.rejectedLongApronTriangleCount}`,
    `meshQuality:softApronRejectedSkinnyTriangles=${softApron.rejectedSkinnyApronTriangleCount}`,
    `meshQuality:softApronProvenance=${softApron.provenance.join(">")}`,
    ...(softApron.fallbackReason === undefined
      ? []
      : [`meshQuality:softApronFallback=${softApron.fallbackReason}`])
  ];
};

const formatContourBandMetricsForTransformHistory = (
  metrics: MeshGenerationQualityMetrics
): readonly string[] => {
  const contourBand = metrics.contourBandMetrics;
  if (contourBand === undefined) {
    return [];
  }

  return [
    `meshQuality:contourBandAlgorithm=${contourBand.algorithmId}`,
    `meshQuality:contourBandPreset=${contourBand.preset}`,
    `meshQuality:contourBandTargetEdge=${formatMetric(contourBand.targetEdgeLength)}`,
    `meshQuality:contourBandOuterOffset=${formatMetric(contourBand.outerOffset)}`,
    `meshQuality:contourBandInnerOffset=${formatMetric(contourBand.innerOffset)}`,
    `meshQuality:contourBandOuterAreaRatio=${formatMetric(contourBand.outerContourAreaRatio)}`,
    `meshQuality:contourBandContourPoints=${contourBand.contourPointCount}`,
    `meshQuality:contourBandOuterPoints=${contourBand.outerContourPointCount}`,
    `meshQuality:contourBandTriangles=${contourBand.contourBandTriangleCount}`,
    `meshQuality:contourBandInteriorPoints=${contourBand.interiorPointCount}`,
    `meshQuality:contourBandInteriorTriangles=${contourBand.interiorTriangleCount}`,
    `meshQuality:contourBandBoundaryToInteriorEdge=${formatMetric(contourBand.maxBoundaryToInteriorEdgeLength)}`,
    `meshQuality:contourBandMaxVertexValence=${contourBand.maxVertexValence}`,
    `meshQuality:contourBandTransparentOnlyTriangleRatio=${formatMetric(contourBand.transparentOnlyTriangleRatio)}`,
    `meshQuality:contourBandVertexCount=${contourBand.vertexCount}`,
    `meshQuality:contourBandVertexCap=${contourBand.maxVertexCountCap}`,
    `meshQuality:contourBandRejectedBoundaryToInteriorTriangles=${contourBand.rejectedLongBoundaryToInteriorTriangleCount}`,
    `meshQuality:contourBandRejectedOutsideTriangles=${contourBand.rejectedOutsideInteriorTriangleCount}`,
    `meshQuality:contourBandProvenance=${contourBand.provenance.join(">")}`,
    ...(contourBand.fallbackReason === undefined
      ? []
      : [`meshQuality:contourBandFallback=${contourBand.fallbackReason}`])
  ];
};

const formatV6MetricsForTransformHistory = (
  metrics: MeshGenerationQualityMetrics
): readonly string[] => {
  const v6 = metrics.v6Metrics;
  if (v6 === undefined) {
    return [];
  }

  return [
    `meshQuality:v6Algorithm=${v6.algorithmId}`,
    `meshQuality:v6Method=${v6.methodId}`,
    `meshQuality:v6Backend=${v6.backendId}`,
    `meshQuality:v6BackendImplementation=${v6.backendImplementationStatus}`,
    `meshQuality:v6RequestedSource=${v6.requestedSourceId}`,
    `meshQuality:v6ActualSource=${v6.actualSourceId}`,
    `meshQuality:v6Output=${v6.outputKind}`,
    `meshQuality:v6Preset=${v6.preset}`,
    ...(v6.fallbackReason === undefined ? [] : [`meshQuality:v6Fallback=${v6.fallbackReason}`]),
    `meshQuality:v6FallbackSteps=${v6.fallbackSteps.length}`,
    `meshQuality:v6BoundaryVertices=${v6.boundaryVertexCount}`,
    `meshQuality:v6InteriorVertices=${v6.interiorVertexCount}`,
    `meshQuality:v6VertexCount=${v6.vertexCount}`,
    `meshQuality:v6TriangleCount=${v6.triangleCount}`,
    `meshQuality:v6AlphaBounds=${v6.alphaBoundsAvailable ? "available" : "unavailable"}`,
    ...(v6.opaquePixelCount === undefined ? [] : [`meshQuality:v6OpaquePixels=${v6.opaquePixelCount}`]),
    `meshQuality:v6ContourLoops=${v6.contourLoopCount}`,
    `meshQuality:v6HoleLikeRegions=${v6.holeLikeRegionCount}`,
    `meshQuality:v6RemovedTriangles=${v6.removedTriangleCount}`,
    `meshQuality:v6OutsideOrCrossingTriangles=${v6.outsideOrCrossingTriangleCount}`,
    `meshQuality:v6MultiIslandHandling=${v6.multiIslandHandling}`,
    `meshQuality:v6HoleHandling=${v6.holeHandling}`,
    `meshQuality:v6Provenance=${v6.provenance.join(">")}`,
    ...formatV6ContourPipelineDiagnosticsForTransformHistory(metrics),
    ...formatV6ConstrainautorDiagnosticsForTransformHistory(metrics),
    ...formatV6SupportRingDiagnosticsForTransformHistory(metrics),
    ...formatV6Poly2TriDiagnosticsForTransformHistory(metrics),
    ...formatV6CustomCdtDiagnosticsForTransformHistory(metrics)
  ];
};

const formatV6ContourPipelineDiagnosticsForTransformHistory = (
  metrics: MeshGenerationQualityMetrics
): readonly string[] => {
  const diagnostics = metrics.v6Metrics?.contourPipelineDiagnostics;
  if (diagnostics === undefined) {
    return [];
  }

  return [
    `meshQuality:v6ContourPipelineStatus=${diagnostics.status}`,
    `meshQuality:v6ContourInputOpaquePixels=${diagnostics.inputOpaquePixelCount}`,
    `meshQuality:v6ContourSoftMaskOpaquePixels=${diagnostics.softMaskOpaquePixelCount}`,
    `meshQuality:v6ContourSelectedComponentPixels=${diagnostics.selectedComponentPixelCount}`,
    `meshQuality:v6ContourBoundaryPoints=${diagnostics.boundaryPointCount}`,
    `meshQuality:v6ContourConstraintEdges=${diagnostics.constraintEdgeCount}`,
    `meshQuality:v6ContourSteinerPoints=${diagnostics.steinerPointCount}`,
    `meshQuality:v6ContourAlphaBounds=${diagnostics.alphaBoundsAvailable ? "available" : "unavailable"}`,
    ...(diagnostics.blockedReason === undefined
      ? []
      : [`meshQuality:v6ContourBlockedReason=${diagnostics.blockedReason}`])
  ];
};

const formatV6ConstrainautorDiagnosticsForTransformHistory = (
  metrics: MeshGenerationQualityMetrics
): readonly string[] => {
  const diagnostics = metrics.v6Metrics?.constrainautorDiagnostics;
  if (diagnostics === undefined) {
    return [];
  }

  return [
    `meshQuality:v6ConstrainautorDependencyGate=${diagnostics.dependencyGateStatus}`,
    `meshQuality:v6ConstrainautorConstraintEdges=${diagnostics.constraintEdgeCount}`,
    `meshQuality:v6ConstrainautorPreservedConstraints=${diagnostics.preservedConstraintEdgeCount}`,
    `meshQuality:v6ConstrainautorMissingConstraints=${diagnostics.missingConstraintEdgeCount}`,
    `meshQuality:v6ConstrainautorRecoveryFailed=${diagnostics.constraintRecoveryFailed ? "true" : "false"}`,
    `meshQuality:v6ConstrainautorOutsideTriangles=${diagnostics.outsideTriangleCount}`,
    ...(diagnostics.thrownErrorKind === undefined
      ? []
      : [`meshQuality:v6ConstrainautorThrown=${diagnostics.thrownErrorKind}`])
  ];
};

const formatV6SupportRingDiagnosticsForTransformHistory = (
  metrics: MeshGenerationQualityMetrics
): readonly string[] => {
  const diagnostics = metrics.v6Metrics?.supportRingDiagnostics;
  if (diagnostics === undefined) {
    return [];
  }

  return [
    `meshQuality:v6SupportRingBoundaryPoints=${diagnostics.boundaryRingPointCount}`,
    `meshQuality:v6SupportRingAlphaBoundaryPoints=${diagnostics.alphaBoundaryRingPointCount}`,
    `meshQuality:v6SupportRingOuterPoints=${diagnostics.outerRingPointCount}`,
    `meshQuality:v6SupportRingInnerPoints=${diagnostics.innerRingPointCount}`,
    `meshQuality:v6SupportRingSkippedPoints=${diagnostics.skippedRingPointCount}`,
    `meshQuality:v6SupportRingMergedPoints=${diagnostics.mergedRingPointCount}`,
    `meshQuality:v6SupportRingSelfIntersections=${diagnostics.ringSelfIntersectionCount}`,
    `meshQuality:v6SupportRingBridgeConstraints=${diagnostics.bridgeConstraintCount}`,
    `meshQuality:v6SupportRingSupportBandTriangles=${diagnostics.supportBandTriangleCount}`,
    `meshQuality:v6SupportRingAlphaBoundaryBandTriangles=${diagnostics.alphaBoundaryBandTriangleCount}`,
    `meshQuality:v6SupportRingInteriorTriangles=${diagnostics.interiorTriangleCount}`,
    `meshQuality:v6SupportRingOutsideLayer=${diagnostics.verticesExtendOutsideLayerBounds ? "true" : "false"}`,
    `meshQuality:v6SupportRingMaxOutsideLayerDistance=${formatMetric(diagnostics.maxOutsideLayerDistance)}`,
    `meshQuality:v6SupportRingOuterOffset=${formatMetric(diagnostics.outerRingOffset)}`,
    `meshQuality:v6SupportRingInnerOffset=${formatMetric(diagnostics.innerRingOffset)}`,
    `meshQuality:v6SupportRingOuterUvPolicy=${diagnostics.outerRingUvPolicy}`
  ];
};

const formatV6Poly2TriDiagnosticsForTransformHistory = (
  metrics: MeshGenerationQualityMetrics
): readonly string[] => {
  const diagnostics = metrics.v6Metrics?.poly2triDiagnostics;
  if (diagnostics === undefined) {
    return [];
  }

  return [
    `meshQuality:v6Poly2TriDependencyGate=${diagnostics.dependencyGateStatus}`,
    `meshQuality:v6Poly2TriOuterPoints=${diagnostics.outerPointCount}`,
    `meshQuality:v6Poly2TriHoles=${diagnostics.holeCount}`,
    `meshQuality:v6Poly2TriSteinerPoints=${diagnostics.steinerPointCount}`,
    `meshQuality:v6Poly2TriPolygonValidationFailed=${diagnostics.polygonValidationFailed ? "true" : "false"}`,
    `meshQuality:v6Poly2TriHoleValidationFailed=${diagnostics.holeValidationFailed ? "true" : "false"}`,
    `meshQuality:v6Poly2TriTriangulationThrown=${diagnostics.triangulationThrown ? "true" : "false"}`,
    `meshQuality:v6Poly2TriBoundaryPreserved=${diagnostics.boundaryEdgePreservedCount}`,
    `meshQuality:v6Poly2TriBoundaryMissing=${diagnostics.boundaryEdgeMissingCount}`,
    `meshQuality:v6Poly2TriMainIslandOnlyFallback=${diagnostics.mainIslandOnlyFallback ? "true" : "false"}`
  ];
};

const formatV6CustomCdtDiagnosticsForTransformHistory = (
  metrics: MeshGenerationQualityMetrics
): readonly string[] => {
  const diagnostics = metrics.v6Metrics?.customCdtDiagnostics;
  if (diagnostics === undefined) {
    return [];
  }

  return [
    `meshQuality:v6CustomCdtDependencyGate=${diagnostics.dependencyGateStatus}`,
    `meshQuality:v6CustomCdtConstraintEdges=${diagnostics.constraintEdgeCount}`,
    `meshQuality:v6CustomCdtPreservedConstraints=${diagnostics.preservedConstraintEdgeCount}`,
    `meshQuality:v6CustomCdtMissingConstraints=${diagnostics.missingConstraintEdgeCount}`,
    `meshQuality:v6CustomCdtEdgeFlips=${diagnostics.edgeFlipCount}`,
    `meshQuality:v6CustomCdtConstraintRecoveryOperations=${diagnostics.constraintRecoveryOperationCount}`,
    `meshQuality:v6CustomCdtLongSpokeCandidates=${diagnostics.longSpokeCandidateCount}`,
    `meshQuality:v6CustomCdtRejectedLocalImprovements=${diagnostics.rejectedLocalImprovementCount}`,
    ...(diagnostics.customTriangulationFallbackReason === undefined
      ? []
      : [`meshQuality:v6CustomCdtFallback=${diagnostics.customTriangulationFallbackReason}`]),
    ...(diagnostics.thrownErrorKind === undefined
      ? []
      : [`meshQuality:v6CustomCdtThrown=${diagnostics.thrownErrorKind}`])
  ];
};

const formatMetric = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");

const createGenerateMeshResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly meshBefore: Parameters<typeof replaceDrawableMesh>[1];
  readonly meshAfter: Parameters<typeof replaceDrawableMesh>[1];
}): OperationResultDto => {
  const drawableTarget: TargetRefDto = { kind: "drawable", id: input.meshAfter.drawableId };
  const meshTarget: TargetRefDto = { kind: "mesh", id: input.meshAfter.meshId };
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [],
    removed: [],
    changed: [
      {
        target: meshTarget,
        fields: [
          {
            path: `/model/meshes/${input.meshAfter.meshId}`,
            before: toModelDiffJsonValue(input.meshBefore),
            after: toModelDiffJsonValue(input.meshAfter)
          },
          {
            path: `/model/meshes/${input.meshAfter.meshId}/vertices`,
            before: input.meshBefore.vertices,
            after: input.meshAfter.vertices
          },
          {
            path: `/model/meshes/${input.meshAfter.meshId}/triangles`,
            before: input.meshBefore.triangles,
            after: input.meshAfter.triangles
          }
        ]
      },
      {
        target: drawableTarget,
        fields: [
          {
            path: "/meshId",
            before: input.meshBefore.meshId,
            after: input.meshAfter.meshId
          }
        ]
      }
    ],
    operationIds: [input.operationId]
  };

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: input.status,
    precondition: createPreconditionResult([], [drawableTarget, meshTarget]),
    modelDiff,
    runtimeDiff: undefined,
    validationDiff: undefined,
    diagnostics: [],
    generatedRuntimeSnapshotIds: [],
    generatedRuntimeStateRefs: [],
    generatedRuntimeStateSequenceRefs: [],
    generatedValidationReportIds: [],
    reversible: true
  });
};
