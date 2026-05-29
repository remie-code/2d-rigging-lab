import { createEmptyParameterFormState, type CreateParameterFormState } from "./create-parameter-form-state.js";
import { createEmptyGeneratedEvidenceSummary, type GeneratedEvidenceSummaryState } from "./generated-evidence-summary.js";
import type { OperationResultSummaryState } from "./operation-result-summary.js";
import { createEmptyOperationLogSummary, type OperationLogSummaryState } from "./operation-log-summary.js";
import type { LoadedPackageIdentityState } from "./package-identity-state.js";
import { emptyPackageRevisionState, type PackageRevisionState } from "./package-revision-state.js";
import type { ParameterListItemState } from "./parameter-list-state.js";
import { createEmptyReloadSummary, type ReloadSummaryState } from "./reload-summary.js";

export const editorSemanticStateSchemaVersion = "editor-semantic-state-v1";

export interface EditorSemanticState {
  readonly schemaVersion: typeof editorSemanticStateSchemaVersion;
  readonly loadedPackage: LoadedPackageIdentityState | null;
  readonly revision: PackageRevisionState;
  readonly parameters: readonly ParameterListItemState[];
  readonly pendingCreateParameter: CreateParameterFormState;
  readonly lastOperationResult: OperationResultSummaryState | null;
  readonly operationLog: OperationLogSummaryState;
  readonly generatedEvidence: GeneratedEvidenceSummaryState;
  readonly reload: ReloadSummaryState;
}

export const createInitialEditorSemanticState = (): EditorSemanticState => ({
  schemaVersion: editorSemanticStateSchemaVersion,
  loadedPackage: null,
  revision: emptyPackageRevisionState(),
  parameters: [],
  pendingCreateParameter: createEmptyParameterFormState(),
  lastOperationResult: null,
  operationLog: createEmptyOperationLogSummary(),
  generatedEvidence: createEmptyGeneratedEvidenceSummary(),
  reload: createEmptyReloadSummary()
});
