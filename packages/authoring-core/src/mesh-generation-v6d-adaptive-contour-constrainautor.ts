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
  allocateV6AlphaIslandBudgets,
  createV6AlphaIslandRgbaBytes,
  detectV6RawAlphaIslands,
  filterV6AlphaIslands,
  unionV6AlphaIslandPixelBounds,
  V6_ALPHA_ISLAND_NOISE_FILTER_CONSTANTS,
  type V6AlphaIslandBudgetAllocation,
  type V6AlphaIslandDetectionResult,
  type V6AlphaIslandNoiseFilterResult,
  type V6AlphaIslandPixelBounds,
  type V6RawAlphaIslandDescriptor
} from "./mesh-generation-v6-alpha-islands.js";
import {
  resolveV6DAdaptiveDensity,
  type V6DAdaptiveDensityResolution
} from "./mesh-generation-v6d-adaptive-density.js";
import {
  createV6DAlphaBoundsFallbackMesh,
  filterV6DConstrainautorTrianglesToMainMask,
  markV6DConstrainautorBoundaryRepairFinalVerificationFailed,
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

interface AdaptiveContourIslandBudget {
  readonly maxBoundaryVertices: number;
  readonly maxInteriorVertices: number;
}

export const createAutoOutlineV6DAdaptiveContourConstrainautorMesh = (
  input: AutoOutlineV6DAdaptiveContourConstrainautorMeshInput
): AutoOutlineV6DAdaptiveContourConstrainautorMeshResult => {
  const rawAlphaIslands = detectV6RawAlphaIslands({
    textureSize: input.textureSize,
    rgbaBytes: input.rgbaBytes,
    ...(input.alphaThreshold === undefined ? {} : { alphaThreshold: input.alphaThreshold })
  });
  if (rawAlphaIslands.status !== "detected" || rawAlphaIslands.islands.length <= 1) {
    return createSingleIslandV6DAdaptiveContourConstrainautorMesh(input);
  }

  const filteredIslands = filterV6AlphaIslands(rawAlphaIslands.islands);
  if (filteredIslands.keptIslands.length === 0) {
    return createNoKeptIslandV6DAdaptiveContourFallback({
      input,
      rawAlphaIslands,
      filteredIslands
    });
  }

  if (filteredIslands.keptIslands.length === 1) {
    return createSingleKeptIslandV6DAdaptiveContourConstrainautorMesh({
      input,
      rawAlphaIslands,
      filteredIslands,
      island: filteredIslands.keptIslands[0]!
    });
  }

  return createMultiIslandV6DAdaptiveContourConstrainautorMesh({
    input,
    rawAlphaIslands,
    filteredIslands
  });
};

const createSingleIslandV6DAdaptiveContourConstrainautorMesh = (
  input: AutoOutlineV6DAdaptiveContourConstrainautorMeshInput,
  islandBudget?: AdaptiveContourIslandBudget
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
  const resolvedDensity =
    islandBudget === undefined ? density : applyIslandBudgetToDensity(density, islandBudget);
  const contourPipeline = createV6ContourCandidateInput({
    textureSize: virtualInput.textureSize,
    meshBounds: virtualInput.meshBounds,
    rgbaBytes: virtualInput.rgbaBytes,
    densityHint: input.densityHint ?? "medium",
    densityParameters: resolvedDensity.parameters,
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
      density: resolvedDensity,
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
      density: resolvedDensity,
      virtualPaddingPixels: virtualInput.paddingPixels,
      reason: "v6d-constraint-recovery-failed",
      diagnostics: markV6DConstrainautorBoundaryRepairFinalVerificationFailed({
        ...diagnostics,
        failureStage: "final-boundary-verification"
      }),
      provenance: createAdaptiveContourFallbackProvenance(candidateInput, "v6d-constraint-recovery-failed", [
        "v6d-adaptive-contour-final-boundary-constraint-verification-failed"
      ])
    });
  }

  return createGeneratedV6DAdaptiveContourMesh({
    input,
    candidateInput,
    contourPipeline,
    density: resolvedDensity,
    virtualPaddingPixels: virtualInput.paddingPixels,
    points: recovery.points,
    triangles: filtered.triangles,
    diagnostics,
    filtered
  });
};

interface AdaptiveContourIslandOutput {
  readonly island: V6RawAlphaIslandDescriptor;
  readonly budget?: V6AlphaIslandBudgetAllocation;
  readonly status: "generated" | "fallback";
  readonly mesh: MeshDto;
  readonly source: DrawableGeneratedMeshSource;
  readonly alphaBounds?: RectDto;
  readonly reason?: MeshGenerationFallbackReason;
  readonly qualityMetrics?: MeshGenerationQualityMetrics;
}

