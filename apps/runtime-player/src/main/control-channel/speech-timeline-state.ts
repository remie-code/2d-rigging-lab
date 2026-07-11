/**
 * Speech timeline GROUP evaluator (C6 Domain A, 設計 §7 裁定1/2, §3.5). A single
 * time-evolving descriptor for the WHOLE mouth group (5 vowels + mouth.open) driven
 * by a MORA列 (`{ timeMs, vowel, s }[]`). Unlike a per-slot `SlotCurveState` (which
 * owns ONE slot independently), this state owns the 6 mouth slots as a UNIT and
 * evaluates all of them from a SINGLE progress `p` and a SINGLE opening strength
 * `s(nowMs)` so that the convex identity Σ(5 vowels) = s = mouth.open holds
 * STRUCTURALLY (裁定2), not by any after-the-fact correction.
 *
 * Naming discipline (設計 §7, C5 命名規律の延長): the per-slot side is `curve`
 * (slot-curve-state.ts, `SlotCurveState`). The GROUP timeline side is `speech
 * timeline` (this module, `SpeechTimelineState`). This module never says "curve" for
 * its own state, and slot-curve-state.ts never says "speech"/"timeline" — so the two
 * machines (per-slot curve vs group timeline) stay lexically distinct, as C4/C5's
 * "envelope(封筒) vs envelope(曲線)" collision taught us to guard against.
 *
 * The smoothstep math is a 写経 of slot-curve-state.ts:79-82 (itself a 写経 of the C3
 * blink generator) — physiology/ is NEVER imported (boundary規律). Only the universal
 * release length is shared with the per-slot machine (imported constant), matching the
 * store's injectable release.
 */

import { RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS } from "./slot-curve-state";

/** The five Japanese vowels the mora contract speaks in (器 is language-neutral;
 * the phoneme→vowel mapping lives in 魂側, 設計 §2). */
export type SpeechVowel = "a" | "i" | "u" | "e" | "o";

/** One mora: a relative time (ms from timeline start), one vowel, one opening
 * strength `s` (0..1, PRE-scale). This is the store-facing shape of a validated
 * `intent.speech` entry (validation is Domain B; the store trusts this shape). */
export type SpeechMora = {
  readonly timeMs: number;
  readonly vowel: SpeechVowel;
  readonly s: number;
};

/**
 * The six mouth-group slot ids this evaluator owns as a UNIT. Fixed (not carried in
 * the payload): the mora contract names a vowel LABEL, the evaluator maps it to the
 * slot id. Order is `mouth-open` then the five vowel slots.
 * (semantic-slot-definitions.ts:117-191.)
 */
export const RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT = "mouth-open";
export const RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS: Readonly<
  Record<SpeechVowel, string>
> = {
  a: "mouth-vowel-a",
  i: "mouth-vowel-i",
  u: "mouth-vowel-u",
  e: "mouth-vowel-e",
  o: "mouth-vowel-o"
};
export const RUNTIME_PLAYER_SPEECH_MOUTH_GROUP_SLOTS: readonly string[] = [
  RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT,
  RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.a,
  RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.i,
  RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.u,
  RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.e,
  RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.o
];

const MOUTH_GROUP_SLOT_SET = new Set(RUNTIME_PLAYER_SPEECH_MOUTH_GROUP_SLOTS);

/** True iff `slotId` is one of the 6 mouth-group slots the evaluator owns (used by
 * the store to detect a per-slot ↔ group conflict for the 後着置換 arbitration). */
export function isSpeechMouthGroupSlot(slotId: string): boolean {
  return MOUTH_GROUP_SLOT_SET.has(slotId);
}

/**
 * Universal speech opening scale (設計 §3.2/§7 裁定5). Non-exposed, non-parameterized
 * const: 発話時は100%形(キャリブレーション到達形)まで開かない。Every `s` is multiplied by
 * this so a well-formed mora with s=1 still tops out at 0.8, never the full 1.0. Not in
 * the payload/contract — a universal default like the release/attack constants.
 */
