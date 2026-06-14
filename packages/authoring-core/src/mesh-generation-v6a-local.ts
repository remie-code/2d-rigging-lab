import type { DrawableId, MeshId, ProvenanceId, RectDto, TriangleId } from "@private-2d-rigging-lab/contracts";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";

import {
  getV6MeshGenerationCandidate,
  type MeshDensityHint
} from "./mesh-generation-contract.js";
import {
  computeMeshQualityMetrics,
  type MeshGenerationQualityMetrics
} from "./mesh-quality-metrics.js";

export interface AutoOutlineV6ALocalMeshInput {
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

export type AutoOutlineV6ALocalMeshResult =
  | {
      readonly status: "generated";
      readonly mesh: MeshDto;
      readonly alphaBounds: RectDto;
      readonly qualityMetrics: MeshGenerationQualityMetrics;
    }
  | {
      readonly status: "blocked";
      readonly reason: "alpha-empty" | "v6a-local-generation-failed";
      readonly opaquePixelCount?: number;
      readonly alphaBounds?: RectDto;
    };

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

interface TriangulationResult {
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly removedTriangleCount: number;
  readonly outsideOrCrossingTriangleCount: number;
}

const DEFAULT_ALPHA_THRESHOLD = 8;
const SOFT_ALPHA_THRESHOLD = 0.18;
const TRIANGLE_AREA_EPSILON = 0.000001;

export const createAutoOutlineV6ALocalMesh = (
  input: AutoOutlineV6ALocalMeshInput
): AutoOutlineV6ALocalMeshResult => {
  const width = Math.round(input.textureSize.width);
  const height = Math.round(input.textureSize.height);
  if (width <= 0 || height <= 0 || input.rgbaBytes.byteLength !== width * height * 4) {
    return { status: "blocked", reason: "v6a-local-generation-failed" };
  }

  const mask = createSoftAlphaMask(input.rgbaBytes, width, height, input.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD);
  if (mask.opaquePixelCount === 0) {
    return { status: "blocked", reason: "alpha-empty", opaquePixelCount: 0 };
  }

  const components = findOpaqueComponents(mask.mask, width, height);
  const mainComponent = selectMainComponent(components);
  if (mainComponent === undefined) {
    return {
      status: "blocked",
      reason: "alpha-empty",
      opaquePixelCount: mask.opaquePixelCount
    };
  }

  const mainMask = createComponentMask(mainComponent, width, height);
  const boundaryLoops = traceBoundaryLoops(mainMask, width, height);
  const outerLoop = selectOuterLoop(boundaryLoops);
  if (outerLoop === undefined || outerLoop.length < 3) {
    return {
      status: "blocked",
      reason: "v6a-local-generation-failed",
      opaquePixelCount: mask.opaquePixelCount,
      alphaBounds: pixelBoundsToStageRect(mainComponent.bounds, input.bounds, width, height)
    };
  }

  const density = input.densityHint ?? "medium";
  const densityParameters = getDensityParameters(density);
  const boundaryPoints = sampleBoundaryLoop(outerLoop, densityParameters);
  if (boundaryPoints.length < 3) {
    return {
      status: "blocked",
      reason: "v6a-local-generation-failed",
      opaquePixelCount: mask.opaquePixelCount,
      alphaBounds: pixelBoundsToStageRect(mainComponent.bounds, input.bounds, width, height)
    };
  }

  const interiorPoints = sampleInteriorPoints({
    mainMask,
    width,
    height,
    component: mainComponent,
    boundaryPoints,
    densityParameters
  });
  const triangulation = triangulateV6ALocalMesh({
    boundaryPoints,
    interiorPoints,
    mainMask,
    width,
    height
  });
  if (triangulation.triangles.length === 0) {
    return {
      status: "blocked",
      reason: "v6a-local-generation-failed",
      opaquePixelCount: mask.opaquePixelCount,
      alphaBounds: pixelBoundsToStageRect(mainComponent.bounds, input.bounds, width, height)
    };
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
        ? `vtx_${token}_v6a_boundary_${index}`
        : `vtx_${token}_v6a_interior_${index - boundaryPoints.length}`
    ),
    triangleStableIds: triangulation.triangles.map(
      (_triangle, index) => `tri_${token}_v6a_${index}` as TriangleId
    ),
    topologyRevision: 0,
    bounds: structuredClone(input.bounds),
    generationProvenanceId: input.provenanceId
  };

