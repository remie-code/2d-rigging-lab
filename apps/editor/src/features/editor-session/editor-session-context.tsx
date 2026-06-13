import type {
  AuthoringSession,
  DrawableGeneratedMeshResult,
  StructureOrderDrop,
  StructureOrderItem
} from "@private-2d-rigging-lab/authoring-core";
import { createGeneratedMeshForDrawable } from "@private-2d-rigging-lab/authoring-core";
import type {
  DrawableId,
  ParameterId,
  PartId,
  RigControlId
} from "@private-2d-rigging-lab/contracts";
import type {
  CreateParameterPayloadDto,
  DeleteParameterPayloadDto,
  EditKeyformKeyPayloadDto,
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

import { commitPsdImportPlan } from "../psd-import/model/psd-import-commit";
import type { PsdImportPlan } from "../psd-import/model/psd-import-types";
import {
  commitDrawableMaskSourceEdit,
  commitDrawableNameEdit,
  commitDrawableOpacityEdit,
  commitDrawableReorder,
  commitDrawableReparent,
  commitDrawableRuntimeVisibility,
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
  commitUpdateRigControl,
  type EditorSessionCommandResult
} from "./model/editor-session-commands";
import { createEmptyAuthoringSession } from "./model/empty-authoring-session";
import type { EditorSelection } from "./model/editor-selection";
import type {
  EditorSessionGestureCommit,
  EditorSessionGestureCommitController
} from "./model/editor-session-gesture-commit";
import { commitEditorSessionGestureWithHistory } from "./model/editor-session-gesture-commit";
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
  createMeshPreviewProvenanceId,
  getMeshGenerationPreset,
  type MeshGenerationPresetId
} from "./model/mesh-tool-state";
import { mergeEditorHiddenPartIds } from "./model/editor-hidden-part-state";
import {
  createDrawablePoolItems,
  createDeformerTreeRows,
  createRotationDeformerPayloadForDrawable,
  createRotationDeformerParentPayloadForRigControl,
  createWarpDeformerParentPayloadForRigControl,
  createWarpDeformerDraftForDrawable,
  createWarpDeformerPayloadFromDraft,
  fitWarpDeformerDraftToChildren,
  resetWarpDeformerDraft,
  updateWarpDeformerDraft,
  type DeformerTreeRow,
  type DrawablePoolItem,
  type WarpDeformerDraft
} from "./model/rig-tool-state";
import {
  createInspectorProjection,
  createStructureTreeRows,
  resolveDestinationPart,
  type InspectorProjection,
  type StructureTreeRow
} from "./model/session-tree";
import { useEditorUiStore } from "../../state/editor-ui-store";

export interface MeshToolDraft {
  readonly drawableId: DrawableId;
  readonly presetId: MeshGenerationPresetId;
  readonly mesh: AuthoringSession["graph"]["meshes"][number];
  readonly source: DrawableGeneratedMeshResult["source"];
  readonly alphaBounds?: DrawableGeneratedMeshResult["alphaBounds"];
  readonly fallbackReason?: DrawableGeneratedMeshResult["fallbackReason"];
  readonly fallbackSteps?: DrawableGeneratedMeshResult["fallbackSteps"];
  readonly qualityMetrics?: DrawableGeneratedMeshResult["qualityMetrics"];
}

interface EditorSessionState {
  readonly session: AuthoringSession;
  readonly history: EditorSessionHistoryState;
}

