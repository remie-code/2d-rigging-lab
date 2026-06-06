import { describe, expect, it } from "vitest";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PartIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  PsdImportPlanApprovalBridgeEvidenceDto,
  PsdImportPlanCandidateDto,
  PsdImportPlanGeneratedScaffoldDto,
  PsdImportPlanSourceLayerReferenceDto,
  PsdImportPlanSourcePsdIdentityDto
} from "@private-2d-rigging-lab/operation-core";

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
  commitEditorSelectedPsdLayerBatchIntakeWorkflow,
  preflightEditorSelectedPsdLayerBatchIntakeWorkflow
} from "./selected-psd-layer-batch-intake-workflow.js";
import type {
  SelectedPsdLayerBatchFileMaterializationInput
} from "./selected-psd-layer-batch-materialization-service.js";
import type {
  SelectedPsdLayerBatchMaterializationResult
} from "./selected-psd-layer-batch-materialization-result.js";
import type {
  SelectedPsdLayerMaterializedAssetCandidate
} from "./selected-psd-layer-materialization-result.js";
import { projectEditorAiPsdImportPlanCommandResult } from "../ai-command-host/editor-ai-psd-import-plan-projector.js";

describe("selected PSD leaf layer batch intake workflow", () => {
  it("commits selected leaf layer materializations into generated parts under a parent part", async () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-06-06T00:00:00.000Z")
    });
    const persistentStore = createRecordingPersistentStore();
    const outcome = await commitEditorSelectedPsdLayerBatchIntakeWorkflow({
      adapter,
      state: createParsedEditorState(adapter),
      command: {
        selectedLayerNodeRefs: ["layer_headwear", "layer_eyewear"],
        destinationParentPartId: "part_root"
      },
      currentPsdFile: createCurrentPsdFile(),
      parsedBridgeResult: createParsedBridgeResult(),
      persistentByteStore: persistentStore.store,
      now: () => new Date("2026-06-06T00:00:00.000Z"),
      materializeSelectedLayers: createSuccessfulBatchMaterializer([
        createCandidate("layer_headwear", ["Headwear"], "Headwear", HEADWEAR_DIGEST),
        createCandidate("layer_eyewear", ["Eyewear"], "Eyewear", EYEWEAR_DIGEST)
      ])
    });

    expect(outcome.result.status).toBe("committed");
    expect(outcome.state.explicitPsdImport.selectedLayerBatchIntake.status).toBe("committed");
    expect(outcome.state.explicitPsdImport.selectedLayerBatchIntake.summaryFacts).toEqual(
      expect.arrayContaining([
        { label: "Batch evidence id", value: "evidence_batch_src_explicit_psd_sample_model_128_2" },
        { label: "Aggregate status", value: "success" },
        { label: "Batch issues", value: "none" },
        { label: "Destination parent part", value: "part_root" },
        { label: "Destination kind", value: "generatedPartScaffold" },
        { label: "Requested / success / failure", value: "2 / 2 / 0" },
        { label: "Provenance", value: "private/local / notPublicDistributable / publicDemoAsset=false" }
      ])
    );
    expect(outcome.state.explicitPsdImport.selectedLayerBatchIntake.entryLabels.join("\n")).toContain(
      "part=part_headwear"
    );
    expect(outcome.state.explicitPsdImport.selectedLayerBatchIntake.entryLabels.join("\n")).toContain(
      "texture=tex_eyewear"
    );
    expect(outcome.state.explicitPsdImport.selectedLayerBatchIntake.entryLabels.join("\n")).toContain(
      "issues=none"
    );

    const snapshot = adapter.createPersistenceSnapshot();
    expect(snapshot.document.model.graph.parts.map((part) => part.partId)).toEqual(
      expect.arrayContaining(["part_headwear", "part_eyewear"])
    );
    expect(snapshot.document.model.drawables.drawables.map((drawable) => drawable.drawableId)).toEqual(
      expect.arrayContaining(["draw_headwear", "draw_eyewear"])
    );
    expect(snapshot.document.assets.textureAtlas?.textures.map((texture) => texture.textureId)).toEqual(
      expect.arrayContaining(["tex_headwear", "tex_eyewear"])
    );
    expect(
      snapshot.document.assets.sourceManifest.sourceAssets.find(
        (sourceAsset) => sourceAsset.sourceAssetId === "src_explicit_psd_sample_model_128"
      )?.binaryAssetRef
    ).toBeUndefined();
    expect(snapshot.packageInMemoryFilePaths).toEqual(
      expect.arrayContaining([
        `assets/textures/psd/layer_headwear_${HEADWEAR_DIGEST.slice(0, 12)}.raw-rgba`,
        `assets/textures/psd/layer_eyewear_${EYEWEAR_DIGEST.slice(0, 12)}.raw-rgba`
      ])
    );
    expect(snapshot.packageInMemoryFilePaths).not.toContain("assets/sources/psd/sample_model_128.psd");
    expect(persistentStore.puts.map((put) => put.record.binaryAssetId)).toEqual(
      expect.arrayContaining(["bin_headwear_raw_rgba", "bin_eyewear_raw_rgba"])
    );
  });

  it("preflights selected leaf layer materializations without mutating the project or persistent bytes", async () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-06-06T00:00:00.000Z")
    });
    const state = createParsedEditorState(adapter);
    const initialMutationState = captureRejectedBatchMutationState(adapter);
    const persistentStore = createRecordingPersistentStore();
    const outcome = await preflightEditorSelectedPsdLayerBatchIntakeWorkflow({
      adapter,
      state,
      command: {
        selectedLayerNodeRefs: ["layer_headwear"],
        destinationParentPartId: "part_root",
        importPlanBridge: createImportPlanBridgeForBatchWorkflowTest()
      },
      currentPsdFile: createCurrentPsdFile(),
      parsedBridgeResult: createParsedBridgeResult(),
      persistentByteStore: persistentStore.store,
      now: () => new Date("2026-06-06T00:00:00.000Z"),
      materializeSelectedLayers: createSuccessfulBatchMaterializer([
        createCandidate("layer_headwear", ["Headwear"], "Headwear", HEADWEAR_DIGEST)
      ])
    });

    expect(outcome.state).toBe(state);
    expect(outcome.result).toMatchObject({
      status: "dry_run",
      stage: "operationCommit",
      selectedLayerNodeRefs: ["layer_headwear"],
      operationResult: {
        status: "dry_run",
        psdLayerMaterializationBatchEvidence: [
          expect.objectContaining({
            aggregateStatus: "success",
            evidenceId: "evidence_batch_src_explicit_psd_sample_model_128_2",
            entries: [
              expect.objectContaining({
                approvedLeafRef: expect.objectContaining({
                  sourceLayerId: "layer_headwear"
                }),
                resultRefs: expect.objectContaining({
                  partId: "part_headwear",
                  drawableId: "draw_headwear",
                  textureId: "tex_headwear",
                  meshId: "mesh_headwear"
                })
              })
            ]
          })
        ]
      }
    });
    expect(captureRejectedBatchMutationState(adapter)).toEqual(initialMutationState);
    expect(persistentStore.puts).toHaveLength(0);
  });

  it("surfaces per-layer materialization failures without committing a partial batch", async () => {
    const adapter = createEditorSessionAdapter();
    const initialDrawableIds = adapter.authoringSession.graph.drawables.map(
      (drawable) => drawable.drawableId
    );
    const persistentStore = createRecordingPersistentStore();
    const outcome = await commitEditorSelectedPsdLayerBatchIntakeWorkflow({
      adapter,
      state: createParsedEditorState(adapter),
      command: {
        selectedLayerNodeRefs: ["layer_headwear", "group_accessories"],
        destinationParentPartId: "part_root"
      },
      currentPsdFile: createCurrentPsdFile(),
      parsedBridgeResult: createParsedBridgeResult(),
      persistentByteStore: persistentStore.store,
      materializeSelectedLayers: createPartialFailureBatchMaterializer()
    });

    expect(outcome.result.status).toBe("failed");
    expect(outcome.result.stage).toBe("materialization");
    expect(outcome.state.explicitPsdImport.selectedLayerBatchIntake.summaryFacts).toEqual(
      expect.arrayContaining([
        { label: "Batch status", value: "partialFailure" },
        { label: "Requested / success / failure", value: "2 / 1 / 1" },
        { label: "Unsupported or group selections", value: "1" }
      ])
    );
    expect(outcome.state.explicitPsdImport.selectedLayerBatchIntake.entryLabels.join("\n")).toContain(
      "unsupportedLayerType"
    );
    expect(adapter.authoringSession.graph.drawables.map((drawable) => drawable.drawableId)).toEqual(
      initialDrawableIds
    );
    expect(persistentStore.puts).toHaveLength(0);
  });

  it("records import-plan bridge evidence while materializing only approved leaf refs", async () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-06-06T00:00:00.000Z")
    });
    const persistentStore = createRecordingPersistentStore();
    const materializedInputs: string[][] = [];
    const outcome = await commitEditorSelectedPsdLayerBatchIntakeWorkflow({
      adapter,
      state: createParsedEditorState(adapter),
      command: {
        selectedLayerNodeRefs: ["layer_headwear"],
        destinationParentPartId: "part_root",
        importPlanBridge: createImportPlanBridgeForBatchWorkflowTest()
      },
      currentPsdFile: createCurrentPsdFile(),
      parsedBridgeResult: createParsedBridgeResult(),
      persistentByteStore: persistentStore.store,
      now: () => new Date("2026-06-06T00:00:00.000Z"),
      materializeSelectedLayers: async (input) => {
        materializedInputs.push([...input.selectedLayerNodeRefs]);
        return createBatchMaterializationResult({
          status: "success",
          input,
          entries: [{
            status: "materialized" as const,
            requestIndex: 0,
            selectedLayerNodeRef: "layer_headwear",
            candidate: createCandidate("layer_headwear", ["Headwear"], "Headwear", HEADWEAR_DIGEST)
          }]
        });
      }
    });

    expect(outcome.result.status).toBe("committed");
    expect(materializedInputs).toEqual([["layer_headwear"]]);
    expect(outcome.state.explicitPsdImport.selectedLayerBatchIntake.summaryFacts).toEqual(
      expect.arrayContaining([
        { label: "Import plan id", value: "plan_editorBatch" },
        { label: "Import plan approval", value: "approval_editorBatch" },
        { label: "Approved leaf candidates", value: "1" },
        { label: "Not-approved / blocked candidates", value: "1 / 0" }
      ])
    );
    expect(
      outcome.result.latestSessionPersistenceResult?.operationResult.psdLayerMaterializationBatchEvidence?.[0]
        ?.importPlanBridge?.approval.approvedLeafRefs.map((leaf) => leaf.sourceLayerRef.sourceLayerId)
    ).toEqual(["layer_headwear"]);
  });

  it("commits an arbitrary approved import-plan leaf ref and exposes per-leaf result refs", async () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-06-06T00:00:00.000Z")
    });
    const persistentStore = createRecordingPersistentStore();
    const frontHairRef = "psd:root/group[2]/layer[0]";
    const outcome = await commitEditorSelectedPsdLayerBatchIntakeWorkflow({
      adapter,
      state: createParsedEditorState(adapter),
      command: {
        selectedLayerNodeRefs: [frontHairRef],
        destinationParentPartId: "part_root",
        importPlanBridge: createImportPlanBridgeForBatchWorkflowTest({
          approvedLayerRef: frontHairRef,
          approvedLayerName: "front hair",
          approvedLayerPath: ["front hair"]
        })
      },
      currentPsdFile: createCurrentPsdFile(),
      parsedBridgeResult: createParsedBridgeResult(),
      persistentByteStore: persistentStore.store,
      now: () => new Date("2026-06-06T00:00:00.000Z"),
      materializeSelectedLayers: createSuccessfulBatchMaterializer([
        createCandidate(frontHairRef, ["front hair"], "front hair", FRONT_HAIR_DIGEST)
      ])
    });

    const batchState = outcome.state.explicitPsdImport.selectedLayerBatchIntake;
    const entriesText = batchState.entryLabels.join("\n");

    expect(outcome.result.status).toBe("committed");
    expect(batchState.summaryFacts).toEqual(
      expect.arrayContaining([
        { label: "Aggregate status", value: "success" },
        { label: "Batch issues", value: "none" },
        { label: "Import plan approval issues", value: "none" },
        { label: "Approved leaf candidates", value: "1" },
        { label: "Not-approved / blocked candidates", value: "1 / 0" }
      ])
    );
    expect(entriesText).toContain(frontHairRef);
    expect(entriesText).toContain("approvalOrder=0");
    expect(entriesText).toContain("batchEvidence=evidence_batch_src_explicit_psd_sample_model_128_2");
    expect(entriesText).toContain("materializationEvidence=mat_psd_root_group_2_layer_0");
    expect(entriesText).toContain("part=part_front_hair");
    expect(entriesText).toContain("drawable=draw_front_hair");
    expect(entriesText).toContain("texture=tex_front_hair");
    expect(entriesText).toContain("mesh=mesh_front_hair");
    expect(entriesText).toContain("issues=none");
    expect(
      outcome.result.latestSessionPersistenceResult?.operationResult.psdLayerMaterializationBatchEvidence?.[0]
        ?.importPlanBridge?.approval.approvedLeafRefs.map((leaf) => leaf.sourceLayerRef.sourceLayerId)
    ).toEqual([frontHairRef]);

    const operationResult = outcome.result.latestSessionPersistenceResult?.operationResult;
    if (operationResult === undefined) {
      throw new Error("Expected committed front hair batch operation result.");
    }
    const aiProjection = projectEditorAiPsdImportPlanCommandResult({
      state: outcome.state,
      detail: "full",
      operationResult,
      stage: outcome.result.stage,
      selectedLayerNodeRefs: outcome.result.selectedLayerNodeRefs
    });
    expect(aiProjection.latestBatch).toMatchObject({
      status: "committed",
      aggregateStatus: "success",
      approvedLayerNodeRefs: [frontHairRef],
      generatedResultRefs: [
        expect.objectContaining({
          sourceLayerId: frontHairRef,
          approvalOrder: 0,
          batchEvidenceId: "evidence_batch_src_explicit_psd_sample_model_128_2",
          materializationEvidenceId: "mat_psd_root_group_2_layer_0",
          partId: "part_front_hair",
          drawableId: "draw_front_hair",
          textureId: "tex_front_hair",
          meshId: "mesh_front_hair",
          issues: []
        })
      ],
      issues: []
    });
  });

  it("surfaces generated scaffold collisions from the batch operation without project mutation", async () => {
    const adapter = createEditorSessionAdapter();
    const initialMutationState = captureRejectedBatchMutationState(adapter);
    const persistentStore = createRecordingPersistentStore();
    const initialPersistentStorePuts = [...persistentStore.puts];
    const outcome = await commitEditorSelectedPsdLayerBatchIntakeWorkflow({
      adapter,
      state: createParsedEditorState(adapter),
      command: {
        selectedLayerNodeRefs: ["layer_headwear", "layer_headwear_copy"],
        destinationParentPartId: "part_root"
      },
      currentPsdFile: createCurrentPsdFile(),
      parsedBridgeResult: createParsedBridgeResult(),
      persistentByteStore: persistentStore.store,
      materializeSelectedLayers: createSuccessfulBatchMaterializer([
        createCandidate("layer_headwear", ["Headwear"], "Headwear", HEADWEAR_DIGEST),
        createCandidate("layer_headwear_copy", ["Headwear"], "Headwear", COPY_DIGEST)
      ])
    });

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.stage).toBe("operationCommit");
    expect(outcome.result.latestSessionPersistenceResult).toBeNull();
    expect(outcome.state.explicitPsdImport.selectedLayerBatchIntake.entryLabels.join("\n")).toContain(
      "operation.importPsdLayerMaterializationBatch.duplicateGeneratedId"
    );
    expect(outcome.state.explicitPsdImport.selectedLayerBatchIntake.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: "operation.importPsdLayerMaterializationBatch.duplicateGeneratedId"
        })
      ])
    );
    expect(captureRejectedBatchMutationState(adapter)).toEqual(initialMutationState);
    expect(persistentStore.puts).toEqual(initialPersistentStorePuts);
  });
});

