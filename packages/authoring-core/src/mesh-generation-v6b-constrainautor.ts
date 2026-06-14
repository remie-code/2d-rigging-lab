import type { DrawableId, MeshId, ProvenanceId, RectDto, TriangleId } from "@private-2d-rigging-lab/contracts";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";
import Delaunator from "delaunator";

import {
  getV6MeshGenerationCandidate,
  type DrawableGeneratedMeshSource,
  type MeshDensityHint,
  type MeshGenerationFallbackReason,
  type MeshGenerationFallbackStep,
  type MeshGenerationV6FallbackReason
} from "./mesh-generation-contract.js";
import Constrainautor from "./mesh-generation-v6b-constrainautor-runtime.js";
import {
  computeMeshQualityMetrics,
  type MeshGenerationQualityMetrics,
  type MeshGenerationV6ConstrainautorDiagnostics
} from "./mesh-quality-metrics.js";

export interface AutoOutlineV6BConstrainautorMeshInput {
  readonly meshId: MeshId;
  readonly drawableId: DrawableId;
  readonly bounds: RectDto;
  readonly provenanceId: ProvenanceId;
  readonly textureSize: {
    readonly width: number;
    readonly height: number;
  };
  readonly rgbaBytes: Uint8Array;
  readonly densityHint?: MeshDensityHint;
  readonly alphaThreshold?: number;
}

export type AutoOutlineV6BConstrainautorMeshResult =
  | {
      readonly status: "generated";
      readonly mesh: MeshDto;
      readonly alphaBounds: RectDto;
      readonly qualityMetrics: MeshGenerationQualityMetrics;
    }
  | {
      readonly status: "fallback";
      readonly mesh: MeshDto;
      readonly source: DrawableGeneratedMeshSource;
      readonly reason: MeshGenerationFallbackReason;
      readonly fallbackSteps: readonly MeshGenerationFallbackStep[];
      readonly alphaBounds?: RectDto;
      readonly qualityMetrics: MeshGenerationQualityMetrics;
    }
  | {
      readonly status: "blocked";
      readonly reason: "alpha-empty" | "v6b-constrainautor-generation-failed";
      readonly opaquePixelCount?: number;
      readonly alphaBounds?: RectDto;
    };

export interface V6BConstrainautorPoint {
  readonly x: number;
  readonly y: number;
  readonly role: "boundary" | "interior";
  readonly stableOrder: number;
}

export interface V6BConstrainautorRecoveryInput {
  readonly points: readonly V6BConstrainautorPoint[];
  readonly constraintEdges: readonly (readonly [number, number])[];
}

export type V6BConstrainautorRecoveryResult =
  | {
      readonly status: "generated";
      readonly points: readonly V6BConstrainautorPoint[];
      readonly triangles: readonly (readonly [number, number, number])[];
      readonly diagnostics: MeshGenerationV6ConstrainautorDiagnostics;
    }
  | {
      readonly status: "failed";
      readonly reason: Exclude<MeshGenerationV6FallbackReason, "v6-backend-not-implemented" | "v6a-local-generation-failed" | "v6b-unsupported-hole-region">;
      readonly points: readonly V6BConstrainautorPoint[];
      readonly triangles: readonly (readonly [number, number, number])[];
      readonly diagnostics: MeshGenerationV6ConstrainautorDiagnostics;
    };

export type V6BConstrainautorRetryProvenance =
  | "v6b-retry-coarser-boundary"
  | "v6b-retry-fewer-interior-points";

export interface V6BConstrainautorRetryProbeAttempt {
  readonly recoveryInput: V6BConstrainautorRecoveryInput;
  readonly retryProvenance?: readonly V6BConstrainautorRetryProvenance[];
}

export interface V6BConstrainautorRetryProbeResult {
  readonly outputKind: "backend-output" | "fallback-output";
  readonly reason?: MeshGenerationFallbackReason;
  readonly attemptCount: number;
  readonly triangleCount: number;
  readonly provenance: readonly string[];
  readonly diagnostics: MeshGenerationV6ConstrainautorDiagnostics;
}

interface PixelPoint {
  readonly x: number;
  readonly y: number;
}

interface PixelBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

interface SoftAlphaMask {
  readonly width: number;
  readonly height: number;
  readonly mask: readonly boolean[];
  readonly opaquePixelCount: number;
}

interface OpaqueComponent {
  readonly pixelIndices: readonly number[];
  readonly bounds: PixelBounds;
}

interface BoundaryEdge {
  readonly start: PixelPoint;
  readonly end: PixelPoint;
}

interface DensityParameters {
  readonly boundarySpacing: number;
  readonly interiorSpacing: number;
  readonly maxBoundaryVertices: number;
  readonly maxInteriorVertices: number;
  readonly interiorBoundaryClearance: number;
}

interface FilteredTriangles {
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly removedTriangleCount: number;
  readonly outsideOrCrossingTriangleCount: number;
}

interface V6BPipelineContext {
  readonly width: number;
  readonly height: number;
  readonly mask: SoftAlphaMask;
  readonly components: readonly OpaqueComponent[];
  readonly mainComponent: OpaqueComponent;
  readonly mainMask: readonly boolean[];
  readonly boundaryLoops: readonly (readonly PixelPoint[])[];
  readonly outerLoop: readonly PixelPoint[];
  readonly boundaryPoints: readonly PixelPoint[];
  readonly interiorPoints: readonly PixelPoint[];
  readonly alphaBounds: RectDto;
  readonly holeLikeRegionCount: number;
  readonly density: MeshDensityHint;
}

type V6BRetryProvenance = V6BConstrainautorRetryProvenance;

interface V6BRecoveryAttempt {
  readonly boundaryPoints: readonly PixelPoint[];
  readonly interiorPoints: readonly PixelPoint[];
  readonly retryProvenance: readonly V6BRetryProvenance[];
}

type V6BConstrainautorAttemptOutcome =
  | {
      readonly status: "generated";
      readonly recovery: Extract<V6BConstrainautorRecoveryResult, { readonly status: "generated" }>;
      readonly filtered: FilteredTriangles;
      readonly diagnostics: MeshGenerationV6ConstrainautorDiagnostics;
    }
  | {
      readonly status: "failed";
      readonly reason: MeshGenerationFallbackReason;
      readonly diagnostics: MeshGenerationV6ConstrainautorDiagnostics;
      readonly details: readonly string[];
    };

const DEFAULT_ALPHA_THRESHOLD = 8;
const SOFT_ALPHA_THRESHOLD = 0.18;
const TRIANGLE_AREA_EPSILON = 0.000001;
const POINT_KEY_SCALE = 1_000_000;

