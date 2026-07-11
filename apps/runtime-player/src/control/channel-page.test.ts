import {
  Children,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ChannelPage } from "./channel-page";
import type {
  RuntimePlayerControlChannelStatus
} from "../preload/channel-bridge-contract";

const ENDPOINT_URL =
  "ws://127.0.0.1:17310/channel?token=channel_token_fixture_1234567890ab";

describe("ChannelPage", () => {
  it("renders the checking state before the bridge status arrives", () => {
    const markup = renderChannelMarkup({ channelStatus: null });
    expect(markup).toContain(
      "Runtime Player is loading the control channel status."
    );
    expect(markup).not.toContain("Open Channel");
  });

  it("renders the tracking-host empty state (no channel, driven by tracking)", () => {
    const markup = renderChannelMarkup({
      channelStatus: createStatus({ available: false })
    });
    expect(markup).toContain(
      "This host has no control channel; the body is driven by tracking."
    );
    expect(markup).not.toContain("Open Channel");
    // No token / endpoint ever surfaces on the empty page.
    expect(markup).not.toContain("token=");
  });

  it("renders the Closed state with an Open Channel switch and no endpoint", () => {
    const markup = renderChannelMarkup({
      channelStatus: createStatus({ connection: { kind: "closed" } })
    });
    expect(markup).toContain("Closed");
    expect(markup).toContain("Open Channel");
    expect(markup).not.toContain("Copy Channel URL");
    expect(markup).not.toContain("token=");
  });

  it("renders Open — no client, with the endpoint URL and copy action", () => {
    const markup = renderChannelMarkup({
      channelStatus: createStatus({
        connection: { kind: "open" },
        endpointUrl: ENDPOINT_URL
      })
    });
    expect(markup).toContain("Open — no client connected");
    expect(markup).toContain("Close");
    expect(markup).toContain(ENDPOINT_URL);
    expect(markup).toContain("Copy Channel URL");
  });

  it("renders Connected with the protocol version", () => {
    const markup = renderChannelMarkup({
      channelStatus: createStatus({
        connection: { kind: "connected", protocolVersion: 1 },
        endpointUrl: ENDPOINT_URL
      })
    });
    expect(markup).toContain("Connected (protocol 1)");
  });

  it("renders Active overlays with slotId=value and a remaining TTL", () => {
    const markup = renderChannelMarkup({
      channelStatus: createStatus({
        connection: { kind: "connected", protocolVersion: 1 },
        endpointUrl: ENDPOINT_URL,
        activeOverlays: [
          { slotId: "head-horizontal", value: 0.4, remainingTtlMs: 320 }
        ]
      })
    });
    // Real semantic slot vocabulary (not the illustrative face.angle.x of the mockup).
    expect(markup).toContain("head-horizontal");
    expect(markup).toContain("0.40");
    expect(markup).toContain("ttl 320ms");
  });

  it("renders Recent Events with accepted intents and rejection codes", () => {
    const markup = renderChannelMarkup({
      channelStatus: createStatus({
        connection: { kind: "connected", protocolVersion: 1 },
        endpointUrl: ENDPOINT_URL,
        recentEvents: [
          { id: 3, kind: "rejected", code: "slotValueOutOfRange" },
          { id: 2, kind: "accepted", slotId: "head-horizontal", value: 0.4 },
          { id: 1, kind: "connected" }
        ]
      })
    });
    expect(markup).toContain("intent.set");
    expect(markup).toContain("slotValueOutOfRange");
    expect(markup).toContain("connected");
  });

  it("wires the Open, Close and Copy Channel URL commands", () => {
    const onOpenChannel = vi.fn();
    const onCopyChannelUrl = vi.fn();
    const closedTree = createElement(ChannelPage, {
      channelStatus: createStatus({ connection: { kind: "closed" } }),
      onOpenChannel,
      onCloseChannel: () => undefined,
      onCopyChannelUrl
    });

    clickButton(closedTree, "Open Channel");
    expect(onOpenChannel).toHaveBeenCalledOnce();

    const onCloseChannel = vi.fn();
    const openTree = createElement(ChannelPage, {
      channelStatus: createStatus({
        connection: { kind: "open" },
        endpointUrl: ENDPOINT_URL
      }),
      onOpenChannel: () => undefined,
      onCloseChannel,
      onCopyChannelUrl
    });

    clickButton(openTree, "Close");
    expect(onCloseChannel).toHaveBeenCalledOnce();
    clickButton(openTree, "Copy Channel URL");
    expect(onCopyChannelUrl).toHaveBeenCalledOnce();
  });
});

function renderChannelMarkup(input: {
  readonly channelStatus: RuntimePlayerControlChannelStatus | null;
}): string {
  return renderToStaticMarkup(
    createElement(ChannelPage, {
      channelStatus: input.channelStatus,
      onOpenChannel: () => undefined,
      onCloseChannel: () => undefined,
      onCopyChannelUrl: () => undefined
    })
  );
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

type ComponentFunction = (props: unknown) => ReactNode;

type ElementProps = {
  readonly "aria-label"?: unknown;
  readonly label?: unknown;
  readonly children?: ReactNode;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
};
