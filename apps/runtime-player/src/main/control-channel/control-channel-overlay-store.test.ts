import { describe, expect, it } from "vitest";

import { RuntimePlayerControlChannelOverlayStore } from "./control-channel-overlay-store";
import {
  RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS,
  RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE
} from "./slot-curve-state";

/**
 * C5 Domain A: the overlay store is now a single time-evolving SLOT CURVE STATE
 * MACHINE (裁定3). These are the決定論fixture / 性質テスト for the pure store layer
 * (no WS / no timer): an intent列(受理時刻付き) + tick列(nowMs列)[+ baseValues列]
 * → 出力Record列. They pin the smoothstep curve shape, the phase boundaries
 * (attack→sustain→decay→release), the re-attack START (案B, prevResolved), the
 * release TARGET (生きた基底, 裁定2), and the set degenerate-curve外面互換.
 */

function smoothstep(x: number): number {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
}

describe("RuntimePlayerControlChannelOverlayStore — set (degenerate curve)", () => {
  it("holds the set value through its TTL (C4 外面互換: TTL中の値は同一)", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.setOverlay("head-horizontal", 0.4, 1000);

    // attack≈0 → the value is present immediately and held flat through sustain,
    // byte-identical to C4's static overlay while un-expired.
    expect(store.snapshot(500)).toStrictEqual({ "head-horizontal": 0.4 });
    expect(store.snapshot(999)).toStrictEqual({ "head-horizontal": 0.4 });
  });

  it("REPLACES C4 snap: at TTL expiry the set eases to the living base over release", () => {
    // C5 意図的置換 (§2.3): C4 asserted snapshot(expiresAtMs) === {} (instant snap to
    // baseline). C5 keeps the slot in a release blend toward the living base for the
    // universal release window, so the value is STILL present at expiry, not gone.
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.setOverlay("head-horizontal", 0.4, 1000);

    // At exactly expiresAtMs the release begins from the held value (peak), not a snap.
    expect(store.snapshot(1000)).toStrictEqual({ "head-horizontal": 0.4 });

    // Midway through release (200/400) it is easing toward base 0.
    const mid = store.snapshot(1200);
    expect(mid["head-horizontal"]).toBeCloseTo(
      0.4 * (1 - smoothstep(200 / RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS)),
      10
    );

    // After the full release window (1000 + 400) the slot is gone → baseline for free.
    expect(store.snapshot(1400)).toStrictEqual({});
    expect(store.snapshot(1500)).toStrictEqual({});
  });

  it("re-attacks (overwrites) the same slot on a later intent", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.setOverlay("head-horizontal", 0.4, 1000);
    store.setOverlay("head-horizontal", -0.2, 2000);

    expect(store.snapshot(1500)).toStrictEqual({ "head-horizontal": -0.2 });
  });

  it("returns only the still-live subset across multiple slots", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.setOverlay("head-horizontal", 0.4, 1000); // released by 1400
    store.setOverlay("eye-blink-left", 1, 3000);

    // At 1500 head-horizontal has fully released (gone); eye-blink-left still sustains.
    expect(store.snapshot(1500)).toStrictEqual({ "eye-blink-left": 1 });
  });

  it("hard-clears every curve on clearAll (model unload path, no release)", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.setOverlay("head-horizontal", 0.4, 5000);
    store.setOverlay("eye-blink-left", 1, 5000);

    store.clearAll();

    expect(store.snapshot(1000)).toStrictEqual({});
  });
});

describe("RuntimePlayerControlChannelOverlayStore — activeOverlays diagnostic", () => {
  it("reports the RELATIVE remaining drive time, never the absolute instant", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.setOverlay("head-horizontal", 0.4, 1000);

    // remainingTtlMs = end-of-drive - nowMs (= expiresAtMs - nowMs for a set), so
    // the absolute 1000 never crosses to the Channel page.
    expect(store.activeOverlays(700)).toStrictEqual([
      { slotId: "head-horizontal", value: 0.4, remainingTtlMs: 300 }
    ]);
  });

  it("omits released/expired entries and returns [] for an empty store", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    expect(store.activeOverlays(0)).toStrictEqual([]);

    store.setOverlay("head-horizontal", 0.4, 1000);
    store.setOverlay("eye-blink-left", 1, 2000);

    // At 1000 head-horizontal has entered release (not actively driven → omitted);
    // eye-blink-left still drives with 1000ms of drive remaining.
    expect(store.activeOverlays(1000)).toStrictEqual([
      { slotId: "eye-blink-left", value: 1, remainingTtlMs: 1000 }
    ]);
  });
});

