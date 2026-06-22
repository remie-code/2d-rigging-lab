import type { TrackingVector3 } from "../../preload/input-tracking-frame-contract";
import {
  createEmptyInputProfileDocument,
  inputProfileDocumentSchemaVersion,
  type InputProfile,
  type InputProfileAxis,
  type InputProfileCalibration,
  type InputProfileDirection,
  type InputProfileDocument,
  type InputProfileLearnedSign
} from "./input-profile-document";
import { isInputProfileHeadPositionCalibrationReady } from "./input-profile-calibration-sections";

export type InputProfileDocumentParseResult =
  | {
      readonly ok: true;
      readonly document: InputProfileDocument;
      readonly warningMessages: readonly string[];
    }
  | {
      readonly ok: false;
      readonly warningMessages: readonly string[];
    };

export function parseInputProfileDocument(
  value: unknown
): InputProfileDocumentParseResult {
  const warningMessages: string[] = [];

  if (!isRecord(value)) {
    return {
      ok: false,
      warningMessages: ["Input profile document must be an object."]
    };
  }

  if (value.schemaVersion !== inputProfileDocumentSchemaVersion) {
    return {
      ok: false,
      warningMessages: ["Input profile document schema version is unsupported."]
    };
  }

  if (!Array.isArray(value.profiles)) {
    return {
      ok: false,
      warningMessages: ["Input profile document profiles must be an array."]
    };
  }

  const profiles: InputProfile[] = [];

  value.profiles.forEach((profileValue, index) => {
    const profile = parseInputProfile(profileValue, warningMessages, index);

    if (profile !== null) {
      profiles.push(profile);
    }
  });

  const activeProfileId =
    typeof value.activeProfileId === "string" &&
    value.activeProfileId.trim().length > 0
      ? value.activeProfileId.trim()
      : undefined;
  const activeProfileExists =
    activeProfileId === undefined ||
    profiles.some((profile) => profile.profileId === activeProfileId);
  const document =
    activeProfileId === undefined || !activeProfileExists
      ? createDocumentWithoutActiveProfile(profiles)
      : createDocumentWithActiveProfile(profiles, activeProfileId);

  if (activeProfileId !== undefined && !activeProfileExists) {
    warningMessages.push(
      `Active input profile ${activeProfileId} was not found and was ignored.`
    );
  }

  return {
    ok: true,
    document,
    warningMessages
  };
}

function parseInputProfile(
  value: unknown,
  warningMessages: string[],
  index: number
): InputProfile | null {
  if (!isRecord(value)) {
    warningMessages.push(`Input profile at index ${index} must be an object.`);
    return null;
  }

  const profileId = readRequiredString(value.profileId);
  const displayName = readRequiredString(value.displayName);
  const createdAtIso = readRequiredString(value.createdAtIso);
  const updatedAtIso = readRequiredString(value.updatedAtIso);

  if (
    profileId === null ||
    displayName === null ||
    createdAtIso === null ||
    updatedAtIso === null ||
    value.source !== "ifacialmocap" ||
    value.transport !== "udp"
  ) {
    warningMessages.push(
      `Input profile at index ${index} is missing required metadata.`
    );
    return null;
  }

  const calibration = parseInputProfileCalibration(value.calibration);

  if (calibration === null) {
    warningMessages.push(
      `Input profile ${profileId} has invalid calibration data and was skipped.`
    );
    return null;
  }

  return {
    profileId,
    displayName,
    source: "ifacialmocap",
    transport: "udp",
    createdAtIso,
    updatedAtIso,
    calibration
  };
}

function parseInputProfileCalibration(
  value: unknown
): InputProfileCalibration | null {
  if (!isRecord(value)) {
    return null;
  }

  const headRotationEulerDeg = parseHeadCalibration(
    value.headRotationEulerDeg
  );
  const headPositionRaw =
    value.headPositionRaw === undefined
      ? undefined
      : parseHeadPositionCalibration(value.headPositionRaw);
  const eyes = parseEyeCalibration(value.eyes);
  const mouth = parseMouthCalibration(value.mouth);

  if (
    headRotationEulerDeg === null ||
    headPositionRaw === null ||
    eyes === null ||
    mouth === null
  ) {
    return null;
  }

  return {
    headRotationEulerDeg,
    ...(headPositionRaw === undefined ? {} : { headPositionRaw }),
    eyes,
    mouth
  };
}

function parseHeadCalibration(
  value: unknown
): InputProfileCalibration["headRotationEulerDeg"] | null {
  if (!isRecord(value)) {
    return null;
  }

  const neutral = parseVector3(value.neutral);
  const min = parseVector3(value.min);
  const max = parseVector3(value.max);

  if (neutral === null || min === null || max === null) {
    return null;
  }

  return {
    neutral,
    min,
    max,
    learnedSigns: parseHeadLearnedSigns(value.learnedSigns)
  };
}

