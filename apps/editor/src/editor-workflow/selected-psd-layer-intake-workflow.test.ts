import { describe, expect, it } from "vitest";

import {
  EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
  createEditorSessionAdapter,
  type EditorPersistentByteStore
} from "../editor-session/index.js";
import {
  projectExplicitPsdImportStateFromBridgeResult,
  type EditorSemanticState
} from "../editor-state/index.js";
import { createEditorWorkflowState } from "./workflow-state-projection.js";
import type { BrowserPsdParserBridgeResult } from "./browser-psd-parser-bridge-result.js";
import {
  commitEditorSelectedPsdLayerIntakeWorkflow,
  type EditorExplicitPsdLayerIntakeCommand
} from "./selected-psd-layer-intake-workflow.js";
import type {
  SelectedPsdLayerMaterializationResult
} from "./selected-psd-layer-materialization-result.js";
import type {
  SelectedPsdLayerFileMaterializationInput
} from "./selected-psd-layer-materialization-service.js";

describe("selected PSD layer intake workflow", () => {
  it("materializes a selected PSD layer into package-local texture bytes and part mapping evidence", async () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-06-05T00:00:00.000Z")
    });
    const persistentStore = createRecordingPersistentStore();
    const outcome = await commitEditorSelectedPsdLayerIntakeWorkflow({
      adapter,
      state: createParsedEditorState(adapter),
      command: {
        selectedLayerNodeRef: "layer_headwear",
        destinationPart: {
          destinationKind: "existingPart",
          partId: "part_root"
        },
        drawableDisplayName: "Headwear From PSD"
      },
      currentPsdFile: createCurrentPsdFile(),
      parsedBridgeResult: createParsedBridgeResult(),
      persistentByteStore: persistentStore.store,
      now: () => new Date("2026-06-05T00:00:00.000Z"),
      materializeSelectedLayer: createSuccessfulMaterializer()
    });

    expect(outcome.result.status).toBe("committed");
    expect(outcome.state.explicitPsdImport.selectedLayerIntake.status).toBe("committed");
    expect(outcome.state.explicitPsdImport.selectedLayerIntake.summaryFacts).toEqual(
      expect.arrayContaining([
        { label: "Materialized digest", value: `sha256:${MATERIALIZED_DIGEST}` },
        { label: "Materialized byte length", value: "16 bytes" },
        {
          label: "Media type",
          value: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8"
        },
        { label: "Dimensions", value: "2 x 2" },
        { label: "Drawable evidence", value: "draw_headwear_from_psd -> part_root" },
        {
          label: "Provenance",
          value: "packageLocalAsset / notPublicDistributable / publicDemoAsset=false"
        }
      ])
    );

    const snapshot = adapter.createPersistenceSnapshot();
    const sourceAsset = snapshot.document.assets.sourceManifest.sourceAssets.find(
      (candidate) => candidate.sourceAssetId === "src_explicit_psd_sample_model_128"
    );
    const texture = snapshot.document.assets.textureAtlas?.textures.find(
      (candidate) => candidate.textureId === "tex_headwear_from_psd"
    );

    expect(sourceAsset?.binaryAssetRef).toBeUndefined();
    expect(texture?.binaryAssetRef).toMatchObject({
      binaryAssetId: "bin_headwear_from_psd_raw_rgba",
      mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
      byteLength: 16,
      rightsAssetId: "src_explicit_psd_sample_model_128"
    });
    expect(snapshot.packageInMemoryFilePaths).toContain(
      `assets/textures/psd/layer_headwear_${MATERIALIZED_DIGEST.slice(0, 12)}.raw-rgba`
    );
    expect(snapshot.packageInMemoryFilePaths).not.toContain("assets/sources/psd/sample_model_128.psd");
    expect(persistentStore.puts).toHaveLength(1);
    expect(persistentStore.puts[0]?.record.binaryAssetId).toBe("bin_headwear_from_psd_raw_rgba");
  });

  it("surfaces Domain B unsupported layer materialization failures without committing", async () => {
    const adapter = createEditorSessionAdapter();
    const initialDrawableIds = adapter.authoringSession.graph.drawables.map(
      (drawable) => drawable.drawableId
    );
    const outcome = await commitEditorSelectedPsdLayerIntakeWorkflow({
      adapter,
      state: createParsedEditorState(adapter),
      command: createExistingPartCommand("part_root"),
      currentPsdFile: createCurrentPsdFile(),
      parsedBridgeResult: createParsedBridgeResult(),
      persistentByteStore: createRecordingPersistentStore().store,
      materializeSelectedLayer: async (input) => createUnsupportedMaterializationFailure(input)
    });

    expect(outcome.result.status).toBe("failed");
    expect(outcome.result.stage).toBe("materialization");
    expect(outcome.state.explicitPsdImport.selectedLayerIntake.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: "selectedPsdLayer.materialization.unsupportedLayerType",
          severity: "error",
          message: expect.stringContaining("Selected node is a group")
        })
      ])
    );
    expect(adapter.authoringSession.graph.drawables.map((drawable) => drawable.drawableId)).toEqual(
      initialDrawableIds
    );
    expect(
      adapter.authoringSession.graph.drawables.some(
        (drawable) => drawable.drawableId === "draw_headwear_from_psd"
      )
    ).toBe(false);
  });

  it("surfaces Domain C destination part rejections after materialization", async () => {
    const adapter = createEditorSessionAdapter();
    const outcome = await commitEditorSelectedPsdLayerIntakeWorkflow({
      adapter,
      state: createParsedEditorState(adapter),
      command: createExistingPartCommand("part_missing"),
      currentPsdFile: createCurrentPsdFile(),
      parsedBridgeResult: createParsedBridgeResult(),
      persistentByteStore: createRecordingPersistentStore().store,
      materializeSelectedLayer: createSuccessfulMaterializer()
    });

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.stage).toBe("operationCommit");
    expect(outcome.state.explicitPsdImport.selectedLayerIntake.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: "operation.importPsdLayerMaterialization.missingDestinationPart",
          message: "Destination part does not exist: part_missing."
        })
      ])
    );
  });
});

