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
  type EditorCreateDrawablePresetCommand,
  type EditorCreateParameterCommand,
  type EditorMeshVertexNudgeCommand,
  type EditorSessionAdapter,
  type EditorSessionDrawablePresetResult,
  type EditorSessionPersistenceResult,
  type EditorSetRightsMetadataCommand,
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
  openViewerRuntimeSurface as openViewerRuntimeStateSurface,
  projectEditorWorkflowViewModel,
  projectCreateDrawableDefaultsForSourceSelection,
  resetPreviewParameterValues as resetPreviewParameterValueStates,
  resetViewerParameterValues as resetViewerRuntimeParameterValues,
  type PreviewParameterSetResult,
  type ViewerParameterSetResult,
  type CreateDrawableFormState,
  type EditorSemanticState,
  type EditorWorkflowViewModel,
  type SourceIntakeDraftState
} from "../editor-state/index.js";
import {
  createWorkflowAiApprovalActions,
  type EditorWorkflowAiApprovalDecisionResult,
  type EditorWorkflowAiCommitResult,
  type EditorWorkflowAiDryRunResult
} from "./workflow-ai-approval-actions.js";
import {
  applyEditorWorkflowCommitResult,
  createEditorWorkflowState,
  projectLoadedEditorWorkflowState
} from "./workflow-state-projection.js";
import {
  applySourceImportResultToDraft,
  createSourceIntakeImportOperationRequest,
  projectImportedSourceSelection,
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
  createWorkflowDynamicsPreviewRunner,
  type EditorWorkflowDynamicsPreviewResult
} from "./dynamics-preview-workflow.js";
import {
  projectViewerRuntimeProjection,
  type EditorViewerRuntimeProjection
} from "./viewer-runtime-workflow.js";

export type {
  EditorWorkflowCreateDynamicsGroupCommand,
  EditorWorkflowDynamicsCreateResult,
  EditorWorkflowDynamicsUpdateResult
} from "./dynamics-group-workflow.js";
export type {
  EditorWorkflowDynamicsPreviewResult
} from "./dynamics-preview-workflow.js";

export interface EditorWorkflowControllerOptions {
  readonly projectStore: BrowserProjectStore;
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

export interface EditorWorkflowResetResult {
  readonly status: "reset";
  readonly clearResult: ClearEditorProjectResult;
}

export type EditorWorkflowPersistenceResult =
  | EditorWorkflowSaveResult
  | EditorWorkflowLoadResult
  | EditorWorkflowResetResult;

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

export type EditorDrawableLayerMoveDirection = "up" | "down";

export interface EditorWorkflowLayerActionNotFoundResult {
  readonly status: "not_found";
  readonly drawableId: string;
}

export interface EditorWorkflowLayerMoveNotMovableResult {
  readonly status: "not_movable";
  readonly drawableId: string;
  readonly direction: EditorDrawableLayerMoveDirection;
}

export interface EditorWorkflowLayerActionCommitResult {
  readonly status: "committed" | "rejected";
  readonly result: EditorSessionPersistenceResult;
}

export type EditorWorkflowLayerVisibilityResult =
  | EditorWorkflowLayerActionNotFoundResult
  | EditorWorkflowLayerActionCommitResult;

export type EditorWorkflowLayerMoveResult =
  | EditorWorkflowLayerActionNotFoundResult
  | EditorWorkflowLayerMoveNotMovableResult
  | EditorWorkflowLayerActionCommitResult;

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
  commitSourceIntakeDraft(draft: SourceIntakeDraftState): EditorWorkflowSourceImportCommitResult;
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
  nudgeMeshVertex(command: EditorMeshVertexNudgeCommand): EditorWorkflowMeshVertexNudgeResult;
  commitCreateDynamicsGroup(command: EditorWorkflowCreateDynamicsGroupCommand): EditorWorkflowDynamicsCreateResult;
  commitUpdateDynamicsGroup(command: EditorUpdateDynamicsGroupCommand): EditorWorkflowDynamicsUpdateResult;
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
  saveProject(): EditorWorkflowSaveResult;
  loadProject(): EditorWorkflowLoadResult;
  resetToSamplePackage(): EditorWorkflowResetResult;
}

