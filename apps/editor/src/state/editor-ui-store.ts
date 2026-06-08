import { create } from "zustand";

export type WorkspaceToolId = "select" | "mesh" | "rig" | "dynamics";
export type WorkspaceEntryId =
  | "import"
  | "parameters"
  | "variants"
  | "atlas"
  | "storage"
  | "validate"
  | "viewer";

type EditorUiState = {
  surfaceLabel: string;
  activeTool: WorkspaceToolId;
  activeEntry: WorkspaceEntryId;
  setActiveTool: (tool: WorkspaceToolId) => void;
  setActiveEntry: (entry: WorkspaceEntryId) => void;
};

export const useEditorUiStore = create<EditorUiState>((set) => ({
  surfaceLabel: "Workspace draft",
  activeTool: "select",
  activeEntry: "import",
  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveEntry: (entry) => set({ activeEntry: entry })
}));
