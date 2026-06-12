import type { DrawableId, MeshId, ProvenanceId, RectDto, TriangleId } from "@private-2d-rigging-lab/contracts";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";

import type { MeshDensityHint } from "./mesh-generation.js";
import type { AutoOutlineFailureReason } from "./mesh-outline-generation.js";
import {
  computeMeshQualityMetrics,
  type MeshGenerationQualityMetrics,
  type MeshGenerationSoftBoundaryMetrics
} from "./mesh-quality-metrics.js";

export interface AutoOutlineV25SoftBoundaryMeshInput {
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

export type AutoOutlineV25SoftBoundaryFailureReason =
  | AutoOutlineFailureReason
  | "soft-boundary-generation-failed"
  | "soft-boundary-area-too-large"
  | "soft-boundary-filter-rejected-all";

export type AutoOutlineV25SoftBoundaryMeshResult =
  | {
      readonly status: "generated";
      readonly mesh: MeshDto;
      readonly alphaBounds: RectDto;
      readonly contourLoopCount: number;
      readonly softBoundaryMetrics: MeshGenerationSoftBoundaryMetrics;
      readonly qualityMetrics: MeshGenerationQualityMetrics;
    }
  | {
      readonly status: "failed";
      readonly reason: AutoOutlineV25SoftBoundaryFailureReason;
      readonly alphaBounds?: RectDto;
      readonly contourLoopCount?: number;
      readonly fallbackMetrics?: MeshGenerationSoftBoundaryMetrics;
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

interface SoftBoundaryPoint extends PixelPoint {
  readonly kind: "boundary" | "interior";
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

interface V25Config {
  readonly minSoftBoundaryAlphaArea: number;
  readonly simplificationSpacing: number;
  readonly simplificationCurvatureKeep: number;
  readonly simplifiedContourVertexCap: number;
  readonly softBoundaryPadding: number;
  readonly transparentAllowance: number;
  readonly boundarySpacing: number;
  readonly boundaryVertexCap: number;
  readonly interiorSpacing: number;
  readonly sampleMinDistance: number;
  readonly maxSoftBoundaryAreaRatio: number;
}

interface SoftBoundaryResult {
  readonly boundary: readonly PixelPoint[];
  readonly padding: number;
  readonly area: number;
  readonly areaRatio: number;
}

interface FilteredTriangleResult {
  readonly triangles: readonly DelaunayTriangle[];
  readonly transparentSampleCount: number;
  readonly outsideTriangleSampleCount: number;
  readonly farTransparentSampleCount: number;
  readonly rejectedOutsideSoftBoundaryTriangleCount: number;
  readonly rejectedFarTransparentTriangleCount: number;
}

export const createAutoOutlineV25SoftBoundaryMesh = (
  input: AutoOutlineV25SoftBoundaryMeshInput
): AutoOutlineV25SoftBoundaryMeshResult => {
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
  const config = createV25Config(alpha.bounds, densityHint);
  if (alpha.area < config.minSoftBoundaryAlphaArea) {
    return {
      status: "failed",
      reason: "soft-boundary-generation-failed",
      alphaBounds
    };
  }

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
  const simplifiedContour = simplifyContourLoop(selectedContour, config);
  if (simplifiedContour.length < 3) {
    return {
      status: "failed",
      reason: "soft-boundary-generation-failed",
      alphaBounds,
      contourLoopCount: contourLoops.length
    };
  }

  const softBoundary = createSoftBoundary({
    contour: simplifiedContour,
    config,
    alphaArea: alpha.area,
    width,
    height
  });
  if (softBoundary === undefined) {
    return {
      status: "failed",
      reason: "soft-boundary-area-too-large",
      alphaBounds,
      contourLoopCount: contourLoops.length
    };
  }

  const boundaryPoints = softBoundary.boundary.map(
    (point): SoftBoundaryPoint => ({ ...point, kind: "boundary" })
  );
  const interiorPoints = sampleSoftBoundaryInteriorPoints({
    mask: alpha.mask,
    width,
    height,
    bounds: alpha.bounds,
    softBoundary: softBoundary.boundary,
    config,
    seed: createSamplerSeed(input, width, height),
    blockedPoints: boundaryPoints
  });
  const points = dedupeSoftBoundaryPoints([
    ...boundaryPoints,
    ...interiorPoints
  ]);

  if (points.length < 3) {
    return {
      status: "failed",
      reason: "triangulation-failed",
      alphaBounds,
      contourLoopCount: contourLoops.length
    };
  }

  const filteredTriangles = createSoftBoundaryFilteredTriangles({
    points,
    mask: alpha.mask,
    width,
    height,
    softBoundary: softBoundary.boundary,
    transparentAllowance: config.transparentAllowance
  });
  if (filteredTriangles.triangles.length === 0) {
    return {
      status: "failed",
      reason: "soft-boundary-filter-rejected-all",
      alphaBounds,
      contourLoopCount: contourLoops.length
    };
  }

  const mesh = createMeshDto({
    input,
    width,
    height,
    points,
    triangles: filteredTriangles.triangles
  });
  const softBoundaryMetrics: MeshGenerationSoftBoundaryMetrics = {
    algorithmId: "auto-outline-v2.5-soft-boundary",
    preset: densityHint,
    padding: roundMetric(softBoundary.padding),
    transparentAllowance: roundMetric(config.transparentAllowance),
    alphaArea: alpha.area,
    softBoundaryArea: roundMetric(softBoundary.area),
    softBoundaryAreaRatio: roundMetric(softBoundary.areaRatio),
    selectedContourVertexCount: selectedContour.length,
    simplifiedContourVertexCount: simplifiedContour.length,
    softBoundaryVertexCount: boundaryPoints.length,
    interiorPointCount: interiorPoints.length,
    transparentSampleCount: filteredTriangles.transparentSampleCount,
    outsideTriangleSampleCount: filteredTriangles.outsideTriangleSampleCount,
    farTransparentSampleCount: filteredTriangles.farTransparentSampleCount,
    rejectedOutsideSoftBoundaryTriangleCount: filteredTriangles.rejectedOutsideSoftBoundaryTriangleCount,
    rejectedFarTransparentTriangleCount: filteredTriangles.rejectedFarTransparentTriangleCount,
    provenance: [
      "rgba-alpha-threshold",
      "largest-alpha-contour",
      "distance-curvature-simplification",
      "ratio-based-centroid-soft-boundary",
      "sparse-alpha-interior-sampling",
      "ordinary-delaunay-soft-boundary-filter",
      "transparent-near-boundary-allowance",
      "constrained-triangulation-deferred"
    ]
  };
  const qualityMetrics = computeMeshQualityMetrics(mesh, {
    refinementIterationCount: 0,
    triangulationMode: "interim-delaunay-soft-boundary-filter",
    softBoundaryMetrics
  });

  return {
    status: "generated",
    mesh,
    alphaBounds,
    contourLoopCount: contourLoops.length,
    softBoundaryMetrics,
    qualityMetrics
  };
};

const createV25Config = (bounds: PixelBounds, densityHint: MeshDensityHint): V25Config => {
  const width = Math.max(bounds.right - bounds.left, 1);
  const height = Math.max(bounds.bottom - bounds.top, 1);
  const maxDimension = Math.max(width, height);
  const minDimension = Math.min(width, height);
  const baseSize = Math.max(minDimension, 1);

  switch (densityHint) {
    case "high": {
      const spacing = clamp(maxDimension / 3.05, 7.5, 15);
      const padding = clamp(baseSize * 0.026, 0.9, Math.max(1.1, minDimension * 0.12));
      return {
        minSoftBoundaryAlphaArea: 14,
        simplificationSpacing: spacing * 1.06,
        simplificationCurvatureKeep: 0.31,
        simplifiedContourVertexCap: 64,
        softBoundaryPadding: padding,
        transparentAllowance: Math.max(padding + 1.2, spacing * 0.36),
        boundarySpacing: spacing * 1.1,
        boundaryVertexCap: 52,
        interiorSpacing: spacing * 1.55,
        sampleMinDistance: spacing * 0.92,
        maxSoftBoundaryAreaRatio: 1.55
      };
    }
    case "medium": {
      const spacing = clamp(maxDimension / 2.62, 8.5, 18);
      const padding = clamp(baseSize * 0.019, 0.75, Math.max(1, minDimension * 0.1));
      return {
        minSoftBoundaryAlphaArea: 14,
        simplificationSpacing: spacing * 1.14,
        simplificationCurvatureKeep: 0.35,
        simplifiedContourVertexCap: 46,
        softBoundaryPadding: padding,
        transparentAllowance: Math.max(padding + 1, spacing * 0.34),
        boundarySpacing: spacing * 1.22,
        boundaryVertexCap: 38,
        interiorSpacing: spacing * 1.9,
        sampleMinDistance: spacing * 0.98,
        maxSoftBoundaryAreaRatio: 1.45
      };
    }
    case "low":
    default: {
      const spacing = clamp(maxDimension / 2.2, 10, 22);
      const padding = clamp(baseSize * 0.012, 0.55, Math.max(0.8, minDimension * 0.08));
      return {
        minSoftBoundaryAlphaArea: 14,
        simplificationSpacing: spacing * 1.25,
        simplificationCurvatureKeep: 0.39,
        simplifiedContourVertexCap: 32,
        softBoundaryPadding: padding,
        transparentAllowance: Math.max(padding + 0.8, spacing * 0.32),
        boundarySpacing: spacing * 1.38,
        boundaryVertexCap: 26,
        interiorSpacing: spacing * 2.35,
        sampleMinDistance: spacing * 1.05,
        maxSoftBoundaryAreaRatio: 1.35
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

const simplifyContourLoop = (
  loop: readonly PixelPoint[],
  config: V25Config
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
      distanceSinceSelected >= config.simplificationSpacing ||
      (curvature >= config.simplificationCurvatureKeep &&
        distanceSinceSelected >= config.simplificationSpacing * 0.38)
    ) {
      selected.push(point);
      distanceSinceSelected = 0;
    }
  }

  const withClosingSupport =
    selected.length >= 3
      ? selected
      : [rotated[0]!, rotated[Math.floor(rotated.length / 3)]!, rotated[Math.floor((rotated.length * 2) / 3)]!];
  return capVerticesByCurvature(withClosingSupport, config.simplifiedContourVertexCap);
};

const createSoftBoundary = (input: {
  readonly contour: readonly PixelPoint[];
  readonly config: V25Config;
  readonly alphaArea: number;
  readonly width: number;
  readonly height: number;
}): SoftBoundaryResult | undefined => {
  const centroid = polygonCentroid(input.contour);
  const attempts = [1, 0.72, 0.48, 0.25] as const;

  for (const paddingFactor of attempts) {
    const padding = input.config.softBoundaryPadding * paddingFactor;
    const offset = input.contour.map((point) =>
      offsetPointFromCentroid(point, centroid, padding, input.width, input.height)
    );
    if (hasSelfIntersections(offset)) {
      continue;
    }

    const boundary = resampleSoftBoundary(offset, input.config);
    if (boundary.length < 3 || hasSelfIntersections(boundary)) {
      continue;
    }

    const area = Math.abs(polygonArea(boundary));
    const areaRatio = area / input.alphaArea;
    if (areaRatio > input.config.maxSoftBoundaryAreaRatio) {
      continue;
    }

    return {
      boundary,
      padding,
      area,
      areaRatio
    };
  }

  return undefined;
};

const offsetPointFromCentroid = (
  point: PixelPoint,
  centroid: PixelPoint,
  padding: number,
  width: number,
  height: number
): PixelPoint => {
  const dx = point.x - centroid.x;
  const dy = point.y - centroid.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.000001) {
    return {
      x: clamp(point.x, 0, width),
      y: clamp(point.y, 0, height)
    };
  }

  return {
    x: roundCoordinate(clamp(point.x + (dx / length) * padding, 0, width)),
    y: roundCoordinate(clamp(point.y + (dy / length) * padding, 0, height))
  };
};

const resampleSoftBoundary = (
  polygon: readonly PixelPoint[],
  config: V25Config
): readonly PixelPoint[] => {
  const rotated = rotatePoints(polygon, findLexicographicPointIndex(polygon));
  const points: PixelPoint[] = [];

  for (let index = 0; index < rotated.length; index += 1) {
    const start = rotated[index]!;
    const end = rotated[(index + 1) % rotated.length]!;
    const distance = Math.sqrt(squaredDistance(start, end));
    const segments = Math.max(1, Math.ceil(distance / config.boundarySpacing));
    points.push(start);

    for (let step = 1; step < segments; step += 1) {
      const ratio = step / segments;
      points.push({
        x: roundCoordinate(lerp(start.x, end.x, ratio)),
        y: roundCoordinate(lerp(start.y, end.y, ratio))
      });
    }
  }

  return capVerticesByCurvature(
    removeConsecutiveDuplicatePoints(points),
    config.boundaryVertexCap
  );
};

const sampleSoftBoundaryInteriorPoints = (input: {
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly bounds: PixelBounds;
  readonly softBoundary: readonly PixelPoint[];
  readonly config: V25Config;
  readonly seed: number;
  readonly blockedPoints: readonly SoftBoundaryPoint[];
}): readonly SoftBoundaryPoint[] => {
  const spacing = input.config.interiorSpacing;
  const rowSpacing = spacing * 0.8660254037844386;
  const points: SoftBoundaryPoint[] = [];
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
        !isPointInsidePolygon(candidate, input.softBoundary)
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
        kind: "interior"
      });
    }
    row += 1;
  }

