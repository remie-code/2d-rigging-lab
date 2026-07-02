import { describe, expect, it } from "vitest";

import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import type {
  RuntimePlayerBrowserSourceRuntimeExportPayload,
  RuntimePlayerBrowserSourceRuntimeExportResponse
} from "../../preload/browser-source-transport-contract";
import type {
  RuntimePlayerBrowserSourceStageViewTransform
} from "../../preload/browser-source-status-contract";
import type {
  RuntimePlayerEffectiveDynamicsTuningProfile
} from "../../preload/dynamics-tuning-bridge-contract";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type {
  RuntimePlayerActiveVariantSelectionState
} from "../../preload/runtime-variant-bridge-contract";
import {
  BrowserSourceStageClient,
  type BrowserSourceAnimationFrames,
  type BrowserSourceStageClientFetch,
  type BrowserSourceStageClientTimers,
  type BrowserSourceWebSocketEventMap,
  type BrowserSourceWebSocketFactory,
  type BrowserSourceWebSocketLike
} from "./browser-source-stage-client";
import type { BrowserSourceStageRenderer } from "./browser-source-stage-renderer";

describe("BrowserSourceStageClient", () => {
  it("fetches the current payload, connects, requests resync, and applies live frames", async () => {
    const renderer = new FakeStageRenderer();
    const sockets = createFakeWebSocketFactory();
    const timers = createManualTimers();
    const requestedUrls: string[] = [];
    const client = new BrowserSourceStageClient({
      config: createConfig(),
      renderer,
      webgl2Available: "available",
      fetcher: createFetch(createLoadedResponse(), requestedUrls),
      webSocketFactory: sockets.factory,
      location: createLocation(),
      timers,
      nowIso: () => "2026-06-23T01:00:02.000Z",
      nowMs: () => Date.parse("2026-06-23T01:00:02.250Z")
    });

    client.start();
    sockets.instances[0]?.open();
    await flushAsync();

    expect(requestedUrls).toEqual([
      "http://127.0.0.1:49200/runtime-export/payload?token=test"
    ]);
    expect(sockets.instances[0]?.url).toBe(
      "ws://127.0.0.1:49200/ws?token=test"
    );
    expect(renderer.payloads).toHaveLength(1);
    expect(renderer.transforms).toEqual([createStageViewTransform()]);
    expect(readSentMessageTypes(sockets.instances[0])).toEqual(
      expect.arrayContaining([
        "browser-source-client-heartbeat",
        "browser-source-resync-request",
        "browser-source-renderer-diagnostics"
      ])
    );

    sockets.instances[0]?.message(JSON.stringify({
      type: "live-parameter-frame",
      protocolVersion: 1,
      sentAtIso: "2026-06-23T01:00:02.000Z",
      frame: createLiveParameterFrame({
        sequence: 43,
        sourceFrameTimestampMs: 1016,
        producedAtIso: "2026-06-23T01:00:02.000Z"
      })
    }));

    expect(renderer.frames).toHaveLength(1);
    expect(renderer.frames[0]?.parameterValues).toEqual({
      ParamAngleX: 12.5
    });
    timers.runTimeouts();
    expect(readLastDiagnostics(sockets.instances[0])).toMatchObject({
      webgl2Available: "available",
      runtimeExportLoaded: true,
      renderStatus: "rendering",
      sourceFps: null,
      frameAgeMs: 250,
      renderMetrics: {
        renderCount: 0,
        canvasWidth: 1280,
        canvasHeight: 720
      }
    });
  });

  it("reconnects and requests resync after a WebSocket close", () => {
    const timers = createManualTimers();
    const sockets = createFakeWebSocketFactory();
    const client = new BrowserSourceStageClient({
      config: createConfig(),
      renderer: new FakeStageRenderer(),
      webgl2Available: "available",
      fetcher: createFetch({ ...createNotLoadedResponse() }),
      webSocketFactory: sockets.factory,
      location: createLocation(),
      timers,
      reconnectDelayMs: 25,
      heartbeatIntervalMs: 0
    });

    client.start();
    sockets.instances[0]?.open();
    sockets.instances[0]?.close();

    expect(client.getSnapshot().connectionStatus).toBe("disconnected");

    timers.runTimeouts();
    expect(sockets.instances).toHaveLength(2);

    sockets.instances[1]?.open();
    expect(readSentMessageTypes(sockets.instances[1])).toContain(
      "browser-source-resync-request"
    );
  });

  it("reports client start and WebSocket attempt before opening the socket", () => {
    const sockets = createFakeWebSocketFactory();
    const events: string[] = [];
    const client = new BrowserSourceStageClient({
      config: createConfig(),
      renderer: new FakeStageRenderer(),
      webgl2Available: "available",
      fetcher: createFetch(createNotLoadedResponse()),
      webSocketFactory: sockets.factory,
      location: createLocation(),
      timers: createManualTimers(),
      heartbeatIntervalMs: 0,
      diagnosticReporter: (diagnostic) => {
        events.push(diagnostic.event);
      }
    });

    client.start();

    expect(events).toEqual([
      "client-start-called",
      "ws-open-attempt"
    ]);
    expect(sockets.instances[0]?.url).toBe(
      "ws://127.0.0.1:49200/ws?token=test"
    );
  });

  it("applies runtime resync payload with latest frame and handles live frame clear", () => {
    const renderer = new FakeStageRenderer();
    const client = new BrowserSourceStageClient({
      config: createConfig(),
      renderer,
      webgl2Available: "available",
      fetcher: createFetch(createNotLoadedResponse()),
      webSocketFactory: createFakeWebSocketFactory().factory,
      location: createLocation(),
      timers: createManualTimers(),
      heartbeatIntervalMs: 0
    });

    client.handleServerMessageData(JSON.stringify({
      type: "runtime-export-resync",
      protocolVersion: 1,
      runtimeExport: createBrowserSourcePayload(),
      runtimeExportStatus: createLoadedStatus(),
      stageDisplayState: createStageDisplayState({
        transform: createStageViewTransform({
          zoomScale: 1.75,
          pan: { x: 120, y: -64 }
        })
      }),
      activeVariantSelection: createActiveVariantSelection("var_smile"),
      latestFrame: createLiveParameterFrame({
        sequence: 44,
        sourceFrameTimestampMs: 1040,
        producedAtIso: "2026-06-23T01:00:03.000Z"
      }),
      sentAtIso: "2026-06-23T01:00:03.000Z"
    }));

    expect(renderer.payloads).toHaveLength(1);
    expect(renderer.transforms).toEqual([
      createStageViewTransform({
        zoomScale: 1.75,
        pan: { x: 120, y: -64 }
      })
    ]);
    expect(renderer.activeVariantSelections.at(-1)).toMatchObject({
      state: "ready",
      activeSelections: [
        {
          variantGroupId: "vgrp_expression",
          activeSelection: {
            kind: "singleSelect",
            variantId: "var_smile"
          }
        }
      ]
    });
    expect(renderer.frames).toHaveLength(1);
    expect(renderer.frames[0]).toMatchObject({
      sequence: 44,
      parameterValues: {
        ParamAngleX: 12.5
      }
    });
    expect(client.getSnapshot()).toMatchObject({
      runtimeExportLoaded: true,
      renderStatus: "rendering"
    });

    client.handleServerMessageData(JSON.stringify({
      type: "live-parameter-cleared",
      protocolVersion: 1,
      sentAtIso: "2026-06-23T01:00:04.000Z"
    }));

    expect(renderer.clearFrameCount).toBe(1);
    expect(client.getSnapshot()).toMatchObject({
      runtimeExportLoaded: true,
      renderStatus: "rendering",
      fps: null,
      frameAgeMs: null
    });
  });

  it("applies Stage display transform updates without making Browser Source interactive", () => {
    const renderer = new FakeStageRenderer();
    const client = new BrowserSourceStageClient({
      config: createConfig(),
      renderer,
      webgl2Available: "available",
      fetcher: createFetch(createNotLoadedResponse()),
      webSocketFactory: createFakeWebSocketFactory().factory,
      location: createLocation(),
      timers: createManualTimers(),
      heartbeatIntervalMs: 0
    });

    client.handleServerMessageData(JSON.stringify({
      type: "stage-display-state-changed",
      protocolVersion: 1,
      stageDisplayState: createStageDisplayState({
        transform: createStageViewTransform({
          zoomScale: 2.5,
          pan: { x: -48, y: 32 }
        })
      }),
      sentAtIso: "2026-06-23T01:00:05.000Z"
    }));

    expect(renderer.transforms).toEqual([
      createStageViewTransform({
        zoomScale: 2.5,
        pan: { x: -48, y: 32 }
      })
    ]);
    expect(renderer.payloads).toHaveLength(0);
    expect(renderer.frames).toHaveLength(0);
  });

  it("applies active Variant selection updates without reapplying Runtime Export payload", () => {
    const renderer = new FakeStageRenderer();
    const client = new BrowserSourceStageClient({
      config: createConfig(),
      renderer,
      webgl2Available: "available",
      fetcher: createFetch(createNotLoadedResponse()),
      webSocketFactory: createFakeWebSocketFactory().factory,
      location: createLocation(),
      timers: createManualTimers(),
      heartbeatIntervalMs: 0
    });

    client.handleServerMessageData(JSON.stringify({
      type: "runtime-export-resync",
      protocolVersion: 1,
      runtimeExport: createBrowserSourcePayload(),
      runtimeExportStatus: createLoadedStatus(),
      stageDisplayState: createStageDisplayState(),
      activeVariantSelection: createActiveVariantSelection(
        "var_expression_default"
      ),
      latestFrame: null,
      sentAtIso: "2026-06-23T01:00:03.000Z"
    }));
    client.handleServerMessageData(JSON.stringify({
      type: "active-variant-selection-changed",
      protocolVersion: 1,
      activeVariantSelection: createActiveVariantSelection("var_smile"),
      sentAtIso: "2026-06-23T01:00:04.000Z"
    }));

    expect(renderer.payloads).toHaveLength(1);
    expect(renderer.activeVariantSelections.map((selection) =>
      selection?.activeSelections[0]?.activeSelection
    )).toEqual([
      {
        kind: "singleSelect",
        variantId: "var_expression_default"
      },
      {
        kind: "singleSelect",
        variantId: "var_expression_default"
      },
      {
        kind: "singleSelect",
        variantId: "var_smile"
      }
    ]);
  });

  it("applies dynamics tuning updates without reapplying Runtime Export payload", () => {
    const renderer = new FakeStageRenderer();
    const client = new BrowserSourceStageClient({
      config: createConfig(),
      renderer,
      webgl2Available: "available",
      fetcher: createFetch(createNotLoadedResponse()),
      webSocketFactory: createFakeWebSocketFactory().factory,
      location: createLocation(),
      timers: createManualTimers(),
      heartbeatIntervalMs: 0
    });

    client.handleServerMessageData(JSON.stringify({
      type: "runtime-export-resync",
      protocolVersion: 1,
      runtimeExport: createBrowserSourcePayload(),
      runtimeExportStatus: createLoadedStatus(),
      stageDisplayState: createStageDisplayState(),
      activeVariantSelection: createActiveVariantSelection(),
      effectiveDynamicsTuning: createEffectiveDynamicsTuning(1),
      latestFrame: null,
      sentAtIso: "2026-06-23T01:00:03.000Z"
    }));
    client.handleServerMessageData(JSON.stringify({
      type: "dynamics-tuning-changed",
      protocolVersion: 1,
      effectiveDynamicsTuning: createEffectiveDynamicsTuning(2),
      sentAtIso: "2026-06-23T01:00:04.000Z"
    }));

    expect(renderer.payloads).toHaveLength(1);
    expect(renderer.dynamicsTuningProfiles.map((profile) =>
      profile?.revision ?? null
    )).toEqual([1, 1, 2]);
  });

  it("samples renderer diagnostics for live frames without throttling renderer frame application", async () => {
    const baseMs = Date.parse("2026-06-23T01:00:05.000Z");
    let nowMs = baseMs;
    const timers = createManualTimers();
    const sockets = createFakeWebSocketFactory();
    const renderer = new FakeStageRenderer();
    const client = new BrowserSourceStageClient({
      config: createConfig(),
      renderer,
      webgl2Available: "available",
      fetcher: createFetch(createNotLoadedResponse()),
      webSocketFactory: sockets.factory,
      location: createLocation(),
      timers,
      heartbeatIntervalMs: 0,
      diagnosticIntervalMs: 500,
      nowMs: () => nowMs
    });

    client.start();
    sockets.instances[0]?.open();
    await flushAsync();
    const initialDiagnosticsCount = readDiagnostics(sockets.instances[0]).length;

    nowMs = baseMs + 10;
    client.handleServerMessageData(JSON.stringify({
      type: "live-parameter-frame",
      protocolVersion: 1,
      frame: createLiveParameterFrame({
        sequence: 45,
        sourceFrameTimestampMs: 1050,
        producedAtIso: "2026-06-23T01:00:05.000Z"
      }),
      sentAtIso: "2026-06-23T01:00:05.000Z"
    }));
    nowMs = baseMs + 20;
    client.handleServerMessageData(JSON.stringify({
      type: "live-parameter-frame",
      protocolVersion: 1,
      frame: createLiveParameterFrame({
        sequence: 46,
        sourceFrameTimestampMs: 1066,
        producedAtIso: "2026-06-23T01:00:05.016Z"
      }),
      sentAtIso: "2026-06-23T01:00:05.016Z"
    }));

    expect(renderer.frames).toHaveLength(2);
    expect(readDiagnostics(sockets.instances[0])).toHaveLength(
      initialDiagnosticsCount
    );

    nowMs = baseMs + 520;
    timers.runTimeouts();

    expect(readDiagnostics(sockets.instances[0])).toHaveLength(
      initialDiagnosticsCount + 1
    );
    expect(readLastDiagnostics(sockets.instances[0])).toMatchObject({
      frameAgeMs: 504
    });
  });

  it("reports independent rAF probe metrics without live frames", async () => {
    const timers = createManualTimers();
    const animationFrames = createManualAnimationFrames();
    const sockets = createFakeWebSocketFactory();
    const renderer = new FakeStageRenderer();
    const client = new BrowserSourceStageClient({
      config: createConfig(),
      renderer,
      webgl2Available: "available",
      fetcher: createFetch(createNotLoadedResponse()),
      webSocketFactory: sockets.factory,
      location: createLocation(),
      timers,
      animationFrames,
      heartbeatIntervalMs: 1000
    });

    client.start();
    sockets.instances[0]?.open();
    await flushAsync();

    animationFrames.runNext(100);
    animationFrames.runNext(116);
    animationFrames.runNext(132);
    timers.runIntervals();

    expect(renderer.frames).toHaveLength(0);
    expect(readLastDiagnostics(sockets.instances[0])).toMatchObject({
      renderMetrics: {
        browserRafProbeFrameCount: 3,
        lastBrowserRafProbeDeltaMs: 16,
        browserRafProbeDeltaSampleCount: 2
      }
    });

    client.stop();

    expect(animationFrames.pendingCount()).toBe(0);
  });

  it("deduplicates identical Runtime Export payload application but applies replacement identities", () => {
    const renderer = new FakeStageRenderer();
    const client = new BrowserSourceStageClient({
      config: createConfig(),
      renderer,
      webgl2Available: "available",
      fetcher: createFetch(createNotLoadedResponse()),
      webSocketFactory: createFakeWebSocketFactory().factory,
      location: createLocation(),
      timers: createManualTimers(),
      heartbeatIntervalMs: 0
    });
    const runtimeExport = createBrowserSourcePayload();

    client.handleServerMessageData(JSON.stringify({
      type: "runtime-export-resync",
      protocolVersion: 1,
      runtimeExport,
      runtimeExportStatus: createLoadedStatus(),
      stageDisplayState: createStageDisplayState(),
      activeVariantSelection: createActiveVariantSelection(),
      latestFrame: null,
      sentAtIso: "2026-06-23T01:00:03.000Z"
    }));
    client.handleServerMessageData(JSON.stringify({
      type: "runtime-export-resync",
      protocolVersion: 1,
      runtimeExport,
      runtimeExportStatus: createLoadedStatus(),
      stageDisplayState: createStageDisplayState(),
      activeVariantSelection: createActiveVariantSelection(),
      latestFrame: null,
      sentAtIso: "2026-06-23T01:00:04.000Z"
    }));

    expect(renderer.payloads).toHaveLength(1);
    expect(client.getSnapshot().runtimeExportApplyCount).toBe(1);

    client.handleServerMessageData(JSON.stringify({
      type: "runtime-export-changed",
      protocolVersion: 1,
      runtimeExport: createBrowserSourcePayload({
        packageRevision: 8,
        loadedAtIso: "2026-06-23T01:01:00.000Z"
      }),
      runtimeExportStatus: createLoadedStatus(),
      activeVariantSelection: createActiveVariantSelection(),
      sentAtIso: "2026-06-23T01:01:00.000Z"
    }));

    expect(renderer.payloads).toHaveLength(2);
    expect(client.getSnapshot().runtimeExportApplyCount).toBe(2);
  });

  it("reports WebGL2 unavailable when no renderer can be created", async () => {
    const sockets = createFakeWebSocketFactory();
    const client = new BrowserSourceStageClient({
      config: createConfig(),
      renderer: null,
      webgl2Available: "unavailable",
      initialMessage: "Stage WebGL2 context is unavailable.",
      fetcher: createFetch(createLoadedResponse()),
      webSocketFactory: sockets.factory,
      location: createLocation(),
      timers: createManualTimers(),
      heartbeatIntervalMs: 0
    });

    client.start();
    sockets.instances[0]?.open();
    await flushAsync();

    expect(client.getSnapshot()).toMatchObject({
      webgl2Available: "unavailable",
      runtimeExportLoaded: false,
      renderStatus: "error"
    });
    expect(readLastDiagnostics(sockets.instances[0])).toMatchObject({
      webgl2Available: "unavailable",
      runtimeExportLoaded: false,
      renderStatus: "error",
      message: "Stage WebGL2 context is unavailable."
    });
  });
});

