import type { TrackingFrame } from "../../preload/input-tracking-frame-contract";
import type { RuntimePlayerInputSessionNeutralSnapshot } from "../../preload/input-profile-bridge-contract";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type { InputProfile } from "../input-profiles/input-profile-document";
import { registerInputBridgeHandlers as defaultRegisterInputBridgeHandlers } from "../input-bridge-handlers";
import { registerInputProfileBridgeHandlers as defaultRegisterInputProfileBridgeHandlers } from "../input-profile-bridge-handlers";
import { registerModelMappingBridgeHandlers as defaultRegisterModelMappingBridgeHandlers } from "../model-mapping-bridge-handlers";
import { createAutoMappingSlots } from "../live-mapping/runtime-export-auto-mapping";
import { RuntimePlayerControlChannelOverlayStore } from "../control-channel/control-channel-overlay-store";
import {
  createAutonomousFrameHeart as defaultCreateAutonomousFrameHeart,
  deriveAutonomousSessionSeed
} from "./autonomous-frame-heart";
import type { PhysiologyConfigProvider } from "../physiology";
import {
  deriveStagePresenceStageMotionSettings,
  type RuntimePlayerStageMotionDrive
} from "../presence/stage-presence-drive";
import type { RuntimePlayerBodyFollowState } from "../live-mapping/body-follow-state";
import type { RuntimePlayerVowelLipsyncState } from "../live-mapping/vowel-lipsync-estimator";
import type { RuntimePlayerLiveMappingState } from "../live-mapping/live-mapping-state";
import type { RuntimePlayerLiveParameterBridgeRegistration } from "../live-parameter-bridge-handlers";
import type { ModelMappingProfileStore } from "../model-mapping-profiles/model-mapping-profile-store";
import type { RuntimePlayerHostRole } from "../profile-slots/host-role";
import type { RuntimePlayerWindowSet } from "../window-management/runtime-player-windows";

/**
 * The seam the composition root wires the rest of the app to, regardless of
 * role. The Tracking Host builds the real input/tracking pipeline behind it; the
 * Autonomous Host builds an inert (static-display) implementation. Every method
 * the composition root needs from "the input side" lives here so there is a
 * single, role-selected object rather than scattered runtime `if (role === ...)`
 * checks.
 */
export type RuntimePlayerInputSubsystem = {
  /** Diagnostic marker only (never used to branch behaviour at runtime). */
  readonly usesTrackingInput: boolean;
  /**
   * Whether this subsystem DRIVES a physiology generator (C3 Domain C). DATA that
   * expresses「生理サブシステムの有無」— the Autonomous Host's frame heart drives
   * physiology (true); the Tracking Host has none (false). The composition root
   * hands this to the Physiology bridge so `getStatus` reports availability as data,
   * never a runtime `if (role === ...)`.
   */
  readonly providesPhysiology: boolean;
  readonly getLatestTrackingFrame: () => TrackingFrame | null;
  readonly getSessionNeutral: () => RuntimePlayerInputSessionNeutralSnapshot | null;
  readonly getActiveInputProfile: () => Promise<InputProfile | null>;
  /**
   * Stage Presence supply (C3 Domain D). The role difference is expressed HERE as a
   * subsystem seam (like `getLatestTrackingFrame`), never a runtime `if (role)`:
   *  - the Autonomous Host returns a drive (posture signal + settings derived from
   *    the Physiology `stagePresence` config) so posture nudges the Stage transform;
   *  - the Tracking Host returns null → the composition root keeps its existing
   *    tracking Stage Motion path untouched (既存挙動を一切変えない).
   * Returns null on the Autonomous Host too when no Physiology config provider is
   * wired (the `stagePresence` field is absent), so a composition without a
   * Physiology state stays inert exactly as before Domain D.
   */
  readonly getStageMotionDrive: () => RuntimePlayerStageMotionDrive | null;
  /**
   * The Control Channel overlay store (C4 Domain B), or null when this subsystem
   * has no channel. Channel is autonomous-host専有 (裁定2): the Autonomous Host
   * creates ONE store instance that is shared two ways —
   *  - the frame heart's `getChannelOverlay` provider READS `snapshot(nowMs)` each
   *    tick (wired here, Domain B), and
   *  - the Channel WS server WRITES it (`setOverlay` on accept, `clearAll` on
   *    disconnect), wired by Domain C's composition root, which obtains the same
   *    instance through this getter.
   * The Tracking Host returns null (no channel subsystem in its composition), so
   * the composition root never needs a runtime `if (role === ...)` — availability
   * is DATA, exactly like `providesPhysiology` / `getStageMotionDrive`.
   */
  readonly getControlChannelOverlayStore: () => RuntimePlayerControlChannelOverlayStore | null;
  readonly publishLatestParameterFrame: () => Promise<void>;
  readonly publishMappingStatus: () => void;
  readonly clearLiveParameterFrame: () => void;
  readonly setRuntimeExportPayload: (
    payload: RuntimeExportLoadedPayload
  ) => Promise<void>;
  readonly clearRuntimeExport: () => void;
  readonly flushPendingProfileSave: () => Promise<void>;
  readonly disconnect: () => Promise<unknown>;
};

