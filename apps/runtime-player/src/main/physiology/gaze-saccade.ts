import { hashUnit } from "./deterministic-hash";

/**
 * Shared, pure saccade schedule (C3 Domain B, design §1.1). The eye does NOT move
 * smoothly: it is the discrete列 「留まる(固視 200ms〜数秒)→跳ぶ(サッカード)→留まる」.
 * This module owns that schedule as a pure function of (seed, config, time) using
 * the SAME event-walk + forward-only cursor pattern as blink-behavior.ts.
 *
 * It is deliberately a standalone module — NOT a behavior — because THREE parties
 * consume the exact same schedule (design §3 結合):
 *  - the gaze behavior (its own landing points), seeded by its sub-seed;
 *  - the head behavior (coupling 1「目が先、頭が後」), which recomputes this schedule
 *    from the gaze sub-seed to lag-follow large saccades;
 *  - the saccade-blink coupling (coupling 2「大きな視線移動に瞬きが乗る」), which
 *    recomputes it to probabilistically sync a blink.
 * Sharing one pure module keeps them coherent with zero shared state.
 *
 * Purity: hashUnit only — no wall clock, no Math.random, no Electron (physiology/
 * blocking review观点).
 */

// --- Exposed 質感語 → internal element mapping (design §6) --------------------
// Only these three are exposed on the Physiology page (Domain C). The bucket
// geometry, jitter ratio, min-fixation floor, and large-saccade threshold are
// UNIVERSAL internal detail (露出しない, design §6「イージング形状・…は普遍既定」).
export type GazeBaselineConfig = {
  /**
   * Gaze: Camera Focus (design §6) — the weight boost on the camera/home bucket
   * (0,0 = looking at the viewer). Higher = the eyes rest on the camera more.
   */
  readonly cameraFocus: number;
  /**
   * Gaze: Restlessness (design §6) — scales saccade FREQUENCY (shorter dwell) and
   * the spatial SPREAD of the off-camera landing buckets. Higher = jumpier, wider.
   */
  readonly restlessness: number;
  /**
   * Gaze: Dwell (design §6) — the CENTER of the fixation-time distribution (ms).
   * The actual dwell is jittered around this and floored at the refractory min.
   */
  readonly dwellMs: number;
};

export const DEFAULT_GAZE_BASELINE: GazeBaselineConfig = {
  cameraFocus: 0.6,
  restlessness: 0.4,
  dwellMs: 1400 // fixations center ~1.4s (design §1.1「200ms〜数秒」)
};

// --- Universal internal constants (露出しない) -------------------------------
/** ばらつき: symmetric jitter on the dwell time (等間隔=即機械, design §1.1). */
const DWELL_JITTER_RATIO = 0.6;
/** 最短不応期: hard floor on a fixation duration (design §1.1「最短不応期」). */
const MIN_FIXATION_MS = 200;
/** A saccade whose landing is farther than this from the previous is「大」. */
export const LARGE_SACCADE_THRESHOLD = 0.4;

/**
 * Weighted spatial buckets (design §1.1「意味を持たない空間バケツの重み付き抽選」).
 * 魂不在: this is「どのへんを見がち」, not「何を見ているか」. Camera (home) dominates;
 * the sides / diagonals / wander are the occasional excursions.
 */
type GazeBucket = {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  /** Base weight before cameraFocus / restlessness shaping. */
  readonly weight: number;
  /** Whether restlessness widens/boosts this (off-camera) bucket. */
  readonly offCamera: boolean;
};

const GAZE_BUCKETS: readonly GazeBucket[] = [
  { cx: 0, cy: 0, rx: 0.08, ry: 0.08, weight: 1, offCamera: false }, // camera / home
  { cx: 0.55, cy: -0.1, rx: 0.15, ry: 0.12, weight: 0.32, offCamera: true }, // 相方側 (脇)
  { cx: 0.28, cy: 0.42, rx: 0.2, ry: 0.16, weight: 0.14, offCamera: true }, // 斜め上 (考え事)
  { cx: -0.24, cy: -0.4, rx: 0.2, ry: 0.16, weight: 0.14, offCamera: true }, // 斜め下
  { cx: 0, cy: 0, rx: 0.62, ry: 0.5, weight: 0.2, offCamera: true } // さまよう (wide)
];

