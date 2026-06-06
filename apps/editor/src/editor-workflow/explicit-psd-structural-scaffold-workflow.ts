import {
  PsdAdapterLayerMaterializationEvidenceSchema,
  type OperationResultDto,
  type PsdAdapterLayerMaterializationEvidenceDto,
  type PsdAdapterResultDto
} from "@private-2d-rigging-lab/operation-core";
import { computePackageBinarySha256Digest } from "@private-2d-rigging-lab/package-format";

import {
  collectEditorPersistentBinaryOwners,
  createEditorSelectedPsdLayerBinaryByteRegistration,
  createImportPsdSourceAssetOperationRequest,
  createImportPsdStructuralScaffoldOperationRequest,
  storeEditorPersistentBinaryOwnerBytes,
  type EditorPersistentByteStore,
  type EditorPersistentByteStorePutResult,
  type EditorSelectedPsdLayerBinaryByteRegistration,
  type EditorSessionAdapter,
  type EditorSessionPersistenceResult
} from "../editor-session/index.js";
import {
  createEmptyExplicitPsdStructuralScaffoldIntakeState,
  createFailedPsdStructuralScaffoldIntakeState,
  projectCommittedPsdStructuralScaffoldIntakeState,
  projectExplicitPsdStructuralScaffoldPlanState,
  type EditorSemanticState,
  type ExplicitPsdImportDiagnosticState
} from "../editor-state/index.js";
import { applyEditorWorkflowCommitResult } from "./workflow-state-projection.js";
import type { BrowserPsdParserBridgeResult } from "./browser-psd-parser-bridge-result.js";
import {
  createBrowserPsdStructuralScaffoldPlan,
  type BrowserPsdStructuralScaffoldPlan
} from "./browser-psd-structural-scaffold-plan-service.js";
import {
  materializeSelectedPsdLayersFromBrowserFile,
  type SelectedPsdLayerBatchFileMaterializationInput
} from "./selected-psd-layer-batch-materialization-service.js";
import type {
  SelectedPsdLayerBatchMaterializationResult,
  SelectedPsdLayerBatchMaterializationSuccessEntry
} from "./selected-psd-layer-batch-materialization-result.js";
import type { SelectedPsdLayerMaterializedAssetCandidate } from "./selected-psd-layer-materialization-result.js";
import {
  createExplicitPsdSourceAssetId,
  createPsdSourcePackagePath,
  sanitizePsdImportIdToken
} from "./explicit-psd-source-identity.js";

export interface EditorExplicitPsdStructuralScaffoldPreviewCommand {
  readonly scopeRef?: string;
  readonly approvedNodeRefs?: readonly string[];
  readonly destinationParentPartId?: string;
}

export interface EditorExplicitPsdStructuralScaffoldCommitCommand {
  readonly destinationParentPartId: string;
}

export interface EditorExplicitPsdStructuralScaffoldPreviewResult {
  readonly status: BrowserPsdStructuralScaffoldPlan["status"];
  readonly structuralPlanId: string;
  readonly structuralPlanDigest: string;
  readonly approvedNodeRefs: readonly string[];
  readonly approvedGroupCount: number;
  readonly approvedLeafCount: number;
}

export interface EditorExplicitPsdStructuralScaffoldPreviewOutcome {
  readonly state: EditorSemanticState["explicitPsdImport"];
  readonly plan: BrowserPsdStructuralScaffoldPlan;
  readonly result: EditorExplicitPsdStructuralScaffoldPreviewResult;
}

export interface EditorExplicitPsdStructuralScaffoldCommitResult {
  readonly status: "committed" | "rejected" | "failed";
  readonly stage: "currentSource" | "materialization" | "sourceImport" | "operationCommit";
  readonly approvedLayerNodeRefs: readonly string[];
  readonly latestSessionPersistenceResult: EditorSessionPersistenceResult | null;
  readonly persistentStoreResults?: readonly EditorStructuralPersistentStoreResult[];
}

export interface EditorExplicitPsdStructuralScaffoldCommitOutcome {
  readonly state: EditorSemanticState;
  readonly result: EditorExplicitPsdStructuralScaffoldCommitResult;
}

