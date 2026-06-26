import type {
  RuntimePlayerBrowserSourceStatus
} from "../preload/browser-source-status-contract";
import type {
  RuntimePlayerInputStatus
} from "../preload/input-bridge-contract";
import {
  runtimePlayerPerformanceDiagnosticsVersion,
  type RuntimePlayerStageRenderMetricsSnapshot
} from "../preload/performance-diagnostics-contract";
import type {
  RuntimePlayerStageStateSnapshot
} from "../preload/runtime-player-bridge-contract";

export type PerformanceDiagnosticsTarget =
  | "both"
  | "native-stage"
  | "browser-source";

export type PerformanceDiagnosticsInputSample = {
  readonly packetCount: number | null;
  readonly estimatedFps: number | null;
};

export type PerformanceDiagnosticsStageSample = {
  readonly windowState:
    RuntimePlayerStageStateSnapshot["stageWindow"]["windowState"] | null;
  readonly stageMotionEnabled: boolean | null;
};

export type PerformanceDiagnosticsBrowserSourceSample = {
  readonly connectedClientCount: number;
  readonly liveFrameSourceTimestampFpsLatest: number | null;
  readonly renderMetrics: RuntimePlayerStageRenderMetricsSnapshot | null;
};

export type PerformanceDiagnosticsCaptureSample = {
  readonly capturedAtMs: number;
  readonly input: PerformanceDiagnosticsInputSample;
  readonly stage: PerformanceDiagnosticsStageSample;
  readonly nativeStageMetrics: RuntimePlayerStageRenderMetricsSnapshot | null;
  readonly browserSource: PerformanceDiagnosticsBrowserSourceSample;
};

export type PerformanceDiagnosticsMetricSummary = {
  readonly sampleCount: number;
  readonly p50: number | null;
  readonly p95: number | null;
  readonly max: number | null;
};

export type PerformanceDiagnosticsTargetReport = {
  readonly availability:
    | "available"
    | "not-captured"
    | "no-stage"
    | "no-browser-source-client"
    | "metrics-unavailable";
  readonly liveFrameSourceTimestampFpsLatest: number | null;
  readonly liveFrameMessageFps: number | null;
  readonly liveFrameMessageCount: number | null;
  readonly appliedLiveFrameFps: number | null;
  readonly appliedLiveFrameCount: number | null;
  readonly renderFps: number | null;
  readonly browserRafProbeFps: number | null;
  readonly browserRafProbeDeltaMs: PerformanceDiagnosticsMetricSummary;
  readonly rafDeltaMs: PerformanceDiagnosticsMetricSummary;
  readonly renderDurationMs: PerformanceDiagnosticsMetricSummary;
  readonly liveRenderInputEvaluationDurationMs:
    PerformanceDiagnosticsMetricSummary;
  readonly evaluationCacheHitCount: number | null;
  readonly evaluationCacheMissCount: number | null;
  readonly evaluationCacheInvalidationCount: number | null;
  readonly scaffoldEvaluationCacheHitCount: number | null;
  readonly scaffoldEvaluationCacheMissCount: number | null;
  readonly scaffoldEvaluationCacheInvalidationCount: number | null;
  readonly compiledEvaluatorFrameCount: number | null;
  readonly compiledRenderFrameCount: number | null;
  readonly transientCompileCount: number | null;
  readonly transientInstanceCount: number | null;
  readonly publicSnapshotMaterializationCount: number | null;
  readonly runtimeModelInstanceCacheHitCount: number | null;
  readonly runtimeModelInstanceCacheMissCount: number | null;
  readonly runtimeModelInstanceCacheInvalidationCount: number | null;
  readonly poseEvaluationDurationMs: PerformanceDiagnosticsMetricSummary;
  readonly snapshotToRenderDrawableDurationMs:
    PerformanceDiagnosticsMetricSummary;
  readonly renderInputSceneBuildDurationMs:
    PerformanceDiagnosticsMetricSummary;
  readonly renderInputScaffoldBuildDurationMs:
    PerformanceDiagnosticsMetricSummary;
  readonly renderInputClippingBuildDurationMs:
    PerformanceDiagnosticsMetricSummary;
  readonly scheduledFrameDurationMs: PerformanceDiagnosticsMetricSummary;
  readonly stageTransformMessageCount: number | null;
  readonly stageViewTransformMessageCount: number | null;
  readonly stageDisplayTransformMessageCount: number | null;
  readonly duplicateTransformSkipCount: number | null;
  readonly liveFramesPerAppliedFrame: number | null;
  readonly coalescedLiveFramesPerAppliedFrame: number | null;
  readonly coalescedLiveFrameCount: number | null;
  readonly renderCount: number | null;
  readonly scheduledRenderCount: number | null;
  readonly immediateRenderCount: number | null;
  readonly browserSourceClientCount: number | null;
  readonly stageMotionEnabled: boolean | null;
  readonly canvas: {
    readonly width: number;
    readonly height: number;
    readonly devicePixelRatio: number;
  } | null;
};

