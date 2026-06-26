import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PerformanceDiagnosticsPage } from "./performance-diagnostics-page";
import {
  addPerformanceDiagnosticsCaptureSample,
  completePerformanceDiagnosticsCapture,
  createPerformanceDiagnosticsCaptureSample,
  createPerformanceDiagnosticsReport,
  formatPerformanceDiagnosticsReport,
  startPerformanceDiagnosticsCapture,
  type PerformanceDiagnosticsCaptureSample
} from "./performance-diagnostics-report";
import type {
  RuntimePlayerBrowserSourceStatus
} from "../preload/browser-source-status-contract";
import type {
  RuntimePlayerInputStatus
} from "../preload/input-bridge-contract";
import type {
  RuntimePlayerStageRenderMetricsSnapshot
} from "../preload/performance-diagnostics-contract";
import {
  runtimePlayerStageViewCoordinateSpace,
  runtimePlayerStageWindowTitle,
  type RuntimePlayerStageStateSnapshot
} from "../preload/runtime-player-bridge-contract";

describe("Performance Diagnostics report", () => {
  it("aggregates native Stage metrics with distinct source and render FPS", () => {
    const report = createPerformanceDiagnosticsReport({
      target: "native-stage",
      startedAtIso: "2026-06-25T01:00:00.000Z",
      endedAtIso: "2026-06-25T01:00:01.000Z",
      durationMs: 1000,
      requestedDurationMs: 1000,
      samples: [
        createSample({
          inputStatus: createInputStatus({
            packetCount: 100,
            estimatedFps: 59.8
          }),
          nativeStageMetrics: createMetrics({
            renderCount: 10,
            scheduledRenderCount: 8,
            immediateRenderCount: 2,
            liveFrameMessageCount: 10,
            stageViewTransformMessageCount: 2,
            stageDisplayTransformMessageCount: 3,
            duplicateTransformSkipCount: 1,
            coalescedLiveFrameCount: 2,
            rafDeltaSampleCount: 20,
            renderDurationSampleCount: 10
          })
        }),
        createSample({
          inputStatus: createInputStatus({
            packetCount: 130,
            estimatedFps: 59.8
          }),
          nativeStageMetrics: createMetrics({
            renderCount: 40,
            scheduledRenderCount: 38,
            immediateRenderCount: 2,
            liveFrameMessageCount: 40,
            stageViewTransformMessageCount: 5,
            stageDisplayTransformMessageCount: 8,
            duplicateTransformSkipCount: 3,
            coalescedLiveFrameCount: 5,
            lastRafDeltaMs: 16,
            rafDeltaSampleCount: 50,
            lastRenderDurationMs: 4,
            renderDurationSampleCount: 40,
            lastLiveRenderInputEvaluationDurationMs: 5,
            liveRenderInputEvaluationDurationSampleCount: 1,
            evaluationCacheHitCount: 1,
            evaluationCacheMissCount: 1,
            evaluationCacheInvalidationCount: 0,
            compiledEvaluatorFrameCount: 1,
            compiledRenderFrameCount: 1,
            transientCompileCount: 0,
            transientInstanceCount: 0,
            publicSnapshotMaterializationCount: 0,
            lastRuntimeCoreEvaluationDurationMs: 2,
            runtimeCoreEvaluationDurationSampleCount: 1,
            lastRuntimeCoreInputValidationDurationMs: 0.1,
            runtimeCoreInputValidationDurationSampleCount: 1,
            lastRuntimeCoreStateCompatibilityDurationMs: 0.2,
            runtimeCoreStateCompatibilityDurationSampleCount: 1,
            lastRuntimeCoreDynamicsEvaluationDurationMs: 0.3,
            runtimeCoreDynamicsEvaluationDurationSampleCount: 1,
            lastRuntimeCoreSnapshotCreationDurationMs: 1.5,
            runtimeCoreSnapshotCreationDurationSampleCount: 1,
            lastRuntimeCoreRenderFrameOutputDurationMs: 0.9,
            runtimeCoreRenderFrameOutputDurationSampleCount: 1,
            lastRuntimeCoreParameterResolutionDurationMs: 0.4,
            runtimeCoreParameterResolutionDurationSampleCount: 1,
            lastRuntimeCoreKeyformSamplingDurationMs: 0.5,
            runtimeCoreKeyformSamplingDurationSampleCount: 1,
            lastRuntimeCoreKeyformApplicationDurationMs: 0.6,
            runtimeCoreKeyformApplicationDurationSampleCount: 1,
            lastRuntimeCoreDeformerHierarchyEvaluationDurationMs: 0.7,
            runtimeCoreDeformerHierarchyEvaluationDurationSampleCount: 1,
            lastRuntimeCoreWarpDeformerVertexTransformDurationMs: 0.8,
            runtimeCoreWarpDeformerVertexTransformDurationSampleCount: 1,
            lastRuntimeCoreRotationDeformerVertexTransformDurationMs: 0.9,
            runtimeCoreRotationDeformerVertexTransformDurationSampleCount: 1,
            lastRuntimeCoreDrawableSnapshotCreationDurationMs: 1,
            runtimeCoreDrawableSnapshotCreationDurationSampleCount: 1,
            lastRuntimeCoreVisibilityDrawOrderEvaluationDurationMs: 1.1,
            runtimeCoreVisibilityDrawOrderEvaluationDurationSampleCount: 1,
            lastRuntimeCoreMaskEvaluationDurationMs: 1.2,
            runtimeCoreMaskEvaluationDurationSampleCount: 1,
            lastRuntimeCoreSnapshotValidationDurationMs: 1.3,
            runtimeCoreSnapshotValidationDurationSampleCount: 1,
            lastPoseEvaluationDurationMs: 3,
            poseEvaluationDurationSampleCount: 1,
            lastSnapshotToRenderDrawableDurationMs: 1,
            snapshotToRenderDrawableDurationSampleCount: 1,
            lastRenderInputSceneBuildDurationMs: 0.5,
            renderInputSceneBuildDurationSampleCount: 1,
            lastRenderInputScaffoldBuildDurationMs: 0,
            renderInputScaffoldBuildDurationSampleCount: 1,
            lastRenderInputClippingBuildDurationMs: 0,
            renderInputClippingBuildDurationSampleCount: 1,
            lastScheduledFrameDurationMs: 10,
            scheduledFrameDurationSampleCount: 1
          })
        }),
        createSample({
          inputStatus: createInputStatus({
            packetCount: 160,
            estimatedFps: 59.8
          }),
          nativeStageMetrics: createMetrics({
            renderCount: 70,
            scheduledRenderCount: 68,
            immediateRenderCount: 2,
            liveFrameMessageCount: 70,
            stageViewTransformMessageCount: 7,
            stageDisplayTransformMessageCount: 10,
            duplicateTransformSkipCount: 4,
            coalescedLiveFrameCount: 7,
            lastRafDeltaMs: 20,
            rafDeltaSampleCount: 80,
            lastRenderDurationMs: 7,
            renderDurationSampleCount: 70,
            lastLiveRenderInputEvaluationDurationMs: 8,
            liveRenderInputEvaluationDurationSampleCount: 2,
            evaluationCacheHitCount: 2,
            evaluationCacheMissCount: 1,
            evaluationCacheInvalidationCount: 0,
            compiledEvaluatorFrameCount: 2,
            compiledRenderFrameCount: 2,
            transientCompileCount: 0,
            transientInstanceCount: 0,
            publicSnapshotMaterializationCount: 0,
            lastRuntimeCoreEvaluationDurationMs: 4,
            runtimeCoreEvaluationDurationSampleCount: 2,
            lastRuntimeCoreInputValidationDurationMs: 0.2,
            runtimeCoreInputValidationDurationSampleCount: 2,
            lastRuntimeCoreStateCompatibilityDurationMs: 0.4,
            runtimeCoreStateCompatibilityDurationSampleCount: 2,
            lastRuntimeCoreDynamicsEvaluationDurationMs: 0.6,
            runtimeCoreDynamicsEvaluationDurationSampleCount: 2,
            lastRuntimeCoreSnapshotCreationDurationMs: 3,
            runtimeCoreSnapshotCreationDurationSampleCount: 2,
            lastRuntimeCoreRenderFrameOutputDurationMs: 1.8,
            runtimeCoreRenderFrameOutputDurationSampleCount: 2,
            lastRuntimeCoreParameterResolutionDurationMs: 0.8,
            runtimeCoreParameterResolutionDurationSampleCount: 2,
            lastRuntimeCoreKeyformSamplingDurationMs: 1,
            runtimeCoreKeyformSamplingDurationSampleCount: 2,
            lastRuntimeCoreKeyformApplicationDurationMs: 1.2,
            runtimeCoreKeyformApplicationDurationSampleCount: 2,
            lastRuntimeCoreDeformerHierarchyEvaluationDurationMs: 1.4,
            runtimeCoreDeformerHierarchyEvaluationDurationSampleCount: 2,
            lastRuntimeCoreWarpDeformerVertexTransformDurationMs: 1.6,
            runtimeCoreWarpDeformerVertexTransformDurationSampleCount: 2,
            lastRuntimeCoreRotationDeformerVertexTransformDurationMs: 1.8,
            runtimeCoreRotationDeformerVertexTransformDurationSampleCount: 2,
            lastRuntimeCoreDrawableSnapshotCreationDurationMs: 2,
            runtimeCoreDrawableSnapshotCreationDurationSampleCount: 2,
            lastRuntimeCoreVisibilityDrawOrderEvaluationDurationMs: 2.2,
            runtimeCoreVisibilityDrawOrderEvaluationDurationSampleCount: 2,
            lastRuntimeCoreMaskEvaluationDurationMs: 2.4,
            runtimeCoreMaskEvaluationDurationSampleCount: 2,
            lastRuntimeCoreSnapshotValidationDurationMs: 2.6,
            runtimeCoreSnapshotValidationDurationSampleCount: 2,
            lastPoseEvaluationDurationMs: 6,
            poseEvaluationDurationSampleCount: 2,
            lastSnapshotToRenderDrawableDurationMs: 2,
            snapshotToRenderDrawableDurationSampleCount: 2,
            lastRenderInputSceneBuildDurationMs: 1,
            renderInputSceneBuildDurationSampleCount: 2,
            lastRenderInputScaffoldBuildDurationMs: 0,
            renderInputScaffoldBuildDurationSampleCount: 2,
            lastRenderInputClippingBuildDurationMs: 0,
            renderInputClippingBuildDurationSampleCount: 2,
            lastScheduledFrameDurationMs: 18,
            scheduledFrameDurationSampleCount: 2,
            canvasWidth: 1920,
            canvasHeight: 1080,
            devicePixelRatio: 1.5
          })
        })
      ]
    });
    const reportText = formatPerformanceDiagnosticsReport(report);

    expect(report.input).toMatchObject({
      inputReceiveFpsLatest: 59.8,
      inputPacketCount: 60
    });
    expect(report.nativeStage).toMatchObject({
      availability: "available",
      liveFrameSourceTimestampFpsLatest: null,
      liveFrameMessageFps: 60,
      liveFrameMessageCount: 60,
      appliedLiveFrameFps: 2,
      appliedLiveFrameCount: 2,
      renderFps: 60,
      evaluationCacheHitCount: 2,
      evaluationCacheMissCount: 1,
      evaluationCacheInvalidationCount: 0,
      compiledEvaluatorFrameCount: 2,
      compiledRenderFrameCount: 2,
      transientCompileCount: 0,
      transientInstanceCount: 0,
      publicSnapshotMaterializationCount: 0,
      stageTransformMessageCount: 12,
      duplicateTransformSkipCount: 3,
      coalescedLiveFrameCount: 5,
      browserSourceClientCount: 0,
      stageMotionEnabled: false,
      canvas: {
        width: 1920,
        height: 1080,
        devicePixelRatio: 1.5
      }
    });
    expect(report.nativeStage.rafDeltaMs).toMatchObject({
      sampleCount: 2,
      p50: 16,
      p95: 20,
      max: 20
    });
    expect(report.nativeStage.renderDurationMs).toMatchObject({
      sampleCount: 2,
      p50: 4,
      p95: 7,
      max: 7
    });
    expect(report.nativeStage.liveRenderInputEvaluationDurationMs)
      .toMatchObject({
        sampleCount: 2,
        p50: 5,
        p95: 8,
        max: 8
      });
    expect(report.nativeStage.runtimeCoreEvaluationDurationMs).toMatchObject({
      sampleCount: 2,
      p50: 2,
      p95: 4,
      max: 4
    });
    expect(report.nativeStage.runtimeCoreRenderFrameOutputDurationMs)
      .toMatchObject({
        sampleCount: 2,
        p50: 0.9,
        p95: 1.8,
        max: 1.8
      });
    expect(report.nativeStage.runtimeCoreParameterResolutionDurationMs)
      .toMatchObject({
        sampleCount: 2,
        p50: 0.4,
        p95: 0.8,
        max: 0.8
      });
    expect(report.nativeStage.runtimeCoreDeformerHierarchyEvaluationDurationMs)
      .toMatchObject({
        sampleCount: 2,
        p50: 0.7,
        p95: 1.4,
        max: 1.4
      });
    expect(report.nativeStage.runtimeCoreWarpDeformerVertexTransformDurationMs)
      .toMatchObject({
        sampleCount: 2,
        p50: 0.8,
        p95: 1.6,
        max: 1.6
      });
    expect(report.nativeStage.runtimeCoreMaskEvaluationDurationMs)
      .toMatchObject({
        sampleCount: 2,
        p50: 1.2,
        p95: 2.4,
        max: 2.4
      });
    expect(report.nativeStage.runtimeCoreSnapshotValidationDurationMs)
      .toMatchObject({
        sampleCount: 2,
        p50: 1.3,
        p95: 2.6,
        max: 2.6
      });
    expect(report.nativeStage.poseEvaluationDurationMs).toMatchObject({
      sampleCount: 2,
      p50: 3,
      p95: 6,
      max: 6
    });
    expect(report.nativeStage.snapshotToRenderDrawableDurationMs)
      .toMatchObject({
        sampleCount: 2,
        p50: 1,
        p95: 2,
        max: 2
      });
    expect(report.nativeStage.renderInputSceneBuildDurationMs).toMatchObject({
      sampleCount: 2,
      p50: 0.5,
      p95: 1,
      max: 1
    });
    expect(report.nativeStage.renderInputScaffoldBuildDurationMs)
      .toMatchObject({
        sampleCount: 2,
        p50: 0,
        p95: 0,
        max: 0
      });
    expect(report.nativeStage.renderInputClippingBuildDurationMs)
      .toMatchObject({
        sampleCount: 2,
        p50: 0,
        p95: 0,
        max: 0
      });
    expect(report.nativeStage.scheduledFrameDurationMs).toMatchObject({
      sampleCount: 2,
      p50: 10,
      p95: 18,
      max: 18
    });
    expect(reportText).toContain("inputReceiveFpsLatest: 59.8");
    expect(reportText).toContain("inputPacketCount: 60");
    expect(reportText).toContain("liveFrameMessageFps: 60");
    expect(reportText).toContain("appliedLiveFrameFps: 2");
    expect(reportText).toContain("renderFps: 60");
    expect(reportText).toContain("liveRenderInputEvaluationDurationMs:");
    expect(reportText).toContain("evaluationCacheHitCount: 2");
    expect(reportText).toContain("evaluationCacheMissCount: 1");
    expect(reportText).toContain(
      "compiledRenderFrameCount: 2 scope=render-frame-fast-path"
    );
    expect(reportText).toContain(
      "publicSnapshotMaterializationCount: 0 scope=public-snapshot-path/deep-runtime-core-profile"
    );
    expect(reportText).toContain("runtimeCoreEvaluationDurationMs:");
    expect(reportText).toContain(
      "runtimeCoreRenderFrameOutputDurationMs: sampleCount=2 p50=0.9"
    );
    expect(reportText).toContain("runtimeCoreParameterResolutionDurationMs:");
    expect(reportText).toContain("runtimeCoreDeformerHierarchyEvaluationDurationMs:");
    expect(reportText).toContain("runtimeCoreWarpDeformerVertexTransformDurationMs:");
    expect(reportText).toContain("runtimeCoreMaskEvaluationDurationMs:");
    expect(reportText).toContain("runtimeCoreSnapshotValidationDurationMs:");
    expect(reportText).toContain("renderInputDrawableMappingDurationMs:");
    expect(reportText).toContain(
      "sourceField=snapshotToRenderDrawableDurationMs scope=renderer-input-mapping-not-public-snapshot-materialization"
    );
    expect(reportText).not.toContain("\nsnapshotToRenderDrawableDurationMs:");
    expect(reportText).toContain("renderInputSceneBuildDurationMs:");
    expect(reportText).toContain("renderInputClippingBuildDurationMs:");
    expect(reportText).toContain("scheduledFrameDurationMs:");
  });

  it("aggregates Browser Source renderer metrics when a client reports them", () => {
    const browserStart = createBrowserSourceStatus({
      connectedClientCount: 1,
      renderMetrics: createMetrics({
        renderCount: 4,
        liveFrameMessageCount: 4,
        liveRenderInputEvaluationDurationSampleCount: 4,
        rafDeltaSampleCount: 2,
        renderDurationSampleCount: 4,
        compiledEvaluatorFrameCount: 4,
        compiledRenderFrameCount: 4,
        transientCompileCount: 0,
        transientInstanceCount: 0,
        publicSnapshotMaterializationCount: 0,
        runtimeModelInstanceCacheHitCount: 3,
        runtimeModelInstanceCacheMissCount: 1,
        runtimeModelInstanceCacheInvalidationCount: 0,
        lastRuntimeModelCompileDurationMs: 5,
        runtimeModelCompileDurationSampleCount: 1
      }),
      sourceFps: 30
    });
    const browserEnd = createBrowserSourceStatus({
      connectedClientCount: 1,
      renderMetrics: createMetrics({
        renderCount: 34,
        scheduledRenderCount: 30,
        immediateRenderCount: 0,
        liveFrameMessageCount: 34,
        liveRenderInputEvaluationDurationSampleCount: 34,
        stageViewTransformMessageCount: 2,
        stageDisplayTransformMessageCount: 1,
        duplicateTransformSkipCount: 1,
        coalescedLiveFrameCount: 3,
        lastRafDeltaMs: 33,
        rafDeltaSampleCount: 32,
        lastRenderDurationMs: 6,
        renderDurationSampleCount: 34,
        lastLiveRenderInputEvaluationDurationMs: 4,
        compiledEvaluatorFrameCount: 34,
        compiledRenderFrameCount: 34,
        transientCompileCount: 0,
        transientInstanceCount: 0,
        publicSnapshotMaterializationCount: 0,
        runtimeModelInstanceCacheHitCount: 33,
        runtimeModelInstanceCacheMissCount: 1,
        runtimeModelInstanceCacheInvalidationCount: 0,
        lastRuntimeModelCompileDurationMs: 5,
        runtimeModelCompileDurationSampleCount: 1,
        lastScheduledFrameDurationMs: 14,
        scheduledFrameDurationSampleCount: 1
      }),
      sourceFps: 30
    });

    const report = createPerformanceDiagnosticsReport({
      target: "browser-source",
      startedAtIso: "2026-06-25T01:00:00.000Z",
      endedAtIso: "2026-06-25T01:00:01.000Z",
      durationMs: 1000,
      requestedDurationMs: 1000,
      samples: [
        createSample({ browserSourceStatus: browserStart }),
        createSample({ browserSourceStatus: browserEnd })
      ]
    });

    expect(report.nativeStage.availability).toBe("not-captured");
    expect(report.browserSource).toMatchObject({
      availability: "available",
      liveFrameSourceTimestampFpsLatest: 30,
      liveFrameMessageFps: 30,
      liveFrameMessageCount: 30,
      appliedLiveFrameFps: 30,
      appliedLiveFrameCount: 30,
      renderFps: 30,
      scaffoldEvaluationCacheHitCount: 0,
      scaffoldEvaluationCacheMissCount: 0,
      scaffoldEvaluationCacheInvalidationCount: 0,
      compiledEvaluatorFrameCount: 30,
      compiledRenderFrameCount: 30,
      transientCompileCount: 0,
      transientInstanceCount: 0,
      publicSnapshotMaterializationCount: 0,
      runtimeModelInstanceCacheHitCount: 30,
      runtimeModelInstanceCacheMissCount: 0,
      runtimeModelInstanceCacheInvalidationCount: 0,
      stageTransformMessageCount: 3,
      browserSourceClientCount: 1
    });
    expect(report.browserSource.runtimeModelCompileDurationMs)
      .toMatchObject({
        sampleCount: 1,
        latest: 5
      });
    expect(report.browserSource.liveRenderInputEvaluationDurationMs)
      .toMatchObject({
        sampleCount: 1,
        p50: 4,
        p95: 4,
        max: 4
      });
    expect(report.browserSource.scheduledFrameDurationMs).toMatchObject({
      sampleCount: 1,
      p50: 14,
      p95: 14,
      max: 14
    });
    expect(formatPerformanceDiagnosticsReport(report)).toContain(
      "compiledEvaluatorFrameCount: 30"
    );
    expect(formatPerformanceDiagnosticsReport(report)).toContain(
      "compiledRenderFrameCount: 30 scope=render-frame-fast-path"
    );
    expect(formatPerformanceDiagnosticsReport(report)).toContain(
      "transientCompileCount: 0"
    );
    expect(formatPerformanceDiagnosticsReport(report)).toContain(
      "publicSnapshotMaterializationCount: 0 scope=public-snapshot-path/deep-runtime-core-profile"
    );
    expect(formatPerformanceDiagnosticsReport(report)).toContain(
      "runtimeModelInstanceCacheHitCount: 30"
    );
    expect(formatPerformanceDiagnosticsReport(report)).toContain(
      "runtimeModelCompileDurationMs: scaffoldBuildSampleCount=1 latest=5 scope=scaffold-build-cold-path"
    );
  });

  it("separates Browser Source input delivery, applied frames, rendering, and source timestamp FPS", () => {
    const report = createPerformanceDiagnosticsReport({
      target: "browser-source",
      startedAtIso: "2026-06-25T01:00:00.000Z",
      endedAtIso: "2026-06-25T01:00:10.000Z",
      durationMs: 10000,
      requestedDurationMs: 10000,
      samples: [
        createSample({
          inputStatus: createInputStatus({
            packetCount: 2000,
            estimatedFps: 60
          }),
          browserSourceStatus: createBrowserSourceStatus({
            connectedClientCount: 1,
            sourceFps: 27,
            renderMetrics: createMetrics({
              renderCount: 400,
              scheduledRenderCount: 400,
              liveFrameMessageCount: 1200,
              liveRenderInputEvaluationDurationSampleCount: 400,
              coalescedLiveFrameCount: 600,
              renderDurationSampleCount: 400
            })
          })
        }),
        createSample({
          inputStatus: createInputStatus({
            packetCount: 2600,
            estimatedFps: 60
          }),
          browserSourceStatus: createBrowserSourceStatus({
            connectedClientCount: 1,
            sourceFps: 27,
            renderMetrics: createMetrics({
              renderCount: 496,
              scheduledRenderCount: 496,
              liveFrameMessageCount: 1798,
              liveRenderInputEvaluationDurationSampleCount: 496,
              coalescedLiveFrameCount: 1100,
              renderDurationSampleCount: 496
            })
          })
        })
      ]
    });
    const reportText = formatPerformanceDiagnosticsReport(report);

    expect(report.input).toMatchObject({
      inputReceiveFpsLatest: 60,
      inputPacketCount: 600
    });
    expect(report.browserSource).toMatchObject({
      availability: "available",
      liveFrameSourceTimestampFpsLatest: 27,
      liveFrameMessageFps: 59.8,
      liveFrameMessageCount: 598,
      appliedLiveFrameFps: 9.6,
      appliedLiveFrameCount: 96,
      renderFps: 9.6,
      renderCount: 96,
      coalescedLiveFrameCount: 500
    });
    expect(reportText).toContain("inputReceiveFpsLatest: 60");
    expect(reportText).toContain("inputPacketCount: 600");
    expect(reportText).toContain("liveFrameSourceTimestampFpsLatest: 27");
    expect(reportText).toContain("liveFrameMessageFps: 59.8");
    expect(reportText).toContain("liveFrameMessageCount: 598");
    expect(reportText).toContain("appliedLiveFrameFps: 9.6");
    expect(reportText).toContain("appliedLiveFrameCount: 96");
    expect(reportText).toContain("renderFps: 9.6");
    expect(reportText).toContain("renderCount: 96");
    expect(reportText).toContain("coalescedLiveFrameCount: 500");
    expect(reportText).not.toContain("sourceInputFps");
    expect(reportText).not.toContain("liveMessageCount:");
  });

  it("prints unknown deep runtime-core phase metrics when profiling is disabled", () => {
    const report = createPerformanceDiagnosticsReport({
      target: "native-stage",
      startedAtIso: "2026-06-25T01:00:00.000Z",
      endedAtIso: "2026-06-25T01:00:01.000Z",
      durationMs: 1000,
      requestedDurationMs: 1000,
      samples: [
        createSample({
          nativeStageMetrics: createMetrics({
            renderCount: 1,
            lastRuntimeCoreEvaluationDurationMs: 3,
            runtimeCoreEvaluationDurationSampleCount: 1
          })
        }),
        createSample({
          nativeStageMetrics: createMetrics({
            renderCount: 2,
            lastRuntimeCoreEvaluationDurationMs: 4,
            runtimeCoreEvaluationDurationSampleCount: 2
          })
        })
      ]
    });
    const reportText = formatPerformanceDiagnosticsReport(report);

    expect(report.nativeStage.runtimeCoreEvaluationDurationMs)
      .toMatchObject({
        sampleCount: 1,
        p50: 4
      });
    expect(report.nativeStage.runtimeCoreSnapshotCreationDurationMs)
      .toMatchObject({
        sampleCount: 0,
        p50: null,
        p95: null,
        max: null
      });
    expect(report.nativeStage.runtimeCoreRenderFrameOutputDurationMs)
      .toMatchObject({
        sampleCount: 0,
        p50: null,
        p95: null,
        max: null
      });
    expect(reportText).toContain(
      "runtimeCoreSnapshotCreationDurationMs: sampleCount=0 p50=unknown p95=unknown max=unknown scope=public-snapshot-path/deep-runtime-core-profile"
    );
    expect(reportText).toContain(
      "runtimeCoreRenderFrameOutputDurationMs: sampleCount=0 p50=unknown p95=unknown max=unknown scope=render-frame-fast-path/deep-runtime-core-profile"
    );
  });

  it("supports capture start, sample, and completion lifecycle", () => {
    const firstSample = createSample({
      nativeStageMetrics: createMetrics({ renderCount: 10 })
    });
    const draft = startPerformanceDiagnosticsCapture({
      target: "native-stage",
      startedAtIso: "2026-06-25T01:00:00.000Z",
      startedAtMs: 1000,
      requestedDurationMs: 10000,
      firstSample
    });
    const sampledDraft = addPerformanceDiagnosticsCaptureSample(
      draft,
      createSample({
        nativeStageMetrics: createMetrics({ renderCount: 20 })
      })
    );
    const report = completePerformanceDiagnosticsCapture({
      draft: sampledDraft,
      endedAtIso: "2026-06-25T01:00:10.000Z",
      endedAtMs: 11000,
      finalSample: createSample({
        nativeStageMetrics: createMetrics({ renderCount: 30 })
      })
    });

    expect(draft.samples).toHaveLength(1);
    expect(sampledDraft.samples).toHaveLength(2);
    expect(report.capture).toMatchObject({
      target: "native-stage",
      durationMs: 10000,
      requestedDurationMs: 10000,
      sampleCount: 3
    });
    expect(report.nativeStage.renderFps).toBe(2);
  });

  it("keeps copied report text free of tokens, raw frames, calibration internals, and private paths", () => {
    const unsafeSample = createSample({
      inputStatus: createInputStatus({
        packetCount: 10,
        diagnostics: {
          rawFrameSample: "rawFrame jawOpen-5 private",
          trackingFrame: { calibrationInternalsPayload: true } as never
        }
      }),
      nativeStageMetrics: createMetrics({ renderCount: 10 }),
      browserSourceStatus: createBrowserSourceStatus({
        browserSourceUrl:
          "http://127.0.0.1:49200/stage?token=token_fixture",
        renderMetrics: createMetrics({
          renderCount: 10,
          extraPrivatePath: "C:/exports/private.runtime-export"
        } as Partial<RuntimePlayerStageRenderMetricsSnapshot>),
        clientDiagnosticSource:
          "C:/exports/private.runtime-export/stage?token=token_fixture"
      })
    });
    const report = createPerformanceDiagnosticsReport({
      target: "both",
      startedAtIso: "2026-06-25T01:00:00.000Z",
      endedAtIso: "2026-06-25T01:00:01.000Z",
      durationMs: 1000,
      requestedDurationMs: 1000,
      samples: [
        unsafeSample,
        createSample({
          inputStatus: createInputStatus({ packetCount: 20 }),
          nativeStageMetrics: createMetrics({ renderCount: 20 }),
          browserSourceStatus: createBrowserSourceStatus({
            browserSourceUrl:
              "http://127.0.0.1:49200/stage?token=token_fixture",
            renderMetrics: createMetrics({ renderCount: 20 }),
            clientDiagnosticSource:
              "C:/exports/private.runtime-export/stage?token=token_fixture"
          })
        })
      ]
    });
    const reportText = formatPerformanceDiagnosticsReport(report);
    const storedSampleText = JSON.stringify(unsafeSample);

    expect(storedSampleText).not.toContain("token_fixture");
    expect(storedSampleText).not.toContain("jawOpen");
    expect(storedSampleText).not.toContain("rawFrame");
    expect(storedSampleText).not.toContain("calibrationInternalsPayload");
    expect(storedSampleText).not.toContain("C:/exports/private.runtime-export");
    expect(reportText).not.toContain("token_fixture");
    expect(reportText).not.toContain("jawOpen");
    expect(reportText).not.toContain("rawFrame");
    expect(reportText).not.toContain("calibrationInternalsPayload");
    expect(reportText).not.toContain("C:/exports/private.runtime-export");
    expect(reportText).toContain("Browser Source token");
    expect(reportText).toContain("private file paths");
  });
});

