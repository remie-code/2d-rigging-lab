import {
  createDrawableIdFromDisplayName,
  createMeshIdFromDrawableId,
  createPartIdFromDisplayName,
  createTextureIdFromDrawableId,
  PsdAdapterLayerMaterializationEvidenceSchema,
  type OperationRequestDto,
  type OperationResultDto,
  type PsdAdapterLayerMaterializationEvidenceDto,
  type PsdImportPlanApprovalBridgeEvidenceDto,
  type PsdImportPlanIssueDto,
  type PsdAdapterResultDto
} from "@private-2d-rigging-lab/operation-core";

import type {
  EditorPersistentByteStore,
  EditorPersistentByteStorePutResult,
  EditorSelectedPsdLayerBinaryByteRegistration,
  EditorSessionAdapter,
  EditorSessionPersistenceResult
} from "../editor-session/index.js";
import {
  collectEditorPersistentBinaryOwners,
  createEditorSessionAdapter,
  createEditorSelectedPsdLayerBinaryByteRegistration,
  createImportPsdLayerMaterializationBatchOperationRequest,
  createImportPsdSourceAssetOperationRequest,
  storeEditorPersistentBinaryOwnerBytes
} from "../editor-session/index.js";
import type {
  EditorSemanticState,
  ExplicitPsdImportDiagnosticState,
  ExplicitPsdLayerBatchIntakeState
} from "../editor-state/index.js";
import { applyEditorWorkflowCommitResult } from "./workflow-state-projection.js";
import type { BrowserPsdParserBridgeResult } from "./browser-psd-parser-bridge-result.js";
import {
  materializeSelectedPsdLayersFromBrowserFile,
  type SelectedPsdLayerBatchFileMaterializationInput
} from "./selected-psd-layer-batch-materialization-service.js";
import {
  createExplicitPsdSourceAssetId,
  createPsdSourcePackagePath,
  sanitizePsdImportIdToken
} from "./explicit-psd-source-identity.js";
import type {
  SelectedPsdLayerBatchMaterializationEntry,
  SelectedPsdLayerBatchMaterializationFailureEntry,
  SelectedPsdLayerBatchMaterializationResult,
  SelectedPsdLayerBatchMaterializationSuccessEntry
} from "./selected-psd-layer-batch-materialization-result.js";
import type {
  SelectedPsdLayerMaterializedAssetCandidate
} from "./selected-psd-layer-materialization-result.js";

export interface EditorExplicitPsdLayerBatchIntakeCommand {
  readonly selectedLayerNodeRefs?: readonly string[];
  readonly destinationParentPartId: string;
  readonly importPlanBridge?: PsdImportPlanApprovalBridgeEvidenceDto;
}

export type EditorExplicitPsdLayerBatchIntakeResultStatus =
  | "committed"
  | "rejected"
  | "failed";

export interface EditorExplicitPsdLayerBatchIntakeResult {
  readonly status: EditorExplicitPsdLayerBatchIntakeResultStatus;
  readonly stage:
    | "currentSource"
    | "materialization"
    | "sourceImport"
    | "operationCommit";
  readonly selectedLayerNodeRefs: readonly string[];
  readonly latestSessionPersistenceResult: EditorSessionPersistenceResult | null;
  readonly persistentStoreResults?: readonly EditorBatchPersistentStoreResult[];
}

export type EditorExplicitPsdLayerBatchIntakePreflightResultStatus =
  | "dry_run"
  | "rejected"
  | "failed";

export interface EditorExplicitPsdLayerBatchIntakePreflightResult {
  readonly status: EditorExplicitPsdLayerBatchIntakePreflightResultStatus;
  readonly stage:
    | "currentSource"
    | "materialization"
    | "sourceImport"
    | "operationCommit";
  readonly selectedLayerNodeRefs: readonly string[];
  readonly operationResult?: OperationResultDto;
}

export interface EditorExplicitPsdLayerBatchIntakePreflightOutcome {
  readonly state: EditorSemanticState;
  readonly result: EditorExplicitPsdLayerBatchIntakePreflightResult;
}

export interface EditorExplicitPsdLayerBatchIntakeWorkflowOutcome {
  readonly state: EditorSemanticState;
  readonly result: EditorExplicitPsdLayerBatchIntakeResult;
}

export interface EditorExplicitPsdLayerBatchIntakeWorkflowInput {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: EditorExplicitPsdLayerBatchIntakeCommand;
  readonly currentPsdFile?: File;
  readonly parsedBridgeResult?: BrowserPsdParserBridgeResult;
  readonly persistentByteStore: EditorPersistentByteStore;
  readonly now?: () => Date;
  readonly materializeSelectedLayers?: (
    input: SelectedPsdLayerBatchFileMaterializationInput
  ) => Promise<SelectedPsdLayerBatchMaterializationResult>;
}

export interface EditorBatchPersistentStoreResult {
  readonly textureId: string;
  readonly result: EditorPersistentByteStorePutResult | "skipped-missing-texture-owner";
}

interface RegisteredBatchEntry {
  readonly materializationEntry: SelectedPsdLayerBatchMaterializationSuccessEntry;
  readonly registration: EditorSelectedPsdLayerBinaryByteRegistration;
  readonly materialization: PsdAdapterLayerMaterializationEvidenceDto;
  readonly textureId: string;
}

