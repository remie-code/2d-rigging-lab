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
  resolveV6DAdaptiveDensity,
  resolveV6DAdaptiveDensityForTest,
  type V6DAdaptiveDensityResolution
} from "./mesh-generation-v6d-adaptive-density.js";
import {
  createAutoOutlineV6DContourBandSupportRingsMesh
} from "./mesh-generation-v6d-contour-band-support-rings.js";
import {
  recoverV6DConstrainautorTriangles,
  type V6DConstrainautorPoint
} from "./mesh-generation-v6d-contour-constrainautor.js";
import {
  computeMeshQualityMetrics,
  type MeshGenerationQualityMetrics,
  type MeshGenerationV6AdaptiveStaggeredBandDiagnostics,
  type MeshGenerationV6ConstrainautorDiagnostics,
  type MeshGenerationV6ContourPipelineDiagnostics,
  type MeshGenerationV6SupportRingDiagnostics
} from "./mesh-quality-metrics.js";

export interface AutoOutlineV6DAdaptiveStaggeredBandMeshInput {
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

export type AutoOutlineV6DAdaptiveStaggeredBandMeshResult =
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

interface AutoOutlineV6DAdaptiveStaggeredBandMeshInternalOptions {
  readonly forceGlobalAdaptiveGeometryFailureForTest?: boolean;
  readonly forcedFailureProvenanceDetailsForTest?: readonly string[];
}

type V6DAdaptiveStaggeredBandRole =
  | "outer-support"
  | "alpha-boundary"
  | "staggered-inner"
  | "ordinary-interior";

interface V6DAdaptiveStaggeredBandPoint extends V6DConstrainautorPoint {
  readonly bandRole: V6DAdaptiveStaggeredBandRole;
  readonly sourceBoundaryIndex: number;
  readonly uvPoint: V6ContourPoint;
}

interface AdaptiveBandParameters {
  readonly outerOffset: number;
  readonly innerOffset: number;
}

type AdaptiveGeometryResult =
  | {
      readonly status: "generated";
      readonly outerPoints: readonly V6ContourPoint[];
      readonly alphaPoints: readonly V6ContourPoint[];
      readonly staggeredInnerPoints: readonly V6ContourPoint[];
      readonly ordinaryInteriorPoints: readonly V6ContourPoint[];
      readonly skippedStaggeredInnerPointCount: number;
      readonly ringSelfIntersectionCount: number;
      readonly interiorPointCountBeforeInnerFilter: number;
      readonly interiorPointCountAfterInnerFilter: number;
      readonly outerOffset: number;
      readonly innerOffset: number;
    }
  | {
      readonly status: "failed";
      readonly reason: Extract<MeshGenerationFallbackReason, "v6d-adaptive-staggered-band-geometry-invalid">;
      readonly adaptiveDiagnostics: MeshGenerationV6AdaptiveStaggeredBandDiagnostics;
    };

interface FilteredInteriorTriangles {
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly removedTriangleCount: number;
  readonly outsideOrCrossingTriangleCount: number;
  readonly interiorTriangleCount: number;
}

interface ExplicitTriangles {
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly degenerateTriangleCount: number;
}

const TRIANGLE_AREA_EPSILON = 0.000001;
const POINT_KEY_SCALE = 1_000_000;

export const createAutoOutlineV6DAdaptiveStaggeredBandMesh = (
  input: AutoOutlineV6DAdaptiveStaggeredBandMeshInput
): AutoOutlineV6DAdaptiveStaggeredBandMeshResult =>
  createAutoOutlineV6DAdaptiveStaggeredBandMeshInternal(input, {});

const createAutoOutlineV6DAdaptiveStaggeredBandMeshInternal = (
  input: AutoOutlineV6DAdaptiveStaggeredBandMeshInput,
  options: AutoOutlineV6DAdaptiveStaggeredBandMeshInternalOptions
): AutoOutlineV6DAdaptiveStaggeredBandMeshResult => {
  const preliminaryContourPipeline = createV6ContourCandidateInput({
    textureSize: input.textureSize,
    meshBounds: input.bounds,
    rgbaBytes: input.rgbaBytes,
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
    ...(input.alphaThreshold === undefined ? {} : { alphaThreshold: input.alphaThreshold })
  });

  if (preliminaryContourPipeline.status === "blocked") {
    return {
      status: "blocked",
      reason: preliminaryContourPipeline.reason,
      ...(preliminaryContourPipeline.opaquePixelCount === undefined
        ? {}
        : { opaquePixelCount: preliminaryContourPipeline.opaquePixelCount }),
      ...(preliminaryContourPipeline.alphaBounds === undefined
        ? {}
        : { alphaBounds: preliminaryContourPipeline.alphaBounds.stageBounds }),
      contourPipeline: preliminaryContourPipeline
    };
  }

  const density = resolveV6DAdaptiveDensity({
    densityHint: input.densityHint ?? "medium",
    selectedComponentPixelCount:
      preliminaryContourPipeline.candidateInput.diagnostics.selectedComponentPixelCount,
    alphaBounds: preliminaryContourPipeline.candidateInput.alphaBounds.pixelBounds
  });
  const contourPipeline = createV6ContourCandidateInput({
    textureSize: input.textureSize,
    meshBounds: input.bounds,
    rgbaBytes: input.rgbaBytes,
    densityHint: input.densityHint ?? "medium",
    densityParameters: density.parameters,
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
  const generatedGeometry = createAdaptiveStaggeredBandGeometry({
    candidateInput,
    density,
    densityHint: input.densityHint ?? "medium"
  });
  const geometry =
    options.forceGlobalAdaptiveGeometryFailureForTest === true && generatedGeometry.status === "generated"
      ? createAdaptiveGeometryFailure({
          density,
          reason: "v6d-adaptive-staggered-band-geometry-invalid",
          staggeredInnerPointCount: generatedGeometry.staggeredInnerPoints.length,
          skippedStaggeredInnerPointCount: 0,
          interiorPointCountBeforeInnerFilter: candidateInput.interiorPoints.length
        })
      : generatedGeometry;
  if (geometry.status === "failed") {
    return createWave70SupportRingFallback({
      input,
      candidateInput,
      contourPipeline,
      reason: geometry.reason,
      adaptiveDiagnostics: geometry.adaptiveDiagnostics,
      provenanceDetails: [
        "v6d-adaptive-staggered-band-global-strip-geometry-invalid",
        ...(options.forcedFailureProvenanceDetailsForTest ?? [])
      ]
    });
  }

  const recoveryInput = createInteriorFillRecoveryInput(geometry);
  const recovery = recoverV6DConstrainautorTriangles(recoveryInput);
  if (recovery.status === "failed") {
    const adaptiveDiagnostics = createAdaptiveDiagnostics({
      density,
      staggeredInnerPointCount: geometry.staggeredInnerPoints.length,
      skippedStaggeredInnerPointCount: geometry.skippedStaggeredInnerPointCount,
      explicitAlphaInnerStripTriangleCount: 0,
      degenerateExplicitStripTriangleCount: 0,
      interiorPointCountBeforeInnerFilter: geometry.interiorPointCountBeforeInnerFilter,
      interiorPointCountAfterInnerFilter: geometry.interiorPointCountAfterInnerFilter,
      directAlphaToInteriorEdgeCount: 0,
      interiorFillUsesStaggeredInnerBoundary: true,
      fallbackFromAdaptiveStaggeredReason: "v6d-adaptive-staggered-band-constraint-recovery-failed"
    });
    return createWave70SupportRingFallback({
      input,
      candidateInput,
      contourPipeline,
      reason: "v6d-adaptive-staggered-band-constraint-recovery-failed",
      adaptiveDiagnostics,
      provenanceDetails: ["v6d-adaptive-staggered-band-inner-fill-constraint-recovery-failed"]
    });
  }

  const filteredInterior = filterInteriorFillTriangles({
    points: recovery.points as readonly V6DAdaptiveStaggeredBandPoint[],
    triangles: recovery.triangles,
    boundaryEdges: recovery.constraintEdges,
    innerRingPointCount: geometry.staggeredInnerPoints.length
  });
  const finalConstraintCounts = countPreservedConstraintEdges(
    filteredInterior.triangles,
    recovery.points as readonly V6DAdaptiveStaggeredBandPoint[],
    recovery.constraintEdges
  );
  const constrainautorDiagnostics = {
    ...recovery.diagnostics,
    preservedConstraintEdgeCount: finalConstraintCounts.preserved,
    missingConstraintEdgeCount: finalConstraintCounts.missing,
    constraintRecoveryFailed: finalConstraintCounts.missing > 0,
    outsideTriangleCount: filteredInterior.outsideOrCrossingTriangleCount
  } satisfies MeshGenerationV6ConstrainautorDiagnostics;

  const finalGeometry = createFinalAdaptiveMeshGeometry({
    geometry,
    recoveredInteriorPoints: recovery.points as readonly V6DAdaptiveStaggeredBandPoint[],
    filteredInterior
  });
  const fallbackReason =
    finalGeometry.explicitAlphaInnerStrip.degenerateTriangleCount > 0 ||
    finalGeometry.directAlphaToInteriorEdgeCount > 0
      ? "v6d-adaptive-staggered-band-geometry-invalid"
      : finalConstraintCounts.missing > 0 || filteredInterior.triangles.length === 0
        ? "v6d-adaptive-staggered-band-constraint-recovery-failed"
        : undefined;
  if (fallbackReason !== undefined) {
    const adaptiveDiagnostics = createAdaptiveDiagnostics({
      density,
      staggeredInnerPointCount: geometry.staggeredInnerPoints.length,
      skippedStaggeredInnerPointCount: geometry.skippedStaggeredInnerPointCount,
      explicitAlphaInnerStripTriangleCount: finalGeometry.explicitAlphaInnerStrip.triangles.length,
      degenerateExplicitStripTriangleCount: finalGeometry.explicitAlphaInnerStrip.degenerateTriangleCount,
      interiorPointCountBeforeInnerFilter: geometry.interiorPointCountBeforeInnerFilter,
      interiorPointCountAfterInnerFilter: geometry.interiorPointCountAfterInnerFilter,
      directAlphaToInteriorEdgeCount: finalGeometry.directAlphaToInteriorEdgeCount,
      interiorFillUsesStaggeredInnerBoundary: true,
      fallbackFromAdaptiveStaggeredReason: fallbackReason
    });
    return createWave70SupportRingFallback({
      input,
      candidateInput,
      contourPipeline,
      reason: fallbackReason,
      adaptiveDiagnostics,
      provenanceDetails: [`fallback-${fallbackReason}`]
    });
  }

  const adaptiveDiagnostics = createAdaptiveDiagnostics({
    density,
    staggeredInnerPointCount: geometry.staggeredInnerPoints.length,
    skippedStaggeredInnerPointCount: geometry.skippedStaggeredInnerPointCount,
    explicitAlphaInnerStripTriangleCount: finalGeometry.explicitAlphaInnerStrip.triangles.length,
    degenerateExplicitStripTriangleCount: finalGeometry.explicitAlphaInnerStrip.degenerateTriangleCount,
    interiorPointCountBeforeInnerFilter: geometry.interiorPointCountBeforeInnerFilter,
    interiorPointCountAfterInnerFilter: geometry.interiorPointCountAfterInnerFilter,
    directAlphaToInteriorEdgeCount: finalGeometry.directAlphaToInteriorEdgeCount,
    interiorFillUsesStaggeredInnerBoundary: true
  });
  const supportRingDiagnostics = createSupportRingDiagnosticsForAdaptive({
    geometry,
    supportBandTriangleCount: finalGeometry.explicitOuterAlphaBand.triangles.length,
    alphaBoundaryBandTriangleCount: finalGeometry.explicitAlphaInnerStrip.triangles.length,
    interiorTriangleCount: filteredInterior.interiorTriangleCount,
    outsideLayer: computeOutsideLayerBoundsMetrics(
      finalGeometry.points.map((point) =>
        mapV6ContourPointToStagePoint(
          point,
          input.bounds,
          candidateInput.textureSize.width,
          candidateInput.textureSize.height
        )
      ),
      input.bounds
    )
  });

  return createGeneratedAdaptiveStaggeredBandMesh({
    input,
    candidateInput,
    contourPipeline,
    points: finalGeometry.points,
    triangles: finalGeometry.triangles,
    filteredInterior,
    constrainautorDiagnostics,
    supportRingDiagnostics,
    adaptiveDiagnostics
  });
};

export const resolveV6DAdaptiveStaggeredBandDensityForTest = (input: {
  readonly densityHint: MeshDensityHint;
  readonly selectedComponentPixelCount?: number;
  readonly alphaBoundsArea?: number;
}): V6DAdaptiveDensityResolution => resolveV6DAdaptiveDensityForTest(input);

const createAdaptiveStaggeredBandProbeInputForTest =
  (): AutoOutlineV6DAdaptiveStaggeredBandMeshInput => {
    const textureSize = { width: 24, height: 20 };
    const bounds = { x: 0, y: 0, width: 24, height: 20 };
    const rgbaBytes = createProbeRgbaBytes(textureSize.width, textureSize.height, (x, y) =>
      x >= 4 && x <= 19 && y >= 4 && y <= 15
    );
    return {
      meshId: "mesh_v6d_adaptive_probe" as MeshId,
      drawableId: "draw_v6d_adaptive_probe" as DrawableId,
      bounds,
      provenanceId: "prov_v6d_adaptive_probe" as ProvenanceId,
      textureSize,
      rgbaBytes,
      densityHint: "medium"
    };
  };

export const probeV6DAdaptiveStaggeredBandWave70FallbackForTest =
  (): AutoOutlineV6DAdaptiveStaggeredBandMeshResult =>
    createAutoOutlineV6DAdaptiveStaggeredBandMeshInternal(
      createAdaptiveStaggeredBandProbeInputForTest(),
      {
        forceGlobalAdaptiveGeometryFailureForTest: true,
        forcedFailureProvenanceDetailsForTest: ["v6d-adaptive-staggered-band-test-probe-wave70-fallback"]
      }
    );

export const probeV6DAdaptiveStaggeredBandStripGeometryForTest = (): {
  readonly alphaPoints: readonly V6ContourPoint[];
  readonly staggeredInnerPoints: readonly V6ContourPoint[];
  readonly alphaStart: number;
  readonly innerGlobalIndexByBoundaryIndex: readonly number[];
  readonly explicitAlphaInnerStripTriangles: readonly (readonly [number, number, number])[];
  readonly directAlphaToInteriorEdgeCount: number;
} => {
  const input = createAdaptiveStaggeredBandProbeInputForTest();
  const preliminaryContourPipeline = createV6ContourCandidateInput({
    textureSize: input.textureSize,
    meshBounds: input.bounds,
    rgbaBytes: input.rgbaBytes,
    densityHint: input.densityHint ?? "medium"
  });
  if (preliminaryContourPipeline.status === "blocked") {
    throw new Error("Expected adaptive staggered-band strip probe preliminary contour to generate.");
  }

  const density = resolveV6DAdaptiveDensity({
    densityHint: input.densityHint ?? "medium",
    selectedComponentPixelCount:
      preliminaryContourPipeline.candidateInput.diagnostics.selectedComponentPixelCount,
    alphaBounds: preliminaryContourPipeline.candidateInput.alphaBounds.pixelBounds
  });
  const contourPipeline = createV6ContourCandidateInput({
    textureSize: input.textureSize,
    meshBounds: input.bounds,
    rgbaBytes: input.rgbaBytes,
    densityHint: input.densityHint ?? "medium",
    densityParameters: density.parameters
  });
  if (contourPipeline.status === "blocked") {
    throw new Error("Expected adaptive staggered-band strip probe contour to generate.");
  }

  const geometry = createAdaptiveStaggeredBandGeometry({
    candidateInput: contourPipeline.candidateInput,
    density,
    densityHint: input.densityHint ?? "medium"
  });
  if (geometry.status === "failed") {
    throw new Error("Expected adaptive staggered-band strip probe geometry to generate.");
  }

  const recoveryInput = createInteriorFillRecoveryInput(geometry);
  const recovery = recoverV6DConstrainautorTriangles(recoveryInput);
  if (recovery.status === "failed") {
    throw new Error("Expected adaptive staggered-band strip probe recovery to generate.");
  }

  const filteredInterior = filterInteriorFillTriangles({
    points: recovery.points as readonly V6DAdaptiveStaggeredBandPoint[],
    triangles: recovery.triangles,
    boundaryEdges: recovery.constraintEdges,
    innerRingPointCount: geometry.staggeredInnerPoints.length
  });
  const finalGeometry = createFinalAdaptiveMeshGeometry({
    geometry,
    recoveredInteriorPoints: recovery.points as readonly V6DAdaptiveStaggeredBandPoint[],
    filteredInterior
  });
  const innerGlobalIndexByBoundaryIndex = geometry.alphaPoints.map((_point, index) => {
    const pointIndex = finalGeometry.points.findIndex(
      (point) => point.bandRole === "staggered-inner" && point.sourceBoundaryIndex === index
    );
    if (pointIndex < 0) {
      throw new Error(`Missing adaptive staggered inner point for boundary index ${index}.`);
    }

    return pointIndex;
  });

  return {
    alphaPoints: geometry.alphaPoints,
    staggeredInnerPoints: geometry.staggeredInnerPoints,
    alphaStart: geometry.outerPoints.length,
    innerGlobalIndexByBoundaryIndex,
    explicitAlphaInnerStripTriangles: finalGeometry.explicitAlphaInnerStrip.triangles,
    directAlphaToInteriorEdgeCount: finalGeometry.directAlphaToInteriorEdgeCount
  };
};

const createAdaptiveStaggeredBandGeometry = (input: {
  readonly candidateInput: V6ContourCandidateInput;
  readonly density: V6DAdaptiveDensityResolution;
  readonly densityHint: MeshDensityHint;
}): AdaptiveGeometryResult => {
  const alphaPoints = input.candidateInput.boundaryPoints;
  const parameters = getAdaptiveBandParameters(input.densityHint);
  if (alphaPoints.length < 3) {
    return createAdaptiveGeometryFailure({
      density: input.density,
      reason: "v6d-adaptive-staggered-band-geometry-invalid",
      staggeredInnerPointCount: 0,
      skippedStaggeredInnerPointCount: alphaPoints.length,
      interiorPointCountBeforeInnerFilter: input.candidateInput.interiorPoints.length
    });
  }

  const outerPoints = alphaPoints.map((point, index) => {
    const normal = estimateOutwardNormal(input.candidateInput, index);
    return roundPixelPoint({
      x: point.x + normal.x * parameters.outerOffset,
      y: point.y + normal.y * parameters.outerOffset
    });
  });
  const outerSelfIntersectionCount = countPolygonSelfIntersections(outerPoints);
  if (outerPoints.length < 3 || outerSelfIntersectionCount > 0 || countDuplicatePoints(outerPoints) > 0) {
    return createAdaptiveGeometryFailure({
      density: input.density,
      reason: "v6d-adaptive-staggered-band-geometry-invalid",
      staggeredInnerPointCount: 0,
      skippedStaggeredInnerPointCount: alphaPoints.length,
      interiorPointCountBeforeInnerFilter: input.candidateInput.interiorPoints.length
    });
  }

  const usedInnerKeys = new Set(alphaPoints.map(pointKey));
  const staggeredInnerPoints: V6ContourPoint[] = [];
  let skippedStaggeredInnerPointCount = 0;
  for (let index = 0; index < alphaPoints.length; index += 1) {
    const innerPoint = findSafeStaggeredInnerPoint({
      candidateInput: input.candidateInput,
      edgeIndex: index,
      innerOffset: parameters.innerOffset
    });
    if (innerPoint === undefined || usedInnerKeys.has(pointKey(innerPoint))) {
      skippedStaggeredInnerPointCount += 1;
      continue;
    }

    usedInnerKeys.add(pointKey(innerPoint));
    staggeredInnerPoints.push(innerPoint);
  }

  if (staggeredInnerPoints.length !== alphaPoints.length) {
    return createAdaptiveGeometryFailure({
      density: input.density,
      reason: "v6d-adaptive-staggered-band-geometry-invalid",
      staggeredInnerPointCount: staggeredInnerPoints.length,
      skippedStaggeredInnerPointCount,
      interiorPointCountBeforeInnerFilter: input.candidateInput.interiorPoints.length
    });
  }

  const innerSelfIntersectionCount = countPolygonSelfIntersections(staggeredInnerPoints);
  if (innerSelfIntersectionCount > 0) {
    return createAdaptiveGeometryFailure({
      density: input.density,
      reason: "v6d-adaptive-staggered-band-geometry-invalid",
      staggeredInnerPointCount: staggeredInnerPoints.length,
      skippedStaggeredInnerPointCount,
      interiorPointCountBeforeInnerFilter: input.candidateInput.interiorPoints.length
    });
  }

  const supportPointKeys = new Set([...outerPoints, ...alphaPoints, ...staggeredInnerPoints].map(pointKey));
  const ordinaryInteriorPoints = input.candidateInput.interiorPoints.filter(
    (point) =>
      isPointInsidePolygonOrOnBoundary(staggeredInnerPoints, point) &&
      !supportPointKeys.has(pointKey(point))
  );

  return {
    status: "generated",
    outerPoints,
    alphaPoints,
    staggeredInnerPoints,
    ordinaryInteriorPoints,
    skippedStaggeredInnerPointCount,
    ringSelfIntersectionCount: outerSelfIntersectionCount + innerSelfIntersectionCount,
    interiorPointCountBeforeInnerFilter: input.candidateInput.interiorPoints.length,
    interiorPointCountAfterInnerFilter: ordinaryInteriorPoints.length,
    outerOffset: parameters.outerOffset,
    innerOffset: parameters.innerOffset
  };
};

const createAdaptiveGeometryFailure = (input: {
  readonly density: V6DAdaptiveDensityResolution;
  readonly reason: Extract<MeshGenerationFallbackReason, "v6d-adaptive-staggered-band-geometry-invalid">;
  readonly staggeredInnerPointCount: number;
  readonly skippedStaggeredInnerPointCount: number;
  readonly interiorPointCountBeforeInnerFilter: number;
}): AdaptiveGeometryResult => ({
  status: "failed",
  reason: input.reason,
  adaptiveDiagnostics: createAdaptiveDiagnostics({
    density: input.density,
    staggeredInnerPointCount: input.staggeredInnerPointCount,
    skippedStaggeredInnerPointCount: input.skippedStaggeredInnerPointCount,
    explicitAlphaInnerStripTriangleCount: 0,
    degenerateExplicitStripTriangleCount: 0,
    interiorPointCountBeforeInnerFilter: input.interiorPointCountBeforeInnerFilter,
    interiorPointCountAfterInnerFilter: 0,
    directAlphaToInteriorEdgeCount: 0,
    interiorFillUsesStaggeredInnerBoundary: false,
    fallbackFromAdaptiveStaggeredReason: input.reason
  })
});

const createInteriorFillRecoveryInput = (
  geometry: Extract<AdaptiveGeometryResult, { readonly status: "generated" }>
) => ({
  points: [
    ...geometry.staggeredInnerPoints.map((point, index) => ({
      ...point,
      role: "boundary" as const,
      bandRole: "staggered-inner" as const,
      sourceBoundaryIndex: index,
      stableOrder: index,
      uvPoint: point
    })),
    ...geometry.ordinaryInteriorPoints.map((point, index) => ({
      ...point,
      role: "interior" as const,
      bandRole: "ordinary-interior" as const,
      sourceBoundaryIndex: index,
      stableOrder: index,
      uvPoint: point
    }))
  ] satisfies readonly V6DAdaptiveStaggeredBandPoint[],
  constraintEdges: createLoopEdges(0, geometry.staggeredInnerPoints.length)
});

const filterInteriorFillTriangles = (input: {
  readonly points: readonly V6DAdaptiveStaggeredBandPoint[];
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly boundaryEdges: readonly (readonly [number, number])[];
  readonly innerRingPointCount: number;
}): FilteredInteriorTriangles => {
  const innerRing = input.points.slice(0, input.innerRingPointCount);
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

    const centroid = triangleCentroid(input.points, triangle);
    const outsideInnerRing = !isPointInsidePolygonOrOnBoundary(innerRing, centroid);
    const crossesInnerRing = triangleCrossesEdges(input.points, triangle, input.boundaryEdges);
    if (outsideInnerRing || crossesInnerRing) {
      removedTriangleCount += 1;
      outsideOrCrossingTriangleCount += 1;
      continue;
    }

    filtered.push([triangle[0], triangle[1], triangle[2]]);
  }

  return {
    triangles: normalizeTriangles(filtered, input.points),
    removedTriangleCount,
    outsideOrCrossingTriangleCount,
    interiorTriangleCount: filtered.length
  };
};

const createFinalAdaptiveMeshGeometry = (input: {
  readonly geometry: Extract<AdaptiveGeometryResult, { readonly status: "generated" }>;
  readonly recoveredInteriorPoints: readonly V6DAdaptiveStaggeredBandPoint[];
  readonly filteredInterior: FilteredInteriorTriangles;
}): {
  readonly points: readonly V6DAdaptiveStaggeredBandPoint[];
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly explicitOuterAlphaBand: ExplicitTriangles;
  readonly explicitAlphaInnerStrip: ExplicitTriangles;
  readonly directAlphaToInteriorEdgeCount: number;
} => {
  const outerStart = 0;
  const alphaStart = input.geometry.outerPoints.length;
  const recoveredStart = alphaStart + input.geometry.alphaPoints.length;
  const points: V6DAdaptiveStaggeredBandPoint[] = [
    ...input.geometry.outerPoints.map((point, index) => ({
      ...point,
      role: "boundary" as const,
      bandRole: "outer-support" as const,
      sourceBoundaryIndex: index,
      stableOrder: index,
      uvPoint: mustGet(input.geometry.alphaPoints, index)
    })),
    ...input.geometry.alphaPoints.map((point, index) => ({
      ...point,
      role: "boundary" as const,
      bandRole: "alpha-boundary" as const,
      sourceBoundaryIndex: index,
      stableOrder: alphaStart + index,
      uvPoint: point
    })),
    ...input.recoveredInteriorPoints
  ];
  const recoveredGlobalIndexByLocalIndex = new Map(
    input.recoveredInteriorPoints.map((_point, index) => [index, recoveredStart + index])
  );
  const innerIndexByBoundaryIndex = new Map<number, number>();
  for (let localIndex = 0; localIndex < input.recoveredInteriorPoints.length; localIndex += 1) {
    const point = mustGet(input.recoveredInteriorPoints, localIndex);
    if (point.bandRole === "staggered-inner") {
      innerIndexByBoundaryIndex.set(point.sourceBoundaryIndex, recoveredStart + localIndex);
    }
  }

  const explicitOuterAlphaBand = createExplicitOuterAlphaBandTriangles({
    points,
    outerStart,
    alphaStart,
    alphaPointCount: input.geometry.alphaPoints.length
  });
  const explicitAlphaInnerStrip = createExplicitAlphaInnerStripTriangles({
    points,
    alphaStart,
    alphaPointCount: input.geometry.alphaPoints.length,
    innerIndexByBoundaryIndex
  });
  const remappedInteriorTriangles = input.filteredInterior.triangles
    .map((triangle) => [
      mustGetMapValue(recoveredGlobalIndexByLocalIndex, triangle[0]),
      mustGetMapValue(recoveredGlobalIndexByLocalIndex, triangle[1]),
      mustGetMapValue(recoveredGlobalIndexByLocalIndex, triangle[2])
    ] as const);
  const triangles = dedupeTriangles(
    normalizeTriangles(
      [
        ...explicitOuterAlphaBand.triangles,
        ...explicitAlphaInnerStrip.triangles,
        ...remappedInteriorTriangles
      ],
      points
    )
  );

  return {
    points,
    triangles,
    explicitOuterAlphaBand,
    explicitAlphaInnerStrip,
    directAlphaToInteriorEdgeCount: countDirectAlphaToOrdinaryInteriorEdges(triangles, points)
  };
};

const createGeneratedAdaptiveStaggeredBandMesh = (input: {
  readonly input: AutoOutlineV6DAdaptiveStaggeredBandMeshInput;
  readonly candidateInput: V6ContourCandidateInput;
  readonly contourPipeline: Extract<V6ContourPipelineResult, { readonly status: "generated" }>;
  readonly points: readonly V6DAdaptiveStaggeredBandPoint[];
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly filteredInterior: FilteredInteriorTriangles;
  readonly constrainautorDiagnostics: MeshGenerationV6ConstrainautorDiagnostics;
  readonly supportRingDiagnostics: MeshGenerationV6SupportRingDiagnostics;
  readonly adaptiveDiagnostics: MeshGenerationV6AdaptiveStaggeredBandDiagnostics;
}): AutoOutlineV6DAdaptiveStaggeredBandMeshResult => {
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6d-adaptive-staggered-band");
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
      switch (point.bandRole) {
        case "outer-support":
          return `vtx_${token}_v6d_adaptive_outer_${point.sourceBoundaryIndex}_${index}`;
        case "alpha-boundary":
          return `vtx_${token}_v6d_adaptive_alpha_${point.sourceBoundaryIndex}_${index}`;
        case "staggered-inner":
          return `vtx_${token}_v6d_adaptive_staggered_inner_${point.sourceBoundaryIndex}_${index}`;
        case "ordinary-interior":
          return `vtx_${token}_v6d_adaptive_interior_${point.stableOrder}_${index}`;
      }
    }),
    triangleStableIds: input.triangles.map((_triangle, index) => `tri_${token}_v6d_adaptive_${index}` as TriangleId),
    topologyRevision: 0,
    bounds: structuredClone(input.input.bounds),
    generationProvenanceId: input.input.provenanceId
  };
  const boundaryVertexCount = input.points.filter((point) => point.bandRole === "alpha-boundary").length;
  const qualityMetrics = computeMeshQualityMetrics(mesh, {
    refinementIterationCount: 0,
    triangulationMode: "v6d-adaptive-staggered-band",
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
      removedTriangleCount:
        input.filteredInterior.removedTriangleCount +
        input.adaptiveDiagnostics.degenerateExplicitStripTriangleCount,
      outsideOrCrossingTriangleCount: input.filteredInterior.outsideOrCrossingTriangleCount,
      multiIslandHandling: input.candidateInput.diagnostics.multiIslandHandling,
      holeHandling: input.candidateInput.diagnostics.holeHandling,
      provenance: createAdaptiveSuccessProvenance(input.candidateInput),
      contourPipelineDiagnostics: createV6ContourPipelineDiagnostics(input.contourPipeline),
      constrainautorDiagnostics: input.constrainautorDiagnostics,
      supportRingDiagnostics: input.supportRingDiagnostics,
      adaptiveStaggeredBandDiagnostics: input.adaptiveDiagnostics
    }
  });

  return {
    status: "generated",
    mesh,
    alphaBounds: input.candidateInput.alphaBounds.stageBounds,
    qualityMetrics
  };
};

