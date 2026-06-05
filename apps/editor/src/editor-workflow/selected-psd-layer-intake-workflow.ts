import {
  createDrawableIdFromDisplayName,
  createMeshIdFromDrawableId,
  createTextureIdFromDrawableId,
  PsdAdapterLayerMaterializationEvidenceSchema,
  type PsdAdapterLayerMaterializationEvidenceDto,
  type PsdAdapterResultDto,
  type PsdLayerMaterializationDestinationPartDto
} from "@private-2d-rigging-lab/operation-core";

import type {
  EditorPersistentByteStore,
  EditorPersistentByteStorePutResult,
  EditorSessionAdapter,
  EditorSessionPersistenceResult
} from "../editor-session/index.js";
import {
  collectEditorPersistentBinaryOwners,
  createEditorSelectedPsdLayerBinaryByteRegistration,
  createImportPsdLayerMaterializationOperationRequest,
  createImportPsdSourceAssetOperationRequest,
  storeEditorPersistentBinaryOwnerBytes
} from "../editor-session/index.js";
import type {
  EditorSemanticState,
  ExplicitPsdImportDiagnosticState,
  ExplicitPsdLayerIntakeState
} from "../editor-state/index.js";
import { applyEditorWorkflowCommitResult } from "./workflow-state-projection.js";
import type { BrowserPsdParserBridgeResult } from "./browser-psd-parser-bridge-result.js";
import {
  materializeSelectedPsdLayerFromBrowserFile,
  type SelectedPsdLayerFileMaterializationInput
} from "./selected-psd-layer-materialization-service.js";
import type {
  SelectedPsdLayerMaterializationFailureResult,
  SelectedPsdLayerMaterializationResult,
  SelectedPsdLayerMaterializationSuccessResult,
  SelectedPsdLayerMaterializedAssetCandidate
} from "./selected-psd-layer-materialization-result.js";

export type EditorPsdLayerIntakeDestinationPart =
  | {
      readonly destinationKind: "existingPart";
      readonly partId: string;
    }
  | {
      readonly destinationKind: "newPart";
      readonly displayName: string;
      readonly partId?: string;
      readonly parentPartId?: string;
    };

export interface EditorExplicitPsdLayerIntakeCommand {
  readonly selectedLayerNodeRef?: string;
  readonly destinationPart: EditorPsdLayerIntakeDestinationPart;
  readonly drawableDisplayName?: string;
}

export type EditorExplicitPsdLayerIntakeResultStatus =
  | "committed"
  | "rejected"
  | "failed";

export interface EditorExplicitPsdLayerIntakeResult {
  readonly status: EditorExplicitPsdLayerIntakeResultStatus;
  readonly stage:
    | "currentSource"
    | "materialization"
    | "sourceImport"
    | "operationCommit";
  readonly selectedLayerNodeRef: string;
  readonly latestSessionPersistenceResult: EditorSessionPersistenceResult | null;
  readonly persistentStoreResult?: EditorPersistentByteStorePutResult | "skipped-missing-texture-owner";
}

export interface EditorExplicitPsdLayerIntakeWorkflowOutcome {
  readonly state: EditorSemanticState;
  readonly result: EditorExplicitPsdLayerIntakeResult;
}

export interface EditorExplicitPsdLayerIntakeWorkflowInput {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: EditorExplicitPsdLayerIntakeCommand;
  readonly currentPsdFile?: File;
  readonly parsedBridgeResult?: BrowserPsdParserBridgeResult;
  readonly persistentByteStore: EditorPersistentByteStore;
  readonly now?: () => Date;
  readonly materializeSelectedLayer?: (
    input: SelectedPsdLayerFileMaterializationInput
  ) => Promise<SelectedPsdLayerMaterializationResult>;
}

