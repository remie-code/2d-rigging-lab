import { describe, expect, it } from "vitest";

import type { TrackingFrame } from "../../preload/input-tracking-frame-contract";
import type {
  RuntimePlayerStageViewTransform
} from "../../preload/runtime-player-bridge-contract";
import type { InputProfile } from "../input-profiles/input-profile-document";
import { runtimePlayerDefaultStageMotionSettings } from "../window-state/window-state-stage-motion-settings";
import { RuntimePlayerStageMotionRuntime } from "./stage-motion-runtime";

describe("RuntimePlayerStageMotionRuntime", () => {
  it("composes base Stage transform with calibrated horizontal and near depth input", () => {
    const runtime = new RuntimePlayerStageMotionRuntime();
    const result = runtime.update({
      baseTransform: createTransform({
        zoomScale: 2,
        pan: { x: 10, y: -5 }
      }),
      settings: {
        ...runtimePlayerDefaultStageMotionSettings,
        enabled: true
      },
      trackingFrame: createTrackingFrame({
        x: 0.5,
        z: 0.5
      }),
      inputProfile: createInputProfile(),
      sessionNeutral: null
    });

    expect(result.browserSourceTransform).toEqual({
      zoomScale: 2.06,
      pan: {
        x: 50,
        y: -5
      },
      coordinateSpace: "stage-viewport-px-v1"
    });
    expect(result.nativeDisplayTransform).toEqual(
      result.browserSourceTransform
    );
  });

  it("returns base transform and clears native override when input is unavailable", () => {
    const runtime = new RuntimePlayerStageMotionRuntime();
    const baseTransform = createTransform({
      zoomScale: 1,
      pan: { x: 4, y: 8 }
    });

    const result = runtime.update({
      baseTransform,
      settings: {
        ...runtimePlayerDefaultStageMotionSettings,
        enabled: true
      },
      trackingFrame: null,
      inputProfile: createInputProfile(),
      sessionNeutral: null
    });

    expect(result.browserSourceTransform).toEqual(baseTransform);
    expect(result.nativeDisplayTransform).toBeNull();
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

function createTrackingFrame(position: {
  readonly x: number;
  readonly z: number;
}): TrackingFrame {
  return {
    source: "ifacialmocap",
    timestampMs: 1000,
    transport: "udp",
    blendshapes: {},
    head: {
      positionRaw: {
        x: position.x,
        y: 0,
        z: position.z
      }
    }
  };
}

function createInputProfile(): InputProfile {
  return {
    profileId: "profile_fixture",
    displayName: "Profile fixture",
    source: "ifacialmocap",
    transport: "udp",
    createdAtIso: "2026-06-23T00:00:00.000Z",
    updatedAtIso: "2026-06-23T00:00:00.000Z",
    calibration: {
      headRotationEulerDeg: {
        neutral: { x: 0, y: 0, z: 0 },
        min: { x: -1, y: -1, z: -1 },
        max: { x: 1, y: 1, z: 1 },
        learnedSigns: {}
      },
      eyes: {
        neutral: { x: 0, y: 0, z: 0 },
        min: { x: -1, y: -1, z: -1 },
        max: { x: 1, y: 1, z: 1 },
        blinkLeftMin: 0,
        blinkLeftMax: 1,
        blinkRightMin: 0,
        blinkRightMax: 1,
        learnedSigns: {}
      },
      mouth: {
        jawOpenMin: 0,
        jawOpenMax: 1,
        smileMin: 0,
        smileMax: 1
      },
      headPositionRaw: {
        neutral: { x: 0, y: 0, z: 0 },
        min: { x: -1, y: -1, z: -1 },
        max: { x: 1, y: 1, z: 1 },
        learnedSigns: {
          bodyLeft: { axis: "x", direction: -1 },
          bodyRight: { axis: "x", direction: 1 },
          bodyNear: { axis: "z", direction: 1 },
          bodyFar: { axis: "z", direction: -1 }
        }
      }
    }
  };
}
