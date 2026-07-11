import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  ipcMainHandle: vi.fn()
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: electronMocks.ipcMainHandle
  }
}));

import { channelBridgeChannels } from "../preload/channel-bridge-channels";
import type {
  RuntimePlayerControlChannelActionResult,
  RuntimePlayerControlChannelStatus
} from "../preload/channel-bridge-contract";
import {
  registerControlChannelBridgeHandlers,
  runtimePlayerControlChannelMaxRecentEvents
} from "./channel-bridge-handlers";
import type {
  RuntimePlayerControlChannelServer,
  RuntimePlayerControlChannelServerEvent,
  RuntimePlayerControlChannelServerEventListener,
  RuntimePlayerControlChannelServerState,
  RuntimePlayerControlChannelServerStateListener
} from "./control-channel/channel-server";
import { RuntimePlayerControlChannelOverlayStore } from "./control-channel/control-channel-overlay-store";
import type { RuntimePlayerWindowSet } from "./window-management/runtime-player-windows";

const TEST_TOKEN = "channel_token_fixture_1234567890ab";
const FIXED_NOW_MS = 10_000;
const FIXED_NOW_ISO = "2026-07-11T00:00:00.000Z";

type IpcHandler = (event?: unknown, ...args: unknown[]) => unknown;

let handlers: Map<string, IpcHandler>;

beforeEach(() => {
  handlers = new Map();
  electronMocks.ipcMainHandle.mockReset();
  electronMocks.ipcMainHandle.mockImplementation(
    (channel: string, handler: IpcHandler) => {
      handlers.set(channel, handler);
    }
  );
});

describe("registerControlChannelBridgeHandlers", () => {
  it("reports channel absence as data on the Tracking Host (available:false)", async () => {
    // Channel is autonomous-host専有 (裁定2): a null server → available:false, sourced
    // as DATA — no `if (role === ...)`. The renderer shows the empty page.
    registerControlChannelBridgeHandlers({
      windows: createFakeWindows(),
      server: null,
      overlayStore: null
    });

    const status = await invokeHandler<Promise<RuntimePlayerControlChannelStatus>>(
      channelBridgeChannels.getStatus
    );

    expect(status.available).toBe(false);
    expect(status.connection).toStrictEqual({ kind: "closed" });
    expect(status.endpointUrl).toBeNull();
    expect(status.activeOverlays).toStrictEqual([]);
    expect(status.recentEvents).toStrictEqual([]);
  });

  it("rejects open/close on the Tracking Host as unavailable", async () => {
    registerControlChannelBridgeHandlers({
      windows: createFakeWindows(),
      server: null,
      overlayStore: null
    });

    const open = await invokeHandler<
      Promise<RuntimePlayerControlChannelActionResult>
    >(channelBridgeChannels.openChannel);

    expect(open.result).toBe("unavailable");
    expect(open.status.available).toBe(false);
  });

  it("starts Closed and opens/closes through the bridge commands (自律)", async () => {
    const fake = createFakeServer();
    registerControlChannelBridgeHandlers({
      windows: createFakeWindows(),
      server: fake.server,
      overlayStore: new RuntimePlayerControlChannelOverlayStore(),
      nowMs: () => FIXED_NOW_MS,
      nowIso: () => FIXED_NOW_ISO
    });

    const initial = await invokeHandler<
      Promise<RuntimePlayerControlChannelStatus>
    >(channelBridgeChannels.getStatus);
    expect(initial.available).toBe(true);
    expect(initial.connection).toStrictEqual({ kind: "closed" });
    // Endpoint URL is unknown until the server binds (Closed → null).
    expect(initial.endpointUrl).toBeNull();

    const opened = await invokeHandler<
      Promise<RuntimePlayerControlChannelActionResult>
    >(channelBridgeChannels.openChannel);
    expect(opened.result).toBe("ok");
    expect(opened.status.connection).toStrictEqual({ kind: "open" });
    // The token appears ONLY as a URL構成要素 in the endpoint (C4 §4 秘匿規律).
    expect(opened.status.endpointUrl).toBe(
      `ws://127.0.0.1:17310/channel?token=${TEST_TOKEN}`
    );

    const closed = await invokeHandler<
      Promise<RuntimePlayerControlChannelActionResult>
    >(channelBridgeChannels.closeChannel);
    expect(closed.result).toBe("ok");
    expect(closed.status.connection).toStrictEqual({ kind: "closed" });
    expect(closed.status.endpointUrl).toBeNull();
  });

  it("exposes the token ONLY inside the endpoint URL, and no seed/raw slot", async () => {
    const fake = createFakeServer();
    registerControlChannelBridgeHandlers({
      windows: createFakeWindows(),
      server: fake.server,
      overlayStore: new RuntimePlayerControlChannelOverlayStore(),
      nowMs: () => FIXED_NOW_MS,
      nowIso: () => FIXED_NOW_ISO
    });

    // Closed: the token must not appear anywhere in the renderer-facing status.
    const closedStatus = await invokeHandler<
      Promise<RuntimePlayerControlChannelStatus>
    >(channelBridgeChannels.getStatus);
    expect(JSON.stringify(closedStatus)).not.toContain(TEST_TOKEN);

    // Open: the token appears EXACTLY once — inside endpointUrl, nowhere else.
    await invokeHandler(channelBridgeChannels.openChannel);
    const openStatus = await invokeHandler<
      Promise<RuntimePlayerControlChannelStatus>
    >(channelBridgeChannels.getStatus);
    const serialized = JSON.stringify(openStatus);
    expect(occurrences(serialized, TEST_TOKEN)).toBe(1);
    expect(openStatus.endpointUrl).toContain(TEST_TOKEN);
    expect(serialized).not.toContain("seed");
  });

  it("keeps a session-only Recent Events ring buffer (most-recent-first, capped)", async () => {
    const fake = createFakeServer();
    registerControlChannelBridgeHandlers({
      windows: createFakeWindows(),
      server: fake.server,
      overlayStore: new RuntimePlayerControlChannelOverlayStore(),
      nowMs: () => FIXED_NOW_MS,
      nowIso: () => FIXED_NOW_ISO
    });

    fake.emitEvent({ kind: "connected" });
    fake.emitEvent({ kind: "accepted", slotId: "head-horizontal", value: 0.4 });
    fake.emitEvent({ kind: "rejected", code: "slotValueOutOfRange" });

    const status = await invokeHandler<
      Promise<RuntimePlayerControlChannelStatus>
    >(channelBridgeChannels.getStatus);

    // Most recent first (C4 §1 直近イベント).
    expect(status.recentEvents.map((event) => event.kind)).toStrictEqual([
      "rejected",
      "accepted",
      "connected"
    ]);
    expect(status.recentEvents[0]).toMatchObject({
      kind: "rejected",
      code: "slotValueOutOfRange"
    });
    expect(status.recentEvents[1]).toMatchObject({
      kind: "accepted",
      slotId: "head-horizontal",
      value: 0.4
    });

    // Ring buffer is capped: overflow drops the oldest.
    for (let index = 0; index < runtimePlayerControlChannelMaxRecentEvents + 5; index += 1) {
      fake.emitEvent({ kind: "connected" });
    }
    const capped = await invokeHandler<
      Promise<RuntimePlayerControlChannelStatus>
    >(channelBridgeChannels.getStatus);
    expect(capped.recentEvents.length).toBe(
      runtimePlayerControlChannelMaxRecentEvents
    );
  });

  it("reports Active overlays with a relative remaining TTL (never expiresAtMs)", async () => {
    const overlayStore = new RuntimePlayerControlChannelOverlayStore();
    // Expiry is an absolute wall clock; the bridge must surface only the remainder.
    overlayStore.setOverlay("head-horizontal", 0.4, FIXED_NOW_MS + 300);
    overlayStore.setOverlay("head-vertical", -0.2, FIXED_NOW_MS - 1); // expired

    registerControlChannelBridgeHandlers({
      windows: createFakeWindows(),
      server: createFakeServer().server,
      overlayStore,
      nowMs: () => FIXED_NOW_MS,
      nowIso: () => FIXED_NOW_ISO
    });

    const status = await invokeHandler<
      Promise<RuntimePlayerControlChannelStatus>
    >(channelBridgeChannels.getStatus);

    expect(status.activeOverlays).toStrictEqual([
      { slotId: "head-horizontal", value: 0.4, remainingTtlMs: 300 }
    ]);
    // The absolute expiry instant never crosses to the renderer.
    expect(JSON.stringify(status.activeOverlays)).not.toContain(
      String(FIXED_NOW_MS + 300)
    );
  });
});

