import type { TrackingFrame } from "../../preload/input-tracking-frame-contract";
import type { RuntimePlayerInputSessionNeutralSnapshot } from "../../preload/input-profile-bridge-contract";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type { InputProfile } from "../input-profiles/input-profile-document";
import { registerInputBridgeHandlers as defaultRegisterInputBridgeHandlers } from "../input-bridge-handlers";
import { registerInputProfileBridgeHandlers as defaultRegisterInputProfileBridgeHandlers } from "../input-profile-bridge-handlers";
import { registerModelMappingBridgeHandlers as defaultRegisterModelMappingBridgeHandlers } from "../model-mapping-bridge-handlers";
import { createAutoMappingSlots } from "../live-mapping/runtime-export-auto-mapping";
import {
  createAutonomousFrameHeart as defaultCreateAutonomousFrameHeart,
  deriveAutonomousSessionSeed
} from "./autonomous-frame-heart";
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
  readonly getLatestTrackingFrame: () => TrackingFrame | null;
  readonly getSessionNeutral: () => RuntimePlayerInputSessionNeutralSnapshot | null;
  readonly getActiveInputProfile: () => Promise<InputProfile | null>;
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
      getLatestTrackingFrame: () => inputBridge.state.getLatestTrackingFrame(),
      getSessionNeutral: () => inputBridge.state.getSessionNeutral(),
      getActiveInputProfile: inputProfileBridge.getActiveInputProfile,
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
  const heart = createHeart({ liveParameters: deps.liveParameters });

  return {
    usesTrackingInput: false,
    getLatestTrackingFrame: () => null,
    getSessionNeutral: () => null,
    getActiveInputProfile: async () => null,
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