// hashUnit channels (distinct per drawn quantity).
const CHANNEL_DWELL = 11;
const CHANNEL_BUCKET = 12;
const CHANNEL_JITTER_X = 13;
const CHANNEL_JITTER_Y = 14;

function clampUnitSigned(value: number): number {
  return Math.min(Math.max(value, -1), 1);
}

function symmetric(unit: number): number {
  return 2 * unit - 1; // [-1, 1]
}

/** A single fixation: the eye rests at (x, y) for [startMs, endMs). */
export type GazeFixation = {
  readonly index: number;
  readonly startMs: number;
  readonly durationMs: number;
  readonly endMs: number;
  readonly x: number;
  readonly y: number;
  /** Euclidean distance of the instant jump from the previous landing. */
  readonly distanceFromPrev: number;
  /** Whether the jump INTO this fixation was a large saccade (design §3-1/§3-2). */
  readonly isLarge: boolean;
};

/** Pick a landing point for fixation `index` via the weighted bucket抽選. */
function pickLanding(
  seed: number,
  index: number,
  config: GazeBaselineConfig
): { x: number; y: number } {
  const cameraFocus = Math.max(0, config.cameraFocus);
  const restlessness = Math.max(0, config.restlessness);

  // Bucket weights: cameraFocus boosts home; restlessness boosts off-camera.
  let total = 0;
  const weights: number[] = [];
  for (const bucket of GAZE_BUCKETS) {
    const w = bucket.offCamera
      ? bucket.weight * (0.5 + restlessness)
      : bucket.weight * (1 + 2 * cameraFocus);
    weights.push(w);
    total += w;
  }

  let roll = hashUnit(seed, index, CHANNEL_BUCKET) * total;
  let chosen = GAZE_BUCKETS[0]!;
  for (let i = 0; i < GAZE_BUCKETS.length; i += 1) {
    roll -= weights[i]!;
    if (roll <= 0) {
      chosen = GAZE_BUCKETS[i]!;
      break;
    }
  }

  // Restlessness widens the off-camera spread (design §6「着地点の空間的広がり」).
  const spread = chosen.offCamera ? 0.6 + restlessness : 1;
  const jx = symmetric(hashUnit(seed, index, CHANNEL_JITTER_X)) * chosen.rx * spread;
  const jy = symmetric(hashUnit(seed, index, CHANNEL_JITTER_Y)) * chosen.ry * spread;
  return {
    x: clampUnitSigned(chosen.cx + jx),
    y: clampUnitSigned(chosen.cy + jy)
  };
}

/** Fixation dwell time: jittered around the configured center, floored. */
function dwellDuration(
  seed: number,
  index: number,
  config: GazeBaselineConfig
): number {
  const restlessness = Math.max(0, config.restlessness);
  // Restlessness shortens dwell (more frequent saccades, design §6).
  const center = Math.max(MIN_FIXATION_MS, config.dwellMs / (1 + restlessness));
  const unit = hashUnit(seed, index, CHANNEL_DWELL);
  const raw = center * (1 + DWELL_JITTER_RATIO * symmetric(unit));
  return Math.max(MIN_FIXATION_MS, raw);
}

/**
 * Forward-only walk cursor: the pure state after all fixations strictly before
 * `nextIndex` have completed (identical discipline to BlinkWalkCursor).
 */
export type GazeWalkCursor = {
  readonly nextIndex: number;
  readonly startMs: number;
  readonly prevX: number;
  readonly prevY: number;
};

export const INITIAL_GAZE_CURSOR: GazeWalkCursor = {
  nextIndex: 0,
  startMs: 0,
  // The pre-epoch landing is the camera (home) — the first jump is measured from it.
  prevX: 0,
  prevY: 0
};

