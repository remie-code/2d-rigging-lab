import type {
  BehaviorSampleInput,
  PhysiologyBehavior,
  SemanticSlotActivationContribution
} from "./behavior-class";
import {
  layeredValueNoise,
  type NoiseLayer
} from "./deterministic-noise";
import {
  DEFAULT_POSTURE_BASELINE,
  INITIAL_RESEAT_CURSOR,
  walkReseatTo,
  type PostureBaselineConfig,
  type ReseatCursor
} from "./posture-reseat";

/**
 * Posture behavior class (C3 Domain B, design §1.3「ドリフト+組み替え」). Emits the
 * two body SEMANTIC slots (body-x → body.angle.x, body-z → body.angle.z) in the
 * centered [-1, 1] convention. Two-storey:
 *  - a constant, extremely slow重心ドリフト (a slow 2-layer noise, small amplitude);
 *  - a rare「座り直し」that moves the BASELINE itself (posture-reseat.ts) and stays.
 *
 * body smoothness is fully CLOSED-FORM inside this generator (裁定2): the drift is
 * mean-reverting layered value noise and the reseat is a smootherstep ramp — both
 * pure functions of time. This behavior NEVER touches `body-follow-state` (the
 * stateful EMA), so the body slots stay a pure function of (seed, config, time)
 * and the fixture boundary stays清潔. Downstream, body-z is further attenuated
 * (rotation 0.25 / position 0.4), so even a full ±1 here lands as small motion —
 * good for小振幅 posture drift.
 */

export const POSTURE_BEHAVIOR_ID = "posture";
export const BODY_X_SLOT_ID = "body-x";
export const BODY_Z_SLOT_ID = "body-z";

/** Slow drift octaves (数十秒スケール, two layers so it is not single-frequency). */
const POSTURE_DRIFT_LAYERS: readonly NoiseLayer[] = [
  { cellMs: 22_000, amplitude: 0.7 },
  { cellMs: 47_000, amplitude: 1 }
];
/** Drift amplitude per axis at drift = 1 (small — 振幅小, design §1.3). */
const DRIFT_AMPLITUDE = 0.35;

const CHANNEL_DRIFT_X = 41;
const CHANNEL_DRIFT_Z = 42;

function clampUnitSigned(value: number): number {
  return Math.min(Math.max(value, -1), 1);
}

/**
 * Pure posture value at a logical time: reseat baseline + slow drift. Exposed for
 * fixtures / cursor-equivalence assertions.
 */
export function samplePostureValue(
  seed: number,
  config: PostureBaselineConfig,
  logicalTimeMs: number
): { x: number; z: number } {
  const walk = walkReseatTo(seed, config, INITIAL_RESEAT_CURSOR, logicalTimeMs);
  return postureFromParts(seed, config, logicalTimeMs, walk.x, walk.z);
}

function postureFromParts(
  seed: number,
  config: PostureBaselineConfig,
  logicalTimeMs: number,
  baselineX: number,
  baselineZ: number
): { x: number; z: number } {
  const driftAmp = DRIFT_AMPLITUDE * Math.max(0, config.drift);
  const driftX =
    driftAmp * layeredValueNoise(seed, CHANNEL_DRIFT_X, logicalTimeMs, POSTURE_DRIFT_LAYERS);
  const driftZ =
    driftAmp * layeredValueNoise(seed, CHANNEL_DRIFT_Z, logicalTimeMs, POSTURE_DRIFT_LAYERS);
  return {
    x: clampUnitSigned(baselineX + driftX),
    z: clampUnitSigned(baselineZ + driftZ)
  };
}

export function createPostureBehavior(
  config: PostureBaselineConfig = DEFAULT_POSTURE_BASELINE
): PhysiologyBehavior {
  let cursor: ReseatCursor = INITIAL_RESEAT_CURSOR;
  let lastTimeMs = Number.NEGATIVE_INFINITY;

  return {
    behaviorId: POSTURE_BEHAVIOR_ID,
    slotIds: [BODY_X_SLOT_ID, BODY_Z_SLOT_ID],
    sample(input: BehaviorSampleInput): SemanticSlotActivationContribution {
      if (input.logicalTimeMs < lastTimeMs) {
        cursor = INITIAL_RESEAT_CURSOR;
      }
      lastTimeMs = input.logicalTimeMs;

      const walk = walkReseatTo(input.seed, config, cursor, input.logicalTimeMs);
      cursor = walk.cursor;

      const value = postureFromParts(
        input.seed,
        config,
        input.logicalTimeMs,
        walk.x,
        walk.z
      );
      return {
        [BODY_X_SLOT_ID]: value.x,
        [BODY_Z_SLOT_ID]: value.z
      };
    }
  };
}
