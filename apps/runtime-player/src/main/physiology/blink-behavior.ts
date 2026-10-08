import type {
  BehaviorSampleInput,
  PhysiologyBehavior,
  SemanticSlotActivationContribution
} from "./behavior-class";
import { hashUnit } from "./deterministic-hash";

/**
 * Blink behavior class (C2 Domain B). Owns 振る舞いの知識A only and emits blink
 * activation on the two blink SEMANTIC slots. Fully deterministic: the core is a
 * pure function of (seed, config, logical time). No wall clock, no Math.random —
 * all variability is derived from the seed via {@link hashUnit}.
 *
 * Design: c2-blink-and-generator-skeleton.md §6.1 (internal 6-element schema) /
 * §6.4 (baseline × modulation, C2 modulation = identity) / §6.2 (left/right
 * fixed together, easing curve not exposed).
 */

// --- Semantic slot ids (the ①/② boundary vocabulary) -----------------------
// These are SEMANTIC slot ids and MUST match live-mapping/semantic-slot-
// definitions.ts (`eye-blink-left` / `eye-blink-right`). They are duplicated as
// local constants (rather than imported) to keep physiology/ decoupled from the
// live-mapping module graph; a test asserts they stay in sync.
export const BLINK_LEFT_SLOT_ID = "eye-blink-left";
export const BLINK_RIGHT_SLOT_ID = "eye-blink-right";

export const BLINK_BEHAVIOR_ID = "blink";

// --- Internal schema: 6 conceptual knobs (§6.1) ----------------------------
// Each knob is a BASELINE value (§6.4). The universal defaults below are the C2
// "普遍既定値" — human-plausible, no UI, no seed exposure.
export type BlinkBaselineConfig = {
  /** 平均頻度: mean interval between blinks (ms). 17/min ≈ 3529ms. */
  readonly meanBlinkIntervalMs: number;
  /** 間隔のばらつき: symmetric jitter as a fraction of the mean interval. */
  readonly intervalJitterRatio: number;
  /** 最短不応期間: hard floor on the gap between separate blinks (ms). */
  readonly minRefractoryMs: number;
  /** 二連瞬きの確率: probability a blink is followed by a paired "ぱちぱち". */
  readonly doubleBlinkProbability: number;
  /** 閉じる速さ: close-phase duration (ms). Fast (~100ms). */
  readonly closeDurationMs: number;
  /** 開く速さ: open-phase duration (ms). Slow (~150-300ms). Asymmetric. */
  readonly openDurationMs: number;
  /** 閉じ切りの保持時間: fully-closed hold (ms). */
  readonly holdDurationMs: number;
  /** 閉じの深さ: peak closure (1 = full close basic). */
  readonly closeDepth: number;
};

/**
 * Modulation layer (§6.4). Every knob is scaled multiplicatively over its
 * baseline. C2 supplies the identity (all 1) so effective = baseline; C5's 魂の
 * 変調 grafts on by supplying non-identity multipliers — no structural change.
 */
export type BlinkModulation = {
  /** frequency ×: effective interval = baseline / rateMultiplier. */
  readonly rateMultiplier: number;
  readonly jitterMultiplier: number;
  readonly doubleBlinkMultiplier: number;
  readonly closeDurationMultiplier: number;
  readonly openDurationMultiplier: number;
  readonly holdDurationMultiplier: number;
  readonly depthMultiplier: number;
};

export type BlinkConfig = {
  readonly baseline: BlinkBaselineConfig;
  readonly modulation: BlinkModulation;
};

/** 普遍既定値 (§2, §6.1): human-plausible universal defaults. */
export const DEFAULT_BLINK_BASELINE: BlinkBaselineConfig = {
  meanBlinkIntervalMs: 3529, // ≈ 17 blinks / minute
  intervalJitterRatio: 0.55, // 等間隔=即死体。生死の分かれ目 (§6.1)
  minRefractoryMs: 900,
  doubleBlinkProbability: 0.12,
  closeDurationMs: 100, // 素早く閉じ (§6.1)
  openDurationMs: 220, // ゆっくり開く (§6.1)
  holdDurationMs: 40,
  closeDepth: 1 // 全閉が基本 (§6.1)
};