describe("RuntimePlayerControlChannelOverlayStore — envelope curve", () => {
  // A representative envelope: attack 100 / sustain 200 / decay 100, release 400.
  const SPEC = { peak: 0.8, attackMs: 100, sustainMs: 200, decayMs: 100 };

  it("pins the smoothstep attack ramp from startValue to peak", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.setEnvelope("mouth-smile", SPEC, 0); // startValue = 0 (no prior effective)

    // attack [0,100): lerp(0, peak, smoothstep(e/100)).
    expect(store.snapshot(0)["mouth-smile"]).toBeCloseTo(0, 10);
    expect(store.snapshot(25)["mouth-smile"]).toBeCloseTo(0.8 * smoothstep(0.25), 10);
    expect(store.snapshot(50)["mouth-smile"]).toBeCloseTo(0.8 * 0.5, 10);
    expect(store.snapshot(75)["mouth-smile"]).toBeCloseTo(0.8 * smoothstep(0.75), 10);
  });

  it("pins the phase boundaries attack→sustain→decay→release", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.setEnvelope("mouth-smile", SPEC, 0);

    // sustain [100,300): held at peak.
    expect(store.snapshot(100)["mouth-smile"]).toBeCloseTo(0.8, 10);
    expect(store.snapshot(200)["mouth-smile"]).toBeCloseTo(0.8, 10);
    // decay [300,400): peak → 0, smoothstep.
    expect(store.snapshot(300)["mouth-smile"]).toBeCloseTo(0.8, 10);
    expect(store.snapshot(350)["mouth-smile"]).toBeCloseTo(0.8 * (1 - 0.5), 10);
    // release [400,800): from 0 → living base (0 here).
    expect(store.snapshot(400)["mouth-smile"]).toBeCloseTo(0, 10);
    // done after the release window.
    expect(store.snapshot(800)).toStrictEqual({});
  });

  it("re-attacks from the CURRENT effective value (案B: prevResolved), no snap", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.setEnvelope("mouth-smile", SPEC, 0);

    // Advance to mid-attack: value is 0.4. The heart would carry this as the next
    // tick's resolvedActivations. Feed it back as prevResolved.
    const before = store.snapshot(50, {}, {})["mouth-smile"];
    expect(before).toBeCloseTo(0.4, 10);
    store.snapshot(50, {}, { "mouth-smile": before ?? 0 }); // cache prevResolved

    // A NEW envelope arrives now (re-attack). startValue must be the current 0.4.
    store.setEnvelope("mouth-smile", { peak: 0.9, attackMs: 100, sustainMs: 100, decayMs: 0 }, 50);
    const after = store.snapshot(50, {}, { "mouth-smile": before ?? 0 })["mouth-smile"];

    // At the re-attack instant the value equals the previous effective value — the
    // curve starts from there, it does not jump to 0 or to the new peak.
    expect(after).toBeCloseTo(before ?? 0, 10);
  });
});

describe("RuntimePlayerControlChannelOverlayStore — release to the living base (裁定2)", () => {
  it("blends to the MOVING base and never re-snaps at the terminal (no frozen base)", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    // Set holds 0.6 until 100, then releases over 400ms (→ 500).
    store.setOverlay("head-horizontal", 0.6, 100);

    // Release starts from the held peak, blended toward the CURRENT base each tick.
    expect(store.snapshot(100, { "head-horizontal": 0.1 })["head-horizontal"]).toBeCloseTo(0.6, 10);
    expect(store.snapshot(300, { "head-horizontal": 0.2 })["head-horizontal"]).toBeCloseTo(
      // lerp(base 0.2, from 0.6, w) with w = 1 - smoothstep(200/400) = 0.5.
      0.2 + (0.6 - 0.2) * (1 - smoothstep(0.5)),
      10
    );

    // Just before the terminal the value already tracks the (constant near end) base…
    const nearEnd = store.snapshot(499, { "head-horizontal": 0.3 })["head-horizontal"];
    expect(nearEnd).toBeCloseTo(0.3, 3);
    // …and at the terminal the slot returns exactly the LIVING base (not a frozen 0),
    // then is pruned — so the hand-off to baseline is continuous (no terminal snap).
    expect(store.snapshot(500, { "head-horizontal": 0.3 })).toStrictEqual({});
  });

  it("releaseAll forces every live slot into a release from its current value", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.setOverlay("head-horizontal", 0.6, 100000); // long-lived
    store.setOverlay("head-vertical", -0.4, 100000);

    // Prime the base cache (release target) and observe both driving at peak.
    const driving = store.snapshot(1000, { "head-horizontal": 0, "head-vertical": 0 });
    expect(driving).toStrictEqual({ "head-horizontal": 0.6, "head-vertical": -0.4 });

    // Disconnect at 1000: both switch to a forced release from their current value.
    store.releaseAll(1000);

    // Immediately after, both still present at their hand-off value (no snap).
    const atStart = store.snapshot(1000, { "head-horizontal": 0, "head-vertical": 0 });
    expect(atStart["head-horizontal"]).toBeCloseTo(0.6, 10);
    expect(atStart["head-vertical"]).toBeCloseTo(-0.4, 10);

    // Fully released after 400ms → both gone (baseline).
    expect(store.snapshot(1400, { "head-horizontal": 0, "head-vertical": 0 })).toStrictEqual({});
  });
});