const MATERIALIZED_DIGEST = "1".repeat(64);
const SOURCE_DIGEST = "2".repeat(64);

const createParsedEditorState = (
  adapter: ReturnType<typeof createEditorSessionAdapter>
): EditorSemanticState => ({
  ...createEditorWorkflowState(adapter),
  explicitPsdImport: projectExplicitPsdImportStateFromBridgeResult(createParsedBridgeResult(), {
    selectedLayerNodeRef: "layer_headwear"
  })
});

const createExistingPartCommand = (partId: string): EditorExplicitPsdLayerIntakeCommand => ({
  selectedLayerNodeRef: "layer_headwear",
  destinationPart: {
    destinationKind: "existingPart",
    partId
  },
  drawableDisplayName: "Headwear From PSD"
});

const createSuccessfulMaterializer =
  () =>
  async (input: SelectedPsdLayerFileMaterializationInput): Promise<SelectedPsdLayerMaterializationResult> => {
    const bytes = new Uint8Array(16);

    return {
      status: "materialized",
      source: createSourceEvidence(input),
      candidate: {
        bytes,
        evidence: {
          evidenceKind: "selected-psd-layer-materialized-asset-candidate-evidence-v1",
          candidateId: "candidate_layer_headwear",
          materializationId: "mat_layer_headwear",
          mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
          pixelFormat: "rgba8",
          width: 2,
          height: 2,
          byteLength: 16,
          digest: { algorithm: "sha256", hex: MATERIALIZED_DIGEST },
          sourcePsd: {
            sourceAssetId: input.sourceAssetId ?? "src_explicit_psd_sample_model_128",
            fileName: input.file.name,
            declaredMediaType: input.file.type,
            byteLength: input.file.size,
            digest: { algorithm: "sha256", hex: SOURCE_DIGEST }
          },
          sourceLayer: {
            sourceLayerId: "layer_headwear",
            sourceLayerPath: ["Headwear"],
            originalName: "Headwear"
          },
          parser: {
            evidenceKind: "psd-parser-evidence-v1",
            parserName: "webtoonPsd",
            parserPackageName: "@webtoon/psd",
            parserVersion: "0.4.0",
            runtime: "browser",
            privateShapePolicy: "parser-private-shape-excluded-v1"
          },
          extraction: {
            extractionKind: "selectedLayerRasterV1",
            optionsSchemaVersion: "psd-layer-extraction-options-v1",
            options: {
              parserMethod: "Layer.composite(false, false)",
              effect: false,
              composed: false,
              selectedNodeRef: input.selectedLayerNodeRef,
              outputEncoding: "raw-rgba",
              channelOrder: "rgba",
              pixelFormat: "rgba8",
              width: 2,
              height: 2
            }
          },
          provenance: {
            sourceInput: "explicit-user-selected-private-local-psd-v1",
            privacyLabel: "private/local",
            publicDemoAsset: false,
            materializedBytePersistence: "editor-local-candidate-only-not-persisted-by-domain-b-v1"
          },
          storageBoundary: {
            storageScope: "editor-local-candidate-only-v1",
            packageStorageIdentity: "not-assigned-domain-c-d-owned-v1",
            persistentBinaryAssetRef: "not-created-by-domain-b-v1"
          }
        }
      },
      diagnostics: []
    };
  };

