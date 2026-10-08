import { describe, expect, it, vi } from "vitest";

import type {
  RuntimePlayerStageViewTransform
} from "../../preload/runtime-player-bridge-contract";
import { publishRuntimePlayerStageMotionDisplayState } from "./stage-motion-transport";

describe("publishRuntimePlayerStageMotionDisplayState", () => {
  it("keeps Browser Source Stage Motion updates active while native preview is suspended", () => {
    const publishBrowserSourceStageDisplayState = vi.fn();
    const publishNativeStageDisplayTransform = vi.fn();
    const composedTransform = createTransform({
      zoomScale: 1.08,
      pan: { x: 32, y: 4 }
    });

    publishRuntimePlayerStageMotionDisplayState({
      browserSourceTransform: composedTransform,
      nativeDisplayTransform: composedTransform,
      stageWindowBounds: null,
      deliverToNativeStageWindow: false,
      notify: "sampled",
      publishBrowserSourceStageDisplayState,
      publishNativeStageDisplayTransform
    });

    expect(publishBrowserSourceStageDisplayState).toHaveBeenCalledWith(
      expect.objectContaining({
        stageView: {
          transform: composedTransform
        }
      }),
      { notify: "sampled" }
    );
    expect(publishNativeStageDisplayTransform).not.toHaveBeenCalled();
  });

  it("delivers the same composed transform to native preview when active", () => {
    const publishBrowserSourceStageDisplayState = vi.fn();
    const publishNativeStageDisplayTransform = vi.fn();
    const composedTransform = createTransform({
      zoomScale: 0.98,
      pan: { x: -12, y: 0 }
    });

    publishRuntimePlayerStageMotionDisplayState({
      browserSourceTransform: composedTransform,
      nativeDisplayTransform: composedTransform,
      stageWindowBounds: { x: 0, y: 0, width: 1280, height: 720 },
      deliverToNativeStageWindow: true,
      publishBrowserSourceStageDisplayState,
      publishNativeStageDisplayTransform
    });

    expect(publishBrowserSourceStageDisplayState).toHaveBeenCalledWith(
      expect.objectContaining({
        stageView: {
          transform: composedTransform
        }
      }),
      {}
    );
    expect(publishNativeStageDisplayTransform).toHaveBeenCalledWith(
      composedTransform
    );
  });
});

function createTransform(input: {
  readonly zoomScale: number;
  readonly pan: RuntimePlayerStageViewTransform["pan"];
}): RuntimePlayerStageViewTransform {
  return {
    zoomScale: input.zoomScale,
    pan: input.pan,
    coordinateSpace: "stage-viewport-px-v1"
  };
}
