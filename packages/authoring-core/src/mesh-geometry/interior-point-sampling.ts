/**
 * Algorithm-neutral interior Steiner-point sampling: generate a grid of
 * candidate interior points at a given spacing, reject those too close to the
 * boundary, then greedily pick a farthest-point (Poisson-disk-like, fully
 * deterministic) subset.
 *
 * Extracted verbatim from the v6 contour pipeline. Behaviour is identical.
 *
 * The interior spacing `R` is an explicit parameter (`interiorSpacing`), as is
 * the boundary clearance (`interiorBoundaryClearance`) and the cap
 * (`maxInteriorVertices`). v6 passes its existing density parameters so its
 * output is byte-identical; future generations can drive `R` directly.
 */

import { type OpaqueComponent } from "./connected-components.js";
import {
  comparePoint,
  distance,
  distanceToClosedPolyline,
  type GeometryPoint,
  isPointInsideMask,
  mustGet,
  pointKey,
  roundPixelPoint
} from "./geometry-primitives.js";

export interface InteriorSamplingParameters {
  readonly interiorSpacing: number;
  readonly maxInteriorVertices: number;
  readonly interiorBoundaryClearance: number;
}

interface InteriorCandidate {
  readonly point: GeometryPoint;
  readonly boundaryDistance: number;
}

export const sampleInteriorSteinerPoints = (input: {
  readonly mainMask: readonly boolean[];
  readonly width: number;
  readonly component: OpaqueComponent;
  readonly boundaryPoints: readonly GeometryPoint[];
  readonly parameters: InteriorSamplingParameters;
}): readonly GeometryPoint[] => {
  const usedKeys = new Set(input.boundaryPoints.map(pointKey));
  const candidatePoints = createInteriorCandidatePoints(input)
    .filter((candidate) => {
      const rounded = roundPixelPoint(candidate.point);
      return (
        !usedKeys.has(pointKey(rounded)) &&
        candidate.boundaryDistance >= input.parameters.interiorBoundaryClearance
      );
    })
    .sort(compareInteriorCandidates);
  const consideredCandidates = candidatePoints.slice(
    0,
    Math.max(64, input.parameters.maxInteriorVertices * 24)
  );
  const selected: GeometryPoint[] = [];

  while (
    selected.length < input.parameters.maxInteriorVertices &&
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
  readonly boundaryPoints: readonly GeometryPoint[];
  readonly parameters: InteriorSamplingParameters;
}): readonly InteriorCandidate[] => {
  const points: InteriorCandidate[] = [];
  const step = input.parameters.interiorSpacing;

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
  candidates: readonly InteriorCandidate[],
  selected: readonly GeometryPoint[]
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
  left: InteriorCandidate,
  right: InteriorCandidate
): number => right.boundaryDistance - left.boundaryDistance || comparePoint(left.point, right.point);

const selectBestInteriorPixelCenter = (input: {
  readonly width: number;
  readonly component: OpaqueComponent;
  readonly boundaryPoints: readonly GeometryPoint[];
}): GeometryPoint | undefined =>
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