const createSingleKeptIslandV6DAdaptiveContourConstrainautorMesh = (input: {
  readonly input: AutoOutlineV6DAdaptiveContourConstrainautorMeshInput;
  readonly rawAlphaIslands: V6AlphaIslandDetectionResult;
  readonly filteredIslands: V6AlphaIslandNoiseFilterResult;
  readonly island: V6RawAlphaIslandDescriptor;
}): AutoOutlineV6DAdaptiveContourConstrainautorMeshResult => {
  const isolatedRgbaBytes = createV6AlphaIslandRgbaBytes({
    sourceRgbaBytes: input.input.rgbaBytes,
    textureSize: input.input.textureSize,
    island: input.island
  });
  const generated = createSingleIslandV6DAdaptiveContourConstrainautorMesh({
    ...input.input,
    rgbaBytes: isolatedRgbaBytes
  });

  if (generated.status !== "blocked") {
    return withV6DAdaptiveContourIslandMetrics(generated, {
      rawAlphaIslands: input.rawAlphaIslands,
      filteredIslands: input.filteredIslands,
      outputs: [
        {
          island: input.island,
          status: generated.status === "generated" ? "generated" : "fallback",
          mesh: generated.mesh,
          source:
            generated.status === "generated"
              ? "outline-v6d-adaptive-contour-constrainautor-rgba"
              : generated.source,
          ...(generated.alphaBounds === undefined ? {} : { alphaBounds: generated.alphaBounds }),
          ...(generated.status === "fallback" ? { reason: generated.reason } : {}),
          qualityMetrics: generated.qualityMetrics
        }
      ]
    });
  }

  const fallbackOutput = createLocalizedBlockedIslandFallbackOutput({
    input: input.input,
    island: input.island,
    isolatedRgbaBytes,
    reason: generated.reason
  });
  return createMergedV6DAdaptiveContourMesh({
    input: input.input,
    rawAlphaIslands: input.rawAlphaIslands,
    filteredIslands: input.filteredIslands,
    globalDensity: resolveV6DAdaptiveDensity({
      densityHint: input.input.densityHint ?? "medium",
      selectedComponentPixelCount: input.island.pixelCount,
      alphaBounds: input.island.bounds
    }),
    outputs: [fallbackOutput]
  });
};

const createMultiIslandV6DAdaptiveContourConstrainautorMesh = (input: {
  readonly input: AutoOutlineV6DAdaptiveContourConstrainautorMeshInput;
  readonly rawAlphaIslands: V6AlphaIslandDetectionResult;
  readonly filteredIslands: V6AlphaIslandNoiseFilterResult;
}): AutoOutlineV6DAdaptiveContourConstrainautorMeshResult => {
  const keptPixelBounds = unionV6AlphaIslandPixelBounds(input.filteredIslands.keptIslands);
  if (keptPixelBounds === undefined) {
    return createNoKeptIslandV6DAdaptiveContourFallback(input);
  }

  const globalDensity = resolveV6DAdaptiveDensity({
    densityHint: input.input.densityHint ?? "medium",
    selectedComponentPixelCount: input.filteredIslands.keptIslands.reduce(
      (sum, island) => sum + island.pixelCount,
      0
    ),
    alphaBounds: keptPixelBounds
  });
  const budgetAllocations = allocateV6AlphaIslandBudgets({
    densityHint: input.input.densityHint ?? "medium",
    islands: input.filteredIslands.keptIslands,
    globalMaxBoundaryVertices: globalDensity.parameters.maxBoundaryVertices,
    globalMaxInteriorVertices: globalDensity.parameters.maxInteriorVertices
  });
  const budgetByComponentOrder = new Map(
    budgetAllocations.map((allocation) => [allocation.componentOrder, allocation])
  );
  const outputs = input.filteredIslands.keptIslands.map((island) => {
    const isolatedRgbaBytes = createV6AlphaIslandRgbaBytes({
      sourceRgbaBytes: input.input.rgbaBytes,
      textureSize: input.input.textureSize,
      island
    });
    const budget = budgetByComponentOrder.get(island.componentOrder);
    const generated = createSingleIslandV6DAdaptiveContourConstrainautorMesh(
      {
        ...input.input,
        rgbaBytes: isolatedRgbaBytes
      },
      budget === undefined
        ? undefined
        : {
            maxBoundaryVertices: budget.maxBoundaryVertices,
            maxInteriorVertices: budget.maxInteriorVertices
          }
    );

    if (generated.status === "generated") {
      return {
        island,
        ...(budget === undefined ? {} : { budget }),
        status: "generated" as const,
        mesh: generated.mesh,
        source: "outline-v6d-adaptive-contour-constrainautor-rgba" as const,
        alphaBounds: generated.alphaBounds,
        qualityMetrics: generated.qualityMetrics
      };
    }

    if (generated.status === "fallback") {
      return {
        island,
        ...(budget === undefined ? {} : { budget }),
        status: "fallback" as const,
        mesh: generated.mesh,
        source: generated.source,
        reason: generated.reason,
        ...(generated.alphaBounds === undefined ? {} : { alphaBounds: generated.alphaBounds }),
        qualityMetrics: generated.qualityMetrics
      };
    }

    return createLocalizedBlockedIslandFallbackOutput({
      input: input.input,
      island,
      ...(budget === undefined ? {} : { budget }),
      isolatedRgbaBytes,
      reason: generated.reason
    });
  });

  if (outputs.length === 0) {
    return createNoKeptIslandV6DAdaptiveContourFallback(input);
  }

  return createMergedV6DAdaptiveContourMesh({
    input: input.input,
    rawAlphaIslands: input.rawAlphaIslands,
    filteredIslands: input.filteredIslands,
    globalDensity,
    outputs
  });
};

