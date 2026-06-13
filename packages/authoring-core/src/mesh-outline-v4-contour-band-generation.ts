import type { DrawableId, MeshId, ProvenanceId, RectDto, TriangleId } from "@private-2d-rigging-lab/contracts";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";

import type { MeshDensityHint } from "./mesh-generation.js";
import type { AutoOutlineFailureReason } from "./mesh-outline-generation.js";
import {
  computeMeshQualityMetrics,
  type MeshGenerationContourBandMetrics,
  type MeshGenerationQualityMetrics
} from "./mesh-quality-metrics.js";

export interface AutoOutlineV4ContourBandMeshInput {
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

export type AutoOutlineV4ContourBandFailureReason =
  | AutoOutlineFailureReason
  | "contour-band-generation-failed"
  | "contour-offset-self-intersection"
  | "interior-fill-failed"
  | "quality-threshold-failed";

export type AutoOutlineV4ContourBandMeshResult =
  | {
      readonly status: "generated";
      readonly mesh: MeshDto;
      readonly alphaBounds: RectDto;
      readonly contourLoopCount: number;
      readonly contourBandMetrics: MeshGenerationContourBandMetrics;
      readonly qualityMetrics: MeshGenerationQualityMetrics;
    }
  | {
      readonly status: "failed";
      readonly reason: AutoOutlineV4ContourBandFailureReason;
      readonly alphaBounds?: RectDto;
      readonly contourLoopCount?: number;
      readonly fallbackMetrics?: MeshGenerationContourBandMetrics;
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

interface ContourBandPoint extends PixelPoint {
  readonly kind: "outer-contour" | "inner-contour" | "interior";
  readonly order: number;
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

interface V4Config {
  readonly preset: MeshDensityHint;
  readonly targetEdgeLength: number;
  readonly contourSampleSpacing: number;
  readonly contourCurvatureKeep: number;
  readonly contourVertexCap: number;
  readonly outerOffset: number;
  readonly innerOffset: number;
  readonly interiorSpacing: number;
  readonly sampleMinDistance: number;
  readonly maxOuterContourAreaRatio: number;
  readonly maxBoundaryToInteriorEdgeLength: number;
  readonly maxInteriorEdgeLength: number;
  readonly maxTransparentOnlyTriangleRatio: number;
  readonly maxVertexValence: number;
  readonly maxVertexCountCap: number;
  readonly maxInteriorPointCount: number;
}

interface ContourBandRings {
  readonly outerContour: readonly PixelPoint[];
  readonly innerContour: readonly PixelPoint[];
  readonly outerOffset: number;
  readonly innerOffset: number;
  readonly outerContourArea: number;
  readonly outerContourAreaRatio: number;
}

interface ContourBandBuild {
  readonly mesh: MeshDto;
  readonly pixelPoints: readonly ContourBandPoint[];
  readonly bandTriangleCount: number;
  readonly interiorTriangleCount: number;
  readonly rejectedDegenerateTriangleCount: number;
  readonly rejectedLongBoundaryToInteriorTriangleCount: number;
  readonly rejectedLongInteriorTriangleCount: number;
  readonly rejectedOutsideInteriorTriangleCount: number;
}

export const createAutoOutlineV4ContourBandMesh = (
  input: AutoOutlineV4ContourBandMeshInput
): AutoOutlineV4ContourBandMeshResult => {
  const width = Math.round(input.textureSize.width);
  const height = Math.round(input.textureSize.height);
  if (width <= 0 || height <= 0 || input.rgbaBytes.byteLength !== width * height * 4) {
    return { status: "failed", reason: "invalid-rgba" };
  }

  const alpha = createAlphaMask(input.rgbaBytes, width, height, input.alphaThreshold ?? 8);
  if (alpha.bounds === undefined || alpha.area <= 0) {
    return { status: "failed", reason: "alpha-empty" };
  }

  const alphaBounds = pixelBoundsToStageRect(alpha.bounds, input.bounds, width, height);
  const densityHint = input.densityHint ?? "low";
  const config = createV4Config(alpha.bounds, densityHint);
  const contourLoops = extractContourLoops(alpha.mask, width, height, alpha.bounds)
    .filter((loop): loop is readonly PixelPoint[] => loop.length >= 3)
    .sort(compareContourLoops);

  if (contourLoops.length === 0) {
    return {
      status: "failed",
      reason: "contour-extraction-failed",
      alphaBounds
    };
  }

  const selectedContour = contourLoops[0]!;
  const contour = resampleContourLoop(selectedContour, config);
  if (contour.length < 3) {
    return {
      status: "failed",
      reason: "contour-band-generation-failed",
      alphaBounds,
      contourLoopCount: contourLoops.length
    };
  }

  const rings = createContourBandRings({
    contour,
    config,
    mask: alpha.mask,
    width,
    height,
    alphaArea: alpha.area
  });
  if (rings === undefined) {
    return {
      status: "failed",
      reason: "contour-offset-self-intersection",
      alphaBounds,
      contourLoopCount: contourLoops.length
    };
  }

  const innerPoints = rings.innerContour.map(
    (point, pointIndex): ContourBandPoint => ({
      ...point,
      kind: "inner-contour",
      order: pointIndex
    })
  );
  const outerPoints = rings.outerContour.map(
    (point, pointIndex): ContourBandPoint => ({
      ...point,
      kind: "outer-contour",
      order: pointIndex
    })
  );
  const interiorPoints = sampleInteriorPoints({
    mask: alpha.mask,
    width,
    height,
    bounds: alpha.bounds,
    innerContour: rings.innerContour,
    config,
    seed: createSamplerSeed(input, width, height),
    blockedPoints: innerPoints
  });
  if (interiorPoints.length === 0) {
    return {
      status: "failed",
      reason: "interior-fill-failed",
      alphaBounds,
      contourLoopCount: contourLoops.length
    };
  }

  const built = createContourBandMesh({
    input,
    width,
    height,
    mask: alpha.mask,
    config,
    outerPoints,
    innerPoints,
    interiorPoints,
    innerContour: rings.innerContour
  });
  if (built.bandTriangleCount === 0 || built.interiorTriangleCount === 0) {
    return {
      status: "failed",
      reason: "interior-fill-failed",
      alphaBounds,
      contourLoopCount: contourLoops.length
    };
  }

  const contourBandMetrics = createContourBandMetrics({
    config,
    alphaArea: alpha.area,
    selectedContourVertexCount: selectedContour.length,
    simplifiedContourVertexCount: contour.length,
    rings,
    interiorPointCount: interiorPoints.length,
    build: built,
    mask: alpha.mask,
    width,
    height
  });

  if (
    contourBandMetrics.transparentOnlyTriangleRatio > config.maxTransparentOnlyTriangleRatio ||
    contourBandMetrics.maxBoundaryToInteriorEdgeLength > config.maxBoundaryToInteriorEdgeLength ||
    contourBandMetrics.maxVertexValence > config.maxVertexValence ||
    contourBandMetrics.vertexCount > config.maxVertexCountCap
  ) {
    return {
      status: "failed",
      reason: "quality-threshold-failed",
      alphaBounds,
      contourLoopCount: contourLoops.length,
      fallbackMetrics: contourBandMetrics
    };
  }

  const qualityMetrics = computeMeshQualityMetrics(built.mesh, {
    refinementIterationCount: 0,
    triangulationMode: "interim-delaunay-contour-band-strip",
    contourBandMetrics
  });

  return {
    status: "generated",
    mesh: built.mesh,
    alphaBounds,
    contourLoopCount: contourLoops.length,
    contourBandMetrics,
    qualityMetrics
  };
};

const createV4Config = (bounds: PixelBounds, densityHint: MeshDensityHint): V4Config => {
  const width = Math.max(bounds.right - bounds.left, 1);
  const height = Math.max(bounds.bottom - bounds.top, 1);
  const maxDimension = Math.max(width, height);
  const minDimension = Math.min(width, height);
  const baseSize = Math.max(minDimension, 1);

  switch (densityHint) {
    case "high": {
      const targetEdgeLength = clamp(maxDimension / 3.8, 5.5, 11);
      return {
        preset: "high",
        targetEdgeLength,
        contourSampleSpacing: targetEdgeLength * 0.82,
        contourCurvatureKeep: 0.3,
        contourVertexCap: 72,
        outerOffset: clamp(baseSize * 0.035, 1.2, Math.max(1.2, baseSize * 0.1)),
        innerOffset: targetEdgeLength * 0.38,
        interiorSpacing: targetEdgeLength * 0.74,
        sampleMinDistance: targetEdgeLength * 0.38,
        maxOuterContourAreaRatio: 1.72,
        maxBoundaryToInteriorEdgeLength: targetEdgeLength * 1.85,
        maxInteriorEdgeLength: targetEdgeLength * 3.1,
        maxTransparentOnlyTriangleRatio: 0.08,
        maxVertexValence: 12,
        maxVertexCountCap: 180,
        maxInteriorPointCount: 72
      };
    }
    case "medium": {
      const targetEdgeLength = clamp(maxDimension / 3.1, 7, 14);
      return {
        preset: "medium",
        targetEdgeLength,
        contourSampleSpacing: targetEdgeLength,
        contourCurvatureKeep: 0.34,
        contourVertexCap: 52,
        outerOffset: clamp(baseSize * 0.027, 0.95, Math.max(0.95, baseSize * 0.085)),
        innerOffset: targetEdgeLength * 0.36,
        interiorSpacing: targetEdgeLength * 0.86,
        sampleMinDistance: targetEdgeLength * 0.4,
        maxOuterContourAreaRatio: 1.58,
        maxBoundaryToInteriorEdgeLength: targetEdgeLength * 2,
        maxInteriorEdgeLength: targetEdgeLength * 3.2,
        maxTransparentOnlyTriangleRatio: 0.08,
        maxVertexValence: 12,
        maxVertexCountCap: 128,
        maxInteriorPointCount: 48
      };
    }
    case "low":
    default: {
      const targetEdgeLength = clamp(maxDimension / 2.45, 8.5, 18);
      return {
        preset: "low",
        targetEdgeLength,
        contourSampleSpacing: targetEdgeLength * 1.18,
        contourCurvatureKeep: 0.38,
        contourVertexCap: 36,
        outerOffset: clamp(baseSize * 0.019, 0.7, Math.max(0.7, baseSize * 0.07)),
        innerOffset: targetEdgeLength * 0.34,
        interiorSpacing: targetEdgeLength * 1.02,
        sampleMinDistance: targetEdgeLength * 0.44,
        maxOuterContourAreaRatio: 1.46,
        maxBoundaryToInteriorEdgeLength: targetEdgeLength * 2.15,
        maxInteriorEdgeLength: targetEdgeLength * 3.3,
        maxTransparentOnlyTriangleRatio: 0.08,
        maxVertexValence: 12,
        maxVertexCountCap: 88,
        maxInteriorPointCount: 30
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
  readonly area: number;
  readonly bounds?: PixelBounds;
} => {
  const mask = new Uint8Array(width * height);
  let area = 0;
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
      area += 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }

  return right < left || bottom < top
    ? { mask, area }
    : {
        mask,
        area,
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
  config: V4Config
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
    distanceSinceSelected += Math.sqrt(squaredDistance(previous, point));

    if (
      distanceSinceSelected >= config.contourSampleSpacing ||
      (curvature >= config.contourCurvatureKeep &&
        distanceSinceSelected >= config.contourSampleSpacing * 0.35)
    ) {
      selected.push(point);
      distanceSinceSelected = 0;
    }
  }

  const withClosingSupport =
    selected.length >= 3
      ? selected
      : [rotated[0]!, rotated[Math.floor(rotated.length / 3)]!, rotated[Math.floor((rotated.length * 2) / 3)]!];
  return capVerticesByCurvature(withClosingSupport, config.contourVertexCap);
};

const createContourBandRings = (input: {
  readonly contour: readonly PixelPoint[];
  readonly config: V4Config;
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly alphaArea: number;
}): ContourBandRings | undefined => {
  const centroid = polygonCentroid(input.contour);
  const attempts = [1, 0.72, 0.48, 0.25] as const;

  for (const offsetFactor of attempts) {
    const outerOffset = input.config.outerOffset * offsetFactor;
    const innerOffset = input.config.innerOffset * offsetFactor;
    const outerContour = input.contour.map((point) =>
      offsetPointFromCentroid(point, centroid, outerOffset, input.width, input.height)
    );
    const innerContour = input.contour.map((point) =>
      findInnerSupportPoint({
        point,
        centroid,
        mask: input.mask,
        width: input.width,
        height: input.height,
        innerOffset
      })
    );

    if (
      outerContour.length < 3 ||
      innerContour.length < 3 ||
      hasSelfIntersections(outerContour) ||
      hasSelfIntersections(innerContour)
    ) {
      continue;
    }

    const outerContourArea = Math.abs(polygonArea(outerContour));
    const outerContourAreaRatio = outerContourArea / Math.max(input.alphaArea, 1);
    if (outerContourAreaRatio > input.config.maxOuterContourAreaRatio) {
      continue;
    }

    return {
      outerContour,
      innerContour,
      outerOffset,
      innerOffset,
      outerContourArea,
      outerContourAreaRatio
    };
  }

  return undefined;
};

const findInnerSupportPoint = (input: {
  readonly point: PixelPoint;
  readonly centroid: PixelPoint;
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly innerOffset: number;
}): PixelPoint => {
  const dx = input.centroid.x - input.point.x;
  const dy = input.centroid.y - input.point.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.000001) {
    return {
      x: roundCoordinate(clamp(input.point.x, 0, input.width)),
      y: roundCoordinate(clamp(input.point.y, 0, input.height))
    };
  }

  for (const factor of [1, 0.78, 0.55, 0.32, 0.16, 0] as const) {
    const candidate = {
      x: roundCoordinate(clamp(input.point.x + (dx / length) * input.innerOffset * factor, 0, input.width)),
      y: roundCoordinate(clamp(input.point.y + (dy / length) * input.innerOffset * factor, 0, input.height))
    };
    if (isPointInsideAlpha(input.mask, input.width, input.height, candidate)) {
      return candidate;
    }
  }

  return {
    x: roundCoordinate(clamp(input.point.x + (dx / length) * input.innerOffset * 0.32, 0, input.width)),
    y: roundCoordinate(clamp(input.point.y + (dy / length) * input.innerOffset * 0.32, 0, input.height))
  };
};

const sampleInteriorPoints = (input: {
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly bounds: PixelBounds;
  readonly innerContour: readonly PixelPoint[];
  readonly config: V4Config;
  readonly seed: number;
  readonly blockedPoints: readonly ContourBandPoint[];
}): readonly ContourBandPoint[] => {
  const spacing = input.config.interiorSpacing;
  const rowSpacing = spacing * 0.8660254037844386;
  const points: ContourBandPoint[] = [];
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

      if (
        !isPointInsideAlpha(input.mask, input.width, input.height, candidate) ||
        !isPointInsidePolygon(candidate, input.innerContour)
      ) {
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
        kind: "interior",
        order: points.length
      });

      if (points.length >= input.config.maxInteriorPointCount) {
        return points.sort(compareContourBandPoints);
      }
    }
    row += 1;
  }

  return points.length > 0
    ? points.sort(compareContourBandPoints)
    : sampleFallbackInteriorPoints(input);
};

const sampleFallbackInteriorPoints = (input: {
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly bounds: PixelBounds;
  readonly innerContour: readonly PixelPoint[];
  readonly config: V4Config;
  readonly seed: number;
  readonly blockedPoints: readonly ContourBandPoint[];
}): readonly ContourBandPoint[] => {
  const centroid = polygonCentroid(input.innerContour);
  const radius = input.config.targetEdgeLength * 0.72;
  const candidates: PixelPoint[] = [centroid];
  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI * 2 * index) / 6;
    candidates.push({
      x: centroid.x + Math.cos(angle) * radius,
      y: centroid.y + Math.sin(angle) * radius
    });
  }
  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI * 2 * (index + 0.5)) / 6;
    candidates.push({
      x: centroid.x + Math.cos(angle) * radius * 1.25,
      y: centroid.y + Math.sin(angle) * radius * 1.25
    });
  }

  const points: ContourBandPoint[] = [];
  for (const candidate of candidates) {
    const clamped = {
      x: roundCoordinate(clamp(candidate.x, input.bounds.left, input.bounds.right)),
      y: roundCoordinate(clamp(candidate.y, input.bounds.top, input.bounds.bottom))
    };
    if (
      !isPointInsideAlpha(input.mask, input.width, input.height, clamped) ||
      !isPointInsidePolygon(clamped, input.innerContour)
    ) {
      continue;
    }

    if (
      minDistanceToPoints(clamped, [...input.blockedPoints, ...points]) <
      input.config.sampleMinDistance * 0.45
    ) {
      continue;
    }

    points.push({
      ...clamped,
      kind: "interior",
      order: points.length
    });
  }

  return points.sort(compareContourBandPoints);
};