interface PreparedBatchOperation {
  readonly request: Extract<OperationRequestDto, { readonly operationType: "importPsdLayerMaterializationBatch" }>;
  readonly entries: readonly RegisteredBatchEntry[];
}

export const commitEditorSelectedPsdLayerBatchIntakeWorkflow = async (
  input: EditorExplicitPsdLayerBatchIntakeWorkflowInput
): Promise<EditorExplicitPsdLayerBatchIntakeWorkflowOutcome> => {
  const selectedLayerNodeRefs = resolveSelectedLayerNodeRefs(input);
  const currentSourceFailure = validateCurrentSource(input, selectedLayerNodeRefs);
  if (currentSourceFailure !== null) {
    return {
      state: projectStateWithBatchIntake(input.state, currentSourceFailure),
      result: {
        status: "failed",
        stage: "currentSource",
        selectedLayerNodeRefs,
        latestSessionPersistenceResult: null
      }
    };
  }

  const parsedBridgeResult = input.parsedBridgeResult;
  const currentPsdFile = input.currentPsdFile;
  if (parsedBridgeResult?.status !== "parsed" || currentPsdFile === undefined) {
    throw new Error("Expected current source validation to reject missing parsed PSD state.");
  }

  const sourceAssetId = createExplicitPsdSourceAssetId(currentPsdFile);
  const materialize =
    input.materializeSelectedLayers ?? materializeSelectedPsdLayersFromBrowserFile;
  const materializationResult = await materialize({
    file: currentPsdFile,
    selectedLayerNodeRefs,
    sourceAssetId
  });

  if (materializationResult.status !== "success") {
    const intake = createBatchMaterializationBlockedIntakeState(materializationResult);
    return {
      state: projectStateWithBatchIntake(input.state, intake),
      result: {
        status: "failed",
        stage: "materialization",
        selectedLayerNodeRefs,
        latestSessionPersistenceResult: null
      }
    };
  }

  const preflightOutcome = await preflightMaterializationBatchOperation({
    adapter: input.adapter,
    state: input.state,
    command: input.command,
    parsedBridgeResult,
    materializationResult,
    currentPsdFile,
    sourceAssetId,
    ...(input.now === undefined ? {} : { now: input.now })
  });
  if (preflightOutcome.status === "rejected") {
    return {
      state: projectStateWithBatchIntake(input.state, preflightOutcome.intake),
      result: {
        status: "rejected",
        stage: preflightOutcome.stage,
        selectedLayerNodeRefs,
        latestSessionPersistenceResult: null
      }
    };
  }

  const sourceImportOutcome = commitSourceMetadataIfMissing({
    adapter: input.adapter,
    state: input.state,
    parsedBridgeResult,
    materializationResult,
    currentPsdFile,
    sourceAssetId
  });
  if (sourceImportOutcome.status === "rejected") {
    return {
      state: projectStateWithBatchIntake(sourceImportOutcome.state, sourceImportOutcome.intake),
      result: {
        status: "rejected",
        stage: "sourceImport",
        selectedLayerNodeRefs,
        latestSessionPersistenceResult: sourceImportOutcome.result
      }
    };
  }

  const materializationOperation = await commitMaterializationBatchOperation({
    adapter: input.adapter,
    command: input.command,
    materializationResult,
    sourceAssetId
  });
  const operationState = applyEditorWorkflowCommitResult(
    sourceImportOutcome.state,
    input.adapter,
    materializationOperation.result
  );
  if (materializationOperation.result.operationResult.status !== "committed") {
    const intake = createOperationRejectedBatchIntakeState({
      stage: "operationCommit",
      result: materializationOperation.result,
      materializationResult
    });

    return {
      state: projectStateWithBatchIntake(operationState, intake),
      result: {
        status: "rejected",
        stage: "operationCommit",
        selectedLayerNodeRefs,
        latestSessionPersistenceResult: materializationOperation.result
      }
    };
  }

  const persistentStoreResults = await storeMaterializedTextureBatchBytes({
    persistentByteStore: input.persistentByteStore,
    result: materializationOperation.result,
    entries: materializationOperation.entries,
    ...(input.now === undefined ? {} : { now: input.now })
  });
  const intake = createCommittedBatchIntakeState({
    result: materializationOperation.result,
    materializationResult,
    persistentStoreResults
  });

  return {
    state: projectStateWithBatchIntake(operationState, intake),
    result: {
      status: "committed",
      stage: "operationCommit",
      selectedLayerNodeRefs,
      latestSessionPersistenceResult: materializationOperation.result,
      persistentStoreResults
    }
  };
};