const createLocalizedBlockedIslandFallbackOutput = (input: {
  readonly input: AutoOutlineV6DAdaptiveContourConstrainautorMeshInput;
  readonly island: V6RawAlphaIslandDescriptor;
  readonly budget?: V6AlphaIslandBudgetAllocation;
  readonly isolatedRgbaBytes: Uint8Array;
  readonly reason: MeshGenerationFallbackReason;
}): AdaptiveContourIslandOutput => {
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6d-adaptive-contour-constrainautor");
  const fallback = createV6DAlphaBoundsFallbackMesh({
    meshId: input.input.meshId,
    drawableId: input.input.drawableId,
    bounds: input.input.bounds,
    provenanceId: input.input.provenanceId,
    textureSize: input.input.textureSize,
    rgbaBytes: input.isolatedRgbaBytes,
    alphaBoundsPixels: input.island.bounds,
    densityHint: input.input.densityHint ?? "medium"
  });
  const boundaryVertexCount = countBoundaryVertices(fallback.mesh);
  const fallbackSteps: readonly MeshGenerationFallbackStep[] = [
    {
      method: candidate.methodId,
      reason: input.reason
    }
  ];
  const qualityMetrics = computeMeshQualityMetrics(fallback.mesh, {
    refinementIterationCount: 0,
    fallbackReason: input.reason,
    triangulationMode: "v6-backend-blocked-fallback",
    v6Metrics: {
      algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
      methodId: candidate.methodId,
      backendId: candidate.backendId,
      backendImplementationStatus: candidate.backendImplementationStatus,
      requestedSourceId: candidate.sourceId,
      actualSourceId: "alpha-aware-rgba",
      outputKind: "fallback-output",
      preset: input.input.densityHint ?? "medium",
      fallbackReason: input.reason,
      fallbackSteps,
      vertexCount: fallback.mesh.vertices.length,
      triangleCount: fallback.mesh.triangles.length,
      boundaryVertexCount,
      interiorVertexCount: Math.max(0, fallback.mesh.vertices.length - boundaryVertexCount),
      alphaBoundsAvailable: true,
      opaquePixelCount: input.island.pixelCount,
      contourLoopCount: 0,
      holeLikeRegionCount: 0,
      removedTriangleCount: 0,
      outsideOrCrossingTriangleCount: 0,
      multiIslandHandling: "supported",
      holeHandling: "not-evaluated",
      provenance: [
        "v6d-adaptive-contour-multi-island-localized-fallback",
        `fallback-${input.reason}`
      ],
      constrainautorDiagnostics: {
        dependencyGateStatus: "available",
        constraintEdgeCount: 0,
        preservedConstraintEdgeCount: 0,
        missingConstraintEdgeCount: 0,
        constraintRecoveryFailed: false,
        outsideTriangleCount: 0
      },
      adaptiveDensityDiagnostics: {
        adaptiveDensityReferenceArea: 0,
        adaptiveDensityEffectiveArea: input.island.pixelCount,
        adaptiveDensityAreaRatio: 0,
        adaptiveDensityClampedAreaRatio: 0,
        adaptiveDensitySpacingScale: 0,
        adaptiveDensityVertexScale: 0,
        adaptiveDensityBoundaryCapScale: 0,
        resolvedBoundarySpacing: 0,
        resolvedInteriorSpacing: 0,
        resolvedMaxBoundaryVertices: input.budget?.maxBoundaryVertices ?? 0,
        resolvedMaxInteriorVertices: input.budget?.maxInteriorVertices ?? 0,
        resolvedInteriorBoundaryClearance: 0
      }
    }
  });

  return {
    island: input.island,
    ...(input.budget === undefined ? {} : { budget: input.budget }),
    status: "fallback",
    mesh: fallback.mesh,
    source: "alpha-aware-rgba",
    alphaBounds: mapOriginalPixelBoundsToStageBounds(
      input.island.bounds,
      input.input.textureSize,
      input.input.bounds
    ),
    reason: input.reason,
    qualityMetrics
  };
};

const createNoKeptIslandV6DAdaptiveContourFallback = (input: {
  readonly input: AutoOutlineV6DAdaptiveContourConstrainautorMeshInput;
  readonly rawAlphaIslands: V6AlphaIslandDetectionResult;
  readonly filteredIslands: V6AlphaIslandNoiseFilterResult;
}): AutoOutlineV6DAdaptiveContourConstrainautorMeshResult => {
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6d-adaptive-contour-constrainautor");
  const rawPixelBounds = unionV6AlphaIslandPixelBounds(input.rawAlphaIslands.islands);
  if (rawPixelBounds === undefined) {
    return createSingleIslandV6DAdaptiveContourConstrainautorMesh(input.input);
  }

  const fallback = createV6DAlphaBoundsFallbackMesh({
    meshId: input.input.meshId,
    drawableId: input.input.drawableId,
    bounds: input.input.bounds,
    provenanceId: input.input.provenanceId,
    textureSize: input.input.textureSize,
    rgbaBytes: input.input.rgbaBytes,
    alphaBoundsPixels: rawPixelBounds,
    densityHint: input.input.densityHint ?? "medium"
  });
  const reason: MeshGenerationFallbackReason = "v6-contour-extraction-failed";
  const fallbackSteps: readonly MeshGenerationFallbackStep[] = [
    {
      method: candidate.methodId,
      reason
    }
  ];
  const boundaryVertexCount = countBoundaryVertices(fallback.mesh);
  const v6Metrics = {
    algorithmId: "auto-outline-v6-alpha-constrained-delaunay" as const,
    methodId: candidate.methodId,
    backendId: candidate.backendId,
    backendImplementationStatus: candidate.backendImplementationStatus,
    requestedSourceId: candidate.sourceId,
    actualSourceId: "alpha-aware-rgba" as const,
    outputKind: "fallback-output" as const,
    preset: input.input.densityHint ?? "medium",
    fallbackReason: reason,
    fallbackSteps,
    vertexCount: fallback.mesh.vertices.length,
    triangleCount: fallback.mesh.triangles.length,
    boundaryVertexCount,
    interiorVertexCount: Math.max(0, fallback.mesh.vertices.length - boundaryVertexCount),
    alphaBoundsAvailable: true,
    opaquePixelCount: input.rawAlphaIslands.opaquePixelCount,
    contourLoopCount: 0,
    holeLikeRegionCount: 0,
    removedTriangleCount: 0,
    outsideOrCrossingTriangleCount: 0,
    multiIslandHandling: "supported" as const,
    holeHandling: "not-evaluated" as const,
    provenance: [
      "v6-contour-raw-alpha-component-detection",
      "v6-contour-alpha-island-noise-filter",
      "v6d-adaptive-contour-multi-island-no-kept-islands",
      `fallback-${reason}`
    ],
    multiIslandDiagnostics: createMultiIslandDiagnostics({
      rawAlphaIslands: input.rawAlphaIslands,
      filteredIslands: input.filteredIslands,
      outputs: [],
      budgets: [],
      localizedFallbackReasons: []
    })
  };
  const qualityMetrics = computeMeshQualityMetrics(fallback.mesh, {
    refinementIterationCount: 0,
    fallbackReason: reason,
    triangulationMode: "v6-backend-blocked-fallback",
    v6Metrics
  });

  return {
    status: "fallback",
    mesh: fallback.mesh,
    source: "alpha-aware-rgba",
    reason,
    fallbackSteps,
    alphaBounds: mapOriginalPixelBoundsToStageBounds(
      rawPixelBounds,
      input.input.textureSize,
      input.input.bounds
    ),
    qualityMetrics
  };
};

