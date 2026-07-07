/**
 * v7 "commercial-like" mesh generation pipeline, operating entirely in pixel
 * space on a single connected component / island.
 *
 * Implements concept-design.md §2-4 from scratch on top of the algorithm-neutral
 * mesh-geometry modules (it imports NO v6 files). The design entry point is the
 * dilated mask: once the silhouette is fattened by r, every later stage only
 * looks at that mask, and the three target output characteristics follow
 * (margin-padded simplified outline, sparse vertices, coarse wrapping of thin
 * detail).
 *
 * Determinism: no randomness anywhere. All ordering is by explicit tie-broken
 * sorts and stable generation order. Coordinates fed to the neutral Douglas-
 * Peucker (whose pointKey is intentionally non-rounding) are pre-rounded with
 * roundCoordinate (1e-6) per the L0 ruling.
 */

import Delaunator from "delaunator";

import Constrainautor from "./mesh-generation-v7-constrainautor-runtime.js";

import {
  createPaddedRgba,
  createSoftAlphaMask,
  expandMask,
  resolveMaskExpansionPixels
} from "./mesh-geometry/alpha-mask.js";
import {
  createComponentMask,
  findOpaqueComponents,
  selectMainComponent,
  type OpaqueComponent
} from "./mesh-geometry/connected-components.js";
import {
  selectOuterLoop,
  traceBoundaryLoops
} from "./mesh-geometry/boundary-tracing.js";
import { sampleBoundaryLoop } from "./mesh-geometry/boundary-resampling.js";
import { sampleInteriorSteinerPoints } from "./mesh-geometry/interior-point-sampling.js";
import {
  simplifyContourLoop,
  type SimplificationPoint
} from "./mesh-geometry/polyline-simplification.js";
import {
  type GeometryPoint,
  type PixelBounds,
  mustGet,
  pointKey,
  roundCoordinate,
  roundPixelPoint
} from "./mesh-geometry/geometry-primitives.js";
import type { MeshDensityHint } from "./mesh-generation-contract.js";
import {
  deriveV7Parameters,
  deriveV7VirtualPaddingPixels,
  V7_MAX_MASK_EXPANSION_PIXELS,
  type V7DerivedParameters
} from "./mesh-generation-v7-parameters.js";

const DEFAULT_ALPHA_THRESHOLD = 8;
const TRIANGLE_AREA_EPSILON = 0.000001;

export type V7PointRole = "boundary" | "interior";

export interface V7PixelPoint {
  readonly x: number;
  readonly y: number;
  readonly role: V7PointRole;
  readonly stableOrder: number;
}

export interface V7PipelineDiagnostics {
  readonly inputOpaquePixelCount: number;
  readonly expandedComponentPixelCount: number;
  readonly marginRadiusPixels: number;
  /**
   * All-around virtual padding (pixels) the pipeline ran under so mask
   * expansion did not clamp at the original texture edge (§2.1). Output points
   * and alphaBoundsPixels are already unpadded back to the original texture
   * coordinate frame, so they may be negative or exceed width/height.
   */
  readonly virtualPaddingPixels: number;
  readonly simplifyEpsilon: number;
  readonly vertexSpacing: number;
  readonly rawBoundaryPointCount: number;
  readonly simplifiedBoundaryPointCount: number;
  readonly resampledBoundaryPointCount: number;
  readonly interiorPointCount: number;
  readonly thinRegionSuppressedInteriorCandidateCount: number;
  readonly lloydRelaxationPasses: number;
}

export type V7PipelineResult =
  | {
      readonly status: "generated";
      readonly points: readonly V7PixelPoint[];
      readonly triangles: readonly (readonly [number, number, number])[];
      readonly boundaryPoints: readonly GeometryPoint[];
      readonly interiorPoints: readonly GeometryPoint[];
      readonly alphaBoundsPixels: PixelBounds;
      readonly parameters: V7DerivedParameters;
      readonly diagnostics: V7PipelineDiagnostics;
    }
  | {
      readonly status: "blocked";
      readonly reason: V7PipelineBlockedReason;
      readonly inputOpaquePixelCount: number;
      readonly alphaBoundsPixels?: PixelBounds;
    };

export type V7PipelineBlockedReason =
  | "v7-margin-contour-alpha-empty"
  | "v7-margin-contour-extraction-failed"
  | "v7-margin-contour-triangulation-failed";

