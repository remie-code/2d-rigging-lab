export const inputProfileBridgeChannels = {
  getStatus: "runtime-player:input-profile:get-status",
  setActiveProfile: "runtime-player:input-profile:set-active-profile",
  useTemporaryDefaults: "runtime-player:input-profile:use-temporary-defaults",
  lookForward: "runtime-player:input-profile:look-forward",
  startCalibration: "runtime-player:input-profile:start-calibration",
  cancelCalibration: "runtime-player:input-profile:cancel-calibration",
  recordCalibrationSample:
    "runtime-player:input-profile:record-calibration-sample",
  advanceCalibrationPrompt:
    "runtime-player:input-profile:advance-calibration-prompt",
  finishCalibration: "runtime-player:input-profile:finish-calibration",
  statusChanged: "runtime-player:input-profile:status-changed"
} as const;