export interface EditorExplicitPsdStructuralScaffoldPreviewWorkflowInput {
  readonly state: EditorSemanticState;
  readonly command: EditorExplicitPsdStructuralScaffoldPreviewCommand;
  readonly currentPsdFile?: File;
  readonly parsedBridgeResult?: BrowserPsdParserBridgeResult;
}

export interface EditorExplicitPsdStructuralScaffoldCommitWorkflowInput {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: EditorExplicitPsdStructuralScaffoldCommitCommand;
  readonly plan?: BrowserPsdStructuralScaffoldPlan;
  readonly currentPsdFile?: File;
  readonly parsedBridgeResult?: BrowserPsdParserBridgeResult;
  readonly persistentByteStore: EditorPersistentByteStore;
  readonly now?: () => Date;
  readonly materializeSelectedLayers?: (
    input: SelectedPsdLayerBatchFileMaterializationInput
  ) => Promise<SelectedPsdLayerBatchMaterializationResult>;
}

export interface EditorStructuralPersistentStoreResult {
  readonly textureId: string;
  readonly result: EditorPersistentByteStorePutResult | "skipped-missing-texture-owner";
}

interface RegisteredStructuralEntry {
  readonly materializationEntry: SelectedPsdLayerBatchMaterializationSuccessEntry;
  readonly registration: EditorSelectedPsdLayerBinaryByteRegistration;
  readonly materialization: PsdAdapterLayerMaterializationEvidenceDto;
  readonly textureId: string;
}

export const runEditorExplicitPsdStructuralScaffoldPreviewWorkflow = async (
  input: EditorExplicitPsdStructuralScaffoldPreviewWorkflowInput
): Promise<EditorExplicitPsdStructuralScaffoldPreviewOutcome> => {
  const parsedBridgeResult = assertParsedCurrentSource(input);
  const currentPsdFile = input.currentPsdFile;
  if (currentPsdFile === undefined) {
    throw new Error("Current PSD source bytes are unavailable; re-parse before creating a structural scaffold preview.");
  }

  const sourceDigest = await computeSourceDigest(currentPsdFile);
  const sourceAssetId = createExplicitPsdSourceAssetId(currentPsdFile);
  const destinationParentPartId = input.command.destinationParentPartId?.trim() || "";
  const plan = await createBrowserPsdStructuralScaffoldPlan({
    parsedBridgeResult,
    sourceAssetId,
    sourceFilePath: createPsdSourcePackagePath(currentPsdFile),
    sourceDigest,
    scopeRef: input.command.scopeRef?.trim() || "psd:root",
    destinationParentPartId,
    approvedNodeRefs: input.command.approvedNodeRefs ?? [],
    reservedGeneratedIds: collectReservedGeneratedIds(input.state),
    reservedGeneratedNames: collectReservedGeneratedNames(input.state)
  });
  const explicitPsdImport = {
    ...input.state.explicitPsdImport,
    selectedLayerNodeRefs: plan.approvedNodeRefs,
    structuralScaffoldPlan: projectExplicitPsdStructuralScaffoldPlanState(plan, {
      destinationParentPartId
    }),
    structuralScaffoldIntake: createEmptyExplicitPsdStructuralScaffoldIntakeState()
  };

  return {
    state: explicitPsdImport,
    plan,
    result: {
      status: plan.status,
      structuralPlanId: plan.structuralScaffoldBridge.structuralPlan.structuralPlanId,
      structuralPlanDigest:
        `sha256:${plan.structuralScaffoldBridge.structuralPlan.structuralPlanDigest.hex}`,
      approvedNodeRefs: plan.approvedNodeRefs,
      approvedGroupCount:
        plan.structuralScaffoldBridge.approval.approvedGroupPartScaffolds.length,
      approvedLeafCount:
        plan.structuralScaffoldBridge.approval.approvedLeafScaffolds.length
    }
  };
};

