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
import {
  createEmptyLayerTreeDraftState,
  type LayerTreeDraftState
} from "./layer-tree-draft-state.js";
import { createEmptyMeshEditState, type MeshEditState } from "./mesh-edit-state.js";
import type { OperationResultSummaryState } from "./operation-result-summary.js";
import { createEmptyOperationLogSummary, type OperationLogSummaryState } from "./operation-log-summary.js";
import type { LoadedPackageIdentityState } from "./package-identity-state.js";
import { emptyPackageRevisionState, type PackageRevisionState } from "./package-revision-state.js";
import type { ParameterListItemState } from "./parameter-list-state.js";
import type { PreviewParameterValueState } from "./preview-parameter-state.js";
import type {
  CompositionMaskRelationState,
  DrawableOpacityKeyformState
} from "./composition-authoring-state.js";
import {
  createEmptyViewerRuntimeState,
  type ViewerRuntimeState
} from "./viewer-runtime-state.js";
import {
  createEmptyTutorialGuidedWorkflowState,
  type TutorialGuidedWorkflowState
} from "./tutorial-guided-workflow-state.js";
import {
  createEmptyTutorialReadinessPreflightState,
  type TutorialReadinessPreflightState
} from "./tutorial-readiness-preflight-state.js";
import { createEmptyReloadSummary, type ReloadSummaryState } from "./reload-summary.js";
import {
  createEmptySourceIntakeDraftState,
  type SourceIntakeDraftState
} from "./source-intake-draft-state.js";
import type {
  ModelPartDto,
  SourceAssetDto,
  TextureAtlasFileDto
} from "@private-2d-rigging-lab/package-format";
import type { RigControlState } from "./rig-control-authoring-state.js";
import type { RigControlAngleKeyformState } from "./rig-control-keyform-state.js";

export const editorSemanticStateSchemaVersion = "editor-semantic-state-v1";

export interface EditorSemanticState {
  readonly schemaVersion: typeof editorSemanticStateSchemaVersion;
  readonly loadedPackage: LoadedPackageIdentityState | null;
  readonly revision: PackageRevisionState;
  readonly parameters: readonly ParameterListItemState[];
  readonly parts: readonly ModelPartDto[];
  readonly rigControls: readonly RigControlState[];
  readonly rigControlAngleKeyforms: readonly RigControlAngleKeyformState[];
  readonly maskRelations: readonly CompositionMaskRelationState[];
  readonly drawableOpacityKeyforms: readonly DrawableOpacityKeyformState[];
  readonly dynamicsGroups: readonly DynamicsGroupState[];
  readonly drawables: readonly DrawableListItemState[];
  readonly layerTreeDraft: LayerTreeDraftState;
  readonly meshEdit: MeshEditState;
  readonly previewParameters: readonly PreviewParameterValueState[];
  readonly viewerRuntime: ViewerRuntimeState;
  readonly tutorialReadinessPreflight: TutorialReadinessPreflightState;
  readonly tutorialGuidedWorkflow: TutorialGuidedWorkflowState;
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
  parts: [],
  rigControls: [],
  rigControlAngleKeyforms: [],
  maskRelations: [],
  drawableOpacityKeyforms: [],
  dynamicsGroups: [],
  drawables: [],
  layerTreeDraft: createEmptyLayerTreeDraftState(),
  meshEdit: createEmptyMeshEditState(),
  previewParameters: [],
  viewerRuntime: createEmptyViewerRuntimeState(),
  tutorialReadinessPreflight: createEmptyTutorialReadinessPreflightState(),
  tutorialGuidedWorkflow: createEmptyTutorialGuidedWorkflowState(),
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
