import {
  PackageBinaryPersistentByteRecordDtoSchema
} from "@private-2d-rigging-lab/package-format";

import {
  copyEditorPersistentBytes,
  createEditorPersistentByteStoreKey,
  EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
  type EditorPersistentByteStore,
  type EditorPersistentByteStoreGetInput,
  type EditorPersistentByteStoreGetResult,
  type EditorPersistentByteStorePutInput,
  type EditorPersistentByteStorePutResult
} from "./persistent-byte-store.js";

const EDITOR_PERSISTENT_BYTE_DB_NAME =
  "private-2d-rigging-lab.editor-persistent-binary-bytes-v1";
const EDITOR_PERSISTENT_BYTE_DB_VERSION = 1;
const EDITOR_PERSISTENT_BYTE_OBJECT_STORE = "persistent-binary-bytes-v1";

interface EditorIndexedDbPersistentByteStoreOptions {
  readonly indexedDB?: IDBFactory;
}

interface IndexedDbPersistentByteValue {
  readonly schemaVersion: "editor-indexeddb-persistent-binary-byte-v1";
  readonly record: unknown;
  readonly bytes: unknown;
}

export const createEditorIndexedDbPersistentByteStore = (
  options: EditorIndexedDbPersistentByteStoreOptions = {}
): EditorPersistentByteStore => {
  const indexedDbFactory = options.indexedDB ?? getGlobalIndexedDbFactory();

  return {
    async put(input) {
      if (indexedDbFactory === undefined) {
        return createUnsupportedPutResult();
      }

      try {
        const db = await openPersistentByteDatabase(indexedDbFactory);
        try {
          const transaction = db.transaction(EDITOR_PERSISTENT_BYTE_OBJECT_STORE, "readwrite");
          const store = transaction.objectStore(EDITOR_PERSISTENT_BYTE_OBJECT_STORE);
          const bytes = copyEditorPersistentBytes(input.bytes);
          const storedValue: IndexedDbPersistentByteValue = {
            schemaVersion: "editor-indexeddb-persistent-binary-byte-v1",
            record: input.record,
            bytes: bytes.buffer.slice(
              bytes.byteOffset,
              bytes.byteOffset + bytes.byteLength
            )
          };

          await requestToPromise(
            store.put(storedValue, createEditorPersistentByteStoreKey(input.record))
          );

          return {
            status: "stored",
            storageBackend: EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
            storageBackendState: "available-v1",
            record: input.record
          };
        } finally {
          db.close();
        }
      } catch (error) {
        return createUnavailablePutResult(error);
      }
    },

    async get(input) {
      if (indexedDbFactory === undefined) {
        return createUnsupportedGetResult();
      }

      try {
        const db = await openPersistentByteDatabase(indexedDbFactory);
        try {
          const transaction = db.transaction(EDITOR_PERSISTENT_BYTE_OBJECT_STORE, "readonly");
          const store = transaction.objectStore(EDITOR_PERSISTENT_BYTE_OBJECT_STORE);
          const storedValue = await requestToPromise<unknown>(
            store.get(createEditorPersistentByteStoreKey(input.binaryAssetRef))
          );

          if (storedValue === undefined) {
            return {
              status: "missing",
              storageBackend: EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
              storageBackendState: "available-v1"
            };
          }

          const storedEntry = readIndexedDbPersistentByteValue(storedValue);
          if (storedEntry === undefined) {
            return {
              status: "unavailable",
              storageBackend: EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
              storageBackendState: "unavailable-v1",
              message: "Stored IndexedDB binary byte value is not readable."
            };
          }

          return {
            status: "found",
            storageBackend: EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
            storageBackendState: "available-v1",
            record: storedEntry.record,
            bytes: storedEntry.bytes
          };
        } finally {
          db.close();
        }
      } catch (error) {
        return createUnavailableGetResult(error);
      }
    }
  };
};

const getGlobalIndexedDbFactory = (): IDBFactory | undefined =>
  (globalThis as typeof globalThis & { readonly indexedDB?: IDBFactory }).indexedDB;

const openPersistentByteDatabase = (indexedDB: IDBFactory): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(
      EDITOR_PERSISTENT_BYTE_DB_NAME,
      EDITOR_PERSISTENT_BYTE_DB_VERSION
    );

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EDITOR_PERSISTENT_BYTE_OBJECT_STORE)) {
        db.createObjectStore(EDITOR_PERSISTENT_BYTE_OBJECT_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed."));
    request.onblocked = () => reject(new Error("IndexedDB open was blocked."));
  });

const requestToPromise = <TValue>(request: IDBRequest<TValue>): Promise<TValue> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });

const readIndexedDbPersistentByteValue = (
  input: unknown
): { readonly record: ReturnType<typeof PackageBinaryPersistentByteRecordDtoSchema.parse>; readonly bytes: Uint8Array } | undefined => {
  if (!isRecord(input) || input.schemaVersion !== "editor-indexeddb-persistent-binary-byte-v1") {
    return undefined;
  }

  const bytes = readIndexedDbStoredBytes(input.bytes);
  if (bytes === undefined) {
    return undefined;
  }

  try {
    return {
      record: PackageBinaryPersistentByteRecordDtoSchema.parse(input.record),
      bytes
    };
  } catch {
    return undefined;
  }
};

const readIndexedDbStoredBytes = (input: unknown): Uint8Array | undefined => {
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input.slice(0));
  }

  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer.slice(
      input.byteOffset,
      input.byteOffset + input.byteLength
    ));
  }

  return undefined;
};

const createUnsupportedPutResult = (): EditorPersistentByteStorePutResult => ({
  status: "unavailable",
  storageBackend: EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
  storageBackendState: "unsupported-v1",
  message: "Browser IndexedDB is not available for persistent binary bytes."
});

const createUnsupportedGetResult = (): EditorPersistentByteStoreGetResult => ({
  status: "unavailable",
  storageBackend: EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
  storageBackendState: "unsupported-v1",
  message: "Browser IndexedDB is not available for persistent binary bytes."
});

const createUnavailablePutResult = (error: unknown): EditorPersistentByteStorePutResult => ({
  status: "unavailable",
  storageBackend: EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
  storageBackendState: "unavailable-v1",
  message: `Could not store persistent binary bytes in IndexedDB: ${formatErrorMessage(error)}`
});

const createUnavailableGetResult = (error: unknown): EditorPersistentByteStoreGetResult => ({
  status: "unavailable",
  storageBackend: EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
  storageBackendState: "unavailable-v1",
  message: `Could not read persistent binary bytes from IndexedDB: ${formatErrorMessage(error)}`
});

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const formatErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
