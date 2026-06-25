export const runtimePlayerPerformanceDiagnosticsVersion =
  "runtime-player-performance-diagnostics-v1" as const;

export type RuntimePlayerStageRenderMetricsSnapshot = {
  readonly renderCount: number;
  readonly scheduledRenderCount: number;
  readonly immediateRenderCount: number;
  readonly liveFrameMessageCount: number;
  readonly stageViewTransformMessageCount: number;
  readonly stageDisplayTransformMessageCount: number;
  readonly duplicateTransformSkipCount: number;
  readonly coalescedLiveFrameCount: number;
  readonly lastRafDeltaMs: number | null;
  readonly rafDeltaSampleCount: number;
  readonly lastRenderDurationMs: number | null;
  readonly renderDurationSampleCount: number;
  readonly lastLiveRenderInputEvaluationDurationMs?: number | null;
  readonly liveRenderInputEvaluationDurationSampleCount?: number;
  readonly lastScheduledFrameDurationMs?: number | null;
  readonly scheduledFrameDurationSampleCount?: number;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly devicePixelRatio: number;
};
