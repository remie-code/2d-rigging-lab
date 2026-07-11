import { describe, expect, it, vi } from "vitest";

import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import type { RuntimePlayerMappingSlot } from "../../preload/model-mapping-bridge-contract";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import {
  BODY_X_SLOT_ID,
  BODY_Z_SLOT_ID,
  type PhysiologyGenerator
} from "../physiology";
import { RuntimePlayerControlChannelOverlayStore } from "../control-channel/control-channel-overlay-store";
import {
  RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS,
  RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE
} from "../control-channel/slot-curve-state";
import {
  createAutonomousFrameHeart,
  type CreateAutonomousFrameHeartInput
} from "./autonomous-frame-heart";

/**
 * C5 Domain A: the Control Channel overlay is now a SLOT CURVE STATE MACHINE that
 * evolves through the frame heart tick. These tests pin, THROUGH the heart tick (the
 * observable boundary):
 *  - Record-merge priority while a curve DRIVES (a live curve value overrides the
 *    generator activation for its slotId).
 *  - RELEASE instead of snap (§2.3): TTL expiry and disconnect no longer snap to the
 *    baseline — the slot eases to the LIVING generator base over the universal
 *    release. This intentionally REPLACES the C4 snap-fixture tests (see報告).
 *  - the release TARGET is the moving generator base fed back as `baseValues`, and the
 *    re-attack START is the previous tick's resolvedActivations fed back as
 *    `prevResolved` (案B) — both handed to `snapshot(nowMs, baseValues, prevResolved)`.
 *  - continuity: every adjacent frame step stays within a DERIVED bound (スナップ不在).
 *  - purity: the merge never mutates the generator `sample()` output.
 */

function makePayload(): RuntimeExportLoadedPayload {
  return {
    summary: { packageId: "pkg-alpha", packageRevision: 3 },
    loadedAtIso: "2026-07-10T00:00:00.000Z"
  } as unknown as RuntimeExportLoadedPayload;
}

function blinkSlot(
  slotId: "eye-blink-left" | "eye-blink-right",
  parameterId: string
): RuntimePlayerMappingSlot {
  return {
    slotId,
    label: slotId,
    group: "eyes",
    target: { parameterId, displayName: parameterId, min: 0, max: 1, default: 0 },
    enabled: true,
    invert: true,
    strength: 1,
    status: "mapped",
    warningMessages: []
  };
}

// invert:true → activation 1 (closed) resolves to target.min (0);
//                activation 0 (open)   resolves to target.max (1).
// So ParamEye*Open = 1 - activation, and |Δparam| = |Δactivation| (unit range) — the
// derived continuity bound in activation space applies directly to the param series.
const BLINK_SLOTS: readonly RuntimePlayerMappingSlot[] = [
  blinkSlot("eye-blink-left", "ParamEyeLOpen"),
  blinkSlot("eye-blink-right", "ParamEyeROpen")
];

/** Generator that always emits both eyes fully closed (activation 1 = baseline). */
function closedEyesGenerator(): PhysiologyGenerator {
  return {
    behaviorIds: ["blink"],
    sample: () => ({ "eye-blink-left": 1, "eye-blink-right": 1 })
  };
}

function createManualScheduler() {
  let handler: (() => void) | null = null;
  const setIntervalFn = vi.fn((hand0: () => void) => {
    handler = hand0;
    return 1 as unknown as ReturnType<typeof setInterval>;
  });
  const clearIntervalFn = vi.fn(() => {
    handler = null;
  });
  return {
    setIntervalFn,
    clearIntervalFn,
    fire: () => handler?.()
  };
}

