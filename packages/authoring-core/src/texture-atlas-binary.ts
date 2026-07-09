import type {
  ProvenanceId,
  TextureId
} from "@private-2d-rigging-lab/contracts";
import {
  BinaryAssetReferenceSchema,
  computePackageBinarySha256Digest,
  getPackageBinaryByteLength,
  type BinaryAssetReferenceDto,
  type TextureAtlasPlacementDto
} from "@private-2d-rigging-lab/package-format";

import type { TextureAtlasPreview } from "./texture-atlas-packing.js";

export const TEXTURE_ATLAS_RAW_RGBA_MEDIA_TYPE =
  "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8";

export type TextureAtlasReadyPreview = Extract<TextureAtlasPreview, { readonly status: "ready" }>;

export const createTextureAtlasPageRgbaBytes = (
  preview: TextureAtlasReadyPreview
): Uint8Array => {
  const page = preview.layoutSummary.pages[0];
  if (page === undefined) {
    throw new Error("Texture atlas ready preview must contain one page.");
  }

  const pageBytes = new Uint8Array(page.width * page.height * 4);
  const targetsByDrawableId = new Map(
    preview.packableTargets.map((target) => [target.drawable.drawableId, target])
  );

  for (const placement of page.placements) {
    const target = targetsByDrawableId.get(placement.drawableId);
    if (target === undefined) {
      throw new Error(`Texture atlas placement has no target bytes: ${placement.drawableId}.`);
    }

    copyTextureIntoPlacement({
      pageBytes,
      pageWidth: page.width,
      sourceBytes: target.textureBytes,
      sourceWidth: target.textureSize.width,
      sourceHeight: target.textureSize.height,
      placement
    });

    if (
      preview.settings.edgeExtrusion.enabled &&
      preview.settings.edgeExtrusion.pixels > 0
    ) {
      extrudeTexturePlacementEdges({
        pageBytes,
        pageWidth: page.width,
        sourceBytes: target.textureBytes,
        sourceWidth: target.textureSize.width,
        sourceHeight: target.textureSize.height,
        placement,
        extrusionPixels: preview.settings.edgeExtrusion.pixels
      });
    }
  }

  return pageBytes;
};

export const createTextureAtlasBinaryAssetReference = async (input: {
  readonly atlasTextureId: TextureId;
  readonly bytes: Uint8Array;
  readonly provenanceId: ProvenanceId;
  readonly rightsAssetId: string;
  readonly packageRelativePath?: string;
}): Promise<BinaryAssetReferenceDto> => {
  const digestResult = await computePackageBinarySha256Digest(input.bytes);
  if (digestResult.status !== "computed") {
    throw new Error("SHA-256 digest support is required to register generated atlas bytes.");
  }

  const textureToken = stripTexturePrefix(input.atlasTextureId);
  const packageRelativePath =
    input.packageRelativePath ?? `assets/textures/${textureToken}.raw-rgba`;

  return BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: `bin_${textureToken}_rgba`,
    packageRelativePath,
    digest: digestResult.digest,
    byteLength: getPackageBinaryByteLength(input.bytes),
    mediaType: TEXTURE_ATLAS_RAW_RGBA_MEDIA_TYPE,
    storageStatus: "stored-package-local-v1",
    provenanceId: input.provenanceId,
    rightsAssetId: input.rightsAssetId
  });
};

const copyTextureIntoPlacement = (input: {
  readonly pageBytes: Uint8Array;
  readonly pageWidth: number;
  readonly sourceBytes: Uint8Array;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly placement: TextureAtlasPlacementDto;
}): void => {
  for (let sourceY = 0; sourceY < input.sourceHeight; sourceY += 1) {
    for (let sourceX = 0; sourceX < input.sourceWidth; sourceX += 1) {
      copyPixel({
        destinationBytes: input.pageBytes,
        destinationWidth: input.pageWidth,
        destinationX: input.placement.contentRectPixels.x + sourceX,
        destinationY: input.placement.contentRectPixels.y + sourceY,
        sourceBytes: input.sourceBytes,
        sourceWidth: input.sourceWidth,
        sourceX,
        sourceY
      });
    }
  }
};

// Clamps the source raster's outer edge outward into the surrounding atlas gutter
// (`paddedRect` minus `contentRect`), leaving the copied content untouched. Wave108
// D-atlas note: `contentRectPixels` is the placement of the **whole padded raster**,
// whose outer edge is now the transparent covering-margin border baked by D-texprep.
// Clamp-extruding a transparent edge therefore yields a **transparent** gutter for
// free — no logic change is needed to override §9's opaque edge-extrude for the
// covering margin (boundary-transparent-margin-design.md §4/§5/§9). The internal
// transparent band (raster interior, inside `contentRectPixels`) is skipped by the
// in-content `continue` below, so extrude never overwrites it with an opaque texel.
const extrudeTexturePlacementEdges = (input: {
  readonly pageBytes: Uint8Array;
  readonly pageWidth: number;
  readonly sourceBytes: Uint8Array;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly placement: TextureAtlasPlacementDto;
  readonly extrusionPixels: number;
}): void => {
  const padded = input.placement.paddedRectPixels;
  const content = input.placement.contentRectPixels;
  const extrusionLeft = Math.max(padded.x, content.x - input.extrusionPixels);
  const extrusionTop = Math.max(padded.y, content.y - input.extrusionPixels);
  const extrusionRight = Math.min(padded.x + padded.width, content.x + content.width + input.extrusionPixels);
  const extrusionBottom = Math.min(padded.y + padded.height, content.y + content.height + input.extrusionPixels);
  const contentRight = content.x + content.width;
  const contentBottom = content.y + content.height;

  for (let destinationY = extrusionTop; destinationY < extrusionBottom; destinationY += 1) {
    for (let destinationX = extrusionLeft; destinationX < extrusionRight; destinationX += 1) {
      if (
        destinationX >= content.x &&
        destinationX < contentRight &&
        destinationY >= content.y &&
        destinationY < contentBottom
      ) {
        continue;
      }

      const sourceX = clamp(destinationX - content.x, 0, input.sourceWidth - 1);
      const sourceY = clamp(destinationY - content.y, 0, input.sourceHeight - 1);
      copyPixel({
        destinationBytes: input.pageBytes,
        destinationWidth: input.pageWidth,
        destinationX,
        destinationY,
        sourceBytes: input.sourceBytes,
        sourceWidth: input.sourceWidth,
        sourceX,
        sourceY
      });
    }
  }
};

const copyPixel = (input: {
  readonly destinationBytes: Uint8Array;
  readonly destinationWidth: number;
  readonly destinationX: number;
  readonly destinationY: number;
  readonly sourceBytes: Uint8Array;
  readonly sourceWidth: number;
  readonly sourceX: number;
  readonly sourceY: number;
}): void => {
  const destinationIndex = (input.destinationY * input.destinationWidth + input.destinationX) * 4;
  const sourceIndex = (input.sourceY * input.sourceWidth + input.sourceX) * 4;

  input.destinationBytes[destinationIndex] = input.sourceBytes[sourceIndex] ?? 0;
  input.destinationBytes[destinationIndex + 1] = input.sourceBytes[sourceIndex + 1] ?? 0;
  input.destinationBytes[destinationIndex + 2] = input.sourceBytes[sourceIndex + 2] ?? 0;
  input.destinationBytes[destinationIndex + 3] = input.sourceBytes[sourceIndex + 3] ?? 0;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const stripTexturePrefix = (textureId: string): string =>
  textureId.startsWith("tex_") ? textureId.slice("tex_".length) : textureId;
