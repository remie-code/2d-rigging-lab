import { describe, expect, it } from "vitest";
import {
  BinaryAssetReferenceSchema,
  createPackageBinaryPersistentByteRecord
} from "@private-2d-rigging-lab/package-format";

import { createEditorIndexedDbPersistentByteStore } from "./indexeddb-persistent-byte-store.js";
import { createEditorPersistentByteStoreKey } from "./persistent-byte-store.js";

const EXPECTED_DB_NAME = "private-2d-rigging-lab.editor-persistent-binary-bytes-v1";
const EXPECTED_DB_VERSION = 1;
const EXPECTED_OBJECT_STORE = "persistent-binary-bytes-v1";

describe("editor IndexedDB persistent byte store", () => {
  it("reports unsupported when browser IndexedDB is not available", async () => {
    const store = createEditorIndexedDbPersistentByteStore();
    const { binaryAssetRef, record } = createPersistentByteFixture({
      binaryAssetId: "bin_indexeddb_unsupported_source",
      packageRelativePath: "assets/sources/indexeddb/unsupported.psd",
      packageId: "pkg_indexeddb_unsupported"
    });

    await expect(store.put({
      record,
      bytes: new Uint8Array([0x50, 0x53, 0x44])
    })).resolves.toMatchObject({
      status: "unavailable",
      storageBackendState: "unsupported-v1"
    });
    await expect(store.get({ binaryAssetRef })).resolves.toMatchObject({
      status: "unavailable",
      storageBackendState: "unsupported-v1"
    });
  });

  it("stores and restores bytes through the available IndexedDB adapter roundtrip", async () => {
    const indexedDB = new FakeIndexedDbFactory();
    const store = createEditorIndexedDbPersistentByteStore({
      indexedDB: indexedDB as unknown as IDBFactory
    });
    const { binaryAssetRef, record } = createPersistentByteFixture({
      binaryAssetId: "bin_indexeddb_available_source",
      packageRelativePath: "assets/sources/indexeddb/available.psd",
      packageId: "pkg_indexeddb_available"
    });
    const backingBytes = new Uint8Array([0x00, 0x50, 0x53, 0x44, 0xff]);
    const selectedBytes = backingBytes.subarray(1, 4);

    await expect(store.put({
      record,
      bytes: selectedBytes
    })).resolves.toMatchObject({
      status: "stored",
      storageBackendState: "available-v1",
      record
    });

    const key = createEditorPersistentByteStoreKey(binaryAssetRef);
    const rawValue = indexedDB.peekRawValue(EXPECTED_OBJECT_STORE, key);
    expect(indexedDB.openCalls[0]).toEqual({
      name: EXPECTED_DB_NAME,
      version: EXPECTED_DB_VERSION
    });
    expect(indexedDB.createdObjectStoreNames).toContain(EXPECTED_OBJECT_STORE);
    expect(indexedDB.transactionObjectStoreNames).toContain(EXPECTED_OBJECT_STORE);
    expect(readRecord(rawValue)?.record).toEqual(record);
    const storedBytes = readRecord(rawValue)?.bytes;
    expect(storedBytes).toBeInstanceOf(ArrayBuffer);
    expect([...new Uint8Array(storedBytes as ArrayBuffer)]).toEqual([0x50, 0x53, 0x44]);

    const found = await store.get({ binaryAssetRef });

    expect(found).toMatchObject({
      status: "found",
      storageBackendState: "available-v1",
      record
    });
    if (found.status !== "found") {
      throw new Error("Expected IndexedDB fake to return stored bytes.");
    }
    expect(found.bytes).toEqual(selectedBytes);
    expect(found.bytes).not.toBe(selectedBytes);

    const sameIdDifferentPath = BinaryAssetReferenceSchema.parse({
      ...binaryAssetRef,
      packageRelativePath: "assets/sources/indexeddb/other.psd"
    });
    await expect(store.get({ binaryAssetRef: sameIdDifferentPath })).resolves.toMatchObject({
      status: "missing",
      storageBackendState: "available-v1"
    });
  });

  it("reports missing when an available IndexedDB store has no matching key", async () => {
    const indexedDB = new FakeIndexedDbFactory();
    const store = createEditorIndexedDbPersistentByteStore({
      indexedDB: indexedDB as unknown as IDBFactory
    });
    const { binaryAssetRef } = createPersistentByteFixture({
      binaryAssetId: "bin_indexeddb_missing_source",
      packageRelativePath: "assets/sources/indexeddb/missing.psd",
      packageId: "pkg_indexeddb_missing"
    });

    await expect(store.get({ binaryAssetRef })).resolves.toMatchObject({
      status: "missing",
      storageBackendState: "available-v1"
    });
  });

  it("reports unavailable when an IndexedDB stored value is unreadable", async () => {
    const indexedDB = new FakeIndexedDbFactory();
    const store = createEditorIndexedDbPersistentByteStore({
      indexedDB: indexedDB as unknown as IDBFactory
    });
    const { binaryAssetRef, record } = createPersistentByteFixture({
      binaryAssetId: "bin_indexeddb_unreadable_source",
      packageRelativePath: "assets/sources/indexeddb/unreadable.psd",
      packageId: "pkg_indexeddb_unreadable"
    });
    indexedDB.putRawValue(
      EXPECTED_OBJECT_STORE,
      createEditorPersistentByteStoreKey(binaryAssetRef),
      {
        schemaVersion: "editor-indexeddb-persistent-binary-byte-v1",
        record,
        bytes: "not-array-buffer-bytes"
      }
    );

    await expect(store.get({ binaryAssetRef })).resolves.toMatchObject({
      status: "unavailable",
      storageBackendState: "unavailable-v1",
      message: "Stored IndexedDB binary byte value is not readable."
    });
  });

  it("reports unavailable when IndexedDB open or object-store requests fail", async () => {
    const { binaryAssetRef, record } = createPersistentByteFixture({
      binaryAssetId: "bin_indexeddb_failure_source",
      packageRelativePath: "assets/sources/indexeddb/failure.psd",
      packageId: "pkg_indexeddb_failure"
    });
    const openFailureStore = createEditorIndexedDbPersistentByteStore({
      indexedDB: new FakeIndexedDbFactory({
        openError: new Error("fake open failure")
      }) as unknown as IDBFactory
    });

    await expect(openFailureStore.get({ binaryAssetRef })).resolves.toMatchObject({
      status: "unavailable",
      storageBackendState: "unavailable-v1",
      message: expect.stringContaining("fake open failure")
    });

    const requestFailureStore = createEditorIndexedDbPersistentByteStore({
      indexedDB: new FakeIndexedDbFactory({
        requestError: new Error("fake request failure")
      }) as unknown as IDBFactory
    });

    await expect(requestFailureStore.put({
      record,
      bytes: new Uint8Array([0x50, 0x53, 0x44])
    })).resolves.toMatchObject({
      status: "unavailable",
      storageBackendState: "unavailable-v1",
      message: expect.stringContaining("fake request failure")
    });
    await expect(requestFailureStore.get({ binaryAssetRef })).resolves.toMatchObject({
      status: "unavailable",
      storageBackendState: "unavailable-v1",
      message: expect.stringContaining("fake request failure")
    });
  });
});

