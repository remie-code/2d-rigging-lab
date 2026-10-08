import type { WorkspaceFsApi } from "../../../preload/workspace-fs-bridge-contract";
import { NodeFsBackedDirectoryHandle } from "./node-fs-backed-directory-handle";
import { createAbortError } from "./node-fs-workspace-error";
import type { WorkspaceDirectoryPicker } from "./workspace-session-storage";

// Electron directory picker built on the workspace fs bridge. Shared so the
// runtime-export flow can reuse the exact same adapter/picker (design judgment 2);
// this module only builds the picker and never wires it into any consumer.

/**
 * Read the workspace fs bridge exposed by the preload script. Returns undefined
 * when running outside Electron (e.g. the FS Access web build), which lets the
 * caller fall back to the browser directory picker.
 */
export function getEditorWorkspaceFsBridge(
  globalObject: typeof globalThis = globalThis
): WorkspaceFsApi | undefined {
  return (globalObject as { readonly editorWorkspaceFs?: WorkspaceFsApi })
    .editorWorkspaceFs;
}

/**
 * Build a {@link WorkspaceDirectoryPicker} that opens the OS directory dialog
 * through the bridge and returns a node:fs-backed handle rooted at the chosen
 * path. Cancellation is surfaced as an `AbortError`, matching the FS Access
 * `showDirectoryPicker` cancel behaviour so the calling flow aborts.
 */
export function createElectronWorkspaceDirectoryPicker(
  bridge: WorkspaceFsApi
): WorkspaceDirectoryPicker {
  return {
    pickDirectory: async () => {
      const picked = await bridge.pickWorkspaceDirectory();

      if (picked === null) {
        throw createAbortError("Workspace directory selection was canceled.");
      }

      return new NodeFsBackedDirectoryHandle(
        bridge,
        picked.rootPath,
        "",
        picked.name
      );
    }
  };
}
