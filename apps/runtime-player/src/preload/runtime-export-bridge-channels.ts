export const runtimeExportBridgeChannels = {
  getStatus: "runtime-player:runtime-export:get-status",
  openDirectory: "runtime-player:runtime-export:open-directory",
  restoreLastDirectory: "runtime-player:runtime-export:restore-last-directory",
  getLoadedPayload: "runtime-player:runtime-export:get-loaded-payload",
  statusChanged: "runtime-player:runtime-export:status-changed",
  loadedPayload: "runtime-player:runtime-export:loaded-payload"
} as const;
