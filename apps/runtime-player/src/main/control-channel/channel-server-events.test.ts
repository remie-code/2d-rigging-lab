import { setTimeout as delay } from "node:timers/promises";

import { afterEach, describe, expect, it } from "vitest";

import type {
  RuntimePlayerMappingSlot,
  RuntimePlayerMappingSlotId
} from "../../preload/model-mapping-bridge-contract";
import {
  RuntimePlayerControlChannelServer,
  type RuntimePlayerControlChannelServerEvent
} from "./channel-server";
import { RuntimePlayerControlChannelOverlayStore } from "./control-channel-overlay-store";

/**
 * The `onEvent` seam (C4 Domain C's Recent Events source): the server surfaces
 * connect / accept / reject / disconnect so the bridge can keep a session-only log.
 * These are the events Domain C wires into the Channel page — validated here over a
 * real WS round trip.
 */

const TEST_TOKEN = "channel_token_fixture_1234567890ab";

const runningServers: RuntimePlayerControlChannelServer[] = [];

afterEach(async () => {
  await Promise.all(runningServers.splice(0).map((server) => server.close()));
});

describe("RuntimePlayerControlChannelServer onEvent", () => {
  it("emits connected / accepted / rejected / disconnected with public data only", async () => {
    const events: RuntimePlayerControlChannelServerEvent[] = [];
    const server = new RuntimePlayerControlChannelServer({
      overlayStore: new RuntimePlayerControlChannelOverlayStore(),
      token: TEST_TOKEN,
      port: 0,
      getCurrentSlots: () => [writableSlot("head-horizontal")],
      nowMs: () => 10_000
    });
    runningServers.push(server);
    server.onEvent((event) => events.push(event));
    await server.open();

    const socket = connect(server);
    await waitForWebSocketOpen(socket);
    await waitFor(() => events.some((event) => event.kind === "connected"));

    // Accepted intent → accepted event carries slotId + value (no token/seed).
    socket.send(JSON.stringify({
      v: 1,
      id: "req-ok",
      kind: "intent.set",
      payload: { slotId: "head-horizontal", value: 0.4 }
    }));
    await waitFor(() => events.some((event) => event.kind === "accepted"));

    // Out-of-range → rejected event carries the enumerated code.
    socket.send(JSON.stringify({
      v: 1,
      id: "req-bad",
      kind: "intent.set",
      payload: { slotId: "head-horizontal", value: 9 }
    }));
    await waitFor(() => events.some((event) => event.kind === "rejected"));

    socket.close();
    await waitFor(() => events.some((event) => event.kind === "disconnected"));

    const accepted = events.find((event) => event.kind === "accepted");
    expect(accepted).toStrictEqual({
      kind: "accepted",
      slotId: "head-horizontal",
      value: 0.4
    });
    const rejected = events.find((event) => event.kind === "rejected");
    expect(rejected).toStrictEqual({
      kind: "rejected",
      code: "slotValueOutOfRange"
    });
    // No secret rides an event.
    expect(JSON.stringify(events)).not.toContain(TEST_TOKEN);
  });

  it("emits an accepted event for intent.envelope carrying peak as its diagnostic value", async () => {
    const events: RuntimePlayerControlChannelServerEvent[] = [];
    const server = new RuntimePlayerControlChannelServer({
      overlayStore: new RuntimePlayerControlChannelOverlayStore(),
      token: TEST_TOKEN,
      port: 0,
      getCurrentSlots: () => [writableSlot("head-horizontal")],
      nowMs: () => 10_000
    });
    runningServers.push(server);
    server.onEvent((event) => events.push(event));
    await server.open();

    const socket = connect(server);
    await waitForWebSocketOpen(socket);
    await waitFor(() => events.some((event) => event.kind === "connected"));

    socket.send(JSON.stringify({
      v: 1,
      id: "req-env",
      kind: "intent.envelope",
      payload: {
        slotId: "head-horizontal",
        peak: 0.7,
        attackMs: 100,
        sustainMs: 400,
        decayMs: 200
      }
    }));
    await waitFor(() => events.some((event) => event.kind === "accepted"));

    const accepted = events.find((event) => event.kind === "accepted");
    // The accepted event surfaces peak as `value` (diagnostic), same shape as set.
    expect(accepted).toStrictEqual({
      kind: "accepted",
      slotId: "head-horizontal",
      value: 0.7
    });

    socket.close();
  });
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

function connect(server: RuntimePlayerControlChannelServer): WebSocket {
  const state = server.getState();
  if (state.kind === "closed") {
    throw new Error("Channel server is closed; no port.");
  }
  const url = new URL(`ws://127.0.0.1:${state.port}/channel`);
  url.searchParams.set("token", TEST_TOKEN);
  return new WebSocket(url.toString());
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

  throw new Error("Timed out waiting for Control Channel event test condition.");
}
