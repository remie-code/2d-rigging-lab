import type {
  AuthoringSession,
  DrawableGeneratedMeshResult,
  GeneratedMeshPreviewCommitMethod,
  StructureOrderDrop,
  StructureOrderItem,
  TextureAtlasPreview,
  VariantActiveSelectionEntry
} from "@private-2d-rigging-lab/authoring-core";
import {
  createGeneratedMeshForDrawable,
  createPackageDocumentBaseFromAuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import { recordLive2dPerformanceCounter } from "@private-2d-rigging-lab/render-core";
import type {
  DiagnosticDto,
  DynamicsGroupId,
  DrawableId,
  ParameterId,
  PartId,
  RectDto,
  RigControlId
} from "@private-2d-rigging-lab/contracts";
import type {
  CreateDynamicsGroupPayloadDto,
  CreateVariantGroupPayloadDto,
  CreateVariantPayloadDto,
  CreateParameterPayloadDto,
  DeleteVariantGroupPayloadDto,
  DeleteVariantPayloadDto,
  DeleteDynamicsGroupPayloadDto,
  DeleteParameterPayloadDto,
  EditKeyformKeyPayloadDto,
  AddVariantTargetDrawablePayloadDto,
  RemoveVariantTargetDrawablePayloadDto,
  SetVariantDefaultActiveSelectionPayloadDto,
  SetVariantMembershipPayloadDto,
  UpdateDynamicsGroupPayloadDto,
  UpdateParameterPayloadDto,
  UpdateVariantGroupPayloadDto,
  UpdateVariantPayloadDto,
  UpdateRigControlPayloadDto
} from "@private-2d-rigging-lab/operation-core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

import {
  exportEditorProjectBundle,
  importEditorProjectBundle,
  toEditorProjectStorageError
} from "../project-storage/model/editor-project-storage";
import {
  readPortableProjectFileText,
  triggerPortableProjectDownload
} from "../project-storage/model/browser-portable-project-transfer";
import {
  createIdleProjectStorageState,
  createLoadedProjectStorageState,
  createLoadingProjectStorageState,
  createProjectStorageErrorState,
  createSavedProjectStorageState,
  createSavingProjectStorageState,
  type ProjectStorageState
} from "../project-storage/model/project-storage-state";
import { commitPsdImportPlan } from "../psd-import/model/psd-import-commit";
import type { PsdImportPlan } from "../psd-import/model/psd-import-types";
import {
  detectWorkspaceDirectoryAccess,
  type WorkspaceDirectoryHandleLike
} from "../workspace-storage/model/workspace-directory-io";
import {
  createEditorWorkspace,
  openEditorWorkspace,
  saveEditorWorkspace,
  saveEditorWorkspaceAs,
  toEditorWorkspaceStorageError,
  type WorkspaceDirectoryPicker
} from "../workspace-storage/model/workspace-session-storage";
import {
  createCreatingWorkspaceStorageState,
  createInitialWorkspaceStorageState,
  createOpeningWorkspaceStorageState,
  createSavedWorkspaceStorageState,
  createSavingWorkspaceStorageState,
  createWorkspaceBlockedStorageState,
  createWorkspaceIdentityLabel,
  createWorkspaceSaveStatusLabel,
  createWorkspaceStorageErrorState,
  type EditorWorkspaceTarget,
  type WorkspaceStorageState
} from "../workspace-storage/model/workspace-storage-state";
import {
  commitDrawableMaskSourceEdit,
  commitDrawableNameEdit,
  commitDrawableOpacityEdit,
  commitDrawableReorder,
  commitDrawableReparent,
  commitDrawableRuntimeVisibility,
  commitCreateDynamicsGroup,
  commitDeleteDynamicsGroup,
  commitDeleteRigControl,
  commitEditKeyformKey,
  commitBindDrawableToRigControl,
  commitCreateRotationDeformer,
  commitCreateWarpDeformer,
  commitGenerateMesh,
  commitMoveDrawableRigControlBinding,
  commitStructureMove,
  commitPartNameEdit,
  commitPartReparent,
  commitReparentRigControl,
  commitUpdateDynamicsGroup,
  commitUpdateRigControl,
  type EditorSessionCommandResult
} from "./model/editor-session-commands";
import { commitMeshApplyAutoRefit } from "./model/mesh-apply-auto-refit";
import { createEmptyAuthoringSession } from "./model/empty-authoring-session";
import type { DeformerTreeSelectionTarget, EditorSelection } from "./model/editor-selection";
import type {
  EditorSessionGestureCommit,
  EditorSessionGestureCommitController
} from "./model/editor-session-gesture-commit";
import { commitEditorSessionGestureWithHistory } from "./model/editor-session-gesture-commit";
import {
  commitTextureAtlasPreview,
  createTextureAtlasSessionChangedWarning,
  type TextureAtlasEditorSessionCommandResult
} from "./model/texture-atlas-session-command";
import {
  commitAddVariantTargetDrawable,
  commitCreateVariant,
  commitCreateVariantGroup,
  commitDeleteVariant,
  commitDeleteVariantGroup,
  commitRemoveVariantTargetDrawable,
  commitSetVariantDefaultActiveSelection,
  commitSetVariantMembership,
  commitUpdateVariant,
  commitUpdateVariantGroup
} from "../variants/model/variant-session-commands";
import {
  reconcileVariantPreviewActiveSelections,
  upsertVariantPreviewActiveSelection
} from "../variants/model/variant-preview-state";
import {
  createDrawableSelection,
  getSelectedDrawableIds,
  getSingleSelectedDrawableId,
  isDeformerTreeAnchorActiveForSelection,
  resolveDeformerTreeSelectionTransition,
  resolveDrawableSelectionTransition
} from "./model/editor-selection";
import {
  canRedoEditorSessionHistory,
  canUndoEditorSessionHistory,
  commitEditorSessionCommandWithHistory,
  createEmptyEditorSessionHistory,
  recordEditorSessionCommit,
  redoEditorSessionHistory,
  undoEditorSessionHistory,
  type EditorSessionHistoryState
} from "./model/editor-session-history";
import {
  clampParameterValue,
  createParameterBarProjection,
  formatKeyformFeedback,
  listEditorParameters,
  resolveActiveParameterId,
  type ParameterBarProjection,
  type ParameterValueMap
} from "./model/parameter-keyform-state";
import {
  commitCreateCustomParameter,
  commitDeleteCustomParameter,
  commitUpdateCustomParameter
} from "./model/parameter-definition-commands";
import {
  createMeshDrawableBatchTargets,
  createMeshPreviewProvenanceId,
  DEFAULT_MESH_GENERATION_METHOD,
  getMeshGenerationPreset,
  isMeshGenerationEligible,
  type MeshGenerationPresetId
} from "./model/mesh-tool-state";
import { mergeEditorHiddenPartIds } from "./model/editor-hidden-part-state";
import {
  createDrawablePoolItems,
  createDeformerTreeRows,
  createRotationDeformerPayloadForDrawable,
  createRotationDeformerPayloadForUnboundDrawables,
  createRotationDeformerParentPayloadForRigControl,
  createWarpDeformerParentPayloadForRigControl,
  createWarpDeformerDraftForDrawable,
  createWarpDeformerPayloadFromDraft,
  createWarpDeformerPayloadForUnboundDrawables,
  fitWarpDeformerDraftToChildren,
  resetWarpDeformerDraft,
  updateWarpDeformerDraft,
  type DeformerTreeRow,
  type DrawablePoolItem,
  type WarpDeformerDraft
} from "./model/rig-tool-state";
import {
  createRotationDeformerPayloadForDeformerTreeSelection,
  createWarpDeformerPayloadForDeformerTreeSelection
} from "./model/deformer-tree-wrap-selection";
import {
  createInspectorProjection,
  createStructureTreeRows,
  resolveDestinationPart,
  type InspectorProjection,
  type StructureTreeRow
} from "./model/session-tree";
import {
  createInitialCollapsedPartIds,
  mergeNewPartInitialCollapsedPartIds
} from "./model/part-tree-collapse-state";
import {
  advanceDynamicsToolPreviewSimulation as advanceDynamicsToolPreviewSimulationState,
  clearDynamicsToolPreviewDefinitionOverride as clearDynamicsToolPreviewDefinitionOverrideState,
  createDynamicsToolPreviewEvaluation,
  createInitialDynamicsToolPreviewState,
  resetDynamicsToolPreviewSimulation as resetDynamicsToolPreviewSimulationState,
  selectDynamicsToolPreviewGroup,
  setDynamicsToolPreviewDefinitionOverride as setDynamicsToolPreviewDefinitionOverrideState,
  setDynamicsToolPreviewDriverValue,
  type DynamicsToolGroup,
  type DynamicsToolPreviewEvaluation,
  type DynamicsToolPreviewState
} from "./model/dynamics-tool-state";
import { useEditorUiStore } from "../../state/editor-ui-store";

export interface MeshToolDraft {
  readonly drawableId: DrawableId;
  readonly presetId: MeshGenerationPresetId;
  readonly commitMode: "single" | "batchEligible";
  readonly method: GeneratedMeshPreviewCommitMethod;
  readonly mesh: AuthoringSession["graph"]["meshes"][number];
  readonly meshDrafts?: readonly MeshToolDraft[];
  readonly source: DrawableGeneratedMeshResult["source"];
  readonly alphaBounds?: DrawableGeneratedMeshResult["alphaBounds"];
  readonly fallbackReason?: DrawableGeneratedMeshResult["fallbackReason"];
  readonly fallbackSteps?: DrawableGeneratedMeshResult["fallbackSteps"];
  readonly qualityMetrics?: DrawableGeneratedMeshResult["qualityMetrics"];
}

export type MeshToolGenerationDiagnosticKind =
  | "generationFailed"
  | "fallback"
  | "emptyResult";

export interface MeshToolGenerationDiagnostic {
  readonly kind: MeshToolGenerationDiagnosticKind;
  readonly drawableId: DrawableId;
  readonly drawableName?: string;
  readonly presetId: MeshGenerationPresetId;
  readonly densityHint?: string;
  readonly method: GeneratedMeshPreviewCommitMethod;
  readonly source?: DrawableGeneratedMeshResult["source"];
  readonly meshBounds?: RectDto;
  readonly alphaBounds?: DrawableGeneratedMeshResult["alphaBounds"];
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly fallbackReason?: DrawableGeneratedMeshResult["fallbackReason"];
  readonly fallbackSteps?: DrawableGeneratedMeshResult["fallbackSteps"];
  readonly qualityMetrics?: DrawableGeneratedMeshResult["qualityMetrics"];
  readonly failureReason?: string;
}

interface MeshGenerationV6MultiIslandDiagnostics {
  readonly rawAlphaComponentCount: number;
  readonly keptIslandCount: number;
  readonly generatedIslandCount: number;
  readonly backendGeneratedIslandCount: number;
  readonly skippedTinyNoiseIslandCount: number;
  readonly skippedTinyNoisePixelCount: number;
  readonly localizedFallbackCount: number;
  readonly localizedFallbackReasons: readonly {
    readonly componentOrder: number;
    readonly reason: string;
  }[];
}

type MeshGenerationV6MetricsWithMultiIslandDiagnostics =
  NonNullable<NonNullable<DrawableGeneratedMeshResult["qualityMetrics"]>["v6Metrics"]> & {
    readonly multiIslandDiagnostics?: MeshGenerationV6MultiIslandDiagnostics;
  };

export function logMeshGenerationPreviewDebug(input: {
  readonly session: AuthoringSession;
  readonly drawableId: DrawableId;
  readonly presetId: MeshGenerationPresetId;
  readonly method: GeneratedMeshPreviewCommitMethod;
  readonly densityHint: string | undefined;
  readonly generated: DrawableGeneratedMeshResult | undefined;
}): void {
  const drawable = input.session.graph.drawables.find((candidate) => candidate.drawableId === input.drawableId);
  const generated = input.generated;
  const v6Metrics = generated?.qualityMetrics?.v6Metrics;
  const supportRingDiagnostics = v6Metrics?.supportRingDiagnostics;
  const adaptiveStaggeredBandDiagnostics = v6Metrics?.adaptiveStaggeredBandDiagnostics;
  const contourPipelineDiagnostics = v6Metrics?.contourPipelineDiagnostics;
  const constrainautorDiagnostics = v6Metrics?.constrainautorDiagnostics;
  const adaptiveDensityDiagnostics = v6Metrics?.adaptiveDensityDiagnostics;
  const multiIslandDiagnostics = getMeshGenerationV6MultiIslandDiagnostics(v6Metrics);
  const summary = {
    drawableId: input.drawableId,
    drawableName: drawable?.displayName,
    presetId: input.presetId,
    densityHint: input.densityHint,
    method: input.method,
    status: generated === undefined ? "undefined" : "generated",
    source: generated?.source,
    fallbackReason: generated?.fallbackReason,
    fallbackSteps: generated?.fallbackSteps,
    vertexCount: generated?.mesh.vertices.length,
    triangleCount: generated?.mesh.triangles.length,
    alphaBounds: generated?.alphaBounds,
    v6OutputKind: v6Metrics?.outputKind,
    v6BackendId: v6Metrics?.backendId,
    v6FallbackReason: v6Metrics?.fallbackReason,
    contourPipelineDiagnostics,
    constrainautorDiagnostics,
    adaptiveDensityDiagnostics,
    multiIslandDiagnostics,
    supportRingDiagnostics,
    adaptiveStaggeredBandDiagnostics
  };

  const log = generated === undefined || generated.fallbackReason !== undefined || v6Metrics?.outputKind !== "backend-output"
    ? console.warn
    : console.info;
  log("[mesh-generation:preview]", summary);
}

function getMeshGenerationV6MultiIslandDiagnostics(
  v6Metrics: NonNullable<DrawableGeneratedMeshResult["qualityMetrics"]>["v6Metrics"] | undefined
): MeshGenerationV6MultiIslandDiagnostics | undefined {
  return (v6Metrics as MeshGenerationV6MetricsWithMultiIslandDiagnostics | undefined)
    ?.multiIslandDiagnostics;
}

interface EditorSessionState {
  readonly session: AuthoringSession;
  readonly history: EditorSessionHistoryState;
  readonly baseDocument: unknown;
}

interface EditorSessionContextValue {
  readonly session: AuthoringSession;
  readonly selection: EditorSelection | null;
  readonly collapsedPartIds: ReadonlySet<PartId>;
  readonly editorHiddenPartIds: ReadonlySet<PartId>;
  readonly meshDraft: MeshToolDraft | null;
  readonly meshDrafts: readonly MeshToolDraft[];
  readonly meshGenerationDiagnostic: MeshToolGenerationDiagnostic | null;
  readonly rigDraft: WarpDeformerDraft | null;
  readonly structureRows: readonly StructureTreeRow[];
  readonly deformerRows: readonly DeformerTreeRow[];
  readonly drawablePoolItems: readonly DrawablePoolItem[];
  readonly inspector: InspectorProjection;
  readonly parameterBar: ParameterBarProjection;
  readonly activeParameterId: ParameterId | null;
  readonly parameterValues: ParameterValueMap;
  readonly dynamicsToolPreview: DynamicsToolPreviewState;
  readonly dynamicsToolPreviewEvaluation: DynamicsToolPreviewEvaluation;
  readonly rigOperationFeedback: string | null;
  readonly parameterOperationFeedback: string | null;
  readonly variantPreviewActiveSelections: readonly VariantActiveSelectionEntry[];
  readonly projectStorage: ProjectStorageState;
  readonly projectIdentityLabel: string;
  readonly projectSaveStatusLabel: string;
  readonly workspaceStorage: WorkspaceStorageState;
  readonly workspaceIdentityLabel: string;
  readonly workspaceSaveStatusLabel: string;
  readonly hasOpenWorkspace: boolean;
  readonly psdImportOpen: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly createWorkspace: () => Promise<void>;
  readonly openWorkspace: () => Promise<void>;
  readonly saveWorkspaceAs: () => Promise<void>;
  readonly saveProject: () => Promise<void>;
  readonly exportPortableProject: () => Promise<void>;
  readonly openProjectFile: (file: File) => Promise<void>;
  readonly openProjectFromPortableBundle: (
    bundleText: string,
    options?: { readonly fileName?: string }
  ) => Promise<void>;
  readonly openPsdImport: () => void;
  readonly closePsdImport: () => void;
  readonly openParameterManager: () => void;
  readonly setActiveParameterId: (parameterId: ParameterId) => void;
  readonly setActiveParameterValue: (value: number) => void;
  readonly resetActiveParameterValue: () => void;
  readonly setDynamicsToolPreviewGroupId: (dynamicsGroupId: DynamicsGroupId | null) => void;
  readonly setDynamicsToolPreviewDriverValue: (
    dynamicsGroupId: DynamicsGroupId,
    parameterId: ParameterId,
    value: number
  ) => void;
  readonly advanceDynamicsToolPreviewSimulation: (
    dynamicsGroupId: DynamicsGroupId,
    dtMs: number
  ) => void;
  readonly setDynamicsToolPreviewDefinitionOverride: (
    dynamicsGroupId: DynamicsGroupId,
    definition: DynamicsToolGroup
  ) => void;
  readonly clearDynamicsToolPreviewDefinitionOverride: (
    dynamicsGroupId: DynamicsGroupId
  ) => void;
  readonly resetDynamicsToolPreviewSimulation: (dynamicsGroupId?: DynamicsGroupId) => void;
  readonly selectPart: (partId: PartId) => void;
  readonly selectDrawable: (
    drawableId: DrawableId,
    options?: {
      readonly range?: boolean;
      readonly toggle?: boolean;
    }
  ) => void;
  readonly selectRigControl: (rigControlId: RigControlId) => void;
  readonly selectDeformerTreeTarget: (
    target: DeformerTreeSelectionTarget,
    options?: {
      readonly range?: boolean;
      readonly toggle?: boolean;
      readonly visibleTargets?: readonly DeformerTreeSelectionTarget[];
    }
  ) => void;
  readonly togglePartCollapse: (partId: PartId) => void;
  readonly togglePartEditorVisibility: (partId: PartId) => void;
  readonly updatePartName: (partId: PartId, displayName: string) => void;
  readonly updateDrawableName: (drawableId: DrawableId, displayName: string) => void;
  readonly updateDrawableOpacity: (drawableId: DrawableId, opacity: number) => void;
  readonly setDrawableRuntimeVisibility: (
    drawableId: DrawableId,
    runtimeVisibility: boolean
  ) => void;
  readonly setDrawableMaskSource: (
    drawableId: DrawableId,
    maskDrawableId: DrawableId | null
  ) => void;
  readonly reorderDrawable: (
    draggedDrawableId: DrawableId,
    targetDrawableId: DrawableId,
    placement: "before" | "after"
  ) => void;
  readonly reparentDrawable: (drawableId: DrawableId, partId: PartId) => void;
  readonly reparentPart: (partId: PartId, parentPartId: PartId) => void;
  readonly moveStructureChild: (moved: StructureOrderItem, drop: StructureOrderDrop) => void;
  readonly previewMeshDraft: (
    drawableId: DrawableId,
    presetId: MeshGenerationPresetId
  ) => void;
  readonly previewMeshDrafts: (
    drawableIds: readonly DrawableId[],
    presetId: MeshGenerationPresetId
  ) => void;
  readonly applyMeshDraft: () => void;
  readonly cancelMeshDraft: () => void;
  readonly startWarpDeformerDraftForDrawable: (drawableId: DrawableId) => void;
  readonly updateWarpDeformerDraft: (patch: Partial<WarpDeformerDraft>) => void;
  readonly fitWarpDeformerDraft: () => void;
  readonly resetWarpDeformerDraft: () => void;
  readonly applyWarpDeformerDraft: () => void;
  readonly cancelWarpDeformerDraft: () => void;
  readonly createRotationDeformerForDrawable: (drawableId: DrawableId) => void;
  readonly createRotationDeformerForDrawables: (drawableIds: readonly DrawableId[]) => void;
  readonly createWarpDeformerForDrawables: (drawableIds: readonly DrawableId[]) => void;
  readonly createRotationDeformerForDeformerTreeSelection: () => void;
  readonly createWarpDeformerForDeformerTreeSelection: () => void;
  readonly createParentRotationDeformerForRigControl: (rigControlId: RigControlId) => void;
  readonly createParentWarpDeformerForRigControl: (rigControlId: RigControlId) => void;
  readonly bindDrawableToRigControl: (
    drawableId: DrawableId,
    parentRigControlId: RigControlId
  ) => void;
  readonly moveDrawableRigControlBinding: (
    drawableId: DrawableId,
    targetRigControlId: RigControlId
  ) => void;
  readonly reparentRigControl: (
    childRigControlId: RigControlId,
    parentRigControlId: RigControlId | null
  ) => void;
  readonly updateRigControl: (payload: UpdateRigControlPayloadDto) => void;
  readonly deleteRigControl: (rigControlId: RigControlId) => void;
  readonly editKeyformKey: (payload: EditKeyformKeyPayloadDto) => void;
  readonly createDynamicsGroup: (
    payload: CreateDynamicsGroupPayloadDto
  ) => EditorSessionCommandResult;
  readonly updateDynamicsGroup: (
    payload: UpdateDynamicsGroupPayloadDto
  ) => EditorSessionCommandResult;
  readonly deleteDynamicsGroup: (
    payload: DeleteDynamicsGroupPayloadDto
  ) => EditorSessionCommandResult;
  readonly createVariantGroup: (
    payload: CreateVariantGroupPayloadDto
  ) => EditorSessionCommandResult;
  readonly updateVariantGroup: (
    payload: UpdateVariantGroupPayloadDto
  ) => EditorSessionCommandResult;
  readonly deleteVariantGroup: (
    payload: DeleteVariantGroupPayloadDto
  ) => EditorSessionCommandResult;
  readonly createVariant: (
    payload: CreateVariantPayloadDto
  ) => EditorSessionCommandResult;
  readonly updateVariant: (
    payload: UpdateVariantPayloadDto
  ) => EditorSessionCommandResult;
  readonly deleteVariant: (
    payload: DeleteVariantPayloadDto
  ) => EditorSessionCommandResult;
  readonly addVariantTargetDrawable: (
    payload: AddVariantTargetDrawablePayloadDto
  ) => EditorSessionCommandResult;
  readonly removeVariantTargetDrawable: (
    payload: RemoveVariantTargetDrawablePayloadDto
  ) => EditorSessionCommandResult;
  readonly setVariantMembership: (
    payload: SetVariantMembershipPayloadDto
  ) => EditorSessionCommandResult;
  readonly setVariantDefaultActiveSelection: (
    payload: SetVariantDefaultActiveSelectionPayloadDto
  ) => EditorSessionCommandResult;
  readonly setVariantPreviewActiveSelection: (
    selection: VariantActiveSelectionEntry
  ) => void;
  readonly resetVariantPreviewActiveSelections: () => void;
  readonly commitGestureCommand: (gesture: EditorSessionGestureCommit<unknown>) => void;
  readonly commitGestureController: <
    Preview,
    Result extends EditorSessionCommandResult = EditorSessionCommandResult
  >(
    controller: EditorSessionGestureCommitController<Preview, Result>
  ) => Result | null;
  readonly createCustomParameter: (
    payload: CreateParameterPayloadDto
  ) => EditorSessionCommandResult;
  readonly updateCustomParameter: (
    payload: UpdateParameterPayloadDto
  ) => EditorSessionCommandResult;
  readonly deleteCustomParameter: (
    payload: DeleteParameterPayloadDto
  ) => EditorSessionCommandResult;
  readonly resolvePsdImportDestination: () => {
    readonly parentPartId: PartId;
    readonly label: string;
  };
  readonly commitPsdImport: (plan: PsdImportPlan) => void;
  readonly applyTextureAtlasPreview: (
    preview: TextureAtlasPreview
  ) => Promise<TextureAtlasEditorSessionCommandResult>;
}

const EditorSessionContext = createContext<EditorSessionContextValue | null>(null);

export interface EditorSessionProviderProps {
  readonly children?: ReactNode;
  readonly confirmDirtyWorkspaceReplacement?: DirtyWorkspaceReplacementConfirmation;
  readonly initialSelection?: EditorSelection | null;
  readonly initialSession?: AuthoringSession;
  readonly initialWorkspaceDirectory?: WorkspaceDirectoryHandleLike;
  readonly initialWorkspaceOpen?: boolean;
  readonly workspaceDirectoryPicker?: WorkspaceDirectoryPicker;
  readonly workspaceGlobalObject?: unknown;
}

export type DirtyWorkspaceReplacementReason = "open-workspace" | "import-portable-json";
export type DirtyWorkspaceReplacementDecision = "save-and-open" | "cancel";

export interface DirtyWorkspaceReplacementRequest {
  readonly reason: DirtyWorkspaceReplacementReason;
  readonly workspaceName: string | null;
  readonly message: string;
}

export type DirtyWorkspaceReplacementConfirmation = (
  request: DirtyWorkspaceReplacementRequest
) => DirtyWorkspaceReplacementDecision | Promise<DirtyWorkspaceReplacementDecision>;

export function EditorSessionProvider({
  children,
  confirmDirtyWorkspaceReplacement = confirmDirtyWorkspaceReplacementWithBrowser,
  initialWorkspaceDirectory,
  initialWorkspaceOpen = false,
  initialSelection = null,
  initialSession,
  workspaceDirectoryPicker,
  workspaceGlobalObject
}: EditorSessionProviderProps) {
  const activeTool = useEditorUiStore((state) => state.activeTool);
  const setActiveEntry = useEditorUiStore((state) => state.setActiveEntry);
  const [editorState, setEditorState] = useState<EditorSessionState>(() => {
    const session =
      initialSession === undefined ? createEmptyAuthoringSession() : structuredClone(initialSession);

    return {
      session,
      history: createEmptyEditorSessionHistory(),
      baseDocument: createPackageDocumentBaseFromAuthoringSession(session)
    };
  });
  const editorStateRef = useRef(editorState);
  const setEditorSessionState = useCallback((nextState: EditorSessionState) => {
    editorStateRef.current = nextState;
    setEditorState(nextState);
  }, []);
  const { baseDocument, history, session } = editorState;
  const [selection, setSelection] = useState<EditorSelection | null>(() => initialSelection);
  const [selectionAnchorDrawableId, setSelectionAnchorDrawableId] =
    useState<DrawableId | null>(() => getSingleSelectedDrawableId(initialSelection) ?? null);
  const [selectionAnchorDeformerTreeTarget, setSelectionAnchorDeformerTreeTarget] =
    useState<DeformerTreeSelectionTarget | null>(null);
  const [activeParameterId, setActiveParameterIdState] = useState<ParameterId | null>(null);
  const [parameterValues, setParameterValues] = useState<ParameterValueMap>({});
  const [dynamicsToolPreview, setDynamicsToolPreview] =
    useState<DynamicsToolPreviewState>(createInitialDynamicsToolPreviewState);
  const [variantPreviewActiveSelectionsState, setVariantPreviewActiveSelectionsState] =
    useState<readonly VariantActiveSelectionEntry[]>(() =>
      reconcileVariantPreviewActiveSelections(session.graph.variantGroups ?? [], undefined)
    );
  const [collapsedPartIds, setCollapsedPartIds] = useState<ReadonlySet<PartId>>(
    () => createInitialCollapsedPartIds(session)
  );
  const [editorHiddenPartIds, setEditorHiddenPartIds] = useState<ReadonlySet<PartId>>(
    () => new Set()
  );
  const [meshDrafts, setMeshDrafts] = useState<readonly MeshToolDraft[]>([]);
  const meshDraft = useMemo(() => createMeshToolDraftCompatValue(meshDrafts), [meshDrafts]);
  const [meshGenerationDiagnostic, setMeshGenerationDiagnostic] =
    useState<MeshToolGenerationDiagnostic | null>(null);
  const [rigDraft, setRigDraft] = useState<WarpDeformerDraft | null>(null);
  const [rigOperationFeedback, setRigOperationFeedback] = useState<string | null>(null);
  const [parameterOperationFeedback, setParameterOperationFeedback] = useState<string | null>(null);
  const [projectStorage, setProjectStorage] = useState<ProjectStorageState>(() =>
    createIdleProjectStorageState()
  );
  const workspaceDirectoryAccess = useMemo(
    () => detectWorkspaceDirectoryAccess(workspaceGlobalObject),
    [workspaceGlobalObject]
  );
  const workspaceAccessSupported =
    workspaceDirectoryAccess.supported ||
    workspaceDirectoryPicker !== undefined ||
    initialWorkspaceDirectory !== undefined ||
    initialWorkspaceOpen;
  const [workspaceStorage, setWorkspaceStorage] = useState<WorkspaceStorageState>(() =>
    initialWorkspaceDirectory === undefined && !initialWorkspaceOpen
      ? createInitialWorkspaceStorageState({ supported: workspaceAccessSupported })
      : createSavedWorkspaceStorageState({
          workspaceName: initialWorkspaceDirectory?.name ?? "Test Workspace",
          binaryWriteCount: 0,
          binarySkipCount: 0,
          message: "Workspace is ready."
        })
  );
  const [workspaceTarget, setWorkspaceTarget] = useState<EditorWorkspaceTarget | null>(() =>
    initialWorkspaceDirectory === undefined
      ? null
      : {
          directory: initialWorkspaceDirectory,
          workspaceName: initialWorkspaceDirectory.name
        }
  );
  const [workspaceOpenOverride, setWorkspaceOpenOverride] = useState(
    initialWorkspaceDirectory !== undefined || initialWorkspaceOpen
  );
  const [psdImportOpen, setPsdImportOpen] = useState(false);
  const resolvedActiveParameterId = useMemo(
    () => resolveActiveParameterId(session, activeParameterId),
    [activeParameterId, session]
  );
  const structureRows = useMemo(
    () =>
      createStructureTreeRows(session, selection, {
        collapsedPartIds,
        editorHiddenPartIds
      }),
    [collapsedPartIds, editorHiddenPartIds, session, selection]
  );
  const deformerRows = useMemo(
    () => createDeformerTreeRows(session, selection),
    [session, selection]
  );
  const drawablePoolItems = useMemo(
    () => createDrawablePoolItems(session, selection),
    [session, selection]
  );
  const inspector = useMemo(
    () => createInspectorProjection(session, selection, { editorHiddenPartIds }),
    [editorHiddenPartIds, session, selection]
  );
  const parameterBar = useMemo(
    () => createParameterBarProjection(session, resolvedActiveParameterId, parameterValues),
    [parameterValues, resolvedActiveParameterId, session]
  );
  const dynamicsToolPreviewEvaluation = useMemo(
    () => createDynamicsToolPreviewEvaluation(session, dynamicsToolPreview),
    [dynamicsToolPreview, session]
  );
  const variantPreviewActiveSelections = useMemo(
    () =>
      reconcileVariantPreviewActiveSelections(
        session.graph.variantGroups ?? [],
        variantPreviewActiveSelectionsState
      ),
    [session.graph.variantGroups, variantPreviewActiveSelectionsState]
  );
  const hasOpenWorkspace = workspaceOpenOverride || workspaceTarget !== null;
  const workspaceIdentityLabel = useMemo(
    () =>
      createWorkspaceIdentityLabel({
        session,
        target: workspaceTarget,
        hasOpenWorkspace
      }),
    [hasOpenWorkspace, session, workspaceTarget]
  );
  const workspaceSaveStatusLabel = useMemo(
    () =>
      createWorkspaceSaveStatusLabel({
        session,
        storageState: workspaceStorage,
        hasOpenWorkspace
      }),
    [hasOpenWorkspace, session, workspaceStorage]
  );
  const projectIdentityLabel = workspaceIdentityLabel;
  const projectSaveStatusLabel = workspaceSaveStatusLabel;

  useEffect(() => {
    if (activeParameterId !== resolvedActiveParameterId) {
      setActiveParameterIdState(resolvedActiveParameterId);
    }
  }, [activeParameterId, resolvedActiveParameterId]);

  useEffect(() => {
    if (activeTool !== "mesh") {
      setMeshDrafts([]);
      setMeshGenerationDiagnostic(null);
    }
  }, [activeTool]);

  useEffect(() => {
    if (activeTool !== "rig") {
      setRigDraft(null);
    }
  }, [activeTool]);

  useEffect(() => {
    setRigOperationFeedback(null);
  }, [selection]);

  useEffect(() => {
    if (
      !isDeformerTreeAnchorActiveForSelection(selection, selectionAnchorDeformerTreeTarget)
    ) {
      setSelectionAnchorDeformerTreeTarget(null);
    }
  }, [selection, selectionAnchorDeformerTreeTarget]);

  useEffect(() => {
    setParameterOperationFeedback(null);
  }, [resolvedActiveParameterId, selection]);

  useEffect(() => {
    setMeshDrafts((current) => filterMeshDraftsForSelection(current, selection));
    setMeshGenerationDiagnostic(null);
  }, [selection]);

  const resolvePsdImportDestination = useCallback(() => {
    const destination = resolveDestinationPart(session, selection);

    return {
      parentPartId: destination.partId,
      label: destination.displayName
    };
  }, [session, selection]);

  const clearTransientCommitState = useCallback(() => {
    setMeshDrafts([]);
    setMeshGenerationDiagnostic(null);
    setRigDraft(null);
    setDynamicsToolPreview(createInitialDynamicsToolPreviewState());
    setVariantPreviewActiveSelectionsState(
      reconcileVariantPreviewActiveSelections(
        editorStateRef.current.session.graph.variantGroups ?? [],
        undefined
      )
    );
    setRigOperationFeedback(null);
    setParameterOperationFeedback(null);
  }, []);

  const resetEditorLocalStateAfterProjectLoad = useCallback((input: {
    readonly loadedSession: AuthoringSession;
    readonly editorHiddenPartIds: readonly PartId[];
  }) => {
    clearTransientCommitState();
    setSelection(null);
    setSelectionAnchorDrawableId(null);
    setSelectionAnchorDeformerTreeTarget(null);
    setActiveParameterIdState(null);
    setParameterValues({});
    setCollapsedPartIds(createInitialCollapsedPartIds(input.loadedSession));
    setEditorHiddenPartIds(new Set(input.editorHiddenPartIds));
    setVariantPreviewActiveSelectionsState(
      reconcileVariantPreviewActiveSelections(input.loadedSession.graph.variantGroups ?? [], undefined)
    );
    setPsdImportOpen(false);
  }, [clearTransientCommitState]);

  const requireOpenWorkspace = useCallback((action: string): boolean => {
    if (hasOpenWorkspace) {
      return true;
    }

    setWorkspaceStorage(createWorkspaceBlockedStorageState(action));
    return false;
  }, [hasOpenWorkspace]);

  const runCommandWithHistory = useCallback(
    <Result extends EditorSessionCommandResult,>(
      command: (currentSession: AuthoringSession) => Result,
      label?: string
    ): Result => {
      const currentState = editorStateRef.current;
      if (!requireOpenWorkspace(label ?? "editing")) {
        return createWorkspaceRequiredCommandResult(
          currentState.session,
          label ?? "editing"
        ) as Result;
      }

      const baseInput = {
        currentSession: currentState.session,
        history: currentState.history,
        command
      };
      const outcome = commitEditorSessionCommandWithHistory(
        label === undefined
          ? baseInput
          : {
              ...baseInput,
              label
            }
      );

      if (outcome.result.committed) {
        setEditorSessionState({
          session: outcome.result.session,
          history: outcome.history,
          baseDocument: currentState.baseDocument
        });
      }

      return outcome.result;
    },
    [requireOpenWorkspace, setEditorSessionState]
  );

  const undo = useCallback(() => {
    const currentState = editorStateRef.current;
    const outcome = undoEditorSessionHistory(currentState.history);
    if (outcome === null) {
      return;
    }

    setEditorSessionState({
      session: outcome.session,
      history: outcome.history,
      baseDocument: currentState.baseDocument
    });
    clearTransientCommitState();
  }, [clearTransientCommitState, setEditorSessionState]);

  const redo = useCallback(() => {
    const currentState = editorStateRef.current;
    const outcome = redoEditorSessionHistory(currentState.history);
    if (outcome === null) {
      return;
    }

    setEditorSessionState({
      session: outcome.session,
      history: outcome.history,
      baseDocument: currentState.baseDocument
    });
    clearTransientCommitState();
  }, [clearTransientCommitState, setEditorSessionState]);

  const applyWorkspaceStorageError = useCallback((error: unknown, workspaceName?: string | null) => {
    const workspaceError = toEditorWorkspaceStorageError(error);
    setWorkspaceStorage(
      createWorkspaceStorageErrorState({
        status: classifyWorkspaceStorageErrorStatus(workspaceError.code),
        workspaceName: workspaceName ?? null,
        code: workspaceError.code,
        message: workspaceError.message,
        ...(workspaceError.path === undefined ? {} : { path: workspaceError.path })
      })
    );
  }, []);

  const persistSessionToWorkspace = useCallback(
    async (input: {
      readonly target: EditorWorkspaceTarget | null;
      readonly sessionToSave: AuthoringSession;
      readonly history: EditorSessionHistoryState;
      readonly baseDocument: unknown;
      readonly message?: string;
    }) => {
      if (input.target === null) {
        setWorkspaceStorage(createWorkspaceBlockedStorageState("saving"));
        return null;
      }

      setWorkspaceStorage(createSavingWorkspaceStorageState(input.target.workspaceName));

      try {
        const result = await saveEditorWorkspace({
          target: input.target,
          session: input.sessionToSave,
          baseDocument: input.baseDocument,
          editorHiddenPartIds
        });

        if (editorStateRef.current.session === input.sessionToSave) {
          const savedSession = structuredClone(input.sessionToSave);
          savedSession.dirty = false;
          setEditorSessionState({
            session: savedSession,
            history: input.history,
            baseDocument: result.packageDocument
          });
          setWorkspaceStorage(
            createSavedWorkspaceStorageState({
              workspaceName: result.workspaceName,
              binaryWriteCount: result.binaryWriteCount,
              binarySkipCount: result.binarySkipCount,
              ...(input.message === undefined ? {} : { message: input.message }),
              completedAt: result.savedAt
            })
          );
        }

        return result;
      } catch (error) {
        applyWorkspaceStorageError(error, input.target.workspaceName);
        return null;
      }
    },
    [applyWorkspaceStorageError, editorHiddenPartIds, setEditorSessionState]
  );

  const prepareDirtyWorkspaceReplacement = useCallback(
    async (reason: DirtyWorkspaceReplacementReason): Promise<boolean> => {
      const currentState = editorStateRef.current;
      if (!hasOpenWorkspace || !currentState.session.dirty) {
        return true;
      }

      const message = reason === "open-workspace"
        ? "Save the current workspace before opening another workspace?"
        : "Save the current workspace before importing Portable JSON?";
      const decision = await confirmDirtyWorkspaceReplacement({
        reason,
        workspaceName: workspaceTarget?.workspaceName ?? null,
        message
      });

      if (decision === "cancel") {
        return false;
      }

      const saved = await persistSessionToWorkspace({
        target: workspaceTarget,
        sessionToSave: currentState.session,
        history: currentState.history,
        baseDocument: currentState.baseDocument,
        message: "Saved current workspace before replacing it."
      });

      return saved !== null;
    },
    [
      confirmDirtyWorkspaceReplacement,
      hasOpenWorkspace,
      persistSessionToWorkspace,
      workspaceTarget
    ]
  );

  const createWorkspace = useCallback(async () => {
    const currentState = editorStateRef.current;
    setWorkspaceStorage(createCreatingWorkspaceStorageState());

    try {
      const result = await createEditorWorkspace({
        session: currentState.session,
        baseDocument: currentState.baseDocument,
        editorHiddenPartIds,
        ...(workspaceDirectoryPicker === undefined ? {} : { picker: workspaceDirectoryPicker }),
        ...(workspaceGlobalObject === undefined ? {} : { globalObject: workspaceGlobalObject })
      });
      setWorkspaceTarget(result.target);
      setWorkspaceOpenOverride(true);
      setActiveEntry("workspace");
      setEditorSessionState({
        session: result.session,
        history: currentState.history,
        baseDocument: result.packageDocument
      });
      resetEditorLocalStateAfterProjectLoad({
        loadedSession: result.session,
        editorHiddenPartIds: result.editorHiddenPartIds
      });
      setWorkspaceStorage(
        createSavedWorkspaceStorageState({
          workspaceName: result.target.workspaceName,
          binaryWriteCount: result.binaryFileCount,
          binarySkipCount: 0,
          message: `Created workspace ${result.target.workspaceName}.`,
          completedAt: result.openedAt
        })
      );
    } catch (error) {
      applyWorkspaceStorageError(error, workspaceTarget?.workspaceName ?? null);
    }
  }, [
    applyWorkspaceStorageError,
    editorHiddenPartIds,
    resetEditorLocalStateAfterProjectLoad,
    setActiveEntry,
    setEditorSessionState,
    workspaceDirectoryPicker,
    workspaceGlobalObject,
    workspaceTarget
  ]);

  const openWorkspace = useCallback(async () => {
    if (!(await prepareDirtyWorkspaceReplacement("open-workspace"))) {
      return;
    }

    setWorkspaceStorage(createOpeningWorkspaceStorageState());

    try {
      const result = await openEditorWorkspace({
        ...(workspaceDirectoryPicker === undefined ? {} : { picker: workspaceDirectoryPicker }),
        ...(workspaceGlobalObject === undefined ? {} : { globalObject: workspaceGlobalObject })
      });
      setWorkspaceTarget(result.target);
      setWorkspaceOpenOverride(true);
      setActiveEntry("workspace");
      setEditorSessionState({
        session: result.session,
        history: createEmptyEditorSessionHistory(),
        baseDocument: result.packageDocument
      });
      resetEditorLocalStateAfterProjectLoad({
        loadedSession: result.session,
        editorHiddenPartIds: result.editorHiddenPartIds
      });
      setWorkspaceStorage(
        createSavedWorkspaceStorageState({
          workspaceName: result.target.workspaceName,
          binaryWriteCount: 0,
          binarySkipCount: result.binaryFileCount,
          message: `Opened workspace ${result.target.workspaceName}.`,
          completedAt: result.openedAt
        })
      );
    } catch (error) {
      applyWorkspaceStorageError(error, workspaceTarget?.workspaceName ?? null);
    }
  }, [
    applyWorkspaceStorageError,
    prepareDirtyWorkspaceReplacement,
    resetEditorLocalStateAfterProjectLoad,
    setActiveEntry,
    setEditorSessionState,
    workspaceDirectoryPicker,
    workspaceGlobalObject,
    workspaceTarget
  ]);

  const saveProject = useCallback(async () => {
    const currentState = editorStateRef.current;
    await persistSessionToWorkspace({
      target: workspaceTarget,
      sessionToSave: currentState.session,
      history: currentState.history,
      baseDocument: currentState.baseDocument
    });
  }, [persistSessionToWorkspace, workspaceTarget]);

  const saveWorkspaceAs = useCallback(async () => {
    const currentState = editorStateRef.current;
    setWorkspaceStorage(createCreatingWorkspaceStorageState());

    try {
      const result = await saveEditorWorkspaceAs({
        session: currentState.session,
        baseDocument: currentState.baseDocument,
        editorHiddenPartIds,
        ...(workspaceDirectoryPicker === undefined ? {} : { picker: workspaceDirectoryPicker }),
        ...(workspaceGlobalObject === undefined ? {} : { globalObject: workspaceGlobalObject })
      });
      setWorkspaceTarget(result.target);
      setWorkspaceOpenOverride(true);
      setActiveEntry("workspace");
      setEditorSessionState({
        session: result.session,
        history: currentState.history,
        baseDocument: result.packageDocument
      });
      setWorkspaceStorage(
        createSavedWorkspaceStorageState({
          workspaceName: result.target.workspaceName,
          binaryWriteCount: result.binaryFileCount,
          binarySkipCount: 0,
          message: `Saved as workspace ${result.target.workspaceName}.`,
          completedAt: result.openedAt
        })
      );
    } catch (error) {
      applyWorkspaceStorageError(error, workspaceTarget?.workspaceName ?? null);
    }
  }, [
    applyWorkspaceStorageError,
    editorHiddenPartIds,
    setActiveEntry,
    setEditorSessionState,
    workspaceDirectoryPicker,
    workspaceGlobalObject,
    workspaceTarget
  ]);

  const exportPortableProject = useCallback(async () => {
    const currentState = editorStateRef.current;
    setProjectStorage(createSavingProjectStorageState());

    try {
      const result = await exportEditorProjectBundle({
        session: currentState.session,
        baseDocument: currentState.baseDocument,
        editorHiddenPartIds
      });
      triggerPortableProjectDownload({
        bundleJson: result.bundleJson,
        fileName: result.fileName
      });

      setProjectStorage(createSavedProjectStorageState(result));
    } catch (error) {
      setProjectStorage(
        createProjectStorageErrorState(toEditorProjectStorageError(error, "save"), "save")
      );
    }
  }, [editorHiddenPartIds]);

  const openProjectFromPortableBundle = useCallback(
    async (bundleText: string, options: { readonly fileName?: string } = {}) => {
      if (!(await prepareDirtyWorkspaceReplacement("import-portable-json"))) {
        return;
      }

      setProjectStorage(createLoadingProjectStorageState(options.fileName));

      try {
        const result = await importEditorProjectBundle({ bundleText });
        setWorkspaceStorage(createCreatingWorkspaceStorageState());
        const workspaceResult = await createEditorWorkspace({
          session: result.session,
          baseDocument: result.packageDocument,
          editorHiddenPartIds: result.editorHiddenPartIds,
          ...(workspaceDirectoryPicker === undefined ? {} : { picker: workspaceDirectoryPicker }),
          ...(workspaceGlobalObject === undefined ? {} : { globalObject: workspaceGlobalObject })
        });
        setWorkspaceTarget(workspaceResult.target);
        setWorkspaceOpenOverride(true);
        setActiveEntry("workspace");
        setEditorSessionState({
          session: workspaceResult.session,
          history: createEmptyEditorSessionHistory(),
          baseDocument: workspaceResult.packageDocument
        });
        resetEditorLocalStateAfterProjectLoad({
          loadedSession: workspaceResult.session,
          editorHiddenPartIds: result.editorHiddenPartIds
        });
        setProjectStorage(createLoadedProjectStorageState(result, options.fileName));
        setWorkspaceStorage(
          createSavedWorkspaceStorageState({
            workspaceName: workspaceResult.target.workspaceName,
            binaryWriteCount: workspaceResult.binaryFileCount,
            binarySkipCount: 0,
            message: `Imported portable JSON into ${workspaceResult.target.workspaceName}.`,
            completedAt: workspaceResult.openedAt
          })
        );
      } catch (error) {
        const workspaceError = toEditorWorkspaceStorageError(error);
        if (!workspaceError.code.startsWith("workspace.unknown")) {
          applyWorkspaceStorageError(error, workspaceTarget?.workspaceName ?? null);
        }
        setProjectStorage(
          createProjectStorageErrorState(
            toEditorProjectStorageError(error, "open"),
            "open",
            options.fileName
          )
        );
      }
    },
    [
      applyWorkspaceStorageError,
      prepareDirtyWorkspaceReplacement,
      resetEditorLocalStateAfterProjectLoad,
      setActiveEntry,
      setEditorSessionState,
      workspaceDirectoryPicker,
      workspaceGlobalObject,
      workspaceTarget
    ]
  );

  const openProjectFile = useCallback(
    async (file: File) => {
      try {
        await openProjectFromPortableBundle(await readPortableProjectFileText(file), {
          fileName: file.name
        });
      } catch (error) {
        setProjectStorage(
          createProjectStorageErrorState(
            toEditorProjectStorageError(error, "open"),
            "open",
            file.name
          )
        );
      }
    },
    [openProjectFromPortableBundle]
  );

  const commitPsdImport = useCallback(
    (plan: PsdImportPlan) => {
      if (!requireOpenWorkspace("importing PSD")) {
        return;
      }

      const currentState = editorStateRef.current;
      const result = commitPsdImportPlan({ session: currentState.session, plan });
      const nextHistory = recordEditorSessionCommit(currentState.history, {
        before: currentState.session,
        after: result.session,
        label: "Import PSD"
      });
      setEditorSessionState({
        session: result.session,
        history: nextHistory,
        baseDocument: currentState.baseDocument
      });
      setCollapsedPartIds((current) =>
        mergeNewPartInitialCollapsedPartIds(current, currentState.session, result.session, {
          expandPartIds: [plan.importRootPartId]
        })
      );
      setEditorHiddenPartIds((current) =>
        mergeEditorHiddenPartIds(current, result.editorHiddenPartIds)
      );
      setSelection({ kind: "part", id: plan.importRootPartId });
      setSelectionAnchorDrawableId(null);
      setPsdImportOpen(false);
      void persistSessionToWorkspace({
        target: workspaceTarget,
        sessionToSave: result.session,
        history: nextHistory,
        baseDocument: currentState.baseDocument,
        message: "Saved PSD import to workspace."
      });
    },
    [persistSessionToWorkspace, requireOpenWorkspace, setEditorSessionState, workspaceTarget]
  );

  const applyTextureAtlasPreview = useCallback(
    async (preview: TextureAtlasPreview): Promise<TextureAtlasEditorSessionCommandResult> => {
      if (!requireOpenWorkspace("applying Texture Atlas")) {
        return {
          committed: false,
          session: editorStateRef.current.session,
          warnings: [createWorkspaceRequiredDiagnostic("applying Texture Atlas")]
        };
      }

      const currentState = editorStateRef.current;
      const result = await commitTextureAtlasPreview(currentState.session, preview, {
        editorHiddenPartIds
      });

      if (!result.committed) {
        if (result.warnings.length > 0) {
          console.warn("Texture Atlas Apply was rejected.", result.warnings);
        }
        return result;
      }

      if (editorStateRef.current.session !== currentState.session) {
        const staleResult: TextureAtlasEditorSessionCommandResult = {
          committed: false,
          session: editorStateRef.current.session,
          warnings: [createTextureAtlasSessionChangedWarning()]
        };
        console.warn("Texture Atlas Apply was rejected.", staleResult.warnings);
        return staleResult;
      }

      const nextHistory = recordEditorSessionCommit(currentState.history, {
        before: currentState.session,
        after: result.session,
        label: "Apply Texture Atlas"
      });
      setEditorSessionState({
        session: result.session,
        history: nextHistory,
        baseDocument: currentState.baseDocument
      });
      clearTransientCommitState();
      await persistSessionToWorkspace({
        target: workspaceTarget,
        sessionToSave: result.session,
        history: nextHistory,
        baseDocument: currentState.baseDocument,
        message: "Saved Texture Atlas artifact to workspace."
      });

      return result;
    },
    [
      clearTransientCommitState,
      editorHiddenPartIds,
      persistSessionToWorkspace,
      requireOpenWorkspace,
      setEditorSessionState,
      workspaceTarget
    ]
  );

  const applyCommand = useCallback(
    (
      command: (currentSession: AuthoringSession) => EditorSessionCommandResult,
      label = "Editor command"
    ) => {
      const result = runCommandWithHistory(command, label);
      if (result.committed) {
        return;
      }

      if (result.diagnostics.length > 0) {
        console.warn("Editor command was rejected.", result.diagnostics);
      }
    },
    [runCommandWithHistory]
  );

  const applyRigCommand = useCallback(
    (
      command: (currentSession: AuthoringSession) => EditorSessionCommandResult,
      onCommitted?: (result: EditorSessionCommandResult) => void,
      label = "Rig command"
    ) => {
      const result = runCommandWithHistory(command, label);
      if (result.committed) {
        setRigOperationFeedback(null);
        onCommitted?.(result);
        return;
      }

      if (result.diagnostics.length > 0) {
        setRigOperationFeedback(formatCommandFeedback(result));
        console.warn("Rig command was rejected.", result.diagnostics);
      } else {
        setRigOperationFeedback("No Rig change was applied.");
      }
    },
    [runCommandWithHistory]
  );

  const editKeyformKey = useCallback((payload: EditKeyformKeyPayloadDto) => {
    if (activeTool === "dynamics") {
      return;
    }

    const result = runCommandWithHistory(
      (sessionForCommand) => commitEditKeyformKey(sessionForCommand, payload),
      "Edit keyform"
    );
    if (result.committed) {
      setParameterOperationFeedback(null);
      return;
    }

    if (result.diagnostics.length > 0) {
      setParameterOperationFeedback(formatKeyformFeedback(result.diagnostics));
      console.warn("Parameter keyform command was rejected.", result.diagnostics);
    } else {
      setParameterOperationFeedback("No keyform change was applied.");
    }
  }, [activeTool, runCommandWithHistory]);

  const applyParameterDefinitionCommand = useCallback(
    (
      command: (currentSession: AuthoringSession) => EditorSessionCommandResult,
      label = "Edit parameter"
    ) => {
      const result = runCommandWithHistory(command, label);
      if (result.committed) {
        setParameterOperationFeedback(null);
        return result;
      }

      if (result.diagnostics.length > 0) {
        setParameterOperationFeedback(formatParameterCommandFeedback(result));
        console.warn("Parameter definition command was rejected.", result.diagnostics);
      } else {
        setParameterOperationFeedback("No Parameter definition change was applied.");
      }

      return result;
    },
    [runCommandWithHistory]
  );

  const createCustomParameter = useCallback(
    (payload: CreateParameterPayloadDto) =>
      applyParameterDefinitionCommand((currentSession) =>
        commitCreateCustomParameter(currentSession, payload)
      ),
    [applyParameterDefinitionCommand]
  );

  const updateCustomParameter = useCallback(
    (payload: UpdateParameterPayloadDto) =>
      applyParameterDefinitionCommand((currentSession) =>
        commitUpdateCustomParameter(currentSession, payload)
      ),
    [applyParameterDefinitionCommand]
  );

  const deleteCustomParameter = useCallback(
    (payload: DeleteParameterPayloadDto) =>
      applyParameterDefinitionCommand((currentSession) =>
        commitDeleteCustomParameter(currentSession, payload)
      ),
    [applyParameterDefinitionCommand]
  );

  const createDynamicsGroup = useCallback(
    (payload: CreateDynamicsGroupPayloadDto) =>
      runCommandWithHistory(
        (currentSession) => commitCreateDynamicsGroup(currentSession, payload),
        "Create Dynamics Group"
      ),
    [runCommandWithHistory]
  );

  const updateDynamicsGroup = useCallback(
    (payload: UpdateDynamicsGroupPayloadDto) =>
      runCommandWithHistory(
        (currentSession) => commitUpdateDynamicsGroup(currentSession, payload),
        "Update Dynamics Group"
      ),
    [runCommandWithHistory]
  );

  const deleteDynamicsGroup = useCallback(
    (payload: DeleteDynamicsGroupPayloadDto) =>
      runCommandWithHistory(
        (currentSession) => commitDeleteDynamicsGroup(currentSession, payload),
        "Delete Dynamics Group"
      ),
    [runCommandWithHistory]
  );

  const createVariantGroup = useCallback(
    (payload: CreateVariantGroupPayloadDto) =>
      runCommandWithHistory(
        (currentSession) => commitCreateVariantGroup(currentSession, payload),
        "Create Variant Group"
      ),
    [runCommandWithHistory]
  );

  const updateVariantGroup = useCallback(
    (payload: UpdateVariantGroupPayloadDto) =>
      runCommandWithHistory(
        (currentSession) => commitUpdateVariantGroup(currentSession, payload),
        "Update Variant Group"
      ),
    [runCommandWithHistory]
  );

  const deleteVariantGroup = useCallback(
    (payload: DeleteVariantGroupPayloadDto) =>
      runCommandWithHistory(
        (currentSession) => commitDeleteVariantGroup(currentSession, payload),
        "Delete Variant Group"
      ),
    [runCommandWithHistory]
  );

  const createVariant = useCallback(
    (payload: CreateVariantPayloadDto) =>
      runCommandWithHistory(
        (currentSession) => commitCreateVariant(currentSession, payload),
        "Create Variant"
      ),
    [runCommandWithHistory]
  );

  const updateVariant = useCallback(
    (payload: UpdateVariantPayloadDto) =>
      runCommandWithHistory(
        (currentSession) => commitUpdateVariant(currentSession, payload),
        "Update Variant"
      ),
    [runCommandWithHistory]
  );

  const deleteVariant = useCallback(
    (payload: DeleteVariantPayloadDto) =>
      runCommandWithHistory(
        (currentSession) => commitDeleteVariant(currentSession, payload),
        "Delete Variant"
      ),
    [runCommandWithHistory]
  );

  const addVariantTargetDrawable = useCallback(
    (payload: AddVariantTargetDrawablePayloadDto) =>
      runCommandWithHistory(
        (currentSession) => commitAddVariantTargetDrawable(currentSession, payload),
        "Add Variant target Drawable"
      ),
    [runCommandWithHistory]
  );

  const removeVariantTargetDrawable = useCallback(
    (payload: RemoveVariantTargetDrawablePayloadDto) =>
      runCommandWithHistory(
        (currentSession) => commitRemoveVariantTargetDrawable(currentSession, payload),
        "Remove Variant target Drawable"
      ),
    [runCommandWithHistory]
  );

  const setVariantMembership = useCallback(
    (payload: SetVariantMembershipPayloadDto) =>
      runCommandWithHistory(
        (currentSession) => commitSetVariantMembership(currentSession, payload),
        "Set Variant membership"
      ),
    [runCommandWithHistory]
  );

  const setVariantDefaultActiveSelection = useCallback(
    (payload: SetVariantDefaultActiveSelectionPayloadDto) =>
      runCommandWithHistory(
        (currentSession) => commitSetVariantDefaultActiveSelection(currentSession, payload),
        "Set Variant default active selection"
      ),
    [runCommandWithHistory]
  );

  const setVariantPreviewActiveSelection = useCallback(
    (entry: VariantActiveSelectionEntry) => {
      setVariantPreviewActiveSelectionsState((current) =>
        upsertVariantPreviewActiveSelection(
          editorStateRef.current.session.graph.variantGroups ?? [],
          current,
          entry
        )
      );
    },
    []
  );

  const resetVariantPreviewActiveSelections = useCallback(() => {
    setVariantPreviewActiveSelectionsState(
      reconcileVariantPreviewActiveSelections(
        editorStateRef.current.session.graph.variantGroups ?? [],
        undefined
      )
    );
  }, []);

  const setDynamicsToolPreviewGroupId = useCallback(
    (dynamicsGroupId: DynamicsGroupId | null) => {
      setDynamicsToolPreview((current) =>
        selectDynamicsToolPreviewGroup(editorStateRef.current.session, current, dynamicsGroupId)
      );
    },
    []
  );

  const setDynamicsToolPreviewDriver = useCallback(
    (dynamicsGroupId: DynamicsGroupId, parameterId: ParameterId, value: number) => {
      setDynamicsToolPreview((current) =>
        setDynamicsToolPreviewDriverValue(editorStateRef.current.session, current, {
          dynamicsGroupId,
          parameterId,
          value
        })
      );
    },
    []
  );

  const advanceDynamicsToolPreviewSimulation = useCallback(
    (dynamicsGroupId: DynamicsGroupId, dtMs: number) => {
      setDynamicsToolPreview((current) =>
        advanceDynamicsToolPreviewSimulationState(editorStateRef.current.session, current, {
          dynamicsGroupId,
          dtMs
        })
      );
    },
    []
  );

  const setDynamicsToolPreviewDefinitionOverride = useCallback(
    (dynamicsGroupId: DynamicsGroupId, definition: DynamicsToolGroup) => {
      setDynamicsToolPreview((current) =>
        setDynamicsToolPreviewDefinitionOverrideState(editorStateRef.current.session, current, {
          dynamicsGroupId,
          definition
        })
      );
    },
    []
  );

  const clearDynamicsToolPreviewDefinitionOverride = useCallback(
    (dynamicsGroupId: DynamicsGroupId) => {
      setDynamicsToolPreview((current) =>
        clearDynamicsToolPreviewDefinitionOverrideState(current, dynamicsGroupId)
      );
    },
    []
  );

  const resetDynamicsToolPreviewSimulation = useCallback(
    (dynamicsGroupId?: DynamicsGroupId) => {
      setDynamicsToolPreview((current) =>
        resetDynamicsToolPreviewSimulationState(
          editorStateRef.current.session,
          current,
          dynamicsGroupId ?? current.selectedGroupId
        )
      );
    },
    []
  );

  const setActiveParameterId = useCallback((parameterId: ParameterId) => {
    setActiveParameterIdState(parameterId);
  }, []);

  const setActiveParameterValue = useCallback(
    (value: number) => {
      if (activeTool === "dynamics") {
        return;
      }

      if (resolvedActiveParameterId === null) {
        return;
      }

      const parameter = listEditorParameters(session).find(
        (candidate) => candidate.parameterId === resolvedActiveParameterId
      );
      if (parameter === undefined) {
        return;
      }

      const nextValue = clampParameterValue(parameter, value);
      setParameterValues((current) => {
        const currentValue = clampParameterValue(
          parameter,
          current[resolvedActiveParameterId] ?? parameter.default
        );
        if (samePreviewParameterValue(currentValue, nextValue)) {
          recordLive2dPerformanceCounter("parameterBar.skippedNoOpUpdates");
          return current;
        }

        recordLive2dPerformanceCounter("parameterBar.appliedUpdates");
        return {
          ...current,
          [resolvedActiveParameterId]: nextValue
        };
      });
    },
    [activeTool, resolvedActiveParameterId, session]
  );

  const resetActiveParameterValue = useCallback(() => {
    if (activeTool === "dynamics") {
      return;
    }

    if (resolvedActiveParameterId === null) {
      return;
    }

    const parameter = listEditorParameters(session).find(
      (candidate) => candidate.parameterId === resolvedActiveParameterId
    );
    if (parameter === undefined) {
      return;
    }

    const nextValue = clampParameterValue(parameter, parameter.default);
    setParameterValues((current) => {
      const currentValue = clampParameterValue(
        parameter,
        current[resolvedActiveParameterId] ?? parameter.default
      );
      if (samePreviewParameterValue(currentValue, nextValue)) {
        recordLive2dPerformanceCounter("parameterBar.skippedNoOpUpdates");
        return current;
      }

      recordLive2dPerformanceCounter("parameterBar.appliedUpdates");
      return {
        ...current,
        [resolvedActiveParameterId]: nextValue
      };
    });
  }, [activeTool, resolvedActiveParameterId, session]);

  const openParameterManager = useCallback(() => {
    setActiveEntry("parameters");
  }, [setActiveEntry]);

  const togglePartCollapse = useCallback((partId: PartId) => {
    setCollapsedPartIds((current) => {
      const next = new Set(current);
      if (next.has(partId)) {
        next.delete(partId);
      } else {
        next.add(partId);
      }

      return next;
    });
  }, []);

  const togglePartEditorVisibility = useCallback((partId: PartId) => {
    setEditorHiddenPartIds((current) => {
      const next = new Set(current);
      if (next.has(partId)) {
        next.delete(partId);
      } else {
        next.add(partId);
      }

      return next;
    });
  }, []);

  const moveStructureChild = useCallback((moved: StructureOrderItem, drop: StructureOrderDrop) => {
    const result = runCommandWithHistory(
      (sessionForCommand) => commitStructureMove(sessionForCommand, moved, drop),
      "Move structure item"
    );
    if (result.committed) {
      if (moved.kind === "part") {
        setSelection({ kind: "part", id: moved.partId });
        setSelectionAnchorDrawableId(null);
      } else {
        setSelection({ kind: "drawable", id: moved.drawableId });
        setSelectionAnchorDrawableId(moved.drawableId);
      }
      return;
    }

    if (result.diagnostics.length > 0) {
      console.warn("Editor command was rejected.", result.diagnostics);
    }
  }, [runCommandWithHistory]);

  const selectPart = useCallback((partId: PartId) => {
    setMeshDrafts([]);
    setSelection({ kind: "part", id: partId });
    setSelectionAnchorDrawableId(null);
    setSelectionAnchorDeformerTreeTarget(null);
  }, []);

  const selectDrawable = useCallback((
    drawableId: DrawableId,
    options: {
      readonly range?: boolean;
      readonly toggle?: boolean;
    } = {}
  ) => {
    const visibleDrawableIds = structureRows
      .filter((row): row is Extract<StructureTreeRow, { readonly kind: "drawable" }> =>
        row.kind === "drawable"
      )
      .map((row) => row.id);
    const mode = options.range ? "range" : options.toggle ? "toggle" : "replace";
    const transition = resolveDrawableSelectionTransition({
      currentSelection: selection,
      anchorDrawableId: selectionAnchorDrawableId,
      clickedDrawableId: drawableId,
      visibleDrawableIds,
      mode
    });
    setMeshDrafts((current) => filterMeshDraftsForSelection(current, transition.selection));
    setSelection(transition.selection);
    setSelectionAnchorDrawableId(transition.anchorDrawableId);
    setSelectionAnchorDeformerTreeTarget(null);
  }, [selection, selectionAnchorDrawableId, structureRows]);

  const selectRigControl = useCallback((rigControlId: RigControlId) => {
    setMeshDrafts([]);
    setSelection({ kind: "rigControl", id: rigControlId });
    setSelectionAnchorDrawableId(null);
    setSelectionAnchorDeformerTreeTarget(null);
  }, []);

  const selectDeformerTreeTarget = useCallback((
    target: DeformerTreeSelectionTarget,
    options: {
      readonly range?: boolean;
      readonly toggle?: boolean;
      readonly visibleTargets?: readonly DeformerTreeSelectionTarget[];
    } = {}
  ) => {
    const mode = options.range ? "range" : options.toggle ? "toggle" : "replace";
    const transition = resolveDeformerTreeSelectionTransition({
      currentSelection: selection,
      anchorTarget: selectionAnchorDeformerTreeTarget,
      clickedTarget: target,
      visibleTargets: options.visibleTargets ?? [target],
      mode
    });

    setMeshDrafts((current) => filterMeshDraftsForSelection(current, transition.selection));
    setSelection(transition.selection);
    setSelectionAnchorDrawableId(getSingleSelectedDrawableId(transition.selection) ?? null);
    setSelectionAnchorDeformerTreeTarget(transition.anchorTarget);
  }, [selection, selectionAnchorDeformerTreeTarget]);

  const cancelMeshDraft = useCallback(() => {
    setMeshDrafts([]);
    setMeshGenerationDiagnostic(null);
  }, []);

  const previewMeshDraft = useCallback(
    (
      drawableId: DrawableId,
      presetId: MeshGenerationPresetId
    ) => {
      const result = createMeshToolDraft({
        commitMode: "single",
        drawableId,
        presetId,
        session
      });

      setMeshDrafts(result.draft === undefined ? [] : [result.draft]);
      setMeshGenerationDiagnostic(result.diagnostic);
    },
    [session]
  );

  const previewMeshDrafts = useCallback(
    (
      drawableIds: readonly DrawableId[],
      presetId: MeshGenerationPresetId
    ) => {
      const eligibleDrawableIds = createMeshDrawableBatchTargets(session, drawableIds)
        .filter((target) => target.eligible)
        .map((target) => target.drawableId);
      const results = eligibleDrawableIds.map((drawableId) =>
        createMeshToolDraft({
          commitMode: "batchEligible",
          drawableId,
          presetId,
          session
        })
      );
      const drafts = results
        .map((result) => result.draft)
        .filter(isDefined);
      const firstDiagnostic = results.find((result) => result.diagnostic !== null)?.diagnostic ?? null;

      setMeshDrafts(drafts);
      setMeshGenerationDiagnostic(firstDiagnostic);
    },
    [session]
  );

  const applyMeshDraft = useCallback(() => {
    if (meshDrafts.length === 0) {
      return;
    }

    const draftsToApply = meshDrafts;
    const committedDrawableIds: DrawableId[] = [];
    const result = runCommandWithHistory(
      (sessionForCommand) => {
        let nextSession = sessionForCommand;
        const diagnostics: Array<EditorSessionCommandResult["diagnostics"][number]> = [];

        for (const draft of draftsToApply) {
          if (
            draft.commitMode === "batchEligible" &&
            !isMeshGenerationEligible(nextSession, draft.drawableId)
          ) {
            continue;
          }

          const preset = getMeshGenerationPreset(draft.presetId);
          const draftResult = commitGenerateMesh(
            nextSession,
            draft.drawableId,
            preset.densityHint,
            draft.mesh,
            draft.method,
            {
              source: draft.source,
              ...(draft.fallbackReason === undefined ? {} : { fallbackReason: draft.fallbackReason }),
              ...(draft.fallbackSteps === undefined ? {} : { fallbackSteps: draft.fallbackSteps }),
              ...(draft.qualityMetrics === undefined ? {} : { qualityMetrics: draft.qualityMetrics })
            }
          );
          diagnostics.push(...draftResult.diagnostics);

          if (!draftResult.committed) {
            continue;
          }

          nextSession = draftResult.session;
          committedDrawableIds.push(draft.drawableId);
        }

        return committedDrawableIds.length === 0
          ? { committed: false, session: sessionForCommand, diagnostics }
          : (() => {
              const refitResult = commitMeshApplyAutoRefit(nextSession, committedDrawableIds);
              diagnostics.push(...refitResult.diagnostics);
              return {
                committed: true,
                session: refitResult.session,
                diagnostics
              };
            })();
      },
      draftsToApply.length === 1 ? "Apply mesh" : "Apply meshes"
    );
    if (result.committed) {
      setMeshDrafts([]);
      setMeshGenerationDiagnostic(null);
      if (draftsToApply.length === 1 && draftsToApply[0]?.commitMode === "single") {
        const committedDrawableId = committedDrawableIds[0]!;
        setSelection({ kind: "drawable", id: committedDrawableId });
        setSelectionAnchorDrawableId(committedDrawableId);
      } else if (committedDrawableIds.length > 1 && selection?.kind === "drawableSet") {
        setSelection(createDrawableSelection(selection.ids));
      }
      return;
    }

    if (result.diagnostics.length > 0) {
      console.warn("Editor command was rejected.", result.diagnostics);
    }
  }, [meshDrafts, runCommandWithHistory, selection]);

  const startWarpDeformerDraftForDrawable = useCallback(
    (drawableId: DrawableId) => {
      const draft = createWarpDeformerDraftForDrawable(session, drawableId);
      if (draft === undefined) {
        setRigDraft(null);
        return;
      }

      setMeshDrafts([]);
      setSelection({ kind: "drawable", id: drawableId });
      setSelectionAnchorDrawableId(drawableId);
      setRigDraft(draft);
    },
    [session]
  );

  const updateRigDraft = useCallback((patch: Partial<WarpDeformerDraft>) => {
    setRigDraft((current) =>
      current === null ? current : updateWarpDeformerDraft(current, patch)
    );
  }, []);

  const fitRigDraft = useCallback(() => {
    setRigDraft((current) =>
      current === null ? current : fitWarpDeformerDraftToChildren(session, current)
    );
  }, [session]);

  const resetRigDraft = useCallback(() => {
    setRigDraft((current) =>
      current === null ? current : resetWarpDeformerDraft(session, current)
    );
  }, [session]);

  const cancelRigDraft = useCallback(() => {
    setRigDraft(null);
  }, []);

  const applyRigDraft = useCallback(() => {
    if (rigDraft === null) {
      return;
    }

    const payload = createWarpDeformerPayloadFromDraft(rigDraft);
    applyRigCommand(
      (currentSession) => commitCreateWarpDeformer(currentSession, payload),
      (result) => {
        setRigDraft(null);
        const rigControlId = (result as { readonly rigControlId?: RigControlId }).rigControlId;
        if (rigControlId !== undefined) {
          setSelection({ kind: "rigControl", id: rigControlId });
          setSelectionAnchorDrawableId(null);
        }
      },
      "Apply Warp Deformer"
    );
  }, [applyRigCommand, rigDraft]);

  const createRotationDeformerForDrawable = useCallback(
    (drawableId: DrawableId) => {
      const payload = createRotationDeformerPayloadForDrawable(session, drawableId);
      if (payload === undefined) {
        setRigOperationFeedback("Rotation Deformer could not be created for the selected Drawable.");
        return;
      }

      setRigDraft(null);
      setMeshDrafts([]);
      applyRigCommand(
        (currentSession) => commitCreateRotationDeformer(currentSession, payload),
        (result) => {
          const rigControlId = (result as { readonly rigControlId?: RigControlId }).rigControlId;
          if (rigControlId === undefined) {
            setSelection({ kind: "drawable", id: drawableId });
            setSelectionAnchorDrawableId(drawableId);
          } else {
            setSelection({ kind: "rigControl", id: rigControlId });
            setSelectionAnchorDrawableId(null);
          }
        },
        "Create Rotation Deformer"
      );
    },
    [applyRigCommand, session]
  );

  const createRotationDeformerForDrawables = useCallback(
    (drawableIds: readonly DrawableId[]) => {
      const payload = createRotationDeformerPayloadForUnboundDrawables(session, drawableIds);
      if (payload === undefined) {
        setRigOperationFeedback("No unbound selected Drawables are eligible for Rotation Deformer creation.");
        return;
      }

      setRigDraft(null);
      setMeshDrafts([]);
      applyRigCommand(
        (currentSession) => commitCreateRotationDeformer(currentSession, payload),
        (result) => {
          const rigControlId = (result as { readonly rigControlId?: RigControlId }).rigControlId;
          if (rigControlId === undefined) {
            const fallbackSelection = createDrawableSelection(drawableIds);
            setSelection(fallbackSelection);
            setSelectionAnchorDrawableId(getSingleSelectedDrawableId(fallbackSelection) ?? null);
          } else {
            setSelection({ kind: "rigControl", id: rigControlId });
            setSelectionAnchorDrawableId(null);
          }
        },
        "Create batch Rotation Deformer"
      );
    },
    [applyRigCommand, session]
  );

  const createWarpDeformerForDrawables = useCallback(
    (drawableIds: readonly DrawableId[]) => {
      const payload = createWarpDeformerPayloadForUnboundDrawables(session, drawableIds);
      if (payload === undefined) {
        setRigOperationFeedback("No unbound selected Drawables are eligible for Warp Deformer creation.");
        return;
      }

      setRigDraft(null);
      setMeshDrafts([]);
      applyRigCommand(
        (currentSession) => commitCreateWarpDeformer(currentSession, payload),
        (result) => {
          const rigControlId = (result as { readonly rigControlId?: RigControlId }).rigControlId;
          if (rigControlId === undefined) {
            const fallbackSelection = createDrawableSelection(drawableIds);
            setSelection(fallbackSelection);
            setSelectionAnchorDrawableId(getSingleSelectedDrawableId(fallbackSelection) ?? null);
          } else {
            setSelection({ kind: "rigControl", id: rigControlId });
            setSelectionAnchorDrawableId(null);
          }
        },
        "Create batch Warp Deformer"
      );
    },
    [applyRigCommand, session]
  );

  const createRotationDeformerForDeformerTreeSelection = useCallback(() => {
    const payload = createRotationDeformerPayloadForDeformerTreeSelection(session, selection);
    if (payload === undefined) {
      setRigOperationFeedback("Selected Deformer Tree targets cannot be wrapped by a Rotation Deformer.");
      return;
    }

    const fallbackSelection = selection;
    setRigDraft(null);
    setMeshDrafts([]);
    applyRigCommand(
      (currentSession) => commitCreateRotationDeformer(currentSession, payload),
      (result) => {
        const rigControlId = (result as { readonly rigControlId?: RigControlId }).rigControlId;
        if (rigControlId === undefined) {
          setSelection(fallbackSelection);
        } else {
          setSelection({ kind: "rigControl", id: rigControlId });
        }
        setSelectionAnchorDrawableId(null);
        setSelectionAnchorDeformerTreeTarget(null);
      },
      "Create selected Rotation Deformer"
    );
  }, [applyRigCommand, selection, session]);

  const createWarpDeformerForDeformerTreeSelection = useCallback(() => {
    const payload = createWarpDeformerPayloadForDeformerTreeSelection(session, selection);
    if (payload === undefined) {
      setRigOperationFeedback("Selected Deformer Tree targets cannot be wrapped by a Warp Deformer.");
      return;
    }

    const fallbackSelection = selection;
    setRigDraft(null);
    setMeshDrafts([]);
    applyRigCommand(
      (currentSession) => commitCreateWarpDeformer(currentSession, payload),
      (result) => {
        const rigControlId = (result as { readonly rigControlId?: RigControlId }).rigControlId;
        if (rigControlId === undefined) {
          setSelection(fallbackSelection);
        } else {
          setSelection({ kind: "rigControl", id: rigControlId });
        }
        setSelectionAnchorDrawableId(null);
        setSelectionAnchorDeformerTreeTarget(null);
      },
      "Create selected Warp Deformer"
    );
  }, [applyRigCommand, selection, session]);

  const createParentRotationDeformerForRigControl = useCallback(
    (rigControlId: RigControlId) => {
      const payload = createRotationDeformerParentPayloadForRigControl(session, rigControlId);
      if (payload === undefined) {
        setRigOperationFeedback("Parent Rotation Deformer could not be created.");
        return;
      }

      setRigDraft(null);
      setMeshDrafts([]);
      applyRigCommand(
        (currentSession) => commitCreateRotationDeformer(currentSession, payload),
        (result) => {
          const parentRigControlId = (result as { readonly rigControlId?: RigControlId }).rigControlId;
          setSelection(
            parentRigControlId === undefined
              ? { kind: "rigControl", id: rigControlId }
              : { kind: "rigControl", id: parentRigControlId }
          );
          setSelectionAnchorDrawableId(null);
        },
        "Create parent Rotation Deformer"
      );
    },
    [applyRigCommand, session]
  );

  const createParentWarpDeformerForRigControl = useCallback(
    (rigControlId: RigControlId) => {
      const payload = createWarpDeformerParentPayloadForRigControl(session, rigControlId);
      if (payload === undefined) {
        setRigOperationFeedback("Parent Warp Deformer could not be created.");
        return;
      }

      setRigDraft(null);
      setMeshDrafts([]);
      applyRigCommand(
        (currentSession) => commitCreateWarpDeformer(currentSession, payload),
        (result) => {
          const parentRigControlId = (result as { readonly rigControlId?: RigControlId }).rigControlId;
          setSelection(
            parentRigControlId === undefined
              ? { kind: "rigControl", id: rigControlId }
              : { kind: "rigControl", id: parentRigControlId }
          );
          setSelectionAnchorDrawableId(null);
        },
        "Create parent Warp Deformer"
      );
    },
    [applyRigCommand, session]
  );

  const bindDrawableToRigControl = useCallback(
    (drawableId: DrawableId, parentRigControlId: RigControlId) => {
      applyRigCommand(
        (currentSession) =>
          commitBindDrawableToRigControl(currentSession, drawableId, parentRigControlId),
        () => {
          setSelection({ kind: "drawable", id: drawableId });
          setSelectionAnchorDrawableId(drawableId);
        },
        "Bind Drawable to Deformer"
      );
    },
    [applyRigCommand]
  );

  const moveDrawableRigControlBinding = useCallback(
    (drawableId: DrawableId, targetRigControlId: RigControlId) => {
      applyRigCommand(
        (currentSession) =>
          commitMoveDrawableRigControlBinding(currentSession, drawableId, targetRigControlId),
        () => {
          setSelection({ kind: "drawable", id: drawableId });
          setSelectionAnchorDrawableId(drawableId);
        },
        "Move Drawable binding"
      );
    },
    [applyRigCommand]
  );

  const reparentRigControl = useCallback(
    (childRigControlId: RigControlId, parentRigControlId: RigControlId | null) => {
      applyRigCommand(
        (currentSession) =>
          commitReparentRigControl(currentSession, childRigControlId, parentRigControlId),
        () => {
          setSelection({ kind: "rigControl", id: childRigControlId });
          setSelectionAnchorDrawableId(null);
        },
        "Reparent Deformer"
      );
    },
    [applyRigCommand]
  );

  const updateRigControl = useCallback(
    (payload: UpdateRigControlPayloadDto) => {
      applyRigCommand(
        (currentSession) => commitUpdateRigControl(currentSession, payload),
        () => {
          setSelection({ kind: "rigControl", id: payload.rigControlId });
          setSelectionAnchorDrawableId(null);
        },
        "Update Deformer"
      );
    },
    [applyRigCommand]
  );

  const deleteRigControl = useCallback(
    (rigControlId: RigControlId) => {
      applyRigCommand(
        (currentSession) => commitDeleteRigControl(currentSession, { rigControlId }),
        () => {
          setSelection(null);
          setSelectionAnchorDrawableId(null);
          setSelectionAnchorDeformerTreeTarget(null);
          setRigDraft(null);
          setRigOperationFeedback(null);
        },
        "Delete Deformer"
      );
    },
    [applyRigCommand]
  );

  const commitGestureCommand = useCallback(
    (gesture: EditorSessionGestureCommit<unknown>) => {
      const currentState = editorStateRef.current;
      if (!requireOpenWorkspace("editing")) {
        return;
      }

      const outcome = commitEditorSessionGestureWithHistory({
        gesture,
        currentSession: currentState.session,
        history: currentState.history
      });
      const result = outcome.result;
      if (result.committed) {
        setEditorSessionState({
          session: result.session,
          history: outcome.history,
          baseDocument: currentState.baseDocument
        });
        return;
      }

      if (result.diagnostics.length > 0) {
        console.warn("Gesture command was rejected.", result.diagnostics);
      }
    },
    [requireOpenWorkspace, setEditorSessionState]
  );

  const commitGestureController = useCallback(
    <
      Preview,
      Result extends EditorSessionCommandResult = EditorSessionCommandResult
    >(
      controller: EditorSessionGestureCommitController<Preview, Result>
    ): Result | null => {
      const currentState = editorStateRef.current;
      if (!requireOpenWorkspace("editing")) {
        return createWorkspaceRequiredCommandResult(currentState.session, "editing") as Result;
      }

      const outcome = controller.commitOnce({
        currentSession: currentState.session,
        history: currentState.history
      });
      if (outcome === null) {
        return null;
      }

      const result = outcome.result;
      if (result.committed) {
        setEditorSessionState({
          session: result.session,
          history: outcome.history,
          baseDocument: currentState.baseDocument
        });
        setParameterOperationFeedback(null);
        return result;
      }

      if (result.diagnostics.length > 0) {
        const firstCheckId = result.diagnostics[0]?.checkId ?? "";
        if (firstCheckId.startsWith("operation.editKeyformKey.")) {
          setParameterOperationFeedback(formatKeyformFeedback(result.diagnostics));
        }
        console.warn("Gesture command was rejected.", result.diagnostics);
      }

      return result;
    },
    [requireOpenWorkspace, setEditorSessionState]
  );

  const openPsdImport = useCallback(() => {
    if (!requireOpenWorkspace("importing PSD")) {
      return;
    }

    setPsdImportOpen(true);
  }, [requireOpenWorkspace]);

  const value = useMemo<EditorSessionContextValue>(
    () => ({
      collapsedPartIds,
      editorHiddenPartIds,
      session,
      selection,
      meshDraft,
      meshDrafts,
      meshGenerationDiagnostic,
      rigDraft,
      structureRows,
      deformerRows,
      drawablePoolItems,
      inspector,
      parameterBar,
      activeParameterId: resolvedActiveParameterId,
      parameterValues,
      dynamicsToolPreview,
      dynamicsToolPreviewEvaluation,
      rigOperationFeedback,
      parameterOperationFeedback,
      variantPreviewActiveSelections,
      projectStorage,
      projectIdentityLabel,
      projectSaveStatusLabel,
      workspaceStorage,
      workspaceIdentityLabel,
      workspaceSaveStatusLabel,
      hasOpenWorkspace,
      psdImportOpen,
      canUndo: canUndoEditorSessionHistory(history),
      canRedo: canRedoEditorSessionHistory(history),
      undo,
      redo,
      createWorkspace,
      openWorkspace,
      saveWorkspaceAs,
      saveProject,
      exportPortableProject,
      openProjectFile,
      openProjectFromPortableBundle,
      openPsdImport,
      closePsdImport: () => setPsdImportOpen(false),
      openParameterManager,
      setActiveParameterId,
      setActiveParameterValue,
      resetActiveParameterValue,
      setDynamicsToolPreviewGroupId,
      setDynamicsToolPreviewDriverValue: setDynamicsToolPreviewDriver,
      advanceDynamicsToolPreviewSimulation,
      setDynamicsToolPreviewDefinitionOverride,
      clearDynamicsToolPreviewDefinitionOverride,
      resetDynamicsToolPreviewSimulation,
      selectPart,
      selectDrawable,
      selectRigControl,
      selectDeformerTreeTarget,
      togglePartCollapse,
      togglePartEditorVisibility,
      updatePartName: (partId, displayName) =>
        applyCommand((currentSession) => commitPartNameEdit(currentSession, partId, displayName)),
      updateDrawableName: (drawableId, displayName) =>
        applyCommand((currentSession) =>
          commitDrawableNameEdit(currentSession, drawableId, displayName)
        ),
      updateDrawableOpacity: (drawableId, opacity) =>
        applyCommand((currentSession) =>
          commitDrawableOpacityEdit(currentSession, drawableId, opacity)
        ),
      setDrawableRuntimeVisibility: (drawableId, runtimeVisibility) =>
        applyCommand((currentSession) =>
          commitDrawableRuntimeVisibility(currentSession, drawableId, runtimeVisibility)
        ),
      setDrawableMaskSource: (drawableId, maskDrawableId) =>
        applyCommand((currentSession) =>
          commitDrawableMaskSourceEdit(currentSession, drawableId, maskDrawableId)
        ),
      reorderDrawable: (draggedDrawableId, targetDrawableId, placement) =>
        applyCommand((currentSession) =>
          commitDrawableReorder(currentSession, draggedDrawableId, targetDrawableId, placement)
        ),
      reparentDrawable: (drawableId, partId) =>
        applyCommand((currentSession) =>
          commitDrawableReparent(currentSession, drawableId, partId)
        ),
      reparentPart: (partId, parentPartId) =>
        applyCommand((currentSession) => commitPartReparent(currentSession, partId, parentPartId)),
      moveStructureChild,
      previewMeshDraft,
      previewMeshDrafts,
      applyMeshDraft,
      cancelMeshDraft,
      startWarpDeformerDraftForDrawable,
      updateWarpDeformerDraft: updateRigDraft,
      fitWarpDeformerDraft: fitRigDraft,
      resetWarpDeformerDraft: resetRigDraft,
      applyWarpDeformerDraft: applyRigDraft,
      cancelWarpDeformerDraft: cancelRigDraft,
      createRotationDeformerForDrawable,
      createRotationDeformerForDrawables,
      createWarpDeformerForDrawables,
      createRotationDeformerForDeformerTreeSelection,
      createWarpDeformerForDeformerTreeSelection,
      createParentRotationDeformerForRigControl,
      createParentWarpDeformerForRigControl,
      bindDrawableToRigControl,
      moveDrawableRigControlBinding,
      reparentRigControl,
      updateRigControl,
      deleteRigControl,
      editKeyformKey,
      createDynamicsGroup,
      updateDynamicsGroup,
      deleteDynamicsGroup,
      createVariantGroup,
      updateVariantGroup,
      deleteVariantGroup,
      createVariant,
      updateVariant,
      deleteVariant,
      addVariantTargetDrawable,
      removeVariantTargetDrawable,
      setVariantMembership,
      setVariantDefaultActiveSelection,
      setVariantPreviewActiveSelection,
      resetVariantPreviewActiveSelections,
      commitGestureCommand,
      commitGestureController,
      createCustomParameter,
      updateCustomParameter,
      deleteCustomParameter,
      resolvePsdImportDestination,
      commitPsdImport,
      applyTextureAtlasPreview
    }),
    [
      applyCommand,
      applyTextureAtlasPreview,
      advanceDynamicsToolPreviewSimulation,
      addVariantTargetDrawable,
      collapsedPartIds,
      applyMeshDraft,
      cancelMeshDraft,
      commitPsdImport,
      cancelRigDraft,
      bindDrawableToRigControl,
      clearDynamicsToolPreviewDefinitionOverride,
      createParentRotationDeformerForRigControl,
      createParentWarpDeformerForRigControl,
      createRotationDeformerForDrawable,
      createRotationDeformerForDrawables,
      createRotationDeformerForDeformerTreeSelection,
      createWarpDeformerForDrawables,
      createWarpDeformerForDeformerTreeSelection,
      createCustomParameter,
      createDynamicsGroup,
      createVariant,
      createVariantGroup,
      commitGestureCommand,
      commitGestureController,
      deformerRows,
      deleteCustomParameter,
      deleteDynamicsGroup,
      deleteRigControl,
      deleteVariant,
      deleteVariantGroup,
      drawablePoolItems,
      dynamicsToolPreview,
      dynamicsToolPreviewEvaluation,
      editKeyformKey,
      editorHiddenPartIds,
      fitRigDraft,
      history,
      inspector,
      meshDraft,
      meshDrafts,
      meshGenerationDiagnostic,
      moveDrawableRigControlBinding,
      openProjectFile,
      openProjectFromPortableBundle,
      openParameterManager,
      parameterBar,
      parameterOperationFeedback,
      parameterValues,
      projectIdentityLabel,
      projectSaveStatusLabel,
      workspaceStorage,
      workspaceIdentityLabel,
      workspaceSaveStatusLabel,
      hasOpenWorkspace,
      projectStorage,
      psdImportOpen,
      previewMeshDraft,
      previewMeshDrafts,
      applyRigDraft,
      createWorkspace,
      openWorkspace,
      saveWorkspaceAs,
      exportPortableProject,
      openPsdImport,
      redo,
      reparentRigControl,
      resetActiveParameterValue,
      resetDynamicsToolPreviewSimulation,
      resetVariantPreviewActiveSelections,
      resetRigDraft,
      resolvePsdImportDestination,
      rigOperationFeedback,
      rigDraft,
      selection,
      resolvedActiveParameterId,
      saveProject,
      selectDrawable,
      selectPart,
      selectRigControl,
      selectDeformerTreeTarget,
      session,
      setVariantDefaultActiveSelection,
      setVariantMembership,
      setVariantPreviewActiveSelection,
      setActiveParameterId,
      setActiveParameterValue,
      setDynamicsToolPreviewDefinitionOverride,
      setDynamicsToolPreviewDriver,
      setDynamicsToolPreviewGroupId,
      startWarpDeformerDraftForDrawable,
      structureRows,
      moveStructureChild,
      togglePartCollapse,
      togglePartEditorVisibility,
      undo,
      updateCustomParameter,
      updateDynamicsGroup,
      updateVariant,
      updateVariantGroup,
      updateRigControl,
      updateRigDraft,
      removeVariantTargetDrawable,
      variantPreviewActiveSelections
    ]
  );

  return (
    <EditorSessionContext.Provider value={value}>{children}</EditorSessionContext.Provider>
  );
}

export function useEditorSession() {
  const context = useContext(EditorSessionContext);
  if (context === null) {
    throw new Error("useEditorSession must be used within EditorSessionProvider.");
  }

  return context;
}

interface MeshToolDraftResult {
  readonly draft?: MeshToolDraft;
  readonly diagnostic: MeshToolGenerationDiagnostic | null;
}

function createMeshToolDraft(input: {
  readonly session: AuthoringSession;
  readonly drawableId: DrawableId;
  readonly presetId: MeshGenerationPresetId;
  readonly commitMode: MeshToolDraft["commitMode"];
}): MeshToolDraftResult {
  const preset = getMeshGenerationPreset(input.presetId);
  const drawable = input.session.graph.drawables.find(
    (candidate) => candidate.drawableId === input.drawableId
  );
  const existingMesh =
    drawable === undefined
      ? undefined
      : input.session.graph.meshes.find((candidate) => candidate.meshId === drawable.meshId);
  const generated = createGeneratedMeshForDrawable({
    session: input.session,
    drawableId: input.drawableId,
    provenanceId: createMeshPreviewProvenanceId(
      input.drawableId,
      input.presetId,
      DEFAULT_MESH_GENERATION_METHOD
    ),
    method: DEFAULT_MESH_GENERATION_METHOD,
    densityHint: preset.densityHint
  });
  logMeshGenerationPreviewDebug({
    session: input.session,
    drawableId: input.drawableId,
    presetId: input.presetId,
    method: DEFAULT_MESH_GENERATION_METHOD,
    densityHint: preset.densityHint,
    generated
  });

  if (generated === undefined) {
    return {
      diagnostic: {
        kind: "generationFailed",
        drawableId: input.drawableId,
        ...(drawable === undefined ? {} : { drawableName: drawable.displayName }),
        presetId: input.presetId,
        densityHint: preset.densityHint,
        method: DEFAULT_MESH_GENERATION_METHOD,
        ...(existingMesh === undefined ? {} : { meshBounds: existingMesh.bounds }),
        vertexCount: 0,
        triangleCount: 0,
        failureReason: "createGeneratedMeshForDrawable returned no preview result."
      }
    };
  }

  return {
    draft: {
      drawableId: input.drawableId,
      presetId: input.presetId,
      commitMode: input.commitMode,
      method: DEFAULT_MESH_GENERATION_METHOD,
      mesh: generated.mesh,
      source: generated.source,
      ...(generated.alphaBounds === undefined ? {} : { alphaBounds: generated.alphaBounds }),
      ...(generated.fallbackReason === undefined ? {} : { fallbackReason: generated.fallbackReason }),
      ...(generated.fallbackSteps === undefined ? {} : { fallbackSteps: generated.fallbackSteps }),
      ...(generated.qualityMetrics === undefined ? {} : { qualityMetrics: generated.qualityMetrics })
    },
    diagnostic: null
  };
}

function createMeshToolDraftCompatValue(
  drafts: readonly MeshToolDraft[]
): MeshToolDraft | null {
  if (drafts.length === 0) {
    return null;
  }

  if (drafts.length === 1) {
    return drafts[0]!;
  }

  return {
    ...drafts[0]!,
    meshDrafts: drafts
  };
}

function filterMeshDraftsForSelection(
  drafts: readonly MeshToolDraft[],
  selection: EditorSelection | null
): readonly MeshToolDraft[] {
  const selectedDrawableIds = new Set(getSelectedDrawableIds(selection));

  return drafts.filter((draft) => selectedDrawableIds.has(draft.drawableId));
}

function isDefined<TValue>(value: TValue | undefined): value is TValue {
  return value !== undefined;
}

function formatCommandFeedback(result: EditorSessionCommandResult): string {
  return result.diagnostics[0]?.message ?? "Rig operation was rejected.";
}

function formatParameterCommandFeedback(result: EditorSessionCommandResult): string {
  return result.diagnostics[0]?.message ?? "Parameter definition operation was rejected.";
}

function createWorkspaceRequiredCommandResult(
  session: AuthoringSession,
  action: string
): EditorSessionCommandResult {
  return {
    committed: false,
    session,
    diagnostics: [createWorkspaceRequiredDiagnostic(action)]
  };
}

function createWorkspaceRequiredDiagnostic(action: string): DiagnosticDto {
  return {
    checkId: "workspace.required" as DiagnosticDto["checkId"],
    status: "fail",
    severity: "error",
    phase: "editor.workspace",
    target: {
      kind: "package",
      id: "current"
    },
    message: `Create or open a workspace before ${action}.`,
    evidence: [],
    relatedAC: [],
    relatedScenarios: [],
    repairCandidateIds: []
  };
}

function classifyWorkspaceStorageErrorStatus(
  code: string
): NonNullable<Parameters<typeof createWorkspaceStorageErrorState>[0]["status"]> {
  if (code === "permission-denied") {
    return "permission-denied";
  }

  if (code === "permission-lost") {
    return "permission-lost";
  }

  if (code === "unsupported") {
    return "unsupported";
  }

  return "save-failed";
}

function confirmDirtyWorkspaceReplacementWithBrowser(
  request: DirtyWorkspaceReplacementRequest
): DirtyWorkspaceReplacementDecision {
  const confirm = globalThis.confirm;

  if (typeof confirm !== "function") {
    return "cancel";
  }

  return confirm(`${request.message}\n\nOK saves and continues. Cancel keeps the current workspace.`)
    ? "save-and-open"
    : "cancel";
}

function samePreviewParameterValue(left: number, right: number): boolean {
  return Math.abs(left - right) <= 0.000001;
}
