import type { DrawableId, MeshId, ProvenanceId, RectDto, TriangleId } from "@private-2d-rigging-lab/contracts";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";

import type { MeshDensityHint } from "./mesh-generation.js";
import type { AutoOutlineFailureReason } from "./mesh-outline-generation.js";
import {
  computeMeshQualityMetrics,
  type MeshGenerationContourBandMetrics,
  type MeshGenerationQualityMetrics
} from "./mesh-quality-metrics.js";

export interface AutoOutlineV4ContourBandMeshInput {
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

export type AutoOutlineV4ContourBandFailureReason =
  | AutoOutlineFailureReason
  | "contour-band-generation-failed"
  | "contour-offset-self-intersection"
  | "interior-fill-failed"
  | "quality-threshold-failed";

export type AutoOutlineV4ContourBandMeshResult =
  | {
      readonly status: "generated";
      readonly mesh: MeshDto;
      readonly alphaBounds: RectDto;
      readonly contourLoopCount: number;
      readonly contourBandMetrics: MeshGenerationContourBandMetrics;
      readonly qualityMetrics: MeshGenerationQualityMetrics;
    }
  | {
      readonly status: "failed";
      readonly reason: AutoOutlineV4ContourBandFailureReason;
      readonly alphaBounds?: RectDto;
      readonly contourLoopCount?: number;
      readonly fallbackMetrics?: MeshGenerationContourBandMetrics;
    };

interface PixelBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

interface PixelPoint {
  readonly x: number;
  readonly y: number;
}

interface ContourBandPoint extends PixelPoint {
  readonly kind: "outer-contour" | "inner-contour" | "interior";
  readonly order: number;
}

interface OutlineEdge {
  readonly start: PixelPoint;
  readonly end: PixelPoint;
  readonly direction: Direction;
}

type Direction = 0 | 1 | 2 | 3;

interface DelaunayTriangle {
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

interface V4Config {
  readonly preset: MeshDensityHint;
  readonly targetEdgeLength: number;
  readonly contourSampleSpacing: number;
  readonly contourCurvatureKeep: number;
  readonly contourVertexCap: number;
  readonly outerOffset: number;
  readonly innerOffset: number;
  readonly interiorSpacing: number;
  readonly sampleMinDistance: number;
  readonly softApronMargin: number;
  readonly geometryClampMargin: number;
  readonly maxOuterContourAreaRatio: number;
  readonly maxBoundaryToInteriorEdgeLength: number;
  readonly maxInteriorEdgeLength: number;
  readonly maxTransparentOnlyTriangleRatio: number;
  readonly minTriangleAngleDegrees: number;
  readonly maxVertexValence: number;
  readonly maxVertexCountCap: number;
  readonly maxInteriorPointCount: number;
}

interface ContourBandRings {
  readonly outerContour: readonly PixelPoint[];
  readonly innerContour: readonly PixelPoint[];
  readonly outerOffset: number;
  readonly innerOffset: number;
  readonly outerContourArea: number;
  readonly outerContourAreaRatio: number;
}

interface ContourBandBuild {
  readonly mesh: MeshDto;
  readonly pixelPoints: readonly ContourBandPoint[];
  readonly bandTriangleCount: number;
  readonly interiorTriangleCount: number;
  readonly rejectedDegenerateTriangleCount: number;
  readonly rejectedLongBoundaryToInteriorTriangleCount: number;
  readonly rejectedLongInteriorTriangleCount: number;
  readonly rejectedOutsideInteriorTriangleCount: number;
}

interface V5FragmentBuild {
  readonly build: ContourBandBuild;
  readonly outerRing: readonly PixelPoint[];
  readonly innerRing: readonly PixelPoint[];
  readonly selectedContourVertexCount: number;
  readonly simplifiedContourVertexCount: number;
}

export const createAutoOutlineV4ContourBandMesh = (
  input: AutoOutlineV4ContourBandMeshInput
): AutoOutlineV4ContourBandMeshResult => {
  const width = Math.round(input.textureSize.width);
  const height = Math.round(input.textureSize.height);
  if (width <= 0 || height <= 0 || input.rgbaBytes.byteLength !== width * height * 4) {
    return { status: "failed", reason: "invalid-rgba" };
  }

  const alpha = createAlphaMask(input.rgbaBytes, width, height, input.alphaThreshold ?? 8);
  if (alpha.bounds === undefined || alpha.area <= 0) {
    return { status: "failed", reason: "alpha-empty" };
  }

  const alphaBounds = pixelBoundsToStageRect(alpha.bounds, input.bounds, width, height);
  const densityHint = input.densityHint ?? "low";
  const config = createV4Config(alpha.bounds, densityHint);
  const contourLoops = extractContourLoops(alpha.mask, width, height, alpha.bounds)
    .filter((loop): loop is readonly PixelPoint[] => loop.length >= 3)
    .sort(compareContourLoops);
  const selectedLoops = selectV5ContourLoops(contourLoops, alpha.area, config);

  if (selectedLoops.length === 0) {
    return {
      status: "failed",
      reason: "contour-extraction-failed",
      alphaBounds
    };
  }

  const fragments = selectedLoops
    .map((loop, loopIndex) =>
      createV5RecursiveContourBandFragment({
        input,
        loop,
        loopIndex,
        config,
        mask: alpha.mask,
        width,
        height
      })
    )
    .filter((fragment): fragment is V5FragmentBuild => fragment !== undefined);

  if (fragments.length === 0) {
    return {
      status: "failed",
      reason: "interior-fill-failed",
      alphaBounds,
      contourLoopCount: contourLoops.length
    };
  }

  const built = mergeV5Fragments(input, fragments);
  if (built.mesh.triangles.length === 0) {
    return {
      status: "failed",
      reason: "interior-fill-failed",
      alphaBounds,
      contourLoopCount: contourLoops.length
    };
  }

  const primaryFragment = fragments[0]!;
  const rings: ContourBandRings = {
    outerContour: primaryFragment.outerRing,
    innerContour: primaryFragment.innerRing,
    outerOffset: config.outerOffset,
    innerOffset: config.innerOffset,
    outerContourArea: Math.abs(polygonArea(primaryFragment.outerRing)),
    outerContourAreaRatio: Math.abs(polygonArea(primaryFragment.outerRing)) / Math.max(alpha.area, 1)
  };
  const contourBandMetrics = createContourBandMetrics({
    config,
    alphaArea: alpha.area,
    selectedContourVertexCount: fragments.reduce((sum, fragment) => sum + fragment.selectedContourVertexCount, 0),
    simplifiedContourVertexCount: fragments.reduce((sum, fragment) => sum + fragment.simplifiedContourVertexCount, 0),
    rings,
    interiorPointCount: built.pixelPoints.length,
    build: built,
    mask: alpha.mask,
    width,
    height
  });

  const qualityMetrics = computeMeshQualityMetrics(built.mesh, {
    refinementIterationCount: 0,
    triangulationMode: "interim-delaunay-contour-band-strip",
    contourBandMetrics
  });

  return {
    status: "generated",
    mesh: built.mesh,
    alphaBounds,
    contourLoopCount: contourLoops.length,
    contourBandMetrics,
    qualityMetrics
  };
};

const createV4Config = (bounds: PixelBounds, densityHint: MeshDensityHint): V4Config => {
  const width = Math.max(bounds.right - bounds.left, 1);
  const height = Math.max(bounds.bottom - bounds.top, 1);
  const maxDimension = Math.max(width, height);

  switch (densityHint) {
    case "high": {
      const targetEdgeLength = presetTargetEdgeLength({
        preferred: 48,
        maxDimension
      });
      return {
        preset: "high",
        targetEdgeLength,
        contourSampleSpacing: targetEdgeLength * 0.95,
        contourCurvatureKeep: 0.42,
        contourVertexCap: 96,
        outerOffset: targetEdgeLength * 0.28,
        innerOffset: targetEdgeLength * 0.36,
        interiorSpacing: targetEdgeLength * 0.92,
        sampleMinDistance: targetEdgeLength * 0.52,
        softApronMargin: targetEdgeLength * 0.72,
        geometryClampMargin: targetEdgeLength * 0.64,
        maxOuterContourAreaRatio: 2.05,
        maxBoundaryToInteriorEdgeLength: targetEdgeLength * 2.35,
        maxInteriorEdgeLength: targetEdgeLength * 2.8,
        maxTransparentOnlyTriangleRatio: 0.32,
        minTriangleAngleDegrees: 10,
        maxVertexValence: 12,
        maxVertexCountCap: 220,
        maxInteriorPointCount: 140
      };
    }
    case "medium": {
      const targetEdgeLength = presetTargetEdgeLength({
        preferred: 66,
        maxDimension
      });
      return {
        preset: "medium",
        targetEdgeLength,
        contourSampleSpacing: targetEdgeLength * 1.05,
        contourCurvatureKeep: 0.46,
        contourVertexCap: 80,
        outerOffset: targetEdgeLength * 0.24,
        innerOffset: targetEdgeLength * 0.34,
        interiorSpacing: targetEdgeLength * 0.98,
        sampleMinDistance: targetEdgeLength * 0.54,
        softApronMargin: targetEdgeLength * 0.78,
        geometryClampMargin: targetEdgeLength * 0.7,
        maxOuterContourAreaRatio: 1.9,
        maxBoundaryToInteriorEdgeLength: targetEdgeLength * 2.4,
        maxInteriorEdgeLength: targetEdgeLength * 2.85,
        maxTransparentOnlyTriangleRatio: 0.32,
        minTriangleAngleDegrees: 10,
        maxVertexValence: 12,
        maxVertexCountCap: 170,
        maxInteriorPointCount: 100
      };
    }
    case "low":
    default: {
      const targetEdgeLength = presetTargetEdgeLength({
        preferred: 86,
        maxDimension
      });
      return {
        preset: "low",
        targetEdgeLength,
        contourSampleSpacing: targetEdgeLength * 1.16,
        contourCurvatureKeep: 0.5,
        contourVertexCap: 64,
        outerOffset: targetEdgeLength * 0.2,
        innerOffset: targetEdgeLength * 0.32,
        interiorSpacing: targetEdgeLength * 1.08,
        sampleMinDistance: targetEdgeLength * 0.58,
        softApronMargin: targetEdgeLength * 0.84,
        geometryClampMargin: targetEdgeLength * 0.76,
        maxOuterContourAreaRatio: 1.78,
        maxBoundaryToInteriorEdgeLength: targetEdgeLength * 2.45,
        maxInteriorEdgeLength: targetEdgeLength * 2.95,
        maxTransparentOnlyTriangleRatio: 0.32,
        minTriangleAngleDegrees: 10,
        maxVertexValence: 12,
        maxVertexCountCap: 130,
        maxInteriorPointCount: 72
      };
    }
  }
};

const presetTargetEdgeLength = (input: {
  readonly preferred: number;
  readonly maxDimension: number;
}): number => {
  const scale = input.preferred <= 50
    ? 0.3
    : input.preferred <= 70
      ? 0.42
      : 0.56;
  return roundCoordinate(Math.max(8, Math.min(input.preferred, input.maxDimension * scale)));
};

const selectV5ContourLoops = (
  loops: readonly (readonly PixelPoint[])[],
  alphaArea: number,
  config: V4Config
): readonly (readonly PixelPoint[])[] => {
  const primary = loops[0];
  if (primary === undefined) {
    return [];
  }

  const primarySign = Math.sign(polygonArea(primary)) || 1;
  const minArea = Math.max(4, alphaArea * 0.00004, config.targetEdgeLength * config.targetEdgeLength * 0.004);
  return loops
    .filter((loop) => Math.sign(polygonArea(loop)) === primarySign || Math.sign(polygonArea(loop)) === 0)
    .filter((loop) => Math.abs(polygonArea(loop)) >= minArea)
    .slice(0, 24);
};

const createV5RecursiveContourBandFragment = (input: {
  readonly input: AutoOutlineV4ContourBandMeshInput;
  readonly loop: readonly PixelPoint[];
  readonly loopIndex: number;
  readonly config: V4Config;
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
}): V5FragmentBuild | undefined => {
  const contour = resampleContourLoop(input.loop, input.config);
  if (contour.length < 3) {
    return undefined;
  }

  const rings = createV5RecursiveRings({
    contour,
    config: input.config,
    width: input.width,
    height: input.height
  });
  if (rings.length < 2) {
    return undefined;
  }

  const build = createV5MeshFromRings({
    input: input.input,
    width: input.width,
    height: input.height,
    loopIndex: input.loopIndex,
    rings
  });

  return build.mesh.triangles.length === 0
    ? undefined
    : {
        build,
        outerRing: rings[0]!,
        innerRing: rings[1]!,
        selectedContourVertexCount: input.loop.length,
        simplifiedContourVertexCount: contour.length
      };
};

const createV5RecursiveRings = (input: {
  readonly contour: readonly PixelPoint[];
  readonly config: V4Config;
  readonly width: number;
  readonly height: number;
}): readonly (readonly PixelPoint[])[] => {
  const center = polygonCentroid(input.contour);
  const initial = createV5InitialContourBandRings({
    contour: input.contour,
    center,
    config: input.config,
    width: input.width,
    height: input.height
  });
  if (initial === undefined) {
    return [];
  }

  const rings: PixelPoint[][] = [initial.outerRing, initial.innerRing];
  const step = input.config.targetEdgeLength * 0.82;
  let current = initial.innerRing;
  for (let ringIndex = 0; ringIndex < 8; ringIndex += 1) {
    if (averageDistanceToPoint(current, center) <= step * 1.25) {
      break;
    }

    const next = current.map((point) => moveToward(point, center, step));
    if (
      !isUsableRing(next, input.config.targetEdgeLength * 0.08) ||
      Math.abs(polygonArea(next)) >= Math.abs(polygonArea(current)) * 0.92 ||
      hasSelfIntersections(next)
    ) {
      break;
    }

    rings.push(next);
    current = next;
  }

  return rings;
};

const createV5InitialContourBandRings = (input: {
  readonly contour: readonly PixelPoint[];
  readonly center: PixelPoint;
  readonly config: V4Config;
  readonly width: number;
  readonly height: number;
}): { readonly outerRing: PixelPoint[]; readonly innerRing: PixelPoint[] } | undefined => {
  for (const factor of [1, 0.78, 0.56, 0.38, 0.22] as const) {
    const outerRing = input.contour.map((point) =>
      offsetPointFromReferenceCenter({
        point,
        center: input.center,
        distance: input.config.outerOffset * factor,
        width: input.width,
        height: input.height,
        margin: input.config.geometryClampMargin
      })
    );
    const innerRing = input.contour.map((point) =>
      offsetPointFromReferenceCenter({
        point,
        center: input.center,
        distance: -input.config.innerOffset * factor,
        width: input.width,
        height: input.height,
        margin: 0
      })
    );

    if (
      isUsableRing(outerRing, input.config.targetEdgeLength * 0.08) &&
      isUsableRing(innerRing, input.config.targetEdgeLength * 0.08) &&
      !hasSelfIntersections(outerRing) &&
      !hasSelfIntersections(innerRing)
    ) {
      return { outerRing, innerRing };
    }
  }

  return undefined;
};

const createV5MeshFromRings = (input: {
  readonly input: AutoOutlineV4ContourBandMeshInput;
  readonly width: number;
  readonly height: number;
  readonly loopIndex: number;
  readonly rings: readonly (readonly PixelPoint[])[];
}): ContourBandBuild => {
  const token = stripIdPrefix(input.input.drawableId, "draw_");
  const pixelPoints: ContourBandPoint[] = [];
  const ringIndices: number[][] = [];
  const vertices: MeshDto["vertices"] = [];
  const uvs: MeshDto["uvs"] = [];
  const vertexStableIds: string[] = [];
  const triangles: MeshDto["triangles"] = [];
  const triangleStableIds: TriangleId[] = [];
  let bandTriangleCount = 0;
  let interiorTriangleCount = 0;
  let rejectedDegenerateTriangleCount = 0;

  input.rings.forEach((ring, ringIndex) => {
    const indices: number[] = [];
    ring.forEach((point, pointIndex) => {
      const kind: ContourBandPoint["kind"] =
        ringIndex === 0 ? "outer-contour" : ringIndex === 1 ? "inner-contour" : "interior";
      const geometry = {
        x: point.x / input.width,
        y: point.y / input.height
      };
      const uv = {
        x: roundCoordinate(clamp(geometry.x, 0, 1)),
        y: roundCoordinate(clamp(geometry.y, 0, 1))
      };
      indices.push(pixelPoints.length);
      pixelPoints.push({
        ...point,
        kind,
        order: pointIndex
      });
      vertices.push({
        x: roundCoordinate(input.input.bounds.x + input.input.bounds.width * geometry.x),
        y: roundCoordinate(input.input.bounds.y + input.input.bounds.height * geometry.y)
      });
      uvs.push(uv);
      vertexStableIds.push(
        `vtx_${token}_outline_v4_contour_band_${stableKind(kind)}_${input.loopIndex}_${ringIndex}_${pointIndex}`
      );
    });
    ringIndices.push(indices);
  });

  const addTriangle = (
    indices: readonly [number, number, number],
    kind: "band" | "interior"
  ) => {
    const oriented = orientTriangle(pixelPoints, {
      a: indices[0],
      b: indices[1],
      c: indices[2]
    });
    if (Math.abs(signedTriangleArea(pixelPoints, oriented)) <= 0.000001) {
      rejectedDegenerateTriangleCount += 1;
      return;
    }

    triangles.push([oriented.a, oriented.b, oriented.c]);
    triangleStableIds.push(
      `tri_${token}_outline_v5_loop_${input.loopIndex}_${kind}_${triangles.length}` as TriangleId
    );
    if (kind === "band") {
      bandTriangleCount += 1;
    } else {
      interiorTriangleCount += 1;
    }
  };

  for (let ringIndex = 0; ringIndex < ringIndices.length - 1; ringIndex += 1) {
    connectV5Rings({
      outerRing: ringIndices[ringIndex]!,
      innerRing: ringIndices[ringIndex + 1]!,
      points: pixelPoints,
      kind: ringIndex === 0 ? "band" : "interior",
      addTriangle
    });
  }

  const lastRing = ringIndices[ringIndices.length - 1]!;
  const center = polygonCentroid(lastRing.map((index) => pixelPoints[index]!));
  const centerIndex = pixelPoints.length;
  const centerGeometry = {
    x: center.x / input.width,
    y: center.y / input.height
  };
  pixelPoints.push({
    ...center,
    kind: "interior",
    order: 0
  });
  vertices.push({
    x: roundCoordinate(input.input.bounds.x + input.input.bounds.width * centerGeometry.x),
    y: roundCoordinate(input.input.bounds.y + input.input.bounds.height * centerGeometry.y)
  });
  uvs.push({
    x: roundCoordinate(clamp(centerGeometry.x, 0, 1)),
    y: roundCoordinate(clamp(centerGeometry.y, 0, 1))
  });
  vertexStableIds.push(`vtx_${token}_outline_v4_contour_band_interior_${input.loopIndex}_center`);

  for (let pointIndex = 0; pointIndex < lastRing.length; pointIndex += 1) {
    addTriangle(
      [lastRing[pointIndex]!, lastRing[(pointIndex + 1) % lastRing.length]!, centerIndex],
      "interior"
    );
  }

  return {
    mesh: {
      meshId: input.input.meshId,
      drawableId: input.input.drawableId,
      vertices,
      uvs,
      triangles,
      vertexStableIds,
      triangleStableIds,
      topologyRevision: 0,
      bounds: structuredClone(input.input.bounds),
      generationProvenanceId: input.input.provenanceId
    },
    pixelPoints,
    bandTriangleCount,
    interiorTriangleCount,
    rejectedDegenerateTriangleCount,
    rejectedLongBoundaryToInteriorTriangleCount: 0,
    rejectedLongInteriorTriangleCount: 0,
    rejectedOutsideInteriorTriangleCount: 0
  };
};

const connectV5Rings = (input: {
  readonly outerRing: readonly number[];
  readonly innerRing: readonly number[];
  readonly points: readonly PixelPoint[];
  readonly kind: "band" | "interior";
  readonly addTriangle: (
    indices: readonly [number, number, number],
    kind: "band" | "interior"
  ) => void;
}): void => {
  const segmentCount = Math.min(input.outerRing.length, input.innerRing.length);
  for (let pointIndex = 0; pointIndex < segmentCount; pointIndex += 1) {
    const nextIndex = (pointIndex + 1) % segmentCount;
    const outerA = input.outerRing[pointIndex]!;
    const outerB = input.outerRing[nextIndex]!;
    const innerA = input.innerRing[pointIndex]!;
    const innerB = input.innerRing[nextIndex]!;
    const optionA: [[number, number, number], [number, number, number]] = [
      [outerA, innerA, outerB],
      [outerB, innerA, innerB]
    ];
    const optionB: [[number, number, number], [number, number, number]] = [
      [outerA, innerA, innerB],
      [outerA, innerB, outerB]
    ];
    const selected = v5ConnectionScore(input.points, optionA) >= v5ConnectionScore(input.points, optionB)
      ? optionA
      : optionB;
    input.addTriangle(selected[0], input.kind);
    input.addTriangle(selected[1], input.kind);
  }
};

const v5ConnectionScore = (
  points: readonly PixelPoint[],
  option: readonly [[number, number, number], [number, number, number]]
): number => {
  const left = orientTriangle(points, { a: option[0][0], b: option[0][1], c: option[0][2] });
  const right = orientTriangle(points, { a: option[1][0], b: option[1][1], c: option[1][2] });
  return Math.min(
    minTriangleAngleDegrees(points, left),
    minTriangleAngleDegrees(points, right)
  ) - Math.max(
    maxTriangleEdgeLength(points, left),
    maxTriangleEdgeLength(points, right)
  ) * 0.001;
};

const mergeV5Fragments = (
  input: AutoOutlineV4ContourBandMeshInput,
  fragments: readonly V5FragmentBuild[]
): ContourBandBuild => {
  const vertices: MeshDto["vertices"] = [];
  const uvs: MeshDto["uvs"] = [];
  const triangles: MeshDto["triangles"] = [];
  const vertexStableIds: string[] = [];
  const triangleStableIds: TriangleId[] = [];
  const pixelPoints: ContourBandPoint[] = [];
  let bandTriangleCount = 0;
  let interiorTriangleCount = 0;
  let rejectedDegenerateTriangleCount = 0;

  fragments.forEach((fragment) => {
    const vertexOffset = vertices.length;
    vertices.push(...fragment.build.mesh.vertices);
    uvs.push(...fragment.build.mesh.uvs);
    vertexStableIds.push(...fragment.build.mesh.vertexStableIds);
    pixelPoints.push(...fragment.build.pixelPoints);
    triangles.push(
      ...fragment.build.mesh.triangles.map(
        (triangle): [number, number, number] => [
          triangle[0] + vertexOffset,
          triangle[1] + vertexOffset,
          triangle[2] + vertexOffset
        ]
      )
    );
    triangleStableIds.push(
      ...fragment.build.mesh.triangles.map(
        (_triangle, triangleIndex): TriangleId =>
          (fragment.build.mesh.triangleStableIds?.[triangleIndex] ??
            `tri_${stripIdPrefix(input.drawableId, "draw_")}_outline_v5_merged_${triangles.length + triangleIndex}`) as TriangleId
      )
    );
    bandTriangleCount += fragment.build.bandTriangleCount;
    interiorTriangleCount += fragment.build.interiorTriangleCount;
    rejectedDegenerateTriangleCount += fragment.build.rejectedDegenerateTriangleCount;
  });

  return {
    mesh: {
      meshId: input.meshId,
      drawableId: input.drawableId,
      vertices,
      uvs,
      triangles,
      vertexStableIds,
      triangleStableIds,
      topologyRevision: 0,
      bounds: structuredClone(input.bounds),
      generationProvenanceId: input.provenanceId
    },
    pixelPoints,
    bandTriangleCount,
    interiorTriangleCount,
    rejectedDegenerateTriangleCount,
    rejectedLongBoundaryToInteriorTriangleCount: 0,
    rejectedLongInteriorTriangleCount: 0,
    rejectedOutsideInteriorTriangleCount: 0
  };
};

const offsetPointFromReferenceCenter = (input: {
  readonly point: PixelPoint;
  readonly center: PixelPoint;
  readonly distance: number;
  readonly width: number;
  readonly height: number;
  readonly margin: number;
}): PixelPoint => {
  const vector = {
    x: input.point.x - input.center.x,
    y: input.point.y - input.center.y
  };
  const length = Math.hypot(vector.x, vector.y);
  const direction = length <= 0.000001
    ? { x: 1, y: 0 }
    : { x: vector.x / length, y: vector.y / length };
  return clampPixelPointWithMargin(
    {
      x: input.point.x + direction.x * input.distance,
      y: input.point.y + direction.y * input.distance
    },
    input.width,
    input.height,
    input.margin
  );
};

const moveToward = (
  point: PixelPoint,
  target: PixelPoint,
  distanceValue: number
): PixelPoint => {
  const dx = target.x - point.x;
  const dy = target.y - point.y;
  const length = Math.hypot(dx, dy);
  if (length <= distanceValue || length <= 0.000001) {
    return {
      x: roundCoordinate((point.x + target.x) / 2),
      y: roundCoordinate((point.y + target.y) / 2)
    };
  }

  const t = distanceValue / length;
  return {
    x: roundCoordinate(point.x + dx * t),
    y: roundCoordinate(point.y + dy * t)
  };
};

const isUsableRing = (
  ring: readonly PixelPoint[],
  minEdgeLength: number
): boolean =>
  ring.length >= 3 &&
  Math.abs(polygonArea(ring)) > 0.000001 &&
  loopEdgeLengths(ring).every((edgeLength) => edgeLength >= minEdgeLength);

const loopEdgeLengths = (points: readonly PixelPoint[]): readonly number[] =>
  points.map((point, pointIndex) => distance(point, points[(pointIndex + 1) % points.length]!));

const averageDistanceToPoint = (
  points: readonly PixelPoint[],
  target: PixelPoint
): number =>
  points.length === 0
    ? 0
    : points.reduce((sum, point) => sum + distance(point, target), 0) / points.length;

const createAlphaMask = (
  rgbaBytes: Uint8Array,
  width: number,
  height: number,
  alphaThreshold: number
): {
  readonly mask: Uint8Array;
  readonly area: number;
  readonly bounds?: PixelBounds;
} => {
  const mask = new Uint8Array(width * height);
  let area = 0;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if ((rgbaBytes[index * 4 + 3] ?? 0) <= alphaThreshold) {
        continue;
      }

      mask[index] = 1;
      area += 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }

