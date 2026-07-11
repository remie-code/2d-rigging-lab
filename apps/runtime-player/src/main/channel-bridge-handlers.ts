import { ipcMain, type BrowserWindow } from "electron";

import { channelBridgeChannels } from "../preload/channel-bridge-channels";
import type {
  RuntimePlayerControlChannelActionResult,
  RuntimePlayerControlChannelConnectionState,
  RuntimePlayerControlChannelEvent,
  RuntimePlayerControlChannelStatus
} from "../preload/channel-bridge-contract";
import { createControlChannelWebSocketUrl } from "./control-channel/channel-url";
import type {
  RuntimePlayerControlChannelServer,
  RuntimePlayerControlChannelServerEvent,
  RuntimePlayerControlChannelServerState
} from "./control-channel/channel-server";
import type {
  RuntimePlayerControlChannelOverlayStore
} from "./control-channel/control-channel-overlay-store";
import type { RuntimePlayerWindowSet } from "./window-management/runtime-player-windows";

/**
 * Control Channel bridge (C4 Domain C). Registered on BOTH roles from main
 * (outside the input subsystem, like the Physiology bridge). The role difference
 * is NOT branched here: `getStatus` reports「チャネルサブシステムの有無」as DATA
 * (`available`), sourced from whether a channel server was wired in (Autonomous
 * only, 裁定2). On the Tracking Host `server` is null → `available:false`, and the
 * renderer shows the one-line empty page — no `if (role === ...)` anywhere.
 *
 * The Recent Events log (C4 §1) is SESSION-ONLY: a ring buffer kept here in the
 * main-process channel state, never persisted, capped at `maxRecentEvents`. Only
 * diagnostic DATA crosses to the renderer — the Endpoint URL is the sole surface
 * the token appears on (a URL構成要素 for the 魂側 one-line setup); no seed, raw
 * slot, or other secret is exposed.
 */

export const runtimePlayerControlChannelMaxRecentEvents = 20;

export type RegisterControlChannelBridgeHandlersInput = {
  readonly windows: RuntimePlayerWindowSet;
  /** The Autonomous Host's channel server, or null on the Tracking Host. */
  readonly server: RuntimePlayerControlChannelServer | null;
  /** The Autonomous Host's overlay store (same instance), or null on tracking. */
  readonly overlayStore: RuntimePlayerControlChannelOverlayStore | null;
  readonly maxRecentEvents?: number;
  readonly nowMs?: () => number;
  readonly nowIso?: () => string;
};

export type RuntimePlayerControlChannelBridgeRegistration = {
  readonly publishStatus: () => void;
  readonly dispose: () => void;
};

export function registerControlChannelBridgeHandlers(
  input: RegisterControlChannelBridgeHandlersInput
): RuntimePlayerControlChannelBridgeRegistration {
  const maxRecentEvents =
    input.maxRecentEvents ?? runtimePlayerControlChannelMaxRecentEvents;
  const nowMs = input.nowMs ?? (() => Date.now());
  const nowIso = input.nowIso ?? (() => new Date().toISOString());

  const recentEvents: RuntimePlayerControlChannelEvent[] = [];
  let nextEventId = 1;
  let revision = 0;

  const recordEvent = (
    event: RuntimePlayerControlChannelServerEvent
  ): void => {
    recentEvents.push(toRendererEvent(event, nextEventId));
    nextEventId += 1;
    if (recentEvents.length > maxRecentEvents) {
      recentEvents.splice(0, recentEvents.length - maxRecentEvents);
    }
  };

  const buildStatus = (): RuntimePlayerControlChannelStatus => {
    revision += 1;
    const server = input.server;
    const state = server?.getState() ?? { kind: "closed" };

    return {
      available: server !== null,
      connection: toConnectionState(state),
      endpointUrl: buildEndpointUrl(server, state),
      activeOverlays: input.overlayStore?.activeOverlays(nowMs()) ?? [],
      // Most recent first (C4 §1 「直近イベント」).
      recentEvents: [...recentEvents].reverse(),
      revision,
      updatedAtIso: nowIso()
    };
  };

  const publishStatus = (): void => {
    sendStatusToControlWindow(input.windows.controlWindow, buildStatus());
  };

  const unsubscribers: Array<() => void> = [];
  if (input.server !== null) {
    unsubscribers.push(input.server.onStateChanged(() => publishStatus()));
    unsubscribers.push(
      input.server.onEvent((event) => {
        recordEvent(event);
        publishStatus();
      })
    );
  }

  ipcMain.handle(channelBridgeChannels.getStatus, () => buildStatus());
  ipcMain.handle(channelBridgeChannels.openChannel, async () => {
    if (input.server === null) {
      return buildActionResult(
        "unavailable",
        "This host has no control channel.",
        buildStatus()
      );
    }

    try {
      await input.server.open();
    } catch (error) {
      return buildActionResult(
        "error",
        toErrorMessage(error),
        buildStatus()
      );
    }

    return buildActionResult("ok", "Control channel opened.", buildStatus());
  });
  ipcMain.handle(channelBridgeChannels.closeChannel, async () => {
    if (input.server === null) {
      return buildActionResult(
        "unavailable",
        "This host has no control channel.",
        buildStatus()
      );
    }

    try {
      await input.server.close();
    } catch (error) {
      return buildActionResult(
        "error",
        toErrorMessage(error),
        buildStatus()
      );
    }

    return buildActionResult("ok", "Control channel closed.", buildStatus());
  });

  return {
    publishStatus,
    dispose: () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    }
  };
}

function toConnectionState(
  state: RuntimePlayerControlChannelServerState
): RuntimePlayerControlChannelConnectionState {
  if (state.kind === "connected") {
    return { kind: "connected", protocolVersion: state.protocolVersion };
  }

  if (state.kind === "open") {
    return { kind: "open" };
  }

  return { kind: "closed" };
}

function buildEndpointUrl(
  server: RuntimePlayerControlChannelServer | null,
  state: RuntimePlayerControlChannelServerState
): string | null {
  // The listening port is only known once the server binds (Open/Connected). The
  // token comes from the server itself; it surfaces to the renderer only here.
  if (server === null || state.kind === "closed") {
    return null;
  }

  return createControlChannelWebSocketUrl({
    port: state.port,
    token: server.token
  });
}

function toRendererEvent(
  event: RuntimePlayerControlChannelServerEvent,
  id: number
): RuntimePlayerControlChannelEvent {
  if (event.kind === "accepted") {
    return { id, kind: "accepted", slotId: event.slotId, value: event.value };
  }

  if (event.kind === "rejected") {
    return { id, kind: "rejected", code: event.code };
  }

  return { id, kind: event.kind };
}

function buildActionResult(
  result: RuntimePlayerControlChannelActionResult["result"],
  message: string,
  status: RuntimePlayerControlChannelStatus
): RuntimePlayerControlChannelActionResult {
  return { result, message, status };
}

function sendStatusToControlWindow(
  window: BrowserWindow,
  payload: RuntimePlayerControlChannelStatus
): void {
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    return;
  }

  window.webContents.send(channelBridgeChannels.statusChanged, payload);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