/**
 * Everything both composers accept. The static composer ignores most of it; the
 * shared shape keeps the role -> composer table uniform.
 */
export type RuntimePlayerInputSubsystemDependencies = {
  readonly windows: RuntimePlayerWindowSet;
  readonly userDataPath: string;
  readonly liveMappingState: RuntimePlayerLiveMappingState;
  readonly bodyFollowState: RuntimePlayerBodyFollowState;
  readonly vowelLipsyncState: RuntimePlayerVowelLipsyncState;
  readonly modelMappingProfileStore: ModelMappingProfileStore;
  readonly liveParameters: RuntimePlayerLiveParameterBridgeRegistration;
  readonly resetStageMotion: () => void;
  readonly requestStageMotionRepublish: () => void;
  // Injection seams for tests (default to the real registrars).
  readonly registerInputBridgeHandlers?: typeof defaultRegisterInputBridgeHandlers;
  readonly registerInputProfileBridgeHandlers?: typeof defaultRegisterInputProfileBridgeHandlers;
  readonly registerModelMappingBridgeHandlers?: typeof defaultRegisterModelMappingBridgeHandlers;
  // Autonomous-only seam (the tracking composer ignores it): lets tests inject a
  // fake frame heart. Defaults to the real 60Hz heart.
  readonly createAutonomousFrameHeart?: typeof defaultCreateAutonomousFrameHeart;
  // ツマミ即時反映 config seam (裁定3). The持ち主 is the main-process Physiology
  // state (both roles共通); ONLY the autonomous composer wires it to the heart
  // (the tracking composer ignores it — role差は合成テーブルのこの1点のみ, no
  // runtime `if (role === ...)`). Optional: the heart defaults to the universal
  // config when absent, so a composition without a Physiology state (or every
  // existing test) behaves exactly as C2. Domain C supplies the real provider.
  readonly physiologyConfigProvider?: PhysiologyConfigProvider;
};

export type RuntimePlayerInputSubsystemComposer = (
  deps: RuntimePlayerInputSubsystemDependencies
) => RuntimePlayerInputSubsystem;

/**
 * Tracking Host: the current full input/tracking composition, moved verbatim
 * behind the subsystem seam. Builds the three input registrars (input,
 * input-profile, model-mapping) and exposes them through the shared interface.
 */