export type PerformanceDiagnosticsReport = {
  readonly diagnosticVersion: typeof runtimePlayerPerformanceDiagnosticsVersion;
  readonly capture: {
    readonly target: PerformanceDiagnosticsTarget;
    readonly startedAtIso: string;
    readonly endedAtIso: string;
    readonly durationMs: number;
    readonly requestedDurationMs: number;
    readonly sampleCount: number;
  };
  readonly input: {
    readonly inputReceiveFpsLatest: number | null;
    readonly inputPacketCount: number | null;
  };
  readonly nativeStage: PerformanceDiagnosticsTargetReport;
  readonly browserSource: PerformanceDiagnosticsTargetReport;
  readonly privacy: {
    readonly excludes: readonly string[];
  };
};

export type PerformanceDiagnosticsCaptureDraft = {
  readonly target: PerformanceDiagnosticsTarget;
  readonly startedAtIso: string;
  readonly startedAtMs: number;
  readonly requestedDurationMs: number;
  readonly samples: readonly PerformanceDiagnosticsCaptureSample[];
};

export function createPerformanceDiagnosticsCaptureSample(input: {
  readonly capturedAtMs: number;
  readonly inputStatus: RuntimePlayerInputStatus | null;
  readonly stageState: RuntimePlayerStageStateSnapshot | null;
  readonly nativeStageMetrics: RuntimePlayerStageRenderMetricsSnapshot | null;
  readonly browserSourceStatus: RuntimePlayerBrowserSourceStatus | null;
}): PerformanceDiagnosticsCaptureSample {
  const latestBrowserDiagnostics =
    input.browserSourceStatus?.latestRendererDiagnostics ?? null;

  return {
    capturedAtMs: input.capturedAtMs,
    input: {
      packetCount: input.inputStatus?.packetCount ?? null,
      estimatedFps: input.inputStatus?.estimatedFps ?? null
    },
    stage: {
      windowState: input.stageState?.stageWindow.windowState ?? null,
      stageMotionEnabled:
        input.stageState?.stageMotion.settings.enabled ?? null
    },
    nativeStageMetrics: copyRenderMetricsSnapshot(input.nativeStageMetrics),
    browserSource: {
      connectedClientCount: input.browserSourceStatus?.connectedClientCount ?? 0,
      liveFrameSourceTimestampFpsLatest: latestBrowserDiagnostics?.sourceFps ??
        latestBrowserDiagnostics?.fps ??
        null,
      renderMetrics: copyRenderMetricsSnapshot(
        latestBrowserDiagnostics?.renderMetrics ?? null
      )
    }
  };
}

export function startPerformanceDiagnosticsCapture(input: {
  readonly target: PerformanceDiagnosticsTarget;
  readonly startedAtIso: string;
  readonly startedAtMs: number;
  readonly requestedDurationMs: number;
  readonly firstSample: PerformanceDiagnosticsCaptureSample;
}): PerformanceDiagnosticsCaptureDraft {
  return {
    target: input.target,
    startedAtIso: input.startedAtIso,
    startedAtMs: input.startedAtMs,
    requestedDurationMs: Math.max(0, input.requestedDurationMs),
    samples: [input.firstSample]
  };
}

export function addPerformanceDiagnosticsCaptureSample(
  draft: PerformanceDiagnosticsCaptureDraft,
  sample: PerformanceDiagnosticsCaptureSample
): PerformanceDiagnosticsCaptureDraft {
  return {
    ...draft,
    samples: [...draft.samples, sample]
  };
}

export function completePerformanceDiagnosticsCapture(input: {
  readonly draft: PerformanceDiagnosticsCaptureDraft;
  readonly endedAtIso: string;
  readonly endedAtMs: number;
  readonly finalSample?: PerformanceDiagnosticsCaptureSample;
}): PerformanceDiagnosticsReport {
  const samples = input.finalSample === undefined
    ? input.draft.samples
    : [...input.draft.samples, input.finalSample];

  return createPerformanceDiagnosticsReport({
    target: input.draft.target,
    startedAtIso: input.draft.startedAtIso,
    endedAtIso: input.endedAtIso,
    durationMs: input.endedAtMs - input.draft.startedAtMs,
    requestedDurationMs: input.draft.requestedDurationMs,
    samples
  });
}

export function createPerformanceDiagnosticsReport(input: {
  readonly target: PerformanceDiagnosticsTarget;
  readonly startedAtIso: string;
  readonly endedAtIso: string;
  readonly durationMs: number;
  readonly requestedDurationMs: number;
  readonly samples: readonly PerformanceDiagnosticsCaptureSample[];
}): PerformanceDiagnosticsReport {
  const durationMs = Math.max(0, input.durationMs);
  const sampleCount = input.samples.length;

  return {
    diagnosticVersion: runtimePlayerPerformanceDiagnosticsVersion,
    capture: {
      target: input.target,
      startedAtIso: input.startedAtIso,
      endedAtIso: input.endedAtIso,
      durationMs,
      requestedDurationMs: Math.max(0, input.requestedDurationMs),
      sampleCount
    },
    input: {
      inputReceiveFpsLatest: readLatestInputFps(input.samples),
      inputPacketCount: readInputPacketDelta(input.samples)
    },
    nativeStage: createNativeStageReport({
      target: input.target,
      durationMs,
      samples: input.samples
    }),
    browserSource: createBrowserSourceReport({
      target: input.target,
      durationMs,
      samples: input.samples
    }),
    privacy: {
      excludes: [
        "raw tracking frames",
        "calibration internals",
        "Browser Source token",
        "private file paths",
        "full Runtime Export payload",
        "Runtime Export textures",
        "Runtime Export mesh data"
      ]
    }
  };
}

