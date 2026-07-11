import type {
  BehaviorSampleInput,
  PhysiologyBehavior,
  SemanticSlotActivationContribution
} from "./behavior-class";
import { deriveBehaviorSeed, hashUnit } from "./deterministic-hash";
import {
  homeSpringValue,
  type NoiseLayer
} from "./deterministic-noise";
import { GAZE_BEHAVIOR_ID } from "./gaze-behavior";
import {
  INITIAL_GAZE_CURSOR,
  stepFixation,
  type GazeBaselineConfig,
  type GazeWalkCursor
} from "./gaze-saccade";
import { POSTURE_BEHAVIOR_ID } from "./posture-behavior";
import {
  INITIAL_RESEAT_CURSOR,
  walkReseatTo,
  type PostureBaselineConfig,
  type ReseatCursor
} from "./posture-reseat";

/**
 * Head behavior class (C3 Domain B, design §1.2「多時間軸ノイズ+目頭協調」). Emits
 * the three head SEMANTIC slots (head-horizontal/vertical/tilt → face.angle.x/y/z)
 * in the centered [-1, 1] convention. Three ingredients:
 *
 *  1. MULTI-TIMESCALE noise (§1.2): fast / mid / slow octaves via homeSpringValue
 *     over layeredValueNoise. The 3層比 is a UNIVERSAL default (露出しない, §6); only
 *     the overall amplitude (Head: Sway) and follow depth (Head: Follow) are
 *     exposed. A single sine wave is the「単一周波数」anti-pattern (§4-2); the layered
 *     octaves push the composite period past the 30s window (§1.2「ほぼ数学」). The
 *     home itself drifts (the slow octave inside the spring), so the head never
 *     snaps back to a fixed centre — avoiding「完全な中心回帰=リセットされる人形」
 *     (§4-4). homePull keeps motion as punctuation, not constant sway (§4-5).
 *
 *  2. COUPLING 1「目が先、頭が後」(§3-1): the head recomputes the SAME gaze saccade
 *     schedule (via the shared coupling seed → gaze sub-seed) and lag-follows LARGE
 *     saccades — starting 300〜700ms later (a per-saccade universal delay,露出しない)
 *     and only PARTWAY (followGain < 1「全部は向かない」). The eye jumps instantly; the
 *     head arrives late and incomplete — the coordination that sells life (§3).
 *
 *  3. COUPLING 3「体は頭の親」(§3-3): the head's home rides on the posture RESEAT
 *     baseline (recomputed via the coupling seed → posture sub-seed). When the body
 *     re-settles, the head's centre moves with it (hierarchy).
 *
 * Determinism/purity: a pure function of (seed, couplingSeed, configs, time). The
 * cursors + recent-saccade ring are a forward-only performance memo; a from-epoch
 * evaluation at any time is identical (asserted by the cursor-equivalence test).
 * Couplings degrade gracefully to independent motion when the sibling config or
 * the coupling seed is absent (isolated unit tests).
 */

export const HEAD_BEHAVIOR_ID = "head";
export const HEAD_HORIZONTAL_SLOT_ID = "head-horizontal";
export const HEAD_VERTICAL_SLOT_ID = "head-vertical";
export const HEAD_TILT_SLOT_ID = "head-tilt";

/** Head: Sway + Follow are the only exposed elements (design §6). */
export type HeadBaselineConfig = {
  /** Head: Sway (design §6) — overall amplitude of the 3-layer noise. */
  readonly sway: number;
  /** Head: Follow (design §6) — depth of the gaze-follow coupling (0..1「途中まで」). */
  readonly follow: number;
};

export const DEFAULT_HEAD_BASELINE: HeadBaselineConfig = {
  sway: 0.5,
  follow: 0.5
};

/** Sibling configs the head couples to (design §3). Absent → that coupling off. */
export type HeadCouplingConfig = {
  readonly gaze?: GazeBaselineConfig;
  readonly posture?: PostureBaselineConfig;
};