const createUnsupportedMaterializationFailure = (
  input: SelectedPsdLayerFileMaterializationInput
): SelectedPsdLayerMaterializationResult => ({
  status: "failed",
  source: createSourceEvidence(input),
  failure: {
    evidenceKind: "selected-psd-layer-materialization-failure-evidence-v1",
    failureKind: "unsupportedLayerType",
    severity: "error",
    message: "Selected node is a group and cannot be materialized as a selected raster layer.",
    source: createSourceEvidence(input),
    selectedLayerNodeRef: input.selectedLayerNodeRef,
    selectedNode: {
      nodeRef: input.selectedLayerNodeRef,
      nodeType: "group",
      sourceNodePath: ["Group"],
      originalName: "Group"
    },
    checks: ["selectedNodeType=group", "publicDemoAsset=false"],
    provenance: {
      sourceInput: "explicit-user-selected-private-local-psd-v1",
      privacyLabel: "private/local",
      publicDemoAsset: false,
      materializedBytePersistence: "editor-local-candidate-only-not-persisted-by-domain-b-v1"
    }
  },
  diagnostics: [{
    checkId: "selectedPsdLayer.materialization.unsupportedLayerType",
    severity: "error",
    message: "Selected node is a group and cannot be materialized.",
    evidence: ["selectedNodeType=group", "publicDemoAsset=false"]
  }]
});

const createSourceEvidence = (input: SelectedPsdLayerFileMaterializationInput) => ({
  evidenceKind: "browser-psd-source-evidence-v1" as const,
  intakeKind: "explicitFile" as const,
  sourceAssetId: input.sourceAssetId ?? "src_explicit_psd_sample_model_128",
  fileName: input.file.name,
  declaredMediaType: input.file.type,
  byteLength: input.file.size,
  sizeCapBytes: 32 * 1024 * 1024,
  privacy: {
    privacyLabel: "packageLocalAsset" as const,
    publicDistribution: "notPublicDistributable" as const,
    rawBytesPersistence: "notPersistedByParserBridge" as const
  }
});

const createCurrentPsdFile = (): File =>
  ({
    name: "sample_model.psd",
    size: 128,
    type: "image/vnd.adobe.photoshop",
    async arrayBuffer() {
      return new Uint8Array(128).buffer;
    }
  }) as File;

const createParsedBridgeResult = (): Extract<BrowserPsdParserBridgeResult, { status: "parsed" }> => ({
  status: "parsed",
  source: {
    evidenceKind: "browser-psd-source-evidence-v1",
    intakeKind: "explicitFile",
    sourceAssetId: "src_browser_psd_import",
    fileName: "sample_model.psd",
    declaredMediaType: "image/vnd.adobe.photoshop",
    byteLength: 128,
    sizeCapBytes: 32 * 1024 * 1024,
    privacy: {
      privacyLabel: "packageLocalAsset",
      publicDistribution: "notPublicDistributable",
      rawBytesPersistence: "notPersistedByParserBridge"
    }
  },
  threading: {
    evidenceKind: "psd-parser-threading-evidence-v1",
    execution: "main-thread",
    workerDecision: "not-implemented-wave45-domain-b-bounded-scope",
    risk: "large-psd-parse-may-block-ui-size-cap-required"
  },
  treeSummary: {
    groupCount: 0,
    layerCount: 1,
    visibleLayerCount: 1,
    hiddenLayerCount: 0,
    rasterCandidateLayerCount: 1,
    maxDepth: 1
  },
  adapterResult: {
    schemaVersion: "psd-adapter-result-v1",
    sourceProfile: "layered-character-psd-profile-v1",
    adapterName: "wave45-browser-explicit-psd-import-adapter",
    adapterVersion: "0.1.0",
    intakeKind: "realPsdParseResult",
    parser: {
      evidenceKind: "psd-parser-evidence-v1",
      parserName: "webtoonPsd",
      parserPackageName: "@webtoon/psd",
      parserVersion: "0.4.0",
      runtime: "browser",
      privateShapePolicy: "parser-private-shape-excluded-v1"
    },
    canvas: { width: 16, height: 16 },
    sourceGroups: [],
    sourceLayers: [{
      sourceLayerId: "layer_headwear",
      originalName: "Headwear",
      normalizedName: "Headwear",
      groupPath: [],
      sourceOrder: 0,
      bounds: { x: 0, y: 0, width: 2, height: 2 },
      visibleInSource: true,
      opacityInSource: 1,
      role: "editableLayer",
      unsupportedFeatures: []
    }],
    unsupportedFeatures: [],
    diagnostics: []
  },
  diagnostics: [],
  errorEvidence: []
});

const createRecordingPersistentStore = (): {
  readonly puts: Parameters<EditorPersistentByteStore["put"]>[0][];
  readonly store: EditorPersistentByteStore;
} => {
  const puts: Parameters<EditorPersistentByteStore["put"]>[0][] = [];

  return {
    puts,
    store: {
      async put(input) {
        puts.push(input);
        return {
          status: "stored",
          storageBackend: EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
          storageBackendState: "available-v1",
          record: input.record
        };
      },
      async get() {
        return {
          status: "missing",
          storageBackend: EDITOR_PERSISTENT_BYTE_STORAGE_BACKEND,
          storageBackendState: "available-v1"
        };
      }
    }
  };
};
