// IPC channel identifiers for the workspace node:fs bridge.
// Imported by both the preload bridge (renderer side) and the main handlers so
// the two ends can never drift apart.
export const workspaceFsBridgeChannels = {
  pickWorkspaceDirectory: "editor:workspace-fs:pick-workspace-directory",
  listDirectory: "editor:workspace-fs:list-directory",
  statPath: "editor:workspace-fs:stat-path",
  readFile: "editor:workspace-fs:read-file",
  writeFile: "editor:workspace-fs:write-file"
} as const;
