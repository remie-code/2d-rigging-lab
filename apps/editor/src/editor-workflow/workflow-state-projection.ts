import type { OperationLogEntryDto } from "@private-2d-rigging-lab/operation-core";
import type { PackageDocumentDto, PackageFileSet } from "@private-2d-rigging-lab/package-format";

import type {
  EditorSessionAdapter,
  EditorSessionPersistenceResult
} from "../editor-session/index.js";
import {
  applyCommittedOperationSummary,
  projectGeneratedEvidenceSummary,
  projectLoadedPackageState,
  projectOperationLogSummary,
  projectReloadSummary,
  type EditorSemanticState
} from "../editor-state/index.js";

export const createEditorWorkflowState = (
  adapter: EditorSessionAdapter
): EditorSemanticState =>
  projectLoadedPackageState({
    identity: adapter.baseDocument.manifest,
    revision: {
      packageRevision: adapter.authoringSession.packageRevision,
      authoringRevision: adapter.authoringSession.authoringRevision
    },
    parameters: adapter.baseDocument.model.parameters.parameters
  });

export const applyEditorWorkflowCommitResult = (
  state: EditorSemanticState,
  adapter: EditorSessionAdapter,
  result: EditorSessionPersistenceResult
): EditorSemanticState =>
  applyCommittedOperationSummary(state, {
    result: {
      ...result.operationResult,
      operationType: "createParameter"
    },
    operationLogEntries: result.operationLogEntries,
    generatedEvidence: {
      runtimeSnapshotIds: result.operationResult.generatedRuntimeSnapshotIds,
      runtimeStateArtifactPaths: result.evidence.generatedRuntimeStateRefs,
      runtimeStateSequenceArtifactPaths: result.evidence.generatedRuntimeStateSequenceRefs,
      validationReportIds: result.evidence.generatedValidationReportIds,
      validationReportArtifactPaths: result.evidence.validationArtifactPaths
    },
    revision: {
      packageRevision: result.packageRevisionAfterCommit,
      authoringRevision: adapter.authoringSession.authoringRevision
    },
    parameters: result.reloadedDocument.model.parameters.parameters,
    reload: {
      status: result.operationResult.status === "committed" ? "reloaded" : "failed",
      packageRevision: result.reloadedPackageRevision,
      parameterIds: result.parameterIdsAfterReload,
      filePaths: result.packageFilePaths
    }
  });

export const projectLoadedEditorWorkflowState = (input: {
  readonly document: PackageDocumentDto;
  readonly packageFileSet: PackageFileSet;
  readonly operationLogEntries: readonly OperationLogEntryDto[];
  readonly generatedArtifactPaths: readonly string[];
}): EditorSemanticState => {
  const loadedState = projectLoadedPackageState({
    identity: input.document.manifest,
    revision: {
      packageRevision: input.document.manifest.packageRevision,
      authoringRevision: 0
    },
    parameters: input.document.model.parameters.parameters
  });
  const evidence = projectLoadedEvidenceSummary({
    operationLogEntries: input.operationLogEntries,
    generatedArtifactPaths: input.generatedArtifactPaths
  });

  return {
    ...loadedState,
    operationLog: projectOperationLogSummary(input.operationLogEntries),
    generatedEvidence: projectGeneratedEvidenceSummary(evidence),
    reload: projectReloadSummary({
      status: "reloaded",
      packageRevision: input.document.manifest.packageRevision,
      parameterIds: input.document.model.parameters.parameters.map(
        (parameter) => parameter.parameterId
      ),
      filePaths: input.packageFileSet.map((entry) => entry.path)
    })
  };
};

const projectLoadedEvidenceSummary = (input: {
  readonly operationLogEntries: readonly OperationLogEntryDto[];
  readonly generatedArtifactPaths: readonly string[];
}) => ({
  runtimeSnapshotIds: [
    ...new Set(input.operationLogEntries.flatMap((entry) => entry.runtimeSnapshotIds))
  ],
  runtimeStateArtifactPaths: input.generatedArtifactPaths.filter((path) =>
    path.startsWith("runtime/states/")
  ),
  runtimeStateSequenceArtifactPaths: input.generatedArtifactPaths.filter((path) =>
    path.startsWith("runtime/state-sequences/")
  ),
  validationReportIds: [
    ...new Set(input.operationLogEntries.flatMap((entry) => entry.validationReportIds))
  ],
  validationReportArtifactPaths: input.generatedArtifactPaths.filter((path) =>
    path.startsWith("validation/reports/")
  )
});
