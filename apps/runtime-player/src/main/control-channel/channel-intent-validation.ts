import {
  runtimePlayerMappingSlotIds,
  type RuntimePlayerMappingSlot,
  type RuntimePlayerMappingSlotId
} from "../../preload/model-mapping-bridge-contract";
import { findSemanticSlotDefinition } from "../live-mapping/semantic-slot-definitions";
import {
  runtimePlayerControlChannelSpeechMaxTimelineLength,
  runtimePlayerControlChannelSpeechVowels,
  type RuntimePlayerControlChannelRejectionCode
} from "./contract/channel-protocol-contract";
import { semanticSlotNormalizedRange } from "./semantic-slot-normalized-range";
import {
  RUNTIME_PLAYER_SPEECH_MOUTH_GROUP_SLOTS,
  type SpeechMora,
  type SpeechVowel
} from "./speech-timeline-state";

/**
 * intent.set validation — the pre-gate that sits IN FRONT of the head-less
 * resolver (C4 検証層 A-3). The resolver's contract is "failure is silence +
 * clamp"; the channel must instead REFUSE with an enumerated code and never
 * clamp (C4 §3.3). So this is a thin layer that inverts "silently drop" into
 * "explicit reject", grounded on the same existing knowledge:
 *
 *  1. payload parse            → invalidPayload
 *  2. findSemanticSlotDefinition (unknown slotId) → unknownSlot
 *  3. sourceKind → normalized domain range check (NO clamp) → slotValueOutOfRange
 *  4. current auto-mapping slot enabled + target present → slotNotWritable
 *
 * The `channelClosed` and `unknownKind` codes are decided one level up (at the
 * envelope/dispatch layer), not here — this function only sees a well-formed
 * `intent.set` request whose payload still needs validating.
 */

export type ControlChannelIntentSetValidation =
  | {
      readonly ok: true;
      readonly slotId: RuntimePlayerMappingSlotId;
      readonly value: number;
      readonly ttlMs: number | undefined;
    }
  | {
      readonly ok: false;
      readonly code: RuntimePlayerControlChannelRejectionCode;
      readonly message: string;
    };

export type ValidateControlChannelIntentSetInput = {
  readonly payload: unknown;
  /**
   * The loaded model's current auto-mapping slots (createAutoMappingSlots
   * output, already held by the autonomous composer). `null` means no model is
   * loaded → every write is `slotNotWritable`.
   */
  readonly getCurrentSlots: () => readonly RuntimePlayerMappingSlot[] | null;
};

export function validateControlChannelIntentSet(
  input: ValidateControlChannelIntentSetInput
): ControlChannelIntentSetValidation {
  const parsed = parseIntentSetPayload(input.payload);
  if (parsed === null) {
    return {
      ok: false,
      code: "invalidPayload",
      message: "intent.set payload is malformed."
    };
  }

  if (!isMappingSlotId(parsed.slotId)) {
    return {
      ok: false,
      code: "unknownSlot",
      message: `Unknown semantic slot: ${parsed.slotId}.`
    };
  }

  const definition = findSemanticSlotDefinition(parsed.slotId);
  const range = semanticSlotNormalizedRange(definition.sourceKind);
  if (parsed.value < range.min || parsed.value > range.max) {
    return {
      ok: false,
      code: "slotValueOutOfRange",
      message: `value ${parsed.value} is outside the ${range.min}..${
        range.max
      } range for slot ${parsed.slotId}.`
    };
  }

  if (!isSlotWritable(parsed.slotId, input.getCurrentSlots())) {
    return {
      ok: false,
      code: "slotNotWritable",
      message: `Slot ${parsed.slotId} is not writable on the loaded model.`
    };
  }

  return {
    ok: true,
    slotId: parsed.slotId,
    value: parsed.value,
    ttlMs: parsed.ttlMs
  };
}