function makeFixation(
  seed: number,
  index: number,
  startMs: number,
  prevX: number,
  prevY: number,
  config: GazeBaselineConfig
): GazeFixation {
  const landing = pickLanding(seed, index, config);
  const durationMs = dwellDuration(seed, index, config);
  const dx = landing.x - prevX;
  const dy = landing.y - prevY;
  const distanceFromPrev = Math.hypot(dx, dy);
  return {
    index,
    startMs,
    durationMs,
    endMs: startMs + durationMs,
    x: landing.x,
    y: landing.y,
    distanceFromPrev,
    isLarge: distanceFromPrev > LARGE_SACCADE_THRESHOLD
  };
}

/**
 * Build the fixation at `cursor` and return the cursor advanced one step past it.
 * Lets a coupled consumer (the head follow) iterate fixations one at a time with a
 * forward-only cursor, examining each for `isLarge`, without re-walking from epoch.
 */
export function stepFixation(
  seed: number,
  config: GazeBaselineConfig,
  cursor: GazeWalkCursor
): { fixation: GazeFixation; next: GazeWalkCursor } {
  const fixation = makeFixation(
    seed,
    cursor.nextIndex,
    cursor.startMs,
    cursor.prevX,
    cursor.prevY,
    config
  );
  return {
    fixation,
    next: {
      nextIndex: cursor.nextIndex + 1,
      startMs: fixation.endMs,
      prevX: fixation.x,
      prevY: fixation.y
    }
  };
}

/**
 * Pure reducer: advance from `cursor` to `logicalTimeMs`, returning the fixation
 * CONTAINING that time (the eye is AT its landing — an instant step, never a lerp
 * between landings; design §4-1「滑る視線」is the fatal anti-pattern) plus the
 * updated cursor. Re-querying the same time with the returned cursor is identical.
 */
export function walkGazeTo(
  seed: number,
  config: GazeBaselineConfig,
  cursor: GazeWalkCursor,
  logicalTimeMs: number
): { fixation: GazeFixation; cursor: GazeWalkCursor } {
  let index = cursor.nextIndex;
  let startMs = cursor.startMs;
  let prevX = cursor.prevX;
  let prevY = cursor.prevY;

  for (let step = 0; step < 1_000_000; step += 1) {
    const fixation = makeFixation(seed, index, startMs, prevX, prevY, config);
    if (logicalTimeMs < fixation.endMs) {
      // Inside (or before, for index 0) this fixation. Do NOT advance past it.
      return {
        fixation,
        cursor: { nextIndex: index, startMs, prevX, prevY }
      };
    }
    startMs = fixation.endMs;
    prevX = fixation.x;
    prevY = fixation.y;
    index += 1;
  }

  // Unreachable for sane configs (durations are floored > 0).
  const fixation = makeFixation(seed, index, startMs, prevX, prevY, config);
  return { fixation, cursor: { nextIndex: index, startMs, prevX, prevY } };
}

/**
 * The eye's landing point at a logical time, from the epoch each call. Pure:
 * same (seed, config, time) → same (x, y). Instant step between fixations.
 */
export function sampleGazeLanding(
  seed: number,
  config: GazeBaselineConfig,
  logicalTimeMs: number
): { x: number; y: number } {
  const { fixation } = walkGazeTo(seed, config, INITIAL_GAZE_CURSOR, logicalTimeMs);
  return { x: fixation.x, y: fixation.y };
}

/**
 * Enumerate fixations whose start falls within [0, untilMs]. Pure; used by
 * distribution-property tests (dwell jitter, refractory floor, home weight,
 * large-saccade population) and by couplings that scan the schedule.
 */
export function enumerateFixations(
  seed: number,
  config: GazeBaselineConfig,
  untilMs: number
): readonly GazeFixation[] {
  const fixations: GazeFixation[] = [];
  let index = 0;
  let startMs = 0;
  let prevX = INITIAL_GAZE_CURSOR.prevX;
  let prevY = INITIAL_GAZE_CURSOR.prevY;

  for (let step = 0; step < 1_000_000; step += 1) {
    const fixation = makeFixation(seed, index, startMs, prevX, prevY, config);
    if (fixation.startMs > untilMs) {
      break;
    }
    fixations.push(fixation);
    startMs = fixation.endMs;
    prevX = fixation.x;
    prevY = fixation.y;
    index += 1;
  }

  return fixations;
}
