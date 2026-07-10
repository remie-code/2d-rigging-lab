import { app, dialog } from "electron";

import { runtimePlayerHostRoleLabels } from "./profile-slots/host-role";
import { adoptRuntimePlayerLegacyDefaults } from "./profile-slots/legacy-adoption";
import {
  resolveRuntimePlayerSlotLaunch,
  type RuntimePlayerSlotLaunch
} from "./profile-slots/role-launch-resolution";
import {
  acquireRuntimePlayerSlotLock,
  type RuntimePlayerSlotLock
} from "./profile-slots/slot-lock";
import { createPreferredPortFactory } from "./profile-slots/slot-preferred-port";
import { registerBrowserSourceBridgeHandlers } from "./broadcast-source/browser-source-bridge-handlers";
import { RuntimePlayerBrowserSourceConfigStore } from "./broadcast-source/browser-source-config-store";
import { RuntimePlayerBrowserSourceServer } from "./broadcast-source/browser-source-server";
import { LocalPreviewLiveRenderSuspensionPolicy } from "./broadcast-source/local-preview-live-render-suspension";
import {
  registerDynamicsTuningBridgeHandlers
} from "./dynamics-tuning-bridge-handlers";
import {
  DynamicsTuningProfileStore
} from "./dynamics-tuning-profiles/dynamics-tuning-profile-store";
import {
  RuntimePlayerDynamicsTuningState
} from "./dynamics-tuning-profiles/dynamics-tuning-state";
import type { TrackingFrame } from "../preload/input-tracking-frame-contract";
import type {
  RuntimePlayerInputSessionNeutralSnapshot
} from "../preload/input-profile-bridge-contract";
import type {
  RuntimePlayerStageViewTransform
} from "../preload/runtime-player-bridge-contract";
import type { InputProfile } from "./input-profiles/input-profile-document";
import { registerLiveParameterBridgeHandlers } from "./live-parameter-bridge-handlers";
import { RuntimePlayerBodyFollowState } from "./live-mapping/body-follow-state";
import { RuntimePlayerVowelLipsyncState } from "./live-mapping/vowel-lipsync-estimator";
import { RuntimePlayerLiveMappingState } from "./live-mapping/live-mapping-state";
import { ModelMappingProfileStore } from "./model-mapping-profiles/model-mapping-profile-store";
import { composeRuntimePlayerInputSubsystem } from "./role-composition/input-subsystem";
import {
  createRuntimePlayerRoleSelectionStubIo,
  presentRuntimePlayerRoleSelectionStub
} from "./role-composition/role-selection-stub";
import { registerPlaceholderBridgeHandlers } from "./placeholder-bridge-handlers";
import { registerRuntimeExportBridgeHandlers } from "./runtime-export-loader/runtime-export-bridge-handlers";
import { registerRuntimeVariantBridgeHandlers } from "./variant-controller/runtime-variant-bridge-handlers";
import {
  registerStageViewBridgeHandlers,
  type RuntimePlayerStageViewBridgeRegistration
} from "./stage-view-bridge-handlers";
import { RuntimePlayerStageMotionRuntime } from "./stage-motion/stage-motion-runtime";
import {
  publishRuntimePlayerStageMotionDisplayState
} from "./stage-motion/stage-motion-transport";
import { RuntimePlayerStartupStateStore } from "./startup-state/runtime-player-startup-state-store";
import { RuntimePlayerWindowStateController } from "./window-state/window-state-controller";
import { RuntimePlayerWindowStateStore } from "./window-state/window-state-store";
import {
  attachRuntimePlayerWindowStateTracking,
  createRuntimePlayerWindows,
  loadRuntimePlayerWindows
} from "./window-management/runtime-player-windows";
import {
  RuntimePlayerQuitController,
  attachRuntimePlayerControlWindowRecovery,
  showRuntimePlayerControlWindow
} from "./window-management/control-window-recovery";
import { registerRuntimePlayerTrayMenu } from "./window-management/runtime-player-tray-menu";
import type { RuntimePlayerTrayMenuRegistration } from "./window-management/runtime-player-tray-menu";
import {
  composeRuntimePlayerControlWindowTitle,
  composeRuntimePlayerStageWindowTitle,
  composeRuntimePlayerTrayTooltip
} from "./window-management/window-title";
import type { RuntimePlayerHostRoleIdentity } from "../preload/runtime-player-bridge-contract";

