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
      sourceInputFps: 59.8,
      liveMessageCount: 60
    });
    expect(report.nativeStage).toMatchObject({
      availability: "available",
      sourceInputFps: 59.8,
      renderFps: 60,
      liveMessageCount: 60,
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
    expect(report.nativeStage.scheduledFrameDurationMs).toMatchObject({
      sampleCount: 2,
      p50: 10,
      p95: 18,
      max: 18
    });
    expect(reportText).toContain("sourceInputFps: 59.8");
    expect(reportText).toContain("renderFps: 60");
    expect(reportText).toContain("liveRenderInputEvaluationDurationMs:");
    expect(reportText).toContain("scheduledFrameDurationMs:");
  });

  it("aggregates Browser Source renderer metrics when a client reports them", () => {
    const browserStart = createBrowserSourceStatus({
      connectedClientCount: 1,
      renderMetrics: createMetrics({
        renderCount: 4,
        liveFrameMessageCount: 4,
        rafDeltaSampleCount: 2,
        renderDurationSampleCount: 4
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
        stageViewTransformMessageCount: 2,
        stageDisplayTransformMessageCount: 1,
        duplicateTransformSkipCount: 1,
        coalescedLiveFrameCount: 3,
        lastRafDeltaMs: 33,
        rafDeltaSampleCount: 32,
        lastRenderDurationMs: 6,
        renderDurationSampleCount: 34,
        lastLiveRenderInputEvaluationDurationMs: 4,
        liveRenderInputEvaluationDurationSampleCount: 1,
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
      sourceInputFps: 30,
      renderFps: 30,
      liveMessageCount: 30,
      stageTransformMessageCount: 3,
      browserSourceClientCount: 1
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
    expect(markup).toContain("Source FPS");
    expect(markup).toContain("Render FPS");
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
    lastScheduledFrameDurationMs: null,
    scheduledFrameDurationSampleCount: 0,
    canvasWidth: 1280,
    canvasHeight: 720,
    devicePixelRatio: 1,
    ...patch
  };
}