  return right < left || bottom < top
    ? { mask, area }
    : {
        mask,
        area,
        bounds: { left, top, right, bottom }
      };
};

const extractContourLoops = (
  mask: Uint8Array,
  width: number,
  height: number,
  bounds: PixelBounds
): readonly (readonly PixelPoint[])[] => {
  const edges: OutlineEdge[] = [];
  const addEdge = (start: PixelPoint, end: PixelPoint, direction: Direction) => {
    edges.push({ start, end, direction });
  };

  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      if (!isMaskFilled(mask, width, height, x, y)) {
        continue;
      }

      if (!isMaskFilled(mask, width, height, x, y - 1)) {
        addEdge({ x, y }, { x: x + 1, y }, 0);
      }
      if (!isMaskFilled(mask, width, height, x + 1, y)) {
        addEdge({ x: x + 1, y }, { x: x + 1, y: y + 1 }, 1);
      }
      if (!isMaskFilled(mask, width, height, x, y + 1)) {
        addEdge({ x: x + 1, y: y + 1 }, { x, y: y + 1 }, 2);
      }
      if (!isMaskFilled(mask, width, height, x - 1, y)) {
        addEdge({ x, y: y + 1 }, { x, y }, 3);
      }
    }
  }

  edges.sort(compareEdges);
  const outgoing = new Map<string, number[]>();
  edges.forEach((edge, edgeIndex) => {
    const key = pointKey(edge.start);
    const list = outgoing.get(key);
    if (list === undefined) {
      outgoing.set(key, [edgeIndex]);
    } else {
      list.push(edgeIndex);
    }
  });
  for (const list of outgoing.values()) {
    list.sort((left, right) => compareEdges(edges[left]!, edges[right]!));
  }

  const visited = new Uint8Array(edges.length);
  const loops: PixelPoint[][] = [];

  for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
    if (visited[edgeIndex] === 1) {
      continue;
    }

    const start = edges[edgeIndex]!.start;
    const loop: PixelPoint[] = [start];
    let currentIndex = edgeIndex;

    while (visited[currentIndex] === 0) {
      const current = edges[currentIndex]!;
      visited[currentIndex] = 1;
      loop.push(current.end);

      if (pointsEqual(current.end, start)) {
        break;
      }

      const candidates = (outgoing.get(pointKey(current.end)) ?? []).filter(
        (candidateIndex) => visited[candidateIndex] === 0
      );
      if (candidates.length === 0) {
        break;
      }

      currentIndex = chooseNextEdge(edges, candidates, current.direction);
    }

    if (loop.length >= 4 && pointsEqual(loop[0]!, loop[loop.length - 1]!)) {
      loop.pop();
      const cleaned = removeConsecutiveDuplicatePoints(loop);
      if (cleaned.length >= 3 && Math.abs(polygonArea(cleaned)) > 0.000001) {
        loops.push(cleaned);
      }
    }
  }

  return loops;
};