const createWave70SupportRingFallback = (input: {
  readonly input: AutoOutlineV6DAdaptiveStaggeredBandMeshInput;
  readonly candidateInput: V6ContourCandidateInput;
  readonly contourPipeline: Extract<V6ContourPipelineResult, { readonly status: "generated" }>;
  readonly reason: Extract<
    MeshGenerationFallbackReason,
    | "v6d-adaptive-staggered-band-geometry-invalid"
    | "v6d-adaptive-staggered-band-constraint-recovery-failed"
  >;
  readonly adaptiveDiagnostics: MeshGenerationV6AdaptiveStaggeredBandDiagnostics;
  readonly provenanceDetails: readonly string[];
}): AutoOutlineV6DAdaptiveStaggeredBandMeshResult => {
  const fallback = createAutoOutlineV6DContourBandSupportRingsMesh(input.input);
  if (fallback.status === "blocked") {
    return {
      status: "blocked",
      reason: fallback.reason,
      ...(fallback.opaquePixelCount === undefined ? {} : { opaquePixelCount: fallback.opaquePixelCount }),
      ...(fallback.alphaBounds === undefined ? {} : { alphaBounds: fallback.alphaBounds }),
      ...(fallback.contourPipeline === undefined ? {} : { contourPipeline: fallback.contourPipeline })
    };
  }

  const candidate = getV6MeshGenerationCandidate("auto-outline-v6d-adaptive-staggered-band");
  const supportSource: DrawableGeneratedMeshSource =
    fallback.status === "generated"
      ? "outline-v6d-contour-band-support-rings-rgba"
      : fallback.source;
  const supportV6Metrics = fallback.qualityMetrics.v6Metrics;
  const fallbackSteps: readonly MeshGenerationFallbackStep[] = [
    {
      method: candidate.methodId,
      reason: input.reason
    },
    ...(fallback.status === "fallback" ? fallback.fallbackSteps : [])
  ];
  const boundaryVertexCount = supportV6Metrics?.boundaryVertexCount ?? countBoundaryVertices(fallback.mesh);
  const qualityMetrics = computeMeshQualityMetrics(fallback.mesh, {
    refinementIterationCount: fallback.qualityMetrics.refinementIterationCount,
    fallbackReason: input.reason,
    ...(fallback.qualityMetrics.triangulationMode === undefined
      ? {}
      : { triangulationMode: fallback.qualityMetrics.triangulationMode }),
    v6Metrics: {
      algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
      methodId: candidate.methodId,
      backendId: candidate.backendId,
      backendImplementationStatus: "implemented",
      requestedSourceId: candidate.sourceId,
      actualSourceId: supportSource,
      outputKind: "fallback-output",
      preset: input.input.densityHint ?? "medium",
      fallbackReason: input.reason,
      fallbackSteps,
      vertexCount: fallback.mesh.vertices.length,
      triangleCount: fallback.mesh.triangles.length,
      boundaryVertexCount,
      interiorVertexCount:
        supportV6Metrics?.interiorVertexCount ?? Math.max(0, fallback.mesh.vertices.length - boundaryVertexCount),
      alphaBoundsAvailable: fallback.alphaBounds !== undefined,
      opaquePixelCount: input.candidateInput.diagnostics.inputOpaquePixelCount,
      contourLoopCount: input.candidateInput.diagnostics.contourLoopCount,
      holeLikeRegionCount: input.candidateInput.diagnostics.holeLikeRegionCount,
      removedTriangleCount: supportV6Metrics?.removedTriangleCount ?? 0,
      outsideOrCrossingTriangleCount: supportV6Metrics?.outsideOrCrossingTriangleCount ?? 0,
      multiIslandHandling: input.candidateInput.diagnostics.multiIslandHandling,
      holeHandling: input.candidateInput.diagnostics.holeHandling,
      provenance: createAdaptiveFallbackProvenance(input.candidateInput, input.reason, input.provenanceDetails),
      contourPipelineDiagnostics: createV6ContourPipelineDiagnostics(input.contourPipeline),
      ...(supportV6Metrics?.constrainautorDiagnostics === undefined
        ? {}
        : { constrainautorDiagnostics: supportV6Metrics.constrainautorDiagnostics }),
      ...(supportV6Metrics?.supportRingDiagnostics === undefined
        ? {}
        : { supportRingDiagnostics: supportV6Metrics.supportRingDiagnostics }),
      adaptiveStaggeredBandDiagnostics: input.adaptiveDiagnostics
    }
  });

  return {
    status: "fallback",
    mesh: fallback.mesh,
    source: supportSource,
    reason: input.reason,
    fallbackSteps,
    qualityMetrics,
    ...(fallback.alphaBounds === undefined ? {} : { alphaBounds: fallback.alphaBounds })
  };
};

