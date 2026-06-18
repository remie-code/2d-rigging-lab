import type {
  AuthoringSession,
  DrawableGeneratedMeshResult,
  GeneratedMeshPreviewCommitMethod,
  StructureOrderDrop,
  StructureOrderItem
} from "@private-2d-rigging-lab/authoring-core";
import {
  createGeneratedMeshForDrawable,
  createPackageDocumentBaseFromAuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import { recordLive2dPerformanceCounter } from "@private-2d-rigging-lab/render-core";
import type {
  DynamicsGroupId,
  DrawableId,
  ParameterId,
  PartId,
  RigControlId
} from "@private-2d-rigging-lab/contracts";
import type {
  CreateDynamicsGroupPayloadDto,
  CreateParameterPayloadDto,
  DeleteDynamicsGroupPayloadDto,
  DeleteParameterPayloadDto,
  EditKeyformKeyPayloadDto,
  UpdateDynamicsGroupPayloadDto,
  UpdateParameterPayloadDto,
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
  createProjectIdentityLabel,
  createProjectSaveStatusLabel,
  createProjectStorageErrorState,
  createSavedProjectStorageState,
  createSavingProjectStorageState,
  type ProjectStorageState
} from "../project-storage/model/project-storage-state";
import { commitPsdImportPlan } from "../psd-import/model/psd-import-commit";
import type { PsdImportPlan } from "../psd-import/model/psd-import-types";
import {
  commitDrawableMaskSourceEdit,
  commitDrawableNameEdit,
  commitDrawableOpacityEdit,
  commitDrawableReorder,
  commitDrawableReparent,
  commitDrawableRuntimeVisibility,
  commitCreateDynamicsGroup,
  commitDeleteDynamicsGroup,
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
import { createEmptyAuthoringSession } from "./model/empty-authoring-session";
import type { DeformerTreeSelectionTarget, EditorSelection } from "./model/editor-selection";
import type {
  EditorSessionGestureCommit,
  EditorSessionGestureCommitController
} from "./model/editor-session-gesture-commit";
import { commitEditorSessionGestureWithHistory } from "./model/editor-session-gesture-commit";
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
  createDynamicsToolPreviewEvaluation,
  createInitialDynamicsToolPreviewState,
  resetDynamicsToolPreviewSimulation as resetDynamicsToolPreviewSimulationState,
  selectDynamicsToolPreviewGroup,
  setDynamicsToolPreviewDriverValue,
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
    supportRingDiagnostics,
    adaptiveStaggeredBandDiagnostics
  };

  const log = generated === undefined || generated.fallbackReason !== undefined || v6Metrics?.outputKind !== "backend-output"
    ? console.warn
    : console.info;
  log("[mesh-generation:preview]", summary);
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
  readonly projectStorage: ProjectStorageState;
  readonly projectIdentityLabel: string;
  readonly projectSaveStatusLabel: string;
  readonly psdImportOpen: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly saveProject: () => Promise<void>;
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
}

const EditorSessionContext = createContext<EditorSessionContextValue | null>(null);

export interface EditorSessionProviderProps {
  readonly children?: ReactNode;
  readonly initialSelection?: EditorSelection | null;
  readonly initialSession?: AuthoringSession;
}

