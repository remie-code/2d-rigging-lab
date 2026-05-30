import {
  SourceAssetIdSchema,
  TextureIdSchema,
  type SourceAssetId,
  type TextureId
} from "@private-2d-rigging-lab/contracts";
import type {
  TextureAtlasFileDto,
  TexturePreviewAssetDto
} from "@private-2d-rigging-lab/package-format";

import type {
  EditorPreviewDrawableDto,
  EditorPreviewDrawableTextureDto,
  EditorPreviewDrawableTexturePreviewReferenceDto,
  EditorPreviewProjectionDto
} from "./preview-dto.js";

export interface EditorPreviewDrawableTextureReferenceInput {
  readonly drawableId: string;
  readonly textureId?: TextureId | string;
  readonly sourceAssetId?: SourceAssetId | string;
  readonly sourceLayerId?: string;
}

export interface ApplyEditorPreviewTextureAssetsInput {
  readonly preview: EditorPreviewProjectionDto | null;
  readonly textureAtlas?: TextureAtlasFileDto;
  readonly drawableTextures?: readonly EditorPreviewDrawableTextureReferenceInput[];
}

export const applyEditorPreviewTextureAssets = (
  input: ApplyEditorPreviewTextureAssetsInput
): EditorPreviewProjectionDto | null => {
  if (input.preview === null) {
    return null;
  }

  const drawableTexturesById = new Map(
    (input.drawableTextures ?? []).map((drawableTexture) => [
      drawableTexture.drawableId,
      drawableTexture
    ])
  );

  return {
    ...input.preview,
    drawables: input.preview.drawables.map((drawable) =>
      applyDrawableTextureAssets({
        drawable,
        textureAtlas: input.textureAtlas,
        drawableTexture: drawableTexturesById.get(drawable.drawableId)
      })
    )
  };
};

const applyDrawableTextureAssets = (input: {
  readonly drawable: EditorPreviewDrawableDto;
  readonly textureAtlas: TextureAtlasFileDto | undefined;
  readonly drawableTexture: EditorPreviewDrawableTextureReferenceInput | undefined;
}): EditorPreviewDrawableDto => {
  const textureId = input.drawable.texture.textureId ?? normalizeTextureId(input.drawableTexture?.textureId);
  const sourceAssetId =
    input.drawable.texture.sourceAssetId ?? normalizeSourceAssetId(input.drawableTexture?.sourceAssetId);
  const sourceLayerId =
    input.drawable.texture.sourceLayerId ?? normalizeOptionalString(input.drawableTexture?.sourceLayerId);
  const previewAsset = findPreviewAsset({
    textureAtlas: input.textureAtlas,
    textureId,
    sourceAssetId,
    sourceLayerId
  });

  return {
    ...input.drawable,
    texture: {
      ...input.drawable.texture,
      status: resolveTextureStatus(input.drawable.texture, textureId, previewAsset),
      ...(textureId === undefined ? {} : { textureId }),
      ...(sourceAssetId === undefined ? {} : { sourceAssetId }),
      ...(sourceLayerId === undefined ? {} : { sourceLayerId }),
      ...(previewAsset === undefined
        ? {}
        : { previewReference: projectPreviewReference(previewAsset) })
    }
  };
};

const resolveTextureStatus = (
  texture: EditorPreviewDrawableTextureDto,
  textureId: string | undefined,
  previewAsset: TexturePreviewAssetDto | undefined
): EditorPreviewDrawableTextureDto["status"] => {
  if (previewAsset !== undefined) {
    return "resolved";
  }

  if (textureId === undefined) {
    return texture.status === "missing" ? "missing" : texture.status;
  }

  if (texture.status === "missing") {
    return "missing";
  }

  return "not_materialized";
};

const findPreviewAsset = (input: {
  readonly textureAtlas: TextureAtlasFileDto | undefined;
  readonly textureId: string | undefined;
  readonly sourceAssetId: string | undefined;
  readonly sourceLayerId: string | undefined;
}): TexturePreviewAssetDto | undefined => {
  if (input.textureAtlas === undefined || input.textureId === undefined) {
    return undefined;
  }

  const previewAssets = (input.textureAtlas.previewAssets ?? []).filter(
    (asset) => asset.textureId === input.textureId
  );

  return (
    previewAssets.find(
      (asset) =>
        (input.sourceAssetId === undefined || asset.sourceAssetId === input.sourceAssetId) &&
        (input.sourceLayerId === undefined || asset.sourceLayerId === input.sourceLayerId)
    ) ?? previewAssets[0]
  );
};

const projectPreviewReference = (
  previewAsset: TexturePreviewAssetDto
): EditorPreviewDrawableTexturePreviewReferenceDto => {
  if (previewAsset.reference.referenceKind === "deterministic-data-url-v1") {
    return {
      previewAssetId: previewAsset.previewAssetId,
      referenceKind: previewAsset.reference.referenceKind,
      href: previewAsset.reference.dataUrl
    };
  }

  return {
    previewAssetId: previewAsset.previewAssetId,
    referenceKind: previewAsset.reference.referenceKind,
    href: previewAsset.reference.filePath
  };
};

const normalizeOptionalString = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized === undefined || normalized.length === 0 ? undefined : normalized;
};

const normalizeTextureId = (value: TextureId | string | undefined): TextureId | undefined => {
  const normalized = normalizeOptionalString(value);
  if (normalized === undefined) {
    return undefined;
  }

  const result = TextureIdSchema.safeParse(normalized);
  return result.success ? result.data : undefined;
};

const normalizeSourceAssetId = (value: SourceAssetId | string | undefined): SourceAssetId | undefined => {
  const normalized = normalizeOptionalString(value);
  if (normalized === undefined) {
    return undefined;
  }

  const result = SourceAssetIdSchema.safeParse(normalized);
  return result.success ? result.data : undefined;
};