const createPersistentByteFixture = (input: {
  readonly binaryAssetId: string;
  readonly packageRelativePath: string;
  readonly packageId: string;
}) => {
  const binaryAssetRef = BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: input.binaryAssetId,
    packageRelativePath: input.packageRelativePath,
    digest: {
      algorithm: "sha256",
      hex: "a".repeat(64)
    },
    byteLength: 3,
    mediaType: "application/octet-stream",
    storageStatus: "stored-package-local-v1",
    provenanceId: `prov_${input.binaryAssetId}`,
    rightsAssetId: `src_${input.binaryAssetId}`
  });
  const record = createPackageBinaryPersistentByteRecord({
    packageId: input.packageId,
    packageRevision: 1,
    binaryAssetRef,
    storedAt: "2026-06-03T00:00:00.000Z"
  });

  return { binaryAssetRef, record };
};

class FakeIndexedDbFactory {
  readonly openCalls: { readonly name: string; readonly version?: number }[] = [];
  readonly createdObjectStoreNames: string[] = [];
  readonly transactionObjectStoreNames: string[] = [];
  private readonly databases = new Map<string, FakeIndexedDbDatabase>();

  constructor(
    private readonly options: {
      readonly openError?: Error;
      readonly requestError?: Error;
    } = {}
  ) {}