export interface V7PipelineInput {
  readonly textureWidth: number;
  readonly textureHeight: number;
  readonly rgbaBytes: Uint8Array;
  readonly densityHint?: MeshDensityHint;
  readonly alphaThreshold?: number;
}

/**
 * Run the full v7 pixel-space pipeline for a single component.
 */
export const runV7MarginContourPipeline = (input: V7PipelineInput): V7PipelineResult => {
  const width = Math.round(input.textureWidth);
  const height = Math.round(input.textureHeight);
  if (width <= 0 || height <= 0 || input.rgbaBytes.byteLength !== width * height * 4) {
    return {
      status: "blocked",
      reason: "v7-margin-contour-extraction-failed",
      inputOpaquePixelCount: 0
    };
  }

  const parameters = deriveV7Parameters({
    ...(input.densityHint === undefined ? {} : { densityHint: input.densityHint }),
    textureWidth: width,
    textureHeight: height
  });
  const alphaThreshold = input.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD;

  // §2.1 / §3 "non-clamped dilation": run every pixel-space stage on a working
  // canvas padded all around by pad = ⌈r + soft-mask growth⌉ so the dilated
  // mask can grow into real background instead of clamping at the original
  // texture edge (which made outline points stick to the canvas border,
  // evaluation-log.md round-trip 1). Output coordinates are unpadded back to
  // the original texture frame at the end; padded vertices legitimately land
  // outside [0,width]×[0,height].
  const paddingPixels = deriveV7VirtualPaddingPixels(parameters.marginRadiusPixels);
  const padded = createPaddedRgba(input.rgbaBytes, width, height, paddingPixels);
  const workWidth = padded.width;
  const workHeight = padded.height;
  const pad = padded.paddingPixels;

  // Stage 1: binarise + soft blur, then dilate by r (§2.1). The 8px clamp is
  // lifted for v7 by passing the wide ceiling.
  const softMask = createSoftAlphaMask(padded.rgbaBytes, workWidth, workHeight, alphaThreshold);
  if (softMask.inputOpaquePixelCount === 0) {
    return {
      status: "blocked",
      reason: "v7-margin-contour-alpha-empty",
      inputOpaquePixelCount: 0
    };
  }

  // v7 lifts the v6 8px ceiling by passing V7_MAX_MASK_EXPANSION_PIXELS so the
  // full computed r is applied (§2). r is already <= that ceiling by the clamp
  // in deriveV7Parameters, but resolving here documents the raised bound.
  const expansionPixels = resolveMaskExpansionPixels(
    parameters.marginRadiusPixels,
    V7_MAX_MASK_EXPANSION_PIXELS
  );
  const expandedMask = expandMask(softMask.mask, workWidth, workHeight, expansionPixels);

  // Stage 1b: select the main opaque component of the dilated mask. Holes are
  // filled by only ever tracing the outer loop (§4: fill all holes).
  const components = findOpaqueComponents(expandedMask, workWidth, workHeight);
  const mainComponent = selectMainComponent(components);
  if (mainComponent === undefined) {
    return {
      status: "blocked",
      reason: "v7-margin-contour-extraction-failed",
      inputOpaquePixelCount: softMask.inputOpaquePixelCount
    };
  }

  const componentMask = createComponentMask(mainComponent, workWidth, workHeight);
  // Unpad the component bounds back to the original texture frame. The dilated
  // component sits in the pad ring, so these bounds legitimately extend outside
  // [0,width]×[0,height] (the coverage margin lives beyond the texture edge).
  const alphaBoundsPixels = unpadPixelBounds(mainComponent.bounds, pad);

  // Stage 2: trace outer contour → Douglas-Peucker (ε) → resample at L (§2.2).
  const outerLoop = selectOuterLoop(traceBoundaryLoops(componentMask, workWidth, workHeight));
  if (outerLoop === undefined || outerLoop.length < 3) {
    return {
      status: "blocked",
      reason: "v7-margin-contour-extraction-failed",
      inputOpaquePixelCount: softMask.inputOpaquePixelCount,
      alphaBoundsPixels
    };
  }

  const preRoundedLoop: readonly SimplificationPoint[] = outerLoop.map((point) => ({
    x: roundCoordinate(point.x),
    y: roundCoordinate(point.y)
  }));
  const simplifiedLoop = simplifyContourLoop(preRoundedLoop, {
    simplifyEpsilon: parameters.simplifyEpsilon,
    contourVertexCap: parameters.maxBoundaryVertices
  });
  const boundaryPoints = sampleBoundaryLoop(simplifiedLoop, {
    boundarySpacing: parameters.vertexSpacing,
    maxBoundaryVertices: parameters.maxBoundaryVertices
  });
  if (boundaryPoints.length < 3) {
    return {
      status: "blocked",
      reason: "v7-margin-contour-extraction-failed",
      inputOpaquePixelCount: softMask.inputOpaquePixelCount,
      alphaBoundsPixels
    };
  }

  // Stage 3: interior points at spacing R, excluding the R/2 boundary band and
  // thin regions (local width < R via distance transform) (§2.3).
  const thinRegion = computeThickComponentMask({
    componentMask,
    component: mainComponent,
    width: workWidth,
    height: workHeight,
    thinRegionWidthThreshold: parameters.thinRegionWidthThreshold
  });
  const interiorPoints =
    thinRegion.thickComponent === undefined
      ? []
      : sampleInteriorSteinerPoints({
          mainMask: thinRegion.thickMask,
          width: workWidth,
          component: thinRegion.thickComponent,
          boundaryPoints,
          parameters: {
            interiorSpacing: parameters.interiorSpacing,
            maxInteriorVertices: parameters.maxInteriorVertices,
            interiorBoundaryClearance: parameters.interiorBoundaryClearance
          }
        });

  // Stage 4: CDT with boundary as constraint edges + Lloyd relaxation (§2.4).
  const triangulation = triangulateWithLloyd({
    boundaryPoints,
    interiorPoints,
    lloydRelaxationPasses: parameters.lloydRelaxationPasses
  });
  if (triangulation === undefined) {
    return {
      status: "blocked",
      reason: "v7-margin-contour-triangulation-failed",
      inputOpaquePixelCount: softMask.inputOpaquePixelCount,
      alphaBoundsPixels
    };
  }

  const diagnostics: V7PipelineDiagnostics = {
    inputOpaquePixelCount: softMask.inputOpaquePixelCount,
    expandedComponentPixelCount: mainComponent.pixelIndices.length,
    marginRadiusPixels: parameters.marginRadiusPixels,
    virtualPaddingPixels: pad,
    simplifyEpsilon: parameters.simplifyEpsilon,
    vertexSpacing: parameters.vertexSpacing,
    rawBoundaryPointCount: outerLoop.length,
    simplifiedBoundaryPointCount: simplifiedLoop.length,
    resampledBoundaryPointCount: boundaryPoints.length,
    interiorPointCount: triangulation.interiorPoints.length,
    thinRegionSuppressedInteriorCandidateCount: thinRegion.suppressedPixelCount,
    lloydRelaxationPasses: parameters.lloydRelaxationPasses
  };

  // Unpad all output coordinates from the padded working frame back to the
  // original texture frame. Coordinates in the pad ring become negative or
  // exceed width/height — that is the coverage margin extending past the
  // texture edge (§3 "non-clamped dilation"; the downstream stage/UV mapping
  // extends bounds and clamps UV to [0,1]). Rounding preserves determinism.
  return {
    status: "generated",
    points: triangulation.points.map((point) => unpadPixelPointWithRole(point, pad)),
    triangles: triangulation.triangles,
    boundaryPoints: boundaryPoints.map((point) => unpadPixelPoint(point, pad)),
    interiorPoints: triangulation.interiorPoints.map((point) => unpadPixelPoint(point, pad)),
    alphaBoundsPixels,
    parameters,
    diagnostics
  };
};