class FakeStageRenderer implements BrowserSourceStageRenderer {
  readonly payloads: RuntimeExportLoadedPayload[] = [];
  readonly frames: RuntimePlayerLiveParameterFrame[] = [];
  readonly transforms: RuntimePlayerBrowserSourceStageViewTransform[] = [];
  readonly activeVariantSelections: Array<RuntimePlayerActiveVariantSelectionState | null> = [];
  readonly dynamicsTuningProfiles: Array<RuntimePlayerEffectiveDynamicsTuningProfile | null> = [];
  clearCount = 0;
  clearFrameCount = 0;
  disposed = false;

  setPayload(payload: RuntimeExportLoadedPayload): {
    readonly runtimeDiagnosticDetails: readonly string[];
  } {
    this.payloads.push(payload);
    return {
      runtimeDiagnosticDetails: []
    };
  }

  setActiveVariantSelection(
    activeVariantSelection: RuntimePlayerActiveVariantSelectionState | null
  ): void {
    this.activeVariantSelections.push(activeVariantSelection);
  }

  setDynamicsTuning(
    effectiveDynamicsTuning: RuntimePlayerEffectiveDynamicsTuningProfile | null
  ): void {
    this.dynamicsTuningProfiles.push(effectiveDynamicsTuning);
  }

