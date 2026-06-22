import type {
  RuntimePlayerInputCalibrationPromptKey,
  RuntimePlayerInputCalibrationSectionKey,
  RuntimePlayerInputCalibrationSectionStatus
} from "../../preload/input-profile-bridge-contract";
import type {
  InputProfileCalibration,
  InputProfileLearnedSign
} from "./input-profile-document";
import type { TrackingVector3 } from "../../preload/input-tracking-frame-contract";

export const inputProfileCalibrationSectionKeys = [
  "head-rotation",
  "eyes-mouth",
  "head-position"
] as const satisfies readonly RuntimePlayerInputCalibrationSectionKey[];

const headRotationPromptKeys = [
  "face-left",
  "face-right",
  "look-up",
  "look-down",
  "tilt-left",
  "tilt-right"
] as const satisfies readonly RuntimePlayerInputCalibrationPromptKey[];

const eyesMouthPromptKeys = [
  "eyes-left",
  "eyes-right",
  "eyes-up",
  "eyes-down",
  "blink",
  "open-mouth",
  "smile"
] as const satisfies readonly RuntimePlayerInputCalibrationPromptKey[];

const headPositionPromptKeys = [
  "head-position-left",
  "head-position-right"
] as const satisfies readonly RuntimePlayerInputCalibrationPromptKey[];

export function createInputProfileCalibrationSectionStatuses(
  calibration: InputProfileCalibration | null
): readonly RuntimePlayerInputCalibrationSectionStatus[] {
  return [
    {
      key: "head-rotation",
      label: "Head rotation",
      status: calibration === null ? "missing" : "ready"
    },
    {
      key: "eyes-mouth",
      label: "Eyes / mouth",
      status: calibration === null ? "missing" : "ready"
    },
    {
      key: "head-position",
      label: "Head position left/right",
      status: isInputProfileHeadPositionCalibrationReady(
        calibration?.headPositionRaw
      )
        ? "ready"
        : "missing"
    }
  ];
}

export function isInputProfileHeadPositionCalibrationReady(
  headPositionRaw: InputProfileCalibration["headPositionRaw"] | undefined
): boolean {
  return (
    headPositionRaw !== undefined &&
    isFiniteVector3(headPositionRaw.neutral) &&
    isFiniteVector3(headPositionRaw.min) &&
    isFiniteVector3(headPositionRaw.max) &&
    isUsableLearnedSign(headPositionRaw.learnedSigns?.bodyLeft) &&
    isUsableLearnedSign(headPositionRaw.learnedSigns?.bodyRight)
  );
}

export function getMissingInputProfileCalibrationSections(
  calibration: InputProfileCalibration
): readonly RuntimePlayerInputCalibrationSectionKey[] {
  return createInputProfileCalibrationSectionStatuses(calibration)
    .filter((section) => section.status === "missing")
    .map((section) => section.key);
}

export function getCalibrationPromptKeysForSections(
  sections: readonly RuntimePlayerInputCalibrationSectionKey[]
): readonly RuntimePlayerInputCalibrationPromptKey[] {
  const promptKeys: RuntimePlayerInputCalibrationPromptKey[] = [
    "look-forward"
  ];

  for (const section of sections) {
    switch (section) {
      case "head-rotation":
        promptKeys.push(...headRotationPromptKeys);
        break;
      case "eyes-mouth":
        promptKeys.push(...eyesMouthPromptKeys);
        break;
      case "head-position":
        promptKeys.push(...headPositionPromptKeys);
        break;
    }
  }

  return promptKeys;
}

function isFiniteVector3(value: TrackingVector3 | undefined): boolean {
  return (
    value !== undefined &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.z)
  );
}

function isUsableLearnedSign(
  value: InputProfileLearnedSign | undefined
): value is InputProfileLearnedSign {
  return (
    value !== undefined &&
    (value.axis === "x" || value.axis === "y" || value.axis === "z") &&
    (value.direction === -1 || value.direction === 1)
  );
}