describe("PerformanceDiagnosticsPage", () => {
  it("renders empty native and Browser Source states clearly", () => {
    const markup = renderToStaticMarkup(
      createElement(PerformanceDiagnosticsPage, {
        inputStatus: null,
        stageState: createStageState(),
        nativeStageMetrics: null,
        browserSourceStatus: createBrowserSourceStatus({
          connectedClientCount: 0,
          renderMetrics: null
        }),
        onCopyReport: vi.fn()
      })
    );

    expect(markup).toContain("Performance Diagnostics Capture");
    expect(markup).toContain("Waiting for native Stage metrics");
    expect(markup).toContain("No Browser Source client connected");
    expect(markup).toContain("Input Receive FPS");
    expect(markup).toContain("Input Packet Count");
    expect(markup).toContain("Native Render FPS");
    expect(markup).toContain("Browser Render FPS");
    expect(markup).toContain("Browser Source Timestamp FPS");
    expect(markup).not.toContain(">Source FPS<");
    expect(markup).toContain("Copy Report");
    expect(markup).toContain("No capture report yet.");
  });
});

function createSample(
  input: {
    readonly capturedAtMs?: number;
    readonly inputStatus?: RuntimePlayerInputStatus | null;
    readonly stageState?: RuntimePlayerStageStateSnapshot | null;
    readonly nativeStageMetrics?: RuntimePlayerStageRenderMetricsSnapshot | null;
    readonly browserSourceStatus?: RuntimePlayerBrowserSourceStatus | null;
  } = {}
): PerformanceDiagnosticsCaptureSample {
  return createPerformanceDiagnosticsCaptureSample({
    capturedAtMs: input.capturedAtMs ?? 0,
    inputStatus: input.inputStatus ?? createInputStatus(),
    stageState: input.stageState ?? createStageState(),
    nativeStageMetrics: input.nativeStageMetrics ?? null,
    browserSourceStatus: input.browserSourceStatus ?? createBrowserSourceStatus()
  });
}

