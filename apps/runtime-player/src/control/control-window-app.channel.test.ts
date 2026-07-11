import {
  Children,
  isValidElement,
  type ReactNode
} from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  connectControlWindowChannelStatusBridge,
  renderControlWindowChannelRoute
} from "./control-window-app";
import type {
  RuntimePlayerControlChannelActionResult,
  RuntimePlayerControlChannelApi,
  RuntimePlayerControlChannelStatus
} from "../preload/channel-bridge-contract";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ControlWindowApp Channel bridge wiring", () => {
  it("requests initial channel status and propagates status changes", async () => {
    const initialStatus = createStatus({ revision: 2 });
    const changedStatus = createStatus({ revision: 3 });
    const { bridge, emitStatusChanged, unsubscribe } =
      createChannelBridge(initialStatus);
    const onStatus = vi.fn();
    let active = true;

    const unsubscribeBridge = connectControlWindowChannelStatusBridge({
      runtimePlayer: { channel: bridge },
      isActive: () => active,
      onStatus
    });

    expect(bridge.getStatus).toHaveBeenCalledOnce();
    expect(bridge.onStatusChanged).toHaveBeenCalledOnce();

    await flushMicrotasks();
    expect(onStatus).toHaveBeenCalledWith(initialStatus);

    emitStatusChanged(changedStatus);
    expect(onStatus).toHaveBeenLastCalledWith(changedStatus);

    active = false;
    emitStatusChanged(createStatus({ revision: 4 }));
    expect(onStatus).toHaveBeenCalledTimes(2);

    unsubscribeBridge();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("wires the Channel route Open/Close commands and the Copy URL action", () => {
    const { bridge } = createChannelBridge(
      createStatus({ connection: { kind: "open" }, endpointUrl: "ws://x" })
    );
    const runChannelAction = vi.fn(
      async (
        action: () => Promise<RuntimePlayerControlChannelActionResult>
      ) => {
        await action();
      }
    );
    const onCopyChannelUrl = vi.fn();

    vi.stubGlobal("window", { runtimePlayer: { channel: bridge } });

    const tree = renderControlWindowChannelRoute({
      channelStatus: createStatus({
        connection: { kind: "open" },
        endpointUrl: "ws://x"
      }),
      runChannelAction,
      onCopyChannelUrl
    });

    clickButton(tree, "Close");
    clickButton(tree, "Copy Channel URL");

    expect(bridge.closeChannel).toHaveBeenCalledOnce();
    expect(onCopyChannelUrl).toHaveBeenCalledOnce();
    expect(runChannelAction).toHaveBeenCalledTimes(1);
  });

  it("wires the Open Channel command when Closed", () => {
    const { bridge } = createChannelBridge(
      createStatus({ connection: { kind: "closed" } })
    );
    const runChannelAction = vi.fn(
      async (
        action: () => Promise<RuntimePlayerControlChannelActionResult>
      ) => {
        await action();
      }
    );

    vi.stubGlobal("window", { runtimePlayer: { channel: bridge } });

    const tree = renderControlWindowChannelRoute({
      channelStatus: createStatus({ connection: { kind: "closed" } }),
      runChannelAction,
      onCopyChannelUrl: () => undefined
    });

    clickButton(tree, "Open Channel");
    expect(bridge.openChannel).toHaveBeenCalledOnce();
  });
});

function createChannelBridge(status: RuntimePlayerControlChannelStatus): {
  readonly bridge: RuntimePlayerControlChannelApi;
  readonly emitStatusChanged: (
    status: RuntimePlayerControlChannelStatus
  ) => void;
  readonly unsubscribe: ReturnType<typeof vi.fn>;
} {
  let statusChangedCallback:
    | ((status: RuntimePlayerControlChannelStatus) => void)
    | null = null;
  const unsubscribe = vi.fn();
  const bridge: RuntimePlayerControlChannelApi = {
    getStatus: vi.fn(async () => status),
    openChannel: vi.fn(async () => createActionResult(status)),
    closeChannel: vi.fn(async () => createActionResult(status)),
    onStatusChanged: vi.fn((callback) => {
      statusChangedCallback = callback;
      return unsubscribe;
    })
  };

  return {
    bridge,
    emitStatusChanged: (nextStatus) => {
      expect(statusChangedCallback).not.toBeNull();
      statusChangedCallback?.(nextStatus);
    },
    unsubscribe
  };
}

function createActionResult(
  status: RuntimePlayerControlChannelStatus
): RuntimePlayerControlChannelActionResult {
  return { result: "ok", message: "Control channel updated.", status };
}

function createStatus(
  patch: Partial<RuntimePlayerControlChannelStatus> = {}
): RuntimePlayerControlChannelStatus {
  return {
    available: true,
    connection: { kind: "closed" },
    endpointUrl: null,
    activeOverlays: [],
    recentEvents: [],
    revision: 1,
    updatedAtIso: "2026-07-11T00:00:00.000Z",
    ...patch
  };
}

function clickButton(node: ReactNode, label: string): void {
  const props = findElementByAriaLabelOrLabel(node, label);
  expect(props?.onClick).toBeTypeOf("function");
  expect(props?.disabled).not.toBe(true);
  props?.onClick?.();
}

function findElementByAriaLabelOrLabel(
  node: ReactNode,
  label: string
): ElementProps | null {
  if (!isValidElement(node)) {
    return null;
  }

  const props = node.props as ElementProps;
  if (props["aria-label"] === label || props.label === label) {
    return props;
  }

  if (typeof node.type === "function") {
    return findElementByAriaLabelOrLabel(
      (node.type as ComponentFunction)(node.props),
      label
    );
  }

  for (const child of Children.toArray(props.children)) {
    const match = findElementByAriaLabelOrLabel(child, label);
    if (match !== null) {
      return match;
    }
  }

  return null;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

type ComponentFunction = (props: unknown) => ReactNode;

type ElementProps = {
  readonly "aria-label"?: unknown;
  readonly label?: unknown;
  readonly children?: ReactNode;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
};