export const createAutoOutlineV6BConstrainautorMesh = (
  input: AutoOutlineV6BConstrainautorMeshInput
): AutoOutlineV6BConstrainautorMeshResult => {
  const contextResult = createV6BPipelineContext(input);
  if (contextResult.status === "blocked") {
    return contextResult;
  }

  const context = contextResult.value;
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6b-constrainautor");
  if (context.holeLikeRegionCount > 0) {
    return createVisibleV6BFallback({
      input,
      context,
      reason: "v6b-unsupported-hole-region",
      diagnostics: createConstrainautorDiagnostics({
        constraintEdgeCount: context.boundaryPoints.length,
        missingConstraintEdgeCount: context.boundaryPoints.length,
        constraintRecoveryFailed: true
      }),
      provenance: createV6BFallbackProvenance("v6b-unsupported-hole-region", [
        "v6b-hole-region-detected",
        "limitation-hole-regions-reported"
      ])
    });
  }

  let successfulAttempt: (Extract<V6BConstrainautorAttemptOutcome, { readonly status: "generated" }> & {
    readonly retryProvenance: readonly V6BRetryProvenance[];
  }) | undefined;
  let lastFailure: Extract<V6BConstrainautorAttemptOutcome, { readonly status: "failed" }> | undefined;
  const attemptedRetryProvenance: V6BRetryProvenance[] = [];
  for (const attempt of createV6BRecoveryAttempts(context)) {
    for (const provenance of attempt.retryProvenance) {
      if (!attemptedRetryProvenance.includes(provenance)) {
        attemptedRetryProvenance.push(provenance);
      }
    }

    const outcome = runV6BConstrainautorAttempt(context, attempt);
    if (outcome.status === "generated") {
      successfulAttempt = {
        ...outcome,
        retryProvenance: [...attemptedRetryProvenance]
      };
      break;
    }

    lastFailure = outcome;
  }

  if (successfulAttempt === undefined) {
    const failureReason = lastFailure?.reason ?? "v6b-constrainautor-generation-failed";
    const diagnostics = lastFailure?.diagnostics ?? createConstrainautorDiagnostics({
      constraintEdgeCount: context.boundaryPoints.length,
      missingConstraintEdgeCount: context.boundaryPoints.length,
      constraintRecoveryFailed: true
    });
    return createVisibleV6BFallback({
      input,
      context,
      reason: failureReason,
      diagnostics,
      provenance: createV6BFallbackProvenance(failureReason, [
        ...attemptedRetryProvenance,
        ...(lastFailure?.details ?? ["v6b-constrainautor-retry-sequence-failed"])
      ])
    });
  }

  const recovery = successfulAttempt.recovery;
  const filtered = successfulAttempt.filtered;
  const finalDiagnostics = successfulAttempt.diagnostics;

  const token = stripIdPrefix(input.drawableId, "draw_");
  const mesh: MeshDto = {
    meshId: input.meshId,
    drawableId: input.drawableId,
    vertices: recovery.points.map((point) => pixelPointToStagePoint(point, input.bounds, context.width, context.height)),
    uvs: recovery.points.map((point) => pixelPointToUv(point, context.width, context.height)),
    triangles: filtered.triangles.map((triangle) => [...triangle] as [number, number, number]),
    vertexStableIds: recovery.points.map((point, index) =>
      point.role === "boundary"
        ? `vtx_${token}_v6b_boundary_${point.stableOrder}`
        : `vtx_${token}_v6b_interior_${point.stableOrder}_${index}`
    ),
    triangleStableIds: filtered.triangles.map((_triangle, index) => `tri_${token}_v6b_${index}` as TriangleId),
    topologyRevision: 0,
    bounds: structuredClone(input.bounds),
    generationProvenanceId: input.provenanceId
  };
  const boundaryVertexCount = recovery.points.filter((point) => point.role === "boundary").length;
  const qualityMetrics = computeMeshQualityMetrics(mesh, {
    refinementIterationCount: 0,
    triangulationMode: "v6b-delaunator-constrainautor",
    v6Metrics: {
      algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
      methodId: candidate.methodId,
      backendId: candidate.backendId,
      backendImplementationStatus: candidate.backendImplementationStatus,
      requestedSourceId: candidate.sourceId,
      actualSourceId: candidate.sourceId,
      outputKind: "backend-output",
      preset: context.density,
      fallbackSteps: [],
      vertexCount: mesh.vertices.length,
      triangleCount: mesh.triangles.length,
      boundaryVertexCount,
      interiorVertexCount: Math.max(0, mesh.vertices.length - boundaryVertexCount),
      alphaBoundsAvailable: true,
      opaquePixelCount: context.mask.opaquePixelCount,
      contourLoopCount: context.boundaryLoops.length,
      holeLikeRegionCount: context.holeLikeRegionCount,
      removedTriangleCount: filtered.removedTriangleCount,
      outsideOrCrossingTriangleCount: filtered.outsideOrCrossingTriangleCount,
      multiIslandHandling: context.components.length > 1 ? "main-island-only" : "supported",
      holeHandling: "supported",
      provenance: createV6BSuccessProvenance(context.components.length, successfulAttempt.retryProvenance),
      constrainautorDiagnostics: finalDiagnostics
    }
  });

  return {
    status: "generated",
    mesh,
    alphaBounds: context.alphaBounds,
    qualityMetrics
  };
};

export const recoverV6BConstrainautorTriangles = (
  input: V6BConstrainautorRecoveryInput
): V6BConstrainautorRecoveryResult => {
  const sanitized = sanitizeConstrainautorInput(input);
  if (sanitized.status === "failed") {
    return {
      status: "failed",
      reason: "v6b-invalid-constraints",
      points: sanitized.points,
      triangles: [],
      diagnostics: createConstrainautorDiagnostics({
        constraintEdgeCount: sanitized.constraintEdgeCount,
        preservedConstraintEdgeCount: 0,
        missingConstraintEdgeCount: sanitized.constraintEdgeCount,
        constraintRecoveryFailed: true
      })
    };
  }

  let delaunay: Delaunator<Float64Array<ArrayBuffer>>;
  let constrainer: Constrainautor;
  try {
    delaunay = Delaunator.from([...sanitized.points], (point) => point.x, (point) => point.y);
    constrainer = new Constrainautor(delaunay);
    const untriangulatedPoints = constrainer.untriangulatedPoints();
    if (untriangulatedPoints.length > 0) {
      return {
        status: "failed",
        reason: "v6b-invalid-constraints",
        points: sanitized.points,
        triangles: [],
        diagnostics: createConstrainautorDiagnostics({
          constraintEdgeCount: sanitized.constraintEdges.length,
          preservedConstraintEdgeCount: 0,
          missingConstraintEdgeCount: sanitized.constraintEdges.length,
          constraintRecoveryFailed: true
        })
      };
    }

    constrainer.constrainAll(sanitized.constraintEdges);
  } catch (error) {
    return {
      status: "failed",
      reason: "v6b-backend-threw",
      points: sanitized.points,
      triangles: [],
      diagnostics: createConstrainautorDiagnostics({
        constraintEdgeCount: sanitized.constraintEdges.length,
        preservedConstraintEdgeCount: 0,
        missingConstraintEdgeCount: sanitized.constraintEdges.length,
        constraintRecoveryFailed: true,
        thrownErrorKind: classifyConstrainautorError(error)
      })
    };
  }

  const triangles = toTriangleTriples(delaunay.triangles);
  const preserved = sanitized.constraintEdges.filter(([left, right]) => {
    const found = constrainer.findEdge(left, right);
    return found !== Infinity && edgeSetHasUndirectedEdge(triangles, left, right);
  }).length;
  const missing = sanitized.constraintEdges.length - preserved;
  const diagnostics = createConstrainautorDiagnostics({
    constraintEdgeCount: sanitized.constraintEdges.length,
    preservedConstraintEdgeCount: preserved,
    missingConstraintEdgeCount: missing,
    constraintRecoveryFailed: missing > 0
  });

  if (missing > 0) {
    return {
      status: "failed",
      reason: "v6b-constraint-recovery-failed",
      points: sanitized.points,
      triangles,
      diagnostics
    };
  }

  return {
    status: "generated",
    points: sanitized.points,
    triangles,
    diagnostics
  };
};

const createV6BPipelineContext = (
  input: AutoOutlineV6BConstrainautorMeshInput
):
  | { readonly status: "ready"; readonly value: V6BPipelineContext }
  | AutoOutlineV6BConstrainautorMeshResult & { readonly status: "blocked" } => {
  const width = Math.round(input.textureSize.width);
  const height = Math.round(input.textureSize.height);
  if (width <= 0 || height <= 0 || input.rgbaBytes.byteLength !== width * height * 4) {
    return { status: "blocked", reason: "v6b-constrainautor-generation-failed" };
  }

  const mask = createSoftAlphaMask(input.rgbaBytes, width, height, input.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD);
  if (mask.opaquePixelCount === 0) {
    return { status: "blocked", reason: "alpha-empty", opaquePixelCount: 0 };
  }

  const components = findOpaqueComponents(mask.mask, width, height);
  const mainComponent = selectMainComponent(components);
  if (mainComponent === undefined) {
    return {
      status: "blocked",
      reason: "alpha-empty",
      opaquePixelCount: mask.opaquePixelCount
    };
  }

  const mainMask = createComponentMask(mainComponent, width, height);
  const boundaryLoops = traceBoundaryLoops(mainMask, width, height);
  const outerLoop = selectOuterLoop(boundaryLoops);
  const alphaBounds = pixelBoundsToStageRect(mainComponent.bounds, input.bounds, width, height);
  if (outerLoop === undefined || outerLoop.length < 3) {
    return {
      status: "blocked",
      reason: "v6b-constrainautor-generation-failed",
      opaquePixelCount: mask.opaquePixelCount,
      alphaBounds
    };
  }

  const density = input.densityHint ?? "medium";
  const densityParameters = getDensityParameters(density);
  const boundaryPoints = sampleBoundaryLoop(outerLoop, densityParameters);
  if (boundaryPoints.length < 3) {
    return {
      status: "blocked",
      reason: "v6b-constrainautor-generation-failed",
      opaquePixelCount: mask.opaquePixelCount,
      alphaBounds
    };
  }

  const interiorPoints = sampleInteriorPoints({
    mainMask,
    width,
    height,
    component: mainComponent,
    boundaryPoints,
    densityParameters
  });
  return {
    status: "ready",
    value: {
      width,
      height,
      mask,
      components,
      mainComponent,
      mainMask,
      boundaryLoops,
      outerLoop,
      boundaryPoints,
      interiorPoints,
      alphaBounds,
      holeLikeRegionCount: countHoleLikeRegions(mainMask, width, height, mainComponent.bounds),
      density
    }
  };
};