const chooseNextEdge = (
  edges: readonly OutlineEdge[],
  candidateIndices: readonly number[],
  currentDirection: Direction
): number => {
  const preference = [
    ((currentDirection + 1) % 4) as Direction,
    currentDirection,
    ((currentDirection + 3) % 4) as Direction,
    ((currentDirection + 2) % 4) as Direction
  ];

  return [...candidateIndices].sort((leftIndex, rightIndex) => {
    const left = edges[leftIndex]!;
    const right = edges[rightIndex]!;
    const directionOrder =
      preference.indexOf(left.direction) - preference.indexOf(right.direction);
    return directionOrder !== 0 ? directionOrder : compareEdges(left, right);
  })[0]!;
};

const resampleContourLoop = (
  loop: readonly PixelPoint[],
  config: V4Config
): readonly PixelPoint[] => {
  const cleaned = removeConsecutiveDuplicatePoints(loop);
  if (cleaned.length <= 3) {
    return cleaned;
  }

  const rotated = rotatePoints(cleaned, findLexicographicPointIndex(cleaned));
  const perimeter = contourPerimeter(rotated);
  if (perimeter <= 0.000001) {
    return [
      rotated[0]!,
      rotated[Math.floor(rotated.length / 3)]!,
      rotated[Math.floor((rotated.length * 2) / 3)]!
    ];
  }

  const targetCount = clampInt(
    Math.round(perimeter / config.contourSampleSpacing),
    3,
    config.contourVertexCap
  );
  const spacing = perimeter / targetCount;
  const selected: PixelPoint[] = [];
  for (let sampleIndex = 0; sampleIndex < targetCount; sampleIndex += 1) {
    selected.push(pointAtLoopDistance(rotated, sampleIndex * spacing));
  }

  return removeNearDuplicateLoopPoints(selected, spacing * 0.52);
};

const createContourBandRings = (input: {
  readonly contour: readonly PixelPoint[];
  readonly config: V4Config;
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly alphaArea: number;
}): ContourBandRings | undefined => {
  const centroid = polygonCentroid(input.contour);
  const attempts = [1, 0.72, 0.48, 0.25] as const;

  for (const offsetFactor of attempts) {
    const outerOffset = input.config.outerOffset * offsetFactor;
    const innerOffset = input.config.innerOffset * offsetFactor;
    const outerContour = input.contour.map((point) =>
      offsetPointFromCentroid(point, centroid, outerOffset, input.width, input.height)
    );
    const innerContour = input.contour.map((point) =>
      findInnerSupportPoint({
        point,
        centroid,
        mask: input.mask,
        width: input.width,
        height: input.height,
        innerOffset
      })
    );

    if (
      outerContour.length < 3 ||
      innerContour.length < 3 ||
      hasSelfIntersections(outerContour) ||
      hasSelfIntersections(innerContour)
    ) {
      continue;
    }

    const outerContourArea = Math.abs(polygonArea(outerContour));
    const outerContourAreaRatio = outerContourArea / Math.max(input.alphaArea, 1);
    if (outerContourAreaRatio > input.config.maxOuterContourAreaRatio) {
      continue;
    }

    return {
      outerContour,
      innerContour,
      outerOffset,
      innerOffset,
      outerContourArea,
      outerContourAreaRatio
    };
  }

  return undefined;
};

const findInnerSupportPoint = (input: {
  readonly point: PixelPoint;
  readonly centroid: PixelPoint;
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly innerOffset: number;
}): PixelPoint => {
  const dx = input.centroid.x - input.point.x;
  const dy = input.centroid.y - input.point.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.000001) {
    return {
      x: roundCoordinate(clamp(input.point.x, 0, input.width)),
      y: roundCoordinate(clamp(input.point.y, 0, input.height))
    };
  }

  for (const factor of [1, 0.78, 0.55, 0.32, 0.16, 0] as const) {
    const candidate = {
      x: roundCoordinate(clamp(input.point.x + (dx / length) * input.innerOffset * factor, 0, input.width)),
      y: roundCoordinate(clamp(input.point.y + (dy / length) * input.innerOffset * factor, 0, input.height))
    };
    if (isPointInsideAlpha(input.mask, input.width, input.height, candidate)) {
      return candidate;
    }
  }

  return {
    x: roundCoordinate(clamp(input.point.x + (dx / length) * input.innerOffset * 0.32, 0, input.width)),
    y: roundCoordinate(clamp(input.point.y + (dy / length) * input.innerOffset * 0.32, 0, input.height))
  };
};

const sampleInteriorPoints = (input: {
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly bounds: PixelBounds;
  readonly innerContour: readonly PixelPoint[];
  readonly config: V4Config;
  readonly seed: number;
  readonly blockedPoints: readonly ContourBandPoint[];
}): readonly ContourBandPoint[] => {
  const spacing = input.config.interiorSpacing;
  const rowSpacing = spacing * 0.8660254037844386;
  const points: ContourBandPoint[] = [];
  let row = 0;

  for (
    let y = input.bounds.top + spacing * 0.5;
    y < input.bounds.bottom;
    y += rowSpacing
  ) {
    const rowOffset = row % 2 === 0 ? 0 : spacing * 0.5;
    let column = 0;
    for (
      let x = input.bounds.left + spacing * 0.5 + rowOffset;
      x < input.bounds.right;
      x += spacing
    ) {
      const jitter = deterministicJitter(input.seed, row, column, spacing);
      const candidate = {
        x: x + jitter.x,
        y: y + jitter.y
      };
      column += 1;

      if (
        !isPointInsideAlpha(input.mask, input.width, input.height, candidate) ||
        !isPointInsidePolygon(candidate, input.innerContour)
      ) {
        continue;
      }

      if (
        minDistanceToPoints(candidate, [...input.blockedPoints, ...points]) <
        input.config.sampleMinDistance
      ) {
        continue;
      }

      points.push({
        x: roundCoordinate(candidate.x),
        y: roundCoordinate(candidate.y),
        kind: "interior",
        order: points.length
      });

      if (points.length >= input.config.maxInteriorPointCount) {
        return points.sort(compareContourBandPoints);
      }
    }
    row += 1;
  }

  return points.length > 0
    ? points.sort(compareContourBandPoints)
    : sampleFallbackInteriorPoints(input);
};

const sampleFallbackInteriorPoints = (input: {
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly bounds: PixelBounds;
  readonly innerContour: readonly PixelPoint[];
  readonly config: V4Config;
  readonly seed: number;
  readonly blockedPoints: readonly ContourBandPoint[];
}): readonly ContourBandPoint[] => {
  const centroid = polygonCentroid(input.innerContour);
  const radius = input.config.targetEdgeLength * 0.72;
  const candidates: PixelPoint[] = [centroid];
  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI * 2 * index) / 6;
    candidates.push({
      x: centroid.x + Math.cos(angle) * radius,
      y: centroid.y + Math.sin(angle) * radius
    });
  }
  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI * 2 * (index + 0.5)) / 6;
    candidates.push({
      x: centroid.x + Math.cos(angle) * radius * 1.25,
      y: centroid.y + Math.sin(angle) * radius * 1.25
    });
  }

  const points: ContourBandPoint[] = [];
  for (const candidate of candidates) {
    const clamped = {
      x: roundCoordinate(clamp(candidate.x, input.bounds.left, input.bounds.right)),
      y: roundCoordinate(clamp(candidate.y, input.bounds.top, input.bounds.bottom))
    };
    if (
      !isPointInsideAlpha(input.mask, input.width, input.height, clamped) ||
      !isPointInsidePolygon(clamped, input.innerContour)
    ) {
      continue;
    }

    if (
      minDistanceToPoints(clamped, [...input.blockedPoints, ...points]) <
      input.config.sampleMinDistance * 0.45
    ) {
      continue;
    }

    points.push({
      ...clamped,
      kind: "interior",
      order: points.length
    });
  }

  return points.sort(compareContourBandPoints);
};

