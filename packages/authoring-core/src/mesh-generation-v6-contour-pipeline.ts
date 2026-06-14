import type { RectDto } from "@private-2d-rigging-lab/contracts";

import type { MeshDensityHint } from "./mesh-generation-contract.js";

export interface V6ContourPipelineInput {
  readonly textureSize: {
    readonly width: number;
    readonly height: number;
  };
  readonly meshBounds: RectDto;
  readonly rgbaBytes: Uint8Array;
  readonly densityHint?: MeshDensityHint;
  readonly densityParameters?: V6ContourDensityParameters;
  readonly alphaThreshold?: number;
  readonly maskExpansionPixels?: number;
}

export interface V6ContourPoint {
  readonly x: number;
  readonly y: number;
}

export interface V6ContourPixelBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export type V6ContourConstraintEdge = readonly [number, number];

export type V6ContourPipelineBlockedReason =
  | "alpha-empty"
  | "v6-contour-extraction-failed";

export interface V6ContourAlphaBounds {
  readonly pixelBounds: V6ContourPixelBounds;
  readonly stageBounds: RectDto;
}

export interface V6ContourPipelineDiagnostics {
  readonly inputOpaquePixelCount: number;
  readonly softMaskOpaquePixelCount: number;
  readonly componentCount: number;
  readonly selectedComponentPixelCount: number;
  readonly contourLoopCount: number;
  readonly holeLikeRegionCount: number;
  readonly boundaryPointCount: number;
  readonly constraintEdgeCount: number;
  readonly interiorPointCount: number;
  readonly boundarySpacing: number;
  readonly interiorSpacing: number;
  readonly multiIslandHandling: "main-island-only" | "supported";
  readonly holeHandling: "unsupported-fallback" | "supported";
  readonly provenance: readonly string[];
}

export interface V6ContourCandidateInput {
  readonly textureSize: {
    readonly width: number;
    readonly height: number;
  };
  readonly meshBounds: RectDto;
  readonly alphaBounds: V6ContourAlphaBounds;
  readonly mainMask: readonly boolean[];
  readonly boundaryLoop: readonly V6ContourPoint[];
  readonly boundaryPoints: readonly V6ContourPoint[];
  readonly constraintEdges: readonly V6ContourConstraintEdge[];
  readonly interiorPoints: readonly V6ContourPoint[];
  readonly diagnostics: V6ContourPipelineDiagnostics;
}

export type V6ContourPipelineResult =
  | {
      readonly status: "generated";
      readonly candidateInput: V6ContourCandidateInput;
    }
  | {
      readonly status: "blocked";
      readonly reason: V6ContourPipelineBlockedReason;
      readonly opaquePixelCount?: number;
      readonly alphaBounds?: V6ContourAlphaBounds;
      readonly diagnostics?: Partial<V6ContourPipelineDiagnostics>;
    };

interface SoftAlphaMask {
  readonly width: number;
  readonly height: number;
  readonly mask: readonly boolean[];
  readonly inputOpaquePixelCount: number;
  readonly softMaskOpaquePixelCount: number;
}

interface OpaqueComponent {
  readonly pixelIndices: readonly number[];
  readonly bounds: V6ContourPixelBounds;
}

interface BoundaryEdge {
  readonly start: V6ContourPoint;
  readonly end: V6ContourPoint;
}

export interface V6ContourDensityParameters {
  readonly boundarySpacing: number;
  readonly interiorSpacing: number;
  readonly maxBoundaryVertices: number;
  readonly maxInteriorVertices: number;
  readonly interiorBoundaryClearance: number;
}

const DEFAULT_ALPHA_THRESHOLD = 8;
const SOFT_ALPHA_THRESHOLD = 0.18;
const MAX_MASK_EXPANSION_PIXELS = 8;

