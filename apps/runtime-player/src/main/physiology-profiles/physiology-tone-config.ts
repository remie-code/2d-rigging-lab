import type {
  PhysiologyBlinkToneField,
  PhysiologyGazeToneField,
  PhysiologyHeadToneField,
  PhysiologyPostureToneField,
  PhysiologySectionId,
  PhysiologyToneOverrides
} from "../../preload/physiology-bridge-contract";
import {
  DEFAULT_BLINK_BASELINE,
  DEFAULT_GAZE_BASELINE,
  DEFAULT_HEAD_BASELINE,
  DEFAULT_POSTURE_BASELINE,
  type BlinkBaselineConfig,
  type GazeBaselineConfig,
  type HeadBaselineConfig,
  type PhysiologyConfig,
  type PostureBaselineConfig
} from "../physiology";

/**
 * Quality-word → internal-element mapping (C3 Domain C, design §6 対応表). This is
 * the ONE place the model-independent「質感語」sliders become the internal physiology
 * schema; the range NORMALIZATION lives here too (Orch 裁定). It is a PURE data
 * transform (no Electron / no clock / no random), so config generation stays clean.
 *
 * Anchoring: every numeric tone is a normalized [0, 1] value whose 0.5 midpoint maps
 * EXACTLY to the universal baseline default (`anchoredLerp` is exact at t = 0.5).
 * So the all-defaults config equals the blink/gaze/head/posture universal baselines —
 * which makes「Reset → 普遍既定」and「default-ON = full physiology」the same construction
 * (tested in physiology-tone-config.test.ts). The endpoints are the quality extremes.
 *
 * Range-preservation of the quality condition (Orch 裁定, task): the internal
 * elements below are only lower-bounded upstream, so each range must keep the internal
 * value inside the band that preserves the design's texture. The sharpest case is
 * Head: Follow — the head gain is 0.6·follow (head-behavior.ts FOLLOW_MAX_GAIN), and
 * follow > ~1.667 breaks「全部は向かない」(|follow| < |gaze|). The follow range maxes the
 * internal follow at 1.0 (gain 0.6 < 1), so the condition holds.
 */

/** Default tone for every exposed numeric slider (midpoint = universal baseline). */
export const DEFAULT_TONE = 0.5;
/** Stage Presence strength default tone (small — 既定は控えめ, UX §2). */
export const DEFAULT_STAGE_PRESENCE_STRENGTH = 0.3;
/** Stage Presence toggle default (既定 Off, 設計§5 裁定). */
export const DEFAULT_STAGE_PRESENCE_ENABLED = false;

export const PHYSIOLOGY_BLINK_TONE_FIELDS: readonly PhysiologyBlinkToneField[] = [
  "frequency",
  "calmness",
  "crispness",
  "quirk"
];
export const PHYSIOLOGY_GAZE_TONE_FIELDS: readonly PhysiologyGazeToneField[] = [
  "cameraFocus",
  "restlessness",
  "dwell"
];
export const PHYSIOLOGY_HEAD_TONE_FIELDS: readonly PhysiologyHeadToneField[] = [
  "sway",
  "follow"
];
export const PHYSIOLOGY_POSTURE_TONE_FIELDS: readonly PhysiologyPostureToneField[] =
  ["drift", "restlessness"];

/** The exposed numeric slider fields per section (Stage Presence handled apart). */
export const PHYSIOLOGY_SECTION_TONE_FIELDS: Readonly<
  Record<PhysiologySectionId, readonly string[]>
> = {
  blink: PHYSIOLOGY_BLINK_TONE_FIELDS,
  gaze: PHYSIOLOGY_GAZE_TONE_FIELDS,
  head: PHYSIOLOGY_HEAD_TONE_FIELDS,
  posture: PHYSIOLOGY_POSTURE_TONE_FIELDS,
  stagePresence: ["strength"]
};