export const commitEditorExplicitPsdStructuralScaffoldWorkflow = async (
  input: EditorExplicitPsdStructuralScaffoldCommitWorkflowInput
): Promise<EditorExplicitPsdStructuralScaffoldCommitOutcome> => {
  const plan = input.plan;
  const approvedLayerNodeRefs =
    plan?.structuralScaffoldBridge.approval.approvedLeafScaffolds.map(
      (leaf) => leaf.sourceLayerRef.sourceLayerId
    ) ?? [];
  const currentSourceFailure = validateCommitCurrentSource(input, approvedLayerNodeRefs);
  if (currentSourceFailure !== null) {
    return {
      state: projectStateWithStructuralIntake(input.state, currentSourceFailure),
      result: {
        status: "failed",
        stage: "currentSource",
        approvedLayerNodeRefs,
        latestSessionPersistenceResult: null
      }
    };
  }

  const parsedBridgeResult = input.parsedBridgeResult;
  const currentPsdFile = input.currentPsdFile;
  if (plan === undefined || parsedBridgeResult?.status !== "parsed" || currentPsdFile === undefined) {
    throw new Error("Expected current source validation to reject missing structural scaffold state.");
  }

  const sourceAssetId = createExplicitPsdSourceAssetId(currentPsdFile);
  const materialize = input.materializeSelectedLayers ?? materializeSelectedPsdLayersFromBrowserFile;
  const materializationResult = await materialize({
    file: currentPsdFile,
    selectedLayerNodeRefs: approvedLayerNodeRefs,
    sourceAssetId,
    maxSelectedLayerCount: plan.structuralScaffoldBridge.approval.capPolicy.approvedLeafLimit,
    maxTotalRawRgbaByteLength: plan.structuralScaffoldBridge.approval.capPolicy.totalRawRgbaByteLimit,
    expectedSource: {
      byteLength: plan.structuralScaffoldBridge.approval.sourcePsd.byteLength,
      digest: plan.structuralScaffoldBridge.approval.sourcePsd.digest
    },
    batchId: createStructuralBatchId(plan)
  });

  if (materializationResult.status !== "success") {
    const intake = createMaterializationBlockedIntakeState(materializationResult);
    return {
      state: projectStateWithStructuralIntake(input.state, intake),
      result: {
        status: "failed",
        stage: "materialization",
        approvedLayerNodeRefs,
        latestSessionPersistenceResult: null
      }
    };
  }

  const operationId = createStructuralOperationId({
    batchId: materializationResult.batchId,
    approvalDigestHex: plan.structuralScaffoldBridge.approval.approvalSelectionDigest.hex
  });
  const entries = await prepareRegisteredStructuralEntries({
    operationId,
    sourceAssetId,
    sourceFilePath: createPsdSourcePackagePath(currentPsdFile),
    plan,
    materializationResult
  });
  const sourceImportOutcome = commitSourceMetadataIfNeeded({
    adapter: input.adapter,
    state: input.state,
    parsedBridgeResult,
    currentPsdFile,
    sourceAssetId,
    materializations: entries.map((entry) => entry.materialization),
    approvedLayerNodeRefs
  });
  if (sourceImportOutcome.status === "rejected") {
    return {
      state: projectStateWithStructuralIntake(sourceImportOutcome.state, sourceImportOutcome.intake),
      result: {
        status: "rejected",
        stage: "sourceImport",
        approvedLayerNodeRefs,
        latestSessionPersistenceResult: sourceImportOutcome.result
      }
    };
  }

  const structuralRequest = createImportPsdStructuralScaffoldOperationRequest(
    {
      operationId,
      sourceAssetId,
      batchId: materializationResult.batchId,
      destinationParentPartId: input.command.destinationParentPartId.trim(),
      structuralScaffoldBridge: plan.structuralScaffoldBridge,
      capPolicy: plan.structuralScaffoldBridge.approval.capPolicy,
      lockedTargetIds: []
    },
    input.adapter.authoringSession.packageRevision
  );
  if (structuralRequest.operationType !== "importPsdStructuralScaffold") {
    throw new Error("Expected importPsdStructuralScaffold request.");
  }

  const structuralResult = input.adapter.commitImportPsdStructuralScaffoldWithBinaryBytes({
    request: structuralRequest,
    entries: entries.map((entry) => ({
      bytes: entry.materializationEntry.candidate.bytes,
      registration: entry.registration
    }))
  });
  const operationState = applyEditorWorkflowCommitResult(
    sourceImportOutcome.state,
    input.adapter,
    structuralResult
  );
  if (structuralResult.operationResult.status !== "committed") {
    const intake = createOperationRejectedIntakeState(structuralResult.operationResult);
    return {
      state: projectStateWithStructuralIntake(operationState, intake),
      result: {
        status: "rejected",
        stage: "operationCommit",
        approvedLayerNodeRefs,
        latestSessionPersistenceResult: structuralResult
      }
    };
  }

  const evidence = structuralResult.operationResult.psdStructuralScaffoldEvidence?.[0];
  const persistentStoreResults = await storeMaterializedTextureBytes({
    persistentByteStore: input.persistentByteStore,
    result: structuralResult,
    entries,
    ...(input.now === undefined ? {} : { now: input.now })
  });
  const committedIntake = evidence === undefined
    ? null
    : projectCommittedPsdStructuralScaffoldIntakeState(evidence);
  const intake = committedIntake === null
    ? createFailedPsdStructuralScaffoldIntakeState({
        checkId: "editor.psdStructuralScaffold.missingOperationEvidence",
        message: "Committed PSD structural scaffold did not return structural operation evidence."
      })
    : {
        ...committedIntake,
        diagnostics: [
          ...committedIntake.diagnostics,
          ...createPersistentStoreDiagnostics(persistentStoreResults)
        ]
      };

  return {
    state: projectStateWithStructuralIntake(operationState, intake),
    result: {
      status: "committed",
      stage: "operationCommit",
      approvedLayerNodeRefs,
      latestSessionPersistenceResult: structuralResult,
      persistentStoreResults
    }
  };
};

