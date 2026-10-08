import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { semanticSlotDefinitions } from "../live-mapping/semantic-slot-definitions";
import {
  BODY_X_SLOT_ID,
  BODY_Z_SLOT_ID,
  createPostureBehavior,
  samplePostureValue
} from "./posture-behavior";
import {
  DEFAULT_POSTURE_BASELINE,
  enumerateReseats,
  sampleReseatBaseline
} from "./posture-reseat";

/**
 * Posture behavior (C3 Domain B, design §1.3). Pins: determinism, the closed-form
 * body smoothness (裁定2 — NO body-follow-state / EMA), the constant slow drift
 * (small amplitude), and the rare「座り直し」reseat schedule (frequency + refractory).
 */

const SEED = 0x9051c;

describe("posture behavior — determinism & closed-form smoothness (裁定2)", () => {
  it("same seed + config + time → identical value", () => {
    for (const t of [0, 5000, 60000, 180000]) {
      expect(samplePostureValue(SEED, DEFAULT_POSTURE_BASELINE, t)).toEqual(
        samplePostureValue(SEED, DEFAULT_POSTURE_BASELINE, t)
      );
    }
  });

  it("cursor-threaded sampling equals a from-epoch walk (memo faithfulness)", () => {
    const behavior = createPostureBehavior();
    for (let frame = 0; frame < 6000; frame += 1) {
      const t = frame * 32;
      const threaded = behavior.sample({ seed: SEED, logicalTimeMs: t });
      const fromEpoch = samplePostureValue(SEED, DEFAULT_POSTURE_BASELINE, t);
      expect(threaded[BODY_X_SLOT_ID]).toBe(fromEpoch.x);
      expect(threaded[BODY_Z_SLOT_ID]).toBe(fromEpoch.z);
    }
  });

  it("is smooth: adjacent 16ms samples move by a small bounded amount", () => {
    // Closed-form (value noise + smootherstep reseat ramp) → no jumps. A stateful
    // EMA would NOT be a pure function of time; this bound also catches a reseat
    // STEP (a discontinuity) sneaking in instead of the smooth ramp.
    let maxDiff = 0;
    let prev = samplePostureValue(SEED, DEFAULT_POSTURE_BASELINE, 0);
    for (let t = 16; t <= 400_000; t += 16) {
      const v = samplePostureValue(SEED, DEFAULT_POSTURE_BASELINE, t);
      maxDiff = Math.max(
        maxDiff,
        Math.abs(v.x - prev.x),
        Math.abs(v.z - prev.z)
      );
      prev = v;
    }
    expect(maxDiff).toBeLessThan(0.01);
    expect(maxDiff).toBeGreaterThan(0); // it does move
  });

  it("this module never imports the stateful body-follow-state EMA (裁定2)", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    for (const name of ["posture-behavior.ts", "posture-reseat.ts"]) {
      // Strip comments so the docstrings that NAME the forbidden module (as prose)
      // do not false-positive; we guard against an actual import in code.
      const code = readFileSync(join(here, name), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
      expect(code.includes("body-follow-state")).toBe(false);
    }
    // sanity: the scan actually found the files
    expect(readdirSync(here)).toContain("posture-behavior.ts");
  });
});

