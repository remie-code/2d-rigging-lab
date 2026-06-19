import {
  TextureAtlasSourceSignatureSchema,
  type TextureAtlasLayoutSettingsDto,
  type TextureAtlasSourceSignatureDto
} from "@private-2d-rigging-lab/package-format";

import type {
  TextureAtlasPackableTarget,
  TextureAtlasTargetSelectionResult
} from "./texture-atlas-targets.js";

const SOURCE_INPUT_VERSION = "atlas-source-inputs-v1";
const SIGNATURE_ALGORITHM_ID = "stable-json-fnv1a32-v1";

export const createTextureAtlasSourceSignature = (input: {
  readonly settings: TextureAtlasLayoutSettingsDto;
  readonly targetSelection: TextureAtlasTargetSelectionResult;
  readonly packableTargets: readonly TextureAtlasPackableTarget[];
}): TextureAtlasSourceSignatureDto => {
  const boundDrawableIds = [...input.targetSelection.boundDrawableIds]
    .map(String)
    .sort();
  const packableDrawableIds = input.packableTargets.map((target) =>
    target.drawable.drawableId
  );
  const payload = {
    inputVersion: SOURCE_INPUT_VERSION,
    settings: normalizeSettings(input.settings),
    boundDrawableIds,
    packableTargets: input.packableTargets.map(normalizePackableTarget)
  };

  return TextureAtlasSourceSignatureSchema.parse({
    schemaVersion: "texture-atlas-source-signature-v1",
    inputVersion: SOURCE_INPUT_VERSION,
    algorithmId: SIGNATURE_ALGORITHM_ID,
    digest: hashString(JSON.stringify(payload)),
    boundDrawableIds,
    packableDrawableIds
  });
};

export const sameTextureAtlasSourceSignature = (
  left: TextureAtlasSourceSignatureDto | undefined,
  right: TextureAtlasSourceSignatureDto | undefined
): boolean =>
  left !== undefined &&
  right !== undefined &&
  left.inputVersion === right.inputVersion &&
  left.algorithmId === right.algorithmId &&
  left.digest === right.digest;

const normalizeSettings = (settings: TextureAtlasLayoutSettingsDto) => ({
  algorithmId: settings.algorithmId,
  pageWidth: settings.pageWidth,
  pageHeight: settings.pageHeight,
  paddingPixels: settings.paddingPixels,
  edgeExtrusion: {
    enabled: settings.edgeExtrusion.enabled,
    pixels: settings.edgeExtrusion.pixels
  }
});

const normalizePackableTarget = (target: TextureAtlasPackableTarget) => ({
  drawable: {
    drawableId: target.drawable.drawableId,
    meshId: target.drawable.meshId,
    textureId: target.drawable.textureId,
    sourceAssetId: target.drawable.sourceAssetId,
    sourceProvenanceId: target.drawable.sourceProvenanceId
  },
  mesh: {
    meshId: target.mesh.meshId,
    drawableId: target.mesh.drawableId,
    topologyRevision: target.mesh.topologyRevision ?? null,
    bounds: normalizeRect(target.mesh.bounds),
    vertices: target.mesh.vertices.map(normalizeVec2),
    uvs: target.mesh.uvs.map(normalizeVec2),
    triangles: target.mesh.triangles.map((triangle) => [...triangle]),
    vertexStableIds: [...(target.mesh.vertexStableIds ?? [])],
    triangleStableIds: [...(target.mesh.triangleStableIds ?? [])]
  },
  textureEntry: {
    textureId: target.textureEntry.textureId,
    filePath: target.textureEntry.filePath,
    contentHash: target.textureEntry.contentHash ?? null,
    dimensions: target.textureEntry.dimensions ?? null,
    sourceAssetId: target.textureEntry.sourceAssetId ?? null,
    sourceLayerId: target.textureEntry.sourceLayerId ?? null,
    provenanceId: target.textureEntry.provenanceId ?? null,
    binaryAssetRef: target.textureEntry.binaryAssetRef === undefined
      ? null
      : {
          binaryAssetId: target.textureEntry.binaryAssetRef.binaryAssetId,
          packageRelativePath: target.textureEntry.binaryAssetRef.packageRelativePath,
          digest: target.textureEntry.binaryAssetRef.digest,
          byteLength: target.textureEntry.binaryAssetRef.byteLength,
          mediaType: target.textureEntry.binaryAssetRef.mediaType,
          storageStatus: target.textureEntry.binaryAssetRef.storageStatus,
          provenanceId: target.textureEntry.binaryAssetRef.provenanceId,
          rightsAssetId: target.textureEntry.binaryAssetRef.rightsAssetId
        }
  },
  textureSize: {
    width: target.textureSize.width,
    height: target.textureSize.height
  },
  textureBytes: {
    byteLength: target.textureBytes.byteLength,
    fingerprint: hashBytes(target.textureBytes)
  }
});

const normalizeRect = (rect: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}) => ({
  x: normalizeNumber(rect.x),
  y: normalizeNumber(rect.y),
  width: normalizeNumber(rect.width),
  height: normalizeNumber(rect.height)
});

const normalizeVec2 = (point: {
  readonly x: number;
  readonly y: number;
}) => ({
  x: normalizeNumber(point.x),
  y: normalizeNumber(point.y)
});

const normalizeNumber = (value: number): number => Object.is(value, -0) ? 0 : value;

const hashString = (text: string): `fnv1a32:${string}` => {
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return `fnv1a32:${hash.toString(16).padStart(8, "0")}` as `fnv1a32:${string}`;
};

const hashBytes = (bytes: Uint8Array): `fnv1a32:${string}` => {
  let hash = 2166136261;

  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return `fnv1a32:${hash.toString(16).padStart(8, "0")}` as `fnv1a32:${string}`;
};