  setLiveParameterFrame(frame: RuntimePlayerLiveParameterFrame): void {
    this.frames.push(frame);
  }

  setViewTransform(transform: RuntimePlayerBrowserSourceStageViewTransform): void {
    this.transforms.push(transform);
  }

  clearLiveParameterFrame(): void {
    this.clearFrameCount += 1;
  }

  getRenderMetricsSnapshot() {
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
      canvasWidth: 1280,
      canvasHeight: 720,
      devicePixelRatio: 1
    };
  }

  clear(): void {
    this.clearCount += 1;
  }

  dispose(): void {
    this.disposed = true;
  }
}

class FakeWebSocket implements BrowserSourceWebSocketLike {
  readonly sent: string[] = [];
  readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(readonly url: string) {}

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.emit("close", {});
  }

  open(): void {
    this.emit("open", {});
  }

  message(data: string): void {
    this.emit("message", { data });
  }

  addEventListener<TKey extends keyof BrowserSourceWebSocketEventMap>(
    type: TKey,
    listener: (event: BrowserSourceWebSocketEventMap[TKey]) => void
  ): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener as (event: unknown) => void);
    this.listeners.set(type, listeners);
  }

  removeEventListener<TKey extends keyof BrowserSourceWebSocketEventMap>(
    type: TKey,
    listener: (event: BrowserSourceWebSocketEventMap[TKey]) => void
  ): void {
    this.listeners.get(type)?.delete(listener as (event: unknown) => void);
  }

  private emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

