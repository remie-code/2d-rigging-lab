import { describe, expect, it } from "vitest";
import type {
  BinaryAssetReferenceDto,
  PackageBinaryPersistentByteRecordDto,
  PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";

import {
  copyEditorPersistentBytes,
  createEditorPersistentByteStoreKey,
  EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
  type EditorPersistentByteStore
} from "../editor-session/index.js";
import {
  createPsdAdapterProfileSourceIntakeDraftState,
  type SourceIntakeDraftState
} from "../editor-state/index.js";
import { createBrowserProjectStore, type StorageLike } from "../project-persistence/index.js";
import { createEditorWorkflowController } from "./workflow-controller.js";

describe("editor workflow portable bundle", () => {
  it("exports current-session bytes and imports them into session and persistent byte storage", async () => {
    const selectedBytes = new Uint8Array([0x50, 0x53, 0x44]);
    const sourceWorkflow = createWorkflow(createMemoryStorage(), createMemoryPersistentByteStore());

    await sourceWorkflow.commitSourceIntakeDraftWithSelectedFile(createPsdSourceIntakeDraft(), {
      fileName: "source.psd",
      bytes: selectedBytes,
      declaredMediaType: "application/octet-stream"
    });

    const exported = await sourceWorkflow.exportPortableBundle();

    expect(exported.status).toBe("portableExported");
    if (exported.status !== "portableExported") {
      throw new Error("Expected portable bundle export to succeed.");
    }
    expect(exported.bundle.bundleKind).toBe("project-defined-json-bundle-v0");
    expect(exported.binaryPayloadCount).toBe(1);
    expect(exported.bundleJson).toContain("portable-package-bundle-v0");
    expect(exported.bundleJson).toContain("UFNE");

    const persistentByteStore = createMemoryPersistentByteStore();
    const targetWorkflow = createWorkflow(createMemoryStorage(), persistentByteStore);
    const imported = await targetWorkflow.importPortableBundle(exported.bundleJson);

    expect(imported.status).toBe("portableImported");
    if (imported.status !== "portableImported") {
      throw new Error("Expected portable bundle import to succeed.");
    }
    expect(imported).toMatchObject({
      binaryPayloadCount: 1,
      byteRegistration: {
        assetCount: 1,
        registeredCount: 1,
        persistentStoreAttemptCount: 1,
        persistentStoredCount: 1,
        persistentUnavailableCount: 0
      }
    });
    expect(targetWorkflow.state.binaryByteIntake.assets).toEqual([
      expect.objectContaining({
        binaryAssetId: "bin_workflow_psd_profile_source",
        packageRelativePath: "assets/sources/workflow/source.psd",
        availabilityStatus: "available-current-editor-session-v1",
        validatorBytesAvailability: "available"
      })
    ]);

    const binaryAssetRef = requireImportedSourceBinaryAssetRef(imported.snapshot.document);
    expect(persistentByteStore.peek(binaryAssetRef)?.bytes).toEqual(selectedBytes);

    const resaved = targetWorkflow.saveProject();
    expect(resaved.snapshot.packageFilePaths).not.toContain("assets/sources/workflow/source.psd");
    expect(resaved.snapshot.packageInMemoryFilePaths).toContain("assets/sources/workflow/source.psd");
  });

  it("fails export truthfully when the loaded project only has metadata for package-local bytes", async () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage, createMemoryPersistentByteStore());

    await first.commitSourceIntakeDraftWithSelectedFile(createPsdSourceIntakeDraft(), {
      fileName: "source.psd",
      bytes: new Uint8Array([0x50, 0x53, 0x44]),
      declaredMediaType: "application/octet-stream"
    });
    first.saveProject();

    const metadataOnly = createWorkflow(storage, createMemoryPersistentByteStore());
    const loaded = metadataOnly.loadProject();
    const beforeRevision = metadataOnly.state.revision.packageRevision;
    const exported = await metadataOnly.exportPortableBundle();

    expect(loaded.status).toBe("loaded");
    expect(exported).toMatchObject({
      status: "portableExportFailed",
      code: "portableBundle.requiresReupload"
    });
    expect(metadataOnly.state.revision.packageRevision).toBe(beforeRevision);
    expect(metadataOnly.latestProjectPersistenceResult).toBe(exported);
  });

  it("rejects invalid import without replacing the current project state or writing bytes", async () => {
    const persistentByteStore = createMemoryPersistentByteStore();
    const workflow = createWorkflow(createMemoryStorage(), persistentByteStore);

    workflow.commitCreateParameter({
      operationId: "op_workflow_create_parameter_before_invalid_import",
      parameterId: "param_before_invalid_import",
      displayName: "Before Invalid Import",
      min: -1,
      max: 1,
      defaultValue: 0,
      recommendedUiStep: 0.1
    });
    const beforeState = {
      packageRevision: workflow.state.revision.packageRevision,
      parameterIds: workflow.state.parameters.map((parameter) => parameter.parameterId),
      operationLogEntryCount: workflow.state.operationLog.entryCount
    };

    const imported = await workflow.importPortableBundle("{not json");

    expect(imported).toMatchObject({
      status: "portableImportFailed",
      code: "portableBundle.json.invalid"
    });
    expect(workflow.state.revision.packageRevision).toBe(beforeState.packageRevision);
    expect(workflow.state.parameters.map((parameter) => parameter.parameterId)).toEqual(
      beforeState.parameterIds
    );
    expect(workflow.state.operationLog.entryCount).toBe(beforeState.operationLogEntryCount);
    expect(persistentByteStore.putRequestCount()).toBe(0);
  });
});

const createWorkflow = (
  storage: StorageLike,
  persistentByteStore: EditorPersistentByteStore
) =>
  createEditorWorkflowController({
    projectStore: createBrowserProjectStore({
      storage,
      now: () => new Date("2026-06-03T00:00:00.000Z")
    }),
    persistentByteStore,
    now: () => new Date("2026-06-03T00:00:00.000Z")
  });

interface MutableMemoryPersistentByteStore extends EditorPersistentByteStore {
  peek(binaryAssetRef: BinaryAssetReferenceDto): {
    readonly record: PackageBinaryPersistentByteRecordDto;
    readonly bytes: Uint8Array;
  } | undefined;
  putRequestCount(): number;
}

const createMemoryPersistentByteStore = (): MutableMemoryPersistentByteStore => {
  let putRequestCount = 0;
  const entries = new Map<string, {
    record: PackageBinaryPersistentByteRecordDto;
    bytes: Uint8Array;
  }>();

  return {
    async put(input) {
      putRequestCount += 1;
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
    putRequestCount() {
      return putRequestCount;
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

const createMemoryStorage = (): StorageLike => {
  const values = new Map<string, string>();

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    }
  };
};
