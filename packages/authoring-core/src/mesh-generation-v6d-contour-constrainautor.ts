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
import {
  createV6ContourCandidateInput,
  mapV6ContourPointToStagePoint,
  mapV6ContourPointToUv,
  type V6ContourCandidateInput,
  type V6ContourConstraintEdge,
  type V6ContourPipelineResult,
  type V6ContourPoint
} from "./mesh-generation-v6-contour-pipeline.js";
import Constrainautor from "./mesh-generation-v6b-constrainautor-runtime.js";
import {
  computeMeshQualityMetrics,
  type MeshGenerationQualityMetrics,
  type MeshGenerationV6ConstrainautorDiagnostics,
  type MeshGenerationV6ContourPipelineDiagnostics
} from "./mesh-quality-metrics.js";

export interface AutoOutlineV6DContourConstrainautorMeshInput {
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

export type AutoOutlineV6DContourConstrainautorMeshResult =
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
      readonly reason: "alpha-empty" | "v6-contour-extraction-failed" | "v6d-constrainautor-generation-failed";
      readonly opaquePixelCount?: number;
      readonly alphaBounds?: RectDto;
      readonly contourPipeline?: V6ContourPipelineResult;
    };

export interface V6DConstrainautorPoint {
  readonly x: number;
  readonly y: number;
  readonly role: "boundary" | "interior";
  readonly stableOrder: number;
}

export interface V6DConstrainautorRecoveryInput {
  readonly points: readonly V6DConstrainautorPoint[];
  readonly constraintEdges: readonly V6ContourConstraintEdge[];
}

export type V6DConstrainautorRecoveryResult =
  | {
      readonly status: "generated";
      readonly points: readonly V6DConstrainautorPoint[];
      readonly constraintEdges: readonly [number, number][];
      readonly triangles: readonly (readonly [number, number, number])[];
      readonly diagnostics: MeshGenerationV6ConstrainautorDiagnostics;
    }
  | {
      readonly status: "failed";
      readonly reason: Extract<
        MeshGenerationV6FallbackReason,
        "v6d-constrainautor-generation-failed" | "v6d-constraint-recovery-failed" | "v6d-backend-threw"
      >;
      readonly points: readonly V6DConstrainautorPoint[];
      readonly constraintEdges: readonly [number, number][];
      readonly triangles: readonly (readonly [number, number, number])[];
      readonly diagnostics: MeshGenerationV6ConstrainautorDiagnostics;
    };

export interface FilteredTriangles {
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly removedTriangleCount: number;
  readonly outsideOrCrossingTriangleCount: number;
}

interface SanitizedConstrainautorInput {
  readonly status: "ok";
  readonly points: readonly V6DConstrainautorPoint[];
  readonly constraintEdges: readonly [number, number][];
}

interface SanitizedConstrainautorFailure {
  readonly status: "failed";
  readonly points: readonly V6DConstrainautorPoint[];
  readonly constraintEdges: readonly [number, number][];
  readonly constraintEdgeCount: number;
}

export interface PixelBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface V6DAlphaBoundsFallbackMeshInput {
  readonly meshId: MeshId;
  readonly drawableId: DrawableId;
  readonly bounds: RectDto;
  readonly provenanceId: ProvenanceId;
  readonly textureSize: {
    readonly width: number;
    readonly height: number;
  };
  readonly rgbaBytes: Uint8Array;
  readonly alphaBoundsPixels: PixelBounds;
  readonly densityHint: MeshDensityHint;
}

const TRIANGLE_AREA_EPSILON = 0.000001;
const POINT_KEY_SCALE = 1_000_000;