export const preflightEditorSelectedPsdLayerBatchIntakeWorkflow = async (
  input: EditorExplicitPsdLayerBatchIntakeWorkflowInput
): Promise<EditorExplicitPsdLayerBatchIntakePreflightOutcome> => {
  const selectedLayerNodeRefs = resolveSelectedLayerNodeRefs(input);
  const currentSourceFailure = validateCurrentSource(input, selectedLayerNodeRefs);
  if (currentSourceFailure !== null) {
    return {
      state: projectStateWithBatchIntake(input.state, currentSourceFailure),
      result: {
        status: "failed",
        stage: "currentSource",
        selectedLayerNodeRefs
      }
    };
  }

  const parsedBridgeResult = input.parsedBridgeResult;
  const currentPsdFile = input.currentPsdFile;
  if (parsedBridgeResult?.status !== "parsed" || currentPsdFile === undefined) {
    throw new Error("Expected current source validation to reject missing parsed PSD state.");
  }

  const sourceAssetId = createExplicitPsdSourceAssetId(currentPsdFile);
  const materialize =
    input.materializeSelectedLayers ?? materializeSelectedPsdLayersFromBrowserFile;
  const materializationResult = await materialize({
    file: currentPsdFile,
    selectedLayerNodeRefs,
    sourceAssetId
  });

  if (materializationResult.status !== "success") {
    const intake = createBatchMaterializationBlockedIntakeState(materializationResult);
    return {
      state: projectStateWithBatchIntake(input.state, intake),
      result: {
        status: "failed",
        stage: "materialization",
        selectedLayerNodeRefs
      }
    };
  }

  const preflightOutcome = await preflightMaterializationBatchOperation({
    adapter: input.adapter,
    state: input.state,
    command: input.command,
    parsedBridgeResult,
    materializationResult,
    currentPsdFile,
    sourceAssetId,
    ...(input.now === undefined ? {} : { now: input.now })
  });
  if (preflightOutcome.status === "rejected") {
    return {
      state: projectStateWithBatchIntake(input.state, preflightOutcome.intake),
      result: {
        status: "rejected",
        stage: preflightOutcome.stage,
        selectedLayerNodeRefs,
        ...(preflightOutcome.operationResult === undefined
          ? {}
          : { operationResult: preflightOutcome.operationResult })
      }
    };
  }

  return {
    state: input.state,
    result: {
      status: "dry_run",
      stage: "operationCommit",
      selectedLayerNodeRefs,
      operationResult: preflightOutcome.operationResult
    }
  };
};

const resolveSelectedLayerNodeRefs = (
  input: Pick<EditorExplicitPsdLayerBatchIntakeWorkflowInput, "command" | "state">
): readonly string[] => {
  const refs = input.command.selectedLayerNodeRefs ?? input.state.explicitPsdImport.selectedLayerNodeRefs;
  return refs.map((ref) => ref.trim()).filter((ref) => ref.length > 0);
};

