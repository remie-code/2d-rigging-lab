import { contextBridge, ipcRenderer } from "electron";

import { workspaceFsBridgeChannels } from "./workspace-fs-bridge-channels";
import type {
  WorkspaceFsApi,
  WorkspaceFsReadMode,
  WorkspaceFsWritePayload
} from "./workspace-fs-bridge-contract";

export function installEditorWorkspaceFsBridge(): void {
  const readFile = ((rootPath: string, relPath: string, mode: WorkspaceFsReadMode) =>
    ipcRenderer.invoke(workspaceFsBridgeChannels.readFile, {
      rootPath,
      relPath,
      mode
    })) as WorkspaceFsApi["readFile"];

  const workspaceFsApi: WorkspaceFsApi = {
    pickWorkspaceDirectory: () =>
      ipcRenderer.invoke(workspaceFsBridgeChannels.pickWorkspaceDirectory),
    listDirectory: (rootPath, relPath) =>
      ipcRenderer.invoke(workspaceFsBridgeChannels.listDirectory, {
        rootPath,
        relPath
      }),
    statPath: (rootPath, relPath) =>
      ipcRenderer.invoke(workspaceFsBridgeChannels.statPath, {
        rootPath,
        relPath
      }),
    readFile,
    writeFile: (rootPath, relPath, payload: WorkspaceFsWritePayload) =>
      ipcRenderer.invoke(workspaceFsBridgeChannels.writeFile, {
        rootPath,
        relPath,
        payload
      })
  };

  contextBridge.exposeInMainWorld("editorWorkspaceFs", workspaceFsApi);
}
