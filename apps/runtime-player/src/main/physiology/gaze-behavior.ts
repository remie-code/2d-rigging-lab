import type {
  BehaviorSampleInput,
  PhysiologyBehavior,
  SemanticSlotActivationContribution
} from "./behavior-class";
import { smoothValueNoise } from "./deterministic-noise";
import {
  DEFAULT_GAZE_BASELINE,
  INITIAL_GAZE_CURSOR,
  sampleGazeLanding,
  walkGazeTo,
  type GazeBaselineConfig,
  type GazeWalkCursor
} from "./gaze-saccade";

/**
 * Gaze behavior class (C3 Domain B, design §1.1「サッカード+固視」). Emits the two
 * gaze SEMANTIC slots (gaze-horizontal → eyeball.x, gaze-vertical → eyeball.y) in
 * the centered [-1, 1] convention (0 = camera / neutral). The motion is a DISCRETE
 * fixation列 (see gaze-saccade.ts): the eye rests at a landing point and jumps
 * INSTANTLY to the next — there is no lerp between landings (design §4-1「滑る視線
 * =幽霊の目」is the fatal anti-pattern). A tiny continuous micro-jitter keeps the
 * fixation「留まっているが生きている」without drifting off the landing (design §1.1
 * 「微小揺らぎは可」).
 *
 * Determinism: a pure function of (seed, config, logical time); the forward-only
 * cursor is a performance memo (asserted equal to a from-epoch walk).
 */

export const GAZE_BEHAVIOR_ID = "gaze";
export const GAZE_HORIZONTAL_SLOT_ID = "gaze-horizontal";
export const GAZE_VERTICAL_SLOT_ID = "gaze-vertical";

/** Micro-jitter during a fixation: tiny amplitude, fast cell (露出しない). */
const MICRO_JITTER_AMPLITUDE = 0.015;
const MICRO_JITTER_CELL_MS = 220;
const CHANNEL_MICRO_X = 31;
const CHANNEL_MICRO_Y = 32;

function clampUnitSigned(value: number): number {
  return Math.min(Math.max(value, -1), 1);
}

/**
 * Pure gaze value at a logical time: the fixation landing plus a small live
 * micro-jitter. Exposed for fixtures / cursor-equivalence assertions.
 */
export function sampleGazeValue(
  seed: number,
  config: GazeBaselineConfig,
  logicalTimeMs: number
): { x: number; y: number } {
  const landing = sampleGazeLanding(seed, config, logicalTimeMs);
  return {
    x: clampUnitSigned(
      landing.x +
        MICRO_JITTER_AMPLITUDE *
          smoothValueNoise(seed, CHANNEL_MICRO_X, logicalTimeMs, MICRO_JITTER_CELL_MS)
    ),
    y: clampUnitSigned(
      landing.y +
        MICRO_JITTER_AMPLITUDE *
          smoothValueNoise(seed, CHANNEL_MICRO_Y, logicalTimeMs, MICRO_JITTER_CELL_MS)
    )
  };
}

export function createGazeBehavior(
  config: GazeBaselineConfig = DEFAULT_GAZE_BASELINE
): PhysiologyBehavior {
  let cursor: GazeWalkCursor = INITIAL_GAZE_CURSOR;
  let lastTimeMs = Number.NEGATIVE_INFINITY;

  return {
    behaviorId: GAZE_BEHAVIOR_ID,
    slotIds: [GAZE_HORIZONTAL_SLOT_ID, GAZE_VERTICAL_SLOT_ID],
    sample(input: BehaviorSampleInput): SemanticSlotActivationContribution {
      if (input.logicalTimeMs < lastTimeMs) {
        cursor = INITIAL_GAZE_CURSOR;
      }
      lastTimeMs = input.logicalTimeMs;

      const walk = walkGazeTo(input.seed, config, cursor, input.logicalTimeMs);
      cursor = walk.cursor;

      const microX = smoothValueNoise(
        input.seed,
        CHANNEL_MICRO_X,
        input.logicalTimeMs,
        MICRO_JITTER_CELL_MS
      );
      const microY = smoothValueNoise(
        input.seed,
        CHANNEL_MICRO_Y,
        input.logicalTimeMs,
        MICRO_JITTER_CELL_MS
      );

      return {
        [GAZE_HORIZONTAL_SLOT_ID]: clampUnitSigned(
          walk.fixation.x + MICRO_JITTER_AMPLITUDE * microX
        ),
        [GAZE_VERTICAL_SLOT_ID]: clampUnitSigned(
          walk.fixation.y + MICRO_JITTER_AMPLITUDE * microY
        )
      };
    }
  };
}
