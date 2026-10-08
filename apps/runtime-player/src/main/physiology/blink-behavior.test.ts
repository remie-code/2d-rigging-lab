import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BLINK_LEFT_SLOT_ID,
  BLINK_RIGHT_SLOT_ID,
  DEFAULT_BLINK_CONFIG,
  IDENTITY_BLINK_MODULATION,
  createBlinkBehavior,
  enumerateBlinkEvents,
  resolveEffectiveBlink,
  sampleBlinkActivation,
  type BlinkConfig
} from "./blink-behavior";

const SEED = 0x1234abcd;

function sampleSeries(
  seed: number,
  config: BlinkConfig,
  stepMs: number,
  frames: number
): number[] {
  const series: number[] = [];
  for (let frame = 0; frame < frames; frame += 1) {
    series.push(sampleBlinkActivation(seed, config, frame * stepMs));
  }
  return series;
}

describe("blink behavior — determinism (裁定3)", () => {
  it("same seed + config + logical time → identical activation", () => {
    for (const t of [0, 500, 3600, 3650, 3700, 7000, 12345]) {
      expect(sampleBlinkActivation(SEED, DEFAULT_BLINK_CONFIG, t)).toBe(
        sampleBlinkActivation(SEED, DEFAULT_BLINK_CONFIG, t)
      );
    }
  });

  it("same seed → same series; different seed → different series", () => {
    const a = sampleSeries(SEED, DEFAULT_BLINK_CONFIG, 16, 4000);
    const aAgain = sampleSeries(SEED, DEFAULT_BLINK_CONFIG, 16, 4000);
    const b = sampleSeries(SEED ^ 0x55555555, DEFAULT_BLINK_CONFIG, 16, 4000);

    expect(a).toEqual(aAgain);
    expect(a).not.toEqual(b);
    // both series must actually contain blinks (non-trivial)
    expect(Math.max(...a)).toBeGreaterThan(0.9);
    expect(Math.max(...b)).toBeGreaterThan(0.9);
  });

  it("identity modulation is equivalent to baseline-only (§6.4 恒等)", () => {
    // A config whose modulation is identity must behave exactly like the same
    // baseline. This is the graft-point guarantee for C5.
    const withIdentity: BlinkConfig = {
      baseline: DEFAULT_BLINK_CONFIG.baseline,
      modulation: IDENTITY_BLINK_MODULATION
    };
    const eff = resolveEffectiveBlink(withIdentity);
    expect(eff.meanIntervalMs).toBeCloseTo(
      DEFAULT_BLINK_CONFIG.baseline.meanBlinkIntervalMs,
      6
    );
    expect(eff.openDurationMs).toBeCloseTo(
      DEFAULT_BLINK_CONFIG.baseline.openDurationMs,
      6
    );
    expect(eff.depth).toBe(DEFAULT_BLINK_CONFIG.baseline.closeDepth);
  });

  it("modulation stays deterministic when non-identity (C5 forward-compat)", () => {
    const tense: BlinkConfig = {
      baseline: DEFAULT_BLINK_CONFIG.baseline,
      modulation: { ...IDENTITY_BLINK_MODULATION, rateMultiplier: 1.5 }
    };
    const eff = resolveEffectiveBlink(tense);
    // 緊張 → 頻度 ×1.5 → interval shortened (§6.4 example)
    expect(eff.meanIntervalMs).toBeLessThan(
      DEFAULT_BLINK_CONFIG.baseline.meanBlinkIntervalMs
    );
    const first = sampleSeries(SEED, tense, 16, 2000);
    const second = sampleSeries(SEED, tense, 16, 2000);
    expect(first).toEqual(second);
    // higher rate → strictly more blink events in a fixed window
    const baseEvents = enumerateBlinkEvents(SEED, DEFAULT_BLINK_CONFIG, 60_000).length;
    const tenseEvents = enumerateBlinkEvents(SEED, tense, 60_000).length;
    expect(tenseEvents).toBeGreaterThan(baseEvents);
  });
});

describe("blink behavior — distribution properties (§6.1)", () => {
  const events = enumerateBlinkEvents(SEED, DEFAULT_BLINK_CONFIG, 5_000_000);
  const eff = resolveEffectiveBlink(DEFAULT_BLINK_CONFIG);

  it("produces a meaningful population of events", () => {
    expect(events.length).toBeGreaterThan(500);
  });

  it("never breaks the minimum refractory period between separate blinks", () => {
    for (let i = 1; i < events.length; i += 1) {
      const current = events[i]!;
      const previous = events[i - 1]!;
      if (current.isSecondOfPair) {
        continue; // ぱちぱち pair uses the short intra-pair gap by design
      }
      const gap = current.startMs - previous.endMs;
      expect(gap).toBeGreaterThanOrEqual(eff.minRefractoryMs - 1e-6);
    }
  });

  it("second-of-pair blinks sit closer than the refractory floor", () => {
    const seconds = events.filter((event) => event.isSecondOfPair);
    expect(seconds.length).toBeGreaterThan(0);
    for (const second of seconds) {
      const previous = events[second.index - 1]!;
      const gap = second.startMs - previous.endMs;
      expect(gap).toBeLessThan(eff.minRefractoryMs);
    }
  });

  it("double-blink rate tracks the configured probability", () => {
    const primaries = events.filter((event) => !event.isSecondOfPair).length;
    const doubles = events.filter((event) => event.isSecondOfPair).length;
    const perPrimaryRate = doubles / primaries;
    // configured 0.12; assert it is present and in a sane statistical band
    expect(doubles).toBeGreaterThan(0);
    expect(perPrimaryRate).toBeGreaterThan(0.06);
    expect(perPrimaryRate).toBeLessThan(0.2);
  });

  it("envelope is asymmetric: close faster than open (§6.1)", () => {
    for (const event of events.slice(0, 400)) {
      expect(event.closeDurationMs).toBeLessThan(event.openDurationMs);
    }
  });
});