const createContourBandMesh = (input: {
  readonly input: AutoOutlineV4ContourBandMeshInput;
  readonly width: number;
  readonly height: number;
  readonly mask: Uint8Array;
  readonly config: V4Config;
  readonly outerPoints: readonly ContourBandPoint[];
  readonly innerPoints: readonly ContourBandPoint[];
  readonly interiorPoints: readonly ContourBandPoint[];
  readonly innerContour: readonly PixelPoint[];
}): ContourBandBuild => {
  const token = stripIdPrefix(input.input.drawableId, "draw_");
  const pixelPoints = [
    ...input.outerPoints,
    ...input.innerPoints,
    ...input.interiorPoints
  ];
  const outerStart = 0;
  const innerStart = input.outerPoints.length;
  const interiorStart = innerStart + input.innerPoints.length;
  const vertices: MeshDto["vertices"] = [];
  const uvs: MeshDto["uvs"] = [];
  const vertexStableIds: string[] = [];
  const triangles: MeshDto["triangles"] = [];
  const triangleStableIds: TriangleId[] = [];
  let bandTriangleCount = 0;
  let interiorTriangleCount = 0;
  let rejectedDegenerateTriangleCount = 0;
  let rejectedLongBoundaryToInteriorTriangleCount = 0;
  let rejectedLongInteriorTriangleCount = 0;
  let rejectedOutsideInteriorTriangleCount = 0;

  pixelPoints.forEach((point, pointIndex) => {
    const uv = {
      x: roundCoordinate(point.x / input.width),
      y: roundCoordinate(point.y / input.height)
    };
    vertices.push({
      x: roundCoordinate(input.input.bounds.x + input.input.bounds.width * uv.x),
      y: roundCoordinate(input.input.bounds.y + input.input.bounds.height * uv.y)
    });
    uvs.push(uv);
    vertexStableIds.push(`vtx_${token}_outline_v4_contour_band_${stableKind(point.kind)}_${point.order}_${pointIndex}`);
  });

  const addBandTriangle = (triangle: [number, number, number], stableId: TriangleId) => {
    const oriented = orientTriangle(pixelPoints, {
      a: triangle[0],
      b: triangle[1],
      c: triangle[2]
    });
    const candidate: [number, number, number] = [oriented.a, oriented.b, oriented.c];
    if (Math.abs(signedTriangleArea(pixelPoints, oriented)) <= 0.000001) {
      rejectedDegenerateTriangleCount += 1;
      return;
    }

    triangles.push(candidate);
    triangleStableIds.push(stableId);
    bandTriangleCount += 1;
  };

  const segmentCount = Math.min(input.outerPoints.length, input.innerPoints.length);
  for (let pointIndex = 0; pointIndex < segmentCount; pointIndex += 1) {
    const nextIndex = (pointIndex + 1) % segmentCount;
    const innerA = innerStart + pointIndex;
    const innerB = innerStart + nextIndex;
    const outerA = outerStart + pointIndex;
    const outerB = outerStart + nextIndex;

    addBandTriangle(
      [innerA, innerB, outerA],
      `tri_${token}_outline_v4_contour_band_strip_${pointIndex}_a` as TriangleId
    );
    addBandTriangle(
      [innerB, outerB, outerA],
      `tri_${token}_outline_v4_contour_band_strip_${pointIndex}_b` as TriangleId
    );
  }

  const interiorDelaunayPoints = [
    ...input.innerPoints,
    ...input.interiorPoints
  ];
  const interiorTriangles = triangulate(interiorDelaunayPoints)
    .map((triangle) => orientTriangle(interiorDelaunayPoints, triangle))
    .sort(compareTriangles);

  for (const triangle of interiorTriangles) {
    const classification = classifyInteriorTriangle({
      points: interiorDelaunayPoints,
      triangle,
      mask: input.mask,
      width: input.width,
      height: input.height,
      innerContour: input.innerContour,
      config: input.config
    });
    if (classification === "degenerate") {
      rejectedDegenerateTriangleCount += 1;
      continue;
    }
    if (classification === "outside") {
      rejectedOutsideInteriorTriangleCount += 1;
      continue;
    }
    if (classification === "long-boundary-to-interior") {
      rejectedLongBoundaryToInteriorTriangleCount += 1;
      continue;
    }
    if (classification === "long-interior") {
      rejectedLongInteriorTriangleCount += 1;
      continue;
    }

    const mapped = mapInteriorTriangle(triangle, innerStart, interiorStart, input.innerPoints.length);
    triangles.push(mapped);
    triangleStableIds.push(`tri_${token}_outline_v4_contour_band_interior_${interiorTriangleCount}` as TriangleId);
    interiorTriangleCount += 1;
  }

  return {
    mesh: {
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
    },
    pixelPoints,
    bandTriangleCount,
    interiorTriangleCount,
    rejectedDegenerateTriangleCount,
    rejectedLongBoundaryToInteriorTriangleCount,
    rejectedLongInteriorTriangleCount,
    rejectedOutsideInteriorTriangleCount
  };
};

