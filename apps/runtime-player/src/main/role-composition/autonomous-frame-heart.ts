import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import type { RuntimePlayerMappingSlot } from "../../preload/model-mapping-bridge-contract";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import { resolveSemanticSlotParameterValues } from "../live-mapping/headless-slot-resolver";
import type { RuntimePlayerLiveParameterBridgeRegistration } from "../live-parameter-bridge-handlers";
import {
  createPhysiologyGenerator,
  hashStringToSeed,
  type PhysiologyGenerator,
  type PhysiologyGeneratorConfig
} from "../physiology";

/**
 * Autonomous Host frame heart (C2 Domain C). A main-process 60Hz periodic timer
 * that is the SOLE frame source for the Autonomous Host — there is no tracking
 * input, so the generated body must beat on its own (裁定3).
 *
 * Each tick:
 *  1. reads the wall clock and converts it to logical time (loadedAt = epoch,
 *     t = 0). The heart owns the wall-clock → logical-time conversion; the
 *     physiology generator stays wall-clock-free (裁定2 の帰結). This module lives
 *     OUTSIDE physiology/ precisely so the wall clock is allowed here.
 *  2. samples the generator at that logical time → semantic-slot activations
 *     (slotId → 0..1, 0 = open / 1 = closed, both eyes equal; 裁定4/5).
 *  3. resolves the activations against the model's auto-mapping slots through the
 *     shared head-less resolver (身体の知識B lives there, not here).
 *  4. stamps a RuntimePlayerLiveParameterFrame with the loaded package identity, a
 *     strictly monotonic sequence, and a monotonic wall-clock timestamp, then
 *     publishes it through the same `liveParameters.publishFrame` seam the
 *     tracking path uses — so the Stage IPC / Browser Source sanitization
 *     boundary is preserved unchanged (only the frame crosses to renderers; seed
 *     and raw activations never leave this process).
 *
 * Timestamps and sequence are the heart's responsibility and sit OUTSIDE the
 * determinism boundary (裁定3/7 — wall clock OK). The generator's semantic-slot
 * sequence is what the Domain B fixtures pin deterministically.
 */

const DEFAULT_FRAME_INTERVAL_MS = 1000 / 60; // ≈16.67ms = 60Hz

export type AutonomousFrameHeartStartInput = {
  /** Loaded payload — its identity stamps every frame's `runtimeExport`. */
  readonly payload: RuntimeExportLoadedPayload;
  /** Auto-mapping slots (身体の知識B). Fed to the head-less resolver each tick. */
  readonly slots: readonly RuntimePlayerMappingSlot[];
  /** Session seed (user-non-exposed, decided by the composer). */
  readonly seed: number;
};

export type AutonomousFrameHeart = {
  /**
   * Begin beating for a freshly loaded body. Stops any prior heartbeat first so
   * a load→load never doubles the timer (no timer leak, no two frame sources).
   */
  readonly start: (input: AutonomousFrameHeartStartInput) => void;
  /** Stop beating and dispose the timer. Idempotent; safe to call when stopped. */
  readonly stop: () => void;
  readonly isRunning: () => boolean;
};

export type CreateAutonomousFrameHeartInput = {
  readonly liveParameters: Pick<
    RuntimePlayerLiveParameterBridgeRegistration,
    "publishFrame"
  >;
  /** Wall clock. Injectable for tests; defaults to Date.now (decision boundary外). */
  readonly now?: () => number;
  /** Timer scheduling seams. Default to the global timers (fake-timer friendly). */
  readonly setIntervalFn?: (
    handler: () => void,
    ms: number
  ) => ReturnType<typeof setInterval>;
  readonly clearIntervalFn?: (handle: ReturnType<typeof setInterval>) => void;
  readonly frameIntervalMs?: number;
  readonly createGenerator?: (
    config: PhysiologyGeneratorConfig
  ) => PhysiologyGenerator;
};

type Heartbeat = {
  readonly payload: RuntimeExportLoadedPayload;
  readonly slots: readonly RuntimePlayerMappingSlot[];
  readonly generator: PhysiologyGenerator;
  readonly epochMs: number;
};

export function createAutonomousFrameHeart(
  deps: CreateAutonomousFrameHeartInput
): AutonomousFrameHeart {
  const now = deps.now ?? Date.now;
  const setIntervalFn =
    deps.setIntervalFn ?? ((handler, ms) => setInterval(handler, ms));
  const clearIntervalFn =
    deps.clearIntervalFn ?? ((handle) => clearInterval(handle));
  const frameIntervalMs = deps.frameIntervalMs ?? DEFAULT_FRAME_INTERVAL_MS;
  const createGenerator = deps.createGenerator ?? createPhysiologyGenerator;

  let timer: ReturnType<typeof setInterval> | null = null;
  let heartbeat: Heartbeat | null = null;
  // Strictly monotonic across the heart's whole lifetime, never reset on
  // load→load, so the sequence downstream sees is always increasing.
  let sequence = 0;

  const tick = (): void => {
    if (heartbeat === null) {
      return;
    }

    const wallNowMs = now();
    // loadedAt = epoch (t = 0); clamp guards against a backward wall clock so
    // logical time never goes negative before the generator.
    const logicalTimeMs = Math.max(0, wallNowMs - heartbeat.epochMs);
    const activations = heartbeat.generator.sample(logicalTimeMs);
    const parameterValues = resolveSemanticSlotParameterValues({
      slots: heartbeat.slots,
      activations
    });

    sequence += 1;
    const frame: RuntimePlayerLiveParameterFrame = {
      schemaVersion: "runtime-player-live-parameter-frame-v1",
      runtimeExport: {
        packageId: heartbeat.payload.summary.packageId,
        packageRevision: heartbeat.payload.summary.packageRevision,
        loadedAtIso: heartbeat.payload.loadedAtIso
      },
      sequence,
      producedAtIso: new Date(wallNowMs).toISOString(),
      sourceFrameTimestampMs: wallNowMs,
      parameterValues
    };

    deps.liveParameters.publishFrame(frame);
  };

  const stop = (): void => {
    if (timer !== null) {
      clearIntervalFn(timer);
      timer = null;
    }
    heartbeat = null;
  };

  const start = (input: AutonomousFrameHeartStartInput): void => {
    // Dispose any prior heartbeat first: load→load must not leave the old timer
    // running (no leak, no two competing frame sources).
    stop();

    heartbeat = {
      payload: input.payload,
      slots: input.slots,
      generator: createGenerator({ seed: input.seed }),
      epochMs: now()
    };
    // The first frame arrives on the first interval tick (after this call
    // returns) — never synchronously here — so it lands AFTER the load handler's
    // clearLiveParameterFrame(), not before it.
    timer = setIntervalFn(tick, frameIntervalMs);
  };

  return {
    start,
    stop,
    isRunning: () => timer !== null
  };
}

/**
 * Derive the session seed for a loaded body. User-non-exposed (C2 §5), decided
 * here from the payload identity: same package + same load → same blink; each
 * fresh load (loadedAtIso advances) → its own individual rhythm. Deterministic
 * given the payload (so it is not a source of test non-determinism) and never
 * leaves the process — it is not written into any frame.
 */
export function deriveAutonomousSessionSeed(
  payload: RuntimeExportLoadedPayload
): number {
  return hashStringToSeed(
    `${payload.summary.packageId}:${payload.summary.packageRevision}:${payload.loadedAtIso}`
  );
}
