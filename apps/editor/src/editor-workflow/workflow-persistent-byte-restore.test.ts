import { describe, expect, it } from "vitest";
import { PackageIdSchema } from "@private-2d-rigging-lab/contracts";
import type {
  BinaryAssetReferenceDto,
  PackageBinaryPersistentByteRecordDto,
  PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import { validatePackageRuntimeWithBinaryAssets } from "@private-2d-rigging-lab/validator-core";

import {
  copyEditorPersistentBytes,
  createEditorPersistentByteStoreKey,
  EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
  type EditorPersistentByteStore
} from "../editor-session/index.js";
import { createBrowserProjectStore, type StorageLike } from "../project-persistence/index.js";
import {
  createPsdAdapterProfileSourceIntakeDraftState,
  type SourceIntakeDraftState
} from "../editor-state/index.js";
import {
  createEditorWorkflowController,
  type EditorWorkflowSaveResult
} from "./workflow-controller.js";

const RAW_BYTE_SENTINEL_TEXT = "PERSISTENT_RAW_BYTES_SENTINEL";
const RAW_BYTE_SENTINEL_BASE64 = "UEVSU0lTVEVOVF9SQVdfQllURVNfU0VOVElORUw=";
const STALE_PERSISTENT_RECORD_CASES: readonly (readonly [
  string,
  (record: PackageBinaryPersistentByteRecordDto) => PackageBinaryPersistentByteRecordDto,
  string,
  string
])[] = [
  [
    "package identity only",
    (record) => ({
      ...record,
      packageId: PackageIdSchema.parse("pkg_other_editor_package")
    }),
    "persistentByteStorage.packageId.mismatch",
    "persistentByteStorage.packageRevision.mismatch"
  ],
  [
    "package revision only",
    (record) => ({
      ...record,
      packageRevision: record.packageRevision + 7
    }),
    "persistentByteStorage.packageRevision.mismatch",
    "persistentByteStorage.packageId.mismatch"
  ]
];

describe("editor workflow persistent byte restore", () => {
  it("stores selected bytes separately and restores them through async browser-local persistent load", async () => {
    const storage = createMemoryStorage();
    const persistentByteStore = createMemoryPersistentByteStore();
    const selectedBytes = new TextEncoder().encode(RAW_BYTE_SENTINEL_TEXT);
    const first = createWorkflow(storage, persistentByteStore);

    const imported = await first.commitSourceIntakeDraftWithSelectedFile(
      createPsdSourceIntakeDraft(),
      {
        fileName: "source.psd",
        bytes: selectedBytes,
        declaredMediaType: "application/octet-stream"
      }
    );
    const saved = first.saveProject();
    const binaryAssetRef = requireImportedSourceBinaryAssetRef(imported.result.reloadedDocument);

    expect(persistentByteStore.peek(binaryAssetRef)?.bytes).toEqual(selectedBytes);
    expectWorkflowSaveToExcludeRawBytes(saved, first.state, storage);
    expect(saved.snapshot.packageFilePaths).not.toContain("assets/sources/workflow/source.psd");
    expect(saved.snapshot.packageInMemoryFilePaths).toContain("assets/sources/workflow/source.psd");

    const second = createWorkflow(storage, persistentByteStore);
    const loaded = await second.loadProjectWithPersistentBytes();

    expect(loaded.status).toBe("loaded");
    if (loaded.status !== "loaded") {
      throw new Error("Expected persistent byte load to succeed.");
    }
    expect(loaded.persistentByteRestore).toMatchObject({
      restoredCount: 1,
      assets: [
        expect.objectContaining({
          binaryAssetId: "bin_workflow_psd_profile_source",
          packageRelativePath: "assets/sources/workflow/source.psd",
          restored: true,
          report: expect.objectContaining({
            availability: "available-browser-local-persistent-bytes-v1",
            status: "pass-v1",
            requiresReupload: false
          })
        })
      ]
    });
    expect(second.state.binaryByteIntake.assets).toEqual([
      expect.objectContaining({
        binaryAssetId: "bin_workflow_psd_profile_source",
        availabilityStatus: "available-current-editor-session-v1",
        validatorBytesAvailability: "available"
      })
    ]);

    const resavedAfterRestore = second.saveProject();
    const report = await validatePackageRuntimeWithBinaryAssets({
      packageDocument: resavedAfterRestore.snapshot.document,
      binaryFileSet: resavedAfterRestore.snapshot.packageInMemoryFileSet,
      byteIntakePreflight: resavedAfterRestore.snapshot.binaryByteEvidence.byteIntakePreflight,
      createdAt: "2026-06-02T01:00:00.000Z"
    });

    expect(resavedAfterRestore.snapshot.packageFilePaths).not.toContain(
      "assets/sources/workflow/source.psd"
    );
    expect(resavedAfterRestore.snapshot.packageInMemoryFilePaths).toContain(
      "assets/sources/workflow/source.psd"
    );
    expectWorkflowSaveToExcludeRawBytes(resavedAfterRestore, second.state, storage);
    expect(report.checks.filter((check) =>
      check.status === "fail" &&
      check.evidence.includes("binaryAssetId=bin_workflow_psd_profile_source") &&
      check.checkId.startsWith("byteAvailability.")
    )).toEqual([]);
  });

  it("keeps sync loadProject metadata-only even when persistent bytes exist", async () => {
    const storage = createMemoryStorage();
    const persistentByteStore = createMemoryPersistentByteStore();
    const selectedBytes = new Uint8Array([0x50, 0x53, 0x44]);
    const first = createWorkflow(storage, persistentByteStore);

    const imported = await first.commitSourceIntakeDraftWithSelectedFile(
      createPsdSourceIntakeDraft(),
      {
        fileName: "source.psd",
        bytes: selectedBytes,
        declaredMediaType: "application/octet-stream"
      }
    );
    first.saveProject();
    const binaryAssetRef = requireImportedSourceBinaryAssetRef(imported.result.reloadedDocument);
    expect(persistentByteStore.peek(binaryAssetRef)?.bytes).toEqual(selectedBytes);
    expect(persistentByteStore.getRequestCount()).toBe(0);

    const second = createWorkflow(storage, persistentByteStore);
    const loaded = second.loadProject();

    expect(loaded.status).toBe("loaded");
    expect("persistentByteRestore" in loaded).toBe(false);
    expect(persistentByteStore.getRequestCount()).toBe(0);
    expect(second.state.binaryByteIntake.assets[0]).toMatchObject({
      binaryAssetId: "bin_workflow_psd_profile_source",
      availabilityStatus: "requires-reupload-after-browser-local-load-v1",
      validatorBytesAvailability: "requiresReupload"
    });
  });

  it.each([
    ["unsupported-v1" as const],
    ["unavailable-v1" as const]
  ])("falls back truthfully when persistent byte storage is %s", async (storageBackendState) => {
    const storage = createMemoryStorage();
    const persistentByteStore = createMemoryPersistentByteStore({ storageBackendState });
    const first = createWorkflow(storage, persistentByteStore);

    await first.commitSourceIntakeDraftWithSelectedFile(createPsdSourceIntakeDraft(), {
      fileName: "source.psd",
      bytes: new Uint8Array([0x50, 0x53, 0x44]),
      declaredMediaType: "application/octet-stream"
    });
    first.saveProject();

    const second = createWorkflow(storage, persistentByteStore);
    const loaded = await second.loadProjectWithPersistentBytes();

    expect(loaded.status).toBe("loaded");
    if (loaded.status !== "loaded") {
      throw new Error("Expected load result.");
    }
    expect(loaded.persistentByteRestore.assets[0]?.report).toMatchObject({
      storageBackendState,
      availability: "unavailable-browser-local-persistent-bytes-v1",
      requiresReupload: true,
      status: "fail-v1"
    });
    expect(second.state.binaryByteIntake.assets[0]).toMatchObject({
      availabilityStatus: "requires-reupload-after-browser-local-load-v1",
      validatorBytesAvailability: "requiresReupload"
    });
  });

  it("falls back truthfully when persistent store bytes are missing", async () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage, createMemoryPersistentByteStore());

    await first.commitSourceIntakeDraftWithSelectedFile(createPsdSourceIntakeDraft(), {
      fileName: "source.psd",
      bytes: new Uint8Array([0x50, 0x53, 0x44]),
      declaredMediaType: "application/octet-stream"
    });
    first.saveProject();

    const second = createWorkflow(storage, createMemoryPersistentByteStore());
    const loaded = await second.loadProjectWithPersistentBytes();

    expect(loaded.status).toBe("loaded");
    if (loaded.status !== "loaded") {
      throw new Error("Expected load result.");
    }
    expect(loaded.persistentByteRestore.assets[0]?.report).toMatchObject({
      recordStatus: "not-supplied-v1",
      availability: "unavailable-browser-local-persistent-bytes-v1",
      requiresReupload: true
    });
    expect(loaded.persistentByteRestore.assets[0]?.report.issues.map((issue) => issue.code)).toContain(
      "persistentByteStorage.record.missing"
    );
    expect(second.state.binaryByteIntake.assets[0]?.availabilityStatus).toBe(
      "requires-reupload-after-browser-local-load-v1"
    );
  });

  it("falls back truthfully when persistent bytes fail digest verification", async () => {
    const storage = createMemoryStorage();
    const persistentByteStore = createMemoryPersistentByteStore();
    const first = createWorkflow(storage, persistentByteStore);

    const imported = await first.commitSourceIntakeDraftWithSelectedFile(
      createPsdSourceIntakeDraft(),
      {
        fileName: "source.psd",
        bytes: new Uint8Array([0x50, 0x53, 0x44]),
        declaredMediaType: "application/octet-stream"
      }
    );
    first.saveProject();
    persistentByteStore.mutate(requireImportedSourceBinaryAssetRef(imported.result.reloadedDocument), {
      bytes: new Uint8Array([0x50, 0x53, 0x45])
    });

    const second = createWorkflow(storage, persistentByteStore);
    const loaded = await second.loadProjectWithPersistentBytes();

    expect(loaded.status).toBe("loaded");
    if (loaded.status !== "loaded") {
      throw new Error("Expected load result.");
    }
    expect(loaded.persistentByteRestore.assets[0]?.report).toMatchObject({
      availability: "corrupt-browser-local-persistent-bytes-v1",
      requiresReupload: true,
      status: "fail-v1"
    });
    expect(loaded.persistentByteRestore.assets[0]?.report.issues.map((issue) => issue.code)).toContain(
      "persistentByteStorage.digest.mismatch"
    );
    expect(second.state.binaryByteIntake.assets[0]?.validatorBytesAvailability).toBe("requiresReupload");
  });

  it("falls back truthfully when persistent bytes fail byteLength verification", async () => {
    const storage = createMemoryStorage();
    const persistentByteStore = createMemoryPersistentByteStore();
    const first = createWorkflow(storage, persistentByteStore);

    const imported = await first.commitSourceIntakeDraftWithSelectedFile(
      createPsdSourceIntakeDraft(),
      {
        fileName: "source.psd",
        bytes: new Uint8Array([0x50, 0x53, 0x44]),
        declaredMediaType: "application/octet-stream"
      }
    );
    first.saveProject();
    persistentByteStore.mutate(requireImportedSourceBinaryAssetRef(imported.result.reloadedDocument), {
      bytes: new Uint8Array([0x50, 0x53, 0x44, 0x00])
    });

    const second = createWorkflow(storage, persistentByteStore);
    const loaded = await second.loadProjectWithPersistentBytes();

    expect(loaded.status).toBe("loaded");
    if (loaded.status !== "loaded") {
      throw new Error("Expected load result.");
    }
    expect(loaded.persistentByteRestore.assets[0]?.report).toMatchObject({
      availability: "corrupt-browser-local-persistent-bytes-v1",
      requiresReupload: true
    });
    expect(loaded.persistentByteRestore.assets[0]?.report.issues.map((issue) => issue.code)).toContain(
      "persistentByteStorage.byteLength.mismatch"
    );
    expect(second.state.binaryByteIntake.assets[0]?.availabilityStatus).toBe(
      "requires-reupload-after-browser-local-load-v1"
    );
  });

  it.each(STALE_PERSISTENT_RECORD_CASES)(
    "falls back truthfully for stale persistent %s",
    async (_label, mutateRecord, expectedIssueCode, unexpectedIssueCode) => {
      const storage = createMemoryStorage();
      const persistentByteStore = createMemoryPersistentByteStore();
      const first = createWorkflow(storage, persistentByteStore);

      const imported = await first.commitSourceIntakeDraftWithSelectedFile(
        createPsdSourceIntakeDraft(),
        {
          fileName: "source.psd",
          bytes: new Uint8Array([0x50, 0x53, 0x44]),
          declaredMediaType: "application/octet-stream"
        }
      );
      first.saveProject();
      persistentByteStore.mutate(requireImportedSourceBinaryAssetRef(imported.result.reloadedDocument), {
        record: mutateRecord
      });

      const second = createWorkflow(storage, persistentByteStore);
      const loaded = await second.loadProjectWithPersistentBytes();

      expect(loaded.status).toBe("loaded");
      if (loaded.status !== "loaded") {
        throw new Error("Expected load result.");
      }
      expect(loaded.persistentByteRestore.assets[0]?.report).toMatchObject({
        recordStatus: "stale-v1",
        availability: "stale-browser-local-persistent-record-v1",
        requiresReupload: true
      });
      const issueCodes =
        loaded.persistentByteRestore.assets[0]?.report.issues.map((issue) => issue.code) ?? [];
      expect(issueCodes).toContain(expectedIssueCode);
      expect(issueCodes).not.toContain(unexpectedIssueCode);
      expect(second.state.binaryByteIntake.assets[0]?.availabilityStatus).toBe(
        "requires-reupload-after-browser-local-load-v1"
      );
    }
  );
});

