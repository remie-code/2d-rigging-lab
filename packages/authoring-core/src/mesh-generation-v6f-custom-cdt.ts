import type { DrawableId, MeshId, ProvenanceId, RectDto, TriangleId } from "@private-2d-rigging-lab/contracts";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";

import {
  getV6MeshGenerationCandidate,
  type MeshDensityHint,
  type MeshGenerationFallbackReason
} from "./mesh-generation-contract.js";
import {
  createV6ContourCandidateInput,
  mapV6ContourPointToStagePoint,
  mapV6ContourPointToUv,
  type V6ContourCandidateInput,
  type V6ContourConstraintEdge,
  type V6ContourPipelineResult,
  type V6ContourPoint
} from "./mesh-generation-v6-contour-pipeline.js";
import {
  computeMeshQualityMetrics,
  type MeshGenerationQualityMetrics,
  type MeshGenerationV6ContourPipelineDiagnostics,
  type MeshGenerationV6CustomCdtDiagnostics,
  type MeshGenerationV6Metrics
} from "./mesh-quality-metrics.js";

export interface AutoOutlineV6FCustomCdtMeshInput {
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

export type AutoOutlineV6FCustomCdtFailureReason =
  | "alpha-empty"
  | "v6-contour-extraction-failed"
  | "v6f-custom-cdt-generation-failed"
  | "v6f-custom-cdt-constraint-recovery-failed"
  | "v6f-custom-cdt-local-improvement-rejected";

export type AutoOutlineV6FCustomCdtMeshResult =
  | {
      readonly status: "generated";
      readonly mesh: MeshDto;
      readonly alphaBounds: RectDto;
      readonly qualityMetrics: MeshGenerationQualityMetrics;
    }
  | {
      readonly status: "blocked";
      readonly reason: AutoOutlineV6FCustomCdtFailureReason;
      readonly alphaBounds?: RectDto;
      readonly opaquePixelCount?: number;
      readonly failureMetrics: AutoOutlineV6FCustomCdtFailureMetrics;
    };

export interface AutoOutlineV6FCustomCdtFailureMetrics {
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
  readonly diagnostics: MeshGenerationV6CustomCdtDiagnostics;
}

interface V6FPoint extends V6ContourPoint {
  readonly role: "boundary" | "interior";
  readonly stableOrder: number;
}

interface V6FEdge {
  readonly left: number;
  readonly right: number;
  readonly key: string;
  readonly length: number;
  readonly longBoundarySpoke: boolean;
  readonly score: number;
}

interface V6FTriangulationMetrics {
  readonly edgeFlipCount: number;
  readonly constraintRecoveryOperationCount: number;
  readonly longSpokeCandidateCount: number;
  readonly rejectedLocalImprovementCount: number;
  readonly removedTriangleCount: number;
  readonly outsideOrCrossingTriangleCount: number;
  readonly preservedConstraintEdgeCount: number;
  readonly missingConstraintEdgeCount: number;
}

type V6FTriangulationResult =
  | {
      readonly status: "generated";
      readonly points: readonly V6FPoint[];
      readonly triangles: readonly (readonly [number, number, number])[];
      readonly metrics: V6FTriangulationMetrics;
    }
  | {
      readonly status: "failed";
      readonly reason: AutoOutlineV6FCustomCdtFailureReason;
      readonly points: readonly V6FPoint[];
      readonly triangles: readonly (readonly [number, number, number])[];
      readonly metrics: V6FTriangulationMetrics;
      readonly provenanceDetails: readonly string[];
    };

interface EdgeFlipResult {
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly edgeFlipCount: number;
  readonly rejectedLocalImprovementCount: number;
}

const TRIANGLE_AREA_EPSILON = 0.000001;
const POINT_KEY_SCALE = 1_000_000;

export const createAutoOutlineV6FCustomCdtMesh = (
  input: AutoOutlineV6FCustomCdtMeshInput
): AutoOutlineV6FCustomCdtMeshResult => {
  const contourPipeline = createV6ContourCandidateInput({
    textureSize: input.textureSize,
    meshBounds: input.bounds,
    rgbaBytes: input.rgbaBytes,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
    ...(input.alphaThreshold === undefined ? {} : { alphaThreshold: input.alphaThreshold })
  });

  if (contourPipeline.status === "blocked") {
    const reason =
      contourPipeline.reason === "alpha-empty"
        ? "alpha-empty"
        : "v6-contour-extraction-failed";
    return {
      status: "blocked",
      reason,
      ...(contourPipeline.alphaBounds === undefined
        ? {}
        : { alphaBounds: contourPipeline.alphaBounds.stageBounds }),
      ...(contourPipeline.opaquePixelCount === undefined
        ? {}
        : { opaquePixelCount: contourPipeline.opaquePixelCount }),
      failureMetrics: createBlockedFailureMetrics({
        reason,
        contourPipeline,
        provenance: ["shared-v6-contour-pipeline", `fallback-${reason}`]
      })
    };
  }

  const candidateInput = contourPipeline.candidateInput;
  const triangulation = triangulateV6FContourCandidate(candidateInput);
  if (triangulation.status === "failed") {
    return {
      status: "blocked",
      reason: triangulation.reason,
      alphaBounds: candidateInput.alphaBounds.stageBounds,
      opaquePixelCount: candidateInput.diagnostics.inputOpaquePixelCount,
      failureMetrics: createBlockedFailureMetrics({
        reason: triangulation.reason,
        contourPipeline,
        triangulation,
        provenance: createV6FFallbackProvenance(triangulation.reason, triangulation.provenanceDetails)
      })
    };
  }

  const token = stripIdPrefix(input.drawableId, "draw_");
  const mesh: MeshDto = {
    meshId: input.meshId,
    drawableId: input.drawableId,
    vertices: triangulation.points.map((point) =>
      mapV6ContourPointToStagePoint(point, input.bounds, candidateInput.textureSize.width, candidateInput.textureSize.height)
    ),
    uvs: triangulation.points.map((point) =>
      mapV6ContourPointToUv(point, candidateInput.textureSize.width, candidateInput.textureSize.height)
    ),
    triangles: triangulation.triangles.map((triangle) => [...triangle] as [number, number, number]),
    vertexStableIds: triangulation.points.map((point, index) =>
      point.role === "boundary"
        ? `vtx_${token}_v6f_boundary_${point.stableOrder}`
        : `vtx_${token}_v6f_steiner_${point.stableOrder}_${index}`
    ),
    triangleStableIds: triangulation.triangles.map(
      (_triangle, index) => `tri_${token}_v6f_${index}` as TriangleId
    ),
    topologyRevision: 0,
    bounds: structuredClone(input.bounds),
    generationProvenanceId: input.provenanceId
  };

  const candidate = getV6MeshGenerationCandidate("auto-outline-v6f-contour-custom-cdt");
  const boundaryVertexCount = triangulation.points.filter((point) => point.role === "boundary").length;
  const qualityMetrics = computeMeshQualityMetrics(mesh, {
    refinementIterationCount: triangulation.metrics.edgeFlipCount,
    triangulationMode: "v6f-contour-custom-cdt",
    v6Metrics: {
      algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
      methodId: candidate.methodId,
      backendId: candidate.backendId,
      backendImplementationStatus: "implemented",
      requestedSourceId: candidate.sourceId,
      actualSourceId: candidate.sourceId,
      outputKind: "backend-output",
      preset: input.densityHint ?? "medium",
      fallbackSteps: [],
      vertexCount: mesh.vertices.length,
      triangleCount: mesh.triangles.length,
      boundaryVertexCount,
      interiorVertexCount: Math.max(0, mesh.vertices.length - boundaryVertexCount),
      alphaBoundsAvailable: true,
      opaquePixelCount: candidateInput.diagnostics.inputOpaquePixelCount,
      contourLoopCount: candidateInput.diagnostics.contourLoopCount,
      holeLikeRegionCount: candidateInput.diagnostics.holeLikeRegionCount,
      removedTriangleCount: triangulation.metrics.removedTriangleCount,
      outsideOrCrossingTriangleCount: triangulation.metrics.outsideOrCrossingTriangleCount,
      multiIslandHandling: candidateInput.diagnostics.multiIslandHandling,
      holeHandling: candidateInput.diagnostics.holeHandling,
      provenance: createV6FBackendOutputProvenance(candidateInput),
      contourPipelineDiagnostics: createGeneratedContourPipelineDiagnostics(candidateInput),
      customCdtDiagnostics: createCustomCdtDiagnostics({
        constraintEdgeCount: candidateInput.constraintEdges.length,
        preservedConstraintEdgeCount: triangulation.metrics.preservedConstraintEdgeCount,
        missingConstraintEdgeCount: triangulation.metrics.missingConstraintEdgeCount,
        edgeFlipCount: triangulation.metrics.edgeFlipCount,
        constraintRecoveryOperationCount: triangulation.metrics.constraintRecoveryOperationCount,
        longSpokeCandidateCount: triangulation.metrics.longSpokeCandidateCount,
        rejectedLocalImprovementCount: triangulation.metrics.rejectedLocalImprovementCount
      })
    }
  });

  return {
    status: "generated",
    mesh,
    alphaBounds: candidateInput.alphaBounds.stageBounds,
    qualityMetrics
  };
};

const triangulateV6FContourCandidate = (
  input: V6ContourCandidateInput
): V6FTriangulationResult => {
  const boundaryPoints = dedupeOrderedPoints(input.boundaryPoints);
  const points = createV6FPoints(boundaryPoints, input.interiorPoints);
  const boundaryPointCount = boundaryPoints.length;
  const constraintEdges = createConstraintEdges(boundaryPointCount);
  const emptyMetrics = createTriangulationMetrics({
    constraintRecoveryOperationCount: constraintEdges.length,
    missingConstraintEdgeCount: constraintEdges.length
  });

  if (boundaryPointCount < 3 || points.length < 3 || Math.abs(polygonSignedArea(boundaryPoints)) <= TRIANGLE_AREA_EPSILON) {
    return {
      status: "failed",
      reason: "v6f-custom-cdt-generation-failed",
      points,
      triangles: [],
      metrics: emptyMetrics,
      provenanceDetails: ["v6f-invalid-contour-input"]
    };
  }

  const edgeBuild = buildConstrainedPlanarEdges({
    points,
    boundaryPointCount,
    boundaryPolygon: boundaryPoints,
    constraintEdges,
    mainMask: input.mainMask,
    width: input.textureSize.width,
    height: input.textureSize.height
  });
  const extracted = extractTrianglesFromPlanarGraph({
    points,
    edgeKeys: edgeBuild.edgeKeys,
    boundaryPolygon: boundaryPoints,
    mainMask: input.mainMask,
    width: input.textureSize.width,
    height: input.textureSize.height
  });
  const improved = improveTrianglesWithLocalFlips({
    points,
    triangles: extracted.triangles,
    constraintEdgeKeys: createConstraintEdgeKeySet(constraintEdges),
    boundaryPointCount,
    longSpokeThreshold: edgeBuild.longSpokeThreshold,
    boundaryPolygon: boundaryPoints,
    mainMask: input.mainMask,
    width: input.textureSize.width,
    height: input.textureSize.height
  });
  const finalTriangles = filterAcceptedTriangles({
    points,
    triangles: improved.triangles,
    boundaryPolygon: boundaryPoints,
    mainMask: input.mainMask,
    width: input.textureSize.width,
    height: input.textureSize.height
  });
  const constraintCounts = countPreservedConstraintEdges(finalTriangles.triangles, constraintEdges);
  const usedPointCount = countUsedPoints(points.length, finalTriangles.triangles);
  const metrics = createTriangulationMetrics({
    edgeFlipCount: improved.edgeFlipCount,
    constraintRecoveryOperationCount: constraintEdges.length,
    longSpokeCandidateCount: edgeBuild.longSpokeCandidateCount,
    rejectedLocalImprovementCount: improved.rejectedLocalImprovementCount,
    removedTriangleCount: extracted.removedTriangleCount + finalTriangles.removedTriangleCount,
    outsideOrCrossingTriangleCount:
      extracted.outsideOrCrossingTriangleCount + finalTriangles.outsideOrCrossingTriangleCount,
    preservedConstraintEdgeCount: constraintCounts.preserved,
    missingConstraintEdgeCount: constraintCounts.missing
  });

  if (constraintCounts.missing > 0) {
    return {
      status: "failed",
      reason: "v6f-custom-cdt-constraint-recovery-failed",
      points,
      triangles: finalTriangles.triangles,
      metrics,
      provenanceDetails: ["v6f-boundary-constraint-missing"]
    };
  }

  if (finalTriangles.triangles.length === 0 || usedPointCount < points.length) {
    return {
      status: "failed",
      reason: "v6f-custom-cdt-generation-failed",
      points,
      triangles: finalTriangles.triangles,
      metrics,
      provenanceDetails: ["v6f-selected-point-unused"]
    };
  }

  return {
    status: "generated",
    points,
    triangles: finalTriangles.triangles,
    metrics
  };
};

const buildConstrainedPlanarEdges = (input: {
  readonly points: readonly V6FPoint[];
  readonly boundaryPointCount: number;
  readonly boundaryPolygon: readonly V6ContourPoint[];
  readonly constraintEdges: readonly V6ContourConstraintEdge[];
  readonly mainMask: readonly boolean[];
  readonly width: number;
  readonly height: number;
}): {
  readonly edgeKeys: ReadonlySet<string>;
  readonly longSpokeCandidateCount: number;
  readonly longSpokeThreshold: number;
} => {
  const edges = new Map<string, V6FEdge>();
  const constraintEdgeKeys = createConstraintEdgeKeySet(input.constraintEdges);
  const boundaryLengths = input.constraintEdges.map(([left, right]) =>
    distance(mustGet(input.points, left), mustGet(input.points, right))
  );
  const averageBoundaryLength =
    boundaryLengths.length === 0
      ? 0
      : boundaryLengths.reduce((sum, length) => sum + length, 0) / boundaryLengths.length;
  const longSpokeThreshold = Math.max(averageBoundaryLength * 2.75, diagonalLength(input.boundaryPolygon) * 0.28);

  for (const [left, right] of input.constraintEdges) {
    const edge = createEdge(input.points, left, right, false, 0);
    edges.set(edge.key, edge);
  }

  const candidates: V6FEdge[] = [];
  let longSpokeCandidateCount = 0;
  for (let left = 0; left < input.points.length; left += 1) {
    for (let right = left + 1; right < input.points.length; right += 1) {
      const key = edgeKey(left, right);
      if (constraintEdgeKeys.has(key)) {
        continue;
      }

      const length = distance(mustGet(input.points, left), mustGet(input.points, right));
      if (length <= TRIANGLE_AREA_EPSILON) {
        continue;
      }

      const longBoundarySpoke =
        left < input.boundaryPointCount &&
        right < input.boundaryPointCount &&
        !areAdjacentBoundaryIndexes(left, right, input.boundaryPointCount) &&
        length > longSpokeThreshold;
      if (longBoundarySpoke) {
        longSpokeCandidateCount += 1;
      }

      if (
        segmentContainsAnyOtherPoint(input.points, left, right) ||
        !isSegmentAccepted({
          points: input.points,
          left,
          right,
          boundaryPolygon: input.boundaryPolygon,
          mainMask: input.mainMask,
          width: input.width,
          height: input.height
        })
      ) {
        continue;
      }

      const boundaryPenalty =
        left < input.boundaryPointCount && right < input.boundaryPointCount
          ? averageBoundaryLength
          : 0;
      const longSpokePenalty = longBoundarySpoke ? longSpokeThreshold * 4 : 0;
      candidates.push(createEdge(input.points, left, right, longBoundarySpoke, boundaryPenalty + longSpokePenalty));
    }
  }

  candidates.sort(compareEdges);
  for (const candidate of candidates) {
    if (edgeCrossesExistingEdges(candidate, edges, input.points)) {
      continue;
    }

    edges.set(candidate.key, candidate);
  }

  return {
    edgeKeys: new Set(edges.keys()),
    longSpokeCandidateCount,
    longSpokeThreshold
  };
};

const extractTrianglesFromPlanarGraph = (input: {
  readonly points: readonly V6FPoint[];
  readonly edgeKeys: ReadonlySet<string>;
  readonly boundaryPolygon: readonly V6ContourPoint[];
  readonly mainMask: readonly boolean[];
  readonly width: number;
  readonly height: number;
}): {
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly removedTriangleCount: number;
  readonly outsideOrCrossingTriangleCount: number;
} => {
  const adjacency = createAdjacency(input.points.length, input.edgeKeys);
  const triangles: (readonly [number, number, number])[] = [];
  let removedTriangleCount = 0;
  let outsideOrCrossingTriangleCount = 0;

  for (let a = 0; a < input.points.length; a += 1) {
    for (const b of mustGet(adjacency, a)) {
      if (b <= a) {
        continue;
      }

      for (const c of mustGet(adjacency, b)) {
        if (c <= b || !input.edgeKeys.has(edgeKey(a, c))) {
          continue;
        }

        const triangle = normalizeTriangle([a, b, c], input.points);
        if (
          Math.abs(triangleAreaByIndex(input.points, triangle)) <= TRIANGLE_AREA_EPSILON ||
          hasPointStrictlyInsideTriangle(input.points, triangle)
        ) {
          removedTriangleCount += 1;
          continue;
        }

        if (!isTriangleAccepted(input.points, triangle, input.boundaryPolygon, input.mainMask, input.width, input.height)) {
          outsideOrCrossingTriangleCount += 1;
          continue;
        }

        triangles.push(triangle);
      }
    }
  }

  return {
    triangles: dedupeAndSortTriangles(triangles),
    removedTriangleCount,
    outsideOrCrossingTriangleCount
  };
};

const improveTrianglesWithLocalFlips = (input: {
  readonly points: readonly V6FPoint[];
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly constraintEdgeKeys: ReadonlySet<string>;
  readonly boundaryPointCount: number;
  readonly longSpokeThreshold: number;
  readonly boundaryPolygon: readonly V6ContourPoint[];
  readonly mainMask: readonly boolean[];
  readonly width: number;
  readonly height: number;
}): EdgeFlipResult => {
  let triangles = [...input.triangles];
  let edgeFlipCount = 0;
  let rejectedLocalImprovementCount = 0;

  for (let iteration = 0; iteration < 4; iteration += 1) {
    let changed = false;
    const sharedEdges = createSharedTriangleEdges(triangles)
      .filter((edge) => !input.constraintEdgeKeys.has(edge.key) && edge.triangleIndexes.length === 2)
      .sort((left, right) => left.key.localeCompare(right.key));

    for (const sharedEdge of sharedEdges) {
      const firstTriangle = triangles[sharedEdge.triangleIndexes[0] ?? -1];
      const secondTriangle = triangles[sharedEdge.triangleIndexes[1] ?? -1];
      if (firstTriangle === undefined || secondTriangle === undefined) {
        continue;
      }

      const oppositeA = findOppositeVertex(firstTriangle, sharedEdge.left, sharedEdge.right);
      const oppositeB = findOppositeVertex(secondTriangle, sharedEdge.left, sharedEdge.right);
      if (oppositeA === undefined || oppositeB === undefined || oppositeA === oppositeB) {
        continue;
      }

      const oldIsLongBoundarySpoke =
        sharedEdge.left < input.boundaryPointCount &&
        sharedEdge.right < input.boundaryPointCount &&
        !areAdjacentBoundaryIndexes(sharedEdge.left, sharedEdge.right, input.boundaryPointCount) &&
        distance(mustGet(input.points, sharedEdge.left), mustGet(input.points, sharedEdge.right)) > input.longSpokeThreshold;
      const replacementKey = edgeKey(oppositeA, oppositeB);
      const currentEdgeKeys = createTriangleEdgeKeySet(triangles);
      currentEdgeKeys.delete(sharedEdge.key);
      if (
        input.constraintEdgeKeys.has(replacementKey) ||
        currentEdgeKeys.has(replacementKey) ||
        segmentContainsAnyOtherPoint(input.points, oppositeA, oppositeB) ||
        !isSegmentAccepted({
          points: input.points,
          left: oppositeA,
          right: oppositeB,
          boundaryPolygon: input.boundaryPolygon,
          mainMask: input.mainMask,
          width: input.width,
          height: input.height
        }) ||
        edgeCrossesEdgeKeys(oppositeA, oppositeB, currentEdgeKeys, input.points)
      ) {
        if (oldIsLongBoundarySpoke) {
          rejectedLocalImprovementCount += 1;
        }
        continue;
      }

      const replacementA = normalizeTriangle([oppositeA, oppositeB, sharedEdge.left], input.points);
      const replacementB = normalizeTriangle([oppositeB, oppositeA, sharedEdge.right], input.points);
      if (
        !isTriangleAccepted(input.points, replacementA, input.boundaryPolygon, input.mainMask, input.width, input.height) ||
        !isTriangleAccepted(input.points, replacementB, input.boundaryPolygon, input.mainMask, input.width, input.height)
      ) {
        if (oldIsLongBoundarySpoke) {
          rejectedLocalImprovementCount += 1;
        }
        continue;
      }

      const oldQuality = pairQuality(input.points, firstTriangle, secondTriangle);
      const newQuality = pairQuality(input.points, replacementA, replacementB);
      const improvesAngle = newQuality.minAngle > oldQuality.minAngle + 0.0001;
      const improvesLongSpoke = oldIsLongBoundarySpoke && newQuality.maxEdgeLength < oldQuality.maxEdgeLength - 0.0001;
      if (!improvesAngle && !improvesLongSpoke) {
        if (oldIsLongBoundarySpoke) {
          rejectedLocalImprovementCount += 1;
        }
        continue;
      }

      triangles = triangles.map((triangle, index) => {
        if (index === sharedEdge.triangleIndexes[0]) {
          return replacementA;
        }
        if (index === sharedEdge.triangleIndexes[1]) {
          return replacementB;
        }
        return triangle;
      });
      edgeFlipCount += 1;
      changed = true;
      break;
    }

    if (!changed) {
      break;
    }
  }

  return {
    triangles: dedupeAndSortTriangles(triangles),
    edgeFlipCount,
    rejectedLocalImprovementCount
  };
};

const filterAcceptedTriangles = (input: {
  readonly points: readonly V6FPoint[];
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly boundaryPolygon: readonly V6ContourPoint[];
  readonly mainMask: readonly boolean[];
  readonly width: number;
  readonly height: number;
}): {
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly removedTriangleCount: number;
  readonly outsideOrCrossingTriangleCount: number;
} => {
  const triangles: (readonly [number, number, number])[] = [];
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

    if (!isTriangleAccepted(input.points, triangle, input.boundaryPolygon, input.mainMask, input.width, input.height)) {
      outsideOrCrossingTriangleCount += 1;
      continue;
    }

    triangles.push(normalizeTriangle(triangle, input.points));
  }

