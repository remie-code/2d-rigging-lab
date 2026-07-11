import { setTimeout as delay } from "node:timers/promises";

import { afterEach, describe, expect, it } from "vitest";

import type {
  RuntimePlayerMappingSlot,
  RuntimePlayerMappingSlotId
} from "../../preload/model-mapping-bridge-contract";
import {
  RuntimePlayerControlChannelServer,
  type RuntimePlayerControlChannelServerState
} from "./channel-server";
import { RuntimePlayerControlChannelOverlayStore } from "./control-channel-overlay-store";

const TEST_TOKEN = "channel_token_fixture_1234567890ab";
const FIXED_NOW_MS = 10_000;

const runningServers: RuntimePlayerControlChannelServer[] = [];

afterEach(async () => {
  await Promise.all(runningServers.splice(0).map((server) => server.close()));
});

function writableSlot(
  slotId: RuntimePlayerMappingSlotId
): RuntimePlayerMappingSlot {
  return {
    slotId,
    label: slotId,
    group: "head",
    target: {
      parameterId: `param_${slotId}`,
      displayName: slotId,
      min: -30,
      max: 30,
      default: 0
    },
    enabled: true,
    invert: false,
    strength: 1,
    status: "mapped",
    warningMessages: []
  };
}

describe("RuntimePlayerControlChannelServer", () => {
  it("starts Closed and only listens after open()", async () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    const server = new RuntimePlayerControlChannelServer({
      overlayStore: store,
      token: TEST_TOKEN,
      port: 0
    });
    runningServers.push(server);

    expect(server.getState()).toStrictEqual({ kind: "closed" });

    const state = await server.open();
    expect(state.kind).toBe("open");
    expect(server.getState()).toMatchObject({
      kind: "open",
      port: expect.any(Number)
    });
  });

  it("is idempotent on repeated open()", async () => {
    const server = await startOpenServer();
    const firstPort = portOf(server.getState());
    const state = await server.open();
    expect(portOf(state)).toBe(firstPort);
  });

  it("announces server.hello immediately on connect and reports connected", async () => {
    const server = await startOpenServer();
    const socket = connect(server);
    const messages = collectMessages(socket);

    await waitForWebSocketOpen(socket);
    await waitFor(() =>
      messages.some((message) => message.kind === "server.hello")
    );

    expect(messages.find((message) => message.kind === "server.hello"))
      .toStrictEqual({
        v: 1,
        kind: "server.hello",
        payload: { protocol: 1, supportedKinds: ["intent.set"] }
      });
    await waitFor(() => server.getState().kind === "connected");
    expect(server.getState()).toMatchObject({
      kind: "connected",
      protocolVersion: 1
    });

    socket.close();
  });

  it("accepts a valid intent, correlates the reply, and writes the overlay", async () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    const server = await startOpenServer({ store });
    const socket = connect(server);
    const messages = collectMessages(socket);

    await waitForWebSocketOpen(socket);
    socket.send(JSON.stringify({
      v: 1,
      id: "req-42",
      kind: "intent.set",
      payload: { slotId: "head-horizontal", value: 0.4, ttlMs: 800 }
    }));

    await waitFor(() =>
      messages.some((message) => message.replyTo === "req-42")
    );
    expect(messages.find((message) => message.replyTo === "req-42"))
      .toStrictEqual({ v: 1, replyTo: "req-42", result: "accepted" });

    // Overlay written with expiry fixed at receivedAtMs + ttlMs.
    expect(store.snapshot(FIXED_NOW_MS + 500)).toStrictEqual({
      "head-horizontal": 0.4
    });
    expect(store.snapshot(FIXED_NOW_MS + 800)).toStrictEqual({});

    socket.close();
  });

  it("rejects an unknown kind but keeps the connection usable", async () => {
    const server = await startOpenServer();
    const socket = connect(server);
    const messages = collectMessages(socket);

    await waitForWebSocketOpen(socket);
    socket.send(JSON.stringify({
      v: 1,
      id: "req-unknown",
      kind: "intent.wave",
      payload: {}
    }));

    await waitFor(() =>
      messages.some((message) => message.replyTo === "req-unknown")
    );
    expect(messages.find((message) => message.replyTo === "req-unknown"))
      .toMatchObject({
        result: "rejected",
        error: { code: "unknownKind" }
      });

    // Connection stayed open (§3.5): a follow-up valid intent still works.
    expect(socket.readyState).toBe(WebSocket.OPEN);
    socket.send(JSON.stringify({
      v: 1,
      id: "req-after",
      kind: "intent.set",
      payload: { slotId: "head-horizontal", value: 0.1 }
    }));
    await waitFor(() =>
      messages.some((message) => message.replyTo === "req-after")
    );
    expect(messages.find((message) => message.replyTo === "req-after"))
      .toMatchObject({ result: "accepted" });

    socket.close();
  });

  it("rejects a connection presenting a bad token", async () => {
    const server = await startOpenServer();
    const socket = connect(server, "wrong-token");

    await expect(waitForWebSocketOpen(socket)).rejects.toThrow();
    expect(server.getState().kind).toBe("open");
  });

  it("clears all overlays and returns to open on client disconnect", async () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    const server = await startOpenServer({ store });
    const socket = connect(server);
    const messages = collectMessages(socket);

    await waitForWebSocketOpen(socket);
    socket.send(JSON.stringify({
      v: 1,
      id: "req-live",
      kind: "intent.set",
      payload: { slotId: "head-horizontal", value: 0.4, ttlMs: 5000 }
    }));
    await waitFor(() =>
      messages.some((message) => message.replyTo === "req-live")
    );
    expect(store.snapshot(FIXED_NOW_MS + 100)).toStrictEqual({
      "head-horizontal": 0.4
    });

    socket.close();
    await waitFor(() => server.getState().kind === "open");
    // Disconnect → 全失効.
    expect(store.snapshot(FIXED_NOW_MS + 100)).toStrictEqual({});
  });

  it("supports the full manual lifecycle: open → close → reopen", async () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    const server = new RuntimePlayerControlChannelServer({
      overlayStore: store,
      token: TEST_TOKEN,
      port: 0,
      getCurrentSlots: () => [writableSlot("head-horizontal")],
      nowMs: () => FIXED_NOW_MS
    });
    runningServers.push(server);
    const states: RuntimePlayerControlChannelServerState[] = [];
    server.onStateChanged((state) => states.push(state));

    await server.open();
    expect(server.getState().kind).toBe("open");

    await server.close();
    expect(server.getState()).toStrictEqual({ kind: "closed" });

    const reopened = await server.open();
    expect(reopened.kind).toBe("open");

    // A client can connect after reopen.
    const socket = connect(server);
    await waitForWebSocketOpen(socket);
    await waitFor(() => server.getState().kind === "connected");
    socket.close();

    expect(states.map((state) => state.kind)).toContain("closed");
  });
});

