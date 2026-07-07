/**
 * Algorithm-neutral geometry primitives shared by the mesh-geometry modules
 * (alpha masking, boundary tracing/resampling, interior sampling).
 *
 * These are pure helpers extracted verbatim from the v6 contour pipeline so
 * that both v6 and future generations can share the exact same numeric
 * behaviour (rounding, tie-break ordering, neighbour enumeration). Nothing in
 * this file is v6-specific.
 */

export interface GeometryPoint {
  readonly x: number;
  readonly y: number;
}

export interface PixelBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * Deterministic coordinate rounding to 1e-6 with negative-zero normalisation.
 * This is the coordinate quantisation the whole codebase relies on for
 * determinism.
 */
export const roundCoordinate = (value: number): number => {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
};

export const roundPixelPoint = (point: GeometryPoint): GeometryPoint => ({
  x: roundCoordinate(point.x),
  y: roundCoordinate(point.y)
});

export const pointKey = (point: GeometryPoint): string =>
  `${roundCoordinate(point.x)}:${roundCoordinate(point.y)}`;

export const comparePoint = (left: GeometryPoint, right: GeometryPoint): number =>
  left.y - right.y || left.x - right.x;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const clampInt = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Math.trunc(value), min), max);

export const distance = (left: GeometryPoint, right: GeometryPoint): number =>
  Math.hypot(left.x - right.x, left.y - right.y);

export const getFourNeighbors = (
  x: number,
  y: number,
  width: number,
  height: number
): readonly GeometryPoint[] => [
  ...(x > 0 ? [{ x: x - 1, y }] : []),
  ...(x < width - 1 ? [{ x: x + 1, y }] : []),
  ...(y > 0 ? [{ x, y: y - 1 }] : []),
  ...(y < height - 1 ? [{ x, y: y + 1 }] : [])
];

export const mustGet = <T>(items: readonly T[], index: number): T => {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`mesh-geometry internal index out of range: ${index}`);
  }

  return item;
};

export const distanceToSegment = (
  point: GeometryPoint,
  start: GeometryPoint,
  end: GeometryPoint
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

export const distanceToClosedPolyline = (
  point: GeometryPoint,
  loop: readonly GeometryPoint[]
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

export const polygonPerimeter = (points: readonly GeometryPoint[]): number => {
  let perimeter = 0;
  for (let index = 0; index < points.length; index += 1) {
    perimeter += distance(mustGet(points, index), mustGet(points, (index + 1) % points.length));
  }

  return perimeter;
};

export const polygonSignedArea = (points: readonly GeometryPoint[]): number => {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = mustGet(points, index);
    const next = mustGet(points, (index + 1) % points.length);
    area += current.x * next.y - next.x * current.y;
  }

  return area / 2;
};

export const isPointInsideMask = (
  mask: readonly boolean[],
  width: number,
  point: GeometryPoint
): boolean => {
  const x = Math.floor(point.x);
  const y = Math.floor(point.y);
  if (x < 0 || x >= width || y < 0 || y * width + x >= mask.length) {
    return false;
  }

  return mask[y * width + x] === true;
};

export const isOpaqueAt = (
  mask: readonly boolean[],
  width: number,
  height: number,
  x: number,
  y: number
): boolean => x >= 0 && x < width && y >= 0 && y < height && mask[y * width + x] === true;
