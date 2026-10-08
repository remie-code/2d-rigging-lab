/**
 * Algorithm-neutral boundary resampling: walk a closed loop at a target spacing
 * to produce a roughly even-interval set of boundary vertices, augmented with
 * the four axis-extreme anchor points, deduplicated in perimeter order.
 *
 * Extracted verbatim from the v6 contour pipeline. Behaviour is identical.
 */

import {
  clampInt,
  comparePoint,
  distance,
  type GeometryPoint,
  mustGet,
  polygonPerimeter,
  roundPixelPoint,
  pointKey
} from "./geometry-primitives.js";

export interface BoundaryResampleParameters {
  readonly boundarySpacing: number;
  readonly maxBoundaryVertices: number;
}

export const sampleBoundaryLoop = (
  loop: readonly GeometryPoint[],
  parameters: BoundaryResampleParameters
): readonly GeometryPoint[] => {
  const perimeter = polygonPerimeter(loop);
  if (perimeter <= 0) {
    return [];
  }

  const targetCount = clampInt(
    Math.round(perimeter / parameters.boundarySpacing),
    Math.min(8, loop.length),
    Math.min(parameters.maxBoundaryVertices, Math.max(3, loop.length * 2))
  );
  const samples: { readonly point: GeometryPoint; readonly distance: number }[] = [];
  for (let index = 0; index < targetCount; index += 1) {
    const distanceAlong = (perimeter * index) / targetCount;
    samples.push({ point: pointAtPolygonDistance(loop, distanceAlong), distance: distanceAlong });
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

const selectBoundaryAnchorIndexes = (loop: readonly GeometryPoint[]): readonly number[] => {
  const indexes = new Set<number>();
  indexes.add(findExtremePointIndex(loop, (left, right) => left.y - right.y || left.x - right.x));
  indexes.add(findExtremePointIndex(loop, (left, right) => right.y - left.y || left.x - right.x));
  indexes.add(findExtremePointIndex(loop, (left, right) => left.x - right.x || left.y - right.y));
  indexes.add(findExtremePointIndex(loop, (left, right) => right.x - left.x || left.y - right.y));
  return [...indexes].sort((left, right) => left - right);
};

const findExtremePointIndex = (
  points: readonly GeometryPoint[],
  compare: (left: GeometryPoint, right: GeometryPoint) => number
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
  loop: readonly GeometryPoint[],
  targetDistance: number
): GeometryPoint => {
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
  loop: readonly GeometryPoint[],
  vertexIndex: number
): number => {
  let walked = 0;
  for (let index = 0; index < vertexIndex; index += 1) {
    walked += distance(mustGet(loop, index), mustGet(loop, (index + 1) % loop.length));
  }

  return walked;
};

const dedupeOrderedPoints = (points: readonly GeometryPoint[]): readonly GeometryPoint[] => {
  const seen = new Set<string>();
  const deduped: GeometryPoint[] = [];
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
