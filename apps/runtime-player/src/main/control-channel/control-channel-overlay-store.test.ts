import { describe, expect, it } from "vitest";

import { RuntimePlayerControlChannelOverlayStore } from "./control-channel-overlay-store";
import {
  RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS,
  RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_SET_ATTACK_MS,
  RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE
} from "./slot-curve-state";
import {
  RUNTIME_PLAYER_SPEECH_DIP_FLOOR,
  RUNTIME_PLAYER_SPEECH_DIP_MS,
  RUNTIME_PLAYER_SPEECH_MOUTH_GROUP_SLOTS,
  RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT,
  RUNTIME_PLAYER_SPEECH_ONSET_MS,
  RUNTIME_PLAYER_SPEECH_OPEN_SCALE,
  RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS,
  type SpeechMora
} from "./speech-timeline-state";

/**
 * C5 Domain A: the overlay store is now a single time-evolving SLOT CURVE STATE
 * MACHINE (裁定3). These are the決定論fixture / 性質テスト for the pure store layer
 * (no WS / no timer): an intent列(受理時刻付き) + tick列(nowMs列)[+ baseValues列]
 * → 出力Record列. They pin the smoothstep curve shape, the phase boundaries
 * (attack→sustain→decay→release), the re-attack START (案B, prevResolved), the
 * release TARGET (生きた基底, 裁定2), and the set degenerate curve's default ease-in
 * (§7 裁定3 改定: attack≈100ms, absorbed out of sustain so drive-end=TTL is不変).
 */

function smoothstep(x: number): number {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
}

