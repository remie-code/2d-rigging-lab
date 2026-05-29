import {
  createInitialEditorSemanticState,
  type EditorSemanticState
} from "./editor-semantic-state.js";
import {
  projectGeneratedEvidenceSummary,
  type GeneratedEvidenceSummaryInput
} from "./generated-evidence-summary.js";
import {
  projectOperationLogSummary,
  type OperationLogEntryProjectionInput
} from "./operation-log-summary.js";
import {
  projectOperationResultSummary,
  type OperationResultSummaryInput
} from "./operation-result-summary.js";
import {
  projectLoadedPackageIdentity,
  type LoadedPackageIdentityInput
} from "./package-identity-state.js";
import { projectPackageRevision, type PackageRevisionInput } from "./package-revision-state.js";
import { projectParameterList, type ParameterProjectionInput } from "./parameter-list-state.js";
import { projectReloadSummary, type ReloadSummaryInput } from "./reload-summary.js";

export interface LoadedPackageSummaryInput {
  readonly identity: LoadedPackageIdentityInput;
  readonly revision: PackageRevisionInput;
  readonly parameters?: readonly ParameterProjectionInput[];
}

export interface CommittedOperationSummaryInput {
  readonly result: OperationResultSummaryInput;
  readonly operationLogEntries: readonly OperationLogEntryProjectionInput[];
  readonly generatedEvidence?: GeneratedEvidenceSummaryInput;
  readonly revision?: PackageRevisionInput;
  readonly parameters?: readonly ParameterProjectionInput[];
  readonly reload?: ReloadSummaryInput;
}

export const projectLoadedPackageState = (
  input: LoadedPackageSummaryInput
): EditorSemanticState => ({
  ...createInitialEditorSemanticState(),
  loadedPackage: projectLoadedPackageIdentity(input.identity),
  revision: projectPackageRevision(input.revision),
  parameters: projectParameterList(input.parameters ?? [])
});

export const applyCommittedOperationSummary = (
  state: EditorSemanticState,
  input: CommittedOperationSummaryInput
): EditorSemanticState => ({
  ...state,
  revision: input.revision === undefined ? state.revision : projectPackageRevision(input.revision),
  parameters: input.parameters === undefined ? state.parameters : projectParameterList(input.parameters),
  pendingCreateParameter: {
    ...state.pendingCreateParameter,
    status: input.result.status === "committed" ? "committed" : "rejected",
    diagnostics: (input.result.diagnostics ?? []).map((diagnostic) => ({
      checkId: diagnostic.checkId,
      severity:
        diagnostic.severity === "info" ||
        diagnostic.severity === "warning" ||
        diagnostic.severity === "error" ||
        diagnostic.severity === "blocking"
          ? diagnostic.severity
          : "warning",
      message: diagnostic.message,
      ...(diagnostic.phase === undefined ? {} : { phase: diagnostic.phase })
    }))
  },
  lastOperationResult: projectOperationResultSummary(input.result),
  operationLog: projectOperationLogSummary(input.operationLogEntries),
  generatedEvidence: projectGeneratedEvidenceSummary(input.generatedEvidence ?? {}),
  reload: input.reload === undefined ? state.reload : projectReloadSummary(input.reload)
});
