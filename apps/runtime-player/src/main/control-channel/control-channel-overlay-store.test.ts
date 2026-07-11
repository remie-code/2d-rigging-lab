import { describe, expect, it } from "vitest";

import { RuntimePlayerControlChannelOverlayStore } from "./control-channel-overlay-store";

describe("RuntimePlayerControlChannelOverlayStore", () => {
  it("snapshots a set overlay while it is un-expired", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.setOverlay("head-horizontal", 0.4, 1000);

    expect(store.snapshot(500)).toStrictEqual({ "head-horizontal": 0.4 });
  });

  it("omits an overlay at and after its expiry instant", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.setOverlay("head-horizontal", 0.4, 1000);

    // Live strictly before expiry; expired at exactly expiresAtMs.
    expect(store.snapshot(999)).toStrictEqual({ "head-horizontal": 0.4 });
    expect(store.snapshot(1000)).toStrictEqual({});
    expect(store.snapshot(1001)).toStrictEqual({});
  });

  it("overwrites the same slot on a later set", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.setOverlay("head-horizontal", 0.4, 1000);
    store.setOverlay("head-horizontal", -0.2, 2000);

    expect(store.snapshot(1500)).toStrictEqual({ "head-horizontal": -0.2 });
  });

  it("returns only the un-expired subset across multiple slots", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.setOverlay("head-horizontal", 0.4, 1000);
    store.setOverlay("eye-blink-left", 1, 3000);

    expect(store.snapshot(1500)).toStrictEqual({ "eye-blink-left": 1 });
  });

  it("clears every overlay on clearAll", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.setOverlay("head-horizontal", 0.4, 5000);
    store.setOverlay("eye-blink-left", 1, 5000);

    store.clearAll();

    expect(store.snapshot(1000)).toStrictEqual({});
  });

  it("activeOverlays reports the RELATIVE remaining TTL, never the absolute expiry", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.setOverlay("head-horizontal", 0.4, 1000);

    // remainingTtlMs = expiresAtMs - nowMs (relative), so the absolute 1000 never
    // crosses to the Channel page.
    expect(store.activeOverlays(700)).toStrictEqual([
      { slotId: "head-horizontal", value: 0.4, remainingTtlMs: 300 }
    ]);
  });

  it("activeOverlays omits expired entries and returns [] for an empty store", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    expect(store.activeOverlays(0)).toStrictEqual([]);

    store.setOverlay("head-horizontal", 0.4, 1000);
    store.setOverlay("eye-blink-left", 1, 2000);

    // Same liveness as snapshot: live strictly before expiry, gone at/after it.
    expect(store.activeOverlays(1000)).toStrictEqual([
      { slotId: "eye-blink-left", value: 1, remainingTtlMs: 1000 }
    ]);
  });
});