export const composeTrackingHostInputSubsystem: RuntimePlayerInputSubsystemComposer =
  (deps) => {
    const registerInput =
      deps.registerInputBridgeHandlers ?? defaultRegisterInputBridgeHandlers;
    const registerInputProfile =
      deps.registerInputProfileBridgeHandlers ??
      defaultRegisterInputProfileBridgeHandlers;
    const registerModelMapping =
      deps.registerModelMappingBridgeHandlers ??
      defaultRegisterModelMappingBridgeHandlers;

    // Local seams for the circular dependency: the input bridge's frame/reset
    // callbacks reference the model-mapping bridge that is built after it.
    let publishLatestParameterFrame = async (): Promise<void> => {};
    let clearLiveParameterFrame = (): void => {
      deps.liveParameters.clear();
    };

    const inputBridge = registerInput({
      windows: deps.windows,
      onTrackingFrame: () => publishLatestParameterFrame(),
      onInputReset: () => {
        deps.bodyFollowState.reset();
        deps.vowelLipsyncState.reset();
        deps.resetStageMotion();
        clearLiveParameterFrame();
      }
    });
    const inputProfileBridge = registerInputProfile({
      windows: deps.windows,
      inputState: inputBridge.state,
      userDataPath: deps.userDataPath,
      onProfileChanged: () => {
        deps.bodyFollowState.reset();
        deps.vowelLipsyncState.reset();
        deps.resetStageMotion();
        deps.requestStageMotionRepublish();
        return publishLatestParameterFrame();
      }
    });
    const modelMappingBridge = registerModelMapping({
      windows: deps.windows,
      inputState: inputBridge.state,
      mappingState: deps.liveMappingState,
      bodyFollowState: deps.bodyFollowState,
      vowelLipsyncState: deps.vowelLipsyncState,
      profileStore: deps.modelMappingProfileStore,
      liveParameters: deps.liveParameters,
      getActiveInputProfile: inputProfileBridge.getActiveInputProfile
    });
    publishLatestParameterFrame = modelMappingBridge.publishLatestParameterFrame;
    clearLiveParameterFrame = modelMappingBridge.clearLiveParameterFrame;

    return {
      usesTrackingInput: true,
      // The Tracking Host body is driven by tracking, not a physiology generator.
      providesPhysiology: false,
      getLatestTrackingFrame: () => inputBridge.state.getLatestTrackingFrame(),
      getSessionNeutral: () => inputBridge.state.getSessionNeutral(),
      getActiveInputProfile: inputProfileBridge.getActiveInputProfile,
      // The Tracking Host keeps its existing head-position Stage Motion path; it
      // never drives Stage Presence from posture (no physiology generator here).
      getStageMotionDrive: () => null,
      // Channel is autonomous-host専有 (裁定2): the tracking composition has no
      // Control Channel overlay store at all — no runtime `if (role === ...)`.
      getControlChannelOverlayStore: () => null,
      publishLatestParameterFrame: () => publishLatestParameterFrame(),
      publishMappingStatus: modelMappingBridge.publishStatus,
      clearLiveParameterFrame: () => clearLiveParameterFrame(),
      setRuntimeExportPayload: async (payload) => {
        await modelMappingBridge.setRuntimeExportPayload(payload);
      },
      clearRuntimeExport: () => {
        modelMappingBridge.clearRuntimeExport();
      },
      flushPendingProfileSave: () => modelMappingBridge.flushPendingProfileSave(),
      disconnect: () => inputBridge.disconnect()
    };
  };

/**
 * Autonomous Host: no input/tracking registrars at all — no UDP receiver, no
 * input IPC handlers, no model-mapping engine. Instead the body beats on its own
 * (C2 Domain C): a 60Hz frame heart drives the physiology generator through the
 * shared head-less resolver and publishes frames on the same
 * `liveParameters.publishFrame` seam the tracking path uses. The role difference
 * stays a single data-lookup choice (see the composer table below); there is no
 * runtime `if (role === ...)` branch anywhere.
 *
 * Lifecycle: `setRuntimeExportPayload` starts the heart (Runtime Export load =
 * heartbeat epoch); `clearRuntimeExport` (unload) and `disconnect` (quit) stop
 * it and dispose the timer, so no timer leaks and quit is never blocked. Because
 * the first frame only arrives on the first interval tick (never synchronously
 * in `start`), it lands after the load handler's `clearLiveParameterFrame()`.
 */