const createVisibleV6BFallback = (input: {
  readonly input: AutoOutlineV6BConstrainautorMeshInput;
  readonly context: V6BPipelineContext;
  readonly reason: MeshGenerationFallbackReason;
  readonly diagnostics: MeshGenerationV6ConstrainautorDiagnostics;
  readonly provenance: readonly string[];
}): AutoOutlineV6BConstrainautorMeshResult => {
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6b-constrainautor");
  const fallback = createAlphaBoundsFallbackMesh({
    meshId: input.input.meshId,
    drawableId: input.input.drawableId,
    bounds: input.input.bounds,
    provenanceId: input.input.provenanceId,
    textureSize: { width: input.context.width, height: input.context.height },
    rgbaBytes: input.input.rgbaBytes,
    alphaBoundsPixels: input.context.mainComponent.bounds,
    densityHint: input.context.density,
    alphaThreshold: input.input.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD
  });
  const mesh = fallback.mesh;
  const source: DrawableGeneratedMeshSource = "alpha-aware-rgba";
  const fallbackSteps: readonly MeshGenerationFallbackStep[] = [
    {
      method: candidate.methodId,
      reason: input.reason
    }
  ];
  const boundaryVertexCount = countBoundaryVertices(mesh);
  const qualityMetrics = computeMeshQualityMetrics(mesh, {
    refinementIterationCount: 0,
    fallbackReason: input.reason,
    triangulationMode: "v6-backend-blocked-fallback",
    v6Metrics: {
      algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
      methodId: candidate.methodId,
      backendId: candidate.backendId,
      backendImplementationStatus: candidate.backendImplementationStatus,
      requestedSourceId: candidate.sourceId,
      actualSourceId: source,
      outputKind: "fallback-output",
      preset: input.context.density,
      fallbackReason: input.reason,
      fallbackSteps,
      vertexCount: mesh.vertices.length,
      triangleCount: mesh.triangles.length,
      boundaryVertexCount,
      interiorVertexCount: Math.max(0, mesh.vertices.length - boundaryVertexCount),
      alphaBoundsAvailable: true,
      opaquePixelCount: input.context.mask.opaquePixelCount,
      contourLoopCount: input.context.boundaryLoops.length,
      holeLikeRegionCount: input.context.holeLikeRegionCount,
      removedTriangleCount: 0,
      outsideOrCrossingTriangleCount: input.diagnostics.outsideTriangleCount,
      multiIslandHandling: input.context.components.length > 1 ? "main-island-only" : "supported",
      holeHandling: input.context.holeLikeRegionCount > 0 ? "unsupported-fallback" : "supported",
      provenance: input.provenance,
      constrainautorDiagnostics: input.diagnostics
    }
  });

  return {
    status: "fallback",
    mesh,
    source,
    reason: input.reason,
    fallbackSteps,
    alphaBounds: input.context.alphaBounds,
    qualityMetrics
  };
};

const createV6BRecoveryAttempts = (
  context: V6BPipelineContext
): readonly V6BRecoveryAttempt[] => {
  const densityParameters = getDensityParameters(context.density);
  const coarserDensityParameters = getCoarserBoundaryDensityParameters(densityParameters);
  const coarserBoundaryPoints = sampleBoundaryLoop(context.outerLoop, coarserDensityParameters);
  const attempts: V6BRecoveryAttempt[] = [
    {
      boundaryPoints: context.boundaryPoints,
      interiorPoints: context.interiorPoints,
      retryProvenance: []
    }
  ];

  if (coarserBoundaryPoints.length >= 3) {
    attempts.push({
      boundaryPoints: coarserBoundaryPoints,
      interiorPoints: sampleInteriorPoints({
        mainMask: context.mainMask,
        width: context.width,
        height: context.height,
        component: context.mainComponent,
        boundaryPoints: coarserBoundaryPoints,
        densityParameters: coarserDensityParameters
      }),
      retryProvenance: ["v6b-retry-coarser-boundary"]
    });
  }

  attempts.push({
    boundaryPoints: context.boundaryPoints,
    interiorPoints: [],
    retryProvenance: ["v6b-retry-fewer-interior-points"]
  });

  return attempts;
};

const runV6BConstrainautorAttempt = (
  context: V6BPipelineContext,
  attempt: V6BRecoveryAttempt
): V6BConstrainautorAttemptOutcome => runV6BConstrainautorRecoveryInput({
  recoveryInput: createRecoveryInputForAttempt(attempt),
  mainMask: context.mainMask,
  width: context.width,
  height: context.height
});

const runV6BConstrainautorRecoveryInput = (input: {
  readonly recoveryInput: V6BConstrainautorRecoveryInput;
  readonly mainMask: readonly boolean[];
  readonly width: number;
  readonly height: number;
}): V6BConstrainautorAttemptOutcome => {
  const recovery = recoverV6BConstrainautorTriangles(input.recoveryInput);
  if (recovery.status === "failed") {
    return {
      status: "failed",
      reason: recovery.reason,
      diagnostics: recovery.diagnostics,
      details: ["v6b-constrainautor-recovery-failed"]
    };
  }

  const boundaryEdges = createRecoveredBoundaryEdges(recovery.points);
  const filtered = filterTrianglesToMainMask({
    points: recovery.points,
    triangles: recovery.triangles,
    mainMask: input.mainMask,
    width: input.width,
    height: input.height,
    boundaryEdges
  });
  const finalConstraintCounts = countPreservedConstraintEdges(
    filtered.triangles,
    recovery.points,
    boundaryEdges
  );
  const diagnostics = {
    ...recovery.diagnostics,
    preservedConstraintEdgeCount: finalConstraintCounts.preserved,
    missingConstraintEdgeCount: finalConstraintCounts.missing,
    constraintRecoveryFailed: finalConstraintCounts.missing > 0,
    outsideTriangleCount: filtered.outsideOrCrossingTriangleCount
  } satisfies MeshGenerationV6ConstrainautorDiagnostics;

  if (filtered.triangles.length === 0 || finalConstraintCounts.missing > 0) {
    return {
      status: "failed",
      reason: "v6b-constraint-recovery-failed",
      diagnostics,
      details: ["v6b-final-boundary-constraint-verification-failed"]
    };
  }

  return {
    status: "generated",
    recovery,
    filtered,
    diagnostics
  };
};

export const probeAutoOutlineV6BConstrainautorRetryForTest = (input: {
  readonly attempts: readonly V6BConstrainautorRetryProbeAttempt[];
  readonly mainMask?: readonly boolean[];
  readonly width?: number;
  readonly height?: number;
}): V6BConstrainautorRetryProbeResult => {
  const width = input.width ?? 8;
  const height = input.height ?? 8;
  const mainMask = input.mainMask ?? Array.from({ length: width * height }, () => true);
  const attemptedRetryProvenance: V6BRetryProvenance[] = [];
  let lastFailure: Extract<V6BConstrainautorAttemptOutcome, { readonly status: "failed" }> | undefined;

  for (let attemptIndex = 0; attemptIndex < input.attempts.length; attemptIndex += 1) {
    const attempt = mustGet(input.attempts, attemptIndex);
    for (const provenance of attempt.retryProvenance ?? []) {
      if (!attemptedRetryProvenance.includes(provenance)) {
        attemptedRetryProvenance.push(provenance);
      }
    }

    const outcome = runV6BConstrainautorRecoveryInput({
      recoveryInput: attempt.recoveryInput,
      mainMask,
      width,
      height
    });
    if (outcome.status === "generated") {
      return {
        outputKind: "backend-output",
        attemptCount: attemptIndex + 1,
        triangleCount: outcome.filtered.triangles.length,
        provenance: createV6BSuccessProvenance(1, attemptedRetryProvenance),
        diagnostics: outcome.diagnostics
      };
    }

    lastFailure = outcome;
  }

  const reason = lastFailure?.reason ?? "v6b-constrainautor-generation-failed";
  const diagnostics = lastFailure?.diagnostics ?? createConstrainautorDiagnostics({
    constraintEdgeCount: 0,
    constraintRecoveryFailed: true
  });
  return {
    outputKind: "fallback-output",
    reason,
    attemptCount: input.attempts.length,
    triangleCount: 0,
    provenance: createV6BFallbackProvenance(reason, [
      ...attemptedRetryProvenance,
      ...(lastFailure?.details ?? ["v6b-constrainautor-retry-sequence-failed"])
    ]),
    diagnostics
  };
};

const createRecoveryInputForAttempt = (
  attempt: V6BRecoveryAttempt
): V6BConstrainautorRecoveryInput => ({
  points: [
    ...attempt.boundaryPoints.map((point, index) => ({
      ...point,
      role: "boundary" as const,
      stableOrder: index
    })),
    ...attempt.interiorPoints.map((point, index) => ({
      ...point,
      role: "interior" as const,
      stableOrder: index
    }))
  ],
  constraintEdges: attempt.boundaryPoints.map((_point, index) => [
    index,
    (index + 1) % attempt.boundaryPoints.length
  ] as const)
});

const createRecoveredBoundaryEdges = (
  points: readonly V6BConstrainautorPoint[]
): readonly (readonly [number, number])[] => {
  const boundaryIndexes = points
    .map((_point, index) => index)
    .filter((index) => points[index]?.role === "boundary");
  return boundaryIndexes.map((pointIndex, edgeIndex) => [
    pointIndex,
    boundaryIndexes[(edgeIndex + 1) % boundaryIndexes.length] ?? pointIndex
  ] as const);
};

interface SanitizedConstrainautorInput {
  readonly status: "ok";
  readonly points: readonly V6BConstrainautorPoint[];
  readonly constraintEdges: readonly [number, number][];
}