const assertParsedCurrentSource = (
  input: EditorExplicitPsdStructuralScaffoldPreviewWorkflowInput
): Extract<BrowserPsdParserBridgeResult, { readonly status: "parsed" }> => {
  if (input.parsedBridgeResult?.status !== "parsed" || input.state.explicitPsdImport.status !== "parsed") {
    throw new Error("Create a structural scaffold preview only after the PSD has parsed in the current browser session.");
  }

  const source = input.state.explicitPsdImport.source;
  if (
    source !== null &&
    input.currentPsdFile !== undefined &&
    (source.fileName !== input.currentPsdFile.name || source.byteLength !== input.currentPsdFile.size)
  ) {
    throw new Error("The retained current-session PSD file no longer matches the displayed PSD import state.");
  }

  return input.parsedBridgeResult;
};

const validateCommitCurrentSource = (
  input: EditorExplicitPsdStructuralScaffoldCommitWorkflowInput,
  approvedLayerNodeRefs: readonly string[]
) => {
  const plan = input.plan;
  if (plan === undefined) {
    return createFailedPsdStructuralScaffoldIntakeState({
      checkId: "editor.psdStructuralScaffold.missingPreview",
      message: "Create and approve a structural scaffold preview before execution."
    });
  }

  if (plan.status !== "ready" || plan.structuralScaffoldBridge.approval.approvalStatus !== "approved") {
    return createFailedPsdStructuralScaffoldIntakeState({
      checkId: "editor.psdStructuralScaffold.previewBlocked",
      message: "Structural scaffold execution requires a ready preview with approved status.",
      status: "rejected"
    });
  }

  if (approvedLayerNodeRefs.length === 0) {
    return createFailedPsdStructuralScaffoldIntakeState({
      checkId: "editor.psdStructuralScaffold.missingApprovedLeaves",
      message: "Approve at least one positive-size PSD leaf before structural scaffold execution."
    });
  }

  if (input.command.destinationParentPartId.trim().length === 0) {
    return createFailedPsdStructuralScaffoldIntakeState({
      checkId: "editor.psdStructuralScaffold.missingDestinationParentPart",
      message: "Destination parent part is required for structural scaffold execution."
    });
  }

  if (input.currentPsdFile === undefined || input.parsedBridgeResult === undefined) {
    return createFailedPsdStructuralScaffoldIntakeState({
      checkId: "editor.psdStructuralScaffold.missingCurrentSource",
      message: "Current PSD source bytes are unavailable; re-parse the PSD file before structural scaffold execution."
    });
  }

  if (input.parsedBridgeResult.status !== "parsed" || input.state.explicitPsdImport.status !== "parsed") {
    return createFailedPsdStructuralScaffoldIntakeState({
      checkId: "editor.psdStructuralScaffold.sourceNotParsed",
      message: "The selected PSD has not produced a parsed tree in the current browser session."
    });
  }

  const source = input.state.explicitPsdImport.source;
  if (
    source !== null &&
    (source.fileName !== input.currentPsdFile.name || source.byteLength !== input.currentPsdFile.size)
  ) {
    return createFailedPsdStructuralScaffoldIntakeState({
      checkId: "editor.psdStructuralScaffold.staleCurrentSource",
      message: "The retained current-session PSD file no longer matches the displayed PSD import state."
    });
  }

  return null;
};

