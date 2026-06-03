import {
  hydrateInMemoryAiCommandTranscript,
  serializeAiCommandTranscript,
  type AiCommandTranscript
} from "@private-2d-rigging-lab/ai-interface";
import {
  parseOperationLogEntriesFromJsonl
} from "@private-2d-rigging-lab/operation-core";
import {
  parsePackageDocumentFromFileSet,
  type PackageFileSet
} from "@private-2d-rigging-lab/package-format";

import {
  createEditorAiCommandHost,
  projectEditorAiState,
  type EditorAiCommandHost
} from "../ai-command-host/index.js";
import type { EditorPreviewProjectionDto } from "../editor-preview/preview-dto.js";
import {
  projectEditorInspectModel,
  projectEditorInspectTarget
} from "../ai-command-host/editor-ai-inspection-projector.js";
import { projectEditorAiValidation } from "../ai-command-host/editor-ai-validation-projector.js";
import {
  createEditorSessionAdapter,
  createEditorIndexedDbPersistentByteStore,
  restoreEditorSessionPersistentBinaryBytes,
  storeEditorPersistentSourceBinaryBytes,
  type EditorCreateDrawablePresetCommand,
  type EditorCreateParameterCommand,
  type EditorCreatePartCommand,
  type EditorPersistentByteStore,
  type EditorMeshVertexNudgeCommand,
  type EditorSessionAdapter,
  type EditorSessionDrawablePresetResult,
  type EditorSessionPersistentByteRestoreResult,
  type EditorSessionPersistenceResult,
  type EditorSetDrawablePartCommand,
  type EditorSetDrawableTextureCommand,
  type EditorSetRightsMetadataCommand,
  type EditorUpdatePartCommand,
  type EditorUpdateDynamicsGroupCommand,
  type EditorSessionPersistenceSnapshot
} from "../editor-session/index.js";
import type {
  BrowserProjectStore,
  ClearEditorProjectResult,
  LoadEditorProjectResult,
  SaveEditorProjectResult
} from "../project-persistence/index.js";
import {
  applyPreviewParameterValue,
  applyViewerParameterValue,
  closeViewerRuntimeSurface as closeViewerRuntimeStateSurface,
  createEditorStateFileFromEditorState,
  openViewerRuntimeSurface as openViewerRuntimeStateSurface,
  projectEditorWorkflowViewModel,
  resetPreviewParameterValues as resetPreviewParameterValueStates,
  resetViewerParameterValues as resetViewerRuntimeParameterValues,
  selectTutorialTargetInEditorState,
  type PreviewParameterSetResult,
  type ViewerParameterSetResult,
  type CreateDrawableFormState,
  type EditorSemanticState,
  type EditorWorkflowViewModel,
  type LayerTreeDrawablePartAssignmentDraftCommand,
  type LayerTreeDrawableTextureAssignmentDraftCommand,
  type LayerTreeEmptyLeafPartDeleteDraftCommand,
  type LayerTreePartRenameDraftCommand,
  type LayerTreePartReparentDraftCommand,
  type MeshCanvasHitSelectionCommand,
  type MeshCanvasVertexSelectionCommand,
  type MeshTopologyAddTriangleDraftCommand,
  type MeshTopologyAddVertexDraftCommand,
  type MeshTopologyRemoveTriangleDraftCommand,
  type MeshTopologyRemoveVertexDraftCommand,
  type MeshUvNudgeDraftCommand,
  type SourceIntakeSelectedFileBytes,
  type SourceIntakeDraftState,
  type TutorialSelectedTargetState
} from "../editor-state/index.js";
import {
  createWorkflowAiApprovalActions,
  type EditorWorkflowAiApprovalDecisionResult,
  type EditorWorkflowAiCommitResult,
  type EditorWorkflowAiDryRunResult
} from "./workflow-ai-approval-actions.js";
import {
  exportEditorWorkflowPortableBundleV0,
  importEditorWorkflowPortableBundleV0,
  type EditorWorkflowPortableBundleExportResult,
  type EditorWorkflowPortableBundleImportResult
} from "./portable-bundle-workflow.js";
import {
  applyEditorWorkflowCommitResult,
  createEditorWorkflowState,
  projectLoadedEditorWorkflowState
} from "./workflow-state-projection.js";
import {
  applySelectedFileBytesToSourceIntakeDraft,
  createSourceIntakePsdImportCommandWithBinaryBytes,
  createSourceIntakeImportOperationRequest,
  projectWorkflowSourceIntakeCommitResult,
  type EditorWorkflowSourceImportCommitResult
} from "./source-intake-workflow.js";
import {
  commitWorkflowCreateDynamicsGroup,
  commitWorkflowUpdateDynamicsGroup,
  type EditorWorkflowCreateDynamicsGroupCommand,
  type EditorWorkflowDynamicsCreateResult,
  type EditorWorkflowDynamicsUpdateResult
} from "./dynamics-group-workflow.js";
import {
  commitWorkflowAddWarpLattice2dControlPointOffsetsKeyform,
  commitWorkflowBindRigControlChild,
  commitWorkflowBindWarpLattice2dChild,
  commitWorkflowCreateRotation2dRigControl,
  commitWorkflowCreateWarpLattice2dRigControl,
  type EditorWorkflowAddWarpLattice2dControlPointOffsetsKeyformCommand,
  type EditorWorkflowBindRigControlChildCommand,
  type EditorWorkflowBindWarpLattice2dChildCommand,
  type EditorWorkflowCreateRotation2dRigControlCommand,
  type EditorWorkflowCreateWarpLattice2dRigControlCommand,
  type EditorWorkflowRigControlCommitResult
} from "./rig-control-workflow.js";
import {
  commitWorkflowAddDrawableOpacityKeyform,
  commitWorkflowSetMaskRelation,
  type EditorWorkflowAddDrawableOpacityKeyformCommand,
  type EditorWorkflowCompositionCommitResult,
  type EditorWorkflowSetMaskRelationCommand
} from "./composition-workflow.js";
import {
  commitWorkflowCreatePart,
  commitWorkflowMoveDrawableLayer,
  commitWorkflowSetDrawablePart,
  commitWorkflowSetDrawableRuntimeVisibility,
  commitWorkflowSetDrawableTexture,
  commitWorkflowToggleDrawableRuntimeVisibility,
  commitWorkflowUpdatePart,
  selectWorkflowDrawableLayer,
  toggleWorkflowDrawableEditorHidden,
  toggleWorkflowDrawableLayerLock,
  type EditorDrawableLayerMoveDirection,
  type EditorWorkflowLayerDraftResult,
  type EditorWorkflowLayerMoveResult,
  type EditorWorkflowLayerVisibilityResult,
  type EditorWorkflowPartTextureCommitResult
} from "./part-texture-layer-workflow.js";
import {
  clearWorkflowLayerTreeDirectManipulationDraft,
  commitWorkflowLayerTreeDirectManipulationDrafts,
  draftWorkflowLayerTreeDrawablePartAssignment,
  draftWorkflowLayerTreeDrawableTextureAssignment,
  draftWorkflowLayerTreeEmptyLeafPartDelete,
  draftWorkflowLayerTreePartRename,
  draftWorkflowLayerTreePartReparent,
  type EditorWorkflowLayerTreeDirectDraftResult,
  type EditorWorkflowLayerTreeDirectManipulationCommitResult
} from "./layer-tree-direct-manipulation-workflow.js";
import {
  createWorkflowDynamicsPreviewRunner,
  type EditorWorkflowDynamicsPreviewResult
} from "./dynamics-preview-workflow.js";
import {
  projectViewerRuntimeProjection,
  type EditorViewerRuntimeProjection
} from "./viewer-runtime-workflow.js";
import {
  commitWorkflowMeshCanvasMove,
  selectWorkflowMeshCanvasHitTarget,
  selectWorkflowMeshCanvasVertex,
  type EditorWorkflowMeshCanvasMoveResult,
  type EditorWorkflowMeshCanvasSelectionResult
} from "./mesh-canvas-workflow.js";
import {
  commitWorkflowAddMeshTriangle,
  commitWorkflowAddMeshVertex,
  commitWorkflowMoveMeshUvPoint,
  commitWorkflowRemoveMeshTriangle,
  commitWorkflowRemoveMeshVertex,
  type EditorWorkflowMeshTopologyCommitResult
} from "./mesh-topology-workflow.js";
import {
  commitWorkflowTutorialSmallMeshEdit,
  createWorkflowTutorialMiniModel,
  type EditorWorkflowTutorialCreateResult,
  type EditorWorkflowTutorialSmallEditResult
} from "./tutorial-mini-model-workflow.js";