  return points.sort(comparePoints);
};

const createSoftBoundaryFilteredTriangles = (input: {
  readonly points: readonly SoftBoundaryPoint[];
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly softBoundary: readonly PixelPoint[];
  readonly transparentAllowance: number;
}): FilteredTriangleResult => {
  let transparentSampleCount = 0;
  let outsideTriangleSampleCount = 0;
  let farTransparentSampleCount = 0;
  let rejectedOutsideSoftBoundaryTriangleCount = 0;
  let rejectedFarTransparentTriangleCount = 0;
  const triangles: DelaunayTriangle[] = [];

  for (const triangle of triangulate(input.points).map((candidate) => orientTriangle(input.points, candidate))) {
    const classification = classifyTriangleSamples({
      ...input,
      triangle
    });

    if (classification.outsideSoftBoundarySampleCount > 0) {
      rejectedOutsideSoftBoundaryTriangleCount += 1;
      continue;
    }

    if (
      classification.farTransparentSampleCount > 0 ||
      !classification.hasAlphaSample
    ) {
      rejectedFarTransparentTriangleCount += 1;
      continue;
    }

    triangles.push(triangle);
    transparentSampleCount += classification.transparentSampleCount;
    outsideTriangleSampleCount += classification.outsideSoftBoundarySampleCount;
    farTransparentSampleCount += classification.farTransparentSampleCount;
  }

  return {
    triangles: triangles.sort(compareTriangles),
    transparentSampleCount,
    outsideTriangleSampleCount,
    farTransparentSampleCount,
    rejectedOutsideSoftBoundaryTriangleCount,
    rejectedFarTransparentTriangleCount
  };
};