const createWorkflow = (
  storage: StorageLike,
  persistentByteStore?: EditorPersistentByteStore
) =>
  createEditorWorkflowController({
    projectStore: createBrowserProjectStore({
      storage,
      now: () => new Date("2026-05-29T04:00:00.000Z")
    }),
    ...(persistentByteStore === undefined ? {} : { persistentByteStore }),
    now: () => new Date("2026-05-29T04:00:00.000Z")
  });

interface MutableMemoryPersistentByteStore extends EditorPersistentByteStore {
  peek(binaryAssetRef: BinaryAssetReferenceDto): {
    readonly record: PackageBinaryPersistentByteRecordDto;
    readonly bytes: Uint8Array;
  } | undefined;
  mutate(
    binaryAssetRef: BinaryAssetReferenceDto,
    mutation: {
      readonly bytes?: Uint8Array;
      readonly record?: (
        record: PackageBinaryPersistentByteRecordDto
      ) => PackageBinaryPersistentByteRecordDto;
    }
  ): void;
  getRequestCount(): number;
}

const createMemoryPersistentByteStore = (
  options: {
    readonly storageBackendState?: "available-v1" | "unsupported-v1" | "unavailable-v1";
  } = {}
): MutableMemoryPersistentByteStore => {
  const storageBackendState = options.storageBackendState ?? "available-v1";
  let getRequestCount = 0;
  const entries = new Map<string, {
    record: PackageBinaryPersistentByteRecordDto;
    bytes: Uint8Array;
  }>();

  return {
    async put(input) {
      if (storageBackendState !== "available-v1") {
        return {
          status: "unavailable",
          storageBackend: EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
          storageBackendState,
          message: `Memory persistent byte store is ${storageBackendState}.`
        };
      }

      entries.set(createEditorPersistentByteStoreKey(input.record), {
        record: structuredClone(input.record),
        bytes: copyEditorPersistentBytes(input.bytes)
      });

      return {
        status: "stored",
        storageBackend: EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
        storageBackendState: "available-v1",
        record: structuredClone(input.record)
      };
    },
    async get(input) {
      getRequestCount += 1;
      if (storageBackendState !== "available-v1") {
        return {
          status: "unavailable",
          storageBackend: EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
          storageBackendState,
          message: `Memory persistent byte store is ${storageBackendState}.`
        };
      }

      const entry = entries.get(createEditorPersistentByteStoreKey(input.binaryAssetRef));
      if (entry === undefined) {
        return {
          status: "missing",
          storageBackend: EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
          storageBackendState: "available-v1"
        };
      }

      return {
        status: "found",
        storageBackend: EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
        storageBackendState: "available-v1",
        record: structuredClone(entry.record),
        bytes: copyEditorPersistentBytes(entry.bytes)
      };
    },
    peek(binaryAssetRef) {
      const entry = entries.get(createEditorPersistentByteStoreKey(binaryAssetRef));
      if (entry === undefined) {
        return undefined;
      }

      return {
        record: structuredClone(entry.record),
        bytes: copyEditorPersistentBytes(entry.bytes)
      };
    },
    getRequestCount() {
      return getRequestCount;
    },
    mutate(binaryAssetRef, mutation) {
      const key = createEditorPersistentByteStoreKey(binaryAssetRef);
      const entry = entries.get(key);
      if (entry === undefined) {
        throw new Error(`No persistent byte entry for ${binaryAssetRef.binaryAssetId}.`);
      }

      entries.set(key, {
        record: mutation.record === undefined
          ? entry.record
          : mutation.record(structuredClone(entry.record)),
        bytes: mutation.bytes === undefined
          ? entry.bytes
          : copyEditorPersistentBytes(mutation.bytes)
      });
    }
  };
};

