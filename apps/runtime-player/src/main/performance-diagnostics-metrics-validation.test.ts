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
    delete legacyMetrics.evaluationCacheHitCount;
    delete legacyMetrics.evaluationCacheMissCount;
    delete legacyMetrics.evaluationCacheInvalidationCount;
    delete legacyMetrics.compiledEvaluatorFrameCount;
    delete legacyMetrics.transientCompileCount;
    delete legacyMetrics.transientInstanceCount;
    delete legacyMetrics.runtimeModelInstanceCacheHitCount;
    delete legacyMetrics.runtimeModelInstanceCacheMissCount;
    delete legacyMetrics.runtimeModelInstanceCacheInvalidationCount;
    delete legacyMetrics.lastRuntimeModelCompileDurationMs;
    delete legacyMetrics.runtimeModelCompileDurationSampleCount;
    delete legacyMetrics.lastRuntimeCoreEvaluationDurationMs;
    delete legacyMetrics.runtimeCoreEvaluationDurationSampleCount;
    delete legacyMetrics.lastRuntimeCoreInputValidationDurationMs;
    delete legacyMetrics.runtimeCoreInputValidationDurationSampleCount;
    delete legacyMetrics.lastRuntimeCoreStateCompatibilityDurationMs;
    delete legacyMetrics.runtimeCoreStateCompatibilityDurationSampleCount;
    delete legacyMetrics.lastRuntimeCoreDynamicsEvaluationDurationMs;
    delete legacyMetrics.runtimeCoreDynamicsEvaluationDurationSampleCount;
    delete legacyMetrics.lastRuntimeCoreSnapshotCreationDurationMs;
    delete legacyMetrics.runtimeCoreSnapshotCreationDurationSampleCount;
    delete legacyMetrics.lastRuntimeCoreParameterResolutionDurationMs;
    delete legacyMetrics.runtimeCoreParameterResolutionDurationSampleCount;
    delete legacyMetrics.lastRuntimeCoreKeyformSamplingDurationMs;
    delete legacyMetrics.runtimeCoreKeyformSamplingDurationSampleCount;
    delete legacyMetrics.lastRuntimeCoreKeyformApplicationDurationMs;
    delete legacyMetrics.runtimeCoreKeyformApplicationDurationSampleCount;
    delete legacyMetrics.lastRuntimeCoreDeformerHierarchyEvaluationDurationMs;
    delete legacyMetrics.runtimeCoreDeformerHierarchyEvaluationDurationSampleCount;
    delete legacyMetrics.lastRuntimeCoreWarpDeformerVertexTransformDurationMs;
    delete legacyMetrics.runtimeCoreWarpDeformerVertexTransformDurationSampleCount;
    delete legacyMetrics.lastRuntimeCoreRotationDeformerVertexTransformDurationMs;
    delete legacyMetrics.runtimeCoreRotationDeformerVertexTransformDurationSampleCount;
    delete legacyMetrics.lastRuntimeCoreDrawableSnapshotCreationDurationMs;
    delete legacyMetrics.runtimeCoreDrawableSnapshotCreationDurationSampleCount;
    delete legacyMetrics.lastRuntimeCoreVisibilityDrawOrderEvaluationDurationMs;
    delete legacyMetrics.runtimeCoreVisibilityDrawOrderEvaluationDurationSampleCount;
    delete legacyMetrics.lastRuntimeCoreMaskEvaluationDurationMs;
    delete legacyMetrics.runtimeCoreMaskEvaluationDurationSampleCount;
    delete legacyMetrics.lastRuntimeCoreSnapshotValidationDurationMs;
    delete legacyMetrics.runtimeCoreSnapshotValidationDurationSampleCount;
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
      transientCompileCount: 0,
      transientInstanceCount: 0,
      runtimeModelInstanceCacheHitCount: 0,
      runtimeModelInstanceCacheMissCount: 0,
      runtimeModelInstanceCacheInvalidationCount: 0,
      lastRuntimeModelCompileDurationMs: null,
      runtimeModelCompileDurationSampleCount: 0,
      lastRuntimeCoreEvaluationDurationMs: null,
      runtimeCoreEvaluationDurationSampleCount: 0,
      lastRuntimeCoreInputValidationDurationMs: null,
      runtimeCoreInputValidationDurationSampleCount: 0,
      lastRuntimeCoreStateCompatibilityDurationMs: null,
      runtimeCoreStateCompatibilityDurationSampleCount: 0,
      lastRuntimeCoreDynamicsEvaluationDurationMs: null,
      runtimeCoreDynamicsEvaluationDurationSampleCount: 0,
      lastRuntimeCoreSnapshotCreationDurationMs: null,
      runtimeCoreSnapshotCreationDurationSampleCount: 0,
      lastRuntimeCoreParameterResolutionDurationMs: null,
      runtimeCoreParameterResolutionDurationSampleCount: 0,
      lastRuntimeCoreKeyformSamplingDurationMs: null,
      runtimeCoreKeyformSamplingDurationSampleCount: 0,
      lastRuntimeCoreKeyformApplicationDurationMs: null,
      runtimeCoreKeyformApplicationDurationSampleCount: 0,
      lastRuntimeCoreDeformerHierarchyEvaluationDurationMs: null,
      runtimeCoreDeformerHierarchyEvaluationDurationSampleCount: 0,
      lastRuntimeCoreWarpDeformerVertexTransformDurationMs: null,
      runtimeCoreWarpDeformerVertexTransformDurationSampleCount: 0,
      lastRuntimeCoreRotationDeformerVertexTransformDurationMs: null,
      runtimeCoreRotationDeformerVertexTransformDurationSampleCount: 0,
      lastRuntimeCoreDrawableSnapshotCreationDurationMs: null,
      runtimeCoreDrawableSnapshotCreationDurationSampleCount: 0,
      lastRuntimeCoreVisibilityDrawOrderEvaluationDurationMs: null,
      runtimeCoreVisibilityDrawOrderEvaluationDurationSampleCount: 0,
      lastRuntimeCoreMaskEvaluationDurationMs: null,
      runtimeCoreMaskEvaluationDurationSampleCount: 0,
      lastRuntimeCoreSnapshotValidationDurationMs: null,
      runtimeCoreSnapshotValidationDurationSampleCount: 0,
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
    ["non-integer transient compile count", { transientCompileCount: 1.5 }],
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
      "negative runtime core sample count",
      { runtimeCoreEvaluationDurationSampleCount: -1 }
    ],
    [
      "Infinity runtime core duration",
      { lastRuntimeCoreEvaluationDurationMs: Infinity }
    ],
    [
      "negative runtime core parameter duration",
      { lastRuntimeCoreParameterResolutionDurationMs: -1 }
    ],
    [
      "non-integer runtime core deformer sample count",
      { runtimeCoreDeformerHierarchyEvaluationDurationSampleCount: 1.25 }
    ],
    [
      "NaN runtime core warp transform duration",
      { lastRuntimeCoreWarpDeformerVertexTransformDurationMs: Number.NaN }
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
    transientCompileCount: 0,
    transientInstanceCount: 0,
    runtimeModelInstanceCacheHitCount: 4,
    runtimeModelInstanceCacheMissCount: 1,
    runtimeModelInstanceCacheInvalidationCount: 0,
    lastRuntimeModelCompileDurationMs: 1.2,
    runtimeModelCompileDurationSampleCount: 1,
    lastRuntimeCoreEvaluationDurationMs: 2,
    runtimeCoreEvaluationDurationSampleCount: 5,
    lastRuntimeCoreInputValidationDurationMs: 0.1,
    runtimeCoreInputValidationDurationSampleCount: 5,
    lastRuntimeCoreStateCompatibilityDurationMs: 0.1,
    runtimeCoreStateCompatibilityDurationSampleCount: 5,
    lastRuntimeCoreDynamicsEvaluationDurationMs: 0.2,
    runtimeCoreDynamicsEvaluationDurationSampleCount: 5,
    lastRuntimeCoreSnapshotCreationDurationMs: 1.8,
    runtimeCoreSnapshotCreationDurationSampleCount: 5,
    lastRuntimeCoreParameterResolutionDurationMs: 0.3,
    runtimeCoreParameterResolutionDurationSampleCount: 5,
    lastRuntimeCoreKeyformSamplingDurationMs: 0.4,
    runtimeCoreKeyformSamplingDurationSampleCount: 5,
    lastRuntimeCoreKeyformApplicationDurationMs: 0.5,
    runtimeCoreKeyformApplicationDurationSampleCount: 5,
    lastRuntimeCoreDeformerHierarchyEvaluationDurationMs: 0.6,
    runtimeCoreDeformerHierarchyEvaluationDurationSampleCount: 5,
    lastRuntimeCoreWarpDeformerVertexTransformDurationMs: 0.7,
    runtimeCoreWarpDeformerVertexTransformDurationSampleCount: 5,
    lastRuntimeCoreRotationDeformerVertexTransformDurationMs: 0.8,
    runtimeCoreRotationDeformerVertexTransformDurationSampleCount: 5,
    lastRuntimeCoreDrawableSnapshotCreationDurationMs: 0.9,
    runtimeCoreDrawableSnapshotCreationDurationSampleCount: 5,
    lastRuntimeCoreVisibilityDrawOrderEvaluationDurationMs: 0.1,
    runtimeCoreVisibilityDrawOrderEvaluationDurationSampleCount: 5,
    lastRuntimeCoreMaskEvaluationDurationMs: 0.1,
    runtimeCoreMaskEvaluationDurationSampleCount: 5,
    lastRuntimeCoreSnapshotValidationDurationMs: 0.2,
    runtimeCoreSnapshotValidationDurationSampleCount: 5,
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
