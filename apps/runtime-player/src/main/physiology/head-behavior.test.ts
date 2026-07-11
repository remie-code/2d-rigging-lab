import { describe, expect, it } from "vitest";

import { semanticSlotDefinitions } from "../live-mapping/semantic-slot-definitions";
import type { BehaviorSampleInput } from "./behavior-class";
import { deriveBehaviorSeed } from "./deterministic-hash";
import {
  DEFAULT_GAZE_BASELINE,
  enumerateFixations,
  type GazeFixation
} from "./gaze-saccade";
import {
  createHeadBehavior,
  DEFAULT_HEAD_BASELINE,
  HEAD_HORIZONTAL_SLOT_ID,
  HEAD_TILT_SLOT_ID,
  HEAD_VERTICAL_SLOT_ID
} from "./head-behavior";
import { DEFAULT_POSTURE_BASELINE, sampleReseatBaseline } from "./posture-reseat";

/**
 * Head behavior (C3 Domain B, design §1.2 + couplings §3-1/§3-3). Pins: determinism
 * & cursor-memo faithfulness (incl. the coupling ring), the multi-timescale noise
 * (30s period non-detection §1.2, punctuation §4-5), and the two head couplings:
 *  - §3-1「目が先、頭が後」: the head lag-follows a large saccade 300〜700ms later,
 *    partway (not all the way);
 *  - §3-3「体は頭の親」: the head's home rides on the posture reseat baseline.
 */

const SESSION_SEED = 0x11a2b3;
const HEAD_SEED = deriveBehaviorSeed(SESSION_SEED, "head");
const GAZE_SEED = deriveBehaviorSeed(SESSION_SEED, "gaze");
const POSTURE_SEED = deriveBehaviorSeed(SESSION_SEED, "posture");

// Internal universal constants mirrored here (露出しない in head-behavior.ts).
const POSTURE_TO_HEAD_H = 0.4;
const POSTURE_TO_HEAD_TILT = 0.5;

function sampleAt(
  behavior: ReturnType<typeof createHeadBehavior>,
  t: number
): Record<string, number> {
  const input: BehaviorSampleInput = {
    seed: HEAD_SEED,
    logicalTimeMs: t,
    couplingSeed: SESSION_SEED
  };
  return behavior.sample(input) as Record<string, number>;
}

