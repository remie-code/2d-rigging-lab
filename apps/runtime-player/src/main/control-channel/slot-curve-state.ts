/**
 * Slot curve state machine (C5 Domain A, 裁定3). A single time-evolving descriptor
 * for one semantic slot's channel drive. Both `intent.set` (a degenerate curve:
 * default ease-in attack≈100ms / sustain=TTL−attack / no decay / universal release)
 * and `intent.envelope`
 * (a full attack→sustain→decay curve) are folded into THIS one machine — the store
 * never holds set and envelope as two separate states (裁定3, external contract
 * stays 2 kinds).
 *
 * Naming discipline (設計 §7): the CURVE side is `curve` (this module, `SlotCurveState`).
 * The word "envelope" is reserved for the C4 message envelope (封筒) and the
 * `intent.envelope` contract kind (Domain B). This module never says "envelope".
 *
 * The curve math is a 写経 of the C3 blink generator (physiology/blink-behavior.ts
 * :207-229 `smoothstep` / `blinkEnvelope`): same close(attack)/hold(sustain)/
 * open(decay)+smoothstep structure, lifted OUTSIDE physiology/ (this is runtime
 * state on the wall clock, outside the determinism boundary) so physiology/ is
 * never imported — the 3-line smoothstep is COPIED, per the boundary規律.
 */

/**
 * Universal default release time (裁定2). Non-exposed, non-parameterized constant:
 * every forced return-to-baseline (set TTL expiry, disconnect) blends to the living
 * base over this window. Chosen at 400ms so「魂を殺しても」表情がすっと解ける.
 */
export const RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS = 400;

/**
 * Default set ease-in attack time (§7 裁定3 改定, 2026-07-11 人間ゲートのカクつき診断).
 * A set is no longer an instant step to `value`: it eases startValue→value over this
 * smoothstep window so that streaming set-drive (魂の TTL 方式) reads as「演じる」, not
 * 「跳ねる」. The C4 外面互換で守るのは契約の形(kind・フィールド)であって動きの粗さ
 * ではない(粗さこそ C5 の精緻化対象)。TTL(drive-end)は不変: the store ABSORBS this
 * attack out of the set's sustain (see control-channel-overlay-store.ts#setOverlay),
 * so `slotCurveDriveEndMs` still lands exactly on `expiresAtMs`. Non-exposed,
 * non-parameterized (universal default, like release). Chosen at 100ms.
 */
export const RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_SET_ATTACK_MS = 100;

/**
 * The maximum slope factor of `smoothstep` (= max of its derivative 6x(1-x), at
 * x=0.5). Exposed so the continuity property tests can DERIVE the per-tick bound
 * from the curve's own parameters (peak, phase durations, frame interval) rather
 * than hard-coding a magic number (レビュー blocking観点: bound は導出であること).
 */
export const RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE = 1.5;

export type SlotCurvePhase = "attack" | "sustain" | "decay" | "release";

/**
 * One slot's live curve. Phases run attack→sustain→decay→release off `startAtMs`.
 * `startValue` is the effective value the slot was showing at acceptance (連続性
 * 原則 3.1: every transition begins from the current effective value = case B's
 * lastResolvedActivations[slot]); attack ramps startValue→peak so a re-attack never
 * snaps. A forced release (disconnect → releaseAll) overrides the natural timeline:
 * `forcedReleaseAtMs`/`forcedReleaseFromValue` blend the captured hand-off value to
 * the LIVING base immediately, regardless of the current phase.
 */
export type SlotCurveState = {
  readonly startAtMs: number;
  readonly startValue: number;
  readonly peak: number;
  readonly attackMs: number;
  readonly sustainMs: number;
  readonly decayMs: number;
  readonly releaseMs: number;
  readonly forcedReleaseAtMs?: number;
  readonly forcedReleaseFromValue?: number;
};

