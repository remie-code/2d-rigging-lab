import { ipcMain, type BrowserWindow } from "electron";

import { physiologyBridgeChannels } from "../preload/physiology-bridge-channels";
import type {
  PhysiologyActionResult,
  PhysiologyStatus
} from "../preload/physiology-bridge-contract";
import type { RuntimeExportLoadedPayload } from "../preload/runtime-export-bridge-contract";
import {
  readPhysiologySectionResetRequest,
  readPhysiologyStagePresenceEnabledRequest,
  readPhysiologyToneUpdateRequest
} from "./physiology-bridge-request-validation";
import {
  PhysiologyProfileSaveController
} from "./physiology-profiles/physiology-profile-save-controller";
import type {
  PhysiologyProfileStore
} from "./physiology-profiles/physiology-profile-store";
import type {
  RuntimePlayerPhysiologyState
} from "./physiology-profiles/physiology-state";
import type { RuntimePlayerWindowSet } from "./window-management/runtime-player-windows";

export type RegisterPhysiologyBridgeHandlersInput = {
  readonly windows: RuntimePlayerWindowSet;
  readonly physiologyState: RuntimePlayerPhysiologyState;
  readonly profileStore?: PhysiologyProfileStore;
  readonly profileSaveDebounceMs?: number;
};

export type RuntimePlayerPhysiologyBridgeRegistration = {
  readonly publishStatus: () => void;
  readonly setRuntimeExportPayload: (
    payload: RuntimeExportLoadedPayload
  ) => Promise<PhysiologyStatus>;
  readonly clearRuntimeExport: () => PhysiologyStatus;
  readonly flushPendingProfileSave: () => Promise<void>;
};

/**
 * Physiology bridge (C3 Domain C). Registered on BOTH roles from main (outside the
 * input subsystem, like Dynamics Tune). The role difference is NOT branched here:
 * `getStatus` reports「生理サブシステムの有無」as DATA (`available`) sourced from the
 * physiology state's injected availability seam — the renderer shows the tracking
 * empty page when `available:false`, with no `if (role === ...)` anywhere. Only
 * quality-word config + status crosses to the renderer (sanitization boundary).
 */
export function registerPhysiologyBridgeHandlers(
  input: RegisterPhysiologyBridgeHandlersInput
): RuntimePlayerPhysiologyBridgeRegistration {
  let profileSaveController: PhysiologyProfileSaveController | null = null;

  const publishStatus = (): void => {
    sendStatusToControlWindow(
      input.windows.controlWindow,
      input.physiologyState.getStatus()
    );
  };

  if (input.profileStore !== undefined) {
    profileSaveController = new PhysiologyProfileSaveController({
      physiologyState: input.physiologyState,
      store: input.profileStore,
      ...(input.profileSaveDebounceMs === undefined
        ? {}
        : { debounceMs: input.profileSaveDebounceMs }),
      onStatusChanged: publishStatus
    });
  }

  async function setRuntimeExportPayload(
    payload: RuntimeExportLoadedPayload
  ): Promise<PhysiologyStatus> {
    const profileLoadResult =
      input.profileStore === undefined
        ? undefined
        : await input.profileStore.loadProfile(payload);

    return input.physiologyState.setRuntimeExportPayload(
      payload,
      profileLoadResult
    );
  }

  function clearRuntimeExport(): PhysiologyStatus {
    return input.physiologyState.clearRuntimeExport();
  }

  async function flushPendingProfileSave(): Promise<void> {
    await profileSaveController?.flush();
  }

  function publishActionResult(
    result: PhysiologyActionResult["result"],
    message: string
  ): PhysiologyActionResult {
    const status = input.physiologyState.getStatus();
    sendStatusToControlWindow(input.windows.controlWindow, status);

    return { result, message, status };
  }

  ipcMain.handle(physiologyBridgeChannels.getStatus, () =>
    input.physiologyState.getStatus()
  );
  ipcMain.handle(
    physiologyBridgeChannels.updateTone,
    (_event, request: unknown) => {
      try {
        const command = readPhysiologyToneUpdateRequest(request);
        input.physiologyState.updateTone(command);
        profileSaveController?.scheduleSave();
      } catch (error) {
        return publishActionResult("validation-error", toErrorMessage(error));
      }

      return publishActionResult("ok", "Physiology updated.");
    }
  );
  ipcMain.handle(
    physiologyBridgeChannels.setStagePresenceEnabled,
    (_event, request: unknown) => {
      try {
        const command = readPhysiologyStagePresenceEnabledRequest(request);
        input.physiologyState.setStagePresenceEnabled(command.enabled);
        profileSaveController?.scheduleSave();
      } catch (error) {
        return publishActionResult("validation-error", toErrorMessage(error));
      }

      return publishActionResult("ok", "Stage Presence updated.");
    }
  );
  ipcMain.handle(
    physiologyBridgeChannels.resetSection,
    (_event, request: unknown) => {
      try {
        const command = readPhysiologySectionResetRequest(request);
        input.physiologyState.resetSection(command.section);
        profileSaveController?.scheduleSave();
      } catch (error) {
        return publishActionResult("validation-error", toErrorMessage(error));
      }

      return publishActionResult("ok", "Physiology section reset.");
    }
  );
  ipcMain.handle(physiologyBridgeChannels.retryProfileSave, async () => {
    const saveOutcome = await profileSaveController?.saveNow();

    if (saveOutcome === undefined || saveOutcome.result === "unavailable") {
      return publishActionResult(
        "unavailable",
        "Open a Runtime Export before saving physiology profile."
      );
    }

    if (saveOutcome.result === "failed") {
      return publishActionResult("save-failed", saveOutcome.message);
    }

    return publishActionResult("ok", saveOutcome.message);
  });

  return {
    publishStatus,
    setRuntimeExportPayload,
    clearRuntimeExport,
    flushPendingProfileSave
  };
}

function sendStatusToControlWindow(
  window: BrowserWindow,
  payload: PhysiologyStatus
): void {
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    return;
  }

  window.webContents.send(physiologyBridgeChannels.statusChanged, payload);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
