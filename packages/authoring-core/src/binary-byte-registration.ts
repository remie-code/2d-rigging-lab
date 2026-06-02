import {
  BinaryAssetEntrySchema,
  BinaryAssetIndexFileSchema,
  BinaryAssetReferenceSchema,
  createPackageBinaryFileEntry,
  type BinaryAssetEntryDto,
  type BinaryAssetReferenceDto,
  type BinaryAssetRoleDto,
  type PackageBinaryByteIntakeSummaryDto,
  type PackageBinaryBytes,
  type PackageBinaryFileEntry
} from "@private-2d-rigging-lab/package-format";
import type {
  OperationId,
  SourceAssetId,
  TextureId
} from "@private-2d-rigging-lab/contracts";

import type {
  AuthoringSession,
  AuthoringSessionBinaryAssets
} from "./authoring-session.js";

export interface RegisterAuthoringSessionBinaryBytesInput {
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly bytes: PackageBinaryBytes;
  readonly role: BinaryAssetRoleDto;
  readonly sourceAssetId?: SourceAssetId | string;
  readonly textureId?: TextureId | string;
  readonly createdByOperationId?: OperationId | string;
  readonly byteIntakeSummary?: PackageBinaryByteIntakeSummaryDto;
}

export interface RegisterAuthoringSessionBinaryBytesResult {
  readonly fileEntry: PackageBinaryFileEntry;
  readonly binaryAssetEntry: BinaryAssetEntryDto;
  readonly byteIntakeSummary?: PackageBinaryByteIntakeSummaryDto;
}

export const registerAuthoringSessionBinaryBytes = (
  session: AuthoringSession,
  input: RegisterAuthoringSessionBinaryBytesInput
): RegisterAuthoringSessionBinaryBytesResult => {
  const state = ensureAuthoringSessionBinaryAssets(session);
  const binaryAssetRef = BinaryAssetReferenceSchema.parse(input.binaryAssetRef);
  const fileEntry = createPackageBinaryFileEntry({
    path: binaryAssetRef.packageRelativePath,
    bytes: input.bytes,
    mediaType: binaryAssetRef.mediaType,
    binaryAssetId: binaryAssetRef.binaryAssetId
  });
  const binaryAssetEntry = BinaryAssetEntrySchema.parse({
    binaryAssetId: binaryAssetRef.binaryAssetId,
    role: input.role,
    packageRelativePath: binaryAssetRef.packageRelativePath,
    digest: binaryAssetRef.digest,
    byteLength: binaryAssetRef.byteLength,
    mediaType: binaryAssetRef.mediaType,
    storageStatus: binaryAssetRef.storageStatus,
    provenanceId: binaryAssetRef.provenanceId,
    rightsAssetId: binaryAssetRef.rightsAssetId,
    ...(input.sourceAssetId === undefined ? {} : { sourceAssetId: input.sourceAssetId }),
    ...(input.textureId === undefined ? {} : { textureId: input.textureId }),
    ...(input.createdByOperationId === undefined
      ? {}
      : { createdByOperationId: input.createdByOperationId })
  });

  upsertBinaryFileEntry(state.fileEntries, fileEntry);
  upsertBinaryAssetEntry(state.binaryAssetIndex.assets, binaryAssetEntry);

  if (input.byteIntakeSummary !== undefined) {
    upsertByteIntakeSummary(state.byteIntakeSummaries, input.byteIntakeSummary);
  }

  return {
    fileEntry: cloneDto(fileEntry),
    binaryAssetEntry: cloneDto(binaryAssetEntry),
    ...(input.byteIntakeSummary === undefined
      ? {}
      : { byteIntakeSummary: cloneDto(input.byteIntakeSummary) })
  };
};

export const getAuthoringSessionBinaryFileEntries = (
  session: AuthoringSession
): readonly PackageBinaryFileEntry[] =>
  cloneDto(session.binaryAssets?.fileEntries ?? []);

export const getAuthoringSessionBinaryAssetIndex = (
  session: AuthoringSession
): AuthoringSessionBinaryAssets["binaryAssetIndex"] =>
  BinaryAssetIndexFileSchema.parse(
    cloneDto(session.binaryAssets?.binaryAssetIndex ?? createEmptyBinaryAssetIndex())
  );

export const getAuthoringSessionByteIntakeSummaries = (
  session: AuthoringSession
): readonly PackageBinaryByteIntakeSummaryDto[] =>
  cloneDto(session.binaryAssets?.byteIntakeSummaries ?? []);

const ensureAuthoringSessionBinaryAssets = (
  session: AuthoringSession
): AuthoringSessionBinaryAssets => {
  if (session.binaryAssets === undefined) {
    session.binaryAssets = {
      fileEntries: [],
      binaryAssetIndex: createEmptyBinaryAssetIndex(),
      byteIntakeSummaries: []
    };
  }

  return session.binaryAssets;
};

const createEmptyBinaryAssetIndex = (): AuthoringSessionBinaryAssets["binaryAssetIndex"] =>
  BinaryAssetIndexFileSchema.parse({
    schemaVersion: "binary-asset-index-v1",
    assets: []
  });

const upsertBinaryFileEntry = (
  entries: PackageBinaryFileEntry[],
  entry: PackageBinaryFileEntry
): void => {
  const index = entries.findIndex((candidate) => candidate.path === entry.path);
  const clonedEntry = cloneDto(entry);

  if (index === -1) {
    entries.push(clonedEntry);
    return;
  }

  entries.splice(index, 1, clonedEntry);
};

const upsertBinaryAssetEntry = (
  entries: BinaryAssetEntryDto[],
  entry: BinaryAssetEntryDto
): void => {
  const index = entries.findIndex((candidate) => candidate.binaryAssetId === entry.binaryAssetId);
  const clonedEntry = cloneDto(entry);

  if (index === -1) {
    entries.push(clonedEntry);
    return;
  }

  entries.splice(index, 1, clonedEntry);
};

const upsertByteIntakeSummary = (
  summaries: PackageBinaryByteIntakeSummaryDto[],
  summary: PackageBinaryByteIntakeSummaryDto
): void => {
  const index = summaries.findIndex((candidate) =>
    candidate.binaryAssetId === summary.binaryAssetId &&
    candidate.packageRelativePath === summary.packageRelativePath
  );
  const clonedSummary = cloneDto(summary);

  if (index === -1) {
    summaries.push(clonedSummary);
    return;
  }

  summaries.splice(index, 1, clonedSummary);
};

const cloneDto = <TValue>(value: TValue): TValue => structuredClone(value);