export type {
  EditorWorkflowCreateDynamicsGroupCommand,
  EditorWorkflowDynamicsCreateResult,
  EditorWorkflowDynamicsUpdateResult
} from "./dynamics-group-workflow.js";
export type {
  EditorWorkflowDynamicsPreviewResult
} from "./dynamics-preview-workflow.js";
export type {
  EditorDrawableLayerMoveDirection,
  EditorWorkflowLayerActionCommitResult,
  EditorWorkflowLayerActionNotFoundResult,
  EditorWorkflowLayerDraftActionResult,
  EditorWorkflowLayerDraftResult,
  EditorWorkflowLayerLockedResult,
  EditorWorkflowLayerMoveNotMovableResult,
  EditorWorkflowLayerMoveResult,
  EditorWorkflowLayerVisibilityResult,
  EditorWorkflowPartTextureCommitResult
} from "./part-texture-layer-workflow.js";
export type {
  EditorWorkflowLayerTreeDirectDraftNotFoundResult,
  EditorWorkflowLayerTreeDirectDraftResult,
  EditorWorkflowLayerTreeDirectDraftUpdatedResult,
  EditorWorkflowLayerTreeDirectManipulationCommitResult,
  EditorWorkflowLayerTreeDirectManipulationSkippedDraft
} from "./layer-tree-direct-manipulation-workflow.js";
export interface EditorWorkflowControllerOptions {
  readonly projectStore: BrowserProjectStore;
  readonly persistentByteStore?: EditorPersistentByteStore;
  readonly now?: () => Date;
}

export interface EditorWorkflowSaveResult {
  readonly status: "saved";
  readonly snapshot: EditorSessionPersistenceSnapshot;
  readonly storeResult: SaveEditorProjectResult;
}

export interface EditorWorkflowLoadLoadedResult {
  readonly status: "loaded";
  readonly storeResult: Extract<LoadEditorProjectResult, { readonly status: "loaded" }>;
  readonly packageFileSet: PackageFileSet;
}

export interface EditorWorkflowLoadPersistentBytesLoadedResult
  extends EditorWorkflowLoadLoadedResult {
  readonly persistentByteRestore: EditorSessionPersistentByteRestoreResult;
  readonly restoredSnapshot: EditorSessionPersistenceSnapshot;
}

export interface EditorWorkflowLoadEmptyResult {
  readonly status: "empty";
  readonly storeResult: Extract<LoadEditorProjectResult, { readonly status: "empty" }>;
}

export interface EditorWorkflowLoadFailedResult {
  readonly status: "failed";
  readonly storeResult: Extract<LoadEditorProjectResult, { readonly status: "failed" }>;
}

export type EditorWorkflowLoadResult =
  | EditorWorkflowLoadLoadedResult
  | EditorWorkflowLoadEmptyResult
  | EditorWorkflowLoadFailedResult;

export type EditorWorkflowLoadPersistentBytesResult =
  | EditorWorkflowLoadPersistentBytesLoadedResult
  | EditorWorkflowLoadEmptyResult
  | EditorWorkflowLoadFailedResult;

export interface EditorWorkflowResetResult {
  readonly status: "reset";
  readonly clearResult: ClearEditorProjectResult;
}

export type EditorWorkflowPersistenceResult =
  | EditorWorkflowSaveResult
  | EditorWorkflowLoadResult
  | EditorWorkflowLoadPersistentBytesResult
  | EditorWorkflowResetResult
  | EditorWorkflowPortableBundleExportResult
  | EditorWorkflowPortableBundleImportResult;

export interface EditorWorkflowPreviewResetResult {
  readonly status: "reset";
  readonly parameterCount: number;
}

