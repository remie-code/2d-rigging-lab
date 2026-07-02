import type {
  RuntimePlayerDynamicsTuningExportIdentity,
  RuntimePlayerDynamicsTuningGroupOverride
} from "../../preload/dynamics-tuning-bridge-contract";
import {
  dynamicsTuningProfileSchemaVersion,
  type DynamicsTuningProfileDocument
} from "./dynamics-tuning-profile-document";

export type DynamicsTuningProfileParseResult =
  | {
      readonly ok: true;
      readonly profile: DynamicsTuningProfileDocument;
      readonly warningMessages: readonly string[];
    }
  | {
      readonly ok: false;
      readonly warningMessages: readonly string[];
    };

export function parseDynamicsTuningProfileDocument(
  value: unknown
): DynamicsTuningProfileParseResult {
  const warningMessages: string[] = [];

  if (!isRecord(value)) {
    return {
      ok: false,
      warningMessages: ["Dynamics tuning profile document must be an object."]
    };
  }

  if (value.schemaVersion !== dynamicsTuningProfileSchemaVersion) {
    return {
      ok: false,
      warningMessages: ["Dynamics tuning profile schema version is unsupported."]
    };
  }

  const createdAtIso = readRequiredString(value.createdAtIso);
  const updatedAtIso = readRequiredString(value.updatedAtIso);
  const exportIdentity = parseExportIdentity(value.exportIdentity);
  const dynamicsSignatureHash = readRequiredString(value.dynamicsSignatureHash);

  if (
    createdAtIso === null ||
    updatedAtIso === null ||
    exportIdentity === null ||
    dynamicsSignatureHash === null
  ) {
    return {
      ok: false,
      warningMessages: ["Dynamics tuning profile is missing required metadata."]
    };
  }

  if (!isRecord(value.groups)) {
    return {
      ok: false,
      warningMessages: ["Dynamics tuning profile groups must be an object."]
    };
  }

  const groups: Record<string, RuntimePlayerDynamicsTuningGroupOverride> = {};
  for (const [groupId, groupValue] of Object.entries(value.groups)) {
    const trimmedGroupId = groupId.trim();
    if (trimmedGroupId.length === 0) {
      warningMessages.push(
        "Dynamics tuning profile group id must be a non-empty string."
      );
      continue;
    }

    const override = parseGroupOverride(
      groupValue,
      warningMessages,
      trimmedGroupId
    );
    if (override !== null && Object.keys(override).length > 0) {
      groups[trimmedGroupId] = override;
    }
  }

  return {
    ok: true,
    profile: {
      schemaVersion: dynamicsTuningProfileSchemaVersion,
      createdAtIso,
      updatedAtIso,
      exportIdentity,
      dynamicsSignatureHash,
      groups
    },
    warningMessages
  };
}

function parseExportIdentity(
  value: unknown
): RuntimePlayerDynamicsTuningExportIdentity | null {
  if (!isRecord(value)) {
    return null;
  }

  const packageId = readRequiredString(value.packageId);
  const packageRevision = readInteger(value.packageRevision);
  const packageHash = readOptionalString(value.packageHash);
  const parameterSignatureHash = readRequiredString(
    value.parameterSignatureHash
  );

  if (
    packageId === null ||
    packageRevision === null ||
    parameterSignatureHash === null
  ) {
    return null;
  }

  return {
    packageId,
    packageRevision,
    ...(packageHash === undefined ? {} : { packageHash }),
    parameterSignatureHash
  };
}

function parseGroupOverride(
  value: unknown,
  warningMessages: string[],
  groupId: string
): RuntimePlayerDynamicsTuningGroupOverride | null {
  if (!isRecord(value)) {
    warningMessages.push(
      `Dynamics tuning profile group ${groupId} must be an object.`
    );
    return null;
  }

  const enabled = readOptionalBoolean(value.enabled);
  const strength = readOptionalFiniteNumber(value.strength);
  const limit = readOptionalNonNegativeNumber(value.limit);
  const length = readOptionalPositiveNumber(value.length);
  const sway = readOptionalNonNegativeNumber(value.sway);
  const reactionSpeed = readOptionalNonNegativeNumber(value.reactionSpeed);
  const convergenceSpeed = readOptionalNonNegativeNumber(
    value.convergenceSpeed
  );

  if (
    enabled === null ||
    strength === null ||
    limit === null ||
    length === null ||
    sway === null ||
    reactionSpeed === null ||
    convergenceSpeed === null
  ) {
    warningMessages.push(
      `Dynamics tuning profile group ${groupId} contains invalid fields; invalid fields were ignored.`
    );
  }

  return {
    ...(enabled === undefined || enabled === null ? {} : { enabled }),
    ...(strength === undefined || strength === null ? {} : { strength }),
    ...(limit === undefined || limit === null ? {} : { limit }),
    ...(length === undefined || length === null ? {} : { length }),
    ...(sway === undefined || sway === null ? {} : { sway }),
    ...(reactionSpeed === undefined || reactionSpeed === null
      ? {}
      : { reactionSpeed }),
    ...(convergenceSpeed === undefined || convergenceSpeed === null
      ? {}
      : { convergenceSpeed })
  };
}

function readRequiredString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function readOptionalBoolean(value: unknown): boolean | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === "boolean" ? value : null;
}

function readInteger(value: unknown): number | null {
  return Number.isInteger(value) ? value as number : null;
}

function readOptionalFiniteNumber(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readOptionalNonNegativeNumber(
  value: unknown
): number | null | undefined {
  const numberValue = readOptionalFiniteNumber(value);
  if (numberValue === null || numberValue === undefined) {
    return numberValue;
  }

  return numberValue >= 0 ? numberValue : null;
}

function readOptionalPositiveNumber(
  value: unknown
): number | null | undefined {
  const numberValue = readOptionalFiniteNumber(value);
  if (numberValue === null || numberValue === undefined) {
    return numberValue;
  }

  return numberValue > 0 ? numberValue : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
