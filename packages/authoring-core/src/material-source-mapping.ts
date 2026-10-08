import { MeshIdSchema, ProvenanceIdSchema, SourceAssetIdSchema, TextureIdSchema,
  type MaterialCandidate, type MaterialNormalizedImage, type RectDto } from "@private-2d-rigging-lab/contracts";
import { BinaryAssetReferenceSchema, SourceAssetSchema, ProvenanceRecordSchema, RightsRecordSchema } from "@private-2d-rigging-lab/package-format";
import type { AuthoringSession } from "./authoring-session.js";
import { importSourceAssetMetadata } from "./source-asset-mutations.js";
import { upsertTexturePreviewAssetMetadata } from "./texture-asset-mutations.js";
import { registerAuthoringSessionBinaryBytes } from "./binary-byte-registration.js";

export const createMaterialSourceMapping = (session: AuthoringSession, candidate: MaterialCandidate, image: MaterialNormalizedImage) => {
  // A new namespace on every build prevents overwriting any existing shared asset.
  const existing = new Set<string>([
    ...session.graph.sourceAssets.flatMap((item) => [item.sourceAssetId, item.filePath, ...item.layers.map((layer) => layer.sourceLayerId)]),
    ...(session.graph.textureAtlas?.textures ?? []).flatMap((item) => [item.textureId, item.filePath]),
    ...(session.graph.textureAtlas?.previewAssets ?? []).map((item) => item.previewAssetId),
    ...session.graph.meshes.map((item) => item.meshId),
    ...session.graph.provenanceRecords.map((item) => item.provenanceId),
    ...session.graph.rightsRecords.map((item) => item.assetId),
    ...(session.binaryAssets?.fileEntries ?? []).flatMap((item) => [item.path, item.binaryAssetId ?? ""]),
    ...(session.binaryAssets?.binaryAssetIndex.assets ?? []).flatMap((item) => [item.binaryAssetId, item.packageRelativePath])
  ]);
  let suffix = 0;
  let token: string;
  do { token = `${candidate.candidateId}_${candidate.candidateRevision}_${suffix++}`; }
  while ([`src_${token}`, `tex_${token}`, `prov_${token}`, `mesh_${token}`, `bin_${token}`, `layer_${token}`, `preview_${token}`,
    `assets/textures/${token}.rgba`].some((id) => existing.has(id)));
  const sourceAssetId = SourceAssetIdSchema.parse(`src_${token}`);
  const textureId = TextureIdSchema.parse(`tex_${token}`);
  const provenanceId = ProvenanceIdSchema.parse(`prov_${token}`);
  const meshId = MeshIdSchema.parse(`mesh_${token}`);
  const sourceLayerId = `layer_${token}`;
  const filePath = `assets/textures/${token}.rgba`;
  const { width, height, contentInset: inset, rgbaSha256 } = image.descriptor;
  const { scale, translation } = candidate.placement;
  const bounds: RectDto = { x: translation.x + scale * inset.left, y: translation.y + scale * inset.top,
    width: scale * (width - inset.left - inset.right), height: scale * (height - inset.top - inset.bottom) };
  if (Object.values(bounds).some((value) => !Number.isFinite(value)) || bounds.width <= 0 || bounds.height <= 0) {
    throw new Error("Material placement produces invalid stage bounds.");
  }
  const binaryAssetRef = BinaryAssetReferenceSchema.parse({ referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: `bin_${token}`, packageRelativePath: filePath, digest: { algorithm: "sha256", hex: rgbaSha256 },
    byteLength: image.rgbaBytes.length, mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
    storageStatus: "stored-package-local-v1", provenanceId, rightsAssetId: sourceAssetId });
  importSourceAssetMetadata(session, {
    sourceAsset: SourceAssetSchema.parse({ sourceAssetId, kind: "split-png-set-v1", filePath,
      contentHash: rgbaSha256, importProfile: "split-png-fallback-v1", binaryAssetRef,
      layers: [{ sourceLayerId, sourceAssetId, originalName: candidate.candidateId, normalizedName: candidate.candidateId,
        groupPath: [], bounds, visibleInSource: true, opacityInSource: 1, role: "editableLayer", mappedDrawableIds: [] }] }),
    provenanceRecord: ProvenanceRecordSchema.parse({ provenanceId, assetId: sourceAssetId, assetKind: "aiEdit", filePath,
      contentHash: rgbaSha256, creator: "generated-material", license: "unspecified", redistributionAllowed: false, aiUsed: true,
      transformHistory: [candidate.provenance.note, `originalFileSha256=${image.descriptor.originalFileSha256}`,
        `normalizedRgbaSha256=${rgbaSha256}`, `placement=${JSON.stringify(candidate.placement)}`, "Material geometry rebuilt; no keyform migration."] }),
    rightsRecord: RightsRecordSchema.parse({ assetId: sourceAssetId, rightsStatus: "needs_review", license: "unspecified",
      redistributionAllowed: false, notes: "Material contract carries no license grant." })
  });
  upsertTexturePreviewAssetMetadata(session, { textureEntry: { textureId, filePath, contentHash: rgbaSha256,
    sourceAssetId, sourceLayerId, provenanceId, binaryAssetRef, dimensions: { width, height, pixelFormat: "rgba8" }, contentInset: { ...inset } },
    previewAsset: { previewAssetId: `preview_${token}`, textureId, reference: { referenceKind: "package-local-file-v1", filePath },
      contentHash: rgbaSha256, sourceAssetId, sourceLayerId, provenanceId, rightsAssetId: sourceAssetId } });
  registerAuthoringSessionBinaryBytes(session, { binaryAssetRef, bytes: image.rgbaBytes, role: "texture-raster-v1", sourceAssetId, textureId });
  return { sourceAssetId, sourceLayerId, textureId, provenanceId, meshId, bounds };
};
export type MaterialSourceMapping = ReturnType<typeof createMaterialSourceMapping>;
