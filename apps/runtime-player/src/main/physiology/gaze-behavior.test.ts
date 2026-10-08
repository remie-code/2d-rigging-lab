import { describe, expect, it } from "vitest";

import { semanticSlotDefinitions } from "../live-mapping/semantic-slot-definitions";
import {
  createGazeBehavior,
  GAZE_HORIZONTAL_SLOT_ID,
  GAZE_VERTICAL_SLOT_ID,
  sampleGazeValue
} from "./gaze-behavior";
import {
  DEFAULT_GAZE_BASELINE,
  enumerateFixations,
  INITIAL_GAZE_CURSOR,
  LARGE_SACCADE_THRESHOLD,
  sampleGazeLanding,
  walkGazeTo,
  type GazeBaselineConfig,
  type GazeFixation
} from "./gaze-saccade";

/**
 * Gaze behavior (C3 Domain B, design §1.1). Pins: determinism (同種同列・異種異列),
 * the discrete fixation grammar (instant step, NO lerp = anti-pattern §4-1), the
 * fixation-time distribution (jitter + refractory floor, §1.1), and the landing
 * distribution (camera/home dominance, §1.1「どのへんを見がち」).
 */

const SEED = 0x51a2e;

function firstLargeSaccade(
  seed: number,
  config: GazeBaselineConfig,
  minAbsX = 0
): GazeFixation {
  const fixations = enumerateFixations(seed, config, 120_000);
  const found = fixations.find(
    (f) => f.index >= 1 && f.isLarge && Math.abs(f.x) >= minAbsX
  );
  expect(found).toBeDefined();
  return found!;
}

describe("gaze behavior — determinism (同種同列・異種異列)", () => {
  it("same seed + config + time → identical value", () => {
    for (const t of [0, 500, 1600, 4321, 30000]) {
      expect(sampleGazeValue(SEED, DEFAULT_GAZE_BASELINE, t)).toEqual(
        sampleGazeValue(SEED, DEFAULT_GAZE_BASELINE, t)
      );
    }
  });

  it("different seed → different series; different config → different series", () => {
    const capture = (seed: number, config: GazeBaselineConfig): number[] => {
      const s: number[] = [];
      for (let t = 0; t <= 40_000; t += 100) {
        s.push(sampleGazeValue(seed, config, t).x);
      }
      return s;
    };
    const base = capture(SEED, DEFAULT_GAZE_BASELINE);
    expect(capture(SEED, DEFAULT_GAZE_BASELINE)).toEqual(base);
    expect(capture(SEED ^ 0x1234, DEFAULT_GAZE_BASELINE)).not.toEqual(base);
    expect(
      capture(SEED, { ...DEFAULT_GAZE_BASELINE, dwellMs: 700 })
    ).not.toEqual(base);
  });

  it("cursor-threaded sampling equals a from-epoch walk (memo faithfulness)", () => {
    const behavior = createGazeBehavior();
    for (let frame = 0; frame < 4000; frame += 1) {
      const t = frame * 16;
      const threaded = behavior.sample({ seed: SEED, logicalTimeMs: t });
      const fromEpoch = sampleGazeValue(SEED, DEFAULT_GAZE_BASELINE, t);
      expect(threaded[GAZE_HORIZONTAL_SLOT_ID]).toBe(fromEpoch.x);
      expect(threaded[GAZE_VERTICAL_SLOT_ID]).toBe(fromEpoch.y);
    }
  });

  it("rewinds when logical time goes backward", () => {
    const behavior = createGazeBehavior();
    behavior.sample({ seed: SEED, logicalTimeMs: 40_000 });
    for (const t of [0, 1600, 8000, 40_000]) {
      const out = behavior.sample({ seed: SEED, logicalTimeMs: t });
      const ref = sampleGazeValue(SEED, DEFAULT_GAZE_BASELINE, t);
      expect(out[GAZE_HORIZONTAL_SLOT_ID]).toBe(ref.x);
    }
  });
});

