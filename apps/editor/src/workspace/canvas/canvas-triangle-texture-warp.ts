export interface TriangleWarpPoint {
  readonly x: number;
  readonly y: number;
}

export interface TriangleTextureWarpTransform {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

export function resolveTriangleTextureWarpTransform(input: {
  readonly source: readonly [TriangleWarpPoint, TriangleWarpPoint, TriangleWarpPoint];
  readonly destination: readonly [TriangleWarpPoint, TriangleWarpPoint, TriangleWarpPoint];
}): TriangleTextureWarpTransform | undefined {
  const [sourceA, sourceB, sourceC] = input.source;
  const [destA, destB, destC] = input.destination;
  const denominator =
    sourceA.x * (sourceB.y - sourceC.y) +
    sourceB.x * (sourceC.y - sourceA.y) +
    sourceC.x * (sourceA.y - sourceB.y);

  if (
    !Number.isFinite(denominator) ||
    Math.abs(denominator) < 1e-9 ||
    Math.abs(triangleSignedArea(input.destination)) < 1e-9
  ) {
    return undefined;
  }

  return {
    a:
      (destA.x * (sourceB.y - sourceC.y) +
        destB.x * (sourceC.y - sourceA.y) +
        destC.x * (sourceA.y - sourceB.y)) /
      denominator,
    b:
      (destA.y * (sourceB.y - sourceC.y) +
        destB.y * (sourceC.y - sourceA.y) +
        destC.y * (sourceA.y - sourceB.y)) /
      denominator,
    c:
      (destA.x * (sourceC.x - sourceB.x) +
        destB.x * (sourceA.x - sourceC.x) +
        destC.x * (sourceB.x - sourceA.x)) /
      denominator,
    d:
      (destA.y * (sourceC.x - sourceB.x) +
        destB.y * (sourceA.x - sourceC.x) +
        destC.y * (sourceB.x - sourceA.x)) /
      denominator,
    e:
      (destA.x * (sourceB.x * sourceC.y - sourceC.x * sourceB.y) +
        destB.x * (sourceC.x * sourceA.y - sourceA.x * sourceC.y) +
        destC.x * (sourceA.x * sourceB.y - sourceB.x * sourceA.y)) /
      denominator,
    f:
      (destA.y * (sourceB.x * sourceC.y - sourceC.x * sourceB.y) +
        destB.y * (sourceC.x * sourceA.y - sourceA.x * sourceC.y) +
        destC.y * (sourceA.x * sourceB.y - sourceB.x * sourceA.y)) /
      denominator
  };
}

function triangleSignedArea(
  points: readonly [TriangleWarpPoint, TriangleWarpPoint, TriangleWarpPoint]
): number {
  const [a, b, c] = points;

  return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
}