const createExplicitOuterAlphaBandTriangles = (input: {
  readonly points: readonly V6DAdaptiveStaggeredBandPoint[];
  readonly outerStart: number;
  readonly alphaStart: number;
  readonly alphaPointCount: number;
}): ExplicitTriangles => {
  const triangles: [number, number, number][] = [];
  let degenerateTriangleCount = 0;
  for (let index = 0; index < input.alphaPointCount; index += 1) {
    const next = (index + 1) % input.alphaPointCount;
    for (const triangle of [
      [input.outerStart + index, input.outerStart + next, input.alphaStart + next],
      [input.outerStart + index, input.alphaStart + next, input.alphaStart + index]
    ] as const) {
      if (Math.abs(triangleAreaByIndex(input.points, triangle)) <= TRIANGLE_AREA_EPSILON) {
        degenerateTriangleCount += 1;
        continue;
      }

      triangles.push([triangle[0], triangle[1], triangle[2]]);
    }
  }

  return {
    triangles,
    degenerateTriangleCount
  };
};

const createExplicitAlphaInnerStripTriangles = (input: {
  readonly points: readonly V6DAdaptiveStaggeredBandPoint[];
  readonly alphaStart: number;
  readonly alphaPointCount: number;
  readonly innerIndexByBoundaryIndex: ReadonlyMap<number, number>;
}): ExplicitTriangles => {
  const triangles: [number, number, number][] = [];
  let degenerateTriangleCount = 0;
  for (let index = 0; index < input.alphaPointCount; index += 1) {
    const next = (index + 1) % input.alphaPointCount;
    const inner = input.innerIndexByBoundaryIndex.get(index);
    const nextInner = input.innerIndexByBoundaryIndex.get(next);
    if (inner === undefined || nextInner === undefined) {
      degenerateTriangleCount += 2;
      continue;
    }

    for (const triangle of [
      [input.alphaStart + index, input.alphaStart + next, inner],
      [input.alphaStart + next, nextInner, inner]
    ] as const) {
      if (Math.abs(triangleAreaByIndex(input.points, triangle)) <= TRIANGLE_AREA_EPSILON) {
        degenerateTriangleCount += 1;
        continue;
      }

      triangles.push([triangle[0], triangle[1], triangle[2]]);
    }
  }

  return {
    triangles,
    degenerateTriangleCount
  };
};