  return {
    triangles: dedupeAndSortTriangles(triangles),
    removedTriangleCount,
    outsideOrCrossingTriangleCount
  };
};

const createV6FPoints = (
  boundaryPoints: readonly V6ContourPoint[],
  interiorPoints: readonly V6ContourPoint[]
): readonly V6FPoint[] => {
  const used = new Set<string>();
  const points: V6FPoint[] = [];

  boundaryPoints.forEach((point, index) => {
    const rounded = roundPoint(point);
    const key = pointKey(rounded);
    if (used.has(key)) {
      return;
    }

    used.add(key);
    points.push({ ...rounded, role: "boundary", stableOrder: index });
  });

  interiorPoints.forEach((point, index) => {
    const rounded = roundPoint(point);
    const key = pointKey(rounded);
    if (used.has(key)) {
      return;
    }

    used.add(key);
    points.push({ ...rounded, role: "interior", stableOrder: index });
  });

  return points;
};

const createConstraintEdges = (
  boundaryPointCount: number
): readonly V6ContourConstraintEdge[] =>
  boundaryPointCount < 3
    ? []
    : Array.from({ length: boundaryPointCount }, (_value, index) => [index, (index + 1) % boundaryPointCount] as const);

const isSegmentAccepted = (input: {
  readonly points: readonly V6FPoint[];
  readonly left: number;
  readonly right: number;
  readonly boundaryPolygon: readonly V6ContourPoint[];
  readonly mainMask: readonly boolean[];
  readonly width: number;
  readonly height: number;
}): boolean => {
  const start = mustGet(input.points, input.left);
  const end = mustGet(input.points, input.right);
  for (const ratio of [0.25, 0.5, 0.75]) {
    const sample = {
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio
    };
    if (
      !isPointInsidePolygon(sample, input.boundaryPolygon) ||
      !isPointInsideMask(input.mainMask, input.width, input.height, sample)
    ) {
      return false;
    }
  }

  return true;
};

