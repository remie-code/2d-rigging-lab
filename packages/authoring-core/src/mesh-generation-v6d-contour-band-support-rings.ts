import type { DrawableId, MeshId, ProvenanceId, RectDto, TriangleId } from "@private-2d-rigging-lab/contracts";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";

import {
  getV6MeshGenerationCandidate,
  type DrawableGeneratedMeshSource,
  type MeshDensityHint,
  type MeshGenerationFallbackReason,
  type MeshGenerationFallbackStep
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
  recoverV6DConstrainautorTriangles,
  type V6DConstrainautorPoint
} from "./mesh-generation-v6d-contour-constrainautor.js";
import {
  computeMeshQualityMetrics,
  type MeshGenerationQualityMetrics,
  type MeshGenerationV6ConstrainautorDiagnostics,
  type MeshGenerationV6ContourPipelineDiagnostics,
  type MeshGenerationV6SupportRingDiagnostics
} from "./mesh-quality-metrics.js";

export interface AutoOutlineV6DContourBandSupportRingsMeshInput {
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

export type AutoOutlineV6DContourBandSupportRingsMeshResult =
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
      readonly reason: "alpha-empty" | "v6-contour-extraction-failed";
      readonly opaquePixelCount?: number;
      readonly alphaBounds?: RectDto;
      readonly contourPipeline?: V6ContourPipelineResult;
    };

export type V6DSupportRingRole =
  | "outer-support"
  | "alpha-boundary"
  | "inner-support"
  | "interior";

export interface V6DSupportRingTriangleFilterPoint {
  readonly x: number;
  readonly y: number;
  readonly ringRole: V6DSupportRingRole;
}

export interface V6DSupportRingFilteredTriangles {
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly removedTriangleCount: number;
  readonly outsideOrCrossingTriangleCount: number;
  readonly supportBandTriangleCount: number;
  readonly alphaBoundaryBandTriangleCount: number;
  readonly interiorTriangleCount: number;
}

interface V6DSupportRingPoint extends V6DConstrainautorPoint {
  readonly ringRole: V6DSupportRingRole;
  readonly sourceBoundaryIndex: number;
  readonly uvPoint: V6ContourPoint;
}

interface V6DSupportRingDiagnostics {
  readonly constrainautorDiagnostics: MeshGenerationV6ConstrainautorDiagnostics;
  readonly supportRingDiagnostics: MeshGenerationV6SupportRingDiagnostics;
}

type SupportRingGeometryResult =
  | {
      readonly status: "generated";
      readonly points: readonly V6DSupportRingPoint[];
      readonly constraintEdges: readonly V6ContourConstraintEdge[];
      readonly outerRingEdges: readonly V6ContourConstraintEdge[];
      readonly alphaRingEdges: readonly V6ContourConstraintEdge[];
      readonly innerRingEdges: readonly V6ContourConstraintEdge[];
      readonly bridgeConstraintCount: number;
      readonly outerRingPointCount: number;
      readonly alphaBoundaryRingPointCount: number;
      readonly innerRingPointCount: number;
      readonly skippedRingPointCount: number;
      readonly mergedRingPointCount: number;
      readonly ringSelfIntersectionCount: number;
      readonly outerRingOffset: number;
      readonly innerRingOffset: number;
    }
  | {
      readonly status: "failed";
      readonly reason: "v6d-support-ring-geometry-invalid";
      readonly partialPointCount: number;
      readonly constraintEdgeCount: number;
      readonly outerRingPointCount: number;
      readonly alphaBoundaryRingPointCount: number;
      readonly innerRingPointCount: number;
      readonly skippedRingPointCount: number;
      readonly mergedRingPointCount: number;
      readonly ringSelfIntersectionCount: number;
      readonly bridgeConstraintCount: number;
      readonly outerRingOffset: number;
      readonly innerRingOffset: number;
    };

interface SupportRingParameters {
  readonly outerOffset: number;
  readonly innerOffset: number;
}

interface PixelBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const TRIANGLE_AREA_EPSILON = 0.000001;
const POINT_KEY_SCALE = 1_000_000;