export interface EditorWorkflowViewerSurfaceResult {
  readonly status: "opened" | "closed";
}

export interface EditorWorkflowViewerResetResult {
  readonly status: "reset";
  readonly parameterCount: number;
}

export interface EditorWorkflowMeshVertexNudgeNotFoundResult {
  readonly status: "not_found";
  readonly meshId: string;
  readonly vertexId: string;
}

export interface EditorWorkflowMeshVertexNudgeNotEditableResult {
  readonly status: "not_editable";
  readonly meshId: string;
  readonly vertexId: string;
}

export interface EditorWorkflowMeshVertexNudgeInvalidDeltaResult {
  readonly status: "invalid_delta";
  readonly meshId: string;
  readonly vertexId: string;
}

export interface EditorWorkflowMeshVertexNudgeCommitResult {
  readonly status: "committed" | "rejected";
  readonly result: EditorSessionPersistenceResult;
}

export type EditorWorkflowMeshVertexNudgeResult =
  | EditorWorkflowMeshVertexNudgeNotFoundResult
  | EditorWorkflowMeshVertexNudgeNotEditableResult
  | EditorWorkflowMeshVertexNudgeInvalidDeltaResult
  | EditorWorkflowMeshVertexNudgeCommitResult;

export interface EditorWorkflowController {
  readonly state: EditorSemanticState;
  readonly viewModel: EditorWorkflowViewModel;
  readonly previewProjection: EditorPreviewProjectionDto | null;
  readonly viewerRuntimeProjection: EditorViewerRuntimeProjection | null;
  readonly aiCommandHost: EditorAiCommandHost;
  readonly latestSessionPersistenceResult: EditorSessionPersistenceResult | null;
  readonly latestDrawablePresetResult: EditorSessionDrawablePresetResult | null;
  readonly latestProjectPersistenceResult: EditorWorkflowPersistenceResult | null;
  commitCreateParameter(command: EditorCreateParameterCommand): EditorSessionPersistenceResult;
  commitCreateDrawablePreset(command: EditorCreateDrawablePresetCommand): EditorSessionDrawablePresetResult;
  commitCreatePart(command: EditorCreatePartCommand): EditorWorkflowPartTextureCommitResult;
  commitUpdatePart(command: EditorUpdatePartCommand): EditorWorkflowPartTextureCommitResult;
  commitSetDrawablePart(command: EditorSetDrawablePartCommand): EditorWorkflowPartTextureCommitResult;
  commitSetDrawableTexture(command: EditorSetDrawableTextureCommand): EditorWorkflowPartTextureCommitResult;
  draftLayerTreePartRename(command: LayerTreePartRenameDraftCommand): EditorWorkflowLayerTreeDirectDraftResult;
  draftLayerTreePartReparent(command: LayerTreePartReparentDraftCommand): EditorWorkflowLayerTreeDirectDraftResult;
  draftLayerTreeEmptyLeafPartDelete(
    command: LayerTreeEmptyLeafPartDeleteDraftCommand
  ): EditorWorkflowLayerTreeDirectDraftResult;
  draftLayerTreeDrawablePartAssignment(
    command: LayerTreeDrawablePartAssignmentDraftCommand
  ): EditorWorkflowLayerTreeDirectDraftResult;
  draftLayerTreeDrawableTextureAssignment(
    command: LayerTreeDrawableTextureAssignmentDraftCommand
  ): EditorWorkflowLayerTreeDirectDraftResult;
  commitLayerTreeDirectManipulationDrafts(): EditorWorkflowLayerTreeDirectManipulationCommitResult;
  clearLayerTreeDirectManipulationDrafts(): EditorWorkflowLayerTreeDirectDraftResult;
  selectDrawableLayer(drawableId: string): EditorWorkflowLayerDraftResult;
  toggleDrawableLayerLock(drawableId: string): EditorWorkflowLayerDraftResult;
  toggleDrawableEditorHidden(drawableId: string): EditorWorkflowLayerDraftResult;
  commitSourceIntakeDraft(draft: SourceIntakeDraftState): EditorWorkflowSourceImportCommitResult;
  commitSourceIntakeDraftWithSelectedFile(
    draft: SourceIntakeDraftState,
    selectedFileBytes: SourceIntakeSelectedFileBytes
  ): Promise<EditorWorkflowSourceImportCommitResult>;
  commitSetRightsMetadata(command: EditorSetRightsMetadataCommand): EditorWorkflowSourceImportCommitResult;
  setDrawableRuntimeVisibility(
    drawableId: string,
    runtimeVisibility: boolean
  ): EditorWorkflowLayerVisibilityResult;
  toggleDrawableRuntimeVisibility(drawableId: string): EditorWorkflowLayerVisibilityResult;
  moveDrawableLayer(
    drawableId: string,
    direction: EditorDrawableLayerMoveDirection
  ): EditorWorkflowLayerMoveResult;
  selectMeshCanvasVertex(
    command: MeshCanvasVertexSelectionCommand
  ): EditorWorkflowMeshCanvasSelectionResult;
  selectMeshCanvasHitTarget(
    command: MeshCanvasHitSelectionCommand
  ): EditorWorkflowMeshCanvasSelectionResult;
  nudgeMeshCanvasSelection(delta: { readonly x: number; readonly y: number }): EditorWorkflowMeshCanvasMoveResult;
  dragMeshCanvasSelection(delta: { readonly x: number; readonly y: number }): EditorWorkflowMeshCanvasMoveResult;
  nudgeMeshVertex(command: EditorMeshVertexNudgeCommand): EditorWorkflowMeshVertexNudgeResult;
  addMeshVertex(command: MeshTopologyAddVertexDraftCommand): EditorWorkflowMeshTopologyCommitResult;
  removeSelectedMeshVertex(command: MeshTopologyRemoveVertexDraftCommand): EditorWorkflowMeshTopologyCommitResult;
  addMeshTriangle(command: MeshTopologyAddTriangleDraftCommand): EditorWorkflowMeshTopologyCommitResult;
  removeMeshTriangle(command: MeshTopologyRemoveTriangleDraftCommand): EditorWorkflowMeshTopologyCommitResult;
  nudgeMeshUv(command: MeshUvNudgeDraftCommand): EditorWorkflowMeshTopologyCommitResult;
  commitCreateDynamicsGroup(command: EditorWorkflowCreateDynamicsGroupCommand): EditorWorkflowDynamicsCreateResult;
  commitUpdateDynamicsGroup(command: EditorUpdateDynamicsGroupCommand): EditorWorkflowDynamicsUpdateResult;
  commitCreateRotation2dRigControl(
    command: EditorWorkflowCreateRotation2dRigControlCommand
  ): EditorWorkflowRigControlCommitResult;
  commitCreateWarpLattice2dRigControl(
    command: EditorWorkflowCreateWarpLattice2dRigControlCommand
  ): EditorWorkflowRigControlCommitResult;
  commitBindRigControlChild(command: EditorWorkflowBindRigControlChildCommand): EditorWorkflowRigControlCommitResult;
  commitBindWarpLattice2dChild(
    command: EditorWorkflowBindWarpLattice2dChildCommand
  ): EditorWorkflowRigControlCommitResult;
  commitAddWarpLattice2dControlPointOffsetsKeyform(
    command: EditorWorkflowAddWarpLattice2dControlPointOffsetsKeyformCommand
  ): EditorWorkflowRigControlCommitResult;
  commitSetMaskRelation(
    command: EditorWorkflowSetMaskRelationCommand
  ): EditorWorkflowCompositionCommitResult;
  commitAddDrawableOpacityKeyform(
    command: EditorWorkflowAddDrawableOpacityKeyformCommand
  ): EditorWorkflowCompositionCommitResult;
  resetDynamicsPreview(): EditorWorkflowDynamicsPreviewResult;
  runDynamicsPreview(frameCount: number): EditorWorkflowDynamicsPreviewResult;
  setPreviewParameterValue(parameterId: string, value: number): PreviewParameterSetResult;
  resetPreviewParameterValues(): EditorWorkflowPreviewResetResult;
  openViewerRuntimeSurface(): EditorWorkflowViewerSurfaceResult;
  closeViewerRuntimeSurface(): EditorWorkflowViewerSurfaceResult;
  setViewerParameterValue(parameterId: string, value: number): ViewerParameterSetResult;
  resetViewerParameterValues(): EditorWorkflowViewerResetResult;
  dryRunAiCreateParameterCommand(): Promise<EditorWorkflowAiDryRunResult>;
  approveLatestAiDryRun(): EditorWorkflowAiApprovalDecisionResult;
  rejectLatestAiDryRun(): EditorWorkflowAiApprovalDecisionResult;
  commitApprovedAiOperation(): Promise<EditorWorkflowAiCommitResult>;
  createTutorialMiniModel(): EditorWorkflowTutorialCreateResult;
  applyTutorialSmallEdit(): EditorWorkflowTutorialSmallEditResult;
  selectTutorialTarget(target: TutorialSelectedTargetState | null): void;
  saveProject(): EditorWorkflowSaveResult;
  loadProject(): EditorWorkflowLoadResult;
  loadProjectWithPersistentBytes(): Promise<EditorWorkflowLoadPersistentBytesResult>;
  exportPortableBundle(): Promise<EditorWorkflowPortableBundleExportResult>;
  importPortableBundle(bundle: unknown): Promise<EditorWorkflowPortableBundleImportResult>;
  resetToSamplePackage(): EditorWorkflowResetResult;
}