const isTriangleAccepted = (
  points: readonly V6FPoint[],
  triangle: readonly [number, number, number],
  boundaryPolygon: readonly V6ContourPoint[],
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

  return isPointInsidePolygon(centroid, boundaryPolygon) && isPointInsideMask(mainMask, width, height, centroid);
};

const createBlockedFailureMetrics = (input: {
  readonly reason: AutoOutlineV6FCustomCdtFailureReason;
  readonly contourPipeline?: V6ContourPipelineResult;
  readonly triangulation?: Extract<V6FTriangulationResult, { readonly status: "failed" }>;
  readonly provenance: readonly string[];
}): AutoOutlineV6FCustomCdtFailureMetrics => {
  const candidateInput =
    input.contourPipeline?.status === "generated" ? input.contourPipeline.candidateInput : undefined;
  const diagnostics = input.triangulation?.metrics;
  const constraintEdgeCount = candidateInput?.constraintEdges.length ?? 0;

  return {
    contourLoopCount: candidateInput?.diagnostics.contourLoopCount ?? 0,
    holeLikeRegionCount: candidateInput?.diagnostics.holeLikeRegionCount ?? 0,
    boundaryVertexCount: candidateInput?.boundaryPoints.length ?? 0,
    interiorVertexCount: candidateInput?.interiorPoints.length ?? 0,
    removedTriangleCount: diagnostics?.removedTriangleCount ?? 0,
    outsideOrCrossingTriangleCount: diagnostics?.outsideOrCrossingTriangleCount ?? 0,
    multiIslandHandling: candidateInput?.diagnostics.multiIslandHandling ?? "not-evaluated",
    holeHandling: candidateInput?.diagnostics.holeHandling ?? "not-evaluated",
    provenance: input.provenance,
    ...(input.contourPipeline === undefined
      ? {}
      : { contourPipelineDiagnostics: createContourPipelineDiagnostics(input.contourPipeline, input.reason) }),
    diagnostics: createCustomCdtDiagnostics({
      constraintEdgeCount,
      preservedConstraintEdgeCount: diagnostics?.preservedConstraintEdgeCount ?? 0,
      missingConstraintEdgeCount: diagnostics?.missingConstraintEdgeCount ?? constraintEdgeCount,
      edgeFlipCount: diagnostics?.edgeFlipCount ?? 0,
      constraintRecoveryOperationCount: diagnostics?.constraintRecoveryOperationCount ?? 0,
      longSpokeCandidateCount: diagnostics?.longSpokeCandidateCount ?? 0,
      rejectedLocalImprovementCount: diagnostics?.rejectedLocalImprovementCount ?? 0,
      customTriangulationFallbackReason: input.reason
    })
  };
};