function createInputStatus(input: {
  readonly packetCount?: number;
  readonly estimatedFps?: number;
  readonly diagnostics?: RuntimePlayerInputStatus["diagnostics"];
} = {}): RuntimePlayerInputStatus {
  return {
    source: "ifacialmocap",
    sourceLabel: "iFacialMocap",
    transport: "udp",
    transportLabel: "UDP",
    receivePort: 49983,
    connectionState: "receiving",
    localIpCandidates: [],
    packetCount: input.packetCount ?? 0,
    estimatedFps: input.estimatedFps ?? 60,
    diagnostics: input.diagnostics ?? {}
  };
}

function createStageState(input: {
  readonly stageMotionEnabled?: boolean;
} = {}): RuntimePlayerStageStateSnapshot {
  return {
    stageWindow: {
      windowState: "created",
      bounds: {
        x: 10,
        y: 20,
        width: 1280,
        height: 720
      }
    },
    stageView: {
      renderStatus: {
        status: "ready",
        statusLabel: "Ready",
        message: "Stage ready",
        details: [],
        tone: "success",
        updatedAtIso: "2026-06-25T00:00:00.000Z"
      },
      transform: {
        zoomScale: 1,
        pan: { x: 0, y: 0 },
        coordinateSpace: runtimePlayerStageViewCoordinateSpace
      }
    },
    stageMotion: {
      settings: {
        enabled: input.stageMotionEnabled ?? false,
        horizontal: {
          strengthPx: 80,
          limitPx: 120,
          invert: false
        },
        scale: {
          strength: 0.06,
          limit: 0.1,
          invert: false
        },
        deadZone: 0.03,
        reaction: 8
      }
    },
    persistence: {
      status: "saved",
      statusLabel: "Saved",
      storageLabel: "window-state/runtime-player.json",
      updatedAtIso: "2026-06-25T00:00:00.000Z",
      warningMessages: []
    },
    capture: {
      arrangeModeEnabled: false,
      clickThroughEnabled: false,
      alwaysOnTopEnabled: false,
      windowTitle: runtimePlayerStageWindowTitle,
      background: "transparent",
      stageUi: "hidden"
    }
  };
}

