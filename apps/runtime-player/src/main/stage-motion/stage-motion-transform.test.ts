import { describe, expect, it } from "vitest";

import type {
  RuntimePlayerStageMotionSettings,
  RuntimePlayerStageViewTransform
} from "../../preload/runtime-player-bridge-contract";
import { runtimePlayerDefaultStageMotionSettings } from "../window-state/window-state-stage-motion-settings";
import {
  composeRuntimePlayerStageMotionTransform,
  createResetStageMotionRuntimeState
} from "./stage-motion-transform";

describe("composeRuntimePlayerStageMotionTransform", () => {
  it("keeps the saved base transform when Stage Motion is disabled", () => {
    const baseTransform = createTransform({
      zoomScale: 1.5,
      pan: { x: 10, y: -20 }
    });

    const result = composeRuntimePlayerStageMotionTransform({
      baseTransform,
      settings: {
        ...runtimePlayerDefaultStageMotionSettings,
        enabled: false
      },
      horizontalInput: 1,
      depthInput: 1,
      elapsedMs: 16,
      previousState: {
        initialized: true,
        smoothedOffsetX: 50,
        smoothedScaleDelta: 0.2
      }
    });

    expect(result.transform).toEqual(baseTransform);
    expect(result.runtimeState).toEqual(createResetStageMotionRuntimeState());
  });

  it("applies dead zone before composing horizontal and scale motion", () => {
    const result = composeRuntimePlayerStageMotionTransform({
      baseTransform: createTransform({
        zoomScale: 1,
        pan: { x: 100, y: 50 }
      }),
      settings: createEnabledSettings({
        deadZone: 0.05
      }),
      horizontalInput: 0.04,
      depthInput: -0.03,
      elapsedMs: 0,
      previousState: createResetStageMotionRuntimeState()
    });

    expect(result.targetOffsetX).toBe(0);
    expect(result.targetScaleDelta).toBe(0);
    expect(result.transform).toMatchObject({
      zoomScale: 1,
      pan: { x: 100, y: 50 }
    });
  });

  it("applies invert and limits before base transform composition", () => {
    const result = composeRuntimePlayerStageMotionTransform({
      baseTransform: createTransform({
        zoomScale: 2,
        pan: { x: 8, y: 9 }
      }),
      settings: createEnabledSettings({
        horizontal: {
          strengthPx: 200,
          limitPx: 60,
          invert: true
        },
        scale: {
          strength: 0.5,
          limit: 0.12,
          invert: true
        }
      }),
      horizontalInput: 0.8,
      depthInput: -0.8,
      elapsedMs: 0,
      previousState: createResetStageMotionRuntimeState()
    });

    expect(result.targetOffsetX).toBe(-60);
    expect(result.targetScaleDelta).toBe(0.12);
    expect(result.transform).toMatchObject({
      zoomScale: 2.24,
      pan: { x: -52, y: 9 }
    });
  });

  it("smooths initialized runtime state with time-based reaction", () => {
    const result = composeRuntimePlayerStageMotionTransform({
      baseTransform: createTransform({
        zoomScale: 1,
        pan: { x: 0, y: 0 }
      }),
      settings: createEnabledSettings({
        horizontal: {
          strengthPx: 100,
          limitPx: 100,
          invert: false
        },
        reaction: 8
      }),
      horizontalInput: 1,
      depthInput: 0,
      elapsedMs: 125,
      previousState: {
        initialized: true,
        smoothedOffsetX: 0,
        smoothedScaleDelta: 0
      }
    });

    expect(result.runtimeState.smoothedOffsetX).toBeCloseTo(63.21, 2);
    expect(result.transform.pan.x).toBeCloseTo(63.21, 2);
  });
});

function createEnabledSettings(
  patch: Partial<RuntimePlayerStageMotionSettings> = {}
): RuntimePlayerStageMotionSettings {
  return {
    ...runtimePlayerDefaultStageMotionSettings,
    ...patch,
    enabled: true,
    horizontal: {
      ...runtimePlayerDefaultStageMotionSettings.horizontal,
      ...patch.horizontal
    },
    scale: {
      ...runtimePlayerDefaultStageMotionSettings.scale,
      ...patch.scale
    }
  };
}

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