type ParsedIntentSetPayload = {
  readonly slotId: string;
  readonly value: number;
  readonly ttlMs: number | undefined;
};

function parseIntentSetPayload(value: unknown): ParsedIntentSetPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.slotId !== "string" || value.slotId.length === 0) {
    return null;
  }

  if (typeof value.value !== "number" || !Number.isFinite(value.value)) {
    return null;
  }

  const ttlMs = parseTtlMs(value.ttlMs);
  if (ttlMs === "invalid") {
    return null;
  }

  return {
    slotId: value.slotId,
    value: value.value,
    ttlMs
  };
}

function parseTtlMs(value: unknown): number | undefined | "invalid" {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "invalid";
  }

  return value;
}

function isMappingSlotId(value: string): value is RuntimePlayerMappingSlotId {
  return (runtimePlayerMappingSlotIds as readonly string[]).includes(value);
}

function isSlotWritable(
  slotId: RuntimePlayerMappingSlotId,
  slots: readonly RuntimePlayerMappingSlot[] | null
): boolean {
  if (slots === null) {
    return false;
  }

  const slot = slots.find((candidate) => candidate.slotId === slotId);
  return slot !== undefined && slot.enabled && slot.target !== null;
}

/**
 * intent.envelope validation (C5 §2/§7-4). The SAME pre-gate discipline as
 * validateControlChannelIntentSet, adapted to the envelope payload
 * ({slotId, peak, attackMs, sustainMs, decayMs}). Rejection reuses the EXISTING
 * enumeration only — NO new code is added (裁定4):
 *
 *  1. payload parse            → invalidPayload
 *       - non-record, slotId missing/non-string
 *       - peak non-number / non-finite
 *       - any duration non-number / non-finite / NEGATIVE (parseTtlMs's value<=0
 *         precedent generalized to attack/sustain/decay)
 *       - zero-life (attackMs + sustainMs + decayMs === 0) — an envelope with no
 *         drive time is malformed; folded into invalidPayload (裁定4), no new code.
 *  2. findSemanticSlotDefinition (unknown slotId) → unknownSlot
 *  3. peak vs the slot's normalized domain (NO clamp) → slotValueOutOfRange
 *       - peak SIGN is a DOMAIN concern, not a parse failure: a centered slot's
 *         domain is -1..1, so a negative peak is in range and accepted; only an
 *         out-of-domain peak (either side) is refused. This keeps envelope drive
 *         as expressive as set (bidirectional centered slots), matching the §2
 *         connectivity intent. (See report §裁量: reconciling the「負値」wording.)
 *  4. current auto-mapping slot enabled + target present → slotNotWritable
 */
export type ControlChannelIntentEnvelopeValidation =
  | {
      readonly ok: true;
      readonly slotId: RuntimePlayerMappingSlotId;
      readonly peak: number;
      readonly attackMs: number;
      readonly sustainMs: number;
      readonly decayMs: number;
    }
  | {
      readonly ok: false;
      readonly code: RuntimePlayerControlChannelRejectionCode;
      readonly message: string;
    };

export type ValidateControlChannelIntentEnvelopeInput = {
  readonly payload: unknown;
  readonly getCurrentSlots: () => readonly RuntimePlayerMappingSlot[] | null;
};