function createHarness(extra: Partial<CreateAutonomousFrameHeartInput> = {}) {
  const frames: RuntimePlayerLiveParameterFrame[] = [];
  const publishFrame = vi.fn((frame: RuntimePlayerLiveParameterFrame) => {
    frames.push(frame);
  });
  const scheduler = createManualScheduler();
  let currentMs = 0;
  const heart = createAutonomousFrameHeart({
    liveParameters: { publishFrame },
    now: () => currentMs,
    setIntervalFn: scheduler.setIntervalFn,
    clearIntervalFn: scheduler.clearIntervalFn,
    frameIntervalMs: 16,
    ...extra
  });
  return {
    heart,
    frames,
    scheduler,
    setNow: (ms: number) => {
      currentMs = ms;
    }
  };
}

/** The parameterValues of the most recently published frame. */
function lastValues(
  frames: readonly RuntimePlayerLiveParameterFrame[]
): Record<string, number> | undefined {
  return frames.at(-1)?.parameterValues;
}

/** A store wired so the heart feeds it the living base + previous resolved (案B). */
function storeProvider(store: RuntimePlayerControlChannelOverlayStore) {
  return {
    getChannelOverlay: (
      nowMs: number,
      baseValues: Record<string, number>,
      prevResolved: Record<string, number>
    ) => store.snapshot(nowMs, baseValues, prevResolved)
  };
}