/** C2 modulation = 恒等 (§6.4). */
export const IDENTITY_BLINK_MODULATION: BlinkModulation = {
  rateMultiplier: 1,
  jitterMultiplier: 1,
  doubleBlinkMultiplier: 1,
  closeDurationMultiplier: 1,
  openDurationMultiplier: 1,
  holdDurationMultiplier: 1,
  depthMultiplier: 1
};

export const DEFAULT_BLINK_CONFIG: BlinkConfig = {
  baseline: DEFAULT_BLINK_BASELINE,
  modulation: IDENTITY_BLINK_MODULATION
};

// --- Internal (non-knob) constants: §6.2 "露出しない" ------------------------
// The intra-pair gap ("ぱちぱち" spacing) and per-blink shape jitter are not part
// of the exposed 6-element schema; they are universal internal detail like the
// easing curve.
const INTRA_PAIR_GAP_MIN_MS = 60;
const INTRA_PAIR_GAP_SPAN_MS = 70;
const SHAPE_JITTER_RATIO = 0.15;

// hashUnit channel discriminators (keep distinct per drawn quantity).
const CHANNEL_INTERVAL = 1;
const CHANNEL_DOUBLE = 2;
const CHANNEL_INTRA_GAP = 3;
const CHANNEL_CLOSE = 4;
const CHANNEL_OPEN = 5;

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/** Effective per-quantity values after applying modulation over the baseline. */
type EffectiveBlink = {
  readonly meanIntervalMs: number;
  readonly jitterRatio: number;
  readonly minRefractoryMs: number;
  readonly doubleProbability: number;
  readonly closeDurationMs: number;
  readonly openDurationMs: number;
  readonly holdDurationMs: number;
  readonly depth: number;
};

export function resolveEffectiveBlink(config: BlinkConfig): EffectiveBlink {
  const { baseline: b, modulation: m } = config;
  const rate = m.rateMultiplier > 0 ? m.rateMultiplier : 1;
  return {
    meanIntervalMs: Math.max(1, b.meanBlinkIntervalMs / rate),
    jitterRatio: Math.max(0, b.intervalJitterRatio * m.jitterMultiplier),
    minRefractoryMs: Math.max(0, b.minRefractoryMs),
    doubleProbability: clamp01(b.doubleBlinkProbability * m.doubleBlinkMultiplier),
    closeDurationMs: Math.max(1, b.closeDurationMs * m.closeDurationMultiplier),
    openDurationMs: Math.max(1, b.openDurationMs * m.openDurationMultiplier),
    holdDurationMs: Math.max(0, b.holdDurationMs * m.holdDurationMultiplier),
    depth: clamp01(b.closeDepth * m.depthMultiplier)
  };
}

/** One scheduled blink (a single close→hold→open). */
export type BlinkEvent = {
  readonly index: number;
  /** Second blink of a "ぱちぱち" pair (short intra-pair gap, not refractory). */
  readonly isSecondOfPair: boolean;
  readonly startMs: number;
  readonly closeDurationMs: number;
  readonly holdDurationMs: number;
  readonly openDurationMs: number;
  readonly depth: number;
  /** Absolute end time (fully open again). */
  readonly endMs: number;
};

function symmetricJitter(unit: number): number {
  return 2 * unit - 1; // [-1, 1]
}

/** Gap from the previous blink's end to this blink's start. */
function intervalBeforeEvent(
  seed: number,
  index: number,
  isSecondOfPair: boolean,
  eff: EffectiveBlink
): number {
  if (isSecondOfPair) {
    const gapUnit = hashUnit(seed, index, CHANNEL_INTRA_GAP);
    return INTRA_PAIR_GAP_MIN_MS + gapUnit * INTRA_PAIR_GAP_SPAN_MS;
  }

  const unit = hashUnit(seed, index, CHANNEL_INTERVAL);
  const raw = eff.meanIntervalMs * (1 + eff.jitterRatio * symmetricJitter(unit));
  // 最短不応期: separate blinks never start closer than the refractory floor.
  return Math.max(eff.minRefractoryMs, raw);
}

