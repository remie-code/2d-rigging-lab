import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import type { RuntimePlayerMappingSlot } from "../../preload/model-mapping-bridge-contract";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import { resolveSemanticSlotParameterValues } from "../live-mapping/headless-slot-resolver";
import type { RuntimePlayerLiveParameterBridgeRegistration } from "../live-parameter-bridge-handlers";
import {
  BODY_X_SLOT_ID,
  BODY_Z_SLOT_ID,
  createPhysiologyBehaviorsFromConfig,
  createPhysiologyGenerator,
  DEFAULT_PHYSIOLOGY_CONFIG,
  hashStringToSeed,
  type PhysiologyConfig,
  type PhysiologyConfigProvider,
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

/**
 * The latest posture signal for Stage Presence (C3 Domain D; C5 Domain C makes it
 * track the合成後 EFFECTIVE body signal, so a Channel curve on body-x/body-z moves the
 * Stage too — 体は一つ). body-x → horizontal, body-z → depth (both centered -1..1),
 * stamped with the sampling wall clock so the Stage Motion smoothing stays
 * frame-rate-independent. Each is null when the current config carries no posture
 * behavior AND no channel drives that slot (e.g. blink-only). Read by the subsystem's
 * `getStageMotionDrive` seam; NEVER leaves the process as a raw signal (only the
 * sanitized composed Stage transform crosses the Browser Source boundary).
 */
export type AutonomousStageMotionSignal = {
  readonly horizontal: number | null;
  readonly depth: number | null;
  readonly timestampMs: number;
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
  /**
   * The most recent posture activation as a Stage Presence signal (C3 Domain D; C5
   * Domain C: the合成後 EFFECTIVE body-x/body-z, channel curves included). Returns nulls
   * while stopped / before the first tick. This is a pure read of the last resolved
   * body-x/body-z — it never samples the generator or the clock itself.
   */
  readonly getLatestStageMotionSignal: () => AutonomousStageMotionSignal;
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
  /**
   * Reads the current physiology config each tick (ツマミ即時反映 seam, 裁定3).
   * The heart rebuilds its generator when this returns a NEW reference (config
   * changed), so a knob change reflects on the next tick. Phase discontinuity is
   * accepted (rebuild may make activity jump). Defaults to a provider returning
   * the universal-default config, so a caller that does not wire a Physiology
   * state (every existing test / the tracking composer) behaves exactly as C2.
   */
  readonly getPhysiologyConfig?: PhysiologyConfigProvider;
  /**
   * Reads the current Control Channel overlay each tick (粗いオーバーレイ seam,
   * 裁定1). A SECOND provider, PARALLEL to `getPhysiologyConfig` but a DIFFERENT
   * concern: it carries live value+TTL runtime state, not config, so it triggers
   * NO generator rebuild — it is merged over the sampled `activations` just
   * before the resolver (§6「有効な間チャネル値が生成器値を上書き、失効・切断で
   * 基底へ戻る」). It is queried with the WALL clock (`wallNowMs`, absolute
   * Date.now-space) — NOT the generator's epoch-relative `logicalTimeMs` — because
   * overlay TTLs are absolute wall-clock instants. Returns the un-expired
   * `slotId → value` Record, or `null` for「オーバーレイ無し」. Defaults to a
   * provider returning `null`, so every existing test / the tracking composer
   * behaves byte-identically to C2/C3 (the pure sample flows straight to the
   * resolver). The overlay never touches the generator `sample()` output — the
   * fixture-pinned determinism boundary stays clean.
   *
   * C5 Domain A: the provider also receives the two feedback signals the curve
   * store needs — `baseValues` (the PURE generator activations = the release TARGET
   * 「生きた基底」, 裁定2) and `prevResolved` (the previous tick's post-merge
   * resolvedActivations = case B's re-attack START source, 裁定1). A provider that
   * ignores them (every C2/C3/C4 test wiring `(nowMs) => store.snapshot(nowMs)`)
   * still type-checks and behaves as before.
   */
  readonly getChannelOverlay?: (
    nowMs: number,
    baseValues: Record<string, number>,
    prevResolved: Record<string, number>
  ) => Record<string, number> | null;
};

type Heartbeat = {
  readonly payload: RuntimeExportLoadedPayload;
  readonly slots: readonly RuntimePlayerMappingSlot[];
  /** Generator built from `config`; rebuilt in-place when `config` changes. */
  generator: PhysiologyGenerator;
  /** Reference-compared each tick to detect a config change (裁定3). */
  config: PhysiologyConfig;
  readonly seed: number;
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
  const getPhysiologyConfig =
    deps.getPhysiologyConfig ?? (() => DEFAULT_PHYSIOLOGY_CONFIG);
  // 粗いオーバーレイ (裁定1): defaults to「常にオーバーレイ無し」so the tracking
  // composer / every existing test flows the pure sample straight to the resolver.
  const getChannelOverlay = deps.getChannelOverlay ?? (() => null);

  const buildGenerator = (
    seed: number,
    config: PhysiologyConfig
  ): PhysiologyGenerator =>
    createGenerator({
      seed,
      behaviors: createPhysiologyBehaviorsFromConfig(config)
    });

  let timer: ReturnType<typeof setInterval> | null = null;
  let heartbeat: Heartbeat | null = null;
  // Strictly monotonic across the heart's whole lifetime, never reset on
  // load→load, so the sequence downstream sees is always increasing.
  let sequence = 0;
  // Latest posture signal for Stage Presence (C3 Domain D; input差し替え C5 Domain C).
  // Updated each tick from the effective (resolved) body-x/body-z — the合成後 value
  // AFTER the channel overlay merge, so a channel that drives body moves the stage too
  // (裁定1「体は一つ」). Cleared to nulls on start/stop so a fresh body (or a stopped
  // heart) never leaks a stale offset into the Stage transform.
  let latestStageMotionSignal: AutonomousStageMotionSignal = EMPTY_STAGE_MOTION_SIGNAL;
  // 案B (裁定1): the previous tick's post-merge resolvedActivations (合成後の真の実効値).
  // Retained as ONE record and fed back to the overlay curve store each tick so a new
  // intent's re-attack starts from the current effective value (連続性原則 3.1). Reset
  // on start/stop so a fresh body never re-attacks from a stale effective value.
  let lastResolvedActivations: Record<string, number> = {};

  const tick = (): void => {
    if (heartbeat === null) {
      return;
    }

    // ツマミ即時反映 (裁定3): re-read the config each tick; when the provider
    // hands back a NEW reference (a knob moved) rebuild the generator with the
    // same session seed so the next frame reflects the new config. A stable ref
    // (default provider / unchanged state) skips the rebuild — no per-tick cost,
    // no phase churn. A rebuild may make activity jump (phase discontinuity is
    // accepted). Same seed → same identity rhythm family.
    const config = getPhysiologyConfig();
    if (config !== heartbeat.config) {
      heartbeat.config = config;
      heartbeat.generator = buildGenerator(heartbeat.seed, config);
    }

    const wallNowMs = now();
    // loadedAt = epoch (t = 0); clamp guards against a backward wall clock so
    // logical time never goes negative before the generator.
    const logicalTimeMs = Math.max(0, wallNowMs - heartbeat.epochMs);
    const activations = heartbeat.generator.sample(logicalTimeMs);
    // C4 Domain B: merge the coarse Control Channel overlay just BEFORE the
    // resolver (裁定1 / §6). The overlay is queried with the WALL clock
    // (`wallNowMs`, absolute) — NOT `logicalTimeMs` (epoch-relative, the
    // generator's deterministic time) — because overlay TTLs are absolute
    // wall-clock instants the server stamped at acceptance. A live overlay
    // value overrides the generator activation for that slotId; on expiry /
    // disconnect the Record shrinks and the slot falls back to the生理 baseline
    // for free. The merge builds a NEW record so the pure `activations` sample
    // output is never mutated (fixture境界の外, 純度不変).
    // null (default provider) ⇒ the pure sample is passed straight through.
    // C5 Domain A: feed the curve store the PURE `activations` (release TARGET, 生きた
    // 基底, 裁定2) and the previous tick's `lastResolvedActivations` (case B re-attack
    // START, 裁定1). The merge seam itself is unchanged — a live curve value overrides
    // the generator activation for its slotId, and on full release the record shrinks
    // and the slot falls back to the生理 baseline for free.
    const overlay = getChannelOverlay(wallNowMs, activations, lastResolvedActivations);
    const resolvedActivations =
      overlay === null ? activations : { ...activations, ...overlay };
    // Retain the合成後 effective values for the NEXT tick's re-attack START (案B).
    lastResolvedActivations = resolvedActivations;
    // Snapshot the posture activation for Stage Presence (C5 Domain C, 裁定1「体は一つ」).
    // Reads the合成後 EFFECTIVE body signal (`resolvedActivations`) — NOT the pure
    // generator value — so whoever moves the body follows the画面: the生理 generator
    // OR a Control Channel curve on body-x/body-z (誰が体を動かしても画面はついてくる).
    // When no channel drives these slots (overlay === null, or no curve on body-*),
    // `resolvedActivations[BODY_*] === activations[BODY_*]`, so this is byte-identical
    // to C3 (無退行). body-x → horizontal, body-z → depth (centered -1..1); absent
    // (blink-only config) ⇒ null ⇒ no Stage offset. The strength convex-gain手当て
    // (`deriveStagePresenceStageMotionSettings`) is input-source-independent, so this
    // pure→effective swap does not reopen the二重適用 (§2.4).
    latestStageMotionSignal = {
      horizontal: readSignedActivation(resolvedActivations[BODY_X_SLOT_ID]),
      depth: readSignedActivation(resolvedActivations[BODY_Z_SLOT_ID]),
      timestampMs: wallNowMs
    };
    const parameterValues = resolveSemanticSlotParameterValues({
      slots: heartbeat.slots,
      activations: resolvedActivations
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
    latestStageMotionSignal = EMPTY_STAGE_MOTION_SIGNAL;
    lastResolvedActivations = {};
  };

  const start = (input: AutonomousFrameHeartStartInput): void => {
    // Dispose any prior heartbeat first: load→load must not leave the old timer
    // running (no leak, no two competing frame sources). stop() also clears the
    // Stage Presence signal so the new body starts from a neutral offset.
    stop();

    // Build the generator from the CURRENT physiology config (裁定3 / 柱3): blink
    // baseline now comes through the config path, not a hard-coded default. With
    // the default provider this is byte-identical to the C2 default blink (the
    // retirement gate), so the blink golden is unchanged.
    const config = getPhysiologyConfig();
    heartbeat = {
      payload: input.payload,
      slots: input.slots,
      generator: buildGenerator(input.seed, config),
      config,
      seed: input.seed,
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
    isRunning: () => timer !== null,
    getLatestStageMotionSignal: () => latestStageMotionSignal
  };
}

const EMPTY_STAGE_MOTION_SIGNAL: AutonomousStageMotionSignal = {
  horizontal: null,
  depth: null,
  timestampMs: 0
};

/** Read a centered signed activation, guarding absent / non-finite values → null. */
function readSignedActivation(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