export const createV6ContourCandidateInput = (
  input: V6ContourPipelineInput
): V6ContourPipelineResult => {
  const width = Math.round(input.textureSize.width);
  const height = Math.round(input.textureSize.height);
  if (width <= 0 || height <= 0 || input.rgbaBytes.byteLength !== width * height * 4) {
    return { status: "blocked", reason: "v6-contour-extraction-failed" };
  }

  const softMask = createSoftAlphaMask(
    input.rgbaBytes,
    width,
    height,
    input.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD
  );
  if (softMask.inputOpaquePixelCount === 0) {
    return {
      status: "blocked",
      reason: "alpha-empty",
      opaquePixelCount: 0,
      diagnostics: {
        inputOpaquePixelCount: 0,
        softMaskOpaquePixelCount: softMask.softMaskOpaquePixelCount
      }
    };
  }

  const components = findOpaqueComponents(softMask.mask, width, height);
  const mainComponent = selectMainComponent(components);
  if (mainComponent === undefined) {
    return {
      status: "blocked",
      reason: "alpha-empty",
      opaquePixelCount: softMask.inputOpaquePixelCount,
      diagnostics: {
        inputOpaquePixelCount: softMask.inputOpaquePixelCount,
        softMaskOpaquePixelCount: softMask.softMaskOpaquePixelCount,
        componentCount: 0
      }
    };
  }

  const componentMask = createComponentMask(mainComponent, width, height);
  const maskExpansionPixels = resolveMaskExpansionPixels(input.maskExpansionPixels);
  const mainMask =
    maskExpansionPixels <= 0
      ? componentMask
      : expandMask(componentMask, width, height, maskExpansionPixels);
  const boundaryLoops = traceBoundaryLoops(mainMask, width, height);
  const outerLoop = selectOuterLoop(boundaryLoops);
  const alphaBounds = {
    pixelBounds: mainComponent.bounds,
    stageBounds: pixelBoundsToStageRect(mainComponent.bounds, input.meshBounds, width, height)
  };
  if (outerLoop === undefined || outerLoop.length < 3) {
    return {
      status: "blocked",
      reason: "v6-contour-extraction-failed",
      opaquePixelCount: softMask.inputOpaquePixelCount,
      alphaBounds,
      diagnostics: {
        inputOpaquePixelCount: softMask.inputOpaquePixelCount,
        softMaskOpaquePixelCount: softMask.softMaskOpaquePixelCount,
        componentCount: components.length,
        selectedComponentPixelCount: mainComponent.pixelIndices.length,
        contourLoopCount: boundaryLoops.length
      }
    };
  }

  const density = input.densityHint ?? "medium";
  const densityParameters = input.densityParameters ?? getDensityParameters(density);
  const boundaryPoints = sampleBoundaryLoop(outerLoop, densityParameters);
  const constraintEdges = createConstraintEdges(boundaryPoints);
  if (boundaryPoints.length < 3 || constraintEdges.length < 3) {
    return {
      status: "blocked",
      reason: "v6-contour-extraction-failed",
      opaquePixelCount: softMask.inputOpaquePixelCount,
      alphaBounds,
      diagnostics: {
        inputOpaquePixelCount: softMask.inputOpaquePixelCount,
        softMaskOpaquePixelCount: softMask.softMaskOpaquePixelCount,
        componentCount: components.length,
        selectedComponentPixelCount: mainComponent.pixelIndices.length,
        contourLoopCount: boundaryLoops.length,
        boundaryPointCount: boundaryPoints.length,
        constraintEdgeCount: constraintEdges.length
      }
    };
  }

  const interiorPoints = sampleInteriorSteinerPoints({
    mainMask,
    width,
    component: mainComponent,
    boundaryPoints,
    densityParameters
  });
  const holeLikeRegionCount = countHoleLikeRegions(mainMask, width, height, mainComponent.bounds);
  const diagnostics: V6ContourPipelineDiagnostics = {
    inputOpaquePixelCount: softMask.inputOpaquePixelCount,
    softMaskOpaquePixelCount: softMask.softMaskOpaquePixelCount,
    componentCount: components.length,
    selectedComponentPixelCount: mainComponent.pixelIndices.length,
    contourLoopCount: boundaryLoops.length,
    holeLikeRegionCount,
    boundaryPointCount: boundaryPoints.length,
    constraintEdgeCount: constraintEdges.length,
    interiorPointCount: interiorPoints.length,
    boundarySpacing: densityParameters.boundarySpacing,
    interiorSpacing: densityParameters.interiorSpacing,
    multiIslandHandling: components.length > 1 ? "main-island-only" : "supported",
    holeHandling: holeLikeRegionCount > 0 ? "unsupported-fallback" : "supported",
    provenance: createV6ContourPipelineProvenance({
      componentCount: components.length,
      holeLikeRegionCount
    })
  };

  return {
    status: "generated",
    candidateInput: {
      textureSize: { width, height },
      meshBounds: structuredClone(input.meshBounds),
      alphaBounds,
      mainMask,
      boundaryLoop: outerLoop,
      boundaryPoints,
      constraintEdges,
      interiorPoints,
      diagnostics
    }
  };
};

