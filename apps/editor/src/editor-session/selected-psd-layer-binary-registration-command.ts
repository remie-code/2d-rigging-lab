import type { TextureId } from "@private-2d-rigging-lab/contracts";
import {
  OperationIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { createProvenanceId } from "@private-2d-rigging-lab/operation-core";
import {
  BinaryAssetIdSchema,
  BinaryAssetMediaTypeSchema,
  BinaryAssetReferenceSchema,
  createPackageBinaryByteIntakeSummary,
  createPackageBinaryFileEntry,
  createPackageInMemoryFileSet,
  verifyPackageBinaryAssetBytes,
  type BinaryAssetReferenceDto,
  type PackageBinaryByteIntakeSummaryDto,
  type PackageBinaryBytes,
  type PackageBinaryFileEntry
} from "@private-2d-rigging-lab/package-format";

export interface EditorSelectedPsdLayerBinaryByteRegistration {
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly fileEntry: PackageBinaryFileEntry;
  readonly byteIntakeSummary: PackageBinaryByteIntakeSummaryDto;
  readonly textureId: TextureId;
}

export const createEditorSelectedPsdLayerBinaryByteRegistration = async (input: {
  readonly operationId: string;
  readonly sourceAssetId: string;
  readonly textureId: string;
  readonly sourceLayerId: string;
  readonly materializedDigest: BinaryAssetReferenceDto["digest"];
  readonly mediaType: string;
  readonly bytes: PackageBinaryBytes;
}): Promise<EditorSelectedPsdLayerBinaryByteRegistration> => {
  const operationId = OperationIdSchema.parse(input.operationId);
  const sourceAssetId = SourceAssetIdSchema.parse(input.sourceAssetId);
  const textureId = TextureIdSchema.parse(input.textureId);
  const mediaType = BinaryAssetMediaTypeSchema.parse(input.mediaType);
  const bytes = copyPackageBinaryBytes(input.bytes);
  const binaryAssetRef = BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: BinaryAssetIdSchema.parse(createTextureBinaryAssetId(textureId)),
    packageRelativePath: createTexturePackageRelativePath({
      sourceLayerId: input.sourceLayerId,
      digestHex: input.materializedDigest.hex
    }),
    digest: input.materializedDigest,
    byteLength: bytes.byteLength,
    mediaType,
    storageStatus: "stored-package-local-v1",
    provenanceId: createProvenanceId(operationId),
    rightsAssetId: sourceAssetId
  });
  const fileEntry = createPackageBinaryFileEntry({
    path: binaryAssetRef.packageRelativePath,
    bytes,
    mediaType: binaryAssetRef.mediaType,
    binaryAssetId: binaryAssetRef.binaryAssetId
  });
  const verificationReport = await verifyPackageBinaryAssetBytes(
    createPackageInMemoryFileSet([fileEntry]),
    binaryAssetRef
  );
  const byteIntakeSummary = createPackageBinaryByteIntakeSummary({
    filename: fileEntry.path.split("/").at(-1) ?? `${binaryAssetRef.binaryAssetId}.raw-rgba`,
    binaryAssetRef,
    verificationReport
  });

  return {
    binaryAssetRef,
    fileEntry,
    byteIntakeSummary,
    textureId
  };
};

const createTextureBinaryAssetId = (textureId: TextureId): string =>
  `bin_${stripIdPrefix(textureId, "tex_")}_raw_rgba`;

const createTexturePackageRelativePath = (input: {
  readonly sourceLayerId: string;
  readonly digestHex: string;
}): string =>
  `assets/textures/psd/${sanitizeIdToken(input.sourceLayerId)}_${input.digestHex.slice(0, 12)}.raw-rgba`;

const stripIdPrefix = (value: string, prefix: string): string =>
  value.startsWith(prefix) ? value.slice(prefix.length) : value;

const sanitizeIdToken = (value: string): string =>
  value.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "selected_layer";

const copyPackageBinaryBytes = (bytes: PackageBinaryBytes): Uint8Array =>
  bytes instanceof Uint8Array ? new Uint8Array(bytes) : new Uint8Array(bytes.slice(0));