type SanitizedConstrainautorFailure = {
  readonly status: "failed";
  readonly points: readonly V6BConstrainautorPoint[];
  readonly constraintEdgeCount: number;
};

const sanitizeConstrainautorInput = (
  input: V6BConstrainautorRecoveryInput
): SanitizedConstrainautorInput | SanitizedConstrainautorFailure => {
  const finitePoints = input.points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  const uniqueByKey = new Map<string, V6BConstrainautorPoint>();
  const originalKeyByIndex = new Map<number, string>();
  for (let index = 0; index < finitePoints.length; index += 1) {
    const point = roundRecoveryPoint(mustGet(finitePoints, index));
    const key = pointKey(point);
    originalKeyByIndex.set(index, key);
    const existing = uniqueByKey.get(key);
    if (existing === undefined || compareRecoveryPoint(point, existing) < 0) {
      uniqueByKey.set(key, point);
    }
  }

  const points = [...uniqueByKey.values()].sort(compareRecoveryPoint);
  const remapByKey = new Map(points.map((point, index) => [pointKey(point), index]));
  const edgeKeySet = new Set<string>();
  const constraintEdges: [number, number][] = [];
  let zeroLengthEdgeCount = 0;

  for (const edge of input.constraintEdges) {
    const leftKey = originalKeyByIndex.get(edge[0]);
    const rightKey = originalKeyByIndex.get(edge[1]);
    const left = leftKey === undefined ? undefined : remapByKey.get(leftKey);
    const right = rightKey === undefined ? undefined : remapByKey.get(rightKey);
    if (left === undefined || right === undefined || left === right) {
      zeroLengthEdgeCount += 1;
      continue;
    }

    const edgeKey = undirectedEdgeKey(left, right);
    if (edgeKeySet.has(edgeKey)) {
      continue;
    }

    edgeKeySet.add(edgeKey);
    constraintEdges.push([left, right]);
  }

  if (
    points.length < 3 ||
    constraintEdges.length < 3 ||
    zeroLengthEdgeCount > 0 ||
    countCrossingConstraintEdges(points, constraintEdges) > 0 ||
    countConstraintPointIntersections(points, constraintEdges) > 0
  ) {
    return {
      status: "failed",
      points,
      constraintEdgeCount: constraintEdges.length
    };
  }

  return {
    status: "ok",
    points,
    constraintEdges
  };
};

const filterTrianglesToMainMask = (input: {
  readonly points: readonly V6BConstrainautorPoint[];
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly mainMask: readonly boolean[];
  readonly width: number;
  readonly height: number;
  readonly boundaryEdges: readonly (readonly [number, number])[];
}): FilteredTriangles => {
  const filtered: [number, number, number][] = [];
  let removedTriangleCount = 0;
  let outsideOrCrossingTriangleCount = 0;

  for (const triangle of input.triangles) {
    if (
      hasDuplicateTriangleIndex(triangle) ||
      Math.abs(triangleAreaByIndex(input.points, triangle)) <= TRIANGLE_AREA_EPSILON
    ) {
      removedTriangleCount += 1;
      continue;
    }

    const outsideMask = !isTriangleAcceptedByMask(input.points, triangle, input.mainMask, input.width, input.height);
    const crossesBoundary = triangleCrossesBoundary(input.points, triangle, input.boundaryEdges);
    if (outsideMask || crossesBoundary) {
      outsideOrCrossingTriangleCount += 1;
      if (crossesBoundary || !triangleHasConstraintBoundaryEdge(triangle, input.boundaryEdges)) {
        removedTriangleCount += 1;
        continue;
      }
    }

    filtered.push([triangle[0], triangle[1], triangle[2]]);
  }

  return {
    triangles: filtered,
    removedTriangleCount,
    outsideOrCrossingTriangleCount
  };
};

const triangleHasConstraintBoundaryEdge = (
  triangle: readonly [number, number, number],
  boundaryEdges: readonly (readonly [number, number])[]
): boolean => {
  const triangleEdgeKeys = new Set([
    undirectedEdgeKey(triangle[0], triangle[1]),
    undirectedEdgeKey(triangle[1], triangle[2]),
    undirectedEdgeKey(triangle[2], triangle[0])
  ]);

  return boundaryEdges.some(([left, right]) => triangleEdgeKeys.has(undirectedEdgeKey(left, right)));
};

const createSoftAlphaMask = (
  rgbaBytes: Uint8Array,
  width: number,
  height: number,
  alphaThreshold: number
): SoftAlphaMask => {
  const originalAlpha: number[] = [];
  let opaquePixelCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = (rgbaBytes[(y * width + x) * 4 + 3] ?? 0) / 255;
      originalAlpha.push(alpha);
      if (alpha * 255 > alphaThreshold) {
        opaquePixelCount += 1;
      }
    }
  }

  const blurredMask = originalAlpha.map((_alpha, index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const blurred = blurAlphaAt(originalAlpha, width, height, x, y);
    return blurred >= SOFT_ALPHA_THRESHOLD || (originalAlpha[index] ?? 0) * 255 > alphaThreshold;
  });

  return {
    width,
    height,
    mask: removeIsolatedAlphaNoise(closeSinglePixelCracks(blurredMask, width, height), originalAlpha, width, height),
    opaquePixelCount
  };
};

const blurAlphaAt = (
  alpha: readonly number[],
  width: number,
  height: number,
  x: number,
  y: number
): number => {
  let weightedSum = 0;
  let weightTotal = 0;

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const sampleX = clampInt(x + dx, 0, width - 1);
      const sampleY = clampInt(y + dy, 0, height - 1);
      const weight = dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1;
      weightedSum += (alpha[sampleY * width + sampleX] ?? 0) * weight;
      weightTotal += weight;
    }
  }

  return weightTotal === 0 ? 0 : weightedSum / weightTotal;
};

const closeSinglePixelCracks = (
  mask: readonly boolean[],
  width: number,
  height: number
): readonly boolean[] =>
  mask.map((isOpaque, index) => {
    if (isOpaque) {
      return true;
    }

    const x = index % width;
    const y = Math.floor(index / width);
    return countOpaqueNeighbors(mask, width, height, x, y) >= 5;
  });

const removeIsolatedAlphaNoise = (
  mask: readonly boolean[],
  originalAlpha: readonly number[],
  width: number,
  height: number
): readonly boolean[] =>
  mask.map((isOpaque, index) => {
    if (!isOpaque || (originalAlpha[index] ?? 0) >= 0.5) {
      return isOpaque;
    }

    const x = index % width;
    const y = Math.floor(index / width);
    return countOpaqueNeighbors(mask, width, height, x, y) > 1;
  });

const countOpaqueNeighbors = (
  mask: readonly boolean[],
  width: number,
  height: number,
  x: number,
  y: number
): number => {
  let count = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }

      const sampleX = x + dx;
      const sampleY = y + dy;
      if (sampleX < 0 || sampleX >= width || sampleY < 0 || sampleY >= height) {
        continue;
      }

      if (mask[sampleY * width + sampleX] === true) {
        count += 1;
      }
    }
  }

  return count;
};

const findOpaqueComponents = (
  mask: readonly boolean[],
  width: number,
  height: number
): readonly OpaqueComponent[] => {
  const visited = new Uint8Array(width * height);
  const components: OpaqueComponent[] = [];

  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== true || visited[index] === 1) {
      continue;
    }

    const stack = [index];
    const pixelIndices: number[] = [];
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;
    visited[index] = 1;

    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined) {
        continue;
      }

      const x = current % width;
      const y = Math.floor(current / width);
      pixelIndices.push(current);
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);

      for (const neighbor of getFourNeighbors(x, y, width, height)) {
        const neighborIndex = neighbor.y * width + neighbor.x;
        if (mask[neighborIndex] !== true || visited[neighborIndex] === 1) {
          continue;
        }

        visited[neighborIndex] = 1;
        stack.push(neighborIndex);
      }
    }

    components.push({
      pixelIndices,
      bounds: { left, top, right, bottom }
    });
  }

  return components;
};

const selectMainComponent = (
  components: readonly OpaqueComponent[]
): OpaqueComponent | undefined =>
  [...components].sort((left, right) => {
    const areaDelta = right.pixelIndices.length - left.pixelIndices.length;
    if (areaDelta !== 0) {
      return areaDelta;
    }

    return (
      left.bounds.top - right.bounds.top ||
      left.bounds.left - right.bounds.left ||
      left.bounds.bottom - right.bounds.bottom ||
      left.bounds.right - right.bounds.right
    );
  })[0];

const createComponentMask = (
  component: OpaqueComponent,
  width: number,
  height: number
): readonly boolean[] => {
  const mask = new Array<boolean>(width * height).fill(false);
  for (const index of component.pixelIndices) {
    mask[index] = true;
  }

  return mask;
};

