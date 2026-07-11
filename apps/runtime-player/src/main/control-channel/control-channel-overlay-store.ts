/**
 * Control Channel overlay store skeleton (C4 §4/§6, Domain A). Records accepted
 * intents as `slotId → { value, expiresAtMs }`. The expiry instant is FIXED at
 * intent-acceptance time (`receivedAtMs + (ttlMs ?? defaultWindowMs)`) — the
 * server computes it and hands it in, so the store itself is time-source free
 * except for the `nowMs` it is queried with.
 *
 * This is the fixture-boundary-OUTSIDE runtime state (裁定1): it holds
 * wall-clock TTLs from WS I/O and never touches the pure generator `sample()`.
 * Domain B wires `getChannelOverlay(nowMs) → snapshot(nowMs)` into the heart tick
 * and owns the TTL-expiry網羅 / Record-merge / disconnect→baseline integration
 * tests. Domain A keeps the store's behaviour to the basics: set / clearAll /
 * snapshot returns un-expired only.
 *
 * There are at most 16 semantic slots, so the map is naturally bounded; a new
 * `setOverlay` for the same slotId overwrites the previous entry.
 */

export type RuntimePlayerControlChannelOverlayEntry = {
  readonly value: number;
  readonly expiresAtMs: number;
};

/**
 * One live overlay for the Channel page's "Active overlays" diagnostic (C4 §1,
 * Domain C). Carries the remaining TTL (`expiresAtMs - nowMs`) so the renderer
 * can show "外から動かされている" with a countdown — the raw `expiresAtMs` (an
 * absolute wall clock) never crosses to the renderer, only the relative remainder.
 */
export type RuntimePlayerControlChannelActiveOverlay = {
  readonly slotId: string;
  readonly value: number;
  readonly remainingTtlMs: number;
};

export class RuntimePlayerControlChannelOverlayStore {
  readonly #entries = new Map<
    string,
    RuntimePlayerControlChannelOverlayEntry
  >();

  /**
   * Record (or overwrite) an accepted intent's overlay. `expiresAtMs` is the
   * absolute wall-clock instant the overlay stops being live, computed once at
   * acceptance time by the server.
   */
  setOverlay(slotId: string, value: number, expiresAtMs: number): void {
    this.#entries.set(slotId, { value, expiresAtMs });
  }

  /** Drop every overlay (client disconnect → 全失効, C4 §4). */
  clearAll(): void {
    this.#entries.clear();
  }

  /**
   * The un-expired overlay values at `nowMs` as a `slotId → value` Record, ready
   * to Record-merge over the generator `activations` in the heart tick. An entry
   * is live strictly before its expiry instant (`expiresAtMs > nowMs`); at
   * exactly `expiresAtMs` it is expired.
   */
  snapshot(nowMs: number): Record<string, number> {
    const live: Record<string, number> = {};

    for (const [slotId, entry] of this.#entries) {
      if (entry.expiresAtMs > nowMs) {
        live[slotId] = entry.value;
      }
    }

    return live;
  }

  /**
   * The un-expired overlays at `nowMs` as diagnostic rows (C4 §1 Active overlays,
   * Domain C read model). Same liveness rule as {@link snapshot} (`expiresAtMs >
   * nowMs`), but each row also exposes the RELATIVE remaining TTL so the Channel
   * page can render a countdown without ever seeing the absolute expiry instant.
   * A pure read — it never mutates or expires entries (Domain B owns expiry).
   */
  activeOverlays(
    nowMs: number
  ): readonly RuntimePlayerControlChannelActiveOverlay[] {
    const live: RuntimePlayerControlChannelActiveOverlay[] = [];

    for (const [slotId, entry] of this.#entries) {
      if (entry.expiresAtMs > nowMs) {
        live.push({
          slotId,
          value: entry.value,
          remainingTtlMs: entry.expiresAtMs - nowMs
        });
      }
    }

    return live;
  }
}
