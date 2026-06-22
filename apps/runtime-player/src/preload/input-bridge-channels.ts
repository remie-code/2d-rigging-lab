export const inputBridgeChannels = {
  getStatus: "runtime-player:input:get-status",
  connect: "runtime-player:input:connect",
  disconnect: "runtime-player:input:disconnect",
  getDiagnostics: "runtime-player:input:get-diagnostics",
  copyDiagnostics: "runtime-player:input:copy-diagnostics",
  statusChanged: "runtime-player:input:status-changed",
  diagnosticsChanged: "runtime-player:input:diagnostics-changed"
} as const;
