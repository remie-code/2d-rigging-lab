import { afterEach, describe, expect, it, vi } from "vitest";

import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import type { RuntimePlayerMappingSlot } from "../../preload/model-mapping-bridge-contract";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type { PhysiologyGenerator } from "../physiology";
import {
  createAutonomousFrameHeart,
  deriveAutonomousSessionSeed,
  type CreateAutonomousFrameHeartInput
} from "./autonomous-frame-heart";

/**
 * Frame heart (C2 Domain C): the Autonomous Host's sole 60Hz frame source. These
 * tests pin the wall-clock → logical-time conversion, monotonic sequence /
 * timestamp supply, generator → resolver → publish wiring, the sanitization
 * boundary (only the frame crosses; no seed / raw activations), silence on
 * unmapped models, and the start/stop lifecycle with no timer leak.
 */

function makePayload(
  overrides: Partial<{
    packageId: string;
    packageRevision: number;
    loadedAtIso: string;
  }> = {}
): RuntimeExportLoadedPayload {
  return {
    summary: {
      packageId: overrides.packageId ?? "pkg-alpha",
      packageRevision: overrides.packageRevision ?? 3
    },
    loadedAtIso: overrides.loadedAtIso ?? "2026-07-10T00:00:00.000Z"
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
    target: {
      parameterId,
      displayName: parameterId,
      min: 0,
      max: 1,
      default: 0
    },
    enabled: true,
    invert: true,
    strength: 1,
    status: "mapped",
    warningMessages: []
  };
}

const BLINK_SLOTS: readonly RuntimePlayerMappingSlot[] = [
  blinkSlot("eye-blink-left", "ParamEyeLOpen"),
  blinkSlot("eye-blink-right", "ParamEyeROpen")
];

/**
 * Manual interval scheduler: the heart never advances time on its own, so tests
 * fire ticks explicitly and control the wall clock, making 60Hz / monotonicity /
 * leak assertions fully deterministic.
 */
function createManualScheduler() {
  let handler: (() => void) | null = null;
  let nextHandle = 1;
  const setIntervalFn = vi.fn((hand0: () => void) => {
    handler = hand0;
    const handle = nextHandle;
    nextHandle += 1;
    return handle as unknown as ReturnType<typeof setInterval>;
  });
  const clearIntervalFn = vi.fn((_handle: ReturnType<typeof setInterval>) => {
    handler = null;
  });
  return {
    setIntervalFn,
    clearIntervalFn,
    fire: () => {
      handler?.();
    },
    hasHandler: () => handler !== null
  };
}

function createHarness(
  extra: Partial<CreateAutonomousFrameHeartInput> = {}
) {
  const frames: RuntimePlayerLiveParameterFrame[] = [];
  const publishFrame = vi.fn((frame: RuntimePlayerLiveParameterFrame) => {
    frames.push(frame);
  });
  const scheduler = createManualScheduler();
  let currentMs = 0;
  const now = () => currentMs;
  const heart = createAutonomousFrameHeart({
    liveParameters: { publishFrame },
    now,
    setIntervalFn: scheduler.setIntervalFn,
    clearIntervalFn: scheduler.clearIntervalFn,
    frameIntervalMs: 16,
    ...extra
  });
  return {
    heart,
    frames,
    publishFrame,
    scheduler,
    setNow: (ms: number) => {
      currentMs = ms;
    },
    getNow: () => currentMs
  };
}