/** Shift a padded-frame point back to the original texture frame. */
const unpadPixelPoint = (point: GeometryPoint, pad: number): GeometryPoint =>
  pad === 0
    ? point
    : { x: roundCoordinate(point.x - pad), y: roundCoordinate(point.y - pad) };

/** Shift a padded-frame pixel point (role/order preserved) back to origin. */
const unpadPixelPointWithRole = (point: V7PixelPoint, pad: number): V7PixelPoint =>
  pad === 0
    ? point
    : {
        x: roundCoordinate(point.x - pad),
        y: roundCoordinate(point.y - pad),
        role: point.role,
        stableOrder: point.stableOrder
      };

/** Shift padded-frame pixel bounds back to the original texture frame. */
const unpadPixelBounds = (bounds: PixelBounds, pad: number): PixelBounds =>
  pad === 0
    ? bounds
    : {
        left: bounds.left - pad,
        top: bounds.top - pad,
        right: bounds.right - pad,
        bottom: bounds.bottom - pad
      };

interface ThickComponentResult {
  readonly thickMask: readonly boolean[];
  readonly thickComponent: OpaqueComponent | undefined;
  readonly suppressedPixelCount: number;
}

/**
 * Build a mask of "thick" pixels: those whose local width (twice the chamfer
 * distance to the nearest background pixel) is at least the thin-region
 * threshold R. Interior points are only sampled inside this mask, so hair tips
 * and thin strands (local width < R) receive zero interior points and are
 * covered by boundary-only long thin triangles (§2.3 exclusion rule (b),
 * feature 3). Fully deterministic (two-pass chamfer transform).
 */
