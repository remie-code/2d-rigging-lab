import { describe, expect, it } from "vitest";

import type {
  RuntimePlayerStageRenderMetricsSnapshot
} from "../preload/performance-diagnostics-contract";
import {
  readOptionalRuntimePlayerStageRenderMetricsSnapshot,
  readRuntimePlayerStageRenderMetricsSnapshot
} from "./performance-diagnostics-metrics-validation";

describe("performance diagnostics metrics validation", () => {
  it("accepts safe Stage render metrics and strips unknown fields", () => {
    const metrics = readRuntimePlayerStageRenderMetricsSnapshot({
      ...createMetrics(),
      privatePath: "C:/private/runtime-export.json",
      token: "token_fixture"
    });

    expect(metrics).toEqual(createMetrics());
    expect(JSON.stringify(metrics)).not.toContain("private");
    expect(JSON.stringify(metrics)).not.toContain("token_fixture");
  });

  it("accepts older Stage render metrics without optional duration fields", () => {
    const legacyMetrics: Record<string, unknown> = { ...createMetrics() };
    delete legacyMetrics.lastLiveRenderInputEvaluationDurationMs;
    delete legacyMetrics.liveRenderInputEvaluationDurationSampleCount;
    delete legacyMetrics.lastScheduledFrameDurationMs;
    delete legacyMetrics.scheduledFrameDurationSampleCount;

    expect(
      readRuntimePlayerStageRenderMetricsSnapshot(legacyMetrics)
    ).toMatchObject({
      lastLiveRenderInputEvaluationDurationMs: null,
      liveRenderInputEvaluationDurationSampleCount: 0,
      lastScheduledFrameDurationMs: null,
      scheduledFrameDurationSampleCount: 0
    });
  });

  it.each([
    ["negative counter", { renderCount: -1 }],
    ["non-integer counter", { renderCount: 1.5 }],
    ["negative sample count", { rafDeltaSampleCount: -1 }],
    ["non-integer sample count", { renderDurationSampleCount: 2.25 }],
    [
      "negative live evaluation sample count",
      { liveRenderInputEvaluationDurationSampleCount: -1 }
    ],
    [
      "non-integer scheduled frame sample count",
      { scheduledFrameDurationSampleCount: 1.25 }
    ],
    ["NaN rAF delta", { lastRafDeltaMs: Number.NaN }],
    ["Infinity render duration", { lastRenderDurationMs: Infinity }],
    [
      "negative live evaluation duration",
      { lastLiveRenderInputEvaluationDurationMs: -1 }
    ],
    [
      "Infinity scheduled frame duration",
      { lastScheduledFrameDurationMs: Infinity }
    ],
    ["negative canvas width", { canvasWidth: -1 }],
    ["non-integer canvas height", { canvasHeight: 720.5 }],
    ["zero device pixel ratio", { devicePixelRatio: 0 }],
    ["NaN device pixel ratio", { devicePixelRatio: Number.NaN }],
    ["Infinity device pixel ratio", { devicePixelRatio: Infinity }]
  ])("rejects malformed Stage render metrics: %s", (_label, patch) => {
    expect(() =>
      readRuntimePlayerStageRenderMetricsSnapshot({
        ...createMetrics(),
        ...patch
      })
    ).toThrow("Stage render metrics");
  });

  it("treats malformed optional Stage render metrics as unavailable", () => {
    expect(
      readOptionalRuntimePlayerStageRenderMetricsSnapshot({
        ...createMetrics(),
        renderCount: -1
      })
    ).toBeNull();
    expect(
      readOptionalRuntimePlayerStageRenderMetricsSnapshot({
        ...createMetrics(),
        devicePixelRatio: Number.NaN
      })
    ).toBeNull();
    expect(readOptionalRuntimePlayerStageRenderMetricsSnapshot(null)).toBeNull();
  });
});

function createMetrics(
  patch: Partial<RuntimePlayerStageRenderMetricsSnapshot> = {}
): RuntimePlayerStageRenderMetricsSnapshot {
  return {
    renderCount: 6,
    scheduledRenderCount: 4,
    immediateRenderCount: 2,
    liveFrameMessageCount: 8,
    stageViewTransformMessageCount: 3,
    stageDisplayTransformMessageCount: 2,
    duplicateTransformSkipCount: 1,
    coalescedLiveFrameCount: 2,
    lastRafDeltaMs: 16,
    rafDeltaSampleCount: 3,
    lastRenderDurationMs: 4,
    renderDurationSampleCount: 6,
    lastLiveRenderInputEvaluationDurationMs: 3,
    liveRenderInputEvaluationDurationSampleCount: 5,
    lastScheduledFrameDurationMs: 9,
    scheduledFrameDurationSampleCount: 4,
    canvasWidth: 1280,
    canvasHeight: 720,
    devicePixelRatio: 1,
    ...patch
  };
}
