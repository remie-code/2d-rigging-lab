import type {
  PhysiologyToneOverrides
} from "../../preload/physiology-bridge-contract";
import type {
  PhysiologyProfileExportIdentity
} from "./physiology-profile-document";
import {
  physiologyProfileSchemaVersion,
  type PhysiologyProfileDocument
} from "./physiology-profile-document";
import {
  PHYSIOLOGY_BLINK_TONE_FIELDS,
  PHYSIOLOGY_GAZE_TONE_FIELDS,
  PHYSIOLOGY_HEAD_TONE_FIELDS,
  PHYSIOLOGY_POSTURE_TONE_FIELDS
} from "./physiology-tone-config";

export type PhysiologyProfileParseResult =
  | {
      readonly ok: true;
      readonly profile: PhysiologyProfileDocument;
      readonly warningMessages: readonly string[];
    }
  | {
      readonly ok: false;
      readonly warningMessages: readonly string[];
    };

export function parsePhysiologyProfileDocument(
  value: unknown
): PhysiologyProfileParseResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      warningMessages: ["Physiology profile document must be an object."]
    };
  }

  if (value.schemaVersion !== physiologyProfileSchemaVersion) {
    return {
      ok: false,
      warningMessages: ["Physiology profile schema version is unsupported."]
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
      warningMessages: ["Physiology profile is missing required metadata."]
    };
  }

  const warningMessages: string[] = [];
  const overrides = parseToneOverrides(value.overrides, warningMessages);

  return {
    ok: true,
    profile: {
      schemaVersion: physiologyProfileSchemaVersion,
      createdAtIso,
      updatedAtIso,
      exportIdentity,
      overrides
    },
    warningMessages
  };
}

function parseExportIdentity(
  value: unknown
): PhysiologyProfileExportIdentity | null {
  if (!isRecord(value)) {
    return null;
  }

  const packageId = readRequiredString(value.packageId);
  const packageRevision = readInteger(value.packageRevision);
  const packageHash = readOptionalString(value.packageHash);
  const fingerprint = readRequiredString(value.fingerprint);

  if (packageId === null || packageRevision === null || fingerprint === null) {
    return null;
  }

  return {
    packageId,
    packageRevision,
    ...(packageHash === undefined ? {} : { packageHash }),
    fingerprint
  };
}

function parseToneOverrides(
  value: unknown,
  warningMessages: string[]
): PhysiologyToneOverrides {
  if (!isRecord(value)) {
    return {};
  }

  const blink = parseNumericFamily(
    value.blink,
    PHYSIOLOGY_BLINK_TONE_FIELDS,
    "blink",
    warningMessages
  );
  const gaze = parseNumericFamily(
    value.gaze,
    PHYSIOLOGY_GAZE_TONE_FIELDS,
    "gaze",
    warningMessages
  );
  const head = parseNumericFamily(
    value.head,
    PHYSIOLOGY_HEAD_TONE_FIELDS,
    "head",
    warningMessages
  );
  const posture = parseNumericFamily(
    value.posture,
    PHYSIOLOGY_POSTURE_TONE_FIELDS,
    "posture",
    warningMessages
  );
  const stagePresence = parseStagePresence(
    value.stagePresence,
    warningMessages
  );

  return {
    ...(blink === undefined ? {} : { blink }),
    ...(gaze === undefined ? {} : { gaze }),
    ...(head === undefined ? {} : { head }),
    ...(posture === undefined ? {} : { posture }),
    ...(stagePresence === undefined ? {} : { stagePresence })
  };
}

function parseNumericFamily(
  value: unknown,
  fields: readonly string[],
  familyName: string,
  warningMessages: string[]
): Readonly<Record<string, number>> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    warningMessages.push(
      `Physiology profile ${familyName} must be an object; it was ignored.`
    );
    return undefined;
  }

  const result: Record<string, number> = {};
  for (const field of fields) {
    const tone = readOptionalUnitNumber(value[field]);
    if (tone === null) {
      warningMessages.push(
        `Physiology profile ${familyName}.${field} was invalid and ignored.`
      );
      continue;
    }
    if (tone !== undefined) {
      result[field] = tone;
    }
  }

  return Object.keys(result).length === 0 ? undefined : result;
}

function parseStagePresence(
  value: unknown,
  warningMessages: string[]
): PhysiologyToneOverrides["stagePresence"] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    warningMessages.push(
      "Physiology profile stagePresence must be an object; it was ignored."
    );
    return undefined;
  }

  const enabled = readOptionalBoolean(value.enabled);
  const strength = readOptionalUnitNumber(value.strength);

  if (enabled === null || strength === null) {
    warningMessages.push(
      "Physiology profile stagePresence contained invalid fields; invalid fields were ignored."
    );
  }

  const result: { enabled?: boolean; strength?: number } = {
    ...(enabled === undefined || enabled === null ? {} : { enabled }),
    ...(strength === undefined || strength === null ? {} : { strength })
  };

  return Object.keys(result).length === 0 ? undefined : result;
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
  return Number.isInteger(value) ? (value as number) : null;
}

/** A tone in [0, 1]; `undefined` when absent, `null` when present-but-invalid. */
function readOptionalUnitNumber(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.min(Math.max(value, 0), 1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