function clampTone(tone: number): number {
  if (!Number.isFinite(tone)) {
    return DEFAULT_TONE;
  }
  return Math.min(Math.max(tone, 0), 1);
}

/**
 * Piecewise-linear interpolation anchored so the midpoint (t = 0.5) is EXACT.
 * t ≤ 0.5 lerps atZero → atHalf; t ≥ 0.5 lerps atHalf → atOne. Inverse mappings
 * (e.g. higher frequency = shorter interval) come from atZero > atOne.
 */
function anchoredLerp(
  tone: number,
  atZero: number,
  atHalf: number,
  atOne: number
): number {
  const t = clampTone(tone);
  if (t <= 0.5) {
    return atZero + (atHalf - atZero) * (t / 0.5);
  }
  return atHalf + (atOne - atHalf) * ((t - 0.5) / 0.5);
}

/** Coerce a sparse family override into a string-indexed numeric record. */
function toneRecord(value: unknown): Readonly<Record<string, number | undefined>> {
  return (value ?? {}) as Readonly<Record<string, number | undefined>>;
}

function toneOf(
  record: Readonly<Record<string, number | undefined>>,
  field: string
): number {
  const value = record[field];
  return value === undefined ? DEFAULT_TONE : clampTone(value);
}

function mapBlinkBaseline(
  overrides: PhysiologyToneOverrides["blink"]
): BlinkBaselineConfig {
  const record = toneRecord(overrides);
  // Crispness scales BOTH close/open durations by one factor (design §6「開閉のきびきび」).
  // 0.5 → 1.0 keeps the exact baseline durations (100 / 220 ms).
  const crispnessFactor = anchoredLerp(toneOf(record, "crispness"), 1.5, 1, 0.6);

  return {
    // Frequency: higher = more blinks = SHORTER mean interval (inverse).
    meanBlinkIntervalMs: anchoredLerp(
      toneOf(record, "frequency"),
      6000,
      DEFAULT_BLINK_BASELINE.meanBlinkIntervalMs,
      1800
    ),
    // Calmness: higher = steadier = LOWER jitter (「ばらつきの逆」, inverse).
    intervalJitterRatio: anchoredLerp(
      toneOf(record, "calmness"),
      0.9,
      DEFAULT_BLINK_BASELINE.intervalJitterRatio,
      0.2
    ),
    // Non-exposed universal constants (露出しない, §6): kept at the baseline.
    minRefractoryMs: DEFAULT_BLINK_BASELINE.minRefractoryMs,
    // Quirk: the二連 (double-blink) probability.
    doubleBlinkProbability: anchoredLerp(
      toneOf(record, "quirk"),
      0,
      DEFAULT_BLINK_BASELINE.doubleBlinkProbability,
      0.4
    ),
    closeDurationMs: Math.round(
      DEFAULT_BLINK_BASELINE.closeDurationMs * crispnessFactor
    ),
    openDurationMs: Math.round(
      DEFAULT_BLINK_BASELINE.openDurationMs * crispnessFactor
    ),
    holdDurationMs: DEFAULT_BLINK_BASELINE.holdDurationMs,
    closeDepth: DEFAULT_BLINK_BASELINE.closeDepth
  };
}

function mapGazeBaseline(
  overrides: PhysiologyToneOverrides["gaze"]
): GazeBaselineConfig {
  const record = toneRecord(overrides);
  return {
    cameraFocus: anchoredLerp(
      toneOf(record, "cameraFocus"),
      0,
      DEFAULT_GAZE_BASELINE.cameraFocus,
      1.2
    ),
    restlessness: anchoredLerp(
      toneOf(record, "restlessness"),
      0,
      DEFAULT_GAZE_BASELINE.restlessness,
      1
    ),
    // Dwell: higher = LONGER fixations (design §6「固視の長さ」).
    dwellMs: anchoredLerp(
      toneOf(record, "dwell"),
      500,
      DEFAULT_GAZE_BASELINE.dwellMs,
      3500
    )
  };
}