const createAdaptiveDiagnostics = (input: {
  readonly density: V6DAdaptiveDensityResolution;
  readonly staggeredInnerPointCount: number;
  readonly skippedStaggeredInnerPointCount: number;
  readonly explicitAlphaInnerStripTriangleCount: number;
  readonly degenerateExplicitStripTriangleCount: number;
  readonly interiorPointCountBeforeInnerFilter: number;
  readonly interiorPointCountAfterInnerFilter: number;
  readonly directAlphaToInteriorEdgeCount: number;
  readonly interiorFillUsesStaggeredInnerBoundary: boolean;
  readonly fallbackFromAdaptiveStaggeredReason?: MeshGenerationFallbackReason;
}): MeshGenerationV6AdaptiveStaggeredBandDiagnostics => ({
  ...input.density.diagnostics,
  staggeredInnerPointCount: input.staggeredInnerPointCount,
  skippedStaggeredInnerPointCount: input.skippedStaggeredInnerPointCount,
  explicitAlphaInnerStripTriangleCount: input.explicitAlphaInnerStripTriangleCount,
  degenerateExplicitStripTriangleCount: input.degenerateExplicitStripTriangleCount,
  interiorPointCountBeforeInnerFilter: input.interiorPointCountBeforeInnerFilter,
  interiorPointCountAfterInnerFilter: input.interiorPointCountAfterInnerFilter,
  directAlphaToInteriorEdgeCount: input.directAlphaToInteriorEdgeCount,
  interiorFillUsesStaggeredInnerBoundary: input.interiorFillUsesStaggeredInnerBoundary,
  ...(input.fallbackFromAdaptiveStaggeredReason === undefined
    ? {}
    : { fallbackFromAdaptiveStaggeredReason: input.fallbackFromAdaptiveStaggeredReason })
});

