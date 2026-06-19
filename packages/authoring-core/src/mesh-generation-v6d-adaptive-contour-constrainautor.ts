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
  type V6ContourPoint,
  type V6ContourPipelineResult
} from "./mesh-generation-v6-contour-pipeline.js";
import {
  resolveV6DAdaptiveDensity,
  type V6DAdaptiveDensityResolution
} from "./mesh-generation-v6d-adaptive-density.js";
import {
  createV6DAlphaBoundsFallbackMesh,
  filterV6DConstrainautorTrianglesToMainMask,
  recoverV6DConstrainautorTriangles,
  type FilteredTriangles,
  type V6DConstrainautorPoint
} from "./mesh-generation-v6d-contour-constrainautor.js";
import {
  computeMeshQualityMetrics,
  type MeshGenerationQualityMetrics,
  type MeshGenerationV6ConstrainautorDiagnostics,
  type MeshGenerationV6ContourPipelineDiagnostics
} from "./mesh-quality-metrics.js";

const ADAPTIVE_CONTOUR_MASK_EXPANSION_PIXELS = 2;
const ADAPTIVE_CONTOUR_VIRTUAL_PADDING_PIXELS = 4;

export interface AutoOutlineV6DAdaptiveContourConstrainautorMeshInput {
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

export type AutoOutlineV6DAdaptiveContourConstrainautorMeshResult =
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

interface AdaptiveContourVirtualInput {
  readonly textureSize: {
    readonly width: number;
    readonly height: number;
  };
  readonly meshBounds: RectDto;
  readonly rgbaBytes: Uint8Array;
  readonly paddingPixels: number;
}

export const createAutoOutlineV6DAdaptiveContourConstrainautorMesh = (
  input: AutoOutlineV6DAdaptiveContourConstrainautorMeshInput
): AutoOutlineV6DAdaptiveContourConstrainautorMeshResult => {
  const virtualInput = createAdaptiveContourVirtualInput(input);
  const preliminaryContourPipeline = createV6ContourCandidateInput({
    textureSize: virtualInput.textureSize,
    meshBounds: virtualInput.meshBounds,
    rgbaBytes: virtualInput.rgbaBytes,
    maskExpansionPixels: ADAPTIVE_CONTOUR_MASK_EXPANSION_PIXELS,
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
        : {
            alphaBounds: mapVirtualAlphaBoundsToOriginalStageBounds(
              preliminaryContourPipeline.alphaBounds.pixelBounds,
              virtualInput.paddingPixels,
              input.textureSize,
              input.bounds
            )
          }),
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
    textureSize: virtualInput.textureSize,
    meshBounds: virtualInput.meshBounds,
    rgbaBytes: virtualInput.rgbaBytes,
    densityHint: input.densityHint ?? "medium",
    densityParameters: density.parameters,
    maskExpansionPixels: ADAPTIVE_CONTOUR_MASK_EXPANSION_PIXELS,
    ...(input.alphaThreshold === undefined ? {} : { alphaThreshold: input.alphaThreshold })
  });

  if (contourPipeline.status === "blocked") {
    return {
      status: "blocked",
      reason: contourPipeline.reason,
      ...(contourPipeline.opaquePixelCount === undefined ? {} : { opaquePixelCount: contourPipeline.opaquePixelCount }),
      ...(contourPipeline.alphaBounds === undefined
        ? {}
        : {
            alphaBounds: mapVirtualAlphaBoundsToOriginalStageBounds(
              contourPipeline.alphaBounds.pixelBounds,
              virtualInput.paddingPixels,
              input.textureSize,
              input.bounds
            )
          }),
      contourPipeline
    };
  }

  const candidateInput = contourPipeline.candidateInput;
  const recovery = recoverV6DConstrainautorTriangles(createRecoveryInput(candidateInput));
  if (recovery.status === "failed") {
    return createVisibleV6DAdaptiveContourFallback({
      input,
      candidateInput,
      contourPipeline,
      density,
      virtualPaddingPixels: virtualInput.paddingPixels,
      reason: recovery.reason,
      diagnostics: recovery.diagnostics,
      provenance: createAdaptiveContourFallbackProvenance(candidateInput, recovery.reason, [
        "v6d-adaptive-contour-constrainautor-recovery-failed"
      ])
    });
  }