const createCustomCdtDiagnostics = (
  input: Partial<Omit<MeshGenerationV6CustomCdtDiagnostics, "dependencyGateStatus">>
): MeshGenerationV6CustomCdtDiagnostics => ({
  dependencyGateStatus: "not-required",
  constraintEdgeCount: input.constraintEdgeCount ?? 0,
  preservedConstraintEdgeCount: input.preservedConstraintEdgeCount ?? 0,
  missingConstraintEdgeCount: input.missingConstraintEdgeCount ?? 0,
  edgeFlipCount: input.edgeFlipCount ?? 0,
  constraintRecoveryOperationCount: input.constraintRecoveryOperationCount ?? 0,
  longSpokeCandidateCount: input.longSpokeCandidateCount ?? 0,
  rejectedLocalImprovementCount: input.rejectedLocalImprovementCount ?? 0,
  ...(input.customTriangulationFallbackReason === undefined
    ? {}
    : { customTriangulationFallbackReason: input.customTriangulationFallbackReason }),
  ...(input.thrownErrorKind === undefined ? {} : { thrownErrorKind: input.thrownErrorKind })
});

const createTriangulationMetrics = (
  input: Partial<V6FTriangulationMetrics>
): V6FTriangulationMetrics => ({
  edgeFlipCount: input.edgeFlipCount ?? 0,
  constraintRecoveryOperationCount: input.constraintRecoveryOperationCount ?? 0,
  longSpokeCandidateCount: input.longSpokeCandidateCount ?? 0,
  rejectedLocalImprovementCount: input.rejectedLocalImprovementCount ?? 0,
  removedTriangleCount: input.removedTriangleCount ?? 0,
  outsideOrCrossingTriangleCount: input.outsideOrCrossingTriangleCount ?? 0,
  preservedConstraintEdgeCount: input.preservedConstraintEdgeCount ?? 0,
  missingConstraintEdgeCount: input.missingConstraintEdgeCount ?? 0
});