const createContourCentroidBandMesh = (input: {
  readonly input: AutoOutlineV4ContourBandMeshInput;
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly bounds: PixelBounds;
  readonly config: V4Config;
  readonly contour: readonly PixelPoint[];
}): ContourBandBuild | undefined => {
  const contour = resampleContourLoop(input.contour, input.config);
  if (contour.length < 3) {
    return undefined;
  }

  const rings = createNormalContourBandRings({
    contour,
    config: input.config,
    mask: input.mask,
    width: input.width,
    height: input.height
  });
  if (rings === undefined) {
    return undefined;
  }

  const seedPoint = findSeedGrowthPoint({
    contour,
    mask: input.mask,
    width: input.width,
    height: input.height,
    bounds: input.bounds,
    config: input.config
  });
  const outerPoints = rings.outerContour.map(
    (point, pointIndex): ContourBandPoint => ({
      ...point,
      kind: "outer-contour",
      order: pointIndex
    })
  );
  const innerPoints = rings.innerContour.map(
    (point, pointIndex): ContourBandPoint => ({
      ...point,
      kind: "inner-contour",
      order: pointIndex
    })
  );
  const interiorPoints = createSeedGrowthInteriorPoints({
    seedPoint,
    contour,
    innerContour: rings.innerContour,
    mask: input.mask,
    width: input.width,
    height: input.height,
    bounds: input.bounds,
    config: input.config,
    seed: createSamplerSeed(input.input, input.width, input.height),
    blockedPoints: [...outerPoints, ...innerPoints]
  });

  const built = createContourBandMesh({
    input: input.input,
    width: input.width,
    height: input.height,
    mask: input.mask,
    config: input.config,
    outerPoints,
    innerPoints,
    interiorPoints,
    alphaContour: contour,
    outerContour: rings.outerContour,
    innerContour: rings.innerContour
  });

  return built.mesh.triangles.length > 0 ? compactContourBandBuild(built, input.input) : undefined;
};

const createNormalContourBandRings = (input: {
  readonly contour: readonly PixelPoint[];
  readonly config: V4Config;
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
}): ContourBandRings | undefined => {
  const centroid = polygonCentroid(input.contour);

  for (const factor of [1, 0.78, 0.55, 0.34] as const) {
    const outerOffset = input.config.outerOffset * factor;
    const innerOffset = input.config.innerOffset * factor;
    const frames = input.contour.map((point, pointIndex) =>
      contourFrame(
        point,
        input.contour[(pointIndex - 1 + input.contour.length) % input.contour.length]!,
        input.contour[(pointIndex + 1) % input.contour.length]!,
        centroid
      )
    );
    const outerContour = input.contour.map((point, pointIndex) => {
      const normal = frames[pointIndex]!.normal;
      return clampPixelPointWithMargin(
        {
          x: point.x - normal.x * outerOffset,
          y: point.y - normal.y * outerOffset
        },
        input.width,
        input.height,
        input.config.geometryClampMargin
      );
    });
    const innerContour = input.contour.map((point, pointIndex) => {
      const normal = frames[pointIndex]!.normal;
      for (const innerFactor of [1, 0.72, 0.48, 0.24, 0] as const) {
        const candidate = clampPixelPoint(
          {
            x: point.x + normal.x * innerOffset * innerFactor,
            y: point.y + normal.y * innerOffset * innerFactor
          },
          input.width,
          input.height
        );
        if (isPointInsideAlpha(input.mask, input.width, input.height, candidate)) {
          return candidate;
        }
      }

      return clampPixelPoint(point, input.width, input.height);
    });

    if (
      outerContour.length >= 3 &&
      innerContour.length >= 3 &&
      !hasSelfIntersections(outerContour) &&
      !hasSelfIntersections(innerContour)
    ) {
      const outerContourArea = Math.abs(polygonArea(outerContour));
      return {
        outerContour,
        innerContour,
        outerOffset,
        innerOffset,
        outerContourArea,
        outerContourAreaRatio: outerContourArea / Math.max(Math.abs(polygonArea(input.contour)), 1)
      };
    }
  }

  return undefined;
};

const findSeedGrowthPoint = (input: {
  readonly contour: readonly PixelPoint[];
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly bounds: PixelBounds;
  readonly config: V4Config;
}): PixelPoint => {
  const preferred = clampPixelPoint(polygonCentroid(input.contour), input.width, input.height);
  if (
    isPointInsideAlpha(input.mask, input.width, input.height, preferred) &&
    isPointInsidePolygon(preferred, input.contour)
  ) {
    return preferred;
  }

  const boundsCenter = clampPixelPoint(
    {
      x: (input.bounds.left + input.bounds.right) / 2,
      y: (input.bounds.top + input.bounds.bottom) / 2
    },
    input.width,
    input.height
  );
  if (
    isPointInsideAlpha(input.mask, input.width, input.height, boundsCenter) &&
    isPointInsidePolygon(boundsCenter, input.contour)
  ) {
    return boundsCenter;
  }

  const step = clamp(input.config.targetEdgeLength * 0.5, 6, 32);
  const maxRadius = Math.max(
    input.bounds.right - input.bounds.left,
    input.bounds.bottom - input.bounds.top
  );
  const maxRing = clampInt(Math.ceil(maxRadius / Math.max(step, 1)), 1, 48);
  for (let ring = 1; ring <= maxRing; ring += 1) {
    const radius = ring * step;
    const sampleCount = Math.max(8, Math.ceil((Math.PI * 2 * radius) / step));
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const angle = (Math.PI * 2 * sampleIndex) / sampleCount;
      const candidate = clampPixelPoint(
        {
          x: preferred.x + Math.cos(angle) * radius,
          y: preferred.y + Math.sin(angle) * radius
        },
        input.width,
        input.height
      );
      if (
        isPointInsideAlpha(input.mask, input.width, input.height, candidate) &&
        isPointInsidePolygon(candidate, input.contour)
      ) {
        return candidate;
      }
    }
  }

  return preferred;
};

const createSeedGrowthInteriorPoints = (input: {
  readonly seedPoint: PixelPoint;
  readonly contour: readonly PixelPoint[];
  readonly innerContour: readonly PixelPoint[];
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly bounds: PixelBounds;
  readonly config: V4Config;
  readonly seed: number;
  readonly blockedPoints: readonly ContourBandPoint[];
}): readonly ContourBandPoint[] => {
  const spacing = input.config.interiorSpacing;
  const axisAngle = principalAxisAngle(input.contour) + Math.PI / 9;
  const basisA = {
    x: Math.cos(axisAngle) * spacing,
    y: Math.sin(axisAngle) * spacing
  };
  const basisB = {
    x: Math.cos(axisAngle + Math.PI / 3) * spacing,
    y: Math.sin(axisAngle + Math.PI / 3) * spacing
  };
  const points: ContourBandPoint[] = [];
  const acceptedForSpacing: PixelPoint[] = [...input.blockedPoints];
  const boundaryPadding = spacing * 0.18;
  const acceptPoint = (candidate: PixelPoint): boolean => {
    if (points.length >= input.config.maxInteriorPointCount) {
      return false;
    }

    const point = clampPixelPoint(candidate, input.width, input.height);
    const insideAlphaOrApron = isPointInsideAlphaOrApron({
      mask: input.mask,
      width: input.width,
      height: input.height,
      point,
      contour: input.contour,
      margin: input.config.softApronMargin
    });
    const insideInteriorArea =
      isPointInsidePolygon(point, input.innerContour) ||
      distanceToContour(point, input.contour) <= input.config.softApronMargin * 0.62;
    if (
      !insideAlphaOrApron ||
      !insideInteriorArea ||
      distanceToContour(point, input.contour) < boundaryPadding ||
      minSquaredDistanceToPoints(point, acceptedForSpacing) <
        (input.config.sampleMinDistance * 0.72) ** 2
    ) {
      return false;
    }

    points.push({
      ...point,
      kind: "interior",
      order: points.length
    });
    acceptedForSpacing.push(point);
    return true;
  };

  const seedRadius = spacing / Math.sqrt(3);
  let seedTriangleCount = 0;
  for (let pointIndex = 0; pointIndex < 3; pointIndex += 1) {
    const angle = axisAngle + pointIndex * (Math.PI * 2 / 3);
    if (
      acceptPoint({
        x: input.seedPoint.x + Math.cos(angle) * seedRadius,
        y: input.seedPoint.y + Math.sin(angle) * seedRadius
      })
    ) {
      seedTriangleCount += 1;
    }
  }
  if (seedTriangleCount < 3) {
    acceptPoint(input.seedPoint);
  }

  const maxDimension = Math.max(
    input.bounds.right - input.bounds.left,
    input.bounds.bottom - input.bounds.top
  );
  const maxRange = clampInt(Math.ceil(maxDimension / Math.max(spacing, 1)) + 4, 2, 96);
  for (let ring = 1; ring <= maxRange && points.length < input.config.maxInteriorPointCount; ring += 1) {
    for (const axial of hexRingCoordinates(ring)) {
      if (points.length >= input.config.maxInteriorPointCount) {
        break;
      }

      const jitter = deterministicJitter(input.seed, axial.q + maxRange, axial.r + maxRange, spacing);
      acceptPoint({
        x: input.seedPoint.x + axial.q * basisA.x + axial.r * basisB.x + jitter.x * 0.38,
        y: input.seedPoint.y + axial.q * basisA.y + axial.r * basisB.y + jitter.y * 0.38
      });
    }
  }

  return points.sort(compareContourBandPoints);
};

const hexRingCoordinates = (
  ring: number
): readonly { readonly q: number; readonly r: number }[] => {
  if (ring <= 0) {
    return [{ q: 0, r: 0 }];
  }

  const directions = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 }
  ] as const;
  const coordinates: { q: number; r: number }[] = [];
  let q = -ring;
  let r = ring;
  for (const direction of directions) {
    for (let step = 0; step < ring; step += 1) {
      coordinates.push({ q, r });
      q += direction.q;
      r += direction.r;
    }
  }

  return coordinates;
};

const principalAxisAngle = (points: readonly PixelPoint[]): number => {
  if (points.length === 0) {
    return 0;
  }

  const center = polygonCentroid(points);
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (const point of points) {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  }

  return Math.atan2(2 * xy, xx - yy) / 2;
};

const compactContourBandBuild = (
  build: ContourBandBuild,
  input: AutoOutlineV4ContourBandMeshInput
): ContourBandBuild => {
  const usedIndices = [...new Set(build.mesh.triangles.flatMap((triangle) => triangle))]
    .sort((leftIndex, rightIndex) => leftIndex - rightIndex);
  if (usedIndices.length === build.mesh.vertices.length) {
    return build;
  }

  const remap = new Map<number, number>();
  const pixelPoints: ContourBandPoint[] = [];
  const vertices: MeshDto["vertices"] = [];
  const uvs: MeshDto["uvs"] = [];
  const vertexStableIds: string[] = [];
  usedIndices.forEach((sourceIndex, targetIndex) => {
    remap.set(sourceIndex, targetIndex);
    const point = build.pixelPoints[sourceIndex]!;
    pixelPoints.push({
      ...point,
      order: targetIndex
    });
    vertices.push(build.mesh.vertices[sourceIndex]!);
    uvs.push(build.mesh.uvs[sourceIndex]!);
    vertexStableIds.push(build.mesh.vertexStableIds[sourceIndex] ?? `vtx_${input.drawableId}_${targetIndex}`);
  });

  const triangles = build.mesh.triangles.map(
    (triangle): [number, number, number] => [
      remap.get(triangle[0])!,
      remap.get(triangle[1])!,
      remap.get(triangle[2])!
    ]
  );

  return {
    ...build,
    mesh: {
      ...build.mesh,
      vertices,
      uvs,
      triangles,
      vertexStableIds
    },
    pixelPoints
  };
};