const computeThickComponentMask = (input: {
  readonly componentMask: readonly boolean[];
  readonly component: OpaqueComponent;
  readonly width: number;
  readonly height: number;
  readonly thinRegionWidthThreshold: number;
}): ThickComponentResult => {
  const distance = computeChamferDistanceTransform(input.componentMask, input.width, input.height);
  // local width ~= 2 * distance-to-background; keep pixels whose width >= R.
  const halfThreshold = input.thinRegionWidthThreshold / 2;
  const thickMask = new Array<boolean>(input.width * input.height).fill(false);
  let thickPixelCount = 0;

  for (const pixelIndex of input.component.pixelIndices) {
    if ((distance[pixelIndex] ?? 0) >= halfThreshold) {
      thickMask[pixelIndex] = true;
      thickPixelCount += 1;
    }
  }

  const suppressedPixelCount = input.component.pixelIndices.length - thickPixelCount;
  if (thickPixelCount === 0) {
    return { thickMask, thickComponent: undefined, suppressedPixelCount };
  }

  // Re-derive the component descriptor over the thick mask so interior sampling
  // sees the correct bounds/pixel set. There may be several thick sub-regions;
  // sampling over the union is deterministic and correct because sampling only
  // ever places points inside thickMask.
  const thickComponent = componentFromMask(thickMask, input.width, input.height);
  return { thickMask, thickComponent, suppressedPixelCount };
};

/**
 * Deterministic two-pass (forward + backward) chamfer distance transform giving,
 * for each opaque pixel, an approximation of the Euclidean distance to the
 * nearest background pixel. Background pixels are distance 0. Uses 3-4 chamfer
 * weights (integer-ish, scaled) which is a standard deterministic DT.
 */
const computeChamferDistanceTransform = (
  mask: readonly boolean[],
  width: number,
  height: number
): readonly number[] => {
  const LARGE = width + height + 1;
  const distance = new Array<number>(width * height);
  for (let index = 0; index < mask.length; index += 1) {
    distance[index] = mask[index] === true ? LARGE : 0;
  }

  const relax = (index: number, neighborIndex: number, cost: number): void => {
    const candidate = (distance[neighborIndex] ?? 0) + cost;
    if (candidate < (distance[index] ?? 0)) {
      distance[index] = candidate;
    }
  };

  // Forward pass (top-left to bottom-right).
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (mask[index] !== true) {
        continue;
      }

      if (x > 0) {
        relax(index, index - 1, 1);
      }
      if (y > 0) {
        relax(index, index - width, 1);
      }
      if (x > 0 && y > 0) {
        relax(index, index - width - 1, Math.SQRT2);
      }
      if (x < width - 1 && y > 0) {
        relax(index, index - width + 1, Math.SQRT2);
      }
    }
  }

  // Backward pass (bottom-right to top-left).
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const index = y * width + x;
      if (mask[index] !== true) {
        continue;
      }

      if (x < width - 1) {
        relax(index, index + 1, 1);
      }
      if (y < height - 1) {
        relax(index, index + width, 1);
      }
      if (x < width - 1 && y < height - 1) {
        relax(index, index + width + 1, Math.SQRT2);
      }
      if (x > 0 && y < height - 1) {
        relax(index, index + width - 1, Math.SQRT2);
      }
    }
  }

  return distance;
};

/** Build an OpaqueComponent descriptor spanning every true pixel of a mask. */
const componentFromMask = (
  mask: readonly boolean[],
  width: number,
  height: number
): OpaqueComponent | undefined => {
  const pixelIndices: number[] = [];
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== true) {
      continue;
    }

    const x = index % width;
    const y = Math.floor(index / width);
    pixelIndices.push(index);
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + 1);
    bottom = Math.max(bottom, y + 1);
  }

  if (pixelIndices.length === 0) {
    return undefined;
  }

  return { pixelIndices, bounds: { left, top, right, bottom } };
};

