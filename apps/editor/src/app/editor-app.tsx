import { FoundationWorkspace } from "../workspace/foundation-workspace";
import { TooltipProvider } from "../ui/tooltip";
import { EditorSessionProvider } from "../features/editor-session/editor-session-context";
import {
  createElectronWorkspaceDirectoryPicker,
  getEditorWorkspaceFsBridge
} from "../features/workspace-storage/model/electron-workspace-directory-picker";

export function EditorApp() {
  // In Electron the preload script exposes the workspace fs bridge, so persist
  // through the node:fs-backed picker. Outside Electron the bridge is absent and
  // the provider keeps its default FS Access behaviour.
  const workspaceFsBridge = getEditorWorkspaceFsBridge();
  const workspaceDirectoryPicker =
    workspaceFsBridge === undefined
      ? undefined
      : createElectronWorkspaceDirectoryPicker(workspaceFsBridge);

  return (
    <TooltipProvider>
      <EditorSessionProvider
        {...(workspaceDirectoryPicker === undefined
          ? {}
          : { workspaceDirectoryPicker })}
      >
        <FoundationWorkspace />
      </EditorSessionProvider>
    </TooltipProvider>
  );
}