const classifyTriangleSamples = (input: {
  readonly points: readonly SoftBoundaryPoint[];
  readonly triangle: DelaunayTriangle;
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly softBoundary: readonly PixelPoint[];
  readonly transparentAllowance: number;
}): {
  readonly transparentSampleCount: number;
  readonly outsideSoftBoundarySampleCount: number;
  readonly farTransparentSampleCount: number;
  readonly hasAlphaSample: boolean;
} => {
  if (Math.abs(signedTriangleArea(input.points, input.triangle)) <= 0.0000001) {
    return {
      transparentSampleCount: 0,
      outsideSoftBoundarySampleCount: 1,
      farTransparentSampleCount: 0,
      hasAlphaSample: false
    };
  }

  const a = input.points[input.triangle.a]!;
  const b = input.points[input.triangle.b]!;
  const c = input.points[input.triangle.c]!;
  const centroid = triangleCentroid(input.points, input.triangle);
  const samples = [
    a,
    b,
    c,
    centroid,
    midpoint(a, b),
    midpoint(b, c),
    midpoint(c, a),
    midpoint(a, centroid),
    midpoint(b, centroid),
    midpoint(c, centroid)
  ];
  let transparentSampleCount = 0;
  let outsideSoftBoundarySampleCount = 0;
  let farTransparentSampleCount = 0;
  let hasAlphaSample = false;

  for (const sample of samples) {
    if (!isPointInsidePolygon(sample, input.softBoundary)) {
      outsideSoftBoundarySampleCount += 1;
      continue;
    }

    if (isPointInsideAlpha(input.mask, input.width, input.height, sample)) {
      hasAlphaSample = true;
      continue;
    }

    transparentSampleCount += 1;
    if (
      !isPointNearAlphaWithinDistance(
        input.mask,
        input.width,
        input.height,
        sample,
        input.transparentAllowance
      )
    ) {
      farTransparentSampleCount += 1;
    }
  }

  return {
    transparentSampleCount,
    outsideSoftBoundarySampleCount,
    farTransparentSampleCount,
    hasAlphaSample
  };
};

