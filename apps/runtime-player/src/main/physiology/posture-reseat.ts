import { hashUnit } from "./deterministic-hash";

/**
 * Shared, pure posture RESEAT schedule (C3 Domain B, design §1.3「稀な組み替え
 * イベント」). Posture is two-storey: a constant slow drift (owned by the posture
 * behavior) PLUS a rare「座り直し」that moves the BASELINE itself to a new place
 * and stays there. The baseline move is what reads as「自分の意志で座っている」.
 *
 * This is a standalone module — NOT a behavior — because TWO parties consume the
 * exact same baseline (design §3-3「体は頭の親」): the posture behavior (its body
 * slots) and the head behavior (its home rides on the posture baseline). Sharing
 * one pure module keeps the hierarchy coherent with zero shared state.
 *
 * Body smoothness is CLOSED-FORM here (裁定2): the reseat transition is a
 * smootherstep RAMP over a fixed duration, a pure function of time — never the
 * stateful `body-follow-state` EMA (which would make the output non-pure and濁す
 * the fixture boundary). The rest position between reseats is piecewise-constant.
 *
 * Purity: hashUnit only — no wall clock, no Math.random, no Electron.
 */

// --- Exposed 質感語 → internal element (design §6) ---------------------------
export type PostureBaselineConfig = {
  /**
   * Posture: Drift (design §6) — amplitude of the constant slow重心ドリフト. The
   * reseat baseline amplitude scales with it too (a bigger mover reseats wider).
   */
  readonly drift: number;
  /**
   * Posture: Restlessness (design §6) — scales the reseat event FREQUENCY (a
   * fidgety body re-settles more often). Higher = more frequent「座り直し」.
   */
  readonly restlessness: number;
};

export const DEFAULT_POSTURE_BASELINE: PostureBaselineConfig = {
  drift: 0.5,
  restlessness: 0.4
};

// --- Universal internal constants (露出しない) -------------------------------
/** Mean gap between reseats at restlessness 0 (design §1.3「数分に一回オーダー」). */
const RESEAT_BASE_INTERVAL_MS = 150_000; // ~2.5 min
/** ばらつき on the reseat interval. */
const RESEAT_JITTER_RATIO = 0.5;
/** 最短不応期: a body never re-settles closer than this. */
const RESEAT_MIN_INTERVAL_MS = 40_000;
/** Closed-form transition duration of one「座り直し」(smootherstep ramp). */
const RESEAT_TRANSITION_MS = 1600;
/** Max reseat offset per axis at drift = 1 (small — 姿勢は控えめ). */
const RESEAT_AMPLITUDE = 0.5;

const CHANNEL_INTERVAL = 21;
const CHANNEL_TARGET_X = 22;
const CHANNEL_TARGET_Z = 23;

function symmetric(unit: number): number {
  return 2 * unit - 1;
}

