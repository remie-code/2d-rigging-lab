import type {
  DrawableId,
  MeshId,
  PartId,
  SourceAssetId
} from "@private-2d-rigging-lab/contracts";
import type {
  DrawableDto,
  MeshDto,
  ModelPartDto,
  SourceAssetDto
} from "@private-2d-rigging-lab/package-format";

import type { AuthoringGraph } from "./authoring-graph.js";

export const getDrawableById = (
  graph: AuthoringGraph,
  drawableId: DrawableId
): DrawableDto | undefined =>
  graph.drawables.find((drawable) => drawable.drawableId === drawableId);

export const hasDrawable = (graph: AuthoringGraph, drawableId: DrawableId): boolean =>
  getDrawableById(graph, drawableId) !== undefined;

export const getMeshById = (graph: AuthoringGraph, meshId: MeshId): MeshDto | undefined =>
  graph.meshes.find((mesh) => mesh.meshId === meshId);

export const hasMesh = (graph: AuthoringGraph, meshId: MeshId): boolean =>
  getMeshById(graph, meshId) !== undefined;

export const getPartById = (graph: AuthoringGraph, partId: PartId): ModelPartDto | undefined =>
  graph.parts.find((part) => part.partId === partId);

export const getSourceAssetById = (
  graph: AuthoringGraph,
  sourceAssetId: SourceAssetId
): SourceAssetDto | undefined =>
  graph.sourceAssets.find((sourceAsset) => sourceAsset.sourceAssetId === sourceAssetId);
