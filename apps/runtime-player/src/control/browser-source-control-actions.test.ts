import { describe, expect, it, vi } from "vitest";

import {
  copyBrowserSourceUrlFromStatus
} from "./browser-source-control-actions";
import type {
  RuntimePlayerBrowserSourceStatus
} from "../preload/browser-source-status-contract";

describe("copyBrowserSourceUrlFromStatus", () => {
  it("copies the Browser Source URL from the bridge status", async () => {
    const writeText = vi.fn(async (_text: string) => undefined);
    const url = "http://127.0.0.1:49200/stage?token=token_fixture";

    const feedback = await copyBrowserSourceUrlFromStatus({
      status: createBrowserSourceStatus({ browserSourceUrl: url }),
      writeText
    });

    expect(writeText).toHaveBeenCalledWith(url);
    expect(feedback).toEqual({
      message: "Browser Source URL copied.",
      tone: "success"
    });
  });

  it("returns visible error feedback when the URL is unavailable", async () => {
    const writeText = vi.fn(async (_text: string) => undefined);

    const feedback = await copyBrowserSourceUrlFromStatus({
      status: createBrowserSourceStatus({ browserSourceUrl: null }),
      writeText
    });

    expect(writeText).not.toHaveBeenCalled();
    expect(feedback).toEqual({
      message: "Browser Source URL is not available yet.",
      tone: "error"
    });
  });
});

function createBrowserSourceStatus(
  patch: Partial<RuntimePlayerBrowserSourceStatus> = {}
): RuntimePlayerBrowserSourceStatus {
  return {
    schemaVersion: "runtime-player-browser-source-status-v1",
    state: "running",
    statusLabel: "Browser Source server running",
    bindAddress: "127.0.0.1",
    port: 49200,
    browserSourceUrl: "http://127.0.0.1:49200/stage?token=token_fixture",
    connectedClientCount: 0,
    runtimeExport: {
      state: "empty",
      loaded: false,
      statusLabel: "No Runtime Export loaded",
      loadedAtIso: null,
      summary: null
    },
    latestFrame: null,
    stageDisplayState: {
      stageWindow: {
        bounds: null
      },
      stageView: {
        transform: null
      },
      updatedAtIso: null
    },
    lastClientConnectedAtIso: null,
    lastClientDisconnectedAtIso: null,
    lastClientHeartbeatAtIso: null,
    lastServerHeartbeatAtIso: null,
    latestRendererDiagnostics: null,
    latestClientDiagnostic: null,
    requestDiagnostics: {
      lastStageRequest: null,
      lastAssetRequest: null,
      lastWsUpgradeRejected: null,
      lastWsConnectedAtIso: null,
      lastWsDisconnectedAtIso: null
    },
    errorMessage: null,
    updatedAtIso: "2026-06-23T00:00:00.000Z",
    ...patch
  };
}