  open(name: string, version?: number): IDBOpenDBRequest {
    this.openCalls.push(version === undefined ? { name } : { name, version });
    const request = createFakeOpenRequest();

    queueMicrotask(() => {
      if (this.options.openError !== undefined) {
        rejectFakeRequest(request, this.options.openError);
        return;
      }

      let database = this.databases.get(name);
      const needsUpgrade = database === undefined;
      if (database === undefined) {
        database = new FakeIndexedDbDatabase(this, name);
        this.databases.set(name, database);
      }

      request.result = database as unknown as IDBDatabase;
      if (needsUpgrade) {
        try {
          request.onupgradeneeded?.call(request as unknown as IDBOpenDBRequest, {} as IDBVersionChangeEvent);
        } catch (error) {
          rejectFakeRequest(request, error);
          return;
        }
      }
      resolveFakeRequest(request, database as unknown as IDBDatabase);
    });

    return request as unknown as IDBOpenDBRequest;
  }

  peekRawValue(objectStoreName: string, key: string): unknown {
    return structuredClone(
      this.databases.get(EXPECTED_DB_NAME)?.peekRawValue(objectStoreName, key)
    );
  }

  putRawValue(objectStoreName: string, key: string, value: unknown): void {
    const database = this.ensureDatabase(EXPECTED_DB_NAME);
    database.putRawValue(objectStoreName, key, value);
  }

  createObjectStore(databaseName: string, objectStoreName: string): FakeIndexedDbObjectStore {
    const database = this.ensureDatabase(databaseName);
    return database.createObjectStore(objectStoreName);
  }

  createObjectStoreRequest(
    objectStoreName: string,
    operation: "put" | "get",
    action: () => unknown
  ): IDBRequest<unknown> {
    const request = createFakeRequest<unknown>();

    queueMicrotask(() => {
      if (this.options.requestError !== undefined) {
        rejectFakeRequest(request, this.options.requestError);
        return;
      }

      try {
        resolveFakeRequest(request, action());
      } catch (error) {
        rejectFakeRequest(request, error);
      }
    });

    this.transactionObjectStoreNames.push(`${objectStoreName}:${operation}`);
    this.transactionObjectStoreNames.push(objectStoreName);

    return request as unknown as IDBRequest<unknown>;
  }

  private ensureDatabase(name: string): FakeIndexedDbDatabase {
    let database = this.databases.get(name);
    if (database === undefined) {
      database = new FakeIndexedDbDatabase(this, name);
      this.databases.set(name, database);
    }

    return database;
  }
}

class FakeIndexedDbDatabase {
  private readonly objectStores = new Map<string, Map<string, unknown>>();
  readonly objectStoreNames = {
    contains: (name: string) => this.objectStores.has(name)
  };

  constructor(
    private readonly indexedDB: FakeIndexedDbFactory,
    private readonly name: string
  ) {}

  createObjectStore(name: string): FakeIndexedDbObjectStore {
    if (!this.objectStores.has(name)) {
      this.objectStores.set(name, new Map());
      this.indexedDB.createdObjectStoreNames.push(name);
    }

    return new FakeIndexedDbObjectStore(this.indexedDB, name, this.requireObjectStore(name));
  }