export const mapV6ContourPointToStagePoint = (
  point: V6ContourPoint,
  bounds: RectDto,
  textureWidth: number,
  textureHeight: number
): V6ContourPoint => ({
  x: roundCoordinate(bounds.x + bounds.width * (point.x / textureWidth)),
  y: roundCoordinate(bounds.y + bounds.height * (point.y / textureHeight))
});

export const mapV6ContourPointToUv = (
  point: V6ContourPoint,
  textureWidth: number,
  textureHeight: number
): V6ContourPoint => ({
  x: roundCoordinate(clamp(point.x / textureWidth, 0, 1)),
  y: roundCoordinate(clamp(point.y / textureHeight, 0, 1))
});

const createSoftAlphaMask = (
  rgbaBytes: Uint8Array,
  width: number,
  height: number,
  alphaThreshold: number
): SoftAlphaMask => {
  const originalAlpha: number[] = [];
  let inputOpaquePixelCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = (rgbaBytes[(y * width + x) * 4 + 3] ?? 0) / 255;
      originalAlpha.push(alpha);
      if (alpha * 255 > alphaThreshold) {
        inputOpaquePixelCount += 1;
      }
    }
  }

  const blurredMask = originalAlpha.map((_alpha, index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const blurred = blurAlphaAt(originalAlpha, width, height, x, y);
    return blurred >= SOFT_ALPHA_THRESHOLD || originalAlpha[index]! * 255 > alphaThreshold;
  });
  const mask = removeIsolatedAlphaNoise(closeSinglePixelCracks(blurredMask, width, height), originalAlpha, width, height);

  return {
    width,
    height,
    mask,
    inputOpaquePixelCount,
    softMaskOpaquePixelCount: mask.reduce((count, isOpaque) => count + (isOpaque ? 1 : 0), 0)
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

const resolveMaskExpansionPixels = (value: number | undefined): number =>
  value === undefined || !Number.isFinite(value)
    ? 0
    : clampInt(Math.round(value), 0, MAX_MASK_EXPANSION_PIXELS);

const expandMask = (
  mask: readonly boolean[],
  width: number,
  height: number,
  expansionPixels: number
): readonly boolean[] => {
  let expanded = [...mask];

  for (let iteration = 0; iteration < expansionPixels; iteration += 1) {
    const next = [...expanded];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (expanded[y * width + x] === true) {
          continue;
        }

        if (
          getFourNeighbors(x, y, width, height).some(
            (neighbor) => expanded[neighbor.y * width + neighbor.x] === true
          )
        ) {
          next[y * width + x] = true;
        }
      }
    }

    expanded = next;
  }

  return expanded;
};

