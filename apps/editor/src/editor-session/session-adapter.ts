import {
  createAuthoringSessionFromPackageDocument,
  listParameters,
  toPackageDocument,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import type {
  OperationLogEntryDto,
  OperationResultDto
} from "@private-2d-rigging-lab/operation-core";
import {
  createOperationCore,
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
  createEditorEvidenceCollector,
  summarizeEvidencePaths,
  toEvidencePackageFileEntries,
  type EditorEvidencePathSummary
} from "./evidence-provider.js";

export interface EditorSessionAdapter {
  readonly baseDocument: PackageDocumentDto;
  readonly authoringSession: AuthoringSession;
  createPersistenceSnapshot(): EditorSessionPersistenceSnapshot;
  commitCreateParameter(command: EditorCreateParameterCommand): EditorSessionPersistenceResult;
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
}

export interface EditorSessionPersistenceResult {
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
    commitCreateParameter(command) {
      const packageRevisionBefore = authoringSession.packageRevision;
      const evidenceStartIndex = evidenceCollector.captures.length;
      const request = createParameterOperationRequest(command, packageRevisionBefore);
      const outcome = operationCore.commitOperation(authoringSession, request);
      const capture = evidenceCollector.captures[evidenceStartIndex];

      if (outcome.result.status !== "committed") {
        return createRejectedPersistenceResult({
          operationResult: outcome.result,
          operationLogEntries: operationCore.operationLog.entries,
          packageRevisionBefore,
          packageRevisionAfterCommit: authoringSession.packageRevision,
          baseDocument
        });
      }

      if (capture === undefined) {
        throw new Error("Committed createParameter did not produce editor evidence artifacts.");
      }

      const operationLogJsonl = serializeOperationLogEntriesToJsonl(operationCore.operationLog.entries);
      const savedDocument = toPackageDocument(authoringSession, baseDocument, {
        updatedAt: now().toISOString()
      });
      appendGeneratedArtifactEntries(
        generatedArtifactEntries,
        toEvidencePackageFileEntries(capture)
      );
      const packageFileSet = serializePackageDocumentToFileSet(savedDocument, {
        operationLogText: operationLogJsonl,
        generatedArtifacts: generatedArtifactEntries
      });
      const reloadedDocument = parsePackageDocumentFromFileSet(packageFileSet);
      const evidence = summarizeEvidencePaths(capture);
      const generatedArtifactPaths = generatedArtifactEntries.map((entry) => entry.path);

      return {
        operationResult: outcome.result,
        operationLogEntries: parseOperationLogEntriesFromJsonl(operationLogJsonl),
        operationLogJsonl,
        packageRevisionBefore,
        packageRevisionAfterCommit: authoringSession.packageRevision,
        packageFileSet,
        packageFilePaths: packageFileSet.map((entry) => entry.path),
        generatedArtifactPaths,
        evidence,
        reloadedDocument,
        reloadedPackageRevision: reloadedDocument.manifest.packageRevision,
        parameterIdsAfterReload: reloadedDocument.model.parameters.parameters.map(
          (parameter) => parameter.parameterId
        )
      };
    }
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
    parameterIds: document.model.parameters.parameters.map((parameter) => parameter.parameterId)
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
  readonly operationResult: OperationResultDto;
  readonly operationLogEntries: readonly OperationLogEntryDto[];
  readonly packageRevisionBefore: number;
  readonly packageRevisionAfterCommit: number;
  readonly baseDocument: PackageDocumentDto;
}): EditorSessionPersistenceResult => {
  const operationLogJsonl = serializeOperationLogEntriesToJsonl(input.operationLogEntries);

  return {
    operationResult: input.operationResult,
    operationLogEntries: input.operationLogEntries,
    operationLogJsonl,
    packageRevisionBefore: input.packageRevisionBefore,
    packageRevisionAfterCommit: input.packageRevisionAfterCommit,
    packageFileSet: [],
    packageFilePaths: [],
    generatedArtifactPaths: [],
    evidence: {
      runtimeArtifactPaths: [],
      validationArtifactPaths: [],
      generatedRuntimeStateRefs: [],
      generatedRuntimeStateSequenceRefs: [],
      generatedValidationReportIds: []
    },
    reloadedDocument: input.baseDocument,
    reloadedPackageRevision: input.baseDocument.manifest.packageRevision,
    parameterIdsAfterReload: listParameters(
      createAuthoringSessionFromPackageDocument(input.baseDocument).graph
    ).map((parameter) => parameter.parameterId)
  };
};