const createContourBandMetrics = (input: {
  readonly config: V4Config;
  readonly alphaArea: number;
  readonly selectedContourVertexCount: number;
  readonly simplifiedContourVertexCount: number;
  readonly rings: ContourBandRings;
  readonly interiorPointCount: number;
  readonly build: ContourBandBuild;
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
}): MeshGenerationContourBandMetrics => {
  const maxBoundaryToInteriorEdgeLength = maxBoundaryToInteriorEdgeLengthForMesh(input.build.pixelPoints, input.build.mesh);
  const maxVertexValence = maxVertexValenceForMesh(input.build.mesh);
  const transparentOnlyTriangleRatio = transparentOnlyTriangleRatioForMesh({
    points: input.build.pixelPoints,
    triangles: input.build.mesh.triangles,
    mask: input.mask,
    width: input.width,
    height: input.height
  });

  return {
    algorithmId: "auto-outline-v4-contour-band",
    preset: input.config.preset,
    targetEdgeLength: roundMetric(input.config.targetEdgeLength),
    contourSampleSpacing: roundMetric(input.config.contourSampleSpacing),
    outerOffset: roundMetric(input.rings.outerOffset),
    innerOffset: roundMetric(input.rings.innerOffset),
    alphaArea: input.alphaArea,
    outerContourArea: roundMetric(input.rings.outerContourArea),
    outerContourAreaRatio: roundMetric(input.rings.outerContourAreaRatio),
    selectedContourVertexCount: input.selectedContourVertexCount,
    simplifiedContourVertexCount: input.simplifiedContourVertexCount,
    contourPointCount: input.rings.innerContour.length,
    outerContourPointCount: input.rings.outerContour.length,
    contourBandTriangleCount: input.build.bandTriangleCount,
    interiorPointCount: input.interiorPointCount,
    interiorTriangleCount: input.build.interiorTriangleCount,
    maxBoundaryToInteriorEdgeLength: roundMetric(maxBoundaryToInteriorEdgeLength),
    maxVertexValence,
    transparentOnlyTriangleRatio: roundMetric(transparentOnlyTriangleRatio),
    vertexCount: input.build.mesh.vertices.length,
    triangleCount: input.build.mesh.triangles.length,
    maxVertexCountCap: input.config.maxVertexCountCap,
    rejectedDegenerateTriangleCount: input.build.rejectedDegenerateTriangleCount,
    rejectedLongBoundaryToInteriorTriangleCount: input.build.rejectedLongBoundaryToInteriorTriangleCount,
    rejectedLongInteriorTriangleCount: input.build.rejectedLongInteriorTriangleCount,
    rejectedOutsideInteriorTriangleCount: input.build.rejectedOutsideInteriorTriangleCount,
    provenance: [
      "rgba-alpha-threshold",
      "largest-alpha-contour",
      "curvature-aware-contour-resampling",
      "centroid-normal-contour-band-offset",
      "explicit-inner-outer-contour-strip",
      "deterministic-jittered-interior-fill",
      "ordinary-delaunay-contour-band-filter",
      "boundary-to-interior-edge-cap",
      "transparent-only-triangle-ratio-cap",
      "constrained-triangulation-deferred"
    ]
  };
};