const triangulate = (points: readonly SoftBoundaryPoint[]): readonly DelaunayTriangle[] => {
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

const createMeshDto = (input: {
  readonly input: AutoOutlineV25SoftBoundaryMeshInput;
  readonly width: number;
  readonly height: number;
  readonly points: readonly SoftBoundaryPoint[];
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
    vertexStableIds.push(`vtx_${token}_outline_v2_5_soft_boundary_${point.kind}_${pointIndex}`);
  });

  return {
    meshId: input.input.meshId,
    drawableId: input.input.drawableId,
    vertices,
    uvs,
    triangles: input.triangles.map((triangle) => [triangle.a, triangle.b, triangle.c]),
    vertexStableIds,
    triangleStableIds: input.triangles.map(
      (_triangle, triangleIndex) => `tri_${token}_outline_v2_5_soft_boundary_${triangleIndex}` as TriangleId
    ),
    topologyRevision: 0,
    bounds: structuredClone(input.input.bounds),
    generationProvenanceId: input.input.provenanceId
  };
};

const createSamplerSeed = (
  input: AutoOutlineV25SoftBoundaryMeshInput,
  width: number,
  height: number
): number =>
  hashString(
    `v2-5-soft-boundary:${input.drawableId}:${width}x${height}:${input.densityHint ?? "low"}:${input.alphaThreshold ?? 8}`
  );

