import {
  registerAuthoringSessionBinaryBytes,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import {
  createPackageInMemoryFileSet,
  readPackageBinaryFileEntry,
  type PackageBinaryFileEntry,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";

import {
  collectEditorPersistentBinaryOwners,
  storeEditorPersistentBinaryOwnerBytes
} from "./persistent-byte-restore.js";
import type {
  EditorPersistentByteStore,
  EditorPersistentByteStorePutResult
} from "./persistent-byte-store.js";

export interface RegisterEditorImportedPortableBundleBytesInput {
  readonly authoringSession: AuthoringSession;
  readonly packageDocument: PackageDocumentDto;
  readonly binaryEntries: readonly PackageBinaryFileEntry[];
  readonly persistentByteStore: EditorPersistentByteStore;
  readonly now?: () => Date;
}

export interface EditorImportedPortableBundleByteAssetResult {
  readonly ownerKind: "sourceAsset" | "texture";
  readonly ownerId: string;
  readonly binaryAssetId: string;
  readonly packageRelativePath: string;
  readonly currentSessionStatus: "registered" | "skipped-missing-binary-entry";
  readonly persistentStoreResult?: EditorPersistentByteStorePutResult;
}

export interface EditorImportedPortableBundleByteRegistrationResult {
  readonly status: "completed";
  readonly assetCount: number;
  readonly registeredCount: number;
  readonly skippedCount: number;
  readonly persistentStoreAttemptCount: number;
  readonly persistentStoredCount: number;
  readonly persistentUnavailableCount: number;
  readonly assets: readonly EditorImportedPortableBundleByteAssetResult[];
}

export const registerEditorImportedPortableBundleBytes = async (
  input: RegisterEditorImportedPortableBundleBytesInput
): Promise<EditorImportedPortableBundleByteRegistrationResult> => {
  const binaryFileSet = createPackageInMemoryFileSet(input.binaryEntries);
  const assets: EditorImportedPortableBundleByteAssetResult[] = [];

  for (const owner of collectEditorPersistentBinaryOwners(input.packageDocument)) {
    const binaryEntry = readPackageBinaryFileEntry(binaryFileSet, owner.binaryAssetRef);

    if (binaryEntry === undefined) {
      assets.push({
        ownerKind: owner.ownerKind,
        ownerId: owner.ownerId,
        binaryAssetId: owner.binaryAssetRef.binaryAssetId,
        packageRelativePath: owner.binaryAssetRef.packageRelativePath,
        currentSessionStatus: "skipped-missing-binary-entry"
      });
      continue;
    }

    registerAuthoringSessionBinaryBytes(input.authoringSession, {
      binaryAssetRef: owner.binaryAssetRef,
      bytes: binaryEntry.bytes,
      role: owner.role,
      ...(owner.ownerKind === "sourceAsset"
        ? { sourceAssetId: owner.ownerId }
        : { textureId: owner.ownerId })
    });

    const persistentStoreResult = await storeEditorPersistentBinaryOwnerBytes({
      persistentByteStore: input.persistentByteStore,
      packageDocument: input.packageDocument,
      owner,
      bytes: binaryEntry.bytes,
      ...(input.now === undefined ? {} : { now: input.now })
    });

    assets.push({
      ownerKind: owner.ownerKind,
      ownerId: owner.ownerId,
      binaryAssetId: owner.binaryAssetRef.binaryAssetId,
      packageRelativePath: owner.binaryAssetRef.packageRelativePath,
      currentSessionStatus: "registered",
      persistentStoreResult
    });
  }

  return {
    status: "completed",
    assetCount: assets.length,
    registeredCount: assets.filter((asset) => asset.currentSessionStatus === "registered").length,
    skippedCount: assets.filter((asset) =>
      asset.currentSessionStatus === "skipped-missing-binary-entry"
    ).length,
    persistentStoreAttemptCount: assets.filter((asset) =>
      asset.persistentStoreResult !== undefined
    ).length,
    persistentStoredCount: assets.filter((asset) =>
      asset.persistentStoreResult?.status === "stored"
    ).length,
    persistentUnavailableCount: assets.filter((asset) =>
      asset.persistentStoreResult?.status === "unavailable"
    ).length,
    assets
  };
};
