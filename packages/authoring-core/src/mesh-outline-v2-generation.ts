import type { DrawableId, MeshId, ProvenanceId, RectDto, TriangleId } from "@private-2d-rigging-lab/contracts";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";

import type { MeshDensityHint } from "./mesh-generation.js";
import type { AutoOutlineFailureReason } from "./mesh-outline-generation.js";
import {
  computeMeshQualityMetrics,
  type MeshGenerationQualityMetrics
} from "./mesh-quality-metrics.js";

export interface AutoOutlineV2MeshInput {
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

export type AutoOutlineV2MeshResult =
  | {
      readonly status: "generated";
      readonly mesh: MeshDto;
      readonly alphaBounds: RectDto;
      readonly contourLoopCount: number;
      readonly insetRingCount: number;
      readonly interiorPointCount: number;
      readonly qualityMetrics: MeshGenerationQualityMetrics;
    }
  | {
      readonly status: "failed";
      readonly reason: AutoOutlineFailureReason;
      readonly alphaBounds?: RectDto;
      readonly contourLoopCount?: number;
    };

interface PixelBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

interface PixelPoint {
  readonly x: number;
  readonly y: number;
}

interface OutlinePoint extends PixelPoint {
  readonly kind: "contour" | "inset" | "interior" | "refinement";
  readonly ringIndex?: number;
}

interface OutlineEdge {
  readonly start: PixelPoint;
  readonly end: PixelPoint;
  readonly direction: Direction;
}

type Direction = 0 | 1 | 2 | 3;

interface DelaunayTriangle {
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

interface V2Config {
  readonly minBoundarySpacing: number;
  readonly maxBoundarySpacing: number;
  readonly contourVertexCap: number;
  readonly insetRingCount: number;
  readonly insetSpacing: number;
  readonly interiorSpacing: number;
  readonly sampleMinDistance: number;
  readonly maxEdgeLength: number;
  readonly maxTriangleArea: number;
  readonly minAngleDegrees: number;
  readonly maxRefinementIterations: number;
  readonly maxRefinementPointsPerIteration: number;
  readonly refinementMinDistance: number;
}

interface RefinementResult {
  readonly points: readonly OutlinePoint[];
  readonly triangles: readonly DelaunayTriangle[];
  readonly iterationCount: number;
}

export const createAutoOutlineV2Mesh = (
  input: AutoOutlineV2MeshInput
): AutoOutlineV2MeshResult => {
  const width = Math.round(input.textureSize.width);
  const height = Math.round(input.textureSize.height);
  if (width <= 0 || height <= 0 || input.rgbaBytes.byteLength !== width * height * 4) {
    return { status: "failed", reason: "invalid-rgba" };
  }

  const alpha = createAlphaMask(input.rgbaBytes, width, height, input.alphaThreshold ?? 8);
  if (alpha.bounds === undefined) {
    return { status: "failed", reason: "alpha-empty" };
  }

  const alphaBounds = pixelBoundsToStageRect(alpha.bounds, input.bounds, width, height);
  const config = createV2Config(alpha.bounds, input.densityHint ?? "low");
  const contourLoops = extractContourLoops(alpha.mask, width, height, alpha.bounds)
    .map((loop) => resampleContourLoop(loop, config))
    .filter((loop): loop is readonly PixelPoint[] => loop.length >= 3)
    .sort(compareContourLoops);

  if (contourLoops.length === 0) {
    return {
      status: "failed",
      reason: "contour-extraction-failed",
      alphaBounds
    };
  }

  const contourPoints = contourLoops.flatMap((loop) =>
    loop.map((point): OutlinePoint => ({ ...point, kind: "contour" }))
  );
  const insetPoints = sampleInsetRingPoints({
    mask: alpha.mask,
    width,
    height,
    config,
    contourLoops,
    contourPoints
  });
  const interiorPoints = sampleJitteredInteriorPoints({
    mask: alpha.mask,
    width,
    height,
    bounds: alpha.bounds,
    config,
    seed: createSamplerSeed(input, width, height),
    blockedPoints: [...contourPoints, ...insetPoints]
  });
  const initialPoints = dedupeOutlinePoints([
    ...contourPoints,
    ...insetPoints,
    ...interiorPoints
  ]);
  if (initialPoints.length < 3) {
    return {
      status: "failed",
      reason: "triangulation-failed",
      alphaBounds,
      contourLoopCount: contourLoops.length
    };
  }

  const refinement = refineTriangulation({
    points: initialPoints,
    mask: alpha.mask,
    width,
    height,
    config
  });
  if (refinement.triangles.length === 0) {
    return {
      status: "failed",
      reason: "triangulation-failed",
      alphaBounds,
      contourLoopCount: contourLoops.length
    };
  }

  const mesh = createMeshDto({
    input,
    width,
    height,
    points: refinement.points,
    triangles: refinement.triangles
  });
  const qualityMetrics = computeMeshQualityMetrics(mesh, {
    refinementIterationCount: refinement.iterationCount,
    triangulationMode: "interim-delaunay-alpha-filter"
  });

  return {
    status: "generated",
    mesh,
    alphaBounds,
    contourLoopCount: contourLoops.length,
    insetRingCount: countGeneratedInsetRings(insetPoints),
    interiorPointCount: interiorPoints.length,
    qualityMetrics
  };
};

const createV2Config = (bounds: PixelBounds, densityHint: MeshDensityHint): V2Config => {
  const width = Math.max(bounds.right - bounds.left, 1);
  const height = Math.max(bounds.bottom - bounds.top, 1);
  const maxDimension = Math.max(width, height);

  switch (densityHint) {
    case "high": {
      const spacing = clamp(maxDimension / 7.5, 2.2, 5.2);
      return {
        minBoundarySpacing: spacing * 0.5,
        maxBoundarySpacing: spacing * 1.25,
        contourVertexCap: 220,
        insetRingCount: 2,
        insetSpacing: spacing * 0.85,
        interiorSpacing: spacing * 1.05,
        sampleMinDistance: spacing * 0.58,
        maxEdgeLength: spacing * 2.25,
        maxTriangleArea: spacing * spacing * 2.1,
        minAngleDegrees: 16,
        maxRefinementIterations: 3,
        maxRefinementPointsPerIteration: 28,
        refinementMinDistance: spacing * 0.42
      };
    }
    case "medium": {
      const spacing = clamp(maxDimension / 5.8, 2.8, 7);
      return {
        minBoundarySpacing: spacing * 0.55,
        maxBoundarySpacing: spacing * 1.45,
        contourVertexCap: 144,
        insetRingCount: 1,
        insetSpacing: spacing * 0.95,
        interiorSpacing: spacing * 1.15,
        sampleMinDistance: spacing * 0.6,
        maxEdgeLength: spacing * 2.45,
        maxTriangleArea: spacing * spacing * 2.35,
        minAngleDegrees: 14,
        maxRefinementIterations: 2,
        maxRefinementPointsPerIteration: 20,
        refinementMinDistance: spacing * 0.45
      };
    }
    case "low":
    default: {
      const spacing = clamp(maxDimension / 3.8, 4, 11);
      return {
        minBoundarySpacing: spacing * 0.65,
        maxBoundarySpacing: spacing * 1.65,
        contourVertexCap: 84,
        insetRingCount: 0,
        insetSpacing: spacing,
        interiorSpacing: spacing * 1.25,
        sampleMinDistance: spacing * 0.64,
        maxEdgeLength: spacing * 2.7,
        maxTriangleArea: spacing * spacing * 2.65,
        minAngleDegrees: 11,
        maxRefinementIterations: 1,
        maxRefinementPointsPerIteration: 12,
        refinementMinDistance: spacing * 0.5
      };
    }
  }
};

const createAlphaMask = (
  rgbaBytes: Uint8Array,
  width: number,
  height: number,
  alphaThreshold: number
): {
  readonly mask: Uint8Array;
  readonly bounds?: PixelBounds;
} => {
  const mask = new Uint8Array(width * height);
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if ((rgbaBytes[index * 4 + 3] ?? 0) <= alphaThreshold) {
        continue;
      }

      mask[index] = 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }

  return right < left || bottom < top
    ? { mask }
    : {
        mask,
        bounds: { left, top, right, bottom }
      };
};

const extractContourLoops = (
  mask: Uint8Array,
  width: number,
  height: number,
  bounds: PixelBounds
): readonly (readonly PixelPoint[])[] => {
  const edges: OutlineEdge[] = [];
  const addEdge = (start: PixelPoint, end: PixelPoint, direction: Direction) => {
    edges.push({ start, end, direction });
  };

  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      if (!isMaskFilled(mask, width, height, x, y)) {
        continue;
      }

      if (!isMaskFilled(mask, width, height, x, y - 1)) {
        addEdge({ x, y }, { x: x + 1, y }, 0);
      }
      if (!isMaskFilled(mask, width, height, x + 1, y)) {
        addEdge({ x: x + 1, y }, { x: x + 1, y: y + 1 }, 1);
      }
      if (!isMaskFilled(mask, width, height, x, y + 1)) {
        addEdge({ x: x + 1, y: y + 1 }, { x, y: y + 1 }, 2);
      }
      if (!isMaskFilled(mask, width, height, x - 1, y)) {
        addEdge({ x, y: y + 1 }, { x, y }, 3);
      }
    }
  }

  edges.sort(compareEdges);
  const outgoing = new Map<string, number[]>();
  edges.forEach((edge, edgeIndex) => {
    const key = pointKey(edge.start);
    const list = outgoing.get(key);
    if (list === undefined) {
      outgoing.set(key, [edgeIndex]);
    } else {
      list.push(edgeIndex);
    }
  });
  for (const list of outgoing.values()) {
    list.sort((left, right) => compareEdges(edges[left]!, edges[right]!));
  }

  const visited = new Uint8Array(edges.length);
  const loops: PixelPoint[][] = [];

  for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
    if (visited[edgeIndex] === 1) {
      continue;
    }

    const start = edges[edgeIndex]!.start;
    const loop: PixelPoint[] = [start];
    let currentIndex = edgeIndex;

    while (visited[currentIndex] === 0) {
      const current = edges[currentIndex]!;
      visited[currentIndex] = 1;
      loop.push(current.end);

      if (pointsEqual(current.end, start)) {
        break;
      }

      const candidates = (outgoing.get(pointKey(current.end)) ?? []).filter(
        (candidateIndex) => visited[candidateIndex] === 0
      );
      if (candidates.length === 0) {
        break;
      }

      currentIndex = chooseNextEdge(edges, candidates, current.direction);
    }

    if (loop.length >= 4 && pointsEqual(loop[0]!, loop[loop.length - 1]!)) {
      loop.pop();
      const cleaned = removeConsecutiveDuplicatePoints(loop);
      if (cleaned.length >= 3 && Math.abs(polygonArea(cleaned)) > 0.000001) {
        loops.push(cleaned);
      }
    }
  }

  return loops;
};