const validateCurrentSource = (
  input: EditorExplicitPsdLayerBatchIntakeWorkflowInput,
  selectedLayerNodeRefs: readonly string[]
): ExplicitPsdLayerBatchIntakeState | null => {
  if (selectedLayerNodeRefs.length === 0) {
    return createFailedBatchIntakeState({
      checkId: "editor.explicitPsdLayerBatchIntake.missingSelectedLayers",
      message: "Select one or more PSD leaf layers before adding generated parts."
    });
  }

  if (input.command.destinationParentPartId.trim().length === 0) {
    return createFailedBatchIntakeState({
      checkId: "editor.explicitPsdLayerBatchIntake.missingDestinationParentPart",
      message: "Choose a destination parent part before adding generated part scaffolds."
    });
  }

  if (input.currentPsdFile === undefined || input.parsedBridgeResult === undefined) {
    return createFailedBatchIntakeState({
      checkId: "editor.explicitPsdLayerBatchIntake.missingCurrentSource",
      message: "Current PSD source bytes are unavailable; re-parse the PSD file before adding selected leaf layers."
    });
  }

  if (input.parsedBridgeResult.status !== "parsed" || input.state.explicitPsdImport.status !== "parsed") {
    return createFailedBatchIntakeState({
      checkId: "editor.explicitPsdLayerBatchIntake.sourceNotParsed",
      message: "The selected PSD has not produced a parsed leaf layer tree in the current browser session."
    });
  }

  const source = input.state.explicitPsdImport.source;
  if (
    source !== null &&
    (source.fileName !== input.currentPsdFile.name || source.byteLength !== input.currentPsdFile.size)
  ) {
    return createFailedBatchIntakeState({
      checkId: "editor.explicitPsdLayerBatchIntake.staleCurrentSource",
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
      readonly result: EditorSessionPersistenceResult;
      readonly intake: ExplicitPsdLayerBatchIntakeState;
    };

const commitSourceMetadataIfMissing = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly parsedBridgeResult: Extract<BrowserPsdParserBridgeResult, { readonly status: "parsed" }>;
  readonly materializationResult: SelectedPsdLayerBatchMaterializationResult;
  readonly currentPsdFile: File;
  readonly sourceAssetId: string;
}): SourceMetadataImportOutcome => {
  if (
    input.adapter.authoringSession.graph.sourceAssets.some(
      (sourceAsset) => sourceAsset.sourceAssetId === input.sourceAssetId
    )
  ) {
    return {
      status: "skipped-existing",
      state: input.state,
      result: null
    };
  }

  const materializations = collectMaterializedEntries(input.materializationResult).map((entry) =>
    createOperationMaterializationEvidence({
      candidate: entry.candidate,
      sourceAssetId: input.sourceAssetId,
      sourceFilePath: createPsdSourcePackagePath(input.currentPsdFile),
      binaryAssetRef: undefined,
      textureId: undefined
    })
  );
  const request = createImportPsdSourceAssetOperationRequest(
    {
      operationId: createSourceImportOperationId({
        sourceAssetId: input.sourceAssetId,
        packageRevision: input.adapter.authoringSession.packageRevision
      }),
      sourceAssetId: input.sourceAssetId,
      fileRef: {
        packageRelativePath: createPsdSourcePackagePath(input.currentPsdFile),
        contentHash: `sha256:${collectMaterializedEntries(input.materializationResult)[0]?.candidate.evidence.sourcePsd.digest.hex ?? "0".repeat(64)}`
      },
      adapterResult: createSourceAdapterResult({
        adapterResult: input.parsedBridgeResult.adapterResult,
        materializations
      }),
      rights: {
        creator: "explicit-psd-import",
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
      intake: createOperationRejectedBatchIntakeState({
        stage: "sourceImport",
        result,
        materializationResult: input.materializationResult
      })
    };
  }

  return {
    status: "committed",
    state,
    result
  };
};

type BatchOperationPreflightOutcome =
  | {
      readonly status: "accepted";
      readonly operationResult: OperationResultDto;
    }
  | {
      readonly status: "rejected";
      readonly stage: "sourceImport" | "operationCommit";
      readonly intake: ExplicitPsdLayerBatchIntakeState;
      readonly operationResult?: OperationResultDto;
    };

const preflightMaterializationBatchOperation = async (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: EditorExplicitPsdLayerBatchIntakeCommand;
  readonly parsedBridgeResult: Extract<BrowserPsdParserBridgeResult, { readonly status: "parsed" }>;
  readonly materializationResult: SelectedPsdLayerBatchMaterializationResult;
  readonly currentPsdFile: File;
  readonly sourceAssetId: string;
  readonly now?: () => Date;
}): Promise<BatchOperationPreflightOutcome> => {
  const snapshot = input.adapter.createPersistenceSnapshot();
  const preflightAdapter = createEditorSessionAdapter({
    packageDocument: snapshot.document,
    initialOperationLogEntries: snapshot.operationLogEntries,
    ...(input.now === undefined ? {} : { now: input.now })
  });
  const sourceImportOutcome = commitSourceMetadataIfMissing({
    adapter: preflightAdapter,
    state: input.state,
    parsedBridgeResult: input.parsedBridgeResult,
    materializationResult: input.materializationResult,
    currentPsdFile: input.currentPsdFile,
    sourceAssetId: input.sourceAssetId
  });
  if (sourceImportOutcome.status === "rejected") {
    return {
      status: "rejected",
      stage: "sourceImport",
      intake: sourceImportOutcome.intake,
      operationResult: sourceImportOutcome.result.operationResult
    };
  }

  const preparedOperation = await prepareMaterializationBatchOperation({
    adapter: preflightAdapter,
    command: input.command,
    materializationResult: input.materializationResult,
    sourceAssetId: input.sourceAssetId
  });
  const preflightResult = preflightAdapter.dryRunOperation({
    ...preparedOperation.request,
    dryRun: true
  });

  if (preflightResult.status !== "dry_run") {
    return {
      status: "rejected",
      stage: "operationCommit",
      operationResult: preflightResult,
      intake: createOperationResultRejectedBatchIntakeState({
        stage: "operationCommit",
        result: preflightResult,
        materializationResult: input.materializationResult
      })
    };
  }

  return { status: "accepted", operationResult: preflightResult };
};

const commitMaterializationBatchOperation = async (input: {
  readonly adapter: EditorSessionAdapter;
  readonly command: EditorExplicitPsdLayerBatchIntakeCommand;
  readonly materializationResult: SelectedPsdLayerBatchMaterializationResult;
  readonly sourceAssetId: string;
}): Promise<{
  readonly result: EditorSessionPersistenceResult;
  readonly entries: readonly RegisteredBatchEntry[];
}> => {
  const preparedOperation = await prepareMaterializationBatchOperation(input);

  return {
    result: input.adapter.commitImportPsdLayerMaterializationBatchWithBinaryBytes({
      request: preparedOperation.request,
      entries: preparedOperation.entries.map((entry) => ({
        bytes: entry.materializationEntry.candidate.bytes,
        registration: entry.registration
      }))
    }),
    entries: preparedOperation.entries
  };
};

const prepareMaterializationBatchOperation = async (input: {
  readonly adapter: EditorSessionAdapter;
  readonly command: EditorExplicitPsdLayerBatchIntakeCommand;
  readonly materializationResult: SelectedPsdLayerBatchMaterializationResult;
  readonly sourceAssetId: string;
}): Promise<PreparedBatchOperation> => {
  const operationId = createLayerMaterializationBatchOperationId({
    batchId: input.materializationResult.batchId,
    packageRevision: input.adapter.authoringSession.packageRevision
  });
  const materializedEntries = collectMaterializedEntries(input.materializationResult);
  const entries = await Promise.all(
    materializedEntries.map(async (entry, index): Promise<RegisteredBatchEntry> => {
      const generated = createGeneratedBatchTargets(entry.candidate.evidence);
      const childOperationId = createBatchChildOperationId({
        operationId,
        selectedIndex: index,
        partId: generated.partId
      });
      const registration = await createEditorSelectedPsdLayerBinaryByteRegistration({
        operationId: childOperationId,
        sourceAssetId: input.sourceAssetId,
        textureId: generated.textureId,
        sourceLayerId: entry.candidate.evidence.sourceLayer.sourceLayerId,
        materializedDigest: entry.candidate.evidence.digest,
        mediaType: entry.candidate.evidence.mediaType,
        bytes: entry.candidate.bytes
      });
      const materialization = createOperationMaterializationEvidence({
        candidate: entry.candidate,
        sourceAssetId: input.sourceAssetId,
        sourceFilePath: createPsdSourcePackagePath(entry.candidate.evidence.sourcePsd),
        binaryAssetRef: registration.binaryAssetRef,
        textureId: generated.textureId
      });

      return {
        materializationEntry: entry,
        registration,
        materialization,
        textureId: generated.textureId
      };
    })
  );
  const request = createImportPsdLayerMaterializationBatchOperationRequest(
    {
      operationId,
      sourceAssetId: input.sourceAssetId,
      batchId: input.materializationResult.batchId,
      destinationParentPartId: input.command.destinationParentPartId.trim(),
      ...(input.command.importPlanBridge === undefined
        ? {}
        : { importPlanBridge: input.command.importPlanBridge }),
      entries: entries.map((entry) => ({
        materialization: entry.materialization
      })),
      lockedTargetIds: []
    },
    input.adapter.authoringSession.packageRevision
  );
  if (request.operationType !== "importPsdLayerMaterializationBatch") {
    throw new Error("Expected importPsdLayerMaterializationBatch request.");
  }

  return {
    request,
    entries
  };
};

const createOperationMaterializationEvidence = (input: {
  readonly candidate: SelectedPsdLayerMaterializedAssetCandidate;
  readonly sourceAssetId: string;
  readonly sourceFilePath: string;
  readonly binaryAssetRef: PsdAdapterLayerMaterializationEvidenceDto["binaryAssetRef"] | undefined;
  readonly textureId: string | undefined;
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
    ...(input.binaryAssetRef === undefined ? {} : { binaryAssetRef: input.binaryAssetRef }),
    ...(input.textureId === undefined ? {} : { textureId: input.textureId }),
    provenance: {
      sourceFilePath: input.sourceFilePath,
      sourceDigest: input.candidate.evidence.sourcePsd.digest,
      sourceByteLength: input.candidate.evidence.sourcePsd.byteLength,
      ...(input.candidate.evidence.sourcePsd.declaredMediaType === undefined
        ? {}
        : { sourceMediaType: input.candidate.evidence.sourcePsd.declaredMediaType }),
      privacyLabel: "packageLocalAsset",
      publicDistribution: "notPublicDistributable",
      derivedArtifactPath: input.binaryAssetRef?.packageRelativePath,
      generatedBy: "wave47-editor-selected-leaf-layer-batch-intake",
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

const storeMaterializedTextureBatchBytes = async (input: {
  readonly persistentByteStore: EditorPersistentByteStore;
  readonly result: EditorSessionPersistenceResult;
  readonly entries: readonly RegisteredBatchEntry[];
  readonly now?: () => Date;
}): Promise<readonly EditorBatchPersistentStoreResult[]> => {
  const owners = collectEditorPersistentBinaryOwners(input.result.reloadedDocument);
  const results: EditorBatchPersistentStoreResult[] = [];

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

const createCommittedBatchIntakeState = (input: {
  readonly result: EditorSessionPersistenceResult;
  readonly materializationResult: SelectedPsdLayerBatchMaterializationResult;
  readonly persistentStoreResults: readonly EditorBatchPersistentStoreResult[];
}): ExplicitPsdLayerBatchIntakeState => {
  const evidence = input.result.operationResult.psdLayerMaterializationBatchEvidence?.[0];
  if (evidence === undefined) {
    return createFailedBatchIntakeState({
      checkId: "editor.explicitPsdLayerBatchIntake.missingOperationEvidence",
      message: "Committed selected leaf layer batch did not return batch materialization operation evidence."
    });
  }

  return {
    status: "committed",
    summaryFacts: [
      { label: "Batch id", value: evidence.batchId },
      { label: "Batch evidence id", value: evidence.evidenceId ?? "not returned" },
      { label: "Aggregate status", value: evidence.aggregateStatus },
      { label: "Batch operation id", value: evidence.operationId ?? input.result.operationResult.operationId },
      { label: "Per-leaf operation ids", value: evidence.perLayerOperationIds.join(", ") || "none" },
      { label: "Batch issues", value: formatImportPlanIssueSummary(evidence.issues) },
      {
        label: "Requested / success / failure",
        value: `${evidence.selectedLayerCount} / ${evidence.successCount} / ${evidence.failureCount}`
      },
      {
        label: "Materialization requested / success / failure",
        value: `${input.materializationResult.summary.requestedCount} / ${input.materializationResult.summary.successCount} / ${input.materializationResult.summary.failureCount}`
      },
      { label: "Destination parent part", value: evidence.destination.parentPartId },
      { label: "Destination kind", value: evidence.destination.destinationKind },
      { label: "Total materialized byte length", value: formatByteLength(evidence.totalMaterializedByteLength) },
      {
        label: "Provenance",
        value: "private/local / notPublicDistributable / publicDemoAsset=false"
      },
      ...(evidence.importPlanBridge === undefined
        ? []
        : [
            { label: "Import plan id", value: evidence.importPlanBridge.candidatePlan.planId },
            {
              label: "Import plan digest",
              value: `sha256:${evidence.importPlanBridge.candidatePlan.candidatePlanDigest.hex}`
            },
            { label: "Import plan approval", value: evidence.importPlanBridge.approval.approvalId },
            {
              label: "Import plan approval issues",
              value: formatImportPlanIssueSummary(evidence.importPlanBridge.approval.issues ?? [])
            },
            {
              label: "Approved leaf candidates",
              value: String(evidence.importPlanBridge.approval.approvedLeafRefs.length)
            },
            {
              label: "Not-approved / blocked candidates",
              value: [
                evidence.importPlanBridge.approval.collisionPreflight.notApprovedCandidateCount,
                evidence.importPlanBridge.approval.collisionPreflight.blockedCandidateCount
              ].join(" / ")
            }
          ]),
      {
        label: "Persistence",
        value: [
          evidence.persistenceBoundary.materializedLayerBytePersistence,
          `browserLocalStore=${formatBatchPersistentStoreResults(input.persistentStoreResults)}`
        ].join(" / ")
      }
    ],
    entryLabels: evidence.entries.map((entry) =>
      [
        entry.status,
        `#${entry.selectedIndex}`,
        entry.sourceLayerRef.sourceLayerId,
        entry.sourceLayerRef.sourceLayerPath?.join(" / ") ?? entry.sourceLayerRef.sourceLayerName,
        entry.approvalOrder === undefined ? "approvalOrder=none" : `approvalOrder=${entry.approvalOrder}`,
        entry.resultRefs?.batchEvidenceId === undefined
          ? "batchEvidence=none"
          : `batchEvidence=${entry.resultRefs.batchEvidenceId}`,
        entry.resultRefs?.materializationEvidenceId === undefined
          ? "materializationEvidence=none"
          : `materializationEvidence=${entry.resultRefs.materializationEvidenceId}`,
        `materialization=${entry.resultRefs?.materializationId ?? entry.materializationId}`,
        `part=${entry.generated.partId}`,
        `drawable=${entry.generated.drawableId}`,
        `texture=${entry.generated.textureId}`,
        `mesh=${entry.generated.meshId}`,
        `bytes=${entry.materializedByteLength}`,
        entry.operationId === undefined ? "operation=none" : `operation=${entry.operationId}`,
        `issues=${formatImportPlanIssueSummary(entry.issues)}`,
        "publicDemoAsset=false"
      ].filter((value): value is string => value !== undefined && value.length > 0).join(" / ")
    ),
    diagnostics: createCommittedDiagnostics(input.persistentStoreResults)
  };
};

const createBatchMaterializationBlockedIntakeState = (
  result: SelectedPsdLayerBatchMaterializationResult
): ExplicitPsdLayerBatchIntakeState => ({
  status: "failed",
  summaryFacts: createMaterializationSummaryFacts(result),
  entryLabels: result.entries.map(formatMaterializationEntryLabel),
  diagnostics: [
    ...result.diagnostics.map((diagnostic) => ({
      checkId: diagnostic.checkId,
      severity: diagnostic.severity,
      message: `${diagnostic.message} ${diagnostic.evidence.join(" / ")}`
    })),
    ...result.entries.flatMap((entry) =>
      entry.status === "failed"
        ? [{
            checkId: `selectedPsdLayer.batchMaterialization.failure.${entry.failure.failureKind}`,
            severity: entry.failure.severity,
            message: `${entry.failure.message} ${entry.failure.checks.join(" / ")}`
          }]
        : []
    )
  ]
});

const createOperationRejectedBatchIntakeState = (input: {
  readonly stage: "sourceImport" | "operationCommit";
  readonly result: EditorSessionPersistenceResult;
  readonly materializationResult: SelectedPsdLayerBatchMaterializationResult;
}): ExplicitPsdLayerBatchIntakeState =>
  createOperationResultRejectedBatchIntakeState({
    stage: input.stage,
    result: input.result.operationResult,
    materializationResult: input.materializationResult
  });

const createOperationResultRejectedBatchIntakeState = (input: {
  readonly stage: "sourceImport" | "operationCommit";
  readonly result: OperationResultDto;
  readonly materializationResult: SelectedPsdLayerBatchMaterializationResult;
}): ExplicitPsdLayerBatchIntakeState => {
  const evidence = input.result.psdLayerMaterializationBatchEvidence?.[0];

  return {
    status: "rejected",
    summaryFacts: [
      { label: "Rejected stage", value: input.stage },
      ...createMaterializationSummaryFacts(input.materializationResult),
      ...(evidence === undefined
        ? [{ label: "Batch operation evidence", value: "not returned" }]
        : [
            { label: "Batch id", value: evidence.batchId },
            { label: "Batch evidence id", value: evidence.evidenceId ?? "not returned" },
            { label: "Aggregate status", value: evidence.aggregateStatus },
            { label: "Batch operation id", value: evidence.operationId ?? input.result.operationId },
            { label: "Destination parent part", value: evidence.destination.parentPartId },
            { label: "Batch issues", value: formatImportPlanIssueSummary(evidence.issues) },
            {
              label: "Operation requested / success / failure",
              value: `${evidence.selectedLayerCount} / ${evidence.successCount} / ${evidence.failureCount}`
            }
          ])
    ],
    entryLabels: evidence === undefined
      ? input.materializationResult.entries.map(formatMaterializationEntryLabel)
      : evidence.entries.map((entry) =>
          [
            entry.status,
            `#${entry.selectedIndex}`,
            entry.sourceLayerRef.sourceLayerId,
            entry.approvalOrder === undefined ? "approvalOrder=none" : `approvalOrder=${entry.approvalOrder}`,
            entry.resultRefs?.batchEvidenceId === undefined
              ? "batchEvidence=none"
              : `batchEvidence=${entry.resultRefs.batchEvidenceId}`,
            entry.resultRefs?.materializationEvidenceId === undefined
              ? "materializationEvidence=none"
              : `materializationEvidence=${entry.resultRefs.materializationEvidenceId}`,
            `materialization=${entry.resultRefs?.materializationId ?? entry.materializationId}`,
            `part=${entry.generated.partId}`,
            `drawable=${entry.generated.drawableId}`,
            `texture=${entry.generated.textureId}`,
            `mesh=${entry.generated.meshId}`,
            entry.diagnostics.length === 0
              ? "diagnostics=none"
              : `diagnostics=${entry.diagnostics.map((diagnostic) => diagnostic.checkId).join(",")}`,
            `issues=${formatImportPlanIssueSummary(entry.issues)}`,
            "publicDemoAsset=false"
          ].join(" / ")
        ),
    diagnostics: collectOperationResultDiagnostics(input.result)
  };
};

const createMaterializationSummaryFacts = (
  result: SelectedPsdLayerBatchMaterializationResult
): readonly { readonly label: string; readonly value: string }[] => [
  { label: "Batch id", value: result.batchId },
  { label: "Batch status", value: result.status },
  {
    label: "Requested / success / failure",
    value: `${result.summary.requestedCount} / ${result.summary.successCount} / ${result.summary.failureCount}`
  },
  { label: "Duplicate selections", value: String(result.summary.duplicateSelectionCount) },
  { label: "Unsupported or group selections", value: String(result.summary.unsupportedLayerTypeCount) },
  { label: "Missing current source bytes", value: String(result.summary.missingCurrentSourceBytesCount) },
  { label: "Stale source", value: String(result.summary.staleSourceCount) },
  { label: "Materialization failures", value: String(result.summary.materializationFailureCount) },
  { label: "Accepted raw RGBA bytes", value: formatByteLength(result.summary.acceptedRawRgbaByteLength) },
  { label: "Max selected leaf layers", value: String(result.summary.maxSelectedLayerCount) },
  { label: "Max total raw RGBA bytes", value: formatByteLength(result.summary.maxTotalRawRgbaBytes) },
  { label: "Provenance", value: "private/local / publicDemoAsset=false" },
  {
    label: "Mutation",
    value: result.status === "success"
      ? "ready for generated part scaffold operation"
      : "not committed because selected leaf layer batch materialization did not fully succeed"
  }
];

const formatMaterializationEntryLabel = (
  entry: SelectedPsdLayerBatchMaterializationEntry
): string => {
  if (entry.status === "materialized") {
    const evidence = entry.candidate.evidence;
    return [
      "materialized",
      `#${entry.requestIndex}`,
      entry.selectedLayerNodeRef,
      evidence.sourceLayer.sourceLayerPath.join(" / ") || evidence.sourceLayer.originalName,
      `sha256:${evidence.digest.hex}`,
      formatByteLength(evidence.byteLength),
      evidence.mediaType,
      "private/local",
      "publicDemoAsset=false",
      "not committed"
    ].join(" / ");
  }

  return [
    "failed",
    `#${entry.requestIndex}`,
    entry.selectedLayerNodeRef,
    entry.failure.failureKind,
    entry.failure.message,
    entry.failure.checks.join(" / "),
    `${entry.failure.provenance.privacyLabel} / publicDemoAsset=${String(entry.failure.provenance.publicDemoAsset)}`
  ].join(" / ");
};

const createFailedBatchIntakeState = (input: {
  readonly checkId: string;
  readonly message: string;
}): ExplicitPsdLayerBatchIntakeState => ({
  status: "failed",
  summaryFacts: [{ label: "Failure", value: input.message }],
  entryLabels: [],
  diagnostics: [{
    checkId: input.checkId,
    severity: "error",
    message: input.message
  }]
});

const projectStateWithBatchIntake = (
  state: EditorSemanticState,
  selectedLayerBatchIntake: ExplicitPsdLayerBatchIntakeState
): EditorSemanticState => ({
  ...state,
  explicitPsdImport: {
    ...state.explicitPsdImport,
    selectedLayerBatchIntake
  }
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

const createCommittedDiagnostics = (
  persistentStoreResults: readonly EditorBatchPersistentStoreResult[]
): readonly ExplicitPsdImportDiagnosticState[] => {
  const unavailable = persistentStoreResults.filter(isUnavailablePersistentStoreResult);
  const missingOwners = persistentStoreResults.filter(
    (entry) => entry.result === "skipped-missing-texture-owner"
  );

  if (missingOwners.length > 0) {
    return missingOwners.map((entry) => ({
      checkId: "editor.explicitPsdLayerBatchIntake.persistentTextureOwnerMissing",
      severity: "warning",
      message: `Materialized bytes for ${entry.textureId} were package-local in the current session, but no texture owner was found for browser-local byte storage.`
    }));
  }

  if (unavailable.length > 0) {
    return unavailable.map((entry) => ({
      checkId: "editor.explicitPsdLayerBatchIntake.browserLocalByteStoreUnavailable",
      severity: "warning",
      message: entry.result.message
    }));
  }

  return [{
    checkId: "editor.explicitPsdLayerBatchIntake.committed",
    severity: "info",
    message: "Selected PSD leaf layer materialized bytes were added as private/local generated part texture assets."
  }];
};

const isUnavailablePersistentStoreResult = (
  entry: EditorBatchPersistentStoreResult
): entry is {
  readonly textureId: string;
  readonly result: Extract<EditorPersistentByteStorePutResult, { readonly status: "unavailable" }>;
} => entry.result !== "skipped-missing-texture-owner" && entry.result.status === "unavailable";

const formatBatchPersistentStoreResults = (
  results: readonly EditorBatchPersistentStoreResult[]
): string =>
  results.map((entry) => {
    if (entry.result === "skipped-missing-texture-owner") {
      return `${entry.textureId}=skipped-missing-texture-owner`;
    }

    return entry.result.status === "stored"
      ? `${entry.textureId}=stored:${entry.result.storageBackend}`
      : `${entry.textureId}=unavailable:${entry.result.storageBackendState}`;
  }).join(", ");

const formatImportPlanIssueSummary = (
  issues: readonly PsdImportPlanIssueDto[]
): string =>
  issues.length === 0
    ? "none"
    : issues.map(formatImportPlanIssue).join(" | ");

const formatImportPlanIssue = (
  issue: PsdImportPlanIssueDto
): string =>
  [
    issue.issueId ?? issue.issueKind,
    issue.issueKind,
    issue.checkId,
    issue.sourceLayerRef?.sourceLayerId,
    issue.selectedIndex === undefined ? undefined : `selectedIndex=${issue.selectedIndex}`,
    issue.approvalOrder === undefined ? undefined : `approvalOrder=${issue.approvalOrder}`,
    issue.targetPath,
    issue.message
  ].filter((value): value is string => value !== undefined && value.length > 0).join(":");

const collectMaterializedEntries = (
  result: SelectedPsdLayerBatchMaterializationResult
): readonly SelectedPsdLayerBatchMaterializationSuccessEntry[] =>
  result.entries.filter(
    (entry): entry is SelectedPsdLayerBatchMaterializationSuccessEntry =>
      entry.status === "materialized"
  );

const createGeneratedBatchTargets = (
  evidence: SelectedPsdLayerMaterializedAssetCandidate["evidence"]
): {
  readonly partId: string;
  readonly drawableId: string;
  readonly textureId: string;
  readonly meshId: string;
} => {
  const displayName = createLayerPathDisplayName(evidence);
  const drawableId = createDrawableIdFromDisplayName(displayName);

  return {
    partId: createPartIdFromDisplayName(displayName),
    drawableId,
    textureId: createTextureIdFromDrawableId(drawableId),
    meshId: createMeshIdFromDrawableId(drawableId)
  };
};

const createLayerPathDisplayName = (
  evidence: SelectedPsdLayerMaterializedAssetCandidate["evidence"]
): string => {
  const path = evidence.sourceLayer.sourceLayerPath.filter((segment) => segment.trim().length > 0);
  if (path.length > 0) {
    return path.join(" / ");
  }

  return evidence.sourceLayer.originalName || evidence.sourceLayer.sourceLayerId;
};

const createSourceImportOperationId = (input: {
  readonly sourceAssetId: string;
  readonly packageRevision: number;
}): string =>
  `op_editor_import_explicit_psd_source_${sanitizePsdImportIdToken(input.sourceAssetId)}_r${input.packageRevision}`;

const createLayerMaterializationBatchOperationId = (input: {
  readonly batchId: string;
  readonly packageRevision: number;
}): string =>
  `op_editor_import_psd_layer_batch_${sanitizePsdImportIdToken(input.batchId)}_r${input.packageRevision}`;

const createBatchChildOperationId = (input: {
  readonly operationId: string;
  readonly selectedIndex: number;
  readonly partId: string;
}): string =>
  `op_${sanitizePsdImportIdToken(`${stripIdPrefix(input.operationId, "op_")}_${input.selectedIndex}_${stripIdPrefix(input.partId, "part_")}`)}`;

const stripIdPrefix = (value: string, prefix: string): string =>
  value.startsWith(prefix) ? value.slice(prefix.length) : value;

const formatByteLength = (byteLength: number): string =>
  `${byteLength} byte${byteLength === 1 ? "" : "s"}`;