function parseEyeCalibration(
  value: unknown
): InputProfileCalibration["eyes"] | null {
  if (!isRecord(value)) {
    return null;
  }

  const neutral = parseVector3(value.neutral);
  const min = parseVector3(value.min);
  const max = parseVector3(value.max);
  const blinkLeftMin = readFiniteNumber(value.blinkLeftMin);
  const blinkLeftMax = readFiniteNumber(value.blinkLeftMax);
  const blinkRightMin = readFiniteNumber(value.blinkRightMin);
  const blinkRightMax = readFiniteNumber(value.blinkRightMax);

  if (
    neutral === null ||
    min === null ||
    max === null ||
    blinkLeftMin === null ||
    blinkLeftMax === null ||
    blinkRightMin === null ||
    blinkRightMax === null
  ) {
    return null;
  }

  return {
    neutral,
    min,
    max,
    blinkLeftMin,
    blinkLeftMax,
    blinkRightMin,
    blinkRightMax,
    learnedSigns: parseEyeLearnedSigns(value.learnedSigns)
  };
}

function parseHeadPositionCalibration(
  value: unknown
): NonNullable<InputProfileCalibration["headPositionRaw"]> | null {
  if (!isRecord(value)) {
    return null;
  }

  const neutral = parseVector3(value.neutral);
  const min = parseVector3(value.min);
  const max = parseVector3(value.max);
  const learnedSigns = parseHeadPositionLearnedSigns(value.learnedSigns);

  if (neutral === null || min === null || max === null) {
    return null;
  }

  const headPositionRaw = {
    neutral,
    min,
    max,
    learnedSigns
  };

  return isInputProfileHeadPositionCalibrationReady(headPositionRaw)
    ? headPositionRaw
    : null;
}

function parseMouthCalibration(
  value: unknown
): InputProfileCalibration["mouth"] | null {
  if (!isRecord(value)) {
    return null;
  }

  const jawOpenMin = readFiniteNumber(value.jawOpenMin);
  const jawOpenMax = readFiniteNumber(value.jawOpenMax);
  const smileMin = readFiniteNumber(value.smileMin);
  const smileMax = readFiniteNumber(value.smileMax);

  if (
    jawOpenMin === null ||
    jawOpenMax === null ||
    smileMin === null ||
    smileMax === null
  ) {
    return null;
  }

  return {
    jawOpenMin,
    jawOpenMax,
    smileMin,
    smileMax
  };
}

function parseHeadLearnedSigns(
  value: unknown
): InputProfileCalibration["headRotationEulerDeg"]["learnedSigns"] {
  if (!isRecord(value)) {
    return {};
  }

  return {
    ...readLearnedSignField(value, "faceLeft"),
    ...readLearnedSignField(value, "faceRight"),
    ...readLearnedSignField(value, "lookUp"),
    ...readLearnedSignField(value, "lookDown"),
    ...readLearnedSignField(value, "tiltLeft"),
    ...readLearnedSignField(value, "tiltRight")
  };
}

function parseEyeLearnedSigns(
  value: unknown
): InputProfileCalibration["eyes"]["learnedSigns"] {
  if (!isRecord(value)) {
    return {};
  }

  return {
    ...readLearnedSignField(value, "eyesLeft"),
    ...readLearnedSignField(value, "eyesRight"),
    ...readLearnedSignField(value, "eyesUp"),
    ...readLearnedSignField(value, "eyesDown")
  };
}

function parseHeadPositionLearnedSigns(
  value: unknown
): NonNullable<InputProfileCalibration["headPositionRaw"]>["learnedSigns"] {
  if (!isRecord(value)) {
    return {};
  }

  return {
    ...readLearnedSignField(value, "bodyLeft"),
    ...readLearnedSignField(value, "bodyRight")
  };
}

function readLearnedSignField<TKey extends string>(
  value: Record<string, unknown>,
  key: TKey
): Partial<Record<TKey, InputProfileLearnedSign>> {
  const learnedSign = parseLearnedSign(value[key]);

  return learnedSign === null ? {} : { [key]: learnedSign } as Record<
    TKey,
    InputProfileLearnedSign
  >;
}

function parseLearnedSign(value: unknown): InputProfileLearnedSign | null {
  if (!isRecord(value) || !isAxis(value.axis) || !isDirection(value.direction)) {
    return null;
  }

  return {
    axis: value.axis,
    direction: value.direction
  };
}

function parseVector3(value: unknown): TrackingVector3 | null {
  if (!isRecord(value)) {
    return null;
  }

  const x = readFiniteNumber(value.x);
  const y = readFiniteNumber(value.y);
  const z = readFiniteNumber(value.z);

  if (x === null || y === null || z === null) {
    return null;
  }

  return { x, y, z };
}

function createDocumentWithoutActiveProfile(
  profiles: readonly InputProfile[]
): InputProfileDocument {
  return {
    ...createEmptyInputProfileDocument(),
    profiles
  };
}

function createDocumentWithActiveProfile(
  profiles: readonly InputProfile[],
  activeProfileId: string
): InputProfileDocument {
  return {
    ...createEmptyInputProfileDocument(),
    activeProfileId,
    profiles
  };
}

function readRequiredString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isAxis(value: unknown): value is InputProfileAxis {
  return value === "x" || value === "y" || value === "z";
}

function isDirection(value: unknown): value is InputProfileDirection {
  return value === -1 || value === 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
