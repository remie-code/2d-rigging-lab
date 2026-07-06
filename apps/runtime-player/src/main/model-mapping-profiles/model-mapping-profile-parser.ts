import {
  runtimePlayerMappingSlotIds,
  type RuntimePlayerMappingSlotId
} from "../../preload/model-mapping-bridge-contract";
import {
  modelMappingProfileAutoMappingVersion,
  modelMappingProfileSchemaVersion,
  type ModelMappingProfileDocument,
  type ModelMappingProfileExportIdentity,
  type ModelMappingProfileSlot,
  type ModelMappingProfileTarget
} from "./model-mapping-profile-document";

export type ModelMappingProfileParseResult =
  | {
      readonly ok: true;
      readonly profile: ModelMappingProfileDocument;
      readonly warningMessages: readonly string[];
    }
  | {
      readonly ok: false;
      readonly warningMessages: readonly string[];
    };

const slotIdSet = new Set<string>(runtimePlayerMappingSlotIds);

export function parseModelMappingProfileDocument(
  value: unknown
): ModelMappingProfileParseResult {
  const warningMessages: string[] = [];

  if (!isRecord(value)) {
    return {
      ok: false,
      warningMessages: ["Model mapping profile document must be an object."]
    };
  }

  if (value.schemaVersion !== modelMappingProfileSchemaVersion) {
    return {
      ok: false,
      warningMessages: ["Model mapping profile schema version is unsupported."]
    };
  }

  const createdAtIso = readRequiredString(value.createdAtIso);
  const updatedAtIso = readRequiredString(value.updatedAtIso);
  const exportIdentity = parseExportIdentity(value.exportIdentity);

  if (
    createdAtIso === null ||
    updatedAtIso === null ||
    exportIdentity === null
  ) {
    return {
      ok: false,
      warningMessages: ["Model mapping profile is missing required metadata."]
    };
  }

  if (value.autoMappingVersion !== modelMappingProfileAutoMappingVersion) {
    warningMessages.push(
      "Model mapping profile auto mapping version differs from this player."
    );
  }

  if (!Array.isArray(value.slots)) {
    return {
      ok: false,
      warningMessages: ["Model mapping profile slots must be an array."]
    };
  }

  const slots: ModelMappingProfileSlot[] = [];

  value.slots.forEach((slotValue, index) => {
    const slot = parseProfileSlot(slotValue, warningMessages, index);

    if (slot !== null) {
      slots.push(slot);
    }
  });

  const vowelLipsyncEnabled = readOptionalBoolean(value.vowelLipsyncEnabled);

  return {
    ok: true,
    profile: {
      schemaVersion: modelMappingProfileSchemaVersion,
      createdAtIso,
      updatedAtIso,
      exportIdentity,
      autoMappingVersion: modelMappingProfileAutoMappingVersion,
      slots,
      ...(vowelLipsyncEnabled === undefined || vowelLipsyncEnabled === null
        ? {}
        : { vowelLipsyncEnabled })
    },
    warningMessages
  };
}

function parseExportIdentity(
  value: unknown
): ModelMappingProfileExportIdentity | null {
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

function parseProfileSlot(
  value: unknown,
  warningMessages: string[],
  index: number
): ModelMappingProfileSlot | null {
  if (!isRecord(value)) {
    warningMessages.push(
      `Model mapping profile slot at index ${index} must be an object.`
    );
    return null;
  }

  const slotId = parseSlotId(value.slotId);
  const enabled = readBoolean(value.enabled);
  const invert = readBoolean(value.invert);
  const strength = readRangedNumber(value.strength, 0, 2);
  const target = parseProfileTarget(value.target);
  const smoothing = readOptionalRangedNumber(value.smoothing, 0, 0.95);
  const bodyRotationStrength = readOptionalRangedNumber(
    value.bodyRotationStrength,
    0,
    2
  );
  const bodyPositionStrength = readOptionalRangedNumber(
    value.bodyPositionStrength,
    0,
    2
  );
  const bodyRotationInvert = readOptionalBoolean(value.bodyRotationInvert);
  const bodyPositionInvert = readOptionalBoolean(value.bodyPositionInvert);

  if (
    slotId === null ||
    enabled === null ||
    invert === null ||
    strength === null ||
    target === undefined ||
    smoothing === null ||
    bodyRotationStrength === null ||
    bodyPositionStrength === null ||
    bodyRotationInvert === null ||
    bodyPositionInvert === null
  ) {
    warningMessages.push(
      `Model mapping profile slot at index ${index} is invalid and was skipped.`
    );
    return null;
  }

  return {
    slotId,
    target,
    enabled,
    invert,
    strength,
    ...(smoothing === undefined ? {} : { smoothing }),
    ...(bodyRotationStrength === undefined
      ? {}
      : { bodyRotationStrength }),
    ...(bodyRotationInvert === undefined ? {} : { bodyRotationInvert }),
    ...(bodyPositionStrength === undefined
      ? {}
      : { bodyPositionStrength }),
    ...(bodyPositionInvert === undefined ? {} : { bodyPositionInvert })
  };
}

function parseProfileTarget(
  value: unknown
): ModelMappingProfileTarget | null | undefined {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const parameterId = readRequiredString(value.parameterId);
  const displayName = readRequiredString(value.displayName);
  const projectPresetAlias = readOptionalString(value.projectPresetAlias);

  if (parameterId === null || displayName === null) {
    return undefined;
  }

  return {
    parameterId,
    displayName,
    ...(projectPresetAlias === undefined ? {} : { projectPresetAlias })
  };
}

function parseSlotId(value: unknown): RuntimePlayerMappingSlotId | null {
  if (typeof value === "string" && slotIdSet.has(value)) {
    return value as RuntimePlayerMappingSlotId;
  }

  return null;
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

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
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

function readRangedNumber(
  value: unknown,
  min: number,
  max: number
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value >= min && value <= max ? value : null;
}

function readOptionalRangedNumber(
  value: unknown,
  min: number,
  max: number
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readRangedNumber(value, min, max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