const createSupportRingDiagnosticsForAdaptive = (input: {
  readonly geometry: Extract<AdaptiveGeometryResult, { readonly status: "generated" }>;
  readonly supportBandTriangleCount: number;
  readonly alphaBoundaryBandTriangleCount: number;
  readonly interiorTriangleCount: number;
  readonly outsideLayer: {
    readonly verticesExtendOutsideLayerBounds: boolean;
    readonly maxOutsideLayerDistance: number;
  };
}): MeshGenerationV6SupportRingDiagnostics => ({
  boundaryRingPointCount: input.geometry.alphaPoints.length,
  alphaBoundaryRingPointCount: input.geometry.alphaPoints.length,
  outerRingPointCount: input.geometry.outerPoints.length,
  innerRingPointCount: input.geometry.staggeredInnerPoints.length,
  skippedRingPointCount: input.geometry.skippedStaggeredInnerPointCount,
  mergedRingPointCount: 0,
  ringSelfIntersectionCount: input.geometry.ringSelfIntersectionCount,
  bridgeConstraintCount: 0,
  supportBandTriangleCount: input.supportBandTriangleCount,
  alphaBoundaryBandTriangleCount: input.alphaBoundaryBandTriangleCount,
  interiorTriangleCount: input.interiorTriangleCount,
  verticesExtendOutsideLayerBounds: input.outsideLayer.verticesExtendOutsideLayerBounds,
  maxOutsideLayerDistance: input.outsideLayer.maxOutsideLayerDistance,
  outerRingOffset: input.geometry.outerOffset,
  innerRingOffset: input.geometry.innerOffset,
  outerRingUvPolicy: "projected-to-alpha-boundary"
});

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