interface EditorSessionContextValue {
  readonly session: AuthoringSession;
  readonly selection: EditorSelection | null;
  readonly collapsedPartIds: ReadonlySet<PartId>;
  readonly editorHiddenPartIds: ReadonlySet<PartId>;
  readonly meshDraft: MeshToolDraft | null;
  readonly rigDraft: WarpDeformerDraft | null;
  readonly structureRows: readonly StructureTreeRow[];
  readonly deformerRows: readonly DeformerTreeRow[];
  readonly drawablePoolItems: readonly DrawablePoolItem[];
  readonly inspector: InspectorProjection;
  readonly parameterBar: ParameterBarProjection;
  readonly activeParameterId: ParameterId | null;
  readonly parameterValues: ParameterValueMap;
  readonly rigOperationFeedback: string | null;
  readonly parameterOperationFeedback: string | null;
  readonly psdImportOpen: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly openPsdImport: () => void;
  readonly closePsdImport: () => void;
  readonly openParameterManager: () => void;
  readonly setActiveParameterId: (parameterId: ParameterId) => void;
  readonly setActiveParameterValue: (value: number) => void;
  readonly resetActiveParameterValue: () => void;
  readonly selectPart: (partId: PartId) => void;
  readonly selectDrawable: (drawableId: DrawableId) => void;
  readonly selectRigControl: (rigControlId: RigControlId) => void;
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
  readonly applyMeshDraft: () => void;
  readonly cancelMeshDraft: () => void;
  readonly startWarpDeformerDraftForDrawable: (drawableId: DrawableId) => void;
  readonly updateWarpDeformerDraft: (patch: Partial<WarpDeformerDraft>) => void;
  readonly fitWarpDeformerDraft: () => void;
  readonly resetWarpDeformerDraft: () => void;
  readonly applyWarpDeformerDraft: () => void;
  readonly cancelWarpDeformerDraft: () => void;
  readonly createRotationDeformerForDrawable: (drawableId: DrawableId) => void;
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

export function EditorSessionProvider({ children }: { readonly children: ReactNode }) {
  const activeTool = useEditorUiStore((state) => state.activeTool);
  const setActiveEntry = useEditorUiStore((state) => state.setActiveEntry);
  const [editorState, setEditorState] = useState<EditorSessionState>(() => ({
    session: createEmptyAuthoringSession(),
    history: createEmptyEditorSessionHistory()
  }));
  const editorStateRef = useRef(editorState);
  const setEditorSessionState = useCallback((nextState: EditorSessionState) => {
    editorStateRef.current = nextState;
    setEditorState(nextState);
  }, []);
  const { history, session } = editorState;
  const [selection, setSelection] = useState<EditorSelection | null>(null);
  const [activeParameterId, setActiveParameterIdState] = useState<ParameterId | null>(null);
  const [parameterValues, setParameterValues] = useState<ParameterValueMap>({});
  const [collapsedPartIds, setCollapsedPartIds] = useState<ReadonlySet<PartId>>(
    () => new Set()
  );
  const [editorHiddenPartIds, setEditorHiddenPartIds] = useState<ReadonlySet<PartId>>(
    () => new Set()
  );
  const [meshDraft, setMeshDraft] = useState<MeshToolDraft | null>(null);
  const [rigDraft, setRigDraft] = useState<WarpDeformerDraft | null>(null);
  const [rigOperationFeedback, setRigOperationFeedback] = useState<string | null>(null);
  const [parameterOperationFeedback, setParameterOperationFeedback] = useState<string | null>(null);
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

  useEffect(() => {
    if (activeParameterId !== resolvedActiveParameterId) {
      setActiveParameterIdState(resolvedActiveParameterId);
    }
  }, [activeParameterId, resolvedActiveParameterId]);

  useEffect(() => {
    if (activeTool !== "mesh") {
      setMeshDraft(null);
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
    setParameterOperationFeedback(null);
  }, [resolvedActiveParameterId, selection]);

  useEffect(() => {
    setMeshDraft((current) => {
      if (current === null) {
        return current;
      }

      return selection?.kind === "drawable" && selection.id === current.drawableId
        ? current
        : null;
    });
  }, [selection]);

  const resolvePsdImportDestination = useCallback(() => {
    const destination = resolveDestinationPart(session, selection);

    return {
      parentPartId: destination.partId,
      label: destination.displayName
    };
  }, [session, selection]);

  const clearTransientCommitState = useCallback(() => {
    setMeshDraft(null);
    setRigDraft(null);
    setRigOperationFeedback(null);
    setParameterOperationFeedback(null);
  }, []);

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
          history: outcome.history
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
      history: outcome.history
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
      history: outcome.history
    });
    clearTransientCommitState();
  }, [clearTransientCommitState, setEditorSessionState]);

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
        history: nextHistory
      });
      setEditorHiddenPartIds((current) =>
        mergeEditorHiddenPartIds(current, result.editorHiddenPartIds)
      );
      setSelection({ kind: "part", id: plan.importRootPartId });
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
  }, [runCommandWithHistory]);

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

  const setActiveParameterId = useCallback((parameterId: ParameterId) => {
    setActiveParameterIdState(parameterId);
  }, []);

  const setActiveParameterValue = useCallback(
    (value: number) => {
      if (resolvedActiveParameterId === null) {
        return;
      }

      const parameter = listEditorParameters(session).find(
        (candidate) => candidate.parameterId === resolvedActiveParameterId
      );
      if (parameter === undefined) {
        return;
      }

      setParameterValues((current) => ({
        ...current,
        [resolvedActiveParameterId]: clampParameterValue(parameter, value)
      }));
    },
    [resolvedActiveParameterId, session]
  );

  const resetActiveParameterValue = useCallback(() => {
    if (resolvedActiveParameterId === null) {
      return;
    }

    const parameter = listEditorParameters(session).find(
      (candidate) => candidate.parameterId === resolvedActiveParameterId
    );
    if (parameter === undefined) {
      return;
    }

    setParameterValues((current) => ({
      ...current,
      [resolvedActiveParameterId]: parameter.default
    }));
  }, [resolvedActiveParameterId, session]);

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
      setSelection(
        moved.kind === "part"
          ? { kind: "part", id: moved.partId }
          : { kind: "drawable", id: moved.drawableId }
      );
      return;
    }

    if (result.diagnostics.length > 0) {
      console.warn("Editor command was rejected.", result.diagnostics);
    }
  }, [runCommandWithHistory]);

  const selectPart = useCallback((partId: PartId) => {
    setMeshDraft(null);
    setSelection({ kind: "part", id: partId });
  }, []);

  const selectDrawable = useCallback((drawableId: DrawableId) => {
    setMeshDraft((current) =>
      current?.drawableId === drawableId ? current : null
    );
    setSelection({ kind: "drawable", id: drawableId });
  }, []);

  const selectRigControl = useCallback((rigControlId: RigControlId) => {
    setMeshDraft(null);
    setSelection({ kind: "rigControl", id: rigControlId });
  }, []);

  const cancelMeshDraft = useCallback(() => {
    setMeshDraft(null);
  }, []);

  const previewMeshDraft = useCallback(
    (drawableId: DrawableId, presetId: MeshGenerationPresetId) => {
      const preset = getMeshGenerationPreset(presetId);
      const generated = createGeneratedMeshForDrawable({
        session,
        drawableId,
        provenanceId: createMeshPreviewProvenanceId(drawableId, presetId),
        method: "auto-outline-v2.6-soft-apron",
        densityHint: preset.densityHint
      });

      if (generated === undefined) {
        setMeshDraft(null);
        return;
      }

      setMeshDraft({
        drawableId,
        presetId,
        mesh: generated.mesh,
        source: generated.source,
        ...(generated.alphaBounds === undefined ? {} : { alphaBounds: generated.alphaBounds }),
        ...(generated.fallbackReason === undefined ? {} : { fallbackReason: generated.fallbackReason }),
        ...(generated.fallbackSteps === undefined ? {} : { fallbackSteps: generated.fallbackSteps }),
        ...(generated.qualityMetrics === undefined ? {} : { qualityMetrics: generated.qualityMetrics })
      });
    },
    [session]
  );

  const applyMeshDraft = useCallback(() => {
    if (meshDraft === null) {
      return;
    }

    const preset = getMeshGenerationPreset(meshDraft.presetId);
    const result = runCommandWithHistory(
      (sessionForCommand) =>
        commitGenerateMesh(
          sessionForCommand,
          meshDraft.drawableId,
          preset.densityHint,
          meshDraft.mesh,
          "auto-outline-v2.6-soft-apron"
        ),
      "Apply mesh"
    );
    if (result.committed) {
      setMeshDraft(null);
      setSelection({ kind: "drawable", id: meshDraft.drawableId });
      return;
    }

    if (result.diagnostics.length > 0) {
      console.warn("Editor command was rejected.", result.diagnostics);
    }
  }, [meshDraft, runCommandWithHistory]);

  const startWarpDeformerDraftForDrawable = useCallback(
    (drawableId: DrawableId) => {
      const draft = createWarpDeformerDraftForDrawable(session, drawableId);
      if (draft === undefined) {
        setRigDraft(null);
        return;
      }

      setMeshDraft(null);
      setSelection({ kind: "drawable", id: drawableId });
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
      setMeshDraft(null);
      applyRigCommand(
        (currentSession) => commitCreateRotationDeformer(currentSession, payload),
        (result) => {
          const rigControlId = (result as { readonly rigControlId?: RigControlId }).rigControlId;
          setSelection(
            rigControlId === undefined
              ? { kind: "drawable", id: drawableId }
              : { kind: "rigControl", id: rigControlId }
          );
        },
        "Create Rotation Deformer"
      );
    },
    [applyRigCommand, session]
  );

  const createParentRotationDeformerForRigControl = useCallback(
    (rigControlId: RigControlId) => {
      const payload = createRotationDeformerParentPayloadForRigControl(session, rigControlId);
      if (payload === undefined) {
        setRigOperationFeedback("Parent Rotation Deformer could not be created.");
        return;
      }

      setRigDraft(null);
      setMeshDraft(null);
      applyRigCommand(
        (currentSession) => commitCreateRotationDeformer(currentSession, payload),
        (result) => {
          const parentRigControlId = (result as { readonly rigControlId?: RigControlId }).rigControlId;
          setSelection(
            parentRigControlId === undefined
              ? { kind: "rigControl", id: rigControlId }
              : { kind: "rigControl", id: parentRigControlId }
          );
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
      setMeshDraft(null);
      applyRigCommand(
        (currentSession) => commitCreateWarpDeformer(currentSession, payload),
        (result) => {
          const parentRigControlId = (result as { readonly rigControlId?: RigControlId }).rigControlId;
          setSelection(
            parentRigControlId === undefined
              ? { kind: "rigControl", id: rigControlId }
              : { kind: "rigControl", id: parentRigControlId }
          );
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
        () => setSelection({ kind: "drawable", id: drawableId }),
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
        () => setSelection({ kind: "drawable", id: drawableId }),
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
        () => setSelection({ kind: "rigControl", id: childRigControlId }),
        "Reparent Deformer"
      );
    },
    [applyRigCommand]
  );

  const updateRigControl = useCallback(
    (payload: UpdateRigControlPayloadDto) => {
      applyRigCommand(
        (currentSession) => commitUpdateRigControl(currentSession, payload),
        () => setSelection({ kind: "rigControl", id: payload.rigControlId }),
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
          history: outcome.history
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
          history: outcome.history
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
      rigDraft,
      structureRows,
      deformerRows,
      drawablePoolItems,
      inspector,
      parameterBar,
      activeParameterId: resolvedActiveParameterId,
      parameterValues,
      rigOperationFeedback,
      parameterOperationFeedback,
      psdImportOpen,
      canUndo: canUndoEditorSessionHistory(history),
      canRedo: canRedoEditorSessionHistory(history),
      undo,
      redo,
      openPsdImport: () => setPsdImportOpen(true),
      closePsdImport: () => setPsdImportOpen(false),
      openParameterManager,
      setActiveParameterId,
      setActiveParameterValue,
      resetActiveParameterValue,
      selectPart,
      selectDrawable,
      selectRigControl,
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
      applyMeshDraft,
      cancelMeshDraft,
      startWarpDeformerDraftForDrawable,
      updateWarpDeformerDraft: updateRigDraft,
      fitWarpDeformerDraft: fitRigDraft,
      resetWarpDeformerDraft: resetRigDraft,
      applyWarpDeformerDraft: applyRigDraft,
      cancelWarpDeformerDraft: cancelRigDraft,
      createRotationDeformerForDrawable,
      createParentRotationDeformerForRigControl,
      createParentWarpDeformerForRigControl,
      bindDrawableToRigControl,
      moveDrawableRigControlBinding,
      reparentRigControl,
      updateRigControl,
      editKeyformKey,
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
      createCustomParameter,
      commitGestureCommand,
      commitGestureController,
      deformerRows,
      deleteCustomParameter,
      drawablePoolItems,
      editKeyformKey,
      editorHiddenPartIds,
      fitRigDraft,
      history,
      inspector,
      meshDraft,
      moveDrawableRigControlBinding,
      openParameterManager,
      parameterBar,
      parameterOperationFeedback,
      parameterValues,
      psdImportOpen,
      previewMeshDraft,
      applyRigDraft,
      redo,
      reparentRigControl,
      resetActiveParameterValue,
      resetRigDraft,
      resolvePsdImportDestination,
      rigOperationFeedback,
      rigDraft,
      selection,
      resolvedActiveParameterId,
      selectDrawable,
      selectPart,
      selectRigControl,
      session,
      setActiveParameterId,
      setActiveParameterValue,
      startWarpDeformerDraftForDrawable,
      structureRows,
      moveStructureChild,
      togglePartCollapse,
      togglePartEditorVisibility,
      undo,
      updateCustomParameter,
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

function formatCommandFeedback(result: EditorSessionCommandResult): string {
  return result.diagnostics[0]?.message ?? "Rig operation was rejected.";
}

function formatParameterCommandFeedback(result: EditorSessionCommandResult): string {
  return result.diagnostics[0]?.message ?? "Parameter definition operation was rejected.";
}