const createMergedV6DAdaptiveContourMesh = (input: {
  readonly input: AutoOutlineV6DAdaptiveContourConstrainautorMeshInput;
  readonly rawAlphaIslands: V6AlphaIslandDetectionResult;
  readonly filteredIslands: V6AlphaIslandNoiseFilterResult;
  readonly globalDensity: V6DAdaptiveDensityResolution;
  readonly outputs: readonly AdaptiveContourIslandOutput[];
}): AutoOutlineV6DAdaptiveContourConstrainautorMeshResult => {
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6d-adaptive-contour-constrainautor");
  const sortedOutputs = [...input.outputs].sort(
    (left, right) => left.island.componentOrder - right.island.componentOrder
  );
  const fallbackOutputs = sortedOutputs.filter((output) => output.status === "fallback");
  if (fallbackOutputs.length === sortedOutputs.length) {
    return createWholeDrawableMultiIslandFallback({
      ...input,
      outputs: sortedOutputs,
      fallbackOutputs
    });
  }

  const shouldScopeStableIds = sortedOutputs.length > 1;
  const vertices: MeshDto["vertices"] = [];
  const uvs: MeshDto["uvs"] = [];
  const triangles: MeshDto["triangles"] = [];
  const vertexStableIds: string[] = [];
  const triangleStableIds: TriangleId[] = [];

  for (const output of sortedOutputs) {
    const vertexOffset = vertices.length;
    vertices.push(...output.mesh.vertices);
    uvs.push(...output.mesh.uvs);
    vertexStableIds.push(
      ...output.mesh.vertexStableIds.map((stableId) =>
        createIslandScopedStableId(stableId, output.island.componentOrder, shouldScopeStableIds)
      )
    );
    triangles.push(
      ...output.mesh.triangles.map(
        ([a, b, c]) => [a + vertexOffset, b + vertexOffset, c + vertexOffset] as [number, number, number]
      )
    );
    const sourceTriangleStableIds =
      output.mesh.triangleStableIds ??
      output.mesh.triangles.map(
        (_triangle, triangleIndex) =>
          `tri_${stripIdPrefix(input.input.drawableId, "draw_")}_v6d_adaptive_contour_island_${output.island.componentOrder}_${triangleIndex}` as TriangleId
      );
    triangleStableIds.push(
      ...sourceTriangleStableIds.map(
        (stableId) =>
          createIslandScopedStableId(stableId, output.island.componentOrder, shouldScopeStableIds) as TriangleId
      )
    );
  }

  const mesh: MeshDto = {
    meshId: input.input.meshId,
    drawableId: input.input.drawableId,
    vertices,
    uvs,
    triangles,
    vertexStableIds,
    triangleStableIds,
    topologyRevision: 0,
    bounds: structuredClone(input.input.bounds),
    generationProvenanceId: input.input.provenanceId
  };
  const alphaBounds =
    unionRects(
      sortedOutputs.map(
        (output) =>
          output.alphaBounds ??
          mapOriginalPixelBoundsToStageBounds(output.island.bounds, input.input.textureSize, input.input.bounds)
      )
    ) ?? input.input.bounds;
  const localizedFallbackReasons = fallbackOutputs.flatMap((output) =>
    output.reason === undefined
      ? []
      : [
          {
            componentOrder: output.island.componentOrder,
            reason: output.reason
          }
        ]
  );
  const firstFallbackReason = localizedFallbackReasons[0]?.reason;
  const fallbackSteps: readonly MeshGenerationFallbackStep[] =
    firstFallbackReason === undefined
      ? []
      : [
          {
            method: candidate.methodId,
            reason: firstFallbackReason
          }
        ];
  const boundaryVertexCount = countBoundaryVertices(mesh);
  const islandMetrics = sortedOutputs
    .map((output) => output.qualityMetrics?.v6Metrics)
    .filter((metrics): metrics is NonNullable<MeshGenerationQualityMetrics["v6Metrics"]> => metrics !== undefined);
  const contourPipelineDiagnostics = aggregateContourPipelineDiagnostics(
    input.rawAlphaIslands,
    islandMetrics
  );
  const constrainautorDiagnostics = aggregateConstrainautorDiagnostics(islandMetrics);
  const v6Metrics = {
    algorithmId: "auto-outline-v6-alpha-constrained-delaunay" as const,
    methodId: candidate.methodId,
    backendId: candidate.backendId,
    backendImplementationStatus: candidate.backendImplementationStatus,
    requestedSourceId: candidate.sourceId,
    actualSourceId:
      fallbackOutputs.length === sortedOutputs.length
        ? ("alpha-aware-rgba" as const)
        : candidate.sourceId,
    outputKind: fallbackOutputs.length > 0 ? ("fallback-output" as const) : ("backend-output" as const),
    preset: input.input.densityHint ?? "medium",
    ...(firstFallbackReason === undefined ? {} : { fallbackReason: firstFallbackReason }),
    fallbackSteps,
    vertexCount: mesh.vertices.length,
    triangleCount: mesh.triangles.length,
    boundaryVertexCount,
    interiorVertexCount: Math.max(0, mesh.vertices.length - boundaryVertexCount),
    alphaBoundsAvailable: true,
    opaquePixelCount: input.rawAlphaIslands.opaquePixelCount,
    contourLoopCount: sumMetric(islandMetrics, "contourLoopCount"),
    holeLikeRegionCount: sumMetric(islandMetrics, "holeLikeRegionCount"),
    removedTriangleCount: sumMetric(islandMetrics, "removedTriangleCount"),
    outsideOrCrossingTriangleCount: sumMetric(islandMetrics, "outsideOrCrossingTriangleCount"),
    multiIslandHandling: "supported" as const,
    holeHandling: islandMetrics.some((metrics) => metrics.holeHandling === "unsupported-fallback")
      ? ("unsupported-fallback" as const)
      : ("supported" as const),
    provenance: createMergedMultiIslandProvenance({
      skippedTinyNoiseIslandCount: input.filteredIslands.skippedTinyNoiseIslands.length,
      localizedFallbackCount: fallbackOutputs.length
    }),
    contourPipelineDiagnostics,
    constrainautorDiagnostics,
    adaptiveDensityDiagnostics: input.globalDensity.diagnostics,
    multiIslandDiagnostics: createMultiIslandDiagnostics({
      rawAlphaIslands: input.rawAlphaIslands,
      filteredIslands: input.filteredIslands,
      outputs: sortedOutputs,
      budgets: sortedOutputs.flatMap((output) => output.budget ?? []),
      budgetPolicy: createBudgetPolicyDiagnostics({
        globalDensity: input.globalDensity,
        budgets: sortedOutputs.flatMap((output) => output.budget ?? [])
      }),
      localizedFallbackReasons
    })
  };
  const qualityMetrics = computeMeshQualityMetrics(mesh, {
    refinementIterationCount: 0,
    ...(firstFallbackReason === undefined ? {} : { fallbackReason: firstFallbackReason }),
    triangulationMode: "v6d-adaptive-contour-constrainautor",
    v6Metrics
  });

  if (firstFallbackReason !== undefined) {
    return {
      status: "fallback",
      mesh,
      source: fallbackOutputs.length === sortedOutputs.length ? "alpha-aware-rgba" : candidate.sourceId,
      reason: firstFallbackReason,
      fallbackSteps,
      alphaBounds,
      qualityMetrics
    };
  }

  return {
    status: "generated",
    mesh,
    alphaBounds,
    qualityMetrics
  };
};