type SourceMetadataImportOutcome =
  | {
      readonly status: "committed" | "skipped-existing";
      readonly state: EditorSemanticState;
      readonly result: EditorSessionPersistenceResult | null;
    }
  | {
      readonly status: "rejected";
      readonly state: EditorSemanticState;
      readonly result: EditorSessionPersistenceResult | null;
      readonly intake: ReturnType<typeof createFailedPsdStructuralScaffoldIntakeState>;
    };

const commitSourceMetadataIfNeeded = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly parsedBridgeResult: Extract<BrowserPsdParserBridgeResult, { readonly status: "parsed" }>;
  readonly currentPsdFile: File;
  readonly sourceAssetId: string;
  readonly materializations: readonly PsdAdapterLayerMaterializationEvidenceDto[];
  readonly approvedLayerNodeRefs: readonly string[];
}): SourceMetadataImportOutcome => {
  const sourceAsset = input.adapter.authoringSession.graph.sourceAssets.find(
    (candidate) => candidate.sourceAssetId === input.sourceAssetId
  );
  if (sourceAsset !== undefined) {
    const materializedLayerIds = new Set(
      sourceAsset.psdProfile?.materializationEvidence?.map(
        (evidence) => evidence.sourceLayerRef.sourceLayerId
      ) ?? []
    );
    const missingLayerIds = input.approvedLayerNodeRefs.filter((layerId) => !materializedLayerIds.has(layerId));
    if (missingLayerIds.length === 0) {
      return {
        status: "skipped-existing",
        state: input.state,
        result: null
      };
    }

    return {
      status: "rejected",
      state: input.state,
      result: null,
      intake: createFailedPsdStructuralScaffoldIntakeState({
        checkId: "editor.psdStructuralScaffold.existingSourceMissingMaterializationEvidence",
        message: `Existing PSD source asset is missing materialization evidence for approved leaves: ${missingLayerIds.join(", ")}.`,
        status: "rejected"
      })
    };
  }

  const request = createImportPsdSourceAssetOperationRequest(
    {
      operationId: createSourceImportOperationId({
        sourceAssetId: input.sourceAssetId,
        packageRevision: input.adapter.authoringSession.packageRevision
      }),
      sourceAssetId: input.sourceAssetId,
      fileRef: {
        packageRelativePath: createPsdSourcePackagePath(input.currentPsdFile),
        contentHash: `sha256:${input.materializations[0]?.provenance.sourceDigest?.hex ?? "0".repeat(64)}`
      },
      adapterResult: createSourceAdapterResult({
        adapterResult: input.parsedBridgeResult.adapterResult,
        materializations: input.materializations
      }),
      rights: {
        creator: "explicit-psd-structural-scaffold",
        license: "private-local-selected-psd-source",
        redistributionAllowed: false,
        aiUsed: false
      }
    },
    input.adapter.authoringSession.packageRevision
  );
  const result = input.adapter.commitOperation(request);
  const state = applyEditorWorkflowCommitResult(input.state, input.adapter, result);

  if (result.operationResult.status !== "committed") {
    return {
      status: "rejected",
      state,
      result,
      intake: createOperationRejectedIntakeState(result.operationResult)
    };
  }

  return {
    status: "committed",
    state,
    result
  };
};