describe("head behavior — determinism & cursor-memo faithfulness", () => {
  it("emits exactly the three head slots within [-1, 1]", () => {
    const behavior = createHeadBehavior(DEFAULT_HEAD_BASELINE, {
      gaze: DEFAULT_GAZE_BASELINE,
      posture: DEFAULT_POSTURE_BASELINE
    });
    for (const t of [0, 1000, 30000, 90000]) {
      const out = sampleAt(behavior, t);
      expect(Object.keys(out).sort()).toEqual(
        [HEAD_HORIZONTAL_SLOT_ID, HEAD_VERTICAL_SLOT_ID, HEAD_TILT_SLOT_ID].sort()
      );
      for (const v of Object.values(out)) {
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("cursor-threaded sampling equals a fresh from-epoch instance (ring memo)", () => {
    // The follow ring + reseat cursor are a forward-only memo; a fresh instance
    // sampled ONCE at time t must equal the threaded instance at t — the coupling
    // is a pure function of time, cadence-independent.
    const coupling = { gaze: DEFAULT_GAZE_BASELINE, posture: DEFAULT_POSTURE_BASELINE };
    const threaded = createHeadBehavior(DEFAULT_HEAD_BASELINE, coupling);
    for (let frame = 0; frame < 3000; frame += 1) {
      const t = frame * 32;
      const threadedOut = sampleAt(threaded, t);
      const fresh = sampleAt(createHeadBehavior(DEFAULT_HEAD_BASELINE, coupling), t);
      expect(threadedOut[HEAD_HORIZONTAL_SLOT_ID]).toBe(fresh[HEAD_HORIZONTAL_SLOT_ID]);
      expect(threadedOut[HEAD_VERTICAL_SLOT_ID]).toBe(fresh[HEAD_VERTICAL_SLOT_ID]);
      expect(threadedOut[HEAD_TILT_SLOT_ID]).toBe(fresh[HEAD_TILT_SLOT_ID]);
    }
  });

  it("rewinds correctly when logical time goes backward", () => {
    const coupling = { gaze: DEFAULT_GAZE_BASELINE, posture: DEFAULT_POSTURE_BASELINE };
    const behavior = createHeadBehavior(DEFAULT_HEAD_BASELINE, coupling);
    sampleAt(behavior, 120_000);
    for (const t of [0, 5000, 40_000, 120_000]) {
      const rewound = sampleAt(behavior, t);
      const fresh = sampleAt(createHeadBehavior(DEFAULT_HEAD_BASELINE, coupling), t);
      expect(rewound[HEAD_HORIZONTAL_SLOT_ID]).toBe(fresh[HEAD_HORIZONTAL_SLOT_ID]);
    }
  });
});

describe("head behavior — multi-timescale noise (§1.2 / anti-patterns §4-2/§4-5)", () => {
  // Sway-only head isolates the multi-timescale noise (no couplings).
  const swayOnly = createHeadBehavior(DEFAULT_HEAD_BASELINE, {});
  const series: number[] = [];
  for (let t = 0; t <= 600_000; t += 100) {
    series.push(
      swayOnly.sample({ seed: HEAD_SEED, logicalTimeMs: t })[HEAD_HORIZONTAL_SLOT_ID]!
    );
  }
  // Mean-centered autocorrelation (standard): the slow drift gives a finite window
  // a small nonzero DC offset that would otherwise inflate the raw metric. A LOOP of
  // period P shows a REBOUND to ~1 at τ = P; a mere slow drift decays monotonically.
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

  it("has no composite period detectable within a 30s window (裁定5 / §4-2)", () => {
    // 30s / 100ms = 300 steps.
    expect(autocorr(300)).toBeLessThan(0.5);
  });

  it("does not loop: autocorrelation never rebounds toward 1 (no period ≤ 90s)", () => {
    // A single-frequency / looped signal would rebound to ≈1 at its period(s). The
    // layered octaves decay and never climb back — no machine loop.
    for (let sec = 20; sec <= 90; sec += 5) {
      expect(autocorr(sec * 10)).toBeLessThan(0.5);
    }
  });

  it("keeps stillness as punctuation, not constant sway (§4-5「静止に句読点」)", () => {
    const nearHome = series.filter((v) => Math.abs(v) < 0.1).length;
    expect(nearHome / series.length).toBeGreaterThan(0.5);
    // but it does move sometimes (excursions exist)
    expect(Math.max(...series.map((v) => Math.abs(v)))).toBeGreaterThan(0.15);
  });

  it("Sway scales the amplitude (§6)", () => {
    const amp = (sway: number): number => {
      const b = createHeadBehavior({ sway, follow: 0 }, {});
      let m = 0;
      for (let t = 0; t <= 120_000; t += 200) {
        m = Math.max(m, Math.abs(b.sample({ seed: HEAD_SEED, logicalTimeMs: t })[HEAD_HORIZONTAL_SLOT_ID]!));
      }
      return m;
    };
    expect(amp(0.8)).toBeGreaterThan(amp(0.3));
  });
});

describe("head coupling 1「目が先、頭が後」(§3-1)", () => {
  function firstLargeWithX(minAbsX: number): GazeFixation {
    const fixations = enumerateFixations(GAZE_SEED, DEFAULT_GAZE_BASELINE, 120_000);
    const found = fixations.find((f) => f.isLarge && Math.abs(f.x) >= minAbsX);
    expect(found).toBeDefined();
    return found!;
  }

  it("lag-follows the FIRST large saccade after 300〜700ms, partway, same direction", () => {
    const large = firstLargeWithX(0.2);
    const Ts = large.startMs;

    const withFollow = createHeadBehavior(DEFAULT_HEAD_BASELINE, { gaze: DEFAULT_GAZE_BASELINE });
    const noFollow = createHeadBehavior({ sway: DEFAULT_HEAD_BASELINE.sway, follow: 0 }, {
      gaze: DEFAULT_GAZE_BASELINE
    });

    let firstActiveT = -1;
    let diffAtActive = 0;
    let diffLate = 0;
    for (let t = 0; t <= Ts + 1300; t += 16) {
      const d =
        sampleAt(withFollow, t)[HEAD_HORIZONTAL_SLOT_ID]! -
        sampleAt(noFollow, t)[HEAD_HORIZONTAL_SLOT_ID]!;
      // Before the earliest possible activation (Ts + 300 min delay) there is NO
      // follow at all — the eye jumped but the head has not started (目が先).
      if (t < Ts + 300) {
        expect(Math.abs(d)).toBeLessThan(1e-9);
      }
      if (firstActiveT < 0 && Math.abs(d) > 0.02) {
        firstActiveT = t;
        diffAtActive = d;
      }
      if (t >= Ts + 1150) {
        diffLate = d;
      }
    }

    // The head DID start following, and only within the delay+ramp window.
    expect(firstActiveT).toBeGreaterThanOrEqual(Ts + 300);
    expect(firstActiveT).toBeLessThanOrEqual(Ts + 1200);
    // Same direction as the gaze landing (the head turns TOWARD the gaze).
    expect(Math.sign(diffAtActive)).toBe(Math.sign(large.x));
    // …but only PARTWAY「全部は向かない」: the head offset is a fraction of the gaze.
    expect(Math.abs(diffLate)).toBeGreaterThan(0);
    expect(Math.abs(diffLate)).toBeLessThan(Math.abs(large.x));
  });

  it("Follow depth scales the follow contribution (§6)", () => {
    const large = firstLargeWithX(0.2);
    const tLate = large.startMs + 1150;
    const followAmount = (follow: number): number => {
      const on = createHeadBehavior({ sway: DEFAULT_HEAD_BASELINE.sway, follow }, {
        gaze: DEFAULT_GAZE_BASELINE
      });
      const off = createHeadBehavior({ sway: DEFAULT_HEAD_BASELINE.sway, follow: 0 }, {
        gaze: DEFAULT_GAZE_BASELINE
      });
      let d = 0;
      for (let t = 0; t <= tLate; t += 16) {
        d = sampleAt(on, t)[HEAD_HORIZONTAL_SLOT_ID]! - sampleAt(off, t)[HEAD_HORIZONTAL_SLOT_ID]!;
      }
      return Math.abs(d);
    };
    expect(followAmount(0.8)).toBeGreaterThan(followAmount(0.3));
  });
});

describe("head coupling 3「体は頭の親」(§3-3)", () => {
  it("head home rides on the posture reseat baseline (exact offset)", () => {
    const withPosture = createHeadBehavior(DEFAULT_HEAD_BASELINE, { posture: DEFAULT_POSTURE_BASELINE });
    const noPosture = createHeadBehavior(DEFAULT_HEAD_BASELINE, {});

    let sawNonZeroOffset = false;
    for (let t = 0; t <= 400_000; t += 2000) {
      const withOut = sampleAt(withPosture, t);
      const noOut = sampleAt(noPosture, t);
      const reseat = sampleReseatBaseline(POSTURE_SEED, DEFAULT_POSTURE_BASELINE, t);
      // The ONLY difference between the two is the posture-parent offset on the home.
      expect(withOut[HEAD_HORIZONTAL_SLOT_ID]! - noOut[HEAD_HORIZONTAL_SLOT_ID]!).toBeCloseTo(
        POSTURE_TO_HEAD_H * reseat.x,
        6
      );
      expect(withOut[HEAD_TILT_SLOT_ID]! - noOut[HEAD_TILT_SLOT_ID]!).toBeCloseTo(
        POSTURE_TO_HEAD_TILT * reseat.z,
        6
      );
      if (Math.hypot(reseat.x, reseat.z) > 0.05) {
        sawNonZeroOffset = true;
      }
    }
    // the coupling is genuinely exercised (a reseat moved the baseline)
    expect(sawNonZeroOffset).toBe(true);
  });
});

describe("head slot ids stay in sync with the semantic slot vocabulary", () => {
  it("matches semantic-slot-definitions head slot ids", () => {
    const headSlotIds = semanticSlotDefinitions
      .filter((d) => d.sourceKind === "head-centered")
      .map((d) => d.slotId)
      .sort();
    expect(headSlotIds).toEqual(
      [HEAD_HORIZONTAL_SLOT_ID, HEAD_VERTICAL_SLOT_ID, HEAD_TILT_SLOT_ID].sort()
    );
  });
});
