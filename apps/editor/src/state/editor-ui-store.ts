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
  meshOverlayVisible: boolean;
  setActiveTool: (tool: WorkspaceToolId) => void;
  setActiveEntry: (entry: WorkspaceEntryId) => void;
  setMeshOverlayVisible: (visible: boolean) => void;
  toggleMeshOverlayVisible: () => void;
};

export const useEditorUiStore = create<EditorUiState>((set) => ({
  surfaceLabel: "Workspace draft",
  activeTool: "select",
  activeEntry: "import",
  meshOverlayVisible: false,
  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveEntry: (entry) => set({ activeEntry: entry }),
  setMeshOverlayVisible: (visible) => set({ meshOverlayVisible: visible }),
  toggleMeshOverlayVisible: () =>
    set((state) => ({ meshOverlayVisible: !state.meshOverlayVisible }))
}));
