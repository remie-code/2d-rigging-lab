import {
  runtimePlayerMappingSlotIds,
  type RuntimePlayerMappingSlotId,
  type RuntimePlayerMappingSlotUpdateRequest,
  type RuntimePlayerMappingVowelLipsyncUpdateRequest
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
  const smoothing = readOptionalSmoothing(record.smoothing);
  const bodyRotationStrength = readOptionalStrength(
    record.bodyRotationStrength,
    "body rotation strength"
  );
  const bodyPositionStrength = readOptionalStrength(
    record.bodyPositionStrength,
    "body position strength"
  );
  const bodyRotationInvert = readOptionalBoolean(
    record.bodyRotationInvert,
    "bodyRotationInvert"
  );
  const bodyPositionInvert = readOptionalBoolean(
    record.bodyPositionInvert,
    "bodyPositionInvert"
  );

  return {
    slotId,
    ...(enabled === undefined ? {} : { enabled }),
    ...(invert === undefined ? {} : { invert }),
    ...(strength === undefined ? {} : { strength }),
    ...(smoothing === undefined ? {} : { smoothing }),
    ...(bodyRotationStrength === undefined
      ? {}
      : { bodyRotationStrength }),
    ...(bodyPositionStrength === undefined
      ? {}
      : { bodyPositionStrength }),
    ...(bodyRotationInvert === undefined ? {} : { bodyRotationInvert }),
    ...(bodyPositionInvert === undefined ? {} : { bodyPositionInvert })
  };
}

export function readMappingVowelLipsyncUpdateRequest(
  value: unknown
): RuntimePlayerMappingVowelLipsyncUpdateRequest {
  if (typeof value !== "object" || value === null) {
    throw new Error("Vowel lipsync update request must be an object.");
  }

  const record = value as Record<string, unknown>;
  if (typeof record.enabled !== "boolean") {
    throw new Error("Vowel lipsync update field enabled must be boolean.");
  }

  return { enabled: record.enabled };
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

function readOptionalStrength(
  value: unknown,
  label = "strength"
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Mapping slot ${label} must be a finite number.`);
  }

  if (value < 0 || value > 2) {
    throw new Error(`Mapping slot ${label} must be from 0 to 2.`);
  }

  return Math.round(value * 100) / 100;
}

function readOptionalSmoothing(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Mapping slot smoothing must be a finite number.");
  }

  if (value < 0 || value > 0.95) {
    throw new Error("Mapping slot smoothing must be from 0 to 0.95.");
  }

  return Math.round(value * 100) / 100;
}