describe("gaze behavior — discrete fixation grammar (instant step, NO lerp §4-1)", () => {
  it("emits exactly the two gaze slots within [-1, 1]", () => {
    const behavior = createGazeBehavior();
    for (const t of [0, 1000, 5000, 20000]) {
      const out = behavior.sample({ seed: SEED, logicalTimeMs: t });
      expect(Object.keys(out).sort()).toEqual(
        [GAZE_HORIZONTAL_SLOT_ID, GAZE_VERTICAL_SLOT_ID].sort()
      );
      for (const v of Object.values(out)) {
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("jumps the FULL landing distance in one frame, then holds (no lerp)", () => {
    const saccade = firstLargeSaccade(SEED, DEFAULT_GAZE_BASELINE);
    const Ts = saccade.startMs;

    // Just before vs just after the saccade instant: the jump happens in one step.
    const before = sampleGazeValue(SEED, DEFAULT_GAZE_BASELINE, Ts - 1);
    const after = sampleGazeValue(SEED, DEFAULT_GAZE_BASELINE, Ts + 1);
    const jump = Math.hypot(after.x - before.x, after.y - before.y);
    // The single-step jump is essentially the whole landing distance (a lerp would
    // spread it over many frames, making this delta small).
    expect(jump).toBeGreaterThan(LARGE_SACCADE_THRESHOLD - 0.05);

    // …and DURING the fixation the eye holds the landing: frame-to-frame motion is
    // just the tiny micro-jitter, orders of magnitude below the saccade jump.
    let maxWithin = 0;
    let prev = sampleGazeValue(SEED, DEFAULT_GAZE_BASELINE, Ts + 1);
    for (let t = Ts + 17; t < saccade.endMs - 1; t += 16) {
      const v = sampleGazeValue(SEED, DEFAULT_GAZE_BASELINE, t);
      maxWithin = Math.max(maxWithin, Math.hypot(v.x - prev.x, v.y - prev.y));
      prev = v;
    }
    expect(maxWithin).toBeLessThan(0.02);
    expect(maxWithin).toBeLessThan(jump / 5);
  });

  it("stays essentially at the landing point across a whole fixation (留まる)", () => {
    const saccade = firstLargeSaccade(SEED, DEFAULT_GAZE_BASELINE);
    const mid = (saccade.startMs + saccade.endMs) / 2;
    const v = sampleGazeValue(SEED, DEFAULT_GAZE_BASELINE, mid);
    // within micro-jitter amplitude of the landing
    expect(Math.abs(v.x - saccade.x)).toBeLessThan(0.02);
    expect(Math.abs(v.y - saccade.y)).toBeLessThan(0.02);
  });
});

describe("gaze — fixation-time distribution (§1.1 ばらつき + 最短不応期)", () => {
  const fixations = enumerateFixations(SEED, DEFAULT_GAZE_BASELINE, 600_000);

  it("has a meaningful population with real variance (等間隔=即機械)", () => {
    expect(fixations.length).toBeGreaterThan(400);
    const durs = fixations.map((f) => f.durationMs);
    const mean = durs.reduce((a, b) => a + b, 0) / durs.length;
    const variance =
      durs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / durs.length;
    // real jitter, not a fixed interval
    expect(Math.sqrt(variance)).toBeGreaterThan(100);
  });

  it("never fixates below the minimum refractory floor", () => {
    // MIN_FIXATION_MS = 200 (internal universal floor, design §1.1).
    for (const f of fixations) {
      expect(f.durationMs).toBeGreaterThanOrEqual(200 - 1e-6);
    }
  });

  it("the refractory floor actually binds under a short-dwell config", () => {
    // A very short dwell would push some draws below 200ms; the floor clamps them.
    const jumpy: GazeBaselineConfig = { cameraFocus: 0.5, restlessness: 1, dwellMs: 250 };
    const jf = enumerateFixations(SEED, jumpy, 200_000);
    const atFloor = jf.filter((f) => f.durationMs <= 200 + 1e-6).length;
    expect(atFloor).toBeGreaterThan(0);
    for (const f of jf) {
      expect(f.durationMs).toBeGreaterThanOrEqual(200 - 1e-6);
    }
  });
});

describe("gaze — landing distribution (§1.1 camera/home dominance)", () => {
  it("rests near the camera (home) far more than anywhere else", () => {
    const fixations = enumerateFixations(SEED, DEFAULT_GAZE_BASELINE, 600_000);
    const nearHome = fixations.filter((f) => Math.hypot(f.x, f.y) < 0.15).length;
    // camera is dominant (design §1.1「カメラがホームで支配的」)
    expect(nearHome / fixations.length).toBeGreaterThan(0.5);
  });

  it("Camera Focus raises the home share; Restlessness lowers it and widens spread", () => {
    const share = (config: GazeBaselineConfig): number => {
      const f = enumerateFixations(SEED, config, 600_000);
      return f.filter((x) => Math.hypot(x.x, x.y) < 0.15).length / f.length;
    };
    const focused = share({ ...DEFAULT_GAZE_BASELINE, cameraFocus: 1.5, restlessness: 0.2 });
    const restless = share({ ...DEFAULT_GAZE_BASELINE, cameraFocus: 0.2, restlessness: 1.2 });
    expect(focused).toBeGreaterThan(restless);
  });

  it("produces a real population of LARGE saccades (feeds the couplings)", () => {
    const fixations = enumerateFixations(SEED, DEFAULT_GAZE_BASELINE, 600_000);
    const large = fixations.filter((f) => f.isLarge).length;
    expect(large).toBeGreaterThan(50);
    // but not everything is a large jump (home fixations cluster)
    expect(large / fixations.length).toBeLessThan(0.7);
  });
});

describe("gaze slot ids stay in sync with the semantic slot vocabulary", () => {
  it("matches semantic-slot-definitions gaze slot ids", () => {
    const gazeSlotIds = semanticSlotDefinitions
      .filter((d) => d.sourceKind === "gaze-centered")
      .map((d) => d.slotId)
      .sort();
    expect(gazeSlotIds).toEqual(
      [GAZE_HORIZONTAL_SLOT_ID, GAZE_VERTICAL_SLOT_ID].sort()
    );
  });

  it("walkGazeTo cursor re-query is stable (same time → same fixation)", () => {
    const a = walkGazeTo(SEED, DEFAULT_GAZE_BASELINE, INITIAL_GAZE_CURSOR, 12_345);
    const b = walkGazeTo(SEED, DEFAULT_GAZE_BASELINE, a.cursor, 12_345);
    expect(b.fixation.index).toBe(a.fixation.index);
    expect(sampleGazeLanding(SEED, DEFAULT_GAZE_BASELINE, 12_345)).toEqual({
      x: a.fixation.x,
      y: a.fixation.y
    });
  });
});
