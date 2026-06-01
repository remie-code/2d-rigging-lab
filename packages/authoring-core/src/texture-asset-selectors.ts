import type { TextureId } from "@private-2d-rigging-lab/contracts";
import type { TextureAtlasEntryDto } from "@private-2d-rigging-lab/package-format";

import type { AuthoringGraph } from "./authoring-graph.js";

export const getTextureAtlasEntryById = (
  graph: AuthoringGraph,
  textureId: TextureId
): TextureAtlasEntryDto | undefined =>
  graph.textureAtlas?.textures.find((texture) => texture.textureId === textureId);

export const hasTextureAtlasEntry = (graph: AuthoringGraph, textureId: TextureId): boolean =>
  getTextureAtlasEntryById(graph, textureId) !== undefined;