function createBrowserSourceStatus(input: {
  readonly connectedClientCount?: number;
  readonly browserSourceUrl?: string | null;
  readonly renderMetrics?: RuntimePlayerStageRenderMetricsSnapshot | null;
  readonly sourceFps?: number | null;
  readonly clientDiagnosticSource?: string | null;
} = {}): RuntimePlayerBrowserSourceStatus {
  const connectedClientCount = input.connectedClientCount ?? 0;

  return {
    schemaVersion: "runtime-player-browser-source-status-v1",
    state: "running",
    statusLabel: "Browser Source server running",
    bindAddress: "127.0.0.1",
    port: 49200,
    browserSourceUrl: input.browserSourceUrl ??
      "http://127.0.0.1:49200/stage?token=token_fixture",
    connectedClientCount,
    runtimeExport: {
      state: "loaded",
      loaded: true,
      statusLabel: "Runtime Export loaded",
      loadedAtIso: "2026-06-25T00:00:00.000Z",
      summary: {
        modelDisplayName: "Fixture Model",
        packageId: "pkg_fixture",
        packageRevision: 1,
        drawableCount: 1,
        meshCount: 1,
        parameterCount: 1,
        maskCount: 0
      }
    },
    latestFrame: {
      sequence: 10,
      producedAtIso: "2026-06-25T00:00:01.000Z"
    },
    stageDisplayState: {
      stageWindow: {
        bounds: {
          x: 10,
          y: 20,
          width: 1280,
          height: 720
        }
      },
      stageView: {
        transform: {
          zoomScale: 1,
          pan: { x: 0, y: 0 },
          coordinateSpace: runtimePlayerStageViewCoordinateSpace
        }
      },
      updatedAtIso: "2026-06-25T00:00:00.000Z"
    },
    lastClientConnectedAtIso: connectedClientCount > 0
      ? "2026-06-25T00:00:00.000Z"
      : null,
    lastClientDisconnectedAtIso: null,
    lastClientHeartbeatAtIso: null,
    lastServerHeartbeatAtIso: null,
    latestRendererDiagnostics: connectedClientCount > 0
      ? {
          clientId: 1,
          receivedAtIso: "2026-06-25T00:00:01.000Z",
          webgl2Available: "available",
          runtimeExportLoaded: true,
          renderStatus: "rendering",
          message: null,
          fps: input.sourceFps ?? null,
          sourceFps: input.sourceFps ?? null,
          frameAgeMs: 12,
          renderMetrics: input.renderMetrics ?? null
        }
      : null,
    latestClientDiagnostic: {
      reportedAtIso: "2026-06-25T00:00:00.000Z",
      event: "module-entry-started",
      message: null,
      source: input.clientDiagnosticSource ?? null,
      line: null,
      column: null
    },
    requestDiagnostics: {
      lastStageRequest: null,
      lastAssetRequest: null,
      lastWsUpgradeRejected: null,
      lastWsConnectedAtIso: null,
      lastWsDisconnectedAtIso: null
    },
    errorMessage: null,
    updatedAtIso: "2026-06-25T00:00:01.000Z"
  };
}

function createMetrics(
  patch: Partial<RuntimePlayerStageRenderMetricsSnapshot> = {}
): RuntimePlayerStageRenderMetricsSnapshot {
  return {
    renderCount: 0,
    scheduledRenderCount: 0,
    immediateRenderCount: 0,
    liveFrameMessageCount: 0,
    stageViewTransformMessageCount: 0,
    stageDisplayTransformMessageCount: 0,
    duplicateTransformSkipCount: 0,
    coalescedLiveFrameCount: 0,
    lastRafDeltaMs: null,
    rafDeltaSampleCount: 0,
    lastRenderDurationMs: null,
    renderDurationSampleCount: 0,
    lastLiveRenderInputEvaluationDurationMs: null,
    liveRenderInputEvaluationDurationSampleCount: 0,
    evaluationCacheHitCount: 0,
    evaluationCacheMissCount: 0,
    evaluationCacheInvalidationCount: 0,
    lastRuntimeCoreEvaluationDurationMs: null,
    runtimeCoreEvaluationDurationSampleCount: 0,
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
    scheduledFrameDurationSampleCount: 0,
    canvasWidth: 1280,
    canvasHeight: 720,
    devicePixelRatio: 1,
    ...patch
  };
}