const createGeneratedContourPipelineDiagnostics = (
  input: V6ContourCandidateInput
): MeshGenerationV6ContourPipelineDiagnostics => ({
  status: "generated",
  inputOpaquePixelCount: input.diagnostics.inputOpaquePixelCount,
  softMaskOpaquePixelCount: input.diagnostics.softMaskOpaquePixelCount,
  selectedComponentPixelCount: input.diagnostics.selectedComponentPixelCount,
  boundaryPointCount: input.diagnostics.boundaryPointCount,
  constraintEdgeCount: input.diagnostics.constraintEdgeCount,
  steinerPointCount: input.diagnostics.interiorPointCount,
  alphaBoundsAvailable: true
});

const createContourPipelineDiagnostics = (
  contourPipeline: V6ContourPipelineResult,
  fallbackReason: MeshGenerationFallbackReason
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
    blockedReason: fallbackReason
  };
};

const createV6FBackendOutputProvenance = (
  input: V6ContourCandidateInput
): readonly string[] => [
  "shared-v6-contour-pipeline",
  "v6f-all-selected-points-seeded",
  "v6f-boundary-constraints-seeded",
  "v6f-constrained-planar-edge-graph",
  "v6f-short-edge-deterministic-triangulation",
  "v6f-local-edge-flip-legalization",
  "v6f-boundary-constraints-verified",
  "v6f-long-boundary-spoke-penalty",
  ...(input.diagnostics.multiIslandHandling === "main-island-only" ? ["limitation-main-island-only"] : []),
  ...(input.diagnostics.holeHandling === "unsupported-fallback" ? ["limitation-hole-regions-reported"] : [])
];

