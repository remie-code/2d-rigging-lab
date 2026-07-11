import { describe, expect, it } from "vitest";

import type { TrackingFrame } from "../../preload/input-tracking-frame-contract";
import type {
  RuntimePlayerStageViewTransform
} from "../../preload/runtime-player-bridge-contract";
import type { InputProfile } from "../input-profiles/input-profile-document";
import type {
  RuntimePlayerStageMotionSettings
} from "../../preload/runtime-player-bridge-contract";
import { runtimePlayerDefaultStageMotionSettings } from "../window-state/window-state-stage-motion-settings";
import { RuntimePlayerStageMotionRuntime } from "./stage-motion-runtime";
import { deriveStagePresenceStageMotionSettings } from "../presence/stage-presence-drive";

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

  // --- C3 Domain D: Stage Presence posture drive ------------------------------

  it("drives the Stage transform from a posture drive WITHOUT a tracking frame", () => {
    const runtime = new RuntimePlayerStageMotionRuntime();
    const settings = deriveStagePresenceStageMotionSettings({
      enabled: true,
      strength: 1
    });
    const result = runtime.update({
      baseTransform: createTransform({ zoomScale: 1, pan: { x: 10, y: -5 } }),
      settings: runtimePlayerDefaultStageMotionSettings,
      // No tracking frame / calibration at all — the candidate-c path bypasses them.
      trackingFrame: null,
      inputProfile: null,
      sessionNeutral: null,
      drive: {
        settings,
        horizontalInput: 1,
        depthInput: 1,
        timestampMs: 1000
      }
    });

    // First frame: smoothing returns the target directly. horizontal 1 × 60px = +60,
    // depth 1 × 0.05 = scale ×1.05.
    expect(result.browserSourceTransform).toEqual({
      zoomScale: 1.05,
      pan: { x: 70, y: -5 },
      coordinateSpace: "stage-viewport-px-v1"
    });
    expect(result.nativeDisplayTransform).toEqual(result.browserSourceTransform);
    // Only the sanitized composed transform crosses — no raw signal / seed leaks.
    expect(Object.keys(result.browserSourceTransform).sort()).toEqual([
      "coordinateSpace",
      "pan",
      "zoomScale"
    ]);
  });

  it("returns the base transform when the Stage Presence drive is disabled", () => {
    const runtime = new RuntimePlayerStageMotionRuntime();
    const baseTransform = createTransform({ zoomScale: 2, pan: { x: 4, y: 8 } });
    const settings = deriveStagePresenceStageMotionSettings({
      enabled: false,
      strength: 1
    });
    const result = runtime.update({
      baseTransform,
      settings: runtimePlayerDefaultStageMotionSettings,
      trackingFrame: null,
      inputProfile: null,
      sessionNeutral: null,
      drive: {
        settings,
        horizontalInput: 1,
        depthInput: 1,
        timestampMs: 1000
      }
    });

    // Off ⇒ the pure calculator returns the base transform; the native override is
    // cleared so it matches the tracking disabled case (「off で base に戻る」).
    expect(result.browserSourceTransform).toEqual(baseTransform);
    expect(result.nativeDisplayTransform).toBeNull();
  });

  it("uses the drive settings, never the window-state settings, when driven", () => {
    const runtime = new RuntimePlayerStageMotionRuntime();
    // A window-state settings object that WOULD move the stage hard if it were used.
    const loudWindowSettings: RuntimePlayerStageMotionSettings = {
      ...runtimePlayerDefaultStageMotionSettings,
      enabled: true,
      horizontal: { strengthPx: 1000, limitPx: 1000, invert: false }
    };
    const result = runtime.update({
      baseTransform: createTransform({ zoomScale: 1, pan: { x: 0, y: 0 } }),
      settings: loudWindowSettings,
      trackingFrame: null,
      inputProfile: null,
      sessionNeutral: null,
      drive: {
        settings: deriveStagePresenceStageMotionSettings({
          enabled: true,
          strength: 0.5
        }),
        horizontalInput: 1,
        depthInput: 0,
        timestampMs: 1000
      }
    });

    // 0.5 × 60px = 30 (drive), NOT 1000 (window-state) — the drive settings win.
    expect(result.browserSourceTransform.pan.x).toBe(30);
  });

  it("takes the drive path even when a valid tracking frame is present", () => {
    const runtime = new RuntimePlayerStageMotionRuntime();
    const result = runtime.update({
      baseTransform: createTransform({ zoomScale: 1, pan: { x: 0, y: 0 } }),
      settings: {
        ...runtimePlayerDefaultStageMotionSettings,
        enabled: true
      },
      // A fully valid tracking frame + profile that WOULD produce a positive offset.
      trackingFrame: createTrackingFrame({ x: 0.5, z: 0.5 }),
      inputProfile: createInputProfile(),
      sessionNeutral: null,
      drive: {
        settings: deriveStagePresenceStageMotionSettings({
          enabled: true,
          strength: 1
        }),
        horizontalInput: -1,
        depthInput: 0,
        timestampMs: 1000
      }
    });

    // The drive (−1 × 60 = −60) wins, proving the tracking path is bypassed.
    expect(result.browserSourceTransform.pan.x).toBe(-60);
  });

  it("smooths across drive frames using the drive timestamps", () => {
    const runtime = new RuntimePlayerStageMotionRuntime();
    const settings = deriveStagePresenceStageMotionSettings({
      enabled: true,
      strength: 1
    });
    const base = createTransform({ zoomScale: 1, pan: { x: 0, y: 0 } });

    // Frame 1: initialized false ⇒ jumps to target (+60).
    const first = runtime.update({
      baseTransform: base,
      settings: runtimePlayerDefaultStageMotionSettings,
      trackingFrame: null,
      inputProfile: null,
      sessionNeutral: null,
      drive: { settings, horizontalInput: 1, depthInput: 0, timestampMs: 0 }
    });
    expect(first.browserSourceTransform.pan.x).toBe(60);

    // Frame 2: target drops to 0; with a finite elapsed the offset eases toward 0
    // (strictly between 0 and the previous 60 — frame-rate-independent smoothing).
    const second = runtime.update({
      baseTransform: base,
      settings: runtimePlayerDefaultStageMotionSettings,
      trackingFrame: null,
      inputProfile: null,
      sessionNeutral: null,
      drive: { settings, horizontalInput: 0, depthInput: 0, timestampMs: 16 }
    });
    expect(second.browserSourceTransform.pan.x).toBeGreaterThan(0);
    expect(second.browserSourceTransform.pan.x).toBeLessThan(60);
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
