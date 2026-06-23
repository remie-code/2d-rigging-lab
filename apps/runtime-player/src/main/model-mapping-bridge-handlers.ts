import { ipcMain, type BrowserWindow } from "electron";

import { modelMappingBridgeChannels } from "../preload/model-mapping-bridge-channels";
import type {
  RuntimePlayerMappingActionResult,
  RuntimePlayerMappingStatus
} from "../preload/model-mapping-bridge-contract";
import type { InputProfile } from "./input-profiles/input-profile-document";
import type { RuntimePlayerLiveParameterBridgeRegistration } from "./live-parameter-bridge-handlers";
import type { RuntimePlayerBodyFollowState } from "./live-mapping/body-follow-state";
import { RuntimePlayerLiveMappingState } from "./live-mapping/live-mapping-state";
import { createRuntimeParameterFrame } from "./live-mapping/runtime-parameter-frame";
import { readMappingSlotUpdateRequest } from "./model-mapping-bridge-request-validation";
import { ModelMappingProfileSaveController } from "./model-mapping-profiles/model-mapping-profile-save-controller";
import type { ModelMappingProfileStore } from "./model-mapping-profiles/model-mapping-profile-store";
import type { RuntimePlayerInputSessionState } from "./input-session-state";
import type { RuntimePlayerWindowSet } from "./window-management/runtime-player-windows";
import type { RuntimeExportLoadedPayload } from "../preload/runtime-export-bridge-contract";

export type RegisterModelMappingBridgeHandlersInput = {
  readonly windows: RuntimePlayerWindowSet;
  readonly inputState: RuntimePlayerInputSessionState;
  readonly mappingState: RuntimePlayerLiveMappingState;
  readonly bodyFollowState?: RuntimePlayerBodyFollowState;
  readonly profileStore?: ModelMappingProfileStore;
  readonly profileSaveDebounceMs?: number;
  readonly liveParameters: RuntimePlayerLiveParameterBridgeRegistration;
  readonly getActiveInputProfile: () => Promise<InputProfile | null>;
  readonly nowMs?: () => number;
};

export type RuntimePlayerModelMappingBridgeRegistration = {
  readonly publishStatus: () => void;
  readonly setRuntimeExportPayload: (
    payload: RuntimeExportLoadedPayload
  ) => Promise<RuntimePlayerMappingStatus>;
  readonly clearRuntimeExport: () => RuntimePlayerMappingStatus;
  readonly flushPendingProfileSave: () => Promise<void>;
  readonly publishLatestParameterFrame: () => Promise<void>;
  readonly clearLiveParameterFrame: () => void;
};

