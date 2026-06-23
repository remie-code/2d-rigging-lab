import { describe, expect, it } from "vitest";

import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import type {
  RuntimePlayerBrowserSourceRuntimeExportPayload,
  RuntimePlayerBrowserSourceRuntimeExportResponse
} from "../../preload/browser-source-transport-contract";
import type {
  RuntimePlayerBrowserSourceStageViewTransform
} from "../../preload/browser-source-status-contract";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import {
  BrowserSourceStageClient,
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
    const requestedUrls: string[] = [];
    const client = new BrowserSourceStageClient({
      config: createConfig(),
      renderer,
      webgl2Available: "available",
      fetcher: createFetch(createLoadedResponse(), requestedUrls),
      webSocketFactory: sockets.factory,
      location: createLocation(),
      timers: createManualTimers(),
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
    expect(readLastDiagnostics(sockets.instances[0])).toMatchObject({
      webgl2Available: "available",
      runtimeExportLoaded: true,
      renderStatus: "rendering",
      frameAgeMs: 250
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

  setLiveParameterFrame(frame: RuntimePlayerLiveParameterFrame): void {
    this.frames.push(frame);
  }

  setViewTransform(transform: RuntimePlayerBrowserSourceStageViewTransform): void {
    this.transforms.push(transform);
  }

  clearLiveParameterFrame(): void {
    this.clearFrameCount += 1;
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
  return (socket?.sent ?? [])
    .map((message) => JSON.parse(message) as Record<string, unknown>)
    .filter((message) =>
      message.type === "browser-source-renderer-diagnostics"
    )
    .at(-1);
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
    runtimeExport: null
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

function createBrowserSourcePayload(): RuntimePlayerBrowserSourceRuntimeExportPayload {
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
      packageRevision: 7,
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
    loadedAtIso: "2026-06-23T01:00:00.000Z"
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