export function validateControlChannelIntentEnvelope(
  input: ValidateControlChannelIntentEnvelopeInput
): ControlChannelIntentEnvelopeValidation {
  const parsed = parseIntentEnvelopePayload(input.payload);
  if (parsed === null) {
    return {
      ok: false,
      code: "invalidPayload",
      message: "intent.envelope payload is malformed."
    };
  }

  if (!isMappingSlotId(parsed.slotId)) {
    return {
      ok: false,
      code: "unknownSlot",
      message: `Unknown semantic slot: ${parsed.slotId}.`
    };
  }

  const definition = findSemanticSlotDefinition(parsed.slotId);
  const range = semanticSlotNormalizedRange(definition.sourceKind);
  if (parsed.peak < range.min || parsed.peak > range.max) {
    return {
      ok: false,
      code: "slotValueOutOfRange",
      message: `peak ${parsed.peak} is outside the ${range.min}..${
        range.max
      } range for slot ${parsed.slotId}.`
    };
  }

  if (!isSlotWritable(parsed.slotId, input.getCurrentSlots())) {
    return {
      ok: false,
      code: "slotNotWritable",
      message: `Slot ${parsed.slotId} is not writable on the loaded model.`
    };
  }

  return {
    ok: true,
    slotId: parsed.slotId,
    peak: parsed.peak,
    attackMs: parsed.attackMs,
    sustainMs: parsed.sustainMs,
    decayMs: parsed.decayMs
  };
}

type ParsedIntentEnvelopePayload = {
  readonly slotId: string;
  readonly peak: number;
  readonly attackMs: number;
  readonly sustainMs: number;
  readonly decayMs: number;
};

function parseIntentEnvelopePayload(
  value: unknown
): ParsedIntentEnvelopePayload | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.slotId !== "string" || value.slotId.length === 0) {
    return null;
  }

  // peak's SIGN is a domain concern (handled by slotValueOutOfRange); parse only
  // rejects a non-finite peak — the same shape check applied to intent.set's value.
  if (typeof value.peak !== "number" || !Number.isFinite(value.peak)) {
    return null;
  }

  const attackMs = parseDurationMs(value.attackMs);
  const sustainMs = parseDurationMs(value.sustainMs);
  const decayMs = parseDurationMs(value.decayMs);
  if (attackMs === null || sustainMs === null || decayMs === null) {
    return null;
  }

  // Zero-life envelope (no drive time at all) is malformed → invalidPayload (裁定4).
  if (attackMs + sustainMs + decayMs <= 0) {
    return null;
  }

  return {
    slotId: value.slotId,
    peak: value.peak,
    attackMs,
    sustainMs,
    decayMs
  };
}

