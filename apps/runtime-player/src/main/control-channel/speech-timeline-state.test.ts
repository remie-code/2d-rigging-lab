import { describe, expect, it } from "vitest";

import { RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE } from "./slot-curve-state";
import {
  RUNTIME_PLAYER_SPEECH_DIP_FLOOR,
  RUNTIME_PLAYER_SPEECH_DIP_MS,
  RUNTIME_PLAYER_SPEECH_MOUTH_GROUP_SLOTS,
  RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT,
  RUNTIME_PLAYER_SPEECH_ONSET_MS,
  RUNTIME_PLAYER_SPEECH_OPEN_SCALE,
  RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS,
  sampleSpeechTimeline,
  type SpeechMora,
  type SpeechTimelineState
} from "./speech-timeline-state";

/**
 * C6 Domain A: property + 決定論golden tests for the PURE speech timeline group
 * evaluator (no store / no WS / no timer — `nowMs` is passed in). They pin the convex
 * identity (Σvowel = s = mouth.open, ALL ticks — 最重要), the complementary split, the
 * re-articulation dip (同母音連続の非静止), undershoot (attack≈モーラ間隔), the s縮小
 * 係数, the onset/terminal release, and a derived continuity bound.
 */

const VOWEL_SLOT_IDS = [
  RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.a,
  RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.i,
  RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.u,
  RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.e,
  RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.o
];

function timeline(moras: readonly SpeechMora[]): SpeechTimelineState {
  return { moras, startAtMs: 0 };
}

function vowelSum(values: Readonly<Record<string, number>>): number {
  return VOWEL_SLOT_IDS.reduce((acc, slot) => acc + (values[slot] ?? 0), 0);
}

function mouthOpen(values: Readonly<Record<string, number>>): number {
  return values[RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT] ?? 0;
}

// A representative phrase exercising every branch: all 5 vowels, an o×5 same-vowel run
// (「のところど」相当), varying s, onset, and terminal — self-contained golden material.
const REPRESENTATIVE: readonly SpeechMora[] = [
  { timeMs: 0, vowel: "a", s: 0.6 },
  { timeMs: 140, vowel: "i", s: 0.8 },
  { timeMs: 280, vowel: "u", s: 0.5 },
  { timeMs: 420, vowel: "e", s: 0.7 },
  { timeMs: 560, vowel: "o", s: 0.6 }, // の
  { timeMs: 700, vowel: "o", s: 0.6 }, // と
  { timeMs: 840, vowel: "o", s: 0.6 }, // こ
  { timeMs: 980, vowel: "o", s: 0.6 }, // ろ
  { timeMs: 1120, vowel: "o", s: 0.6 } // ど
];

describe("sampleSpeechTimeline — convex identity Σvowel = s = mouth.open (全tick性質)", () => {
  it("holds at EVERY tick across onset / segments / boundaries / same-vowel run / terminal", () => {
    const speech = timeline(REPRESENTATIVE);
    const lastMs = REPRESENTATIVE[REPRESENTATIVE.length - 1]!.timeMs;
    // Walk from before onset through the full terminal release at a fine step, covering
    // onset, mid-segment, every boundary, the o×5 run, and terminal + release.
    for (let now = 0; now <= lastMs + 800; now += 4) {
      const { values } = sampleSpeechTimeline(speech, now);
      // Σ(5 vowels) === mouth-open, structurally (single s, single p) — float tolerance.
      expect(vowelSum(values)).toBeCloseTo(mouthOpen(values), 9);
    }
  });

  it("holds for a single-mora timeline and through its terminal release", () => {
    const speech = timeline([{ timeMs: 0, vowel: "a", s: 0.7 }]);
    for (let now = 0; now <= 800; now += 4) {
      const { values } = sampleSpeechTimeline(speech, now);
      expect(vowelSum(values)).toBeCloseTo(mouthOpen(values), 9);
    }
  });

  it("holds through a forced release (uniform w-scale preserves the identity)", () => {
    const speech: SpeechTimelineState = {
      moras: REPRESENTATIVE,
      startAtMs: 0,
      forcedReleaseAtMs: 300,
      forcedReleaseFrom: sampleSpeechTimeline(timeline(REPRESENTATIVE), 300).values
    };
    for (let now = 300; now <= 300 + 500; now += 4) {
      const { values } = sampleSpeechTimeline(speech, now);
      expect(vowelSum(values)).toBeCloseTo(mouthOpen(values), 9);
    }
  });
});