  const candidate = getV6MeshGenerationCandidate("auto-outline-v6a-local");
  const holeLikeRegionCount = countHoleLikeRegions(mainMask, width, height, mainComponent.bounds);
  const qualityMetrics = computeMeshQualityMetrics(mesh, {
    refinementIterationCount: 0,
    triangulationMode: "v6a-local-earclip-steiner-approximation",
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
      multiIslandHandling: components.length > 1 ? "main-island-only" : "supported",
      holeHandling: holeLikeRegionCount > 0 ? "unsupported-fallback" : "supported",
      provenance: createV6ALocalProvenance({
        componentCount: components.length,
        holeLikeRegionCount
      })
    }
  });

  return {
    status: "generated",
    mesh,
    alphaBounds: pixelBoundsToStageRect(mainComponent.bounds, input.bounds, width, height),
    qualityMetrics
  };
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

  return dedupeOrderedPoints(
    samples
      .sort((left, right) => left.distance - right.distance || comparePoint(left.point, right.point))
      .map((sample) => sample.point)
  );
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
    if (!isPointInsideMask(input.mainMask, input.width, input.height, point)) {
      return;
    }

    if (requireClearance) {
      const boundaryDistance = distanceToClosedPolyline(point, input.boundaryPoints);
      if (boundaryDistance < input.densityParameters.interiorBoundaryClearance) {
        return;
      }
    }

    const key = pointKey(point);
    if (usedKeys.has(key) || points.length >= input.densityParameters.maxInteriorVertices) {
      return;
    }

    usedKeys.add(key);
    points.push(roundPixelPoint(point));
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

const triangulateV6ALocalMesh = (input: {
  readonly boundaryPoints: readonly PixelPoint[];
  readonly interiorPoints: readonly PixelPoint[];
  readonly mainMask: readonly boolean[];
  readonly width: number;
  readonly height: number;
}): TriangulationResult => {
  const allPoints = [...input.boundaryPoints, ...input.interiorPoints];
  const boundaryTriangles = earClipPolygon(input.boundaryPoints);
  const seedTriangles =
    boundaryTriangles.length > 0
      ? boundaryTriangles
      : triangulateBoundaryFan(input.boundaryPoints);
  const splitTriangles = splitTrianglesWithInteriorPoints(seedTriangles, allPoints, input.boundaryPoints.length);
  const filteredTriangles: [number, number, number][] = [];
  let removedTriangleCount = 0;
  let outsideOrCrossingTriangleCount = 0;

  for (const triangle of splitTriangles) {
    if (hasDuplicateTriangleIndex(triangle) || Math.abs(triangleAreaByIndex(allPoints, triangle)) <= TRIANGLE_AREA_EPSILON) {
      removedTriangleCount += 1;
      continue;
    }

    if (!isTriangleAcceptedByMask(allPoints, triangle, input.mainMask, input.width, input.height)) {
      removedTriangleCount += 1;
      outsideOrCrossingTriangleCount += 1;
      continue;
    }

    filteredTriangles.push(triangle);
  }

  return {
    triangles: filteredTriangles,
    removedTriangleCount,
    outsideOrCrossingTriangleCount
  };
};