// --- Universal internal constants (露出しない, design §6) --------------------
/** fast / mid / slow octaves for head horizontal & vertical (数学的な多時間軸). */
const HEAD_LAYERS: readonly NoiseLayer[] = [
  { cellMs: 900, amplitude: 0.25 }, // fast 微調整
  { cellMs: 6000, amplitude: 0.6 }, // mid 彷徨
  { cellMs: 45000, amplitude: 1 } // slow 中心ドリフト (home drifts here)
];
/** Tilt is subtler: a 2-layer octave set, smaller amplitude. */
const HEAD_TILT_LAYERS: readonly NoiseLayer[] = [
  { cellMs: 1200, amplitude: 0.4 },
  { cellMs: 9000, amplitude: 1 }
];
const SWAY_AMPLITUDE = 0.5; // head-h/v amplitude at sway = 1
const TILT_AMPLITUDE = 0.32; // head-tilt amplitude at sway = 1
const HEAD_HOME_PULL = 0.5; // punctuation (§4-5「静止に句読点」)

const FOLLOW_DELAY_MIN_MS = 300; // §3-1「300〜700ms遅れて」
const FOLLOW_DELAY_SPAN_MS = 400; // → up to 700ms
const FOLLOW_RAMP_MS = 450; // smootherstep ramp of the partial follow
const FOLLOW_MAX_GAIN = 0.6; // partway ceiling; × config.follow

const POSTURE_TO_HEAD_H = 0.4; // body-x reseat → head horizontal home
const POSTURE_TO_HEAD_TILT = 0.5; // body-z reseat → head tilt home

/** How many recent large saccades to retain for the follow ramp (bounded memo). */
const SACCADE_RING = 16;

const CHANNEL_SWAY_H = 51;
const CHANNEL_SWAY_V = 52;
const CHANNEL_SWAY_TILT = 53;
const CHANNEL_FOLLOW_DELAY = 54;

function clampUnitSigned(value: number): number {
  return Math.min(Math.max(value, -1), 1);
}

