import {
  createInitialEditorSemanticState,
  type EditorSemanticState
} from "./editor-semantic-state.js";
import {
  projectEditorBinaryByteIntakeState,
  type ProjectEditorBinaryByteIntakeStateInput
} from "./binary-byte-intake-state.js";
import {
  applyCreateDrawableDraftResult,
  projectCreateDrawableDefaults,
  projectCreateDrawableDefaultsForSourceSelection
} from "./create-drawable-form-state.js";
import { projectDrawableList } from "./drawable-list-state.js";
import {
  createEmptyDynamicsPreviewState,
  projectDynamicsGroupState,
  type DynamicsPreviewState
} from "./dynamics-authoring-state.js";
import {
  projectGeneratedEvidenceSummary,
  type GeneratedEvidenceSummaryInput
} from "./generated-evidence-summary.js";
import { projectMeshSelectedVertexIdsFromEditorState } from "./editor-state-file.js";
import { projectLayerTreeDraftState } from "./layer-tree-draft-state.js";
import { projectMeshEditState, reprojectMeshEditState } from "./mesh-edit-state.js";
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
import { projectPreviewParameterValues } from "./preview-parameter-state.js";
import {
  projectCompositionMaskRelationState,
  projectDrawableOpacityKeyformState
} from "./composition-authoring-state.js";
import { projectRigControlState } from "./rig-control-authoring-state.js";
import { projectRigControlAngleKeyformState } from "./rig-control-keyform-state.js";
import { projectTutorialGuidedWorkflowState } from "./tutorial-guided-workflow-state.js";
import type { TutorialReadinessPreflightState } from "./tutorial-readiness-preflight-state.js";
import { projectViewerRuntimeState } from "./viewer-runtime-state.js";
import { projectReloadSummary, type ReloadSummaryInput } from "./reload-summary.js";
import { createEmptySourceIntakeDraftState } from "./source-intake-draft-state.js";
import type {
  DrawableDto,
  DrawOrderEntryDto,
  DynamicsGroupDto,
  EditorStateFileDto,
  KeyformSetDto,
  MaskRelationDto,
  MeshDto,
  ModelPartDto,
  RigControlDto,
  SourceAssetDto,
  TextureAtlasFileDto
} from "@private-2d-rigging-lab/package-format";

export interface LoadedPackageSummaryInput {
  readonly identity: LoadedPackageIdentityInput;
  readonly revision: PackageRevisionInput;
  readonly parameters?: readonly ParameterProjectionInput[];
  readonly dynamicsGroups?: readonly DynamicsGroupDto[];
  readonly rigControls?: readonly RigControlDto[];
  readonly keyformSets?: readonly KeyformSetDto[];
  readonly masks?: readonly MaskRelationDto[];
  readonly drawables?: readonly DrawableDto[];
  readonly drawOrderEntries?: readonly DrawOrderEntryDto[];
  readonly meshes?: readonly MeshDto[];
  readonly parts?: readonly ModelPartDto[];
  readonly sourceAssets?: readonly SourceAssetDto[];
  readonly textureAtlas?: TextureAtlasFileDto;
  readonly binaryByteIntake?: ProjectEditorBinaryByteIntakeStateInput;
  readonly editorState?: EditorStateFileDto;
  readonly tutorialReadinessPreflight?: TutorialReadinessPreflightState;
  readonly canvasSize?: {
    readonly width: number;
    readonly height: number;
  };
}

export interface CommittedOperationSummaryInput {
  readonly result: OperationResultSummaryInput;
  readonly operationLogEntries: readonly OperationLogEntryProjectionInput[];
  readonly generatedEvidence?: GeneratedEvidenceSummaryInput;
  readonly dynamicsPreview?: DynamicsPreviewState;
  readonly revision?: PackageRevisionInput;
  readonly parameters?: readonly ParameterProjectionInput[];
  readonly dynamicsGroups?: readonly DynamicsGroupDto[];
  readonly rigControls?: readonly RigControlDto[];
  readonly keyformSets?: readonly KeyformSetDto[];
  readonly masks?: readonly MaskRelationDto[];
  readonly drawables?: readonly DrawableDto[];
  readonly drawOrderEntries?: readonly DrawOrderEntryDto[];
  readonly meshes?: readonly MeshDto[];
  readonly sourceAssets?: readonly SourceAssetDto[];
  readonly textureAtlas?: TextureAtlasFileDto;
  readonly binaryByteIntake?: ProjectEditorBinaryByteIntakeStateInput;
  readonly editorState?: EditorStateFileDto;
  readonly parts?: readonly ModelPartDto[];
  readonly canvasSize?: {
    readonly width: number;
    readonly height: number;
  };
  readonly importedSourceSelection?: {
    readonly sourceAssetId: string;
    readonly sourceLayerId?: string;
    readonly textureId?: string;
    readonly partId?: string;
  };
  readonly reload?: ReloadSummaryInput;
  readonly tutorialReadinessPreflight?: TutorialReadinessPreflightState;
}