interface TriangulationResult {
  readonly points: readonly V7PixelPoint[];
  readonly interiorPoints: readonly GeometryPoint[];
  readonly triangles: readonly (readonly [number, number, number])[];
}

/**
 * Constrained Delaunay triangulation of boundary (constraint ring) + interior
 * Steiner points, followed by Lloyd relaxation of interior points only. Returns
 * undefined if the CDT could not be built at all.
 */
const triangulateWithLloyd = (input: {
  readonly boundaryPoints: readonly GeometryPoint[];
  readonly interiorPoints: readonly GeometryPoint[];
  readonly lloydRelaxationPasses: number;
}): TriangulationResult | undefined => {
  let interiorPoints = input.interiorPoints;
  let lastTriangulation = triangulateConstrained(input.boundaryPoints, interiorPoints);
  if (lastTriangulation === undefined) {
    return undefined;
  }

  for (let pass = 0; pass < input.lloydRelaxationPasses && interiorPoints.length > 0; pass += 1) {
    const relaxed = relaxInteriorPoints({
      boundaryCount: input.boundaryPoints.length,
      points: lastTriangulation.orderedPixelPoints,
      triangles: lastTriangulation.triangles
    });
    const nextTriangulation = triangulateConstrained(input.boundaryPoints, relaxed);
    if (nextTriangulation === undefined) {
      break;
    }

    interiorPoints = relaxed;
    lastTriangulation = nextTriangulation;
  }

  return {
    points: lastTriangulation.orderedPixelPoints,
    interiorPoints,
    triangles: lastTriangulation.triangles
  };
};

interface ConstrainedTriangulation {
  readonly orderedPixelPoints: readonly V7PixelPoint[];
  readonly triangles: readonly (readonly [number, number, number])[];
}

const triangulateConstrained = (
  boundaryPoints: readonly GeometryPoint[],
  interiorPoints: readonly GeometryPoint[]
): ConstrainedTriangulation | undefined => {
  const orderedPixelPoints: V7PixelPoint[] = [
    ...boundaryPoints.map((point, index) => ({
      x: point.x,
      y: point.y,
      role: "boundary" as const,
      stableOrder: index
    })),
    ...interiorPoints.map((point, index) => ({
      x: point.x,
      y: point.y,
      role: "interior" as const,
      stableOrder: index
    }))
  ];
  if (orderedPixelPoints.length < 3) {
    return undefined;
  }

  const constraintEdges: [number, number][] = boundaryPoints.map(
    (_point, index) => [index, (index + 1) % boundaryPoints.length]
  );

  let delaunay: Delaunator<Float64Array<ArrayBuffer>>;
  let constrainer: Constrainautor;
  try {
    delaunay = Delaunator.from(
      orderedPixelPoints,
      (point) => point.x,
      (point) => point.y
    );
    constrainer = new Constrainautor(delaunay);
    if (constrainer.untriangulatedPoints().length > 0) {
      return undefined;
    }

    constrainer.constrainAll(constraintEdges);
  } catch {
    return undefined;
  }

  const rawTriangles = toTriangleTriples(delaunay.triangles);
  const filtered = filterTrianglesInsideBoundary({
    points: orderedPixelPoints,
    triangles: rawTriangles,
    boundaryCount: boundaryPoints.length
  });
  if (filtered.length === 0) {
    return undefined;
  }

  return {
    orderedPixelPoints,
    triangles: normalizeTriangles(filtered, orderedPixelPoints)
  };
};

/**
 * Move each interior point to the centroid of the incident triangle centroids
 * (a Lloyd relaxation step); boundary points are held fixed. Deterministic:
 * incident triangles are visited in triangle order.
 */
