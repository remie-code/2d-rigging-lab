import type { MeshDto } from "@private-2d-rigging-lab/package-format";

import type {
  DrawableGeneratedMeshSource,
  MeshDensityHint,
  MeshGenerationFallbackReason,
  MeshGenerationFallbackStep,
  V6MeshGenerationBackendId,
  V6MeshGenerationBackendImplementationStatus,
  V6MeshGenerationDependencyGateStatus,
  V6MeshGenerationMethod,
  V6MeshGenerationSourceId
} from "./mesh-generation-contract.js";

export interface MeshGenerationQualityMetrics {
  readonly maxEdgeLength: number;
  readonly maxTriangleArea: number;
  readonly minAngleDegrees: number;
  readonly maxVertexValence: number;
  readonly refinementIterationCount: number;
  readonly fallbackReason?: string;
  readonly triangulationMode?:
    | "ordinary-delaunay-alpha-filter"
    | "interim-delaunay-alpha-filter"
    | "interim-delaunay-envelope-filter"
    | "interim-delaunay-soft-boundary-filter"
    | "interim-delaunay-soft-apron-strip"
    | "interim-delaunay-contour-band-strip"
    | "v6a-local-earclip-steiner-approximation"
    | "v6b-delaunator-constrainautor"
    | "v6c-poly2tri-constrained-polygon"
    | "v6-backend-blocked-fallback";
  readonly envelopeMetrics?: MeshGenerationEnvelopeMetrics;
  readonly softBoundaryMetrics?: MeshGenerationSoftBoundaryMetrics;
  readonly softApronMetrics?: MeshGenerationSoftApronMetrics;
  readonly contourBandMetrics?: MeshGenerationContourBandMetrics;
  readonly v6Metrics?: MeshGenerationV6Metrics;
}

export interface MeshGenerationEnvelopeMetrics {
  readonly algorithmId: "auto-outline-v3-envelope";
  readonly preset: "low" | "medium" | "high";
  readonly padding: number;
  readonly alphaArea: number;
  readonly envelopeArea: number;
  readonly envelopeAreaRatio: number;
  readonly selectedContourVertexCount: number;
  readonly simplifiedContourVertexCount: number;
  readonly envelopeBoundaryVertexCount: number;
  readonly supportRingCount: number;
  readonly interiorPointCount: number;
  readonly transparentSampleCount: number;
  readonly outsideTriangleSampleCount: number;
  readonly cleanupMode:
    | "convex-hull-envelope"
    | "convex-hull-after-self-intersection"
    | "reduced-padding-convex-hull-envelope";
  readonly provenance: readonly string[];
  readonly fallbackReason?: string;
}

export interface MeshGenerationSoftBoundaryMetrics {
  readonly algorithmId: "auto-outline-v2.5-soft-boundary";
  readonly preset: "low" | "medium" | "high";
  readonly padding: number;
  readonly transparentAllowance: number;
  readonly alphaArea: number;
  readonly softBoundaryArea: number;
  readonly softBoundaryAreaRatio: number;
  readonly selectedContourVertexCount: number;
  readonly simplifiedContourVertexCount: number;
  readonly softBoundaryVertexCount: number;
  readonly interiorPointCount: number;
  readonly transparentSampleCount: number;
  readonly outsideTriangleSampleCount: number;
  readonly farTransparentSampleCount: number;
  readonly rejectedOutsideSoftBoundaryTriangleCount: number;
  readonly rejectedFarTransparentTriangleCount: number;
  readonly provenance: readonly string[];
  readonly fallbackReason?: string;
}

export interface MeshGenerationSoftApronMetrics {
  readonly algorithmId: "auto-outline-v2.6-soft-apron";
  readonly baseAlgorithmId: "auto-outline-v2.5-soft-boundary";
  readonly preset: "low" | "medium" | "high";
  readonly apronPadding: number;
  readonly apronPaddingRatio: number;
  readonly alphaArea: number;
  readonly baseSoftBoundaryAreaRatio: number;
  readonly apronBoundaryArea: number;
  readonly apronBoundaryAreaRatio: number;
  readonly apronRingCount: 1 | 2;
  readonly innerBoundaryVertexCount: number;
  readonly apronVertexCount: number;
  readonly apronTriangleCount: number;
  readonly baseInteriorPointCount: number;
  readonly baseTriangleCount: number;
  readonly triangleCountIncreaseRatio: number;
  readonly maxBoundaryToApronEdgeLength: number;
  readonly maxApronEdgeLength: number;
  readonly maxApronFanTriangleCount: number;
  readonly skinnyApronTriangleCount: number;
  readonly longApronEdgeCount: number;
  readonly rejectedDegenerateApronTriangleCount: number;
  readonly rejectedLongApronTriangleCount: number;
  readonly rejectedSkinnyApronTriangleCount: number;
  readonly provenance: readonly string[];
  readonly fallbackReason?: string;
}