const classifyInteriorTriangle = (input: {
  readonly points: readonly ContourBandPoint[];
  readonly triangle: DelaunayTriangle;
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly innerContour: readonly PixelPoint[];
  readonly config: V4Config;
}): "accepted" | "degenerate" | "outside" | "long-boundary-to-interior" | "long-interior" => {
  if (Math.abs(signedTriangleArea(input.points, input.triangle)) <= 0.000001) {
    return "degenerate";
  }

  const a = input.points[input.triangle.a]!;
  const b = input.points[input.triangle.b]!;
  const c = input.points[input.triangle.c]!;
  const centroid = triangleCentroid(input.points, input.triangle);
  const samples = [
    centroid,
    midpoint(a, b),
    midpoint(b, c),
    midpoint(c, a)
  ];
  if (
    samples.some((sample) => !isPointInsidePolygon(sample, input.innerContour)) ||
    !samples.some((sample) => isPointInsideAlpha(input.mask, input.width, input.height, sample))
  ) {
    return "outside";
  }

  const maxBoundaryInteriorEdge = maxBoundaryToInteriorEdgeLengthForTriangle(input.points, input.triangle);
  if (maxBoundaryInteriorEdge > input.config.maxBoundaryToInteriorEdgeLength) {
    return "long-boundary-to-interior";
  }

  if (maxTriangleEdgeLength(input.points, input.triangle) > input.config.maxInteriorEdgeLength) {
    return "long-interior";
  }

  return "accepted";
};