const traceBoundaryLoops = (
  mainMask: readonly boolean[],
  width: number,
  height: number
): readonly (readonly PixelPoint[])[] => {
  const edges: BoundaryEdge[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mainMask[y * width + x] !== true) {
        continue;
      }

      if (!isOpaqueAt(mainMask, width, height, x, y - 1)) {
        edges.push({ start: { x, y }, end: { x: x + 1, y } });
      }
      if (!isOpaqueAt(mainMask, width, height, x + 1, y)) {
        edges.push({ start: { x: x + 1, y }, end: { x: x + 1, y: y + 1 } });
      }
      if (!isOpaqueAt(mainMask, width, height, x, y + 1)) {
        edges.push({ start: { x: x + 1, y: y + 1 }, end: { x, y: y + 1 } });
      }
      if (!isOpaqueAt(mainMask, width, height, x - 1, y)) {
        edges.push({ start: { x, y: y + 1 }, end: { x, y } });
      }
    }
  }

  const outgoingEdges = new Map<string, number[]>();
  for (let index = 0; index < edges.length; index += 1) {
    const edge = mustGet(edges, index);
    const key = pointKey(edge.start);
    const outgoing = outgoingEdges.get(key);
    if (outgoing === undefined) {
      outgoingEdges.set(key, [index]);
      continue;
    }

    outgoing.push(index);
  }
  for (const indexes of outgoingEdges.values()) {
    indexes.sort((leftIndex, rightIndex) => {
      const left = mustGet(edges, leftIndex);
      const right = mustGet(edges, rightIndex);
      return comparePoint(left.end, right.end);
    });
  }

  const unused = new Set(edges.map((_edge, index) => index));
  const loops: (readonly PixelPoint[])[] = [];
  while (unused.size > 0) {
    const firstEdgeIndex = [...unused].sort((leftIndex, rightIndex) => {
      const left = mustGet(edges, leftIndex);
      const right = mustGet(edges, rightIndex);
      return comparePoint(left.start, right.start) || comparePoint(left.end, right.end);
    })[0];
    if (firstEdgeIndex === undefined) {
      break;
    }

    const firstEdge = mustGet(edges, firstEdgeIndex);
    const startKey = pointKey(firstEdge.start);
    const loop: PixelPoint[] = [firstEdge.start];
    let currentEdgeIndex = firstEdgeIndex;
    let guard = 0;

    while (guard < edges.length + 1) {
      guard += 1;
      const edge = mustGet(edges, currentEdgeIndex);
      unused.delete(currentEdgeIndex);
      loop.push(edge.end);

      const endKey = pointKey(edge.end);
      if (endKey === startKey) {
        break;
      }

      const outgoing = outgoingEdges.get(endKey) ?? [];
      const nextEdgeIndex = outgoing.find((candidateIndex) => unused.has(candidateIndex));
      if (nextEdgeIndex === undefined) {
        break;
      }

      currentEdgeIndex = nextEdgeIndex;
    }

    const normalizedLoop = normalizeLoop(loop);
    if (normalizedLoop.length >= 3 && pointKey(mustGet(normalizedLoop, 0)) === startKey) {
      loops.push(ensurePositiveLoopOrientation(rotateLoopToStableStart(normalizedLoop)));
    }
  }

  return loops;
};

const selectOuterLoop = (
  loops: readonly (readonly PixelPoint[])[]
): readonly PixelPoint[] | undefined =>
  [...loops].sort((left, right) => {
    const areaDelta = Math.abs(polygonSignedArea(right)) - Math.abs(polygonSignedArea(left));
    if (areaDelta !== 0) {
      return areaDelta;
    }

    const leftPoint = selectLexicographicPoint(left);
    const rightPoint = selectLexicographicPoint(right);
    return comparePoint(leftPoint, rightPoint);
  })[0];

const sampleBoundaryLoop = (
  loop: readonly PixelPoint[],
  densityParameters: DensityParameters
): readonly PixelPoint[] => {
  const perimeter = polygonPerimeter(loop);
  if (perimeter <= 0) {
    return [];
  }

  const targetCount = clampInt(
    Math.round(perimeter / densityParameters.boundarySpacing),
    Math.min(8, loop.length),
    Math.min(densityParameters.maxBoundaryVertices, Math.max(3, loop.length * 2))
  );
  const samples: { readonly point: PixelPoint; readonly distance: number }[] = [];
  for (let index = 0; index < targetCount; index += 1) {
    const distance = (perimeter * index) / targetCount;
    samples.push({ point: pointAtPolygonDistance(loop, distance), distance });
  }

  for (const anchorIndex of selectBoundaryAnchorIndexes(loop)) {
    samples.push({
      point: mustGet(loop, anchorIndex),
      distance: polygonDistanceAtVertex(loop, anchorIndex)
    });
  }

  return nudgeBoundaryPointsOffSharedLines(dedupeOrderedPoints(
    samples
      .sort((left, right) => left.distance - right.distance || comparePoint(left.point, right.point))
      .map((sample) => sample.point)
  ));
};

const nudgeBoundaryPointsOffSharedLines = (
  points: readonly PixelPoint[]
): readonly PixelPoint[] => {
  if (points.length < 3) {
    return points;
  }

  const centroid = {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length
  };
  return points.map((point, index) => {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0) {
      return point;
    }

    const epsilon = 0.0001 + (index % 3) * 0.00001;
    return {
      x: roundCoordinate(point.x + (dx / length) * epsilon),
      y: roundCoordinate(point.y + (dy / length) * epsilon)
    };
  });
};

const selectBoundaryAnchorIndexes = (
  loop: readonly PixelPoint[]
): readonly number[] => {
  const indexes = new Set<number>();
  indexes.add(findExtremePointIndex(loop, (left, right) => left.y - right.y || left.x - right.x));
  indexes.add(findExtremePointIndex(loop, (left, right) => right.y - left.y || left.x - right.x));
  indexes.add(findExtremePointIndex(loop, (left, right) => left.x - right.x || left.y - right.y));
  indexes.add(findExtremePointIndex(loop, (left, right) => right.x - left.x || left.y - right.y));
  return [...indexes].sort((left, right) => left - right);
};

const findExtremePointIndex = (
  points: readonly PixelPoint[],
  compare: (left: PixelPoint, right: PixelPoint) => number
): number => {
  let selectedIndex = 0;
  for (let index = 1; index < points.length; index += 1) {
    if (compare(mustGet(points, index), mustGet(points, selectedIndex)) < 0) {
      selectedIndex = index;
    }
  }

  return selectedIndex;
};

const sampleInteriorPoints = (input: {
  readonly mainMask: readonly boolean[];
  readonly width: number;
  readonly height: number;
  readonly component: OpaqueComponent;
  readonly boundaryPoints: readonly PixelPoint[];
  readonly densityParameters: DensityParameters;
}): readonly PixelPoint[] => {
  const points: PixelPoint[] = [];
  const usedKeys = new Set(input.boundaryPoints.map(pointKey));
  const addInteriorPoint = (point: PixelPoint, requireClearance: boolean): void => {
    const rounded = roundPixelPoint(point);
    if (!isPointInsideMask(input.mainMask, input.width, input.height, rounded)) {
      return;
    }

    if (requireClearance) {
      const boundaryDistance = distanceToClosedPolyline(rounded, input.boundaryPoints);
      if (boundaryDistance < input.densityParameters.interiorBoundaryClearance) {
        return;
      }
    }

    const key = pointKey(rounded);
    if (usedKeys.has(key) || points.length >= input.densityParameters.maxInteriorVertices) {
      return;
    }

    usedKeys.add(key);
    points.push(rounded);
  };

  addInteriorPoint(resolveComponentCentroid(input.component, input.width, input.height, input.mainMask), false);

  const step = input.densityParameters.interiorSpacing;
  for (let y = input.component.bounds.top + step / 2; y < input.component.bounds.bottom; y += step) {
    for (let x = input.component.bounds.left + step / 2; x < input.component.bounds.right; x += step) {
      addInteriorPoint({ x, y }, true);
    }
  }

  return points.sort(comparePoint);
};