export const createEditorWorkflowController = (
  options: EditorWorkflowControllerOptions
): EditorWorkflowController => {
  const createSampleAdapter = (): EditorSessionAdapter =>
    createEditorSessionAdapter({
      ...(options.now === undefined ? {} : { now: options.now })
    });

  let adapter = createSampleAdapter();
  let state = createEditorWorkflowState(adapter);
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
    commitSourceIntakeDraft(draft) {
      const result = adapter.commitOperation(
        createSourceIntakeImportOperationRequest(draft, adapter.authoringSession.packageRevision)
      );
      const committedState = applyEditorWorkflowCommitResult(state, adapter, result);
      const importedSourceSelection = projectImportedSourceSelection(draft);
      const sourceIntakeDraft = applySourceImportResultToDraft(draft, result);
      const nextPendingCreateDrawable =
        result.operationResult.status !== "committed"
          ? committedState.pendingCreateDrawable
          : projectCreateDrawableDefaultsForSourceSelection({
              sourceAssets: committedState.sourceAssets,
              parts: result.reloadedDocument.model.graph.parts,
              drawables: result.reloadedDocument.model.drawables.drawables,
              canvasSize: result.reloadedDocument.model.graph.canvasSize,
              preferredSourceAssetId: importedSourceSelection.sourceAssetId,
              ...(importedSourceSelection.sourceLayerId === undefined
                ? {}
                : { preferredSourceLayerId: importedSourceSelection.sourceLayerId }),
              ...(importedSourceSelection.textureId === undefined
                ? {}
                : { preferredTextureId: importedSourceSelection.textureId }),
              ...(importedSourceSelection.partId === undefined
                ? {}
                : { preferredPartId: importedSourceSelection.partId })
            });

      latestDrawablePresetResult = null;
      latestSessionPersistenceResult = result;
      state = {
        ...committedState,
        pendingCreateDrawable: nextPendingCreateDrawable,
        sourceIntakeDraft
      };
      clearDynamicsPreview();

      return {
        status: result.operationResult.status === "committed" ? "committed" : "rejected",
        result
      };
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
      if (!state.drawables.some((drawable) => drawable.drawableId === drawableId)) {
        return {
          status: "not_found",
          drawableId
        };
      }

      const result = adapter.commitSetDrawableRuntimeVisibility({
        operationId: createLayerOperationId(
          "set_runtime_visibility",
          drawableId,
          runtimeVisibility ? "show" : "hide",
          adapter.authoringSession.packageRevision
        ),
        drawableId,
        runtimeVisibility
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
    toggleDrawableRuntimeVisibility(drawableId) {
      const drawable = state.drawables.find((candidate) => candidate.drawableId === drawableId);
      if (drawable === undefined) {
        return {
          status: "not_found",
          drawableId
        };
      }

      return this.setDrawableRuntimeVisibility(drawableId, !drawable.visible);
    },
    moveDrawableLayer(drawableId, direction) {
      const move = createDrawableLayerMoveEntries(state.drawables, drawableId, direction);

      if (move.status !== "ready") {
        return move;
      }

      const result = adapter.commitSetDrawableDrawOrder({
        operationId: createLayerOperationId(
          "set_draw_order",
          drawableId,
          direction,
          adapter.authoringSession.packageRevision
        ),
        entries: move.entries
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
    saveProject() {
      const snapshot = adapter.createPersistenceSnapshot();
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
        generatedArtifactPaths: project.generatedArtifactPaths
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
    resetToSamplePackage() {
      const clearResult = options.projectStore.clearProject();
      adapter = createSampleAdapter();
      state = createEditorWorkflowState(adapter);
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

const createDrawableLayerMoveEntries = (
  drawables: EditorSemanticState["drawables"],
  drawableId: string,
  direction: EditorDrawableLayerMoveDirection
):
  | {
      readonly status: "ready";
      readonly entries: readonly { readonly drawableId: string; readonly baseDrawOrder: number }[];
    }
  | EditorWorkflowLayerActionNotFoundResult
  | EditorWorkflowLayerMoveNotMovableResult => {
  const ordered = [...drawables].sort((left, right) => left.orderIndex - right.orderIndex);
  const index = ordered.findIndex((drawable) => drawable.drawableId === drawableId);
  if (index < 0) {
    return {
      status: "not_found",
      drawableId
    };
  }

  const targetIndex = direction === "up" ? index + 1 : index - 1;
  if (targetIndex < 0 || targetIndex >= ordered.length) {
    return {
      status: "not_movable",
      drawableId,
      direction
    };
  }

  const reordered = [...ordered];
  const selected = reordered[index];
  const target = reordered[targetIndex];
  if (selected === undefined || target === undefined) {
    return {
      status: "not_movable",
      drawableId,
      direction
    };
  }

  reordered[index] = target;
  reordered[targetIndex] = selected;

  return {
    status: "ready",
    entries: reordered.map((drawable, baseDrawOrder) => ({
      drawableId: drawable.drawableId,
      baseDrawOrder
    }))
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

const createLayerOperationId = (
  operation: string,
  drawableId: string,
  action: string,
  packageRevision: number
): string =>
  `op_editor_${operation}_${sanitizeOperationIdToken(drawableId)}_${sanitizeOperationIdToken(action)}_r${packageRevision}`;

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