function blinkShape(
  seed: number,
  index: number,
  eff: EffectiveBlink
): { closeDurationMs: number; holdDurationMs: number; openDurationMs: number; depth: number } {
  const closeJitter = symmetricJitter(hashUnit(seed, index, CHANNEL_CLOSE));
  const openJitter = symmetricJitter(hashUnit(seed, index, CHANNEL_OPEN));
  return {
    closeDurationMs: Math.max(
      1,
      eff.closeDurationMs * (1 + SHAPE_JITTER_RATIO * closeJitter)
    ),
    openDurationMs: Math.max(
      1,
      eff.openDurationMs * (1 + SHAPE_JITTER_RATIO * openJitter)
    ),
    holdDurationMs: eff.holdDurationMs,
    depth: eff.depth
  };
}

function whetherDouble(seed: number, index: number, eff: EffectiveBlink): boolean {
  return hashUnit(seed, index, CHANNEL_DOUBLE) < eff.doubleProbability;
}

function smoothstep(x: number): number {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
}

/** Envelope value at `elapsedMs` into a blink event. Peak = depth. */
export function blinkEnvelope(event: BlinkEvent, elapsedMs: number): number {
  if (elapsedMs <= 0 || elapsedMs >= event.endMs - event.startMs) {
    return 0;
  }

  if (elapsedMs < event.closeDurationMs) {
    return event.depth * smoothstep(elapsedMs / event.closeDurationMs);
  }

  const afterClose = elapsedMs - event.closeDurationMs;
  if (afterClose < event.holdDurationMs) {
    return event.depth;
  }

  const afterHold = afterClose - event.holdDurationMs;
  return event.depth * (1 - smoothstep(afterHold / event.openDurationMs));
}

/**
 * Forward-only walk cursor: the pure state after all events strictly before
 * `nextEventIndex` have fully completed. Threading this across monotonically
 * increasing logical times bounds per-frame cost to O(1) amortized while
 * remaining a faithful memo of a from-epoch walk.
 */
export type BlinkWalkCursor = {
  readonly nextEventIndex: number;
  /** Time at which the eyes last became free (previous blink end, or 0). */
  readonly freeTimeMs: number;
  /** Whether `nextEventIndex` is the second of a pair. */
  readonly nextIsSecondOfPair: boolean;
};

export const INITIAL_BLINK_CURSOR: BlinkWalkCursor = {
  nextEventIndex: 0,
  freeTimeMs: 0,
  nextIsSecondOfPair: false
};

function makeEvent(
  seed: number,
  index: number,
  isSecondOfPair: boolean,
  freeTimeMs: number,
  eff: EffectiveBlink
): BlinkEvent {
  const startMs = freeTimeMs + intervalBeforeEvent(seed, index, isSecondOfPair, eff);
  const shape = blinkShape(seed, index, eff);
  const endMs =
    startMs + shape.closeDurationMs + shape.holdDurationMs + shape.openDurationMs;
  return {
    index,
    isSecondOfPair,
    startMs,
    closeDurationMs: shape.closeDurationMs,
    holdDurationMs: shape.holdDurationMs,
    openDurationMs: shape.openDurationMs,
    depth: shape.depth,
    endMs
  };
}

/**
 * Pure reducer: advance from `cursor` to `logicalTimeMs`, returning the blink
 * activation at that time plus the updated cursor. The cursor only advances past
 * events that have fully completed (end < time), so re-querying the same time
 * with the returned cursor yields the same activation.
 */