/** A curve duration: finite and NON-NEGATIVE. Anything else → null (invalidPayload). */
function parseDurationMs(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

/**
 * intent.speech validation (C6 §2/§7 裁定4). The SAME pre-gate discipline as the
 * set/envelope validators, adapted to the FIRST variable-length payload — a mora列
 * `{ timeMs, vowel, s }[]`. Rejection reuses the EXISTING enumeration only — NO new
 * code (拒否語彙の不増殖, 裁定4):
 *
 *  1. payload/shape parse → invalidPayload
 *       - non-record, `timeline` non-array, EMPTY timeline
 *       - timeline length > 512 (裁定4 上限。超過は畳む、クランプ禁止)
 *       - a mora non-record; timeMs non-finite / negative / NOT strictly increasing
 *         (前要素以下は拒否 — the mora列 must be a monotone schedule); vowel not a/i/u/e/o;
 *         s non-finite
 *  2. s domain (mouth-vowel 0..1, NO clamp) → slotValueOutOfRange
 *       (the same domain概念 as intent.set's value / intent.envelope's peak; a value
 *        outside 0..1 is a range refusal, distinct from a non-finite parse failure)
 *  3. the fixed 6 mouth-group slots (mouth-open + 5 vowel slots) ALL writable →
 *     slotNotWritable (§2.1 gate依存). There is NO slotId in the payload, so this is
 *     the group form: any of the 6 not writable ⇒ refuse. There is likewise NO
 *     unknownSlot path — the slots are fixed, not carried on the wire.
 *
 * On ok it returns the validated `SpeechMora[]` (Domain A's store-facing shape); the
 * server hands it to `store.setSpeech(moras, nowMs)`.
 */
export type ControlChannelIntentSpeechValidation =
  | {
      readonly ok: true;
      readonly moras: readonly SpeechMora[];
    }
  | {
      readonly ok: false;
      readonly code: RuntimePlayerControlChannelRejectionCode;
      readonly message: string;
    };

export type ValidateControlChannelIntentSpeechInput = {
  readonly payload: unknown;
  readonly getCurrentSlots: () => readonly RuntimePlayerMappingSlot[] | null;
};

export function validateControlChannelIntentSpeech(
  input: ValidateControlChannelIntentSpeechInput
): ControlChannelIntentSpeechValidation {
  const parsed = parseIntentSpeechTimeline(input.payload);
  if (parsed === null) {
    return {
      ok: false,
      code: "invalidPayload",
      message: "intent.speech payload is malformed."
    };
  }

  // s domain (mouth-vowel 0..1) — a range refusal, never clamped (same rule as
  // intent.set's value / intent.envelope's peak). Non-finite s was already a parse
  // failure above; here we only reject out-of-DOMAIN finite values.
  const range = semanticSlotNormalizedRange("mouth-vowel");
  for (const mora of parsed) {
    if (mora.s < range.min || mora.s > range.max) {
      return {
        ok: false,
        code: "slotValueOutOfRange",
        message: `mora s ${mora.s} is outside the ${range.min}..${range.max} mouth-vowel range.`
      };
    }
  }

  // The 6 mouth-group slots are driven as a UNIT — all must be writable.
  if (!speechMouthGroupWritable(input.getCurrentSlots())) {
    return {
      ok: false,
      code: "slotNotWritable",
      message: "The mouth group (mouth-open + mouth-vowel-*) is not writable on the loaded model."
    };
  }

  return { ok: true, moras: parsed };
}

/**
 * Parse + shape-validate the mora列. Returns the validated `SpeechMora[]` or null
 * (⇒ invalidPayload). Shape-only: the s DOMAIN (0..1) and slot writability are checked
 * by the caller with their own codes. Non-finite s IS a shape failure here (null);
 * an out-of-range but finite s is left for the caller's slotValueOutOfRange.
 */
function parseIntentSpeechTimeline(
  value: unknown
): readonly SpeechMora[] | null {
  if (!isRecord(value)) {
    return null;
  }

  const { timeline } = value;
  if (!Array.isArray(timeline)) {
    return null;
  }
  // Empty timeline (no drive) and over-cap timeline (裁定4 DoS bound) are both
  // malformed → invalidPayload (no new code, never clamped/truncated).
  if (
    timeline.length === 0 ||
    timeline.length > runtimePlayerControlChannelSpeechMaxTimelineLength
  ) {
    return null;
  }

  const moras: SpeechMora[] = [];
  let previousTimeMs = Number.NEGATIVE_INFINITY;
  for (const entry of timeline) {
    if (!isRecord(entry)) {
      return null;
    }
    const { timeMs, vowel, s } = entry;
    if (
      typeof timeMs !== "number" ||
      !Number.isFinite(timeMs) ||
      timeMs < 0 ||
      timeMs <= previousTimeMs
    ) {
      // Non-finite / negative / non-monotonic (≤ previous) time → malformed schedule.
      return null;
    }
    if (!isSpeechVowel(vowel)) {
      return null;
    }
    if (typeof s !== "number" || !Number.isFinite(s)) {
      return null;
    }
    previousTimeMs = timeMs;
    moras.push({ timeMs, vowel, s });
  }
  return moras;
}

function isSpeechVowel(value: unknown): value is SpeechVowel {
  return (
    typeof value === "string" &&
    (runtimePlayerControlChannelSpeechVowels as readonly string[]).includes(value)
  );
}

/** True iff every one of the 6 mouth-group slots is writable on the loaded model. */
function speechMouthGroupWritable(
  slots: readonly RuntimePlayerMappingSlot[] | null
): boolean {
  for (const slotId of RUNTIME_PLAYER_SPEECH_MOUTH_GROUP_SLOTS) {
    if (!isMappingSlotId(slotId) || !isSlotWritable(slotId, slots)) {
      return false;
    }
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