const traceBoundaryLoops = (
  mainMask: readonly boolean[],
  width: number,
  height: number
): readonly (readonly V6ContourPoint[])[] => {
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
  const loops: (readonly V6ContourPoint[])[] = [];
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
    const loop: V6ContourPoint[] = [firstEdge.start];
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
  loops: readonly (readonly V6ContourPoint[])[]
): readonly V6ContourPoint[] | undefined =>
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
  loop: readonly V6ContourPoint[],
  densityParameters: V6ContourDensityParameters
): readonly V6ContourPoint[] => {
  const perimeter = polygonPerimeter(loop);
  if (perimeter <= 0) {
    return [];
  }

  const targetCount = clampInt(
    Math.round(perimeter / densityParameters.boundarySpacing),
    Math.min(8, loop.length),
    Math.min(densityParameters.maxBoundaryVertices, Math.max(3, loop.length * 2))
  );
  const samples: { readonly point: V6ContourPoint; readonly distance: number }[] = [];
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

const createConstraintEdges = (
  boundaryPoints: readonly V6ContourPoint[]
): readonly V6ContourConstraintEdge[] => {
  if (boundaryPoints.length < 3) {
    return [];
  }

  return boundaryPoints.map((_point, index) => [index, (index + 1) % boundaryPoints.length] as const);
};

const selectBoundaryAnchorIndexes = (
  loop: readonly V6ContourPoint[]
): readonly number[] => {
  const indexes = new Set<number>();
  indexes.add(findExtremePointIndex(loop, (left, right) => left.y - right.y || left.x - right.x));
  indexes.add(findExtremePointIndex(loop, (left, right) => right.y - left.y || left.x - right.x));
  indexes.add(findExtremePointIndex(loop, (left, right) => left.x - right.x || left.y - right.y));
  indexes.add(findExtremePointIndex(loop, (left, right) => right.x - left.x || left.y - right.y));
  return [...indexes].sort((left, right) => left - right);
};

const findExtremePointIndex = (
  points: readonly V6ContourPoint[],
  compare: (left: V6ContourPoint, right: V6ContourPoint) => number
): number => {
  let selectedIndex = 0;
  for (let index = 1; index < points.length; index += 1) {
    if (compare(mustGet(points, index), mustGet(points, selectedIndex)) < 0) {
      selectedIndex = index;
    }
  }

  return selectedIndex;
};

const sampleInteriorSteinerPoints = (input: {
  readonly mainMask: readonly boolean[];
  readonly width: number;
  readonly component: OpaqueComponent;
  readonly boundaryPoints: readonly V6ContourPoint[];
  readonly densityParameters: V6ContourDensityParameters;
}): readonly V6ContourPoint[] => {
  const usedKeys = new Set(input.boundaryPoints.map(pointKey));
  const candidatePoints = createInteriorCandidatePoints(input)
    .filter((candidate) => {
      const rounded = roundPixelPoint(candidate.point);
      return !usedKeys.has(pointKey(rounded)) &&
        candidate.boundaryDistance >= input.densityParameters.interiorBoundaryClearance;
    })
    .sort(compareInteriorCandidates);
  const consideredCandidates = candidatePoints.slice(
    0,
    Math.max(64, input.densityParameters.maxInteriorVertices * 24)
  );
  const selected: V6ContourPoint[] = [];

  while (
    selected.length < input.densityParameters.maxInteriorVertices &&
    consideredCandidates.length > 0
  ) {
    const nextIndex = selectNextInteriorCandidateIndex(consideredCandidates, selected);
    const [next] = consideredCandidates.splice(nextIndex, 1);
    if (next === undefined) {
      break;
    }

    const point = roundPixelPoint(next.point);
    const key = pointKey(point);
    if (usedKeys.has(key)) {
      continue;
    }

    usedKeys.add(key);
    selected.push(point);
  }

  if (selected.length === 0) {
    const fallback = selectBestInteriorPixelCenter(input);
    if (fallback !== undefined && !usedKeys.has(pointKey(fallback))) {
      selected.push(fallback);
    }
  }

  return selected;
};

const createInteriorCandidatePoints = (input: {
  readonly mainMask: readonly boolean[];
  readonly width: number;
  readonly component: OpaqueComponent;
  readonly boundaryPoints: readonly V6ContourPoint[];
  readonly densityParameters: V6ContourDensityParameters;
}): readonly { readonly point: V6ContourPoint; readonly boundaryDistance: number }[] => {
  const points: { readonly point: V6ContourPoint; readonly boundaryDistance: number }[] = [];
  const step = input.densityParameters.interiorSpacing;

  for (let y = input.component.bounds.top + step / 2; y < input.component.bounds.bottom; y += step) {
    for (let x = input.component.bounds.left + step / 2; x < input.component.bounds.right; x += step) {
      const point = roundPixelPoint({ x, y });
      if (!isPointInsideMask(input.mainMask, input.width, point)) {
        continue;
      }

      points.push({
        point,
        boundaryDistance: distanceToClosedPolyline(point, input.boundaryPoints)
      });
    }
  }

  return points;
};

const selectNextInteriorCandidateIndex = (
  candidates: readonly { readonly point: V6ContourPoint; readonly boundaryDistance: number }[],
  selected: readonly V6ContourPoint[]
): number => {
  let selectedIndex = 0;
  let selectedScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = mustGet(candidates, index);
    const selectedDistance =
      selected.length === 0
        ? Number.POSITIVE_INFINITY
        : Math.min(...selected.map((point) => distance(point, candidate.point)));
    const score = Math.min(candidate.boundaryDistance, selectedDistance);
    const currentSelected = mustGet(candidates, selectedIndex);
    if (
      score > selectedScore ||
      (score === selectedScore && compareInteriorCandidates(candidate, currentSelected) < 0)
    ) {
      selectedIndex = index;
      selectedScore = score;
    }
  }

  return selectedIndex;
};