export interface MeshGenerationContourBandMetrics {
  readonly algorithmId: "auto-outline-v4-contour-band";
  readonly preset: "low" | "medium" | "high";
  readonly targetEdgeLength: number;
  readonly contourSampleSpacing: number;
  readonly outerOffset: number;
  readonly innerOffset: number;
  readonly alphaArea: number;
  readonly outerContourArea: number;
  readonly outerContourAreaRatio: number;
  readonly selectedContourVertexCount: number;
  readonly simplifiedContourVertexCount: number;
  readonly contourPointCount: number;
  readonly outerContourPointCount: number;
  readonly contourBandTriangleCount: number;
  readonly interiorPointCount: number;
  readonly interiorTriangleCount: number;
  readonly maxBoundaryToInteriorEdgeLength: number;
  readonly maxVertexValence: number;
  readonly transparentOnlyTriangleRatio: number;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly maxVertexCountCap: number;
  readonly rejectedDegenerateTriangleCount: number;
  readonly rejectedLongBoundaryToInteriorTriangleCount: number;
  readonly rejectedLongInteriorTriangleCount: number;
  readonly rejectedOutsideInteriorTriangleCount: number;
  readonly provenance: readonly string[];
  readonly fallbackReason?: string;
}

export interface MeshGenerationV6Metrics {
  readonly algorithmId: "auto-outline-v6-alpha-constrained-delaunay";
  readonly methodId: V6MeshGenerationMethod;
  readonly backendId: V6MeshGenerationBackendId;
  readonly backendImplementationStatus: V6MeshGenerationBackendImplementationStatus;
  readonly requestedSourceId: V6MeshGenerationSourceId;
  readonly actualSourceId: DrawableGeneratedMeshSource;
  readonly outputKind: "backend-output" | "fallback-output" | "blocked";
  readonly preset: MeshDensityHint;
  readonly fallbackReason?: MeshGenerationFallbackReason;
  readonly fallbackSteps: readonly MeshGenerationFallbackStep[];
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly boundaryVertexCount: number;
  readonly interiorVertexCount: number;
  readonly alphaBoundsAvailable: boolean;
  readonly opaquePixelCount?: number;
  readonly contourLoopCount: number;
  readonly holeLikeRegionCount: number;
  readonly removedTriangleCount: number;
  readonly outsideOrCrossingTriangleCount: number;
  readonly multiIslandHandling: "not-evaluated" | "main-island-only" | "supported";
  readonly holeHandling: "not-evaluated" | "unsupported-fallback" | "supported";
  readonly provenance: readonly string[];
  readonly constrainautorDiagnostics?: MeshGenerationV6ConstrainautorDiagnostics;
  readonly poly2triDiagnostics?: MeshGenerationV6Poly2TriDiagnostics;
}

export interface MeshGenerationV6ConstrainautorDiagnostics {
  readonly dependencyGateStatus: V6MeshGenerationDependencyGateStatus;
  readonly constraintEdgeCount: number;
  readonly preservedConstraintEdgeCount: number;
  readonly missingConstraintEdgeCount: number;
  readonly constraintRecoveryFailed: boolean;
  readonly outsideTriangleCount: number;
  readonly thrownErrorKind?: string;
}

export interface MeshGenerationV6Poly2TriDiagnostics {
  readonly dependencyGateStatus: V6MeshGenerationDependencyGateStatus;
  readonly outerPointCount: number;
  readonly holeCount: number;
  readonly steinerPointCount: number;
  readonly polygonValidationFailed: boolean;
  readonly holeValidationFailed: boolean;
  readonly triangulationThrown: boolean;
  readonly boundaryEdgePreservedCount: number;
  readonly boundaryEdgeMissingCount: number;
  readonly mainIslandOnlyFallback: boolean;
}