const HEADWEAR_DIGEST = "1".repeat(64);
const EYEWEAR_DIGEST = "3".repeat(64);
const COPY_DIGEST = "4".repeat(64);
const FRONT_HAIR_DIGEST = "5".repeat(64);
const SOURCE_DIGEST = "2".repeat(64);
const MEDIA_TYPE = "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8";

const captureRejectedBatchMutationState = (
  adapter: ReturnType<typeof createEditorSessionAdapter>
) => {
  const snapshot = adapter.createPersistenceSnapshot();

  return {
    packageRevision: snapshot.packageRevision,
    sourceAssetIds: snapshot.document.assets.sourceManifest.sourceAssets.map(
      (sourceAsset) => sourceAsset.sourceAssetId
    ),
    operationLogEntries: snapshot.operationLogEntries,
    generatedArtifactPaths: snapshot.generatedArtifactPaths,
    packageInMemoryFilePaths: snapshot.packageInMemoryFilePaths,
    textureIds: snapshot.document.assets.textureAtlas?.textures.map((texture) => texture.textureId) ?? [],
    drawableIds: snapshot.document.model.drawables.drawables.map((drawable) => drawable.drawableId),
    partIds: snapshot.document.model.graph.parts.map((part) => part.partId)
  };
};

const createParsedEditorState = (
  adapter: ReturnType<typeof createEditorSessionAdapter>
): EditorSemanticState => ({
  ...createEditorWorkflowState(adapter),
  explicitPsdImport: projectExplicitPsdImportStateFromBridgeResult(createParsedBridgeResult(), {
    selectedLayerNodeRef: "layer_headwear",
    selectedLayerNodeRefs: ["layer_headwear", "layer_eyewear"]
  })
});