function createFakeWebSocketFactory(): {
  readonly instances: FakeWebSocket[];
  readonly factory: BrowserSourceWebSocketFactory;
} {
  const instances: FakeWebSocket[] = [];
  return {
    instances,
    factory: (url) => {
      const socket = new FakeWebSocket(url);
      instances.push(socket);
      return socket;
    }
  };
}

function createManualTimers(): BrowserSourceStageClientTimers & {
  readonly runTimeouts: () => void;
  readonly runIntervals: () => void;
} {
  let nextHandle = 1;
  const timeouts = new Map<number, () => void>();
  const intervals = new Map<number, () => void>();

  return {
    setTimeout: (callback) => {
      const handle = nextHandle;
      nextHandle += 1;
      timeouts.set(handle, callback);
      return handle;
    },
    clearTimeout: (handle) => {
      timeouts.delete(Number(handle));
    },
    setInterval: (callback) => {
      const handle = nextHandle;
      nextHandle += 1;
      intervals.set(handle, callback);
      return handle;
    },
    clearInterval: (handle) => {
      intervals.delete(Number(handle));
    },
    runTimeouts: () => {
      const callbacks = [...timeouts.values()];
      timeouts.clear();
      for (const callback of callbacks) {
        callback();
      }
    },
    runIntervals: () => {
      for (const callback of intervals.values()) {
        callback();
      }
    }
  };
}