export function formatPerformanceDiagnosticsReport(
  report: PerformanceDiagnosticsReport
): string {
  const lines = [
    "Runtime Player Performance Diagnostics",
    `diagnosticVersion: ${report.diagnosticVersion}`,
    "diagnosticScope: live-health-fps-connection-fast-path",
    `captureTarget: ${report.capture.target}`,
    `captureStartedAtIso: ${report.capture.startedAtIso}`,
    `captureEndedAtIso: ${report.capture.endedAtIso}`,
    `captureDurationMs: ${Math.round(report.capture.durationMs)}`,
    `requestedDurationMs: ${Math.round(report.capture.requestedDurationMs)}`,
    `sampleCount: ${report.capture.sampleCount}`,
    "",
    "[Input]",
    `inputReceiveFpsLatest: ${
      formatNullableNumber(report.input.inputReceiveFpsLatest)
    }`,
    `inputPacketCount: ${formatNullableInteger(report.input.inputPacketCount)}`,
    "",
    ...formatTargetReport("Native Stage", report.nativeStage),
    "",
    ...formatTargetReport("Browser Source", report.browserSource),
    "",
    "[Comparison Notes]",
    "nativeStageOnly: run target Native Stage with no Browser Source client connected.",
    "browserSourceConnected: run target Browser Source or Both after OBS Browser Source connects.",
    "stageMotionOffOn: capture once with Stage Motion off and once with it on.",
    "obsCustomFps: record OBS custom FPS off/30/60 as manual observation.",
    "",
    "[Privacy]",
    `excludes: ${report.privacy.excludes.join(", ")}`
  ];

  return lines.join("\n");
}

function createNativeStageReport(input: {
  readonly target: PerformanceDiagnosticsTarget;
  readonly durationMs: number;
  readonly samples: readonly PerformanceDiagnosticsCaptureSample[];
}): PerformanceDiagnosticsTargetReport {
  if (input.target === "browser-source") {
    return createUnavailableTargetReport("not-captured");
  }

  const metrics = input.samples
    .map((sample) => sample.nativeStageMetrics)
    .filter(isNonNull);
  const latestStageState = readLatestValue(
    input.samples.map((sample) => sample.stage)
  );

  if (latestStageState?.windowState === "destroyed") {
    return createUnavailableTargetReport("no-stage");
  }

  if (metrics.length === 0) {
    return createUnavailableTargetReport("metrics-unavailable", {
      stageMotionEnabled: latestStageState?.stageMotionEnabled ?? null
    });
  }

  return createMetricsTargetReport({
    availability: "available",
    durationMs: input.durationMs,
    metrics,
    liveFrameSourceTimestampFpsLatest: null,
    browserSourceClientCount: readLatestBrowserSourceClientCount(input.samples),
    stageMotionEnabled: latestStageState?.stageMotionEnabled ?? null
  });
}

function createBrowserSourceReport(input: {
  readonly target: PerformanceDiagnosticsTarget;
  readonly durationMs: number;
  readonly samples: readonly PerformanceDiagnosticsCaptureSample[];
}): PerformanceDiagnosticsTargetReport {
  if (input.target === "native-stage") {
    return createUnavailableTargetReport("not-captured");
  }

  const latestBrowserSource = readLatestValue(
    input.samples.map((sample) => sample.browserSource)
  );
  const metrics = input.samples
    .map((sample) => sample.browserSource.renderMetrics)
    .filter(isNonNull);
  const latestStageState = readLatestValue(
    input.samples.map((sample) => sample.stage)
  );
  const browserSourceClientCount =
    latestBrowserSource?.connectedClientCount ?? null;
  const liveFrameSourceTimestampFpsLatest =
    latestBrowserSource?.liveFrameSourceTimestampFpsLatest ?? null;

  if ((browserSourceClientCount ?? 0) <= 0) {
    return createUnavailableTargetReport("no-browser-source-client", {
      liveFrameSourceTimestampFpsLatest,
      browserSourceClientCount,
      stageMotionEnabled: latestStageState?.stageMotionEnabled ?? null
    });
  }

  if (metrics.length === 0) {
    return createUnavailableTargetReport("metrics-unavailable", {
      liveFrameSourceTimestampFpsLatest,
      browserSourceClientCount,
      stageMotionEnabled: latestStageState?.stageMotionEnabled ?? null
    });
  }

  return createMetricsTargetReport({
    availability: "available",
    durationMs: input.durationMs,
    metrics,
    liveFrameSourceTimestampFpsLatest,
    browserSourceClientCount,
    stageMotionEnabled: latestStageState?.stageMotionEnabled ?? null
  });
}

