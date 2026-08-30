/**
 * Control Channel overlay store (C4 §4/§6 → C5 Domain A). A single time-evolving
 * SLOT CURVE STATE MACHINE (裁定3): each entry is a `SlotCurveState` that the store
 * evaluates at the query `nowMs`. `intent.set` and `intent.envelope` are folded into
 * the SAME machine — set is a degenerate curve (default ease-in attack≈100ms /
 * sustain=TTL−attack / no decay / universal release), envelope is a full
 * attack→sustain→decay curve. The external
 * contract stays two kinds; the store holds one state per slot (never set-vs-envelope
 * as two states).
 *
 * This is fixture-boundary-OUTSIDE runtime state (裁定1): it holds wall-clock times
 * from WS I/O and never touches the pure generator `sample()`. The curve math is a
 * 写経 of the C3 blink generator (see slot-curve-state.ts) — physiology/ is never
 * imported (boundary規律).
 *
 * Two feedback signals flow in from the heart each tick via {@link snapshot}:
 *  - `baseValues`  = the PURE generator activations. This is the release TARGET
 *    (「生きた基底」livingBase, 毎tick動く, NEVER frozen — 裁定2). §4 の TARGET.
 *  - `prevResolved` = the previous tick's post-merge resolvedActivations (案B, the
 *    heart retains and supplies it, autonomous-frame-heart.ts). This is the re-attack
 *    START source: a new intent's `startValue = prevResolved[slot]` so every
 *    transition begins from the current effective value (連続性原則 3.1). §4 の START.
 *
 * There are at most 16 semantic slots, so the map is naturally bounded; a new
 * intent for the same slotId overwrites the previous curve (re-attack, not stacking).
 *
 * C6 Domain A adds a SECOND kind of entry alongside the per-slot curve map: a single
 * optional SPEECH TIMELINE (`#speech`, a `SpeechTimelineState`) that owns the 6
 * mouth-group slots (mouth.open + 5 vowels) as a UNIT and is driven by a mora列
 * (`setSpeech`). It is evaluated in {@link snapshot} from the SAME wall-clock `nowMs`
 * as the curves and merged into the same live Record. The two machines never both
 * drive one slot ambiguously — a single 後着置換 arbitration lives here (see
 * {@link setSpeech} / {@link #yieldSpeechForSlot}): setSpeech drops the per-slot
 * curves on the 6 mouth slots (the group takes exclusive ownership), and a per-slot
 * `set`/`envelope` landing on a mouth slot during speech forced-releases the group
 * (per-slot then wins that slot; the group's other slots ease to base). In the merge,
 * per-slot curves are written AFTER the group so a per-slot curve deterministically
 * overrides the group on any shared slot.
 */

import {
  RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS,
  RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_SET_ATTACK_MS,
  sampleSlotCurve,
  slotCurveDriveEndMs,
  type SlotCurveState
} from "./slot-curve-state";
import {
  isSpeechMouthGroupSlot,
  RUNTIME_PLAYER_SPEECH_MOUTH_GROUP_SLOTS,
  RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT,
  sampleSpeechTimeline,
  type SpeechMora,
  type SpeechTimelineState
} from "./speech-timeline-state";

/**
 * An `intent.envelope` shape (Domain B wires `intent.envelope` payloads to this).
 * Durations in ms; `peak` in the slot's normalized range. Release is NOT here — it
 * is the universal non-exposed default (裁定2).
 */
export type RuntimePlayerControlChannelEnvelopeSpec = {
  readonly peak: number;
  readonly attackMs: number;
  readonly sustainMs: number;
  readonly decayMs: number;
};

/**
 * One live overlay for the Channel page's "Active overlays" diagnostic (C4 §1,
 * Domain C read model). `remainingTtlMs` is the countdown until the curve stops
 * actively driving (end of drive = attack+sustain+decay, matching C4's TTL for a
 * set) — the release tail is NOT counted as "driven". The raw absolute instants
 * never cross to the renderer, only the relative remainder.
 */
export type RuntimePlayerControlChannelActiveOverlay = {
  readonly slotId: string;
  readonly value: number;
  readonly remainingTtlMs: number;
};

export type RuntimePlayerControlChannelOverlayStoreOptions = {
  /** Universal release time (裁定2). Injectable for tests; default 400ms. */
  readonly releaseMs?: number;
  /**
   * Re-articulation dip floor provider (C6 Domain E改, §13). Read fresh EACH snapshot so
   * moving the Physiology `Articulation` slider changes the dip depth即時反映 even during a
   * long (looping) utterance. Returns the Player-side profile floor, or `undefined` to fall
   * back to the evaluator's universal default. Data-driven (the composition root wires it
   * from the Physiology config seam); the store never queries a role. Absent → the speech
   * evaluator uses its universal default floor, so every existing test is unchanged.
   */
  readonly dipFloorProvider?: () => number | undefined;
};

