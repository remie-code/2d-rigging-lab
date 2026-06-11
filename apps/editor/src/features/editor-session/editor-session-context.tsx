import type {
  AuthoringSession,
  DrawableGeneratedMeshResult,
  StructureOrderDrop,
  StructureOrderItem
} from "@private-2d-rigging-lab/authoring-core";
import { createGeneratedMeshForDrawable } from "@private-2d-rigging-lab/authoring-core";
import type { DrawableId, PartId } from "@private-2d-rigging-lab/contracts";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  commitGenerateMesh,
  commitStructureMove,
  commitPartNameEdit,
  commitPartReparent,
  type EditorSessionCommandResult
} from "./model/editor-session-commands";
import { createEmptyAuthoringSession } from "./model/empty-authoring-session";
import type { EditorSelection } from "./model/editor-selection";
import {
  createMeshPreviewProvenanceId,
  getMeshGenerationPreset,
  type MeshGenerationPresetId
} from "./model/mesh-tool-state";
import { mergeEditorHiddenPartIds } from "./model/editor-hidden-part-state";
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
}

interface EditorSessionContextValue {
  readonly session: AuthoringSession;
  readonly selection: EditorSelection | null;
  readonly collapsedPartIds: ReadonlySet<PartId>;
  readonly editorHiddenPartIds: ReadonlySet<PartId>;
  readonly meshDraft: MeshToolDraft | null;
  readonly structureRows: readonly StructureTreeRow[];
  readonly inspector: InspectorProjection;
  readonly psdImportOpen: boolean;
  readonly openPsdImport: () => void;
  readonly closePsdImport: () => void;
  readonly selectPart: (partId: PartId) => void;
  readonly selectDrawable: (drawableId: DrawableId) => void;
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
  readonly resolvePsdImportDestination: () => {
    readonly parentPartId: PartId;
    readonly label: string;
  };
  readonly commitPsdImport: (plan: PsdImportPlan) => void;
}

const EditorSessionContext = createContext<EditorSessionContextValue | null>(null);

export function EditorSessionProvider({ children }: { readonly children: ReactNode }) {
  const activeTool = useEditorUiStore((state) => state.activeTool);
  const [session, setSession] = useState<AuthoringSession>(() => createEmptyAuthoringSession());
  const [selection, setSelection] = useState<EditorSelection | null>(null);
  const [collapsedPartIds, setCollapsedPartIds] = useState<ReadonlySet<PartId>>(
    () => new Set()
  );
  const [editorHiddenPartIds, setEditorHiddenPartIds] = useState<ReadonlySet<PartId>>(
    () => new Set()
  );
  const [meshDraft, setMeshDraft] = useState<MeshToolDraft | null>(null);
  const [psdImportOpen, setPsdImportOpen] = useState(false);
  const structureRows = useMemo(
    () =>
      createStructureTreeRows(session, selection, {
        collapsedPartIds,
        editorHiddenPartIds
      }),
    [collapsedPartIds, editorHiddenPartIds, session, selection]
  );
  const inspector = useMemo(
    () => createInspectorProjection(session, selection, { editorHiddenPartIds }),
    [editorHiddenPartIds, session, selection]
  );

  useEffect(() => {
    if (activeTool !== "mesh") {
      setMeshDraft(null);
    }
  }, [activeTool]);

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

  const commitPsdImport = useCallback(
    (plan: PsdImportPlan) => {
      const result = commitPsdImportPlan({ session, plan });
      setSession(result.session);
      setEditorHiddenPartIds((current) =>
        mergeEditorHiddenPartIds(current, result.editorHiddenPartIds)
      );
      setSelection({ kind: "part", id: plan.importRootPartId });
      setPsdImportOpen(false);
    },
    [session]
  );

  const applyCommand = useCallback(
    (command: (currentSession: AuthoringSession) => EditorSessionCommandResult) => {
      setSession((currentSession) => {
        const result = command(currentSession);
        if (result.committed) {
          return result.session;
        }

        if (result.diagnostics.length > 0) {
          console.warn("Editor command was rejected.", result.diagnostics);
        }

        return currentSession;
      });
    },
    []
  );

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
    setSession((currentSession) => {
      const result = commitStructureMove(currentSession, moved, drop);
      if (result.committed) {
        setSelection(
          moved.kind === "part"
            ? { kind: "part", id: moved.partId }
            : { kind: "drawable", id: moved.drawableId }
        );
        return result.session;
      }

      if (result.diagnostics.length > 0) {
        console.warn("Editor command was rejected.", result.diagnostics);
      }

      return currentSession;
    });
  }, []);

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
        method: "auto-grid-v1",
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
        ...(generated.alphaBounds === undefined ? {} : { alphaBounds: generated.alphaBounds })
      });
    },
    [session]
  );

  const applyMeshDraft = useCallback(() => {
    if (meshDraft === null) {
      return;
    }

    const preset = getMeshGenerationPreset(meshDraft.presetId);
    setSession((currentSession) => {
      const result = commitGenerateMesh(
        currentSession,
        meshDraft.drawableId,
        preset.densityHint,
        meshDraft.mesh
      );
      if (result.committed) {
        setMeshDraft(null);
        setSelection({ kind: "drawable", id: meshDraft.drawableId });
        return result.session;
      }

      if (result.diagnostics.length > 0) {
        console.warn("Editor command was rejected.", result.diagnostics);
      }

      return currentSession;
    });
  }, [meshDraft]);

  const value = useMemo<EditorSessionContextValue>(
    () => ({
      collapsedPartIds,
      editorHiddenPartIds,
      session,
      selection,
      meshDraft,
      structureRows,
      inspector,
      psdImportOpen,
      openPsdImport: () => setPsdImportOpen(true),
      closePsdImport: () => setPsdImportOpen(false),
      selectPart,
      selectDrawable,
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
      resolvePsdImportDestination,
      commitPsdImport
    }),
    [
      applyCommand,
      collapsedPartIds,
      applyMeshDraft,
      cancelMeshDraft,
      commitPsdImport,
      editorHiddenPartIds,
      inspector,
      meshDraft,
      psdImportOpen,
      previewMeshDraft,
      resolvePsdImportDestination,
      selection,
      selectDrawable,
      selectPart,
      session,
      structureRows,
      moveStructureChild,
      togglePartCollapse,
      togglePartEditorVisibility
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