const mapInteriorTriangle = (
  triangle: DelaunayTriangle,
  innerStart: number,
  interiorStart: number,
  innerPointCount: number
): [number, number, number] => {
  const mapIndex = (index: number): number =>
    index < innerPointCount ? innerStart + index : interiorStart + index - innerPointCount;
  return [mapIndex(triangle.a), mapIndex(triangle.b), mapIndex(triangle.c)];
};

const triangulate = (points: readonly ContourBandPoint[]): readonly DelaunayTriangle[] => {
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

const maxBoundaryToInteriorEdgeLengthForMesh = (
  points: readonly ContourBandPoint[],
  mesh: MeshDto
): number => {
  let result = 0;
  for (const triangle of mesh.triangles) {
    result = Math.max(
      result,
      maxBoundaryToInteriorEdgeLengthForTriangle(points, {
        a: triangle[0],
        b: triangle[1],
        c: triangle[2]
      })
    );
  }

  return result;
};

const maxBoundaryToInteriorEdgeLengthForTriangle = (
  points: readonly ContourBandPoint[],
  triangle: DelaunayTriangle
): number => {
  let result = 0;
  for (const [leftIndex, rightIndex] of [
    [triangle.a, triangle.b],
    [triangle.b, triangle.c],
    [triangle.c, triangle.a]
  ] as const) {
    const left = points[leftIndex]!;
    const right = points[rightIndex]!;
    if (
      (left.kind !== "interior" && right.kind === "interior") ||
      (left.kind === "interior" && right.kind !== "interior")
    ) {
      result = Math.max(result, distance(left, right));
    }
  }

  return result;
};

const maxVertexValenceForMesh = (mesh: MeshDto): number => {
  const neighborsByVertex = new Map<number, Set<number>>();
  const addNeighbor = (vertexIndex: number, neighborIndex: number) => {
    const neighbors = neighborsByVertex.get(vertexIndex);
    if (neighbors === undefined) {
      neighborsByVertex.set(vertexIndex, new Set([neighborIndex]));
      return;
    }

    neighbors.add(neighborIndex);
  };

  for (const triangle of mesh.triangles) {
    const [a, b, c] = triangle;
    addNeighbor(a, b);
    addNeighbor(a, c);
    addNeighbor(b, a);
    addNeighbor(b, c);
    addNeighbor(c, a);
    addNeighbor(c, b);
  }

  return neighborsByVertex.size === 0
    ? 0
    : Math.max(...[...neighborsByVertex.values()].map((neighbors) => neighbors.size));
};

const transparentOnlyTriangleRatioForMesh = (input: {
  readonly points: readonly ContourBandPoint[];
  readonly triangles: MeshDto["triangles"];
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
}): number => {
  if (input.triangles.length === 0) {
    return 0;
  }

  let transparentOnlyTriangleCount = 0;
  for (const triangle of input.triangles) {
    const a = input.points[triangle[0]]!;
    const b = input.points[triangle[1]]!;
    const c = input.points[triangle[2]]!;
    const centroid = {
      x: (a.x + b.x + c.x) / 3,
      y: (a.y + b.y + c.y) / 3
    };
    const samples = [
      a,
      b,
      c,
      centroid,
      midpoint(a, b),
      midpoint(b, c),
      midpoint(c, a)
    ];
    if (samples.every((sample) => !isPointInsideAlpha(input.mask, input.width, input.height, sample))) {
      transparentOnlyTriangleCount += 1;
    }
  }

  return transparentOnlyTriangleCount / input.triangles.length;
};

const maxTriangleEdgeLength = (
  points: readonly PixelPoint[],
  triangle: DelaunayTriangle
): number => {
  const a = points[triangle.a]!;
  const b = points[triangle.b]!;
  const c = points[triangle.c]!;
  return Math.max(distance(a, b), distance(b, c), distance(c, a));
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

const isPointInsidePolygon = (
  point: PixelPoint,
  polygon: readonly PixelPoint[]
): boolean => {
  if (polygon.length < 3) {
    return false;
  }

  for (let index = 0; index < polygon.length; index += 1) {
    if (isPointOnSegment(point, polygon[index]!, polygon[(index + 1) % polygon.length]!)) {
      return true;
    }
  }

  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const a = polygon[index]!;
    const b = polygon[previousIndex]!;
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
  if (Math.abs(cross(start, end, point)) > 0.000001) {
    return false;
  }

  return (
    point.x >= Math.min(start.x, end.x) - 0.000001 &&
    point.x <= Math.max(start.x, end.x) + 0.000001 &&
    point.y >= Math.min(start.y, end.y) - 0.000001 &&
    point.y <= Math.max(start.y, end.y) + 0.000001
  );
};

const hasSelfIntersections = (points: readonly PixelPoint[]): boolean => {
  if (points.length < 4) {
    return false;
  }

  for (let leftIndex = 0; leftIndex < points.length; leftIndex += 1) {
    const leftStart = points[leftIndex]!;
    const leftEnd = points[(leftIndex + 1) % points.length]!;
    for (let rightIndex = leftIndex + 1; rightIndex < points.length; rightIndex += 1) {
      if (
        rightIndex === leftIndex ||
        rightIndex === (leftIndex + 1) % points.length ||
        leftIndex === (rightIndex + 1) % points.length
      ) {
        continue;
      }

      const rightStart = points[rightIndex]!;
      const rightEnd = points[(rightIndex + 1) % points.length]!;
      if (segmentsIntersect(leftStart, leftEnd, rightStart, rightEnd)) {
        return true;
      }
    }
  }

  return false;
};

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
    Math.abs(abC) <= 0.000001 ||
    Math.abs(abD) <= 0.000001 ||
    Math.abs(cdA) <= 0.000001 ||
    Math.abs(cdB) <= 0.000001
  ) {
    return false;
  }

  return (abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0);
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

const compareContourBandPoints = (
  left: ContourBandPoint,
  right: ContourBandPoint
): number =>
  left.kind.localeCompare(right.kind) ||
  left.order - right.order ||
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
    const pointCross = point.x * next.y - next.x * point.y;
    x += (point.x + next.x) * pointCross;
    y += (point.y + next.y) * pointCross;
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

  const pointCross = ax * by - ay * bx;
  const dot = ax * bx + ay * by;
  return clamp(Math.abs(Math.atan2(pointCross, dot)) / Math.PI, 0, 1);
};