function mapHeadBaseline(
  overrides: PhysiologyToneOverrides["head"]
): HeadBaselineConfig {
  const record = toneRecord(overrides);
  return {
    sway: anchoredLerp(
      toneOf(record, "sway"),
      0,
      DEFAULT_HEAD_BASELINE.sway,
      1.2
    ),
    // Follow capped at 1.0 so gain (0.6·follow) stays < 1 —「全部は向かない」holds.
    follow: anchoredLerp(
      toneOf(record, "follow"),
      0,
      DEFAULT_HEAD_BASELINE.follow,
      1
    )
  };
}

function mapPostureBaseline(
  overrides: PhysiologyToneOverrides["posture"]
): PostureBaselineConfig {
  const record = toneRecord(overrides);
  return {
    drift: anchoredLerp(
      toneOf(record, "drift"),
      0,
      DEFAULT_POSTURE_BASELINE.drift,
      1.2
    ),
    restlessness: anchoredLerp(
      toneOf(record, "restlessness"),
      0,
      DEFAULT_POSTURE_BASELINE.restlessness,
      1
    )
  };
}

/**
 * Build the full PhysiologyConfig the config provider hands to the heart. Starts
 * from the universal full-baseline grammar (blink + gaze + head + posture, so the
 * Autonomous Host is fully alive「設定なしで視線・頭・姿勢が生きる」) and applies the tone
 * overrides. Stage Presence is carried as a config field for Domain D (既定 Off).
 */
export function physiologyOverridesToConfig(
  overrides: PhysiologyToneOverrides
): PhysiologyConfig {
  return {
    schemaVersion: "runtime-player-physiology-config-v1",
    blink: mapBlinkBaseline(overrides.blink),
    gaze: mapGazeBaseline(overrides.gaze),
    head: mapHeadBaseline(overrides.head),
    posture: mapPostureBaseline(overrides.posture),
    stagePresence: {
      enabled:
        overrides.stagePresence?.enabled ?? DEFAULT_STAGE_PRESENCE_ENABLED,
      strength: clampTone(
        overrides.stagePresence?.strength ?? DEFAULT_STAGE_PRESENCE_STRENGTH
      )
    }
  };
}

/**
 * The effective tone shown on each section's sliders (default merged with the
 * override). Used to render the page — quality-word positions only, never the
 * internal ms/Hz values.
 */
export function resolveEffectiveSectionTones(
  section: PhysiologySectionId,
  overrides: PhysiologyToneOverrides
): Readonly<Record<string, number>> {
  if (section === "stagePresence") {
    return {
      strength: clampTone(
        overrides.stagePresence?.strength ?? DEFAULT_STAGE_PRESENCE_STRENGTH
      )
    };
  }

  const record = toneRecord(overrides[section]);
  const tones: Record<string, number> = {};
  for (const field of PHYSIOLOGY_SECTION_TONE_FIELDS[section]) {
    tones[field] = toneOf(record, field);
  }
  return tones;
}

/** Whether a section carries any effective deviation from the universal default. */
export function sectionHasOverride(
  section: PhysiologySectionId,
  overrides: PhysiologyToneOverrides
): boolean {
  if (section === "stagePresence") {
    const stage = overrides.stagePresence;
    if (stage === undefined) {
      return false;
    }
    return (
      (stage.enabled !== undefined &&
        stage.enabled !== DEFAULT_STAGE_PRESENCE_ENABLED) ||
      (stage.strength !== undefined &&
        clampTone(stage.strength) !== DEFAULT_STAGE_PRESENCE_STRENGTH)
    );
  }

  const record = toneRecord(overrides[section]);
  return PHYSIOLOGY_SECTION_TONE_FIELDS[section].some((field) => {
    const value = record[field];
    return value !== undefined && clampTone(value) !== DEFAULT_TONE;
  });
}
