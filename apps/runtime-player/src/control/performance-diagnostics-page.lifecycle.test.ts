import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  RuntimePlayerBrowserSourceStatus
} from "../preload/browser-source-status-contract";
import type {
  RuntimePlayerInputStatus
} from "../preload/input-bridge-contract";
import type {
  RuntimePlayerStageRenderMetricsSnapshot
} from "../preload/performance-diagnostics-contract";
import {
  runtimePlayerStageViewCoordinateSpace,
  runtimePlayerStageWindowTitle,
  type RuntimePlayerStageStateSnapshot
} from "../preload/runtime-player-bridge-contract";

type PerformanceDiagnosticsPageModule =
  typeof import("./performance-diagnostics-page");
type ReactModule = typeof import("react");
type HookEffect = () => void | (() => void);
type HookEffectState = {
  readonly deps: readonly unknown[] | undefined;
  readonly cleanup: void | (() => void);
};
type ElementProps = {
  readonly label?: unknown;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly children?: ReactNode;
};

afterEach(() => {
  vi.doUnmock("react");
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("PerformanceDiagnosticsPage lifecycle", () => {
  it("handles Start Capture, Stop Capture, Copy Report, and Clear Report controls", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-25T01:00:00.000Z"));
    vi.stubGlobal("window", createTimerWindow());

    const { page, react, render } = await setupPageHarness();
    const onCopyReport = vi.fn();
    const onSetRuntimeCoreProfiling = vi.fn();
    let props = createPageProps({
      onCopyReport,
      onSetRuntimeCoreProfiling,
      nativeStageMetrics: createMetrics({ renderCount: 10 })
    });
    let tree = render(page, props);

    findButton(react, tree, "Start Capture").onClick?.();
    tree = render(page, props);

    expect(onSetRuntimeCoreProfiling).toHaveBeenCalledWith({
      target: "native-stage",
      mode: "deep"
    });
    expect(findButton(react, tree, "Start Capture").disabled).toBe(true);
    expect(findButton(react, tree, "Stop Capture").disabled).toBe(false);

    vi.setSystemTime(new Date("2026-06-25T01:00:01.000Z"));
    props = {
      ...props,
      nativeStageMetrics: createMetrics({
        renderCount: 70,
        lastRafDeltaMs: 16,
        rafDeltaSampleCount: 1,
        lastRenderDurationMs: 4,
        renderDurationSampleCount: 1
      })
    };
    tree = render(page, props);

    findButton(react, tree, "Stop Capture").onClick?.();
    tree = render(page, props);

    expect(onSetRuntimeCoreProfiling).toHaveBeenLastCalledWith({
      target: "native-stage",
      mode: "disabled"
    });
    const copyButton = findButton(react, tree, "Copy Report");
    expect(copyButton.disabled).toBe(false);

    copyButton.onClick?.();
    expect(onCopyReport).toHaveBeenCalledTimes(1);
    expect(onCopyReport.mock.calls[0]?.[0]).toContain("renderFps: 60");

    findButton(react, tree, "Clear Report").onClick?.();
    tree = render(page, props);

    expect(findButton(react, tree, "Copy Report").disabled).toBe(true);
    expect(findButton(react, tree, "Start Capture").disabled).toBe(false);
  });

  it("completes a timed capture and enables Copy Report", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-25T01:00:00.000Z"));
    vi.stubGlobal("window", createTimerWindow());

    const { page, react, render } = await setupPageHarness();
    const onCopyReport = vi.fn();
    const onSetRuntimeCoreProfiling = vi.fn();
    const props = createPageProps({
      onCopyReport,
      onSetRuntimeCoreProfiling,
      nativeStageMetrics: createMetrics({ renderCount: 5 })
    });
    let tree = render(page, props);

    findButton(react, tree, "Start Capture").onClick?.();
    vi.advanceTimersByTime(10_000);
    tree = render(page, props);

    expect(onSetRuntimeCoreProfiling).toHaveBeenLastCalledWith({
      target: "native-stage",
      mode: "disabled"
    });
    const copyButton = findButton(react, tree, "Copy Report");
    expect(copyButton.disabled).toBe(false);

    copyButton.onClick?.();
    expect(onCopyReport.mock.calls[0]?.[0]).toContain(
      "captureDurationMs: 10000"
    );
  });
});

