/**
 * Algorithm-neutral polyline simplification: a recursive Douglas-Peucker for
 * open polylines and a closed-loop wrapper that preserves concave anchor
 * points and caps the resulting vertex count.
 *
 * Extracted verbatim from the v1-v4 outline generator
 * (`mesh-outline-generation`). Behaviour is identical. The loop wrapper takes
 * an explicit `epsilon`/`vertexCap` pair instead of the outline `config`
 * object so it is not coupled to v6/outline-specific config.
 *
 * Points here use integer-ish pixel coordinates and compare via exact string
 * keys, matching the original outline generator (which does not round to
 * 1e-6). This is intentionally kept distinct from the contour-pipeline
 * primitives, whose `pointKey` rounds.
 */

export interface SimplificationPoint {
  readonly x: number;
  readonly y: number;
}

export interface ContourSimplificationConfig {
  readonly simplifyEpsilon: number;
  readonly contourVertexCap: number;
}

export const simplifyContourLoop = (
  loop: readonly SimplificationPoint[],
  config: ContourSimplificationConfig
): readonly SimplificationPoint[] => {
  const cleaned = removeConsecutiveDuplicatePoints(loop);
  if (cleaned.length <= 3) {
    return cleaned;
  }

  const startIndex = findLexicographicPointIndex(cleaned);
  const rotated = rotatePoints(cleaned, startIndex);
  const oppositeIndex = findFarthestPointIndex(rotated, rotated[0]!);
  if (oppositeIndex <= 0 || oppositeIndex >= rotated.length - 1) {
    return capContourVertices(removeCollinearPoints(rotated), config.contourVertexCap);
  }

  const firstChain = rotated.slice(0, oppositeIndex + 1);
  const secondChain = [...rotated.slice(oppositeIndex), rotated[0]!];
  const simplifiedFirst = simplifyOpenPolyline(firstChain, config.simplifyEpsilon);
  const simplifiedSecond = simplifyOpenPolyline(secondChain, config.simplifyEpsilon);
  const simplified = removeCollinearPoints([
    ...simplifiedFirst,
    ...simplifiedSecond.slice(1, -1)
  ]);
  const protectedPointKeys = collectProtectedConcavityPointKeys(rotated);
  const selectedPointKeys = new Set([
    ...simplified.map(pointKey),
    ...protectedPointKeys
  ]);
  const protectedSimplified = removeCollinearPoints(
    rotated.filter((point) => selectedPointKeys.has(pointKey(point)))
  );

  return capContourVertices(
    protectedSimplified.length >= 3 ? protectedSimplified : rotated,
    config.contourVertexCap
  );
};

export const simplifyOpenPolyline = (
  points: readonly SimplificationPoint[],
  epsilon: number
): readonly SimplificationPoint[] => {
  if (points.length <= 2) {
    return points;
  }

  const first = points[0]!;
  const last = points[points.length - 1]!;
  let maxDistance = -1;
  let maxIndex = -1;

  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = pointToSegmentDistance(points[index]!, first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = index;
    }
  }

  if (maxDistance <= epsilon || maxIndex < 0) {
    return [first, last];
  }

  const left = simplifyOpenPolyline(points.slice(0, maxIndex + 1), epsilon);
  const right = simplifyOpenPolyline(points.slice(maxIndex), epsilon);
  return [...left.slice(0, -1), ...right];
};

const collectProtectedConcavityPointKeys = (
  points: readonly SimplificationPoint[]
): readonly string[] => {
  if (points.length < 4) {
    return [];
  }

  const areaSign = Math.sign(polygonArea(points));
  if (areaSign === 0) {
    return [];
  }

  const protectedKeys = new Set<string>();
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length]!;
    const point = points[index]!;
    const next = points[(index + 1) % points.length]!;
    const cross =
      (point.x - previous.x) * (next.y - point.y) -
      (point.y - previous.y) * (next.x - point.x);
    if (Math.sign(cross) !== 0 && Math.sign(cross) !== areaSign) {
      protectedKeys.add(pointKey(previous));
      protectedKeys.add(pointKey(point));
      protectedKeys.add(pointKey(next));
    }
  }

  return [...protectedKeys].sort();
};

const removeConsecutiveDuplicatePoints = (
  points: readonly SimplificationPoint[]
): SimplificationPoint[] => {
  const result: SimplificationPoint[] = [];
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

const removeCollinearPoints = (points: readonly SimplificationPoint[]): SimplificationPoint[] => {
  if (points.length <= 3) {
    return [...points];
  }

  const result: SimplificationPoint[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length]!;
    const point = points[index]!;
    const next = points[(index + 1) % points.length]!;
    const cross =
      (point.x - previous.x) * (next.y - point.y) -
      (point.y - previous.y) * (next.x - point.x);
    if (Math.abs(cross) > 0.0000001) {
      result.push(point);
    }
  }

  return result.length >= 3 ? result : [...points];
};

const capContourVertices = (
  points: readonly SimplificationPoint[],
  cap: number
): readonly SimplificationPoint[] => {
  if (points.length <= cap) {
    return points;
  }

  const step = points.length / cap;
  const result: SimplificationPoint[] = [];
  for (let index = 0; index < cap; index += 1) {
    result.push(points[Math.floor(index * step)]!);
  }

  return removeCollinearPoints(result);
};

const findLexicographicPointIndex = (points: readonly SimplificationPoint[]): number => {
  let result = 0;
  for (let index = 1; index < points.length; index += 1) {
    if (comparePoints(points[index]!, points[result]!) < 0) {
      result = index;
    }
  }

  return result;
};

const findFarthestPointIndex = (
  points: readonly SimplificationPoint[],
  origin: SimplificationPoint
): number => {
  let result = 0;
  let maxDistance = -1;
  for (let index = 1; index < points.length; index += 1) {
    const distance = squaredDistance(points[index]!, origin);
    if (distance > maxDistance) {
      maxDistance = distance;
      result = index;
    }
  }

  return result;
};

const rotatePoints = (
  points: readonly SimplificationPoint[],
  startIndex: number
): readonly SimplificationPoint[] => [...points.slice(startIndex), ...points.slice(0, startIndex)];

const pointToSegmentDistance = (
  point: SimplificationPoint,
  segmentStart: SimplificationPoint,
  segmentEnd: SimplificationPoint
): number => {
  const dx = segmentEnd.x - segmentStart.x;
  const dy = segmentEnd.y - segmentStart.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0.0000001) {
    return Math.sqrt(squaredDistance(point, segmentStart));
  }

  const ratio = clamp(
    ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) / lengthSquared,
    0,
    1
  );
  return Math.sqrt(
    squaredDistance(point, {
      x: segmentStart.x + dx * ratio,
      y: segmentStart.y + dy * ratio
    })
  );
};

const polygonArea = (points: readonly SimplificationPoint[]): number => {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += point.x * next.y - next.x * point.y;
  }

  return area / 2;
};

const comparePoints = (left: SimplificationPoint, right: SimplificationPoint): number =>
  left.y - right.y || left.x - right.x;

const pointKey = (point: SimplificationPoint): string => `${point.x}:${point.y}`;

const pointsEqual = (left: SimplificationPoint, right: SimplificationPoint): boolean =>
  left.x === right.x && left.y === right.y;

const squaredDistance = (left: SimplificationPoint, right: SimplificationPoint): number =>
  (left.x - right.x) ** 2 + (left.y - right.y) ** 2;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);