function createMetricsTargetReport(input: {
  readonly availability: PerformanceDiagnosticsTargetReport["availability"];
  readonly durationMs: number;
  readonly metrics: readonly RuntimePlayerStageRenderMetricsSnapshot[];
  readonly liveFrameSourceTimestampFpsLatest: number | null;
  readonly browserSourceClientCount: number | null;
  readonly stageMotionEnabled: boolean | null;
}): PerformanceDiagnosticsTargetReport {
  const start = input.metrics[0] ?? null;
  const end = input.metrics.at(-1) ?? null;
  const renderCount = readMetricDelta(start, end, "renderCount");
  const browserRafProbeFrameCount = readMetricDelta(
    start,
    end,
    "browserRafProbeFrameCount"
  );
  const liveFrameMessageCount = readMetricDelta(
    start,
    end,
    "liveFrameMessageCount"
  );
  const appliedLiveFrameCount = readMetricDelta(
    start,
    end,
    "liveRenderInputEvaluationDurationSampleCount"
  );
  const stageViewTransformMessageCount = readMetricDelta(
    start,
    end,
    "stageViewTransformMessageCount"
  );
  const stageDisplayTransformMessageCount = readMetricDelta(
    start,
    end,
    "stageDisplayTransformMessageCount"
  );
  const scaffoldEvaluationCacheHitCount = readMetricDelta(
    start,
    end,
    "evaluationCacheHitCount"
  );
  const scaffoldEvaluationCacheMissCount = readMetricDelta(
    start,
    end,
    "evaluationCacheMissCount"
  );
  const scaffoldEvaluationCacheInvalidationCount = readMetricDelta(
    start,
    end,
    "evaluationCacheInvalidationCount"
  );
  const coalescedLiveFrameCount = readMetricDelta(
    start,
    end,
    "coalescedLiveFrameCount"
  );

  return {
    availability: input.availability,
    liveFrameSourceTimestampFpsLatest:
      input.liveFrameSourceTimestampFpsLatest,
    liveFrameMessageFps: liveFrameMessageCount === null
      ? null
      : calculateFps(liveFrameMessageCount, input.durationMs),
    liveFrameMessageCount,
    appliedLiveFrameFps: appliedLiveFrameCount === null
      ? null
      : calculateFps(appliedLiveFrameCount, input.durationMs),
    appliedLiveFrameCount,
    renderFps: renderCount === null
      ? null
      : calculateFps(renderCount, input.durationMs),
    browserRafProbeFps: browserRafProbeFrameCount === null
      ? null
      : calculateFps(browserRafProbeFrameCount, input.durationMs),
    browserRafProbeDeltaMs: summarizeMetricSamples({
      metrics: input.metrics,
      sampleCountKey: "browserRafProbeDeltaSampleCount",
      valueKey: "lastBrowserRafProbeDeltaMs"
    }),
    rafDeltaMs: summarizeMetricSamples({
      metrics: input.metrics,
      sampleCountKey: "rafDeltaSampleCount",
      valueKey: "lastRafDeltaMs"
    }),
    renderDurationMs: summarizeMetricSamples({
      metrics: input.metrics,
      sampleCountKey: "renderDurationSampleCount",
      valueKey: "lastRenderDurationMs"
    }),
    liveRenderInputEvaluationDurationMs: summarizeMetricSamples({
      metrics: input.metrics,
      sampleCountKey: "liveRenderInputEvaluationDurationSampleCount",
      valueKey: "lastLiveRenderInputEvaluationDurationMs"
    }),
    evaluationCacheHitCount: scaffoldEvaluationCacheHitCount,
    evaluationCacheMissCount: scaffoldEvaluationCacheMissCount,
    evaluationCacheInvalidationCount: scaffoldEvaluationCacheInvalidationCount,
    scaffoldEvaluationCacheHitCount,
    scaffoldEvaluationCacheMissCount,
    scaffoldEvaluationCacheInvalidationCount,
    compiledEvaluatorFrameCount: readMetricDelta(
      start,
      end,
      "compiledEvaluatorFrameCount"
    ),
    compiledRenderFrameCount: readMetricDelta(
      start,
      end,
      "compiledRenderFrameCount"
    ),
    transientCompileCount: readMetricDelta(
      start,
      end,
      "transientCompileCount"
    ),
    transientInstanceCount: readMetricDelta(
      start,
      end,
      "transientInstanceCount"
    ),
    publicSnapshotMaterializationCount: readMetricDelta(
      start,
      end,
      "publicSnapshotMaterializationCount"
    ),
    runtimeModelInstanceCacheHitCount: readMetricDelta(
      start,
      end,
      "runtimeModelInstanceCacheHitCount"
    ),
    runtimeModelInstanceCacheMissCount: readMetricDelta(
      start,
      end,
      "runtimeModelInstanceCacheMissCount"
    ),
    runtimeModelInstanceCacheInvalidationCount: readMetricDelta(
      start,
      end,
      "runtimeModelInstanceCacheInvalidationCount"
    ),
    poseEvaluationDurationMs: summarizeMetricSamples({
      metrics: input.metrics,
      sampleCountKey: "poseEvaluationDurationSampleCount",
      valueKey: "lastPoseEvaluationDurationMs"
    }),
    snapshotToRenderDrawableDurationMs: summarizeMetricSamples({
      metrics: input.metrics,
      sampleCountKey: "snapshotToRenderDrawableDurationSampleCount",
      valueKey: "lastSnapshotToRenderDrawableDurationMs"
    }),
    renderInputSceneBuildDurationMs: summarizeMetricSamples({
      metrics: input.metrics,
      sampleCountKey: "renderInputSceneBuildDurationSampleCount",
      valueKey: "lastRenderInputSceneBuildDurationMs"
    }),
    renderInputScaffoldBuildDurationMs: summarizeMetricSamples({
      metrics: input.metrics,
      sampleCountKey: "renderInputScaffoldBuildDurationSampleCount",
      valueKey: "lastRenderInputScaffoldBuildDurationMs"
    }),
    renderInputClippingBuildDurationMs: summarizeMetricSamples({
      metrics: input.metrics,
      sampleCountKey: "renderInputClippingBuildDurationSampleCount",
      valueKey: "lastRenderInputClippingBuildDurationMs"
    }),
    scheduledFrameDurationMs: summarizeMetricSamples({
      metrics: input.metrics,
      sampleCountKey: "scheduledFrameDurationSampleCount",
      valueKey: "lastScheduledFrameDurationMs"
    }),
    stageTransformMessageCount: addNullableCounts(
      stageViewTransformMessageCount,
      stageDisplayTransformMessageCount
    ),
    stageViewTransformMessageCount,
    stageDisplayTransformMessageCount,
    duplicateTransformSkipCount: readMetricDelta(
      start,
      end,
      "duplicateTransformSkipCount"
    ),
    liveFramesPerAppliedFrame: calculateRatio(
      liveFrameMessageCount,
      appliedLiveFrameCount
    ),
    coalescedLiveFramesPerAppliedFrame: calculateRatio(
      coalescedLiveFrameCount,
      appliedLiveFrameCount
    ),
    coalescedLiveFrameCount,
    renderCount,
    scheduledRenderCount: readMetricDelta(
      start,
      end,
      "scheduledRenderCount"
    ),
    immediateRenderCount: readMetricDelta(
      start,
      end,
      "immediateRenderCount"
    ),
    browserSourceClientCount: input.browserSourceClientCount,
    stageMotionEnabled: input.stageMotionEnabled,
    canvas: end === null
      ? null
      : {
          width: end.canvasWidth,
          height: end.canvasHeight,
          devicePixelRatio: end.devicePixelRatio
        }
  };
}

