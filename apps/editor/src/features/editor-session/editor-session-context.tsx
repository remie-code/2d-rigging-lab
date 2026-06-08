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
  readonly structureRows: readonly StructureTreeRow[];
  readonly inspector: InspectorProjection;
  readonly psdImportOpen: boolean;
  readonly openPsdImport: () => void;
  readonly closePsdImport: () => void;
  readonly selectPart: (partId: PartId) => void;
  readonly selectDrawable: (drawableId: DrawableId) => void;
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
  const [psdImportOpen, setPsdImportOpen] = useState(false);
  const structureRows = useMemo(
    () => createStructureTreeRows(session, selection),
    [session, selection]
  );
  const inspector = useMemo(
    () => createInspectorProjection(session, selection),
    [session, selection]
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

  const value = useMemo<EditorSessionContextValue>(
    () => ({
      session,
      selection,
      structureRows,
      inspector,
      psdImportOpen,
      openPsdImport: () => setPsdImportOpen(true),
      closePsdImport: () => setPsdImportOpen(false),
      selectPart: (partId) => setSelection({ kind: "part", id: partId }),
      selectDrawable: (drawableId) => setSelection({ kind: "drawable", id: drawableId }),
      resolvePsdImportDestination,
      commitPsdImport
    }),
    [
      commitPsdImport,
      inspector,
      psdImportOpen,
      resolvePsdImportDestination,
      selection,
      session,
      structureRows
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
