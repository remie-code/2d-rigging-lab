import {
  runtimePlayerMappingSlotIds,
  type RuntimePlayerMappingSlot,
  type RuntimePlayerMappingSlotId
} from "../../preload/model-mapping-bridge-contract";
import { findSemanticSlotDefinition } from "../live-mapping/semantic-slot-definitions";
import type { RuntimePlayerControlChannelRejectionCode } from "./contract/channel-protocol-contract";
import { semanticSlotNormalizedRange } from "./semantic-slot-normalized-range";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