function createUnavailableTargetReport(
  availability: PerformanceDiagnosticsTargetReport["availability"],
  patch: Partial<PerformanceDiagnosticsTargetReport> = {}
): PerformanceDiagnosticsTargetReport {
  return {
    availability,
    liveFrameSourceTimestampFpsLatest: null,
    liveFrameMessageFps: null,
    liveFrameMessageCount: null,
    appliedLiveFrameFps: null,
    appliedLiveFrameCount: null,
    renderFps: null,
    browserRafProbeFps: null,
    browserRafProbeDeltaMs: createEmptyMetricSummary(),
    rafDeltaMs: createEmptyMetricSummary(),
    renderDurationMs: createEmptyMetricSummary(),
    liveRenderInputEvaluationDurationMs: createEmptyMetricSummary(),
    evaluationCacheHitCount: null,
    evaluationCacheMissCount: null,
    evaluationCacheInvalidationCount: null,
    scaffoldEvaluationCacheHitCount: null,
    scaffoldEvaluationCacheMissCount: null,
    scaffoldEvaluationCacheInvalidationCount: null,
    compiledEvaluatorFrameCount: null,
    compiledRenderFrameCount: null,
    transientCompileCount: null,
    transientInstanceCount: null,
    publicSnapshotMaterializationCount: null,
    runtimeModelInstanceCacheHitCount: null,
    runtimeModelInstanceCacheMissCount: null,
    runtimeModelInstanceCacheInvalidationCount: null,
    poseEvaluationDurationMs: createEmptyMetricSummary(),
    snapshotToRenderDrawableDurationMs: createEmptyMetricSummary(),
    renderInputSceneBuildDurationMs: createEmptyMetricSummary(),
    renderInputScaffoldBuildDurationMs: createEmptyMetricSummary(),
    renderInputClippingBuildDurationMs: createEmptyMetricSummary(),
    scheduledFrameDurationMs: createEmptyMetricSummary(),
    stageTransformMessageCount: null,
    stageViewTransformMessageCount: null,
    stageDisplayTransformMessageCount: null,
    duplicateTransformSkipCount: null,
    liveFramesPerAppliedFrame: null,
    coalescedLiveFramesPerAppliedFrame: null,
    coalescedLiveFrameCount: null,
    renderCount: null,
    scheduledRenderCount: null,
    immediateRenderCount: null,
    browserSourceClientCount: null,
    stageMotionEnabled: null,
    canvas: null,
    ...patch
  };
}

