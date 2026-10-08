import { hashUnit } from "./deterministic-hash";

/**
 * Closed-form deterministic noise / home-spring primitives for the physiology
 * layer (C3 Domain A, design c3-gaze-head-posture.md §1.2 「ホームへのバネ付き
 * 滑らかな乱歩の層重ね」). These are the atomic素子 Domain B (gaze/head/posture)
 * composes into behaviors; Domain A ships only the primitives + their purity /
 * smoothness tests, not the behaviors themselves.
 *
 * Purity contract (identical to deterministic-hash.ts, blocking review观点 for
 * physiology/):
 *  - No Electron imports.
 *  - No wall clock (`Date.now`/`performance.now`/`new Date`).
 *  - No non-seeded randomness (`Math.random`, `crypto`).
 *  - Every value is a PURE FUNCTION of (seed, channel, logical time, params).
 *    Same logical time → same value; frame-rate independent.
 *
 * WHY closed-form instead of dt-integration (裁定1, inventory §2.1/§4-3):
 *  A spring-damped random walk is classically written as a stateful integrator
 *  (`v += (home - x) * k * dt; x += v * dt`), but that makes the output depend on
 *  the frame cadence — a non-pure function of time that breaks the C2 fixture
 *  discipline (seed+config+time → value must be pure). Instead we express the
 *  *already-integrated* walk directly as a function of time: smooth value noise.
 *  Interpolated value noise is inherently BOUNDED and MEAN-REVERTING (it always
 *  returns toward its mean), which is exactly the observable signature of a
 *  damped spring toward home — with no accumulated state. Multi-timescale
 *  layering (fBm) then pushes the composite period beyond the 30s ゲート window
 *  (design §1.2「ほぼ数学」).
 *
 * Lattice / interpolation choices (裁量, documented per task):
 *  - Integer time lattice of `cellMs` ms: `hashUnit` is drawn at the two bracket-
 *    ing lattice points and interpolated. Larger `cellMs` = slower layer. This
 *    reuses the established `hashUnit` seeded-noise flavor (no new randomness).
 *  - Quintic smootherstep (6t⁵−15t⁴+10t³) for interpolation rather than the
 *    cubic 3t²−2t³ used by the blink envelope: quintic has zero FIRST derivative
 *    at the lattice points, so the interpolated signal is C² — no velocity kink
 *    when crossing a cell boundary. For a bounded discrete envelope (blink) the
 *    cubic is fine; for a continuous "living" noise the extra continuity matters
 *    (avoids the「単一周波数」mechanical read at boundaries).
 */

/** Maximum slope of the quintic smootherstep weight (at t = 0.5): 15/8. */
export const SMOOTHERSTEP_MAX_SLOPE = 1.875;

/**
 * Value-noise span: a single octave ranges over [-1, 1], i.e. a span of 2. The
 * bounded adjacent-sample difference of one octave is therefore at most
 * `NOISE_SPAN * SMOOTHERSTEP_MAX_SLOPE * (dt / cellMs)` (span × max slope × the
 * fraction of a cell crossed). Exposed so smoothness tests assert against the
 * analytic bound rather than a magic number.
 */
export const NOISE_SPAN = 2;

/** Channel stride separating the decorrelated per-layer streams (a prime). */
const LAYER_CHANNEL_STRIDE = 977;

