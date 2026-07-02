import type {
  RuntimePlayerDynamicsTuningGroupResetRequest,
  RuntimePlayerDynamicsTuningGroupUpdateRequest
} from "../preload/dynamics-tuning-bridge-contract";

export function readDynamicsTuningGroupUpdateRequest(
  value: unknown
): RuntimePlayerDynamicsTuningGroupUpdateRequest {
  if (!isRecord(value)) {
    throw new Error("Dynamics tuning group update request must be an object.");
  }

  const groupId = readGroupId(value.groupId);
  const enabled = readOptionalBoolean(value.enabled, "enabled");
  const strength = readOptionalFiniteNumber(value.strength, "strength");
  const limit = readOptionalNonNegativeNumber(value.limit, "limit");
  const length = readOptionalPositiveNumber(value.length, "length");
  const sway = readOptionalNonNegativeNumber(value.sway, "sway");
  const reactionSpeed = readOptionalNonNegativeNumber(
    value.reactionSpeed,
    "reactionSpeed"
  );
  const convergenceSpeed = readOptionalNonNegativeNumber(
    value.convergenceSpeed,
    "convergenceSpeed"
  );

  return {
    groupId,
    ...(enabled === undefined ? {} : { enabled }),
    ...(strength === undefined ? {} : { strength }),
    ...(limit === undefined ? {} : { limit }),
    ...(length === undefined ? {} : { length }),
    ...(sway === undefined ? {} : { sway }),
    ...(reactionSpeed === undefined ? {} : { reactionSpeed }),
    ...(convergenceSpeed === undefined ? {} : { convergenceSpeed })
  };
}

export function readDynamicsTuningGroupResetRequest(
  value: unknown
): RuntimePlayerDynamicsTuningGroupResetRequest {
  if (!isRecord(value)) {
    throw new Error("Dynamics tuning group reset request must be an object.");
  }

  return {
    groupId: readGroupId(value.groupId)
  };
}

function readGroupId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Dynamics tuning group id must be a non-empty string.");
  }

  return value.trim();
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

  throw new Error(`Dynamics tuning field ${fieldName} must be boolean.`);
}

function readOptionalFiniteNumber(
  value: unknown,
  fieldName: string
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Dynamics tuning field ${fieldName} must be a finite number.`);
  }

  return roundTuningNumber(value);
}

function readOptionalNonNegativeNumber(
  value: unknown,
  fieldName: string
): number | undefined {
  const numberValue = readOptionalFiniteNumber(value, fieldName);
  if (numberValue === undefined) {
    return undefined;
  }

  if (numberValue < 0) {
    throw new Error(`Dynamics tuning field ${fieldName} must be non-negative.`);
  }

  return numberValue;
}

function readOptionalPositiveNumber(
  value: unknown,
  fieldName: string
): number | undefined {
  const numberValue = readOptionalFiniteNumber(value, fieldName);
  if (numberValue === undefined) {
    return undefined;
  }

  if (numberValue <= 0) {
    throw new Error(`Dynamics tuning field ${fieldName} must be positive.`);
  }

  return numberValue;
}

function roundTuningNumber(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