async function setupPageHarness(): Promise<{
  readonly page: PerformanceDiagnosticsPageModule;
  readonly react: ReactModule;
  readonly render: (
    page: PerformanceDiagnosticsPageModule,
    props: Parameters<PerformanceDiagnosticsPageModule["PerformanceDiagnosticsPage"]>[0]
  ) => ReactNode;
}> {
  const hookHarness = createHookHarness();

  vi.doMock("react", async () => {
    const actual = await vi.importActual<ReactModule>("react");

    return {
      ...actual,
      useEffect: hookHarness.useEffect,
      useRef: hookHarness.useRef,
      useState: hookHarness.useState
    };
  });

  const page = await import("./performance-diagnostics-page");
  const react = await import("react");

  return {
    page,
    react,
    render: (pageModule, props) => {
      hookHarness.resetCursor();
      return pageModule.PerformanceDiagnosticsPage(props);
    }
  };
}

function createHookHarness(): {
  readonly resetCursor: () => void;
  readonly useEffect: (
    effect: HookEffect,
    deps?: readonly unknown[]
  ) => void;
  readonly useRef: <TValue>(initialValue: TValue) => { current: TValue };
  readonly useState: <TValue>(
    initialValue: TValue | (() => TValue)
  ) => [TValue, (nextValue: TValue | ((current: TValue) => TValue)) => void];
} {
  const hookValues: unknown[] = [];
  let hookIndex = 0;

  return {
    resetCursor: () => {
      hookIndex = 0;
    },
    useEffect: (effect, deps) => {
      const index = hookIndex;
      hookIndex += 1;
      const previous = hookValues[index] as HookEffectState | undefined;

      if (previous !== undefined && areHookDepsEqual(previous.deps, deps)) {
        return;
      }

      if (typeof previous?.cleanup === "function") {
        previous.cleanup();
      }
      hookValues[index] = {
        deps: deps === undefined ? undefined : [...deps],
        cleanup: effect()
      } satisfies HookEffectState;
    },
    useRef: <TValue,>(initialValue: TValue) => {
      const index = hookIndex;
      hookIndex += 1;

      if (hookValues[index] === undefined) {
        hookValues[index] = { current: initialValue };
      }

      return hookValues[index] as { current: TValue };
    },
    useState: <TValue,>(initialValue: TValue | (() => TValue)) => {
      const index = hookIndex;
      hookIndex += 1;

      if (hookValues[index] === undefined) {
        hookValues[index] =
          typeof initialValue === "function"
            ? (initialValue as () => TValue)()
            : initialValue;
      }

      return [
        hookValues[index] as TValue,
        (nextValue: TValue | ((current: TValue) => TValue)) => {
          hookValues[index] =
            typeof nextValue === "function"
              ? (nextValue as (current: TValue) => TValue)(
                  hookValues[index] as TValue
                )
              : nextValue;
        }
      ];
    }
  };
}

function areHookDepsEqual(
  left: readonly unknown[] | undefined,
  right: readonly unknown[] | undefined
): boolean {
  if (left === undefined || right === undefined || left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => Object.is(value, right[index]));
}

function createTimerWindow(): {
  readonly setTimeout: (handler: () => void, timeout: number) => number;
  readonly clearTimeout: (handle: number) => void;
} {
  return {
    setTimeout: (handler, timeout) =>
      setTimeout(handler, timeout) as unknown as number,
    clearTimeout: (handle) => {
      clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
    }
  };
}

function findButton(
  react: ReactModule,
  node: ReactNode,
  label: string
): ElementProps {
  const match = findElementWithLabel(react, node, label);
  expect(match).not.toBeNull();
  return match as ElementProps;
}

