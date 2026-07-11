import { describe, expect, it, vi } from "vitest";

import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import type { RuntimePlayerMappingSlot } from "../../preload/model-mapping-bridge-contract";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type {
  PhysiologyGenerator
} from "../physiology";
import { RuntimePlayerControlChannelOverlayStore } from "../control-channel/control-channel-overlay-store";
import { runtimePlayerControlChannelDefaultWindowMs } from "../control-channel/channel-server";
import {
  createAutonomousFrameHeart,
  type CreateAutonomousFrameHeartInput
} from "./autonomous-frame-heart";

/**
 * C4 Domain B: the coarse Control Channel overlay integrated into the frame heart
 * tick (裁定1 / §6). These tests pin, THROUGH the heart tick (the observable
 * boundary), the four semantics Domain B owns:
 *  - Record-merge priority: a live overlay value overrides the generator
 *    activation for its slotId; on expiry the slot falls back to the生理 baseline.
 *  - TTL expiry against the WALL clock: explicit-ttlMs and default-window styles,
 *    and the exact `expiresAtMs` boundary (live strictly before, expired at).
 *  - disconnect → clearAll → baseline: after the store is cleared the体 returns to
 *    the pure generator output next tick.
 *  - purity: the overlay merge never mutates the generator `sample()` output — the
 *    fixture-pinned determinism boundary stays clean.
 *
 * The overlay TTL lives in WALL-clock space (absolute `expiresAtMs`, stamped by
 * the server at acceptance), distinct from the generator's epoch-relative
 * `logicalTimeMs`; a dedicated test proves the heart judges expiry against the
 * wall clock, not logical time.
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
const BLINK_SLOTS: readonly RuntimePlayerMappingSlot[] = [
  blinkSlot("eye-blink-left", "ParamEyeLOpen"),
  blinkSlot("eye-blink-right", "ParamEyeROpen")
];

/** Generator that always emits both eyes fully closed (activation 1). */
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