const requireImportedSourceBinaryAssetRef = (
  document: PackageDocumentDto
): BinaryAssetReferenceDto => {
  const binaryAssetRef = document.assets.sourceManifest.sourceAssets.find(
    (sourceAsset) => sourceAsset.sourceAssetId === "src_workflow_psd_profile"
  )?.binaryAssetRef;

  if (binaryAssetRef === undefined) {
    throw new Error("Expected imported PSD profile source binary asset ref.");
  }

  return binaryAssetRef;
};

const createPsdSourceIntakeDraft = (): SourceIntakeDraftState => ({
  ...createPsdAdapterProfileSourceIntakeDraftState({ defaultPartId: "part_root" }),
  status: "confirmed",
  sourceAssetId: "src_workflow_psd_profile",
  manifestPath: "assets/sources/workflow/source.psd",
  contentHash: "sha256:workflow-psd-reference",
  defaultPartId: "part_root",
  psdProfile: {
    adapterName: "manual-psd-profile-entry",
    canvasWidth: 2048,
    canvasHeight: 3072
  },
  layers: [
    {
      sourceLayerId: "layer_face",
      originalName: "Face",
      normalizedName: "face",
      groupPath: ["Root", "Head"],
      bounds: { x: 320, y: 240, width: 512, height: 512 },
      visibleInSource: true,
      opacityInSource: 0.8,
      role: "editableLayer",
      unsupportedFeatures: ["psd.textLayer"],
      texturePreviewReference: "assets/sources/workflow/face.preview.png",
      textureId: "tex_face",
      targetPartId: "part_root"
    }
  ],
  rights: {
    rightsStatus: "cleared",
    creator: "Workflow Artist",
    license: "private-cleared",
    redistributionAllowed: false,
    aiUsed: false,
    sourceUrl: "https://example.invalid/workflow-psd-source",
    notes: "manual PSD adapter/profile metadata"
  },
  diagnostics: []
});