export const RUNTIME_PLAYER_SPEECH_OPEN_SCALE = 0.8;

/**
 * Re-articulation dip floor (設計 §3.5). Non-exposed universal const. At every mora
 * BOUNDARY the opening strength `s` sinks to this fraction (~40%) — the近似 of a
 * consonant closure gesture the mora contract drops. Multiplying `s` by the dip keeps
 * the convex identity intact (Σvowel = s = mouth.open) because the dip folds into the
 * single `s`.
 */
export const RUNTIME_PLAYER_SPEECH_DIP_FLOOR = 0.4;

/**
 * Re-articulation dip half-window (設計 §3.5: 「30〜50msで回復」). Non-exposed universal
 * const. The dip valley is a smoothstep that reaches the floor AT the boundary and
 * recovers to 1.0 over this many ms on each side, so the whole valley is symmetric and
 * CONTINUOUS across the boundary (the same floor value is hit from both the outgoing
 * segment's right edge and the incoming segment's left edge). Effect: 同母音連続
 * (「のところど」= o×5拍) still moves per beat — s dips at each boundary and recovers
 * mid-segment — instead of freezing.
 */
export const RUNTIME_PLAYER_SPEECH_DIP_MS = 40;

/**
 * Onset ramp window (設計 §4 相乗り: onset は基底→先頭モーラを連続で立ち上げる, スナップ禁止).
 * Non-exposed universal const. A global smoothstep factor rises 0→1 over this window
 * from timeline start so the mouth opens FROM the living base (mouth base = 0, 生理は
 * 口を産まない §2.8) rather than snapping to the first mora. Also serves as the
 * fallback terminal hold for a single-mora timeline (see below).
 */
export const RUNTIME_PLAYER_SPEECH_ONSET_MS = 60;

/**
 * The live speech timeline state the store holds (at most one — 一発話=一タイムライン,
 * 設計 §7 裁定4). `moras` is the validated mora列 (relative times), `startAtMs` the
 * acceptance instant (absolute wall clock; absolute mora time = startAtMs + timeMs).
 * A forced release (disconnect → releaseAll, or a per-slot mouth intent taking over →
 * 後着置換) captures the 6 slots' current values and eases them to the living base,
 * overriding the natural timeline — exactly like SlotCurveState's forced release.
 */
export type SpeechTimelineState = {
  readonly moras: readonly SpeechMora[];
  readonly startAtMs: number;
  readonly forcedReleaseAtMs?: number;
  readonly forcedReleaseFrom?: Readonly<Record<string, number>>;
};

export type SpeechTimelineSample = {
  /** The 6 mouth-group slot values (mouth.open + 5 vowels). Inactive vowels are
   * emitted as explicit 0 so the group fully re-specifies its slots each tick. */
  readonly values: Readonly<Record<string, number>>;
  /** True once the timeline has fully closed (terminal release / forced release
   * complete) — the store drops the state and the slots return to base for free. */
  readonly done: boolean;
};

export type SpeechTimelineSampleOptions = {
  /** Universal release length. Defaults to the per-slot machine's default (400ms);
   * the store passes its own injectable `releaseMs` so both machines share it. */
  readonly releaseMs?: number;
  /** The living base (release TARGET) for a mouth slot. Defaults to 0 — 生理は口を
   * 産まない (§2.8) so the base is 0 (closed mouth). Injectable for symmetry with the
   * per-slot machine. */
  readonly baseFor?: (slotId: string) => number;
};