const prepareRegisteredStructuralEntries = async (input: {
  readonly operationId: string;
  readonly sourceAssetId: string;
  readonly sourceFilePath: string;
  readonly plan: BrowserPsdStructuralScaffoldPlan;
  readonly materializationResult: SelectedPsdLayerBatchMaterializationResult;
}): Promise<readonly RegisteredStructuralEntry[]> => {
  const approvedLeaves = input.plan.structuralScaffoldBridge.approval.approvedLeafScaffolds;
  const materializedEntries = collectMaterializedEntries(input.materializationResult);

  return Promise.all(materializedEntries.map(async (entry, index) => {
    const approvedLeaf = approvedLeaves.find(
      (leaf) => leaf.sourceLayerRef.sourceLayerId === entry.candidate.evidence.sourceLayer.sourceLayerId
    );
    if (approvedLeaf === undefined) {
      throw new Error(`Materialized PSD layer is not part of structural approval: ${entry.selectedLayerNodeRef}`);
    }

    const childOperationId = createStructuralChildOperationId({
      operationId: input.operationId,
      selectedIndex: index,
      drawableId: approvedLeaf.generatedDrawableId
    });
    const registration = await createEditorSelectedPsdLayerBinaryByteRegistration({
      operationId: childOperationId,
      sourceAssetId: input.sourceAssetId,
      textureId: approvedLeaf.generatedTextureId,
      sourceLayerId: approvedLeaf.sourceLayerRef.sourceLayerId,
      materializedDigest: entry.candidate.evidence.digest,
      mediaType: entry.candidate.evidence.mediaType,
      bytes: entry.candidate.bytes
    });
    const materialization = createOperationMaterializationEvidence({
      candidate: entry.candidate,
      sourceAssetId: input.sourceAssetId,
      sourceFilePath: input.sourceFilePath,
      binaryAssetRef: registration.binaryAssetRef,
      textureId: approvedLeaf.generatedTextureId
    });

    return {
      materializationEntry: entry,
      registration,
      materialization,
      textureId: approvedLeaf.generatedTextureId
    };
  }));
};

const createOperationMaterializationEvidence = (input: {
  readonly candidate: SelectedPsdLayerMaterializedAssetCandidate;
  readonly sourceAssetId: string;
  readonly sourceFilePath: string;
  readonly binaryAssetRef: NonNullable<PsdAdapterLayerMaterializationEvidenceDto["binaryAssetRef"]>;
  readonly textureId: string;
}): PsdAdapterLayerMaterializationEvidenceDto =>
  PsdAdapterLayerMaterializationEvidenceSchema.parse({
    evidenceKind: "psd-layer-materialization-evidence-v1",
    materializationId: input.candidate.evidence.materializationId,
    sourceLayerRef: {
      sourceAssetId: input.sourceAssetId,
      sourceLayerId: input.candidate.evidence.sourceLayer.sourceLayerId,
      sourceLayerName: input.candidate.evidence.sourceLayer.originalName,
      sourceLayerPath: input.candidate.evidence.sourceLayer.sourceLayerPath
    },
    mediaType: input.candidate.evidence.mediaType,
    byteLength: input.candidate.evidence.byteLength,
    digest: input.candidate.evidence.digest,
    width: input.candidate.evidence.width,
    height: input.candidate.evidence.height,
    binaryAssetRef: input.binaryAssetRef,
    textureId: input.textureId,
    provenance: {
      sourceFilePath: input.sourceFilePath,
      sourceDigest: input.candidate.evidence.sourcePsd.digest,
      sourceByteLength: input.candidate.evidence.sourcePsd.byteLength,
      ...(input.candidate.evidence.sourcePsd.declaredMediaType === undefined
        ? {}
        : { sourceMediaType: input.candidate.evidence.sourcePsd.declaredMediaType }),
      privacyLabel: "packageLocalAsset",
      publicDistribution: "notPublicDistributable",
      derivedArtifactPath: input.binaryAssetRef.packageRelativePath,
      generatedBy: "wave50-editor-psd-structural-scaffold",
      publicDemoAsset: false
    },
    parser: input.candidate.evidence.parser,
    extraction: {
      extractionKind: "selectedLayerRasterV1",
      optionsSchemaVersion: "psd-layer-extraction-options-v1",
      options: {
        channelOrder: "rgba",
        includeEffects: false,
        includeHiddenLayers: false,
        composeWithOtherLayers: false,
        layerSelection: input.candidate.evidence.sourceLayer.sourceLayerId,
        selectedNodeRef: input.candidate.evidence.extraction.options.selectedNodeRef,
        parserMethod: input.candidate.evidence.extraction.options.parserMethod,
        outputEncoding: input.candidate.evidence.extraction.options.outputEncoding,
        pixelFormat: input.candidate.evidence.extraction.options.pixelFormat
      }
    }
  });

