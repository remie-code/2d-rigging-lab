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
import type { RuntimePlayerStageMotionDrive } from "../presence/stage-presence-drive";
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
    /**
     * Stage Presence override (C3 Domain D). When present the posture signal drives
     * the SAME head-less pure calculator, bypassing the TrackingFrame / calibration
     * requirement (research candidate c). A DATA branch — the composition root hands
     * a drive for the Autonomous Host and null for the Tracking Host, so there is no
     * runtime `if (role === ...)` here and the tracking path is byte-for-byte
     * unchanged when no drive is supplied.
     */
    readonly drive?: RuntimePlayerStageMotionDrive | null;
  }): RuntimePlayerStageMotionFrameResult {
    const baseTransform = normalizeRuntimePlayerStageViewTransform(
      input.baseTransform
    );

    if (input.drive !== undefined && input.drive !== null) {
      return this.updateFromDrive(baseTransform, input.drive);
    }

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

  /**
   * Stage Presence path (C3 Domain D): compose the base transform with the posture
   * signal through the SAME pure calculator the tracking path uses. Settings come
   * from the drive (derived from the Physiology `stagePresence` config), NEVER the
   * window-state settings. When Stage Presence is off (settings.enabled === false)
   * the pure calculator returns the base transform + a reset state; we clear the
   * native override (null) so「off で base に戻る」matches the tracking disabled case.
   */
  private updateFromDrive(
    baseTransform: RuntimePlayerStageViewTransform,
    drive: RuntimePlayerStageMotionDrive
  ): RuntimePlayerStageMotionFrameResult {
    const elapsedMs = this.previousFrameTimestampMs === null
      ? 0
      : Math.max(0, drive.timestampMs - this.previousFrameTimestampMs);
    const result = composeRuntimePlayerStageMotionTransform({
      baseTransform,
      settings: drive.settings,
      horizontalInput: drive.horizontalInput,
      depthInput: drive.depthInput,
      elapsedMs,
      previousState: this.runtimeState
    });

    this.runtimeState = result.runtimeState;
    this.previousFrameTimestampMs = drive.timestampMs;

    return {
      browserSourceTransform: result.transform,
      nativeDisplayTransform: drive.settings.enabled ? result.transform : null
    };
  }
}
