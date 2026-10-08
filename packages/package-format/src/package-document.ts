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
import {
  VariantsFileSchema,
  createEmptyVariantsFile,
  type VariantsFileDto
} from "./model-variants.js";
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
  variants: VariantsFileSchema.default(createEmptyVariantsFile),
  editorState: EditorStateFileSchema.optional()
});
export type PackageModelFilesDto =
  Omit<z.infer<typeof PackageModelFilesSchema>, "variants"> & {
    readonly variants?: VariantsFileDto;
  };

export const PackageAssetFilesSchema = z.object({
  sourceManifest: SourceManifestSchema,
  textureAtlas: TextureAtlasFileSchema.optional(),
  provenance: ProvenanceFileSchema,
  rights: RightsFileSchema
});
export type PackageAssetFilesDto = z.infer<typeof PackageAssetFilesSchema>;

const PackageDocumentBaseSchema = z.object({
  manifest: PackageManifestSchema,
  model: PackageModelFilesSchema,
  assets: PackageAssetFilesSchema
});

export const PackageDocumentSchema = PackageDocumentBaseSchema.superRefine((document, context) => {
  const drawableIds = new Set(
    document.model.drawables.drawables.map((drawable) => drawable.drawableId)
  );

  document.model.variants.variantGroups.forEach((group, groupIndex) => {
    group.targetDrawableIds.forEach((drawableId, drawableIndex) => {
      if (!drawableIds.has(drawableId)) {
        context.addIssue({
          code: "custom",
          path: ["model", "variants", "variantGroups", groupIndex, "targetDrawableIds", drawableIndex],
          message: `Variant target drawable does not exist: ${drawableId}.`
        });
      }
    });
  });
});
export type PackageDocumentDto =
  Omit<z.infer<typeof PackageDocumentBaseSchema>, "model"> & {
    readonly model: PackageModelFilesDto;
  };

export function parsePackageDocument(input: unknown): PackageParseResult<PackageDocumentDto> {
  return toPackageParseResult(PackageDocumentSchema.safeParse(input));
}