describe("RuntimePlayerControlChannelOverlayStore — set (degenerate curve)", () => {
  it("eases in over the default attack then holds the value flat through its TTL", () => {
    // §7 裁定3 改定 (2026-07-11): 意図的置換. C4/前実装 pinned「set=即時適用 (attack≈0),
    // byte-identical to C4's static overlay」. C5 追撃 makes a set ease startValue→value
    // over the default ~100ms smoothstep, THEN hold flat at value through sustain until
    // TTL — 連続性原則をattackにも貫徹. These sample points are past the ease-in, in the
    // sustain plateau, so they still read the held value (the ramp itself is pinned by
    // the dedicated ease-in test below).
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.setOverlay("head-horizontal", 0.4, 1000); // startAtMs = 0 (no prior snapshot)

    expect(store.snapshot(500)).toStrictEqual({ "head-horizontal": 0.4 });
    expect(store.snapshot(999)).toStrictEqual({ "head-horizontal": 0.4 });
  });

  it("eases in over the default ~100ms attack (smoothstep), NOT an instant step", () => {
    // §7 裁定3 改定: the ramp itself. startValue = 0 (no prior effective), attack
    // [0, DEFAULT_SET_ATTACK_MS): lerp(0, peak, smoothstep(e/attack)). t=0近傍 is far
    // below peak (proof it is NOT the old instant jump to `value`).
    const store = new RuntimePlayerControlChannelOverlayStore();
    const peak = 0.4;
    const attack = RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_SET_ATTACK_MS;
    store.setOverlay("head-horizontal", peak, 1000); // startAtMs = 0

    expect(store.snapshot(0)["head-horizontal"]).toBeCloseTo(0, 10);
    expect(store.snapshot(attack * 0.25)["head-horizontal"]).toBeCloseTo(
      peak * smoothstep(0.25),
      10
    );
    expect(store.snapshot(attack * 0.5)["head-horizontal"]).toBeCloseTo(peak * 0.5, 10);
    expect(store.snapshot(attack * 0.75)["head-horizontal"]).toBeCloseTo(
      peak * smoothstep(0.75),
      10
    );
    // t=0近傍 (1ms in) is nowhere near the peak — the old attack≈0 would already be at peak.
    expect(store.snapshot(1)["head-horizontal"] ?? 0).toBeLessThan(peak * 0.5);
    // Reaches the peak exactly at the end of the ease-in, then holds it.
    expect(store.snapshot(attack)["head-horizontal"]).toBeCloseTo(peak, 10);
  });

  it("preserves the TTL: drive-end stays at expiresAtMs (attack absorbed out of sustain)", () => {
    // TTL不変 is the absolute condition of the §7 改定: the ease-in is absorbed out of
    // sustain, so activeOverlays' remainingTtlMs (= driveEnd - nowMs = expiresAtMs -
    // nowMs) is unchanged from C4, and the drive ends exactly at expiresAtMs.
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.setOverlay("head-horizontal", 0.4, 1000); // startAtMs 0, expiresAt 1000

    // Just past the ease-in and deep in sustain, the countdown targets expiresAtMs.
    expect(store.activeOverlays(100)[0]?.remainingTtlMs).toBe(900);
    expect(store.activeOverlays(700)[0]?.remainingTtlMs).toBe(300);
    // At expiresAtMs the drive has ended (only the release tail remains) → omitted.
    expect(store.activeOverlays(1000)).toStrictEqual([]);
  });

  it("clamps the ease-in to a short TTL window so sustain never goes negative", () => {
    // window (40ms) < default attack (100ms): the whole window becomes the ease-in
    // (attack = window, sustain = 0, decay = 0). drive-end still lands on expiresAtMs.
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.setOverlay("head-horizontal", 0.4, 40); // startAtMs 0, window 40

    expect(store.snapshot(0)["head-horizontal"]).toBeCloseTo(0, 10);
    expect(store.snapshot(20)["head-horizontal"]).toBeCloseTo(0.4 * smoothstep(0.5), 10);
    // At the window end the ease-in has reached peak and release begins from it (no snap).
    expect(store.snapshot(40)["head-horizontal"]).toBeCloseTo(0.4, 10);
    // drive-end = expiresAtMs (40): TTL不変 even in the clamped case.
    expect(store.activeOverlays(0)[0]?.remainingTtlMs).toBe(40);
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
  it("keeps every adjacent-tick step of the set ease-in within the DERIVED bound", () => {
    // §7 裁定3 改定: the set is now an ease-in, so its continuity must be pinned too.
    // Walk the whole set life ease-in→sustain→(expiry)→release at 60Hz and check every
    // adjacent step stays within a bound DERIVED from the set curve's own parameters —
    // the default attack, the default release, the peak, the frame interval, and the
    // exposed max-slope constant. NO magic number (レビュー blocking観点).
    const store = new RuntimePlayerControlChannelOverlayStore();
    const peak = 0.8;
    const expiresAtMs = 1000;
    store.setOverlay("head-horizontal", peak, expiresAtMs); // startAtMs 0, default ease-in

    const attackMs = RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_SET_ATTACK_MS;
    const frameIntervalMs = 16;
    const releaseMs = RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS;
    const base = 0; // constant living base → no base-movement term.

    // Ease-in ramps |peak - startValue(0)| over attackMs; release blends |peak - base|
    // over releaseMs. Each × smoothstep max slope × frame interval upper-bounds a tick.
    const attackStep =
      (Math.abs(peak - 0) / attackMs) *
      RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE *
      frameIntervalMs;
    const releaseStep =
      (Math.abs(peak - base) / releaseMs) *
      RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE *
      frameIntervalMs;
    const bound = Math.max(attackStep, releaseStep);

    let previous: number | undefined;
    for (let now = 0; now <= expiresAtMs + releaseMs; now += frameIntervalMs) {
      const value =
        store.snapshot(now, { "head-horizontal": base })["head-horizontal"] ?? base;
      if (previous !== undefined) {
        expect(Math.abs(value - previous)).toBeLessThanOrEqual(bound);
      }
      previous = value;
    }
  });

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

/**
 * C6 Domain A: the store now also holds a single SPEECH TIMELINE group evaluator
 * (setSpeech). These tests pin the STORE integration — the group's 6 mouth values land
 * in the snapshot Record, the 後着置換 arbitration (group ↔ per-slot never both live on a
 * mouth slot), 切断release (releaseAll), and that the whole thing is additive (the
 * curve-only paths above are unchanged). The pure evaluator math is pinned in
 * speech-timeline-state.test.ts.
 */
const PHRASE: readonly SpeechMora[] = [
  { timeMs: 0, vowel: "a", s: 0.6 },
  { timeMs: 140, vowel: "i", s: 0.8 },
  { timeMs: 280, vowel: "o", s: 0.6 }
];

function vowelSumOf(snap: Record<string, number>): number {
  return (
    (snap[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.a] ?? 0) +
    (snap[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.i] ?? 0) +
    (snap[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.u] ?? 0) +
    (snap[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.e] ?? 0) +
    (snap[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.o] ?? 0)
  );
}

describe("RuntimePlayerControlChannelOverlayStore — speech timeline (C6 group)", () => {
  it("drives the 6 mouth-group slots from a mora列, convex identity intact", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.snapshot(0); // anchor lastNowMs
    store.setSpeech(PHRASE, 0);

    // Mid-segment [0,140] (p≈0.5 at e=70): both a and i active, Σvowel = mouth.open.
    const snap = store.snapshot(70);
    expect(vowelSumOf(snap)).toBeCloseTo(
      snap[RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT] ?? 0,
      9
    );
    expect(snap[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.a] ?? 0).toBeGreaterThan(0);
    expect(snap[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.i] ?? 0).toBeGreaterThan(0);
    // A non-mouth generator slot is untouched by the group (only the 6 are written).
    expect(snap["head-horizontal"]).toBeUndefined();
  });

  it("prunes the timeline after the terminal release (mouth returns to base)", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.snapshot(0);
    store.setSpeech(PHRASE, 0);

    // hold = last interval 140ms after the last mora (280) then 400ms release → gone.
    expect(store.snapshot(300)[RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT] ?? 0).toBeGreaterThan(0);
    expect(store.snapshot(280 + 140 + 400 + 50)).toStrictEqual({});
  });

  it("replaces a timeline only when the next accepted speech write arrives; snapshots do not replay an older timeline", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    const first: readonly SpeechMora[] = [
      { timeMs: 0, vowel: "a", s: 0.6 },
      { timeMs: 140, vowel: "i", s: 0.8 }
    ];
    const second: readonly SpeechMora[] = [
      { timeMs: 0, vowel: "u", s: 0.7 },
      { timeMs: 140, vowel: "e", s: 0.5 }
    ];
    store.snapshot(0);
    store.setSpeech(first, 0);

    // The Runtime has no AudioPlayer terminal signal. Until Soul's FIFO boundary
    // sends the next accepted request, successive heart snapshots keep this first
    // timeline; an old/duplicate audio callback cannot cause a replacement here.
    const beforeReplacement = store.snapshot(100);
    const stillFirst = store.snapshot(120, {}, beforeReplacement);
    expect(stillFirst[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.a] ?? 0).toBeGreaterThan(0);
    expect(stillFirst[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.u] ?? 0).toBe(0);

    // This explicit later accepted write is the sole replacement seam. It is the
    // Wave-2 queue→channel adapter's responsibility to call it in WAV playback order.
    store.setSpeech(second, 140);
    const replaced = store.snapshot(140, {}, stillFirst);
    expect(replaced[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.u] ?? 0).toBeGreaterThan(0);
    expect(replaced[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.a] ?? 0).toBe(0);
    expect(vowelSumOf(replaced)).toBeCloseTo(
      replaced[RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT] ?? 0,
      9
    );
  });

  it("setSpeech drops any per-slot curve on the 6 mouth slots (group takes over, no competition)", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    // A per-slot envelope is driving a vowel slot BEFORE speech.
    store.setEnvelope(
      RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.a,
      { peak: 0.9, attackMs: 100, sustainMs: 1000, decayMs: 0 },
      0
    );
    expect(store.snapshot(200)[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.a]).toBeCloseTo(0.9, 6);

    // Speech arrives → the per-slot curve on mouth-vowel-a is dropped; the group owns it.
    store.setSpeech(PHRASE, 200);
    const snap = store.snapshot(270); // mid-segment [200,340]
    // mouth-vowel-a is now the GROUP value (part of a→i cross-fade), NOT the 0.9 curve,
    // and the convex identity holds → proof the group solely owns the slot.
    expect(vowelSumOf(snap)).toBeCloseTo(snap[RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT] ?? 0, 9);
    expect(snap[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.a] ?? 0).toBeLessThan(0.9);
  });

  it("a per-slot mouth intent DURING speech forced-releases the group; per-slot wins its slot", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.snapshot(0);
    store.setSpeech(PHRASE, 0);
    // Thread prevResolved as the heart would, so the per-slot re-attacks continuously.
    const mid = store.snapshot(70, {}, {});
    store.snapshot(70, {}, mid);

    // A per-slot envelope now targets mouth-vowel-a → the group yields (forced release),
    // the per-slot curve takes that slot over.
    store.setEnvelope(
      RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.a,
      { peak: 0.95, attackMs: 100, sustainMs: 1000, decayMs: 0 },
      70
    );
    // After the per-slot attack completes, mouth-vowel-a shows the PER-SLOT peak (0.95),
    // which the group (whose s is scaled to ≤0.8) could never produce — proof per-slot won.
    const after = store.snapshot(200, {}, mid);
    expect(after[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.a] ?? 0).toBeCloseTo(0.95, 6);

    // The group's OTHER mouth slots eased to base over the release (no lingering group);
    // once the group is fully released, only the per-slot curve remains — exactly one
    // owner per slot (mouth-open is only ever the group's, so it is absent = base 0).
    const settled = store.snapshot(70 + RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS + 50, {}, mid);
    expect(settled[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.i]).toBeUndefined();
    expect(settled[RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT]).toBeUndefined();
    // The per-slot curve on mouth-vowel-a still drives (its long sustain), sole owner.
    expect(settled[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.a] ?? 0).toBeCloseTo(0.95, 6);
  });

  it("releaseAll eases the group's 6 slots from their current values to base (切断→閉口)", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.snapshot(0);
    store.setSpeech(PHRASE, 0);

    const driving = store.snapshot(210); // mid-segment [140,280], group active
    expect(driving[RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT] ?? 0).toBeGreaterThan(0);

    store.releaseAll(210);
    // Immediately after: still present at the hand-off value (no snap), identity intact.
    const atStart = store.snapshot(210);
    expect(atStart[RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT] ?? 0).toBeGreaterThan(0);
    expect(vowelSumOf(atStart)).toBeCloseTo(atStart[RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT] ?? 0, 9);

    // Fully closed after the release window → all 6 gone (base 0).
    expect(store.snapshot(210 + RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS)).toStrictEqual({});
  });

  it("keeps every adjacent-tick step within a DERIVED bound across a setSpeech→releaseAll walk", () => {
    // 連続性 bound (same derivation as the pure evaluator test): the two steepest
    // smoothstep factors that can coincide at a boundary are the onset (full 0→valueRange
    // over ONSET_MS) and the dip ((1−FLOOR)·value over DIP_MS). The forced-release tail
    // (releaseMs) and the cross-fade (mora interval) are shallower and are NOT summed in
    // (the old 4-way sum inflated the bound past the value range → vacuous). NO magic
    // number: every factor is an evaluator constant.
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.snapshot(0);
    store.setSpeech(PHRASE, 0);

    const frameIntervalMs = 16;
    const releaseMs = RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS;
    const slope = RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE;
    const maxS = Math.max(...PHRASE.map((m) => m.s));
    const valueRange = RUNTIME_PLAYER_SPEECH_OPEN_SCALE * maxS; // no slot exceeds this.

    const onsetSlopePerMs = slope / RUNTIME_PLAYER_SPEECH_ONSET_MS;
    const dipSlopePerMs =
      (slope * (1 - RUNTIME_PLAYER_SPEECH_DIP_FLOOR)) / RUNTIME_PLAYER_SPEECH_DIP_MS;
    const bound = valueRange * (onsetSlopePerMs + dipSlopePerMs) * frameIntervalMs;

    // GATE (kills the vacuous case): a bound ≥ valueRange could never catch a whole-range
    // snap, so it must be strictly below the value range to be a real no-snap guard.
    expect(bound).toBeLessThan(valueRange);

    let previous: Record<string, number> | undefined;
    let observedMax = 0;
    for (let now = 0; now <= 280 + releaseMs + 200; now += frameIntervalMs) {
      if (now === 160) {
        store.releaseAll(now); // disconnect mid-utterance
      }
      const snap = store.snapshot(now);
      if (previous !== undefined) {
        for (const slot of RUNTIME_PLAYER_SPEECH_MOUTH_GROUP_SLOTS) {
          const step = Math.abs((snap[slot] ?? 0) - (previous[slot] ?? 0));
          observedMax = Math.max(observedMax, step);
          expect(step).toBeLessThanOrEqual(bound);
        }
      }
      previous = { ...snap };
    }
    // The real walk stays well under the bound — the gate has genuine headroom.
    expect(observedMax).toBeLessThan(bound);
  });

  it("clearAll drops the speech timeline immediately (model unload path)", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    store.snapshot(0);
    store.setSpeech(PHRASE, 0);
    expect(store.snapshot(70)[RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT] ?? 0).toBeGreaterThan(0);

    store.clearAll();
    expect(store.snapshot(70)).toStrictEqual({});
  });

  it("group re-attacks from the current effective mouth-open when speech starts mid per-slot drive (§12項目2)", () => {
    // 同時ケース: a per-slot curve holds mouth-open OPEN when speech arrives. The group must
    // lift FROM that effective value (案B prevResolved feedback), NOT snap to 0 (the old
    // delete専有). This is the forward version of the existing reverse re-attack.
    const store = new RuntimePlayerControlChannelOverlayStore();
    const openSlot = RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT;

    // Drive mouth-open per-slot to a steady 0.5, threading prevResolved as the heart would
    // so the store's effective-value feedback holds 0.5 at speech start.
    store.setOverlay(openSlot, 0.5, 100000);
    let prevResolved: Record<string, number> = {};
    let live: Record<string, number> = {};
    for (let now = 0; now <= 200; now += 16) {
      live = store.snapshot(now, {}, prevResolved);
      prevResolved = { ...live };
    }
    expect(live[openSlot] ?? 0).toBeCloseTo(0.5, 6); // set curve in sustain at 0.5

    // Speech starts NOW. The per-slot mouth-open curve is dropped; the group takes over.
    store.setSpeech(PHRASE, 200);

    // At the seam the group's mouth-open == the captured 0.5 (continuous), NOT ~0.
    const atSeam = store.snapshot(200, {}, prevResolved);
    expect(atSeam[openSlot] ?? 0).toBeCloseTo(0.5, 6);
    expect(atSeam[openSlot] ?? 0).toBeGreaterThan(0.4); // proves no snap-down to base 0.
    expect(vowelSumOf(atSeam)).toBeCloseTo(atSeam[openSlot] ?? 0, 9); // identity at the seam.

    // Continuity: mouth-open steps within a bound DERIVED from the onset blend range + dip
    // (floor = the evaluator's default here — no provider). NO magic number.
    const frameIntervalMs = 16;
    const slope = RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE;
    const maxS = Math.max(...PHRASE.map((m) => m.s));
    const valueRange = RUNTIME_PLAYER_SPEECH_OPEN_SCALE * maxS;
    const onsetRange = Math.max(valueRange, 0.5); // widest the onset lerp can swing.
    const onsetSlopePerMs = slope / RUNTIME_PLAYER_SPEECH_ONSET_MS;
    const dipSlopePerMs =
      (slope * (1 - RUNTIME_PLAYER_SPEECH_DIP_FLOOR)) / RUNTIME_PLAYER_SPEECH_DIP_MS;
    const bound = onsetRange * (onsetSlopePerMs + dipSlopePerMs) * frameIntervalMs;

    let previousOpen = atSeam[openSlot] ?? 0;
    for (let now = 216; now <= 200 + 280 + 200; now += frameIntervalMs) {
      const open = store.snapshot(now)[openSlot] ?? 0;
      expect(Math.abs(open - previousOpen)).toBeLessThanOrEqual(bound);
      previousOpen = open;
    }
  });

  it("reads the Articulation dip floor from the provider each snapshot (即時反映, §13)", () => {
    // The provider is read fresh EACH snapshot, so moving the Articulation slider changes
    // the dip depth on the spot. Same nowMs (same phase), only the floor differs → a deeper
    // floor (crisp) leaves the boundary mouth LESS open than a soft floor (barely dips).
    let floor = RUNTIME_PLAYER_SPEECH_DIP_FLOOR; // crisp / deep dip
    const store = new RuntimePlayerControlChannelOverlayStore({
      dipFloorProvider: () => floor
    });
    const openSlot = RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT;
    const oRun: readonly SpeechMora[] = [
      { timeMs: 0, vowel: "o", s: 0.6 },
      { timeMs: 140, vowel: "o", s: 0.6 },
      { timeMs: 280, vowel: "o", s: 0.6 }
    ];
    store.snapshot(0);
    store.setSpeech(oRun, 0);

    // At the boundary (140), past onset, the dip is at the floor.
    const deep = store.snapshot(140)[openSlot] ?? 0;
    floor = 0.95; // slider moved toward「barely dips」— read on the NEXT snapshot.
    const shallow = store.snapshot(140)[openSlot] ?? 0;
    expect(shallow).toBeGreaterThan(deep);
  });
});