const compareInteriorCandidates = (
  left: { readonly point: V6ContourPoint; readonly boundaryDistance: number },
  right: { readonly point: V6ContourPoint; readonly boundaryDistance: number }
): number =>
  right.boundaryDistance - left.boundaryDistance || comparePoint(left.point, right.point);

const selectBestInteriorPixelCenter = (input: {
  readonly mainMask: readonly boolean[];
  readonly width: number;
  readonly component: OpaqueComponent;
  readonly boundaryPoints: readonly V6ContourPoint[];
}): V6ContourPoint | undefined =>
  input.component.pixelIndices
    .map((index) => {
      const point = {
        x: (index % input.width) + 0.5,
        y: Math.floor(index / input.width) + 0.5
      };
      return {
        point: roundPixelPoint(point),
        boundaryDistance: distanceToClosedPolyline(point, input.boundaryPoints)
      };
    })
    .sort(compareInteriorCandidates)[0]?.point;

const countHoleLikeRegions = (
  mainMask: readonly boolean[],
  width: number,
  height: number,
  bounds: V6ContourPixelBounds
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

const getDensityParameters = (densityHint: MeshDensityHint): V6ContourDensityParameters => {
  switch (densityHint) {
    case "high":
      return {
        boundarySpacing: 10,
        interiorSpacing: 7.5,
        maxBoundaryVertices: 96,
        maxInteriorVertices: 64,
        interiorBoundaryClearance: 1.1
      };
    case "medium":
      return {
        boundarySpacing: 15,
        interiorSpacing: 10,
        maxBoundaryVertices: 96,
        maxInteriorVertices: 32,
        interiorBoundaryClearance: 1.1
      };
    case "low":
      return {
        boundarySpacing: 30,
        interiorSpacing: 15,
        maxBoundaryVertices: 64,
        maxInteriorVertices: 16,
        interiorBoundaryClearance: 1.5
      };
  }
};

const createV6ContourPipelineProvenance = (input: {
  readonly componentCount: number;
  readonly holeLikeRegionCount: number;
}): readonly string[] => [
  "v6-contour-soft-alpha-mask",
  "v6-contour-main-component-selection",
  "v6-contour-boundary-loop-trace",
  "v6-contour-outer-loop-selection",
  "v6-contour-boundary-sampling",
  "v6-contour-constraint-edge-contract",
  "v6-contour-farthest-interior-steiner-sampling",
  ...(input.componentCount > 1 ? ["limitation-main-island-only"] : []),
  ...(input.holeLikeRegionCount > 0 ? ["limitation-hole-regions-reported"] : [])
];

const normalizeLoop = (loop: readonly V6ContourPoint[]): readonly V6ContourPoint[] => {
  const withoutDuplicateEnd =
    loop.length > 1 && pointKey(mustGet(loop, 0)) === pointKey(mustGet(loop, loop.length - 1))
      ? loop.slice(0, -1)
      : [...loop];
  const normalized: V6ContourPoint[] = [];
  for (const point of withoutDuplicateEnd) {
    const previous = normalized.at(-1);
    if (previous === undefined || pointKey(previous) !== pointKey(point)) {
      normalized.push(point);
    }
  }

  return normalized;
};

const rotateLoopToStableStart = (loop: readonly V6ContourPoint[]): readonly V6ContourPoint[] => {
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
  loop: readonly V6ContourPoint[]
): readonly V6ContourPoint[] => {
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
  points: readonly V6ContourPoint[]
): readonly V6ContourPoint[] => {
  const seen = new Set<string>();
  const deduped: V6ContourPoint[] = [];
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
  loop: readonly V6ContourPoint[],
  targetDistance: number
): V6ContourPoint => {
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
  loop: readonly V6ContourPoint[],
  vertexIndex: number
): number => {
  let walked = 0;
  for (let index = 0; index < vertexIndex; index += 1) {
    walked += distance(mustGet(loop, index), mustGet(loop, (index + 1) % loop.length));
  }

  return walked;
};

const polygonPerimeter = (points: readonly V6ContourPoint[]): number => {
  let perimeter = 0;
  for (let index = 0; index < points.length; index += 1) {
    perimeter += distance(mustGet(points, index), mustGet(points, (index + 1) % points.length));
  }

  return perimeter;
};

const polygonSignedArea = (points: readonly V6ContourPoint[]): number => {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = mustGet(points, index);
    const next = mustGet(points, (index + 1) % points.length);
    area += current.x * next.y - next.x * current.y;
  }

  return area / 2;
};

