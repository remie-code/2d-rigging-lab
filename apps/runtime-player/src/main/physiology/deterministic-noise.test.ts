import { describe, expect, it } from "vitest";

import {
  homeSpringValue,
  layeredValueNoise,
  NOISE_SPAN,
  SMOOTHERSTEP_MAX_SLOPE,
  smoothValueNoise,
  type NoiseLayer
} from "./deterministic-noise";

/**
 * Closed-form deterministic noise / home-spring primitives (C3 Domain A). These
 * tests pin the two contract properties Domain B relies on:
 *  1. PURITY: same (seed, channel, time, params) → same value; different seed /
 *     time → deterministic and (generally) different. No wall clock, no state.
 *  2. SMOOTHNESS: adjacent samples differ by a bounded amount (the analytic
 *     value-noise bound), so the signal is「滑らか」not a single-frequency jitter.
 */

const SEED = 0x51ee7;
const HEAD_LAYERS: readonly NoiseLayer[] = [
  { cellMs: 900, amplitude: 0.25 }, // fast micro-jitter
  { cellMs: 6000, amplitude: 0.6 }, // mid wander
  { cellMs: 45000, amplitude: 1 } // slow center drift
];

describe("smoothValueNoise — purity", () => {
  it("is a pure function of logical time (same time → same value)", () => {
    for (const t of [0, 16, 512, 3333, 90000]) {
      expect(smoothValueNoise(SEED, 0, t, 1000)).toBe(
        smoothValueNoise(SEED, 0, t, 1000)
      );
    }
  });

  it("depends deterministically on seed and channel (decorrelated streams)", () => {
    const t = 4321;
    const a = smoothValueNoise(SEED, 0, t, 1000);
    const b = smoothValueNoise(SEED + 1, 0, t, 1000);
    const c = smoothValueNoise(SEED, 1, t, 1000);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    // still reproducible
    expect(smoothValueNoise(SEED + 1, 0, t, 1000)).toBe(b);
  });

  it("stays within the centered [-1, 1] range (home = 0)", () => {
    let sum = 0;
    let count = 0;
    // Small cells over a long window = many lattice draws, so the sample mean
    // tightly reflects the mean-reverting property (home = 0).
    for (let t = 0; t <= 300000; t += 37) {
      const v = smoothValueNoise(SEED, 3, t, 2000);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
      sum += v;
      count += 1;
    }
    // mean-reverting: the average sits near home (0), not off to one side.
    expect(Math.abs(sum / count)).toBeLessThan(0.2);
  });
});

describe("smoothValueNoise — smoothness (bounded adjacent difference)", () => {
  it("adjacent 16ms samples differ by less than the analytic value-noise bound", () => {
    const cellMs = 900; // the fastest layer we use
    const dt = 16;
    const bound = NOISE_SPAN * SMOOTHERSTEP_MAX_SLOPE * (dt / cellMs);
    let maxDiff = 0;
    let prev = smoothValueNoise(SEED, 7, 0, cellMs);
    for (let t = dt; t <= 120000; t += dt) {
      const v = smoothValueNoise(SEED, 7, t, cellMs);
      maxDiff = Math.max(maxDiff, Math.abs(v - prev));
      prev = v;
    }
    expect(maxDiff).toBeLessThanOrEqual(bound + 1e-9);
    // non-trivial: the signal actually moves (not a flat line)
    expect(maxDiff).toBeGreaterThan(0);
  });

  it("is continuous across lattice cell boundaries (no jump at integer cells)", () => {
    const cellMs = 1000;
    for (const boundary of [1000, 5000, 12000]) {
      const before = smoothValueNoise(SEED, 2, boundary - 0.001, cellMs);
      const at = smoothValueNoise(SEED, 2, boundary, cellMs);
      const after = smoothValueNoise(SEED, 2, boundary + 0.001, cellMs);
      expect(Math.abs(at - before)).toBeLessThan(1e-4);
      expect(Math.abs(after - at)).toBeLessThan(1e-4);
    }
  });
});

describe("smoothValueNoise — interpolation continuity (guards quintic against regression)", () => {
  // Domain A review Lane3 (non-blocking) noted the quintic smootherstep's velocity
  // continuity was not pinned, so a silent regression to cubic (3t²−2t³) or linear
  // interpolation would leave every other test green. Domain B consumes this helper
  // for head/posture, so this is the防波堤 before consumption: it fails if the
  // interpolation loses its C¹ (velocity) or C² (acceleration) continuity at the
  // lattice points.
  //   quintic 6t⁵−15t⁴+10t³ : S'(0)=S'(1)=0  AND  S''(0)=S''(1)=0  → C² at lattice.
  //   cubic   3t²−2t³        : S'(0)=S'(1)=0  but  S''(0)=6, S''(1)=−6 → C¹ only.
  //   linear                 : S'(0)=1 (velocity JUMPS at the lattice)  → C⁰ only.
  const cellMs = 1000;
  const channel = 15;
  const h = 0.5; // ms

  function velocity(t: number): number {
    return (
      (smoothValueNoise(SEED, channel, t + h, cellMs) -
        smoothValueNoise(SEED, channel, t - h, cellMs)) /
      (2 * h)
    );
  }
  function acceleration(t: number): number {
    return (
      (smoothValueNoise(SEED, channel, t + h, cellMs) -
        2 * smoothValueNoise(SEED, channel, t, cellMs) +
        smoothValueNoise(SEED, channel, t - h, cellMs)) /
      (h * h)
    );
  }

  it("velocity is ≈0 at lattice points (fails for linear interpolation)", () => {
    // Linear interp would give velocity = (b−a)/cellMs ≠ 0 and DISCONTINUOUS here.
    for (const boundary of [1000, 3000, 7000, 12000]) {
      expect(Math.abs(velocity(boundary))).toBeLessThan(1e-4);
    }
  });

  it("acceleration is ≈0 at lattice points (fails for cubic interpolation)", () => {
    // Cubic interp would give |acceleration| ≈ |b−a|·6/cellMs² ~ 1e-5..1e-6 ≠ 0;
    // quintic's second derivative vanishes at the lattice, so it stays far below.
    for (const boundary of [1000, 3000, 7000, 12000]) {
      expect(Math.abs(acceleration(boundary))).toBeLessThan(1e-7);
    }
    // Sanity: the signal genuinely accelerates INSIDE a cell (not a flat line), so
    // the ≈0-at-lattice result reflects continuity, not a dead signal.
    let maxInteriorAccel = 0;
    for (let t = 100; t <= 900; t += 50) {
      maxInteriorAccel = Math.max(maxInteriorAccel, Math.abs(acceleration(t)));
    }
    expect(maxInteriorAccel).toBeGreaterThan(1e-7);
  });
});

