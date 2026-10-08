import { describe, expect, it } from "vitest";

import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import type {
  RuntimePlayerBrowserSourceStatus
} from "../../preload/browser-source-status-contract";
import type {
  RuntimePlayerEffectiveDynamicsTuningProfile
} from "../../preload/dynamics-tuning-bridge-contract";
import type {
  RuntimePlayerActiveVariantSelectionState
} from "../../preload/runtime-variant-bridge-contract";
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

  it("samples Stage display status while broadcasting every composed transform", () => {
    let nowMs = 0;
    const timers = createManualTimers();
    const session = new RuntimePlayerBrowserSourceSession({
      token: "token_fixture",
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
    session.publishStageDisplayState(createStageDisplayState(10), {
      notify: "sampled"
    });
    nowMs = 20;
    session.publishStageDisplayState(createStageDisplayState(20), {
      notify: "sampled"
    });

    const stageMessages = client.messages.filter((message) =>
      message.type === "stage-display-state-changed"
    );

    expect(stageMessages).toHaveLength(2);
    expect(stageMessages.at(-1)).toMatchObject({
      stageDisplayState: {
        stageView: {
          transform: {
            pan: { x: 20, y: 0 }
          }
        }
      }
    });
    expect(JSON.stringify(stageMessages.at(-1))).not.toContain("headPosition");
    expect(JSON.stringify(stageMessages.at(-1))).not.toContain("debug");
    expect(notifications).toHaveLength(0);

    nowMs = 510;
    timers.runNext();

    expect(notifications).toHaveLength(1);
    expect(
      notifications[0]?.stageDisplayState.stageView.transform?.pan.x
    ).toBe(20);
  });

  it("includes current active Variant selection in Browser Source resync without raw diagnostics", () => {
    const session = new RuntimePlayerBrowserSourceSession({
      token: "token_fixture"
    });
    const client = createClient();

    session.publishActiveVariantSelection(createActiveVariantSelection());
    session.addClient(client);

    const resync = client.messages.find((message) =>
      message.type === "runtime-export-resync"
    );

    expect(resync).toMatchObject({
      activeVariantSelection: {
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
      }
    });
    expect(JSON.stringify(resync)).not.toContain("tracking");
    expect(JSON.stringify(resync)).not.toContain("debug");
    expect(JSON.stringify(resync)).not.toContain("calibration");
  });

  it("syncs effective dynamics tuning through resync and separate update messages", () => {
    const session = new RuntimePlayerBrowserSourceSession({
      token: "token_fixture"
    });
    const client = createClient();

    session.publishDynamicsTuningProfile(createEffectiveDynamicsTuning(1));
    session.addClient(client);

    const resync = client.messages.find((message) =>
      message.type === "runtime-export-resync"
    );
    expect(resync).toMatchObject({
      effectiveDynamicsTuning: {
        revision: 1,
        dynamicsSignatureHash: "sha256:dynamics",
        groups: {
          dyn_hair_sway: {
            outputScale: 0.5
          }
        }
      }
    });
    expect(JSON.stringify(resync)).not.toContain("tracking");
    expect(JSON.stringify(resync)).not.toContain("private");

    client.messages.length = 0;
    session.publishDynamicsTuningProfile(createEffectiveDynamicsTuning(2));

    expect(client.messages).toContainEqual(expect.objectContaining({
      type: "dynamics-tuning-changed",
      effectiveDynamicsTuning: expect.objectContaining({
        revision: 2
      })
    }));
  });

  it("does not include product runtime-core profiling controls in broadcasts or resync", () => {
    const session = new RuntimePlayerBrowserSourceSession({
      token: "token_fixture"
    });
    const client = createClient();

    session.addClient(client);
    expect(JSON.stringify(client.messages)).not.toContain("tracking");
    expect(JSON.stringify(client.messages)).not.toContain("calibration");
    expect(JSON.stringify(client.messages)).not.toContain(
      "runtimeCoreProfiling"
    );
    expect(JSON.stringify(client.messages)).not.toContain(
      "runtime-core-profiling-changed"
    );

    const secondClient = createClient();
    session.addClient(secondClient);

    const resync = secondClient.messages.find((message) =>
      message.type === "runtime-export-resync"
    );

    expect(JSON.stringify(resync)).not.toContain("runtimeCoreProfiling");
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

function createStageDisplayState(panX: number) {
  return {
    stageWindow: {
      bounds: null
    },
    stageView: {
      transform: {
        zoomScale: 1,
        pan: {
          x: panX,
          y: 0
        },
        coordinateSpace: "stage-viewport-px-v1" as const
      }
    }
  };
}

function createActiveVariantSelection(): RuntimePlayerActiveVariantSelectionState {
  return {
    schemaVersion: "runtime-player-active-variant-selection-v1",
    state: "ready",
    activeSelections: [
      {
        variantGroupId: "vgrp_expression",
        activeSelection: {
          kind: "singleSelect",
          variantId: "var_smile"
        }
      }
    ],
    updatedAtIso: "2026-06-24T00:00:00.000Z"
  };
}

function createEffectiveDynamicsTuning(
  revision: number
): RuntimePlayerEffectiveDynamicsTuningProfile {
  return {
    schemaVersion: "runtime-player-effective-dynamics-tuning-v1",
    revision,
    fingerprint: "package-hash-fixture",
    updatedAtIso: "2026-06-30T00:00:00.000Z",
    exportIdentity: {
      packageId: "pkg_fixture",
      packageRevision: 7,
      packageHash: "sha256:fixture",
      parameterSignatureHash: "sha256:parameters"
    },
    dynamicsSignatureHash: "sha256:dynamics",
    groups: {
      dyn_hair_sway: {
        outputScale: 0.5
      }
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
