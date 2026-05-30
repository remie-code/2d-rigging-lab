import {
  createAuthoringSessionFromPackageDocument,
  toPackageDocument,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import type {
  OperationLogEntryDto,
  OperationRequestDto,
  OperationResultDto
} from "@private-2d-rigging-lab/operation-core";
import {
  createOperationCore,
  OperationRequestSchema,
  parseOperationLogEntriesFromJsonl,
  serializeOperationLogEntriesToJsonl
} from "@private-2d-rigging-lab/operation-core";
import {
  parsePackageDocumentFromFileSet,
  serializePackageDocumentToFileSet,
  type PackageDocumentDto,
  type PackageFileSet
} from "@private-2d-rigging-lab/package-format";

import {
  createBrowserSamplePackageDocument,
  EDITOR_BROWSER_SAMPLE_PACKAGE_HASH
} from "./browser-sample-package.js";
import {
  createParameterOperationRequest,
  type EditorCreateParameterCommand
} from "./create-parameter-command.js";
import {
  createDrawablePresetOperationRequests,
  type EditorCreateDrawablePresetCommand
} from "./create-drawable-preset-command.js";
import {
  createSetDrawableDrawOrderOperationRequest,
  createSetDrawableRuntimeVisibilityOperationRequest,
  type EditorSetDrawableDrawOrderCommand,
  type EditorSetDrawableRuntimeVisibilityCommand
} from "./drawable-layer-command.js";
import {
  createMoveMeshVertexOperationRequest,
  type EditorMoveMeshVertexCommand
} from "./mesh-vertex-command.js";
import {
  createImportSplitPngSourceAssetOperationRequest,
  createSetRightsMetadataOperationRequest,
  type EditorImportSplitPngSourceAssetCommand,
  type EditorSetRightsMetadataCommand
} from "./source-import-command.js";
import {
  createEditorEvidenceCollector,
  summarizeEvidencePaths,
  toEvidencePackageFileEntries,
  type EditorEvidencePathSummary
} from "./evidence-provider.js";

export interface EditorSessionAdapter {
  readonly baseDocument: PackageDocumentDto;
  readonly authoringSession: AuthoringSession;
  createPersistenceSnapshot(): EditorSessionPersistenceSnapshot;
  getOperationLogEntries(): readonly OperationLogEntryDto[];
  dryRunOperation(request: OperationRequestDto): OperationResultDto;
  commitOperation(request: OperationRequestDto): EditorSessionPersistenceResult;
  commitCreateParameter(command: EditorCreateParameterCommand): EditorSessionPersistenceResult;
  commitCreateDrawablePreset(command: EditorCreateDrawablePresetCommand): EditorSessionDrawablePresetResult;
  commitSetDrawableRuntimeVisibility(
    command: EditorSetDrawableRuntimeVisibilityCommand
  ): EditorSessionPersistenceResult;
  commitSetDrawableDrawOrder(command: EditorSetDrawableDrawOrderCommand): EditorSessionPersistenceResult;
  commitMoveMeshVertex(command: EditorMoveMeshVertexCommand): EditorSessionPersistenceResult;
  commitImportSplitPngSourceAsset(
    command: EditorImportSplitPngSourceAssetCommand
  ): EditorSessionPersistenceResult;
  commitSetRightsMetadata(command: EditorSetRightsMetadataCommand): EditorSessionPersistenceResult;
}

export interface EditorSessionAdapterOptions {
  readonly packageDocument?: PackageDocumentDto;
  readonly packageHash?: string;
  readonly initialOperationLogEntries?: readonly OperationLogEntryDto[];
  readonly initialGeneratedArtifactEntries?: readonly PackageFileSet[number][];
  readonly now?: () => Date;
}

export interface EditorSessionPersistenceSnapshot {
  readonly operationLogEntries: readonly OperationLogEntryDto[];
  readonly operationLogJsonl: string;
  readonly packageRevision: number;
  readonly packageFileSet: PackageFileSet;
  readonly packageFilePaths: readonly string[];
  readonly generatedArtifactPaths: readonly string[];
  readonly document: PackageDocumentDto;
  readonly parameterIds: readonly string[];
  readonly drawableIds: readonly string[];
}

export interface EditorSessionPersistenceResult {
  readonly operationType: OperationRequestDto["operationType"];
  readonly operationResult: OperationResultDto;
  readonly operationLogEntries: readonly OperationLogEntryDto[];
  readonly operationLogJsonl: string;
  readonly packageRevisionBefore: number;
  readonly packageRevisionAfterCommit: number;
  readonly packageFileSet: PackageFileSet;
  readonly packageFilePaths: readonly string[];
  readonly generatedArtifactPaths: readonly string[];
  readonly evidence: EditorEvidencePathSummary;
  readonly reloadedDocument: PackageDocumentDto;
  readonly reloadedPackageRevision: number;
  readonly parameterIdsAfterReload: readonly string[];
  readonly drawableIdsAfterReload: readonly string[];
}

export interface EditorSessionDrawablePresetResult {
  readonly status: "committed" | "rejected";
  readonly createDrawable: EditorSessionPersistenceResult;
  readonly generateMesh: EditorSessionPersistenceResult | null;
  readonly finalPersistenceResult: EditorSessionPersistenceResult;
}

export const createEditorSessionAdapter = (
  options: EditorSessionAdapterOptions = {}
): EditorSessionAdapter => {
  const baseDocument = options.packageDocument ?? createBrowserSamplePackageDocument();
  const authoringSession = createAuthoringSessionFromPackageDocument(baseDocument);
  const now = options.now ?? (() => new Date());
  const evidenceCollector = createEditorEvidenceCollector({
    packageHash: options.packageHash ?? EDITOR_BROWSER_SAMPLE_PACKAGE_HASH,
    now
  });
  const generatedArtifactEntries = [...(options.initialGeneratedArtifactEntries ?? [])];
  const operationCore = createOperationCore({
    now,
    evidenceProvider: evidenceCollector.collectOperationEvidence,
    initialOperationLogEntries: options.initialOperationLogEntries ?? []
  });

  return {
    baseDocument,
    authoringSession,
    createPersistenceSnapshot() {
      return createPersistenceSnapshot({
        authoringSession,
        baseDocument,
        operationLogEntries: operationCore.operationLog.entries,
        generatedArtifactEntries,
        now
      });
    },
    getOperationLogEntries() {
      return operationCore.operationLog.entries;
    },
    dryRunOperation(request) {
      return operationCore.dryRunOperation(authoringSession, request);
    },
    commitOperation(request) {
      return commitOperationRequest({
        request,
        authoringSession,
        baseDocument,
        operationCore,
        evidenceCollector,
        generatedArtifactEntries,
        now
      });
    },
    commitCreateParameter(command) {
      const packageRevisionBefore = authoringSession.packageRevision;
      const request = createParameterOperationRequest(command, packageRevisionBefore);
      return this.commitOperation(request);
    },
    commitCreateDrawablePreset(command) {
      const packageRevisionBefore = authoringSession.packageRevision;
      const requests = createDrawablePresetOperationRequests(command, packageRevisionBefore);
      const createDrawable = this.commitOperation(requests.createDrawable);

      if (createDrawable.operationResult.status !== "committed") {
        return {
          status: "rejected",
          createDrawable,
          generateMesh: null,
          finalPersistenceResult: createDrawable
        };
      }

      const generateMeshRequest = {
        ...requests.generateMesh,
        basePackageRevision: authoringSession.packageRevision
      };
      const generateMesh = this.commitOperation(OperationRequestSchema.parse(generateMeshRequest));

      return {
        status: generateMesh.operationResult.status === "committed" ? "committed" : "rejected",
        createDrawable,
        generateMesh,
        finalPersistenceResult: generateMesh
      };
    },
    commitSetDrawableRuntimeVisibility(command) {
      const request = createSetDrawableRuntimeVisibilityOperationRequest(
        command,
        authoringSession.packageRevision
      );
      return this.commitOperation(request);
    },
    commitSetDrawableDrawOrder(command) {
      const request = createSetDrawableDrawOrderOperationRequest(
        command,
        authoringSession.packageRevision
      );
      return this.commitOperation(request);
    },
    commitMoveMeshVertex(command) {
      const request = createMoveMeshVertexOperationRequest(
        command,
        authoringSession.packageRevision
      );
      return this.commitOperation(request);
    },
    commitImportSplitPngSourceAsset(command) {
      const request = createImportSplitPngSourceAssetOperationRequest(
        command,
        authoringSession.packageRevision
      );
      return this.commitOperation(request);
    },
    commitSetRightsMetadata(command) {
      const request = createSetRightsMetadataOperationRequest(
        command,
        authoringSession.packageRevision
      );
      return this.commitOperation(request);
    }
  };
};

const commitOperationRequest = (input: {
  readonly request: OperationRequestDto;
  readonly authoringSession: AuthoringSession;
  readonly baseDocument: PackageDocumentDto;
  readonly operationCore: ReturnType<typeof createOperationCore>;
  readonly evidenceCollector: ReturnType<typeof createEditorEvidenceCollector>;
  readonly generatedArtifactEntries: PackageFileSet[number][];
  readonly now: () => Date;
}): EditorSessionPersistenceResult => {
  const packageRevisionBefore = input.authoringSession.packageRevision;
  const evidenceStartIndex = input.evidenceCollector.captures.length;
  const outcome = input.operationCore.commitOperation(input.authoringSession, input.request);
  const capture = input.evidenceCollector.captures[evidenceStartIndex];

  if (outcome.result.status !== "committed") {
    return createRejectedPersistenceResult({
      operationType: input.request.operationType,
      operationResult: outcome.result,
      operationLogEntries: input.operationCore.operationLog.entries,
      packageRevisionBefore,
      packageRevisionAfterCommit: input.authoringSession.packageRevision,
      authoringSession: input.authoringSession,
      baseDocument: input.baseDocument,
      generatedArtifactEntries: input.generatedArtifactEntries,
      now: input.now
    });
  }

  if (capture === undefined) {
    throw new Error(`Committed ${input.request.operationType} did not produce editor evidence artifacts.`);
  }

  const operationLogJsonl = serializeOperationLogEntriesToJsonl(input.operationCore.operationLog.entries);
  const savedDocument = toPackageDocument(input.authoringSession, input.baseDocument, {
    updatedAt: input.now().toISOString()
  });
  appendGeneratedArtifactEntries(
    input.generatedArtifactEntries,
    toEvidencePackageFileEntries(capture)
  );
  const packageFileSet = serializePackageDocumentToFileSet(savedDocument, {
    operationLogText: operationLogJsonl,
    generatedArtifacts: input.generatedArtifactEntries
  });
  const reloadedDocument = parsePackageDocumentFromFileSet(packageFileSet);
  const evidence = summarizeEvidencePaths(capture);
  const generatedArtifactPaths = input.generatedArtifactEntries.map((entry) => entry.path);

  return {
    operationType: input.request.operationType,
    operationResult: outcome.result,
    operationLogEntries: parseOperationLogEntriesFromJsonl(operationLogJsonl),
    operationLogJsonl,
    packageRevisionBefore,
    packageRevisionAfterCommit: input.authoringSession.packageRevision,
    packageFileSet,
    packageFilePaths: packageFileSet.map((entry) => entry.path),
    generatedArtifactPaths,
    evidence,
    reloadedDocument,
    reloadedPackageRevision: reloadedDocument.manifest.packageRevision,
    parameterIdsAfterReload: reloadedDocument.model.parameters.parameters.map(
      (parameter) => parameter.parameterId
    ),
    drawableIdsAfterReload: reloadedDocument.model.drawables.drawables.map(
      (drawable) => drawable.drawableId
    )
  };
};

const createPersistenceSnapshot = (input: {
  readonly authoringSession: AuthoringSession;
  readonly baseDocument: PackageDocumentDto;
  readonly operationLogEntries: readonly OperationLogEntryDto[];
  readonly generatedArtifactEntries: readonly PackageFileSet[number][];
  readonly now: () => Date;
}): EditorSessionPersistenceSnapshot => {
  const operationLogJsonl = serializeOperationLogEntriesToJsonl(input.operationLogEntries);
  const document = toPackageDocument(input.authoringSession, input.baseDocument, {
    updatedAt: input.now().toISOString()
  });
  const packageFileSet = serializePackageDocumentToFileSet(document, {
    operationLogText: operationLogJsonl,
    generatedArtifacts: input.generatedArtifactEntries
  });

  return {
    operationLogEntries: parseOperationLogEntriesFromJsonl(operationLogJsonl),
    operationLogJsonl,
    packageRevision: document.manifest.packageRevision,
    packageFileSet,
    packageFilePaths: packageFileSet.map((entry) => entry.path),
    generatedArtifactPaths: input.generatedArtifactEntries.map((entry) => entry.path),
    document,
    parameterIds: document.model.parameters.parameters.map((parameter) => parameter.parameterId),
    drawableIds: document.model.drawables.drawables.map((drawable) => drawable.drawableId)
  };
};

const appendGeneratedArtifactEntries = (
  target: PackageFileSet[number][],
  entries: readonly PackageFileSet[number][]
): void => {
  const incomingPaths = new Set(entries.map((entry) => entry.path));

  for (let index = target.length - 1; index >= 0; index -= 1) {
    if (incomingPaths.has(target[index]?.path ?? "")) {
      target.splice(index, 1);
    }
  }

  target.push(...entries);
};

const createRejectedPersistenceResult = (input: {
  readonly operationType: OperationRequestDto["operationType"];
  readonly operationResult: OperationResultDto;
  readonly operationLogEntries: readonly OperationLogEntryDto[];
  readonly packageRevisionBefore: number;
  readonly packageRevisionAfterCommit: number;
  readonly authoringSession: AuthoringSession;
  readonly baseDocument: PackageDocumentDto;
  readonly generatedArtifactEntries: readonly PackageFileSet[number][];
  readonly now: () => Date;
}): EditorSessionPersistenceResult => {
  const operationLogJsonl = serializeOperationLogEntriesToJsonl(input.operationLogEntries);
  const savedDocument = toPackageDocument(input.authoringSession, input.baseDocument, {
    updatedAt: input.now().toISOString()
  });
  const packageFileSet = serializePackageDocumentToFileSet(savedDocument, {
    operationLogText: operationLogJsonl,
    generatedArtifacts: input.generatedArtifactEntries
  });
  const reloadedDocument = parsePackageDocumentFromFileSet(packageFileSet);

  return {
    operationType: input.operationType,
    operationResult: input.operationResult,
    operationLogEntries: input.operationLogEntries,
    operationLogJsonl,
    packageRevisionBefore: input.packageRevisionBefore,
    packageRevisionAfterCommit: input.packageRevisionAfterCommit,
    packageFileSet,
    packageFilePaths: packageFileSet.map((entry) => entry.path),
    generatedArtifactPaths: input.generatedArtifactEntries.map((entry) => entry.path),
    evidence: {
      runtimeArtifactPaths: [],
      validationArtifactPaths: [],
      generatedRuntimeStateRefs: [],
      generatedRuntimeStateSequenceRefs: [],
      generatedValidationReportIds: []
    },
    reloadedDocument,
    reloadedPackageRevision: reloadedDocument.manifest.packageRevision,
    parameterIdsAfterReload: reloadedDocument.model.parameters.parameters.map(
      (parameter) => parameter.parameterId
    ),
    drawableIdsAfterReload: reloadedDocument.model.drawables.drawables.map(
      (drawable) => drawable.drawableId
    )
  };
};
