import { z } from "zod";

import { ProvenanceFileSchema, RightsFileSchema } from "./asset-metadata.js";
import {
  DrawablesFileSchema,
  DrawOrderFileSchema,
  DynamicsFileSchema,
  EditorStateFileSchema,
  KeyformsFileSchema,
  MasksFileSchema,
  MeshesFileSchema,
  ParametersFileSchema,
  RigControlsFileSchema
} from "./model-files.js";
import { ModelGraphSchema } from "./model-graph.js";
import { PackageManifestSchema } from "./package-manifest.js";
import { toPackageParseResult, type PackageParseResult } from "./parse-result.js";
import { SourceManifestSchema } from "./source-manifest.js";
import { TextureAtlasFileSchema } from "./texture-atlas.js";

export const PackageModelFilesSchema = z.object({
  graph: ModelGraphSchema,
  drawables: DrawablesFileSchema,
  meshes: MeshesFileSchema,
  parameters: ParametersFileSchema,
  keyforms: KeyformsFileSchema,
  rigControls: RigControlsFileSchema,
  dynamics: DynamicsFileSchema,
  masks: MasksFileSchema,
  drawOrder: DrawOrderFileSchema,
  editorState: EditorStateFileSchema.optional()
});
export type PackageModelFilesDto = z.infer<typeof PackageModelFilesSchema>;

export const PackageAssetFilesSchema = z.object({
  sourceManifest: SourceManifestSchema,
  textureAtlas: TextureAtlasFileSchema.optional(),
  provenance: ProvenanceFileSchema,
  rights: RightsFileSchema
});
export type PackageAssetFilesDto = z.infer<typeof PackageAssetFilesSchema>;

export const PackageDocumentSchema = z.object({
  manifest: PackageManifestSchema,
  model: PackageModelFilesSchema,
  assets: PackageAssetFilesSchema
});
export type PackageDocumentDto = z.infer<typeof PackageDocumentSchema>;

export function parsePackageDocument(input: unknown): PackageParseResult<PackageDocumentDto> {
  return toPackageParseResult(PackageDocumentSchema.safeParse(input));
}