const chooseNextEdge = (
  edges: readonly OutlineEdge[],
  candidateIndices: readonly number[],
  currentDirection: Direction
): number => {
  const preference = [
    ((currentDirection + 1) % 4) as Direction,
    currentDirection,
    ((currentDirection + 3) % 4) as Direction,
    ((currentDirection + 2) % 4) as Direction
  ];

  return [...candidateIndices].sort((leftIndex, rightIndex) => {
    const left = edges[leftIndex]!;
    const right = edges[rightIndex]!;
    const directionOrder =
      preference.indexOf(left.direction) - preference.indexOf(right.direction);
    return directionOrder !== 0 ? directionOrder : compareEdges(left, right);
  })[0]!;
};

const resampleContourLoop = (
  loop: readonly PixelPoint[],
  config: V2Config
): readonly PixelPoint[] => {
  const cleaned = removeConsecutiveDuplicatePoints(loop);
  if (cleaned.length <= 3) {
    return cleaned;
  }

  const rotated = rotatePoints(cleaned, findLexicographicPointIndex(cleaned));
  const selected: PixelPoint[] = [rotated[0]!];
  let distanceSinceSelected = 0;

  for (let index = 1; index < rotated.length; index += 1) {
    const previous = rotated[(index - 1 + rotated.length) % rotated.length]!;
    const point = rotated[index]!;
    const next = rotated[(index + 1) % rotated.length]!;
    const curvature = turningCurvature(previous, point, next);
    const targetSpacing = lerp(
      config.maxBoundarySpacing,
      config.minBoundarySpacing,
      curvature
    );
    distanceSinceSelected += Math.sqrt(squaredDistance(previous, point));

    if (
      distanceSinceSelected >= targetSpacing ||
      (curvature >= 0.34 && distanceSinceSelected >= config.minBoundarySpacing * 0.55)
    ) {
      selected.push(point);
      distanceSinceSelected = 0;
    }
  }

  const withClosingSupport =
    selected.length >= 3
      ? selected
      : [rotated[0]!, rotated[Math.floor(rotated.length / 3)]!, rotated[Math.floor((rotated.length * 2) / 3)]!];
  return capContourVerticesByCurvature(withClosingSupport, config.contourVertexCap);
};