const relaxInteriorPoints = (input: {
  readonly boundaryCount: number;
  readonly points: readonly V7PixelPoint[];
  readonly triangles: readonly (readonly [number, number, number])[];
}): readonly GeometryPoint[] => {
  const accumulators = new Map<number, { sumX: number; sumY: number; count: number }>();
  for (const triangle of input.triangles) {
    const centroid = {
      x: (mustGet(input.points, triangle[0]).x +
        mustGet(input.points, triangle[1]).x +
        mustGet(input.points, triangle[2]).x) / 3,
      y: (mustGet(input.points, triangle[0]).y +
        mustGet(input.points, triangle[1]).y +
        mustGet(input.points, triangle[2]).y) / 3
    };
    for (const vertexIndex of triangle) {
      if (vertexIndex < input.boundaryCount) {
        continue;
      }

      const accumulator = accumulators.get(vertexIndex) ?? { sumX: 0, sumY: 0, count: 0 };
      accumulator.sumX += centroid.x;
      accumulator.sumY += centroid.y;
      accumulator.count += 1;
      accumulators.set(vertexIndex, accumulator);
    }
  }

  const relaxed: GeometryPoint[] = [];
  for (let index = input.boundaryCount; index < input.points.length; index += 1) {
    const original = mustGet(input.points, index);
    const accumulator = accumulators.get(index);
    if (accumulator === undefined || accumulator.count === 0) {
      relaxed.push(roundPixelPoint({ x: original.x, y: original.y }));
      continue;
    }

    relaxed.push(
      roundPixelPoint({
        x: accumulator.sumX / accumulator.count,
        y: accumulator.sumY / accumulator.count
      })
    );
  }

  return dedupePixelPoints(relaxed);
};

const dedupePixelPoints = (points: readonly GeometryPoint[]): readonly GeometryPoint[] => {
  const seen = new Set<string>();
  const deduped: GeometryPoint[] = [];
  for (const point of points) {
    const key = pointKey(point);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(point);
  }

  return deduped;
};

const filterTrianglesInsideBoundary = (input: {
  readonly points: readonly V7PixelPoint[];
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly boundaryCount: number;
}): readonly [number, number, number][] => {
  const boundary = input.points.slice(0, input.boundaryCount);
  const filtered: [number, number, number][] = [];

  for (const triangle of input.triangles) {
    if (hasDuplicateTriangleIndex(triangle)) {
      continue;
    }

    if (Math.abs(triangleAreaByIndex(input.points, triangle)) <= TRIANGLE_AREA_EPSILON) {
      continue;
    }

    const a = mustGet(input.points, triangle[0]);
    const b = mustGet(input.points, triangle[1]);
    const c = mustGet(input.points, triangle[2]);
    const centroid = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
    if (!isPointInsidePolygon(boundary, centroid)) {
      continue;
    }

    filtered.push([triangle[0], triangle[1], triangle[2]]);
  }

  return filtered;
};

const isPointInsidePolygon = (
  polygon: readonly GeometryPoint[],
  point: GeometryPoint
): boolean => {
  let inside = false;
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = mustGet(polygon, index);
    const previous = mustGet(polygon, previousIndex);
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

const toTriangleTriples = (
  triangles: ArrayLike<number>
): readonly (readonly [number, number, number])[] => {
  const triples: [number, number, number][] = [];
  for (let index = 0; index + 2 < triangles.length; index += 3) {
    triples.push([triangles[index] ?? 0, triangles[index + 1] ?? 0, triangles[index + 2] ?? 0]);
  }

  return triples;
};

const normalizeTriangles = (
  triangles: readonly (readonly [number, number, number])[],
  points: readonly V7PixelPoint[]
): readonly (readonly [number, number, number])[] =>
  triangles
    .map((triangle) => orientTrianglePositive(points, triangle))
    .sort((left, right) => left[0] - right[0] || left[1] - right[1] || left[2] - right[2]);

const orientTrianglePositive = (
  points: readonly V7PixelPoint[],
  triangle: readonly [number, number, number]
): readonly [number, number, number] =>
  triangleAreaByIndex(points, triangle) < 0
    ? [triangle[0], triangle[2], triangle[1]]
    : [triangle[0], triangle[1], triangle[2]];

const hasDuplicateTriangleIndex = (triangle: readonly [number, number, number]): boolean =>
  triangle[0] === triangle[1] || triangle[1] === triangle[2] || triangle[2] === triangle[0];

const triangleAreaByIndex = (
  points: readonly V7PixelPoint[],
  triangle: readonly [number, number, number]
): number => {
  const a = mustGet(points, triangle[0]);
  const b = mustGet(points, triangle[1]);
  const c = mustGet(points, triangle[2]);
  return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
};

/** Test-only probe exposing the deterministic pixel-space pipeline output. */
export const probeV7MarginContourPipelineForTest = (input: V7PipelineInput): V7PipelineResult =>
  runV7MarginContourPipeline(input);