describe("Frame heart × Control Channel curve store (C5 Domain A)", () => {
  it("overrides the generator activation for a slotId while the curve drives", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    const harness = createHarness({
      createGenerator: () => closedEyesGenerator(),
      ...storeProvider(store)
    });

    harness.setNow(0);
    harness.heart.start({ payload: makePayload(), slots: BLINK_SLOTS, seed: 1 });

    // Baseline (no overlay): both eyes closed → ParamEye*Open = 0.
    harness.setNow(16);
    harness.scheduler.fire();
    expect(lastValues(harness.frames)).toEqual({
      ParamEyeLOpen: 0,
      ParamEyeROpen: 0
    });

    // A channel intent opens the LEFT eye (activation 0) until wall 1000.
    store.setOverlay("eye-blink-left", 0, 1000);
    harness.setNow(32); // still in sustain → drives
    harness.scheduler.fire();
    // Left eye now reflects the overlay (open → 1); right eye stays the generator
    // baseline (closed → 0). The override is per-slotId.
    expect(lastValues(harness.frames)).toEqual({
      ParamEyeLOpen: 1,
      ParamEyeROpen: 0
    });
  });

  it("REPLACES C4 snap: eases a set overlay to the living baseline over release (失効)", () => {
    // C4 asserted an instant snap to baseline at expiresAtMs. C5 keeps the slot in a
    // release blend to the LIVING generator base over the universal release window.
    const store = new RuntimePlayerControlChannelOverlayStore();
    const harness = createHarness({
      createGenerator: () => closedEyesGenerator(),
      ...storeProvider(store)
    });

    harness.setNow(0);
    harness.heart.start({ payload: makePayload(), slots: BLINK_SLOTS, seed: 1 });

    store.setOverlay("eye-blink-left", 0, 500); // open left eye until wall 500

    // Sustain (wall 400 < 500): overlay wins → open.
    harness.setNow(400);
    harness.scheduler.fire();
    expect(lastValues(harness.frames)?.ParamEyeLOpen).toBe(1);

    // Release begins at 500 (from the held open value), NOT an instant snap.
    harness.setNow(500);
    harness.scheduler.fire();
    expect(lastValues(harness.frames)?.ParamEyeLOpen).toBe(1);

    // Mid-release (700 = 500 + 200/400): a MIDDLE value between open (1) and the
    // closed baseline (0) — proof there is no snap.
    harness.setNow(700);
    harness.scheduler.fire();
    const mid = lastValues(harness.frames)?.ParamEyeLOpen ?? 0;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);

    // Release complete (900 = 500 + 400): fully returned to the生理 baseline (closed).
    harness.setNow(900);
    harness.scheduler.fire();
    expect(lastValues(harness.frames)).toEqual({
      ParamEyeLOpen: 0,
      ParamEyeROpen: 0
    });
  });

  it("judges the expiry→release boundary against the WALL clock, not logical time", () => {
    // epoch != 0 so logicalTime and wallNow diverge. If the heart (wrongly) fed
    // logicalTimeMs to the store, this overlay would still read as deep in sustain.
    const store = new RuntimePlayerControlChannelOverlayStore();
    const harness = createHarness({
      createGenerator: () => closedEyesGenerator(),
      ...storeProvider(store)
    });

    harness.setNow(1000); // epoch captured at start
    harness.heart.start({ payload: makePayload(), slots: BLINK_SLOTS, seed: 1 });

    store.setOverlay("eye-blink-left", 0, 1200); // sustain until wall 1200

    // wall 1300 → logicalTime 300. On the WALL clock (1300 > 1200) the slot is in
    // release (partially closed → ParamEyeLOpen < 1). On logical time (300 < 1200)
    // it would still be fully open (=1); the assertion rejects that.
    harness.setNow(1300);
    harness.scheduler.fire();
    const releasing = lastValues(harness.frames)?.ParamEyeLOpen ?? 0;
    expect(releasing).toBeGreaterThan(0);
    expect(releasing).toBeLessThan(1);

    // After the full release window on the wall clock (1200 + 400) → baseline.
    harness.setNow(1600);
    harness.scheduler.fire();
    expect(lastValues(harness.frames)?.ParamEyeLOpen).toBe(0);
  });

  it("REPLACES C4 clearAll snap: disconnect releases ALL slots to baseline (切断)", () => {
    // C4 called clearAll() on disconnect → instant snap. C5 calls releaseAll() so
    // every slot eases to the living base together (魂を殺しても呼吸が残る).
    const store = new RuntimePlayerControlChannelOverlayStore();
    const harness = createHarness({
      createGenerator: () => closedEyesGenerator(),
      ...storeProvider(store)
    });

    harness.setNow(0);
    harness.heart.start({ payload: makePayload(), slots: BLINK_SLOTS, seed: 1 });

    store.setOverlay("eye-blink-left", 0, 100000);
    store.setOverlay("eye-blink-right", 0, 100000);
    harness.setNow(16);
    harness.scheduler.fire();
    expect(lastValues(harness.frames)).toEqual({
      ParamEyeLOpen: 1,
      ParamEyeROpen: 1
    });

    // Disconnect at wall 16: the server would call releaseAll (Domain A). Both slots
    // switch to a forced release from their current open value.
    store.releaseAll(16);

    // Mid-release (216 = 16 + 200/400): both are a MIDDLE value (no snap).
    harness.setNow(216);
    harness.scheduler.fire();
    const mid = lastValues(harness.frames) ?? {};
    expect(mid.ParamEyeLOpen).toBeGreaterThan(0);
    expect(mid.ParamEyeLOpen).toBeLessThan(1);
    expect(mid.ParamEyeROpen).toBeGreaterThan(0);
    expect(mid.ParamEyeROpen).toBeLessThan(1);

    // Release complete (416 = 16 + 400): both back to the生理 baseline (closed).
    harness.setNow(416);
    harness.scheduler.fire();
    expect(lastValues(harness.frames)).toEqual({
      ParamEyeLOpen: 0,
      ParamEyeROpen: 0
    });
  });

  it("keeps every adjacent frame step within a DERIVED bound across an envelope life", () => {
    // Continuity property test (連続性の性質テスト): an envelope opens the eye from the
    // closed baseline and releases back — attack→sustain→decay→release entirely
    // smooth. Every adjacent published-frame step must stay within the bound DERIVED
    // from the envelope's own parameters (レビュー blocking: no magic number).
    const store = new RuntimePlayerControlChannelOverlayStore();
    const harness = createHarness({
      createGenerator: () => closedEyesGenerator(), // eye-blink-left base = 1 (closed)
      ...storeProvider(store)
    });

    harness.setNow(0);
    harness.heart.start({ payload: makePayload(), slots: BLINK_SLOTS, seed: 1 });

    // Envelope: open (peak 0) from the closed base (1). decay>0 so the release blends
    // 0 → living base (1). startValue = current effective (base 1) → attack is smooth.
    const spec = { peak: 0, attackMs: 100, sustainMs: 100, decayMs: 100 };
    store.setEnvelope("eye-blink-left", spec, 0);

    const frameIntervalMs = 16;
    const releaseMs = RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS;
    const startValue = 1; // = the closed base at re-attack
    const livingBase = 1; // closed base is constant here
    const attackStep =
      (Math.abs(spec.peak - startValue) / spec.attackMs) *
      RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE *
      frameIntervalMs;
    const decayStep =
      (Math.abs(spec.peak - 0) / spec.decayMs) *
      RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE *
      frameIntervalMs;
    const releaseStep =
      (Math.abs(0 - livingBase) / releaseMs) *
      RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE *
      frameIntervalMs;
    const bound = Math.max(attackStep, decayStep, releaseStep);

    let previous: number | undefined;
    for (let now = 0; now <= 700; now += frameIntervalMs) {
      harness.setNow(now);
      harness.scheduler.fire();
      const value = lastValues(harness.frames)?.ParamEyeLOpen ?? 0;
      if (previous !== undefined) {
        expect(Math.abs(value - previous)).toBeLessThanOrEqual(bound);
      }
      previous = value;
    }
  });

  it("keeps every adjacent frame step within a DERIVED bound across releaseAll (切断)", () => {
    // Coverage穴#3 (lane3): the disconnect(releaseAll) path was a point check
    // (mid-value 0<x<1). Here EVERY adjacent published-frame step of EVERY slot is
    // walked through the forced release and checked against a bound DERIVED from the
    // hand-off amplitude and the release window — 魂殺しの機械保証 (no magic number).
    const store = new RuntimePlayerControlChannelOverlayStore();
    const harness = createHarness({
      createGenerator: () => closedEyesGenerator(), // both eyes base = 1 (closed)
      ...storeProvider(store)
    });

    harness.setNow(0);
    harness.heart.start({ payload: makePayload(), slots: BLINK_SLOTS, seed: 1 });

    // Two slots driving at their open value (activation 0) under a long TTL.
    store.setOverlay("eye-blink-left", 0, 100000);
    store.setOverlay("eye-blink-right", 0, 100000);
    harness.setNow(16);
    harness.scheduler.fire();
    expect(lastValues(harness.frames)).toEqual({ ParamEyeLOpen: 1, ParamEyeROpen: 1 });

    // Disconnect: every slot switches to a forced release from its current value.
    const releaseAtMs = 16;
    store.releaseAll(releaseAtMs);

    const frameIntervalMs = 16;
    const releaseMs = RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS;
    // Hand-off = the sustained open activation (0); base = the closed generator
    // activation (1). |Δparam| = |Δactivation| (unit range, invert), so the activation
    // bound applies directly to the published param series.
    const handOffActivation = 0;
    const baseActivation = 1;
    const bound =
      (Math.abs(handOffActivation - baseActivation) / releaseMs) *
      RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE *
      frameIntervalMs;

    let prevL: number | undefined;
    let prevR: number | undefined;
    for (
      let now = releaseAtMs;
      now <= releaseAtMs + releaseMs + frameIntervalMs;
      now += frameIntervalMs
    ) {
      harness.setNow(now);
      harness.scheduler.fire();
      const values = lastValues(harness.frames) ?? {};
      const l = values.ParamEyeLOpen ?? 0;
      const r = values.ParamEyeROpen ?? 0;
      if (prevL !== undefined && prevR !== undefined) {
        expect(Math.abs(l - prevL)).toBeLessThanOrEqual(bound);
        expect(Math.abs(r - prevR)).toBeLessThanOrEqual(bound);
      }
      prevL = l;
      prevR = r;
    }
    // Fully released → both back to the生理 baseline (closed).
    expect(lastValues(harness.frames)).toEqual({ ParamEyeLOpen: 0, ParamEyeROpen: 0 });
  });

  it("keeps continuity across a re-attack that lands mid-release (release中re-attack, 案B end-to-end)", () => {
    // Coverage穴#4/#5 (lane3): a NEW envelope arrives while the slot is mid-release.
    // The heart retains the previous tick's resolvedActivations and feeds them back as
    // prevResolved (案B), so the re-attack's startValue = the current releasing value
    // — NO snap. This exercises the case-B retention path END-TO-END through the heart
    // (lastResolvedActivations), walking every adjacent published-frame step against a
    // DERIVED bound (no magic number).
    const store = new RuntimePlayerControlChannelOverlayStore();
    const harness = createHarness({
      createGenerator: () => closedEyesGenerator(), // eye-blink-left base = 1 (closed)
      ...storeProvider(store)
    });

    harness.setNow(0);
    harness.heart.start({ payload: makePayload(), slots: BLINK_SLOTS, seed: 1 });

    // One baseline tick primes the store's living base (closed activation 1), so the
    // first envelope's attack starts from the base (smooth onset).
    harness.setNow(16);
    harness.scheduler.fire();

    const specA = { peak: 0, attackMs: 160, sustainMs: 100, decayMs: 160 }; // opens the eye
    const specB = { peak: 0.2, attackMs: 160, sustainMs: 100, decayMs: 160 };
    const specAStartMs = 32;
    const reAttackAtMs = 640; // inside A's release window [452, 852)
    const frameIntervalMs = 16;
    const releaseMs = RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS;

    // Activation stays in [0,1] (open↔closed); |Δparam| = |Δactivation|. The widest
    // attack/re-attack span is ≤ 1, decay ≤ the larger peak, release blends 0→base(=1).
    const maxSpan = 1;
    const attackStep =
      (maxSpan / Math.min(specA.attackMs, specB.attackMs)) *
      RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE *
      frameIntervalMs;
    const decayStep =
      (Math.max(specA.peak, specB.peak) / Math.min(specA.decayMs, specB.decayMs)) *
      RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE *
      frameIntervalMs;
    const releaseStep =
      (maxSpan / releaseMs) * RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE * frameIntervalMs;
    const bound = Math.max(attackStep, decayStep, releaseStep);

    const endMs =
      reAttackAtMs + specB.attackMs + specB.sustainMs + specB.decayMs + releaseMs;
    let previous: number | undefined;
    for (let now = 16; now <= endMs + frameIntervalMs; now += frameIntervalMs) {
      if (now === specAStartMs) {
        store.setEnvelope("eye-blink-left", specA, specAStartMs);
      }
      if (now === reAttackAtMs) {
        store.setEnvelope("eye-blink-left", specB, reAttackAtMs);
      }
      harness.setNow(now);
      harness.scheduler.fire();
      const value = lastValues(harness.frames)?.ParamEyeLOpen ?? 0;
      if (previous !== undefined) {
        expect(Math.abs(value - previous)).toBeLessThanOrEqual(bound);
      }
      previous = value;
    }
    // After B's full life the slot has returned to the closed生理 baseline.
    expect(lastValues(harness.frames)?.ParamEyeLOpen).toBe(0);
  });

  it("never mutates the generator sample() output (純度維持)", () => {
    // The generator returns a STABLE object we can inspect after the tick. The
    // overlay adds a DIFFERENT slotId; if the merge mutated the sample output the
    // captured object would gain that key.
    const sampleOutput: Record<string, number> = { "eye-blink-left": 1 };
    const generator: PhysiologyGenerator = {
      behaviorIds: ["blink"],
      sample: () => sampleOutput
    };
    const store = new RuntimePlayerControlChannelOverlayStore();
    const harness = createHarness({
      createGenerator: () => generator,
      ...storeProvider(store)
    });

    harness.setNow(0);
    harness.heart.start({ payload: makePayload(), slots: BLINK_SLOTS, seed: 1 });

    store.setOverlay("eye-blink-right", 0, 100000);
    harness.setNow(16);
    harness.scheduler.fire();

    // The pure sample output is untouched: only its original key remains, the
    // overlay's slotId was NOT written into it. The merge built a new record.
    expect(sampleOutput).toEqual({ "eye-blink-left": 1 });
    // Meanwhile the published frame DID reflect the overlay (right eye open).
    expect(lastValues(harness.frames)).toEqual({
      ParamEyeLOpen: 0,
      ParamEyeROpen: 1
    });
  });

  it("Stage Presence follows the合成後 effective body signal when a channel drives body (C5 Domain C, 裁定1)", () => {
    // 裁定1「体は一つ——誰が体を動かしても画面はついてくる」: the Stage snapshot now reads
    // resolvedActivations, so a channel curve on body-x moves the Stage transform even
    // though the PURE generator body value never changes. body-z (no channel) still
    // reflects the pure generator value (resolved === activations for that slot),
    // proving the no-regression on untouched slots.
    const store = new RuntimePlayerControlChannelOverlayStore();
    const postureGenerator: PhysiologyGenerator = {
      behaviorIds: ["posture"],
      // Pure generator posture, constant: body-x 0.4, body-z -0.2.
      sample: () => ({ [BODY_X_SLOT_ID]: 0.4, [BODY_Z_SLOT_ID]: -0.2 })
    };
    const harness = createHarness({
      createGenerator: () => postureGenerator,
      ...storeProvider(store)
    });

    harness.setNow(0);
    harness.heart.start({ payload: makePayload(), slots: [], seed: 1 });

    // No channel yet: Stage follows the pure generator value (= resolved, since
    // resolved === activations with no overlay). This is the C3 baseline behavior.
    harness.setNow(16);
    harness.scheduler.fire();
    expect(harness.heart.getLatestStageMotionSignal()).toEqual({
      horizontal: 0.4,
      depth: -0.2,
      timestampMs: 16
    });

    // A channel curve drives body-x to 0.9 — a value the generator NEVER emits.
    // startAtMs = the last snapshot's nowMs (16); attack≈0 (set curve), so it holds
    // 0.9 through sustain.
    store.setOverlay(BODY_X_SLOT_ID, 0.9, 100000);
    harness.setNow(32); // deep in sustain → the curve holds 0.9
    harness.scheduler.fire();

    // Stage horizontal now follows the合成後 EFFECTIVE value (0.9, channel-driven), NOT
    // the pure generator value (0.4). body-z has no channel curve, so it stays the pure
    // -0.2 (resolved === activations for that slot). 追従の機械証明.
    expect(harness.heart.getLatestStageMotionSignal()).toEqual({
      horizontal: 0.9,
      depth: -0.2,
      timestampMs: 32
    });
  });

  it("with the default (null) overlay provider, published values are byte-identical to no channel", () => {
    // The retirement guard: omitting getChannelOverlay must produce the same
    // published series as an empty channel store — the pure C2/C3 path.
    function runSeries(extra: Partial<CreateAutonomousFrameHeartInput>) {
      const harness = createHarness({
        createGenerator: () => closedEyesGenerator(),
        ...extra
      });
      harness.setNow(0);
      harness.heart.start({ payload: makePayload(), slots: BLINK_SLOTS, seed: 3 });
      for (let frame = 1; frame <= 50; frame += 1) {
        harness.setNow(frame * 16);
        harness.scheduler.fire();
      }
      return harness.frames.map((f) => f.parameterValues);
    }

    const noProvider = runSeries({});
    const emptyStore = runSeries({
      getChannelOverlay: (nowMs, baseValues, prevResolved) =>
        new RuntimePlayerControlChannelOverlayStore().snapshot(
          nowMs,
          baseValues,
          prevResolved
        )
    });

    expect(emptyStore).toEqual(noProvider);
  });
});