export const createAutoOutlineV6DContourConstrainautorMesh = (
  input: AutoOutlineV6DContourConstrainautorMeshInput
): AutoOutlineV6DContourConstrainautorMeshResult => {
  const contourPipeline = createV6ContourCandidateInput({
    textureSize: input.textureSize,
    meshBounds: input.bounds,
    rgbaBytes: input.rgbaBytes,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
    ...(input.alphaThreshold === undefined ? {} : { alphaThreshold: input.alphaThreshold })
  });

  if (contourPipeline.status === "blocked") {
    return {
      status: "blocked",
      reason: contourPipeline.reason,
      ...(contourPipeline.opaquePixelCount === undefined ? {} : { opaquePixelCount: contourPipeline.opaquePixelCount }),
      ...(contourPipeline.alphaBounds === undefined ? {} : { alphaBounds: contourPipeline.alphaBounds.stageBounds }),
      contourPipeline
    };
  }

  const candidateInput = contourPipeline.candidateInput;
  const recovery = recoverV6DConstrainautorTriangles(createRecoveryInput(candidateInput));
  if (recovery.status === "failed") {
    return createVisibleV6DFallback({
      input,
      candidateInput,
      contourPipeline,
      reason: recovery.reason,
      diagnostics: recovery.diagnostics,
      provenance: createV6DFallbackProvenance(candidateInput, recovery.reason, [
        "v6d-constrainautor-recovery-failed"
      ])
    });
  }

  const filtered = filterTrianglesToMainMask({
    points: recovery.points,
    triangles: recovery.triangles,
    boundaryEdges: recovery.constraintEdges
  });
  const finalConstraintCounts = countPreservedConstraintEdges(
    filtered.triangles,
    recovery.points,
    recovery.constraintEdges
  );
  const diagnostics = {
    ...recovery.diagnostics,
    preservedConstraintEdgeCount: finalConstraintCounts.preserved,
    missingConstraintEdgeCount: finalConstraintCounts.missing,
    constraintRecoveryFailed: finalConstraintCounts.missing > 0,
    outsideTriangleCount: filtered.outsideOrCrossingTriangleCount
  } satisfies MeshGenerationV6ConstrainautorDiagnostics;

  if (filtered.triangles.length === 0 || finalConstraintCounts.missing > 0) {
    return createVisibleV6DFallback({
      input,
      candidateInput,
      contourPipeline,
      reason: "v6d-constraint-recovery-failed",
      diagnostics,
      provenance: createV6DFallbackProvenance(candidateInput, "v6d-constraint-recovery-failed", [
        "v6d-final-boundary-constraint-verification-failed"
      ])
    });
  }

  return createGeneratedV6DMesh({
    input,
    candidateInput,
    contourPipeline,
    points: recovery.points,
    triangles: filtered.triangles,
    diagnostics,
    filtered
  });
};