const deterministicJitter = (
  seed: number,
  row: number,
  column: number,
  spacing: number
): PixelPoint => {
  const xUnit = hashUnit(seed, row, column, 0);
  const yUnit = hashUnit(seed, row, column, 1);
  const amplitude = spacing * 0.2;
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

const dedupeSoftBoundaryPoints = (points: readonly SoftBoundaryPoint[]): readonly SoftBoundaryPoint[] => {
  const result: SoftBoundaryPoint[] = [];
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

const isPointNearAlphaWithinDistance = (
  mask: Uint8Array,
  width: number,
  height: number,
  point: PixelPoint,
  distance: number
): boolean => {
  const centerX = Math.floor(point.x);
  const centerY = Math.floor(point.y);
  const radius = Math.max(1, Math.ceil(distance));
  const maxDistanceSquared = distance * distance;

  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if (!isMaskFilled(mask, width, height, x, y)) {
        continue;
      }

      const sampleCenter = { x: x + 0.5, y: y + 0.5 };
      if (squaredDistance(point, sampleCenter) <= maxDistanceSquared) {
        return true;
      }
    }
  }

  return false;
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
  const area = Math.abs(cross(start, end, point));
  if (area > 0.000001) {
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

const roundMetric = (value: number): number => roundCoordinate(value);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Math.trunc(value), min), max);
