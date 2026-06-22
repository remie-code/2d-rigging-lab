import type {
  RuntimePlayerInputProfileFinishCalibrationRequest,
  RuntimePlayerInputProfileStartCalibrationRequest
} from "../preload/input-profile-bridge-contract";

const defaultCalibrationDisplayName = "iFacialMocap Profile";
const maxDisplayNameLength = 80;

export type InputProfileStartCalibrationCommand = {
  readonly displayName: string;
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

  return {
    displayName: readOptionalDisplayName(rawRequest?.displayName)
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