export const recoverV6DConstrainautorTriangles = (
  input: V6DConstrainautorRecoveryInput
): V6DConstrainautorRecoveryResult => {
  const sanitized = sanitizeConstrainautorInput(input);
  if (sanitized.status === "failed") {
    return {
      status: "failed",
      reason: "v6d-constrainautor-generation-failed",
      points: sanitized.points,
      constraintEdges: sanitized.constraintEdges,
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
    if (constrainer.untriangulatedPoints().length > 0) {
      return {
        status: "failed",
        reason: "v6d-constrainautor-generation-failed",
        points: sanitized.points,
        constraintEdges: sanitized.constraintEdges,
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
      reason: "v6d-backend-threw",
      points: sanitized.points,
      constraintEdges: sanitized.constraintEdges,
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

  const triangles = normalizeTriangles(toTriangleTriples(delaunay.triangles), sanitized.points);
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
      reason: "v6d-constraint-recovery-failed",
      points: sanitized.points,
      constraintEdges: sanitized.constraintEdges,
      triangles,
      diagnostics
    };
  }

  return {
    status: "generated",
    points: sanitized.points,
    constraintEdges: sanitized.constraintEdges,
    triangles,
    diagnostics
  };
};

export const probeV6DOutsideTriangleFilterForTest = (input: {
  readonly points: readonly V6DConstrainautorPoint[];
  readonly boundaryEdges: readonly (readonly [number, number])[];
  readonly triangles: readonly (readonly [number, number, number])[];
}): FilteredTriangles => filterTrianglesToMainMask(input);

export const filterV6DConstrainautorTrianglesToMainMask = (input: {
  readonly points: readonly V6DConstrainautorPoint[];
  readonly boundaryEdges: readonly (readonly [number, number])[];
  readonly triangles: readonly (readonly [number, number, number])[];
}): FilteredTriangles => filterTrianglesToMainMask(input);

export const createV6DAlphaBoundsFallbackMesh = (
  input: V6DAlphaBoundsFallbackMeshInput
): { readonly mesh: MeshDto } => createAlphaBoundsFallbackMesh(input);

const createRecoveryInput = (
  candidateInput: V6ContourCandidateInput
): V6DConstrainautorRecoveryInput => ({
  points: [
    ...candidateInput.boundaryPoints.map((point, index) => ({
      ...point,
      role: "boundary" as const,
      stableOrder: index
    })),
    ...candidateInput.interiorPoints.map((point, index) => ({
      ...point,
      role: "interior" as const,
      stableOrder: index
    }))
  ],
  constraintEdges: candidateInput.constraintEdges
});

const createGeneratedV6DMesh = (input: {
  readonly input: AutoOutlineV6DContourConstrainautorMeshInput;
  readonly candidateInput: V6ContourCandidateInput;
  readonly contourPipeline: Extract<V6ContourPipelineResult, { readonly status: "generated" }>;
  readonly points: readonly V6DConstrainautorPoint[];
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly diagnostics: MeshGenerationV6ConstrainautorDiagnostics;
  readonly filtered: FilteredTriangles;
}): AutoOutlineV6DContourConstrainautorMeshResult => {
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6d-contour-constrainautor");
  const token = stripIdPrefix(input.input.drawableId, "draw_");
  const mesh: MeshDto = {
    meshId: input.input.meshId,
    drawableId: input.input.drawableId,
    vertices: input.points.map((point) =>
      mapV6ContourPointToStagePoint(
        point,
        input.input.bounds,
        input.candidateInput.textureSize.width,
        input.candidateInput.textureSize.height
      )
    ),
    uvs: input.points.map((point) =>
      mapV6ContourPointToUv(point, input.candidateInput.textureSize.width, input.candidateInput.textureSize.height)
    ),
    triangles: input.triangles.map((triangle) => [...triangle] as [number, number, number]),
    vertexStableIds: input.points.map((point, index) =>
      point.role === "boundary"
        ? `vtx_${token}_v6d_boundary_${point.stableOrder}`
        : `vtx_${token}_v6d_interior_${point.stableOrder}_${index}`
    ),
    triangleStableIds: input.triangles.map((_triangle, index) => `tri_${token}_v6d_${index}` as TriangleId),
    topologyRevision: 0,
    bounds: structuredClone(input.input.bounds),
    generationProvenanceId: input.input.provenanceId
  };
  const boundaryVertexCount = input.points.filter((point) => point.role === "boundary").length;
  const qualityMetrics = computeMeshQualityMetrics(mesh, {
    refinementIterationCount: 0,
    triangulationMode: "v6d-contour-delaunator-constrainautor",
    v6Metrics: {
      algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
      methodId: candidate.methodId,
      backendId: candidate.backendId,
      backendImplementationStatus: "implemented",
      requestedSourceId: candidate.sourceId,
      actualSourceId: candidate.sourceId,
      outputKind: "backend-output",
      preset: input.input.densityHint ?? "medium",
      fallbackSteps: [],
      vertexCount: mesh.vertices.length,
      triangleCount: mesh.triangles.length,
      boundaryVertexCount,
      interiorVertexCount: Math.max(0, mesh.vertices.length - boundaryVertexCount),
      alphaBoundsAvailable: true,
      opaquePixelCount: input.candidateInput.diagnostics.inputOpaquePixelCount,
      contourLoopCount: input.candidateInput.diagnostics.contourLoopCount,
      holeLikeRegionCount: input.candidateInput.diagnostics.holeLikeRegionCount,
      removedTriangleCount: input.filtered.removedTriangleCount,
      outsideOrCrossingTriangleCount: input.filtered.outsideOrCrossingTriangleCount,
      multiIslandHandling: input.candidateInput.diagnostics.multiIslandHandling,
      holeHandling: input.candidateInput.diagnostics.holeHandling,
      provenance: createV6DSuccessProvenance(input.candidateInput),
      contourPipelineDiagnostics: createV6ContourPipelineDiagnostics(input.contourPipeline),
      constrainautorDiagnostics: input.diagnostics
    }
  });

  return {
    status: "generated",
    mesh,
    alphaBounds: input.candidateInput.alphaBounds.stageBounds,
    qualityMetrics
  };
};

const createVisibleV6DFallback = (input: {
  readonly input: AutoOutlineV6DContourConstrainautorMeshInput;
  readonly candidateInput: V6ContourCandidateInput;
  readonly contourPipeline: Extract<V6ContourPipelineResult, { readonly status: "generated" }>;
  readonly reason: MeshGenerationFallbackReason;
  readonly diagnostics: MeshGenerationV6ConstrainautorDiagnostics;
  readonly provenance: readonly string[];
}): AutoOutlineV6DContourConstrainautorMeshResult => {
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6d-contour-constrainautor");
  const fallback = createAlphaBoundsFallbackMesh({
    meshId: input.input.meshId,
    drawableId: input.input.drawableId,
    bounds: input.input.bounds,
    provenanceId: input.input.provenanceId,
    textureSize: input.candidateInput.textureSize,
    rgbaBytes: input.input.rgbaBytes,
    alphaBoundsPixels: input.candidateInput.alphaBounds.pixelBounds,
    densityHint: input.input.densityHint ?? "medium"
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
      backendImplementationStatus: "implemented",
      requestedSourceId: candidate.sourceId,
      actualSourceId: source,
      outputKind: "fallback-output",
      preset: input.input.densityHint ?? "medium",
      fallbackReason: input.reason,
      fallbackSteps,
      vertexCount: mesh.vertices.length,
      triangleCount: mesh.triangles.length,
      boundaryVertexCount,
      interiorVertexCount: Math.max(0, mesh.vertices.length - boundaryVertexCount),
      alphaBoundsAvailable: true,
      opaquePixelCount: input.candidateInput.diagnostics.inputOpaquePixelCount,
      contourLoopCount: input.candidateInput.diagnostics.contourLoopCount,
      holeLikeRegionCount: input.candidateInput.diagnostics.holeLikeRegionCount,
      removedTriangleCount: 0,
      outsideOrCrossingTriangleCount: input.diagnostics.outsideTriangleCount,
      multiIslandHandling: input.candidateInput.diagnostics.multiIslandHandling,
      holeHandling: input.candidateInput.diagnostics.holeHandling,
      provenance: input.provenance,
      contourPipelineDiagnostics: createV6ContourPipelineDiagnostics(input.contourPipeline),
      constrainautorDiagnostics: input.diagnostics
    }
  });

  return {
    status: "fallback",
    mesh,
    source,
    reason: input.reason,
    fallbackSteps,
    alphaBounds: input.candidateInput.alphaBounds.stageBounds,
    qualityMetrics
  };
};

const sanitizeConstrainautorInput = (
  input: V6DConstrainautorRecoveryInput
): SanitizedConstrainautorInput | SanitizedConstrainautorFailure => {
  const uniqueByKey = new Map<string, V6DConstrainautorPoint>();
  const originalKeyByIndex = new Map<number, string>();
  for (let index = 0; index < input.points.length; index += 1) {
    const point = input.points[index];
    if (point === undefined || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      continue;
    }

    const rounded = roundRecoveryPoint(point);
    const key = pointKey(rounded);
    originalKeyByIndex.set(index, key);
    const existing = uniqueByKey.get(key);
    if (existing === undefined || compareRecoveryPoint(rounded, existing) < 0) {
      uniqueByKey.set(key, rounded);
    }
  }

  const points = [...uniqueByKey.values()].sort(compareRecoveryPoint);
  const remapByKey = new Map(points.map((point, index) => [pointKey(point), index]));
  const edgeKeySet = new Set<string>();
  const constraintEdges: [number, number][] = [];
  let zeroLengthEdgeCount = 0;

  for (const [leftOriginal, rightOriginal] of input.constraintEdges) {
    const leftKey = originalKeyByIndex.get(leftOriginal);
    const rightKey = originalKeyByIndex.get(rightOriginal);
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
      constraintEdges,
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
  readonly points: readonly V6DConstrainautorPoint[];
  readonly triangles: readonly (readonly [number, number, number])[];
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

    const outsideMask = !isTriangleCentroidInsideBoundaryPolygon(input.points, triangle);
    const crossesBoundary = triangleCrossesBoundary(input.points, triangle, input.boundaryEdges);
    if (outsideMask || crossesBoundary) {
      outsideOrCrossingTriangleCount += 1;
      removedTriangleCount += 1;
      continue;
    }

    filtered.push([triangle[0], triangle[1], triangle[2]]);
  }

  return {
    triangles: normalizeTriangles(filtered, input.points),
    removedTriangleCount,
    outsideOrCrossingTriangleCount
  };
};

const createAlphaBoundsFallbackMesh = (input: V6DAlphaBoundsFallbackMeshInput): { readonly mesh: MeshDto } => {
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
    vertexStableIds.push(`vtx_${token}_v6d_fallback_${row}_${column}`);
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
      if (!cellHasAlpha(input.rgbaBytes, input.textureSize.width, input.textureSize.height, cellPixels)) {
        continue;
      }

      const topLeft = addVertex(row, column);
      const topRight = addVertex(row, column + 1);
      const bottomLeft = addVertex(row + 1, column);
      const bottomRight = addVertex(row + 1, column + 1);
      triangles.push([topLeft, topRight, bottomLeft]);
      triangleStableIds.push(`tri_${token}_v6d_fallback_${row}_${column}_a` as TriangleId);
      triangles.push([topRight, bottomRight, bottomLeft]);
      triangleStableIds.push(`tri_${token}_v6d_fallback_${row}_${column}_b` as TriangleId);
    }
  }

  if (vertices.length === 0 || triangles.length === 0) {
    const left = mapV6ContourPointToStagePoint(
      { x: input.alphaBoundsPixels.left, y: input.alphaBoundsPixels.top },
      input.bounds,
      input.textureSize.width,
      input.textureSize.height
    );
    const right = mapV6ContourPointToStagePoint(
      { x: input.alphaBoundsPixels.right, y: input.alphaBoundsPixels.bottom },
      input.bounds,
      input.textureSize.width,
      input.textureSize.height
    );
    return {
      mesh: {
        meshId: input.meshId,
        drawableId: input.drawableId,
        vertices: [
          { x: left.x, y: left.y },
          { x: right.x, y: left.y },
          { x: left.x, y: right.y },
          { x: right.x, y: right.y }
        ],
        uvs: [
          mapV6ContourPointToUv(
            { x: input.alphaBoundsPixels.left, y: input.alphaBoundsPixels.top },
            input.textureSize.width,
            input.textureSize.height
          ),
          mapV6ContourPointToUv(
            { x: input.alphaBoundsPixels.right, y: input.alphaBoundsPixels.top },
            input.textureSize.width,
            input.textureSize.height
          ),
          mapV6ContourPointToUv(
            { x: input.alphaBoundsPixels.left, y: input.alphaBoundsPixels.bottom },
            input.textureSize.width,
            input.textureSize.height
          ),
          mapV6ContourPointToUv(
            { x: input.alphaBoundsPixels.right, y: input.alphaBoundsPixels.bottom },
            input.textureSize.width,
            input.textureSize.height
          )
        ],
        triangles: [
          [0, 1, 2],
          [1, 3, 2]
        ],
        vertexStableIds: [
          `vtx_${token}_v6d_fallback_bounds_0`,
          `vtx_${token}_v6d_fallback_bounds_1`,
          `vtx_${token}_v6d_fallback_bounds_2`,
          `vtx_${token}_v6d_fallback_bounds_3`
        ],
        triangleStableIds: [
          `tri_${token}_v6d_fallback_bounds_a` as TriangleId,
          `tri_${token}_v6d_fallback_bounds_b` as TriangleId
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

const createV6ContourPipelineDiagnostics = (
  contourPipeline: Extract<V6ContourPipelineResult, { readonly status: "generated" }>
): MeshGenerationV6ContourPipelineDiagnostics => {
  const diagnostics = contourPipeline.candidateInput.diagnostics;
  return {
    status: "generated",
    inputOpaquePixelCount: diagnostics.inputOpaquePixelCount,
    softMaskOpaquePixelCount: diagnostics.softMaskOpaquePixelCount,
    selectedComponentPixelCount: diagnostics.selectedComponentPixelCount,
    boundaryPointCount: diagnostics.boundaryPointCount,
    constraintEdgeCount: diagnostics.constraintEdgeCount,
    steinerPointCount: diagnostics.interiorPointCount,
    alphaBoundsAvailable: true
  };
};

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

const createV6DSuccessProvenance = (
  candidateInput: V6ContourCandidateInput
): readonly string[] => [
  ...candidateInput.diagnostics.provenance,
  "dependency-available",
  "v6d-delaunator-all-points",
  "v6d-constrainautor-constraint-recovery",
  "v6d-boundary-constraints-verified",
  "v6d-outside-triangle-filter"
];

const createV6DFallbackProvenance = (
  candidateInput: V6ContourCandidateInput,
  reason: MeshGenerationFallbackReason,
  details: readonly string[]
): readonly string[] => [
  ...candidateInput.diagnostics.provenance,
  "dependency-available",
  "v6d-delaunator-all-points",
  "v6d-constrainautor-constraint-recovery",
  "v6d-visible-fallback",
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

const normalizeTriangles = (
  triangles: readonly (readonly [number, number, number])[],
  points: readonly V6DConstrainautorPoint[]
): readonly (readonly [number, number, number])[] =>
  triangles
    .map((triangle) => orientTrianglePositive(points, triangle))
    .sort((left, right) =>
      left[0] - right[0] ||
      left[1] - right[1] ||
      left[2] - right[2]
    );

const orientTrianglePositive = (
  points: readonly V6DConstrainautorPoint[],
  triangle: readonly [number, number, number]
): readonly [number, number, number] =>
  triangleAreaByIndex(points, triangle) < 0
    ? [triangle[0], triangle[2], triangle[1]]
    : [triangle[0], triangle[1], triangle[2]];

const countPreservedConstraintEdges = (
  triangles: readonly (readonly [number, number, number])[],
  points: readonly V6DConstrainautorPoint[],
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
  points: readonly V6DConstrainautorPoint[],
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

      if (
        segmentsIntersect(
          mustGet(points, left[0]),
          mustGet(points, left[1]),
          mustGet(points, right[0]),
          mustGet(points, right[1])
        )
      ) {
        count += 1;
      }
    }
  }

  return count;
};

const countConstraintPointIntersections = (
  points: readonly V6DConstrainautorPoint[],
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
  points: readonly V6DConstrainautorPoint[],
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

const isTriangleCentroidInsideBoundaryPolygon = (
  points: readonly V6DConstrainautorPoint[],
  triangle: readonly [number, number, number]
): boolean => {
  const a = mustGet(points, triangle[0]);
  const b = mustGet(points, triangle[1]);
  const c = mustGet(points, triangle[2]);
  return isPointInsideBoundaryPolygon(points, {
    x: (a.x + b.x + c.x) / 3,
    y: (a.y + b.y + c.y) / 3
  });
};

const cellHasAlpha = (
  rgbaBytes: Uint8Array,
  width: number,
  height: number,
  cell: PixelBounds
): boolean => {
  const left = clampInt(cell.left, 0, width);
  const top = clampInt(cell.top, 0, height);
  const right = clampInt(Math.max(cell.right, left + 1), 0, width);
  const bottom = clampInt(Math.max(cell.bottom, top + 1), 0, height);

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      if ((rgbaBytes[(y * width + x) * 4 + 3] ?? 0) > 8) {
        return true;
      }
    }
  }

  return false;
};

const isPointInsideBoundaryPolygon = (
  points: readonly V6DConstrainautorPoint[],
  point: V6ContourPoint
): boolean => {
  const boundary = points.filter((candidate) => candidate.role === "boundary");
  for (let index = 0; index < boundary.length; index += 1) {
    if (isPointOnSegment(point, mustGet(boundary, index), mustGet(boundary, (index + 1) % boundary.length))) {
      return true;
    }
  }

  let inside = false;
  for (let index = 0, previousIndex = boundary.length - 1; index < boundary.length; previousIndex = index, index += 1) {
    const current = mustGet(boundary, index);
    const previous = mustGet(boundary, previousIndex);
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

const hasDuplicateTriangleIndex = (
  triangle: readonly [number, number, number]
): boolean => triangle[0] === triangle[1] || triangle[1] === triangle[2] || triangle[2] === triangle[0];

const triangleAreaByIndex = (
  points: readonly V6DConstrainautorPoint[],
  triangle: readonly [number, number, number]
): number => triangleArea(
  mustGet(points, triangle[0]),
  mustGet(points, triangle[1]),
  mustGet(points, triangle[2])
);

const triangleArea = (a: V6ContourPoint, b: V6ContourPoint, c: V6ContourPoint): number =>
  cross(a, b, c) / 2;

const cross = (a: V6ContourPoint, b: V6ContourPoint, c: V6ContourPoint): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

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

const roundRecoveryPoint = (point: V6DConstrainautorPoint): V6DConstrainautorPoint => ({
  ...point,
  x: roundCoordinate(point.x),
  y: roundCoordinate(point.y)
});

const roundCoordinate = (value: number): number => {
  const rounded = Math.round(value * POINT_KEY_SCALE) / POINT_KEY_SCALE;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const pointKey = (point: V6ContourPoint): string =>
  `${roundCoordinate(point.x)}:${roundCoordinate(point.y)}`;

const compareRecoveryPoint = (
  left: V6DConstrainautorPoint,
  right: V6DConstrainautorPoint
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

const comparePoint = (left: V6ContourPoint, right: V6ContourPoint): number =>
  left.y - right.y || left.x - right.x;

const undirectedEdgeKey = (left: number, right: number): string =>
  left < right ? `${left}:${right}` : `${right}:${left}`;

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

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Math.trunc(value), min), max);

const mustGet = <T>(items: readonly T[] | ArrayLike<T>, index: number): T => {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`v6d constrainautor mesh generation internal index out of range: ${index}`);
  }

  return item;
};