function smootherstep(x: number): number {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** One reseat: at `startMs` the baseline begins ramping toward (targetX, targetZ). */
export type ReseatEvent = {
  readonly index: number;
  readonly startMs: number;
  readonly targetX: number;
  readonly targetZ: number;
};

function reseatInterval(
  seed: number,
  index: number,
  config: PostureBaselineConfig
): number {
  const restlessness = Math.max(0, config.restlessness);
  const mean = Math.max(
    RESEAT_MIN_INTERVAL_MS,
    RESEAT_BASE_INTERVAL_MS / (1 + restlessness)
  );
  const unit = hashUnit(seed, index, CHANNEL_INTERVAL);
  const raw = mean * (1 + RESEAT_JITTER_RATIO * symmetric(unit));
  return Math.max(RESEAT_MIN_INTERVAL_MS, raw);
}

function reseatTarget(
  seed: number,
  index: number,
  config: PostureBaselineConfig
): { x: number; z: number } {
  const amp = RESEAT_AMPLITUDE * Math.max(0, config.drift);
  return {
    x: amp * symmetric(hashUnit(seed, index, CHANNEL_TARGET_X)),
    z: amp * symmetric(hashUnit(seed, index, CHANNEL_TARGET_Z))
  };
}

/**
 * Forward-only cursor: pure state after all reseats strictly before `nextIndex`
 * have begun. `restX/restZ` is the target the body is resting at going in.
 */
export type ReseatCursor = {
  readonly nextIndex: number;
  readonly nextStartMs: number;
  readonly restX: number;
  readonly restZ: number;
};

export const INITIAL_RESEAT_CURSOR: ReseatCursor = {
  nextIndex: 0,
  // Sentinel: 0 means「reseat 0's start not yet computed」(the only time index 0
  // pairs with startMs 0). walkReseatTo resolves it to S₀ = interval(0) on entry.
  nextStartMs: 0,
  restX: 0,
  restZ: 0
};

/**
 * The posture BASELINE (reseat component only, no drift) at a logical time. The
 * body rests at the current segment's target; within `RESEAT_TRANSITION_MS` of a
 * reseat it smootherstep-ramps from the previous target — a closed-form「座り直し」
 * movement (裁定2, no EMA state). Pure: same (seed, config, time) → same value.
 *
 * Timing model (identical to enumerateReseats): reseat i starts at
 * Sᵢ = Σₖ₌₀ⁱ interval(k); its ramp occupies [Sᵢ, Sᵢ + RESEAT_TRANSITION_MS].
 * Since the min interval (40s) ≫ the transition (1.6s), ramps never overlap.
 */
export function walkReseatTo(
  seed: number,
  config: PostureBaselineConfig,
  cursor: ReseatCursor,
  logicalTimeMs: number
): { x: number; z: number; cursor: ReseatCursor } {
  let index = cursor.nextIndex;
  let startMs =
    cursor.nextIndex === 0 && cursor.nextStartMs === 0
      ? reseatInterval(seed, 0, config) // resolve S₀ from the sentinel
      : cursor.nextStartMs;
  let restX = cursor.restX;
  let restZ = cursor.restZ;

  for (let step = 0; step < 1_000_000; step += 1) {
    if (logicalTimeMs < startMs) {
      // Before reseat `index` begins: resting at the previous baseline.
      return { x: restX, z: restZ, cursor: { nextIndex: index, nextStartMs: startMs, restX, restZ } };
    }

    const target = reseatTarget(seed, index, config);
    const rampEnd = startMs + RESEAT_TRANSITION_MS;
    if (logicalTimeMs < rampEnd) {
      // Inside this reseat's closed-form ramp: blend prev rest → this target.
      const t = smootherstep((logicalTimeMs - startMs) / RESEAT_TRANSITION_MS);
      return {
        x: restX + (target.x - restX) * t,
        z: restZ + (target.z - restZ) * t,
        // Do NOT advance past an in-progress ramp (so re-query is stable).
        cursor: { nextIndex: index, nextStartMs: startMs, restX, restZ }
      };
    }

    // This reseat completed: it is now the resting baseline; advance to Sᵢ₊₁.
    restX = target.x;
    restZ = target.z;
    index += 1;
    startMs += reseatInterval(seed, index, config);
  }

  return { x: restX, z: restZ, cursor: { nextIndex: index, nextStartMs: startMs, restX, restZ } };
}

/** From-epoch reseat baseline. Pure. */
export function sampleReseatBaseline(
  seed: number,
  config: PostureBaselineConfig,
  logicalTimeMs: number
): { x: number; z: number } {
  const walk = walkReseatTo(seed, config, INITIAL_RESEAT_CURSOR, logicalTimeMs);
  return { x: walk.x, z: walk.z };
}

/**
 * Enumerate reseat events whose start falls within [0, untilMs]. Pure; used by
 * distribution-property tests (reseat frequency, refractory floor).
 */
export function enumerateReseats(
  seed: number,
  config: PostureBaselineConfig,
  untilMs: number
): readonly ReseatEvent[] {
  const events: ReseatEvent[] = [];
  let index = 0;
  let startMs = reseatInterval(seed, 0, config);

  for (let step = 0; step < 1_000_000; step += 1) {
    if (startMs > untilMs) {
      break;
    }
    const target = reseatTarget(seed, index, config);
    events.push({ index, startMs, targetX: target.x, targetZ: target.z });
    index += 1;
    startMs += reseatInterval(seed, index, config);
  }

  return events;
}