const createSourceAdapterResult = (input: {
  readonly adapterResult: PsdAdapterResultDto;
  readonly materializations: readonly PsdAdapterLayerMaterializationEvidenceDto[];
}): PsdAdapterResultDto => ({
  ...input.adapterResult,
  materializationEvidence: [...input.materializations]
});

const storeMaterializedTextureBytes = async (input: {
  readonly persistentByteStore: EditorPersistentByteStore;
  readonly result: EditorSessionPersistenceResult;
  readonly entries: readonly RegisteredStructuralEntry[];
  readonly now?: () => Date;
}): Promise<readonly EditorStructuralPersistentStoreResult[]> => {
  const owners = collectEditorPersistentBinaryOwners(input.result.reloadedDocument);
  const results: EditorStructuralPersistentStoreResult[] = [];

  for (const entry of input.entries) {
    const owner = owners.find(
      (candidate) => candidate.ownerKind === "texture" && candidate.ownerId === entry.textureId
    );
    if (owner === undefined) {
      results.push({
        textureId: entry.textureId,
        result: "skipped-missing-texture-owner"
      });
      continue;
    }

    results.push({
      textureId: entry.textureId,
      result: await storeEditorPersistentBinaryOwnerBytes({
        persistentByteStore: input.persistentByteStore,
        packageDocument: input.result.reloadedDocument,
        owner,
        bytes: entry.materializationEntry.candidate.bytes,
        ...(input.now === undefined ? {} : { now: input.now })
      })
    });
  }

  return results;
};

const createMaterializationBlockedIntakeState = (
  result: SelectedPsdLayerBatchMaterializationResult
) => createFailedPsdStructuralScaffoldIntakeState({
  checkId: "editor.psdStructuralScaffold.materializationFailed",
  message: "Approved PSD structural leaves could not all be materialized.",
  summaryFacts: [
    { label: "Batch id", value: result.batchId },
    { label: "Batch status", value: result.status },
    {
      label: "Requested / success / failure",
      value: `${result.summary.requestedCount} / ${result.summary.successCount} / ${result.summary.failureCount}`
    }
  ],
  entryLabels: result.entries.map((entry) =>
    entry.status === "materialized"
      ? [
          "materialized",
          entry.selectedLayerNodeRef,
          `bytes=${entry.candidate.evidence.byteLength}`,
          `sha256:${entry.candidate.evidence.digest.hex}`
        ].join(" / ")
      : [
          "failed",
          entry.selectedLayerNodeRef,
          entry.failure.failureKind,
          entry.failure.message
        ].join(" / ")
  ),
  diagnostics: [
    ...result.diagnostics.map((diagnostic) => ({
      checkId: diagnostic.checkId,
      severity: diagnostic.severity,
      message: `${diagnostic.message} ${diagnostic.evidence.join(" / ")}`
    })),
    ...result.entries.flatMap((entry) =>
      entry.status === "failed"
        ? [{
            checkId: `editor.psdStructuralScaffold.materialization.${entry.failure.failureKind}`,
            severity: entry.failure.severity,
            message: `${entry.failure.message} ${entry.failure.checks.join(" / ")}`
          }]
        : []
    )
  ]
});

const createOperationRejectedIntakeState = (
  result: OperationResultDto
) => createFailedPsdStructuralScaffoldIntakeState({
  checkId: "editor.psdStructuralScaffold.operationRejected",
  message: "PSD structural scaffold operation was rejected.",
  status: "rejected",
  summaryFacts: [
    { label: "Operation status", value: result.status },
    { label: "Operation id", value: result.operationId },
    { label: "Precondition diagnostics", value: String(result.precondition.diagnostics.length) },
    { label: "Diagnostics", value: String(result.diagnostics.length) }
  ],
  diagnostics: collectOperationResultDiagnostics(result)
});

const collectOperationResultDiagnostics = (
  result: OperationResultDto
): readonly ExplicitPsdImportDiagnosticState[] => [
  ...result.precondition.diagnostics,
  ...result.diagnostics
].map((diagnostic) => ({
  checkId: diagnostic.checkId,
  severity: diagnostic.severity === "blocking" ? "error" : diagnostic.severity,
  message: diagnostic.message
}));

