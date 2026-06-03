import type {
  BinaryAssetReferenceDto,
  PackageBinaryBytes,
  PackageBinaryPersistentByteRecordDto,
  PackageBinaryPersistentStorageBackendDto,
  PackageBinaryPersistentStorageBackendStateDto
} from "@private-2d-rigging-lab/package-format";

export const EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND:
  PackageBinaryPersistentStorageBackendDto = "indexeddb-same-origin-browser-local-v1";

export interface EditorPersistentByteStorePutInput {
  readonly record: PackageBinaryPersistentByteRecordDto;
  readonly bytes: PackageBinaryBytes;
}

export type EditorPersistentByteStorePutResult =
  | {
      readonly status: "stored";
      readonly storageBackend: PackageBinaryPersistentStorageBackendDto;
      readonly storageBackendState: "available-v1";
      readonly record: PackageBinaryPersistentByteRecordDto;
    }
  | {
      readonly status: "unavailable";
      readonly storageBackend: PackageBinaryPersistentStorageBackendDto;
      readonly storageBackendState: Exclude<
        PackageBinaryPersistentStorageBackendStateDto,
        "available-v1"
      >;
      readonly message: string;
    };

export interface EditorPersistentByteStoreGetInput {
  readonly binaryAssetRef: BinaryAssetReferenceDto;
}

export type EditorPersistentByteStoreGetResult =
  | {
      readonly status: "found";
      readonly storageBackend: PackageBinaryPersistentStorageBackendDto;
      readonly storageBackendState: "available-v1";
      readonly record: PackageBinaryPersistentByteRecordDto;
      readonly bytes: Uint8Array;
    }
  | {
      readonly status: "missing";
      readonly storageBackend: PackageBinaryPersistentStorageBackendDto;
      readonly storageBackendState: "available-v1";
    }
  | {
      readonly status: "unavailable";
      readonly storageBackend: PackageBinaryPersistentStorageBackendDto;
      readonly storageBackendState: Exclude<
        PackageBinaryPersistentStorageBackendStateDto,
        "available-v1"
      >;
      readonly message: string;
    };

export interface EditorPersistentByteStore {
  put(input: EditorPersistentByteStorePutInput): Promise<EditorPersistentByteStorePutResult>;
  get(input: EditorPersistentByteStoreGetInput): Promise<EditorPersistentByteStoreGetResult>;
}

export const createEditorPersistentByteStoreKey = (
  binaryAssetRef: Pick<BinaryAssetReferenceDto, "binaryAssetId" | "packageRelativePath">
): string => `${binaryAssetRef.binaryAssetId}\n${binaryAssetRef.packageRelativePath}`;

export const copyEditorPersistentBytes = (bytes: PackageBinaryBytes): Uint8Array => {
  if (bytes instanceof Uint8Array) {
    return new Uint8Array(bytes);
  }

  return new Uint8Array(bytes.slice(0));
};