export const createEditorWorkflowController = (
  options: EditorWorkflowControllerOptions
): EditorWorkflowController => {
  const createSampleAdapter = (): EditorSessionAdapter =>
    createEditorSessionAdapter({
      ...(options.now === undefined ? {} : { now: options.now })
    });
  const persistentByteStore =
    options.persistentByteStore ?? createEditorIndexedDbPersistentByteStore();

  let adapter = createSampleAdapter();
  let state = createEditorWorkflowState(adapter, {
    ...(options.now === undefined ? {} : { now: options.now })
  });
  let latestSessionPersistenceResult: EditorSessionPersistenceResult | null = null;
  let latestDrawablePresetResult: EditorSessionDrawablePresetResult | null = null;
  let latestProjectPersistenceResult: EditorWorkflowPersistenceResult | null = null;
  const dynamicsPreviewRunner = createWorkflowDynamicsPreviewRunner({
    ...(options.now === undefined ? {} : { now: options.now })
  });
  const createAiHost = (input: {
    readonly transcript?: AiCommandTranscript;
  } = {}): EditorAiCommandHost =>
    createEditorAiCommandHost({
      operationHost: {
        dryRunOperation(request) {
          return adapter.dryRunOperation(request);
        },
        commitOperation(request) {
          const result = adapter.commitOperation(request);
          latestSessionPersistenceResult = result;
          latestDrawablePresetResult = null;
          if (result.operationResult.status === "committed") {
            state = applyEditorWorkflowCommitResult(state, adapter, result);
          }

          return result.operationResult;
        }
      },
      readHost: {
        getEditorState(payload) {
          return projectEditorAiState(state, payload.detail);
        },
        inspectModel() {
          return projectEditorInspectModel({
            state,
            packageDocument: adapter.createPersistenceSnapshot().document
          });
        },
        inspectTarget(payload) {
          return projectEditorInspectTarget(
            {
              state,
              packageDocument: adapter.createPersistenceSnapshot().document
            },
            payload.target,
            { includeReferences: payload.includeReferences }
          );
        },
        validatePackage(payload) {
          return projectEditorAiValidation({
            packageDocument: adapter.createPersistenceSnapshot().document,
            payload,
            ...(options.now === undefined ? {} : { createdAt: options.now().toISOString() })
          });
        },
        getOperationLog() {
          return adapter.getOperationLogEntries();
        }
      },
      ...(input.transcript === undefined ? {} : { transcript: input.transcript })
    });
  let aiCommandHost = createAiHost();
  const aiApprovalActions = createWorkflowAiApprovalActions({
    getState: () => state,
    setState(nextState) {
      state = nextState;
    },
    getAiCommandHost: () => aiCommandHost,
    setAiCommandHost(nextAiCommandHost) {
      aiCommandHost = nextAiCommandHost;
    },
    createAiCommandHost: createAiHost
  });
  const clearDynamicsPreview = (): void => {
    state = dynamicsPreviewRunner.clear(state);
  };

  return {
    get state() {
      return state;
    },
    get viewModel() {
      return projectEditorWorkflowViewModel(state);
    },
    get previewProjection() {
      return dynamicsPreviewRunner.projectPreviewProjection({ adapter, state });
    },
    get viewerRuntimeProjection() {
      return projectViewerRuntimeProjection({
        adapter,
        state,
        ...(options.now === undefined ? {} : { now: options.now })
      });
    },
    get aiCommandHost() {
      return aiCommandHost;
    },
    get latestSessionPersistenceResult() {
      return latestSessionPersistenceResult;
    },
    get latestDrawablePresetResult() {
      return latestDrawablePresetResult;
    },
    get latestProjectPersistenceResult() {
      return latestProjectPersistenceResult;
    },
    commitCreateParameter(command) {
      const result = adapter.commitCreateParameter(command);

      latestSessionPersistenceResult = result;
      latestDrawablePresetResult = null;
      state = applyEditorWorkflowCommitResult(state, adapter, result);
      clearDynamicsPreview();

      return result;
    },
    commitCreateDrawablePreset(command) {
      const result = adapter.commitCreateDrawablePreset(
        completeCreateDrawablePresetCommand(command, state.pendingCreateDrawable)
      );

      latestDrawablePresetResult = result;
      latestSessionPersistenceResult = result.finalPersistenceResult;
      state = applyEditorWorkflowCommitResult(state, adapter, result.createDrawable);
      if (result.generateMesh !== null) {
        state = applyEditorWorkflowCommitResult(state, adapter, result.generateMesh);
      }
      clearDynamicsPreview();

      return result;
    },
    commitCreatePart(command) {
      const outcome = commitWorkflowCreatePart({
        adapter,
        state,
        command
      });

      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
      state = outcome.state;
      clearDynamicsPreview();

      return outcome.result;
    },
    commitUpdatePart(command) {
      const outcome = commitWorkflowUpdatePart({
        adapter,
        state,
        command
      });

      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
      state = outcome.state;
      clearDynamicsPreview();

      return outcome.result;
    },
    commitSetDrawablePart(command) {
      const outcome = commitWorkflowSetDrawablePart({
        adapter,
        state,
        command
      });

      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
      state = outcome.state;
      clearDynamicsPreview();

      return outcome.result;
    },
    commitSetDrawableTexture(command) {
      const outcome = commitWorkflowSetDrawableTexture({
        adapter,
        state,
        command
      });

      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
      state = outcome.state;
      clearDynamicsPreview();

      return outcome.result;
    },
    draftLayerTreePartRename(command) {
      const outcome = draftWorkflowLayerTreePartRename({
        state,
        command
      });

      state = outcome.state;
      return outcome.result;
    },
    draftLayerTreePartReparent(command) {
      const outcome = draftWorkflowLayerTreePartReparent({
        state,
        command
      });

      state = outcome.state;
      return outcome.result;
    },
    draftLayerTreeEmptyLeafPartDelete(command) {
      const outcome = draftWorkflowLayerTreeEmptyLeafPartDelete({
        state,
        command
      });

      state = outcome.state;
      return outcome.result;
    },
    draftLayerTreeDrawablePartAssignment(command) {
      const outcome = draftWorkflowLayerTreeDrawablePartAssignment({
        state,
        command
      });

      state = outcome.state;
      return outcome.result;
    },
    draftLayerTreeDrawableTextureAssignment(command) {
      const outcome = draftWorkflowLayerTreeDrawableTextureAssignment({
        state,
        command
      });

      state = outcome.state;
      return outcome.result;
    },
    commitLayerTreeDirectManipulationDrafts() {
      const outcome = commitWorkflowLayerTreeDirectManipulationDrafts({
        adapter,
        state
      });

      state = outcome.state;
      if (outcome.latestSessionPersistenceResult !== null) {
        latestDrawablePresetResult = null;
        latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
        clearDynamicsPreview();
      }

      return outcome.result;
    },
    clearLayerTreeDirectManipulationDrafts() {
      state = clearWorkflowLayerTreeDirectManipulationDraft(state);

      return {
        status: "updated",
        targetKind: "part",
        targetId: "layerTreeDirectManipulation"
      };
    },
    selectDrawableLayer(drawableId) {
      const outcome = selectWorkflowDrawableLayer({
        state,
        drawableId
      });

      state = outcome.state;
      return outcome.result;
    },
    toggleDrawableLayerLock(drawableId) {
      const outcome = toggleWorkflowDrawableLayerLock({
        state,
        drawableId
      });

      state = outcome.state;
      return outcome.result;
    },
    toggleDrawableEditorHidden(drawableId) {
      const outcome = toggleWorkflowDrawableEditorHidden({
        state,
        drawableId
      });

      state = outcome.state;
      return outcome.result;
    },
    commitSourceIntakeDraft(draft) {
      const result = adapter.commitOperation(
        createSourceIntakeImportOperationRequest(draft, adapter.authoringSession.packageRevision)
      );
      const outcome = projectWorkflowSourceIntakeCommitResult({
        state,
        adapter,
        draft,
        result
      });

      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = result;
      state = outcome.state;
      clearDynamicsPreview();

      return outcome.result;
    },
    async commitSourceIntakeDraftWithSelectedFile(draft, selectedFileBytes) {
      if (draft.intakeMode !== "psdAdapterProfile") {
        return this.commitSourceIntakeDraft(draft);
      }

      const draftWithSelectedFile = applySelectedFileBytesToSourceIntakeDraft(draft, selectedFileBytes);
      const result = await adapter.commitImportPsdSourceAssetWithBinaryBytes(
        createSourceIntakePsdImportCommandWithBinaryBytes(
          draftWithSelectedFile,
          adapter.authoringSession.packageRevision,
          selectedFileBytes
        )
      );
      if (result.operationResult.status === "committed") {
        await storeEditorPersistentSourceBinaryBytes({
          persistentByteStore,
          packageDocument: result.reloadedDocument,
          sourceAssetId: draftWithSelectedFile.sourceAssetId,
          bytes: selectedFileBytes.bytes,
          ...(options.now === undefined ? {} : { now: options.now })
        });
      }
      const outcome = projectWorkflowSourceIntakeCommitResult({
        state,
        adapter,
        draft: draftWithSelectedFile,
        result
      });

      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = result;
      state = outcome.state;
      clearDynamicsPreview();

      return outcome.result;
    },
    commitSetRightsMetadata(command) {
      const result = adapter.commitSetRightsMetadata(command);

      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = result;
      state = applyEditorWorkflowCommitResult(state, adapter, result);
      clearDynamicsPreview();

      return {
        status: result.operationResult.status === "committed" ? "committed" : "rejected",
        result
      };
    },
    setDrawableRuntimeVisibility(drawableId, runtimeVisibility) {
      const outcome = commitWorkflowSetDrawableRuntimeVisibility({
        adapter,
        state,
        drawableId,
        runtimeVisibility
      });

      state = outcome.state;
      if (outcome.latestSessionPersistenceResult !== null) {
        latestDrawablePresetResult = null;
        latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
        clearDynamicsPreview();
      }

      return outcome.result;
    },
    toggleDrawableRuntimeVisibility(drawableId) {
      const outcome = commitWorkflowToggleDrawableRuntimeVisibility({
        adapter,
        state,
        drawableId
      });

      state = outcome.state;
      if (outcome.latestSessionPersistenceResult !== null) {
        latestDrawablePresetResult = null;
        latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
        clearDynamicsPreview();
      }

      return outcome.result;
    },
    moveDrawableLayer(drawableId, direction) {
      const outcome = commitWorkflowMoveDrawableLayer({
        adapter,
        state,
        drawableId,
        direction
      });

      state = outcome.state;
      if (outcome.latestSessionPersistenceResult !== null) {
        latestDrawablePresetResult = null;
        latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
        clearDynamicsPreview();
      }

      return outcome.result;
    },
    selectMeshCanvasVertex(command) {
      const outcome = selectWorkflowMeshCanvasVertex({
        state,
        command
      });

      state = outcome.state;
      return outcome.result;
    },
    selectMeshCanvasHitTarget(command) {
      const outcome = selectWorkflowMeshCanvasHitTarget({
        state,
        command
      });

      state = outcome.state;
      return outcome.result;
    },
    nudgeMeshCanvasSelection(delta) {
      const outcome = commitWorkflowMeshCanvasMove({
        adapter,
        state,
        delta,
        source: "canvasNudge"
      });

      state = outcome.state;
      if (outcome.latestSessionPersistenceResult !== null) {
        latestDrawablePresetResult = null;
        latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
        clearDynamicsPreview();
      }

      return outcome.result;
    },
    dragMeshCanvasSelection(delta) {
      const outcome = commitWorkflowMeshCanvasMove({
        adapter,
        state,
        delta,
        source: "canvasDrag"
      });

      state = outcome.state;
      if (outcome.latestSessionPersistenceResult !== null) {
        latestDrawablePresetResult = null;
        latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
        clearDynamicsPreview();
      }

      return outcome.result;
    },
    nudgeMeshVertex(command) {
      const selectedMesh = state.meshEdit.selectedMesh;
      if (selectedMesh === null || selectedMesh.meshId !== command.meshId) {
        return {
          status: "not_found",
          meshId: String(command.meshId),
          vertexId: String(command.vertexId)
        };
      }

      const editableVertex = state.meshEdit.editableVertices.find(
        (vertex) => vertex.vertexId === command.vertexId
      );
      if (editableVertex === undefined) {
        return {
          status: "not_editable",
          meshId: String(command.meshId),
          vertexId: String(command.vertexId)
        };
      }

      if (!state.meshEdit.canNudgeSelectedMesh) {
        return {
          status: "not_editable",
          meshId: String(command.meshId),
          vertexId: String(command.vertexId)
        };
      }

      if (!isValidMeshVertexNudgeDelta(command.delta)) {
        return {
          status: "invalid_delta",
          meshId: String(command.meshId),
          vertexId: String(command.vertexId)
        };
      }

      const result = adapter.commitMoveMeshVertex({
        operationId:
          command.operationId ??
          createMeshVertexOperationId(
            "move_mesh_vertex",
            command.meshId,
            command.vertexId,
            adapter.authoringSession.packageRevision
          ),
        meshId: command.meshId,
        vertexDeltas: [
          {
            vertexId: command.vertexId,
            delta: command.delta
          }
        ],
        lockedTargetIds: state.layerTreeDraft.lockedIds,
        intent: command.intent ?? "editor mesh vertex nudge"
      });

      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = result;
      state = applyEditorWorkflowCommitResult(state, adapter, result);
      clearDynamicsPreview();

      return {
        status: result.operationResult.status === "committed" ? "committed" : "rejected",
        result
      };
    },
    addMeshVertex(command) {
      const outcome = commitWorkflowAddMeshVertex({ adapter, state, command });

      state = outcome.state;
      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
      clearDynamicsPreview();

      return outcome.result;
    },
    removeSelectedMeshVertex(command) {
      const outcome = commitWorkflowRemoveMeshVertex({ adapter, state, command });

      state = outcome.state;
      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
      clearDynamicsPreview();

      return outcome.result;
    },
    addMeshTriangle(command) {
      const outcome = commitWorkflowAddMeshTriangle({ adapter, state, command });

      state = outcome.state;
      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
      clearDynamicsPreview();

      return outcome.result;
    },
    removeMeshTriangle(command) {
      const outcome = commitWorkflowRemoveMeshTriangle({ adapter, state, command });

      state = outcome.state;
      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
      clearDynamicsPreview();

      return outcome.result;
    },
    nudgeMeshUv(command) {
      const outcome = commitWorkflowMoveMeshUvPoint({ adapter, state, command });

      state = outcome.state;
      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
      clearDynamicsPreview();

      return outcome.result;
    },
    commitCreateDynamicsGroup(command) {
      const outcome = commitWorkflowCreateDynamicsGroup({ adapter, state, command });
      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
      state = outcome.state;

      return outcome.result;
    },
    commitUpdateDynamicsGroup(command) {
      const outcome = commitWorkflowUpdateDynamicsGroup({ adapter, state, command });
      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
      state = outcome.state;

      return outcome.result;
    },
    commitCreateRotation2dRigControl(command) {
      const outcome = commitWorkflowCreateRotation2dRigControl({ adapter, state, command });
      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
      state = outcome.state;
      clearDynamicsPreview();

      return outcome.result;
    },
    commitCreateWarpLattice2dRigControl(command) {
      const outcome = commitWorkflowCreateWarpLattice2dRigControl({ adapter, state, command });
      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
      state = outcome.state;
      clearDynamicsPreview();

      return outcome.result;
    },
    commitBindRigControlChild(command) {
      const outcome = commitWorkflowBindRigControlChild({ adapter, state, command });
      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
      state = outcome.state;
      clearDynamicsPreview();

      return outcome.result;
    },
    commitBindWarpLattice2dChild(command) {
      const outcome = commitWorkflowBindWarpLattice2dChild({ adapter, state, command });
      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
      state = outcome.state;
      clearDynamicsPreview();

      return outcome.result;
    },
    commitAddWarpLattice2dControlPointOffsetsKeyform(command) {
      const outcome = commitWorkflowAddWarpLattice2dControlPointOffsetsKeyform({ adapter, state, command });
      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
      state = outcome.state;
      clearDynamicsPreview();

      return outcome.result;
    },
    commitSetMaskRelation(command) {
      const outcome = commitWorkflowSetMaskRelation({ adapter, state, command });
      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
      state = outcome.state;
      clearDynamicsPreview();

      return outcome.result;
    },
    commitAddDrawableOpacityKeyform(command) {
      const outcome = commitWorkflowAddDrawableOpacityKeyform({ adapter, state, command });
      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
      state = outcome.state;
      clearDynamicsPreview();

      return outcome.result;
    },
    resetDynamicsPreview() {
      const preview = dynamicsPreviewRunner.reset({ adapter, state });
      state = preview.state;

      return preview.result;
    },
    runDynamicsPreview(frameCount) {
      const preview = dynamicsPreviewRunner.run({ adapter, state, frameCount });
      state = preview.state;

      return preview.result;
    },
    setPreviewParameterValue(parameterId, value) {
      const projection = applyPreviewParameterValue(state.previewParameters, {
        parameterId,
        value
      });

      if (projection.result.status === "updated") {
        state = {
          ...state,
          previewParameters: projection.parameters
        };
      }

      return projection.result;
    },
    resetPreviewParameterValues() {
      const previewParameters = resetPreviewParameterValueStates(state.previewParameters);

      state = {
        ...state,
        previewParameters
      };

      return {
        status: "reset",
        parameterCount: previewParameters.length
      };
    },
    openViewerRuntimeSurface() {
      state = {
        ...state,
        viewerRuntime: openViewerRuntimeStateSurface(state.viewerRuntime)
      };

      return {
        status: "opened"
      };
    },
    closeViewerRuntimeSurface() {
      state = {
        ...state,
        viewerRuntime: closeViewerRuntimeStateSurface(state.viewerRuntime)
      };

      return {
        status: "closed"
      };
    },
    setViewerParameterValue(parameterId, value) {
      const projection = applyViewerParameterValue(state.viewerRuntime, {
        parameterId,
        value
      });

      if (projection.result.status === "updated") {
        state = {
          ...state,
          viewerRuntime: projection.viewerRuntime
        };
      }

      return projection.result;
    },
    resetViewerParameterValues() {
      const viewerRuntime = resetViewerRuntimeParameterValues(state.viewerRuntime);

      state = {
        ...state,
        viewerRuntime
      };

      return {
        status: "reset",
        parameterCount: viewerRuntime.parameters.length
      };
    },
    dryRunAiCreateParameterCommand: aiApprovalActions.dryRunAiCreateParameterCommand,
    approveLatestAiDryRun: aiApprovalActions.approveLatestAiDryRun,
    rejectLatestAiDryRun: aiApprovalActions.rejectLatestAiDryRun,
    async commitApprovedAiOperation() {
      const result = await aiApprovalActions.commitApprovedAiOperation();
      if (result.status === "committed") {
        clearDynamicsPreview();
      }
      return result;
    },
    createTutorialMiniModel() {
      const outcome = createWorkflowTutorialMiniModel({
        ...(options.now === undefined ? {} : { now: options.now })
      });
      adapter = outcome.adapter;
      state = outcome.state;
      latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
      latestDrawablePresetResult = null;
      latestProjectPersistenceResult = null;
      aiApprovalActions.reset();
      clearDynamicsPreview();

      return outcome.result;
    },
    applyTutorialSmallEdit() {
      const outcome = commitWorkflowTutorialSmallMeshEdit({ adapter, state });
      state = outcome.state;
      if (outcome.latestSessionPersistenceResult !== null) {
        latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
        latestDrawablePresetResult = null;
        clearDynamicsPreview();
      }

      return outcome.result;
    },
    selectTutorialTarget(target) {
      state = selectTutorialTargetInEditorState(state, target);
    },
    saveProject() {
      const snapshot = adapter.createPersistenceSnapshot({
        editorState: createEditorStateFileFromEditorState(state)
      });
      const storeResult = options.projectStore.saveProject({
        packageFileSet: snapshot.packageFileSet,
        operationLogJsonl: snapshot.operationLogJsonl,
        aiCommandTranscript: serializeAiCommandTranscript(aiCommandHost.transcript),
        generatedArtifactPaths: snapshot.generatedArtifactPaths
      });
      const result: EditorWorkflowSaveResult = {
        status: "saved",
        snapshot,
        storeResult
      };

      latestProjectPersistenceResult = result;

      return result;
    },
    loadProject() {
      const storeResult = options.projectStore.loadProject();

      if (storeResult.status !== "loaded") {
        const result: EditorWorkflowLoadResult =
          storeResult.status === "empty"
            ? { status: "empty", storeResult }
            : { status: "failed", storeResult };
        aiApprovalActions.reset();
        latestProjectPersistenceResult = result;
        return result;
      }

      const project = storeResult.project;
      const document = parsePackageDocumentFromFileSet(project.packageFileSet);
      const operationLogEntries = parseOperationLogEntriesFromJsonl(project.operationLogJsonl);
      adapter = createEditorSessionAdapter({
        packageDocument: document,
        initialOperationLogEntries: operationLogEntries,
        initialGeneratedArtifactEntries: selectGeneratedArtifactEntries({
          packageFileSet: project.packageFileSet,
          generatedArtifactPaths: project.generatedArtifactPaths
        }),
        packageHash: `persisted:${project.packageSummary.packageId}:r${project.packageSummary.packageRevision}`,
        ...(options.now === undefined ? {} : { now: options.now })
      });
      state = projectLoadedEditorWorkflowState({
        document,
        packageFileSet: project.packageFileSet,
        operationLogEntries,
        generatedArtifactPaths: project.generatedArtifactPaths,
        ...(options.now === undefined ? {} : { now: options.now })
      });
      latestSessionPersistenceResult = null;
      latestDrawablePresetResult = null;
      aiApprovalActions.reset({
        transcript: hydrateInMemoryAiCommandTranscript(project.aiCommandTranscript)
      });
      clearDynamicsPreview();

      const result: EditorWorkflowLoadResult = {
        status: "loaded",
        storeResult,
        packageFileSet: project.packageFileSet
      };
      latestProjectPersistenceResult = result;

      return result;
    },
    async loadProjectWithPersistentBytes() {
      const loaded = this.loadProject();

      if (loaded.status !== "loaded") {
        return loaded;
      }

      const project = loaded.storeResult.project;
      const document = parsePackageDocumentFromFileSet(project.packageFileSet);
      const loadedAiApproval = state.aiApproval;
      const persistentByteRestore = await restoreEditorSessionPersistentBinaryBytes({
        persistentByteStore,
        authoringSession: adapter.authoringSession,
        packageDocument: document
      });
      const restoredSnapshot = adapter.createPersistenceSnapshot({
        editorState: createEditorStateFileFromEditorState(state)
      });
      const operationLogEntries = parseOperationLogEntriesFromJsonl(project.operationLogJsonl);

      state = {
        ...projectLoadedEditorWorkflowState({
          document,
          packageFileSet: project.packageFileSet,
          operationLogEntries,
          generatedArtifactPaths: project.generatedArtifactPaths,
          binaryByteIntake: {
            sourceAssets: document.assets.sourceManifest.sourceAssets,
            ...(document.assets.textureAtlas === undefined
              ? {}
              : { textureAtlas: document.assets.textureAtlas }),
            byteIntakeSummaries: restoredSnapshot.binaryByteEvidence.byteIntakeSummaries,
            packageLocalBinaryFilePaths:
              restoredSnapshot.binaryByteEvidence.packageLocalBinaryFilePaths,
            reloadSource: "browserLocalLoad"
          },
          ...(options.now === undefined ? {} : { now: options.now })
        }),
        aiApproval: loadedAiApproval
      };
      clearDynamicsPreview();

      const result: EditorWorkflowLoadPersistentBytesResult = {
        ...loaded,
        persistentByteRestore,
        restoredSnapshot
      };
      latestProjectPersistenceResult = result;

      return result;
    },
    async exportPortableBundle() {
      const snapshot = adapter.createPersistenceSnapshot({
        editorState: createEditorStateFileFromEditorState(state)
      });
      const result = await exportEditorWorkflowPortableBundleV0({ snapshot });

      latestProjectPersistenceResult = result;

      return result;
    },
    async importPortableBundle(bundle) {
      const result = await importEditorWorkflowPortableBundleV0({
        bundle,
        persistentByteStore,
        ...(options.now === undefined ? {} : { now: options.now })
      });

      if (result.status === "portableImported") {
        adapter = result.adapter;
        state = result.state;
        latestSessionPersistenceResult = null;
        latestDrawablePresetResult = null;
        aiApprovalActions.reset();
        clearDynamicsPreview();
      }

      latestProjectPersistenceResult = result;

      return result;
    },
    resetToSamplePackage() {
      const clearResult = options.projectStore.clearProject();
      adapter = createSampleAdapter();
      state = createEditorWorkflowState(adapter, {
        ...(options.now === undefined ? {} : { now: options.now })
      });
      latestSessionPersistenceResult = null;
      latestDrawablePresetResult = null;
      aiApprovalActions.reset();
      clearDynamicsPreview();

      const result: EditorWorkflowResetResult = {
        status: "reset",
        clearResult
      };
      latestProjectPersistenceResult = result;

      return result;
    }
  };
};

