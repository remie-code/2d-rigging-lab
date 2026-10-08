import type {
  RuntimePlayerBrowserSourceStageDisplayState
} from "../../preload/browser-source-status-contract";
import type {
  RuntimePlayerStageViewTransform
} from "../../preload/runtime-player-bridge-contract";

export type RuntimePlayerStageMotionTransportNotification =
  "immediate" | "sampled";

export function publishRuntimePlayerStageMotionDisplayState(input: {
  readonly browserSourceTransform: RuntimePlayerStageViewTransform;
  readonly nativeDisplayTransform: RuntimePlayerStageViewTransform | null;
  readonly stageWindowBounds:
    RuntimePlayerBrowserSourceStageDisplayState["stageWindow"]["bounds"];
  readonly deliverToNativeStageWindow: boolean;
  readonly notify?: RuntimePlayerStageMotionTransportNotification;
  readonly publishBrowserSourceStageDisplayState: (
    state: RuntimePlayerBrowserSourceStageDisplayState,
    options: {
      readonly notify?: RuntimePlayerStageMotionTransportNotification;
    }
  ) => void;
  readonly publishNativeStageDisplayTransform: (
    transform: RuntimePlayerStageViewTransform | null
  ) => void;
}): void {
  input.publishBrowserSourceStageDisplayState(
    createRuntimePlayerStageMotionDisplayState({
      stageWindowBounds: input.stageWindowBounds,
      transform: input.browserSourceTransform
    }),
    input.notify === undefined ? {} : { notify: input.notify }
  );

  if (input.deliverToNativeStageWindow) {
    input.publishNativeStageDisplayTransform(input.nativeDisplayTransform);
  }
}

export function createRuntimePlayerStageMotionDisplayState(input: {
  readonly stageWindowBounds:
    RuntimePlayerBrowserSourceStageDisplayState["stageWindow"]["bounds"];
  readonly transform: RuntimePlayerStageViewTransform;
}): RuntimePlayerBrowserSourceStageDisplayState {
  return {
    stageWindow: {
      bounds: input.stageWindowBounds
    },
    stageView: {
      transform: input.transform
    },
    updatedAtIso: null
  };
}
