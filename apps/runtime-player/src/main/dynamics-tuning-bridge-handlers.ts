import { ipcMain, type BrowserWindow } from "electron";

import { dynamicsTuningBridgeChannels } from "../preload/dynamics-tuning-bridge-channels";
import type {
  RuntimePlayerDynamicsTuningActionResult,
  RuntimePlayerDynamicsTuningStatus,
  RuntimePlayerEffectiveDynamicsTuningProfile
} from "../preload/dynamics-tuning-bridge-contract";
import type { RuntimeExportLoadedPayload } from "../preload/runtime-export-bridge-contract";
import {
  readDynamicsTuningGroupResetRequest,
  readDynamicsTuningGroupUpdateRequest
} from "./dynamics-tuning-bridge-request-validation";
import {
  DynamicsTuningProfileSaveController
} from "./dynamics-tuning-profiles/dynamics-tuning-profile-save-controller";
import type {
  DynamicsTuningProfileStore
} from "./dynamics-tuning-profiles/dynamics-tuning-profile-store";
import {
  RuntimePlayerDynamicsTuningState
} from "./dynamics-tuning-profiles/dynamics-tuning-state";
import type { RuntimePlayerWindowSet } from "./window-management/runtime-player-windows";

export type RegisterDynamicsTuningBridgeHandlersInput = {
  readonly windows: RuntimePlayerWindowSet;
  readonly tuningState: RuntimePlayerDynamicsTuningState;
  readonly profileStore?: DynamicsTuningProfileStore;
  readonly profileSaveDebounceMs?: number;
  readonly nowMs?: () => number;
  readonly publishEffectiveProfile?: (
    profile: RuntimePlayerEffectiveDynamicsTuningProfile | null
  ) => void;
};

export type RuntimePlayerDynamicsTuningBridgeRegistration = {
  readonly publishStatus: () => void;
  readonly publishEffectiveProfile: () => void;
  readonly setRuntimeExportPayload: (
    payload: RuntimeExportLoadedPayload
  ) => Promise<RuntimePlayerDynamicsTuningStatus>;
  readonly clearRuntimeExport: () => RuntimePlayerDynamicsTuningStatus;
  readonly flushPendingProfileSave: () => Promise<void>;
};

export function registerDynamicsTuningBridgeHandlers(
  input: RegisterDynamicsTuningBridgeHandlersInput
): RuntimePlayerDynamicsTuningBridgeRegistration {
  let profileSaveController: DynamicsTuningProfileSaveController | null = null;

  const publishStatus = (): void => {
    sendStatusToControlWindow(
      input.windows.controlWindow,
      input.tuningState.getStatus()
    );
  };
  const publishEffectiveProfile = (): void => {
    const effectiveProfile = input.tuningState.getEffectiveProfile();
    sendEffectiveProfileToStageWindow(
      input.windows.stageWindow,
      effectiveProfile
    );
    input.publishEffectiveProfile?.(effectiveProfile);
  };

  if (input.profileStore !== undefined) {
    profileSaveController = new DynamicsTuningProfileSaveController({
      tuningState: input.tuningState,
      store: input.profileStore,
      ...(input.profileSaveDebounceMs === undefined
        ? {}
        : { debounceMs: input.profileSaveDebounceMs }),
      onStatusChanged: publishStatus
    });
  }

  async function setRuntimeExportPayload(
    payload: RuntimeExportLoadedPayload
  ): Promise<RuntimePlayerDynamicsTuningStatus> {
    const profileLoadResult = input.profileStore === undefined
      ? undefined
      : await input.profileStore.loadProfile(payload);
    const status = input.tuningState.setRuntimeExportPayload(
      payload,
      profileLoadResult
    );
    publishEffectiveProfile();

    return status;
  }

  function clearRuntimeExport(): RuntimePlayerDynamicsTuningStatus {
    const status = input.tuningState.clearRuntimeExport();
    publishEffectiveProfile();

    return status;
  }

  async function flushPendingProfileSave(): Promise<void> {
    await profileSaveController?.flush();
  }

  async function publishActionResult(
    result: RuntimePlayerDynamicsTuningActionResult["result"],
    message: string
  ): Promise<RuntimePlayerDynamicsTuningActionResult> {
    const status = input.tuningState.getStatus();
    sendStatusToControlWindow(input.windows.controlWindow, status);
    publishEffectiveProfile();

    return {
      result,
      message,
      status
    };
  }

  ipcMain.handle(dynamicsTuningBridgeChannels.getStatus, () =>
    input.tuningState.getStatus()
  );
  ipcMain.handle(dynamicsTuningBridgeChannels.getEffectiveProfile, () =>
    input.tuningState.getEffectiveProfile()
  );
  ipcMain.handle(
    dynamicsTuningBridgeChannels.updateGroup,
    async (_event, request: unknown) => {
      try {
        const command = readDynamicsTuningGroupUpdateRequest(request);
        input.tuningState.updateGroup(command);
        profileSaveController?.scheduleSave();
      } catch (error) {
        return publishActionResult("validation-error", toErrorMessage(error));
      }

      return publishActionResult("ok", "Dynamics tuning updated.");
    }
  );
  ipcMain.handle(
    dynamicsTuningBridgeChannels.resetGroup,
    async (_event, request: unknown) => {
      try {
        const command = readDynamicsTuningGroupResetRequest(request);
        input.tuningState.resetGroup(command);
        profileSaveController?.scheduleSave();
      } catch (error) {
        return publishActionResult("validation-error", toErrorMessage(error));
      }

      return publishActionResult("ok", "Dynamics tuning reset.");
    }
  );
  ipcMain.handle(dynamicsTuningBridgeChannels.retryProfileSave, async () => {
    const saveOutcome = await profileSaveController?.saveNow();

    if (saveOutcome === undefined || saveOutcome.result === "unavailable") {
      return publishActionResult(
        "unavailable",
        "Open a Runtime Export before saving dynamics tuning profile."
      );
    }

    if (saveOutcome.result === "failed") {
      return publishActionResult("save-failed", saveOutcome.message);
    }

    return publishActionResult("ok", saveOutcome.message);
  });

  return {
    publishStatus,
    publishEffectiveProfile,
    setRuntimeExportPayload,
    clearRuntimeExport,
    flushPendingProfileSave
  };
}

function sendStatusToControlWindow(
  window: BrowserWindow,
  payload: RuntimePlayerDynamicsTuningStatus
): void {
  sendToWindow(window, dynamicsTuningBridgeChannels.statusChanged, payload);
}

function sendEffectiveProfileToStageWindow(
  window: BrowserWindow,
  payload: RuntimePlayerEffectiveDynamicsTuningProfile | null
): void {
  sendToWindow(
    window,
    dynamicsTuningBridgeChannels.effectiveProfileChanged,
    payload
  );
}

function sendToWindow(
  window: BrowserWindow,
  channel: string,
  payload:
    | RuntimePlayerDynamicsTuningStatus
    | RuntimePlayerEffectiveDynamicsTuningProfile
    | null
): void {
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    return;
  }

  window.webContents.send(channel, payload);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