  transaction(objectStoreName: string): IDBTransaction {
    this.requireObjectStore(objectStoreName);
    this.indexedDB.transactionObjectStoreNames.push(objectStoreName);

    return {
      objectStore: (name: string) =>
        new FakeIndexedDbObjectStore(this.indexedDB, name, this.requireObjectStore(name))
    } as unknown as IDBTransaction;
  }

  close(): void {}

  peekRawValue(objectStoreName: string, key: string): unknown {
    return this.requireObjectStore(objectStoreName).get(key);
  }

  putRawValue(objectStoreName: string, key: string, value: unknown): void {
    let objectStore = this.objectStores.get(objectStoreName);
    if (objectStore === undefined) {
      objectStore = new Map();
      this.objectStores.set(objectStoreName, objectStore);
    }
    objectStore.set(key, structuredClone(value));
  }

  private requireObjectStore(objectStoreName: string): Map<string, unknown> {
    const objectStore = this.objectStores.get(objectStoreName);
    if (objectStore === undefined) {
      throw new Error(`Missing fake IndexedDB object store ${this.name}/${objectStoreName}.`);
    }

    return objectStore;
  }
}

class FakeIndexedDbObjectStore {
  constructor(
    private readonly indexedDB: FakeIndexedDbFactory,
    private readonly name: string,
    private readonly entries: Map<string, unknown>
  ) {}

  put(value: unknown, key: IDBValidKey): IDBRequest<IDBValidKey> {
    return this.indexedDB.createObjectStoreRequest(this.name, "put", () => {
      this.entries.set(String(key), structuredClone(value));
      return key;
    }) as IDBRequest<IDBValidKey>;
  }

  get(query: IDBValidKey | IDBKeyRange): IDBRequest<unknown> {
    return this.indexedDB.createObjectStoreRequest(this.name, "get", () => {
      const value = this.entries.get(String(query));
      return value === undefined ? undefined : structuredClone(value);
    });
  }
}

interface MutableFakeRequest<TValue> {
  result: TValue;
  error: Error | null;
  onsuccess: ((this: IDBRequest<TValue>, event: Event) => unknown) | null;
  onerror: ((this: IDBRequest<TValue>, event: Event) => unknown) | null;
}

interface MutableFakeOpenRequest extends MutableFakeRequest<IDBDatabase> {
  onupgradeneeded: ((this: IDBOpenDBRequest, event: IDBVersionChangeEvent) => unknown) | null;
  onblocked: ((this: IDBOpenDBRequest, event: IDBVersionChangeEvent) => unknown) | null;
}

const createFakeRequest = <TValue>(): MutableFakeRequest<TValue> => ({
  result: undefined as TValue,
  error: null,
  onsuccess: null,
  onerror: null
});

const createFakeOpenRequest = (): MutableFakeOpenRequest => ({
  ...createFakeRequest<IDBDatabase>(),
  onupgradeneeded: null,
  onblocked: null
});

const resolveFakeRequest = <TValue>(
  request: MutableFakeRequest<TValue>,
  result: TValue
): void => {
  request.result = result;
  request.onsuccess?.call(request as unknown as IDBRequest<TValue>, {} as Event);
};

const rejectFakeRequest = <TValue>(
  request: MutableFakeRequest<TValue>,
  error: unknown
): void => {
  request.error = error instanceof Error ? error : new Error(String(error));
  request.onerror?.call(request as unknown as IDBRequest<TValue>, {} as Event);
};

const readRecord = (
  input: unknown
): { readonly record?: unknown; readonly bytes?: unknown } | undefined =>
  typeof input === "object" && input !== null && !Array.isArray(input)
    ? input as { readonly record?: unknown; readonly bytes?: unknown }
    : undefined;
