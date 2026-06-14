import type { DrawableId, MeshId, ProvenanceId, RectDto, TriangleId } from "@private-2d-rigging-lab/contracts";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";
import * as poly2tri from "poly2tri";

import {
  getV6MeshGenerationCandidate,
  type MeshDensityHint
} from "./mesh-generation-contract.js";
import {
  computeMeshQualityMetrics,
  type MeshGenerationQualityMetrics,
  type MeshGenerationV6Metrics,
  type MeshGenerationV6Poly2TriDiagnostics
} from "./mesh-quality-metrics.js";

export interface AutoOutlineV6CPoly2TriMeshInput {
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

export type AutoOutlineV6CPoly2TriFailureReason =
  | "alpha-empty"
  | "v6c-poly2tri-generation-failed"
  | "v6c-poly2tri-polygon-invalid"
  | "v6c-poly2tri-hole-unsupported"
  | "v6c-poly2tri-multi-island-unsupported"
  | "v6c-poly2tri-triangulation-threw"
  | "v6c-poly2tri-boundary-missing";

export type AutoOutlineV6CPoly2TriMeshResult =
  | {
      readonly status: "generated";
      readonly mesh: MeshDto;
      readonly alphaBounds: RectDto;
      readonly qualityMetrics: MeshGenerationQualityMetrics;
    }
  | {
      readonly status: "blocked";
      readonly reason: AutoOutlineV6CPoly2TriFailureReason;
      readonly alphaBounds?: RectDto;
      readonly opaquePixelCount?: number;
      readonly failureMetrics: AutoOutlineV6CPoly2TriFailureMetrics;
    };

export interface AutoOutlineV6CPoly2TriFailureMetrics {
  readonly contourLoopCount: number;
  readonly holeLikeRegionCount: number;
  readonly boundaryVertexCount: number;
  readonly interiorVertexCount: number;
  readonly removedTriangleCount: number;
  readonly outsideOrCrossingTriangleCount: number;
  readonly multiIslandHandling: MeshGenerationV6Metrics["multiIslandHandling"];
  readonly holeHandling: MeshGenerationV6Metrics["holeHandling"];
  readonly provenance: readonly string[];
  readonly diagnostics: MeshGenerationV6Poly2TriDiagnostics;
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

interface PolygonValidationResult {
  readonly ok: boolean;
  readonly failures: readonly string[];
}

interface Poly2TriTriangulationResult {
  readonly status: "generated" | "blocked";
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly removedTriangleCount: number;
  readonly outsideOrCrossingTriangleCount: number;
  readonly diagnostics: MeshGenerationV6Poly2TriDiagnostics;
}

interface IndexedPoly2TriPoint extends poly2tri.XY {
  x: number;
  y: number;
  vertexIndex: number;
}

export interface AutoOutlineV6CPoly2TriProbePoint {
  readonly x: number;
  readonly y: number;
}

export interface AutoOutlineV6CPoly2TriProbeTriangle {
  readonly getPoints: () => [poly2tri.XY, poly2tri.XY, poly2tri.XY];
}

export interface AutoOutlineV6CPoly2TriProbeSweepContext {
  addPoints(points: poly2tri.XY[]): unknown;
  triangulate(): unknown;
  getTriangles(): readonly AutoOutlineV6CPoly2TriProbeTriangle[];
}

export type AutoOutlineV6CPoly2TriProbeSweepContextFactory = (
  contourPoints: poly2tri.XY[]
) => AutoOutlineV6CPoly2TriProbeSweepContext;

export interface AutoOutlineV6CPoly2TriProbeResult {
  readonly outputKind: MeshGenerationV6Metrics["outputKind"];
  readonly reason?: AutoOutlineV6CPoly2TriFailureReason;
  readonly validationFailures: readonly string[];
  readonly triangleCount: number;
  readonly removedTriangleCount: number;
  readonly outsideOrCrossingTriangleCount: number;
  readonly diagnostics: MeshGenerationV6Poly2TriDiagnostics;
}

export interface AutoOutlineV6CPoly2TriSanitizationProbeResult {
  readonly originalPointCount: number;
  readonly sanitizedPointCount: number;
  readonly removedPointCount: number;
  readonly shortestSanitizedEdgeLength: number;
  readonly sanitizedPoints: readonly AutoOutlineV6CPoly2TriProbePoint[];
  readonly validationFailures: readonly string[];
  readonly diagnostics: MeshGenerationV6Poly2TriDiagnostics;
}

const DEFAULT_ALPHA_THRESHOLD = 8;
const SOFT_ALPHA_THRESHOLD = 0.18;
const TRIANGLE_AREA_EPSILON = 0.000001;

export const createAutoOutlineV6CPoly2TriMesh = (
  input: AutoOutlineV6CPoly2TriMeshInput
): AutoOutlineV6CPoly2TriMeshResult => {
  const width = Math.round(input.textureSize.width);
  const height = Math.round(input.textureSize.height);
  const density = input.densityHint ?? "medium";
  const emptyDiagnostics = createPoly2TriDiagnostics({});

  if (width <= 0 || height <= 0 || input.rgbaBytes.byteLength !== width * height * 4) {
    return createBlockedResult({
      reason: "v6c-poly2tri-generation-failed",
      diagnostics: emptyDiagnostics,
      provenance: ["v6c-poly2tri-invalid-texture-input"]
    });
  }

  const mask = createSoftAlphaMask(input.rgbaBytes, width, height, input.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD);
  if (mask.opaquePixelCount === 0) {
    return createBlockedResult({
      reason: "alpha-empty",
      opaquePixelCount: 0,
      diagnostics: emptyDiagnostics,
      provenance: ["v6c-poly2tri-soft-alpha-mask", "fallback-alpha-empty"]
    });
  }

  const components = findOpaqueComponents(mask.mask, width, height);
  const mainComponent = selectMainComponent(components);
  if (mainComponent === undefined) {
    return createBlockedResult({
      reason: "alpha-empty",
      opaquePixelCount: mask.opaquePixelCount,
      diagnostics: emptyDiagnostics,
      provenance: ["v6c-poly2tri-soft-alpha-mask", "fallback-alpha-empty"]
    });
  }

  const alphaBounds = pixelBoundsToStageRect(mainComponent.bounds, input.bounds, width, height);
  const mainMask = createComponentMask(mainComponent, width, height);
  const boundaryLoops = traceBoundaryLoops(mainMask, width, height);
  const outerLoop = selectOuterLoop(boundaryLoops);
  if (outerLoop === undefined || outerLoop.length < 3) {
    return createBlockedResult({
      reason: "v6c-poly2tri-polygon-invalid",
      alphaBounds,
      opaquePixelCount: mask.opaquePixelCount,
      contourLoopCount: boundaryLoops.length,
      diagnostics: createPoly2TriDiagnostics({ polygonValidationFailed: true }),
      provenance: ["v6c-poly2tri-main-island-boundary", "fallback-invalid-outer-polygon"]
    });
  }

  const densityParameters = getDensityParameters(density);
  const boundaryPoints = sanitizePolygonLoop(sampleBoundaryLoop(outerLoop, densityParameters));
  const holeLikeRegionCount = countHoleLikeRegions(mainMask, width, height, mainComponent.bounds);
  const interiorPoints = sampleInteriorPoints({
    mainMask,
    width,
    height,
    component: mainComponent,
    boundaryPoints,
    densityParameters
  });
  const baseDiagnostics = createPoly2TriDiagnostics({
    outerPointCount: boundaryPoints.length,
    holeCount: holeLikeRegionCount,
    steinerPointCount: interiorPoints.length
  });

  if (components.length > 1) {
    return createBlockedResult({
      reason: "v6c-poly2tri-multi-island-unsupported",
      alphaBounds,
      opaquePixelCount: mask.opaquePixelCount,
      contourLoopCount: boundaryLoops.length,
      holeLikeRegionCount,
      boundaryVertexCount: boundaryPoints.length,
      interiorVertexCount: interiorPoints.length,
      multiIslandHandling: "main-island-only",
      holeHandling: holeLikeRegionCount > 0 ? "unsupported-fallback" : "supported",
      diagnostics: {
        ...baseDiagnostics,
        mainIslandOnlyFallback: true
      },
      provenance: createV6CBlockedProvenance([
        "limitation-main-island-only",
        "fallback-multi-island-unsupported"
      ])
    });
  }

  if (holeLikeRegionCount > 0) {
    return createBlockedResult({
      reason: "v6c-poly2tri-hole-unsupported",
      alphaBounds,
      opaquePixelCount: mask.opaquePixelCount,
      contourLoopCount: boundaryLoops.length,
      holeLikeRegionCount,
      boundaryVertexCount: boundaryPoints.length,
      interiorVertexCount: interiorPoints.length,
      multiIslandHandling: "supported",
      holeHandling: "unsupported-fallback",
      diagnostics: {
        ...baseDiagnostics,
        holeValidationFailed: true
      },
      provenance: createV6CBlockedProvenance([
        "limitation-hole-regions-reported",
        "fallback-hole-unsupported"
      ])
    });
  }

  const polygonValidation = validateSimplePolygon(boundaryPoints);
  if (!polygonValidation.ok) {
    return createBlockedResult({
      reason: "v6c-poly2tri-polygon-invalid",
      alphaBounds,
      opaquePixelCount: mask.opaquePixelCount,
      contourLoopCount: boundaryLoops.length,
      boundaryVertexCount: boundaryPoints.length,
      interiorVertexCount: interiorPoints.length,
      diagnostics: {
        ...baseDiagnostics,
        polygonValidationFailed: true
      },
      provenance: createV6CBlockedProvenance([
        ...polygonValidation.failures.map((failure) => `polygon-validation-${failure}`),
        "fallback-invalid-outer-polygon"
      ])
    });
  }

  const triangulation = triangulateWithPoly2Tri({
    boundaryPoints,
    interiorPoints,
    mainMask,
    width,
    height,
    diagnostics: baseDiagnostics
  });

  if (triangulation.status === "blocked" || triangulation.triangles.length === 0) {
    const reason = triangulation.diagnostics.triangulationThrown
      ? "v6c-poly2tri-triangulation-threw"
      : triangulation.diagnostics.boundaryEdgeMissingCount > 0
        ? "v6c-poly2tri-boundary-missing"
        : "v6c-poly2tri-generation-failed";

    return createBlockedResult({
      reason,
      alphaBounds,
      opaquePixelCount: mask.opaquePixelCount,
      contourLoopCount: boundaryLoops.length,
      boundaryVertexCount: boundaryPoints.length,
      interiorVertexCount: interiorPoints.length,
      removedTriangleCount: triangulation.removedTriangleCount,
      outsideOrCrossingTriangleCount: triangulation.outsideOrCrossingTriangleCount,
      diagnostics: triangulation.diagnostics,
      provenance: createV6CBlockedProvenance([
        ...(triangulation.diagnostics.triangulationThrown ? ["poly2tri-triangulation-threw"] : []),
        ...(triangulation.diagnostics.boundaryEdgeMissingCount > 0 ? ["poly2tri-boundary-missing"] : []),
        "fallback-poly2tri-output-invalid"
      ])
    });
  }

  const allPoints = [...boundaryPoints, ...interiorPoints];
  const token = stripIdPrefix(input.drawableId, "draw_");
  const mesh: MeshDto = {
    meshId: input.meshId,
    drawableId: input.drawableId,
    vertices: allPoints.map((point) => pixelPointToStagePoint(point, input.bounds, width, height)),
    uvs: allPoints.map((point) => pixelPointToUv(point, width, height)),
    triangles: triangulation.triangles.map((triangle) => [...triangle] as [number, number, number]),
    vertexStableIds: allPoints.map((_point, index) =>
      index < boundaryPoints.length
        ? `vtx_${token}_v6c_boundary_${index}`
        : `vtx_${token}_v6c_steiner_${index - boundaryPoints.length}`
    ),
    triangleStableIds: triangulation.triangles.map(
      (_triangle, index) => `tri_${token}_v6c_${index}` as TriangleId
    ),
    topologyRevision: 0,
    bounds: structuredClone(input.bounds),
    generationProvenanceId: input.provenanceId
  };

  const candidate = getV6MeshGenerationCandidate("auto-outline-v6c-poly2tri");
  const qualityMetrics = computeMeshQualityMetrics(mesh, {
    refinementIterationCount: 0,
    triangulationMode: "v6c-poly2tri-constrained-polygon",
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
      boundaryVertexCount: boundaryPoints.length,
      interiorVertexCount: interiorPoints.length,
      alphaBoundsAvailable: true,
      opaquePixelCount: mask.opaquePixelCount,
      contourLoopCount: boundaryLoops.length,
      holeLikeRegionCount,
      removedTriangleCount: triangulation.removedTriangleCount,
      outsideOrCrossingTriangleCount: triangulation.outsideOrCrossingTriangleCount,
      multiIslandHandling: "supported",
      holeHandling: "supported",
      provenance: createV6CBackendOutputProvenance(),
      poly2triDiagnostics: triangulation.diagnostics
    }
  });

