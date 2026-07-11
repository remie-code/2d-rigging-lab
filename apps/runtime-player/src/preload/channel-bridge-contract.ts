/**
 * Control Channel bridge contract (C4 Domain C, UX c4-channel-diagnostics.md §1/§2).
 * The renderer-facing surface for the Channel page and the Autonomous Overview's
 * Channel card. A parallel duplicate of the Physiology bridge contract.
 *
 * Exposure boundary (C4 §4 規律): everything crossing to the renderer is diagnostic
 * DATA — connection state, the Endpoint URL (the ONLY place the token surfaces, as a
 * URL構成要素 for the one-line 魂側 setup), Active overlays (slotId + value + the
 * RELATIVE remaining TTL), and a session-only Recent Events log. No seed, no raw
 * internal slot, no secret other than the token-in-URL ever crosses. `available` is
 * DATA (自律のみ true), never a role query — the Tracking Host renders the empty page.
 */

/**
 * The connection state, mirrored from the server's own state machine (Domain A
 * `getState()`): Closed / Open (listening, no client) / Connected (protocol版).
 * `protocolVersion` is a plain number here so the renderer/preload layer stays
 * self-contained — it never imports the main-process wire contract. The bridge
 * handler (main) maps the authoritative types onto this shape.
 */
export type RuntimePlayerControlChannelConnectionState =
  | { readonly kind: "closed" }
  | { readonly kind: "open" }
  | {
      readonly kind: "connected";
      readonly protocolVersion: number;
    };

/** One live overlay row (slotId=value with a countdown), C4 §1 Active overlays. */
export type RuntimePlayerControlChannelActiveOverlayView = {
  readonly slotId: string;
  readonly value: number;
  readonly remainingTtlMs: number;
};

/**
 * One Recent Events row (C4 §1). Session-only; the log lives in the main-process
 * channel state as a ring buffer and never persists. `id` is a monotonic sequence
 * used only as a stable render key.
 */
export type RuntimePlayerControlChannelEvent = {
  readonly id: number;
  readonly kind: "accepted" | "rejected" | "connected" | "disconnected";
  readonly slotId?: string;
  readonly value?: number;
  /** The enumerated rejection reason (`slotValueOutOfRange` 等), for rejected rows. */
  readonly code?: string;
};

export type RuntimePlayerControlChannelStatus = {
  /**
   * Whether this host HAS a control channel subsystem — DATA, not a role query
   * (C4 §4). The channel is autonomous-host専有 (裁定2): the Autonomous Host owns a
   * channel (available = true); the Tracking Host has none (available = false → the
   * renderer shows the one-line empty page). Neither renderer nor main branches on
   * `if (role === ...)`.
   */
  readonly available: boolean;
  readonly connection: RuntimePlayerControlChannelConnectionState;
  /**
   * `ws://127.0.0.1:<port>/channel?token=…`, present only while Open/Connected (the
   * listening port is unknown until the server binds). Null when Closed or on the
   * Tracking Host. This is the ONLY renderer surface the token appears on.
   */
  readonly endpointUrl: string | null;
  readonly activeOverlays: readonly RuntimePlayerControlChannelActiveOverlayView[];
  readonly recentEvents: readonly RuntimePlayerControlChannelEvent[];
  readonly revision: number;
  readonly updatedAtIso: string;
};

export type RuntimePlayerControlChannelActionResultKind =
  | "ok"
  | "unavailable"
  | "error";

export type RuntimePlayerControlChannelActionResult = {
  readonly result: RuntimePlayerControlChannelActionResultKind;
  readonly message: string;
  readonly status: RuntimePlayerControlChannelStatus;
};

export type RuntimePlayerControlChannelApi = {
  readonly getStatus: () => Promise<RuntimePlayerControlChannelStatus>;
  readonly openChannel: () => Promise<RuntimePlayerControlChannelActionResult>;
  readonly closeChannel: () => Promise<RuntimePlayerControlChannelActionResult>;
  readonly onStatusChanged: (
    callback: (status: RuntimePlayerControlChannelStatus) => void
  ) => () => void;
};