const createWholeDrawableMultiIslandFallback = (input: {
  readonly input: AutoOutlineV6DAdaptiveContourConstrainautorMeshInput;
  readonly rawAlphaIslands: V6AlphaIslandDetectionResult;
  readonly filteredIslands: V6AlphaIslandNoiseFilterResult;
  readonly globalDensity: V6DAdaptiveDensityResolution;
  readonly outputs: readonly AdaptiveContourIslandOutput[];
  readonly fallbackOutputs: readonly AdaptiveContourIslandOutput[];
}): AutoOutlineV6DAdaptiveContourConstrainautorMeshResult => {
  const candidate = getV6MeshGenerationCandidate("auto-outline-v6d-adaptive-contour-constrainautor");
  const fallbackPixelBounds =
    unionV6AlphaIslandPixelBounds(input.filteredIslands.keptIslands) ??
    unionV6AlphaIslandPixelBounds(input.rawAlphaIslands.islands);
  if (fallbackPixelBounds === undefined) {
    return createNoKeptIslandV6DAdaptiveContourFallback(input);
  }

  const reason: MeshGenerationFallbackReason =
    input.fallbackOutputs[0]?.reason ?? "v6-contour-extraction-failed";
  const fallback = createV6DAlphaBoundsFallbackMesh({
    meshId: input.input.meshId,
    drawableId: input.input.drawableId,
    bounds: input.input.bounds,
    provenanceId: input.input.provenanceId,
    textureSize: input.input.textureSize,
    rgbaBytes: input.input.rgbaBytes,
    alphaBoundsPixels: fallbackPixelBounds,
    densityHint: input.input.densityHint ?? "medium"
  });
  const fallbackSteps: readonly MeshGenerationFallbackStep[] = [
    {
      method: candidate.methodId,
      reason
    }
  ];
  const localizedFallbackReasons = input.fallbackOutputs.flatMap((output) =>
    output.reason === undefined
      ? []
      : [
          {
            componentOrder: output.island.componentOrder,
            reason: output.reason
          }
        ]
  );
  const islandMetrics = input.outputs
    .map((output) => output.qualityMetrics?.v6Metrics)
    .filter((metrics): metrics is V6Metrics => metrics !== undefined);
  const boundaryVertexCount = countBoundaryVertices(fallback.mesh);
  const budgets = input.outputs.flatMap((output) => output.budget ?? []);
  const v6Metrics = {
    algorithmId: "auto-outline-v6-alpha-constrained-delaunay" as const,
    methodId: candidate.methodId,
    backendId: candidate.backendId,
    backendImplementationStatus: candidate.backendImplementationStatus,
    requestedSourceId: candidate.sourceId,
    actualSourceId: "alpha-aware-rgba" as const,
    outputKind: "fallback-output" as const,
    preset: input.input.densityHint ?? "medium",
    fallbackReason: reason,
    fallbackSteps,
    vertexCount: fallback.mesh.vertices.length,
    triangleCount: fallback.mesh.triangles.length,
    boundaryVertexCount,
    interiorVertexCount: Math.max(0, fallback.mesh.vertices.length - boundaryVertexCount),
    alphaBoundsAvailable: true,
    opaquePixelCount: input.rawAlphaIslands.opaquePixelCount,
    contourLoopCount: sumMetric(islandMetrics, "contourLoopCount"),
    holeLikeRegionCount: sumMetric(islandMetrics, "holeLikeRegionCount"),
    removedTriangleCount: sumMetric(islandMetrics, "removedTriangleCount"),
    outsideOrCrossingTriangleCount: sumMetric(islandMetrics, "outsideOrCrossingTriangleCount"),
    multiIslandHandling: "supported" as const,
    holeHandling: islandMetrics.some((metrics) => metrics.holeHandling === "unsupported-fallback")
      ? ("unsupported-fallback" as const)
      : ("supported" as const),
    provenance: createAllIslandFallbackProvenance({
      skippedTinyNoiseIslandCount: input.filteredIslands.skippedTinyNoiseIslands.length,
      reason
    }),
    contourPipelineDiagnostics: aggregateContourPipelineDiagnostics(input.rawAlphaIslands, islandMetrics),
    constrainautorDiagnostics: aggregateConstrainautorDiagnostics(islandMetrics),
    adaptiveDensityDiagnostics: input.globalDensity.diagnostics,
    multiIslandDiagnostics: createMultiIslandDiagnostics({
      rawAlphaIslands: input.rawAlphaIslands,
      filteredIslands: input.filteredIslands,
      outputs: input.outputs,
      budgets,
      budgetPolicy: createBudgetPolicyDiagnostics({
        globalDensity: input.globalDensity,
        budgets
      }),
      localizedFallbackReasons
    })
  };
  const qualityMetrics = computeMeshQualityMetrics(fallback.mesh, {
    refinementIterationCount: 0,
    fallbackReason: reason,
    triangulationMode: "v6-backend-blocked-fallback",
    v6Metrics
  });

  return {
    status: "fallback",
    mesh: fallback.mesh,
    source: "alpha-aware-rgba",
    reason,
    fallbackSteps,
    alphaBounds: mapOriginalPixelBoundsToStageBounds(
      fallbackPixelBounds,
      input.input.textureSize,
      input.input.bounds
    ),
    qualityMetrics
  };
};

