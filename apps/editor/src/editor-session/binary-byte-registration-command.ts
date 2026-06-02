import type { OperationId, SourceAssetId } from "@private-2d-rigging-lab/contracts";
import { OperationIdSchema, SourceAssetIdSchema } from "@private-2d-rigging-lab/contracts";
import { createProvenanceId } from "@private-2d-rigging-lab/operation-core";
import {
  BinaryAssetIdSchema,
  BinaryAssetMediaTypeSchema,
  BinaryAssetReferenceSchema,
  createPackageBinaryByteIntakeSummary,
  createPackageBinaryFileEntry,
  createPackageInMemoryFileSet,
  computePackageBinarySha256Digest,
  getPackageBinaryByteLength,
  verifyPackageBinaryAssetBytes,
  type BinaryAssetReferenceDto,
  type PackageBinaryByteIntakeSummaryDto,
  type PackageBinaryBytes,
  type PackageBinaryFileEntry
} from "@private-2d-rigging-lab/package-format";
import type { ByteIntakeAssetPreflightInput } from "@private-2d-rigging-lab/validator-core";

import type { EditorImportPsdSourceAssetCommand } from "./source-import-command.js";

type ByteIntakeUnsupportedClaim = NonNullable<
  ByteIntakeAssetPreflightInput["unsupportedClaims"]
>[number];

export interface EditorBrowserSourceBinaryFileInput {
  readonly fileName: string;
  readonly bytes: PackageBinaryBytes;
  readonly declaredMediaType?: string;
  readonly binaryAssetId?: string;
}

export interface EditorBrowserBinaryStorageEvidence {
  readonly byteSource: "browser-file-input-v1";
  readonly packageLocalStorageScope: "current-editor-session-memory-v1";
  readonly metadataSnapshotPersistence: "bytes-not-persisted-by-browser-metadata-snapshot-v1";
  readonly reloadPolicy: "requires-browser-file-reupload-after-metadata-only-reload-v1";
  readonly parserSupport: "not-claimed-v1";
  readonly imageDecodeSupport: "not-claimed-v1";
  readonly archiveSupport: "not-claimed-v1";
}

export interface EditorSourceBinaryByteRegistration {
  readonly operationId: OperationId;
  readonly sourceAssetId: SourceAssetId;
  readonly filename: string;
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly fileEntry: PackageBinaryFileEntry;
  readonly byteIntakeSummary: PackageBinaryByteIntakeSummaryDto;
  readonly byteIntakePreflightAsset: ByteIntakeAssetPreflightInput;
  readonly browserStorageEvidence: EditorBrowserBinaryStorageEvidence;
}

export interface EditorImportPsdSourceAssetWithBinaryBytesCommand
  extends Omit<
    EditorImportPsdSourceAssetCommand,
    "operationId" | "sourceAssetId" | "fileRef"
  > {
  readonly operationId: OperationId | string;
  readonly sourceAssetId: SourceAssetId | string;
  readonly fileRef: {
    readonly packageRelativePath: string;
  };
  readonly selectedFile: EditorBrowserSourceBinaryFileInput;
}

export const createEditorBrowserSourceBinaryByteRegistration = async (input: {
  readonly operationId: OperationId | string;
  readonly sourceAssetId: SourceAssetId | string;
  readonly packageRelativePath: string;
  readonly selectedFile: EditorBrowserSourceBinaryFileInput;
}): Promise<EditorSourceBinaryByteRegistration> => {
  const operationId = OperationIdSchema.parse(input.operationId);
  const sourceAssetId = SourceAssetIdSchema.parse(input.sourceAssetId);
  const mediaType = BinaryAssetMediaTypeSchema.parse(
    normalizeBrowserDeclaredMediaType(input.selectedFile.declaredMediaType)
  );
  const binaryAssetId = BinaryAssetIdSchema.parse(
    input.selectedFile.binaryAssetId ?? createSourceBinaryAssetId(sourceAssetId)
  );
  const digestResult = await computePackageBinarySha256Digest(input.selectedFile.bytes);

  if (digestResult.status === "unsupported") {
    throw new Error(
      `Cannot register package-local binary bytes: SHA-256 digest is unavailable (${digestResult.reason}).`
    );
  }

  const binaryAssetRef = BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId,
    packageRelativePath: input.packageRelativePath,
    digest: digestResult.digest,
    byteLength: getPackageBinaryByteLength(input.selectedFile.bytes),
    mediaType,
    storageStatus: "stored-package-local-v1",
    provenanceId: createProvenanceId(operationId),
    rightsAssetId: sourceAssetId
  });
  const fileEntry = createPackageBinaryFileEntry({
    path: binaryAssetRef.packageRelativePath,
    bytes: input.selectedFile.bytes,
    mediaType: binaryAssetRef.mediaType,
    binaryAssetId: binaryAssetRef.binaryAssetId
  });
  const verificationReport = await verifyPackageBinaryAssetBytes(
    createPackageInMemoryFileSet([fileEntry]),
    binaryAssetRef
  );
  const filename = input.selectedFile.fileName.trim();
  const byteIntakeSummary = createPackageBinaryByteIntakeSummary({
    filename,
    binaryAssetRef,
    verificationReport
  });

  return {
    operationId,
    sourceAssetId,
    filename,
    binaryAssetRef,
    fileEntry,
    byteIntakeSummary,
    byteIntakePreflightAsset: createSourceByteIntakePreflightAsset({
      sourceAssetId,
      byteIntakeSummary,
      fileMediaType: mediaType
    }),
    browserStorageEvidence: createEditorBrowserBinaryStorageEvidence()
  };
};

