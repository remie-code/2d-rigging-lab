import {
  registerAuthoringSessionBinaryBytes
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  createPackageBinaryFileEntry,
  createPackageBinaryPersistentByteRecord,
  createPackageInMemoryFileSet,
  evaluatePackageBinaryPersistentByteAvailability,
  verifyPackageBinaryAssetBytes,
  type BinaryAssetReferenceDto,
  type BinaryAssetRoleDto,
  type PackageBinaryBytes,
  type PackageBinaryPersistentByteAvailabilityReportDto,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";

import {
  EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
  type EditorPersistentByteStore,
  type EditorPersistentByteStorePutResult
} from "./persistent-byte-store.js";

export interface EditorPersistentBinaryOwner {
  readonly ownerKind: "sourceAsset" | "texture";
  readonly ownerId: string;
  readonly role: BinaryAssetRoleDto;
  readonly binaryAssetRef: BinaryAssetReferenceDto;
}

export interface StoreEditorPersistentSourceBinaryBytesInput {
  readonly persistentByteStore: EditorPersistentByteStore;
  readonly packageDocument: PackageDocumentDto;
  readonly sourceAssetId: string;
  readonly bytes: Uint8Array | ArrayBuffer;
  readonly now?: () => Date;
}

export type StoreEditorPersistentSourceBinaryBytesResult =
  | EditorPersistentByteStorePutResult
  | {
      readonly status: "skipped";
      readonly reason: "source-binary-asset-ref-missing";
      readonly sourceAssetId: string;
    };

export interface StoreEditorPersistentBinaryOwnerBytesInput {
  readonly persistentByteStore: EditorPersistentByteStore;
  readonly packageDocument: PackageDocumentDto;
  readonly owner: EditorPersistentBinaryOwner;
  readonly bytes: PackageBinaryBytes;
  readonly now?: () => Date;
}

export interface RestoreEditorSessionPersistentBinaryBytesInput {
  readonly persistentByteStore: EditorPersistentByteStore;
  readonly authoringSession: AuthoringSession;
  readonly packageDocument: PackageDocumentDto;
}

export interface EditorSessionPersistentByteRestoreAssetResult {
  readonly ownerKind: "sourceAsset" | "texture";
  readonly ownerId: string;
  readonly binaryAssetId: string;
  readonly packageRelativePath: string;
  readonly restored: boolean;
  readonly report: PackageBinaryPersistentByteAvailabilityReportDto;
}

export interface EditorSessionPersistentByteRestoreResult {
  readonly status: "completed";
  readonly restoredCount: number;
  readonly assets: readonly EditorSessionPersistentByteRestoreAssetResult[];
}

export const storeEditorPersistentSourceBinaryBytes = async (
  input: StoreEditorPersistentSourceBinaryBytesInput
): Promise<StoreEditorPersistentSourceBinaryBytesResult> => {
  const owner = collectEditorPersistentBinaryOwners(input.packageDocument).find(
    (candidate) =>
      candidate.ownerKind === "sourceAsset" &&
      candidate.ownerId === input.sourceAssetId
  );

  if (owner === undefined) {
    return {
      status: "skipped",
      reason: "source-binary-asset-ref-missing",
      sourceAssetId: input.sourceAssetId
    };
  }

  return storeEditorPersistentBinaryOwnerBytes({
    persistentByteStore: input.persistentByteStore,
    packageDocument: input.packageDocument,
    owner,
    bytes: input.bytes,
    ...(input.now === undefined ? {} : { now: input.now })
  });
};

export const storeEditorPersistentBinaryOwnerBytes = async (
  input: StoreEditorPersistentBinaryOwnerBytesInput
): Promise<EditorPersistentByteStorePutResult> => {
  const storedAt = (input.now ?? (() => new Date()))().toISOString();
  const record = createPackageBinaryPersistentByteRecord({
    packageId: input.packageDocument.manifest.packageId,
    packageRevision: input.packageDocument.manifest.packageRevision,
    binaryAssetRef: input.owner.binaryAssetRef,
    storageBackend: EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
    storedAt,
    verifiedAt: storedAt
  });

  try {
    return await input.persistentByteStore.put({
      record,
      bytes: input.bytes
    });
  } catch (error) {
    return {
      status: "unavailable",
      storageBackend: EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
      storageBackendState: "unavailable-v1",
      message: `Could not store persistent binary bytes: ${formatErrorMessage(error)}`
    };
  }
};

export const restoreEditorSessionPersistentBinaryBytes = async (
  input: RestoreEditorSessionPersistentBinaryBytesInput
): Promise<EditorSessionPersistentByteRestoreResult> => {
  const assets: EditorSessionPersistentByteRestoreAssetResult[] = [];

  for (const owner of collectEditorPersistentBinaryOwners(input.packageDocument)) {
    const result = await restorePersistentBinaryOwner({
      persistentByteStore: input.persistentByteStore,
      authoringSession: input.authoringSession,
      packageDocument: input.packageDocument,
      owner
    });

    assets.push(result);
  }

  return {
    status: "completed",
    restoredCount: assets.filter((asset) => asset.restored).length,
    assets
  };
};

const restorePersistentBinaryOwner = async (input: {
  readonly persistentByteStore: EditorPersistentByteStore;
  readonly authoringSession: AuthoringSession;
  readonly packageDocument: PackageDocumentDto;
  readonly owner: EditorPersistentBinaryOwner;
}): Promise<EditorSessionPersistentByteRestoreAssetResult> => {
  const stored = await input.persistentByteStore.get({
    binaryAssetRef: input.owner.binaryAssetRef
  });

  if (stored.status === "unavailable") {
    return createRestoreAssetResult({
      owner: input.owner,
      restored: false,
      report: evaluatePackageBinaryPersistentByteAvailability({
        packageId: input.packageDocument.manifest.packageId,
        packageRevision: input.packageDocument.manifest.packageRevision,
        binaryAssetRef: input.owner.binaryAssetRef,
        storageBackend: stored.storageBackend,
        storageBackendState: stored.storageBackendState
      })
    });
  }

  if (stored.status === "missing") {
    return createRestoreAssetResult({
      owner: input.owner,
      restored: false,
      report: evaluatePackageBinaryPersistentByteAvailability({
        packageId: input.packageDocument.manifest.packageId,
        packageRevision: input.packageDocument.manifest.packageRevision,
        binaryAssetRef: input.owner.binaryAssetRef,
        storageBackend: stored.storageBackend,
        storageBackendState: stored.storageBackendState
      })
    });
  }

  const verificationFileEntry = createPackageBinaryFileEntry({
    path: input.owner.binaryAssetRef.packageRelativePath,
    bytes: stored.bytes,
    mediaType: stored.record.mediaType,
    binaryAssetId: stored.record.binaryAssetId
  });
  const persistentVerificationReport = await verifyPackageBinaryAssetBytes(
    createPackageInMemoryFileSet([verificationFileEntry]),
    input.owner.binaryAssetRef
  );
  const report = evaluatePackageBinaryPersistentByteAvailability({
    packageId: input.packageDocument.manifest.packageId,
    packageRevision: input.packageDocument.manifest.packageRevision,
    binaryAssetRef: input.owner.binaryAssetRef,
    storageBackend: stored.storageBackend,
    storageBackendState: stored.storageBackendState,
    storedRecord: stored.record,
    persistentVerificationReport
  });
  const canRestore =
    report.availability === "available-browser-local-persistent-bytes-v1" &&
    persistentVerificationReport.status === "pass";

  if (canRestore) {
    registerAuthoringSessionBinaryBytes(input.authoringSession, {
      binaryAssetRef: input.owner.binaryAssetRef,
      bytes: stored.bytes,
      role: input.owner.role,
      ...(input.owner.ownerKind === "sourceAsset"
        ? { sourceAssetId: input.owner.ownerId }
        : { textureId: input.owner.ownerId })
    });
  }

  return createRestoreAssetResult({
    owner: input.owner,
    restored: canRestore,
    report
  });
};

export const collectEditorPersistentBinaryOwners = (
  packageDocument: PackageDocumentDto
): readonly EditorPersistentBinaryOwner[] => [
  ...packageDocument.assets.sourceManifest.sourceAssets.flatMap((sourceAsset) =>
    sourceAsset.binaryAssetRef === undefined
      ? []
      : [{
          ownerKind: "sourceAsset" as const,
          ownerId: sourceAsset.sourceAssetId,
          role: "source-original-v1" as const,
          binaryAssetRef: sourceAsset.binaryAssetRef
        }]
  ),
  ...(packageDocument.assets.textureAtlas?.textures.flatMap((texture) =>
    texture.binaryAssetRef === undefined
      ? []
      : [{
          ownerKind: "texture" as const,
          ownerId: texture.textureId,
          role: "texture-raster-v1" as const,
          binaryAssetRef: texture.binaryAssetRef
        }]
  ) ?? [])
];

const createRestoreAssetResult = (input: {
  readonly owner: EditorPersistentBinaryOwner;
  readonly restored: boolean;
  readonly report: PackageBinaryPersistentByteAvailabilityReportDto;
}): EditorSessionPersistentByteRestoreAssetResult => ({
  ownerKind: input.owner.ownerKind,
  ownerId: input.owner.ownerId,
  binaryAssetId: input.owner.binaryAssetRef.binaryAssetId,
  packageRelativePath: input.owner.binaryAssetRef.packageRelativePath,
  restored: input.restored,
  report: input.report
});

const formatErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