export class RuntimePlayerControlChannelOverlayStore {
  readonly #curves = new Map<string, SlotCurveState>();
  /** The single live speech timeline (C6, 一発話=一タイムライン §7 裁定4), or null. */
  #speech: SpeechTimelineState | null = null;
  readonly #releaseMs: number;
  /** Re-articulation dip floor provider (§13, read per snapshot), or null. */
  readonly #dipFloorProvider: (() => number | undefined) | null;
  /** Last query time observed via {@link snapshot} — the set curve's start anchor. */
  #lastNowMs = 0;
  /** Last living base (pure activations) observed — the release TARGET (裁定2). */
  #lastBaseValues: Record<string, number> = {};
  /** Last post-merge resolved effective values (案B) — the re-attack START source. */
  #lastResolved: Record<string, number> = {};

  constructor(options?: RuntimePlayerControlChannelOverlayStoreOptions) {
    this.#releaseMs =
      options?.releaseMs ?? RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS;
    this.#dipFloorProvider = options?.dipFloorProvider ?? null;
  }

  /**
   * Record an accepted `intent.set` as a DEGENERATE curve (裁定3, §7 改定): a default
   * ease-in attack (`RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_SET_ATTACK_MS`≈100ms) ramps the
   * current effective value → `value` (連続性原則をattackにも貫徹, no instant step),
   * then sustain holds `value` up to the fixed `expiresAtMs`, no decay, universal
   * release. C4 で守るのは契約の形であって動きの粗さではない(§7 改定)。
   *
   * TTL(drive-end)不変が絶対条件: the attack is ABSORBED out of sustain, so
   * `slotCurveDriveEndMs` (= startAtMs + attack + sustain + decay) still lands exactly
   * on `expiresAtMs` — `activeOverlays`' remainingTtlMs and the expiry instant are
   * unchanged, and release (400ms / 動く基底へのblend) is untouched. A short TTL window
   * clamps the attack (`min(default, window)`) so sustain never goes negative. External
   * signature is unchanged so Domain B / the existing dispatch call it as before.
   */
  setOverlay(slotId: string, value: number, expiresAtMs: number): void {
    this.#yieldSpeechForSlot(slotId, this.#lastNowMs);
    const startAtMs = this.#lastNowMs;
    const windowMs = Math.max(0, expiresAtMs - startAtMs);
    const attackMs = Math.min(
      RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_SET_ATTACK_MS,
      windowMs
    );
    this.#curves.set(slotId, {
      startAtMs,
      startValue: this.#effectiveStart(slotId),
      peak: value,
      attackMs,
      sustainMs: windowMs - attackMs,
      decayMs: 0,
      releaseMs: this.#releaseMs
    });
  }

  /**
   * Record an accepted `intent.envelope` as a full curve (Domain B calls this).
   * `startAtMs` is the acceptance instant. `startValue` = the current effective value
   * (案B) so the attack re-attacks from what the slot is already showing (連続性 3.1).
   */
  setEnvelope(
    slotId: string,
    spec: RuntimePlayerControlChannelEnvelopeSpec,
    startAtMs: number
  ): void {
    this.#yieldSpeechForSlot(slotId, startAtMs);
    this.#curves.set(slotId, {
      startAtMs,
      startValue: this.#effectiveStart(slotId),
      peak: spec.peak,
      attackMs: Math.max(0, spec.attackMs),
      sustainMs: Math.max(0, spec.sustainMs),
      decayMs: Math.max(0, spec.decayMs),
      releaseMs: this.#releaseMs
    });
  }

  /**
   * Record an accepted `intent.speech` as the single live SPEECH TIMELINE (C6 Domain A,
   * §7 裁定1). `moras` is the validated mora列 (relative times; validation = Domain B),
   * `startAtMs` the acceptance instant (absolute mora time = startAtMs + mora.timeMs).
   * The group evaluator (evaluated in {@link snapshot}) then drives the 6 mouth-group
   * slots as a unit — the convex identity Σvowel = s = mouth.open holds structurally
   * (speech-timeline-state.ts).
   *
   * 後着置換 (裁定3) + group re-attack (§12項目2 / 裁定B): the new speech drive REPLACES any
   * prior mouth drive. Per-slot curves on the 6 mouth slots are dropped so the group takes
   * EXCLUSIVE ownership (no slot is ever driven by both the group and a per-slot curve at
   * once — the single arbitration point). Rather than the group's onset always rising from
   * 0 (which SNAPPED down when the mouth was already open — the delete専有 of Domain A), the
   * group now立ち上がる FROM the current effective mouth-open (`onsetFromOpen`, captured from
   * the 案B prevResolved feedback via {@link #effectiveStart}). So a concurrent per-slot
   * mouth drive is superseded CONTINUOUSLY: the mouth-open magnitude carries over and the
   * group re-forms the vowel shape from it. In the idle常況 the effective value is 0, so the
   * onset rises from 0 exactly as before (the forward version of the existing reverse
   * re-attack — {@link #yieldSpeechForSlot} — not a new machine). A prior speech timeline is
   * likewise replaced (the later utterance wins).
   *
   * This store intentionally has no AudioPlayer completion signal: an accepted
   * Control Channel request is its sole ordering input. Soul must therefore send
   * the next timeline only when its FIFO playback boundary has reached that job;
   * duplicate/late audio callbacks never call this method on their own.
   */
  setSpeech(moras: readonly SpeechMora[], startAtMs: number): void {
    // Capture the current effective mouth-open (案B) BEFORE dropping the per-slot curves, so
    // the group onset re-attacks from what the mouth is actually showing (no snap).
    const onsetFromOpen = this.#effectiveStart(
      RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT
    );
    for (const slotId of RUNTIME_PLAYER_SPEECH_MOUTH_GROUP_SLOTS) {
      this.#curves.delete(slotId);
    }
    this.#speech = { moras: [...moras], startAtMs, onsetFromOpen };
  }

  /**
   * Hard-drop every curve (immediate, no release). Used only where there is no
   * living body to ease toward — model unload / runtime-export teardown
   * (runtime-player-main.ts). Client disconnect uses {@link releaseAll} instead.
   */
  clearAll(): void {
    this.#curves.clear();
    this.#speech = null;
  }

  /**
   * Disconnect → every slot eases to the living base over the universal release
   * (§2.3「魂の死=表情がすっと解けて呼吸だけが残る」). Each live curve is switched to
   * a forced release from its CURRENT effective value; a curve already fully returned
   * is dropped. No immediate snap (that was C4). The speech timeline (if any) is
   * forced-released the same way — the 6 mouth slots ease from their current values to
   * base (口がすっと閉じる, §2.8).
   */
  releaseAll(nowMs: number): void {
    this.#lastNowMs = nowMs;
    for (const [slotId, curve] of this.#curves) {
      const sample = sampleSlotCurve(curve, nowMs, this.#livingBase(slotId));
      if (sample.done) {
        this.#curves.delete(slotId);
        continue;
      }
      this.#curves.set(slotId, {
        ...curve,
        forcedReleaseAtMs: nowMs,
        forcedReleaseFromValue: sample.value
      });
    }
    this.#forceReleaseSpeech(nowMs);
  }

  /**
   * The channel-driven values at `nowMs` as a `slotId → value` Record, ready to
   * Record-merge over the generator `activations` in the heart tick. Evaluates every
   * curve (attack/sustain/decay/release) at `nowMs`. Curves that have fully returned
   * to the living base are pruned (the heart drives this with a monotonic wall clock,
   * so pruning is the natural tick advance). Both feedback signals are cached here:
   * `baseValues` (livingBase, release TARGET) and `prevResolved` (case B re-attack
   * START source). Both default to `{}` so a caller that only passes `nowMs` still
   * works (release then eases to 0 for want of a base).
   */
  snapshot(
    nowMs: number,
    baseValues: Record<string, number> = {},
    prevResolved: Record<string, number> = {}
  ): Record<string, number> {
    this.#lastNowMs = nowMs;
    this.#lastBaseValues = baseValues;
    this.#lastResolved = prevResolved;

    const live: Record<string, number> = {};

    // Group timeline FIRST (lower merge priority): its 6 mouth-slot values are written
    // before the per-slot curves, so a per-slot curve on a shared mouth slot (only ever
    // present after a 後着置換 that forced-released the group) deterministically wins.
    if (this.#speech !== null) {
      const sample = sampleSpeechTimeline(this.#speech, nowMs, {
        releaseMs: this.#releaseMs,
        baseFor: (slotId) => this.#livingBase(slotId),
        ...this.#dipFloorOption()
      });
      if (sample.done) {
        this.#speech = null;
      } else {
        Object.assign(live, sample.values);
      }
    }

    for (const [slotId, curve] of this.#curves) {
      const sample = sampleSlotCurve(curve, nowMs, this.#livingBase(slotId));
      if (sample.done) {
        this.#curves.delete(slotId);
        continue;
      }
      live[slotId] = sample.value;
    }
    return live;
  }

  /**
   * The actively-driven overlays at `nowMs` as diagnostic rows (C4 §1 Active
   * overlays, Domain C read model). A curve counts as "active" while it is still
   * DRIVING (before its release begins); the release tail is omitted (the体 is
   * easing back, not being driven). `remainingTtlMs` is the countdown to the end of
   * drive — for a set this equals C4's `expiresAtMs - nowMs`. A pure read: it never
   * mutates entries. Uses the last observed living base for any in-flight value.
   */
  activeOverlays(
    nowMs: number
  ): readonly RuntimePlayerControlChannelActiveOverlay[] {
    const live: RuntimePlayerControlChannelActiveOverlay[] = [];

    for (const [slotId, curve] of this.#curves) {
      if (curve.forcedReleaseAtMs !== undefined) {
        continue; // forced release → returning to base, not actively driven.
      }
      const driveEndMs = slotCurveDriveEndMs(curve);
      if (nowMs >= driveEndMs) {
        continue; // in the release tail (or done) → not actively driven.
      }
      const sample = sampleSlotCurve(curve, nowMs, this.#livingBase(slotId));
      live.push({
        slotId,
        value: sample.value,
        remainingTtlMs: driveEndMs - nowMs
      });
    }

    return live;
  }

  /**
   * 後着置換 (裁定3), per-slot side: if a per-slot `set`/`envelope` lands on one of the
   * 6 mouth-group slots while a speech timeline is live, the whole group YIELDS —
   * forced-released to base — so the per-slot curve can take over that slot (the group
   * cannot partially own the six, or Σvowel = mouth.open would break). The group's other
   * five slots ease to base; the targeted slot is driven by the incoming per-slot curve,
   * which re-attacks from the current effective value (案B) for continuity. This is the
   * single point where a per-slot drive overrides the group.
   */
  #yieldSpeechForSlot(slotId: string, nowMs: number): void {
    if (this.#speech !== null && isSpeechMouthGroupSlot(slotId)) {
      this.#forceReleaseSpeech(nowMs);
    }
  }

  /**
   * Switch the live speech timeline (if any) into a forced release from its CURRENT 6
   * values toward the living base, mirroring a per-slot curve's forced release. A
   * timeline already fully closed is dropped. Idempotent-ish: a timeline already in
   * forced release keeps its original anchor (re-capturing would restart the ease).
   */
  #forceReleaseSpeech(nowMs: number): void {
    const speech = this.#speech;
    if (speech === null || speech.forcedReleaseAtMs !== undefined) {
      return;
    }
    const sample = sampleSpeechTimeline(speech, nowMs, {
      releaseMs: this.#releaseMs,
      baseFor: (slotId) => this.#livingBase(slotId),
      ...this.#dipFloorOption()
    });
    if (sample.done) {
      this.#speech = null;
      return;
    }
    this.#speech = {
      ...speech,
      forcedReleaseAtMs: nowMs,
      forcedReleaseFrom: sample.values
    };
  }

  /**
   * The current re-articulation dip floor option for the speech evaluator (§13), read
   * fresh from the provider so an Articulation slider move takes effect即時. Returns a
   * conditional spread (`{ dipFloor }` only when a finite number is supplied) so an absent
   * or non-finite provider falls back to the evaluator's universal default —
   * exactOptionalPropertyTypes-safe.
   */
  #dipFloorOption(): { dipFloor?: number } {
    const floor = this.#dipFloorProvider?.();
    return typeof floor === "number" && Number.isFinite(floor)
      ? { dipFloor: floor }
      : {};
  }

  /** Case B (連続性 3.1): the effective value the slot is currently showing. */
  #effectiveStart(slotId: string): number {
    const resolved = this.#lastResolved[slotId];
    if (typeof resolved === "number" && Number.isFinite(resolved)) {
      return resolved;
    }
    return this.#livingBase(slotId);
  }

  /** The living base for `slotId` (release TARGET); rest = 0 when the generator
   * emits nothing for it. */
  #livingBase(slotId: string): number {
    const base = this.#lastBaseValues[slotId];
    return typeof base === "number" && Number.isFinite(base) ? base : 0;
  }
}