const capVerticesByCurvature = (
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

const deterministicJitter = (
  seed: number,
  row: number,
  column: number,
  spacing: number
): PixelPoint => {
  const xUnit = hashUnit(seed, row, column, 0);
  const yUnit = hashUnit(seed, row, column, 1);
  const amplitude = spacing * 0.22;
  return {
    x: (xUnit - 0.5) * amplitude,
    y: (yUnit - 0.5) * amplitude
  };
};

const createSamplerSeed = (
  input: AutoOutlineV4ContourBandMeshInput,
  width: number,
  height: number
): number =>
  hashString(
    `v4-contour-band:${input.drawableId}:${width}x${height}:${input.densityHint ?? "low"}:${input.alphaThreshold ?? 8}`
  );

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

const cross = (a: PixelPoint, b: PixelPoint, c: PixelPoint): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

const triangleKey = (triangle: DelaunayTriangle): string =>
  `${triangle.a}:${triangle.b}:${triangle.c}`;

const edgeKey = (a: number, b: number): string =>
  a < b ? `${a}:${b}` : `${b}:${a}`;

const pointKey = (point: PixelPoint): string => `${point.x}:${point.y}`;

const pointsEqual = (left: PixelPoint, right: PixelPoint): boolean =>
  left.x === right.x && left.y === right.y;

const squaredDistance = (left: PixelPoint, right: PixelPoint): number =>
  (left.x - right.x) ** 2 + (left.y - right.y) ** 2;

const distance = (left: PixelPoint, right: PixelPoint): number =>
  Math.hypot(left.x - right.x, left.y - right.y);

const midpoint = (left: PixelPoint, right: PixelPoint): PixelPoint => ({
  x: (left.x + right.x) / 2,
  y: (left.y + right.y) / 2
});

const offsetPointFromCentroid = (
  point: PixelPoint,
  centroid: PixelPoint,
  offset: number,
  width: number,
  height: number
): PixelPoint => {
  const dx = point.x - centroid.x;
  const dy = point.y - centroid.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.000001) {
    return {
      x: roundCoordinate(clamp(point.x, 0, width)),
      y: roundCoordinate(clamp(point.y, 0, height))
    };
  }

  return {
    x: roundCoordinate(clamp(point.x + (dx / length) * offset, 0, width)),
    y: roundCoordinate(clamp(point.y + (dy / length) * offset, 0, height))
  };
};

const stableKind = (kind: ContourBandPoint["kind"]): string =>
  kind.replace(/-/g, "_");

const stripIdPrefix = (id: string, prefix: string): string =>
  id.startsWith(prefix) ? id.slice(prefix.length) : id;

const roundCoordinate = (value: number): number => {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const roundMetric = (value: number): number => roundCoordinate(value);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Math.trunc(value), min), max);