  const filtered = filterV6DConstrainautorTrianglesToMainMask({
    points: recovery.points,
    triangles: recovery.triangles,
    boundaryEdges: recovery.constraintEdges
  });
  const finalConstraintCounts = countPreservedConstraintEdges(filtered.triangles, recovery.constraintEdges);
  const diagnostics = {
    ...recovery.diagnostics,
    preservedConstraintEdgeCount: finalConstraintCounts.preserved,
    missingConstraintEdgeCount: finalConstraintCounts.missing,
    constraintRecoveryFailed: finalConstraintCounts.missing > 0,
    outsideTriangleCount: filtered.outsideOrCrossingTriangleCount,
    filteredTriangleCount: filtered.triangles.length
  } satisfies MeshGenerationV6ConstrainautorDiagnostics;

  if (filtered.triangles.length === 0 || finalConstraintCounts.missing > 0) {
    return createVisibleV6DAdaptiveContourFallback({
      input,
      candidateInput,
      contourPipeline,
      density,
      virtualPaddingPixels: virtualInput.paddingPixels,
      reason: "v6d-constraint-recovery-failed",
      diagnostics: {
        ...diagnostics,
        failureStage: "final-boundary-verification"
      },
      provenance: createAdaptiveContourFallbackProvenance(candidateInput, "v6d-constraint-recovery-failed", [
        "v6d-adaptive-contour-final-boundary-constraint-verification-failed"
      ])
    });
  }

  return createGeneratedV6DAdaptiveContourMesh({
    input,
    candidateInput,
    contourPipeline,
    density,
    virtualPaddingPixels: virtualInput.paddingPixels,
    points: recovery.points,
    triangles: filtered.triangles,
    diagnostics,
    filtered
  });
};

const createAdaptiveContourVirtualInput = (
  input: AutoOutlineV6DAdaptiveContourConstrainautorMeshInput
): AdaptiveContourVirtualInput => {
  const originalWidth = Math.round(input.textureSize.width);
  const originalHeight = Math.round(input.textureSize.height);
  const paddingPixels = ADAPTIVE_CONTOUR_VIRTUAL_PADDING_PIXELS;
  if (
    originalWidth <= 0 ||
    originalHeight <= 0 ||
    input.rgbaBytes.byteLength !== originalWidth * originalHeight * 4
  ) {
    return {
      textureSize: input.textureSize,
      meshBounds: input.bounds,
      rgbaBytes: input.rgbaBytes,
      paddingPixels: 0
    };
  }

  const paddedWidth = originalWidth + paddingPixels * 2;
  const paddedHeight = originalHeight + paddingPixels * 2;
  const rgbaBytes = new Uint8Array(paddedWidth * paddedHeight * 4);
  const sourceRowBytes = originalWidth * 4;
  for (let y = 0; y < originalHeight; y += 1) {
    const sourceOffset = y * sourceRowBytes;
    const targetOffset = ((y + paddingPixels) * paddedWidth + paddingPixels) * 4;
    rgbaBytes.set(input.rgbaBytes.subarray(sourceOffset, sourceOffset + sourceRowBytes), targetOffset);
  }

  return {
    textureSize: {
      width: paddedWidth,
      height: paddedHeight
    },
    meshBounds: {
      x: input.bounds.x - input.bounds.width * (paddingPixels / originalWidth),
      y: input.bounds.y - input.bounds.height * (paddingPixels / originalHeight),
      width: input.bounds.width * (paddedWidth / originalWidth),
      height: input.bounds.height * (paddedHeight / originalHeight)
    },
    rgbaBytes,
    paddingPixels
  };
};

const mapVirtualPaddedContourPointToOriginalUv = (
  point: V6ContourPoint,
  paddingPixels: number,
  originalTextureSize: AutoOutlineV6DAdaptiveContourConstrainautorMeshInput["textureSize"]
): V6ContourPoint =>
  mapV6ContourPointToUv(
    {
      x: point.x - paddingPixels,
      y: point.y - paddingPixels
    },
    Math.max(1, Math.round(originalTextureSize.width)),
    Math.max(1, Math.round(originalTextureSize.height))
  );

