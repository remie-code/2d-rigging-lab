import type { DrawableId, MeshId, ProvenanceId, RectDto, TriangleId } from "@private-2d-rigging-lab/contracts";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";

import type { MeshDensityHint } from "./mesh-generation.js";
import {
  createAutoOutlineV25SoftBoundaryMesh,
  type AutoOutlineV25SoftBoundaryFailureReason
} from "./mesh-outline-v2-5-soft-boundary-generation.js";
import {
  computeMeshQualityMetrics,
  type MeshGenerationQualityMetrics,
  type MeshGenerationSoftApronMetrics
} from "./mesh-quality-metrics.js";

export interface AutoOutlineV26SoftApronMeshInput {
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

export type AutoOutlineV26SoftApronFailureReason =
  | AutoOutlineV25SoftBoundaryFailureReason
  | "soft-apron-generation-failed"
  | "soft-apron-boundary-unavailable"
  | "soft-apron-area-too-large"
  | "soft-apron-filter-rejected-all";

export type AutoOutlineV26SoftApronMeshResult =
  | {
      readonly status: "generated";
      readonly mesh: MeshDto;
      readonly alphaBounds: RectDto;
      readonly contourLoopCount: number;
      readonly softApronMetrics: MeshGenerationSoftApronMetrics;
      readonly qualityMetrics: MeshGenerationQualityMetrics;
    }
  | {
      readonly status: "failed";
      readonly reason: AutoOutlineV26SoftApronFailureReason;
      readonly alphaBounds?: RectDto;
      readonly contourLoopCount?: number;
      readonly fallbackMetrics?: MeshGenerationSoftApronMetrics;
    };

interface BoundaryVertex {
  readonly index: number;
  readonly order: number;
  readonly vertex: Vec2;
}

interface V26Config {
  readonly preset: MeshDensityHint;
  readonly apronPaddingRatio: number;
  readonly apronPadding: number;
  readonly apronRingCount: 1 | 2;
  readonly maxApronAreaRatio: number;
  readonly maxApronEdgeLength: number;
  readonly skinnyAngleDegrees: number;
}

interface ApronRings {
  readonly padding: number;
  readonly apronBoundaryArea: number;
  readonly apronBoundaryAreaRatio: number;
  readonly rings: readonly (readonly Vec2[])[];
}

interface ApronMeshBuild {
  readonly mesh: MeshDto;
  readonly apronVertexCount: number;
  readonly apronTriangleCount: number;
  readonly maxBoundaryToApronEdgeLength: number;
  readonly maxApronEdgeLength: number;
  readonly maxApronFanTriangleCount: number;
  readonly skinnyApronTriangleCount: number;
  readonly longApronEdgeCount: number;
  readonly rejectedDegenerateApronTriangleCount: number;
  readonly rejectedLongApronTriangleCount: number;
  readonly rejectedSkinnyApronTriangleCount: number;
}

type Vec2 = MeshDto["vertices"][number];

export const createAutoOutlineV26SoftApronMesh = (
  input: AutoOutlineV26SoftApronMeshInput
): AutoOutlineV26SoftApronMeshResult => {
  const base = createAutoOutlineV25SoftBoundaryMesh(input);
  if (base.status !== "generated") {
    return {
      status: "failed",
      reason: base.reason,
      ...(base.alphaBounds === undefined ? {} : { alphaBounds: base.alphaBounds }),
      ...(base.contourLoopCount === undefined ? {} : { contourLoopCount: base.contourLoopCount })
    };
  }

  const boundary = getOrderedV25BoundaryVertices(base.mesh);
  if (boundary.length < 3) {
    return {
      status: "failed",
      reason: "soft-apron-boundary-unavailable",
      alphaBounds: base.alphaBounds,
      contourLoopCount: base.contourLoopCount
    };
  }

  const config = createV26Config({
    alphaBounds: base.alphaBounds,
    densityHint: input.densityHint ?? "low",
    boundary
  });
  const apronRings = createApronRings({
    boundary,
    config,
    alphaArea: base.softBoundaryMetrics.alphaArea
  });
  if (apronRings === undefined) {
    return {
      status: "failed",
      reason: "soft-apron-area-too-large",
      alphaBounds: base.alphaBounds,
      contourLoopCount: base.contourLoopCount
    };
  }

  const built = createSoftApronMesh({
    input,
    baseMesh: base.mesh,
    boundary,
    rings: apronRings.rings,
    config
  });
  if (built.apronTriangleCount === 0) {
    return {
      status: "failed",
      reason: "soft-apron-filter-rejected-all",
      alphaBounds: base.alphaBounds,
      contourLoopCount: base.contourLoopCount
    };
  }

  const softApronMetrics: MeshGenerationSoftApronMetrics = {
    algorithmId: "auto-outline-v2.6-soft-apron",
    baseAlgorithmId: "auto-outline-v2.5-soft-boundary",
    preset: config.preset,
    apronPadding: roundMetric(apronRings.padding),
    apronPaddingRatio: roundMetric(apronRings.padding / Math.max(Math.min(base.alphaBounds.width, base.alphaBounds.height), 1)),
    alphaArea: base.softBoundaryMetrics.alphaArea,
    baseSoftBoundaryAreaRatio: base.softBoundaryMetrics.softBoundaryAreaRatio,
    apronBoundaryArea: roundMetric(apronRings.apronBoundaryArea),
    apronBoundaryAreaRatio: roundMetric(apronRings.apronBoundaryAreaRatio),
    apronRingCount: config.apronRingCount,
    innerBoundaryVertexCount: boundary.length,
    apronVertexCount: built.apronVertexCount,
    apronTriangleCount: built.apronTriangleCount,
    baseInteriorPointCount: base.softBoundaryMetrics.interiorPointCount,
    baseTriangleCount: base.mesh.triangles.length,
    triangleCountIncreaseRatio: roundMetric(built.mesh.triangles.length / Math.max(base.mesh.triangles.length, 1)),
    maxBoundaryToApronEdgeLength: roundMetric(built.maxBoundaryToApronEdgeLength),
    maxApronEdgeLength: roundMetric(built.maxApronEdgeLength),
    maxApronFanTriangleCount: built.maxApronFanTriangleCount,
    skinnyApronTriangleCount: built.skinnyApronTriangleCount,
    longApronEdgeCount: built.longApronEdgeCount,
    rejectedDegenerateApronTriangleCount: built.rejectedDegenerateApronTriangleCount,
    rejectedLongApronTriangleCount: built.rejectedLongApronTriangleCount,
    rejectedSkinnyApronTriangleCount: built.rejectedSkinnyApronTriangleCount,
    provenance: [
      "v2-5-soft-boundary-base-mesh",
      "ratio-based-soft-apron-padding",
      "ordered-boundary-apron-ring-sampling",
      "frontier-growth-apron-triangulation",
      "apron-long-edge-skinny-filter",
      "apron-fan-metrics",
      "v2-5-sparse-interior-preserved",
      "local-gap-refill-deferred"
    ]
  };
  const qualityMetrics = computeMeshQualityMetrics(built.mesh, {
    refinementIterationCount: 0,
    triangulationMode: "interim-delaunay-soft-apron-strip",
    softApronMetrics
  });

  return {
    status: "generated",
    mesh: built.mesh,
    alphaBounds: base.alphaBounds,
    contourLoopCount: base.contourLoopCount,
    softApronMetrics,
    qualityMetrics
  };
};

const getOrderedV25BoundaryVertices = (mesh: MeshDto): readonly BoundaryVertex[] => {
  const boundary: BoundaryVertex[] = [];
  mesh.vertexStableIds.forEach((stableId, index) => {
    const match = stableId.match(/_outline_v2_5_soft_boundary_boundary_(\d+)$/);
    const vertex = mesh.vertices[index];
    if (match === null || vertex === undefined) {
      return;
    }

    boundary.push({
      index,
      order: Number(match[1]),
      vertex
    });
  });

  return boundary.sort((left, right) => left.order - right.order || left.index - right.index);
};

const createV26Config = (input: {
  readonly alphaBounds: RectDto;
  readonly densityHint: MeshDensityHint;
  readonly boundary: readonly BoundaryVertex[];
}): V26Config => {
  const baseSize = Math.max(Math.min(input.alphaBounds.width, input.alphaBounds.height), 1);
  const representativeBoundaryEdgeLength = median(loopEdgeLengths(input.boundary.map((item) => item.vertex)));

  switch (input.densityHint) {
    case "high": {
      const ratio = 0.036 * 2;
      const padding = clamp(baseSize * ratio, 1.05 * 2, Math.max(1.05 * 2, baseSize * 0.095 * 2));
      return {
        preset: "high",
        apronPaddingRatio: ratio,
        apronPadding: padding,
        apronRingCount: 1,
        maxApronAreaRatio: 1.7,
        maxApronEdgeLength: Math.max(representativeBoundaryEdgeLength * 1.7, padding * 6),
        skinnyAngleDegrees: 1
      };
    }
    case "medium": {
      const ratio = 0.026 * 2;
      const padding = clamp(baseSize * ratio, 0.85 * 2, Math.max(0.85 * 2, baseSize * 0.08 * 2));
      return {
        preset: "medium",
        apronPaddingRatio: ratio,
        apronPadding: padding,
        apronRingCount: 1,
        maxApronAreaRatio: 1.58,
        maxApronEdgeLength: Math.max(representativeBoundaryEdgeLength * 1.75, padding * 6),
        skinnyAngleDegrees: 1
      };
    }
    case "low":
    default: {
      const ratio = 0.018 * 2;
      const padding = clamp(baseSize * ratio, 0.6 * 2, Math.max(0.6 * 2, baseSize * 0.065 * 2));
      return {
        preset: "low",
        apronPaddingRatio: ratio,
        apronPadding: padding,
        apronRingCount: 1,
        maxApronAreaRatio: 1.48,
        maxApronEdgeLength: Math.max(representativeBoundaryEdgeLength * 1.8, padding * 6),
        skinnyAngleDegrees: 1
      };
    }
  }
};

const createApronRings = (input: {
  readonly boundary: readonly BoundaryVertex[];
  readonly config: V26Config;
  readonly alphaArea: number;
}): ApronRings | undefined => {
  const boundaryPoints = input.boundary.map((item) => item.vertex);
  const centroid = polygonCentroid(boundaryPoints);
  const attempts = [1, 0.72, 0.48, 0.25] as const;

  for (const paddingFactor of attempts) {
    const padding = input.config.apronPadding * paddingFactor;
    const ring = boundaryPoints.map((point, pointIndex) => {
      const next = boundaryPoints[(pointIndex + 1) % boundaryPoints.length]!;
      return createFrontierApex({
        start: point,
        end: next,
        centroid,
        maxGrowthDistance: padding
      });
    });
    if (ring.length < 3) {
      continue;
    }

    const apronBoundaryArea = Math.abs(polygonArea(ring));
    const apronBoundaryAreaRatio = apronBoundaryArea / Math.max(input.alphaArea, 1);
    if (apronBoundaryAreaRatio > input.config.maxApronAreaRatio) {
      continue;
    }

    return {
      padding,
      apronBoundaryArea,
      apronBoundaryAreaRatio,
      rings: [ring]
    };
  }

  return undefined;
};

const createFrontierApex = (input: {
  readonly start: Vec2;
  readonly end: Vec2;
  readonly centroid: Vec2;
  readonly maxGrowthDistance: number;
}): Vec2 => {
  const edgeX = input.end.x - input.start.x;
  const edgeY = input.end.y - input.start.y;
  const edgeLength = Math.hypot(edgeX, edgeY);
  const center = {
    x: (input.start.x + input.end.x) / 2,
    y: (input.start.y + input.end.y) / 2
  };
  if (edgeLength <= 0.000001) {
    return center;
  }

  const normalA = {
    x: edgeY / edgeLength,
    y: -edgeX / edgeLength
  };
  const awayFromCentroid = {
    x: center.x - input.centroid.x,
    y: center.y - input.centroid.y
  };
  const outward =
    normalA.x * awayFromCentroid.x + normalA.y * awayFromCentroid.y >= 0
      ? normalA
      : {
          x: -normalA.x,
          y: -normalA.y
        };
  const equilateralHeight = edgeLength * 0.8660254037844386;
  const growthDistance = Math.min(equilateralHeight, input.maxGrowthDistance);

  return {
    x: roundCoordinate(center.x + outward.x * growthDistance),
    y: roundCoordinate(center.y + outward.y * growthDistance)
  };
};

const createSoftApronMesh = (input: {
  readonly input: AutoOutlineV26SoftApronMeshInput;
  readonly baseMesh: MeshDto;
  readonly boundary: readonly BoundaryVertex[];
  readonly rings: readonly (readonly Vec2[])[];
  readonly config: V26Config;
}): ApronMeshBuild => {
  const token = stripIdPrefix(input.input.drawableId, "draw_");
  const vertices = input.baseMesh.vertices.map((vertex) => ({ ...vertex }));
  const uvs = input.baseMesh.uvs.map((uv) => ({ ...uv }));
  const vertexStableIds = createV26BaseVertexStableIds(input.baseMesh, input.boundary, token);
  const triangles: MeshDto["triangles"] = input.baseMesh.triangles.map((triangle) => [
    triangle[0],
    triangle[1],
    triangle[2]
  ]);
  const triangleStableIds: TriangleId[] = input.baseMesh.triangles.map(
    (_triangle, triangleIndex) => `tri_${token}_outline_v2_6_soft_apron_base_${triangleIndex}` as TriangleId
  );
  const ringIndices = input.rings.map((ring, ringIndex) =>
    ring.map((point, pointIndex) => {
      const vertexIndex = vertices.length;
      vertices.push({ ...point });
      uvs.push(stagePointToUv(point, input.input.bounds));
      vertexStableIds.push(`vtx_${token}_outline_v2_6_soft_apron_ring_${ringIndex}_${pointIndex}`);
      return vertexIndex;
    })
  );

  let apronTriangleCount = 0;
  let maxBoundaryToApronEdgeLength = 0;
  let maxApronEdgeLength = 0;
  let skinnyApronTriangleCount = 0;
  let longApronEdgeCount = 0;
  let rejectedDegenerateApronTriangleCount = 0;
  let rejectedLongApronTriangleCount = 0;
  let rejectedSkinnyApronTriangleCount = 0;
  const fanCounts = new Map<number, number>();

  const addFan = (vertexIndex: number) => {
    fanCounts.set(vertexIndex, (fanCounts.get(vertexIndex) ?? 0) + 1);
  };
  const addTriangle = (
    triangle: [number, number, number],
    stableId: TriangleId,
    boundaryToApronEdges: readonly (readonly [number, number])[]
  ) => {
    const classification = classifyApronTriangle(vertices, triangle, input.config);
    if (classification === "degenerate") {
      rejectedDegenerateApronTriangleCount += 1;
      return;
    }
    if (classification === "long") {
      rejectedLongApronTriangleCount += 1;
      return;
    }
    if (classification === "skinny") {
      rejectedSkinnyApronTriangleCount += 1;
      return;
    }

    triangles.push(triangle);
    triangleStableIds.push(stableId);
    apronTriangleCount += 1;
    maxApronEdgeLength = Math.max(maxApronEdgeLength, maxTriangleEdgeLength(vertices, triangle));
    longApronEdgeCount += classification === "accepted-long" ? 1 : 0;
    skinnyApronTriangleCount += classification === "accepted-skinny" ? 1 : 0;
    for (const [left, right] of boundaryToApronEdges) {
      maxBoundaryToApronEdgeLength = Math.max(maxBoundaryToApronEdgeLength, distance(vertices[left]!, vertices[right]!));
    }
    triangle.forEach(addFan);
  };

  for (let ringIndex = 0; ringIndex < ringIndices.length; ringIndex += 1) {
    const inner = ringIndex === 0 ? input.boundary.map((item) => item.index) : ringIndices[ringIndex - 1]!;
    const outer = ringIndices[ringIndex]!;
    const segmentCount = Math.min(inner.length, outer.length);
    for (let pointIndex = 0; pointIndex < segmentCount; pointIndex += 1) {
      const nextIndex = (pointIndex + 1) % segmentCount;
      const innerA = inner[pointIndex]!;
      const innerB = inner[nextIndex]!;
      const outerA = outer[pointIndex]!;
      addTriangle(
        [innerA, innerB, outerA],
        `tri_${token}_outline_v2_6_soft_apron_ring_${ringIndex}_${pointIndex}` as TriangleId,
        [
          [innerA, outerA],
          [innerB, outerA]
        ]
      );
    }
  }

  const maxApronFanTriangleCount =
    fanCounts.size === 0 ? 0 : Math.max(...[...fanCounts.values()]);

  return {
    mesh: {
      ...input.baseMesh,
      vertices,
      uvs,
      triangles,
      vertexStableIds,
      triangleStableIds,
      generationProvenanceId: input.input.provenanceId
    },
    apronVertexCount: ringIndices.reduce((count, ring) => count + ring.length, 0),
    apronTriangleCount,
    maxBoundaryToApronEdgeLength,
    maxApronEdgeLength,
    maxApronFanTriangleCount,
    skinnyApronTriangleCount,
    longApronEdgeCount,
    rejectedDegenerateApronTriangleCount,
    rejectedLongApronTriangleCount,
    rejectedSkinnyApronTriangleCount
  };
};

const createV26BaseVertexStableIds = (
  mesh: MeshDto,
  boundary: readonly BoundaryVertex[],
  token: string
): string[] => {
  const boundaryOrderByIndex = new Map(boundary.map((item) => [item.index, item.order]));
  let interiorIndex = 0;
  return mesh.vertexStableIds.map((_stableId, index) => {
    const boundaryOrder = boundaryOrderByIndex.get(index);
    if (boundaryOrder !== undefined) {
      return `vtx_${token}_outline_v2_6_soft_apron_inner_boundary_${boundaryOrder}`;
    }

    const result = `vtx_${token}_outline_v2_6_soft_apron_interior_${interiorIndex}`;
    interiorIndex += 1;
    return result;
  });
};

const classifyApronTriangle = (
  vertices: readonly Vec2[],
  triangle: [number, number, number],
  config: V26Config
): "accepted" | "accepted-long" | "accepted-skinny" | "degenerate" | "long" | "skinny" => {
  const a = vertices[triangle[0]];
  const b = vertices[triangle[1]];
  const c = vertices[triangle[2]];
  if (a === undefined || b === undefined || c === undefined) {
    return "degenerate";
  }

  const area = Math.abs(cross(a, b, c)) / 2;
  if (area <= 0.000001) {
    return "degenerate";
  }

  const ab = distance(a, b);
  const bc = distance(b, c);
  const ca = distance(c, a);
  const maxEdge = Math.max(ab, bc, ca);
  const minAngle = Math.min(
    angleDegrees(ab, ca, bc),
    angleDegrees(ab, bc, ca),
    angleDegrees(bc, ca, ab)
  );

  if (maxEdge > config.maxApronEdgeLength * 1.35) {
    return "long";
  }
  if (minAngle < config.skinnyAngleDegrees * 0.5) {
    return "skinny";
  }
  if (maxEdge > config.maxApronEdgeLength) {
    return "accepted-long";
  }
  if (minAngle < config.skinnyAngleDegrees) {
    return "accepted-skinny";
  }

  return "accepted";
};

const stagePointToUv = (point: Vec2, bounds: RectDto): Vec2 => ({
  x: roundCoordinate(clamp((point.x - bounds.x) / Math.max(bounds.width, 1), 0, 1)),
  y: roundCoordinate(clamp((point.y - bounds.y) / Math.max(bounds.height, 1), 0, 1))
});

const loopEdgeLengths = (points: readonly Vec2[]): readonly number[] => {
  const lengths: number[] = [];
  for (let index = 0; index < points.length; index += 1) {
    lengths.push(distance(points[index]!, points[(index + 1) % points.length]!));
  }

  return lengths;
};

const median = (values: readonly number[]): number => {
  if (values.length === 0) {
    return 1;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : sorted[middle] ?? 1;
};

const polygonArea = (points: readonly Vec2[]): number => {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += point.x * next.y - next.x * point.y;
  }

  return area / 2;
};

const polygonCentroid = (points: readonly Vec2[]): Vec2 => {
  const area = polygonArea(points);
  if (Math.abs(area) <= 0.000001) {
    const bounds = pointSetBounds(points);
    return {
      x: (bounds.left + bounds.right) / 2,
      y: (bounds.top + bounds.bottom) / 2
    };
  }

  let x = 0;
  let y = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    const next = points[(index + 1) % points.length]!;
    const pointCross = point.x * next.y - next.x * point.y;
    x += (point.x + next.x) * pointCross;
    y += (point.y + next.y) * pointCross;
  }

  return {
    x: x / (6 * area),
    y: y / (6 * area)
  };
};

const pointSetBounds = (points: readonly Vec2[]): {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
} => {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    left = Math.min(left, point.x);
    top = Math.min(top, point.y);
    right = Math.max(right, point.x);
    bottom = Math.max(bottom, point.y);
  }

  return { left, top, right, bottom };
};

const maxTriangleEdgeLength = (
  vertices: readonly Vec2[],
  triangle: [number, number, number]
): number => {
  const a = vertices[triangle[0]]!;
  const b = vertices[triangle[1]]!;
  const c = vertices[triangle[2]]!;
  return Math.max(distance(a, b), distance(b, c), distance(c, a));
};

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

const cross = (a: Vec2, b: Vec2, c: Vec2): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

const distance = (left: Vec2, right: Vec2): number =>
  Math.hypot(left.x - right.x, left.y - right.y);

const stripIdPrefix = (id: string, prefix: string): string =>
  id.startsWith(prefix) ? id.slice(prefix.length) : id;

const roundCoordinate = (value: number): number => {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const roundMetric = (value: number): number => roundCoordinate(value);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);