const createSuccessfulBatchMaterializer =
  (candidates: readonly SelectedPsdLayerMaterializedAssetCandidate[]) =>
  async (input: SelectedPsdLayerBatchFileMaterializationInput): Promise<SelectedPsdLayerBatchMaterializationResult> =>
    createBatchMaterializationResult({
      status: "success",
      input,
      entries: candidates.map((candidate, requestIndex) => ({
        status: "materialized" as const,
        requestIndex,
        selectedLayerNodeRef: input.selectedLayerNodeRefs[requestIndex] ?? candidate.evidence.sourceLayer.sourceLayerId,
        candidate
      }))
    });

const createPartialFailureBatchMaterializer =
  () =>
  async (input: SelectedPsdLayerBatchFileMaterializationInput): Promise<SelectedPsdLayerBatchMaterializationResult> =>
    createBatchMaterializationResult({
      status: "partialFailure",
      input,
      entries: [
        {
          status: "materialized" as const,
          requestIndex: 0,
          selectedLayerNodeRef: "layer_headwear",
          candidate: createCandidate("layer_headwear", ["Headwear"], "Headwear", HEADWEAR_DIGEST)
        },
        {
          status: "failed" as const,
          requestIndex: 1,
          selectedLayerNodeRef: "group_accessories",
          failure: {
            evidenceKind: "selected-psd-layer-batch-materialization-failure-evidence-v1",
            failureKind: "unsupportedLayerType",
            severity: "error",
            message: "Selected node is a group and cannot be materialized as a PSD leaf layer.",
            requestIndex: 1,
            selectedLayerNodeRef: "group_accessories",
            source: createSourceEvidence(input),
            selectedNode: {
              nodeRef: "group_accessories",
              nodeType: "group",
              sourceNodePath: ["Accessories"],
              originalName: "Accessories"
            },
            checks: ["selectedNodeType=group", "materialized=false", "publicDemoAsset=false"],
            provenance: {
              sourceInput: "explicit-user-selected-private-local-psd-v1",
              privacyLabel: "private/local",
              publicDemoAsset: false,
              materializedBytePersistence: "editor-local-candidate-only-not-persisted-by-domain-b-v1"
            }
          }
        }
      ]
    });