function createManualAnimationFrames(): BrowserSourceAnimationFrames & {
  readonly runNext: (timestampMs: number) => void;
  readonly pendingCount: () => number;
} {
  let nextHandle = 1;
  const callbacks = new Map<number, (timestampMs: number) => void>();

  return {
    requestAnimationFrame: (callback) => {
      const handle = nextHandle;
      nextHandle += 1;
      callbacks.set(handle, callback);
      return handle;
    },
    cancelAnimationFrame: (handle) => {
      callbacks.delete(handle);
    },
    runNext: (timestampMs) => {
      const entry = callbacks.entries().next().value;
      if (entry === undefined) {
        throw new Error("Expected a pending rAF probe callback.");
      }

      const [handle, callback] = entry;
      callbacks.delete(handle);
      callback(timestampMs);
    },
    pendingCount: () => callbacks.size
  };
}

function createFetch(
  response: RuntimePlayerBrowserSourceRuntimeExportResponse,
  requestedUrls: string[] = []
): BrowserSourceStageClientFetch {
  return async (url) => {
    requestedUrls.push(url);
    return {
      ok: true,
      json: async () => response
    };
  };
}

function readSentMessageTypes(
  socket: FakeWebSocket | undefined
): readonly string[] {
  return (socket?.sent ?? []).map((message) =>
    JSON.parse(message).type as string
  );
}