const withV6DAdaptiveContourIslandMetrics = (
  result: Exclude<AutoOutlineV6DAdaptiveContourConstrainautorMeshResult, { readonly status: "blocked" }>,
  input: {
    readonly rawAlphaIslands: V6AlphaIslandDetectionResult;
    readonly filteredIslands: V6AlphaIslandNoiseFilterResult;
    readonly outputs: readonly AdaptiveContourIslandOutput[];
  }
): AutoOutlineV6DAdaptiveContourConstrainautorMeshResult => {
  const baseV6Metrics = result.qualityMetrics.v6Metrics;
  if (baseV6Metrics === undefined) {
    return result;
  }

  const v6Metrics = {
    ...baseV6Metrics,
    opaquePixelCount: input.rawAlphaIslands.opaquePixelCount,
    multiIslandHandling: "supported" as const,
    provenance: [
      ...baseV6Metrics.provenance,
      "v6-contour-raw-alpha-component-detection",
      "v6-contour-alpha-island-noise-filter",
      ...(input.filteredIslands.skippedTinyNoiseIslands.length > 0
        ? ["v6d-adaptive-contour-multi-island-noise-filtered"]
        : [])
    ],
    multiIslandDiagnostics: createMultiIslandDiagnostics({
      rawAlphaIslands: input.rawAlphaIslands,
      filteredIslands: input.filteredIslands,
      outputs: input.outputs,
      budgets: [],
      localizedFallbackReasons: input.outputs.flatMap((output) =>
        output.reason === undefined
          ? []
          : [
              {
                componentOrder: output.island.componentOrder,
                reason: output.reason
              }
            ]
      )
    })
  };
  const qualityMetrics = {
    ...result.qualityMetrics,
    v6Metrics
  };

  return {
    ...result,
    qualityMetrics
  };
};