const createAlphaBoundsFallbackMesh = (input: {
  readonly meshId: MeshId;
  readonly drawableId: DrawableId;
  readonly bounds: RectDto;
  readonly provenanceId: ProvenanceId;
  readonly textureSize: { readonly width: number; readonly height: number };
  readonly rgbaBytes: Uint8Array;
  readonly alphaBoundsPixels: PixelBounds;
  readonly densityHint: MeshDensityHint;
  readonly alphaThreshold: number;
}): { readonly mesh: MeshDto } => {
  const cells = gridCellsForDensity(input.densityHint);
  const vertices: MeshDto["vertices"] = [];
  const uvs: MeshDto["uvs"] = [];
  const vertexStableIds: string[] = [];
  const triangles: MeshDto["triangles"] = [];
  const triangleStableIds: TriangleId[] = [];
  const token = stripIdPrefix(input.drawableId, "draw_");
  const vertexIndexByGridPoint = new Map<string, number>();

  const addVertex = (row: number, column: number): number => {
    const key = `${row}:${column}`;
    const existingIndex = vertexIndexByGridPoint.get(key);
    if (existingIndex !== undefined) {
      return existingIndex;
    }

    const pixelX = lerp(input.alphaBoundsPixels.left, input.alphaBoundsPixels.right, column / cells);
    const pixelY = lerp(input.alphaBoundsPixels.top, input.alphaBoundsPixels.bottom, row / cells);
    const uv = {
      x: roundCoordinate(pixelX / input.textureSize.width),
      y: roundCoordinate(pixelY / input.textureSize.height)
    };
    const vertex = {
      x: roundCoordinate(input.bounds.x + input.bounds.width * uv.x),
      y: roundCoordinate(input.bounds.y + input.bounds.height * uv.y)
    };
    const vertexIndex = vertices.length;
    vertices.push(vertex);
    uvs.push(uv);
    vertexStableIds.push(`vtx_${token}_v6b_fallback_${row}_${column}`);
    vertexIndexByGridPoint.set(key, vertexIndex);
    return vertexIndex;
  };

  for (let row = 0; row < cells; row += 1) {
    for (let column = 0; column < cells; column += 1) {
      const cellPixels = {
        left: Math.floor(lerp(input.alphaBoundsPixels.left, input.alphaBoundsPixels.right, column / cells)),
        top: Math.floor(lerp(input.alphaBoundsPixels.top, input.alphaBoundsPixels.bottom, row / cells)),
        right: Math.ceil(lerp(input.alphaBoundsPixels.left, input.alphaBoundsPixels.right, (column + 1) / cells)),
        bottom: Math.ceil(lerp(input.alphaBoundsPixels.top, input.alphaBoundsPixels.bottom, (row + 1) / cells))
      };
      if (!cellHasAlpha(input.rgbaBytes, input.textureSize.width, input.textureSize.height, cellPixels, input.alphaThreshold)) {
        continue;
      }

      const topLeft = addVertex(row, column);
      const topRight = addVertex(row, column + 1);
      const bottomLeft = addVertex(row + 1, column);
      const bottomRight = addVertex(row + 1, column + 1);
      triangles.push([topLeft, topRight, bottomLeft]);
      triangleStableIds.push(`tri_${token}_v6b_fallback_${row}_${column}_a` as TriangleId);
      triangles.push([topRight, bottomRight, bottomLeft]);
      triangleStableIds.push(`tri_${token}_v6b_fallback_${row}_${column}_b` as TriangleId);
    }
  }

  if (vertices.length === 0 || triangles.length === 0) {
    const fallbackVertices = [
      { x: input.bounds.x, y: input.bounds.y },
      { x: input.bounds.x + input.bounds.width, y: input.bounds.y },
      { x: input.bounds.x, y: input.bounds.y + input.bounds.height },
      { x: input.bounds.x + input.bounds.width, y: input.bounds.y + input.bounds.height }
    ];
    return {
      mesh: {
        meshId: input.meshId,
        drawableId: input.drawableId,
        vertices: fallbackVertices.map((vertex) => ({ x: roundCoordinate(vertex.x), y: roundCoordinate(vertex.y) })),
        uvs: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
          { x: 1, y: 1 }
        ],
        triangles: [
          [0, 1, 2],
          [1, 3, 2]
        ],
        vertexStableIds: [
          `vtx_${token}_v6b_fallback_bounds_0_0`,
          `vtx_${token}_v6b_fallback_bounds_0_1`,
          `vtx_${token}_v6b_fallback_bounds_1_0`,
          `vtx_${token}_v6b_fallback_bounds_1_1`
        ],
        triangleStableIds: [
          `tri_${token}_v6b_fallback_bounds_a` as TriangleId,
          `tri_${token}_v6b_fallback_bounds_b` as TriangleId
        ],
        topologyRevision: 0,
        bounds: structuredClone(input.bounds),
        generationProvenanceId: input.provenanceId
      }
    };
  }

  return {
    mesh: {
      meshId: input.meshId,
      drawableId: input.drawableId,
      vertices,
      uvs,
      triangles,
      vertexStableIds,
      triangleStableIds,
      topologyRevision: 0,
      bounds: structuredClone(input.bounds),
      generationProvenanceId: input.provenanceId
    }
  };
};

const countHoleLikeRegions = (
  mainMask: readonly boolean[],
  width: number,
  height: number,
  bounds: PixelBounds
): number => {
  const visited = new Uint8Array(width * height);
  let count = 0;

  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const index = y * width + x;
      if (mainMask[index] === true || visited[index] === 1) {
        continue;
      }

      const stack = [{ x, y }];
      let touchesBounds = false;
      visited[index] = 1;

      while (stack.length > 0) {
        const current = stack.pop();
        if (current === undefined) {
          continue;
        }

        if (
          current.x === bounds.left ||
          current.x === bounds.right - 1 ||
          current.y === bounds.top ||
          current.y === bounds.bottom - 1
        ) {
          touchesBounds = true;
        }

        for (const neighbor of getFourNeighbors(current.x, current.y, width, height)) {
          if (
            neighbor.x < bounds.left ||
            neighbor.x >= bounds.right ||
            neighbor.y < bounds.top ||
            neighbor.y >= bounds.bottom
          ) {
            continue;
          }

          const neighborIndex = neighbor.y * width + neighbor.x;
          if (mainMask[neighborIndex] === true || visited[neighborIndex] === 1) {
            continue;
          }

          visited[neighborIndex] = 1;
          stack.push(neighbor);
        }
      }

      if (!touchesBounds) {
        count += 1;
      }
    }
  }

  return count;
};

const getDensityParameters = (densityHint: MeshDensityHint): DensityParameters => {
  switch (densityHint) {
    case "high":
      return {
        boundarySpacing: 1.75,
        interiorSpacing: 3,
        maxBoundaryVertices: 128,
        maxInteriorVertices: 64,
        interiorBoundaryClearance: 0.75
      };
    case "medium":
      return {
        boundarySpacing: 2.75,
        interiorSpacing: 5,
        maxBoundaryVertices: 96,
        maxInteriorVertices: 32,
        interiorBoundaryClearance: 1.1
      };
    case "low":
      return {
        boundarySpacing: 4.25,
        interiorSpacing: 7,
        maxBoundaryVertices: 64,
        maxInteriorVertices: 16,
        interiorBoundaryClearance: 1.5
      };
  }
};

const getCoarserBoundaryDensityParameters = (
  densityParameters: DensityParameters
): DensityParameters => ({
  ...densityParameters,
  boundarySpacing: densityParameters.boundarySpacing * 1.75,
  maxBoundaryVertices: Math.max(8, Math.floor(densityParameters.maxBoundaryVertices / 2))
});

const createConstrainautorDiagnostics = (input: {
  readonly constraintEdgeCount: number;
  readonly preservedConstraintEdgeCount?: number;
  readonly missingConstraintEdgeCount?: number;
  readonly constraintRecoveryFailed: boolean;
  readonly outsideTriangleCount?: number;
  readonly thrownErrorKind?: string;
}): MeshGenerationV6ConstrainautorDiagnostics => ({
  dependencyGateStatus: "available",
  constraintEdgeCount: input.constraintEdgeCount,
  preservedConstraintEdgeCount: input.preservedConstraintEdgeCount ?? 0,
  missingConstraintEdgeCount: input.missingConstraintEdgeCount ?? 0,
  constraintRecoveryFailed: input.constraintRecoveryFailed,
  outsideTriangleCount: input.outsideTriangleCount ?? 0,
  ...(input.thrownErrorKind === undefined ? {} : { thrownErrorKind: input.thrownErrorKind })
});

const createV6BSuccessProvenance = (
  componentCount: number,
  retryProvenance: readonly V6BRetryProvenance[]
): readonly string[] => [
  "v6b-soft-alpha-mask",
  "v6b-main-island-boundary",
  "v6b-adaptive-boundary-sampling",
  "v6b-deterministic-interior-sampling",
  "v6b-delaunator",
  "v6b-constrainautor-constraint-recovery",
  ...retryProvenance,
  "v6b-boundary-constraints-verified",
  ...(componentCount > 1 ? ["limitation-main-island-only"] : [])
];

const createV6BFallbackProvenance = (
  reason: MeshGenerationFallbackReason,
  details: readonly string[]
): readonly string[] => [
  "v6b-soft-alpha-mask",
  "v6b-main-island-boundary",
  "v6b-visible-fallback",
  `fallback-${reason}`,
  ...details
];

const classifyConstrainautorError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized.length === 0 ? "unknown-constrainautor-error" : normalized;
};

const toTriangleTriples = (
  triangles: ArrayLike<number>
): readonly (readonly [number, number, number])[] => {
  const triples: [number, number, number][] = [];
  for (let index = 0; index + 2 < triangles.length; index += 3) {
    triples.push([triangles[index] ?? 0, triangles[index + 1] ?? 0, triangles[index + 2] ?? 0]);
  }

  return triples;
};

const countPreservedConstraintEdges = (
  triangles: readonly (readonly [number, number, number])[],
  points: readonly V6BConstrainautorPoint[],
  constraintEdges: readonly (readonly [number, number])[]
): { readonly preserved: number; readonly missing: number } => {
  let preserved = 0;
  for (const [left, right] of constraintEdges) {
    if (
      left !== right &&
      points[left] !== undefined &&
      points[right] !== undefined &&
      edgeSetHasUndirectedEdge(triangles, left, right)
    ) {
      preserved += 1;
    }
  }

  return {
    preserved,
    missing: constraintEdges.length - preserved
  };
};