export const commitEditorSelectedPsdLayerIntakeWorkflow = async (
  input: EditorExplicitPsdLayerIntakeWorkflowInput
): Promise<EditorExplicitPsdLayerIntakeWorkflowOutcome> => {
  const selectedLayerNodeRef = resolveSelectedLayerNodeRef(input);
  const currentSourceFailure = validateCurrentSource(input, selectedLayerNodeRef);
  if (currentSourceFailure !== null) {
    return {
      state: projectStateWithIntake(input.state, currentSourceFailure),
      result: {
        status: "failed",
        stage: "currentSource",
        selectedLayerNodeRef,
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
    input.materializeSelectedLayer ?? materializeSelectedPsdLayerFromBrowserFile;
  const materializationResult = await materialize({
    file: currentPsdFile,
    selectedLayerNodeRef,
    sourceAssetId
  });

  if (materializationResult.status === "failed") {
    const intake = createMaterializationFailureIntakeState(materializationResult);
    return {
      state: projectStateWithIntake(input.state, intake),
      result: {
        status: "failed",
        stage: "materialization",
        selectedLayerNodeRef,
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
      state: projectStateWithIntake(sourceImportOutcome.state, sourceImportOutcome.intake),
      result: {
        status: "rejected",
        stage: "sourceImport",
        selectedLayerNodeRef,
        latestSessionPersistenceResult: sourceImportOutcome.result
      }
    };
  }

  const materializationOperation = await commitMaterializationOperation({
    adapter: input.adapter,
    state: sourceImportOutcome.state,
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
    const intake = createOperationRejectedIntakeState({
      stage: "operationCommit",
      result: materializationOperation.result,
      materializationResult
    });

    return {
      state: projectStateWithIntake(operationState, intake),
      result: {
        status: "rejected",
        stage: "operationCommit",
        selectedLayerNodeRef,
        latestSessionPersistenceResult: materializationOperation.result
      }
    };
  }

  const persistentStoreResult = await storeMaterializedTextureBytes({
    persistentByteStore: input.persistentByteStore,
    result: materializationOperation.result,
    textureId: materializationOperation.textureId,
    bytes: materializationResult.candidate.bytes,
    ...(input.now === undefined ? {} : { now: input.now })
  });
  const intake = createCommittedIntakeState({
    result: materializationOperation.result,
    materializationResult,
    persistentStoreResult
  });

  return {
    state: projectStateWithIntake(operationState, intake),
    result: {
      status: "committed",
      stage: "operationCommit",
      selectedLayerNodeRef,
      latestSessionPersistenceResult: materializationOperation.result,
      persistentStoreResult
    }
  };
};

const resolveSelectedLayerNodeRef = (
  input: Pick<EditorExplicitPsdLayerIntakeWorkflowInput, "command" | "state">
): string =>
  input.command.selectedLayerNodeRef?.trim() ||
  input.state.explicitPsdImport.selectedLayerNodeRef;

const validateCurrentSource = (
  input: EditorExplicitPsdLayerIntakeWorkflowInput,
  selectedLayerNodeRef: string
): ExplicitPsdLayerIntakeState | null => {
  if (selectedLayerNodeRef.trim().length === 0) {
    return createFailedIntakeState({
      checkId: "editor.explicitPsdLayerIntake.missingSelectedLayer",
      message: "Select one PSD layer before adding it to the project."
    });
  }

  if (input.currentPsdFile === undefined || input.parsedBridgeResult === undefined) {
    return createFailedIntakeState({
      checkId: "editor.explicitPsdLayerIntake.missingCurrentSource",
      message: "Current PSD source bytes are unavailable; re-parse the PSD file before adding a layer."
    });
  }

  if (input.parsedBridgeResult.status !== "parsed" || input.state.explicitPsdImport.status !== "parsed") {
    return createFailedIntakeState({
      checkId: "editor.explicitPsdLayerIntake.sourceNotParsed",
      message: "The selected PSD has not produced a parsed layer tree in the current browser session."
    });
  }

  const source = input.state.explicitPsdImport.source;
  if (
    source !== null &&
    (source.fileName !== input.currentPsdFile.name || source.byteLength !== input.currentPsdFile.size)
  ) {
    return createFailedIntakeState({
      checkId: "editor.explicitPsdLayerIntake.staleCurrentSource",
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
      readonly intake: ExplicitPsdLayerIntakeState;
    };

const commitSourceMetadataIfMissing = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly parsedBridgeResult: Extract<BrowserPsdParserBridgeResult, { readonly status: "parsed" }>;
  readonly materializationResult: SelectedPsdLayerMaterializationSuccessResult;
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

  const materialization = createOperationMaterializationEvidence({
    candidate: input.materializationResult.candidate,
    sourceAssetId: input.sourceAssetId,
    sourceFilePath: createPsdSourcePackagePath(input.currentPsdFile),
    binaryAssetRef: undefined,
    textureId: undefined
  });
  const request = createImportPsdSourceAssetOperationRequest(
    {
      operationId: createSourceImportOperationId({
        sourceAssetId: input.sourceAssetId,
        packageRevision: input.adapter.authoringSession.packageRevision
      }),
      sourceAssetId: input.sourceAssetId,
      fileRef: {
        packageRelativePath: createPsdSourcePackagePath(input.currentPsdFile),
        contentHash: `sha256:${input.materializationResult.candidate.evidence.sourcePsd.digest.hex}`
      },
      adapterResult: createSourceAdapterResult({
        adapterResult: input.parsedBridgeResult.adapterResult,
        materialization
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
      intake: createOperationRejectedIntakeState({
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

const commitMaterializationOperation = async (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: EditorExplicitPsdLayerIntakeCommand;
  readonly materializationResult: SelectedPsdLayerMaterializationSuccessResult;
  readonly sourceAssetId: string;
}): Promise<{
  readonly result: EditorSessionPersistenceResult;
  readonly textureId: string;
}> => {
  const candidate = input.materializationResult.candidate;
  const drawableDisplayName =
    input.command.drawableDisplayName?.trim() ||
    candidate.evidence.sourceLayer.originalName ||
    candidate.evidence.sourceLayer.sourceLayerId;
  const drawableId = createDrawableIdFromDisplayName(drawableDisplayName);
  const textureId = createTextureIdFromDrawableId(drawableId);
  const meshId = createMeshIdFromDrawableId(drawableId);
  const operationId = createLayerMaterializationOperationId({
    materializationId: candidate.evidence.materializationId,
    packageRevision: input.adapter.authoringSession.packageRevision
  });
  const registration = await createEditorSelectedPsdLayerBinaryByteRegistration({
    operationId,
    sourceAssetId: input.sourceAssetId,
    textureId,
    sourceLayerId: candidate.evidence.sourceLayer.sourceLayerId,
    materializedDigest: candidate.evidence.digest,
    mediaType: candidate.evidence.mediaType,
    bytes: candidate.bytes
  });
  const materialization = createOperationMaterializationEvidence({
    candidate,
    sourceAssetId: input.sourceAssetId,
    sourceFilePath: createPsdSourcePackagePath(candidate.evidence.sourcePsd),
    binaryAssetRef: registration.binaryAssetRef,
    textureId
  });
  const request = createImportPsdLayerMaterializationOperationRequest(
    {
      operationId,
      sourceAssetId: input.sourceAssetId,
      materialization,
      textureId,
      drawableId,
      meshId,
      drawableDisplayName,
      destinationPart: normalizeDestinationPart(input.command.destinationPart),
      lockedTargetIds: []
    },
    input.adapter.authoringSession.packageRevision
  );
  if (request.operationType !== "importPsdLayerMaterialization") {
    throw new Error("Expected importPsdLayerMaterialization request.");
  }

  return {
    result: input.adapter.commitImportPsdLayerMaterializationWithBinaryBytes({
      request,
      bytes: candidate.bytes,
      registration
    }),
    textureId
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
      generatedBy: "wave46-editor-selected-layer-intake",
      publicDemoAsset: false
    },
    parser: input.candidate.evidence.parser,
    extraction: createOperationExtractionEvidence(input.candidate)
  });

const createOperationExtractionEvidence = (
  candidate: SelectedPsdLayerMaterializedAssetCandidate
): PsdAdapterLayerMaterializationEvidenceDto["extraction"] => ({
  extractionKind: "selectedLayerRasterV1",
  optionsSchemaVersion: "psd-layer-extraction-options-v1",
  options: {
    channelOrder: "rgba",
    includeEffects: false,
    includeHiddenLayers: false,
    composeWithOtherLayers: false,
    layerSelection: candidate.evidence.sourceLayer.sourceLayerId,
    selectedNodeRef: candidate.evidence.extraction.options.selectedNodeRef,
    parserMethod: candidate.evidence.extraction.options.parserMethod,
    outputEncoding: candidate.evidence.extraction.options.outputEncoding,
    pixelFormat: candidate.evidence.extraction.options.pixelFormat
  }
});

const createSourceAdapterResult = (input: {
  readonly adapterResult: PsdAdapterResultDto;
  readonly materialization: PsdAdapterLayerMaterializationEvidenceDto;
}): PsdAdapterResultDto => ({
  ...input.adapterResult,
  materializationEvidence: [input.materialization]
});

const normalizeDestinationPart = (
  destinationPart: EditorPsdLayerIntakeDestinationPart
): PsdLayerMaterializationDestinationPartDto => {
  if (destinationPart.destinationKind === "existingPart") {
    return {
      destinationKind: "existingPart",
      partId: destinationPart.partId
    } as PsdLayerMaterializationDestinationPartDto;
  }

  return {
    destinationKind: "newPart",
    displayName: destinationPart.displayName,
    ...(destinationPart.partId === undefined || destinationPart.partId.trim().length === 0
      ? {}
      : { partId: destinationPart.partId.trim() }),
    ...(destinationPart.parentPartId === undefined || destinationPart.parentPartId.trim().length === 0
      ? {}
      : { parentPartId: destinationPart.parentPartId.trim() })
  } as PsdLayerMaterializationDestinationPartDto;
};

const storeMaterializedTextureBytes = async (input: {
  readonly persistentByteStore: EditorPersistentByteStore;
  readonly result: EditorSessionPersistenceResult;
  readonly textureId: string;
  readonly bytes: Uint8Array;
  readonly now?: () => Date;
}): Promise<EditorPersistentByteStorePutResult | "skipped-missing-texture-owner"> => {
  const owner = collectEditorPersistentBinaryOwners(input.result.reloadedDocument).find(
    (candidate) => candidate.ownerKind === "texture" && candidate.ownerId === input.textureId
  );
  if (owner === undefined) {
    return "skipped-missing-texture-owner";
  }

  return storeEditorPersistentBinaryOwnerBytes({
    persistentByteStore: input.persistentByteStore,
    packageDocument: input.result.reloadedDocument,
    owner,
    bytes: input.bytes,
    ...(input.now === undefined ? {} : { now: input.now })
  });
};

const createCommittedIntakeState = (input: {
  readonly result: EditorSessionPersistenceResult;
  readonly materializationResult: SelectedPsdLayerMaterializationSuccessResult;
  readonly persistentStoreResult: EditorPersistentByteStorePutResult | "skipped-missing-texture-owner";
}): ExplicitPsdLayerIntakeState => {
  const evidence = input.result.operationResult.psdLayerMaterializationEvidence?.[0];
  const candidate = input.materializationResult.candidate.evidence;
  if (evidence === undefined) {
    return createFailedIntakeState({
      checkId: "editor.explicitPsdLayerIntake.missingOperationEvidence",
      message: "Committed selected layer intake did not return materialization operation evidence."
    });
  }

  return {
    status: "committed",
    summaryFacts: [
      { label: "Materialized digest", value: `sha256:${candidate.digest.hex}` },
      { label: "Materialized byte length", value: formatByteLength(candidate.byteLength) },
      { label: "Media type", value: candidate.mediaType },
      { label: "Dimensions", value: `${candidate.width} x ${candidate.height}` },
      {
        label: "Texture evidence",
        value: [
          evidence.mapping.textureId,
          evidence.materializedAsset.binaryAssetRef?.binaryAssetId,
          evidence.materializedAsset.binaryAssetRef?.packageRelativePath
        ].filter((value): value is string => value !== undefined).join(" / ")
      },
      {
        label: "Drawable evidence",
        value: `${evidence.mapping.drawableId} -> ${evidence.mapping.partId}`
      },
      {
        label: "Part destination",
        value: `${evidence.destination.destinationKind} / ${evidence.destination.partId}`
      },
      {
        label: "Source layer",
        value: [
          evidence.sourceLayerRef.sourceLayerId,
          evidence.sourceLayerRef.sourceLayerName,
          evidence.sourceLayerRef.sourceLayerPath?.join(" / ")
        ].filter((value): value is string => value !== undefined && value.length > 0).join(" / ")
      },
      {
        label: "Source PSD",
        value: `${evidence.sourcePsd.sourceFilePath} / sha256:${evidence.sourcePsd.digest.hex} / ${formatByteLength(evidence.sourcePsd.byteLength)}`
      },
      {
        label: "Provenance",
        value: `${evidence.provenanceBoundary.privacyLabel} / ${evidence.provenanceBoundary.publicDistribution} / publicDemoAsset=${String(evidence.provenanceBoundary.publicDemoAsset)}`
      },
      {
        label: "Persistence",
        value: [
          evidence.materializedByteStorage,
          evidence.persistenceBoundary.materializedLayerBytePersistence,
          formatPersistentStoreResult(input.persistentStoreResult)
        ].join(" / ")
      }
    ],
    diagnostics: createCommittedDiagnostics(input.persistentStoreResult)
  };
};

const createMaterializationFailureIntakeState = (
  result: SelectedPsdLayerMaterializationFailureResult
): ExplicitPsdLayerIntakeState => ({
  status: "failed",
  summaryFacts: [
    { label: "Failure", value: result.failure.failureKind },
    { label: "Selected layer", value: result.failure.selectedLayerNodeRef || "No selected layer" },
    { label: "Source PSD", value: `${result.source.fileName} / ${formatByteLength(result.source.byteLength)}` },
    {
      label: "Provenance",
      value: `${result.failure.provenance.privacyLabel} / publicDemoAsset=${String(result.failure.provenance.publicDemoAsset)}`
    }
  ],
  diagnostics: [
    ...result.diagnostics.map((diagnostic) => ({
      checkId: diagnostic.checkId,
      severity: diagnostic.severity,
      message: `${diagnostic.message} ${diagnostic.evidence.join(" / ")}`
    })),
    {
      checkId: `selectedPsdLayer.materialization.failure.${result.failure.failureKind}`,
      severity: result.failure.severity,
      message: `${result.failure.message} ${result.failure.checks.join(" / ")}`
    }
  ]
});

const createOperationRejectedIntakeState = (input: {
  readonly stage: "sourceImport" | "operationCommit";
  readonly result: EditorSessionPersistenceResult;
  readonly materializationResult: SelectedPsdLayerMaterializationSuccessResult;
}): ExplicitPsdLayerIntakeState => ({
  status: "rejected",
  summaryFacts: [
    { label: "Rejected stage", value: input.stage },
    {
      label: "Materialized digest",
      value: `sha256:${input.materializationResult.candidate.evidence.digest.hex}`
    },
    {
      label: "Materialized byte length",
      value: formatByteLength(input.materializationResult.candidate.evidence.byteLength)
    },
    { label: "Media type", value: input.materializationResult.candidate.evidence.mediaType },
    {
      label: "Provenance",
      value: `${input.materializationResult.candidate.evidence.provenance.privacyLabel} / publicDemoAsset=false`
    }
  ],
  diagnostics: collectOperationDiagnostics(input.result)
});

const createFailedIntakeState = (input: {
  readonly checkId: string;
  readonly message: string;
}): ExplicitPsdLayerIntakeState => ({
  status: "failed",
  summaryFacts: [{ label: "Failure", value: input.message }],
  diagnostics: [{
    checkId: input.checkId,
    severity: "error",
    message: input.message
  }]
});

const projectStateWithIntake = (
  state: EditorSemanticState,
  selectedLayerIntake: ExplicitPsdLayerIntakeState
): EditorSemanticState => ({
  ...state,
  explicitPsdImport: {
    ...state.explicitPsdImport,
    selectedLayerIntake
  }
});

const collectOperationDiagnostics = (
  result: EditorSessionPersistenceResult
): readonly ExplicitPsdImportDiagnosticState[] => [
  ...result.operationResult.precondition.diagnostics,
  ...result.operationResult.diagnostics
].map((diagnostic) => ({
  checkId: diagnostic.checkId,
  severity: diagnostic.severity === "blocking" ? "error" : diagnostic.severity,
  message: diagnostic.message
}));

const createCommittedDiagnostics = (
  persistentStoreResult: EditorPersistentByteStorePutResult | "skipped-missing-texture-owner"
): readonly ExplicitPsdImportDiagnosticState[] => {
  if (persistentStoreResult === "skipped-missing-texture-owner") {
    return [{
      checkId: "editor.explicitPsdLayerIntake.persistentTextureOwnerMissing",
      severity: "warning",
      message: "Materialized bytes were package-local in the current session, but no texture owner was found for browser-local byte storage."
    }];
  }

  if (persistentStoreResult.status === "unavailable") {
    return [{
      checkId: "editor.explicitPsdLayerIntake.browserLocalByteStoreUnavailable",
      severity: "warning",
      message: persistentStoreResult.message
    }];
  }

  return [{
    checkId: "editor.explicitPsdLayerIntake.committed",
    severity: "info",
    message: "Selected PSD layer materialized bytes were added as a private/local package texture asset."
  }];
};

const formatPersistentStoreResult = (
  result: EditorPersistentByteStorePutResult | "skipped-missing-texture-owner"
): string => {
  if (result === "skipped-missing-texture-owner") {
    return "browserLocalStore=skipped-missing-texture-owner";
  }

  return result.status === "stored"
    ? `browserLocalStore=stored:${result.storageBackend}`
    : `browserLocalStore=unavailable:${result.storageBackendState}`;
};

const createSourceImportOperationId = (input: {
  readonly sourceAssetId: string;
  readonly packageRevision: number;
}): string =>
  `op_editor_import_explicit_psd_source_${sanitizeIdToken(input.sourceAssetId)}_r${input.packageRevision}`;

const createLayerMaterializationOperationId = (input: {
  readonly materializationId: string;
  readonly packageRevision: number;
}): string =>
  `op_editor_import_psd_layer_materialization_${sanitizeIdToken(input.materializationId)}_r${input.packageRevision}`;

const createExplicitPsdSourceAssetId = (file: Pick<File, "name" | "size">): string =>
  `src_explicit_psd_${sanitizeIdToken(removeFileExtension(file.name))}_${file.size}`;

const createPsdSourcePackagePath = (
  source: Pick<File, "name" | "size"> | { readonly fileName: string; readonly byteLength: number }
): string => {
  const fileName = "fileName" in source ? source.fileName : source.name;
  const byteLength = "byteLength" in source ? source.byteLength : source.size;

  return `assets/sources/psd/${sanitizeIdToken(removeFileExtension(fileName))}_${byteLength}.psd`;
};

const removeFileExtension = (fileName: string): string =>
  fileName.replace(/\.[^.\\/]+$/, "");

const sanitizeIdToken = (value: string): string =>
  value.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "selected_layer";

const formatByteLength = (byteLength: number): string =>
  `${byteLength} byte${byteLength === 1 ? "" : "s"}`;