const createV6FFallbackProvenance = (
  reason: AutoOutlineV6FCustomCdtFailureReason,
  details: readonly string[]
): readonly string[] => [
  "shared-v6-contour-pipeline",
  "v6f-visible-fallback",
  `fallback-${reason}`,
  ...details
];

const createEdge = (
  points: readonly V6FPoint[],
  left: number,
  right: number,
  longBoundarySpoke: boolean,
  penalty: number
): V6FEdge => {
  const length = distance(mustGet(points, left), mustGet(points, right));
  return {
    left,
    right,
    key: edgeKey(left, right),
    length,
    longBoundarySpoke,
    score: length + penalty
  };
};

const compareEdges = (left: V6FEdge, right: V6FEdge): number =>
  left.score - right.score ||
  left.length - right.length ||
  Number(left.longBoundarySpoke) - Number(right.longBoundarySpoke) ||
  left.left - right.left ||
  left.right - right.right;

const createAdjacency = (
  pointCount: number,
  edgeKeys: ReadonlySet<string>
): readonly (readonly number[])[] => {
  const adjacency = Array.from({ length: pointCount }, () => [] as number[]);
  for (const key of edgeKeys) {
    const [left, right] = parseEdgeKey(key);
    mustGet(adjacency, left).push(right);
    mustGet(adjacency, right).push(left);
  }

  return adjacency.map((neighbors) => neighbors.sort((left, right) => left - right));
};

const createSharedTriangleEdges = (
  triangles: readonly (readonly [number, number, number])[]
): readonly {
  readonly key: string;
  readonly left: number;
  readonly right: number;
  readonly triangleIndexes: readonly number[];
}[] => {
  const entries = new Map<string, { readonly left: number; readonly right: number; readonly triangleIndexes: number[] }>();
  triangles.forEach((triangle, triangleIndex) => {
    for (const [left, right] of triangleEdges(triangle)) {
      const key = edgeKey(left, right);
      const current = entries.get(key);
      if (current === undefined) {
        const [normalizedLeft, normalizedRight] = parseEdgeKey(key);
        entries.set(key, { left: normalizedLeft, right: normalizedRight, triangleIndexes: [triangleIndex] });
        continue;
      }

      current.triangleIndexes.push(triangleIndex);
    }
  });

  return [...entries.entries()].map(([key, value]) => ({
    key,
    left: value.left,
    right: value.right,
    triangleIndexes: [...value.triangleIndexes].sort((left, right) => left - right)
  }));
};

