import { describe, expect, it } from "vitest";

import type {
  RuntimePlayerStageRenderMetricsSnapshot
} from "../../preload/performance-diagnostics-contract";
import { readBrowserSourceClientMessage } from "./browser-source-client-message";

describe("readBrowserSourceClientMessage", () => {
  it("accepts Browser Source diagnostics with safe render metrics", () => {
    const message = readBrowserSourceClientMessage(
      createRendererDiagnosticsMessage(createMetrics())
    );

    expect(message).toMatchObject({
      type: "browser-source-renderer-diagnostics",
      sourceFps: 60,
      renderMetrics: createMetrics()
    });
  });

  it.each([
    ["negative count", { renderCount: -1 }],
    ["non-integer count", { renderCount: 1.5 }],
    ["negative sample count", { rafDeltaSampleCount: -1 }],
    ["non-integer sample count", { renderDurationSampleCount: 2.25 }],
    ["negative canvas", { canvasWidth: -1 }],
    ["non-integer canvas", { canvasHeight: 720.5 }],
    ["invalid device pixel ratio", { devicePixelRatio: 0 }],
    ["malformed nested renderMetrics", { renderMetrics: createMetrics() }]
  ])("drops malformed Browser Source render metrics: %s", (_label, patch) => {
    const renderMetrics =
      "renderMetrics" in patch
        ? patch
        : {
            ...createMetrics(),
            ...patch
          };
    const message = readBrowserSourceClientMessage(
      createRendererDiagnosticsMessage(renderMetrics)
    );

    expect(message).toMatchObject({
      type: "browser-source-renderer-diagnostics",
      renderMetrics: null
    });
  });

  it("drops non-finite Browser Source diagnostics values parsed from JSON", () => {
    const message = readBrowserSourceClientMessage(`{
      "type": "browser-source-renderer-diagnostics",
      "webgl2Available": "available",
      "runtimeExportLoaded": true,
      "renderStatus": "rendering",
      "fps": 1e999,
      "sourceFps": 1e999,
      "frameAgeMs": 1e999,
      "renderMetrics": {
        "renderCount": 1,
        "scheduledRenderCount": 1,
        "immediateRenderCount": 0,
        "liveFrameMessageCount": 1,
        "stageViewTransformMessageCount": 0,
        "stageDisplayTransformMessageCount": 0,
        "duplicateTransformSkipCount": 0,
        "coalescedLiveFrameCount": 0,
        "lastRafDeltaMs": 1e999,
        "rafDeltaSampleCount": 1,
        "lastRenderDurationMs": 4,
        "renderDurationSampleCount": 1,
        "canvasWidth": 1280,
        "canvasHeight": 720,
        "devicePixelRatio": 1
      }
    }`);

    expect(message).toMatchObject({
      type: "browser-source-renderer-diagnostics",
      fps: null,
      sourceFps: null,
      frameAgeMs: null,
      renderMetrics: null
    });
  });

  it("strips unknown unsafe render metrics fields from Browser Source diagnostics", () => {
    const message = readBrowserSourceClientMessage(
      createRendererDiagnosticsMessage({
        ...createMetrics(),
        token: "token_fixture",
        privatePath: "C:/private/runtime-export.json"
      })
    );

    expect(message?.type).toBe("browser-source-renderer-diagnostics");
    expect(JSON.stringify(message)).not.toContain("token_fixture");
    expect(JSON.stringify(message)).not.toContain("C:/private");
  });
});

function createRendererDiagnosticsMessage(renderMetrics: unknown): string {
  return JSON.stringify({
    type: "browser-source-renderer-diagnostics",
    webgl2Available: "available",
    runtimeExportLoaded: true,
    renderStatus: "rendering",
    fps: 60,
    sourceFps: 60,
    frameAgeMs: 12,
    renderMetrics
  });
}

function createMetrics(
  patch: Partial<RuntimePlayerStageRenderMetricsSnapshot> = {}
): RuntimePlayerStageRenderMetricsSnapshot {
  return {
    renderCount: 1,
    scheduledRenderCount: 1,
    immediateRenderCount: 0,
    liveFrameMessageCount: 1,
    stageViewTransformMessageCount: 0,
    stageDisplayTransformMessageCount: 0,
    duplicateTransformSkipCount: 0,
    coalescedLiveFrameCount: 0,
    lastRafDeltaMs: 16,
    rafDeltaSampleCount: 1,
    browserRafProbeFrameCount: 3,
    lastBrowserRafProbeDeltaMs: 16,
    browserRafProbeDeltaSampleCount: 2,
    lastRenderDurationMs: 4,
    renderDurationSampleCount: 1,
    canvasWidth: 1280,
    canvasHeight: 720,
    devicePixelRatio: 1,
    ...patch
  };
}
