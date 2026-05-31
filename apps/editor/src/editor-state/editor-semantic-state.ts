import { createEmptyAiApprovalState, type AiApprovalState } from "./ai-approval-state.js";
import { createEmptyDrawableFormState, type CreateDrawableFormState } from "./create-drawable-form-state.js";
import { createEmptyParameterFormState, type CreateParameterFormState } from "./create-parameter-form-state.js";
import {
  createEmptyDynamicsPreviewState,
  type DynamicsGroupState,
  type DynamicsPreviewState
} from "./dynamics-authoring-state.js";
import type { DrawableListItemState } from "./drawable-list-state.js";
import { createEmptyGeneratedEvidenceSummary, type GeneratedEvidenceSummaryState } from "./generated-evidence-summary.js";
import { createEmptyMeshEditState, type MeshEditState } from "./mesh-edit-state.js";
import type { OperationResultSummaryState } from "./operation-result-summary.js";
import { createEmptyOperationLogSummary, type OperationLogSummaryState } from "./operation-log-summary.js";
import type { LoadedPackageIdentityState } from "./package-identity-state.js";
import { emptyPackageRevisionState, type PackageRevisionState } from "./package-revision-state.js";
import type { ParameterListItemState } from "./parameter-list-state.js";
import type { PreviewParameterValueState } from "./preview-parameter-state.js";
import { createEmptyReloadSummary, type ReloadSummaryState } from "./reload-summary.js";
import {
  createEmptySourceIntakeDraftState,
  type SourceIntakeDraftState
} from "./source-intake-draft-state.js";
import type {
  SourceAssetDto,
  TextureAtlasFileDto
} from "@private-2d-rigging-lab/package-format";

export const editorSemanticStateSchemaVersion = "editor-semantic-state-v1";

export interface EditorSemanticState {
  readonly schemaVersion: typeof editorSemanticStateSchemaVersion;
  readonly loadedPackage: LoadedPackageIdentityState | null;
  readonly revision: PackageRevisionState;
  readonly parameters: readonly ParameterListItemState[];
  readonly dynamicsGroups: readonly DynamicsGroupState[];
  readonly drawables: readonly DrawableListItemState[];
  readonly meshEdit: MeshEditState;
  readonly previewParameters: readonly PreviewParameterValueState[];
  readonly pendingCreateParameter: CreateParameterFormState;
  readonly pendingCreateDrawable: CreateDrawableFormState;
  readonly sourceIntakeDraft: SourceIntakeDraftState;
  readonly sourceAssets: readonly SourceAssetDto[];
  readonly textureAtlas: TextureAtlasFileDto | null;
  readonly lastOperationResult: OperationResultSummaryState | null;
  readonly operationLog: OperationLogSummaryState;
  readonly generatedEvidence: GeneratedEvidenceSummaryState;
  readonly dynamicsPreview: DynamicsPreviewState;
  readonly reload: ReloadSummaryState;
  readonly aiApproval: AiApprovalState;
}

export const createInitialEditorSemanticState = (): EditorSemanticState => ({
  schemaVersion: editorSemanticStateSchemaVersion,
  loadedPackage: null,
  revision: emptyPackageRevisionState(),
  parameters: [],
  dynamicsGroups: [],
  drawables: [],
  meshEdit: createEmptyMeshEditState(),
  previewParameters: [],
  pendingCreateParameter: createEmptyParameterFormState(),
  pendingCreateDrawable: createEmptyDrawableFormState(),
  sourceIntakeDraft: createEmptySourceIntakeDraftState(),
  sourceAssets: [],
  textureAtlas: null,
  lastOperationResult: null,
  operationLog: createEmptyOperationLogSummary(),
  generatedEvidence: createEmptyGeneratedEvidenceSummary(),
  dynamicsPreview: createEmptyDynamicsPreviewState(),
  reload: createEmptyReloadSummary(),
  aiApproval: createEmptyAiApprovalState()
});