const findOppositeVertex = (
  triangle: readonly [number, number, number],
  left: number,
  right: number
): number | undefined =>
  triangle.find((index) => index !== left && index !== right);

const pairQuality = (
  points: readonly V6FPoint[],
  left: readonly [number, number, number],
  right: readonly [number, number, number]
): { readonly minAngle: number; readonly maxEdgeLength: number } => {
  const leftQuality = triangleQuality(points, left);
  const rightQuality = triangleQuality(points, right);
  return {
    minAngle: Math.min(leftQuality.minAngle, rightQuality.minAngle),
    maxEdgeLength: Math.max(leftQuality.maxEdgeLength, rightQuality.maxEdgeLength)
  };
};

const triangleQuality = (
  points: readonly V6FPoint[],
  triangle: readonly [number, number, number]
): { readonly minAngle: number; readonly maxEdgeLength: number } => {
  const a = mustGet(points, triangle[0]);
  const b = mustGet(points, triangle[1]);
  const c = mustGet(points, triangle[2]);
  const ab = distance(a, b);
  const bc = distance(b, c);
  const ca = distance(c, a);
  return {
    minAngle: Math.min(angleDegrees(ab, ca, bc), angleDegrees(ab, bc, ca), angleDegrees(bc, ca, ab)),
    maxEdgeLength: Math.max(ab, bc, ca)
  };
};

const countPreservedConstraintEdges = (
  triangles: readonly (readonly [number, number, number])[],
  constraintEdges: readonly V6ContourConstraintEdge[]
): { readonly preserved: number; readonly missing: number } => {
  const triangleEdgeKeys = createTriangleEdgeKeySet(triangles);
  const preserved = constraintEdges.filter(([left, right]) => triangleEdgeKeys.has(edgeKey(left, right))).length;
  return {
    preserved,
    missing: constraintEdges.length - preserved
  };
};

const countUsedPoints = (
  pointCount: number,
  triangles: readonly (readonly [number, number, number])[]
): number => {
  const used = new Set<number>();
  for (const triangle of triangles) {
    used.add(triangle[0]);
    used.add(triangle[1]);
    used.add(triangle[2]);
  }

  return [...used].filter((index) => index >= 0 && index < pointCount).length;
};

const edgeCrossesExistingEdges = (
  candidate: V6FEdge,
  edges: ReadonlyMap<string, V6FEdge>,
  points: readonly V6FPoint[]
): boolean => {
  for (const edge of edges.values()) {
    if (
      candidate.left === edge.left ||
      candidate.left === edge.right ||
      candidate.right === edge.left ||
      candidate.right === edge.right
    ) {
      continue;
    }

    if (
      segmentsIntersect(
        mustGet(points, candidate.left),
        mustGet(points, candidate.right),
        mustGet(points, edge.left),
        mustGet(points, edge.right)
      )
    ) {
      return true;
    }
  }

  return false;
};

const edgeCrossesEdgeKeys = (
  left: number,
  right: number,
  edgeKeys: ReadonlySet<string>,
  points: readonly V6FPoint[]
): boolean => {
  for (const key of edgeKeys) {
    const [edgeLeft, edgeRight] = parseEdgeKey(key);
    if (left === edgeLeft || left === edgeRight || right === edgeLeft || right === edgeRight) {
      continue;
    }

    if (
      segmentsIntersect(
        mustGet(points, left),
        mustGet(points, right),
        mustGet(points, edgeLeft),
        mustGet(points, edgeRight)
      )
    ) {
      return true;
    }
  }

  return false;
};

const segmentContainsAnyOtherPoint = (
  points: readonly V6FPoint[],
  left: number,
  right: number
): boolean => {
  const start = mustGet(points, left);
  const end = mustGet(points, right);
  for (let index = 0; index < points.length; index += 1) {
    if (index === left || index === right) {
      continue;
    }

    if (isPointOnSegment(mustGet(points, index), start, end)) {
      return true;
    }
  }

  return false;
};

const hasPointStrictlyInsideTriangle = (
  points: readonly V6FPoint[],
  triangle: readonly [number, number, number]
): boolean => {
  const a = mustGet(points, triangle[0]);
  const b = mustGet(points, triangle[1]);
  const c = mustGet(points, triangle[2]);
  for (let index = 0; index < points.length; index += 1) {
    if (index === triangle[0] || index === triangle[1] || index === triangle[2]) {
      continue;
    }

    if (isPointStrictlyInsideTriangle(mustGet(points, index), a, b, c)) {
      return true;
    }
  }

  return false;
};

const isPointInsideMask = (
  mask: readonly boolean[],
  width: number,
  height: number,
  point: V6ContourPoint
): boolean => {
  const x = Math.floor(point.x);
  const y = Math.floor(point.y);
  if (x < 0 || x >= width || y < 0 || y >= height) {
    return false;
  }

  return mask[y * width + x] === true;
};

const isPointInsidePolygon = (
  point: V6ContourPoint,
  polygon: readonly V6ContourPoint[]
): boolean => {
  for (let index = 0; index < polygon.length; index += 1) {
    if (isPointOnSegment(point, mustGet(polygon, index), mustGet(polygon, (index + 1) % polygon.length))) {
      return true;
    }
  }

  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const a = mustGet(polygon, index);
    const b = mustGet(polygon, previousIndex);
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

const isPointStrictlyInsideTriangle = (
  point: V6ContourPoint,
  a: V6ContourPoint,
  b: V6ContourPoint,
  c: V6ContourPoint
): boolean => {
  const area = Math.abs(cross(a, b, c));
  if (area <= TRIANGLE_AREA_EPSILON) {
    return false;
  }

  const areaA = Math.abs(cross(point, b, c));
  const areaB = Math.abs(cross(a, point, c));
  const areaC = Math.abs(cross(a, b, point));
  if (Math.abs(area - (areaA + areaB + areaC)) > TRIANGLE_AREA_EPSILON) {
    return false;
  }

  return areaA > TRIANGLE_AREA_EPSILON && areaB > TRIANGLE_AREA_EPSILON && areaC > TRIANGLE_AREA_EPSILON;
};

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

  return abC * abD < -TRIANGLE_AREA_EPSILON && cdA * cdB < -TRIANGLE_AREA_EPSILON;
};

