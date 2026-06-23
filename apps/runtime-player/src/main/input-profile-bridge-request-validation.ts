import type {
  RuntimePlayerInputCalibrationMode,
  RuntimePlayerInputCalibrationSectionKey,
  RuntimePlayerInputProfileFinishCalibrationRequest,
  RuntimePlayerInputProfileStartCalibrationRequest
} from "../preload/input-profile-bridge-contract";

const defaultCalibrationDisplayName = "iFacialMocap Profile";
const maxDisplayNameLength = 80;

export type InputProfileStartCalibrationCommand = {
  readonly displayName: string;
  readonly mode: RuntimePlayerInputCalibrationMode;
  readonly section?: RuntimePlayerInputCalibrationSectionKey;
};

export type InputProfileFinishCalibrationCommand = {
  readonly displayName: string;
};

export type InputProfileSetActiveCommand = {
  readonly profileId: string;
};

export function readStartCalibrationRequest(
  request: unknown
): InputProfileStartCalibrationCommand {
  const rawRequest = readOptionalRecord(request, "Start calibration request");
  const mode = readCalibrationMode(rawRequest?.mode);
  const section = readCalibrationSection(rawRequest?.section);

  if (mode === "section" && section === undefined) {
    throw new Error("Section calibration request must include a section.");
  }

  if (mode !== "section" && section !== undefined) {
    throw new Error("Calibration section can only be used with section mode.");
  }

  return {
    displayName: readOptionalDisplayName(rawRequest?.displayName),
    mode,
    ...(section === undefined ? {} : { section })
  };
}

export function readFinishCalibrationRequest(
  request: unknown
): InputProfileFinishCalibrationCommand {
  const rawRequest = readOptionalRecord(request, "Finish calibration request");

  return {
    displayName: readOptionalDisplayName(rawRequest?.displayName)
  };
}

export function readSetActiveProfileRequest(
  request: unknown
): InputProfileSetActiveCommand {
  if (!isRecord(request)) {
    throw new Error("Set active input profile request must be an object.");
  }

  if (
    typeof request.profileId !== "string" ||
    request.profileId.trim().length === 0
  ) {
    throw new Error("Input profile id must be a non-empty string.");
  }

  return {
    profileId: request.profileId.trim()
  };
}

function readOptionalRecord(
  request: unknown,
  label: string
):
  | Partial<
      RuntimePlayerInputProfileStartCalibrationRequest &
        RuntimePlayerInputProfileFinishCalibrationRequest
    >
  | undefined {
  if (request === undefined) {
    return undefined;
  }

  if (!isRecord(request)) {
    throw new Error(`${label} must be an object.`);
  }

  return request;
}

function readOptionalDisplayName(value: unknown): string {
  if (value === undefined) {
    return defaultCalibrationDisplayName;
  }

  if (typeof value !== "string") {
    throw new Error("Input profile display name must be a string.");
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return defaultCalibrationDisplayName;
  }

  if (trimmed.length > maxDisplayNameLength) {
    throw new Error("Input profile display name is too long.");
  }

  return trimmed;
}

function readCalibrationMode(value: unknown): RuntimePlayerInputCalibrationMode {
  if (value === undefined) {
    return "full";
  }

  if (value === "full" || value === "missing-only" || value === "section") {
    return value;
  }

  throw new Error("Input profile calibration mode is unsupported.");
}

function readCalibrationSection(
  value: unknown
): RuntimePlayerInputCalibrationSectionKey | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    value === "head-rotation" ||
    value === "eyes-mouth" ||
    value === "head-position-left-right" ||
    value === "head-position-near-far"
  ) {
    return value;
  }

  throw new Error("Input profile calibration section is unsupported.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