function smootherstep(x: number): number {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** A large saccade's activated follow point: influence turns on at `activateMs`. */
type FollowPoint = {
  readonly activateMs: number;
  readonly x: number;
  readonly y: number;
};

export function createHeadBehavior(
  config: HeadBaselineConfig = DEFAULT_HEAD_BASELINE,
  coupling: HeadCouplingConfig = {}
): PhysiologyBehavior {
  // Forward-only memo state (reset on time rewind or coupling-seed change).
  let gazeCursor: GazeWalkCursor = INITIAL_GAZE_CURSOR;
  let reseatCursor: ReseatCursor = INITIAL_RESEAT_CURSOR;
  let followRing: FollowPoint[] = [];
  let lastTimeMs = Number.NEGATIVE_INFINITY;
  let lastCouplingSeed: number | undefined;

  const resetMemo = (): void => {
    gazeCursor = INITIAL_GAZE_CURSOR;
    reseatCursor = INITIAL_RESEAT_CURSOR;
    followRing = [];
  };

  /**
   * Advance the gaze fixation walk to `t`, recording each LARGE saccade's follow
   * point into the ring (kept bounded). Pure function of the schedule + t: a fresh
   * walk from epoch to t yields the same ring tail as an incremental one, so the
   * follow is cadence-independent (fixture equivalence).
   */
  const advanceFollowRing = (
    gazeSeed: number,
    headSeed: number,
    gazeConfig: GazeBaselineConfig,
    t: number
  ): void => {
    for (let guard = 0; guard < 1_000_000; guard += 1) {
      const step = stepFixation(gazeSeed, gazeConfig, gazeCursor);
      if (step.fixation.startMs > t) {
        break;
      }
      if (step.fixation.isLarge) {
        const delay =
          FOLLOW_DELAY_MIN_MS +
          hashUnit(headSeed, step.fixation.index, CHANNEL_FOLLOW_DELAY) *
            FOLLOW_DELAY_SPAN_MS;
        followRing.push({
          activateMs: step.fixation.startMs + delay,
          x: step.fixation.x,
          y: step.fixation.y
        });
        if (followRing.length > SACCADE_RING) {
          followRing.shift();
        }
      }
      gazeCursor = step.next;
    }
  };

  /** Follow contribution at t: smootherstep ramp between the two most-recently
   *  ACTIVATED large-saccade points (activateMs ≤ t). Pure in (ring, t). */
  const followContribution = (t: number): { x: number; y: number } => {
    let cur: FollowPoint | null = null;
    let prev: FollowPoint | null = null;
    for (const point of followRing) {
      if (point.activateMs > t) {
        continue;
      }
      if (cur === null || point.activateMs > cur.activateMs) {
        prev = cur;
        cur = point;
      } else if (prev === null || point.activateMs > prev.activateMs) {
        prev = point;
      }
    }
    if (cur === null) {
      return { x: 0, y: 0 };
    }
    const fromX = prev ? prev.x : 0;
    const fromY = prev ? prev.y : 0;
    const ramp = smootherstep((t - cur.activateMs) / FOLLOW_RAMP_MS);
    return {
      x: fromX + (cur.x - fromX) * ramp,
      y: fromY + (cur.y - fromY) * ramp
    };
  };

  return {
    behaviorId: HEAD_BEHAVIOR_ID,
    slotIds: [HEAD_HORIZONTAL_SLOT_ID, HEAD_VERTICAL_SLOT_ID, HEAD_TILT_SLOT_ID],
    sample(input: BehaviorSampleInput): SemanticSlotActivationContribution {
      const t = input.logicalTimeMs;
      if (input.couplingSeed !== lastCouplingSeed) {
        lastCouplingSeed = input.couplingSeed;
        resetMemo();
      }
      if (t < lastTimeMs) {
        resetMemo();
      }
      lastTimeMs = t;

      // --- 1. Multi-timescale sway (always) ---
      const swayAmp = SWAY_AMPLITUDE * Math.max(0, config.sway);
      const tiltAmp = TILT_AMPLITUDE * Math.max(0, config.sway);
      let headH = homeSpringValue(input.seed, CHANNEL_SWAY_H, t, {
        home: 0,
        amplitude: swayAmp,
        layers: HEAD_LAYERS,
        homePull: HEAD_HOME_PULL
      });
      let headV = homeSpringValue(input.seed, CHANNEL_SWAY_V, t, {
        home: 0,
        amplitude: swayAmp,
        layers: HEAD_LAYERS,
        homePull: HEAD_HOME_PULL
      });
      let headTilt = homeSpringValue(input.seed, CHANNEL_SWAY_TILT, t, {
        home: 0,
        amplitude: tiltAmp,
        layers: HEAD_TILT_LAYERS,
        homePull: HEAD_HOME_PULL
      });

      // --- 3. Posture parent: head home rides on the reseat baseline (§3-3) ---
      if (input.couplingSeed !== undefined && coupling.posture) {
        const postureSeed = deriveBehaviorSeed(input.couplingSeed, POSTURE_BEHAVIOR_ID);
        const walk = walkReseatTo(postureSeed, coupling.posture, reseatCursor, t);
        reseatCursor = walk.cursor;
        headH += POSTURE_TO_HEAD_H * walk.x;
        headTilt += POSTURE_TO_HEAD_TILT * walk.z;
      }

      // --- 1'. Gaze follow: eyes first, head after (§3-1) ---
      if (input.couplingSeed !== undefined && coupling.gaze) {
        const gazeSeed = deriveBehaviorSeed(input.couplingSeed, GAZE_BEHAVIOR_ID);
        advanceFollowRing(gazeSeed, input.seed, coupling.gaze, t);
        const follow = followContribution(t);
        const gain = FOLLOW_MAX_GAIN * Math.max(0, config.follow);
        headH += gain * follow.x;
        headV += gain * follow.y;
      }

      return {
        [HEAD_HORIZONTAL_SLOT_ID]: clampUnitSigned(headH),
        [HEAD_VERTICAL_SLOT_ID]: clampUnitSigned(headV),
        [HEAD_TILT_SLOT_ID]: clampUnitSigned(headTilt)
      };
    }
  };
}