export function walkBlinkTo(
  seed: number,
  config: BlinkConfig,
  cursor: BlinkWalkCursor,
  logicalTimeMs: number
): { activation: number; cursor: BlinkWalkCursor } {
  const eff = resolveEffectiveBlink(config);
  let index = cursor.nextEventIndex;
  let freeTimeMs = cursor.freeTimeMs;
  let isSecondOfPair = cursor.nextIsSecondOfPair;

  // Bounded loop guard: an event always spans > 0 ms and intervals are >= 0, so
  // this terminates once an event starts after `logicalTimeMs`. The guard only
  // protects against a pathological config (never expected).
  for (let step = 0; step < 1_000_000; step += 1) {
    const event = makeEvent(seed, index, isSecondOfPair, freeTimeMs, eff);

    if (event.startMs > logicalTimeMs) {
      // In the open gap before this event. Cursor unchanged (event not started).
      return {
        activation: 0,
        cursor: { nextEventIndex: index, freeTimeMs, nextIsSecondOfPair: isSecondOfPair }
      };
    }

    if (logicalTimeMs < event.endMs) {
      // Inside this blink's window. Do NOT advance past it.
      return {
        activation: blinkEnvelope(event, logicalTimeMs - event.startMs),
        cursor: { nextEventIndex: index, freeTimeMs, nextIsSecondOfPair: isSecondOfPair }
      };
    }

    // Event fully completed before `logicalTimeMs`: advance.
    const spawnsDouble: boolean = !isSecondOfPair && whetherDouble(seed, index, eff);
    freeTimeMs = event.endMs;
    index += 1;
    isSecondOfPair = spawnsDouble;
  }

  return {
    activation: 0,
    cursor: { nextEventIndex: index, freeTimeMs, nextIsSecondOfPair: isSecondOfPair }
  };
}

/**
 * THE pure core (裁定3): seed + config + logical time → blink activation in
 * [0, 1] (0 = open, 1 = closed). Walks from the epoch each call. Same
 * (seed, config, time) → same activation. Fixtures assert this directly.
 */
export function sampleBlinkActivation(
  seed: number,
  config: BlinkConfig,
  logicalTimeMs: number
): number {
  return walkBlinkTo(seed, config, INITIAL_BLINK_CURSOR, logicalTimeMs).activation;
}

/**
 * Enumerate blink events whose start falls within [0, untilMs]. Pure; used by
 * distribution-property tests (refractory, double-blink rate, asymmetry).
 */
export function enumerateBlinkEvents(
  seed: number,
  config: BlinkConfig,
  untilMs: number
): readonly BlinkEvent[] {
  const eff = resolveEffectiveBlink(config);
  const events: BlinkEvent[] = [];
  let index = 0;
  let freeTimeMs = 0;
  let isSecondOfPair: boolean = false;

  for (let step = 0; step < 1_000_000; step += 1) {
    const event = makeEvent(seed, index, isSecondOfPair, freeTimeMs, eff);
    if (event.startMs > untilMs) {
      break;
    }
    events.push(event);
    const spawnsDouble: boolean = !isSecondOfPair && whetherDouble(seed, index, eff);
    freeTimeMs = event.endMs;
    index += 1;
    isSecondOfPair = spawnsDouble;
  }

  return events;
}

/**
 * Blink behavior class. Wraps the pure core; holds a forward-only cursor as a
 * performance memo (identical results to {@link sampleBlinkActivation}, asserted
 * by the cursor-equivalence test). Emits the SAME activation on both blink slots
 * (裁定4 左右同値).
 */
export function createBlinkBehavior(
  config: BlinkConfig = DEFAULT_BLINK_CONFIG
): PhysiologyBehavior {
  let cursor = INITIAL_BLINK_CURSOR;
  let lastTimeMs = Number.NEGATIVE_INFINITY;

  return {
    behaviorId: BLINK_BEHAVIOR_ID,
    slotIds: [BLINK_LEFT_SLOT_ID, BLINK_RIGHT_SLOT_ID],
    sample(input: BehaviorSampleInput): SemanticSlotActivationContribution {
      // Forward-only memo: rewind if time goes backward so the result always
      // equals a from-epoch evaluation.
      if (input.logicalTimeMs < lastTimeMs) {
        cursor = INITIAL_BLINK_CURSOR;
      }
      lastTimeMs = input.logicalTimeMs;

      const result = walkBlinkTo(input.seed, config, cursor, input.logicalTimeMs);
      cursor = result.cursor;

      return {
        [BLINK_LEFT_SLOT_ID]: result.activation,
        [BLINK_RIGHT_SLOT_ID]: result.activation
      };
    }
  };
}