export function registerModelMappingBridgeHandlers(
  input: RegisterModelMappingBridgeHandlersInput
): RuntimePlayerModelMappingBridgeRegistration {
  const nowMs = input.nowMs ?? Date.now;
  let liveFrameSequence = 0;
  let profileSaveController: ModelMappingProfileSaveController | null = null;

  const publishStatus = (): void => {
    sendToControlWindow(
      input.windows.controlWindow,
      modelMappingBridgeChannels.statusChanged,
      input.mappingState.getStatus()
    );
  };
  if (input.profileStore !== undefined) {
    profileSaveController = new ModelMappingProfileSaveController({
      mappingState: input.mappingState,
      store: input.profileStore,
      ...(input.profileSaveDebounceMs === undefined
        ? {}
        : { debounceMs: input.profileSaveDebounceMs }),
      onStatusChanged: publishStatus
    });
  }

  async function setRuntimeExportPayload(
    payload: RuntimeExportLoadedPayload
  ): Promise<RuntimePlayerMappingStatus> {
    const profileLoadResult = input.profileStore === undefined
      ? undefined
      : await input.profileStore.loadProfile(payload);

    return input.mappingState.setRuntimeExportPayload(
      payload,
      profileLoadResult
    );
  }

  function clearRuntimeExport(): RuntimePlayerMappingStatus {
    return input.mappingState.clearRuntimeExport();
  }

  async function flushPendingProfileSave(): Promise<void> {
    await profileSaveController?.flush();
  }

  async function publishLatestParameterFrame(): Promise<void> {
    const runtimeExportPayload = input.mappingState.getRuntimeExportPayload();
    const trackingFrame = input.inputState.getLatestTrackingFrame();

    if (runtimeExportPayload === null || trackingFrame === null) {
      input.liveParameters.clear();
      return;
    }

    const inputProfile = await input.getActiveInputProfile();
    if (inputProfile === null) {
      input.liveParameters.clear();
      return;
    }

    const frame = createRuntimeParameterFrame({
      runtimeExportPayload,
      trackingFrame,
      sessionNeutral: input.inputState.getSessionNeutral(),
      inputProfile,
      slots: input.mappingState.getSlots(),
      sequence: ++liveFrameSequence,
      producedAtMs: nowMs(),
      ...(input.bodyFollowState === undefined
        ? {}
        : { bodyFollowState: input.bodyFollowState })
    });

    input.liveParameters.publishFrame(frame);
  }

  function clearLiveParameterFrame(): void {
    input.liveParameters.clear();
  }

  async function publishActionResult(
    result: RuntimePlayerMappingActionResult["result"],
    message: string
  ): Promise<RuntimePlayerMappingActionResult> {
    const status = input.mappingState.getStatus();
    sendToControlWindow(
      input.windows.controlWindow,
      modelMappingBridgeChannels.statusChanged,
      status
    );
    await publishLatestParameterFrame();

    return {
      result,
      message,
      status
    };
  }

  ipcMain.handle(modelMappingBridgeChannels.getStatus, () =>
    input.mappingState.getStatus()
  );
  ipcMain.handle(modelMappingBridgeChannels.regenerateAutoMapping, async () => {
    const status = input.mappingState.regenerateAutoMapping();

    if (status === null) {
      return publishActionResult(
        "unavailable",
        "Open a Runtime Export before auto mapping."
      );
    }

    input.bodyFollowState?.reset();
    profileSaveController?.scheduleSave();

    return publishActionResult("ok", "Auto Mapping regenerated.");
  });
  ipcMain.handle(modelMappingBridgeChannels.resetToAutoMap, async () => {
    const status = input.mappingState.regenerateAutoMapping();

    if (status === null) {
      return publishActionResult(
        "unavailable",
        "Open a Runtime Export before resetting mapping."
      );
    }

    input.bodyFollowState?.reset();
    input.mappingState.markMappingProfileUnsaved();
    const saveOutcome = await profileSaveController?.saveNow();

    if (saveOutcome?.result === "failed") {
      return publishActionResult(
        "save-failed",
        "Auto Map restored, but profile save failed."
      );
    }

    return publishActionResult("ok", "Reset to Auto Map saved.");
  });
  ipcMain.handle(modelMappingBridgeChannels.retryProfileSave, async () => {
    const saveOutcome = await profileSaveController?.saveNow();

    if (saveOutcome === undefined || saveOutcome.result === "unavailable") {
      return publishActionResult(
        "unavailable",
        "Open a Runtime Export before saving mapping profile."
      );
    }

    if (saveOutcome.result === "failed") {
      return publishActionResult("save-failed", saveOutcome.message);
    }

    return publishActionResult("ok", saveOutcome.message);
  });
  ipcMain.handle(
    modelMappingBridgeChannels.updateSlot,
    async (_event, request: unknown) => {
      try {
        const command = readMappingSlotUpdateRequest(request);
        input.mappingState.updateSlot(command);
        input.bodyFollowState?.reset();
        profileSaveController?.scheduleSave();
      } catch (error) {
        return publishActionResult("validation-error", toErrorMessage(error));
      }

      return publishActionResult("ok", "Mapping slot updated.");
    }
  );

  return {
    publishStatus,
    setRuntimeExportPayload,
    clearRuntimeExport,
    flushPendingProfileSave,
    publishLatestParameterFrame,
    clearLiveParameterFrame
  };
}

function sendToControlWindow(
  window: BrowserWindow,
  channel: string,
  payload: RuntimePlayerMappingStatus
): void {
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    return;
  }

  window.webContents.send(channel, payload);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
