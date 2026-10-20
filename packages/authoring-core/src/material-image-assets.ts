import { MeshIdSchema, ProvenanceIdSchema, SourceAssetIdSchema, TextureIdSchema,
  type MaterialContentInset, type MeshId, type ProvenanceId, type SourceAssetId, type TextureId } from "@private-2d-rigging-lab/contracts";
import { BinaryAssetReferenceSchema, type BinaryAssetReferenceDto } from "@private-2d-rigging-lab/package-format";
import type { AuthoringSession } from "./authoring-session.js";
import { registerAuthoringSessionBinaryBytes } from "./binary-byte-registration.js";
import { MaterialRejection } from "./material-validation.js";

export const MATERIAL_RGBA_MEDIA_TYPE = "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8";

/** Normalized straight-alpha RGBA8 image facts a drawable is built from. A full MaterialImageDescriptor satisfies it. */
export interface MaterialImageSubject {
  readonly rgbaSha256: string;
  readonly width: number;
  readonly height: number;
  readonly contentInset: MaterialContentInset;
  readonly originalFileSha256?: string;
}

/** Package IDs and the binary reference derived from one ID seed. Session independent, so a host can register first. */
export interface MaterialImageAssetPlan {
  readonly idSeed: string;
  readonly sourceAssetId: SourceAssetId;
  readonly sourceLayerId: string;
  readonly textureId: TextureId;
  readonly provenanceId: ProvenanceId;
  readonly meshId: MeshId;
  readonly previewAssetId: string;
  readonly filePath: string;
  readonly binaryAssetRef: BinaryAssetReferenceDto;
}

export const planMaterialImageAssets = (
  idSeed: string, image: Pick<MaterialImageSubject, "rgbaSha256" | "width" | "height">
): MaterialImageAssetPlan => {
  if (!/^[A-Za-z0-9_-]+$/.test(idSeed)) {
    throw new MaterialRejection("idSeedInvalid", `Material ID seed must match [A-Za-z0-9_-]+: ${idSeed}`);
  }
  const byteLength = image.width * image.height * 4;
  if (!Number.isSafeInteger(byteLength) || byteLength <= 0) throw new MaterialRejection("imageDimensionsInvalid", "Material image dimensions are invalid.");
  const sourceAssetId = SourceAssetIdSchema.parse(`src_${idSeed}`);
  const provenanceId = ProvenanceIdSchema.parse(`prov_${idSeed}`);
  const filePath = `assets/textures/${idSeed}.rgba`;
  return {
    idSeed, sourceAssetId, provenanceId, filePath,
    sourceLayerId: `layer_${idSeed}`,
    textureId: TextureIdSchema.parse(`tex_${idSeed}`),
    meshId: MeshIdSchema.parse(`mesh_${idSeed}`),
    previewAssetId: `preview_${idSeed}`,
    binaryAssetRef: BinaryAssetReferenceSchema.parse({ referenceKind: "package-binary-asset-ref-v1",
      binaryAssetId: `bin_${idSeed}`, packageRelativePath: filePath, digest: { algorithm: "sha256", hex: image.rgbaSha256 },
      byteLength, mediaType: MATERIAL_RGBA_MEDIA_TYPE, storageStatus: "stored-package-local-v1", provenanceId, rightsAssetId: sourceAssetId })
  };
};

export interface RegisterMaterialImageBytesInput {
  readonly idSeed: string;
  /** `rgbaSha256` must be the SHA-256 the caller computed from `rgbaBytes`; this function does not hash. */
  readonly image: Pick<MaterialImageSubject, "rgbaSha256" | "width" | "height">;
  readonly rgbaBytes: Uint8Array;
  readonly createdByOperationId?: string;
}

/**
 * Caller-side step that must run before addDrawableFromImage / replaceDrawableImage:
 * register the normalized RGBA bytes at the location planned for the same ID seed.
 */
export const registerMaterialImageBytes = (session: AuthoringSession, input: RegisterMaterialImageBytesInput): MaterialImageAssetPlan => {
  const plan = planMaterialImageAssets(input.idSeed, input.image);
  if (input.rgbaBytes.byteLength !== plan.binaryAssetRef.byteLength) {
    throw new MaterialRejection("imageDigestMismatch", "RGBA byte length does not match width * height * 4.");
  }
  registerAuthoringSessionBinaryBytes(session, { binaryAssetRef: plan.binaryAssetRef, bytes: input.rgbaBytes,
    role: "texture-raster-v1", sourceAssetId: plan.sourceAssetId, textureId: plan.textureId,
    ...(input.createdByOperationId === undefined ? {} : { createdByOperationId: input.createdByOperationId }) });
  return plan;
};

/** Finds the bytes registered for the plan. Compares declared digests only; never recomputes SHA-256. */
export const requireRegisteredMaterialImageBytes = (session: AuthoringSession, plan: MaterialImageAssetPlan): Uint8Array => {
  const ref = plan.binaryAssetRef;
  const target = { kind: "texture" as const, id: plan.textureId, path: ref.packageRelativePath };
  const entry = session.binaryAssets?.binaryAssetIndex.assets.find((item) => item.binaryAssetId === ref.binaryAssetId);
  const file = session.binaryAssets?.fileEntries.find((item) => item.path === ref.packageRelativePath);
  if (entry === undefined || file === undefined) {
    throw new MaterialRejection("imageBytesMissing",
      `RGBA bytes are not registered at ${ref.packageRelativePath} (${ref.binaryAssetId}); register them before adding or replacing.`, target);
  }
  if (entry.digest.algorithm !== ref.digest.algorithm || entry.digest.hex !== ref.digest.hex ||
      entry.byteLength !== ref.byteLength || file.bytes.byteLength !== ref.byteLength) {
    throw new MaterialRejection("imageDigestMismatch",
      `Registered RGBA bytes (sha256=${entry.digest.hex}, ${file.bytes.byteLength} bytes) do not match sha256=${ref.digest.hex}, ${ref.byteLength} bytes.`, target);
  }
  if (entry.packageRelativePath !== ref.packageRelativePath || entry.mediaType !== ref.mediaType || file.mediaType !== ref.mediaType ||
      entry.storageStatus !== ref.storageStatus || entry.provenanceId !== ref.provenanceId || entry.rightsAssetId !== ref.rightsAssetId ||
      file.binaryAssetId !== ref.binaryAssetId) {
    throw new MaterialRejection("imageBytesMismatch", `Registered binary metadata for ${ref.binaryAssetId} does not match the planned material asset.`, target);
  }
  return file.bytes;
};

export const materialRgbaHasVisiblePixel = (rgbaBytes: Uint8Array): boolean => {
  for (let offset = 3; offset < rgbaBytes.length; offset += 4) if (rgbaBytes[offset] !== 0) return true;
  return false;
};
