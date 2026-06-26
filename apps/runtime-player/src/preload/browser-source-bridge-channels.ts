export const browserSourceBridgeChannels = {
  getStatus: "runtime-player:browser-source:get-status",
  setRuntimeCoreProfiling:
    "runtime-player:browser-source:set-runtime-core-profiling",
  statusChanged: "runtime-player:browser-source:status-changed"
} as const;
