import {
  Children,
  createElement,
  isValidElement,
  type ReactNode
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { BrowserSourceOutputPanel } from "./browser-source-output-panel";
import { StagePage } from "./stage-page";
import type {
  RuntimePlayerBrowserSourceStatus
} from "../preload/browser-source-status-contract";
import type { RuntimeExportStatus } from "../preload/runtime-export-bridge-contract";
import {
  runtimePlayerStageViewCoordinateSpace,
  runtimePlayerStageWindowTitle,
  type RuntimePlayerStageStateSnapshot
} from "../preload/runtime-player-bridge-contract";

describe("StagePage Browser Source output", () => {
  it("renders the Browser Source URL, server status, clients, and renderer diagnostics", () => {
    const markup = renderStagePage(
      createBrowserSourceStatus({
        connectedClientCount: 1,
        runtimeExport: {
          state: "loaded",
          loaded: true,
          statusLabel: "Runtime Export loaded",
          loadedAtIso: "2026-06-23T01:00:00.000Z",
          summary: {
            modelDisplayName: "Wave9 Test Model",
            packageId: "wave9-test",
            packageRevision: 1,
            drawableCount: 2,
            meshCount: 2,
            parameterCount: 3,
            maskCount: 0
          }
        },
        latestFrame: {
          sequence: 42,
          producedAtIso: "2026-06-23T01:02:00.000Z"
        },
        lastClientHeartbeatAtIso: "2026-06-23T01:02:01.000Z",
        lastServerHeartbeatAtIso: "2026-06-23T01:02:02.000Z",
        requestDiagnostics: {
          lastStageRequest: {
            requestedAtIso: "2026-06-23T01:01:00.000Z",
            statusCode: 200,
            statusLabel: "served"
          },
          lastAssetRequest: {
            requestedAtIso: "2026-06-23T01:01:01.000Z",
            routeKind: "dev",
            statusCode: 200,
            statusLabel: "served"
          },
          lastWsUpgradeRejected: null,
          lastWsConnectedAtIso: "2026-06-23T01:01:02.000Z",
          lastWsDisconnectedAtIso: null
        },
        latestRendererDiagnostics: {
          clientId: 1,
          receivedAtIso: "2026-06-23T01:02:03.000Z",
          webgl2Available: "available",
          runtimeExportLoaded: true,
          renderStatus: "rendering",
          message: "Frame rendered",
          fps: 59.8,
          frameAgeMs: 18
        },
        latestClientDiagnostic: {
          reportedAtIso: "2026-06-23T01:01:01.500Z",
          event: "module-entry-started",
          message: null,
          source: null,
          line: null,
          column: null
        }
      })
    );

    expect(markup).toContain("Browser Source Output");
    expect(markup).toContain(
      "http://127.0.0.1:49200/stage?token=token_fixture"
    );
    expect(markup).toContain("Running - Browser Source server running");
    expect(markup).toContain("127.0.0.1");
    expect(markup).toContain("49200");
    expect(markup).toContain("Included in URL");
    expect(markup).toContain("Recommended OBS Size");
    expect(markup).toContain("1280 x 720");
    expect(markup).toContain("1 connected client");
    expect(markup).toContain("Stage Request");
    expect(markup).toContain("Served (200) at 2026-06-23T01:01:00.000Z");
    expect(markup).toContain("Asset Request");
    expect(markup).toContain("Dev Served (200) at 2026-06-23T01:01:01.000Z");
    expect(markup).toContain("WS Request");
    expect(markup).toContain("Connected at 2026-06-23T01:01:02.000Z");
    expect(markup).toContain("Client Boot");
    expect(markup).toContain("Module Entry Started at 2026-06-23T01:01:01.500Z");
    expect(markup).toContain("Runtime Export loaded: Wave9 Test Model");
    expect(markup).toContain("#42 at 2026-06-23T01:02:00.000Z");
    expect(markup).toContain("2026-06-23T01:02:01.000Z");
    expect(markup).toContain("2026-06-23T01:02:02.000Z");
    expect(markup).toContain("Rendering: Frame rendered");
    expect(markup).toContain("Available");
    expect(markup).toContain("Loaded in Browser Source");
    expect(markup).toContain("18 ms");
    expect(markup).toContain("59.8 fps");
    expect(markup).toContain("OBS Browser Source setup");
  });

  it("renders server error and no-client states distinctly", () => {
    const markup = renderStagePage(
      createBrowserSourceStatus({
        state: "error",
        statusLabel: "Browser Source server failed",
        port: null,
        browserSourceUrl: null,
        connectedClientCount: 0,
        errorMessage: "Port 49200 is unavailable."
      })
    );

    expect(markup).toContain("Error - Browser Source server failed");
    expect(markup).toContain("Browser Source server error");
    expect(markup).toContain("Port 49200 is unavailable.");
    expect(markup).toContain("URL unavailable");
    expect(markup).toContain("No Browser Source client connected");
    expect(markup).toContain("No boot/client diagnostic");
    expect(markup).toContain("No client diagnostics");
  });

  it("keeps native Stage Window capture controls as fallback instead of the primary output", () => {
    const markup = renderStagePage(createBrowserSourceStatus());
    const browserSourceIndex = markup.indexOf("Browser Source Output");
    const fallbackIndex = markup.indexOf("Local Preview / Fallback");
    const copyWindowTitleIndex = markup.indexOf("Copy Window Title");

    expect(markup).not.toContain("Capture Target");
    expect(browserSourceIndex).toBeGreaterThanOrEqual(0);
    expect(fallbackIndex).toBeGreaterThan(browserSourceIndex);
    expect(copyWindowTitleIndex).toBeGreaterThan(fallbackIndex);
  });

  it("wires the Copy URL button to the provided callback", () => {
    const onCopyUrl = vi.fn();
    const panel = BrowserSourceOutputPanel({
      status: createBrowserSourceStatus(),
      onCopyUrl
    });
    const button = findElementWithLabel(panel, "Copy URL");

    expect(button?.onClick).toBeTypeOf("function");
    button?.onClick?.();

    expect(onCopyUrl).toHaveBeenCalledOnce();
  });
});

function renderStagePage(
  browserSourceStatus: RuntimePlayerBrowserSourceStatus
): string {
  return renderToStaticMarkup(
    createElement(StagePage, {
      stageState: createStageState(),
      runtimeExportStatus: createRuntimeExportStatus(),
      browserSourceStatus,
      onFocusStage: noop,
      onResetView: noop,
      onCenterModel: noop,
      onSetArrangeMode: noop,
      onSetClickThrough: noop,
      onSetAlwaysOnTop: noop,
      onCopyBrowserSourceUrl: noop,
      onCopyWindowTitle: noop,
      onOpenRuntimeExport: noop,
      onRetryRuntimeExportRestore: noop
    })
  );
}

function noop(): void {
  return undefined;
}

function createRuntimeExportStatus(): RuntimeExportStatus {
  return {
    status: "empty",
    loaded: false,
    statusLabel: "No Runtime Export loaded"
  };
}

function createStageState(): RuntimePlayerStageStateSnapshot {
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
        updatedAtIso: "2026-06-23T00:00:00.000Z"
      },
      transform: {
        zoomScale: 1,
        pan: {
          x: 0,
          y: 0
        },
        coordinateSpace: runtimePlayerStageViewCoordinateSpace
      }
    },
    persistence: {
      status: "saved",
      statusLabel: "Saved",
      storageLabel: "window-state/runtime-player.json",
      updatedAtIso: "2026-06-23T00:00:00.000Z",
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
          pan: {
            x: 0,
            y: 0
          },
          coordinateSpace: runtimePlayerStageViewCoordinateSpace
        }
      },
      updatedAtIso: "2026-06-23T00:00:00.000Z"
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

type ElementProps = {
  readonly label?: unknown;
  readonly onClick?: () => void;
  readonly children?: ReactNode;
};

function findElementWithLabel(
  node: ReactNode,
  label: string
): ElementProps | null {
  if (!isValidElement(node)) {
    return null;
  }

  const props = node.props as ElementProps;

  if (props.label === label && typeof props.onClick === "function") {
    return props;
  }

  for (const child of Children.toArray(props.children)) {
    const match = findElementWithLabel(child, label);
    if (match !== null) {
      return match;
    }
  }

  return null;
}