const connectRings = (input: {
  readonly innerRing: readonly number[];
  readonly outerRing: readonly number[];
  readonly kind: "boundary" | "interior";
  readonly points: readonly ContourBandPoint[];
  readonly addTriangle: (
    indices: readonly [number, number, number],
    kind: "boundary" | "interior"
  ) => void;
}): void => {
  const segmentCount = Math.min(input.innerRing.length, input.outerRing.length);
  for (let pointIndex = 0; pointIndex < segmentCount; pointIndex += 1) {
    const nextIndex = (pointIndex + 1) % segmentCount;
    const innerA = input.innerRing[pointIndex]!;
    const innerB = input.innerRing[nextIndex]!;
    const outerA = input.outerRing[pointIndex]!;
    const outerB = input.outerRing[nextIndex]!;
    const diagonalInnerAOuterB = distance(input.points[innerA]!, input.points[outerB]!);
    const diagonalOuterAInnerB = distance(input.points[outerA]!, input.points[innerB]!);

    if (diagonalInnerAOuterB <= diagonalOuterAInnerB) {
      input.addTriangle([innerA, outerA, outerB], input.kind);
      input.addTriangle([innerA, outerB, innerB], input.kind);
    } else {
      input.addTriangle([innerA, outerA, innerB], input.kind);
      input.addTriangle([innerB, outerA, outerB], input.kind);
    }
  }
};

const createTriangularLatticeMesh = (input: {
  readonly input: AutoOutlineV4ContourBandMeshInput;
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly bounds: PixelBounds;
  readonly config: V4Config;
  readonly contour: readonly PixelPoint[];
}): ContourBandBuild | undefined => {
  const token = stripIdPrefix(input.input.drawableId, "draw_");
  const spacing = input.config.targetEdgeLength;
  const rowSpacing = spacing * 0.8660254037844386;
  const apron = spacing * 0.85;
  const left = clamp(input.bounds.left - apron, 0, input.width);
  const top = clamp(input.bounds.top - apron, 0, input.height);
  const right = clamp(input.bounds.right + apron, 0, input.width);
  const bottom = clamp(input.bounds.bottom + apron, 0, input.height);
  const rows: number[][] = [];
  const latticePoints: ContourBandPoint[] = [];
  let order = 0;
  let rowIndex = 0;

  for (let y = top; y <= bottom + rowSpacing * 0.5; y += rowSpacing) {
    const row: number[] = [];
    const rowOffset = rowIndex % 2 === 0 ? 0 : spacing * 0.5;
    for (let x = left - spacing; x <= right + spacing; x += spacing) {
      const point = {
        x: roundCoordinate(clamp(x + rowOffset, 0, input.width)),
        y: roundCoordinate(clamp(y, 0, input.height)),
        kind: "interior" as const,
        order
      };
      order += 1;
      if (row.length > 0 && pointsEqual(latticePoints[row[row.length - 1]!]!, point)) {
        continue;
      }
      row.push(latticePoints.length);
      latticePoints.push(point);
    }
    if (row.length >= 2) {
      rows.push(row);
    }
    rowIndex += 1;
  }

  const acceptedTriangles: DelaunayTriangle[] = [];
  let bandTriangleCount = 0;
  let interiorTriangleCount = 0;
  let rejectedDegenerateTriangleCount = 0;
  let rejectedOutsideInteriorTriangleCount = 0;

  const addIfAccepted = (triangle: DelaunayTriangle) => {
    const oriented = orientTriangle(latticePoints, triangle);
    if (Math.abs(signedTriangleArea(latticePoints, oriented)) <= 0.000001) {
      rejectedDegenerateTriangleCount += 1;
      return;
    }

    const classification = classifyLatticeTriangle({
      points: latticePoints,
      triangle: oriented,
      mask: input.mask,
      width: input.width,
      height: input.height,
      contour: input.contour,
      targetEdgeLength: spacing
    });
    if (classification === "outside") {
      rejectedOutsideInteriorTriangleCount += 1;
      return;
    }

    acceptedTriangles.push(oriented);
    if (classification === "boundary") {
      bandTriangleCount += 1;
    } else {
      interiorTriangleCount += 1;
    }
  };

  for (let index = 0; index < rows.length - 1; index += 1) {
    const upper = rows[index]!;
    const lower = rows[index + 1]!;
    const limit = Math.min(upper.length, lower.length) - 1;
    for (let column = 0; column < limit; column += 1) {
      if (index % 2 === 0) {
        addIfAccepted({ a: upper[column]!, b: lower[column]!, c: upper[column + 1]! });
        addIfAccepted({ a: upper[column + 1]!, b: lower[column]!, c: lower[column + 1]! });
      } else {
        addIfAccepted({ a: lower[column]!, b: upper[column]!, c: lower[column + 1]! });
        addIfAccepted({ a: upper[column]!, b: upper[column + 1]!, c: lower[column + 1]! });
      }
    }
  }

  if (acceptedTriangles.length === 0) {
    return undefined;
  }

  const usedIndices = [...new Set(acceptedTriangles.flatMap((triangle) => [triangle.a, triangle.b, triangle.c]))]
    .sort((leftIndex, rightIndex) => leftIndex - rightIndex);
  const remap = new Map<number, number>();
  const pixelPoints: ContourBandPoint[] = [];
  const vertices: MeshDto["vertices"] = [];
  const uvs: MeshDto["uvs"] = [];
  const vertexStableIds: string[] = [];

  usedIndices.forEach((sourceIndex, targetIndex) => {
    remap.set(sourceIndex, targetIndex);
    const point = latticePoints[sourceIndex]!;
    pixelPoints.push(point);
    const uv = {
      x: roundCoordinate(point.x / input.width),
      y: roundCoordinate(point.y / input.height)
    };
    vertices.push({
      x: roundCoordinate(input.input.bounds.x + input.input.bounds.width * uv.x),
      y: roundCoordinate(input.input.bounds.y + input.input.bounds.height * uv.y)
    });
    uvs.push(uv);
    vertexStableIds.push(`vtx_${token}_outline_v4_lattice_${point.order}_${targetIndex}`);
  });

  const triangles = acceptedTriangles.map(
    (triangle): [number, number, number] => [
      remap.get(triangle.a)!,
      remap.get(triangle.b)!,
      remap.get(triangle.c)!
    ]
  );
  const triangleStableIds = triangles.map(
    (_triangle, triangleIndex): TriangleId =>
      `tri_${token}_outline_v4_lattice_${triangleIndex}` as TriangleId
  );

  return {
    mesh: {
      meshId: input.input.meshId,
      drawableId: input.input.drawableId,
      vertices,
      uvs,
      triangles,
      vertexStableIds,
      triangleStableIds,
      topologyRevision: 0,
      bounds: structuredClone(input.input.bounds),
      generationProvenanceId: input.input.provenanceId
    },
    pixelPoints,
    bandTriangleCount,
    interiorTriangleCount,
    rejectedDegenerateTriangleCount,
    rejectedLongBoundaryToInteriorTriangleCount: 0,
    rejectedLongInteriorTriangleCount: 0,
    rejectedOutsideInteriorTriangleCount
  };
};

const classifyLatticeTriangle = (input: {
  readonly points: readonly PixelPoint[];
  readonly triangle: DelaunayTriangle;
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly contour: readonly PixelPoint[];
  readonly targetEdgeLength: number;
}): "boundary" | "interior" | "outside" => {
  const a = input.points[input.triangle.a]!;
  const b = input.points[input.triangle.b]!;
  const c = input.points[input.triangle.c]!;
  const centroid = triangleCentroid(input.points, input.triangle);
  const samples = [
    a,
    b,
    c,
    centroid,
    midpoint(a, b),
    midpoint(b, c),
    midpoint(c, a)
  ];
  const alphaHit = samples.some((sample) => isPointInsideAlpha(input.mask, input.width, input.height, sample));
  const contourHit = contourIntersectsTriangle({
    contour: input.contour,
    a,
    b,
    c
  });
  const nearContour =
    distanceToContour(centroid, input.contour) <= input.targetEdgeLength * 0.62 ||
    samples.some((sample) => distanceToContour(sample, input.contour) <= input.targetEdgeLength * 0.34);

  if (contourHit || nearContour) {
    return "boundary";
  }

  return alphaHit ? "interior" : "outside";
};

const contourFrame = (
  center: PixelPoint,
  previous: PixelPoint,
  next: PixelPoint,
  polygonCentroidPoint: PixelPoint
): {
  readonly tangent: PixelPoint;
  readonly normal: PixelPoint;
} => {
  const rawTangent = normalizeVector({
    x: next.x - previous.x,
    y: next.y - previous.y
  });
  const tangent = Math.hypot(rawTangent.x, rawTangent.y) <= 0.000001
    ? { x: 1, y: 0 }
    : rawTangent;
  let normal = {
    x: -tangent.y,
    y: tangent.x
  };
  const inward = {
    x: polygonCentroidPoint.x - center.x,
    y: polygonCentroidPoint.y - center.y
  };
  if (normal.x * inward.x + normal.y * inward.y < 0) {
    normal = {
      x: -normal.x,
      y: -normal.y
    };
  }

  return { tangent, normal };
};

const normalizeVector = (vector: PixelPoint): PixelPoint => {
  const length = Math.hypot(vector.x, vector.y);
  return length <= 0.000001
    ? { x: 0, y: 0 }
    : {
        x: vector.x / length,
        y: vector.y / length
      };
};

const sampleContourFollowingInteriorPoints = (input: {
  readonly contour: readonly PixelPoint[];
  readonly centroid: PixelPoint;
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly config: V4Config;
}): readonly ContourBandPoint[] => {
  const points: ContourBandPoint[] = [];
  const add = (point: PixelPoint) => {
    const candidate = {
      x: roundCoordinate(clamp(point.x, 0, input.width)),
      y: roundCoordinate(clamp(point.y, 0, input.height))
    };
    if (
      !isPointInsidePolygon(candidate, input.contour) ||
      !isPointInsideAlpha(input.mask, input.width, input.height, candidate) ||
      minDistanceToPoints(candidate, points) < input.config.targetEdgeLength * 0.42
    ) {
      return;
    }
    points.push({
      ...candidate,
      kind: "interior",
      order: points.length
    });
  };

  input.contour.forEach((center, pointIndex) => {
    const previous = input.contour[(pointIndex - 1 + input.contour.length) % input.contour.length]!;
    const next = input.contour[(pointIndex + 1) % input.contour.length]!;
    const frame = contourFrame(center, previous, next, input.centroid);
    for (const factor of [0.85, 1.65, 2.45, 3.25] as const) {
      add({
        x: center.x + frame.normal.x * input.config.targetEdgeLength * factor,
        y: center.y + frame.normal.y * input.config.targetEdgeLength * factor
      });
    }
  });

  add(input.centroid);
  return points.sort(compareContourBandPoints);
};

const contourIntersectsTriangle = (input: {
  readonly contour: readonly PixelPoint[];
  readonly a: PixelPoint;
  readonly b: PixelPoint;
  readonly c: PixelPoint;
}): boolean => {
  const minX = Math.min(input.a.x, input.b.x, input.c.x);
  const maxX = Math.max(input.a.x, input.b.x, input.c.x);
  const minY = Math.min(input.a.y, input.b.y, input.c.y);
  const maxY = Math.max(input.a.y, input.b.y, input.c.y);

  for (const point of input.contour) {
    if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) {
      continue;
    }
    if (isPointInsideTriangle(point, input.a, input.b, input.c)) {
      return true;
    }
  }

  return false;
};

const isPointInsideTriangle = (
  point: PixelPoint,
  a: PixelPoint,
  b: PixelPoint,
  c: PixelPoint
): boolean => {
  const area = Math.abs(cross(a, b, c));
  const areaA = Math.abs(cross(point, b, c));
  const areaB = Math.abs(cross(a, point, c));
  const areaC = Math.abs(cross(a, b, point));
  return Math.abs(area - (areaA + areaB + areaC)) <= 0.0001;
};

const distanceToContour = (
  point: PixelPoint,
  contour: readonly PixelPoint[]
): number => {
  if (contour.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  let result = Number.POSITIVE_INFINITY;
  for (let index = 0; index < contour.length; index += 1) {
    result = Math.min(
      result,
      distancePointToSegment(point, contour[index]!, contour[(index + 1) % contour.length]!)
    );
  }

  return result;
};

const distancePointToSegment = (
  point: PixelPoint,
  start: PixelPoint,
  end: PixelPoint
): number => {
  const segmentLengthSquared = squaredDistance(start, end);
  if (segmentLengthSquared <= 0.000001) {
    return distance(point, start);
  }

  const t = clamp(
    ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) /
      segmentLengthSquared,
    0,
    1
  );
  return distance(point, {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t
  });
};