const applyIslandBudgetToDensity = (
  density: V6DAdaptiveDensityResolution,
  islandBudget: AdaptiveContourIslandBudget
): V6DAdaptiveDensityResolution => {
  const maxBoundaryVertices = Math.max(3, Math.trunc(islandBudget.maxBoundaryVertices));
  const maxInteriorVertices = Math.max(0, Math.trunc(islandBudget.maxInteriorVertices));
  return {
    parameters: {
      ...density.parameters,
      maxBoundaryVertices,
      maxInteriorVertices
    },
    diagnostics: {
      ...density.diagnostics,
      resolvedMaxBoundaryVertices: maxBoundaryVertices,
      resolvedMaxInteriorVertices: maxInteriorVertices
    }
  };
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

const mapOriginalPixelBoundsToStageBounds = (
  pixelBounds: V6AlphaIslandPixelBounds,
  originalTextureSize: AutoOutlineV6DAdaptiveContourConstrainautorMeshInput["textureSize"],
  originalBounds: RectDto
): RectDto => {
  const originalWidth = Math.max(1, Math.round(originalTextureSize.width));
  const originalHeight = Math.max(1, Math.round(originalTextureSize.height));
  const topLeft = mapV6ContourPointToStagePoint(
    { x: pixelBounds.left, y: pixelBounds.top },
    originalBounds,
    originalWidth,
    originalHeight
  );
  const bottomRight = mapV6ContourPointToStagePoint(
    { x: pixelBounds.right, y: pixelBounds.bottom },
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

const unionRects = (rects: readonly RectDto[]): RectDto | undefined => {
  if (rects.length === 0) {
    return undefined;
  }

  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return {
    x: roundCoordinate(left),
    y: roundCoordinate(top),
    width: roundCoordinate(right - left),
    height: roundCoordinate(bottom - top)
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

type V6Metrics = NonNullable<MeshGenerationQualityMetrics["v6Metrics"]>;

interface V6MultiIslandBudgetPolicyDiagnostics {
  readonly globalMaxBoundaryVertices: number;
  readonly globalMaxInteriorVertices: number;
  readonly allocatedMaxBoundaryVertices: number;
  readonly allocatedMaxInteriorVertices: number;
  readonly minimumBoundaryFloorExceededGlobalCap: boolean;
  readonly minimumInteriorFloorExceededGlobalCap: boolean;
}

const aggregateContourPipelineDiagnostics = (
  rawAlphaIslands: V6AlphaIslandDetectionResult,
  islandMetrics: readonly V6Metrics[]
): MeshGenerationV6ContourPipelineDiagnostics => {
  const diagnostics = islandMetrics.flatMap((metrics) => metrics.contourPipelineDiagnostics ?? []);
  return {
    status: "generated",
    inputOpaquePixelCount: rawAlphaIslands.opaquePixelCount,
    softMaskOpaquePixelCount: diagnostics.reduce(
      (sum, diagnostic) => sum + diagnostic.softMaskOpaquePixelCount,
      0
    ),
    selectedComponentPixelCount: diagnostics.reduce(
      (sum, diagnostic) => sum + diagnostic.selectedComponentPixelCount,
      0
    ),
    boundaryPointCount: diagnostics.reduce(
      (sum, diagnostic) => sum + diagnostic.boundaryPointCount,
      0
    ),
    constraintEdgeCount: diagnostics.reduce(
      (sum, diagnostic) => sum + diagnostic.constraintEdgeCount,
      0
    ),
    steinerPointCount: diagnostics.reduce(
      (sum, diagnostic) => sum + diagnostic.steinerPointCount,
      0
    ),
    alphaBoundsAvailable: true
  };
};

const aggregateConstrainautorDiagnostics = (
  islandMetrics: readonly V6Metrics[]
): MeshGenerationV6ConstrainautorDiagnostics => {
  const diagnostics = islandMetrics.flatMap((metrics) => metrics.constrainautorDiagnostics ?? []);
  return {
    dependencyGateStatus: "available",
    constraintEdgeCount: diagnostics.reduce(
      (sum, diagnostic) => sum + diagnostic.constraintEdgeCount,
      0
    ),
    preservedConstraintEdgeCount: diagnostics.reduce(
      (sum, diagnostic) => sum + diagnostic.preservedConstraintEdgeCount,
      0
    ),
    missingConstraintEdgeCount: diagnostics.reduce(
      (sum, diagnostic) => sum + diagnostic.missingConstraintEdgeCount,
      0
    ),
    constraintRecoveryFailed: diagnostics.some((diagnostic) => diagnostic.constraintRecoveryFailed),
    outsideTriangleCount: diagnostics.reduce(
      (sum, diagnostic) => sum + diagnostic.outsideTriangleCount,
      0
    )
  };
};

const createMultiIslandDiagnostics = (input: {
  readonly rawAlphaIslands: V6AlphaIslandDetectionResult;
  readonly filteredIslands: V6AlphaIslandNoiseFilterResult;
  readonly outputs: readonly AdaptiveContourIslandOutput[];
  readonly budgets: readonly V6AlphaIslandBudgetAllocation[];
  readonly budgetPolicy?: V6MultiIslandBudgetPolicyDiagnostics;
  readonly localizedFallbackReasons: readonly {
    readonly componentOrder: number;
    readonly reason: MeshGenerationFallbackReason;
  }[];
}): {
  readonly rawAlphaComponentCount: number;
  readonly keptIslandCount: number;
  readonly generatedIslandCount: number;
  readonly backendGeneratedIslandCount: number;
  readonly skippedTinyNoiseIslandCount: number;
  readonly skippedTinyNoisePixelCount: number;
  readonly rawOpaquePixelCount: number;
  readonly largestComponentPixelCount: number;
  readonly localizedFallbackCount: number;
  readonly localizedFallbackReasons: readonly {
    readonly componentOrder: number;
    readonly reason: MeshGenerationFallbackReason;
  }[];
  readonly noiseFilterConstants: typeof V6_ALPHA_ISLAND_NOISE_FILTER_CONSTANTS;
  readonly budgetPolicy: V6MultiIslandBudgetPolicyDiagnostics;
  readonly islands: readonly {
    readonly componentOrder: number;
    readonly pixelCount: number;
    readonly bounds: V6AlphaIslandPixelBounds;
    readonly handling: "generated" | "localized-fallback" | "kept-not-generated" | "skipped-tiny-noise";
    readonly vertexCount?: number;
    readonly triangleCount?: number;
    readonly maxBoundaryVertices?: number;
    readonly maxInteriorVertices?: number;
    readonly budgetWeight?: number;
  }[];
} => {
  const outputByComponentOrder = new Map(
    input.outputs.map((output) => [output.island.componentOrder, output])
  );
  const budgetByComponentOrder = new Map(
    input.budgets.map((budget) => [budget.componentOrder, budget])
  );
  const keptComponentOrders = new Set(
    input.filteredIslands.keptIslands.map((island) => island.componentOrder)
  );
  const skippedComponentOrders = new Set(
    input.filteredIslands.skippedTinyNoiseIslands.map((island) => island.componentOrder)
  );

  return {
    rawAlphaComponentCount: input.rawAlphaIslands.islands.length,
    keptIslandCount: input.filteredIslands.keptIslands.length,
    generatedIslandCount: input.outputs.length,
    backendGeneratedIslandCount: input.outputs.filter((output) => output.status === "generated").length,
    skippedTinyNoiseIslandCount: input.filteredIslands.skippedTinyNoiseIslands.length,
    skippedTinyNoisePixelCount: input.filteredIslands.skippedTinyNoisePixelCount,
    rawOpaquePixelCount: input.rawAlphaIslands.opaquePixelCount,
    largestComponentPixelCount: input.filteredIslands.largestComponentPixelCount,
    localizedFallbackCount: input.localizedFallbackReasons.length,
    localizedFallbackReasons: input.localizedFallbackReasons.map((fallback) => ({ ...fallback })),
    noiseFilterConstants: V6_ALPHA_ISLAND_NOISE_FILTER_CONSTANTS,
    budgetPolicy: input.budgetPolicy ?? createZeroBudgetPolicyDiagnostics(input.budgets),
    islands: input.rawAlphaIslands.islands.map((island) => {
      const output = outputByComponentOrder.get(island.componentOrder);
      const budget = budgetByComponentOrder.get(island.componentOrder) ?? output?.budget;
      const handling =
        output?.status === "generated"
          ? "generated"
          : output?.status === "fallback"
            ? "localized-fallback"
            : skippedComponentOrders.has(island.componentOrder)
              ? "skipped-tiny-noise"
              : keptComponentOrders.has(island.componentOrder)
                ? "kept-not-generated"
                : "skipped-tiny-noise";
      return {
        componentOrder: island.componentOrder,
        pixelCount: island.pixelCount,
        bounds: { ...island.bounds },
        handling,
        ...(output === undefined
          ? {}
          : {
              vertexCount: output.mesh.vertices.length,
              triangleCount: output.mesh.triangles.length
            }),
        ...(budget === undefined
          ? {}
          : {
              maxBoundaryVertices: budget.maxBoundaryVertices,
              maxInteriorVertices: budget.maxInteriorVertices,
              budgetWeight: budget.budgetWeight
            })
      };
    })
  };
};

const createBudgetPolicyDiagnostics = (input: {
  readonly globalDensity: V6DAdaptiveDensityResolution;
  readonly budgets: readonly V6AlphaIslandBudgetAllocation[];
}): V6MultiIslandBudgetPolicyDiagnostics => {
  const allocatedMaxBoundaryVertices = input.budgets.reduce(
    (sum, budget) => sum + budget.maxBoundaryVertices,
    0
  );
  const allocatedMaxInteriorVertices = input.budgets.reduce(
    (sum, budget) => sum + budget.maxInteriorVertices,
    0
  );
  const globalMaxBoundaryVertices = input.globalDensity.parameters.maxBoundaryVertices;
  const globalMaxInteriorVertices = input.globalDensity.parameters.maxInteriorVertices;

  return {
    globalMaxBoundaryVertices,
    globalMaxInteriorVertices,
    allocatedMaxBoundaryVertices,
    allocatedMaxInteriorVertices,
    minimumBoundaryFloorExceededGlobalCap: allocatedMaxBoundaryVertices > globalMaxBoundaryVertices,
    minimumInteriorFloorExceededGlobalCap: allocatedMaxInteriorVertices > globalMaxInteriorVertices
  };
};

const createZeroBudgetPolicyDiagnostics = (
  budgets: readonly V6AlphaIslandBudgetAllocation[]
): V6MultiIslandBudgetPolicyDiagnostics => ({
  globalMaxBoundaryVertices: 0,
  globalMaxInteriorVertices: 0,
  allocatedMaxBoundaryVertices: budgets.reduce((sum, budget) => sum + budget.maxBoundaryVertices, 0),
  allocatedMaxInteriorVertices: budgets.reduce((sum, budget) => sum + budget.maxInteriorVertices, 0),
  minimumBoundaryFloorExceededGlobalCap: false,
  minimumInteriorFloorExceededGlobalCap: false
});

const createMergedMultiIslandProvenance = (input: {
  readonly skippedTinyNoiseIslandCount: number;
  readonly localizedFallbackCount: number;
}): readonly string[] => [
  "v6-contour-raw-alpha-component-detection",
  "v6-contour-alpha-island-noise-filter",
  ...(input.skippedTinyNoiseIslandCount > 0
    ? ["v6d-adaptive-contour-multi-island-noise-filtered"]
    : []),
  "v6d-adaptive-contour-multi-island-global-budget-allocated",
  "v6d-adaptive-contour-multi-island-isolated-generation",
  "v6d-adaptive-density-resolved",
  "v6d-adaptive-contour-constrainautor-delaunator-all-points",
  "v6d-adaptive-contour-constrainautor-constraint-recovery",
  "v6d-adaptive-contour-constrainautor-boundary-constraints-verified",
  "v6d-adaptive-contour-constrainautor-outside-triangle-filter",
  "v6d-adaptive-contour-multi-island-merged-disconnected-mesh",
  ...(input.localizedFallbackCount > 0
    ? ["v6d-adaptive-contour-multi-island-localized-fallback"]
    : [])
];

const createAllIslandFallbackProvenance = (input: {
  readonly skippedTinyNoiseIslandCount: number;
  readonly reason: MeshGenerationFallbackReason;
}): readonly string[] => [
  "v6-contour-raw-alpha-component-detection",
  "v6-contour-alpha-island-noise-filter",
  ...(input.skippedTinyNoiseIslandCount > 0
    ? ["v6d-adaptive-contour-multi-island-noise-filtered"]
    : []),
  "v6d-adaptive-contour-multi-island-global-budget-allocated",
  "v6d-adaptive-contour-multi-island-isolated-generation",
  "v6d-adaptive-contour-multi-island-all-islands-fallback",
  "v6d-adaptive-contour-multi-island-whole-drawable-fallback",
  `fallback-${input.reason}`
];

const sumMetric = (
  metrics: readonly V6Metrics[],
  key:
    | "contourLoopCount"
    | "holeLikeRegionCount"
    | "removedTriangleCount"
    | "outsideOrCrossingTriangleCount"
): number => metrics.reduce((sum, metric) => sum + metric[key], 0);

const createIslandScopedStableId = (
  stableId: string,
  componentOrder: number,
  shouldScopeStableIds: boolean
): string => shouldScopeStableIds ? `${stableId}_island_${componentOrder}` : stableId;

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