describe("posture behavior — output shape & small amplitude (振幅小)", () => {
  it("emits exactly the two body slots within [-1, 1]", () => {
    const behavior = createPostureBehavior();
    for (const t of [0, 30000, 120000]) {
      const out = behavior.sample({ seed: SEED, logicalTimeMs: t });
      expect(Object.keys(out).sort()).toEqual(
        [BODY_X_SLOT_ID, BODY_Z_SLOT_ID].sort()
      );
      for (const v of Object.values(out)) {
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("keeps posture drift small (design §1.3「振幅小」)", () => {
    let maxAbs = 0;
    for (let t = 0; t <= 600_000; t += 200) {
      const v = samplePostureValue(SEED, DEFAULT_POSTURE_BASELINE, t);
      maxAbs = Math.max(maxAbs, Math.abs(v.x), Math.abs(v.z));
    }
    // reseat amplitude (≤0.25 at default) + drift (≤0.175) stays well under half-range
    expect(maxAbs).toBeLessThan(0.6);
    expect(maxAbs).toBeGreaterThan(0.1); // but it genuinely wanders
  });
});

describe("posture — reseat schedule (§1.3 稀な組み替え + 基線移動)", () => {
  const reseats = enumerateReseats(SEED, DEFAULT_POSTURE_BASELINE, 3_600_000);

  it("re-settles on the order of minutes, never below the refractory floor", () => {
    expect(reseats.length).toBeGreaterThan(10); // a real population over an hour
    for (let i = 1; i < reseats.length; i += 1) {
      const gap = reseats[i]!.startMs - reseats[i - 1]!.startMs;
      // RESEAT_MIN_INTERVAL_MS = 40_000 (internal floor).
      expect(gap).toBeGreaterThanOrEqual(40_000 - 1e-6);
    }
    const gaps: number[] = [];
    for (let i = 1; i < reseats.length; i += 1) {
      gaps.push(reseats[i]!.startMs - reseats[i - 1]!.startMs);
    }
    const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    // 「数分に一回オーダー」
    expect(meanGap).toBeGreaterThan(60_000);
    expect(meanGap).toBeLessThan(240_000);
  });

  it("Restlessness increases the reseat frequency (§6)", () => {
    const calm = enumerateReseats(SEED, { ...DEFAULT_POSTURE_BASELINE, restlessness: 0 }, 3_600_000);
    const fidgety = enumerateReseats(SEED, { ...DEFAULT_POSTURE_BASELINE, restlessness: 2 }, 3_600_000);
    expect(fidgety.length).toBeGreaterThan(calm.length);
  });

  it("moves the BASELINE to a new place and holds it there (基線ごと動く)", () => {
    const first = reseats[0]!;
    // Well before the first reseat: near the origin baseline.
    const preBaseline = sampleReseatBaseline(SEED, DEFAULT_POSTURE_BASELINE, first.startMs - 5000);
    expect(Math.hypot(preBaseline.x, preBaseline.z)).toBeLessThan(0.05);

    // After the transition completes: parked at the reseat target and holding.
    const settledA = sampleReseatBaseline(SEED, DEFAULT_POSTURE_BASELINE, first.startMs + 3000);
    const settledB = sampleReseatBaseline(SEED, DEFAULT_POSTURE_BASELINE, first.startMs + 8000);
    expect(settledA.x).toBeCloseTo(first.targetX, 6);
    expect(settledA.z).toBeCloseTo(first.targetZ, 6);
    // it STAYS (held, not drifting back to center — the reseat baseline is constant
    // between events, design §1.3)
    expect(settledB.x).toBeCloseTo(first.targetX, 6);
    expect(settledB.z).toBeCloseTo(first.targetZ, 6);
    // and the move was real
    expect(Math.hypot(first.targetX, first.targetZ)).toBeGreaterThan(0.02);
  });

  it("the reseat transition is a smooth ramp, not a step (裁定2 closed-form)", () => {
    const first = reseats[0]!;
    // Sample densely across the transition window; the max single-step move must be
    // small (a hard step would produce one large jump).
    let maxStep = 0;
    let prev = sampleReseatBaseline(SEED, DEFAULT_POSTURE_BASELINE, first.startMs - 100);
    for (let t = first.startMs - 100; t <= first.startMs + 2000; t += 16) {
      const v = sampleReseatBaseline(SEED, DEFAULT_POSTURE_BASELINE, t);
      maxStep = Math.max(maxStep, Math.hypot(v.x - prev.x, v.z - prev.z));
      prev = v;
    }
    expect(maxStep).toBeLessThan(0.02);
  });
});

describe("posture slot ids stay in sync with the semantic slot vocabulary", () => {
  it("matches semantic-slot-definitions body slot ids", () => {
    const bodySlotIds = semanticSlotDefinitions
      .filter((d) => d.sourceKind === "body-x" || d.sourceKind === "body-z")
      .map((d) => d.slotId)
      .sort();
    expect(bodySlotIds).toEqual([BODY_X_SLOT_ID, BODY_Z_SLOT_ID].sort());
  });
});