function readLastDiagnostics(
  socket: FakeWebSocket | undefined
): Record<string, unknown> | undefined {
  return readDiagnostics(socket)
    .at(-1);
}

function readDiagnostics(
  socket: FakeWebSocket | undefined
): Array<Record<string, unknown>> {
  return (socket?.sent ?? [])
    .map((message) => JSON.parse(message) as Record<string, unknown>)
    .filter((message) =>
      message.type === "browser-source-renderer-diagnostics"
    );
}

function createConfig() {
  return {
    protocolVersion: 1,
    webSocketPath: "/ws?token=test",
    runtimeExportStatusPath: "/runtime-export/status?token=test",
    runtimeExportPayloadPath: "/runtime-export/payload?token=test",
    clientDiagnosticsPath: "/browser-source/client-diagnostics?token=test"
  } as const;
}

function createLocation() {
  return {
    origin: "http://127.0.0.1:49200",
    protocol: "http:"
  };
}

function createLoadedResponse(): RuntimePlayerBrowserSourceRuntimeExportResponse {
  return {
    status: "loaded",
    runtimeExportStatus: createLoadedStatus(),
    stageDisplayState: createStageDisplayState(),
    activeVariantSelection: createActiveVariantSelection(),
    effectiveDynamicsTuning: null,
    runtimeExport: createBrowserSourcePayload()
  };
}