export const computeMeshQualityMetrics = (
  mesh: MeshDto,
  options: {
    readonly refinementIterationCount: number;
    readonly fallbackReason?: string;
    readonly triangulationMode?: MeshGenerationQualityMetrics["triangulationMode"];
    readonly envelopeMetrics?: MeshGenerationEnvelopeMetrics;
    readonly softBoundaryMetrics?: MeshGenerationSoftBoundaryMetrics;
    readonly softApronMetrics?: MeshGenerationSoftApronMetrics;
    readonly contourBandMetrics?: MeshGenerationContourBandMetrics;
    readonly v6Metrics?: MeshGenerationV6Metrics;
  }
): MeshGenerationQualityMetrics => {
  const neighborsByVertex = new Map<number, Set<number>>();
  let maxEdgeLength = 0;
  let maxTriangleArea = 0;
  let minAngleDegrees = mesh.triangles.length === 0 ? 0 : Number.POSITIVE_INFINITY;

  const addNeighbor = (vertexIndex: number, neighborIndex: number) => {
    const neighbors = neighborsByVertex.get(vertexIndex);
    if (neighbors === undefined) {
      neighborsByVertex.set(vertexIndex, new Set([neighborIndex]));
      return;
    }

    neighbors.add(neighborIndex);
  };

  for (const triangle of mesh.triangles) {
    const [aIndex, bIndex, cIndex] = triangle;
    const a = mesh.vertices[aIndex];
    const b = mesh.vertices[bIndex];
    const c = mesh.vertices[cIndex];
    if (a === undefined || b === undefined || c === undefined) {
      continue;
    }

    addNeighbor(aIndex, bIndex);
    addNeighbor(aIndex, cIndex);
    addNeighbor(bIndex, aIndex);
    addNeighbor(bIndex, cIndex);
    addNeighbor(cIndex, aIndex);
    addNeighbor(cIndex, bIndex);

    const ab = distance(a, b);
    const bc = distance(b, c);
    const ca = distance(c, a);
    maxEdgeLength = Math.max(maxEdgeLength, ab, bc, ca);
    maxTriangleArea = Math.max(maxTriangleArea, triangleArea(a, b, c));
    minAngleDegrees = Math.min(
      minAngleDegrees,
      angleDegrees(ab, ca, bc),
      angleDegrees(ab, bc, ca),
      angleDegrees(bc, ca, ab)
    );
  }

  const maxVertexValence =
    neighborsByVertex.size === 0
      ? 0
      : Math.max(...[...neighborsByVertex.values()].map((neighbors) => neighbors.size));

  return {
    maxEdgeLength: roundMetric(maxEdgeLength),
    maxTriangleArea: roundMetric(maxTriangleArea),
    minAngleDegrees: roundMetric(
      Number.isFinite(minAngleDegrees) ? minAngleDegrees : 0
    ),
    maxVertexValence,
    refinementIterationCount: options.refinementIterationCount,
    ...(options.fallbackReason === undefined ? {} : { fallbackReason: options.fallbackReason }),
    ...(options.triangulationMode === undefined ? {} : { triangulationMode: options.triangulationMode }),
    ...(options.envelopeMetrics === undefined ? {} : { envelopeMetrics: options.envelopeMetrics }),
    ...(options.softBoundaryMetrics === undefined ? {} : { softBoundaryMetrics: options.softBoundaryMetrics }),
    ...(options.softApronMetrics === undefined ? {} : { softApronMetrics: options.softApronMetrics }),
    ...(options.contourBandMetrics === undefined ? {} : { contourBandMetrics: options.contourBandMetrics }),
    ...(options.v6Metrics === undefined ? {} : { v6Metrics: options.v6Metrics })
  };
};

type Vec2 = MeshDto["vertices"][number];

const distance = (left: Vec2, right: Vec2): number =>
  Math.hypot(left.x - right.x, left.y - right.y);

const triangleArea = (a: Vec2, b: Vec2, c: Vec2): number =>
  Math.abs(((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2);

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

const roundMetric = (value: number): number => {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);