const capContourVerticesByCurvature = (
  points: readonly PixelPoint[],
  cap: number
): readonly PixelPoint[] => {
  if (points.length <= cap) {
    return points;
  }

  const selectedIndices = new Set<number>([0]);
  const ranked = points
    .map((point, index) => ({
      index,
      curvature: turningCurvature(
        points[(index - 1 + points.length) % points.length]!,
        point,
        points[(index + 1) % points.length]!
      )
    }))
    .sort((left, right) => right.curvature - left.curvature || left.index - right.index);

  for (const candidate of ranked) {
    selectedIndices.add(candidate.index);
    if (selectedIndices.size >= cap) {
      break;
    }
  }

  return [...selectedIndices]
    .sort((left, right) => left - right)
    .map((index) => points[index]!);
};

const sampleInsetRingPoints = (input: {
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly config: V2Config;
  readonly contourLoops: readonly (readonly PixelPoint[])[];
  readonly contourPoints: readonly OutlinePoint[];
}): readonly OutlinePoint[] => {
  if (input.config.insetRingCount <= 0) {
    return [];
  }

  const points: OutlinePoint[] = [];
  for (const loop of input.contourLoops) {
    const centroid = polygonCentroid(loop);
    for (let ringIndex = 0; ringIndex < input.config.insetRingCount; ringIndex += 1) {
      const ringDistance = input.config.insetSpacing * (ringIndex + 1);
      for (const point of loop) {
        const candidate = findInsetCandidate({
          mask: input.mask,
          width: input.width,
          height: input.height,
          point,
          centroid,
          ringDistance
        });
        if (candidate === undefined) {
          continue;
        }

        const rounded = {
          x: roundCoordinate(candidate.x),
          y: roundCoordinate(candidate.y),
          kind: "inset" as const,
          ringIndex
        };
        if (
          minDistanceToPoints(rounded, [...input.contourPoints, ...points]) <
          input.config.insetSpacing * 0.38
        ) {
          continue;
        }

        points.push(rounded);
      }
    }
  }

  return [...dedupeOutlinePoints(points)].sort(compareOutlinePoints);
};

const findInsetCandidate = (input: {
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly point: PixelPoint;
  readonly centroid: PixelPoint;
  readonly ringDistance: number;
}): PixelPoint | undefined => {
  const dx = input.centroid.x - input.point.x;
  const dy = input.centroid.y - input.point.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.000001) {
    return undefined;
  }

  for (const factor of [1, 0.72, 0.48, 0.28]) {
    const candidate = {
      x: input.point.x + (dx / length) * input.ringDistance * factor,
      y: input.point.y + (dy / length) * input.ringDistance * factor
    };
    if (isPointInsideAlpha(input.mask, input.width, input.height, candidate)) {
      return candidate;
    }
  }

  return undefined;
};

const sampleJitteredInteriorPoints = (input: {
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly bounds: PixelBounds;
  readonly config: V2Config;
  readonly seed: number;
  readonly blockedPoints: readonly OutlinePoint[];
}): readonly OutlinePoint[] => {
  const spacing = input.config.interiorSpacing;
  const rowSpacing = spacing * 0.8660254037844386;
  const points: OutlinePoint[] = [];
  let row = 0;

  for (
    let y = input.bounds.top + spacing * 0.5;
    y < input.bounds.bottom;
    y += rowSpacing
  ) {
    const rowOffset = row % 2 === 0 ? 0 : spacing * 0.5;
    let column = 0;
    for (
      let x = input.bounds.left + spacing * 0.5 + rowOffset;
      x < input.bounds.right;
      x += spacing
    ) {
      const jitter = deterministicJitter(input.seed, row, column, spacing);
      const candidate = {
        x: x + jitter.x,
        y: y + jitter.y
      };
      column += 1;

      if (!isPointInsideAlpha(input.mask, input.width, input.height, candidate)) {
        continue;
      }

      if (
        minDistanceToPoints(candidate, [...input.blockedPoints, ...points]) <
        input.config.sampleMinDistance
      ) {
        continue;
      }

      points.push({
        x: roundCoordinate(candidate.x),
        y: roundCoordinate(candidate.y),
        kind: "interior"
      });
    }
    row += 1;
  }

  return points.sort(compareOutlinePoints);
};