const edgeSetHasUndirectedEdge = (
  triangles: readonly (readonly [number, number, number])[],
  left: number,
  right: number
): boolean => {
  const key = undirectedEdgeKey(left, right);
  for (const triangle of triangles) {
    if (
      undirectedEdgeKey(triangle[0], triangle[1]) === key ||
      undirectedEdgeKey(triangle[1], triangle[2]) === key ||
      undirectedEdgeKey(triangle[2], triangle[0]) === key
    ) {
      return true;
    }
  }

  return false;
};

const countCrossingConstraintEdges = (
  points: readonly V6BConstrainautorPoint[],
  edges: readonly (readonly [number, number])[]
): number => {
  let count = 0;
  for (let leftIndex = 0; leftIndex < edges.length; leftIndex += 1) {
    const left = mustGet(edges, leftIndex);
    for (let rightIndex = leftIndex + 1; rightIndex < edges.length; rightIndex += 1) {
      const right = mustGet(edges, rightIndex);
      if (left[0] === right[0] || left[0] === right[1] || left[1] === right[0] || left[1] === right[1]) {
        continue;
      }

      if (segmentsIntersect(mustGet(points, left[0]), mustGet(points, left[1]), mustGet(points, right[0]), mustGet(points, right[1]))) {
        count += 1;
      }
    }
  }

  return count;
};

const countConstraintPointIntersections = (
  points: readonly V6BConstrainautorPoint[],
  edges: readonly (readonly [number, number])[]
): number => {
  let count = 0;
  for (const [left, right] of edges) {
    const start = mustGet(points, left);
    const end = mustGet(points, right);
    for (let index = 0; index < points.length; index += 1) {
      if (index === left || index === right) {
        continue;
      }

      if (isPointOnSegment(mustGet(points, index), start, end)) {
        count += 1;
      }
    }
  }

  return count;
};

const triangleCrossesBoundary = (
  points: readonly V6BConstrainautorPoint[],
  triangle: readonly [number, number, number],
  boundaryEdges: readonly (readonly [number, number])[]
): boolean => {
  const triangleEdges = [
    [triangle[0], triangle[1]],
    [triangle[1], triangle[2]],
    [triangle[2], triangle[0]]
  ] as const;

  for (const triangleEdge of triangleEdges) {
    for (const boundaryEdge of boundaryEdges) {
      if (
        triangleEdge[0] === boundaryEdge[0] ||
        triangleEdge[0] === boundaryEdge[1] ||
        triangleEdge[1] === boundaryEdge[0] ||
        triangleEdge[1] === boundaryEdge[1]
      ) {
        continue;
      }

      if (
        segmentsIntersect(
          mustGet(points, triangleEdge[0]),
          mustGet(points, triangleEdge[1]),
          mustGet(points, boundaryEdge[0]),
          mustGet(points, boundaryEdge[1])
        )
      ) {
        return true;
      }
    }
  }

  return false;
};

const isTriangleAcceptedByMask = (
  points: readonly V6BConstrainautorPoint[],
  triangle: readonly [number, number, number],
  mainMask: readonly boolean[],
  width: number,
  height: number
): boolean => {
  const a = mustGet(points, triangle[0]);
  const b = mustGet(points, triangle[1]);
  const c = mustGet(points, triangle[2]);
  const centroid = {
    x: (a.x + b.x + c.x) / 3,
    y: (a.y + b.y + c.y) / 3
  };
  return isPointInsideMask(mainMask, width, height, centroid);
};

const normalizeLoop = (loop: readonly PixelPoint[]): readonly PixelPoint[] => {
  const withoutDuplicateEnd =
    loop.length > 1 && pointKey(mustGet(loop, 0)) === pointKey(mustGet(loop, loop.length - 1))
      ? loop.slice(0, -1)
      : [...loop];
  const normalized: PixelPoint[] = [];
  for (const point of withoutDuplicateEnd) {
    const previous = normalized.at(-1);
    if (previous === undefined || pointKey(previous) !== pointKey(point)) {
      normalized.push(point);
    }
  }

  return normalized;
};

const rotateLoopToStableStart = (loop: readonly PixelPoint[]): readonly PixelPoint[] => {
  if (loop.length === 0) {
    return [];
  }

  let startIndex = 0;
  for (let index = 1; index < loop.length; index += 1) {
    if (comparePoint(mustGet(loop, index), mustGet(loop, startIndex)) < 0) {
      startIndex = index;
    }
  }

  return [...loop.slice(startIndex), ...loop.slice(0, startIndex)];
};

const ensurePositiveLoopOrientation = (
  loop: readonly PixelPoint[]
): readonly PixelPoint[] => {
  if (polygonSignedArea(loop) >= 0 || loop.length <= 1) {
    return loop;
  }

  const [first, ...rest] = loop;
  if (first === undefined) {
    return [];
  }

  return [first, ...rest.reverse()];
};

const dedupeOrderedPoints = (
  points: readonly PixelPoint[]
): readonly PixelPoint[] => {
  const seen = new Set<string>();
  const deduped: PixelPoint[] = [];
  for (const point of points) {
    const rounded = roundPixelPoint(point);
    const key = pointKey(rounded);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(rounded);
  }

  return deduped;
};

const pointAtPolygonDistance = (
  loop: readonly PixelPoint[],
  targetDistance: number
): PixelPoint => {
  let walked = 0;
  for (let index = 0; index < loop.length; index += 1) {
    const current = mustGet(loop, index);
    const next = mustGet(loop, (index + 1) % loop.length);
    const segmentLength = distance(current, next);
    if (walked + segmentLength >= targetDistance) {
      const ratio = segmentLength <= 0 ? 0 : (targetDistance - walked) / segmentLength;
      return {
        x: current.x + (next.x - current.x) * ratio,
        y: current.y + (next.y - current.y) * ratio
      };
    }

    walked += segmentLength;
  }

  return mustGet(loop, 0);
};

const polygonDistanceAtVertex = (
  loop: readonly PixelPoint[],
  vertexIndex: number
): number => {
  let walked = 0;
  for (let index = 0; index < vertexIndex; index += 1) {
    walked += distance(mustGet(loop, index), mustGet(loop, (index + 1) % loop.length));
  }

  return walked;
};

const polygonPerimeter = (points: readonly PixelPoint[]): number => {
  let perimeter = 0;
  for (let index = 0; index < points.length; index += 1) {
    perimeter += distance(mustGet(points, index), mustGet(points, (index + 1) % points.length));
  }

  return perimeter;
};

const polygonSignedArea = (points: readonly PixelPoint[]): number => {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = mustGet(points, index);
    const next = mustGet(points, (index + 1) % points.length);
    area += current.x * next.y - next.x * current.y;
  }

  return area / 2;
};

const resolveComponentCentroid = (
  component: OpaqueComponent,
  width: number,
  height: number,
  mainMask: readonly boolean[]
): PixelPoint => {
  let xSum = 0;
  let ySum = 0;
  for (const index of component.pixelIndices) {
    xSum += (index % width) + 0.5;
    ySum += Math.floor(index / width) + 0.5;
  }

  const centroid = {
    x: xSum / component.pixelIndices.length,
    y: ySum / component.pixelIndices.length
  };
  if (isPointInsideMask(mainMask, width, height, centroid)) {
    return roundPixelPoint(centroid);
  }

  return selectNearestComponentPixelCenter(component, centroid, width);
};

const selectNearestComponentPixelCenter = (
  component: OpaqueComponent,
  point: PixelPoint,
  width: number
): PixelPoint => {
  const selectedIndex = [...component.pixelIndices].sort((leftIndex, rightIndex) => {
    const left = { x: (leftIndex % width) + 0.5, y: Math.floor(leftIndex / width) + 0.5 };
    const right = { x: (rightIndex % width) + 0.5, y: Math.floor(rightIndex / width) + 0.5 };
    return distance(left, point) - distance(right, point) || comparePoint(left, right);
  })[0];
  if (selectedIndex === undefined) {
    return point;
  }

  return {
    x: (selectedIndex % width) + 0.5,
    y: Math.floor(selectedIndex / width) + 0.5
  };
};

const isPointInsideMask = (
  mask: readonly boolean[],
  width: number,
  height: number,
  point: PixelPoint
): boolean => {
  const x = Math.floor(point.x);
  const y = Math.floor(point.y);
  if (x < 0 || x >= width || y < 0 || y >= height) {
    return false;
  }

  return mask[y * width + x] === true;
};

const hasDuplicateTriangleIndex = (
  triangle: readonly [number, number, number]
): boolean => triangle[0] === triangle[1] || triangle[1] === triangle[2] || triangle[2] === triangle[0];

const triangleAreaByIndex = (
  points: readonly PixelPoint[],
  triangle: readonly [number, number, number]
): number => triangleArea(
  mustGet(points, triangle[0]),
  mustGet(points, triangle[1]),
  mustGet(points, triangle[2])
);