const rangesOverlap = (
  leftA: number,
  rightA: number,
  leftB: number,
  rightB: number
): boolean =>
  Math.max(Math.min(leftA, rightA), Math.min(leftB, rightB)) <=
  Math.min(Math.max(leftA, rightA), Math.max(leftB, rightB)) + TRIANGLE_AREA_EPSILON;

const normalizeTriangle = (
  triangle: readonly [number, number, number],
  points: readonly V6ContourPoint[]
): [number, number, number] =>
  triangleAreaByIndex(points, triangle) >= 0
    ? [...triangle]
    : [triangle[0], triangle[2], triangle[1]];

const triangleEdges = (
  triangle: readonly [number, number, number]
): readonly (readonly [number, number])[] => [
  [triangle[0], triangle[1]],
  [triangle[1], triangle[2]],
  [triangle[2], triangle[0]]
];

const createTriangleEdgeKeySet = (
  triangles: readonly (readonly [number, number, number])[]
): Set<string> => {
  const keys = new Set<string>();
  for (const triangle of triangles) {
    for (const [left, right] of triangleEdges(triangle)) {
      keys.add(edgeKey(left, right));
    }
  }

  return keys;
};

const createConstraintEdgeKeySet = (
  constraintEdges: readonly V6ContourConstraintEdge[]
): Set<string> => new Set(constraintEdges.map(([left, right]) => edgeKey(left, right)));

const dedupeAndSortTriangles = (
  triangles: readonly (readonly [number, number, number])[]
): readonly (readonly [number, number, number])[] => {
  const seen = new Set<string>();
  const deduped: (readonly [number, number, number])[] = [];
  for (const triangle of triangles) {
    const key = triangleKey(triangle);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(triangle);
  }

  return deduped.sort(compareTriangle);
};

const dedupeOrderedPoints = (
  points: readonly V6ContourPoint[]
): readonly V6ContourPoint[] => {
  const seen = new Set<string>();
  const deduped: V6ContourPoint[] = [];
  for (const point of points) {
    const rounded = roundPoint(point);
    const key = pointKey(rounded);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(rounded);
  }

  return deduped;
};

const areAdjacentBoundaryIndexes = (
  left: number,
  right: number,
  boundaryPointCount: number
): boolean =>
  Math.abs(left - right) === 1 || Math.abs(left - right) === boundaryPointCount - 1;

const hasDuplicateTriangleIndex = (
  triangle: readonly [number, number, number]
): boolean => triangle[0] === triangle[1] || triangle[1] === triangle[2] || triangle[2] === triangle[0];

const triangleAreaByIndex = (
  points: readonly V6ContourPoint[],
  triangle: readonly [number, number, number]
): number => cross(mustGet(points, triangle[0]), mustGet(points, triangle[1]), mustGet(points, triangle[2])) / 2;

const polygonSignedArea = (points: readonly V6ContourPoint[]): number => {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = mustGet(points, index);
    const next = mustGet(points, (index + 1) % points.length);
    area += current.x * next.y - next.x * current.y;
  }

  return area / 2;
};

const diagonalLength = (
  points: readonly V6ContourPoint[]
): number => {
  if (points.length === 0) {
    return 0;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return Math.hypot(maxX - minX, maxY - minY);
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

const angleDegrees = (
  adjacentA: number,
  adjacentB: number,
  opposite: number
): number => {
  if (adjacentA <= 0 || adjacentB <= 0) {
    return 0;
  }

  const cosine = clamp(
    (adjacentA * adjacentA + adjacentB * adjacentB - opposite * opposite) /
      (2 * adjacentA * adjacentB),
    -1,
    1
  );
  return (Math.acos(cosine) * 180) / Math.PI;
};

const roundPoint = (
  point: V6ContourPoint
): V6ContourPoint => ({
  x: roundCoordinate(point.x),
  y: roundCoordinate(point.y)
});

const roundCoordinate = (value: number): number => {
  const rounded = Math.round(value * POINT_KEY_SCALE) / POINT_KEY_SCALE;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const pointKey = (point: V6ContourPoint): string =>
  `${roundCoordinate(point.x)}:${roundCoordinate(point.y)}`;

const edgeKey = (left: number, right: number): string =>
  left < right ? `${left}:${right}` : `${right}:${left}`;

const parseEdgeKey = (key: string): readonly [number, number] => {
  const [left, right] = key.split(":").map((value) => Number.parseInt(value, 10));
  if (left === undefined || right === undefined || !Number.isInteger(left) || !Number.isInteger(right)) {
    throw new Error(`v6f custom cdt invalid edge key: ${key}`);
  }

  return [left, right];
};

const triangleKey = (triangle: readonly [number, number, number]): string =>
  [...triangle].sort((left, right) => left - right).join(":");

const compareTriangle = (
  left: readonly [number, number, number],
  right: readonly [number, number, number]
): number =>
  left[0] - right[0] || left[1] - right[1] || left[2] - right[2];

const stripIdPrefix = (id: string, prefix: string): string =>
  id.startsWith(prefix) ? id.slice(prefix.length) : id;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const mustGet = <T>(items: readonly T[], index: number): T => {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`v6f custom cdt internal index out of range: ${index}`);
  }

  return item;
};
