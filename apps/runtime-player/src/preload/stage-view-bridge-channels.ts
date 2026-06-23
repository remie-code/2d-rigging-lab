export const stageViewBridgeChannels = {
  getStatus: "runtime-player:stage-view:get-status",
  getState: "runtime-player:stage-view:get-state",
  reportStatus: "runtime-player:stage-view:report-status",
  reportViewTransform: "runtime-player:stage-view:report-view-transform",
  focusStage: "runtime-player:stage-view:focus-stage",
  resetView: "runtime-player:stage-view:reset-view",
  centerModel: "runtime-player:stage-view:center-model",
  getViewTransform: "runtime-player:stage-view:get-view-transform",
  statusChanged: "runtime-player:stage-view:status-changed",
  stateChanged: "runtime-player:stage-view:state-changed",
  applyViewTransformRequested:
    "runtime-player:stage-view:apply-view-transform-requested",
  resetRequested: "runtime-player:stage-view:reset-requested"
} as const;
