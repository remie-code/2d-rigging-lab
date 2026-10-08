import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BLINK_LEFT_SLOT_ID,
  BLINK_RIGHT_SLOT_ID,
  DEFAULT_BLINK_BASELINE
} from "./blink-behavior";
import { deriveBehaviorSeed } from "./deterministic-hash";
import { DEFAULT_GAZE_BASELINE, enumerateFixations } from "./gaze-saccade";
import { DEFAULT_HEAD_BASELINE } from "./head-behavior";
import { DEFAULT_POSTURE_BASELINE } from "./posture-reseat";
import {
  createPhysiologyBehaviorsFromConfig,
  DEFAULT_FULL_PHYSIOLOGY_CONFIG,
  DEFAULT_PHYSIOLOGY_CONFIG
} from "./physiology-config";
import { createPhysiologyGenerator } from "./physiology-generator";

/**
 * Cross-behavior couplings + full-generator integration (C3 Domain B, design §3).
 * The couplings — not the single behaviors — are what sell life (§3), so these pin:
 *  - coupling 2「大サッカードに瞬きが乗る」(§3-2): the saccade-blink sync injects blinks
 *    at large saccades, and the generator's max-on-collision merge means it can only
 *    DEEPEN — never truncate — a natural blink;
 *  - the full generator emits all семь slots deterministically (representative-time
 *    snapshot + determinism), with no 900-frame golden bloat (裁定5 / §7 配分).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SESSION_SEED = 0x0c0ffee1;

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function fullGenerator(seed: number) {
  return createPhysiologyGenerator({
    seed,
    behaviors: createPhysiologyBehaviorsFromConfig(DEFAULT_FULL_PHYSIOLOGY_CONFIG)
  });
}

describe("config fan-out (Domain A unchanged, Domain B additive)", () => {
  it("default (blink-only) config still fans out exactly [blink]", () => {
    const behaviors = createPhysiologyBehaviorsFromConfig(DEFAULT_PHYSIOLOGY_CONFIG);
    expect(behaviors.map((b) => b.behaviorId)).toEqual(["blink"]);
  });

  it("full config fans out blink + gaze + head + posture + saccade-blink coupling", () => {
    const behaviors = createPhysiologyBehaviorsFromConfig(DEFAULT_FULL_PHYSIOLOGY_CONFIG);
    expect(behaviors.map((b) => b.behaviorId)).toEqual([
      "blink",
      "gaze",
      "head",
      "posture",
      "saccade-blink-sync"
    ]);
  });

  it("the saccade-blink coupling is only wired when gaze is present", () => {
    const noGaze = createPhysiologyBehaviorsFromConfig({
      schemaVersion: "runtime-player-physiology-config-v1",
      blink: DEFAULT_BLINK_BASELINE,
      head: DEFAULT_HEAD_BASELINE,
      posture: DEFAULT_POSTURE_BASELINE
    });
    expect(noGaze.map((b) => b.behaviorId)).not.toContain("saccade-blink-sync");
  });
});

describe("coupling 2「大サッカードに瞬きが乗る」(§3-2)", () => {
  it("injects synced blinks yet never REDUCES a natural blink (max-on-collision)", () => {
    const full = fullGenerator(SESSION_SEED);
    // Blink-only generator with the SAME session seed → identical natural blink
    // sub-stream (same behaviorId 'blink' → same derived sub-seed).
    const natural = createPhysiologyGenerator({
      seed: SESSION_SEED,
      behaviors: createPhysiologyBehaviorsFromConfig(DEFAULT_PHYSIOLOGY_CONFIG)
    });

    let injected = 0;
    for (let t = 0; t <= 600_000; t += 16) {
      const f = full.sample(t)[BLINK_LEFT_SLOT_ID]!;
      const n = natural.sample(t)[BLINK_LEFT_SLOT_ID]!;
      // union semantics: a synced blink can only deepen the natural stream.
      expect(f).toBeGreaterThanOrEqual(n - 1e-9);
      // both eye slots stay equal (裁定4) in the merged output too.
      // (checked separately below)
      if (f > n + 0.5) {
        injected += 1;
      }
    }
    // the coupling genuinely added blinks that were not in the natural stream.
    expect(injected).toBeGreaterThan(0);
  });

  it("every injected blink coincides with a large saccade (the coupling is gaze-driven)", () => {
    const full = fullGenerator(SESSION_SEED);
    const gazeSeed = deriveBehaviorSeed(SESSION_SEED, "gaze");
    const natural = createPhysiologyGenerator({
      seed: SESSION_SEED,
      behaviors: createPhysiologyBehaviorsFromConfig(DEFAULT_PHYSIOLOGY_CONFIG)
    });
    // Large-saccade start times (the only place a synced blink may originate).
    const largeStarts = enumerateFixations(gazeSeed, DEFAULT_GAZE_BASELINE, 300_000)
      .filter((f) => f.isLarge)
      .map((f) => f.startMs);

    let injectedCount = 0;
    for (let t = 0; t <= 300_000; t += 16) {
      const f = full.sample(t)[BLINK_LEFT_SLOT_ID]!;
      const n = natural.sample(t)[BLINK_LEFT_SLOT_ID]!;
      if (f > n + 0.5) {
        injectedCount += 1;
        // the synced blink envelope spans ~320ms from a large saccade's start.
        const nearLarge = largeStarts.some((Ts) => t - Ts >= 0 && t - Ts <= 340);
        expect(nearLarge, `injected blink at t=${t} sits on a large saccade`).toBe(true);
      }
    }
    expect(injectedCount).toBeGreaterThan(0);
  });
});

describe("full generator — shape, equality, determinism", () => {
  it("emits all seven C3 slots; both eye slots stay equal (裁定4)", () => {
    const gen = fullGenerator(SESSION_SEED);
    for (const t of [0, 1234, 40_000, 123_456]) {
      const a = gen.sample(t);
      expect(Object.keys(a).sort()).toEqual(
        [
          "eye-blink-left",
          "eye-blink-right",
          "gaze-horizontal",
          "gaze-vertical",
          "head-horizontal",
          "head-vertical",
          "head-tilt",
          "body-x",
          "body-z"
        ].sort()
      );
      expect(a[BLINK_LEFT_SLOT_ID]).toBe(a[BLINK_RIGHT_SLOT_ID]);
      for (const [slot, v] of Object.entries(a)) {
        expect(v, `${slot} in range`).toBeGreaterThanOrEqual(-1);
        expect(v, `${slot} in range`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("is deterministic across two independent generator instances (同種同列)", () => {
    const a = fullGenerator(SESSION_SEED);
    const b = fullGenerator(SESSION_SEED);
    for (let frame = 0; frame < 4000; frame += 1) {
      expect(a.sample(frame * 16)).toEqual(b.sample(frame * 16));
    }
  });

  it("a different session seed produces a different stream (異種異列)", () => {
    const a = fullGenerator(SESSION_SEED);
    const b = fullGenerator(SESSION_SEED ^ 0x5a5a5a5a);
    let differs = false;
    for (let frame = 0; frame < 2000; frame += 1) {
      const t = frame * 16;
      if (a.sample(t)["head-horizontal"] !== b.sample(t)["head-horizontal"]) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });
});

describe("full generator — representative-time snapshot (§7 配分, no 900-frame bloat)", () => {
  it("matches the committed snapshot golden across representative times", () => {
    const gen = fullGenerator(0x5eed1234); // fixed seed, like the blink golden
    const slots = [
      "gaze-horizontal",
      "gaze-vertical",
      "head-horizontal",
      "head-vertical",
      "head-tilt",
      "body-x",
      "body-z",
      "eye-blink-left"
    ];
    const snapshot: Record<string, number[]> = {};
    // 25 representative times spanning ~4 minutes (a saccade, a reseat, drift…).
    const times: number[] = [];
    for (let i = 0; i < 25; i += 1) {
      times.push(i * 10_000);
    }
    for (const slot of slots) {
      snapshot[slot] = times.map((t) => round6(gen.sample(t)[slot]!));
    }

    const path = join(HERE, "full-generator-snapshot.golden.json");
    const shouldUpdate =
      process.env.UPDATE_BLINK_GOLDEN === "1" || !existsSync(path);
    if (shouldUpdate) {
      writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    }
    const golden = JSON.parse(readFileSync(path, "utf8")) as Record<string, number[]>;
    expect(snapshot).toEqual(golden);
  });
});

describe("posture — no composite period detectable within 30s (裁定5)", () => {
  it("body-x autocorrelation stays low and never rebounds (no loop ≤ 90s)", () => {
    const gen = fullGenerator(SESSION_SEED);
    const series: number[] = [];
    for (let t = 0; t <= 600_000; t += 200) {
      series.push(gen.sample(t)["body-x"]!);
    }
    const mean = series.reduce((a, b) => a + b, 0) / series.length;
    const centered = series.map((v) => v - mean);
    const energy = centered.reduce((a, b) => a + b * b, 0);
    const autocorr = (lagSteps: number): number => {
      let dot = 0;
      for (let i = 0; i + lagSteps < centered.length; i += 1) {
        dot += centered[i]! * centered[i + lagSteps]!;
      }
      return dot / energy;
    };
    // 200ms step → 30s = 150 steps. Check the whole 30..90s band for a loop rebound.
    for (let sec = 30; sec <= 90; sec += 10) {
      expect(autocorr((sec * 1000) / 200)).toBeLessThan(0.6);
    }
  });
});