export const composeStaticInputSubsystem: RuntimePlayerInputSubsystemComposer = (
  deps
) => {
  const createHeart =
    deps.createAutonomousFrameHeart ?? defaultCreateAutonomousFrameHeart;
  // C4 Domain B: the ONE Control Channel overlay store for this composition
  // (channel = autonomous専有, 裁定2). It is shared two ways — the heart READS its
  // `snapshot(nowMs)` each tick through the `getChannelOverlay` provider below,
  // and Domain C's composition root obtains the SAME instance via
  // `getControlChannelOverlayStore()` to hand to the Channel WS server (which
  // WRITES setOverlay/clearAll). Starts empty, so until a channel accepts an
  // intent `snapshot` is `{}` and the heart's merge is byte-identical to the pure
  // C2/C3 activations.
  const controlChannelOverlayStore =
    new RuntimePlayerControlChannelOverlayStore();
  // Only the autonomous composer forwards the config provider to the heart. When
  // no provider is injected the heart falls back to the universal-default config
  // internally, so this stays a pure pass-through of the seam. The property is
  // omitted (not set to undefined) when absent for exactOptionalPropertyTypes.
  const heart = createHeart({
    liveParameters: deps.liveParameters,
    // 粗いオーバーレイ第二seam (Domain B): read the un-expired overlay values at the
    // WALL clock. The heart passes its own `wallNowMs` (absolute), matching the
    // absolute `expiresAtMs` the server stamps — never the generator's logical time.
    getChannelOverlay: (nowMs) => controlChannelOverlayStore.snapshot(nowMs),
    ...(deps.physiologyConfigProvider !== undefined
      ? { getPhysiologyConfig: deps.physiologyConfigProvider }
      : {})
  });

  return {
    usesTrackingInput: false,
    // The Autonomous Host's frame heart drives the physiology generator.
    providesPhysiology: true,
    getLatestTrackingFrame: () => null,
    getSessionNeutral: () => null,
    getActiveInputProfile: async () => null,
    // Stage Presence supply (C3 Domain D). Reads the current `stagePresence` config
    // (既定 Off) and the heart's latest posture signal, then derives Stage Motion
    // settings from strength (別意味論・別フィールド; never the window-state settings).
    // Absent config provider / stagePresence ⇒ null ⇒ Stage Motion stays inert.
    getStageMotionDrive: (): RuntimePlayerStageMotionDrive | null => {
      const stagePresence = deps.physiologyConfigProvider?.().stagePresence;
      if (stagePresence === undefined) {
        return null;
      }
      const signal = heart.getLatestStageMotionSignal();
      return {
        settings: deriveStagePresenceStageMotionSettings(stagePresence),
        horizontalInput: signal.horizontal,
        depthInput: signal.depth,
        timestampMs: signal.timestampMs
      };
    },
    // Domain C wires this store's setOverlay/clearAll to the Channel WS server;
    // the heart above already reads its snapshot each tick (same instance).
    getControlChannelOverlayStore: () => controlChannelOverlayStore,
    publishLatestParameterFrame: async () => {},
    publishMappingStatus: () => {},
    clearLiveParameterFrame: () => {
      deps.liveParameters.clear();
    },
    setRuntimeExportPayload: async (payload) => {
      heart.start({
        payload,
        slots: createAutoMappingSlots(payload),
        seed: deriveAutonomousSessionSeed(payload)
      });
    },
    clearRuntimeExport: () => {
      heart.stop();
    },
    flushPendingProfileSave: async () => {},
    disconnect: async () => {
      heart.stop();
    }
  };
};

/**
 * The single composition-root selection: role -> which registrar set to build.
 * A data lookup (like the role label table), so the role difference is expressed
 * once, here, and never re-tested at runtime.
 */
export const runtimePlayerInputSubsystemComposers: Record<
  RuntimePlayerHostRole,
  RuntimePlayerInputSubsystemComposer
> = {
  trackingHost: composeTrackingHostInputSubsystem,
  autonomousHost: composeStaticInputSubsystem
};

export function composeRuntimePlayerInputSubsystem(
  role: RuntimePlayerHostRole,
  deps: RuntimePlayerInputSubsystemDependencies
): RuntimePlayerInputSubsystem {
  return runtimePlayerInputSubsystemComposers[role](deps);
}