const unpadVirtualPixelBounds = (
  pixelBounds: V6ContourCandidateInput["alphaBounds"]["pixelBounds"],
  paddingPixels: number,
  originalTextureSize: AutoOutlineV6DAdaptiveContourConstrainautorMeshInput["textureSize"]
): V6ContourCandidateInput["alphaBounds"]["pixelBounds"] => {
  const width = Math.max(0, Math.round(originalTextureSize.width));
  const height = Math.max(0, Math.round(originalTextureSize.height));
  const left = clamp(pixelBounds.left - paddingPixels, 0, width);
  const right = clamp(pixelBounds.right - paddingPixels, 0, width);
  const top = clamp(pixelBounds.top - paddingPixels, 0, height);
  const bottom = clamp(pixelBounds.bottom - paddingPixels, 0, height);

  return {
    left: Math.min(left, right),
    top: Math.min(top, bottom),
    right: Math.max(left, right),
    bottom: Math.max(top, bottom)
  };
};

const mapVirtualAlphaBoundsToOriginalStageBounds = (
  pixelBounds: V6ContourCandidateInput["alphaBounds"]["pixelBounds"],
  paddingPixels: number,
  originalTextureSize: AutoOutlineV6DAdaptiveContourConstrainautorMeshInput["textureSize"],
  originalBounds: RectDto
): RectDto => {
  const originalPixelBounds = unpadVirtualPixelBounds(pixelBounds, paddingPixels, originalTextureSize);
  const originalWidth = Math.max(1, Math.round(originalTextureSize.width));
  const originalHeight = Math.max(1, Math.round(originalTextureSize.height));
  const topLeft = mapV6ContourPointToStagePoint(
    { x: originalPixelBounds.left, y: originalPixelBounds.top },
    originalBounds,
    originalWidth,
    originalHeight
  );
  const bottomRight = mapV6ContourPointToStagePoint(
    { x: originalPixelBounds.right, y: originalPixelBounds.bottom },
    originalBounds,
    originalWidth,
    originalHeight
  );

  return {
    x: topLeft.x,
    y: topLeft.y,
    width: roundCoordinate(bottomRight.x - topLeft.x),
    height: roundCoordinate(bottomRight.y - topLeft.y)
  };
};