  return {
    status: "generated",
    mesh,
    alphaBounds,
    qualityMetrics
  };
};

export const probeAutoOutlineV6CPoly2TriFailureForTest = (input: {
  readonly boundaryPoints: readonly AutoOutlineV6CPoly2TriProbePoint[];
  readonly interiorPoints?: readonly AutoOutlineV6CPoly2TriProbePoint[];
  readonly mainMask?: readonly boolean[];
  readonly width?: number;
  readonly height?: number;
  readonly createSweepContext?: AutoOutlineV6CPoly2TriProbeSweepContextFactory;
}): AutoOutlineV6CPoly2TriProbeResult => {
  const boundaryPoints = input.boundaryPoints.map(copyProbePoint);
  const interiorPoints = (input.interiorPoints ?? []).map(copyProbePoint);
  const width = input.width ?? 16;
  const height = input.height ?? 16;
  const mainMask =
    input.mainMask ?? Array.from({ length: width * height }, () => true);
  const diagnostics = createPoly2TriDiagnostics({
    outerPointCount: boundaryPoints.length,
    steinerPointCount: interiorPoints.length
  });
  const validation = validateSimplePolygon(boundaryPoints);

  if (!validation.ok) {
    return {
      outputKind: "blocked",
      reason: "v6c-poly2tri-polygon-invalid",
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
        ? "v6c-poly2tri-triangulation-threw"
        : triangulation.diagnostics.boundaryEdgeMissingCount > 0
          ? "v6c-poly2tri-boundary-missing"
          : "v6c-poly2tri-generation-failed";

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

export const probeAutoOutlineV6CPoly2TriSanitizationForTest = (input: {
  readonly boundaryPoints: readonly AutoOutlineV6CPoly2TriProbePoint[];
}): AutoOutlineV6CPoly2TriSanitizationProbeResult => {
  const originalPoints = input.boundaryPoints.map(copyProbePoint);
  const sanitizedPoints = sanitizePolygonLoop(originalPoints);
  const validation = validateSimplePolygon(sanitizedPoints);

  return {
    originalPointCount: originalPoints.length,
    sanitizedPointCount: sanitizedPoints.length,
    removedPointCount: originalPoints.length - sanitizedPoints.length,
    shortestSanitizedEdgeLength: shortestClosedEdgeLength(sanitizedPoints),
    sanitizedPoints: sanitizedPoints.map(copyProbePoint),
    validationFailures: validation.failures,
    diagnostics: createPoly2TriDiagnostics({
      outerPointCount: sanitizedPoints.length,
      polygonValidationFailed: !validation.ok
    })
  };
};

const createBlockedResult = (input: {
  readonly reason: AutoOutlineV6CPoly2TriFailureReason;
  readonly alphaBounds?: RectDto;
  readonly opaquePixelCount?: number;
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
}): AutoOutlineV6CPoly2TriMeshResult => ({
  status: "blocked",
  reason: input.reason,
  ...(input.alphaBounds === undefined ? {} : { alphaBounds: input.alphaBounds }),
  ...(input.opaquePixelCount === undefined ? {} : { opaquePixelCount: input.opaquePixelCount }),
  failureMetrics: {
    contourLoopCount: input.contourLoopCount ?? 0,
    holeLikeRegionCount: input.holeLikeRegionCount ?? 0,
    boundaryVertexCount: input.boundaryVertexCount ?? 0,
    interiorVertexCount: input.interiorVertexCount ?? 0,
    removedTriangleCount: input.removedTriangleCount ?? 0,
    outsideOrCrossingTriangleCount: input.outsideOrCrossingTriangleCount ?? 0,
    multiIslandHandling: input.multiIslandHandling ?? "not-evaluated",
    holeHandling: input.holeHandling ?? "not-evaluated",
    provenance: input.provenance,
    diagnostics: input.diagnostics
  }
});

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

const copyProbePoint = (point: AutoOutlineV6CPoly2TriProbePoint): PixelPoint => ({
  x: point.x,
  y: point.y
});

const shortestClosedEdgeLength = (points: readonly PixelPoint[]): number => {
  if (points.length < 2) {
    return 0;
  }

  let shortest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length; index += 1) {
    shortest = Math.min(shortest, distance(mustGet(points, index), mustGet(points, (index + 1) % points.length)));
  }

  return shortest;
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
    return blurred >= SOFT_ALPHA_THRESHOLD || originalAlpha[index]! * 255 > alphaThreshold;
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
    if (normalizedLoop.length >= 3 && pointKey(normalizedLoop[0]!) === startKey) {
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

  return samples
    .sort((left, right) => left.distance - right.distance || comparePoint(left.point, right.point))
    .map((sample) => sample.point);
};

const sanitizePolygonLoop = (
  loop: readonly PixelPoint[]
): readonly PixelPoint[] => {
  let sanitized = dedupeOrderedPoints(loop);
  let previousLength = -1;
  let guard = 0;
  while (sanitized.length !== previousLength && guard < 8) {
    guard += 1;
    previousLength = sanitized.length;
    sanitized = dedupeOrderedPoints(removeCollinearPoints(removeShortEdges(sanitized, 1.25)));
  }

  if (sanitized.length <= 1 || polygonSignedArea(sanitized) >= 0) {
    return sanitized;
  }

  const [first, ...rest] = sanitized;
  return first === undefined ? [] : [first, ...rest.reverse()];
};

const removeShortEdges = (
  points: readonly PixelPoint[],
  minLength: number
): readonly PixelPoint[] => {
  if (points.length < 4) {
    return points;
  }

  const result: PixelPoint[] = [];
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
  points: readonly PixelPoint[]
): readonly PixelPoint[] => {
  const deduped = dedupeOrderedPoints(points);
  if (deduped.length < 4) {
    return deduped;
  }

  const result: PixelPoint[] = [];
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

const validateSimplePolygon = (
  points: readonly PixelPoint[]
): PolygonValidationResult => {
  const failures: string[] = [];
  if (points.length < 3) {
    failures.push("too-few-points");
  }

  if (Math.abs(polygonSignedArea(points)) <= TRIANGLE_AREA_EPSILON) {
    failures.push("zero-area");
  }

  for (let index = 0; index < points.length; index += 1) {
    const current = mustGet(points, index);
    const next = mustGet(points, (index + 1) % points.length);
    if (distance(current, next) <= TRIANGLE_AREA_EPSILON) {
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
    if (
      !isPointInsideMask(input.mainMask, input.width, input.height, rounded) ||
      !isPointInsidePolygon(rounded, input.boundaryPoints)
    ) {
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

  return points;
};

const triangulateWithPoly2Tri = (input: {
  readonly boundaryPoints: readonly PixelPoint[];
  readonly interiorPoints: readonly PixelPoint[];
  readonly mainMask: readonly boolean[];
  readonly width: number;
  readonly height: number;
  readonly diagnostics: MeshGenerationV6Poly2TriDiagnostics;
  readonly createSweepContext?: AutoOutlineV6CPoly2TriProbeSweepContextFactory;
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
      const points = triangle.getPoints();
      const indexes = points.map((point) => resolvePoly2TriPointIndex(point, pointIndexByKey));
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

    if (!isTriangleAcceptedByMask(allPoints, triangle, input.mainMask, input.width, input.height)) {
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

const createPoly2TriSweepContext: AutoOutlineV6CPoly2TriProbeSweepContextFactory = (
  contourPoints
): AutoOutlineV6CPoly2TriProbeSweepContext =>
  new poly2tri.SweepContext([...contourPoints], { cloneArrays: true });

const createIndexedPoly2TriPoint = (
  point: PixelPoint,
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
    const key = edgeKey(index, (index + 1) % boundaryPointCount);
    if (triangleEdges.has(key)) {
      preserved += 1;
      continue;
    }

    missing += 1;
  }

  return { preserved, missing };
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

const createV6CBackendOutputProvenance = (): readonly string[] => [
  "v6c-poly2tri-soft-alpha-mask",
  "v6c-poly2tri-main-island-boundary",
  "v6c-poly2tri-adaptive-boundary-sampling",
  "v6c-poly2tri-deterministic-steiner-sampling",
  "v6c-poly2tri-constrained-polygon-triangulation",
  "v6c-poly2tri-boundary-preserved"
];

const createV6CBlockedProvenance = (
  entries: readonly string[]
): readonly string[] => [
  "v6c-poly2tri-soft-alpha-mask",
  "v6c-poly2tri-main-island-boundary",
  ...entries
];

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

const hasSelfIntersection = (
  points: readonly PixelPoint[]
): boolean => {
  for (let leftIndex = 0; leftIndex < points.length; leftIndex += 1) {
    const leftStart = mustGet(points, leftIndex);
    const leftEnd = mustGet(points, (leftIndex + 1) % points.length);
    for (let rightIndex = leftIndex + 1; rightIndex < points.length; rightIndex += 1) {
      if (areAdjacentEdges(leftIndex, rightIndex, points.length)) {
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

const areAdjacentEdges = (
  leftIndex: number,
  rightIndex: number,
  pointCount: number
): boolean =>
  leftIndex === rightIndex ||
  (leftIndex + 1) % pointCount === rightIndex ||
  (rightIndex + 1) % pointCount === leftIndex;

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

  return abC * abD < 0 && cdA * cdB < 0;
};

const rangesOverlap = (
  leftA: number,
  leftB: number,
  rightA: number,
  rightB: number
): boolean =>
  Math.max(Math.min(leftA, leftB), Math.min(rightA, rightB)) <
  Math.min(Math.max(leftA, leftB), Math.max(rightA, rightB)) - TRIANGLE_AREA_EPSILON;

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

const isTriangleAcceptedByMask = (
  points: readonly PixelPoint[],
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

const isPointInsidePolygon = (
  point: PixelPoint,
  polygon: readonly PixelPoint[]
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

const normalizeTriangleOrientation = (
  triangle: readonly [number, number, number],
  points: readonly PixelPoint[]
): [number, number, number] =>
  triangleAreaByIndex(points, triangle) >= 0
    ? [...triangle]
    : [triangle[0], triangle[2], triangle[1]];

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

const roundPixelPoint = (point: PixelPoint): PixelPoint => ({
  x: roundCoordinate(point.x),
  y: roundCoordinate(point.y)
});

const roundCoordinate = (value: number): number => {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const pointKey = (point: PixelPoint): string =>
  `${roundCoordinate(point.x)}:${roundCoordinate(point.y)}`;

const edgeKey = (left: number, right: number): string =>
  left < right ? `${left}:${right}` : `${right}:${left}`;

const triangleKey = (triangle: readonly [number, number, number]): string =>
  [...triangle].sort((left, right) => left - right).join(":");

const compareTriangle = (
  left: readonly [number, number, number],
  right: readonly [number, number, number]
): number =>
  left[0] - right[0] || left[1] - right[1] || left[2] - right[2];

const comparePoint = (left: PixelPoint, right: PixelPoint): number =>
  left.y - right.y || left.x - right.x;

const selectLexicographicPoint = (
  points: readonly PixelPoint[]
): PixelPoint =>
  [...points].sort(comparePoint)[0] ?? { x: 0, y: 0 };

const stripIdPrefix = (id: string, prefix: string): string =>
  id.startsWith(prefix) ? id.slice(prefix.length) : id;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Math.trunc(value), min), max);

const mustGet = <T>(items: readonly T[], index: number): T => {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`v6c poly2tri mesh generation internal index out of range: ${index}`);
  }

  return item;
};