interface InspectableStorageLike extends StorageLike {
  dumpValues(): readonly string[];
}

const createMemoryStorage = (
  entries: readonly (readonly [string, string])[] = []
): InspectableStorageLike => {
  const values = new Map(entries);

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
    dumpValues() {
      return [...values.values()];
    }
  };
};

const expectWorkflowSaveToExcludeRawBytes = (
  saveResult: EditorWorkflowSaveResult,
  workflowState: unknown,
  storage: InspectableStorageLike
): void => {
  const savedProjectJson = JSON.stringify(saveResult.storeResult.project);
  expectSerializedTextToExcludeRawBytes(savedProjectJson);
  expect(savedProjectJson).not.toMatch(/"bytes"|"bytesBase64"|"rawBytes"|"selectedFile"/);
  expectPackageTextEntriesToExcludeRawBytes(saveResult.snapshot.packageFileSet);
  expectSerializedTextToExcludeRawBytes(saveResult.snapshot.operationLogJsonl);
  expectSerializedTextToExcludeRawBytes(
    JSON.stringify(saveResult.snapshot.document.model.editorState ?? {})
  );
  expectSerializedTextToExcludeRawBytes(JSON.stringify(workflowState));
  for (const storedValue of storage.dumpValues()) {
    expectSerializedTextToExcludeRawBytes(storedValue);
  }
};

const expectPackageTextEntriesToExcludeRawBytes = (
  fileSet: readonly { readonly path: string; readonly text: string }[]
): void => {
  for (const entry of fileSet) {
    expectSerializedTextToExcludeRawBytes(`${entry.path}\n${entry.text}`);
  }
};

const expectSerializedTextToExcludeRawBytes = (text: string): void => {
  expect(text).not.toContain(RAW_BYTE_SENTINEL_TEXT);
  expect(text).not.toContain(RAW_BYTE_SENTINEL_BASE64);
};
