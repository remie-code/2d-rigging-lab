import path from "node:path";

import { dialog, ipcMain, type BrowserWindow } from "electron";

import { workspaceFsBridgeChannels } from "../../preload/workspace-fs-bridge-channels";
import type { WorkspaceFsPickedDirectory } from "../../preload/workspace-fs-bridge-contract";
import {
  readWorkspaceFsPathRequest,
  readWorkspaceFsReadFileRequest,
  readWorkspaceFsWriteFileRequest
} from "./workspace-fs-request-validation";
import {
  listWorkspaceDirectory,
  readWorkspaceFile,
  statWorkspacePath,
  writeWorkspaceFile
} from "./workspace-fs-store";

export interface RegisterWorkspaceFsBridgeHandlersInput {
  // Resolves the window used as the modal parent for the directory dialog.
  // Returning null opens a non-modal dialog (still valid).
  readonly getParentWindow: () => BrowserWindow | null;
}

export function registerWorkspaceFsBridgeHandlers(
  input: RegisterWorkspaceFsBridgeHandlersInput
): void {
  ipcMain.handle(
    workspaceFsBridgeChannels.pickWorkspaceDirectory,
    () => pickWorkspaceDirectory(input.getParentWindow())
  );

  ipcMain.handle(
    workspaceFsBridgeChannels.listDirectory,
    (_event, request: unknown) => {
      const { rootPath, relPath } = readWorkspaceFsPathRequest(request);
      return listWorkspaceDirectory(rootPath, relPath);
    }
  );

  ipcMain.handle(
    workspaceFsBridgeChannels.statPath,
    (_event, request: unknown) => {
      const { rootPath, relPath } = readWorkspaceFsPathRequest(request);
      return statWorkspacePath(rootPath, relPath);
    }
  );

  ipcMain.handle(
    workspaceFsBridgeChannels.readFile,
    (_event, request: unknown) => {
      const { rootPath, relPath, mode } = readWorkspaceFsReadFileRequest(request);
      return mode === "utf8"
        ? readWorkspaceFile(rootPath, relPath, "utf8")
        : readWorkspaceFile(rootPath, relPath, "binary");
    }
  );

  ipcMain.handle(
    workspaceFsBridgeChannels.writeFile,
    (_event, request: unknown) => {
      const { rootPath, relPath, payload } =
        readWorkspaceFsWriteFileRequest(request);
      return writeWorkspaceFile(rootPath, relPath, payload);
    }
  );
}

async function pickWorkspaceDirectory(
  parentWindow: BrowserWindow | null
): Promise<WorkspaceFsPickedDirectory | null> {
  const selection = parentWindow === null
    ? await dialog.showOpenDialog({
        title: "Select Workspace Folder",
        properties: ["openDirectory", "createDirectory"]
      })
    : await dialog.showOpenDialog(parentWindow, {
        title: "Select Workspace Folder",
        properties: ["openDirectory", "createDirectory"]
      });

  const rootPath = selection.filePaths[0];
  if (selection.canceled || rootPath === undefined) {
    return null;
  }

  return {
    rootPath,
    name: path.basename(rootPath)
  };
}