const createContourBandMesh = (input: {
  readonly input: AutoOutlineV4ContourBandMeshInput;
  readonly width: number;
  readonly height: number;
  readonly mask: Uint8Array;
  readonly config: V4Config;
  readonly outerPoints: readonly ContourBandPoint[];
  readonly innerPoints: readonly ContourBandPoint[];
  readonly interiorPoints: readonly ContourBandPoint[];
  readonly alphaContour: readonly PixelPoint[];
  readonly outerContour: readonly PixelPoint[];
  readonly innerContour: readonly PixelPoint[];
}): ContourBandBuild => {
  const token = stripIdPrefix(input.input.drawableId, "draw_");
  const pixelPoints = [
    ...input.outerPoints,
    ...input.innerPoints,
    ...input.interiorPoints
  ];
  const outerStart = 0;
  const innerStart = input.outerPoints.length;
  const interiorStart = innerStart + input.innerPoints.length;
  const vertices: MeshDto["vertices"] = [];
  const uvs: MeshDto["uvs"] = [];
  const vertexStableIds: string[] = [];
  const triangles: MeshDto["triangles"] = [];
  const triangleStableIds: TriangleId[] = [];
  let bandTriangleCount = 0;
  let interiorTriangleCount = 0;
  let rejectedDegenerateTriangleCount = 0;
  let rejectedLongBoundaryToInteriorTriangleCount = 0;
  let rejectedLongInteriorTriangleCount = 0;
  let rejectedOutsideInteriorTriangleCount = 0;

  pixelPoints.forEach((point, pointIndex) => {
    const geometry = {
      x: point.x / input.width,
      y: point.y / input.height
    };
    const uv = {
      x: roundCoordinate(clamp(geometry.x, 0, 1)),
      y: roundCoordinate(clamp(geometry.y, 0, 1))
    };
    vertices.push({
      x: roundCoordinate(input.input.bounds.x + input.input.bounds.width * geometry.x),
      y: roundCoordinate(input.input.bounds.y + input.input.bounds.height * geometry.y)
    });
    uvs.push(uv);
    vertexStableIds.push(`vtx_${token}_outline_v4_contour_band_${stableKind(point.kind)}_${point.order}_${pointIndex}`);
  });

  const addBandTriangle = (triangle: [number, number, number], suffix: string) => {
    const oriented = orientTriangle(pixelPoints, {
      a: triangle[0],
      b: triangle[1],
      c: triangle[2]
    });
    if (Math.abs(signedTriangleArea(pixelPoints, oriented)) <= 0.000001) {
      rejectedDegenerateTriangleCount += 1;
      return;
    }
    if (triangleOverlapsExistingTriangles(pixelPoints, oriented, triangles)) {
      rejectedDegenerateTriangleCount += 1;
      return;
    }

    triangles.push([oriented.a, oriented.b, oriented.c]);
    triangleStableIds.push(`tri_${token}_outline_v4_contour_band_strip_${suffix}` as TriangleId);
    bandTriangleCount += 1;
  };

  const bandOptionScore = (option: readonly [[number, number, number], [number, number, number]]): number => {
    const left = orientTriangle(pixelPoints, { a: option[0][0], b: option[0][1], c: option[0][2] });
    const right = orientTriangle(pixelPoints, { a: option[1][0], b: option[1][1], c: option[1][2] });
    return Math.min(
      minTriangleAngleDegrees(pixelPoints, left),
      minTriangleAngleDegrees(pixelPoints, right)
    );
  };

  const segmentCount = Math.min(input.outerPoints.length, input.innerPoints.length);
  for (let pointIndex = 0; pointIndex < segmentCount; pointIndex += 1) {
    const nextIndex = (pointIndex + 1) % segmentCount;
    const innerA = innerStart + pointIndex;
    const innerB = innerStart + nextIndex;
    const outerA = outerStart + pointIndex;
    const outerB = outerStart + nextIndex;
    const optionA: [[number, number, number], [number, number, number]] = [
      [innerA, outerA, outerB],
      [innerA, outerB, innerB]
    ];
    const optionB: [[number, number, number], [number, number, number]] = [
      [innerA, outerA, innerB],
      [innerB, outerA, outerB]
    ];
    const selectedOption = bandOptionScore(optionA) >= bandOptionScore(optionB)
      ? optionA
      : optionB;
    addBandTriangle(selectedOption[0], `${pointIndex}_a`);
    addBandTriangle(selectedOption[1], `${pointIndex}_b`);
  }

  const interiorDelaunayPoints = [
    ...input.innerPoints,
    ...input.interiorPoints
  ];
  const delaunayTriangles = triangulate(interiorDelaunayPoints)
    .map((triangle) => orientTriangle(interiorDelaunayPoints, triangle))
    .sort(compareTriangles);

  for (const triangle of delaunayTriangles) {
    const classification = classifyInteriorTriangle({
      points: interiorDelaunayPoints,
      triangle,
      mask: input.mask,
      width: input.width,
      height: input.height,
      alphaContour: input.alphaContour,
      outerContour: input.innerContour,
      innerContour: input.innerContour,
      config: input.config
    });
    if (classification === "degenerate") {
      rejectedDegenerateTriangleCount += 1;
      continue;
    }
    if (classification === "outside") {
      rejectedOutsideInteriorTriangleCount += 1;
      continue;
    }
    if (classification === "long-boundary-to-interior") {
      rejectedLongBoundaryToInteriorTriangleCount += 1;
      continue;
    }
    if (classification === "long-interior") {
      rejectedLongInteriorTriangleCount += 1;
      continue;
    }

    const mapped = mapInteriorTriangle(triangle, innerStart, interiorStart, input.innerPoints.length);
    const orientedMapped = orientTriangle(pixelPoints, {
      a: mapped[0],
      b: mapped[1],
      c: mapped[2]
    });
    if (triangleOverlapsExistingTriangles(pixelPoints, orientedMapped, triangles)) {
      rejectedDegenerateTriangleCount += 1;
      continue;
    }
    triangles.push(mapped);
    triangleStableIds.push(`tri_${token}_outline_v4_contour_band_interior_${interiorTriangleCount}` as TriangleId);
    interiorTriangleCount += 1;
  }

  return {
    mesh: {
      meshId: input.input.meshId,
      drawableId: input.input.drawableId,
      vertices,
      uvs,
      triangles,
      vertexStableIds,
      triangleStableIds,
      topologyRevision: 0,
      bounds: structuredClone(input.input.bounds),
      generationProvenanceId: input.input.provenanceId
    },
    pixelPoints,
    bandTriangleCount,
    interiorTriangleCount,
    rejectedDegenerateTriangleCount,
    rejectedLongBoundaryToInteriorTriangleCount,
    rejectedLongInteriorTriangleCount,
    rejectedOutsideInteriorTriangleCount
  };
};

const createContourBandMetrics = (input: {
  readonly config: V4Config;
  readonly alphaArea: number;
  readonly selectedContourVertexCount: number;
  readonly simplifiedContourVertexCount: number;
  readonly rings: ContourBandRings;
  readonly interiorPointCount: number;
  readonly build: ContourBandBuild;
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
}): MeshGenerationContourBandMetrics => {
  const maxBoundaryToInteriorEdgeLength = maxBoundaryToInteriorEdgeLengthForMesh(input.build.pixelPoints, input.build.mesh);
  const maxVertexValence = maxVertexValenceForMesh(input.build.mesh);
  const transparentOnlyTriangleRatio = transparentOnlyTriangleRatioForMesh({
    points: input.build.pixelPoints,
    triangles: input.build.mesh.triangles,
    mask: input.mask,
    width: input.width,
    height: input.height
  });

  return {
    algorithmId: "auto-outline-v4-contour-band",
    preset: input.config.preset,
    targetEdgeLength: roundMetric(input.config.targetEdgeLength),
    contourSampleSpacing: roundMetric(input.config.contourSampleSpacing),
    outerOffset: roundMetric(input.rings.outerOffset),
    innerOffset: roundMetric(input.rings.innerOffset),
    alphaArea: input.alphaArea,
    outerContourArea: roundMetric(input.rings.outerContourArea),
    outerContourAreaRatio: roundMetric(input.rings.outerContourAreaRatio),
    selectedContourVertexCount: input.selectedContourVertexCount,
    simplifiedContourVertexCount: input.simplifiedContourVertexCount,
    contourPointCount: input.rings.innerContour.length,
    outerContourPointCount: input.rings.outerContour.length,
    contourBandTriangleCount: input.build.bandTriangleCount,
    interiorPointCount: input.interiorPointCount,
    interiorTriangleCount: input.build.interiorTriangleCount,
    maxBoundaryToInteriorEdgeLength: roundMetric(maxBoundaryToInteriorEdgeLength),
    maxVertexValence,
    transparentOnlyTriangleRatio: roundMetric(transparentOnlyTriangleRatio),
    vertexCount: input.build.mesh.vertices.length,
    triangleCount: input.build.mesh.triangles.length,
    maxVertexCountCap: input.config.maxVertexCountCap,
    rejectedDegenerateTriangleCount: input.build.rejectedDegenerateTriangleCount,
    rejectedLongBoundaryToInteriorTriangleCount: input.build.rejectedLongBoundaryToInteriorTriangleCount,
    rejectedLongInteriorTriangleCount: input.build.rejectedLongInteriorTriangleCount,
    rejectedOutsideInteriorTriangleCount: input.build.rejectedOutsideInteriorTriangleCount,
    provenance: [
      "rgba-alpha-threshold",
      "largest-alpha-contour",
      "curvature-aware-contour-resampling",
      "centroid-normal-contour-band-offset",
      "explicit-inner-outer-contour-strip",
      "deterministic-jittered-interior-fill",
      "ordinary-delaunay-contour-band-filter",
      "boundary-to-interior-edge-cap",
      "transparent-only-triangle-ratio-cap",
      "constrained-triangulation-deferred"
    ]
  };
};

const classifyInteriorTriangle = (input: {
  readonly points: readonly ContourBandPoint[];
  readonly triangle: DelaunayTriangle;
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly alphaContour: readonly PixelPoint[];
  readonly outerContour: readonly PixelPoint[];
  readonly innerContour: readonly PixelPoint[];
  readonly config: V4Config;
}): "accepted" | "degenerate" | "outside" | "long-boundary-to-interior" | "long-interior" => {
  if (Math.abs(signedTriangleArea(input.points, input.triangle)) <= 0.000001) {
    return "degenerate";
  }

  const a = input.points[input.triangle.a]!;
  const b = input.points[input.triangle.b]!;
  const c = input.points[input.triangle.c]!;
  const centroid = triangleCentroid(input.points, input.triangle);
  const samples = [
    centroid,
    midpoint(a, b),
    midpoint(b, c),
    midpoint(c, a)
  ];

  if (samples.some((sample) => !isPointInsidePolygon(sample, input.outerContour))) {
    return "outside";
  }

  const touchesBoundary = triangleTouchesBoundary(input.points, input.triangle);
  if (
    !touchesBoundary &&
    !samples.some((sample) =>
      isPointInsideAlphaOrApron({
        mask: input.mask,
        width: input.width,
        height: input.height,
        point: sample,
        contour: input.alphaContour,
        margin: input.config.softApronMargin
      })
    )
  ) {
    return "outside";
  }

  if (minTriangleAngleDegrees(input.points, input.triangle) < input.config.minTriangleAngleDegrees) {
    return "degenerate";
  }

  const maxBoundaryInteriorEdge = maxBoundaryToInteriorEdgeLengthForTriangle(input.points, input.triangle);
  if (maxBoundaryInteriorEdge > input.config.maxBoundaryToInteriorEdgeLength) {
    return "long-boundary-to-interior";
  }

  if (maxTriangleEdgeLength(input.points, input.triangle) > input.config.maxInteriorEdgeLength) {
    return "long-interior";
  }

  return "accepted";
};

const triangleTouchesBoundary = (
  points: readonly ContourBandPoint[],
  triangle: DelaunayTriangle
): boolean =>
  points[triangle.a]!.kind !== "interior" ||
  points[triangle.b]!.kind !== "interior" ||
  points[triangle.c]!.kind !== "interior";