export function startRuntimePlayerMain(): void {
  let isRuntimePlayerQuitInProgress = (): boolean => false;
  let requestRuntimePlayerQuit = (): void => {
    app.quit();
  };

  // --- Profile-slot foundation (Domain A) ---------------------------------
  // Resolve the launch role/slot once, at the composition-root entry, from the
  // process arguments. The `role` on a resolved launch is the single seam
  // Domain B uses to select the registrar set; nothing below re-tests the role
  // value at runtime.
  const defaultUserDataPath = app.getPath("userData");
  const launch: RuntimePlayerSlotLaunch = resolveRuntimePlayerSlotLaunch({
    argv: process.argv,
    defaultUserDataPath
  });

  const exitWithFatalDialog = (message: string): void => {
    void app.whenReady().then(() => {
      dialog.showErrorBox("Runtime Player", message);
      app.quit();
    });
  };

  if (launch.kind === "error") {
    exitWithFatalDialog(launch.message);
    return;
  }

  let slotLock: RuntimePlayerSlotLock | null = null;

  if (launch.kind === "role-resolved") {
    // Claim the slot before doing anything else. A second instance of the same
    // slot fails fast with a clear dialog; a stale lock from an abnormal exit
    // is reclaimed inside acquire. No single-instance lock is used.
    const lockResult = acquireRuntimePlayerSlotLock({
      slotUserDataPath: launch.slotUserDataPath,
      role: launch.role
    });

    if (!lockResult.ok) {
      exitWithFatalDialog(
        `This profile is already in use by a running ${runtimePlayerHostRoleLabels[launch.role]}.`
      );
      return;
    }

    slotLock = lockResult.lock;
    // Point the effective userData base at the slot before `app` is ready. All
    // stores are `{ userDataPath }`-DI'd, so this single redirect moves every
    // artifact into the slot with no store changes.
    app.setPath("userData", launch.slotUserDataPath);
  }

  app.whenReady().then(async () => {
    if (launch.kind !== "role-resolved") {
      // No-role launch (the `error` kind is handled synchronously above). Show
      // the minimal role selection stub: it asks, never implicitly binds a role,
      // and remembers nothing. It builds no windows/slots of its own.
      await presentRuntimePlayerRoleSelectionStub(
        createRuntimePlayerRoleSelectionStubIo()
      );
      return;
    }

    // `launch` is now narrowed to the resolved role. The role is carried as data
    // (identity + registrar-set selection); no `if (role === ...)` runtime
    // branch is introduced anywhere below.
    const roleIdentity: RuntimePlayerHostRoleIdentity = {
      id: launch.role,
      label: runtimePlayerHostRoleLabels[launch.role]
    };

    if (launch.adoptsLegacyDefaults) {
      // One-time, idempotent, non-destructive adoption of the pre-slot data so
      // today's single Tracking Host keeps its calibration/mappings/etc.
      await adoptRuntimePlayerLegacyDefaults({
        defaultUserDataPath: launch.defaultUserDataPath,
        slotUserDataPath: launch.slotUserDataPath
      }).catch(() => undefined);
    }

    // Identity: role-in-title receptacle. Windows are created with the role
    // title; the controller weaves the loaded model name in on Runtime Export
    // load and re-applies it when the Stage window is recreated.
    let loadedModelName: string | null = null;
    let refreshTrayIdentity = (): void => {};
    const applyWindowTitles = (): void => {
      const controlTitle = composeRuntimePlayerControlWindowTitle({
        role: launch.role,
        modelName: loadedModelName
      });
      const stageTitle = composeRuntimePlayerStageWindowTitle({
        role: launch.role,
        modelName: loadedModelName
      });

      if (!windows.controlWindow.isDestroyed()) {
        windows.controlWindow.setTitle(controlTitle);
      }
      if (!windows.stageWindow.isDestroyed()) {
        windows.stageWindow.setTitle(stageTitle);
      }
    };
    const setLoadedModelName = (modelName: string | null): void => {
      loadedModelName = modelName;
      applyWindowTitles();
      refreshTrayIdentity();
    };

    const windowStateStore = new RuntimePlayerWindowStateStore({
      userDataPath: app.getPath("userData")
    });
    const windowStateSnapshot = await windowStateStore.getSnapshot();
    const windowState = new RuntimePlayerWindowStateController({
      store: windowStateStore,
      snapshot: windowStateSnapshot
    });
    const windows = createRuntimePlayerWindows({
      windowState: windowState.getDocument(),
      getWindowStateDocument: () => windowState.getDocument(),
      controlWindowTitle: composeRuntimePlayerControlWindowTitle({
        role: launch.role
      }),
      stageWindowTitle: composeRuntimePlayerStageWindowTitle({
        role: launch.role
      })
    });
    attachRuntimePlayerWindowStateTracking({ windows, windowState });
    registerPlaceholderBridgeHandlers({ windows, role: roleIdentity });
    const browserSourceConfigStore = new RuntimePlayerBrowserSourceConfigStore({
      userDataPath: app.getPath("userData"),
      createPreferredPort: createPreferredPortFactory(launch.preferredPort)
    });
    const browserSourceConfig =
      await browserSourceConfigStore.getOrCreateConfig();
    const browserSourceServer = new RuntimePlayerBrowserSourceServer({
      port: browserSourceConfig.preferredPort,
      token: browserSourceConfig.token
    });
    const browserSourceBridge = registerBrowserSourceBridgeHandlers({
      windows,
      statusProvider: browserSourceServer
    });
    const runtimeVariantBridge = registerRuntimeVariantBridgeHandlers({
      windows
    });
    const unsubscribeRuntimeVariantBridge =
      runtimeVariantBridge.onStatusChanged((status) => {
        browserSourceServer.publishActiveVariantSelection(
          status.activeVariantSelection
        );
      });
    const stageMotionRuntime = new RuntimePlayerStageMotionRuntime();
    let stageViewBridge: RuntimePlayerStageViewBridgeRegistration | null = null;
    let isLocalPreviewLiveRenderSuspended = false;
    let latestNativeStageDisplayTransform: RuntimePlayerStageViewTransform | null =
      null;
    let getLatestTrackingFrameForStageMotion = (): TrackingFrame | null => null;
    let getSessionNeutralForStageMotion =
      (): RuntimePlayerInputSessionNeutralSnapshot | null => null;
    let getActiveInputProfileForStageMotion:
      () => Promise<InputProfile | null> = async () => null;
    const getStageWindowBoundsForBrowserSource = () =>
      windows.stageWindow.isDestroyed()
        ? null
        : windows.stageWindow.getBounds();
    const publishStageMotionTransport = (input: {
      readonly browserSourceTransform: RuntimePlayerStageViewTransform;
      readonly nativeDisplayTransform: RuntimePlayerStageViewTransform | null;
      readonly notify?: "immediate" | "sampled";
    }): void => {
      publishRuntimePlayerStageMotionDisplayState({
        browserSourceTransform: input.browserSourceTransform,
        nativeDisplayTransform: input.nativeDisplayTransform,
        stageWindowBounds: getStageWindowBoundsForBrowserSource(),
        deliverToNativeStageWindow:
          stageViewBridge !== null && !isLocalPreviewLiveRenderSuspended,
        ...(input.notify === undefined ? {} : { notify: input.notify }),
        publishBrowserSourceStageDisplayState: (state, options) => {
          browserSourceServer.publishStageDisplayState(state, options);
        },
        publishNativeStageDisplayTransform: (transform) => {
          stageViewBridge?.publishDisplayViewTransform(transform);
        }
      });
    };
    const publishNativeStageDisplayTransform = (): void => {
      if (stageViewBridge === null || isLocalPreviewLiveRenderSuspended) {
        return;
      }

      stageViewBridge.publishDisplayViewTransform(
        latestNativeStageDisplayTransform
      );
    };
    const publishLatestStageMotionDisplayState = async (input: {
      readonly notify?: "immediate" | "sampled";
    } = {}): Promise<void> => {
      const trackingFrame = getLatestTrackingFrameForStageMotion();
      const inputProfile = await getActiveInputProfileForStageMotion();
      const result = stageMotionRuntime.update({
        baseTransform: windowState.getStageViewTransform(),
        settings: windowState.getStageMotionSettings(),
        trackingFrame,
        inputProfile,
        sessionNeutral: inputBridgeSessionNeutralForStageMotion()
      });

      latestNativeStageDisplayTransform = result.nativeDisplayTransform;
      publishStageMotionTransport({
        browserSourceTransform: result.browserSourceTransform,
        nativeDisplayTransform: result.nativeDisplayTransform,
        ...(input.notify === undefined ? {} : { notify: input.notify })
      });
    };
    const clearStageMotionDisplayTransform = (input: {
      readonly notify?: "immediate" | "sampled";
    } = {}): void => {
      stageMotionRuntime.reset();
      latestNativeStageDisplayTransform = null;
      publishStageMotionTransport({
        browserSourceTransform: windowState.getStageViewTransform(),
        nativeDisplayTransform: null,
        ...(input.notify === undefined ? {} : { notify: input.notify })
      });
    };
    const inputBridgeSessionNeutralForStageMotion = () =>
      getSessionNeutralForStageMotion();
    const unsubscribeBrowserSourceStageDisplayState =
      windowState.subscribe(() => {
        void publishLatestStageMotionDisplayState({
          notify: "immediate"
        });
    });
    clearStageMotionDisplayTransform({ notify: "immediate" });
    await browserSourceServer.start().catch(() => undefined);
    const stageLiveParameters = registerLiveParameterBridgeHandlers({ windows });
    let trayMenu: RuntimePlayerTrayMenuRegistration | null = null;
    stageViewBridge = registerStageViewBridgeHandlers({
      windows,
      windowState,
      onCaptureStateChanged: () => {
        trayMenu?.refresh();
      },
      onStageWindowReopened: () => {
        // The recreated Stage window starts with the role-only title; re-apply
        // the current model name so its title stays distinguishable.
        applyWindowTitles();
        runtimeVariantBridge.publishStatus();
        if (!isLocalPreviewLiveRenderSuspended) {
          stageLiveParameters.publishLatestFrameToStageWindow({
            resetBeforePublish: true
          });
        }
        publishNativeStageDisplayTransform();
      },
      onStageMotionSettingsChanged: () => {
        stageMotionRuntime.reset();
        void publishLatestStageMotionDisplayState({
          notify: "immediate"
        });
      }
    });
    const localPreviewLiveRenderPolicy =
      new LocalPreviewLiveRenderSuspensionPolicy({
        onStateChanged: (state) => {
          if (state.suspended === isLocalPreviewLiveRenderSuspended) {
            return;
          }

          isLocalPreviewLiveRenderSuspended = state.suspended;
          stageLiveParameters.setStageWindowLiveFrameDeliveryEnabled(
            !state.suspended
          );

          if (state.suspended) {
            stageLiveParameters.clearStageWindowLiveParameterFrame();
            stageViewBridge?.publishDisplayViewTransform(null);
            return;
          }

          stageLiveParameters.publishLatestFrameToStageWindow({
            resetBeforePublish: true
          });
          publishNativeStageDisplayTransform();
        }
      });
    const unsubscribeLocalPreviewLiveRenderPolicy =
      browserSourceServer.onStatusChanged((status) => {
        localPreviewLiveRenderPolicy.updateConnectedClientCount(
          status.connectedClientCount
        );
      });
    localPreviewLiveRenderPolicy.updateConnectedClientCount(
      browserSourceServer.getStatus().connectedClientCount
    );
    const liveParameters = {
      getLatestFrame: stageLiveParameters.getLatestFrame,
      publishFrame: (frame: Parameters<typeof stageLiveParameters.publishFrame>[0]) => {
        stageLiveParameters.publishFrame(frame, {
          deliverToStageWindow: !localPreviewLiveRenderPolicy.isSuspended()
        });
        browserSourceServer.publishLiveParameterFrame(frame);
        void publishLatestStageMotionDisplayState({
          notify: "sampled"
        });
      },
      publishLatestFrameToStageWindow:
        stageLiveParameters.publishLatestFrameToStageWindow,
      setStageWindowLiveFrameDeliveryEnabled:
        stageLiveParameters.setStageWindowLiveFrameDeliveryEnabled,
      clearStageWindowLiveParameterFrame:
        stageLiveParameters.clearStageWindowLiveParameterFrame,
      clear: () => {
        stageLiveParameters.clear();
        browserSourceServer.clearLatestFrame();
        clearStageMotionDisplayTransform({
          notify: "immediate"
        });
      }
    };
    const liveMappingState = new RuntimePlayerLiveMappingState();
    const bodyFollowState = new RuntimePlayerBodyFollowState();
    const vowelLipsyncState = new RuntimePlayerVowelLipsyncState();
    const modelMappingProfileStore = new ModelMappingProfileStore({
      userDataPath: app.getPath("userData")
    });
    const dynamicsTuningState = new RuntimePlayerDynamicsTuningState();
    const dynamicsTuningProfileStore = new DynamicsTuningProfileStore({
      userDataPath: app.getPath("userData")
    });
    const startupStateStore = new RuntimePlayerStartupStateStore({
      userDataPath: app.getPath("userData")
    });
    // Role composition, single point: the role selects which input subsystem to
    // assemble (data lookup, not an `if (role === ...)` runtime branch). The
    // Tracking Host builds the full input/tracking registrars; the Autonomous
    // Host builds an inert subsystem (no UDP receiver, no input registrars). The
    // rest of the composition wires to `inputSubsystem` uniformly.
    const inputSubsystem = composeRuntimePlayerInputSubsystem(launch.role, {
      windows,
      userDataPath: app.getPath("userData"),
      liveMappingState,
      bodyFollowState,
      vowelLipsyncState,
      modelMappingProfileStore,
      liveParameters,
      resetStageMotion: () => {
        stageMotionRuntime.reset();
      },
      requestStageMotionRepublish: () => {
        void publishLatestStageMotionDisplayState({
          notify: "immediate"
        });
      }
    });
    getLatestTrackingFrameForStageMotion = inputSubsystem.getLatestTrackingFrame;
    getSessionNeutralForStageMotion = inputSubsystem.getSessionNeutral;
    getActiveInputProfileForStageMotion = inputSubsystem.getActiveInputProfile;
    const dynamicsTuningBridge = registerDynamicsTuningBridgeHandlers({
      windows,
      tuningState: dynamicsTuningState,
      profileStore: dynamicsTuningProfileStore,
      publishEffectiveProfile: (profile) => {
        browserSourceServer.publishDynamicsTuningProfile(profile);
      }
    });
    registerRuntimeExportBridgeHandlers({
      windows,
      startupStateStore,
      onRuntimeExportChanging: async () => {
        await inputSubsystem.flushPendingProfileSave();
        await dynamicsTuningBridge.flushPendingProfileSave();
        bodyFollowState.reset();
        vowelLipsyncState.reset();
        inputSubsystem.clearRuntimeExport();
        dynamicsTuningBridge.clearRuntimeExport();
        runtimeVariantBridge.clearRuntimeExport();
        inputSubsystem.clearLiveParameterFrame();
        browserSourceServer.clearRuntimeExport("Runtime Export changing");
        inputSubsystem.publishMappingStatus();
        setLoadedModelName(null);
      },
      onRuntimeExportLoaded: async (payload) => {
        bodyFollowState.reset();
        vowelLipsyncState.reset();
        await inputSubsystem.setRuntimeExportPayload(payload);
        await dynamicsTuningBridge.setRuntimeExportPayload(payload);
        const variantStatus =
          runtimeVariantBridge.setRuntimeExportPayload(payload);
        inputSubsystem.clearLiveParameterFrame();
        browserSourceServer.publishRuntimeExportLoaded(
          payload,
          variantStatus.activeVariantSelection,
          dynamicsTuningState.getEffectiveProfile()
        );
        inputSubsystem.publishMappingStatus();
        dynamicsTuningBridge.publishStatus();
        void inputSubsystem.publishLatestParameterFrame();
        setLoadedModelName(payload.summary.modelDisplayName);
      },
      onRuntimeExportCleared: async () => {
        await inputSubsystem.flushPendingProfileSave();
        await dynamicsTuningBridge.flushPendingProfileSave();
        bodyFollowState.reset();
        vowelLipsyncState.reset();
        inputSubsystem.clearRuntimeExport();
        dynamicsTuningBridge.clearRuntimeExport();
        runtimeVariantBridge.clearRuntimeExport();
        inputSubsystem.clearLiveParameterFrame();
        browserSourceServer.clearRuntimeExport("No Runtime Export loaded");
        inputSubsystem.publishMappingStatus();
        setLoadedModelName(null);
      }
    });
    const quitController = new RuntimePlayerQuitController({
      quit: () => {
        app.quit();
      },
      disconnectInput: () => inputSubsystem.disconnect(),
      flushModelMappingProfile: async () => {
        await inputSubsystem.flushPendingProfileSave();
        await dynamicsTuningBridge.flushPendingProfileSave();
      },
      flushWindowState: () => windowState.flush()
    });
    isRuntimePlayerQuitInProgress = () => quitController.isQuitInProgress();
    requestRuntimePlayerQuit = () => {
      quitController.requestQuit();
    };
    app.on("before-quit", (event) => {
      void quitController.handleBeforeQuit(event);
    });
    attachRuntimePlayerControlWindowRecovery({
      controlWindow: windows.controlWindow,
      isExplicitQuitInProgress: () => quitController.isQuitInProgress(),
      requestQuit: () => {
        quitController.requestQuit();
      },
      closeStageWindow: () => {
        windows.stageWindowLifecycle.closeStageWindow();
      }
    });
    trayMenu = registerRuntimePlayerTrayMenu({
      actions: {
        showControl: () =>
          showRuntimePlayerControlWindow(windows.controlWindow),
        focusStage: () => {
          if (stageViewBridge === null) {
            return false;
          }

          void stageViewBridge.focusStage();
          return true;
        },
        disableClickThrough: () => stageViewBridge?.disableClickThrough() ??
          false,
        quit: () => {
          quitController.requestQuit();
        }
      },
      getClickThroughRecoveryState: () => ({
        enabled: stageViewBridge?.getCaptureState().clickThroughEnabled ?? false
      }),
      getToolTip: () =>
        composeRuntimePlayerTrayTooltip({
          role: launch.role,
          modelName: loadedModelName
        })
    });
    refreshTrayIdentity = () => {
      trayMenu?.refresh();
    };
    await loadRuntimePlayerWindows(windows);

    app.on("activate", () => {
      showRuntimePlayerControlWindow(windows.controlWindow);
    });

    app.once("will-quit", () => {
      trayMenu?.dispose();
      localPreviewLiveRenderPolicy.dispose();
      unsubscribeLocalPreviewLiveRenderPolicy();
      unsubscribeBrowserSourceStageDisplayState();
      unsubscribeRuntimeVariantBridge();
      browserSourceBridge.dispose();
      void browserSourceServer.stop();
      slotLock?.release();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin" && !isRuntimePlayerQuitInProgress()) {
      requestRuntimePlayerQuit();
    }
  });
}