async function startOpenServer(options: {
  readonly store?: RuntimePlayerControlChannelOverlayStore;
} = {}): Promise<RuntimePlayerControlChannelServer> {
  const server = new RuntimePlayerControlChannelServer({
    overlayStore:
      options.store ?? new RuntimePlayerControlChannelOverlayStore(),
    token: TEST_TOKEN,
    port: 0,
    getCurrentSlots: () => [writableSlot("head-horizontal")],
    nowMs: () => FIXED_NOW_MS
  });
  runningServers.push(server);
  await server.open();
  return server;
}

function portOf(state: RuntimePlayerControlChannelServerState): number {
  if (state.kind === "closed") {
    throw new Error("Channel server is closed; no port.");
  }
  return state.port;
}

function connect(
  server: RuntimePlayerControlChannelServer,
  token = TEST_TOKEN
): WebSocket {
  const port = portOf(server.getState());
  const url = new URL(`ws://127.0.0.1:${port}/channel`);
  url.searchParams.set("token", token);
  return new WebSocket(url.toString());
}

function collectMessages(socket: WebSocket): Array<Record<string, unknown>> {
  const messages: Array<Record<string, unknown>> = [];
  socket.addEventListener("message", (event) => {
    messages.push(JSON.parse(String(event.data)) as Record<string, unknown>);
  });
  return messages;
}

async function waitForWebSocketOpen(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.OPEN) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const onOpen = (): void => {
      cleanup();
      resolve();
    };
    const onError = (): void => {
      cleanup();
      reject(new Error("Control Channel WebSocket open failed."));
    };
    const cleanup = (): void => {
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("error", onError);
    };
    socket.addEventListener("open", onOpen);
    socket.addEventListener("error", onError);
  });
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 1000
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }
    await delay(10);
  }

  throw new Error("Timed out waiting for Control Channel server test condition.");
}
