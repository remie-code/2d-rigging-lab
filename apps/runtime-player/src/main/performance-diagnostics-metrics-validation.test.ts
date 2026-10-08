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
      token: "token_fixture",
      lastRuntimeCoreEvaluationDurationMs: 2,
      runtimeCoreEvaluationDurationSampleCount: 1,
      lastRuntimeCoreParameterResolutionDurationMs: 0.3
    });

    expect(metrics).toEqual(createMetrics());
    expect(JSON.stringify(metrics)).not.toContain("private");
    expect(JSON.stringify(metrics)).not.toContain("token_fixture");
    expect(metrics).not.toHaveProperty("lastRuntimeCoreEvaluationDurationMs");
    expect(metrics).not.toHaveProperty(
      "runtimeCoreEvaluationDurationSampleCount"
    );
  });

  it("accepts optional Browser Source rAF probe metrics", () => {
    expect(
      readRuntimePlayerStageRenderMetricsSnapshot({
        ...createMetrics(),
        browserRafProbeFrameCount: 24,
        lastBrowserRafProbeDeltaMs: 16.7,
        browserRafProbeDeltaSampleCount: 23
      })
    ).toMatchObject({
      browserRafProbeFrameCount: 24,
      lastBrowserRafProbeDeltaMs: 16.7,
      browserRafProbeDeltaSampleCount: 23
    });
  });

  it("accepts older Stage render metrics without optional duration fields", () => {
    const legacyMetrics: Record<string, unknown> = { ...createMetrics() };
    delete legacyMetrics.lastLiveRenderInputEvaluationDurationMs;
    delete legacyMetrics.liveRenderInputEvaluationDurationSampleCount;
    delete legacyMetrics.evaluationCacheHitCount;
    delete legacyMetrics.evaluationCacheMissCount;
    delete legacyMetrics.evaluationCacheInvalidationCount;
    delete legacyMetrics.compiledEvaluatorFrameCount;
    delete legacyMetrics.compiledRenderFrameCount;
    delete legacyMetrics.transientCompileCount;
    delete legacyMetrics.transientInstanceCount;
    delete legacyMetrics.publicSnapshotMaterializationCount;
    delete legacyMetrics.runtimeModelInstanceCacheHitCount;
    delete legacyMetrics.runtimeModelInstanceCacheMissCount;
    delete legacyMetrics.runtimeModelInstanceCacheInvalidationCount;
    delete legacyMetrics.lastRuntimeModelCompileDurationMs;
    delete legacyMetrics.runtimeModelCompileDurationSampleCount;
    delete legacyMetrics.lastPoseEvaluationDurationMs;
    delete legacyMetrics.poseEvaluationDurationSampleCount;
    delete legacyMetrics.lastSnapshotToRenderDrawableDurationMs;
    delete legacyMetrics.snapshotToRenderDrawableDurationSampleCount;
    delete legacyMetrics.lastRenderInputSceneBuildDurationMs;
    delete legacyMetrics.renderInputSceneBuildDurationSampleCount;
    delete legacyMetrics.lastRenderInputScaffoldBuildDurationMs;
    delete legacyMetrics.renderInputScaffoldBuildDurationSampleCount;
    delete legacyMetrics.lastRenderInputClippingBuildDurationMs;
    delete legacyMetrics.renderInputClippingBuildDurationSampleCount;
    delete legacyMetrics.lastScheduledFrameDurationMs;
    delete legacyMetrics.scheduledFrameDurationSampleCount;

    expect(
      readRuntimePlayerStageRenderMetricsSnapshot(legacyMetrics)
    ).toMatchObject({
      lastLiveRenderInputEvaluationDurationMs: null,
      liveRenderInputEvaluationDurationSampleCount: 0,
      evaluationCacheHitCount: 0,
      evaluationCacheMissCount: 0,
      evaluationCacheInvalidationCount: 0,
      compiledEvaluatorFrameCount: 0,
      compiledRenderFrameCount: 0,
      transientCompileCount: 0,
      transientInstanceCount: 0,
      publicSnapshotMaterializationCount: 0,
      runtimeModelInstanceCacheHitCount: 0,
      runtimeModelInstanceCacheMissCount: 0,
      runtimeModelInstanceCacheInvalidationCount: 0,
      lastRuntimeModelCompileDurationMs: null,
      runtimeModelCompileDurationSampleCount: 0,
      lastPoseEvaluationDurationMs: null,
      poseEvaluationDurationSampleCount: 0,
      lastSnapshotToRenderDrawableDurationMs: null,
      snapshotToRenderDrawableDurationSampleCount: 0,
      lastRenderInputSceneBuildDurationMs: null,
      renderInputSceneBuildDurationSampleCount: 0,
      lastRenderInputScaffoldBuildDurationMs: null,
      renderInputScaffoldBuildDurationSampleCount: 0,
      lastRenderInputClippingBuildDurationMs: null,
      renderInputClippingBuildDurationSampleCount: 0,
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
    [
      "negative Browser Source rAF probe count",
      { browserRafProbeFrameCount: -1 }
    ],
    [
      "NaN Browser Source rAF probe delta",
      { lastBrowserRafProbeDeltaMs: Number.NaN }
    ],
    [
      "non-integer Browser Source rAF probe sample count",
      { browserRafProbeDeltaSampleCount: 2.25 }
    ],
    ["NaN rAF delta", { lastRafDeltaMs: Number.NaN }],
    ["Infinity render duration", { lastRenderDurationMs: Infinity }],
    [
      "negative live evaluation duration",
      { lastLiveRenderInputEvaluationDurationMs: -1 }
    ],
    ["negative cache hit count", { evaluationCacheHitCount: -1 }],
    ["non-integer cache miss count", { evaluationCacheMissCount: 1.5 }],
    [
      "negative compiled evaluator frame count",
      { compiledEvaluatorFrameCount: -1 }
    ],
    [
      "non-integer compiled render frame count",
      { compiledRenderFrameCount: 1.5 }
    ],
    ["non-integer transient compile count", { transientCompileCount: 1.5 }],
    [
      "negative public snapshot materialization count",
      { publicSnapshotMaterializationCount: -1 }
    ],
    [
      "negative runtime model instance cache hit count",
      { runtimeModelInstanceCacheHitCount: -1 }
    ],
    [
      "Infinity runtime model compile duration",
      { lastRuntimeModelCompileDurationMs: Infinity }
    ],
    [
      "negative runtime model compile sample count",
      { runtimeModelCompileDurationSampleCount: -1 }
    ],
    [
      "negative pose evaluation duration",
      { lastPoseEvaluationDurationMs: -1 }
    ],
    [
      "negative snapshot drawable sample count",
      { snapshotToRenderDrawableDurationSampleCount: -1 }
    ],
    [
      "NaN render input scene build duration",
      { lastRenderInputSceneBuildDurationMs: Number.NaN }
    ],
    [
      "negative scaffold build duration",
      { lastRenderInputScaffoldBuildDurationMs: -1 }
    ],
    [
      "negative clipping build sample count",
      { renderInputClippingBuildDurationSampleCount: -1 }
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
    evaluationCacheHitCount: 10,
    evaluationCacheMissCount: 2,
    evaluationCacheInvalidationCount: 1,
    compiledEvaluatorFrameCount: 5,
    compiledRenderFrameCount: 4,
    transientCompileCount: 0,
    transientInstanceCount: 0,
    publicSnapshotMaterializationCount: 0,
    runtimeModelInstanceCacheHitCount: 4,
    runtimeModelInstanceCacheMissCount: 1,
    runtimeModelInstanceCacheInvalidationCount: 0,
    lastRuntimeModelCompileDurationMs: 1.2,
    runtimeModelCompileDurationSampleCount: 1,
    lastPoseEvaluationDurationMs: 3,
    poseEvaluationDurationSampleCount: 5,
    lastSnapshotToRenderDrawableDurationMs: 1,
    snapshotToRenderDrawableDurationSampleCount: 5,
    lastRenderInputSceneBuildDurationMs: 0.5,
    renderInputSceneBuildDurationSampleCount: 5,
    lastRenderInputScaffoldBuildDurationMs: 0,
    renderInputScaffoldBuildDurationSampleCount: 5,
    lastRenderInputClippingBuildDurationMs: 0,
    renderInputClippingBuildDurationSampleCount: 5,
    lastScheduledFrameDurationMs: 9,
    scheduledFrameDurationSampleCount: 4,
    canvasWidth: 1280,
    canvasHeight: 720,
    devicePixelRatio: 1,
    ...patch
  };
}
