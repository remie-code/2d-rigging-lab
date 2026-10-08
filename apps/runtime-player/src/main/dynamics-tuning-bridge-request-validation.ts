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
  const outputScale = readOptionalPositiveNumber(
    value.outputScale,
    "outputScale"
  );
  const limit = readOptionalNonNegativeNumber(value.limit, "limit");
  const damping = readOptionalNonNegativeNumber(value.damping, "damping");
  const gravityScale = readOptionalNonNegativeNumber(
    value.gravityScale,
    "gravityScale"
  );
  const lengthScale = readOptionalPositiveNumber(
    value.lengthScale,
    "lengthScale"
  );

  return {
    groupId,
    ...(enabled === undefined ? {} : { enabled }),
    ...(outputScale === undefined ? {} : { outputScale }),
    ...(limit === undefined ? {} : { limit }),
    ...(damping === undefined ? {} : { damping }),
    ...(gravityScale === undefined ? {} : { gravityScale }),
    ...(lengthScale === undefined ? {} : { lengthScale })
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