export const createAutoOutlineV6DContourBandSupportRingsMesh = (
  input: AutoOutlineV6DContourBandSupportRingsMeshInput
): AutoOutlineV6DContourBandSupportRingsMeshResult => {
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
  const ringGeometry = createSupportRingGeometry(candidateInput, input.densityHint ?? "medium");
  if (ringGeometry.status === "failed") {
    return createVisibleSupportRingFallback({
      input,
      candidateInput,
      contourPipeline,
      reason: ringGeometry.reason,
      diagnostics: createSupportRingDiagnostics({
        dependencyGateStatus: "available",
        constraintEdgeCount: ringGeometry.constraintEdgeCount,
        preservedConstraintEdgeCount: 0,
        missingConstraintEdgeCount: ringGeometry.constraintEdgeCount,
        constraintRecoveryFailed: true,
        outsideTriangleCount: 0,
        ringGeometry,
        filtered: emptyFilteredTriangles(),
        outsideLayer: { verticesExtendOutsideLayerBounds: false, maxOutsideLayerDistance: 0 }
      }),
      provenance: createSupportRingFallbackProvenance(candidateInput, ringGeometry.reason, [
        "v6d-support-ring-geometry-invalid"
      ])
    });
  }

  const recovery = recoverV6DConstrainautorTriangles({
    points: ringGeometry.points,
    constraintEdges: ringGeometry.constraintEdges
  });
  if (recovery.status === "failed") {
    const fallbackReason =
      recovery.reason === "v6d-backend-threw"
        ? "v6d-backend-threw"
        : "v6d-support-ring-constraint-recovery-failed";
    return createVisibleSupportRingFallback({
      input,
      candidateInput,
      contourPipeline,
      reason: fallbackReason,
      diagnostics: createSupportRingDiagnostics({
        ...recovery.diagnostics,
        outsideTriangleCount: 0,
        ringGeometry,
        filtered: emptyFilteredTriangles(),
        outsideLayer: { verticesExtendOutsideLayerBounds: false, maxOutsideLayerDistance: 0 }
      }),
      provenance: createSupportRingFallbackProvenance(candidateInput, fallbackReason, [
        "v6d-support-ring-constrainautor-recovery-failed"
      ])
    });
  }

  const recoveredPoints = recovery.points as readonly V6DSupportRingPoint[];
  const filtered = filterSupportRingTriangles({
    points: recoveredPoints,
    triangles: recovery.triangles,
    outerRingEdges: remapEdgesForRecoveredPoints(recoveredPoints, ringGeometry.outerRingEdges, ringGeometry.points),
    alphaRingEdges: remapEdgesForRecoveredPoints(recoveredPoints, ringGeometry.alphaRingEdges, ringGeometry.points),
    alphaBoundaryRing: recoveredPoints.filter((point) => point.ringRole === "alpha-boundary"),
    outerSupportRing: recoveredPoints.filter((point) => point.ringRole === "outer-support")
  });
  const finalConstraintCounts = countPreservedConstraintEdges(
    filtered.triangles,
    recoveredPoints,
    recovery.constraintEdges
  );
  const outsideLayer = computeOutsideLayerBoundsMetrics(
    recoveredPoints.map((point) =>
      mapV6ContourPointToStagePoint(
        point,
        input.bounds,
        candidateInput.textureSize.width,
        candidateInput.textureSize.height
      )
    ),
    input.bounds
  );
  const diagnostics = createSupportRingDiagnostics({
    ...recovery.diagnostics,
    preservedConstraintEdgeCount: finalConstraintCounts.preserved,
    missingConstraintEdgeCount: finalConstraintCounts.missing,
    constraintRecoveryFailed: finalConstraintCounts.missing > 0,
    outsideTriangleCount: filtered.outsideOrCrossingTriangleCount,
    ringGeometry,
    filtered,
    outsideLayer
  });

  if (filtered.triangles.length === 0 || finalConstraintCounts.missing > 0) {
    return createVisibleSupportRingFallback({
      input,
      candidateInput,
      contourPipeline,
      reason: "v6d-support-ring-constraint-recovery-failed",
      diagnostics,
      provenance: createSupportRingFallbackProvenance(
        candidateInput,
        "v6d-support-ring-constraint-recovery-failed",
        ["v6d-support-ring-final-constraint-verification-failed"]
      )
    });
  }

  return createGeneratedSupportRingMesh({
    input,
    candidateInput,
    contourPipeline,
    points: recoveredPoints,
    triangles: filtered.triangles,
    diagnostics,
    filtered
  });
};

export const probeV6DSupportRingTriangleFilterForTest = (input: {
  readonly points: readonly V6DSupportRingTriangleFilterPoint[];
  readonly outerRingEdges: readonly (readonly [number, number])[];
  readonly alphaRingEdges: readonly (readonly [number, number])[];
  readonly triangles: readonly (readonly [number, number, number])[];
}): V6DSupportRingFilteredTriangles => filterSupportRingTriangles({
  points: input.points,
  triangles: input.triangles,
  outerRingEdges: input.outerRingEdges,
  alphaRingEdges: input.alphaRingEdges,
  alphaBoundaryRing: input.points.filter((point) => point.ringRole === "alpha-boundary"),
  outerSupportRing: input.points.filter((point) => point.ringRole === "outer-support")
});

