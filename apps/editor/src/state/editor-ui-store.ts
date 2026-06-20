import { create } from "zustand";

export type WorkspaceToolId = "select" | "mesh" | "rig" | "dynamics";
export type WorkspaceEntryId =
  | "workspace"
  | "parameters"
  | "variants"
  | "atlas"
  | "validate"
  | "viewer";

type EditorUiState = {
  surfaceLabel: string;
  activeTool: WorkspaceToolId;
  activeEntry: WorkspaceEntryId;
  meshOverlayVisible: boolean;
  deformerOverlayVisible: boolean;
  setActiveTool: (tool: WorkspaceToolId) => void;
  setActiveEntry: (entry: WorkspaceEntryId) => void;
  setMeshOverlayVisible: (visible: boolean) => void;
  toggleMeshOverlayVisible: () => void;
  setDeformerOverlayVisible: (visible: boolean) => void;
  toggleDeformerOverlayVisible: () => void;
};

export const useEditorUiStore = create<EditorUiState>((set) => ({
  surfaceLabel: "Workspace draft",
  activeTool: "select",
  activeEntry: "workspace",
  meshOverlayVisible: false,
  deformerOverlayVisible: false,
  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveEntry: (entry) => set({ activeEntry: entry }),
  setMeshOverlayVisible: (visible) => set({ meshOverlayVisible: visible }),
  toggleMeshOverlayVisible: () =>
    set((state) => ({ meshOverlayVisible: !state.meshOverlayVisible })),
  setDeformerOverlayVisible: (visible) => set({ deformerOverlayVisible: visible }),
  toggleDeformerOverlayVisible: () =>
    set((state) => ({ deformerOverlayVisible: !state.deformerOverlayVisible }))
}));