const createBatchMaterializationResult = (input: {
  readonly status: SelectedPsdLayerBatchMaterializationResult["status"];
  readonly input: SelectedPsdLayerBatchFileMaterializationInput;
  readonly entries: SelectedPsdLayerBatchMaterializationResult["entries"];
}): SelectedPsdLayerBatchMaterializationResult => {
  const failures = input.entries.filter((entry) => entry.status === "failed");
  const acceptedBytes = input.entries
    .filter((entry) => entry.status === "materialized")
    .reduce((sum, entry) => sum + entry.candidate.evidence.byteLength, 0);

  return {
    evidenceKind: "selected-psd-layer-batch-materialization-result-v1",
    batchId: "batch_src_explicit_psd_sample_model_128_2",
    status: input.status,
    source: createSourceEvidence(input.input),
    entries: input.entries,
    summary: {
      requestedCount: input.entries.length,
      uniqueRequestedCount: new Set(input.entries.map((entry) => entry.selectedLayerNodeRef)).size,
      successCount: input.entries.length - failures.length,
      failureCount: failures.length,
      duplicateSelectionCount: 0,
      unsupportedLayerTypeCount: failures.filter(
        (entry) => entry.status === "failed" && entry.failure.failureKind === "unsupportedLayerType"
      ).length,
      missingCurrentSourceBytesCount: 0,
      staleSourceCount: 0,
      materializationFailureCount: failures.length,
      batchLayerCountExceededCount: 0,
      batchTotalByteCapExceededCount: 0,
      maxSelectedLayerCount: 4,
      maxTotalRawRgbaBytes: 32 * 1024 * 1024,
      acceptedRawRgbaByteLength: acceptedBytes,
      attemptedRawRgbaByteLength: acceptedBytes,
      batchCap: {
        exceeded: false,
        requestedUniqueCount: input.entries.length,
        maxSelectedLayerCount: 4
      },
      totalByteCap: {
        exceeded: false,
        acceptedRawRgbaByteLength: acceptedBytes,
        attemptedRawRgbaByteLength: acceptedBytes,
        maxTotalRawRgbaBytes: 32 * 1024 * 1024
      },
      publicDemoAsset: false
    },
    diagnostics: [{
      checkId: `selectedPsdLayer.batchMaterialization.${input.status}`,
      severity: input.status === "success" ? "info" : "warning",
      message: "Selected PSD layer batch materialization completed with explicit per-layer results.",
      evidence: [
        `requestedCount=${input.entries.length}`,
        `successCount=${input.entries.length - failures.length}`,
        `failureCount=${failures.length}`,
        "publicDemoAsset=false"
      ]
    }]
  };
};

