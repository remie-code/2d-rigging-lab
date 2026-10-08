/**
 * Algorithm-neutral boundary tracing: enumerate the pixel-edge boundary of an
 * opacity mask, stitch edges into deterministic oriented loops, and select the
 * outer (largest-area) loop.
 *
 * Extracted verbatim from the v6 contour pipeline. Behaviour is identical.
 */

import {
  comparePoint,
  type GeometryPoint,
  isOpaqueAt,
  mustGet,
  pointKey,
  polygonSignedArea
} from "./geometry-primitives.js";

interface BoundaryEdge {
  readonly start: GeometryPoint;
  readonly end: GeometryPoint;
}

export const traceBoundaryLoops = (
  mainMask: readonly boolean[],
  width: number,
  height: number
): readonly (readonly GeometryPoint[])[] => {
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
  const loops: (readonly GeometryPoint[])[] = [];
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
    const loop: GeometryPoint[] = [firstEdge.start];
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

export const selectOuterLoop = (
  loops: readonly (readonly GeometryPoint[])[]
): readonly GeometryPoint[] | undefined =>
  [...loops].sort((left, right) => {
    const areaDelta = Math.abs(polygonSignedArea(right)) - Math.abs(polygonSignedArea(left));
    if (areaDelta !== 0) {
      return areaDelta;
    }

    const leftPoint = selectLexicographicPoint(left);
    const rightPoint = selectLexicographicPoint(right);
    return comparePoint(leftPoint, rightPoint);
  })[0];

const normalizeLoop = (loop: readonly GeometryPoint[]): readonly GeometryPoint[] => {
  const withoutDuplicateEnd =
    loop.length > 1 && pointKey(mustGet(loop, 0)) === pointKey(mustGet(loop, loop.length - 1))
      ? loop.slice(0, -1)
      : [...loop];
  const normalized: GeometryPoint[] = [];
  for (const point of withoutDuplicateEnd) {
    const previous = normalized.at(-1);
    if (previous === undefined || pointKey(previous) !== pointKey(point)) {
      normalized.push(point);
    }
  }

  return normalized;
};

const rotateLoopToStableStart = (loop: readonly GeometryPoint[]): readonly GeometryPoint[] => {
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
  loop: readonly GeometryPoint[]
): readonly GeometryPoint[] => {
  if (polygonSignedArea(loop) >= 0 || loop.length <= 1) {
    return loop;
  }

  const [first, ...rest] = loop;
  if (first === undefined) {
    return [];
  }

  return [first, ...rest.reverse()];
};

const selectLexicographicPoint = (points: readonly GeometryPoint[]): GeometryPoint =>
  [...points].sort(comparePoint)[0] ?? { x: 0, y: 0 };
