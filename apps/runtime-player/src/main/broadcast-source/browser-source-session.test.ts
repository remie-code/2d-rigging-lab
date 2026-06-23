import { describe, expect, it } from "vitest";

import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import type {
  RuntimePlayerBrowserSourceStatus
} from "../../preload/browser-source-status-contract";
import {
  RuntimePlayerBrowserSourceSession,
  type BrowserSourceSessionClient,
  type BrowserSourceSessionTimers
} from "./browser-source-session";

describe("RuntimePlayerBrowserSourceSession status sampling", () => {
  it("samples live-frame status notifications while broadcasting every live frame", () => {
    let nowMs = 0;
    const timers = createManualTimers();
    const session = new RuntimePlayerBrowserSourceSession({
      token: "token_fixture",
      nowIso: () => `2026-06-23T01:00:${String(nowMs).padStart(2, "0")}.000Z`,
      nowMs: () => nowMs,
      timers,
      statusNotificationIntervalMs: 500
    });
    const notifications: RuntimePlayerBrowserSourceStatus[] = [];
    const client = createClient();

    session.onStatusChanged((status) => notifications.push(status));
    session.addClient(client);
    notifications.length = 0;
    client.messages.length = 0;

    nowMs = 10;
    session.publishLiveParameterFrame(createLiveParameterFrame(1));
    nowMs = 20;
    session.publishLiveParameterFrame(createLiveParameterFrame(2));
    nowMs = 30;
    session.publishLiveParameterFrame(createLiveParameterFrame(3));

    expect(client.messages.filter((message) =>
      message.type === "live-parameter-frame"
    )).toHaveLength(3);
    expect(notifications).toHaveLength(0);

    nowMs = 510;
    timers.runNext();

    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.latestFrame).toStrictEqual({
      sequence: 3,
      producedAtIso: "2026-06-23T01:00:03.000Z"
    });
  });

  it("keeps connect and disconnect transitions prompt even when sampled live status is pending", () => {
    let nowMs = 0;
    const timers = createManualTimers();
    const session = new RuntimePlayerBrowserSourceSession({
      token: "token_fixture",
      nowMs: () => nowMs,
      timers,
      statusNotificationIntervalMs: 500
    });
    const notifications: RuntimePlayerBrowserSourceStatus[] = [];

    session.onStatusChanged((status) => notifications.push(status));
    const clientId = session.addClient(createClient());

    expect(notifications.at(-1)?.connectedClientCount).toBe(1);

    nowMs = 10;
    session.publishLiveParameterFrame(createLiveParameterFrame(1));
    session.removeClient(clientId);

    expect(notifications.at(-1)?.connectedClientCount).toBe(0);
    expect(notifications.at(-1)?.lastClientDisconnectedAtIso).not.toBeNull();
  });

  it("samples unchanged renderer diagnostics but reports render errors immediately", () => {
    let nowMs = 0;
    const timers = createManualTimers();
    const session = new RuntimePlayerBrowserSourceSession({
      token: "token_fixture",
      nowMs: () => nowMs,
      timers,
      statusNotificationIntervalMs: 500
    });
    const notifications: RuntimePlayerBrowserSourceStatus[] = [];
    const clientId = session.addClient(createClient());

    session.onStatusChanged((status) => notifications.push(status));
    session.handleClientMessage(clientId, {
      type: "browser-source-renderer-diagnostics",
      webgl2Available: "available",
      runtimeExportLoaded: true,
      renderStatus: "rendering",
      message: null,
      fps: 60,
      frameAgeMs: 12
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.latestRendererDiagnostics).toMatchObject({
      renderStatus: "rendering",
      fps: 60
    });

    nowMs = 10;
    session.handleClientMessage(clientId, {
      type: "browser-source-renderer-diagnostics",
      webgl2Available: "available",
      runtimeExportLoaded: true,
      renderStatus: "rendering",
      message: null,
      fps: 59,
      frameAgeMs: 18
    });

    expect(notifications).toHaveLength(1);

    session.handleClientMessage(clientId, {
      type: "browser-source-renderer-diagnostics",
      webgl2Available: "available",
      runtimeExportLoaded: true,
      renderStatus: "error",
      message: "WebGL render failed.",
      fps: null,
      frameAgeMs: null
    });

    expect(notifications).toHaveLength(2);
    expect(notifications.at(-1)?.latestRendererDiagnostics).toMatchObject({
      renderStatus: "error",
      message: "WebGL render failed."
    });
  });
});

function createClient(): BrowserSourceSessionClient & {
  readonly messages: Array<Record<string, unknown>>;
} {
  const messages: Array<Record<string, unknown>> = [];
  return {
    messages,
    send: (message) => {
      messages.push(message as unknown as Record<string, unknown>);
    },
    close: () => undefined
  };
}

function createLiveParameterFrame(sequence: number): RuntimePlayerLiveParameterFrame {
  return {
    schemaVersion: "runtime-player-live-parameter-frame-v1",
    runtimeExport: {
      packageId: "pkg_fixture",
      packageRevision: 7,
      loadedAtIso: "2026-06-23T01:00:00.000Z"
    },
    sequence,
    producedAtIso: `2026-06-23T01:00:0${sequence}.000Z`,
    sourceFrameTimestampMs: 1000 + sequence * 16,
    parameterValues: {
      ParamAngleX: sequence
    }
  };
}

function createManualTimers(): BrowserSourceSessionTimers & {
  readonly runNext: () => void;
} {
  let nextHandle = 1;
  const timeouts = new Map<number, () => void>();

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
    runNext: () => {
      const entry = timeouts.entries().next().value;
      if (entry === undefined) {
        return;
      }

      const [handle, callback] = entry;
      timeouts.delete(handle);
      callback();
    }
  };
}
