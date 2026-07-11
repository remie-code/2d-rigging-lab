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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
