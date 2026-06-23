import type { RuntimePlayerInputSessionNeutralSnapshot } from "../../preload/input-profile-bridge-contract";
import type { TrackingFrame } from "../../preload/input-tracking-frame-contract";
import type {
  RuntimePlayerStageMotionSettings,
  RuntimePlayerStageViewTransform
} from "../../preload/runtime-player-bridge-contract";
import { normalizeInputProfileHeadPositionDepth } from "../input-profiles/input-profile-head-position-normalization";
import type { InputProfile } from "../input-profiles/input-profile-document";
import { normalizeRuntimePlayerStageViewTransform } from "../window-state/window-state-document";
import { normalizeInputProfileHeadPositionHorizontal } from "./stage-motion-input";
import {
  composeRuntimePlayerStageMotionTransform,
  createResetStageMotionRuntimeState,
  type RuntimePlayerStageMotionRuntimeState
} from "./stage-motion-transform";

export type RuntimePlayerStageMotionFrameResult = {
  readonly browserSourceTransform: RuntimePlayerStageViewTransform;
  readonly nativeDisplayTransform: RuntimePlayerStageViewTransform | null;
};

export class RuntimePlayerStageMotionRuntime {
  private runtimeState: RuntimePlayerStageMotionRuntimeState =
    createResetStageMotionRuntimeState();
  private previousFrameTimestampMs: number | null = null;

  reset(): void {
    this.runtimeState = createResetStageMotionRuntimeState();
    this.previousFrameTimestampMs = null;
  }

  update(input: {
    readonly baseTransform: RuntimePlayerStageViewTransform;
    readonly settings: RuntimePlayerStageMotionSettings;
    readonly trackingFrame: TrackingFrame | null;
    readonly inputProfile: InputProfile | null;
    readonly sessionNeutral: RuntimePlayerInputSessionNeutralSnapshot | null;
  }): RuntimePlayerStageMotionFrameResult {
    const baseTransform = normalizeRuntimePlayerStageViewTransform(
      input.baseTransform
    );

    if (
      !input.settings.enabled ||
      input.trackingFrame === null ||
      input.inputProfile === null
    ) {
      this.reset();
      return {
        browserSourceTransform: baseTransform,
        nativeDisplayTransform: null
      };
    }

    const headPositionRaw = input.trackingFrame.head.positionRaw;
    const calibration = input.inputProfile.calibration.headPositionRaw;
    const horizontalInput = normalizeInputProfileHeadPositionHorizontal({
      current: headPositionRaw,
      sessionNeutral: input.sessionNeutral,
      calibration
    });
    const depthInput = normalizeInputProfileHeadPositionDepth({
      current: headPositionRaw,
      sessionNeutral: input.sessionNeutral,
      calibration
    });

    if (horizontalInput === null && depthInput === null) {
      this.reset();
      return {
        browserSourceTransform: baseTransform,
        nativeDisplayTransform: null
      };
    }

    const elapsedMs = this.previousFrameTimestampMs === null
      ? 0
      : Math.max(0, input.trackingFrame.timestampMs -
        this.previousFrameTimestampMs);
    const result = composeRuntimePlayerStageMotionTransform({
      baseTransform,
      settings: input.settings,
      horizontalInput,
      depthInput,
      elapsedMs,
      previousState: this.runtimeState
    });

    this.runtimeState = result.runtimeState;
    this.previousFrameTimestampMs = input.trackingFrame.timestampMs;

    return {
      browserSourceTransform: result.transform,
      nativeDisplayTransform: result.transform
    };
  }
}