export type SlotCurveSample = {
  readonly value: number;
  readonly phase: SlotCurvePhase;
  /** True once the curve has fully returned to the living base (entry can be dropped). */
  readonly done: boolean;
};

/** 写経元: physiology/blink-behavior.ts:207-209 (NOT imported — boundary規律). */
function smoothstep(x: number): number {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Evaluate the curve at `nowMs` against the CURRENT living base (毎tick動く pure
 * 生成器基底値). The living base is the release TARGET; it is NEVER frozen (裁定2:
 * freezing the base re-creates the terminal snap). Emphatically distinct from the
 * re-attack START (`startValue`, the resolved effective value at acceptance): §4 の
 * START(=resolved)/TARGET(=living base)区別。
 *
 * Phases (elapsed e = nowMs - startAtMs):
 *  - attack  [0, attackMs):        lerp(startValue, peak, smoothstep)  — drives.
 *  - sustain [.., +sustainMs):     peak                                — drives.
 *  - decay   [.., +decayMs):       peak → 0 (envelope rest), smoothstep — drives.
 *  - release [.., +releaseMs):     lerp(livingBase, releaseFrom, w), w:1→0 — returns.
 * A degenerate set has a default ease-in attackMs≈100ms (startValue→peak smoothstep,
 * §7 裁定3 改定 — 動きの粗さは C4 互換の対象ではない) and decayMs=0 (release blends
 * peak→livingBase directly, no snap). Its attack is absorbed out of sustain so the
 * drive-end stays on the TTL (`expiresAtMs`). A well-formed envelope's decay lands at
 * 0 and release eases 0→livingBase, so the very end tracks the moving base (no snap).
 */
export function sampleSlotCurve(
  curve: SlotCurveState,
  nowMs: number,
  livingBase: number
): SlotCurveSample {
  if (curve.forcedReleaseAtMs !== undefined) {
    const rel = nowMs - curve.forcedReleaseAtMs;
    if (rel >= curve.releaseMs) {
      return { value: livingBase, phase: "release", done: true };
    }
    const w = 1 - smoothstep(rel / curve.releaseMs);
    const from = curve.forcedReleaseFromValue ?? livingBase;
    return { value: lerp(livingBase, from, w), phase: "release", done: false };
  }

  const e = Math.max(0, nowMs - curve.startAtMs);
  const attackEnd = curve.attackMs;
  const sustainEnd = attackEnd + curve.sustainMs;
  const decayEnd = sustainEnd + curve.decayMs;
  const releaseEnd = decayEnd + curve.releaseMs;

  if (e < attackEnd) {
    return {
      value: lerp(curve.startValue, curve.peak, smoothstep(e / curve.attackMs)),
      phase: "attack",
      done: false
    };
  }
  if (e < sustainEnd) {
    return { value: curve.peak, phase: "sustain", done: false };
  }
  if (e < decayEnd) {
    return {
      value: curve.peak * (1 - smoothstep((e - sustainEnd) / curve.decayMs)),
      phase: "decay",
      done: false
    };
  }
  if (e < releaseEnd) {
    // The value entering release: 0 if a decay ran it down (envelope), else the
    // peak (a set has no decay — release blends the held value straight to base).
    const releaseFrom = curve.decayMs > 0 ? 0 : curve.peak;
    const w = 1 - smoothstep((e - decayEnd) / curve.releaseMs);
    return { value: lerp(livingBase, releaseFrom, w), phase: "release", done: false };
  }
  return { value: livingBase, phase: "release", done: true };
}

/**
 * The instant (absolute, in `startAtMs` space) at which the curve stops actively
 * DRIVING and begins its return to base — i.e. the end of decay (for a set, the
 * TTL expiry; for an envelope, attack+sustain+decay). Used by the "Active overlays"
 * diagnostic to report a remaining-drive countdown that matches C4's TTL semantics.
 */
export function slotCurveDriveEndMs(curve: SlotCurveState): number {
  return curve.startAtMs + curve.attackMs + curve.sustainMs + curve.decayMs;
}