type FakeServerHandle = {
  readonly server: RuntimePlayerControlChannelServer;
  readonly emitEvent: (event: RuntimePlayerControlChannelServerEvent) => void;
};

function createFakeServer(): FakeServerHandle {
  let state: RuntimePlayerControlChannelServerState = { kind: "closed" };
  const stateListeners = new Set<RuntimePlayerControlChannelServerStateListener>();
  const eventListeners = new Set<RuntimePlayerControlChannelServerEventListener>();

  const setState = (next: RuntimePlayerControlChannelServerState): void => {
    state = next;
    for (const listener of stateListeners) {
      listener(next);
    }
  };

  const server = {
    token: TEST_TOKEN,
    getState: () => state,
    onStateChanged: (listener: RuntimePlayerControlChannelServerStateListener) => {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },
    onEvent: (listener: RuntimePlayerControlChannelServerEventListener) => {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
    open: async () => {
      setState({ kind: "open", port: 17310 });
      return state;
    },
    close: async () => {
      setState({ kind: "closed" });
    }
  } as unknown as RuntimePlayerControlChannelServer;

  return {
    server,
    emitEvent: (event) => {
      for (const listener of eventListeners) {
        listener(event);
      }
    }
  };
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function invokeHandler<TResult>(channel: string, ...args: unknown[]): TResult {
  const handler = handlers.get(channel);
  expect(handler).toBeTypeOf("function");
  return handler?.({}, ...args) as TResult;
}

function createFakeWindows(): RuntimePlayerWindowSet {
  return {
    controlWindow:
      createFakeWindow() as unknown as RuntimePlayerWindowSet["controlWindow"],
    stageWindow:
      createFakeWindow() as unknown as RuntimePlayerWindowSet["stageWindow"]
  };
}

function createFakeWindow() {
  return {
    webContents: {
      isDestroyed: vi.fn(() => false),
      send: vi.fn()
    },
    isDestroyed: vi.fn(() => false)
  };
}
