import type { RuntimePlayerInputSessionNeutralSnapshot } from "../../preload/input-profile-bridge-contract";
import type { TrackingVector3 } from "../../preload/input-tracking-frame-contract";
import type { InputProfileCalibration } from "./input-profile-document";
import { isInputProfileHeadPositionNearFarCalibrationReady } from "./input-profile-calibration-sections";

export function normalizeInputProfileHeadPositionDepth(input: {
  readonly current: TrackingVector3 | undefined;
  readonly sessionNeutral: RuntimePlayerInputSessionNeutralSnapshot | null;
  readonly calibration: InputProfileCalibration["headPositionRaw"] | undefined;
}): number | null {
  if (
    input.current === undefined ||
    input.calibration === undefined ||
    !isInputProfileHeadPositionNearFarCalibrationReady(input.calibration)
  ) {
    return null;
  }

  const sign = input.calibration.learnedSigns.bodyNear;

  if (sign === undefined) {
    return null;
  }

  return readCenteredNormalizedValue({
    current: input.current[sign.axis],
    sessionNeutral: input.sessionNeutral?.headPositionRaw?.[sign.axis],
    profileNeutral: input.calibration.neutral[sign.axis],
    profileMin: input.calibration.min[sign.axis],
    profileMax: input.calibration.max[sign.axis],
    positiveDirection: sign.direction
  });
}

function readCenteredNormalizedValue(input: {
  readonly current: number;
  readonly sessionNeutral: number | null | undefined;
  readonly profileNeutral: number;
  readonly profileMin: number;
  readonly profileMax: number;
  readonly positiveDirection: -1 | 1;
}): number | null {
  if (
    !Number.isFinite(input.current) ||
    !Number.isFinite(input.profileNeutral) ||
    !Number.isFinite(input.profileMin) ||
    !Number.isFinite(input.profileMax) ||
    (
      input.sessionNeutral !== null &&
      input.sessionNeutral !== undefined &&
      !Number.isFinite(input.sessionNeutral)
    )
  ) {
    return null;
  }

  const neutral = input.sessionNeutral ?? input.profileNeutral;
  const signedCurrent = (input.current - neutral) * input.positiveDirection;
  const signedProfileMin =
    (input.profileMin - input.profileNeutral) * input.positiveDirection;
  const signedProfileMax =
    (input.profileMax - input.profileNeutral) * input.positiveDirection;
  const positiveRange = Math.max(
    0.0001,
    ...[signedProfileMin, signedProfileMax].filter(Number.isFinite)
  );
  const negativeRange = Math.max(
    0.0001,
    ...[-signedProfileMin, -signedProfileMax].filter(Number.isFinite)
  );
  const normalized = signedCurrent >= 0
    ? signedCurrent / positiveRange
    : signedCurrent / negativeRange;

  return clamp(normalized, -1, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