function createNotLoadedResponse(): RuntimePlayerBrowserSourceRuntimeExportResponse {
  return {
    status: "not-loaded",
    runtimeExportStatus: {
      state: "empty",
      loaded: false,
      statusLabel: "No model",
      loadedAtIso: null,
      summary: null
    },
    stageDisplayState: createStageDisplayState(),
    activeVariantSelection: createDisabledActiveVariantSelection(),
    effectiveDynamicsTuning: null,
    runtimeExport: null
  };
}

function createActiveVariantSelection(
  variantId = "var_expression_default"
): RuntimePlayerActiveVariantSelectionState {
  return {
    schemaVersion: "runtime-player-active-variant-selection-v1",
    state: "ready",
    updatedAtIso: "2026-06-23T01:00:00.000Z",
    activeSelections: [
      {
        variantGroupId: "vgrp_expression",
        activeSelection: {
          kind: "singleSelect",
          variantId
        }
      }
    ]
  };
}

function createEffectiveDynamicsTuning(
  revision: number
): RuntimePlayerEffectiveDynamicsTuningProfile {
  return {
    schemaVersion: "runtime-player-effective-dynamics-tuning-v1",
    revision,
    fingerprint: "fingerprint_fixture",
    updatedAtIso: "2026-06-23T01:00:00.000Z",
    exportIdentity: {
      packageId: "pkg_fixture",
      packageRevision: 7,
      packageHash: "package_hash_fixture",
      parameterSignatureHash: "parameter_signature_fixture"
    },
    dynamicsSignatureHash: "dynamics_signature_fixture",
    groups: {
      dyn_head: {
        enabled: true,
        strength: revision,
        limit: 30,
        length: 1,
        sway: 0.25,
        reactionSpeed: 0.4,
        convergenceSpeed: 0.7
      }
    }
  };
}