const triangleOverlapsExistingTriangles = (
  points: readonly PixelPoint[],
  candidate: DelaunayTriangle,
  existingTriangles: readonly (readonly [number, number, number])[]
): boolean => {
  for (const existing of existingTriangles) {
    const existingTriangle = {
      a: existing[0],
      b: existing[1],
      c: existing[2]
    };
    if (trianglesShareEdge(candidate, existingTriangle)) {
      continue;
    }
    if (trianglesHaveCrossingEdges(points, candidate, existingTriangle)) {
      return true;
    }
    if (
      !trianglesShareVertex(candidate, existingTriangle) &&
      (isTriangleCentroidInsideTriangle(points, candidate, existingTriangle) ||
        isTriangleCentroidInsideTriangle(points, existingTriangle, candidate))
    ) {
      return true;
    }
  }

  return false;
};

const trianglesHaveCrossingEdges = (
  points: readonly PixelPoint[],
  left: DelaunayTriangle,
  right: DelaunayTriangle
): boolean => {
  for (const leftEdge of triangleIndexEdges(left)) {
    for (const rightEdge of triangleIndexEdges(right)) {
      if (leftEdge[0] === rightEdge[0] || leftEdge[0] === rightEdge[1] ||
        leftEdge[1] === rightEdge[0] || leftEdge[1] === rightEdge[1]) {
        continue;
      }
      if (segmentsIntersect(
        points[leftEdge[0]]!,
        points[leftEdge[1]]!,
        points[rightEdge[0]]!,
        points[rightEdge[1]]!
      )) {
        return true;
      }
    }
  }

  return false;
};

const trianglesShareEdge = (
  left: DelaunayTriangle,
  right: DelaunayTriangle
): boolean => {
  for (const leftEdge of triangleIndexEdges(left)) {
    for (const rightEdge of triangleIndexEdges(right)) {
      if (
        (leftEdge[0] === rightEdge[0] && leftEdge[1] === rightEdge[1]) ||
        (leftEdge[0] === rightEdge[1] && leftEdge[1] === rightEdge[0])
      ) {
        return true;
      }
    }
  }

  return false;
};

const trianglesShareVertex = (
  left: DelaunayTriangle,
  right: DelaunayTriangle
): boolean =>
  triangleIndices(left).some((leftIndex) => triangleIndices(right).includes(leftIndex));

const triangleIndexEdges = (
  triangle: DelaunayTriangle
): readonly (readonly [number, number])[] => [
  [triangle.a, triangle.b],
  [triangle.b, triangle.c],
  [triangle.c, triangle.a]
];

const triangleIndices = (triangle: DelaunayTriangle): readonly number[] => [
  triangle.a,
  triangle.b,
  triangle.c
];

const isTriangleCentroidInsideTriangle = (
  points: readonly PixelPoint[],
  subject: DelaunayTriangle,
  container: DelaunayTriangle
): boolean =>
  isPointInsideTriangle(
    triangleCentroid(points, subject),
    points[container.a]!,
    points[container.b]!,
    points[container.c]!
  );

const minTriangleAngleDegrees = (
  points: readonly PixelPoint[],
  triangle: DelaunayTriangle
): number => {
  const a = points[triangle.a]!;
  const b = points[triangle.b]!;
  const c = points[triangle.c]!;
  const angleA = angleDegrees(distance(b, c), distance(a, b), distance(a, c));
  const angleB = angleDegrees(distance(a, c), distance(a, b), distance(b, c));
  const angleC = angleDegrees(distance(a, b), distance(a, c), distance(b, c));
  return Math.min(angleA, angleB, angleC);
};

const angleDegrees = (
  opposite: number,
  sideA: number,
  sideB: number
): number => {
  if (sideA <= 0.000001 || sideB <= 0.000001) {
    return 0;
  }

  const cosine = clamp(
    (sideA * sideA + sideB * sideB - opposite * opposite) / (2 * sideA * sideB),
    -1,
    1
  );
  return (Math.acos(cosine) * 180) / Math.PI;
};

const mapInteriorTriangle = (
  triangle: DelaunayTriangle,
  innerStart: number,
  interiorStart: number,
  innerPointCount: number
): [number, number, number] => {
  const mapIndex = (index: number): number =>
    index < innerPointCount ? innerStart + index : interiorStart + index - innerPointCount;
  return [mapIndex(triangle.a), mapIndex(triangle.b), mapIndex(triangle.c)];
};

const triangulate = (points: readonly ContourBandPoint[]): readonly DelaunayTriangle[] => {
  const bounds = pointSetBounds(points);
  const delta = Math.max(bounds.right - bounds.left, bounds.bottom - bounds.top, 1);
  const midX = (bounds.left + bounds.right) / 2;
  const midY = (bounds.top + bounds.bottom) / 2;
  const allPoints: PixelPoint[] = [
    ...points,
    { x: midX - delta * 20, y: midY - delta },
    { x: midX, y: midY + delta * 20 },
    { x: midX + delta * 20, y: midY - delta }
  ];
  const superA = points.length;
  const superB = points.length + 1;
  const superC = points.length + 2;
  let triangles: DelaunayTriangle[] = [{ a: superA, b: superB, c: superC }];

  for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
    const point = points[pointIndex]!;
    const badTriangles = triangles.filter((triangle) =>
      circumcircleContains(allPoints, triangle, point)
    );
    const badTriangleKeys = new Set(badTriangles.map(triangleKey));
    const boundaryEdges = collectBoundaryEdges(badTriangles);

    triangles = triangles.filter((triangle) => !badTriangleKeys.has(triangleKey(triangle)));
    for (const edge of boundaryEdges) {
      const candidate = { a: edge.a, b: edge.b, c: pointIndex };
      if (Math.abs(signedTriangleArea(allPoints, candidate)) > 0.0000001) {
        triangles.push(candidate);
      }
    }
  }

  return triangles.filter(
    (triangle) => triangle.a < points.length && triangle.b < points.length && triangle.c < points.length
  );
};

const collectBoundaryEdges = (
  triangles: readonly DelaunayTriangle[]
): readonly { readonly a: number; readonly b: number }[] => {
  const edges = new Map<string, { edge: { readonly a: number; readonly b: number }; count: number }>();
  for (const triangle of triangles) {
    for (const edge of [
      { a: triangle.a, b: triangle.b },
      { a: triangle.b, b: triangle.c },
      { a: triangle.c, b: triangle.a }
    ]) {
      const key = edgeKey(edge.a, edge.b);
      const entry = edges.get(key);
      if (entry === undefined) {
        edges.set(key, { edge, count: 1 });
      } else {
        entry.count += 1;
      }
    }
  }

  return [...edges.values()]
    .filter((entry) => entry.count === 1)
    .map((entry) => entry.edge)
    .sort((left, right) => edgeKey(left.a, left.b).localeCompare(edgeKey(right.a, right.b)));
};

const circumcircleContains = (
  points: readonly PixelPoint[],
  triangle: DelaunayTriangle,
  point: PixelPoint
): boolean => {
  const a = points[triangle.a]!;
  const b = points[triangle.b]!;
  const c = points[triangle.c]!;
  const ax = a.x - point.x;
  const ay = a.y - point.y;
  const bx = b.x - point.x;
  const by = b.y - point.y;
  const cx = c.x - point.x;
  const cy = c.y - point.y;
  const determinant =
    (ax * ax + ay * ay) * (bx * cy - cx * by) -
    (bx * bx + by * by) * (ax * cy - cx * ay) +
    (cx * cx + cy * cy) * (ax * by - bx * ay);
  const orientation = signedTriangleArea(points, triangle);

  if (Math.abs(orientation) <= 0.0000001) {
    return false;
  }

  return orientation > 0 ? determinant > 0.0000001 : determinant < -0.0000001;
};

const maxBoundaryToInteriorEdgeLengthForMesh = (
  points: readonly ContourBandPoint[],
  mesh: MeshDto
): number => {
  let result = 0;
  for (const triangle of mesh.triangles) {
    result = Math.max(
      result,
      maxBoundaryToInteriorEdgeLengthForTriangle(points, {
        a: triangle[0],
        b: triangle[1],
        c: triangle[2]
      })
    );
  }

  return result;
};

const maxBoundaryToInteriorEdgeLengthForTriangle = (
  points: readonly ContourBandPoint[],
  triangle: DelaunayTriangle
): number => {
  let result = 0;
  for (const [leftIndex, rightIndex] of [
    [triangle.a, triangle.b],
    [triangle.b, triangle.c],
    [triangle.c, triangle.a]
  ] as const) {
    const left = points[leftIndex]!;
    const right = points[rightIndex]!;
    if (
      (left.kind !== "interior" && right.kind === "interior") ||
      (left.kind === "interior" && right.kind !== "interior")
    ) {
      result = Math.max(result, distance(left, right));
    }
  }

  return result;
};

const maxVertexValenceForMesh = (mesh: MeshDto): number => {
  const neighborsByVertex = new Map<number, Set<number>>();
  const addNeighbor = (vertexIndex: number, neighborIndex: number) => {
    const neighbors = neighborsByVertex.get(vertexIndex);
    if (neighbors === undefined) {
      neighborsByVertex.set(vertexIndex, new Set([neighborIndex]));
      return;
    }

    neighbors.add(neighborIndex);
  };

  for (const triangle of mesh.triangles) {
    const [a, b, c] = triangle;
    addNeighbor(a, b);
    addNeighbor(a, c);
    addNeighbor(b, a);
    addNeighbor(b, c);
    addNeighbor(c, a);
    addNeighbor(c, b);
  }

  return neighborsByVertex.size === 0
    ? 0
    : Math.max(...[...neighborsByVertex.values()].map((neighbors) => neighbors.size));
};

const transparentOnlyTriangleRatioForMesh = (input: {
  readonly points: readonly ContourBandPoint[];
  readonly triangles: MeshDto["triangles"];
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
}): number => {
  if (input.triangles.length === 0) {
    return 0;
  }

  let transparentOnlyTriangleCount = 0;
  for (const triangle of input.triangles) {
    const a = input.points[triangle[0]]!;
    const b = input.points[triangle[1]]!;
    const c = input.points[triangle[2]]!;
    const centroid = {
      x: (a.x + b.x + c.x) / 3,
      y: (a.y + b.y + c.y) / 3
    };
    const samples = [
      a,
      b,
      c,
      centroid,
      midpoint(a, b),
      midpoint(b, c),
      midpoint(c, a)
    ];
    if (samples.every((sample) => !isPointInsideAlpha(input.mask, input.width, input.height, sample))) {
      transparentOnlyTriangleCount += 1;
    }
  }

  return transparentOnlyTriangleCount / input.triangles.length;
};

const maxTriangleEdgeLength = (
  points: readonly PixelPoint[],
  triangle: DelaunayTriangle
): number => {
  const a = points[triangle.a]!;
  const b = points[triangle.b]!;
  const c = points[triangle.c]!;
  return Math.max(distance(a, b), distance(b, c), distance(c, a));
};

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

const isMaskFilled = (
  mask: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number
): boolean => {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return false;
  }

  return mask[y * width + x] === 1;
};

const isPointInsideAlpha = (
  mask: Uint8Array,
  width: number,
  height: number,
  point: PixelPoint
): boolean => {
  if (point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) {
    return false;
  }

  const x = clampInt(Math.floor(point.x), 0, width - 1);
  const y = clampInt(Math.floor(point.y), 0, height - 1);
  return isMaskFilled(mask, width, height, x, y);
};

const isPointInsideAlphaOrApron = (input: {
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly point: PixelPoint;
  readonly contour: readonly PixelPoint[];
  readonly margin: number;
}): boolean =>
  isPointInsideAlpha(input.mask, input.width, input.height, input.point) ||
  distanceToContour(input.point, input.contour) <= input.margin;