export const createImportPsdSourceAssetCommandWithBinaryBytes = (
  command: EditorImportPsdSourceAssetWithBinaryBytesCommand,
  registration: EditorSourceBinaryByteRegistration
): EditorImportPsdSourceAssetCommand => ({
  ...command,
  operationId: registration.operationId,
  sourceAssetId: registration.sourceAssetId,
  fileRef: {
    packageRelativePath: registration.binaryAssetRef.packageRelativePath,
    contentHash: `${registration.binaryAssetRef.digest.algorithm}:${registration.binaryAssetRef.digest.hex}`,
    binaryAssetRef: registration.binaryAssetRef
  }
});

export const createSourceByteIntakePreflightAsset = (input: {
  readonly sourceAssetId: SourceAssetId | string;
  readonly byteIntakeSummary: PackageBinaryByteIntakeSummaryDto;
  readonly fileMediaType?: string;
}): ByteIntakeAssetPreflightInput => ({
  intakeSummary: input.byteIntakeSummary,
  ...(input.fileMediaType === undefined ? {} : { fileMediaType: input.fileMediaType }),
  targetKind: "sourceAsset",
  targetId: SourceAssetIdSchema.parse(input.sourceAssetId),
  targetPath: `/assets/sourceManifest/sourceAssets/${input.sourceAssetId}/binaryAssetRef`,
  unsupportedClaims: createUnsupportedByteIntakeClaims()
});

export const createEditorBrowserBinaryStorageEvidence =
  (): EditorBrowserBinaryStorageEvidence => ({
    byteSource: "browser-file-input-v1",
    packageLocalStorageScope: "current-editor-session-memory-v1",
    metadataSnapshotPersistence: "bytes-not-persisted-by-browser-metadata-snapshot-v1",
    reloadPolicy: "requires-browser-file-reupload-after-metadata-only-reload-v1",
    parserSupport: "not-claimed-v1",
    imageDecodeSupport: "not-claimed-v1",
    archiveSupport: "not-claimed-v1"
  });

export const createUnsupportedByteIntakeClaims = (): readonly ByteIntakeUnsupportedClaim[] => [
  {
    claimKind: "parser",
    status: "unsupported",
    source: "editor-session.binary-byte-registration",
    evidence: ["parserSupport=not-claimed-v1"]
  },
  {
    claimKind: "imageDecode",
    status: "unsupported",
    source: "editor-session.binary-byte-registration",
    evidence: ["imageDecodeSupport=not-claimed-v1"]
  },
  {
    claimKind: "archive",
    status: "unsupported",
    source: "editor-session.binary-byte-registration",
    evidence: ["archiveSupport=not-claimed-v1"]
  }
];

const normalizeBrowserDeclaredMediaType = (mediaType: string | undefined): string => {
  const normalized = mediaType?.trim().toLowerCase();
  return normalized === undefined || normalized.length === 0
    ? "application/octet-stream"
    : normalized;
};

const createSourceBinaryAssetId = (sourceAssetId: SourceAssetId): string => {
  const sourceSuffix = sourceAssetId.replace(/^src_/, "");
  const safeSuffix = sourceSuffix.replace(/[^A-Za-z0-9_-]/g, "_");
  return `bin_${safeSuffix}_source`;
};