const createCandidate = (
  sourceLayerId: string,
  sourceLayerPath: readonly string[],
  originalName: string,
  digestHex: string
): SelectedPsdLayerMaterializedAssetCandidate => {
  const bytes = new Uint8Array(16);
  const sourceLayerToken = createTestIdToken(sourceLayerId);

  return {
    bytes,
    evidence: {
      evidenceKind: "selected-psd-layer-materialized-asset-candidate-evidence-v1",
      candidateId: `candidate_${sourceLayerToken}`,
      materializationId: `mat_${sourceLayerToken}`,
      mediaType: MEDIA_TYPE,
      pixelFormat: "rgba8",
      width: 2,
      height: 2,
      byteLength: 16,
      digest: { algorithm: "sha256", hex: digestHex },
      sourcePsd: {
        sourceAssetId: "src_explicit_psd_sample_model_128",
        fileName: "sample_model.psd",
        declaredMediaType: "image/vnd.adobe.photoshop",
        byteLength: 128,
        digest: { algorithm: "sha256", hex: SOURCE_DIGEST }
      },
      sourceLayer: {
        sourceLayerId,
        sourceLayerPath,
        originalName,
        bounds: {
          x: 0,
          y: 0,
          width: 2,
          height: 2
        },
        visibleInSource: true
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
          selectedNodeRef: sourceLayerId,
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
  };
};

const createImportPlanBridgeForBatchWorkflowTest = (options: {
  readonly approvedLayerRef?: string;
  readonly approvedLayerName?: string;
  readonly approvedLayerPath?: readonly string[];
} = {}): PsdImportPlanApprovalBridgeEvidenceDto => {
  const approvedLayerRef = options.approvedLayerRef ?? "layer_headwear";
  const approvedLayerName = options.approvedLayerName ?? "Headwear";
  const approvedLayerPath = options.approvedLayerPath ?? ["Headwear"];
  const notApprovedLayerRef = "layer_eyewear";
  const notApprovedLayerName = "Eyewear";
  const notApprovedLayerPath = ["Eyewear"];

  return {
    schemaVersion: "psd-import-plan-approval-bridge-evidence-v1",
    candidatePlan: {
      schemaVersion: "psd-import-plan-candidate-evidence-v1",
      evidenceKind: "psd-import-plan-candidate-evidence-v1",
      planId: "plan_editorBatch",
      candidatePlanDigest: { algorithm: "sha256", hex: "5".repeat(64) },
      sourcePsd: createImportPlanSourcePsdIdentity(),
      parser: {
        evidenceKind: "psd-parser-evidence-v1",
        parserName: "webtoonPsd",
        parserPackageName: "@webtoon/psd",
        parserVersion: "0.4.0",
        runtime: "browser",
        privateShapePolicy: "parser-private-shape-excluded-v1"
      },
      scope: {
        scopeRef: { kind: "document", id: "psd:root" },
        scopeDisplayPath: [],
        discoveryMode: "recursiveLeafCandidatePreview"
      },
      candidates: [
        createImportPlanCandidate(approvedLayerRef, approvedLayerName, approvedLayerPath, 0, ["candidate"]),
        createImportPlanCandidate(notApprovedLayerRef, notApprovedLayerName, notApprovedLayerPath, 1, [
          "candidate",
          "notApproved"
        ])
      ],
      summary: {
        candidateCount: 2,
        approvedCandidateCount: 1,
        notApprovedCandidateCount: 1,
        blockedCandidateCount: 0,
        hiddenCandidateCount: 0,
        unsupportedCandidateCount: 0,
        duplicateNameCount: 0,
        duplicateRefCount: 0,
        generatedIdCollisionCount: 0,
        generatedNameCollisionCount: 0,
        byteCapBlockedCount: 0,
        totalByteEstimate: 32,
        approvedByteEstimate: 16
      },
      boundary: {
        rawParserObjectPersistence: "notPersisted",
        sourcePsdBytePersistence: "metadataOnlyNoRawBytes",
        candidateDiscoveryBytePersistence: "metadataOnlyNoRawBytes",
        publicDemoAsset: false,
        allLayerOneClickImport: "notProvided",
        recursiveGroupAutoImport: "notProvided"
      }
    },
    approval: {
      schemaVersion: "psd-import-plan-approval-evidence-v1",
      evidenceKind: "psd-import-plan-approval-evidence-v1",
      approvalId: "approval_editorBatch",
      candidatePlanDigest: { algorithm: "sha256", hex: "5".repeat(64) },
      approvalSelectionDigest: { algorithm: "sha256", hex: "6".repeat(64) },
      sourcePsd: createImportPlanSourcePsdIdentity(),
      destination: {
        destinationKind: "generatedPartScaffold",
        parentPartId: PartIdSchema.parse("part_root")
      },
      approvalStatus: "approved",
      approvedLeafRefs: [{
        approvalOrder: 0,
        sourceLayerRef: createImportPlanSourceLayerRef(approvedLayerRef, approvedLayerName, approvedLayerPath),
        sourceLayerName: approvedLayerName,
        sourceLayerPath: [...approvedLayerPath],
        candidateStatuses: ["candidate"],
        candidateStatusReasons: [],
        generatedScaffoldPreview: createImportPlanGeneratedScaffold(
          approvedLayerPath.join(" / "),
          "previewReady"
        ),
        resolvedGeneratedIds: createImportPlanGeneratedScaffold(approvedLayerPath.join(" / "), "resolved")
      }],
      notApprovedCandidates: [
        createImportPlanCandidate(notApprovedLayerRef, notApprovedLayerName, notApprovedLayerPath, 1, [
          "candidate",
          "notApproved"
        ])
      ],
      blockedCandidates: [],
      collisionPreflight: {
        duplicateRefCount: 0,
        duplicateNameCount: 0,
        generatedIdCollisionCount: 0,
        generatedNameCollisionCount: 0,
        byteCapBlockedCount: 0,
        blockedCandidateCount: 0,
        notApprovedCandidateCount: 1,
        preflightBlockedCount: 0
      },
      boundary: {
        onlyApprovedLeafRefsPassedToBatch: true,
        rawParserObjectPersistence: "notPersisted",
        sourcePsdBytePersistence: "metadataOnlyNoRawBytes",
        materializedLayerBytePersistence: "binaryAssetRefOnlyNoInlineBytes",
        publicDemoAsset: false,
        allLayerOneClickImport: "notProvided",
        recursiveGroupAutoImport: "notProvided"
      }
    }
  };
};

const createImportPlanSourcePsdIdentity = (): PsdImportPlanSourcePsdIdentityDto => ({
  sourceAssetId: SourceAssetIdSchema.parse("src_explicit_psd_sample_model_128"),
  sourceFilePath: "assets/sources/psd/sample_model_128.psd",
  digest: { algorithm: "sha256", hex: SOURCE_DIGEST },
  byteLength: 128,
  mediaType: "image/vnd.adobe.photoshop",
  sourceBytePersistence: "metadataOnlyNoRawBytes",
  publicDemoAsset: false
});

const createImportPlanCandidate = (
  sourceLayerId: string,
  sourceLayerName: string,
  sourceLayerPath: readonly string[],
  candidateIndex: number,
  statuses: readonly ("candidate" | "notApproved")[]
): PsdImportPlanCandidateDto => ({
  candidateIndex,
  sourceLayerRef: createImportPlanSourceLayerRef(sourceLayerId, sourceLayerName, sourceLayerPath),
  sourceLayerName,
  sourceLayerPath: [...sourceLayerPath],
  sourceOrder: candidateIndex,
  bounds: { x: 0, y: 0, width: 2, height: 2 },
  visibleInSource: true,
  opacityInSource: 1,
  byteEstimate: 16,
  statuses: [...statuses],
  statusReasons: [],
  approvalBlockedReasons: [],
  generatedScaffoldPreview: createImportPlanGeneratedScaffold(sourceLayerPath.join(" / "), "previewReady")
});

const createImportPlanSourceLayerRef = (
  sourceLayerId: string,
  sourceLayerName: string,
  sourceLayerPath: readonly string[]
): PsdImportPlanSourceLayerReferenceDto => ({
  sourceAssetId: SourceAssetIdSchema.parse("src_explicit_psd_sample_model_128"),
  sourceLayerId,
  sourceLayerName,
  sourceLayerPath: [...sourceLayerPath]
});

const createImportPlanGeneratedScaffold = (
  displayName: string,
  status: "previewReady" | "resolved"
): PsdImportPlanGeneratedScaffoldDto => {
  const token = createTestIdToken(displayName);

  return {
    destinationKind: "generatedPartScaffold",
    parentPartId: PartIdSchema.parse("part_root"),
    partId: PartIdSchema.parse(`part_${token}`),
    partDisplayName: displayName,
    drawableId: DrawableIdSchema.parse(`draw_${token}`),
    drawableDisplayName: displayName,
    textureId: TextureIdSchema.parse(`tex_${token}`),
    meshId: MeshIdSchema.parse(`mesh_${token}`),
    status,
    statusReasons: []
  };
};

const createTestIdToken = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unnamed";

const createSourceEvidence = (input: SelectedPsdLayerBatchFileMaterializationInput) => ({
  evidenceKind: "browser-psd-source-evidence-v1" as const,
  intakeKind: "explicitFile" as const,
  sourceAssetId: input.sourceAssetId ?? "src_explicit_psd_sample_model_128",
  fileName: input.file?.name ?? "sample_model.psd",
  declaredMediaType: input.file?.type ?? "image/vnd.adobe.photoshop",
  byteLength: input.file?.size ?? 128,
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
    groupCount: 1,
    layerCount: 3,
    visibleLayerCount: 3,
    hiddenLayerCount: 0,
    rasterCandidateLayerCount: 3,
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
    sourceGroups: [{
      sourceGroupId: "group_accessories",
      originalName: "Accessories",
      normalizedName: "Accessories",
      groupPath: ["Accessories"],
      sourceOrder: 0,
      visibleInSource: true,
      opacityInSource: 1,
      unsupportedFeatures: []
    }],
    sourceLayers: [
      createAdapterSourceLayer("layer_headwear", "Headwear", 1),
      createAdapterSourceLayer("layer_eyewear", "Eyewear", 2),
      createAdapterSourceLayer("layer_headwear_copy", "Headwear", 3),
      createAdapterSourceLayer("psd:root/group[2]/layer[0]", "front hair", 4)
    ],
    unsupportedFeatures: [],
    diagnostics: []
  },
  diagnostics: [],
  errorEvidence: []
});

const createAdapterSourceLayer = (
  sourceLayerId: string,
  originalName: string,
  sourceOrder: number,
  groupPath: readonly string[] = []
) => ({
  sourceLayerId,
  originalName,
  normalizedName: originalName,
  groupPath: [...groupPath],
  sourceOrder,
  bounds: { x: 0, y: 0, width: 2, height: 2 },
  visibleInSource: true,
  opacityInSource: 1,
  role: "editableLayer" as const,
  unsupportedFeatures: []
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