function createDisabledActiveVariantSelection(): RuntimePlayerActiveVariantSelectionState {
  return {
    schemaVersion: "runtime-player-active-variant-selection-v1",
    state: "disabled",
    updatedAtIso: null,
    activeSelections: []
  };
}

function createLoadedStatus() {
  return {
    state: "loaded",
    loaded: true,
    statusLabel: "Model loaded",
    loadedAtIso: "2026-06-23T01:00:00.000Z",
    summary: {
      modelDisplayName: "Fixture Model",
      packageId: "pkg_fixture",
      packageRevision: 7,
      drawableCount: 1,
      meshCount: 1,
      parameterCount: 1,
      maskCount: 0
    }
  } as const;
}

function createBrowserSourcePayload(input: {
  readonly packageRevision?: number;
  readonly loadedAtIso?: string;
} = {}): RuntimePlayerBrowserSourceRuntimeExportPayload {
  const packageRevision = input.packageRevision ?? 7;
  const loadedAtIso = input.loadedAtIso ?? "2026-06-23T01:00:00.000Z";

  return {
    schemaVersion: "runtime-player-browser-source-runtime-export-v1",
    artifacts: {
      manifest: {},
      model: {},
      atlas: {}
    } as RuntimePlayerBrowserSourceRuntimeExportPayload["artifacts"],
    texturePage: {
      metadata: {
        pageId: "atlas_page_0",
        path: "assets/textures/atlas_page_0.raw-rgba",
        width: 1,
        height: 1,
        pixelFormat: "rgba8",
        byteLength: 4
      } as RuntimePlayerBrowserSourceRuntimeExportPayload["texturePage"]["metadata"],
      encoding: "base64",
      bytesBase64: "AQIDBA==",
      byteLength: 4
    },
    summary: {
      modelDisplayName: "Fixture Model",
      packageId: "pkg_fixture",
      packageRevision,
      drawableCount: 1,
      meshCount: 1,
      parameterCount: 1,
      maskCount: 0,
      texturePage: {
        pageId: "atlas_page_0",
        path: "assets/textures/atlas_page_0.raw-rgba",
        width: 1,
        height: 1,
        pixelFormat: "rgba8",
        byteLength: 4
      },
      requiredCapabilities: []
    },
    loadedAtIso
  };
}

function createStageDisplayState(input: {
  readonly transform?: RuntimePlayerBrowserSourceStageViewTransform | null;
} = {}) {
  return {
    stageWindow: {
      bounds: {
        x: 100,
        y: 80,
        width: 1280,
        height: 720
      }
    },
    stageView: {
      transform: input.transform === undefined
        ? createStageViewTransform()
        : input.transform
    },
    updatedAtIso: "2026-06-23T01:00:00.500Z"
  } as const;
}

function createStageViewTransform(input: {
  readonly zoomScale?: number;
  readonly pan?: RuntimePlayerBrowserSourceStageViewTransform["pan"];
} = {}): RuntimePlayerBrowserSourceStageViewTransform {
  return {
    zoomScale: input.zoomScale ?? 1.25,
    pan: input.pan ?? {
      x: 16,
      y: -20
    },
    coordinateSpace: "stage-viewport-px-v1"
  };
}

function createLiveParameterFrame(input: {
  readonly sequence: number;
  readonly sourceFrameTimestampMs: number;
  readonly producedAtIso: string;
}): RuntimePlayerLiveParameterFrame {
  return {
    schemaVersion: "runtime-player-live-parameter-frame-v1",
    runtimeExport: {
      packageId: "pkg_fixture",
      packageRevision: 7,
      loadedAtIso: "2026-06-23T01:00:00.000Z"
    },
    sequence: input.sequence,
    producedAtIso: input.producedAtIso,
    sourceFrameTimestampMs: input.sourceFrameTimestampMs,
    parameterValues: {
      ParamAngleX: 12.5
    }
  };
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