describe("sampleSpeechTimeline — complementary split (相補式)", () => {
  it("splits weight equally at the segment temporal midpoint (p=0.5)", () => {
    // Segment [0,200] a→i. At the temporal midpoint e=100, frac=0.5 → p=smoothstep(0.5)
    // =0.5, so weight_prev = weight_next and each vowel = mouth-open/2.
    const speech = timeline([
      { timeMs: 0, vowel: "a", s: 0.8 },
      { timeMs: 200, vowel: "i", s: 0.8 },
      { timeMs: 400, vowel: "u", s: 0.8 }
    ]);
    const { values } = sampleSpeechTimeline(speech, 100);
    const a = values[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.a] ?? 0;
    const i = values[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.i] ?? 0;
    expect(a).toBeCloseTo(i, 9);
    expect(a).toBeCloseTo(mouthOpen(values) / 2, 9);
    // The other three vowels are silent.
    expect(values[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.u]).toBe(0);
    expect(values[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.e]).toBe(0);
    expect(values[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.o]).toBe(0);
  });

  it("leans toward the incoming vowel as p→1 near the segment end", () => {
    const speech = timeline([
      { timeMs: 0, vowel: "a", s: 0.8 },
      { timeMs: 200, vowel: "i", s: 0.8 },
      { timeMs: 400, vowel: "u", s: 0.8 }
    ]);
    // Late in the segment (e=170) i outweighs a.
    const { values } = sampleSpeechTimeline(speech, 170);
    const a = values[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.a] ?? 0;
    const i = values[RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.i] ?? 0;
    expect(i).toBeGreaterThan(a);
  });
});