export const probeV6DSupportRingGeometryFallbackForTest =
  (): AutoOutlineV6DContourBandSupportRingsMeshResult => {
    const textureSize = { width: 8, height: 8 };
    const bounds = { x: 0, y: 0, width: 8, height: 8 };
    const rgbaBytes = createProbeRgbaBytes(textureSize.width, textureSize.height, (x, y) =>
      x >= 2 && x <= 5 && y >= 2 && y <= 5
    );
    const input: AutoOutlineV6DContourBandSupportRingsMeshInput = {
      meshId: "mesh_v6d_support_probe" as MeshId,
      drawableId: "draw_v6d_support_probe" as DrawableId,
      bounds,
      provenanceId: "prov_v6d_support_probe" as ProvenanceId,
      textureSize,
      rgbaBytes,
      densityHint: "medium"
    };
    const contourPipeline = createV6ContourCandidateInput({
      textureSize,
      meshBounds: bounds,
      rgbaBytes,
      densityHint: "medium"
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
    const parameters = getSupportRingParameters("medium");
    const ringGeometry: SupportRingGeometryResult = {
      status: "failed",
      reason: "v6d-support-ring-geometry-invalid",
      partialPointCount: candidateInput.boundaryPoints.length * 2,
      constraintEdgeCount: candidateInput.boundaryPoints.length,
      outerRingPointCount: candidateInput.boundaryPoints.length,
      alphaBoundaryRingPointCount: candidateInput.boundaryPoints.length,
      innerRingPointCount: 0,
      skippedRingPointCount: 0,
      mergedRingPointCount: 1,
      ringSelfIntersectionCount: 1,
      bridgeConstraintCount: 0,
      outerRingOffset: parameters.outerOffset,
      innerRingOffset: parameters.innerOffset
    };

    return createVisibleSupportRingFallback({
      input,
      candidateInput,
      contourPipeline,
      reason: ringGeometry.reason,
      diagnostics: createSupportRingDiagnostics({
        dependencyGateStatus: "available",
        constraintEdgeCount: ringGeometry.constraintEdgeCount,
        preservedConstraintEdgeCount: 0,
        missingConstraintEdgeCount: ringGeometry.constraintEdgeCount,
        constraintRecoveryFailed: true,
        outsideTriangleCount: 0,
        ringGeometry,
        filtered: emptyFilteredTriangles(),
        outsideLayer: { verticesExtendOutsideLayerBounds: false, maxOutsideLayerDistance: 0 }
      }),
      provenance: createSupportRingFallbackProvenance(candidateInput, ringGeometry.reason, [
        "v6d-support-ring-test-probe-invalid-geometry"
      ])
    });
  };

const createSupportRingGeometry = (
  candidateInput: V6ContourCandidateInput,
  densityHint: MeshDensityHint
): SupportRingGeometryResult => {
  const alphaPoints = candidateInput.boundaryPoints;
  const parameters = getSupportRingParameters(densityHint);
  if (alphaPoints.length < 3) {
    return {
      status: "failed",
      reason: "v6d-support-ring-geometry-invalid",
      partialPointCount: alphaPoints.length,
      constraintEdgeCount: 0,
      outerRingPointCount: 0,
      alphaBoundaryRingPointCount: alphaPoints.length,
      innerRingPointCount: 0,
      skippedRingPointCount: 0,
      mergedRingPointCount: 0,
      ringSelfIntersectionCount: 0,
      bridgeConstraintCount: 0,
      outerRingOffset: parameters.outerOffset,
      innerRingOffset: parameters.innerOffset
    };
  }

  const outerPoints = alphaPoints.map((point, index) => {
    const normal = estimateOutwardNormal(candidateInput, index);
    return roundPixelPoint({
      x: point.x + normal.x * parameters.outerOffset,
      y: point.y + normal.y * parameters.outerOffset
    });
  });
  const outerSelfIntersectionCount = countPolygonSelfIntersections(outerPoints);
  const outerDuplicateCount = countDuplicatePoints(outerPoints);
  if (outerPoints.length < 3 || outerSelfIntersectionCount > 0 || outerDuplicateCount > 0) {
    return {
      status: "failed",
      reason: "v6d-support-ring-geometry-invalid",
      partialPointCount: outerPoints.length + alphaPoints.length,
      constraintEdgeCount: 0,
      outerRingPointCount: outerPoints.length,
      alphaBoundaryRingPointCount: alphaPoints.length,
      innerRingPointCount: 0,
      skippedRingPointCount: 0,
      mergedRingPointCount: outerDuplicateCount,
      ringSelfIntersectionCount: outerSelfIntersectionCount,
      bridgeConstraintCount: 0,
      outerRingOffset: parameters.outerOffset,
      innerRingOffset: parameters.innerOffset
    };
  }

  const usedInnerKeys = new Set(alphaPoints.map(pointKey));
  const innerPointsByBoundaryIndex: { readonly point: V6ContourPoint; readonly sourceBoundaryIndex: number }[] = [];
  const alphaCentroid = polygonCentroid(alphaPoints);
  let skippedRingPointCount = 0;
  let mergedRingPointCount = 0;
  for (let index = 0; index < alphaPoints.length; index += 1) {
    const boundaryPoint = mustGet(alphaPoints, index);
    const normal = estimateOutwardNormal(candidateInput, index);
    const innerPoint = findSafeInnerPoint({
      point: boundaryPoint,
      outwardNormal: normal,
      alphaCentroid,
      innerOffset: parameters.innerOffset,
      candidateInput
    });
    if (innerPoint === undefined) {
      skippedRingPointCount += 1;
      continue;
    }

    const key = pointKey(innerPoint);
    if (usedInnerKeys.has(key)) {
      mergedRingPointCount += 1;
      continue;
    }

    usedInnerKeys.add(key);
    innerPointsByBoundaryIndex.push({ point: innerPoint, sourceBoundaryIndex: index });
  }

  let safeInnerPoints = innerPointsByBoundaryIndex;
  let innerSelfIntersectionCount = 0;
  if (safeInnerPoints.length >= 3) {
    innerSelfIntersectionCount = countPolygonSelfIntersections(safeInnerPoints.map((inner) => inner.point));
    if (innerSelfIntersectionCount > 0) {
      skippedRingPointCount += safeInnerPoints.length;
      safeInnerPoints = [];
      innerSelfIntersectionCount = 0;
    }
  }

  const outerStart = 0;
  const alphaStart = outerPoints.length;
  const innerStart = alphaStart + alphaPoints.length;
  const innerPolygon = safeInnerPoints.map((inner) => inner.point);
  const supportRingPointKeys = new Set(
    [...outerPoints, ...alphaPoints, ...innerPolygon].map(pointKey)
  );
  const interiorPoints =
    innerPolygon.length >= 3
      ? candidateInput.interiorPoints.filter(
          (point) =>
            isPointInsidePolygonOrOnBoundary(innerPolygon, point) &&
            !supportRingPointKeys.has(pointKey(point))
        )
      : candidateInput.interiorPoints.filter((point) => !supportRingPointKeys.has(pointKey(point)));
  const points: V6DSupportRingPoint[] = [
    ...outerPoints.map((point, index) => ({
      ...point,
      role: "boundary" as const,
      ringRole: "outer-support" as const,
      sourceBoundaryIndex: index,
      stableOrder: index,
      uvPoint: mustGet(alphaPoints, index)
    })),
    ...alphaPoints.map((point, index) => ({
      ...point,
      role: "boundary" as const,
      ringRole: "alpha-boundary" as const,
      sourceBoundaryIndex: index,
      stableOrder: alphaStart + index,
      uvPoint: point
    })),
    ...safeInnerPoints.map((inner, index) => ({
      ...inner.point,
      role: "boundary" as const,
      ringRole: "inner-support" as const,
      sourceBoundaryIndex: inner.sourceBoundaryIndex,
      stableOrder: innerStart + index,
      uvPoint: inner.point
    })),
    ...interiorPoints.map((point, index) => ({
      ...point,
      role: "interior" as const,
      ringRole: "interior" as const,
      sourceBoundaryIndex: index,
      stableOrder: index,
      uvPoint: point
    }))
  ];
  const outerRingEdges = createLoopEdges(outerStart, outerPoints.length);
  const alphaRingEdges = createLoopEdges(alphaStart, alphaPoints.length);
  let activeInnerRingEdges =
    safeInnerPoints.length >= 3 ? createLoopEdges(innerStart, safeInnerPoints.length) : [];
  let baseEdges = [...outerRingEdges, ...alphaRingEdges, ...activeInnerRingEdges];
  if (constraintsAreInvalid(points, baseEdges)) {
    const withoutInner = [
      ...outerRingEdges,
      ...alphaRingEdges
    ];
    if (constraintsAreInvalid(points, withoutInner)) {
      return {
        status: "failed",
        reason: "v6d-support-ring-geometry-invalid",
        partialPointCount: points.length,
        constraintEdgeCount: baseEdges.length,
        outerRingPointCount: outerPoints.length,
        alphaBoundaryRingPointCount: alphaPoints.length,
        innerRingPointCount: safeInnerPoints.length,
        skippedRingPointCount,
        mergedRingPointCount,
        ringSelfIntersectionCount: outerSelfIntersectionCount + innerSelfIntersectionCount,
        bridgeConstraintCount: 0,
        outerRingOffset: parameters.outerOffset,
        innerRingOffset: parameters.innerOffset
      };
    }

    skippedRingPointCount += safeInnerPoints.length;
    activeInnerRingEdges = [];
    baseEdges = withoutInner;
  }

  const bridgeEdges = createBridgeEdges({
    outerStart,
    alphaStart,
    alphaPointCount: alphaPoints.length,
    innerStart,
    innerPoints: safeInnerPoints
  });
  const edgesWithBridges = [...baseEdges, ...bridgeEdges];
  const constraintEdges = constraintsAreInvalid(points, edgesWithBridges) ? baseEdges : edgesWithBridges;
  const bridgeConstraintCount = constraintEdges.length - baseEdges.length;

  return {
    status: "generated",
    points,
    constraintEdges,
    outerRingEdges,
    alphaRingEdges,
    innerRingEdges: activeInnerRingEdges,
    bridgeConstraintCount,
    outerRingPointCount: outerPoints.length,
    alphaBoundaryRingPointCount: alphaPoints.length,
    innerRingPointCount: safeInnerPoints.length,
    skippedRingPointCount,
    mergedRingPointCount,
    ringSelfIntersectionCount: outerSelfIntersectionCount + innerSelfIntersectionCount,
    outerRingOffset: parameters.outerOffset,
    innerRingOffset: parameters.innerOffset
  };
};

const createGeneratedSupportRingMesh = (input: {
  readonly input: AutoOutlineV6DContourBandSupportRingsMeshInput;
  readonly candidateInput: V6ContourCandidateInput;
  readonly contourPipeline: Extract<V6ContourPipelineResult, { readonly status: "generated" }>;
  readonly points: readonly V6DSupportRingPoint[];
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly diagnostics: V6DSupportRingDiagnostics;
  readonly filtered: V6DSupportRingFilteredTriangles;
}): AutoOutlineV6DContourBandSupportRingsMeshResult => {
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6d-contour-band-support-rings");
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
      mapV6ContourPointToUv(point.uvPoint, input.candidateInput.textureSize.width, input.candidateInput.textureSize.height)
    ),
    triangles: input.triangles.map((triangle) => [...triangle] as [number, number, number]),
    vertexStableIds: input.points.map((point, index) => {
      switch (point.ringRole) {
        case "outer-support":
          return `vtx_${token}_v6d_support_outer_${point.sourceBoundaryIndex}_${index}`;
        case "alpha-boundary":
          return `vtx_${token}_v6d_support_alpha_${point.sourceBoundaryIndex}_${index}`;
        case "inner-support":
          return `vtx_${token}_v6d_support_inner_${point.sourceBoundaryIndex}_${index}`;
        case "interior":
          return `vtx_${token}_v6d_support_interior_${point.stableOrder}_${index}`;
      }
    }),
    triangleStableIds: input.triangles.map((_triangle, index) => `tri_${token}_v6d_support_${index}` as TriangleId),
    topologyRevision: 0,
    bounds: structuredClone(input.input.bounds),
    generationProvenanceId: input.input.provenanceId
  };
  const boundaryVertexCount = input.points.filter((point) => point.ringRole === "alpha-boundary").length;
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
      provenance: createSupportRingSuccessProvenance(input.candidateInput),
      contourPipelineDiagnostics: createV6ContourPipelineDiagnostics(input.contourPipeline),
      constrainautorDiagnostics: input.diagnostics.constrainautorDiagnostics,
      supportRingDiagnostics: input.diagnostics.supportRingDiagnostics
    }
  });

  return {
    status: "generated",
    mesh,
    alphaBounds: input.candidateInput.alphaBounds.stageBounds,
    qualityMetrics
  };
};