describe("RuntimePlayerControlChannelOverlayStore — continuity property (導出bound)", () => {
  it("keeps every adjacent-tick step within the DERIVED bound (スナップ不在)", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    const spec = { peak: 0.8, attackMs: 100, sustainMs: 200, decayMs: 100 };
    store.setEnvelope("mouth-smile", spec, 0);

    const frameIntervalMs = 16;
    const releaseMs = RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS;
    const base = 0; // constant living base → no base-movement term.

    // Per-tick bound = max phase amplitude/duration × smoothstep max slope × frame
    // interval. NO magic number — every factor is a curve parameter (レビュー blocking).
    const attackStep =
      (Math.abs(spec.peak - 0) / spec.attackMs) *
      RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE *
      frameIntervalMs;
    const decayStep =
      (Math.abs(spec.peak - 0) / spec.decayMs) *
      RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE *
      frameIntervalMs;
    const releaseStep =
      (Math.abs(0 - base) / releaseMs) *
      RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE *
      frameIntervalMs;
    const bound = Math.max(attackStep, decayStep, releaseStep);

    // Walk the whole life attack→sustain→decay→release at 60Hz and check every step.
    let previous: number | undefined;
    for (let now = 0; now <= 800; now += frameIntervalMs) {
      const value = store.snapshot(now, { "mouth-smile": base })["mouth-smile"] ?? base;
      if (previous !== undefined) {
        expect(Math.abs(value - previous)).toBeLessThanOrEqual(bound);
      }
      previous = value;
    }
  });

  it("keeps every adjacent step within the DERIVED bound across a re-attack seam (重ねがけ)", () => {
    // Coverage穴#1 (lane3 test-adequacy): the point check at re-attack (after≈before)
    // is generalised to a full bound-WALK that CROSSES the seam. A new envelope lands
    // mid-attack of the first; its startValue = the current effective value (案B,
    // prevResolved) so the seam step is ~0, and EVERY adjacent tick — before, across,
    // and after the re-attack — stays within a bound DERIVED from BOTH curves'
    // parameters (no magic number).
    const store = new RuntimePlayerControlChannelOverlayStore();
    const slot = "mouth-smile";
    const specA = { peak: 0.8, attackMs: 240, sustainMs: 160, decayMs: 240 };
    const specB = { peak: 0.5, attackMs: 240, sustainMs: 160, decayMs: 240 };
    const reAttackAtMs = 96; // mid-attack of A
    const base = 0; // constant living base → no base-movement term.

    store.setEnvelope(slot, specA, 0);

    const frameIntervalMs = 16;
    const releaseMs = RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS;
    // The value never leaves [0, maxPeak], so any attack/re-attack amplitude
    // (|peak - startValue|) and any decay amplitude (peak → 0) is ≤ maxPeak. Dividing
    // the widest span by the SHORTEST phase duration upper-bounds every per-tick step
    // of either curve. Every factor is a spec field or the exposed max-slope constant.
    const maxPeak = Math.max(specA.peak, specB.peak);
    const attackStep =
      (maxPeak / Math.min(specA.attackMs, specB.attackMs)) *
      RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE *
      frameIntervalMs;
    const decayStep =
      (maxPeak / Math.min(specA.decayMs, specB.decayMs)) *
      RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE *
      frameIntervalMs;
    const releaseStep =
      (maxPeak / releaseMs) * RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE * frameIntervalMs;
    const bound = Math.max(attackStep, decayStep, releaseStep);

    // Walk from before the re-attack through the whole life of B, threading
    // prevResolved back each tick exactly as the heart would (案B).
    const endMs =
      reAttackAtMs + specB.attackMs + specB.sustainMs + specB.decayMs + releaseMs;
    let previous: number | undefined;
    let prevResolved: Record<string, number> = {};
    for (let now = 0; now <= endMs; now += frameIntervalMs) {
      if (now === reAttackAtMs) {
        // Refresh the store's prevResolved cache to the last tick's value FIRST, then
        // the re-attack's startValue = that current effective value (no snap).
        store.snapshot(now, { [slot]: base }, prevResolved);
        store.setEnvelope(slot, specB, now);
      }
      const value =
        store.snapshot(now, { [slot]: base }, prevResolved)[slot] ?? base;
      if (previous !== undefined) {
        expect(Math.abs(value - previous)).toBeLessThanOrEqual(bound);
      }
      previous = value;
      prevResolved = { [slot]: value };
    }
  });

  it("stays continuous through envelope decay over a NON-ZERO moving base (characterization)", () => {
    // Coverage穴#2/#4 + lane3 質問2: an envelope over a livingBase that is NON-ZERO
    // AND moves every tick. This FIXES (characterizes) the current implementation:
    // decay drops peak→0 base-INDEPENDENTLY (slot-curve-state.ts:124), so the value
    // dips BELOW the living base, then release blends 0→livingBase back up. The
    // dip-below-base is documented 現行 behavior — decay's target semantics are NOT
    // changed here (裁定事項). The whole walk must stay within the derived bound
    // (continuity is absorbed by the release blend).
    const store = new RuntimePlayerControlChannelOverlayStore();
    const slot = "mouth-smile";
    const spec = { peak: 0.8, attackMs: 100, sustainMs: 100, decayMs: 100 };

    const frameIntervalMs = 16;
    const releaseMs = RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS;
    const walkEndMs = spec.attackMs + spec.sustainMs + spec.decayMs + releaseMs; // 700
    // Non-zero base that MOVES every tick: a bounded linear ramp 0.3 → 0.5. Its own
    // per-tick delta is derivable (slope × frame interval) and used as the base-
    // movement term of the bound — the moving-base contribution is not a magic number.
    const baseStart = 0.3;
    const baseEnd = 0.5;
    const baseSlopePerMs = (baseEnd - baseStart) / walkEndMs;
    const livingBaseAt = (t: number) => baseStart + baseSlopePerMs * t;
    const baseMovementStep = baseSlopePerMs * frameIntervalMs;

    // Prime the living-base cache so the envelope's startValue = the current effective
    // value (= base at t0); then the onset from base into attack is smooth (no snap).
    store.snapshot(0, { [slot]: livingBaseAt(0) }, {});
    store.setEnvelope(slot, spec, 0);

    const attackStep =
      (Math.abs(spec.peak - baseStart) / spec.attackMs) *
      RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE *
      frameIntervalMs;
    const decayStep =
      (Math.abs(spec.peak - 0) / spec.decayMs) *
      RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE *
      frameIntervalMs;
    // Release blends 0 → livingBase; its w-driven amplitude ≤ the largest base value.
    const releaseStep =
      (Math.abs(0 - baseEnd) / releaseMs) *
      RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE *
      frameIntervalMs;
    // The moving base adds at most baseMovementStep per tick on top of the w-driven
    // release step; adding it globally is a safe (conservative) upper bound.
    const bound = Math.max(attackStep, decayStep, releaseStep) + baseMovementStep;

    let previous: number | undefined;
    let sawDipBelowBase = false;
    for (let now = 0; now <= walkEndMs; now += frameIntervalMs) {
      const b = livingBaseAt(now);
      const value = store.snapshot(now, { [slot]: b }, {})[slot] ?? b;
      if (previous !== undefined) {
        expect(Math.abs(value - previous)).toBeLessThanOrEqual(bound);
      }
      if (value < b - 1e-9) {
        sawDipBelowBase = true;
      }
      previous = value;
    }
    // The characterization: the value DID dip below the (non-zero) living base — the
    // documented decay-to-0 semantics — yet the whole walk stayed within the derived
    // bound (continuous, no snap).
    expect(sawDipBelowBase).toBe(true);
  });
});