const earClipPolygon = (
  boundaryPoints: readonly PixelPoint[]
): readonly [number, number, number][] => {
  if (boundaryPoints.length < 3) {
    return [];
  }

  const orientation = polygonSignedArea(boundaryPoints) >= 0 ? 1 : -1;
  const remaining = boundaryPoints.map((_point, index) => index);
  const triangles: [number, number, number][] = [];
  let guard = 0;

  while (remaining.length > 3 && guard < boundaryPoints.length * boundaryPoints.length) {
    guard += 1;
    let clipped = false;

    for (let index = 0; index < remaining.length; index += 1) {
      const previousIndex = mustGet(remaining, (index - 1 + remaining.length) % remaining.length);
      const currentIndex = mustGet(remaining, index);
      const nextIndex = mustGet(remaining, (index + 1) % remaining.length);
      const previous = mustGet(boundaryPoints, previousIndex);
      const current = mustGet(boundaryPoints, currentIndex);
      const next = mustGet(boundaryPoints, nextIndex);

      if (orientation * cross(previous, current, next) <= TRIANGLE_AREA_EPSILON) {
        continue;
      }

      const containsOtherVertex = remaining.some((candidateIndex) => {
        if (candidateIndex === previousIndex || candidateIndex === currentIndex || candidateIndex === nextIndex) {
          return false;
        }

        return pointInTriangle(
          mustGet(boundaryPoints, candidateIndex),
          previous,
          current,
          next,
          true
        );
      });
      if (containsOtherVertex) {
        continue;
      }

      triangles.push([previousIndex, currentIndex, nextIndex]);
      remaining.splice(index, 1);
      clipped = true;
      break;
    }

    if (!clipped) {
      break;
    }
  }

  if (remaining.length === 3) {
    triangles.push([mustGet(remaining, 0), mustGet(remaining, 1), mustGet(remaining, 2)]);
  }

  return triangles;
};

const triangulateBoundaryFan = (
  boundaryPoints: readonly PixelPoint[]
): readonly [number, number, number][] => {
  const triangles: [number, number, number][] = [];
  for (let index = 1; index < boundaryPoints.length - 1; index += 1) {
    triangles.push([0, index, index + 1]);
  }

  return triangles;
};

const splitTrianglesWithInteriorPoints = (
  seedTriangles: readonly (readonly [number, number, number])[],
  allPoints: readonly PixelPoint[],
  firstInteriorIndex: number
): readonly [number, number, number][] => {
  const triangles = seedTriangles.map((triangle) => [...triangle] as [number, number, number]);

  for (let pointIndex = firstInteriorIndex; pointIndex < allPoints.length; pointIndex += 1) {
    const point = mustGet(allPoints, pointIndex);
    const containingTriangleIndex = triangles.findIndex((triangle) => {
      const a = mustGet(allPoints, triangle[0]);
      const b = mustGet(allPoints, triangle[1]);
      const c = mustGet(allPoints, triangle[2]);
      return pointInTriangle(point, a, b, c, false);
    });
    if (containingTriangleIndex < 0) {
      continue;
    }

    const [a, b, c] = mustGet(triangles, containingTriangleIndex);
    triangles.splice(
      containingTriangleIndex,
      1,
      [a, b, pointIndex],
      [b, c, pointIndex],
      [c, a, pointIndex]
    );
  }

  return triangles;
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

const createV6ALocalProvenance = (input: {
  readonly componentCount: number;
  readonly holeLikeRegionCount: number;
}): readonly string[] => [
  "v6a-local-soft-alpha-mask",
  "v6a-local-main-island-boundary",
  "v6a-local-adaptive-boundary-sampling",
  "v6a-local-deterministic-interior-sampling",
  "v6a-local-earclip-steiner-approximation",
  "limitation-not-full-constrained-delaunay",
  ...(input.componentCount > 1 ? ["limitation-main-island-only"] : []),
  ...(input.holeLikeRegionCount > 0 ? ["limitation-hole-regions-reported"] : [])
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

const pointInTriangle = (
  point: PixelPoint,
  a: PixelPoint,
  b: PixelPoint,
  c: PixelPoint,
  includeEdges: boolean
): boolean => {
  const area = triangleArea(a, b, c);
  if (Math.abs(area) <= TRIANGLE_AREA_EPSILON) {
    return false;
  }

  const a1 = triangleArea(point, b, c);
  const a2 = triangleArea(a, point, c);
  const a3 = triangleArea(a, b, point);
  const delta = Math.abs(Math.abs(area) - (Math.abs(a1) + Math.abs(a2) + Math.abs(a3)));
  if (delta > 0.0001) {
    return false;
  }

  if (includeEdges) {
    return true;
  }

  return Math.abs(a1) > TRIANGLE_AREA_EPSILON &&
    Math.abs(a2) > TRIANGLE_AREA_EPSILON &&
    Math.abs(a3) > TRIANGLE_AREA_EPSILON;
};

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
    throw new Error(`v6a local mesh generation internal index out of range: ${index}`);
  }

  return item;
};
