/**
 * v7 "commercial-like" mesh generation backend (auto-outline-v7-margin-contour).
 *
 * Orchestrates the pixel-space v7 pipeline into a MeshDto: it maps pixel-space
 * points to stage/UV coordinates using the same transform convention as the v6
 * backends (stage = bounds.origin + bounds.size * (pixel / textureSize); uv =
 * clamp(pixel / textureSize, 0, 1)), handles multi-island drawables by placing
 * each valid island as an independent sub-mesh in a single MeshDto (§4), and
 * bakes v7 provenance into the quality metrics (provenance-only diagnostics per
 * the wave decision — no preview-schema changes).
 *
 * This file imports NO v6 files: only the mesh-geometry neutral modules, the v7
 * pipeline/parameters, and the contract. The transform helpers are re-derived
 * here rather than imported from the v6 contour pipeline.
 */

import type { DrawableId, MeshId, ProvenanceId, RectDto, TriangleId } from "@private-2d-rigging-lab/contracts";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";

import {
  getV7MeshGenerationCandidate,
  type MeshDensityHint
} from "./mesh-generation-contract.js";
import {
  createAlphaIslandRgbaBytes,
  detectRawAlphaIslands,
  filterAlphaIslands,
  type AlphaIslandDescriptor
} from "./mesh-geometry/alpha-island-components.js";
import {
  clamp,
  roundCoordinate,
  type GeometryPoint,
  type PixelBounds
} from "./mesh-geometry/geometry-primitives.js";
import { computeMeshQualityMetrics, type MeshGenerationQualityMetrics } from "./mesh-quality-metrics.js";
import {
  runV7MarginContourPipeline,
  type V7PipelineBlockedReason,
  type V7PipelineResult,
  type V7PixelPoint
} from "./mesh-generation-v7-pipeline.js";