const createVisibleSupportRingFallback = (input: {
  readonly input: AutoOutlineV6DContourBandSupportRingsMeshInput;
  readonly candidateInput: V6ContourCandidateInput;
  readonly contourPipeline: Extract<V6ContourPipelineResult, { readonly status: "generated" }>;
  readonly reason: MeshGenerationFallbackReason;
  readonly diagnostics: V6DSupportRingDiagnostics;
  readonly provenance: readonly string[];
}): AutoOutlineV6DContourBandSupportRingsMeshResult => {
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6d-contour-band-support-rings");
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
      outsideOrCrossingTriangleCount: input.diagnostics.constrainautorDiagnostics.outsideTriangleCount,
      multiIslandHandling: input.candidateInput.diagnostics.multiIslandHandling,
      holeHandling: input.candidateInput.diagnostics.holeHandling,
      provenance: input.provenance,
      contourPipelineDiagnostics: createV6ContourPipelineDiagnostics(input.contourPipeline),
      constrainautorDiagnostics: input.diagnostics.constrainautorDiagnostics,
      supportRingDiagnostics: input.diagnostics.supportRingDiagnostics
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

const filterSupportRingTriangles = (input: {
  readonly points: readonly V6DSupportRingTriangleFilterPoint[];
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly outerRingEdges: readonly (readonly [number, number])[];
  readonly alphaRingEdges: readonly (readonly [number, number])[];
  readonly alphaBoundaryRing: readonly V6DSupportRingTriangleFilterPoint[];
  readonly outerSupportRing: readonly V6DSupportRingTriangleFilterPoint[];
}): V6DSupportRingFilteredTriangles => {
  const filtered: [number, number, number][] = [];
  let removedTriangleCount = 0;
  let outsideOrCrossingTriangleCount = 0;
  let supportBandTriangleCount = 0;
  let alphaBoundaryBandTriangleCount = 0;
  let interiorTriangleCount = 0;

  for (const triangle of input.triangles) {
    if (
      hasDuplicateTriangleIndex(triangle) ||
      Math.abs(triangleAreaByIndex(input.points, triangle)) <= TRIANGLE_AREA_EPSILON
    ) {
      removedTriangleCount += 1;
      continue;
    }

    const centroid = triangleCentroid(input.points, triangle);
    const outsideSupportEnvelope = !isPointInsidePolygonOrOnBoundary(input.outerSupportRing, centroid);
    const crossesOuterEnvelope = triangleCrossesEdges(input.points, triangle, input.outerRingEdges);
    if (outsideSupportEnvelope || crossesOuterEnvelope) {
      outsideOrCrossingTriangleCount += 1;
      removedTriangleCount += 1;
      continue;
    }

    const touchesOuterRing = triangle.some((index) => input.points[index]?.ringRole === "outer-support");
    const touchesAlphaRing = triangle.some((index) => input.points[index]?.ringRole === "alpha-boundary");
    const centroidInsideAlpha = isPointInsidePolygonOrOnBoundary(input.alphaBoundaryRing, centroid);
    if (touchesOuterRing || !centroidInsideAlpha) {
      supportBandTriangleCount += 1;
    } else if (touchesAlphaRing) {
      alphaBoundaryBandTriangleCount += 1;
    } else {
      interiorTriangleCount += 1;
    }

    filtered.push([triangle[0], triangle[1], triangle[2]]);
  }

  return {
    triangles: normalizeTriangles(filtered, input.points),
    removedTriangleCount,
    outsideOrCrossingTriangleCount,
    supportBandTriangleCount,
    alphaBoundaryBandTriangleCount,
    interiorTriangleCount
  };
};

const createSupportRingDiagnostics = (input: {
  readonly dependencyGateStatus: MeshGenerationV6ConstrainautorDiagnostics["dependencyGateStatus"];
  readonly constraintEdgeCount: number;
  readonly preservedConstraintEdgeCount: number;
  readonly missingConstraintEdgeCount: number;
  readonly constraintRecoveryFailed: boolean;
  readonly outsideTriangleCount: number;
  readonly thrownErrorKind?: string;
  readonly ringGeometry: SupportRingGeometryResult;
  readonly filtered: V6DSupportRingFilteredTriangles;
  readonly outsideLayer: {
    readonly verticesExtendOutsideLayerBounds: boolean;
    readonly maxOutsideLayerDistance: number;
  };
}): V6DSupportRingDiagnostics => ({
  constrainautorDiagnostics: {
    dependencyGateStatus: input.dependencyGateStatus,
    constraintEdgeCount: input.constraintEdgeCount,
    preservedConstraintEdgeCount: input.preservedConstraintEdgeCount,
    missingConstraintEdgeCount: input.missingConstraintEdgeCount,
    constraintRecoveryFailed: input.constraintRecoveryFailed,
    outsideTriangleCount: input.outsideTriangleCount,
    ...(input.thrownErrorKind === undefined ? {} : { thrownErrorKind: input.thrownErrorKind })
  },
  supportRingDiagnostics: {
    boundaryRingPointCount: input.ringGeometry.alphaBoundaryRingPointCount,
    alphaBoundaryRingPointCount: input.ringGeometry.alphaBoundaryRingPointCount,
    outerRingPointCount: input.ringGeometry.outerRingPointCount,
    innerRingPointCount: input.ringGeometry.innerRingPointCount,
    skippedRingPointCount: input.ringGeometry.skippedRingPointCount,
    mergedRingPointCount: input.ringGeometry.mergedRingPointCount,
    ringSelfIntersectionCount: input.ringGeometry.ringSelfIntersectionCount,
    bridgeConstraintCount: input.ringGeometry.bridgeConstraintCount,
    supportBandTriangleCount: input.filtered.supportBandTriangleCount,
    alphaBoundaryBandTriangleCount: input.filtered.alphaBoundaryBandTriangleCount,
    interiorTriangleCount: input.filtered.interiorTriangleCount,
    verticesExtendOutsideLayerBounds: input.outsideLayer.verticesExtendOutsideLayerBounds,
    maxOutsideLayerDistance: input.outsideLayer.maxOutsideLayerDistance,
    outerRingOffset: input.ringGeometry.outerRingOffset,
    innerRingOffset: input.ringGeometry.innerRingOffset,
    outerRingUvPolicy: "projected-to-alpha-boundary"
  }
});

const createAlphaBoundsFallbackMesh = (input: {
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
    vertexStableIds.push(`vtx_${token}_v6d_support_fallback_${row}_${column}`);
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
      triangleStableIds.push(`tri_${token}_v6d_support_fallback_${row}_${column}_a` as TriangleId);
      triangles.push([topRight, bottomRight, bottomLeft]);
      triangleStableIds.push(`tri_${token}_v6d_support_fallback_${row}_${column}_b` as TriangleId);
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
          `vtx_${token}_v6d_support_fallback_bounds_0`,
          `vtx_${token}_v6d_support_fallback_bounds_1`,
          `vtx_${token}_v6d_support_fallback_bounds_2`,
          `vtx_${token}_v6d_support_fallback_bounds_3`
        ],
        triangleStableIds: [
          `tri_${token}_v6d_support_fallback_bounds_a` as TriangleId,
          `tri_${token}_v6d_support_fallback_bounds_b` as TriangleId
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

const createSupportRingSuccessProvenance = (
  candidateInput: V6ContourCandidateInput
): readonly string[] => [
  ...candidateInput.diagnostics.provenance,
  "dependency-available",
  "v6d-support-rings-outer-ring",
  "v6d-support-rings-alpha-boundary-ring",
  "v6d-support-rings-inner-ring",
  "v6d-support-rings-outer-uv-projected-to-alpha-boundary",
  "v6d-support-rings-delaunator-all-points",
  "v6d-support-rings-constrainautor-constraint-recovery",
  "v6d-support-rings-support-envelope-triangle-filter",
  "v6d-support-rings-constraints-verified"
];

const createSupportRingFallbackProvenance = (
  candidateInput: V6ContourCandidateInput,
  reason: MeshGenerationFallbackReason,
  details: readonly string[]
): readonly string[] => [
  ...candidateInput.diagnostics.provenance,
  "dependency-available",
  "v6d-support-rings-visible-fallback",
  `fallback-${reason}`,
  ...details
];

const getSupportRingParameters = (densityHint: MeshDensityHint): SupportRingParameters => {
  switch (densityHint) {
    case "high":
      return { outerOffset: 4, innerOffset: 2.5 };
    case "medium":
      return { outerOffset: 2.5, innerOffset: 1.75 };
    case "low":
      return { outerOffset: 1.25, innerOffset: 0.9 };
  }
};

const estimateOutwardNormal = (
  candidateInput: V6ContourCandidateInput,
  index: number
): V6ContourPoint => {
  const points = candidateInput.boundaryPoints;
  const previous = mustGet(points, (index - 1 + points.length) % points.length);
  const next = mustGet(points, (index + 1) % points.length);
  const tangent = normalizeVector({
    x: next.x - previous.x,
    y: next.y - previous.y
  });
  const leftCandidate = normalizeVector({ x: -tangent.y, y: tangent.x });
  const rightCandidate = { x: -leftCandidate.x, y: -leftCandidate.y };
  const point = mustGet(points, index);
  const leftInside = isPointInsideAlphaRegion(candidateInput, {
    x: point.x + leftCandidate.x * 0.75,
    y: point.y + leftCandidate.y * 0.75
  });
  const rightInside = isPointInsideAlphaRegion(candidateInput, {
    x: point.x + rightCandidate.x * 0.75,
    y: point.y + rightCandidate.y * 0.75
  });
  if (leftInside && !rightInside) {
    return rightCandidate;
  }
  if (rightInside && !leftInside) {
    return leftCandidate;
  }

  const signedArea = polygonSignedArea(points);
  return signedArea >= 0
    ? normalizeVector({ x: tangent.y, y: -tangent.x })
    : normalizeVector({ x: -tangent.y, y: tangent.x });
};

const findSafeInnerPoint = (input: {
  readonly point: V6ContourPoint;
  readonly outwardNormal: V6ContourPoint;
  readonly alphaCentroid: V6ContourPoint;
  readonly innerOffset: number;
  readonly candidateInput: V6ContourCandidateInput;
}): V6ContourPoint | undefined => {
  const inwardCandidates = [
    normalizeVector({
      x: input.alphaCentroid.x - input.point.x,
      y: input.alphaCentroid.y - input.point.y
    }),
    { x: -input.outwardNormal.x, y: -input.outwardNormal.y }
  ];
  for (const inward of inwardCandidates) {
    for (const scale of [1, 0.75, 0.5, 0.25] as const) {
      const candidate = roundPixelPoint({
        x: input.point.x + inward.x * input.innerOffset * scale,
        y: input.point.y + inward.y * input.innerOffset * scale
      });
      if (isPointInsideAlphaRegion(input.candidateInput, candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
};

const isPointInsideAlphaRegion = (
  candidateInput: V6ContourCandidateInput,
  point: V6ContourPoint
): boolean =>
  isPointInsidePolygonOrOnBoundary(candidateInput.boundaryPoints, point) ||
  isPointInsideMainMask(candidateInput.mainMask, candidateInput.textureSize.width, point);

const isPointInsideMainMask = (
  mask: readonly boolean[],
  width: number,
  point: V6ContourPoint
): boolean => {
  const x = Math.floor(point.x);
  const y = Math.floor(point.y);
  if (x < 0 || x >= width || y < 0 || y * width + x >= mask.length) {
    return false;
  }

  return mask[y * width + x] === true;
};

const createLoopEdges = (
  start: number,
  count: number
): readonly V6ContourConstraintEdge[] => {
  if (count < 3) {
    return [];
  }

  return Array.from({ length: count }, (_value, index) => [start + index, start + ((index + 1) % count)] as const);
};

const createBridgeEdges = (input: {
  readonly outerStart: number;
  readonly alphaStart: number;
  readonly alphaPointCount: number;
  readonly innerStart: number;
  readonly innerPoints: readonly { readonly sourceBoundaryIndex: number }[];
}): readonly V6ContourConstraintEdge[] => [
  ...Array.from(
    { length: input.alphaPointCount },
    (_value, index) => [input.outerStart + index, input.alphaStart + index] as const
  ),
  ...input.innerPoints.map(
    (inner, index) => [input.alphaStart + inner.sourceBoundaryIndex, input.innerStart + index] as const
  )
];

const constraintsAreInvalid = (
  points: readonly V6DSupportRingPoint[],
  edges: readonly V6ContourConstraintEdge[]
): boolean =>
  edges.length < 3 ||
  countCrossingConstraintEdges(points, edges) > 0 ||
  countConstraintPointIntersections(points, edges) > 0;

const remapEdgesForRecoveredPoints = (
  recoveredPoints: readonly V6DSupportRingPoint[],
  originalEdges: readonly V6ContourConstraintEdge[],
  originalPoints: readonly V6DSupportRingPoint[]
): readonly V6ContourConstraintEdge[] => {
  const recoveredIndexByKey = new Map(recoveredPoints.map((point, index) => [pointKey(point), index]));
  const remapped: V6ContourConstraintEdge[] = [];
  for (const [left, right] of originalEdges) {
    const leftPoint = originalPoints[left];
    const rightPoint = originalPoints[right];
    const leftIndex = leftPoint === undefined ? undefined : recoveredIndexByKey.get(pointKey(leftPoint));
    const rightIndex = rightPoint === undefined ? undefined : recoveredIndexByKey.get(pointKey(rightPoint));
    if (leftIndex === undefined || rightIndex === undefined || leftIndex === rightIndex) {
      continue;
    }

    remapped.push([leftIndex, rightIndex]);
  }

  return remapped;
};

const countPreservedConstraintEdges = (
  triangles: readonly (readonly [number, number, number])[],
  points: readonly V6DSupportRingPoint[],
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
  points: readonly V6DSupportRingTriangleFilterPoint[],
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
  points: readonly V6DSupportRingTriangleFilterPoint[],
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

const triangleCrossesEdges = (
  points: readonly V6DSupportRingTriangleFilterPoint[],
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

const countPolygonSelfIntersections = (
  points: readonly V6ContourPoint[]
): number => {
  if (points.length < 4) {
    return 0;
  }

  let count = 0;
  for (let leftIndex = 0; leftIndex < points.length; leftIndex += 1) {
    const leftNext = (leftIndex + 1) % points.length;
    for (let rightIndex = leftIndex + 1; rightIndex < points.length; rightIndex += 1) {
      const rightNext = (rightIndex + 1) % points.length;
      if (
        leftIndex === rightIndex ||
        leftNext === rightIndex ||
        rightNext === leftIndex
      ) {
        continue;
      }

      if (
        segmentsIntersect(
          mustGet(points, leftIndex),
          mustGet(points, leftNext),
          mustGet(points, rightIndex),
          mustGet(points, rightNext)
        )
      ) {
        count += 1;
      }
    }
  }

  return count;
};

const countDuplicatePoints = (points: readonly V6ContourPoint[]): number => {
  const keys = new Set<string>();
  let count = 0;
  for (const point of points) {
    const key = pointKey(point);
    if (keys.has(key)) {
      count += 1;
      continue;
    }

    keys.add(key);
  }

  return count;
};

const emptyFilteredTriangles = (): V6DSupportRingFilteredTriangles => ({
  triangles: [],
  removedTriangleCount: 0,
  outsideOrCrossingTriangleCount: 0,
  supportBandTriangleCount: 0,
  alphaBoundaryBandTriangleCount: 0,
  interiorTriangleCount: 0
});

const computeOutsideLayerBoundsMetrics = (
  vertices: readonly V6ContourPoint[],
  bounds: RectDto
): {
  readonly verticesExtendOutsideLayerBounds: boolean;
  readonly maxOutsideLayerDistance: number;
} => {
  let maxOutsideLayerDistance = 0;
  for (const vertex of vertices) {
    const dx = vertex.x < bounds.x
      ? bounds.x - vertex.x
      : vertex.x > bounds.x + bounds.width
        ? vertex.x - (bounds.x + bounds.width)
        : 0;
    const dy = vertex.y < bounds.y
      ? bounds.y - vertex.y
      : vertex.y > bounds.y + bounds.height
        ? vertex.y - (bounds.y + bounds.height)
        : 0;
    maxOutsideLayerDistance = Math.max(maxOutsideLayerDistance, Math.hypot(dx, dy));
  }

  return {
    verticesExtendOutsideLayerBounds: maxOutsideLayerDistance > 0,
    maxOutsideLayerDistance: roundCoordinate(maxOutsideLayerDistance)
  };
};

const normalizeTriangles = (
  triangles: readonly (readonly [number, number, number])[],
  points: readonly V6DSupportRingTriangleFilterPoint[]
): readonly (readonly [number, number, number])[] =>
  triangles
    .map((triangle) => orientTrianglePositive(points, triangle))
    .sort((left, right) =>
      left[0] - right[0] ||
      left[1] - right[1] ||
      left[2] - right[2]
    );

const orientTrianglePositive = (
  points: readonly V6DSupportRingTriangleFilterPoint[],
  triangle: readonly [number, number, number]
): readonly [number, number, number] =>
  triangleAreaByIndex(points, triangle) < 0
    ? [triangle[0], triangle[2], triangle[1]]
    : [triangle[0], triangle[1], triangle[2]];

const triangleCentroid = (
  points: readonly V6DSupportRingTriangleFilterPoint[],
  triangle: readonly [number, number, number]
): V6ContourPoint => {
  const a = mustGet(points, triangle[0]);
  const b = mustGet(points, triangle[1]);
  const c = mustGet(points, triangle[2]);
  return {
    x: (a.x + b.x + c.x) / 3,
    y: (a.y + b.y + c.y) / 3
  };
};

const isPointInsidePolygonOrOnBoundary = (
  polygon: readonly V6ContourPoint[],
  point: V6ContourPoint
): boolean => {
  if (polygon.length < 3) {
    return false;
  }

  for (let index = 0; index < polygon.length; index += 1) {
    if (isPointOnSegment(point, mustGet(polygon, index), mustGet(polygon, (index + 1) % polygon.length))) {
      return true;
    }
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

const hasDuplicateTriangleIndex = (
  triangle: readonly [number, number, number]
): boolean => triangle[0] === triangle[1] || triangle[1] === triangle[2] || triangle[2] === triangle[0];

const triangleAreaByIndex = (
  points: readonly V6DSupportRingTriangleFilterPoint[],
  triangle: readonly [number, number, number]
): number => triangleArea(
  mustGet(points, triangle[0]),
  mustGet(points, triangle[1]),
  mustGet(points, triangle[2])
);

const triangleArea = (a: V6ContourPoint, b: V6ContourPoint, c: V6ContourPoint): number =>
  cross(a, b, c) / 2;

const polygonSignedArea = (points: readonly V6ContourPoint[]): number => {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = mustGet(points, index);
    const next = mustGet(points, (index + 1) % points.length);
    area += current.x * next.y - next.x * current.y;
  }

  return area / 2;
};

const polygonCentroid = (points: readonly V6ContourPoint[]): V6ContourPoint => {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  const signedArea = polygonSignedArea(points);
  if (Math.abs(signedArea) <= TRIANGLE_AREA_EPSILON) {
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length
    };
  }

  let x = 0;
  let y = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = mustGet(points, index);
    const next = mustGet(points, (index + 1) % points.length);
    const factor = current.x * next.y - next.x * current.y;
    x += (current.x + next.x) * factor;
    y += (current.y + next.y) * factor;
  }

  return {
    x: x / (6 * signedArea),
    y: y / (6 * signedArea)
  };
};

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

const normalizeVector = (vector: V6ContourPoint): V6ContourPoint => {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= 0) {
    return { x: 0, y: -1 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length
  };
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

const createProbeRgbaBytes = (
  width: number,
  height: number,
  predicate: (x: number, y: number) => boolean
): Uint8Array => {
  const bytes = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!predicate(x, y)) {
        continue;
      }

      const offset = (y * width + x) * 4;
      bytes[offset] = 255;
      bytes[offset + 1] = 255;
      bytes[offset + 2] = 255;
      bytes[offset + 3] = 255;
    }
  }

  return bytes;
};

const roundPixelPoint = (point: V6ContourPoint): V6ContourPoint => ({
  x: roundCoordinate(point.x),
  y: roundCoordinate(point.y)
});

const roundCoordinate = (value: number): number => {
  const rounded = Math.round(value * POINT_KEY_SCALE) / POINT_KEY_SCALE;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const pointKey = (point: V6ContourPoint): string =>
  `${roundCoordinate(point.x)}:${roundCoordinate(point.y)}`;

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
    throw new Error(`v6d support-ring mesh generation internal index out of range: ${index}`);
  }

  return item;
};