const completeCreateDrawablePresetCommand = (
  command: EditorCreateDrawablePresetCommand,
  draft: CreateDrawableFormState
): EditorCreateDrawablePresetCommand => {
  const commandSourceLayerId = command.sourceLayerId ?? null;
  const canInheritDraftTexture =
    command.textureId === undefined &&
    String(command.sourceAssetId) === draft.sourceAssetId &&
    commandSourceLayerId === draft.sourceLayerId &&
    draft.textureId.trim().length > 0;

  if (!canInheritDraftTexture) {
    return command;
  }

  return {
    ...command,
    textureId: draft.textureId.trim(),
    ...(String(command.partId).trim().length === 0 && draft.partId.trim().length > 0
      ? { partId: draft.partId.trim() }
      : {})
  };
};

const createMeshVertexOperationId = (
  operation: string,
  meshId: string,
  vertexId: string,
  packageRevision: number
): string =>
  `op_editor_${operation}_${sanitizeOperationIdToken(meshId)}_${sanitizeOperationIdToken(vertexId)}_r${packageRevision}`;

const sanitizeOperationIdToken = (text: string): string =>
  text.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();

const isValidMeshVertexNudgeDelta = (delta: {
  readonly x: number;
  readonly y: number;
}): boolean =>
  Number.isFinite(delta.x) &&
  Number.isFinite(delta.y) &&
  (delta.x !== 0 || delta.y !== 0);

const selectGeneratedArtifactEntries = (input: {
  readonly packageFileSet: PackageFileSet;
  readonly generatedArtifactPaths: readonly string[];
}): PackageFileSet => {
  const generatedPathSet = new Set(input.generatedArtifactPaths);

  return input.packageFileSet.filter((entry) => generatedPathSet.has(entry.path));
};
