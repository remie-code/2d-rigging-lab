import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_BLINK_CONFIG,
  IDENTITY_BLINK_MODULATION,
  sampleBlinkActivation,
  type BlinkConfig
} from "./blink-behavior";

/**
 * Golden fixtures (§7, 決定論の背骨). "seed X + config → this semantic-slot
 * activation series" captured at a fixed timestep. Regenerate deliberately with
 * `UPDATE_BLINK_GOLDEN=1 npx vitest run src/main/physiology/blink-behavior-fixture.test.ts`;
 * otherwise the committed golden is the assertion target. Same seed+config →
 * same列; different seed / different config → different列 (asserted below).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const STEP_MS = 16; // ~60Hz fixed timestep
const FRAMES = 900; // ~14.4s → several blinks

const GOLDEN_SEED = 0x5eed1234;
const ALT_SEED = 0x5eed9999;

// A second config proves settings are a fixture input and determinism holds
// when they change (§7). Higher rate, longer hold, shallower depth.
const ALT_CONFIG: BlinkConfig = {
  baseline: {
    ...DEFAULT_BLINK_CONFIG.baseline,
    meanBlinkIntervalMs: 1800,
    holdDurationMs: 120,
    closeDepth: 0.85
  },
  modulation: IDENTITY_BLINK_MODULATION
};

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function captureSeries(seed: number, config: BlinkConfig): number[] {
  const series: number[] = [];
  for (let frame = 0; frame < FRAMES; frame += 1) {
    series.push(round6(sampleBlinkActivation(seed, config, frame * STEP_MS)));
  }
  return series;
}

function goldenPath(name: string): string {
  return join(HERE, name);
}

function loadOrCapture(name: string, series: number[]): number[] {
  const path = goldenPath(name);
  const shouldUpdate = process.env.UPDATE_BLINK_GOLDEN === "1" || !existsSync(path);
  if (shouldUpdate) {
    writeFileSync(path, `${JSON.stringify(series, null, 2)}\n`, "utf8");
    return series;
  }
  return JSON.parse(readFileSync(path, "utf8")) as number[];
}

describe("blink golden fixtures (§7)", () => {
  it("default config series matches the committed golden", () => {
    const series = captureSeries(GOLDEN_SEED, DEFAULT_BLINK_CONFIG);
    const golden = loadOrCapture("blink-default.golden.json", series);
    expect(series).toEqual(golden);
    // non-trivial: the series actually blinks (reaches full close somewhere)
    expect(Math.max(...series)).toBeGreaterThan(0.95);
    // and returns to open (0) somewhere
    expect(Math.min(...series)).toBe(0);
  });

  it("alternate config series matches its own committed golden (設定も入力)", () => {
    const series = captureSeries(GOLDEN_SEED, ALT_CONFIG);
    const golden = loadOrCapture("blink-alt-config.golden.json", series);
    expect(series).toEqual(golden);
    // shallower depth (0.85) → peak below full close
    expect(Math.max(...series)).toBeGreaterThan(0.8);
    expect(Math.max(...series)).toBeLessThanOrEqual(0.85 + 1e-6);
  });

  it("同種同列・異種異列: a different seed produces a different series", () => {
    const golden = captureSeries(GOLDEN_SEED, DEFAULT_BLINK_CONFIG);
    const same = captureSeries(GOLDEN_SEED, DEFAULT_BLINK_CONFIG);
    const other = captureSeries(ALT_SEED, DEFAULT_BLINK_CONFIG);
    expect(same).toEqual(golden);
    expect(other).not.toEqual(golden);
  });

  it("different config produces a different series for the same seed", () => {
    const def = captureSeries(GOLDEN_SEED, DEFAULT_BLINK_CONFIG);
    const alt = captureSeries(GOLDEN_SEED, ALT_CONFIG);
    expect(alt).not.toEqual(def);
  });
});
