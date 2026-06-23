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
  "head-position-left-right",
  "head-position-near-far"
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

const headPositionLeftRightPromptKeys = [
  "head-position-left",
  "head-position-right"
] as const satisfies readonly RuntimePlayerInputCalibrationPromptKey[];

const headPositionNearFarPromptKeys = [
  "head-position-near",
  "head-position-far"
] as const satisfies readonly RuntimePlayerInputCalibrationPromptKey[];

export const inputProfileHeadPositionCalibrationSectionKeys = [
  "head-position-left-right",
  "head-position-near-far"
] as const satisfies readonly RuntimePlayerInputCalibrationSectionKey[];

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
      key: "head-position-left-right",
      label: "Head position left/right",
      status: isInputProfileHeadPositionLeftRightCalibrationReady(
        calibration?.headPositionRaw
      )
        ? "ready"
        : "missing"
    },
    {
      key: "head-position-near-far",
      label: "Head position near/far",
      status: isInputProfileHeadPositionNearFarCalibrationReady(
        calibration?.headPositionRaw
      )
        ? "ready"
        : "missing"
    }
  ];
}

export function isInputProfileHeadPositionLeftRightCalibrationReady(
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

export function isInputProfileHeadPositionNearFarCalibrationReady(
  headPositionRaw: InputProfileCalibration["headPositionRaw"] | undefined
): boolean {
  return (
    headPositionRaw !== undefined &&
    isFiniteVector3(headPositionRaw.neutral) &&
    isFiniteVector3(headPositionRaw.min) &&
    isFiniteVector3(headPositionRaw.max) &&
    isUsableLearnedSign(headPositionRaw.learnedSigns?.bodyNear) &&
    isUsableLearnedSign(headPositionRaw.learnedSigns?.bodyFar)
  );
}

export function isInputProfileHeadPositionCalibrationSectionKey(
  section: RuntimePlayerInputCalibrationSectionKey
): boolean {
  return (
    section === "head-position-left-right" ||
    section === "head-position-near-far"
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
      case "head-position-left-right":
        promptKeys.push(...headPositionLeftRightPromptKeys);
        break;
      case "head-position-near-far":
        promptKeys.push(...headPositionNearFarPromptKeys);
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