function summarizeMetricSamples(input: {
  readonly metrics: readonly RuntimePlayerStageRenderMetricsSnapshot[];
  readonly sampleCountKey:
    | "rafDeltaSampleCount"
    | "browserRafProbeDeltaSampleCount"
    | "renderDurationSampleCount"
    | "liveRenderInputEvaluationDurationSampleCount"
    | "poseEvaluationDurationSampleCount"
    | "snapshotToRenderDrawableDurationSampleCount"
    | "renderInputSceneBuildDurationSampleCount"
    | "renderInputScaffoldBuildDurationSampleCount"
    | "renderInputClippingBuildDurationSampleCount"
    | "scheduledFrameDurationSampleCount";
  readonly valueKey:
    | "lastRafDeltaMs"
    | "lastBrowserRafProbeDeltaMs"
    | "lastRenderDurationMs"
    | "lastLiveRenderInputEvaluationDurationMs"
    | "lastPoseEvaluationDurationMs"
    | "lastSnapshotToRenderDrawableDurationMs"
    | "lastRenderInputSceneBuildDurationMs"
    | "lastRenderInputScaffoldBuildDurationMs"
    | "lastRenderInputClippingBuildDurationMs"
    | "lastScheduledFrameDurationMs";
}): PerformanceDiagnosticsMetricSummary {
  let previousSampleCount = input.metrics[0]?.[input.sampleCountKey] ?? -1;
  const values: number[] = [];

  for (const snapshot of input.metrics.slice(1)) {
    const sampleCount = snapshot[input.sampleCountKey] ?? 0;
    const value = snapshot[input.valueKey] ?? null;
    if (sampleCount > previousSampleCount && value !== null) {
      values.push(value);
    }
    previousSampleCount = Math.max(previousSampleCount, sampleCount);
  }

  if (values.length === 0) {
    return createEmptyMetricSummary();
  }

  const sorted = [...values].sort((left, right) => left - right);

  return {
    sampleCount: values.length,
    p50: readPercentile(sorted, 0.5),
    p95: readPercentile(sorted, 0.95),
    max: sorted.at(-1) ?? null
  };
}

function readMetricDelta(
  start: RuntimePlayerStageRenderMetricsSnapshot | null,
  end: RuntimePlayerStageRenderMetricsSnapshot | null,
  key: keyof RuntimePlayerStageRenderMetricsSnapshot
): number | null {
  if (start === null || end === null) {
    return null;
  }

  const startValue = start[key];
  const endValue = end[key];
  if (typeof startValue !== "number" || typeof endValue !== "number") {
    return null;
  }

  return Math.max(0, endValue - startValue);
}

function readInputPacketDelta(
  samples: readonly PerformanceDiagnosticsCaptureSample[]
): number | null {
  const packetCounts = samples
    .map((sample) => sample.input.packetCount)
    .filter(isNonNull);
  const start = packetCounts[0];
  const end = packetCounts.at(-1);

  return start === undefined || end === undefined
    ? null
    : Math.max(0, end - start);
}

function readLatestInputFps(
  samples: readonly PerformanceDiagnosticsCaptureSample[]
): number | null {
  return readLatestValue(
    samples.map((sample) => sample.input.estimatedFps)
  );
}

function readLatestBrowserSourceClientCount(
  samples: readonly PerformanceDiagnosticsCaptureSample[]
): number | null {
  return readLatestValue(
    samples.map((sample) => sample.browserSource.connectedClientCount)
  );
}

function calculateFps(count: number, durationMs: number): number | null {
  if (durationMs <= 0) {
    return null;
  }

  return Math.round((count / (durationMs / 1000)) * 10) / 10;
}

function calculateRatio(
  numerator: number | null,
  denominator: number | null
): number | null {
  if (numerator === null || denominator === null || denominator <= 0) {
    return null;
  }

  return Math.round((numerator / denominator) * 10) / 10;
}

function readPercentile(
  sortedValues: readonly number[],
  percentile: number
): number | null {
  if (sortedValues.length === 0) {
    return null;
  }

  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * percentile) - 1)
  );

  return sortedValues[index] ?? null;
}

function addNullableCounts(
  left: number | null,
  right: number | null
): number | null {
  if (left === null && right === null) {
    return null;
  }

  return (left ?? 0) + (right ?? 0);
}

function readLatestValue<TValue>(
  values: readonly (TValue | null | undefined)[]
): TValue | null {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (value !== null && value !== undefined) {
      return value;
    }
  }

  return null;
}

function createEmptyMetricSummary(): PerformanceDiagnosticsMetricSummary {
  return {
    sampleCount: 0,
    p50: null,
    p95: null,
    max: null
  };
}

