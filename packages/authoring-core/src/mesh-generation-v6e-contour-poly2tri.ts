import type { DrawableId, MeshId, ProvenanceId, RectDto, TriangleId } from "@private-2d-rigging-lab/contracts";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";
import * as poly2tri from "poly2tri";

import {
  getV6MeshGenerationCandidate,
  type MeshDensityHint
} from "./mesh-generation-contract.js";
import {
  createV6ContourCandidateInput,
  mapV6ContourPointToStagePoint,
  mapV6ContourPointToUv,
  type V6ContourCandidateInput,
  type V6ContourPipelineResult,
  type V6ContourPoint
} from "./mesh-generation-v6-contour-pipeline.js";
import {
  computeMeshQualityMetrics,
  type MeshGenerationQualityMetrics,
  type MeshGenerationV6ContourPipelineDiagnostics,
  type MeshGenerationV6Metrics,
  type MeshGenerationV6Poly2TriDiagnostics
} from "./mesh-quality-metrics.js";

export interface AutoOutlineV6EContourPoly2TriMeshInput {
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

export type AutoOutlineV6EContourPoly2TriFailureReason =
  | "alpha-empty"
  | "v6-contour-extraction-failed"
  | "v6e-poly2tri-generation-failed"
  | "v6e-poly2tri-polygon-invalid"
  | "v6e-poly2tri-triangulation-threw";

export type AutoOutlineV6EContourPoly2TriMeshResult =
  | {
      readonly status: "generated";
      readonly mesh: MeshDto;
      readonly alphaBounds: RectDto;
      readonly qualityMetrics: MeshGenerationQualityMetrics;
    }
  | {
      readonly status: "blocked";
      readonly reason: AutoOutlineV6EContourPoly2TriFailureReason;
      readonly alphaBounds?: RectDto;
      readonly opaquePixelCount?: number;
      readonly failureMetrics: AutoOutlineV6EContourPoly2TriFailureMetrics;
    };

export interface AutoOutlineV6EContourPoly2TriFailureMetrics {
  readonly contourLoopCount: number;
  readonly holeLikeRegionCount: number;
  readonly boundaryVertexCount: number;
  readonly interiorVertexCount: number;
  readonly removedTriangleCount: number;
  readonly outsideOrCrossingTriangleCount: number;
  readonly multiIslandHandling: MeshGenerationV6Metrics["multiIslandHandling"];
  readonly holeHandling: MeshGenerationV6Metrics["holeHandling"];
  readonly provenance: readonly string[];
  readonly contourPipelineDiagnostics?: MeshGenerationV6ContourPipelineDiagnostics;
  readonly diagnostics: MeshGenerationV6Poly2TriDiagnostics;
}

interface PolygonValidationResult {
  readonly ok: boolean;
  readonly failures: readonly string[];
}

interface SanitizedCandidatePoints {
  readonly boundaryPoints: readonly V6ContourPoint[];
  readonly interiorPoints: readonly V6ContourPoint[];
  readonly validationFailures: readonly string[];
}

interface IndexedPoly2TriPoint extends poly2tri.XY {
  x: number;
  y: number;
  vertexIndex: number;
}

interface Poly2TriTriangulationResult {
  readonly status: "generated" | "blocked";
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly removedTriangleCount: number;
  readonly outsideOrCrossingTriangleCount: number;
  readonly diagnostics: MeshGenerationV6Poly2TriDiagnostics;
}

export interface AutoOutlineV6EContourPoly2TriProbePoint {
  readonly x: number;
  readonly y: number;
}

export interface AutoOutlineV6EContourPoly2TriProbeTriangle {
  readonly getPoints: () => [poly2tri.XY, poly2tri.XY, poly2tri.XY];
}

export interface AutoOutlineV6EContourPoly2TriProbeSweepContext {
  addPoints(points: poly2tri.XY[]): unknown;
  triangulate(): unknown;
  getTriangles(): readonly AutoOutlineV6EContourPoly2TriProbeTriangle[];
}

export type AutoOutlineV6EContourPoly2TriProbeSweepContextFactory = (
  contourPoints: poly2tri.XY[]
) => AutoOutlineV6EContourPoly2TriProbeSweepContext;

export interface AutoOutlineV6EContourPoly2TriProbeResult {
  readonly outputKind: MeshGenerationV6Metrics["outputKind"];
  readonly reason?: AutoOutlineV6EContourPoly2TriFailureReason;
  readonly validationFailures: readonly string[];
  readonly triangleCount: number;
  readonly removedTriangleCount: number;
  readonly outsideOrCrossingTriangleCount: number;
  readonly diagnostics: MeshGenerationV6Poly2TriDiagnostics;
}

export interface AutoOutlineV6EContourPoly2TriSanitizationProbeResult {
  readonly originalBoundaryPointCount: number;
  readonly sanitizedBoundaryPointCount: number;
  readonly removedBoundaryPointCount: number;
  readonly originalInteriorPointCount: number;
  readonly sanitizedInteriorPointCount: number;
  readonly removedInteriorPointCount: number;
  readonly shortestSanitizedEdgeLength: number;
  readonly validationFailures: readonly string[];
  readonly diagnostics: MeshGenerationV6Poly2TriDiagnostics;
}

const TRIANGLE_AREA_EPSILON = 0.000001;
const MIN_BOUNDARY_EDGE_LENGTH = 1.25;

export const createAutoOutlineV6EContourPoly2TriMesh = (
  input: AutoOutlineV6EContourPoly2TriMeshInput
): AutoOutlineV6EContourPoly2TriMeshResult => {
  const density = input.densityHint ?? "medium";
  const contourPipeline = createV6ContourCandidateInput({
    textureSize: input.textureSize,
    meshBounds: input.bounds,
    rgbaBytes: input.rgbaBytes,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
    ...(input.alphaThreshold === undefined ? {} : { alphaThreshold: input.alphaThreshold })
  });

  if (contourPipeline.status === "blocked") {
    return createBlockedResult({
      reason: contourPipeline.reason,
      ...(contourPipeline.alphaBounds === undefined ? {} : { alphaBounds: contourPipeline.alphaBounds.stageBounds }),
      ...(contourPipeline.opaquePixelCount === undefined ? {} : { opaquePixelCount: contourPipeline.opaquePixelCount }),
      contourPipeline,
      diagnostics: createPoly2TriDiagnostics({}),
      provenance: createV6EBlockedProvenance([
        `fallback-${contourPipeline.reason}`
      ])
    });
  }

  const candidateInput = contourPipeline.candidateInput;
  const sanitized = sanitizeCandidatePoints(candidateInput);
  const baseDiagnostics = createPoly2TriDiagnostics({
    outerPointCount: sanitized.boundaryPoints.length,
    holeCount: candidateInput.diagnostics.holeLikeRegionCount,
    steinerPointCount: sanitized.interiorPoints.length,
    mainIslandOnlyFallback: candidateInput.diagnostics.multiIslandHandling === "main-island-only"
  });

  if (candidateInput.diagnostics.holeLikeRegionCount > 0) {
    return createBlockedResult({
      reason: "v6e-poly2tri-polygon-invalid",
      alphaBounds: candidateInput.alphaBounds.stageBounds,
      opaquePixelCount: candidateInput.diagnostics.inputOpaquePixelCount,
      contourPipeline,
      boundaryVertexCount: sanitized.boundaryPoints.length,
      interiorVertexCount: sanitized.interiorPoints.length,
      multiIslandHandling: candidateInput.diagnostics.multiIslandHandling,
      holeHandling: "unsupported-fallback",
      diagnostics: {
        ...baseDiagnostics,
        holeValidationFailed: true
      },
      provenance: createV6EBlockedProvenance([
        "shared-v6-contour-pipeline",
        "limitation-hole-regions-reported",
        "fallback-hole-unsupported"
      ])
    });
  }

  if (sanitized.validationFailures.length > 0) {
    return createBlockedResult({
      reason: "v6e-poly2tri-polygon-invalid",
      alphaBounds: candidateInput.alphaBounds.stageBounds,
      opaquePixelCount: candidateInput.diagnostics.inputOpaquePixelCount,
      contourPipeline,
      boundaryVertexCount: sanitized.boundaryPoints.length,
      interiorVertexCount: sanitized.interiorPoints.length,
      multiIslandHandling: candidateInput.diagnostics.multiIslandHandling,
      holeHandling: candidateInput.diagnostics.holeHandling,
      diagnostics: {
        ...baseDiagnostics,
        polygonValidationFailed: true
      },
      provenance: createV6EBlockedProvenance([
        "shared-v6-contour-pipeline",
        ...sanitized.validationFailures.map((failure) => `polygon-validation-${failure}`),
        "fallback-invalid-outer-polygon"
      ])
    });
  }

  const triangulation = triangulateWithPoly2Tri({
    boundaryPoints: sanitized.boundaryPoints,
    interiorPoints: sanitized.interiorPoints,
    mainMask: candidateInput.mainMask,
    width: candidateInput.textureSize.width,
    height: candidateInput.textureSize.height,
    diagnostics: baseDiagnostics
  });

  if (triangulation.status === "blocked" || triangulation.triangles.length === 0) {
    return createBlockedResult({
      reason: triangulation.diagnostics.triangulationThrown
        ? "v6e-poly2tri-triangulation-threw"
        : "v6e-poly2tri-generation-failed",
      alphaBounds: candidateInput.alphaBounds.stageBounds,
      opaquePixelCount: candidateInput.diagnostics.inputOpaquePixelCount,
      contourPipeline,
      boundaryVertexCount: sanitized.boundaryPoints.length,
      interiorVertexCount: sanitized.interiorPoints.length,
      removedTriangleCount: triangulation.removedTriangleCount,
      outsideOrCrossingTriangleCount: triangulation.outsideOrCrossingTriangleCount,
      multiIslandHandling: candidateInput.diagnostics.multiIslandHandling,
      holeHandling: candidateInput.diagnostics.holeHandling,
      diagnostics: triangulation.diagnostics,
      provenance: createV6EBlockedProvenance([
        "shared-v6-contour-pipeline",
        ...(triangulation.diagnostics.triangulationThrown ? ["poly2tri-triangulation-threw"] : []),
        ...(triangulation.diagnostics.boundaryEdgeMissingCount > 0 ? ["poly2tri-boundary-missing"] : []),
        "fallback-poly2tri-output-invalid"
      ])
    });
  }

  const allPoints = [...sanitized.boundaryPoints, ...sanitized.interiorPoints];
  const token = stripIdPrefix(input.drawableId, "draw_");
  const mesh: MeshDto = {
    meshId: input.meshId,
    drawableId: input.drawableId,
    vertices: allPoints.map((point) =>
      mapV6ContourPointToStagePoint(
        point,
        input.bounds,
        candidateInput.textureSize.width,
        candidateInput.textureSize.height
      )
    ),
    uvs: allPoints.map((point) =>
      mapV6ContourPointToUv(point, candidateInput.textureSize.width, candidateInput.textureSize.height)
    ),
    triangles: triangulation.triangles.map((triangle) => [...triangle] as [number, number, number]),
    vertexStableIds: allPoints.map((_point, index) =>
      index < sanitized.boundaryPoints.length
        ? `vtx_${token}_v6e_boundary_${index}`
        : `vtx_${token}_v6e_steiner_${index - sanitized.boundaryPoints.length}`
    ),
    triangleStableIds: triangulation.triangles.map(
      (_triangle, index) => `tri_${token}_v6e_${index}` as TriangleId
    ),
    topologyRevision: 0,
    bounds: structuredClone(input.bounds),
    generationProvenanceId: input.provenanceId
  };
  const candidate = {
    ...getV6MeshGenerationCandidate("auto-outline-v6e-contour-poly2tri"),
    backendImplementationStatus: "implemented" as const
  };
  const qualityMetrics = computeMeshQualityMetrics(mesh, {
    refinementIterationCount: 0,
    triangulationMode: "v6e-contour-poly2tri-constrained-polygon",
    v6Metrics: {
      algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
      methodId: candidate.methodId,
      backendId: candidate.backendId,
      backendImplementationStatus: candidate.backendImplementationStatus,
      requestedSourceId: candidate.sourceId,
      actualSourceId: candidate.sourceId,
      outputKind: "backend-output",
      preset: density,
      fallbackSteps: [],
      vertexCount: mesh.vertices.length,
      triangleCount: mesh.triangles.length,
      boundaryVertexCount: sanitized.boundaryPoints.length,
      interiorVertexCount: sanitized.interiorPoints.length,
      alphaBoundsAvailable: true,
      opaquePixelCount: candidateInput.diagnostics.inputOpaquePixelCount,
      contourLoopCount: candidateInput.diagnostics.contourLoopCount,
      holeLikeRegionCount: candidateInput.diagnostics.holeLikeRegionCount,
      removedTriangleCount: triangulation.removedTriangleCount,
      outsideOrCrossingTriangleCount: triangulation.outsideOrCrossingTriangleCount,
      multiIslandHandling: candidateInput.diagnostics.multiIslandHandling,
      holeHandling: candidateInput.diagnostics.holeHandling,
      provenance: createV6EBackendOutputProvenance(candidateInput),
      contourPipelineDiagnostics: createGeneratedContourPipelineDiagnostics(candidateInput),
      poly2triDiagnostics: triangulation.diagnostics
    }
  });

  return {
    status: "generated",
    mesh,
    alphaBounds: candidateInput.alphaBounds.stageBounds,
    qualityMetrics
  };
};

export const probeAutoOutlineV6EContourPoly2TriFailureForTest = (input: {
  readonly boundaryPoints: readonly AutoOutlineV6EContourPoly2TriProbePoint[];
  readonly interiorPoints?: readonly AutoOutlineV6EContourPoly2TriProbePoint[];
  readonly mainMask?: readonly boolean[];
  readonly width?: number;
  readonly height?: number;
  readonly createSweepContext?: AutoOutlineV6EContourPoly2TriProbeSweepContextFactory;
}): AutoOutlineV6EContourPoly2TriProbeResult => {
  const boundaryPoints = sanitizePolygonLoop(input.boundaryPoints.map(copyProbePoint));
  const width = input.width ?? 16;
  const height = input.height ?? 16;
  const mainMask = input.mainMask ?? Array.from({ length: width * height }, () => true);
  const interiorPoints = sanitizeInteriorPoints({
    interiorPoints: (input.interiorPoints ?? []).map(copyProbePoint),
    boundaryPoints,
    mainMask,
    width,
    height
  });
  const validation = validateSimplePolygon(boundaryPoints);
  const diagnostics = createPoly2TriDiagnostics({
    outerPointCount: boundaryPoints.length,
    steinerPointCount: interiorPoints.length
  });

  if (!validation.ok) {
    return {
      outputKind: "blocked",
      reason: "v6e-poly2tri-polygon-invalid",
      validationFailures: validation.failures,
      triangleCount: 0,
      removedTriangleCount: 0,
      outsideOrCrossingTriangleCount: 0,
      diagnostics: {
        ...diagnostics,
        polygonValidationFailed: true
      }
    };
  }

  const triangulation = triangulateWithPoly2Tri({
    boundaryPoints,
    interiorPoints,
    mainMask,
    width,
    height,
    diagnostics,
    ...(input.createSweepContext === undefined
      ? {}
      : { createSweepContext: input.createSweepContext })
  });
  const reason =
    triangulation.status === "generated"
      ? undefined
      : triangulation.diagnostics.triangulationThrown
        ? "v6e-poly2tri-triangulation-threw"
        : "v6e-poly2tri-generation-failed";

  return {
    outputKind: triangulation.status === "generated" ? "backend-output" : "blocked",
    ...(reason === undefined ? {} : { reason }),
    validationFailures: validation.failures,
    triangleCount: triangulation.triangles.length,
    removedTriangleCount: triangulation.removedTriangleCount,
    outsideOrCrossingTriangleCount: triangulation.outsideOrCrossingTriangleCount,
    diagnostics: triangulation.diagnostics
  };
};

export const probeAutoOutlineV6EContourPoly2TriSanitizationForTest = (input: {
  readonly boundaryPoints: readonly AutoOutlineV6EContourPoly2TriProbePoint[];
  readonly interiorPoints?: readonly AutoOutlineV6EContourPoly2TriProbePoint[];
  readonly mainMask?: readonly boolean[];
  readonly width?: number;
  readonly height?: number;
}): AutoOutlineV6EContourPoly2TriSanitizationProbeResult => {
  const width = input.width ?? 16;
  const height = input.height ?? 16;
  const mainMask = input.mainMask ?? Array.from({ length: width * height }, () => true);
  const boundaryPoints = sanitizePolygonLoop(input.boundaryPoints.map(copyProbePoint));
  const interiorPoints = sanitizeInteriorPoints({
    interiorPoints: (input.interiorPoints ?? []).map(copyProbePoint),
    boundaryPoints,
    mainMask,
    width,
    height
  });
  const validation = validateSimplePolygon(boundaryPoints);

  return {
    originalBoundaryPointCount: input.boundaryPoints.length,
    sanitizedBoundaryPointCount: boundaryPoints.length,
    removedBoundaryPointCount: input.boundaryPoints.length - boundaryPoints.length,
    originalInteriorPointCount: input.interiorPoints?.length ?? 0,
    sanitizedInteriorPointCount: interiorPoints.length,
    removedInteriorPointCount: (input.interiorPoints?.length ?? 0) - interiorPoints.length,
    shortestSanitizedEdgeLength: shortestClosedEdgeLength(boundaryPoints),
    validationFailures: validation.failures,
    diagnostics: createPoly2TriDiagnostics({
      outerPointCount: boundaryPoints.length,
      steinerPointCount: interiorPoints.length,
      polygonValidationFailed: !validation.ok
    })
  };
};

const sanitizeCandidatePoints = (
  candidateInput: V6ContourCandidateInput
): SanitizedCandidatePoints => {
  const boundaryPoints = sanitizePolygonLoop(candidateInput.boundaryPoints);
  const interiorPoints = sanitizeInteriorPoints({
    interiorPoints: candidateInput.interiorPoints,
    boundaryPoints,
    mainMask: candidateInput.mainMask,
    width: candidateInput.textureSize.width,
    height: candidateInput.textureSize.height
  });
  const validation = validateSimplePolygon(boundaryPoints);

  return {
    boundaryPoints,
    interiorPoints,
    validationFailures: validation.failures
  };
};

const sanitizePolygonLoop = (
  loop: readonly V6ContourPoint[]
): readonly V6ContourPoint[] => {
  let sanitized = dedupeOrderedPoints(loop.map(roundPoint));
  let previousLength = -1;
  let guard = 0;
  while (sanitized.length !== previousLength && guard < 8) {
    guard += 1;
    previousLength = sanitized.length;
    sanitized = dedupeOrderedPoints(removeCollinearPoints(removeShortEdges(sanitized, MIN_BOUNDARY_EDGE_LENGTH)));
  }

  if (sanitized.length <= 1 || polygonSignedArea(sanitized) >= 0) {
    return sanitized;
  }

  const [first, ...rest] = sanitized;
  return first === undefined ? [] : [first, ...rest.reverse()];
};

const sanitizeInteriorPoints = (input: {
  readonly interiorPoints: readonly V6ContourPoint[];
  readonly boundaryPoints: readonly V6ContourPoint[];
  readonly mainMask: readonly boolean[];
  readonly width: number;
  readonly height: number;
}): readonly V6ContourPoint[] => {
  const usedKeys = new Set(input.boundaryPoints.map(pointKey));
  const points: V6ContourPoint[] = [];

  for (const point of input.interiorPoints) {
    const rounded = roundPoint(point);
    const key = pointKey(rounded);
    if (
      usedKeys.has(key) ||
      !isPointInsideMask(input.mainMask, input.width, input.height, rounded) ||
      !isPointInsidePolygon(rounded, input.boundaryPoints) ||
      isPointOnPolygonBoundary(rounded, input.boundaryPoints)
    ) {
      continue;
    }

    usedKeys.add(key);
    points.push(rounded);
  }

  return points.sort(comparePoint);
};

const validateSimplePolygon = (
  points: readonly V6ContourPoint[]
): PolygonValidationResult => {
  const failures: string[] = [];
  if (points.length < 3) {
    failures.push("too-few-points");
  }

  if (Math.abs(polygonSignedArea(points)) <= TRIANGLE_AREA_EPSILON) {
    failures.push("zero-area");
  }

  for (let index = 0; index < points.length; index += 1) {
    if (distance(mustGet(points, index), mustGet(points, (index + 1) % points.length)) <= TRIANGLE_AREA_EPSILON) {
      failures.push("zero-length-edge");
      break;
    }
  }

  const seen = new Set<string>();
  for (const point of points) {
    const key = pointKey(point);
    if (seen.has(key)) {
      failures.push("duplicate-point");
      break;
    }

    seen.add(key);
  }

  if (hasSelfIntersection(points)) {
    failures.push("self-intersection");
  }

  return {
    ok: failures.length === 0,
    failures
  };
};

const triangulateWithPoly2Tri = (input: {
  readonly boundaryPoints: readonly V6ContourPoint[];
  readonly interiorPoints: readonly V6ContourPoint[];
  readonly mainMask: readonly boolean[];
  readonly width: number;
  readonly height: number;
  readonly diagnostics: MeshGenerationV6Poly2TriDiagnostics;
  readonly createSweepContext?: AutoOutlineV6EContourPoly2TriProbeSweepContextFactory;
}): Poly2TriTriangulationResult => {
  const allPoints = [...input.boundaryPoints, ...input.interiorPoints];
  const contourPoints = input.boundaryPoints.map((point, index) => createIndexedPoly2TriPoint(point, index));
  const steinerPoints = input.interiorPoints.map((point, index) =>
    createIndexedPoly2TriPoint(point, input.boundaryPoints.length + index)
  );
  const pointIndexByKey = new Map<string, number>();
  for (const point of [...contourPoints, ...steinerPoints]) {
    pointIndexByKey.set(pointKey(point), point.vertexIndex);
  }

  let triangles: [number, number, number][];
  try {
    const sweepContext = (input.createSweepContext ?? createPoly2TriSweepContext)(contourPoints);
    sweepContext.addPoints(steinerPoints);
    sweepContext.triangulate();
    triangles = sweepContext.getTriangles().flatMap((triangle) => {
      const indexes = triangle.getPoints().map((point) =>
        resolvePoly2TriPointIndex(point, pointIndexByKey)
      );
      if (indexes.some((index) => index === undefined)) {
        return [];
      }

      const [a, b, c] = indexes as [number, number, number];
      return [normalizeTriangleOrientation([a, b, c], allPoints)];
    });
  } catch {
    return {
      status: "blocked",
      triangles: [],
      removedTriangleCount: 0,
      outsideOrCrossingTriangleCount: 0,
      diagnostics: {
        ...input.diagnostics,
        triangulationThrown: true
      }
    };
  }

  const filteredTriangles: [number, number, number][] = [];
  const seenTriangles = new Set<string>();
  let removedTriangleCount = 0;
  let outsideOrCrossingTriangleCount = 0;

  for (const triangle of triangles) {
    const key = triangleKey(triangle);
    if (
      seenTriangles.has(key) ||
      hasDuplicateTriangleIndex(triangle) ||
      Math.abs(triangleAreaByIndex(allPoints, triangle)) <= TRIANGLE_AREA_EPSILON
    ) {
      removedTriangleCount += 1;
      continue;
    }

    if (
      !isTriangleAcceptedByMask({
        allPoints,
        boundaryPoints: input.boundaryPoints,
        triangle,
        mainMask: input.mainMask,
        width: input.width,
        height: input.height
      })
    ) {
      removedTriangleCount += 1;
      outsideOrCrossingTriangleCount += 1;
      continue;
    }

    seenTriangles.add(key);
    filteredTriangles.push(triangle);
  }

  const sortedTriangles = filteredTriangles.sort(compareTriangle);
  const boundaryCounts = countPreservedBoundaryEdges(input.boundaryPoints.length, sortedTriangles);
  const diagnostics = {
    ...input.diagnostics,
    boundaryEdgePreservedCount: boundaryCounts.preserved,
    boundaryEdgeMissingCount: boundaryCounts.missing
  };

  return {
    status: diagnostics.boundaryEdgeMissingCount > 0 || sortedTriangles.length === 0 ? "blocked" : "generated",
    triangles: sortedTriangles,
    removedTriangleCount,
    outsideOrCrossingTriangleCount,
    diagnostics
  };
};

const createPoly2TriSweepContext: AutoOutlineV6EContourPoly2TriProbeSweepContextFactory = (
  contourPoints
): AutoOutlineV6EContourPoly2TriProbeSweepContext =>
  new poly2tri.SweepContext([...contourPoints], { cloneArrays: true });

const createIndexedPoly2TriPoint = (
  point: V6ContourPoint,
  vertexIndex: number
): IndexedPoly2TriPoint => ({
  x: point.x,
  y: point.y,
  vertexIndex
});

const resolvePoly2TriPointIndex = (
  point: poly2tri.XY,
  pointIndexByKey: ReadonlyMap<string, number>
): number | undefined => {
  const maybeIndexed = point as Partial<IndexedPoly2TriPoint>;
  if (maybeIndexed.vertexIndex !== undefined) {
    return maybeIndexed.vertexIndex;
  }

  return pointIndexByKey.get(pointKey(point));
};

const countPreservedBoundaryEdges = (
  boundaryPointCount: number,
  triangles: readonly (readonly [number, number, number])[]
): { readonly preserved: number; readonly missing: number } => {
  const triangleEdges = new Set<string>();
  for (const [a, b, c] of triangles) {
    triangleEdges.add(edgeKey(a, b));
    triangleEdges.add(edgeKey(b, c));
    triangleEdges.add(edgeKey(c, a));
  }

  let preserved = 0;
  let missing = 0;
  for (let index = 0; index < boundaryPointCount; index += 1) {
    if (triangleEdges.has(edgeKey(index, (index + 1) % boundaryPointCount))) {
      preserved += 1;
      continue;
    }

    missing += 1;
  }

  return { preserved, missing };
};

const createBlockedResult = (input: {
  readonly reason: AutoOutlineV6EContourPoly2TriFailureReason;
  readonly alphaBounds?: RectDto;
  readonly opaquePixelCount?: number;
  readonly contourPipeline?: V6ContourPipelineResult;
  readonly contourLoopCount?: number;
  readonly holeLikeRegionCount?: number;
  readonly boundaryVertexCount?: number;
  readonly interiorVertexCount?: number;
  readonly removedTriangleCount?: number;
  readonly outsideOrCrossingTriangleCount?: number;
  readonly multiIslandHandling?: MeshGenerationV6Metrics["multiIslandHandling"];
  readonly holeHandling?: MeshGenerationV6Metrics["holeHandling"];
  readonly diagnostics: MeshGenerationV6Poly2TriDiagnostics;
  readonly provenance: readonly string[];
}): AutoOutlineV6EContourPoly2TriMeshResult => {
  const generatedCandidate =
    input.contourPipeline?.status === "generated" ? input.contourPipeline.candidateInput : undefined;
  return {
    status: "blocked",
    reason: input.reason,
    ...(input.alphaBounds === undefined ? {} : { alphaBounds: input.alphaBounds }),
    ...(input.opaquePixelCount === undefined ? {} : { opaquePixelCount: input.opaquePixelCount }),
    failureMetrics: {
      contourLoopCount: input.contourLoopCount ?? generatedCandidate?.diagnostics.contourLoopCount ?? 0,
      holeLikeRegionCount: input.holeLikeRegionCount ?? generatedCandidate?.diagnostics.holeLikeRegionCount ?? 0,
      boundaryVertexCount: input.boundaryVertexCount ?? 0,
      interiorVertexCount: input.interiorVertexCount ?? 0,
      removedTriangleCount: input.removedTriangleCount ?? 0,
      outsideOrCrossingTriangleCount: input.outsideOrCrossingTriangleCount ?? 0,
      multiIslandHandling: input.multiIslandHandling ?? generatedCandidate?.diagnostics.multiIslandHandling ?? "not-evaluated",
      holeHandling: input.holeHandling ?? generatedCandidate?.diagnostics.holeHandling ?? "not-evaluated",
      provenance: input.provenance,
      ...(input.contourPipeline === undefined
        ? {}
        : { contourPipelineDiagnostics: createContourPipelineDiagnostics(input.contourPipeline, input.reason) }),
      diagnostics: input.diagnostics
    }
  };
};

const createPoly2TriDiagnostics = (
  input: Partial<Omit<MeshGenerationV6Poly2TriDiagnostics, "dependencyGateStatus">>
): MeshGenerationV6Poly2TriDiagnostics => ({
  dependencyGateStatus: "available",
  outerPointCount: input.outerPointCount ?? 0,
  holeCount: input.holeCount ?? 0,
  steinerPointCount: input.steinerPointCount ?? 0,
  polygonValidationFailed: input.polygonValidationFailed ?? false,
  holeValidationFailed: input.holeValidationFailed ?? false,
  triangulationThrown: input.triangulationThrown ?? false,
  boundaryEdgePreservedCount: input.boundaryEdgePreservedCount ?? 0,
  boundaryEdgeMissingCount: input.boundaryEdgeMissingCount ?? 0,
  mainIslandOnlyFallback: input.mainIslandOnlyFallback ?? false
});

const createV6EBackendOutputProvenance = (
  candidateInput: V6ContourCandidateInput
): readonly string[] => [
  "shared-v6-contour-pipeline",
  "v6e-poly2tri-quantized-deduped-points",
  "v6e-poly2tri-normalized-winding",
  "v6e-poly2tri-steiner-points",
  "v6e-poly2tri-constrained-polygon-triangulation",
  "v6e-poly2tri-boundary-preserved",
  ...(candidateInput.diagnostics.multiIslandHandling === "main-island-only"
    ? ["limitation-main-island-only"]
    : [])
];

const createV6EBlockedProvenance = (
  entries: readonly string[]
): readonly string[] => [
  "v6e-contour-poly2tri",
  ...entries
];

const createGeneratedContourPipelineDiagnostics = (
  candidateInput: V6ContourCandidateInput
): MeshGenerationV6ContourPipelineDiagnostics => ({
  status: "generated",
  inputOpaquePixelCount: candidateInput.diagnostics.inputOpaquePixelCount,
  softMaskOpaquePixelCount: candidateInput.diagnostics.softMaskOpaquePixelCount,
  selectedComponentPixelCount: candidateInput.diagnostics.selectedComponentPixelCount,
  boundaryPointCount: candidateInput.diagnostics.boundaryPointCount,
  constraintEdgeCount: candidateInput.diagnostics.constraintEdgeCount,
  steinerPointCount: candidateInput.diagnostics.interiorPointCount,
  alphaBoundsAvailable: true
});

const createContourPipelineDiagnostics = (
  contourPipeline: V6ContourPipelineResult,
  blockedReason: AutoOutlineV6EContourPoly2TriFailureReason
): MeshGenerationV6ContourPipelineDiagnostics => {
  if (contourPipeline.status === "generated") {
    return createGeneratedContourPipelineDiagnostics(contourPipeline.candidateInput);
  }

  return {
    status: "blocked",
    inputOpaquePixelCount:
      contourPipeline.opaquePixelCount ?? contourPipeline.diagnostics?.inputOpaquePixelCount ?? 0,
    softMaskOpaquePixelCount: contourPipeline.diagnostics?.softMaskOpaquePixelCount ?? 0,
    selectedComponentPixelCount: contourPipeline.diagnostics?.selectedComponentPixelCount ?? 0,
    boundaryPointCount: contourPipeline.diagnostics?.boundaryPointCount ?? 0,
    constraintEdgeCount: contourPipeline.diagnostics?.constraintEdgeCount ?? 0,
    steinerPointCount: contourPipeline.diagnostics?.interiorPointCount ?? 0,
    alphaBoundsAvailable: contourPipeline.alphaBounds !== undefined,
    blockedReason
  };
};

const copyProbePoint = (
  point: AutoOutlineV6EContourPoly2TriProbePoint
): V6ContourPoint => ({
  x: point.x,
  y: point.y
});

const removeShortEdges = (
  points: readonly V6ContourPoint[],
  minLength: number
): readonly V6ContourPoint[] => {
  if (points.length < 4) {
    return points;
  }

  const result: V6ContourPoint[] = [];
  for (const point of points) {
    const previous = result.at(-1);
    if (previous !== undefined && distance(previous, point) < minLength) {
      continue;
    }

    result.push(point);
  }

  const first = result[0];
  const last = result.at(-1);
  if (first !== undefined && last !== undefined && result.length > 3 && distance(first, last) < minLength) {
    result.pop();
  }

  return result.length >= 3 ? result : points;
};

const removeCollinearPoints = (
  points: readonly V6ContourPoint[]
): readonly V6ContourPoint[] => {
  const deduped = dedupeOrderedPoints(points);
  if (deduped.length < 4) {
    return deduped;
  }

  const result: V6ContourPoint[] = [];
  for (let index = 0; index < deduped.length; index += 1) {
    const previous = mustGet(deduped, (index - 1 + deduped.length) % deduped.length);
    const current = mustGet(deduped, index);
    const next = mustGet(deduped, (index + 1) % deduped.length);
    if (Math.abs(cross(previous, current, next)) <= TRIANGLE_AREA_EPSILON) {
      continue;
    }

    result.push(current);
  }

  return result.length >= 3 ? result : deduped;
};

const dedupeOrderedPoints = (
  points: readonly V6ContourPoint[]
): readonly V6ContourPoint[] => {
  const seen = new Set<string>();
  const deduped: V6ContourPoint[] = [];
  for (const point of points) {
    const key = pointKey(point);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(point);
  }

  return deduped;
};

const hasSelfIntersection = (
  points: readonly V6ContourPoint[]
): boolean => {
  if (points.length < 4) {
    return false;
  }

  for (let leftIndex = 0; leftIndex < points.length; leftIndex += 1) {
    const leftStart = mustGet(points, leftIndex);
    const leftEnd = mustGet(points, (leftIndex + 1) % points.length);
    for (let rightIndex = leftIndex + 1; rightIndex < points.length; rightIndex += 1) {
      if (
        rightIndex === leftIndex ||
        rightIndex === (leftIndex + 1) % points.length ||
        leftIndex === (rightIndex + 1) % points.length
      ) {
        continue;
      }

      const rightStart = mustGet(points, rightIndex);
      const rightEnd = mustGet(points, (rightIndex + 1) % points.length);
      if (segmentsIntersect(leftStart, leftEnd, rightStart, rightEnd)) {
        return true;
      }
    }
  }

  return false;
};

const segmentsIntersect = (
  a: V6ContourPoint,
  b: V6ContourPoint,
  c: V6ContourPoint,
  d: V6ContourPoint
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

  return abC * abD < 0 && cdA * cdB < 0;
};

const isTriangleAcceptedByMask = (input: {
  readonly allPoints: readonly V6ContourPoint[];
  readonly boundaryPoints: readonly V6ContourPoint[];
  readonly triangle: readonly [number, number, number];
  readonly mainMask: readonly boolean[];
  readonly width: number;
  readonly height: number;
}): boolean => {
  const a = mustGet(input.allPoints, input.triangle[0]);
  const b = mustGet(input.allPoints, input.triangle[1]);
  const c = mustGet(input.allPoints, input.triangle[2]);
  const centroid = {
    x: (a.x + b.x + c.x) / 3,
    y: (a.y + b.y + c.y) / 3
  };
  const samples = [
    centroid,
    midpoint(a, b),
    midpoint(b, c),
    midpoint(c, a),
    midpoint(a, centroid),
    midpoint(b, centroid),
    midpoint(c, centroid)
  ];

  return samples.every((sample) =>
    isPointInsideMask(input.mainMask, input.width, input.height, sample) ||
    isPointInsidePolygon(sample, input.boundaryPoints)
  );
};

const isPointInsideMask = (
  mask: readonly boolean[],
  width: number,
  height: number,
  point: V6ContourPoint
): boolean => {
  const x = Math.floor(point.x);
  const y = Math.floor(point.y);
  if (x < 0 || x >= width || y < 0 || y >= height || y * width + x >= mask.length) {
    return false;
  }

  return mask[y * width + x] === true;
};

const isPointInsidePolygon = (
  point: V6ContourPoint,
  polygon: readonly V6ContourPoint[]
): boolean => {
  if (isPointOnPolygonBoundary(point, polygon)) {
    return true;
  }

  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = mustGet(polygon, index);
    const previous = mustGet(polygon, previousIndex);
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

const isPointOnPolygonBoundary = (
  point: V6ContourPoint,
  polygon: readonly V6ContourPoint[]
): boolean =>
  polygon.some((start, index) =>
    isPointOnSegment(point, start, mustGet(polygon, (index + 1) % polygon.length))
  );

const isPointOnSegment = (
  point: V6ContourPoint,
  start: V6ContourPoint,
  end: V6ContourPoint
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

const normalizeTriangleOrientation = (
  triangle: readonly [number, number, number],
  points: readonly V6ContourPoint[]
): [number, number, number] =>
  triangleAreaByIndex(points, triangle) >= 0
    ? [triangle[0], triangle[1], triangle[2]]
    : [triangle[0], triangle[2], triangle[1]];

const compareTriangle = (
  left: readonly [number, number, number],
  right: readonly [number, number, number]
): number => triangleKey(left).localeCompare(triangleKey(right));

const triangleKey = (
  triangle: readonly [number, number, number]
): string => [...triangle].sort((left, right) => left - right).join(":");

const edgeKey = (left: number, right: number): string =>
  left < right ? `${left}:${right}` : `${right}:${left}`;

const hasDuplicateTriangleIndex = (
  triangle: readonly [number, number, number]
): boolean => triangle[0] === triangle[1] || triangle[1] === triangle[2] || triangle[2] === triangle[0];

const triangleAreaByIndex = (
  points: readonly V6ContourPoint[],
  triangle: readonly [number, number, number]
): number => {
  const a = mustGet(points, triangle[0]);
  const b = mustGet(points, triangle[1]);
  const c = mustGet(points, triangle[2]);
  return cross(a, b, c) / 2;
};

const shortestClosedEdgeLength = (
  points: readonly V6ContourPoint[]
): number => {
  if (points.length < 2) {
    return 0;
  }

  let shortest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length; index += 1) {
    shortest = Math.min(shortest, distance(mustGet(points, index), mustGet(points, (index + 1) % points.length)));
  }

  return Number.isFinite(shortest) ? roundMetric(shortest) : 0;
};

const polygonSignedArea = (
  points: readonly V6ContourPoint[]
): number => {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = mustGet(points, index);
    const next = mustGet(points, (index + 1) % points.length);
    area += current.x * next.y - next.x * current.y;
  }

  return area / 2;
};

const midpoint = (
  left: V6ContourPoint,
  right: V6ContourPoint
): V6ContourPoint => ({
  x: (left.x + right.x) / 2,
  y: (left.y + right.y) / 2
});

const distance = (
  left: V6ContourPoint,
  right: V6ContourPoint
): number => Math.hypot(left.x - right.x, left.y - right.y);

const cross = (
  a: V6ContourPoint,
  b: V6ContourPoint,
  c: V6ContourPoint
): number => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

const rangesOverlap = (
  a: number,
  b: number,
  c: number,
  d: number
): boolean => Math.max(Math.min(a, b), Math.min(c, d)) <= Math.min(Math.max(a, b), Math.max(c, d));

const roundPoint = (
  point: V6ContourPoint
): V6ContourPoint => ({
  x: roundMetric(point.x),
  y: roundMetric(point.y)
});

const roundMetric = (value: number): number => {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const pointKey = (point: V6ContourPoint): string =>
  `${roundMetric(point.x)}:${roundMetric(point.y)}`;

const comparePoint = (
  left: V6ContourPoint,
  right: V6ContourPoint
): number => left.y - right.y || left.x - right.x;

const stripIdPrefix = (id: string, prefix: string): string =>
  id.startsWith(prefix) ? id.slice(prefix.length) : id;

const mustGet = <T>(items: readonly T[], index: number): T => {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`v6e poly2tri mesh generation internal index out of range: ${index}`);
  }

  return item;
};