/** 写経元: slot-curve-state.ts:79-82 (NOT imported from physiology — boundary規律). */
function smoothstep(x: number): number {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(x: number): number {
  return Math.min(Math.max(x, 0), 1);
}

/**
 * The re-articulation dip factor for a point whose distance to the nearest boundary is
 * `dtMs` (>=0). Floor at the boundary (dt=0), smoothstep up to 1 at dt=DIP_MS. Symmetric
 * on both sides, so taking `min(dipLeft, dipRight)` gives a valley that is continuous
 * across a boundary and for ANY mora interval (even shorter than the dip window: both
 * sides just stay nearer the floor).
 */
function dipFactor(dtMs: number): number {
  return lerp(
    RUNTIME_PLAYER_SPEECH_DIP_FLOOR,
    1,
    smoothstep(clamp01(dtMs / RUNTIME_PLAYER_SPEECH_DIP_MS))
  );
}

function baseValuesRecord(baseFor: (slotId: string) => number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const slot of RUNTIME_PLAYER_SPEECH_MOUTH_GROUP_SLOTS) {
    out[slot] = baseFor(slot);
  }
  return out;
}

/**
 * Evaluate the whole mouth group at `nowMs` — the C6 core (設計 §7 裁定2, §3.5).
 *
 * 相補式 (凸恒等を構造で保証): in a segment [i, i+1] with progress
 *   p = smoothstep((e - t_i)/(t_{i+1} - t_i))  (e = nowMs - startAtMs, t = relative mora time)
 * a SINGLE opening strength drives everything:
 *   s(nowMs) = lerp(s_i, s_{i+1}, p) · dip · onset · term · OPEN_SCALE
 * and the 6 slots are read off that ONE s and that ONE p:
 *   mouth.open      = s
 *   vowel[v_i]      = s · (1 − p)
 *   vowel[v_{i+1}]  = s · p          (accumulated if v_i == v_{i+1})
 *   other vowels    = 0
 * so Σ(5 vowels) = s·((1−p)+p) = s = mouth.open is an ALGEBRAIC identity, never a
 * checked/corrected sum (裁定2, レビュー blocking観点). dip/onset/term/OPEN_SCALE are all
 * folded into the single `s`, so they never break the identity.
 *
 * Time hypothesis (設計 §3.2): the cross-fade length IS the mora interval t_{i+1}−t_i,
 * so attack≈モーラ長 and undershoot emerges — a fast mora is still mid-cross-fade when
 * the next target arrives, so the vertex is never reached (mixing survives). No steady
 * blend table, no payload attack field.
 *
 * Boundaries (設計 §4, 裁量 documented in the report):
 *  - onset  [0, ONSET_MS): a global smoothstep 0→1 lifts s FROM the base (0) — no snap.
 *  - terminal (e ≥ last mora): hold the last vowel for `holdMs` (= the last mora interval
 *    for a multi-mora列, else ONSET_MS for a single mora), then a smoothstep release to 0
 *    over `releaseMs` — 発話後に口が自然に閉じる. `done` once fully closed → pruned.
 */
