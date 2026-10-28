import { describe, expect, it } from "vitest";

import { stagePngCaptureBridgeChannels } from "./stage-png-capture-bridge-channels";

describe("stage PNG capture bridge channels", () => {
  it("declares the Control actions and the main <-> Stage capture round trip", () => {
    expect(stagePngCaptureBridgeChannels).toEqual({
      capturePng: "runtime-player:stage-png-capture:capture-png",
      openFolder: "runtime-player:stage-png-capture:open-folder",
      captureRequested: "runtime-player:stage-png-capture:capture-requested",
      reportCapture: "runtime-player:stage-png-capture:report-capture"
    });
  });
});
