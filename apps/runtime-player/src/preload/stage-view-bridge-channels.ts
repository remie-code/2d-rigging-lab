export const stageViewBridgeChannels = {
  getStatus: "runtime-player:stage-view:get-status",
  getState: "runtime-player:stage-view:get-state",
  reportStatus: "runtime-player:stage-view:report-status",
  reportViewTransform: "runtime-player:stage-view:report-view-transform",
  focusStage: "runtime-player:stage-view:focus-stage",
  resetView: "runtime-player:stage-view:reset-view",
  centerModel: "runtime-player:stage-view:center-model",
  setArrangeMode: "runtime-player:stage-view:set-arrange-mode",
  setClickThrough: "runtime-player:stage-view:set-click-through",
  setAlwaysOnTop: "runtime-player:stage-view:set-always-on-top",
  copyWindowTitle: "runtime-player:stage-view:copy-window-title",
  getViewTransform: "runtime-player:stage-view:get-view-transform",
  getArrangeState: "runtime-player:stage-view:get-arrange-state",
  statusChanged: "runtime-player:stage-view:status-changed",
  stateChanged: "runtime-player:stage-view:state-changed",
  arrangeStateChanged: "runtime-player:stage-view:arrange-state-changed",
  applyViewTransformRequested:
    "runtime-player:stage-view:apply-view-transform-requested",
  resetRequested: "runtime-player:stage-view:reset-requested"
} as const;