export const projectLoadedPackageState = (
  input: LoadedPackageSummaryInput
): EditorSemanticState => {
  const initialState = createInitialEditorSemanticState();
  const loadedPackage = projectLoadedPackageIdentity(input.identity);
  const parts = input.parts ?? [];
  const rigControls = projectRigControlState(input.rigControls ?? []);
  const rigControlAngleKeyforms = projectRigControlAngleKeyformState(input.keyformSets ?? []);
  const maskRelations = projectCompositionMaskRelationState(input.masks ?? []);
  const drawableOpacityKeyforms = projectDrawableOpacityKeyformState(input.keyformSets ?? []);
  const dynamicsGroups = projectDynamicsGroupState(input.dynamicsGroups ?? []);
  const drawables = projectDrawableList(
    input.drawables ?? [],
    input.meshes ?? [],
    input.drawOrderEntries ?? []
  );
  const layerTreeDraft = projectLayerTreeDraftState(input.editorState);
  const meshEdit = projectMeshEditState(drawables, input.meshes ?? [], {
    layerTreeDraft,
    selectedVertexIds: projectMeshSelectedVertexIdsFromEditorState(input.editorState)
  });
  const textureAtlas = input.textureAtlas ?? null;
  const viewerRuntime = projectViewerRuntimeState(input.parameters ?? []);
  const tutorialReadinessPreflight =
    input.tutorialReadinessPreflight ?? initialState.tutorialReadinessPreflight;

  return {
    ...initialState,
    loadedPackage,
    revision: projectPackageRevision(input.revision),
    parameters: projectParameterList(input.parameters ?? []),
    parts,
    rigControls,
    rigControlAngleKeyforms,
    maskRelations,
    drawableOpacityKeyforms,
    dynamicsGroups,
    drawables,
    layerTreeDraft,
    meshEdit,
    pendingCreateDrawable: projectCreateDrawableDefaults({
      ...(input.sourceAssets === undefined ? {} : { sourceAssets: input.sourceAssets }),
      ...(input.drawables === undefined ? {} : { drawables: input.drawables }),
      parts,
      ...(input.canvasSize === undefined ? {} : { canvasSize: input.canvasSize })
    }),
    sourceIntakeDraft: createEmptySourceIntakeDraftState({
      defaultPartId: parts[0]?.partId ?? ""
    }),
    binaryByteIntake: projectEditorBinaryByteIntakeState(input.binaryByteIntake),
    sourceAssets: input.sourceAssets ?? [],
    textureAtlas,
    previewParameters: projectPreviewParameterValues(input.parameters ?? []),
    viewerRuntime,
    tutorialReadinessPreflight,
    tutorialGuidedWorkflow: projectTutorialGuidedWorkflowState({
      loadedPackage,
      parts,
      drawables,
      layerTreeDraft,
      meshEdit,
      textureAtlas,
      maskRelations,
      drawableOpacityKeyforms,
      rigControls,
      rigControlAngleKeyforms,
      dynamicsGroups,
      generatedEvidence: initialState.generatedEvidence,
      viewerRuntime,
      tutorialReadinessPreflight,
      reload: initialState.reload
    })
  };
};

