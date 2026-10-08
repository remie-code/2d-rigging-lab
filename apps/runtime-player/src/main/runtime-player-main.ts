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
import {
  createPreferredPortFactory,
  findFreeLoopbackPort
} from "./profile-slots/slot-preferred-port";
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
import {
  registerPhysiologyBridgeHandlers
} from "./physiology-bridge-handlers";
import {
  registerControlChannelBridgeHandlers
} from "./channel-bridge-handlers";
import { RuntimePlayerControlChannelServer } from "./control-channel/channel-server";
import { RuntimePlayerControlChannelConfigStore } from "./control-channel/channel-config-store";
import { RuntimePlayerControlChannelDiagnosticLog } from "./control-channel/fire-diagnostics";
import { runtimePlayerControlChannelDefaultPort } from "./control-channel/channel-slot-ports";
import { createAutoMappingSlots } from "./live-mapping/runtime-export-auto-mapping";
import type {
  RuntimePlayerMappingSlot
} from "../preload/model-mapping-bridge-contract";
import {
  PhysiologyProfileStore
} from "./physiology-profiles/physiology-profile-store";
import {
  RuntimePlayerPhysiologyState
} from "./physiology-profiles/physiology-state";
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
import type { RuntimePlayerStageMotionDrive } from "./presence/stage-presence-drive";
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
    // Stage Presence drive seam (C3 Domain D): the Autonomous Host supplies a posture
    // drive, the Tracking Host returns null. Assigned from the composed subsystem
    // below (DATA, not a role query); until then it is inert (tracking path unchanged).
    let getStageMotionDriveForStageMotion =
      (): RuntimePlayerStageMotionDrive | null => null;
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
        sessionNeutral: inputBridgeSessionNeutralForStageMotion(),
        // Stage Presence (C3 Domain D): when the Autonomous Host supplies a posture
        // drive the runtime composes it instead of the tracking path (data branch).
        // The Tracking Host returns null → its existing Stage Motion is untouched.
        drive: getStageMotionDriveForStageMotion()
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
    // Physiology state (C3 Domain C). The持ち主 of the ツマミ即時反映 config, common to
    // both roles; ONLY the Autonomous composer wires its provider to the heart (the
    // provider seam below). `physiologyAvailable` is set from the composed subsystem's
    // `providesPhysiology` DATA marker after composition — never a role query. The
    // state reads it lazily so it can be created here (before composition) yet report
    // availability once the subsystem is composed.
    let physiologyAvailable = false;
    const physiologyState = new RuntimePlayerPhysiologyState({
      isAvailable: () => physiologyAvailable
    });
    const physiologyProfileStore = new PhysiologyProfileStore({
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
      },
      // ツマミ即時反映 config seam (裁定3). Only the Autonomous composer forwards this
      // to the heart; the Tracking composer ignores it (role差は合成テーブルのこの1点のみ).
      physiologyConfigProvider: () => physiologyState.getPhysiologyConfig()
    });
    getLatestTrackingFrameForStageMotion = inputSubsystem.getLatestTrackingFrame;
    getSessionNeutralForStageMotion = inputSubsystem.getSessionNeutral;
    getActiveInputProfileForStageMotion = inputSubsystem.getActiveInputProfile;
    getStageMotionDriveForStageMotion = inputSubsystem.getStageMotionDrive;
    // Availability is DATA from the composed subsystem (生理サブシステムの有無), not a role
    // check: the Autonomous subsystem drives physiology, the Tracking one does not.
    physiologyAvailable = inputSubsystem.providesPhysiology;
    const physiologyBridge = registerPhysiologyBridgeHandlers({
      windows,
      physiologyState,
      profileStore: physiologyProfileStore
    });
    // Control Channel (C4 Domain C). Autonomous-host専有 (裁定2), expressed as DATA:
    // the overlay store is non-null only when the composed subsystem provides a
    // channel (Domain B's `getControlChannelOverlayStore`). The server is created
    // but NOT started (起動時Closed, UX §1); open/close flow through the Channel
    // bridge. The Tracking Host wires a null server → the bridge reports
    // available:false with no runtime `if (role === ...)`.
    const controlChannelOverlayStore =
      inputSubsystem.getControlChannelOverlayStore();
    // The loaded model's current auto-mapping slots, tracked here for the channel
    // server's writability validation. Recomputed from the same payload the heart
    // feeds to createAutoMappingSlots (a pure function → identical slots), so the
    // two never diverge. Null when no model is loaded → every write is
    // slotNotWritable (Domain A validation).
    let currentControlChannelSlots:
      readonly RuntimePlayerMappingSlot[] | null = null;
    let controlChannelServer: RuntimePlayerControlChannelServer | null = null;
    if (controlChannelOverlayStore !== null) {
      // Fire diagnostics are automatic and local to this Runtime Player slot.
      // Failure to initialize the best-effort trace is contained by the logger.
      const controlChannelDiagnosticLog =
        await RuntimePlayerControlChannelDiagnosticLog.create({
          userDataPath: app.getPath("userData")
        });
      const channelConfigStore = new RuntimePlayerControlChannelConfigStore({
        userDataPath: app.getPath("userData"),
        // autonomous-default → fixed 17310; a custom autonomous slot auto-assigns a
        // free loopback port (手動ポート設定なしの規律維持), like Browser Source.
        createPreferredPort: () =>
          launch.preferredPort.mode === "fixed"
            ? runtimePlayerControlChannelDefaultPort
            : findFreeLoopbackPort()
      });
      const channelConfig = await channelConfigStore.getOrCreateConfig();
      controlChannelServer = new RuntimePlayerControlChannelServer({
        overlayStore: controlChannelOverlayStore,
        token: channelConfig.token,
        port: channelConfig.preferredPort,
        getCurrentSlots: () => currentControlChannelSlots,
        diagnosticSink: controlChannelDiagnosticLog
      });
    }
    const controlChannelBridge = registerControlChannelBridgeHandlers({
      windows,
      server: controlChannelServer,
      overlayStore: controlChannelOverlayStore
    });
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
        await physiologyBridge.flushPendingProfileSave();
        bodyFollowState.reset();
        vowelLipsyncState.reset();
        inputSubsystem.clearRuntimeExport();
        dynamicsTuningBridge.clearRuntimeExport();
        physiologyBridge.clearRuntimeExport();
        runtimeVariantBridge.clearRuntimeExport();
        inputSubsystem.clearLiveParameterFrame();
        // Model unload: forget the writable slots (new writes → slotNotWritable) and
        // drop any live overlays now so the体 falls to the生理 baseline immediately,
        // rather than waiting for each overlay's TTL (Domain A 引き継ぎ #3).
        currentControlChannelSlots = null;
        controlChannelOverlayStore?.clearAll();
        controlChannelBridge.publishStatus();
        browserSourceServer.clearRuntimeExport("Runtime Export changing");
        inputSubsystem.publishMappingStatus();
        physiologyBridge.publishStatus();
        setLoadedModelName(null);
      },
      onRuntimeExportLoaded: async (payload) => {
        bodyFollowState.reset();
        vowelLipsyncState.reset();
        await inputSubsystem.setRuntimeExportPayload(payload);
        await dynamicsTuningBridge.setRuntimeExportPayload(payload);
        await physiologyBridge.setRuntimeExportPayload(payload);
        const variantStatus =
          runtimeVariantBridge.setRuntimeExportPayload(payload);
        // The channel's writability check reads the loaded model's auto-mapping
        // slots (same pure derivation the heart uses).
        currentControlChannelSlots = createAutoMappingSlots(payload);
        inputSubsystem.clearLiveParameterFrame();
        browserSourceServer.publishRuntimeExportLoaded(
          payload,
          variantStatus.activeVariantSelection,
          dynamicsTuningState.getEffectiveProfile()
        );
        inputSubsystem.publishMappingStatus();
        dynamicsTuningBridge.publishStatus();
        physiologyBridge.publishStatus();
        void inputSubsystem.publishLatestParameterFrame();
        setLoadedModelName(payload.summary.modelDisplayName);
      },
      onRuntimeExportCleared: async () => {
        await inputSubsystem.flushPendingProfileSave();
        await dynamicsTuningBridge.flushPendingProfileSave();
        await physiologyBridge.flushPendingProfileSave();
        bodyFollowState.reset();
        vowelLipsyncState.reset();
        inputSubsystem.clearRuntimeExport();
        dynamicsTuningBridge.clearRuntimeExport();
        physiologyBridge.clearRuntimeExport();
        runtimeVariantBridge.clearRuntimeExport();
        inputSubsystem.clearLiveParameterFrame();
        currentControlChannelSlots = null;
        controlChannelOverlayStore?.clearAll();
        controlChannelBridge.publishStatus();
        browserSourceServer.clearRuntimeExport("No Runtime Export loaded");
        inputSubsystem.publishMappingStatus();
        physiologyBridge.publishStatus();
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
        await physiologyBridge.flushPendingProfileSave();
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
      controlChannelBridge.dispose();
      void controlChannelServer?.close();
      slotLock?.release();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin" && !isRuntimePlayerQuitInProgress()) {
      requestRuntimePlayerQuit();
    }
  });
}