export function sampleSpeechTimeline(
  speech: SpeechTimelineState,
  nowMs: number,
  options?: SpeechTimelineSampleOptions
): SpeechTimelineSample {
  const releaseMs =
    options?.releaseMs ?? RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS;
  const baseFor = options?.baseFor ?? (() => 0);

  // Forced release (disconnect / per-slot mouth intent 後着置換): ease the captured 6
  // values to the living base. A UNIFORM scale by `w` preserves the convex identity —
  // Σ lerp(0, vFrom, w) = w·ΣvFrom = w·openFrom = lerp(0, openFrom, w) — since the
  // captured `from` came from a state that already satisfied it.
  if (speech.forcedReleaseAtMs !== undefined) {
    const rel = nowMs - speech.forcedReleaseAtMs;
    if (rel >= releaseMs) {
      return { values: baseValuesRecord(baseFor), done: true };
    }
    const from = speech.forcedReleaseFrom ?? {};
    const w = 1 - smoothstep(clamp01(rel / releaseMs));
    const values: Record<string, number> = {};
    for (const slot of RUNTIME_PLAYER_SPEECH_MOUTH_GROUP_SLOTS) {
      const base = baseFor(slot);
      values[slot] = lerp(base, from[slot] ?? base, w);
    }
    return { values, done: false };
  }

  const moras = speech.moras;
  const n = moras.length;
  // Defensive: an empty timeline is never installed by the store (Domain B rejects it),
  // but keep the pure function total.
  if (n === 0) {
    return { values: baseValuesRecord(baseFor), done: true };
  }

  const e = Math.max(0, nowMs - speech.startAtMs);

  // Locate the current mora index i: the largest i with moras[i].timeMs <= e (clamped
  // to the last). Segment [i, i+1] exists iff i < n-1; otherwise we are in the terminal
  // hold/release of the last mora.
  let i = 0;
  while (i < n - 1) {
    const next = moras[i + 1];
    if (next === undefined || next.timeMs > e) {
      break;
    }
    i += 1;
  }

  let p: number;
  let sRaw: number;
  let vowelPrev: SpeechVowel;
  let vowelNext: SpeechVowel;
  let leftBoundaryMs: number;
  let rightBoundaryMs: number | undefined;
  let term = 1;

  const cur = moras[i];
  const next = moras[i + 1];
  if (cur === undefined) {
    // Unreachable (i is always in-range), but keeps the function total.
    return { values: baseValuesRecord(baseFor), done: true };
  }

  if (next !== undefined) {
    // Inside (or just before, via clamp) segment [i, i+1].
    const t0 = cur.timeMs;
    const t1 = next.timeMs;
    const interval = t1 - t0;
    const frac = interval > 0 ? (e - t0) / interval : 1;
    p = smoothstep(clamp01(frac));
    sRaw = lerp(cur.s, next.s, p);
    vowelPrev = cur.vowel;
    vowelNext = next.vowel;
    leftBoundaryMs = t0;
    rightBoundaryMs = t1;
  } else {
    // Terminal: at/after the last mora. Weight fully on the last vowel (p=0).
    p = 0;
    sRaw = cur.s;
    vowelPrev = cur.vowel;
    vowelNext = cur.vowel;
    leftBoundaryMs = cur.timeMs;
    rightBoundaryMs = undefined;

    // 裁量: terminal hold = the last mora interval (derived, no magic number) for a
    // multi-mora列; ONSET_MS for a single mora (no interval to derive from). After the
    // hold, a smoothstep release closes the mouth to base over `releaseMs`.
    const prev = moras[n - 2];
    const holdMs =
      prev !== undefined
        ? cur.timeMs - prev.timeMs
        : RUNTIME_PLAYER_SPEECH_ONSET_MS;
    const releaseStartMs = cur.timeMs + holdMs;
    if (e >= releaseStartMs) {
      const rel = e - releaseStartMs;
      if (rel >= releaseMs) {
        return { values: baseValuesRecord(baseFor), done: true };
      }
      term = 1 - smoothstep(clamp01(rel / releaseMs));
    }
  }

  // Re-articulation dip: floor at each boundary, recovering mid-segment (§3.5). The min
  // of the two nearest-boundary ramps is a valley continuous across every boundary.
  const dipLeft = dipFactor(e - leftBoundaryMs);
  const dipRight =
    rightBoundaryMs !== undefined ? dipFactor(rightBoundaryMs - e) : 1;
  const dip = Math.min(dipLeft, dipRight);

  // Onset: a global rise from the base (0) so the mouth does not snap open (§4).
  const onset = smoothstep(clamp01(e / RUNTIME_PLAYER_SPEECH_ONSET_MS));

  // The SINGLE opening strength — the sole basis for all 6 slots (裁定2).
  const s = sRaw * dip * onset * term * RUNTIME_PLAYER_SPEECH_OPEN_SCALE;

  const values: Record<string, number> = {
    [RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT]: s,
    [RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.a]: 0,
    [RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.i]: 0,
    [RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.u]: 0,
    [RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.e]: 0,
    [RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS.o]: 0
  };
  // Complementary split from the SINGLE p (accumulate for same-vowel continuation).
  const prevSlot = RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS[vowelPrev];
  const nextSlot = RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS[vowelNext];
  values[prevSlot] = (values[prevSlot] ?? 0) + s * (1 - p);
  values[nextSlot] = (values[nextSlot] ?? 0) + s * p;

  return { values, done: false };
}
