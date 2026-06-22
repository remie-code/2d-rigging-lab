import {
  runtimePlayerMappingSlotIds,
  type RuntimePlayerMappingSlotId,
  type RuntimePlayerMappingSlotUpdateRequest
} from "../preload/model-mapping-bridge-contract";

const slotIdSet = new Set<string>(runtimePlayerMappingSlotIds);

export function readMappingSlotUpdateRequest(
  value: unknown
): RuntimePlayerMappingSlotUpdateRequest {
  if (typeof value !== "object" || value === null) {
    throw new Error("Mapping slot update request must be an object.");
  }

  const record = value as Record<string, unknown>;
  const slotId = readSlotId(record.slotId);
  const enabled = readOptionalBoolean(record.enabled, "enabled");
  const invert = readOptionalBoolean(record.invert, "invert");
  const strength = readOptionalStrength(record.strength);

  return {
    slotId,
    ...(enabled === undefined ? {} : { enabled }),
    ...(invert === undefined ? {} : { invert }),
    ...(strength === undefined ? {} : { strength })
  };
}

function readSlotId(value: unknown): RuntimePlayerMappingSlotId {
  if (typeof value === "string" && slotIdSet.has(value)) {
    return value as RuntimePlayerMappingSlotId;
  }

  throw new Error("Mapping slot update request has an unsupported slotId.");
}

function readOptionalBoolean(
  value: unknown,
  fieldName: string
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  throw new Error(`Mapping slot update field ${fieldName} must be boolean.`);
}

function readOptionalStrength(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Mapping slot strength must be a finite number.");
  }

  if (value < 0 || value > 2) {
    throw new Error("Mapping slot strength must be from 0 to 2.");
  }

  return Math.round(value * 100) / 100;
}