const isPointInsidePolygon = (
  point: PixelPoint,
  polygon: readonly PixelPoint[]
): boolean => {
  if (polygon.length < 3) {
    return false;
  }

  for (let index = 0; index < polygon.length; index += 1) {
    if (isPointOnSegment(point, polygon[index]!, polygon[(index + 1) % polygon.length]!)) {
      return true;
    }
  }

  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const a = polygon[index]!;
    const b = polygon[previousIndex]!;
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

const isPointOnSegment = (
  point: PixelPoint,
  start: PixelPoint,
  end: PixelPoint
): boolean => {
  if (Math.abs(cross(start, end, point)) > 0.000001) {
    return false;
  }

  return (
    point.x >= Math.min(start.x, end.x) - 0.000001 &&
    point.x <= Math.max(start.x, end.x) + 0.000001 &&
    point.y >= Math.min(start.y, end.y) - 0.000001 &&
    point.y <= Math.max(start.y, end.y) + 0.000001
  );
};

const hasSelfIntersections = (points: readonly PixelPoint[]): boolean => {
  if (points.length < 4) {
    return false;
  }

  for (let leftIndex = 0; leftIndex < points.length; leftIndex += 1) {
    const leftStart = points[leftIndex]!;
    const leftEnd = points[(leftIndex + 1) % points.length]!;
    for (let rightIndex = leftIndex + 1; rightIndex < points.length; rightIndex += 1) {
      if (
        rightIndex === leftIndex ||
        rightIndex === (leftIndex + 1) % points.length ||
        leftIndex === (rightIndex + 1) % points.length
      ) {
        continue;
      }

      const rightStart = points[rightIndex]!;
      const rightEnd = points[(rightIndex + 1) % points.length]!;
      if (segmentsIntersect(leftStart, leftEnd, rightStart, rightEnd)) {
        return true;
      }
    }
  }

  return false;
};

const segmentsIntersect = (
  a: PixelPoint,
  b: PixelPoint,
  c: PixelPoint,
  d: PixelPoint
): boolean => {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);

  if (
    Math.abs(abC) <= 0.000001 ||
    Math.abs(abD) <= 0.000001 ||
    Math.abs(cdA) <= 0.000001 ||
    Math.abs(cdB) <= 0.000001
  ) {
    return false;
  }

  return (abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0);
};

const compareContourLoops = (
  left: readonly PixelPoint[],
  right: readonly PixelPoint[]
): number => {
  const areaOrder = Math.abs(polygonArea(right)) - Math.abs(polygonArea(left));
  if (areaOrder !== 0) {
    return areaOrder;
  }

  return comparePoints(left[0]!, right[0]!);
};

const compareContourBandPoints = (
  left: ContourBandPoint,
  right: ContourBandPoint
): number =>
  left.kind.localeCompare(right.kind) ||
  left.order - right.order ||
  comparePoints(left, right);

const comparePoints = (left: PixelPoint, right: PixelPoint): number =>
  left.y - right.y || left.x - right.x;

const compareEdges = (left: OutlineEdge, right: OutlineEdge): number =>
  comparePoints(left.start, right.start) ||
  comparePoints(left.end, right.end) ||
  left.direction - right.direction;

const compareTriangles = (left: DelaunayTriangle, right: DelaunayTriangle): number => {
  const leftKey = [left.a, left.b, left.c].sort((a, b) => a - b).join(":");
  const rightKey = [right.a, right.b, right.c].sort((a, b) => a - b).join(":");
  return leftKey.localeCompare(rightKey);
};

const findLexicographicPointIndex = (points: readonly PixelPoint[]): number => {
  let result = 0;
  for (let index = 1; index < points.length; index += 1) {
    if (comparePoints(points[index]!, points[result]!) < 0) {
      result = index;
    }
  }

  return result;
};

const rotatePoints = (
  points: readonly PixelPoint[],
  startIndex: number
): readonly PixelPoint[] => [...points.slice(startIndex), ...points.slice(0, startIndex)];

const removeConsecutiveDuplicatePoints = (points: readonly PixelPoint[]): PixelPoint[] => {
  const result: PixelPoint[] = [];
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

const removeNearDuplicateLoopPoints = (
  points: readonly PixelPoint[],
  minDistance: number
): readonly PixelPoint[] => {
  if (points.length <= 3) {
    return points;
  }

  const result: PixelPoint[] = [];
  for (const point of points) {
    if (result.length === 0 || distance(result[result.length - 1]!, point) >= minDistance) {
      result.push(point);
    }
  }

  while (result.length > 3 && distance(result[0]!, result[result.length - 1]!) < minDistance) {
    result.pop();
  }

  return result.length >= 3 ? result : points.slice(0, 3);
};

const contourPerimeter = (points: readonly PixelPoint[]): number => {
  let result = 0;
  for (let index = 0; index < points.length; index += 1) {
    result += distance(points[index]!, points[(index + 1) % points.length]!);
  }

  return result;
};

const pointAtLoopDistance = (
  points: readonly PixelPoint[],
  targetDistance: number
): PixelPoint => {
  let walked = 0;
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index]!;
    const end = points[(index + 1) % points.length]!;
    const segmentLength = distance(start, end);
    if (segmentLength <= 0.000001) {
      continue;
    }

    if (walked + segmentLength >= targetDistance) {
      const t = clamp((targetDistance - walked) / segmentLength, 0, 1);
      return {
        x: roundCoordinate(start.x + (end.x - start.x) * t),
        y: roundCoordinate(start.y + (end.y - start.y) * t)
      };
    }

    walked += segmentLength;
  }

  return points[0]!;
};

const pointSetBounds = (points: readonly PixelPoint[]): PixelBounds => {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    left = Math.min(left, point.x);
    top = Math.min(top, point.y);
    right = Math.max(right, point.x);
    bottom = Math.max(bottom, point.y);
  }

  return { left, top, right, bottom };
};

const minDistanceToPoints = (
  point: PixelPoint,
  points: readonly PixelPoint[]
): number => {
  if (points.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.sqrt(Math.min(...points.map((candidate) => squaredDistance(point, candidate))));
};

const minSquaredDistanceToPoints = (
  point: PixelPoint,
  points: readonly PixelPoint[]
): number => {
  if (points.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  let result = Number.POSITIVE_INFINITY;
  for (const candidate of points) {
    result = Math.min(result, squaredDistance(point, candidate));
  }

  return result;
};

const polygonArea = (points: readonly PixelPoint[]): number => {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += point.x * next.y - next.x * point.y;
  }

  return area / 2;
};

const polygonCentroid = (points: readonly PixelPoint[]): PixelPoint => {
  const area = polygonArea(points);
  if (Math.abs(area) <= 0.000001) {
    const bounds = pointSetBounds(points);
    return {
      x: (bounds.left + bounds.right) / 2,
      y: (bounds.top + bounds.bottom) / 2
    };
  }

  let x = 0;
  let y = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    const next = points[(index + 1) % points.length]!;
    const pointCross = point.x * next.y - next.x * point.y;
    x += (point.x + next.x) * pointCross;
    y += (point.y + next.y) * pointCross;
  }

  return {
    x: x / (6 * area),
    y: y / (6 * area)
  };
};

const signedTriangleArea = (
  points: readonly PixelPoint[],
  triangle: DelaunayTriangle
): number => {
  const a = points[triangle.a]!;
  const b = points[triangle.b]!;
  const c = points[triangle.c]!;
  return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
};

const triangleCentroid = (
  points: readonly PixelPoint[],
  triangle: DelaunayTriangle
): PixelPoint => {
  const a = points[triangle.a]!;
  const b = points[triangle.b]!;
  const c = points[triangle.c]!;
  return {
    x: (a.x + b.x + c.x) / 3,
    y: (a.y + b.y + c.y) / 3
  };
};

const orientTriangle = (
  points: readonly PixelPoint[],
  triangle: DelaunayTriangle
): DelaunayTriangle =>
  signedTriangleArea(points, triangle) < 0
    ? { a: triangle.a, b: triangle.c, c: triangle.b }
    : triangle;

const turningCurvature = (
  previous: PixelPoint,
  point: PixelPoint,
  next: PixelPoint
): number => {
  const ax = point.x - previous.x;
  const ay = point.y - previous.y;
  const bx = next.x - point.x;
  const by = next.y - point.y;
  const aLength = Math.hypot(ax, ay);
  const bLength = Math.hypot(bx, by);
  if (aLength <= 0.000001 || bLength <= 0.000001) {
    return 0;
  }

  const pointCross = ax * by - ay * bx;
  const dot = ax * bx + ay * by;
  return clamp(Math.abs(Math.atan2(pointCross, dot)) / Math.PI, 0, 1);
};

const capVerticesByCurvature = (
  points: readonly PixelPoint[],
  cap: number
): readonly PixelPoint[] => {
  if (points.length <= cap) {
    return points;
  }

  const selectedIndices = new Set<number>([0]);
  const ranked = points
    .map((point, index) => ({
      index,
      curvature: turningCurvature(
        points[(index - 1 + points.length) % points.length]!,
        point,
        points[(index + 1) % points.length]!
      )
    }))
    .sort((left, right) => right.curvature - left.curvature || left.index - right.index);

  for (const candidate of ranked) {
    selectedIndices.add(candidate.index);
    if (selectedIndices.size >= cap) {
      break;
    }
  }

  return [...selectedIndices]
    .sort((left, right) => left - right)
    .map((index) => points[index]!);
};

const deterministicJitter = (
  seed: number,
  row: number,
  column: number,
  spacing: number
): PixelPoint => {
  const xUnit = hashUnit(seed, row, column, 0);
  const yUnit = hashUnit(seed, row, column, 1);
  const amplitude = spacing * 0.22;
  return {
    x: (xUnit - 0.5) * amplitude,
    y: (yUnit - 0.5) * amplitude
  };
};

const createSamplerSeed = (
  input: AutoOutlineV4ContourBandMeshInput,
  width: number,
  height: number
): number =>
  hashString(
    `v4-contour-band:${input.drawableId}:${width}x${height}:${input.densityHint ?? "low"}:${input.alphaThreshold ?? 8}`
  );

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const hashUnit = (
  seed: number,
  row: number,
  column: number,
  channel: number
): number => {
  let hash = seed ^ Math.imul(row + 0x9e3779b9, 0x85ebca6b);
  hash ^= Math.imul(column + 0xc2b2ae35, 0x27d4eb2d);
  hash ^= Math.imul(channel + 0x165667b1, 0x9e3779b1);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0xffffffff;
};

const cross = (a: PixelPoint, b: PixelPoint, c: PixelPoint): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

const triangleKey = (triangle: DelaunayTriangle): string =>
  `${triangle.a}:${triangle.b}:${triangle.c}`;

const edgeKey = (a: number, b: number): string =>
  a < b ? `${a}:${b}` : `${b}:${a}`;

const pointKey = (point: PixelPoint): string => `${point.x}:${point.y}`;

const pointsEqual = (left: PixelPoint, right: PixelPoint): boolean =>
  left.x === right.x && left.y === right.y;

const squaredDistance = (left: PixelPoint, right: PixelPoint): number =>
  (left.x - right.x) ** 2 + (left.y - right.y) ** 2;

const distance = (left: PixelPoint, right: PixelPoint): number =>
  Math.hypot(left.x - right.x, left.y - right.y);

const midpoint = (left: PixelPoint, right: PixelPoint): PixelPoint => ({
  x: (left.x + right.x) / 2,
  y: (left.y + right.y) / 2
});

const offsetPointFromCentroid = (
  point: PixelPoint,
  centroid: PixelPoint,
  offset: number,
  width: number,
  height: number
): PixelPoint => {
  const dx = point.x - centroid.x;
  const dy = point.y - centroid.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.000001) {
    return {
      x: roundCoordinate(clamp(point.x, 0, width)),
      y: roundCoordinate(clamp(point.y, 0, height))
    };
  }

  return {
    x: roundCoordinate(clamp(point.x + (dx / length) * offset, 0, width)),
    y: roundCoordinate(clamp(point.y + (dy / length) * offset, 0, height))
  };
};

const stableKind = (kind: ContourBandPoint["kind"]): string =>
  kind.replace(/-/g, "_");

const stripIdPrefix = (id: string, prefix: string): string =>
  id.startsWith(prefix) ? id.slice(prefix.length) : id;

const roundCoordinate = (value: number): number => {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const roundMetric = (value: number): number => roundCoordinate(value);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Math.trunc(value), min), max);

const clampPixelPoint = (
  point: PixelPoint,
  width: number,
  height: number
): PixelPoint => ({
  x: roundCoordinate(clamp(point.x, 0, width)),
  y: roundCoordinate(clamp(point.y, 0, height))
});

const clampPixelPointWithMargin = (
  point: PixelPoint,
  width: number,
  height: number,
  margin: number
): PixelPoint => ({
  x: roundCoordinate(clamp(point.x, -margin, width + margin)),
  y: roundCoordinate(clamp(point.y, -margin, height + margin))
});