const createRecoveryInput = (
  candidateInput: V6ContourCandidateInput
): {
  readonly points: readonly V6DConstrainautorPoint[];
  readonly constraintEdges: V6ContourCandidateInput["constraintEdges"];
} => ({
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

const createGeneratedV6DAdaptiveContourMesh = (input: {
  readonly input: AutoOutlineV6DAdaptiveContourConstrainautorMeshInput;
  readonly candidateInput: V6ContourCandidateInput;
  readonly contourPipeline: Extract<V6ContourPipelineResult, { readonly status: "generated" }>;
  readonly density: V6DAdaptiveDensityResolution;
  readonly virtualPaddingPixels: number;
  readonly points: readonly V6DConstrainautorPoint[];
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly diagnostics: MeshGenerationV6ConstrainautorDiagnostics;
  readonly filtered: FilteredTriangles;
}): AutoOutlineV6DAdaptiveContourConstrainautorMeshResult => {
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6d-adaptive-contour-constrainautor");
  const token = stripIdPrefix(input.input.drawableId, "draw_");
  const mesh: MeshDto = {
    meshId: input.input.meshId,
    drawableId: input.input.drawableId,
    vertices: input.points.map((point) =>
      mapV6ContourPointToStagePoint(
        point,
        input.candidateInput.meshBounds,
        input.candidateInput.textureSize.width,
        input.candidateInput.textureSize.height
      )
    ),
    uvs: input.points.map((point) =>
      mapVirtualPaddedContourPointToOriginalUv(point, input.virtualPaddingPixels, input.input.textureSize)
    ),
    triangles: input.triangles.map((triangle) => [...triangle] as [number, number, number]),
    vertexStableIds: input.points.map((point, index) =>
      point.role === "boundary"
        ? `vtx_${token}_v6d_adaptive_contour_boundary_${point.stableOrder}`
        : `vtx_${token}_v6d_adaptive_contour_interior_${point.stableOrder}_${index}`
    ),
    triangleStableIds: input.triangles.map(
      (_triangle, index) => `tri_${token}_v6d_adaptive_contour_${index}` as TriangleId
    ),
    topologyRevision: 0,
    bounds: structuredClone(input.input.bounds),
    generationProvenanceId: input.input.provenanceId
  };
  const boundaryVertexCount = input.points.filter((point) => point.role === "boundary").length;
  const qualityMetrics = computeMeshQualityMetrics(mesh, {
    refinementIterationCount: 0,
    triangulationMode: "v6d-adaptive-contour-constrainautor",
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
      provenance: createAdaptiveContourSuccessProvenance(input.candidateInput),
      contourPipelineDiagnostics: createV6ContourPipelineDiagnostics(input.contourPipeline),
      constrainautorDiagnostics: input.diagnostics,
      adaptiveDensityDiagnostics: input.density.diagnostics
    }
  });

  return {
    status: "generated",
    mesh,
    alphaBounds: mapVirtualAlphaBoundsToOriginalStageBounds(
      input.candidateInput.alphaBounds.pixelBounds,
      input.virtualPaddingPixels,
      input.input.textureSize,
      input.input.bounds
    ),
    qualityMetrics
  };
};

const createVisibleV6DAdaptiveContourFallback = (input: {
  readonly input: AutoOutlineV6DAdaptiveContourConstrainautorMeshInput;
  readonly candidateInput: V6ContourCandidateInput;
  readonly contourPipeline: Extract<V6ContourPipelineResult, { readonly status: "generated" }>;
  readonly density: V6DAdaptiveDensityResolution;
  readonly virtualPaddingPixels: number;
  readonly reason: MeshGenerationFallbackReason;
  readonly diagnostics: MeshGenerationV6ConstrainautorDiagnostics;
  readonly provenance: readonly string[];
}): AutoOutlineV6DAdaptiveContourConstrainautorMeshResult => {
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6d-adaptive-contour-constrainautor");
  const fallback = createV6DAlphaBoundsFallbackMesh({
    meshId: input.input.meshId,
    drawableId: input.input.drawableId,
    bounds: input.input.bounds,
    provenanceId: input.input.provenanceId,
    textureSize: input.input.textureSize,
    rgbaBytes: input.input.rgbaBytes,
    alphaBoundsPixels: unpadVirtualPixelBounds(
      input.candidateInput.alphaBounds.pixelBounds,
      input.virtualPaddingPixels,
      input.input.textureSize
    ),
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
      constrainautorDiagnostics: input.diagnostics,
      adaptiveDensityDiagnostics: input.density.diagnostics
    }
  });

  return {
    status: "fallback",
    mesh,
    source,
    reason: input.reason,
    fallbackSteps,
    alphaBounds: mapVirtualAlphaBoundsToOriginalStageBounds(
      input.candidateInput.alphaBounds.pixelBounds,
      input.virtualPaddingPixels,
      input.input.textureSize,
      input.input.bounds
    ),
    qualityMetrics
  };
};

const countPreservedConstraintEdges = (
  triangles: readonly (readonly [number, number, number])[],
  constraintEdges: readonly (readonly [number, number])[]
): { readonly preserved: number; readonly missing: number } => {
  let preserved = 0;
  for (const [left, right] of constraintEdges) {
    if (left !== right && edgeSetHasUndirectedEdge(triangles, left, right)) {
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

const createAdaptiveContourSuccessProvenance = (
  candidateInput: V6ContourCandidateInput
): readonly string[] => [
  ...candidateInput.diagnostics.provenance,
  "dependency-available",
  "v6d-adaptive-density-resolved",
  "v6d-adaptive-contour-constrainautor-delaunator-all-points",
  "v6d-adaptive-contour-constrainautor-constraint-recovery",
  "v6d-adaptive-contour-constrainautor-boundary-constraints-verified",
  "v6d-adaptive-contour-constrainautor-outside-triangle-filter"
];

const createAdaptiveContourFallbackProvenance = (
  candidateInput: V6ContourCandidateInput,
  reason: MeshGenerationFallbackReason,
  details: readonly string[]
): readonly string[] => [
  ...candidateInput.diagnostics.provenance,
  "dependency-available",
  "v6d-adaptive-density-resolved",
  "v6d-adaptive-contour-constrainautor-visible-fallback",
  `fallback-${reason}`,
  ...details
];

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

const undirectedEdgeKey = (left: number, right: number): string =>
  left < right ? `${left}:${right}` : `${right}:${left}`;

const stripIdPrefix = (id: string, prefix: string): string =>
  id.startsWith(prefix) ? id.slice(prefix.length) : id;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const roundCoordinate = (value: number): number => {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
};
