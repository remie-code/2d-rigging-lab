import type {
  RuntimePlayerStageMotionSettings
} from "../../preload/runtime-player-bridge-contract";

export const runtimePlayerDefaultStageMotionSettings: RuntimePlayerStageMotionSettings = {
  enabled: false,
  horizontal: {
    strengthPx: 80,
    limitPx: 120,
    invert: false
  },
  scale: {
    strength: 0.06,
    limit: 0.1,
    invert: false
  },
  deadZone: 0.03,
  reaction: 8
};

const maxHorizontalPixels = 10000;
const maxScaleFraction = 0.95;
const maxReaction = 60;

export function normalizeRuntimePlayerStageMotionSettings(
  value: unknown
): RuntimePlayerStageMotionSettings {
  if (!isRecord(value)) {
    return runtimePlayerDefaultStageMotionSettings;
  }

  const horizontal = isRecord(value.horizontal)
    ? value.horizontal
    : {};
  const scale = isRecord(value.scale)
    ? value.scale
    : {};

  return {
    enabled: readBoolean(
      value.enabled,
      runtimePlayerDefaultStageMotionSettings.enabled
    ),
    horizontal: {
      strengthPx: readClampedFiniteNumber(
        horizontal.strengthPx,
        0,
        maxHorizontalPixels,
        runtimePlayerDefaultStageMotionSettings.horizontal.strengthPx
      ),
      limitPx: readClampedFiniteNumber(
        horizontal.limitPx,
        0,
        maxHorizontalPixels,
        runtimePlayerDefaultStageMotionSettings.horizontal.limitPx
      ),
      invert: readBoolean(
        horizontal.invert,
        runtimePlayerDefaultStageMotionSettings.horizontal.invert
      )
    },
    scale: {
      strength: readClampedFiniteNumber(
        scale.strength,
        0,
        maxScaleFraction,
        runtimePlayerDefaultStageMotionSettings.scale.strength
      ),
      limit: readClampedFiniteNumber(
        scale.limit,
        0,
        maxScaleFraction,
        runtimePlayerDefaultStageMotionSettings.scale.limit
      ),
      invert: readBoolean(
        scale.invert,
        runtimePlayerDefaultStageMotionSettings.scale.invert
      )
    },
    deadZone: readClampedFiniteNumber(
      value.deadZone,
      0,
      1,
      runtimePlayerDefaultStageMotionSettings.deadZone
    ),
    reaction: readClampedFiniteNumber(
      value.reaction,
      0,
      maxReaction,
      runtimePlayerDefaultStageMotionSettings.reaction
    )
  };
}

export function applyRuntimePlayerStageMotionSettingsUpdate(
  current: RuntimePlayerStageMotionSettings,
  update: unknown
): RuntimePlayerStageMotionSettings {
  const updateRecord = readSettingsUpdateRecord(update);

  return normalizeRuntimePlayerStageMotionSettings({
    ...current,
    ...updateRecord,
    horizontal: {
      ...current.horizontal,
      ...readSettingsUpdateRecord(updateRecord.horizontal)
    },
    scale: {
      ...current.scale,
      ...readSettingsUpdateRecord(updateRecord.scale)
    }
  });
}

function readSettingsUpdateRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readClampedFiniteNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
