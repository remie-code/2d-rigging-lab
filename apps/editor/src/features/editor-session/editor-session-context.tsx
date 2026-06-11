import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { DrawableId, PartId } from "@private-2d-rigging-lab/contracts";
import {
  createContext,
  useCallback,
  useContext,
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
  commitPartNameEdit,
  commitPartReparent,
  type EditorSessionCommandResult
} from "./model/editor-session-commands";
import { createEmptyAuthoringSession } from "./model/empty-authoring-session";
import type { EditorSelection } from "./model/editor-selection";
import {
  createInspectorProjection,
  createStructureTreeRows,
  resolveDestinationPart,
  type InspectorProjection,
  type StructureTreeRow
} from "./model/session-tree";

interface EditorSessionContextValue {
  readonly session: AuthoringSession;
  readonly selection: EditorSelection | null;
  readonly collapsedPartIds: ReadonlySet<PartId>;
  readonly editorHiddenPartIds: ReadonlySet<PartId>;
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
  readonly resolvePsdImportDestination: () => {
    readonly parentPartId: PartId;
    readonly label: string;
  };
  readonly commitPsdImport: (plan: PsdImportPlan) => void;
}

const EditorSessionContext = createContext<EditorSessionContextValue | null>(null);

export function EditorSessionProvider({ children }: { readonly children: ReactNode }) {
  const [session, setSession] = useState<AuthoringSession>(() => createEmptyAuthoringSession());
  const [selection, setSelection] = useState<EditorSelection | null>(null);
  const [collapsedPartIds, setCollapsedPartIds] = useState<ReadonlySet<PartId>>(
    () => new Set()
  );
  const [editorHiddenPartIds, setEditorHiddenPartIds] = useState<ReadonlySet<PartId>>(
    () => new Set()
  );
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

  const value = useMemo<EditorSessionContextValue>(
    () => ({
      collapsedPartIds,
      editorHiddenPartIds,
      session,
      selection,
      structureRows,
      inspector,
      psdImportOpen,
      openPsdImport: () => setPsdImportOpen(true),
      closePsdImport: () => setPsdImportOpen(false),
      selectPart: (partId) => setSelection({ kind: "part", id: partId }),
      selectDrawable: (drawableId) => setSelection({ kind: "drawable", id: drawableId }),
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
      resolvePsdImportDestination,
      commitPsdImport
    }),
    [
      applyCommand,
      collapsedPartIds,
      commitPsdImport,
      editorHiddenPartIds,
      inspector,
      psdImportOpen,
      resolvePsdImportDestination,
      selection,
      session,
      structureRows,
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