function copyRenderMetricsSnapshot(
  snapshot: RuntimePlayerStageRenderMetricsSnapshot | null
): RuntimePlayerStageRenderMetricsSnapshot | null {
  if (snapshot === null) {
    return null;
  }

  return {
    renderCount: snapshot.renderCount,
    scheduledRenderCount: snapshot.scheduledRenderCount,
    immediateRenderCount: snapshot.immediateRenderCount,
    liveFrameMessageCount: snapshot.liveFrameMessageCount,
    stageViewTransformMessageCount: snapshot.stageViewTransformMessageCount,
    stageDisplayTransformMessageCount: snapshot.stageDisplayTransformMessageCount,
    duplicateTransformSkipCount: snapshot.duplicateTransformSkipCount,
    coalescedLiveFrameCount: snapshot.coalescedLiveFrameCount,
    lastRafDeltaMs: snapshot.lastRafDeltaMs,
    rafDeltaSampleCount: snapshot.rafDeltaSampleCount,
    ...(snapshot.browserRafProbeFrameCount === undefined
      ? {}
      : {
          browserRafProbeFrameCount: snapshot.browserRafProbeFrameCount
        }),
    ...(snapshot.lastBrowserRafProbeDeltaMs === undefined
      ? {}
      : {
          lastBrowserRafProbeDeltaMs:
            snapshot.lastBrowserRafProbeDeltaMs
        }),
    ...(snapshot.browserRafProbeDeltaSampleCount === undefined
      ? {}
      : {
          browserRafProbeDeltaSampleCount:
            snapshot.browserRafProbeDeltaSampleCount
        }),
    lastRenderDurationMs: snapshot.lastRenderDurationMs,
    renderDurationSampleCount: snapshot.renderDurationSampleCount,
    lastLiveRenderInputEvaluationDurationMs:
      snapshot.lastLiveRenderInputEvaluationDurationMs ?? null,
    liveRenderInputEvaluationDurationSampleCount:
      snapshot.liveRenderInputEvaluationDurationSampleCount ?? 0,
    evaluationCacheHitCount: snapshot.evaluationCacheHitCount ?? 0,
    evaluationCacheMissCount: snapshot.evaluationCacheMissCount ?? 0,
    evaluationCacheInvalidationCount:
      snapshot.evaluationCacheInvalidationCount ?? 0,
    compiledEvaluatorFrameCount:
      snapshot.compiledEvaluatorFrameCount ?? 0,
    compiledRenderFrameCount:
      snapshot.compiledRenderFrameCount ?? 0,
    transientCompileCount: snapshot.transientCompileCount ?? 0,
    transientInstanceCount: snapshot.transientInstanceCount ?? 0,
    publicSnapshotMaterializationCount:
      snapshot.publicSnapshotMaterializationCount ?? 0,
    runtimeModelInstanceCacheHitCount:
      snapshot.runtimeModelInstanceCacheHitCount ?? 0,
    runtimeModelInstanceCacheMissCount:
      snapshot.runtimeModelInstanceCacheMissCount ?? 0,
    runtimeModelInstanceCacheInvalidationCount:
      snapshot.runtimeModelInstanceCacheInvalidationCount ?? 0,
    lastRuntimeModelCompileDurationMs:
      snapshot.lastRuntimeModelCompileDurationMs ?? null,
    runtimeModelCompileDurationSampleCount:
      snapshot.runtimeModelCompileDurationSampleCount ?? 0,
    lastPoseEvaluationDurationMs:
      snapshot.lastPoseEvaluationDurationMs ?? null,
    poseEvaluationDurationSampleCount:
      snapshot.poseEvaluationDurationSampleCount ?? 0,
    lastSnapshotToRenderDrawableDurationMs:
      snapshot.lastSnapshotToRenderDrawableDurationMs ?? null,
    snapshotToRenderDrawableDurationSampleCount:
      snapshot.snapshotToRenderDrawableDurationSampleCount ?? 0,
    lastRenderInputSceneBuildDurationMs:
      snapshot.lastRenderInputSceneBuildDurationMs ?? null,
    renderInputSceneBuildDurationSampleCount:
      snapshot.renderInputSceneBuildDurationSampleCount ?? 0,
    lastRenderInputScaffoldBuildDurationMs:
      snapshot.lastRenderInputScaffoldBuildDurationMs ?? null,
    renderInputScaffoldBuildDurationSampleCount:
      snapshot.renderInputScaffoldBuildDurationSampleCount ?? 0,
    lastRenderInputClippingBuildDurationMs:
      snapshot.lastRenderInputClippingBuildDurationMs ?? null,
    renderInputClippingBuildDurationSampleCount:
      snapshot.renderInputClippingBuildDurationSampleCount ?? 0,
    lastScheduledFrameDurationMs:
      snapshot.lastScheduledFrameDurationMs ?? null,
    scheduledFrameDurationSampleCount:
      snapshot.scheduledFrameDurationSampleCount ?? 0,
    canvasWidth: snapshot.canvasWidth,
    canvasHeight: snapshot.canvasHeight,
    devicePixelRatio: snapshot.devicePixelRatio
  };
}