export interface AutoOutlineV7MarginContourMeshInput {
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

export type AutoOutlineV7MarginContourMeshResult =
  | {
      readonly status: "generated";
      readonly mesh: MeshDto;
      readonly alphaBounds: RectDto;
      readonly qualityMetrics: MeshGenerationQualityMetrics;
    }
  | {
      readonly status: "blocked";
      readonly reason: V7PipelineBlockedReason | "v7-margin-contour-generation-failed";
      readonly opaquePixelCount?: number;
      readonly alphaBounds?: RectDto;
    };

interface V7IslandMesh {
  readonly island: AlphaIslandDescriptor;
  readonly points: readonly V7PixelPoint[];
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly alphaBoundsPixels: PixelBounds;
}

export const createAutoOutlineV7MarginContourMesh = (
  input: AutoOutlineV7MarginContourMeshInput
): AutoOutlineV7MarginContourMeshResult => {
  const rawAlphaIslands = detectRawAlphaIslands({
    textureSize: input.textureSize,
    rgbaBytes: input.rgbaBytes,
    ...(input.alphaThreshold === undefined ? {} : { alphaThreshold: input.alphaThreshold })
  });

  if (rawAlphaIslands.status !== "detected") {
    return { status: "blocked", reason: "v7-margin-contour-extraction-failed" };
  }
  if (rawAlphaIslands.opaquePixelCount === 0) {
    return { status: "blocked", reason: "v7-margin-contour-alpha-empty", opaquePixelCount: 0 };
  }

  const filteredIslands = filterAlphaIslands(rawAlphaIslands.islands);
  // §4: mesh EVERY valid island. Single-island drawables fall through the same
  // path (one island) so there is one code path.
  const keptIslands =
    filteredIslands.keptIslands.length > 0 ? filteredIslands.keptIslands : rawAlphaIslands.islands;

  const islandMeshes: V7IslandMesh[] = [];
  for (const island of keptIslands) {
    const islandResult = runIslandPipeline({ input, island, islandCount: keptIslands.length });
    if (islandResult !== undefined) {
      islandMeshes.push(islandResult);
    }
  }

  if (islandMeshes.length === 0) {
    return {
      status: "blocked",
      reason: "v7-margin-contour-generation-failed",
      opaquePixelCount: rawAlphaIslands.opaquePixelCount
    };
  }

  return assembleV7Mesh({ input, islandMeshes });
};

const runIslandPipeline = (input: {
  readonly input: AutoOutlineV7MarginContourMeshInput;
  readonly island: AlphaIslandDescriptor;
  readonly islandCount: number;
}): V7IslandMesh | undefined => {
  const isolatedRgbaBytes =
    input.islandCount <= 1
      ? input.input.rgbaBytes
      : createAlphaIslandRgbaBytes({
          sourceRgbaBytes: input.input.rgbaBytes,
          textureSize: input.input.textureSize,
          island: input.island
        });

  const pipeline: V7PipelineResult = runV7MarginContourPipeline({
    textureWidth: input.input.textureSize.width,
    textureHeight: input.input.textureSize.height,
    rgbaBytes: isolatedRgbaBytes,
    ...(input.input.densityHint === undefined ? {} : { densityHint: input.input.densityHint }),
    ...(input.input.alphaThreshold === undefined ? {} : { alphaThreshold: input.input.alphaThreshold })
  });

  if (pipeline.status !== "generated") {
    return undefined;
  }

  return {
    island: input.island,
    points: pipeline.points,
    triangles: pipeline.triangles,
    alphaBoundsPixels: pipeline.alphaBoundsPixels
  };
};

const assembleV7Mesh = (input: {
  readonly input: AutoOutlineV7MarginContourMeshInput;
  readonly islandMeshes: readonly V7IslandMesh[];
}): AutoOutlineV7MarginContourMeshResult => {
  const candidate = getV7MeshGenerationCandidate("auto-outline-v7-margin-contour");
  const token = stripIdPrefix(input.input.drawableId, "draw_");
  const scopeIslands = input.islandMeshes.length > 1;
  const width = Math.max(1, Math.round(input.input.textureSize.width));
  const height = Math.max(1, Math.round(input.input.textureSize.height));

  const vertices: MeshDto["vertices"] = [];
  const uvs: MeshDto["uvs"] = [];
  const triangles: MeshDto["triangles"] = [];
  const vertexStableIds: string[] = [];
  const triangleStableIds: TriangleId[] = [];

  for (const islandMesh of input.islandMeshes) {
    const vertexOffset = vertices.length;
    const scopeSuffix = scopeIslands ? `_island_${islandMesh.island.componentOrder}` : "";

    islandMesh.points.forEach((point) => {
      vertices.push(mapPixelPointToStagePoint(point, input.input.bounds, width, height));
      uvs.push(mapPixelPointToUv(point, width, height));
      vertexStableIds.push(
        point.role === "boundary"
          ? `vtx_${token}_v7${scopeSuffix}_boundary_${point.stableOrder}`
          : `vtx_${token}_v7${scopeSuffix}_interior_${point.stableOrder}`
      );
    });

    islandMesh.triangles.forEach((triangle, triangleIndex) => {
      triangles.push([
        triangle[0] + vertexOffset,
        triangle[1] + vertexOffset,
        triangle[2] + vertexOffset
      ]);
      triangleStableIds.push(`tri_${token}_v7${scopeSuffix}_${triangleIndex}` as TriangleId);
    });
  }

  if (vertices.length < 3 || triangles.length === 0) {
    return {
      status: "blocked",
      reason: "v7-margin-contour-generation-failed"
    };
  }

  const mesh: MeshDto = {
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
  };

  const alphaBounds = unionStageAlphaBounds({
    islandMeshes: input.islandMeshes,
    bounds: input.input.bounds,
    width,
    height
  });
  // v7 diagnostics are provenance-only (wave decision: no preview-schema
  // changes). The v7 provenance tokens are recorded in the provenance record's
  // transformHistory via the source ID (meshSource:outline-v7-margin-contour-rgba)
  // by the operation layer; the quality metrics here stay purely geometric so no
  // v6Metrics / triangulationMode enum is touched.
  void candidate;
  const qualityMetrics = computeMeshQualityMetrics(mesh, {
    refinementIterationCount: 0
  });

  return {
    status: "generated",
    mesh,
    alphaBounds,
    qualityMetrics
  };
};

const unionStageAlphaBounds = (input: {
  readonly islandMeshes: readonly V7IslandMesh[];
  readonly bounds: RectDto;
  readonly width: number;
  readonly height: number;
}): RectDto => {
  const rects = input.islandMeshes.map((islandMesh) =>
    mapPixelBoundsToStageRect(islandMesh.alphaBoundsPixels, input.bounds, input.width, input.height)
  );
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return {
    x: roundCoordinate(left),
    y: roundCoordinate(top),
    width: roundCoordinate(right - left),
    height: roundCoordinate(bottom - top)
  };
};

const mapPixelPointToStagePoint = (
  point: GeometryPoint,
  bounds: RectDto,
  textureWidth: number,
  textureHeight: number
): GeometryPoint => ({
  x: roundCoordinate(bounds.x + bounds.width * (point.x / textureWidth)),
  y: roundCoordinate(bounds.y + bounds.height * (point.y / textureHeight))
});

const mapPixelPointToUv = (
  point: GeometryPoint,
  textureWidth: number,
  textureHeight: number
): GeometryPoint => ({
  x: roundCoordinate(clamp(point.x / textureWidth, 0, 1)),
  y: roundCoordinate(clamp(point.y / textureHeight, 0, 1))
});

const mapPixelBoundsToStageRect = (
  pixelBounds: PixelBounds,
  bounds: RectDto,
  textureWidth: number,
  textureHeight: number
): RectDto => {
  const topLeft = mapPixelPointToStagePoint(
    { x: pixelBounds.left, y: pixelBounds.top },
    bounds,
    textureWidth,
    textureHeight
  );
  const bottomRight = mapPixelPointToStagePoint(
    { x: pixelBounds.right, y: pixelBounds.bottom },
    bounds,
    textureWidth,
    textureHeight
  );
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: roundCoordinate(bottomRight.x - topLeft.x),
    height: roundCoordinate(bottomRight.y - topLeft.y)
  };
};

const stripIdPrefix = (id: string, prefix: string): string =>
  id.startsWith(prefix) ? id.slice(prefix.length) : id;