const createPersistentStoreDiagnostics = (
  results: readonly EditorStructuralPersistentStoreResult[]
): readonly ExplicitPsdImportDiagnosticState[] => {
  const unavailable = results.filter(isUnavailablePersistentStoreResult);
  const missingOwners = results.filter((entry) => entry.result === "skipped-missing-texture-owner");
  if (missingOwners.length > 0) {
    return missingOwners.map((entry) => ({
      checkId: "editor.psdStructuralScaffold.persistentTextureOwnerMissing",
      severity: "warning",
      message: `Materialized bytes for ${entry.textureId} were package-local in the current session, but no texture owner was found for browser-local byte storage.`
    }));
  }
  if (unavailable.length > 0) {
    return unavailable.map((entry) => ({
      checkId: "editor.psdStructuralScaffold.browserLocalByteStoreUnavailable",
      severity: "warning",
      message: entry.result.message
    }));
  }

  return [];
};

const isUnavailablePersistentStoreResult = (
  entry: EditorStructuralPersistentStoreResult
): entry is {
  readonly textureId: string;
  readonly result: Extract<EditorPersistentByteStorePutResult, { readonly status: "unavailable" }>;
} => entry.result !== "skipped-missing-texture-owner" && entry.result.status === "unavailable";

const projectStateWithStructuralIntake = (
  state: EditorSemanticState,
  structuralScaffoldIntake: EditorSemanticState["explicitPsdImport"]["structuralScaffoldIntake"]
): EditorSemanticState => ({
  ...state,
  explicitPsdImport: {
    ...state.explicitPsdImport,
    structuralScaffoldIntake
  }
});

const collectMaterializedEntries = (
  result: SelectedPsdLayerBatchMaterializationResult
): readonly SelectedPsdLayerBatchMaterializationSuccessEntry[] =>
  result.entries.filter(
    (entry): entry is SelectedPsdLayerBatchMaterializationSuccessEntry =>
      entry.status === "materialized"
  );

const computeSourceDigest = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const digestResult = await computePackageBinarySha256Digest(bytes);
  if (digestResult.status === "unsupported") {
    throw new Error(`Unable to compute structural scaffold source digest: ${digestResult.reason}`);
  }

  return digestResult.digest;
};

const collectReservedGeneratedIds = (state: EditorSemanticState) => ({
  partIds: state.parts.map((part) => part.partId),
  drawableIds: state.drawables.map((drawable) => drawable.drawableId),
  textureIds: [
    ...state.drawables.map((drawable) => drawable.textureId),
    ...(state.textureAtlas?.textures.map((texture) => texture.textureId) ?? [])
  ]
});

const collectReservedGeneratedNames = (state: EditorSemanticState): readonly string[] => [
  ...state.parts.map((part) => part.displayName),
  ...state.drawables.map((drawable) => drawable.displayName)
];

const createStructuralBatchId = (plan: BrowserPsdStructuralScaffoldPlan): string =>
  `batch_${sanitizePsdImportIdToken([
    plan.structuralScaffoldBridge.structuralPlan.sourcePsd.sourceAssetId,
    plan.structuralScaffoldBridge.structuralPlan.structuralPlanId
  ].join("_"))}`;

const createStructuralOperationId = (input: {
  readonly batchId: string;
  readonly approvalDigestHex: string;
}): string =>
  `op_editor_import_psd_structural_${sanitizePsdImportIdToken(`${input.batchId}_${input.approvalDigestHex.slice(0, 12)}`)}`;

const createStructuralChildOperationId = (input: {
  readonly operationId: string;
  readonly selectedIndex: number;
  readonly drawableId: string;
}): string =>
  `op_${sanitizePsdImportIdToken(`${stripIdPrefix(input.operationId, "op_")}_${input.selectedIndex}_${stripIdPrefix(input.drawableId, "draw_")}`)}`;

const createSourceImportOperationId = (input: {
  readonly sourceAssetId: string;
  readonly packageRevision: number;
}): string =>
  `op_editor_import_explicit_psd_source_${sanitizePsdImportIdToken(input.sourceAssetId)}_r${input.packageRevision}`;

const stripIdPrefix = (value: string, prefix: string): string =>
  value.startsWith(prefix) ? value.slice(prefix.length) : value;