function formatTargetReport(
  label: string,
  report: PerformanceDiagnosticsTargetReport
): readonly string[] {
  return [
    `[${label}]`,
    `availability: ${report.availability}`,
    `liveFrameSourceTimestampFpsLatest: ${
      formatNullableNumber(report.liveFrameSourceTimestampFpsLatest)
    }`,
    `liveFrameMessageFps: ${
      formatNullableNumber(report.liveFrameMessageFps)
    }`,
    `liveFrameMessageCount: ${
      formatNullableInteger(report.liveFrameMessageCount)
    }`,
    `appliedLiveFrameFps: ${
      formatNullableNumber(report.appliedLiveFrameFps)
    }`,
    `appliedLiveFrameCount: ${
      formatNullableInteger(report.appliedLiveFrameCount)
    }`,
    `renderFps: ${formatNullableNumber(report.renderFps)}`,
    ...(label === "Browser Source"
      ? [
          `browserRafProbeFps: ${
            formatNullableNumber(report.browserRafProbeFps)
          }`,
          `browserRafProbeDeltaMs: ${
            formatMetricSummary(report.browserRafProbeDeltaMs)
          }`
        ]
      : []),
    `scheduledRafDeltaMs: ${formatMetricSummary(report.rafDeltaMs)}`,
    `renderDurationMs: ${formatMetricSummary(report.renderDurationMs)}`,
    `scheduledFrameDurationMs: ${
      formatMetricSummary(report.scheduledFrameDurationMs)
    }`,
    `renderCount: ${formatNullableInteger(report.renderCount)}`,
    `scheduledRenderCount: ${formatNullableInteger(report.scheduledRenderCount)}`,
    `immediateRenderCount: ${formatNullableInteger(report.immediateRenderCount)}`,
    `browserSourceClientCount: ${
      formatNullableInteger(report.browserSourceClientCount)
    }`,
    `stageMotionEnabled: ${
      report.stageMotionEnabled === null
        ? "unknown"
        : report.stageMotionEnabled ? "true" : "false"
    }`,
    `canvas: ${formatCanvas(report.canvas)}`,
    `scaffoldEvaluationCacheHitCount: ${
      formatNullableInteger(report.scaffoldEvaluationCacheHitCount)
    }`,
    `scaffoldEvaluationCacheMissCount: ${
      formatNullableInteger(report.scaffoldEvaluationCacheMissCount)
    }`,
    `scaffoldEvaluationCacheInvalidationCount: ${
      formatNullableInteger(report.scaffoldEvaluationCacheInvalidationCount)
    }`,
    `compiledEvaluatorFrameCount: ${
      formatNullableInteger(report.compiledEvaluatorFrameCount)
    }`,
    `compiledRenderFrameCount: ${
      formatNullableInteger(report.compiledRenderFrameCount)
    } scope=render-frame-fast-path`,
    `transientCompileCount: ${
      formatNullableInteger(report.transientCompileCount)
    }`,
    `transientInstanceCount: ${
      formatNullableInteger(report.transientInstanceCount)
    }`,
    `publicSnapshotMaterializationCount: ${
      formatNullableInteger(report.publicSnapshotMaterializationCount)
    } scope=fast-path-proof-public-snapshot-avoidance`,
    `runtimeModelInstanceCacheHitCount: ${
      formatNullableInteger(report.runtimeModelInstanceCacheHitCount)
    }`,
    `runtimeModelInstanceCacheMissCount: ${
      formatNullableInteger(report.runtimeModelInstanceCacheMissCount)
    }`,
    `runtimeModelInstanceCacheInvalidationCount: ${
      formatNullableInteger(
        report.runtimeModelInstanceCacheInvalidationCount
      )
    }`,
    `stageTransformMessageCount: ${
      formatNullableInteger(report.stageTransformMessageCount)
    }`,
    `stageViewTransformMessageCount: ${
      formatNullableInteger(report.stageViewTransformMessageCount)
    }`,
    `stageDisplayTransformMessageCount: ${
      formatNullableInteger(report.stageDisplayTransformMessageCount)
    }`,
    `duplicateTransformSkipCount: ${
      formatNullableInteger(report.duplicateTransformSkipCount)
    }`,
    `liveFramesPerAppliedFrame: ${
      formatNullableNumber(report.liveFramesPerAppliedFrame)
    }`,
    `coalescedLiveFramesPerAppliedFrame: ${
      formatNullableNumber(report.coalescedLiveFramesPerAppliedFrame)
    }`,
    `coalescedLiveFrameCount: ${
      formatNullableInteger(report.coalescedLiveFrameCount)
    }`
  ];
}

function formatCanvas(
  canvas: PerformanceDiagnosticsTargetReport["canvas"]
): string {
  if (canvas === null) {
    return "unknown";
  }

  return `${canvas.width}x${canvas.height} dpr=${formatNullableNumber(
    canvas.devicePixelRatio
  )}`;
}

function formatNullableInteger(value: number | null): string {
  return value === null ? "unknown" : String(Math.round(value));
}

function formatNullableNumber(value: number | null): string {
  if (value === null) {
    return "unknown";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatMetricSummary(
  summary: PerformanceDiagnosticsMetricSummary
): string {
  return [
    `samples=${summary.sampleCount}`,
    `p50=${formatNullableNumber(summary.p50)}`,
    `p95=${formatNullableNumber(summary.p95)}`,
    `max=${formatNullableNumber(summary.max)}`
  ].join(" ");
}

function isNonNull<TValue>(value: TValue | null): value is TValue {
  return value !== null;
}