describe("Frame heart × Control Channel overlay (C4 Domain B)", () => {
  it("overrides the generator activation for a slotId while the overlay is live", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    const harness = createHarness({
      createGenerator: () => closedEyesGenerator(),
      getChannelOverlay: (nowMs) => store.snapshot(nowMs)
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
    harness.setNow(32); // still < 1000 → live
    harness.scheduler.fire();
    // Left eye now reflects the overlay (open → 1); right eye stays the generator
    // baseline (closed → 0). The override is per-slotId.
    expect(lastValues(harness.frames)).toEqual({
      ParamEyeLOpen: 1,
      ParamEyeROpen: 0
    });
  });

  it("falls back to the generator baseline when the overlay expires (基底復帰)", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    const harness = createHarness({
      createGenerator: () => closedEyesGenerator(),
      getChannelOverlay: (nowMs) => store.snapshot(nowMs)
    });

    harness.setNow(0);
    harness.heart.start({ payload: makePayload(), slots: BLINK_SLOTS, seed: 1 });

    store.setOverlay("eye-blink-left", 0, 500);

    // Live (wall 400 < 500): overlay wins.
    harness.setNow(400);
    harness.scheduler.fire();
    expect(lastValues(harness.frames)?.ParamEyeLOpen).toBe(1);

    // Expired (wall 600 ≥ 500): the体 returns to the生理 baseline (closed → 0).
    harness.setNow(600);
    harness.scheduler.fire();
    expect(lastValues(harness.frames)).toEqual({
      ParamEyeLOpen: 0,
      ParamEyeROpen: 0
    });
  });

  it("expires an explicit-ttlMs overlay at receivedAt + ttlMs", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    const harness = createHarness({
      createGenerator: () => closedEyesGenerator(),
      getChannelOverlay: (nowMs) => store.snapshot(nowMs)
    });

    harness.setNow(0);
    harness.heart.start({ payload: makePayload(), slots: BLINK_SLOTS, seed: 1 });

    // Explicit "this intent is 800ms valid" style: server would stamp
    // expiresAtMs = receivedAt(200) + ttlMs(800) = 1000.
    const receivedAt = 200;
    const ttlMs = 800;
    store.setOverlay("eye-blink-left", 0, receivedAt + ttlMs);

    harness.setNow(999); // < 1000 → live
    harness.scheduler.fire();
    expect(lastValues(harness.frames)?.ParamEyeLOpen).toBe(1);

    harness.setNow(1000); // = expiresAtMs → expired
    harness.scheduler.fire();
    expect(lastValues(harness.frames)?.ParamEyeLOpen).toBe(0);
  });

  it("expires a default-window overlay (ttlMs omitted) at receivedAt + defaultWindowMs", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    const harness = createHarness({
      createGenerator: () => closedEyesGenerator(),
      getChannelOverlay: (nowMs) => store.snapshot(nowMs)
    });

    harness.setNow(0);
    harness.heart.start({ payload: makePayload(), slots: BLINK_SLOTS, seed: 1 });

    // Streaming style: ttlMs omitted, so the server applies the既定窓. The store
    // holds expiresAtMs = receivedAt(0) + defaultWindowMs. (Computation of
    // `ttlMs ?? defaultWindowMs` is Domain A's; here we pin that the heart reverts
    // to baseline at that instant.)
    const expiresAtMs = 0 + runtimePlayerControlChannelDefaultWindowMs;
    store.setOverlay("eye-blink-left", 0, expiresAtMs);

    harness.setNow(expiresAtMs - 1); // one tick before the window closes → live
    harness.scheduler.fire();
    expect(lastValues(harness.frames)?.ParamEyeLOpen).toBe(1);

    harness.setNow(expiresAtMs); // window closed → baseline
    harness.scheduler.fire();
    expect(lastValues(harness.frames)?.ParamEyeLOpen).toBe(0);
  });

  it("judges TTL against the WALL clock, not the generator's logical time", () => {
    // epoch != 0 so logicalTime and wallNow diverge. If the heart (wrongly) fed
    // logicalTimeMs to the overlay store, this overlay would still read as live.
    const store = new RuntimePlayerControlChannelOverlayStore();
    const harness = createHarness({
      createGenerator: () => closedEyesGenerator(),
      getChannelOverlay: (nowMs) => store.snapshot(nowMs)
    });

    harness.setNow(1000); // epoch captured at start
    harness.heart.start({ payload: makePayload(), slots: BLINK_SLOTS, seed: 1 });

    // expiresAtMs is in ABSOLUTE wall-clock space.
    store.setOverlay("eye-blink-left", 0, 1200);

    // wall 1300 → logicalTime 300. Wall clock (1300 ≥ 1200) ⇒ EXPIRED. Logical
    // time (300 < 1200) would be a false "live" — the assertion below rejects it.
    harness.setNow(1300);
    harness.scheduler.fire();
    expect(lastValues(harness.frames)?.ParamEyeLOpen).toBe(0);
  });

  it("clears all overlays on disconnect and returns to baseline next tick (切断→全失効)", () => {
    const store = new RuntimePlayerControlChannelOverlayStore();
    const harness = createHarness({
      createGenerator: () => closedEyesGenerator(),
      getChannelOverlay: (nowMs) => store.snapshot(nowMs)
    });

    harness.setNow(0);
    harness.heart.start({ payload: makePayload(), slots: BLINK_SLOTS, seed: 1 });

    // Long-lived overlays on both eyes.
    store.setOverlay("eye-blink-left", 0, 100000);
    store.setOverlay("eye-blink-right", 0, 100000);
    harness.setNow(16);
    harness.scheduler.fire();
    expect(lastValues(harness.frames)).toEqual({
      ParamEyeLOpen: 1,
      ParamEyeROpen: 1
    });

    // Client disconnect: the server calls clearAll() (Domain A). Even though the
    // overlays are far from their TTL, the体 falls to the生理 baseline next tick.
    store.clearAll();
    harness.setNow(32);
    harness.scheduler.fire();
    expect(lastValues(harness.frames)).toEqual({
      ParamEyeLOpen: 0,
      ParamEyeROpen: 0
    });
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
      getChannelOverlay: (nowMs) => store.snapshot(nowMs)
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
      getChannelOverlay: (nowMs) =>
        new RuntimePlayerControlChannelOverlayStore().snapshot(nowMs)
    });

    expect(emptyStore).toEqual(noProvider);
  });
});
