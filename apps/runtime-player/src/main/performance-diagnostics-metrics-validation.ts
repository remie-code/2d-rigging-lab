import type {
  RuntimePlayerStageRenderMetricsSnapshot
} from "../preload/performance-diagnostics-contract";

const counterKeys = [
  "renderCount",
  "scheduledRenderCount",
  "immediateRenderCount",
  "liveFrameMessageCount",
  "stageViewTransformMessageCount",
  "stageDisplayTransformMessageCount",
  "duplicateTransformSkipCount",
  "coalescedLiveFrameCount",
  "rafDeltaSampleCount",
  "renderDurationSampleCount",
  "liveRenderInputEvaluationDurationSampleCount",
  "scheduledFrameDurationSampleCount",
  "canvasWidth",
  "canvasHeight"
] as const;

export function readRuntimePlayerStageRenderMetricsSnapshot(
  value: unknown
): RuntimePlayerStageRenderMetricsSnapshot {
  if (!isRecord(value)) {
    throw new Error("Stage render metrics snapshot must be an object.");
  }

  return {
    renderCount: readCounter(value.renderCount, "renderCount"),
    scheduledRenderCount: readCounter(
      value.scheduledRenderCount,
      "scheduledRenderCount"
    ),
    immediateRenderCount: readCounter(
      value.immediateRenderCount,
      "immediateRenderCount"
    ),
    liveFrameMessageCount: readCounter(
      value.liveFrameMessageCount,
      "liveFrameMessageCount"
    ),
    stageViewTransformMessageCount: readCounter(
      value.stageViewTransformMessageCount,
      "stageViewTransformMessageCount"
    ),
    stageDisplayTransformMessageCount: readCounter(
      value.stageDisplayTransformMessageCount,
      "stageDisplayTransformMessageCount"
    ),
    duplicateTransformSkipCount: readCounter(
      value.duplicateTransformSkipCount,
      "duplicateTransformSkipCount"
    ),
    coalescedLiveFrameCount: readCounter(
      value.coalescedLiveFrameCount,
      "coalescedLiveFrameCount"
    ),
    lastRafDeltaMs: readNullableNonNegativeFiniteNumber(
      value.lastRafDeltaMs,
      "lastRafDeltaMs"
    ),
    rafDeltaSampleCount: readCounter(
      value.rafDeltaSampleCount,
      "rafDeltaSampleCount"
    ),
    lastRenderDurationMs: readNullableNonNegativeFiniteNumber(
      value.lastRenderDurationMs,
      "lastRenderDurationMs"
    ),
    renderDurationSampleCount: readCounter(
      value.renderDurationSampleCount,
      "renderDurationSampleCount"
    ),
    lastLiveRenderInputEvaluationDurationMs:
      readOptionalNullableNonNegativeFiniteNumber(
        value.lastLiveRenderInputEvaluationDurationMs,
        "lastLiveRenderInputEvaluationDurationMs"
      ),
    liveRenderInputEvaluationDurationSampleCount: readOptionalCounter(
      value.liveRenderInputEvaluationDurationSampleCount,
      "liveRenderInputEvaluationDurationSampleCount"
    ),
    lastScheduledFrameDurationMs: readOptionalNullableNonNegativeFiniteNumber(
      value.lastScheduledFrameDurationMs,
      "lastScheduledFrameDurationMs"
    ),
    scheduledFrameDurationSampleCount: readOptionalCounter(
      value.scheduledFrameDurationSampleCount,
      "scheduledFrameDurationSampleCount"
    ),
    canvasWidth: readCounter(value.canvasWidth, "canvasWidth"),
    canvasHeight: readCounter(value.canvasHeight, "canvasHeight"),
    devicePixelRatio: readDevicePixelRatio(value.devicePixelRatio)
  };
}

export function readOptionalRuntimePlayerStageRenderMetricsSnapshot(
  value: unknown
): RuntimePlayerStageRenderMetricsSnapshot | null {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    return readRuntimePlayerStageRenderMetricsSnapshot(value);
  } catch {
    return null;
  }
}

export function createEmptyRuntimePlayerStageRenderMetricsSnapshot():
  RuntimePlayerStageRenderMetricsSnapshot {
  const snapshot = Object.fromEntries(
    counterKeys.map((key) => [key, 0])
  ) as Record<(typeof counterKeys)[number], number>;

  return {
    ...snapshot,
    lastRafDeltaMs: null,
    lastRenderDurationMs: null,
    lastLiveRenderInputEvaluationDurationMs: null,
    lastScheduledFrameDurationMs: null,
    devicePixelRatio: 1
  };
}

function readCounter(value: unknown, key: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Stage render metrics ${key} must be a non-negative integer.`);
  }

  return value;
}

function readNullableNonNegativeFiniteNumber(
  value: unknown,
  key: string
): number | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Stage render metrics ${key} must be null or non-negative.`);
  }

  return value;
}

function readOptionalCounter(value: unknown, key: string): number {
  return value === undefined ? 0 : readCounter(value, key);
}

function readOptionalNullableNonNegativeFiniteNumber(
  value: unknown,
  key: string
): number | null {
  return value === undefined
    ? null
    : readNullableNonNegativeFiniteNumber(value, key);
}

function readDevicePixelRatio(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error("Stage render metrics devicePixelRatio must be positive.");
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