export function EditorSessionProvider({
  children,
  initialSelection = null,
  initialSession
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
  const [collapsedPartIds, setCollapsedPartIds] = useState<ReadonlySet<PartId>>(
    () => createInitialCollapsedPartIds(session)
  );
  const [editorHiddenPartIds, setEditorHiddenPartIds] = useState<ReadonlySet<PartId>>(
    () => new Set()
  );
  const [meshDrafts, setMeshDrafts] = useState<readonly MeshToolDraft[]>([]);
  const meshDraft = useMemo(() => createMeshToolDraftCompatValue(meshDrafts), [meshDrafts]);
  const [rigDraft, setRigDraft] = useState<WarpDeformerDraft | null>(null);
  const [rigOperationFeedback, setRigOperationFeedback] = useState<string | null>(null);
  const [parameterOperationFeedback, setParameterOperationFeedback] = useState<string | null>(null);
  const [projectStorage, setProjectStorage] = useState<ProjectStorageState>(() =>
    createIdleProjectStorageState()
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
  const projectIdentityLabel = useMemo(
    () => createProjectIdentityLabel(session),
    [session]
  );
  const projectSaveStatusLabel = useMemo(
    () => createProjectSaveStatusLabel(session, projectStorage),
    [projectStorage, session]
  );

  useEffect(() => {
    if (activeParameterId !== resolvedActiveParameterId) {
      setActiveParameterIdState(resolvedActiveParameterId);
    }
  }, [activeParameterId, resolvedActiveParameterId]);

  useEffect(() => {
    if (activeTool !== "mesh") {
      setMeshDrafts([]);
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
    setRigDraft(null);
    setDynamicsToolPreview(createInitialDynamicsToolPreviewState());
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
    setPsdImportOpen(false);
  }, [clearTransientCommitState]);

  const runCommandWithHistory = useCallback(
    <Result extends EditorSessionCommandResult,>(
      command: (currentSession: AuthoringSession) => Result,
      label?: string
    ): Result => {
      const currentState = editorStateRef.current;
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
    [setEditorSessionState]
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

  const saveProject = useCallback(async () => {
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

      if (editorStateRef.current.session === currentState.session) {
        const savedSession = structuredClone(currentState.session);
        savedSession.dirty = false;
        setEditorSessionState({
          session: savedSession,
          history: currentState.history,
          baseDocument: result.packageDocument
        });
      }

      setProjectStorage(createSavedProjectStorageState(result));
    } catch (error) {
      setProjectStorage(
        createProjectStorageErrorState(toEditorProjectStorageError(error, "save"), "save")
      );
    }
  }, [editorHiddenPartIds, setEditorSessionState]);

  const openProjectFromPortableBundle = useCallback(
    async (bundleText: string, options: { readonly fileName?: string } = {}) => {
      setProjectStorage(createLoadingProjectStorageState(options.fileName));

      try {
        const result = await importEditorProjectBundle({ bundleText });
        setEditorSessionState({
          session: result.session,
          history: createEmptyEditorSessionHistory(),
          baseDocument: result.packageDocument
        });
        resetEditorLocalStateAfterProjectLoad({
          loadedSession: result.session,
          editorHiddenPartIds: result.editorHiddenPartIds
        });
        setProjectStorage(createLoadedProjectStorageState(result, options.fileName));
      } catch (error) {
        setProjectStorage(
          createProjectStorageErrorState(
            toEditorProjectStorageError(error, "open"),
            "open",
            options.fileName
          )
        );
      }
    },
    [resetEditorLocalStateAfterProjectLoad, setEditorSessionState]
  );

  const openProjectFile = useCallback(
    async (file: File) => {
      setProjectStorage(createLoadingProjectStorageState(file.name));

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
    },
    [setEditorSessionState]
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
  }, []);

  const previewMeshDraft = useCallback(
    (
      drawableId: DrawableId,
      presetId: MeshGenerationPresetId
    ) => {
      const draft = createMeshToolDraft({
        commitMode: "single",
        drawableId,
        presetId,
        session
      });

      setMeshDrafts(draft === undefined ? [] : [draft]);
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
      const drafts = eligibleDrawableIds
        .map((drawableId) =>
          createMeshToolDraft({
            commitMode: "batchEligible",
            drawableId,
            presetId,
            session
          })
        )
        .filter(isDefined);

      setMeshDrafts(drafts);
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
          : { committed: true, session: nextSession, diagnostics };
      },
      draftsToApply.length === 1 ? "Apply mesh" : "Apply meshes"
    );
    if (result.committed) {
      setMeshDrafts([]);
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

  const commitGestureCommand = useCallback(
    (gesture: EditorSessionGestureCommit<unknown>) => {
      const currentState = editorStateRef.current;
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
    [setEditorSessionState]
  );

  const commitGestureController = useCallback(
    <
      Preview,
      Result extends EditorSessionCommandResult = EditorSessionCommandResult
    >(
      controller: EditorSessionGestureCommitController<Preview, Result>
    ): Result | null => {
      const currentState = editorStateRef.current;
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
    [setEditorSessionState]
  );

  const value = useMemo<EditorSessionContextValue>(
    () => ({
      collapsedPartIds,
      editorHiddenPartIds,
      session,
      selection,
      meshDraft,
      meshDrafts,
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
      projectStorage,
      projectIdentityLabel,
      projectSaveStatusLabel,
      psdImportOpen,
      canUndo: canUndoEditorSessionHistory(history),
      canRedo: canRedoEditorSessionHistory(history),
      undo,
      redo,
      saveProject,
      openProjectFile,
      openProjectFromPortableBundle,
      openPsdImport: () => setPsdImportOpen(true),
      closePsdImport: () => setPsdImportOpen(false),
      openParameterManager,
      setActiveParameterId,
      setActiveParameterValue,
      resetActiveParameterValue,
      setDynamicsToolPreviewGroupId,
      setDynamicsToolPreviewDriverValue: setDynamicsToolPreviewDriver,
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
      editKeyformKey,
      createDynamicsGroup,
      updateDynamicsGroup,
      deleteDynamicsGroup,
      commitGestureCommand,
      commitGestureController,
      createCustomParameter,
      updateCustomParameter,
      deleteCustomParameter,
      resolvePsdImportDestination,
      commitPsdImport
    }),
    [
      applyCommand,
      collapsedPartIds,
      applyMeshDraft,
      cancelMeshDraft,
      commitPsdImport,
      cancelRigDraft,
      bindDrawableToRigControl,
      createParentRotationDeformerForRigControl,
      createParentWarpDeformerForRigControl,
      createRotationDeformerForDrawable,
      createRotationDeformerForDrawables,
      createRotationDeformerForDeformerTreeSelection,
      createWarpDeformerForDrawables,
      createWarpDeformerForDeformerTreeSelection,
      createCustomParameter,
      createDynamicsGroup,
      commitGestureCommand,
      commitGestureController,
      deformerRows,
      deleteCustomParameter,
      deleteDynamicsGroup,
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
      moveDrawableRigControlBinding,
      openProjectFile,
      openProjectFromPortableBundle,
      openParameterManager,
      parameterBar,
      parameterOperationFeedback,
      parameterValues,
      projectIdentityLabel,
      projectSaveStatusLabel,
      projectStorage,
      psdImportOpen,
      previewMeshDraft,
      previewMeshDrafts,
      applyRigDraft,
      redo,
      reparentRigControl,
      resetActiveParameterValue,
      resetDynamicsToolPreviewSimulation,
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
      setActiveParameterId,
      setActiveParameterValue,
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
      updateRigControl,
      updateRigDraft
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

function createMeshToolDraft(input: {
  readonly session: AuthoringSession;
  readonly drawableId: DrawableId;
  readonly presetId: MeshGenerationPresetId;
  readonly commitMode: MeshToolDraft["commitMode"];
}): MeshToolDraft | undefined {
  const preset = getMeshGenerationPreset(input.presetId);
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
    return undefined;
  }

  return {
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

function samePreviewParameterValue(left: number, right: number): boolean {
  return Math.abs(left - right) <= 0.000001;
}
