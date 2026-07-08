import { installEditorWorkspaceFsBridge } from "./workspace-fs-bridge";

// Expose the workspace node:fs bridge so the renderer can persist and load
// workspaces through the main process while staying isolated from Node/Electron.
installEditorWorkspaceFsBridge();