const refineTriangulation = (input: {
  readonly points: readonly OutlinePoint[];
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly config: V2Config;
}): RefinementResult => {
  let points = input.points;
  let triangles = createFilteredTriangles(points, input.mask, input.width, input.height);
  let iterationCount = 0;

  if (triangles.length === 0) {
    return { points, triangles, iterationCount };
  }

  for (let iteration = 0; iteration < input.config.maxRefinementIterations; iteration += 1) {
    const additions = collectRefinementPoints({
      points,
      triangles,
      mask: input.mask,
      width: input.width,
      height: input.height,
      config: input.config
    });
    if (additions.length === 0) {
      break;
    }

    const nextPoints = dedupeOutlinePoints([...points, ...additions]);
    const nextTriangles = createFilteredTriangles(nextPoints, input.mask, input.width, input.height);
    if (nextTriangles.length === 0) {
      break;
    }

    points = nextPoints;
    triangles = nextTriangles;
    iterationCount = iteration + 1;
  }

  return { points, triangles, iterationCount };
};

const collectRefinementPoints = (input: {
  readonly points: readonly OutlinePoint[];
  readonly triangles: readonly DelaunayTriangle[];
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly config: V2Config;
}): readonly OutlinePoint[] => {
  const candidates = input.triangles
    .map((triangle) => ({
      triangle,
      score: triangleRefinementScore(input.points, triangle, input.config)
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || compareTriangles(left.triangle, right.triangle));
  const additions: OutlinePoint[] = [];

  for (const candidate of candidates) {
    if (additions.length >= input.config.maxRefinementPointsPerIteration) {
      break;
    }

    const centroid = triangleCentroid(input.points, candidate.triangle);
    if (!isPointInsideAlpha(input.mask, input.width, input.height, centroid)) {
      continue;
    }

    if (
      minDistanceToPoints(centroid, [...input.points, ...additions]) <
      input.config.refinementMinDistance
    ) {
      continue;
    }

    additions.push({
      x: roundCoordinate(centroid.x),
      y: roundCoordinate(centroid.y),
      kind: "refinement"
    });
  }

  return additions.sort(compareOutlinePoints);
};

const triangleRefinementScore = (
  points: readonly PixelPoint[],
  triangle: DelaunayTriangle,
  config: V2Config
): number => {
  const a = points[triangle.a]!;
  const b = points[triangle.b]!;
  const c = points[triangle.c]!;
  const ab = Math.sqrt(squaredDistance(a, b));
  const bc = Math.sqrt(squaredDistance(b, c));
  const ca = Math.sqrt(squaredDistance(c, a));
  const maxEdge = Math.max(ab, bc, ca);
  const area = Math.abs(signedTriangleArea(points, triangle));
  const minAngle = Math.min(
    angleDegrees(ab, ca, bc),
    angleDegrees(ab, bc, ca),
    angleDegrees(bc, ca, ab)
  );

  const edgeScore = Math.max(0, maxEdge / config.maxEdgeLength - 1);
  const areaScore = Math.max(0, area / config.maxTriangleArea - 1);
  const angleScore = Math.max(0, (config.minAngleDegrees - minAngle) / config.minAngleDegrees);
  return edgeScore * 3 + areaScore * 2 + angleScore;
};

const createFilteredTriangles = (
  points: readonly OutlinePoint[],
  mask: Uint8Array,
  width: number,
  height: number
): readonly DelaunayTriangle[] =>
  triangulate(points)
    .map((triangle) => orientTriangle(points, triangle))
    .filter((triangle) => trianglePassesAlphaFilter(points, triangle, mask, width, height))
    .sort(compareTriangles);

const triangulate = (points: readonly OutlinePoint[]): readonly DelaunayTriangle[] => {
  const bounds = pointSetBounds(points);
  const delta = Math.max(bounds.right - bounds.left, bounds.bottom - bounds.top, 1);
  const midX = (bounds.left + bounds.right) / 2;
  const midY = (bounds.top + bounds.bottom) / 2;
  const allPoints: PixelPoint[] = [
    ...points,
    { x: midX - delta * 20, y: midY - delta },
    { x: midX, y: midY + delta * 20 },
    { x: midX + delta * 20, y: midY - delta }
  ];
  const superA = points.length;
  const superB = points.length + 1;
  const superC = points.length + 2;
  let triangles: DelaunayTriangle[] = [{ a: superA, b: superB, c: superC }];

  for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
    const point = points[pointIndex]!;
    const badTriangles = triangles.filter((triangle) =>
      circumcircleContains(allPoints, triangle, point)
    );
    const badTriangleKeys = new Set(badTriangles.map(triangleKey));
    const boundaryEdges = collectBoundaryEdges(badTriangles);

    triangles = triangles.filter((triangle) => !badTriangleKeys.has(triangleKey(triangle)));
    for (const edge of boundaryEdges) {
      const candidate = { a: edge.a, b: edge.b, c: pointIndex };
      if (Math.abs(signedTriangleArea(allPoints, candidate)) > 0.0000001) {
        triangles.push(candidate);
      }
    }
  }

  return triangles.filter(
    (triangle) => triangle.a < points.length && triangle.b < points.length && triangle.c < points.length
  );
};

const collectBoundaryEdges = (
  triangles: readonly DelaunayTriangle[]
): readonly { readonly a: number; readonly b: number }[] => {
  const edges = new Map<string, { edge: { readonly a: number; readonly b: number }; count: number }>();
  for (const triangle of triangles) {
    for (const edge of [
      { a: triangle.a, b: triangle.b },
      { a: triangle.b, b: triangle.c },
      { a: triangle.c, b: triangle.a }
    ]) {
      const key = edgeKey(edge.a, edge.b);
      const entry = edges.get(key);
      if (entry === undefined) {
        edges.set(key, { edge, count: 1 });
      } else {
        entry.count += 1;
      }
    }
  }

  return [...edges.values()]
    .filter((entry) => entry.count === 1)
    .map((entry) => entry.edge)
    .sort((left, right) => edgeKey(left.a, left.b).localeCompare(edgeKey(right.a, right.b)));
};

const circumcircleContains = (
  points: readonly PixelPoint[],
  triangle: DelaunayTriangle,
  point: PixelPoint
): boolean => {
  const a = points[triangle.a]!;
  const b = points[triangle.b]!;
  const c = points[triangle.c]!;
  const ax = a.x - point.x;
  const ay = a.y - point.y;
  const bx = b.x - point.x;
  const by = b.y - point.y;
  const cx = c.x - point.x;
  const cy = c.y - point.y;
  const determinant =
    (ax * ax + ay * ay) * (bx * cy - cx * by) -
    (bx * bx + by * by) * (ax * cy - cx * ay) +
    (cx * cx + cy * cy) * (ax * by - bx * ay);
  const orientation = signedTriangleArea(points, triangle);

  if (Math.abs(orientation) <= 0.0000001) {
    return false;
  }

  return orientation > 0 ? determinant > 0.0000001 : determinant < -0.0000001;
};

const trianglePassesAlphaFilter = (
  points: readonly OutlinePoint[],
  triangle: DelaunayTriangle,
  mask: Uint8Array,
  width: number,
  height: number
): boolean => {
  const a = points[triangle.a]!;
  const b = points[triangle.b]!;
  const c = points[triangle.c]!;
  const area = Math.abs(signedTriangleArea(points, triangle));
  if (area <= 0.0000001) {
    return false;
  }

  const centroid = triangleCentroid(points, triangle);
  if (!isPointInsideAlpha(mask, width, height, centroid)) {
    return false;
  }

  const samples = [
    midpoint(a, b),
    midpoint(b, c),
    midpoint(c, a),
    midpoint(a, centroid),
    midpoint(b, centroid),
    midpoint(c, centroid)
  ];

  return samples.every((sample) => isPointNearAlpha(mask, width, height, sample));
};

const createMeshDto = (input: {
  readonly input: AutoOutlineV2MeshInput;
  readonly width: number;
  readonly height: number;
  readonly points: readonly OutlinePoint[];
  readonly triangles: readonly DelaunayTriangle[];
}): MeshDto => {
  const token = stripIdPrefix(input.input.drawableId, "draw_");
  const vertices: MeshDto["vertices"] = [];
  const uvs: MeshDto["uvs"] = [];
  const vertexStableIds: string[] = [];

  input.points.forEach((point, pointIndex) => {
    const uv = {
      x: roundCoordinate(point.x / input.width),
      y: roundCoordinate(point.y / input.height)
    };
    vertices.push({
      x: roundCoordinate(input.input.bounds.x + input.input.bounds.width * uv.x),
      y: roundCoordinate(input.input.bounds.y + input.input.bounds.height * uv.y)
    });
    uvs.push(uv);
    vertexStableIds.push(`vtx_${token}_outline_v2_${pointStableKind(point)}_${pointIndex}`);
  });

  return {
    meshId: input.input.meshId,
    drawableId: input.input.drawableId,
    vertices,
    uvs,
    triangles: input.triangles.map((triangle) => [triangle.a, triangle.b, triangle.c]),
    vertexStableIds,
    triangleStableIds: input.triangles.map(
      (_triangle, triangleIndex) => `tri_${token}_outline_v2_${triangleIndex}` as TriangleId
    ),
    topologyRevision: 0,
    bounds: structuredClone(input.input.bounds),
    generationProvenanceId: input.input.provenanceId
  };
};

const pointStableKind = (point: OutlinePoint): string =>
  point.kind === "inset" ? `inset_${point.ringIndex ?? 0}` : point.kind;

const createSamplerSeed = (
  input: AutoOutlineV2MeshInput,
  width: number,
  height: number
): number =>
  hashString(
    `${input.drawableId}:${width}x${height}:${input.densityHint ?? "low"}:${input.alphaThreshold ?? 8}`
  );

const deterministicJitter = (
  seed: number,
  row: number,
  column: number,
  spacing: number
): PixelPoint => {
  const xUnit = hashUnit(seed, row, column, 0);
  const yUnit = hashUnit(seed, row, column, 1);
  const amplitude = spacing * 0.28;
  return {
    x: (xUnit - 0.5) * amplitude,
    y: (yUnit - 0.5) * amplitude
  };
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const hashUnit = (
  seed: number,
  row: number,
  column: number,
  channel: number
): number => {
  let hash = seed ^ Math.imul(row + 0x9e3779b9, 0x85ebca6b);
  hash ^= Math.imul(column + 0xc2b2ae35, 0x27d4eb2d);
  hash ^= Math.imul(channel + 0x165667b1, 0x9e3779b1);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0xffffffff;
};

const countGeneratedInsetRings = (points: readonly OutlinePoint[]): number =>
  new Set(
    points
      .filter((point) => point.kind === "inset")
      .map((point) => point.ringIndex ?? 0)
  ).size;

const dedupeOutlinePoints = (points: readonly OutlinePoint[]): readonly OutlinePoint[] => {
  const result: OutlinePoint[] = [];
  const seen = new Set<string>();
  for (const point of points) {
    const key = `${roundCoordinate(point.x)}:${roundCoordinate(point.y)}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push({
      x: roundCoordinate(point.x),
      y: roundCoordinate(point.y),
      kind: point.kind,
      ...(point.ringIndex === undefined ? {} : { ringIndex: point.ringIndex })
    });
  }

  return result;
};

const removeConsecutiveDuplicatePoints = (points: readonly PixelPoint[]): PixelPoint[] => {
  const result: PixelPoint[] = [];
  for (const point of points) {
    if (result.length === 0 || !pointsEqual(result[result.length - 1]!, point)) {
      result.push(point);
    }
  }

  if (result.length > 1 && pointsEqual(result[0]!, result[result.length - 1]!)) {
    result.pop();
  }

  return result;
};

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

const isMaskFilled = (
  mask: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number
): boolean => {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return false;
  }

  return mask[y * width + x] === 1;
};

const isPointInsideAlpha = (
  mask: Uint8Array,
  width: number,
  height: number,
  point: PixelPoint
): boolean => {
  const x = clampInt(Math.floor(point.x), 0, width - 1);
  const y = clampInt(Math.floor(point.y), 0, height - 1);
  return isMaskFilled(mask, width, height, x, y);
};

const isPointNearAlpha = (
  mask: Uint8Array,
  width: number,
  height: number,
  point: PixelPoint
): boolean => {
  const x = Math.floor(point.x);
  const y = Math.floor(point.y);
  for (let offsetY = -1; offsetY <= 0; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 0; offsetX += 1) {
      if (isMaskFilled(mask, width, height, x + offsetX, y + offsetY)) {
        return true;
      }
    }
  }

  return isPointInsideAlpha(mask, width, height, point);
};

const compareContourLoops = (
  left: readonly PixelPoint[],
  right: readonly PixelPoint[]
): number => {
  const areaOrder = Math.abs(polygonArea(right)) - Math.abs(polygonArea(left));
  if (areaOrder !== 0) {
    return areaOrder;
  }

  return comparePoints(left[0]!, right[0]!);
};

const compareOutlinePoints = (left: OutlinePoint, right: OutlinePoint): number =>
  (left.ringIndex ?? -1) - (right.ringIndex ?? -1) ||
  comparePoints(left, right) ||
  left.kind.localeCompare(right.kind);

const comparePoints = (left: PixelPoint, right: PixelPoint): number =>
  left.y - right.y || left.x - right.x;

const compareEdges = (left: OutlineEdge, right: OutlineEdge): number =>
  comparePoints(left.start, right.start) ||
  comparePoints(left.end, right.end) ||
  left.direction - right.direction;

const compareTriangles = (left: DelaunayTriangle, right: DelaunayTriangle): number => {
  const leftKey = [left.a, left.b, left.c].sort((a, b) => a - b).join(":");
  const rightKey = [right.a, right.b, right.c].sort((a, b) => a - b).join(":");
  return leftKey.localeCompare(rightKey);
};

const findLexicographicPointIndex = (points: readonly PixelPoint[]): number => {
  let result = 0;
  for (let index = 1; index < points.length; index += 1) {
    if (comparePoints(points[index]!, points[result]!) < 0) {
      result = index;
    }
  }

  return result;
};

const rotatePoints = (
  points: readonly PixelPoint[],
  startIndex: number
): readonly PixelPoint[] => [...points.slice(startIndex), ...points.slice(0, startIndex)];

const pointSetBounds = (points: readonly PixelPoint[]): PixelBounds => {
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

const minDistanceToPoints = (
  point: PixelPoint,
  points: readonly PixelPoint[]
): number => {
  if (points.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.sqrt(Math.min(...points.map((candidate) => squaredDistance(point, candidate))));
};

const polygonArea = (points: readonly PixelPoint[]): number => {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += point.x * next.y - next.x * point.y;
  }

  return area / 2;
};

const polygonCentroid = (points: readonly PixelPoint[]): PixelPoint => {
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
    const cross = point.x * next.y - next.x * point.y;
    x += (point.x + next.x) * cross;
    y += (point.y + next.y) * cross;
  }

  return {
    x: x / (6 * area),
    y: y / (6 * area)
  };
};

const signedTriangleArea = (
  points: readonly PixelPoint[],
  triangle: DelaunayTriangle
): number => {
  const a = points[triangle.a]!;
  const b = points[triangle.b]!;
  const c = points[triangle.c]!;
  return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
};

const triangleCentroid = (
  points: readonly PixelPoint[],
  triangle: DelaunayTriangle
): PixelPoint => {
  const a = points[triangle.a]!;
  const b = points[triangle.b]!;
  const c = points[triangle.c]!;
  return {
    x: (a.x + b.x + c.x) / 3,
    y: (a.y + b.y + c.y) / 3
  };
};

const orientTriangle = (
  points: readonly PixelPoint[],
  triangle: DelaunayTriangle
): DelaunayTriangle =>
  signedTriangleArea(points, triangle) < 0
    ? { a: triangle.a, b: triangle.c, c: triangle.b }
    : triangle;

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

const turningCurvature = (
  previous: PixelPoint,
  point: PixelPoint,
  next: PixelPoint
): number => {
  const ax = point.x - previous.x;
  const ay = point.y - previous.y;
  const bx = next.x - point.x;
  const by = next.y - point.y;
  const aLength = Math.hypot(ax, ay);
  const bLength = Math.hypot(bx, by);
  if (aLength <= 0.000001 || bLength <= 0.000001) {
    return 0;
  }

  const cross = ax * by - ay * bx;
  const dot = ax * bx + ay * by;
  return clamp(Math.abs(Math.atan2(cross, dot)) / Math.PI, 0, 1);
};

const triangleKey = (triangle: DelaunayTriangle): string =>
  `${triangle.a}:${triangle.b}:${triangle.c}`;

const edgeKey = (a: number, b: number): string =>
  a < b ? `${a}:${b}` : `${b}:${a}`;

const pointKey = (point: PixelPoint): string => `${point.x}:${point.y}`;

const pointsEqual = (left: PixelPoint, right: PixelPoint): boolean =>
  left.x === right.x && left.y === right.y;

const squaredDistance = (left: PixelPoint, right: PixelPoint): number =>
  (left.x - right.x) ** 2 + (left.y - right.y) ** 2;

const midpoint = (left: PixelPoint, right: PixelPoint): PixelPoint => ({
  x: (left.x + right.x) / 2,
  y: (left.y + right.y) / 2
});

const stripIdPrefix = (id: string, prefix: string): string =>
  id.startsWith(prefix) ? id.slice(prefix.length) : id;

const lerp = (left: number, right: number, ratio: number): number =>
  left + (right - left) * ratio;

const roundCoordinate = (value: number): number => {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Math.trunc(value), min), max);