const isPointInsideMask = (
  mask: readonly boolean[],
  width: number,
  point: V6ContourPoint
): boolean => {
  const x = Math.floor(point.x);
  const y = Math.floor(point.y);
  if (x < 0 || x >= width || y < 0 || y * width + x >= mask.length) {
    return false;
  }

  return mask[y * width + x] === true;
};

const distanceToClosedPolyline = (
  point: V6ContourPoint,
  loop: readonly V6ContourPoint[]
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
  point: V6ContourPoint,
  start: V6ContourPoint,
  end: V6ContourPoint
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

const distance = (left: V6ContourPoint, right: V6ContourPoint): number =>
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
): readonly V6ContourPoint[] => [
  ...(x > 0 ? [{ x: x - 1, y }] : []),
  ...(x < width - 1 ? [{ x: x + 1, y }] : []),
  ...(y > 0 ? [{ x, y: y - 1 }] : []),
  ...(y < height - 1 ? [{ x, y: y + 1 }] : [])
];

const pixelBoundsToStageRect = (
  pixelBounds: V6ContourPixelBounds,
  textureBounds: RectDto,
  textureWidth: number,
  textureHeight: number
): RectDto => ({
  x: roundCoordinate(textureBounds.x + textureBounds.width * (pixelBounds.left / textureWidth)),
  y: roundCoordinate(textureBounds.y + textureBounds.height * (pixelBounds.top / textureHeight)),
  width: roundCoordinate(textureBounds.width * ((pixelBounds.right - pixelBounds.left) / textureWidth)),
  height: roundCoordinate(textureBounds.height * ((pixelBounds.bottom - pixelBounds.top) / textureHeight))
});

const roundPixelPoint = (point: V6ContourPoint): V6ContourPoint => ({
  x: roundCoordinate(point.x),
  y: roundCoordinate(point.y)
});

const roundCoordinate = (value: number): number => {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const pointKey = (point: V6ContourPoint): string =>
  `${roundCoordinate(point.x)}:${roundCoordinate(point.y)}`;

const comparePoint = (left: V6ContourPoint, right: V6ContourPoint): number =>
  left.y - right.y || left.x - right.x;

const selectLexicographicPoint = (
  points: readonly V6ContourPoint[]
): V6ContourPoint =>
  [...points].sort(comparePoint)[0] ?? { x: 0, y: 0 };

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Math.trunc(value), min), max);

const mustGet = <T>(items: readonly T[], index: number): T => {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`v6 contour pipeline internal index out of range: ${index}`);
  }

  return item;
};
