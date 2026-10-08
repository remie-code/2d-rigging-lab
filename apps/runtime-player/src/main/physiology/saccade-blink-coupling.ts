import type {
  BehaviorSampleInput,
  PhysiologyBehavior,
  SemanticSlotActivationContribution
} from "./behavior-class";
import {
  BLINK_LEFT_SLOT_ID,
  BLINK_RIGHT_SLOT_ID,
  blinkEnvelope,
  type BlinkEvent
} from "./blink-behavior";
import { deriveBehaviorSeed, hashUnit } from "./deterministic-hash";
import { GAZE_BEHAVIOR_ID } from "./gaze-behavior";
import {
  INITIAL_GAZE_CURSOR,
  stepFixation,
  type GazeBaselineConfig,
  type GazeWalkCursor
} from "./gaze-saccade";

/**
 * Saccade-blink coupling (C3 Domain B, coupling 2「大きな視線移動に瞬きが乗る」,
 * design §3-2 / C2 §6.2「連動カップリング」as reserved there). A separate behavior —
 * NOT a change to the golden-locked blink core — that recomputes the SAME gaze
 * saccade schedule (via the shared coupling seed → gaze sub-seed) and, at each LARGE
 * saccade, PROBABILISTICALLY emits a synced blink on the two eye slots.
 *
 * WHY a separate behavior + the generator's max-on-collision merge, rather than
 * editing blink-behavior.ts:
 *  - The blink pure core (sampleBlinkActivation / walkBlinkTo / its event schedule)
 *    stays byte-identical, so the blink golden 2本 and the retirement gate are
 *    untouched — the safest possible treatment of the C2 asset.
 *  - Layering: cross-domain knowledge (gaze → blink) lives in this explicit coupling
 *    module, not inside the base blink module (which must not know about gaze).
 *  - Semantics: a synced blink is a UNION with the natural blink; the generator
 *    keeps the larger-magnitude contribution on the eye slots (max), so a synced
 *    blink can only deepen — never truncate — a coincident natural blink.
 *
 * The default physiology config carries no gaze, so this behavior is only fanned out
 * WITH gaze present; the pure blink path (Domain A default) never sees it.
 *
 * Determinism/purity: pure function of (seed, couplingSeed, gaze config, time); the
 * cursor + recent-synced-blink ring are a forward-only memo equal to a from-epoch
 * evaluation. hashUnit only — no wall clock, no Math.random, no Electron.
 */

export const SACCADE_BLINK_BEHAVIOR_ID = "saccade-blink-sync";

/** Probability a large saccade drags a blink with it (universal, 露出しない §6). */
const SACCADE_BLINK_PROBABILITY = 0.3;
/** Synced blink envelope shape (universal; a touch snappier than a natural blink). */
const SYNCED_CLOSE_MS = 90;
const SYNCED_HOLD_MS = 30;
const SYNCED_OPEN_MS = 200;
const SYNCED_DEPTH = 1;
const SYNCED_SPAN_MS = SYNCED_CLOSE_MS + SYNCED_HOLD_MS + SYNCED_OPEN_MS;
/** Retain a few recent synced blinks (envelopes are short ~320ms). */
const SYNC_RING = 8;

const CHANNEL_SYNC_GATE = 61;

/** Build the synthetic blink event for a synced blink starting at `startMs`. */
function syncedEvent(startMs: number): BlinkEvent {
  return {
    index: 0,
    isSecondOfPair: false,
    startMs,
    closeDurationMs: SYNCED_CLOSE_MS,
    holdDurationMs: SYNCED_HOLD_MS,
    openDurationMs: SYNCED_OPEN_MS,
    depth: SYNCED_DEPTH,
    endMs: startMs + SYNCED_SPAN_MS
  };
}

export function createSaccadeBlinkCoupling(
  gazeConfig: GazeBaselineConfig
): PhysiologyBehavior {
  let gazeCursor: GazeWalkCursor = INITIAL_GAZE_CURSOR;
  let syncRing: number[] = []; // start times of recent synced blinks
  let lastTimeMs = Number.NEGATIVE_INFINITY;
  let lastCouplingSeed: number | undefined;

  const resetMemo = (): void => {
    gazeCursor = INITIAL_GAZE_CURSOR;
    syncRing = [];
  };

  const advanceSyncRing = (gazeSeed: number, ownSeed: number, t: number): void => {
    for (let guard = 0; guard < 1_000_000; guard += 1) {
      const step = stepFixation(gazeSeed, gazeConfig, gazeCursor);
      if (step.fixation.startMs > t) {
        break;
      }
      if (
        step.fixation.isLarge &&
        hashUnit(ownSeed, step.fixation.index, CHANNEL_SYNC_GATE) <
          SACCADE_BLINK_PROBABILITY
      ) {
        syncRing.push(step.fixation.startMs);
        if (syncRing.length > SYNC_RING) {
          syncRing.shift();
        }
      }
      gazeCursor = step.next;
    }
  };

  const activationAt = (t: number): number => {
    let value = 0;
    for (const startMs of syncRing) {
      if (t >= startMs && t < startMs + SYNCED_SPAN_MS) {
        value = Math.max(value, blinkEnvelope(syncedEvent(startMs), t - startMs));
      }
    }
    return value;
  };

  return {
    behaviorId: SACCADE_BLINK_BEHAVIOR_ID,
    slotIds: [BLINK_LEFT_SLOT_ID, BLINK_RIGHT_SLOT_ID],
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

      if (input.couplingSeed === undefined) {
        // No coupling seed → cannot reference the gaze schedule; contribute nothing.
        return {};
      }

      const gazeSeed = deriveBehaviorSeed(input.couplingSeed, GAZE_BEHAVIOR_ID);
      advanceSyncRing(gazeSeed, input.seed, t);
      const activation = activationAt(t);
      return {
        [BLINK_LEFT_SLOT_ID]: activation,
        [BLINK_RIGHT_SLOT_ID]: activation
      };
    }
  };
}
