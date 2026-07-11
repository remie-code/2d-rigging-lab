import type { ReactElement } from "react";
import { Copy, PlugZap, Power } from "lucide-react";

import {
  EmptySubsystemNotice,
  IconTextButton,
  Panel,
  StatusRow
} from "./control-window-components";
import type {
  RuntimePlayerControlChannelConnectionState,
  RuntimePlayerControlChannelEvent,
  RuntimePlayerControlChannelStatus
} from "../preload/channel-bridge-contract";

/**
 * Channel page (C4 Domain C, UX c4-channel-diagnostics.md §1). The家 of the control
 * channel: the Open/Close switch lives here (起動時Closed), the Endpoint URL is
 * copy-able (Browser Source と同じ作法), and the diagnostics are three tiers —
 * connection state, Active overlays (今チャネルが上書きしているスロット+値+残TTL), and
 * a session-only Recent Events log (受理 / 拒否+コード / 接続). Two states beyond the
 * live page: null (checking) and the Tracking Host empty state (no channel). All
 * driven by DATA (`available`), never a role query. Slot names are the real semantic
 * vocabulary (`head-horizontal` 等), not the illustrative `face.angle.x` of the mockup.
 */
export function ChannelPage({
  channelStatus,
  onOpenChannel,
  onCloseChannel,
  onCopyChannelUrl
}: {
  readonly channelStatus: RuntimePlayerControlChannelStatus | null;
  readonly onOpenChannel: () => void;
  readonly onCloseChannel: () => void;
  readonly onCopyChannelUrl: () => void;
}): ReactElement {
  if (channelStatus === null) {
    return (
      <Panel title="Channel">
        <EmptySubsystemNotice
          title="Checking channel"
          message="Runtime Player is loading the control channel status."
        />
      </Panel>
    );
  }

  // Empty state (UX §1): the Tracking Host has no control channel subsystem — the
  // body is driven by tracking. A one-line degraded page, no nav工事.
  if (!channelStatus.available) {
    return (
      <Panel title="Channel">
        <EmptySubsystemNotice
          title="No control channel on this host"
          message="This host has no control channel; the body is driven by tracking."
        />
      </Panel>
    );
  }

  const connection = channelStatus.connection;
  const isOpen = connection.kind !== "closed";

  return (
    <div className="grid gap-4">
      <Panel title="Channel">
        <StatusRow label="Status" value={formatConnectionLabel(connection)} />
        <div className="mt-3 flex flex-wrap gap-2">
          {isOpen ? (
            <IconTextButton
              icon={Power}
              label="Close"
              onClick={onCloseChannel}
              variant="secondary"
            />
          ) : (
            <IconTextButton
              icon={PlugZap}
              label="Open Channel"
              onClick={onOpenChannel}
              variant="primary"
            />
          )}
        </div>
        {channelStatus.endpointUrl === null ? null : (
          <div className="mt-4 grid gap-2">
            <StatusRow label="Endpoint" value={channelStatus.endpointUrl} />
            <div>
              <IconTextButton
                icon={Copy}
                label="Copy Channel URL"
                onClick={onCopyChannelUrl}
                variant="secondary"
              />
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Live">
        <ActiveOverlaysList overlays={channelStatus.activeOverlays} />
      </Panel>

      <Panel title="Recent Events">
        <RecentEventsList events={channelStatus.recentEvents} />
      </Panel>
    </div>
  );
}

function ActiveOverlaysList({
  overlays
}: {
  readonly overlays: RuntimePlayerControlChannelStatus["activeOverlays"];
}): ReactElement {
  if (overlays.length === 0) {
    return (
      <p className="text-sm text-neutral-400">
        No active overlays. Nothing is driving the body from the channel.
      </p>
    );
  }

  return (
    <ul className="grid gap-1">
      {overlays.map((overlay) => (
        <li
          key={overlay.slotId}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        >
          <span className="font-medium">{overlay.slotId}</span>
          {" = "}
          {formatOverlayValue(overlay.value)}
          <span className="text-neutral-400">
            {" "}
            (ttl {Math.max(0, Math.round(overlay.remainingTtlMs))}ms)
          </span>
        </li>
      ))}
    </ul>
  );
}

function RecentEventsList({
  events
}: {
  readonly events: readonly RuntimePlayerControlChannelEvent[];
}): ReactElement {
  if (events.length === 0) {
    return <p className="text-sm text-neutral-400">No events yet.</p>;
  }

  return (
    <ul className="grid gap-1">
      {events.map((event) => (
        <li
          key={event.id}
          className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200"
        >
          {formatEvent(event)}
        </li>
      ))}
    </ul>
  );
}

function formatConnectionLabel(
  connection: RuntimePlayerControlChannelConnectionState
): string {
  if (connection.kind === "connected") {
    return `Connected (protocol ${connection.protocolVersion})`;
  }

  if (connection.kind === "open") {
    return "Open — no client connected";
  }

  return "Closed";
}

function formatOverlayValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatEvent(event: RuntimePlayerControlChannelEvent): string {
  if (event.kind === "accepted") {
    return `✓ intent.set  ${event.slotId ?? ""}  ${
      event.value === undefined ? "" : formatOverlayValue(event.value)
    }`.trimEnd();
  }

  if (event.kind === "rejected") {
    return `✗ rejected  ${event.code ?? "unknown"}`;
  }

  if (event.kind === "connected") {
    return "✓ connected  client";
  }

  return "• disconnected";
}