describe("blink behavior — shape reflection", () => {
  it("reaches full close depth and holds it (深さ・保持)", () => {
    const [firstEvent] = enumerateBlinkEvents(SEED, DEFAULT_BLINK_CONFIG, 20_000);
    expect(firstEvent).toBeDefined();
    const event = firstEvent!;

    // peak at end of close phase ≈ depth
    const peak = sampleBlinkActivation(
      SEED,
      DEFAULT_BLINK_CONFIG,
      event.startMs + event.closeDurationMs
    );
    expect(peak).toBeCloseTo(event.depth, 5);
    expect(event.depth).toBe(1); // 全閉が基本 (default)

    // held fully closed across the hold window
    const midHold = sampleBlinkActivation(
      SEED,
      DEFAULT_BLINK_CONFIG,
      event.startMs + event.closeDurationMs + event.holdDurationMs / 2
    );
    expect(midHold).toBeCloseTo(event.depth, 5);
  });

  it("reflects a shallower depth via modulation", () => {
    const half: BlinkConfig = {
      baseline: DEFAULT_BLINK_CONFIG.baseline,
      modulation: { ...IDENTITY_BLINK_MODULATION, depthMultiplier: 0.5 }
    };
    const [firstEvent] = enumerateBlinkEvents(SEED, half, 20_000);
    const event = firstEvent!;
    const peak = sampleBlinkActivation(
      SEED,
      half,
      event.startMs + event.closeDurationMs
    );
    expect(peak).toBeCloseTo(0.5, 5);
  });

  it("activation stays within [0, 1] and opens (0) in the gaps", () => {
    for (let t = 0; t <= 20_000; t += 7) {
      const value = sampleBlinkActivation(SEED, DEFAULT_BLINK_CONFIG, t);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    // t=0 is before the first blink → eyes open
    expect(sampleBlinkActivation(SEED, DEFAULT_BLINK_CONFIG, 0)).toBe(0);
  });

  it("close phase rises monotonically, open phase falls monotonically", () => {
    const [firstEvent] = enumerateBlinkEvents(SEED, DEFAULT_BLINK_CONFIG, 20_000);
    const event = firstEvent!;
    let previous = -1;
    for (let e = 0; e <= event.closeDurationMs; e += event.closeDurationMs / 10) {
      const value = sampleBlinkActivation(SEED, DEFAULT_BLINK_CONFIG, event.startMs + e);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = value;
    }
    const openStart = event.startMs + event.closeDurationMs + event.holdDurationMs;
    let prevOpen = 2;
    for (let e = 0; e <= event.openDurationMs; e += event.openDurationMs / 10) {
      const value = sampleBlinkActivation(SEED, DEFAULT_BLINK_CONFIG, openStart + e);
      expect(value).toBeLessThanOrEqual(prevOpen + 1e-9);
      prevOpen = value;
    }
  });
});

describe("blink behavior — slot ids (裁定4/5 vocabulary)", () => {
  it("emits both blink slots with the same value", () => {
    const behavior = createBlinkBehavior();
    for (const t of [0, 3600, 3650, 3700, 8000]) {
      const out = behavior.sample({ seed: SEED, logicalTimeMs: t });
      expect(Object.keys(out).sort()).toEqual(
        [BLINK_LEFT_SLOT_ID, BLINK_RIGHT_SLOT_ID].sort()
      );
      expect(out[BLINK_LEFT_SLOT_ID]).toBe(out[BLINK_RIGHT_SLOT_ID]);
    }
  });
});

describe("physiology/ purity (blocking review observation)", () => {
  it("no source module imports Electron, reads a wall clock, or uses Math.random", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const sources = readdirSync(here).filter(
      (name) => name.endsWith(".ts") && !name.endsWith(".test.ts")
    );
    expect(sources.length).toBeGreaterThan(0);

    const forbidden: readonly { label: string; pattern: RegExp }[] = [
      { label: "electron import", pattern: /from\s+["']electron/ },
      { label: "electron-vite import", pattern: /electron-vite/ },
      { label: "Date.now", pattern: /Date\.now/ },
      { label: "performance.now", pattern: /performance\.now/ },
      { label: "new Date", pattern: /new\s+Date\b/ },
      { label: "Math.random", pattern: /Math\.random/ },
      { label: "node:crypto", pattern: /node:crypto|require\(["']crypto/ },
      { label: "crypto.randomBytes", pattern: /randomBytes/ }
    ];

    for (const name of sources) {
      // Strip block + line comments so that documentation prose mentioning the
      // forbidden APIs (e.g. "no Math.random") does not false-positive; we guard
      // against actual usage in code.
      const code = readFileSync(join(here, name), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
      for (const rule of forbidden) {
        expect(
          rule.pattern.test(code),
          `${name} must not contain ${rule.label}`
        ).toBe(false);
      }
    }
  });
});
