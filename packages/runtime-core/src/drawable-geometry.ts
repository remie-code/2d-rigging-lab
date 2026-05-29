import type { RectDto, Vec2Dto } from "@private-2d-rigging-lab/contracts";

export const computeBoundsFromVertices = (vertices: readonly Vec2Dto[]): RectDto => {
  const first = vertices[0];
  if (first === undefined) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0
    };
  }

  let minX = first.x;
  let minY = first.y;
  let maxX = first.x;
  let maxY = first.y;

  for (const vertex of vertices.slice(1)) {
    minX = Math.min(minX, vertex.x);
    minY = Math.min(minY, vertex.y);
    maxX = Math.max(maxX, vertex.x);
    maxY = Math.max(maxY, vertex.y);
  }

  return {
    x: normalizeZero(minX),
    y: normalizeZero(minY),
    width: normalizeZero(maxX - minX),
    height: normalizeZero(maxY - minY)
  };
};

export const createStableVertexHash = (
  vertices: readonly Vec2Dto[],
  options: {
    readonly hashPrecisionDecimals?: number;
  } = {}
): string => {
  const hashPrecisionDecimals = options.hashPrecisionDecimals ?? 5;
  let hash = 0x811c9dc5;
  const normalizedVertices = vertices
    .map((vertex) => `${formatCoordinate(vertex.x, hashPrecisionDecimals)},${formatCoordinate(vertex.y, hashPrecisionDecimals)}`)
    .join(";");

  for (let index = 0; index < normalizedVertices.length; index += 1) {
    const charCode = normalizedVertices.charCodeAt(index);
    hash ^= charCode;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return `vhash_${hash.toString(16).padStart(8, "0")}_${vertices.length}`;
};

const formatCoordinate = (value: number, precisionDecimals: number): string => {
  const precisionFactor = 10 ** precisionDecimals;
  return normalizeZero(Math.round(value * precisionFactor) / precisionFactor).toFixed(precisionDecimals);
};

const normalizeZero = (value: number): number => (Object.is(value, -0) ? 0 : value);