const createAdaptiveSuccessProvenance = (
  candidateInput: V6ContourCandidateInput
): readonly string[] => [
  ...candidateInput.diagnostics.provenance,
  "dependency-available",
  "v6d-adaptive-density-resolved",
  "v6d-adaptive-staggered-band-outer-support-ring",
  "v6d-adaptive-staggered-band-alpha-boundary-ring",
  "v6d-adaptive-staggered-band-edge-midpoint-inner-ring",
  "v6d-adaptive-staggered-band-explicit-alpha-inner-strip",
  "v6d-adaptive-staggered-band-inner-boundary-interior-fill",
  "v6d-adaptive-staggered-band-no-alpha-to-ordinary-interior-edges",
  "v6d-adaptive-staggered-band-constraints-verified"
];

const createAdaptiveFallbackProvenance = (
  candidateInput: V6ContourCandidateInput,
  reason: MeshGenerationFallbackReason,
  details: readonly string[]
): readonly string[] => [
  ...candidateInput.diagnostics.provenance,
  "dependency-available",
  "v6d-adaptive-density-resolved",
  "v6d-adaptive-staggered-band-wave70-support-ring-fallback",
  `fallback-${reason}`,
  ...details
];

const getAdaptiveBandParameters = (densityHint: MeshDensityHint): AdaptiveBandParameters => {
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

const findSafeStaggeredInnerPoint = (input: {
  readonly candidateInput: V6ContourCandidateInput;
  readonly edgeIndex: number;
  readonly innerOffset: number;
}): V6ContourPoint | undefined => {
  const alphaPoints = input.candidateInput.boundaryPoints;
  const start = mustGet(alphaPoints, input.edgeIndex);
  const end = mustGet(alphaPoints, (input.edgeIndex + 1) % alphaPoints.length);
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2
  };
  const tangent = normalizeVector({
    x: end.x - start.x,
    y: end.y - start.y
  });
  const leftCandidate = normalizeVector({ x: -tangent.y, y: tangent.x });
  const rightCandidate = { x: -leftCandidate.x, y: -leftCandidate.y };
  const centroid = polygonCentroid(alphaPoints);
  const centroidCandidate = normalizeVector({
    x: centroid.x - midpoint.x,
    y: centroid.y - midpoint.y
  });
  const inwardCandidates = [
    leftCandidate,
    rightCandidate,
    centroidCandidate
  ].filter((candidate, index, candidates) =>
    candidate.x !== 0 ||
    candidate.y !== 0 ||
    candidates.findIndex((other) => pointKey(other) === pointKey(candidate)) === index
  );
  const orderedCandidates = [
    ...inwardCandidates.filter((candidate) =>
      isPointInsideAlphaRegion(input.candidateInput, {
        x: midpoint.x + candidate.x * 0.75,
        y: midpoint.y + candidate.y * 0.75
      })
    ),
    ...inwardCandidates.filter((candidate) =>
      !isPointInsideAlphaRegion(input.candidateInput, {
        x: midpoint.x + candidate.x * 0.75,
        y: midpoint.y + candidate.y * 0.75
      })
    )
  ];

  for (const inward of orderedCandidates) {
    for (const scale of [1, 0.75, 0.5, 0.25] as const) {
      const candidate = roundPixelPoint({
        x: midpoint.x + inward.x * input.innerOffset * scale,
        y: midpoint.y + inward.y * input.innerOffset * scale
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

const countPreservedConstraintEdges = (
  triangles: readonly (readonly [number, number, number])[],
  points: readonly V6DAdaptiveStaggeredBandPoint[],
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
  return triangles.some(
    (triangle) =>
      undirectedEdgeKey(triangle[0], triangle[1]) === key ||
      undirectedEdgeKey(triangle[1], triangle[2]) === key ||
      undirectedEdgeKey(triangle[2], triangle[0]) === key
  );
};

const countDirectAlphaToOrdinaryInteriorEdges = (
  triangles: readonly (readonly [number, number, number])[],
  points: readonly V6DAdaptiveStaggeredBandPoint[]
): number => {
  const edges = new Set<string>();
  for (const triangle of triangles) {
    for (const [left, right] of [
      [triangle[0], triangle[1]],
      [triangle[1], triangle[2]],
      [triangle[2], triangle[0]]
    ] as const) {
      const leftPoint = points[left];
      const rightPoint = points[right];
      if (leftPoint === undefined || rightPoint === undefined) {
        continue;
      }

      const connectsAlphaToOrdinaryInterior =
        (leftPoint.bandRole === "alpha-boundary" && rightPoint.bandRole === "ordinary-interior") ||
        (rightPoint.bandRole === "alpha-boundary" && leftPoint.bandRole === "ordinary-interior");
      if (connectsAlphaToOrdinaryInterior) {
        edges.add(undirectedEdgeKey(left, right));
      }
    }
  }

  return edges.size;
};

const triangleCrossesEdges = (
  points: readonly V6DAdaptiveStaggeredBandPoint[],
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
    maxOutsideLayerDistance: roundMetric(maxOutsideLayerDistance)
  };
};

const normalizeTriangles = (
  triangles: readonly (readonly [number, number, number])[],
  points: readonly V6DAdaptiveStaggeredBandPoint[]
): readonly (readonly [number, number, number])[] =>
  triangles
    .map((triangle) => orientTrianglePositive(points, triangle))
    .sort((left, right) =>
      left[0] - right[0] ||
      left[1] - right[1] ||
      left[2] - right[2]
    );

const dedupeTriangles = (
  triangles: readonly (readonly [number, number, number])[]
): readonly (readonly [number, number, number])[] => {
  const seen = new Set<string>();
  const result: [number, number, number][] = [];
  for (const triangle of triangles) {
    const key = [...triangle].sort((left, right) => left - right).join(":");
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push([triangle[0], triangle[1], triangle[2]]);
  }

  return result;
};

const orientTrianglePositive = (
  points: readonly V6DAdaptiveStaggeredBandPoint[],
  triangle: readonly [number, number, number]
): readonly [number, number, number] =>
  triangleAreaByIndex(points, triangle) < 0
    ? [triangle[0], triangle[2], triangle[1]]
    : [triangle[0], triangle[1], triangle[2]];

const triangleCentroid = (
  points: readonly V6DAdaptiveStaggeredBandPoint[],
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
  points: readonly V6DAdaptiveStaggeredBandPoint[],
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

      const index = (y * width + x) * 4;
      bytes[index] = 255;
      bytes[index + 1] = 255;
      bytes[index + 2] = 255;
      bytes[index + 3] = 255;
    }
  }

  return bytes;
};

const roundPixelPoint = (point: V6ContourPoint): V6ContourPoint => ({
  x: roundCoordinate(point.x),
  y: roundCoordinate(point.y)
});

const roundMetric = (value: number): number => roundCoordinate(value);

const roundCoordinate = (value: number): number => {
  const rounded = Math.round(value * POINT_KEY_SCALE) / POINT_KEY_SCALE;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const pointKey = (point: V6ContourPoint): string =>
  `${roundCoordinate(point.x)}:${roundCoordinate(point.y)}`;

const undirectedEdgeKey = (left: number, right: number): string =>
  left < right ? `${left}:${right}` : `${right}:${left}`;

const stripIdPrefix = (id: string, prefix: string): string =>
  id.startsWith(prefix) ? id.slice(prefix.length) : id;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Math.trunc(value), min), max);

const mustGet = <T>(items: readonly T[], index: number): T => {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`v6d adaptive staggered band internal index out of range: ${index}`);
  }

  return item;
};

const mustGetMapValue = <K, V>(items: ReadonlyMap<K, V>, key: K): V => {
  const value = items.get(key);
  if (value === undefined) {
    throw new Error("v6d adaptive staggered band internal map key missing");
  }

  return value;
};