describe("layeredValueNoise — multi-timescale composition", () => {
  it("is pure and stays within [-1, 1] after normalization", () => {
    for (let t = 0; t <= 120000; t += 53) {
      const v = layeredValueNoise(SEED, 0, t, HEAD_LAYERS);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
      expect(layeredValueNoise(SEED, 0, t, HEAD_LAYERS)).toBe(v);
    }
  });

  it("returns home (0) for an empty or zero-weight layer set", () => {
    expect(layeredValueNoise(SEED, 0, 1234, [])).toBe(0);
    expect(
      layeredValueNoise(SEED, 0, 1234, [{ cellMs: 1000, amplitude: 0 }])
    ).toBe(0);
  });

  it("differs from any single octave (the layers genuinely combine)", () => {
    const t = 8765;
    const combined = layeredValueNoise(SEED, 0, t, HEAD_LAYERS);
    const single = smoothValueNoise(SEED, 0, t, HEAD_LAYERS[1]!.cellMs);
    expect(combined).not.toBe(single);
  });

  it("has no composite period detectable within a 30s window (裁定5 proxy)", () => {
    // Autocorrelation of the composite at a 30s lag must be well below 1: if the
    // layers phase-locked into a ≤30s loop, a 30s-shifted copy would align.
    const dt = 100;
    const lagMs = 30000;
    let dot = 0;
    let energy = 0;
    for (let t = 0; t <= 240000; t += dt) {
      const a = layeredValueNoise(SEED, 5, t, HEAD_LAYERS);
      const b = layeredValueNoise(SEED, 5, t + lagMs, HEAD_LAYERS);
      dot += a * b;
      energy += a * a;
    }
    const normalizedCorrelation = dot / energy;
    // A perfect 30s loop → ~1.0. The multi-timescale signal decorrelates.
    expect(normalizedCorrelation).toBeLessThan(0.5);
  });
});

describe("homeSpringValue — closed-form damped walk toward home", () => {
  it("is pure and stays within [home ± amplitude]", () => {
    const home = 0.2;
    const amplitude = 0.5;
    for (let t = 0; t <= 120000; t += 41) {
      const v = homeSpringValue(SEED, 0, t, { home, amplitude, layers: HEAD_LAYERS });
      expect(v).toBeGreaterThanOrEqual(home - amplitude - 1e-9);
      expect(v).toBeLessThanOrEqual(home + amplitude + 1e-9);
      expect(
        homeSpringValue(SEED, 0, t, { home, amplitude, layers: HEAD_LAYERS })
      ).toBe(v);
    }
  });

  it("homePull concentrates the walk toward home (per-sample, never amplifies)", () => {
    const base = { home: 0, amplitude: 1, layers: HEAD_LAYERS } as const;
    const dt = 100;
    let loose = 0;
    let tight = 0;
    let maxTight = 0;
    for (let t = 0; t <= 180000; t += dt) {
      const looseV = Math.abs(homeSpringValue(SEED, 9, t, { ...base, homePull: 0 }));
      const tightV = Math.abs(homeSpringValue(SEED, 9, t, { ...base, homePull: 1 }));
      // signed power shaping (|d|^3 for homePull=1, |d| ≤ 1) never amplifies:
      // every sample is pulled toward home, exactly, point by point.
      expect(tightV).toBeLessThanOrEqual(looseV + 1e-9);
      loose += looseV;
      tight += tightV;
      maxTight = Math.max(maxTight, tightV);
    }
    // Higher homePull → smaller mean deviation (values hug home more).
    expect(tight).toBeLessThan(loose);
    // …but the walk still moves (excursions happen, just rarer as punctuation).
    expect(maxTight).toBeGreaterThan(0.1);
  });

  it("stays smooth: adjacent 16ms samples remain bounded under homePull", () => {
    const dt = 16;
    let maxDiff = 0;
    let prev = homeSpringValue(SEED, 4, 0, {
      home: 0,
      amplitude: 1,
      layers: HEAD_LAYERS,
      homePull: 1
    });
    for (let t = dt; t <= 120000; t += dt) {
      const v = homeSpringValue(SEED, 4, t, {
        home: 0,
        amplitude: 1,
        layers: HEAD_LAYERS,
        homePull: 1
      });
      maxDiff = Math.max(maxDiff, Math.abs(v - prev));
      prev = v;
    }
    // The shaping (signed power ≥1) is C¹ and Lipschitz, so the bound only grows
    // by the extra exponent factor over the fastest octave.
    const fastest = HEAD_LAYERS[0]!.cellMs;
    const bound = NOISE_SPAN * SMOOTHERSTEP_MAX_SLOPE * (dt / fastest) * 3;
    expect(maxDiff).toBeLessThanOrEqual(bound);
  });
});
