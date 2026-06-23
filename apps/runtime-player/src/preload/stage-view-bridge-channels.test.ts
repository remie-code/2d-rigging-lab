import { describe, expect, it } from "vitest";

import { stageViewBridgeChannels } from "./stage-view-bridge-channels";

describe("stage view bridge channels", () => {
  it("declares Control and Stage channels for state actions and transform restore", () => {
    expect(stageViewBridgeChannels).toMatchObject({
      getState: "runtime-player:stage-view:get-state",
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
      stateChanged: "runtime-player:stage-view:state-changed",
      arrangeStateChanged: "runtime-player:stage-view:arrange-state-changed",
      applyViewTransformRequested:
        "runtime-player:stage-view:apply-view-transform-requested"
    });
  });
});