const triangleArea = (a: PixelPoint, b: PixelPoint, c: PixelPoint): number =>
  cross(a, b, c) / 2;

const cross = (a: PixelPoint, b: PixelPoint, c: PixelPoint): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

const segmentsIntersect = (
  a: PixelPoint,
  b: PixelPoint,
  c: PixelPoint,
  d: PixelPoint
): boolean => {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);

  if (
    Math.abs(abC) <= TRIANGLE_AREA_EPSILON &&
    Math.abs(abD) <= TRIANGLE_AREA_EPSILON &&
    Math.abs(cdA) <= TRIANGLE_AREA_EPSILON &&
    Math.abs(cdB) <= TRIANGLE_AREA_EPSILON
  ) {
    return rangesOverlap(a.x, b.x, c.x, d.x) && rangesOverlap(a.y, b.y, c.y, d.y);
  }

  return (
    abC * abD < -TRIANGLE_AREA_EPSILON &&
    cdA * cdB < -TRIANGLE_AREA_EPSILON
  );
};

const rangesOverlap = (
  leftA: number,
  rightA: number,
  leftB: number,
  rightB: number
): boolean =>
  Math.max(Math.min(leftA, rightA), Math.min(leftB, rightB)) <=
  Math.min(Math.max(leftA, rightA), Math.max(leftB, rightB)) + TRIANGLE_AREA_EPSILON;

const isPointOnSegment = (
  point: PixelPoint,
  start: PixelPoint,
  end: PixelPoint
): boolean => {
  if (Math.abs(cross(start, end, point)) > TRIANGLE_AREA_EPSILON) {
    return false;
  }

  return (
    point.x >= Math.min(start.x, end.x) - TRIANGLE_AREA_EPSILON &&
    point.x <= Math.max(start.x, end.x) + TRIANGLE_AREA_EPSILON &&
    point.y >= Math.min(start.y, end.y) - TRIANGLE_AREA_EPSILON &&
    point.y <= Math.max(start.y, end.y) + TRIANGLE_AREA_EPSILON
  );
};

const distanceToClosedPolyline = (
  point: PixelPoint,
  loop: readonly PixelPoint[]
): number => {
  let minDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < loop.length; index += 1) {
    minDistance = Math.min(
      minDistance,
      distanceToSegment(point, mustGet(loop, index), mustGet(loop, (index + 1) % loop.length))
    );
  }

  return Number.isFinite(minDistance) ? minDistance : 0;
};

const distanceToSegment = (
  point: PixelPoint,
  start: PixelPoint,
  end: PixelPoint
): number => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const segmentLengthSquared = dx * dx + dy * dy;
  if (segmentLengthSquared <= 0) {
    return distance(point, start);
  }

  const ratio = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / segmentLengthSquared,
    0,
    1
  );
  return distance(point, {
    x: start.x + dx * ratio,
    y: start.y + dy * ratio
  });
};

const distance = (left: PixelPoint, right: PixelPoint): number =>
  Math.hypot(left.x - right.x, left.y - right.y);

const isOpaqueAt = (
  mask: readonly boolean[],
  width: number,
  height: number,
  x: number,
  y: number
): boolean => x >= 0 && x < width && y >= 0 && y < height && mask[y * width + x] === true;

const getFourNeighbors = (
  x: number,
  y: number,
  width: number,
  height: number
): readonly PixelPoint[] => [
  ...(x > 0 ? [{ x: x - 1, y }] : []),
  ...(x < width - 1 ? [{ x: x + 1, y }] : []),
  ...(y > 0 ? [{ x, y: y - 1 }] : []),
  ...(y < height - 1 ? [{ x, y: y + 1 }] : [])
];

const pixelPointToStagePoint = (
  point: PixelPoint,
  bounds: RectDto,
  textureWidth: number,
  textureHeight: number
): PixelPoint => ({
  x: roundCoordinate(bounds.x + bounds.width * (point.x / textureWidth)),
  y: roundCoordinate(bounds.y + bounds.height * (point.y / textureHeight))
});

const pixelPointToUv = (
  point: PixelPoint,
  textureWidth: number,
  textureHeight: number
): PixelPoint => ({
  x: roundCoordinate(clamp(point.x / textureWidth, 0, 1)),
  y: roundCoordinate(clamp(point.y / textureHeight, 0, 1))
});

const pixelBoundsToStageRect = (
  pixelBounds: PixelBounds,
  textureBounds: RectDto,
  textureWidth: number,
  textureHeight: number
): RectDto => ({
  x: roundCoordinate(textureBounds.x + textureBounds.width * (pixelBounds.left / textureWidth)),
  y: roundCoordinate(textureBounds.y + textureBounds.height * (pixelBounds.top / textureHeight)),
  width: roundCoordinate(textureBounds.width * ((pixelBounds.right - pixelBounds.left) / textureWidth)),
  height: roundCoordinate(textureBounds.height * ((pixelBounds.bottom - pixelBounds.top) / textureHeight))
});

const roundRecoveryPoint = (point: V6BConstrainautorPoint): V6BConstrainautorPoint => ({
  ...point,
  x: roundCoordinate(point.x),
  y: roundCoordinate(point.y)
});

const roundPixelPoint = (point: PixelPoint): PixelPoint => ({
  x: roundCoordinate(point.x),
  y: roundCoordinate(point.y)
});

const roundCoordinate = (value: number): number => {
  const rounded = Math.round(value * POINT_KEY_SCALE) / POINT_KEY_SCALE;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const pointKey = (point: PixelPoint): string =>
  `${roundCoordinate(point.x)}:${roundCoordinate(point.y)}`;

const comparePoint = (left: PixelPoint, right: PixelPoint): number =>
  left.y - right.y || left.x - right.x;

const compareRecoveryPoint = (
  left: V6BConstrainautorPoint,
  right: V6BConstrainautorPoint
): number => {
  const roleDelta = (left.role === "boundary" ? 0 : 1) - (right.role === "boundary" ? 0 : 1);
  if (roleDelta !== 0) {
    return roleDelta;
  }

  if (left.role === "boundary" && right.role === "boundary") {
    return left.stableOrder - right.stableOrder || comparePoint(left, right);
  }

  return comparePoint(left, right) || left.stableOrder - right.stableOrder;
};

const selectLexicographicPoint = (
  points: readonly PixelPoint[]
): PixelPoint =>
  [...points].sort(comparePoint)[0] ?? { x: 0, y: 0 };

const undirectedEdgeKey = (left: number, right: number): string =>
  left < right ? `${left}:${right}` : `${right}:${left}`;

const cellHasAlpha = (
  rgbaBytes: Uint8Array,
  width: number,
  height: number,
  cell: PixelBounds,
  alphaThreshold: number
): boolean => {
  const left = clampInt(cell.left, 0, width);
  const top = clampInt(cell.top, 0, height);
  const right = clampInt(Math.max(cell.right, left + 1), 0, width);
  const bottom = clampInt(Math.max(cell.bottom, top + 1), 0, height);

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      if ((rgbaBytes[(y * width + x) * 4 + 3] ?? 0) > alphaThreshold) {
        return true;
      }
    }
  }

  return false;
};

const countBoundaryVertices = (mesh: MeshDto): number => {
  const edgeCounts = new Map<string, { readonly edge: readonly [number, number]; count: number }>();

  for (const [a, b, c] of mesh.triangles) {
    addCountedEdge(edgeCounts, a, b);
    addCountedEdge(edgeCounts, b, c);
    addCountedEdge(edgeCounts, c, a);
  }

  const boundaryIndices = new Set<number>();
  for (const countedEdge of edgeCounts.values()) {
    if (countedEdge.count !== 1) {
      continue;
    }

    boundaryIndices.add(countedEdge.edge[0]);
    boundaryIndices.add(countedEdge.edge[1]);
  }

  return boundaryIndices.size;
};

const addCountedEdge = (
  edgeCounts: Map<string, { readonly edge: readonly [number, number]; count: number }>,
  left: number,
  right: number
): void => {
  const edge: readonly [number, number] = left < right ? [left, right] : [right, left];
  const key = `${edge[0]}:${edge[1]}`;
  const current = edgeCounts.get(key);
  if (current === undefined) {
    edgeCounts.set(key, { edge, count: 1 });
    return;
  }

  current.count += 1;
};

const gridCellsForDensity = (densityHint: MeshDensityHint): number => {
  switch (densityHint) {
    case "medium":
      return 2;
    case "high":
      return 4;
    case "low":
      return 1;
  }
};

const stripIdPrefix = (id: string, prefix: string): string =>
  id.startsWith(prefix) ? id.slice(prefix.length) : id;

const lerp = (left: number, right: number, ratio: number): number =>
  left + (right - left) * ratio;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Math.trunc(value), min), max);

const mustGet = <T>(items: readonly T[] | ArrayLike<T>, index: number): T => {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`v6b constrainautor mesh generation internal index out of range: ${index}`);
  }

  return item;
};