export const applyCommittedOperationSummary = (
  state: EditorSemanticState,
  input: CommittedOperationSummaryInput
): EditorSemanticState => {
  const drawables =
    input.drawables === undefined
      ? state.drawables
      : projectDrawableList(input.drawables, input.meshes ?? [], input.drawOrderEntries ?? []);
  const layerTreeDraft =
    input.editorState === undefined
      ? state.layerTreeDraft
      : projectLayerTreeDraftState(input.editorState);
  const selectedVertexIds =
    input.editorState === undefined || input.editorState.activeTool !== "meshEdit"
      ? state.meshEdit.selectedVertexIds
      : projectMeshSelectedVertexIdsFromEditorState(input.editorState);
  const meshEdit =
    input.drawables === undefined && input.meshes === undefined && input.editorState === undefined
      ? state.meshEdit
      : input.meshes === undefined
        ? reprojectMeshEditState(state.meshEdit, {
            layerTreeDraft,
            selectedVertexIds,
            ...(input.drawables === undefined ? {} : { drawables })
          })
        : projectMeshEditState(drawables, input.meshes, {
            layerTreeDraft,
            selectedVertexIds
          });
  const sourceAssets = input.sourceAssets ?? state.sourceAssets;
  const textureAtlas = input.textureAtlas ?? state.textureAtlas;
  const pendingCreateDrawable = projectCommittedCreateDrawableDraft(state, input, sourceAssets);
  const parts = input.parts ?? state.parts;
  const rigControls =
    input.rigControls === undefined
      ? state.rigControls
      : projectRigControlState(input.rigControls);
  const rigControlAngleKeyforms =
    input.keyformSets === undefined
      ? state.rigControlAngleKeyforms
      : projectRigControlAngleKeyformState(input.keyformSets);
  const maskRelations =
    input.masks === undefined
      ? state.maskRelations
      : projectCompositionMaskRelationState(input.masks);
  const drawableOpacityKeyforms =
    input.keyformSets === undefined
      ? state.drawableOpacityKeyforms
      : projectDrawableOpacityKeyformState(input.keyformSets);
  const dynamicsGroups =
    input.dynamicsGroups === undefined
      ? state.dynamicsGroups
      : projectDynamicsGroupState(input.dynamicsGroups);
  const generatedEvidence =
    input.generatedEvidence === undefined
      ? state.generatedEvidence
      : projectGeneratedEvidenceSummary(input.generatedEvidence);
  const viewerRuntime =
    input.parameters === undefined
      ? state.viewerRuntime
      : projectViewerRuntimeState(input.parameters, { surface: state.viewerRuntime.surface });
  const reload = input.reload === undefined ? state.reload : projectReloadSummary(input.reload);
  const tutorialReadinessPreflight =
    input.tutorialReadinessPreflight ?? state.tutorialReadinessPreflight;

  return {
    ...state,
    revision: input.revision === undefined ? state.revision : projectPackageRevision(input.revision),
    parameters: input.parameters === undefined ? state.parameters : projectParameterList(input.parameters),
    dynamicsGroups,
    parts,
    rigControls,
    rigControlAngleKeyforms,
    maskRelations,
    drawableOpacityKeyforms,
    drawables,
    layerTreeDraft,
    meshEdit,
    previewParameters:
      input.parameters === undefined
        ? state.previewParameters
        : projectPreviewParameterValues(input.parameters),
    viewerRuntime,
    tutorialReadinessPreflight,
    pendingCreateParameter:
      input.result.operationType === "createParameter"
        ? {
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
          }
        : state.pendingCreateParameter,
    pendingCreateDrawable,
    sourceAssets,
    binaryByteIntake:
      input.binaryByteIntake === undefined
        ? state.binaryByteIntake
        : projectEditorBinaryByteIntakeState(input.binaryByteIntake),
    textureAtlas,
    lastOperationResult: projectOperationResultSummary(input.result),
    operationLog: projectOperationLogSummary(input.operationLogEntries),
    generatedEvidence,
    dynamicsPreview:
      input.dynamicsPreview ??
      (input.parameters === undefined && input.dynamicsGroups === undefined
        ? state.dynamicsPreview
        : createEmptyDynamicsPreviewState()),
    reload,
    tutorialGuidedWorkflow: projectTutorialGuidedWorkflowState(
      {
        loadedPackage: state.loadedPackage,
        parts,
        drawables,
        layerTreeDraft,
        meshEdit,
        textureAtlas,
        maskRelations,
        drawableOpacityKeyforms,
        rigControls,
        rigControlAngleKeyforms,
        dynamicsGroups,
        generatedEvidence,
        viewerRuntime,
        tutorialReadinessPreflight,
        reload
      },
      state.tutorialGuidedWorkflow
    )
  };
};

const projectCommittedCreateDrawableDraft = (
  state: EditorSemanticState,
  input: CommittedOperationSummaryInput,
  sourceAssets: readonly SourceAssetDto[]
) => {
  if (
    input.result.operationType === "importSplitPngSourceAsset" &&
    input.result.status === "committed" &&
    input.importedSourceSelection !== undefined
  ) {
    return projectCreateDrawableDefaultsForSourceSelection({
      sourceAssets,
      parts: input.parts ?? [],
      drawables: input.drawables ?? [],
      ...(input.canvasSize === undefined ? {} : { canvasSize: input.canvasSize }),
      preferredSourceAssetId: input.importedSourceSelection.sourceAssetId,
      ...(input.importedSourceSelection.sourceLayerId === undefined
        ? {}
        : { preferredSourceLayerId: input.importedSourceSelection.sourceLayerId }),
      ...(input.importedSourceSelection.textureId === undefined
        ? {}
        : { preferredTextureId: input.importedSourceSelection.textureId }),
      ...(input.importedSourceSelection.partId === undefined
        ? {}
        : { preferredPartId: input.importedSourceSelection.partId })
    });
  }

  if (input.result.operationType === "createDrawable" || input.result.operationType === "generateMesh") {
    return applyCreateDrawableDraftResult(state.pendingCreateDrawable, {
      status: input.result.status === "committed" ? "committed" : "rejected",
      ...(input.result.diagnostics === undefined ? {} : { diagnostics: input.result.diagnostics })
    });
  }

  return state.pendingCreateDrawable;
};