describe("sampleSpeechTimeline — re-articulation dip (同母音連続の非静止, §3.5)", () => {
  it("makes mouth.open sink at each boundary and recover mid-segment for o×5", () => {
    // 「のところど」: five o moras. Same vowel, same s → without the dip the mouth would
    // FREEZE. With the dip, mouth.open sinks toward the floor at each boundary and
    // recovers mid-segment.
    const oRun: readonly SpeechMora[] = [
      { timeMs: 0, vowel: "o", s: 0.6 },
      { timeMs: 140, vowel: "o", s: 0.6 },
      { timeMs: 280, vowel: "o", s: 0.6 },
      { timeMs: 420, vowel: "o", s: 0.6 },
      { timeMs: 560, vowel: "o", s: 0.6 }
    ];
    const speech = timeline(oRun);

    // Boundary at 280 (dip floor) vs mid-segment 210 (dip fully recovered). Both are
    // past onset (>60) so onset=1 at each.
    const atBoundary = mouthOpen(sampleSpeechTimeline(speech, 280).values);
    const atMidBefore = mouthOpen(sampleSpeechTimeline(speech, 210).values);
    const atMidAfter = mouthOpen(sampleSpeechTimeline(speech, 350).values);
    expect(atBoundary).toBeLessThan(atMidBefore);
    expect(atBoundary).toBeLessThan(atMidAfter);
    // The boundary value is near the floor fraction of the mid value.
    expect(atBoundary).toBeCloseTo(atMidBefore * RUNTIME_PLAYER_SPEECH_DIP_FLOOR, 6);

    // NOT static: sample the whole o-run (past onset) and require real movement.
    let min = Infinity;
    let max = -Infinity;
    for (let now = 100; now <= 560; now += 4) {
      const v = mouthOpen(sampleSpeechTimeline(speech, now).values);
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(max - min).toBeGreaterThan(0.2);
  });
});

describe("sampleSpeechTimeline — undershoot (attack≈モーラ間隔, §3.2)", () => {
  it("reaches a lower vowel peak for fast moras than for slow moras", () => {
    // Same a→i→a shape at two speeds. The incoming vowel i's peak activation is lower
    // when the moras are fast (still mid-cross-fade when the next target arrives — the
    // vertex is never reached, mixing survives), higher when they are slow.
    const fast = timeline([
      { timeMs: 0, vowel: "a", s: 1 },
      { timeMs: 30, vowel: "i", s: 1 },
      { timeMs: 60, vowel: "a", s: 1 }
    ]);
    const slow = timeline([
      { timeMs: 0, vowel: "a", s: 1 },
      { timeMs: 220, vowel: "i", s: 1 },
      { timeMs: 440, vowel: "a", s: 1 }
    ]);

    const peak = (speech: SpeechTimelineState, endMs: number): number => {
      let m = 0;
      for (let now = 0; now <= endMs; now += 2) {
        m = Math.max(m, sampleSpeechTimeline(speech, now).values[
          RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.i
        ] ?? 0);
      }
      return m;
    };

    expect(peak(fast, 60)).toBeLessThan(peak(slow, 440));
  });
});

describe("sampleSpeechTimeline — s縮小係数 (§7 裁定5)", () => {
  it("never opens past the universal scale even for s=1 moras", () => {
    const speech = timeline([
      { timeMs: 0, vowel: "a", s: 1 },
      { timeMs: 200, vowel: "i", s: 1 },
      { timeMs: 400, vowel: "u", s: 1 }
    ]);
    // At a dip-free, onset-complete mid-segment point (e=100), mouth.open tops out at
    // exactly the scale — not the full 1.0.
    expect(mouthOpen(sampleSpeechTimeline(speech, 100).values)).toBeCloseTo(
      RUNTIME_PLAYER_SPEECH_OPEN_SCALE,
      9
    );
    // And it NEVER exceeds the scale anywhere on the timeline.
    for (let now = 0; now <= 900; now += 4) {
      expect(mouthOpen(sampleSpeechTimeline(speech, now).values)).toBeLessThanOrEqual(
        RUNTIME_PLAYER_SPEECH_OPEN_SCALE + 1e-9
      );
    }
  });
});

describe("sampleSpeechTimeline — onset & terminal release (閉口)", () => {
  it("onsets from the base (0) with no snap", () => {
    const speech = timeline([
      { timeMs: 0, vowel: "a", s: 0.6 },
      { timeMs: 200, vowel: "i", s: 0.6 }
    ]);
    // At t0 the global onset factor is 0 → the whole group is at base 0 (no snap open).
    expect(mouthOpen(sampleSpeechTimeline(speech, 0).values)).toBeCloseTo(0, 9);
    // It has risen by the end of the onset window.
    expect(
      mouthOpen(sampleSpeechTimeline(speech, RUNTIME_PLAYER_SPEECH_ONSET_MS).values)
    ).toBeGreaterThan(0.1);
  });

  it("releases the mouth to base after the last mora and reports done", () => {
    const speech = timeline([
      { timeMs: 0, vowel: "a", s: 0.6 },
      { timeMs: 140, vowel: "i", s: 0.8 },
      { timeMs: 280, vowel: "o", s: 0.6 }
    ]);
    // Still driving during the hold just after the last mora.
    expect(mouthOpen(sampleSpeechTimeline(speech, 300).values)).toBeGreaterThan(0);
    // Well after (hold = last interval 140ms, then 400ms release) → fully closed & done.
    const late = sampleSpeechTimeline(speech, 280 + 140 + 400 + 50);
    expect(late.done).toBe(true);
    for (const slot of RUNTIME_PLAYER_SPEECH_MOUTH_GROUP_SLOTS) {
      expect(late.values[slot] ?? 0).toBeCloseTo(0, 9);
    }
  });
});

describe("sampleSpeechTimeline — 決定論golden (代表フレーズ全体)", () => {
  it("pins the 6-slot output series for a fixed tick列", () => {
    // 代表フレーズ: all 5 vowels + an o×5 same-vowel run + varying s + onset + terminal.
    // Ticks hit onset, segment midpoints (p=0.5), every kind of boundary, the o×5 run,
    // the terminal hold, mid-release, and done. Each row is (done, 6 slots) rounded to
    // 1e-6. Every row satisfies Σvowel = mouth.open by construction.
    const speech = timeline(REPRESENTATIVE);
    const round = (x: number): number => Math.round(x * 1e6) / 1e6;
    const ticks = [
      0, 30, 70, 140, 210, 280, 350, 490, 560, 630, 700, 1120, 1200, 1400, 1660
    ];
    const rows = ticks.map((t) => {
      const { values, done } = sampleSpeechTimeline(speech, t);
      const row: Record<string, unknown> = { t, done };
      for (const slot of RUNTIME_PLAYER_SPEECH_MOUTH_GROUP_SLOTS) {
        row[slot] = round(values[slot] ?? 0);
      }
      return row;
    });

    expect(rows).toStrictEqual([
      { t: 0, done: false, "mouth-open": 0, "mouth-vowel-a": 0, "mouth-vowel-i": 0, "mouth-vowel-u": 0, "mouth-vowel-e": 0, "mouth-vowel-o": 0 },
      { t: 30, done: false, "mouth-open": 0.22606, "mouth-vowel-a": 0.199368, "mouth-vowel-i": 0.026692, "mouth-vowel-u": 0, "mouth-vowel-e": 0, "mouth-vowel-o": 0 },
      { t: 70, done: false, "mouth-open": 0.56, "mouth-vowel-a": 0.28, "mouth-vowel-i": 0.28, "mouth-vowel-u": 0, "mouth-vowel-e": 0, "mouth-vowel-o": 0 },
      { t: 140, done: false, "mouth-open": 0.256, "mouth-vowel-a": 0, "mouth-vowel-i": 0.256, "mouth-vowel-u": 0, "mouth-vowel-e": 0, "mouth-vowel-o": 0 },
      { t: 210, done: false, "mouth-open": 0.52, "mouth-vowel-a": 0, "mouth-vowel-i": 0.26, "mouth-vowel-u": 0.26, "mouth-vowel-e": 0, "mouth-vowel-o": 0 },
      { t: 280, done: false, "mouth-open": 0.16, "mouth-vowel-a": 0, "mouth-vowel-i": 0, "mouth-vowel-u": 0.16, "mouth-vowel-e": 0, "mouth-vowel-o": 0 },
      { t: 350, done: false, "mouth-open": 0.48, "mouth-vowel-a": 0, "mouth-vowel-i": 0, "mouth-vowel-u": 0.24, "mouth-vowel-e": 0.24, "mouth-vowel-o": 0 },
      { t: 490, done: false, "mouth-open": 0.52, "mouth-vowel-a": 0, "mouth-vowel-i": 0, "mouth-vowel-u": 0, "mouth-vowel-e": 0.26, "mouth-vowel-o": 0.26 },
      { t: 560, done: false, "mouth-open": 0.192, "mouth-vowel-a": 0, "mouth-vowel-i": 0, "mouth-vowel-u": 0, "mouth-vowel-e": 0, "mouth-vowel-o": 0.192 },
      { t: 630, done: false, "mouth-open": 0.48, "mouth-vowel-a": 0, "mouth-vowel-i": 0, "mouth-vowel-u": 0, "mouth-vowel-e": 0, "mouth-vowel-o": 0.48 },
      { t: 700, done: false, "mouth-open": 0.192, "mouth-vowel-a": 0, "mouth-vowel-i": 0, "mouth-vowel-u": 0, "mouth-vowel-e": 0, "mouth-vowel-o": 0.192 },
      { t: 1120, done: false, "mouth-open": 0.192, "mouth-vowel-a": 0, "mouth-vowel-i": 0, "mouth-vowel-u": 0, "mouth-vowel-e": 0, "mouth-vowel-o": 0.192 },
      { t: 1200, done: false, "mouth-open": 0.48, "mouth-vowel-a": 0, "mouth-vowel-i": 0, "mouth-vowel-u": 0, "mouth-vowel-e": 0, "mouth-vowel-o": 0.48 },
      { t: 1400, done: false, "mouth-open": 0.34476, "mouth-vowel-a": 0, "mouth-vowel-i": 0, "mouth-vowel-u": 0, "mouth-vowel-e": 0, "mouth-vowel-o": 0.34476 },
      { t: 1660, done: true, "mouth-open": 0, "mouth-vowel-a": 0, "mouth-vowel-i": 0, "mouth-vowel-u": 0, "mouth-vowel-e": 0, "mouth-vowel-o": 0 }
    ]);
  });
});

describe("sampleSpeechTimeline — continuity (導出bound, マジックナンバー禁止)", () => {
  it("keeps every adjacent-tick step within a bound DERIVED from the two dominant slopes", () => {
    const speech = timeline(REPRESENTATIVE);
    const frameIntervalMs = 16;
    const releaseMs = 400; // the default the evaluator uses (RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS).
    const slope = RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE;
    const maxS = Math.max(...REPRESENTATIVE.map((m) => m.s));

    // No slot value can exceed this — every value is s·weight with s ≤ OPEN_SCALE·maxS
    // and weight ≤ 1. The gate below anchors on it.
    const valueRange = RUNTIME_PLAYER_SPEECH_OPEN_SCALE * maxS;

    // The bound is built from the TWO steepest smoothstep factors that can coincide at a
    // timeline boundary (the onset at t0 lands on the first mora boundary):
    //   - onset: the value swings a full 0→valueRange over ONSET_MS.
    //   - dip:   the value swings (1−FLOOR)·value over DIP_MS.
    // The remaining factors — the sRaw/p cross-fade (over a mora interval ≥ ONSET_MS
    // here) and the terminal release (over releaseMs) — are 3–10× shallower per ms and
    // are NOT added (that naive 4-way sum over-counts moves that never coincide and
    // inflated the bound past valueRange, making the test vacuous). Every factor here is
    // an evaluator constant, so there is still NO magic number.
    const onsetSlopePerMs = slope / RUNTIME_PLAYER_SPEECH_ONSET_MS;
    const dipSlopePerMs =
      (slope * (1 - RUNTIME_PLAYER_SPEECH_DIP_FLOOR)) / RUNTIME_PLAYER_SPEECH_DIP_MS;
    const boundPerTick =
      valueRange * (onsetSlopePerMs + dipSlopePerMs) * frameIntervalMs;

    // GATE (kills the vacuous case): the bound MUST be strictly below the value range.
    // A regression that snapped a slot across its whole range would step by up to
    // valueRange in one tick; a bound ≥ valueRange could never catch it. This assert is
    // what makes the walk below a real no-snap guard.
    expect(boundPerTick).toBeLessThan(valueRange);

    const lastMs = REPRESENTATIVE[REPRESENTATIVE.length - 1]!.timeMs;
    let previous: Record<string, number> | undefined;
    let observedMax = 0;
    for (let now = 0; now <= lastMs + releaseMs + 200; now += frameIntervalMs) {
      const { values } = sampleSpeechTimeline(speech, now);
      if (previous !== undefined) {
        for (const slot of RUNTIME_PLAYER_SPEECH_MOUTH_GROUP_SLOTS) {
          const step = Math.abs((values[slot] ?? 0) - (previous[slot] ?? 0));
          observedMax = Math.max(observedMax, step);
          expect(step).toBeLessThanOrEqual(boundPerTick);
        }
      }
      previous = { ...values };
    }
    // Sanity: the real walk stays well UNDER the bound (the bound is not just barely
    // above the data), so the gate has real headroom — the evaluator is continuous.
    expect(observedMax).toBeLessThan(boundPerTick);
  });
});
