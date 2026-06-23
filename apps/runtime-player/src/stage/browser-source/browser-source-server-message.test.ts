import { describe, expect, it } from "vitest";

import {
  readBrowserSourceRuntimeExportResponse,
  readBrowserSourceServerMessage
} from "./browser-source-server-message";

describe("readBrowserSourceServerMessage", () => {
  it("sanitizes live parameter frames to the render-only frame shape", () => {
    const extraFrameKey = ["raw", "Frame"].join("");
    const message = readBrowserSourceServerMessage(JSON.stringify({
      type: "live-parameter-frame",
      protocolVersion: 1,
      sentAtIso: "2026-06-23T01:00:02.000Z",
      frame: {
        schemaVersion: "runtime-player-live-parameter-frame-v1",
        runtimeExport: {
          packageId: "pkg_fixture",
          packageRevision: 7,
          loadedAtIso: "2026-06-23T01:00:00.000Z"
        },
        sequence: 10,
        producedAtIso: "2026-06-23T01:00:01.000Z",
        sourceFrameTimestampMs: 1200,
        parameterValues: {
          ParamAngleX: 12.5,
          ParamIgnored: "not-a-number"
        },
        [extraFrameKey]: {
          secret: "must-not-survive"
        }
      }
    }));

    expect(message).toStrictEqual({
      type: "live-parameter-frame",
      protocolVersion: 1,
      sentAtIso: "2026-06-23T01:00:02.000Z",
      frame: {
        schemaVersion: "runtime-player-live-parameter-frame-v1",
        runtimeExport: {
          packageId: "pkg_fixture",
          packageRevision: 7,
          loadedAtIso: "2026-06-23T01:00:00.000Z"
        },
        sequence: 10,
        producedAtIso: "2026-06-23T01:00:01.000Z",
        sourceFrameTimestampMs: 1200,
        parameterValues: {
          ParamAngleX: 12.5
        }
      }
    });
    expect(JSON.stringify(message)).not.toContain("must-not-survive");
  });

  it("ignores unsupported server message families", () => {
    expect(readBrowserSourceServerMessage(JSON.stringify({
      type: "tracking-diagnostics",
      protocolVersion: 1,
      sentAtIso: "2026-06-23T01:00:02.000Z",
      blendshapes: {
        MouthSmileLeft: 0.5
      }
    }))).toBeNull();
  });

  it("reads Stage display state from resync and drops unrelated fields", () => {
    const message = readBrowserSourceServerMessage(JSON.stringify({
      type: "runtime-export-resync",
      protocolVersion: 1,
      runtimeExport: null,
      runtimeExportStatus: {
        state: "empty",
        loaded: false,
        statusLabel: "No model",
        loadedAtIso: null,
        summary: null
      },
      latestFrame: null,
      stageDisplayState: {
        stageWindow: {
          bounds: {
            x: 100,
            y: 80,
            width: 1280,
            height: 720,
            debug: "must-not-survive"
          }
        },
        stageView: {
          transform: {
            zoomScale: 1.5,
            pan: {
              x: 24,
              y: -16
            },
            coordinateSpace: "stage-viewport-px-v1",
            raw: "must-not-survive"
          }
        },
        updatedAtIso: "2026-06-23T01:00:00.000Z",
        diagnostics: {
          rawFrame: "must-not-survive"
        }
      },
      sentAtIso: "2026-06-23T01:00:02.000Z"
    }));

    expect(message).toMatchObject({
      type: "runtime-export-resync",
      stageDisplayState: {
        stageWindow: {
          bounds: {
            x: 100,
            y: 80,
            width: 1280,
            height: 720
          }
        },
        stageView: {
          transform: {
            zoomScale: 1.5,
            pan: {
              x: 24,
              y: -16
            },
            coordinateSpace: "stage-viewport-px-v1"
          }
        },
        updatedAtIso: "2026-06-23T01:00:00.000Z"
      }
    });
    expect(JSON.stringify(message)).not.toContain("must-not-survive");
  });
});

describe("readBrowserSourceRuntimeExportResponse", () => {
  it("accepts the not-loaded response shape", () => {
    expect(readBrowserSourceRuntimeExportResponse({
      status: "not-loaded",
      runtimeExport: null,
      runtimeExportStatus: {
        state: "empty",
        loaded: false,
        statusLabel: "No model",
        loadedAtIso: null,
        summary: null
      },
      stageDisplayState: {
        stageWindow: {
          bounds: null
        },
        stageView: {
          transform: null
        },
        updatedAtIso: null
      }
    })).toStrictEqual({
      status: "not-loaded",
      runtimeExport: null,
      runtimeExportStatus: {
        state: "empty",
        loaded: false,
        statusLabel: "No model",
        loadedAtIso: null,
        summary: null
      },
      stageDisplayState: {
        stageWindow: {
          bounds: null
        },
        stageView: {
          transform: null
        },
        updatedAtIso: null
      }
    });
  });
});
