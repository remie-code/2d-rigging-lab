import type { MeshDto } from "@private-2d-rigging-lab/package-format";

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
    | "interim-delaunay-envelope-filter";
  readonly envelopeMetrics?: MeshGenerationEnvelopeMetrics;
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

export const computeMeshQualityMetrics = (
  mesh: MeshDto,
  options: {
    readonly refinementIterationCount: number;
    readonly fallbackReason?: string;
    readonly triangulationMode?: MeshGenerationQualityMetrics["triangulationMode"];
    readonly envelopeMetrics?: MeshGenerationEnvelopeMetrics;
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
    ...(options.envelopeMetrics === undefined ? {} : { envelopeMetrics: options.envelopeMetrics })
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