describe("Autonomous frame heart", () => {
  it("converts wall clock to logical time (loadedAt = epoch) each tick", () => {
    const sampleTimes: number[] = [];
    const generator: PhysiologyGenerator = {
      behaviorIds: ["blink"],
      sample: (logicalTimeMs) => {
        sampleTimes.push(logicalTimeMs);
        return {};
      }
    };
    const harness = createHarness({ createGenerator: () => generator });

    harness.setNow(1000); // epoch captured at start
    harness.heart.start({ payload: makePayload(), slots: [], seed: 1 });

    harness.setNow(1016);
    harness.scheduler.fire();
    harness.setNow(1032);
    harness.scheduler.fire();
    harness.setNow(1048);
    harness.scheduler.fire();

    // logical time = wall - epoch, never the raw wall clock.
    expect(sampleTimes).toEqual([16, 32, 48]);
    expect(harness.publishFrame).toHaveBeenCalledTimes(3);
  });

  it("supplies strictly monotonic sequence and timestamps", () => {
    const generator: PhysiologyGenerator = {
      behaviorIds: ["blink"],
      sample: () => ({})
    };
    const harness = createHarness({ createGenerator: () => generator });

    harness.setNow(500);
    harness.heart.start({ payload: makePayload(), slots: [], seed: 1 });

    for (let i = 1; i <= 5; i += 1) {
      harness.setNow(500 + i * 16);
      harness.scheduler.fire();
    }

    expect(harness.frames.map((frame) => frame.sequence)).toEqual([
      1, 2, 3, 4, 5
    ]);
    expect(
      harness.frames.map((frame) => frame.sourceFrameTimestampMs)
    ).toEqual([516, 532, 548, 564, 580]);
    // producedAtIso mirrors the wall clock (monotonic, decision-boundary外).
    expect(harness.frames[0]?.producedAtIso).toBe(
      new Date(516).toISOString()
    );
  });

  it("keeps sequence monotonic across load→load (never resets)", () => {
    const harness = createHarness({
      createGenerator: () => ({ behaviorIds: [], sample: () => ({}) })
    });

    harness.setNow(0);
    harness.heart.start({ payload: makePayload(), slots: [], seed: 1 });
    harness.setNow(16);
    harness.scheduler.fire();
    harness.setNow(32);
    harness.scheduler.fire();

    // Second load: epoch resets (logical time), but the frame sequence keeps
    // climbing so downstream never sees a sequence go backwards.
    harness.setNow(1000);
    harness.heart.start({ payload: makePayload(), slots: [], seed: 2 });
    harness.setNow(1016);
    harness.scheduler.fire();

    expect(harness.frames.map((frame) => frame.sequence)).toEqual([1, 2, 3]);
  });

  it("stamps the loaded package identity and resolves activations to parameterValues", () => {
    // Injected generator emits both eyes fully closed (activation 1).
    const generator: PhysiologyGenerator = {
      behaviorIds: ["blink"],
      sample: () => ({ "eye-blink-left": 1, "eye-blink-right": 1 })
    };
    const harness = createHarness({ createGenerator: () => generator });

    harness.setNow(0);
    harness.heart.start({
      payload: makePayload({
        packageId: "pkg-beta",
        packageRevision: 7,
        loadedAtIso: "2026-07-10T12:00:00.000Z"
      }),
      slots: BLINK_SLOTS,
      seed: 42
    });
    harness.setNow(16);
    harness.scheduler.fire();

    const frame = harness.frames[0];
    expect(frame?.runtimeExport).toEqual({
      packageId: "pkg-beta",
      packageRevision: 7,
      loadedAtIso: "2026-07-10T12:00:00.000Z"
    });
    // invert:true, activation 1 (closed) → target.min (0 = closed).
    expect(frame?.parameterValues).toEqual({
      ParamEyeLOpen: 0,
      ParamEyeROpen: 0
    });
  });

  it("with the real generator, t=0 leaves the eyes open (default-pose equivalent)", () => {
    const harness = createHarness(); // real createPhysiologyGenerator

    harness.setNow(5000);
    harness.heart.start({
      payload: makePayload(),
      slots: BLINK_SLOTS,
      seed: 123
    });
    // Fire without advancing the clock → logical time 0 = pre-first-blink = open.
    harness.scheduler.fire();

    // invert:true, activation 0 (open) → target.max (1 = open).
    expect(harness.frames[0]?.parameterValues).toEqual({
      ParamEyeLOpen: 1,
      ParamEyeROpen: 1
    });
  });

  it("only the sanitized frame crosses the seam — no seed, no raw slot activations", () => {
    const generator: PhysiologyGenerator = {
      behaviorIds: ["blink"],
      sample: () => ({ "eye-blink-left": 0.5, "eye-blink-right": 0.5 })
    };
    const harness = createHarness({ createGenerator: () => generator });

    harness.setNow(0);
    harness.heart.start({ payload: makePayload(), slots: BLINK_SLOTS, seed: 99 });
    harness.setNow(16);
    harness.scheduler.fire();

    const frame = harness.frames[0]!;
    expect(Object.keys(frame).sort()).toEqual(
      [
        "parameterValues",
        "producedAtIso",
        "runtimeExport",
        "schemaVersion",
        "sequence",
        "sourceFrameTimestampMs"
      ].sort()
    );
    // parameterValues are keyed by model parameterId, never by the semantic
    // slotId — the raw activation vocabulary does not leak to renderers.
    expect(Object.keys(frame.parameterValues)).toEqual([
      "ParamEyeLOpen",
      "ParamEyeROpen"
    ]);
    // The seed is nowhere in the serialized frame.
    expect(JSON.stringify(frame)).not.toContain("99");
  });

  it("stays silent (empty parameterValues, no throw) for an unmapped model", () => {
    const generator: PhysiologyGenerator = {
      behaviorIds: ["blink"],
      sample: () => ({ "eye-blink-left": 1, "eye-blink-right": 1 })
    };
    const harness = createHarness({ createGenerator: () => generator });

    harness.setNow(0);
    // No blink slots resolve (empty slots) → resolver returns {}.
    harness.heart.start({ payload: makePayload(), slots: [], seed: 1 });
    harness.setNow(16);
    expect(() => harness.scheduler.fire()).not.toThrow();

    expect(harness.frames[0]?.parameterValues).toEqual({});
  });

  it("start after start disposes the first timer (no leak, single frame source)", () => {
    const generatorA: PhysiologyGenerator = {
      behaviorIds: ["a"],
      sample: () => ({ "eye-blink-left": 1, "eye-blink-right": 1 })
    };
    const generatorB: PhysiologyGenerator = {
      behaviorIds: ["b"],
      sample: () => ({ "eye-blink-left": 0, "eye-blink-right": 0 })
    };
    const generators = [generatorA, generatorB];
    let created = 0;
    const harness = createHarness({
      createGenerator: () => generators[created++]!
    });

    harness.setNow(0);
    harness.heart.start({ payload: makePayload(), slots: BLINK_SLOTS, seed: 1 });
    harness.setNow(1000);
    harness.heart.start({ payload: makePayload(), slots: BLINK_SLOTS, seed: 2 });

    // The prior interval was cleared exactly once before the new one started.
    expect(harness.scheduler.clearIntervalFn).toHaveBeenCalledTimes(1);
    expect(harness.scheduler.setIntervalFn).toHaveBeenCalledTimes(2);

    // Only the second heartbeat is live: firing produces generatorB's output.
    harness.setNow(1016);
    harness.scheduler.fire();
    expect(harness.frames.at(-1)?.parameterValues).toEqual({
      ParamEyeLOpen: 1, // activation 0 (open) → target.max
      ParamEyeROpen: 1
    });
  });

  it("stop disposes the timer and is idempotent; a stopped heart emits nothing", () => {
    const harness = createHarness({
      createGenerator: () => ({
        behaviorIds: [],
        sample: () => ({ "eye-blink-left": 1, "eye-blink-right": 1 })
      })
    });

    harness.setNow(0);
    harness.heart.start({ payload: makePayload(), slots: BLINK_SLOTS, seed: 1 });
    expect(harness.heart.isRunning()).toBe(true);

    harness.heart.stop();
    expect(harness.heart.isRunning()).toBe(false);
    expect(harness.scheduler.clearIntervalFn).toHaveBeenCalledTimes(1);
    expect(harness.scheduler.hasHandler()).toBe(false);

    // Idempotent: a second stop does not clear again or throw.
    expect(() => harness.heart.stop()).not.toThrow();
    expect(harness.scheduler.clearIntervalFn).toHaveBeenCalledTimes(1);

    // A stale fire (if any residual reference existed) publishes nothing.
    harness.scheduler.fire();
    expect(harness.publishFrame).not.toHaveBeenCalled();
  });

  it("derives a stable, non-exposed seed from the payload identity", () => {
    const seedA = deriveAutonomousSessionSeed(makePayload());
    const seedB = deriveAutonomousSessionSeed(makePayload());
    const seedC = deriveAutonomousSessionSeed(
      makePayload({ loadedAtIso: "2026-07-10T00:00:01.000Z" })
    );

    expect(seedA).toBe(seedB); // deterministic given identical payload
    expect(seedA).not.toBe(seedC); // each fresh load → its own rhythm
    expect(Number.isFinite(seedA)).toBe(true);
  });
});

describe("Autonomous frame heart — real timer lifecycle (fake timers)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules a real 60Hz interval and clears it on stop (no leak)", () => {
    vi.useFakeTimers();
    const publishFrame = vi.fn();
    const heart = createAutonomousFrameHeart({
      liveParameters: { publishFrame }
    });

    expect(vi.getTimerCount()).toBe(0);

    heart.start({ payload: makePayload(), slots: BLINK_SLOTS, seed: 1 });
    expect(vi.getTimerCount()).toBe(1);
    expect(heart.isRunning()).toBe(true);

    // ~5 frames at 60Hz.
    vi.advanceTimersByTime(100);
    expect(publishFrame.mock.calls.length).toBeGreaterThanOrEqual(5);

    heart.stop();
    expect(vi.getTimerCount()).toBe(0);
    expect(heart.isRunning()).toBe(false);

    // No further frames after stop even as time advances.
    const publishedByStop = publishFrame.mock.calls.length;
    vi.advanceTimersByTime(200);
    expect(publishFrame.mock.calls.length).toBe(publishedByStop);
  });
});
