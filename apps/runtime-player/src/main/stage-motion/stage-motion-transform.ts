import type {
  RuntimePlayerStageMotionSettings,
  RuntimePlayerStageViewTransform
} from "../../preload/runtime-player-bridge-contract";
import { normalizeRuntimePlayerStageViewTransform } from "../window-state/window-state-document";

export type RuntimePlayerStageMotionRuntimeState = {
  readonly initialized: boolean;
  readonly smoothedOffsetX: number;
  readonly smoothedScaleDelta: number;
};

export type RuntimePlayerStageMotionTransformResult = {
  readonly transform: RuntimePlayerStageViewTransform;
  readonly runtimeState: RuntimePlayerStageMotionRuntimeState;
  readonly targetOffsetX: number;
  readonly targetScaleDelta: number;
};

export function createResetStageMotionRuntimeState(): RuntimePlayerStageMotionRuntimeState {
  return {
    initialized: false,
    smoothedOffsetX: 0,
    smoothedScaleDelta: 0
  };
}

export function composeRuntimePlayerStageMotionTransform(input: {
  readonly baseTransform: RuntimePlayerStageViewTransform;
  readonly settings: RuntimePlayerStageMotionSettings;
  readonly horizontalInput: number | null;
  readonly depthInput: number | null;
  readonly elapsedMs: number;
  readonly previousState: RuntimePlayerStageMotionRuntimeState;
}): RuntimePlayerStageMotionTransformResult {
  const baseTransform = normalizeRuntimePlayerStageViewTransform(
    input.baseTransform
  );

  if (!input.settings.enabled) {
    return {
      transform: baseTransform,
      runtimeState: createResetStageMotionRuntimeState(),
      targetOffsetX: 0,
      targetScaleDelta: 0
    };
  }

  const horizontalInput = applyDeadZone(
    normalizeSignedInput(input.horizontalInput),
    input.settings.deadZone
  );
  const depthInput = applyDeadZone(
    normalizeSignedInput(input.depthInput),
    input.settings.deadZone
  );
  const targetOffsetX = clamp(
    horizontalInput *
      input.settings.horizontal.strengthPx *
      (input.settings.horizontal.invert ? -1 : 1),
    -input.settings.horizontal.limitPx,
    input.settings.horizontal.limitPx
  );
  const targetScaleDelta = clamp(
    depthInput *
      input.settings.scale.strength *
      (input.settings.scale.invert ? -1 : 1),
    -input.settings.scale.limit,
    input.settings.scale.limit
  );
  const smoothedOffsetX = approach({
    previous: input.previousState.smoothedOffsetX,
    target: targetOffsetX,
    initialized: input.previousState.initialized,
    reaction: input.settings.reaction,
    elapsedMs: input.elapsedMs
  });
  const smoothedScaleDelta = approach({
    previous: input.previousState.smoothedScaleDelta,
    target: targetScaleDelta,
    initialized: input.previousState.initialized,
    reaction: input.settings.reaction,
    elapsedMs: input.elapsedMs
  });
  const runtimeState = {
    initialized: true,
    smoothedOffsetX,
    smoothedScaleDelta
  };

  return {
    transform: {
      zoomScale: baseTransform.zoomScale *
        Math.max(0.0001, 1 + smoothedScaleDelta),
      pan: {
        x: baseTransform.pan.x + smoothedOffsetX,
        y: baseTransform.pan.y
      },
      coordinateSpace: baseTransform.coordinateSpace
    },
    runtimeState,
    targetOffsetX,
    targetScaleDelta
  };
}

function normalizeSignedInput(value: number | null): number {
  if (value === null || !Number.isFinite(value)) {
    return 0;
  }

  return clamp(value, -1, 1);
}

function applyDeadZone(value: number, deadZone: number): number {
  const normalizedDeadZone = clamp(
    Number.isFinite(deadZone) ? deadZone : 0,
    0,
    1
  );

  return Math.abs(value) < normalizedDeadZone ? 0 : value;
}

function approach(input: {
  readonly previous: number;
  readonly target: number;
  readonly initialized: boolean;
  readonly reaction: number;
  readonly elapsedMs: number;
}): number {
  if (!input.initialized) {
    return input.target;
  }

  const reaction = Math.max(0, Number.isFinite(input.reaction)
    ? input.reaction
    : 0);
  const elapsedSeconds = Math.max(0, Number.isFinite(input.elapsedMs)
    ? input.elapsedMs
    : 0) / 1000;

  if (reaction === 0 || elapsedSeconds === 0) {
    return input.previous;
  }

  const alpha = clamp(1 - Math.exp(-reaction * elapsedSeconds), 0, 1);
  return input.previous + (input.target - input.previous) * alpha;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