/** Quintic smootherstep on [0,1]; clamps outside. C² (zero 1st derivative at ends). */
function smootherstep(x: number): number {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * One octave of smooth value noise: a pure function of logical time in the range
 * [-1, 1], centered on 0 (its mean = home). The integer time lattice has cell
 * size `cellMs`; the two bracketing lattice samples (`hashUnit` mapped to
 * [-1,1]) are quintic-interpolated by the in-cell fraction.
 *
 * This is the closed-form "smooth random walk" layer: bounded (never escapes
 * [-1,1]) and mean-reverting (always drawn back toward 0), which is the damped-
 * spring signature — with no dt integration and no accumulated state.
 *
 * @param cellMs lattice cell size (ms). Larger = slower / lower-frequency layer.
 *               Must be > 0.
 */
export function smoothValueNoise(
  seed: number,
  channel: number,
  logicalTimeMs: number,
  cellMs: number
): number {
  const safeCellMs = cellMs > 0 ? cellMs : 1;
  const cell = logicalTimeMs / safeCellMs;
  const i0 = Math.floor(cell);
  const frac = cell - i0;
  const a = hashUnit(seed, i0, channel) * 2 - 1; // [-1, 1]
  const b = hashUnit(seed, i0 + 1, channel) * 2 - 1; // [-1, 1]
  return a + (b - a) * smootherstep(frac);
}

/** One timescale of a layered walk: a lattice cell size and a relative weight. */
export type NoiseLayer = {
  /** Lattice cell size (ms) = this octave's timescale. Larger = slower. */
  readonly cellMs: number;
  /** Relative amplitude weight. The output is normalized by the weight sum. */
  readonly amplitude: number;
};

/**
 * Multi-timescale (fractal) value noise: a normalized weighted sum of
 * {@link smoothValueNoise} octaves at different cell sizes. Each layer draws a
 * DECORRELATED stream (distinct channel), so a fast micro-jitter octave and a
 * slow drift octave never phase-lock. The weighted sum is divided by the total
 * weight, so the result stays in [-1, 1].
 *
 * This is design §1.2's「時間軸の違う層の重ね」: the composite period of octaves
 * whose cell sizes are non-commensurate is not detectable within a 30s window,
 * the machine-side proxy for「30秒眺めて機械のループに見えない」(裁定5).
 *
 * @param layers ordered octaves. An empty list returns 0 (flat = home).
 */
export function layeredValueNoise(
  seed: number,
  channel: number,
  logicalTimeMs: number,
  layers: readonly NoiseLayer[]
): number {
  let sum = 0;
  let weight = 0;
  for (let index = 0; index < layers.length; index += 1) {
    const layer = layers[index]!;
    const amplitude = Math.abs(layer.amplitude);
    if (amplitude === 0) {
      continue;
    }
    const layerChannel = channel * LAYER_CHANNEL_STRIDE + index;
    sum +=
      amplitude *
      smoothValueNoise(seed, layerChannel, logicalTimeMs, layer.cellMs);
    weight += amplitude;
  }
  return weight > 0 ? sum / weight : 0;
}

/** Parameters of a closed-form home-spring damped walk. */
export type HomeSpringParams = {
  /** The value the walk springs toward (its rest / home position). */
  readonly home: number;
  /** Maximum deviation from home (the reach of an excursion). */
  readonly amplitude: number;
  /** Multi-timescale octaves driving the deviation. */
  readonly layers: readonly NoiseLayer[];
  /**
   * Home concentration in [0, 1] (default 0 = none). Higher values bias the
   * value toward home so excursions become rarer punctuation rather than
   * constant sway — the antidote to anti-pattern 5「動きすぎ」(design §4-5,
   * 「静止に句読点が打たれる」). Implemented by raising the normalized deviation
   * to a signed power ≥ 1: it preserves the sign and the extremes (|dev|=1 maps
   * to full amplitude, dev=0 stays at home) while pulling every mid-range value
   * toward home — so |shaped| ≤ |dev| everywhere (it never amplifies). Rare full
   * excursions still reach the amplitude; typical motion hugs home. It stays C¹
   * and bounded, so smoothness is preserved.
   */
  readonly homePull?: number;
};

/** Extra exponent applied at homePull = 1 (deviation → sign·|dev|^(1+GAIN)). */
const SPRING_EXPONENT_GAIN = 2;

/**
 * Closed-form home-spring damped random walk evaluated purely from logical time:
 * `home + amplitude · shape(layeredValueNoise(...))`, where `shape` optionally
 * concentrates the deviation toward home (see {@link HomeSpringParams.homePull}).
 *
 * The bounded, mean-reverting layered value noise IS the damped spring in closed
 * form — there is no velocity/position state to integrate, so the result is a
 * pure function of time and frame-rate independent (裁定1). Domain B builds head
 * / posture behaviors on top of this; the amplitude and homePull map to the
 * exposed質感語 (Head: Sway / Posture: Drift and their restlessness), while the
 * octave ratios stay universal defaults (design §6).
 */
export function homeSpringValue(
  seed: number,
  channel: number,
  logicalTimeMs: number,
  params: HomeSpringParams
): number {
  const deviation = layeredValueNoise(
    seed,
    channel,
    logicalTimeMs,
    params.layers
  );
  const homePull = Math.min(Math.max(params.homePull ?? 0, 0), 1);
  const shaped =
    homePull > 0
      ? Math.sign(deviation) *
        Math.pow(Math.abs(deviation), 1 + SPRING_EXPONENT_GAIN * homePull)
      : deviation;
  return params.home + params.amplitude * shaped;
}