function findElementWithLabel(
  react: ReactModule,
  node: ReactNode,
  label: string
): ElementProps | null {
  if (!react.isValidElement(node)) {
    return null;
  }

  const props = node.props as ElementProps;

  if (props.label === label && typeof props.onClick === "function") {
    return props;
  }

  for (const child of react.Children.toArray(props.children)) {
    const match = findElementWithLabel(react, child, label);
    if (match !== null) {
      return match;
    }
  }

  return null;
}

function createPageProps(input: {
  readonly onCopyReport: (reportText: string) => void;
  readonly onSetRuntimeCoreProfiling?: Parameters<
    PerformanceDiagnosticsPageModule["PerformanceDiagnosticsPage"]
  >[0]["onSetRuntimeCoreProfiling"];
  readonly nativeStageMetrics: RuntimePlayerStageRenderMetricsSnapshot | null;
}): Parameters<PerformanceDiagnosticsPageModule["PerformanceDiagnosticsPage"]>[0] {
  return {
    inputStatus: createInputStatus(),
    stageState: createStageState(),
    nativeStageMetrics: input.nativeStageMetrics,
    browserSourceStatus: createBrowserSourceStatus(),
    onCopyReport: input.onCopyReport,
    onSetRuntimeCoreProfiling: input.onSetRuntimeCoreProfiling
  };
}

function createInputStatus(): RuntimePlayerInputStatus {
  return {
    source: "ifacialmocap",
    sourceLabel: "iFacialMocap",
    transport: "udp",
    transportLabel: "UDP",
    receivePort: 49983,
    connectionState: "receiving",
    localIpCandidates: [],
    packetCount: 10,
    estimatedFps: 60,
    diagnostics: {}
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
        updatedAtIso: "2026-06-25T00:00:00.000Z"
      },
      transform: {
        zoomScale: 1,
        pan: { x: 0, y: 0 },
        coordinateSpace: runtimePlayerStageViewCoordinateSpace
      }
    },
    stageMotion: {
      settings: {
        enabled: false,
        horizontal: {
          strengthPx: 80,
          limitPx: 120,
          invert: false
        },
        scale: {
          strength: 0.06,
          limit: 0.1,
          invert: false
        },
        deadZone: 0.03,
        reaction: 8
      }
    },
    persistence: {
      status: "saved",
      statusLabel: "Saved",
      storageLabel: "window-state/runtime-player.json",
      updatedAtIso: "2026-06-25T00:00:00.000Z",
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

function createBrowserSourceStatus(): RuntimePlayerBrowserSourceStatus {
  return {
    schemaVersion: "runtime-player-browser-source-status-v1",
    state: "running",
    statusLabel: "Browser Source server running",
    bindAddress: "127.0.0.1",
    port: 49200,
    browserSourceUrl: "http://127.0.0.1:49200/stage?token=token_fixture",
    connectedClientCount: 0,
    runtimeExport: {
      state: "not-loaded",
      loaded: false,
      statusLabel: "Runtime Export not loaded",
      loadedAtIso: null,
      summary: null
    },
    latestFrame: null,
    stageDisplayState: null,
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
    updatedAtIso: "2026-06-25T00:00:00.000Z"
  };
}

function createMetrics(
  patch: Partial<RuntimePlayerStageRenderMetricsSnapshot> = {}
): RuntimePlayerStageRenderMetricsSnapshot {
  return {
    renderCount: 0,
    scheduledRenderCount: 0,
    immediateRenderCount: 0,
    liveFrameMessageCount: 0,
    stageViewTransformMessageCount: 0,
    stageDisplayTransformMessageCount: 0,
    duplicateTransformSkipCount: 0,
    coalescedLiveFrameCount: 0,
    lastRafDeltaMs: null,
    rafDeltaSampleCount: 0,
    lastRenderDurationMs: null,
    renderDurationSampleCount: 0,
    canvasWidth: 1280,
    canvasHeight: 720,
    devicePixelRatio: 1,
    ...patch
  };
}
