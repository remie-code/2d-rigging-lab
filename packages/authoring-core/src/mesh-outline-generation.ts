import type { DrawableId, MeshId, ProvenanceId, RectDto, TriangleId } from "@private-2d-rigging-lab/contracts";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";

import type { MeshDensityHint } from "./mesh-generation.js";
import { simplifyContourLoop } from "./mesh-geometry/polyline-simplification.js";

export type AutoOutlineFailureReason =
  | "invalid-rgba"
  | "alpha-empty"
  | "contour-extraction-failed"
  | "triangulation-failed";

export interface AutoOutlineMeshInput {
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

export type AutoOutlineMeshResult =
  | {
      readonly status: "generated";
      readonly mesh: MeshDto;
      readonly alphaBounds: RectDto;
      readonly contourLoopCount: number;
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
  readonly kind: "contour" | "interior";
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

interface OutlineConfig {
  readonly simplifyEpsilon: number;
  readonly interiorDivisions: number;
  readonly minInteriorSpacing: number;
  readonly contourVertexCap: number;
}

const OUTLINE_CONFIG_BY_DENSITY: Record<MeshDensityHint, OutlineConfig> = {
  high: {
    simplifyEpsilon: 0.35,
    interiorDivisions: 8,
    minInteriorSpacing: 2,
    contourVertexCap: 192
  },
  medium: {
    simplifyEpsilon: 0.65,
    interiorDivisions: 5,
    minInteriorSpacing: 3,
    contourVertexCap: 112
  },
  low: {
    simplifyEpsilon: 1.25,
    interiorDivisions: 3,
    minInteriorSpacing: 4,
    contourVertexCap: 64
  }
};

export const createAutoOutlineMesh = (input: AutoOutlineMeshInput): AutoOutlineMeshResult => {
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
  const config = OUTLINE_CONFIG_BY_DENSITY[input.densityHint ?? "low"];
  const contourLoops = extractContourLoops(alpha.mask, width, height, alpha.bounds)
    .map((loop) => simplifyContourLoop(loop, config))
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
  const interiorPoints = sampleInteriorPoints({
    mask: alpha.mask,
    width,
    height,
    bounds: alpha.bounds,
    config,
    contourPoints
  });
  const points = dedupeOutlinePoints([...contourPoints, ...interiorPoints]);
  if (points.length < 3) {
    return {
      status: "failed",
      reason: "triangulation-failed",
      alphaBounds,
      contourLoopCount: contourLoops.length
    };
  }

  const triangles = triangulate(points)
    .map((triangle) => orientTriangle(points, triangle))
    .filter((triangle) => trianglePassesAlphaFilter(points, triangle, alpha.mask, width, height))
    .sort(compareTriangles);

  if (triangles.length === 0) {
    return {
      status: "failed",
      reason: "triangulation-failed",
      alphaBounds,
      contourLoopCount: contourLoops.length
    };
  }

  const token = stripIdPrefix(input.drawableId, "draw_");
  const vertices: MeshDto["vertices"] = [];
  const uvs: MeshDto["uvs"] = [];
  const vertexStableIds: string[] = [];

  points.forEach((point, pointIndex) => {
    const uv = {
      x: roundCoordinate(point.x / width),
      y: roundCoordinate(point.y / height)
    };
    vertices.push({
      x: roundCoordinate(input.bounds.x + input.bounds.width * uv.x),
      y: roundCoordinate(input.bounds.y + input.bounds.height * uv.y)
    });
    uvs.push(uv);
    vertexStableIds.push(`vtx_${token}_${point.kind}_${pointIndex}`);
  });

  return {
    status: "generated",
    alphaBounds,
    contourLoopCount: contourLoops.length,
    mesh: {
      meshId: input.meshId,
      drawableId: input.drawableId,
      vertices,
      uvs,
      triangles: triangles.map((triangle) => [triangle.a, triangle.b, triangle.c]),
      vertexStableIds,
      triangleStableIds: triangles.map(
        (_triangle, triangleIndex) => `tri_${token}_outline_${triangleIndex}` as TriangleId
      ),
      topologyRevision: 0,
      bounds: structuredClone(input.bounds),
      generationProvenanceId: input.provenanceId
    }
  };
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

const sampleInteriorPoints = (input: {
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly bounds: PixelBounds;
  readonly config: OutlineConfig;
  readonly contourPoints: readonly OutlinePoint[];
}): readonly OutlinePoint[] => {
  const maxDimension = Math.max(
    input.bounds.right - input.bounds.left,
    input.bounds.bottom - input.bounds.top
  );
  const spacing = Math.max(
    input.config.minInteriorSpacing,
    Math.round(maxDimension / input.config.interiorDivisions)
  );
  const points: OutlinePoint[] = [];

  for (let y = input.bounds.top + spacing / 2; y < input.bounds.bottom; y += spacing) {
    for (let x = input.bounds.left + spacing / 2; x < input.bounds.right; x += spacing) {
      if (!isPointInsideAlpha(input.mask, input.width, input.height, { x, y })) {
        continue;
      }

      if (minDistanceToPoints({ x, y }, input.contourPoints) < spacing * 0.45) {
        continue;
      }

      points.push({ x: roundCoordinate(x), y: roundCoordinate(y), kind: "interior" });
    }
  }

  return points.sort(compareOutlinePoints);
};

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

  const centroid = {
    x: (a.x + b.x + c.x) / 3,
    y: (a.y + b.y + c.y) / 3
  };
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

const orientTriangle = (
  points: readonly PixelPoint[],
  triangle: DelaunayTriangle
): DelaunayTriangle => {
  return signedTriangleArea(points, triangle) < 0
    ? { a: triangle.a, b: triangle.c, c: triangle.b }
    : triangle;
};

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
      kind: point.kind
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
  comparePoints(left, right);

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

const signedTriangleArea = (
  points: readonly PixelPoint[],
  triangle: DelaunayTriangle
): number => {
  const a = points[triangle.a]!;
  const b = points[triangle.b]!;
  const c = points[triangle.c]!;
  return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
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

const roundCoordinate = (value: number): number => {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
};


const clampInt = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Math.trunc(value), min), max);
