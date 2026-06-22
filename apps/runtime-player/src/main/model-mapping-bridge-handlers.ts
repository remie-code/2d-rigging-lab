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
import type { RuntimePlayerInputSessionState } from "./input-session-state";
import type { RuntimePlayerWindowSet } from "./window-management/runtime-player-windows";

export type RegisterModelMappingBridgeHandlersInput = {
  readonly windows: RuntimePlayerWindowSet;
  readonly inputState: RuntimePlayerInputSessionState;
  readonly mappingState: RuntimePlayerLiveMappingState;
  readonly bodyFollowState?: RuntimePlayerBodyFollowState;
  readonly liveParameters: RuntimePlayerLiveParameterBridgeRegistration;
  readonly getActiveInputProfile: () => Promise<InputProfile | null>;
  readonly nowMs?: () => number;
};

export type RuntimePlayerModelMappingBridgeRegistration = {
  readonly publishStatus: () => void;
  readonly publishLatestParameterFrame: () => Promise<void>;
  readonly clearLiveParameterFrame: () => void;
};

export function registerModelMappingBridgeHandlers(
  input: RegisterModelMappingBridgeHandlersInput
): RuntimePlayerModelMappingBridgeRegistration {
  const nowMs = input.nowMs ?? Date.now;
  let liveFrameSequence = 0;

  const publishStatus = (): void => {
    sendToControlWindow(
      input.windows.controlWindow,
      modelMappingBridgeChannels.statusChanged,
      input.mappingState.getStatus()
    );
  };

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

    return publishActionResult("ok", "Auto Mapping regenerated.");
  });
  ipcMain.handle(
    modelMappingBridgeChannels.updateSlot,
    async (_event, request: unknown) => {
      try {
        const command = readMappingSlotUpdateRequest(request);
        input.mappingState.updateSlot(command);
        input.bodyFollowState?.reset();
      } catch (error) {
        return publishActionResult("validation-error", toErrorMessage(error));
      }

      return publishActionResult("ok", "Mapping slot updated.");
    }
  );

  return {
    publishStatus,
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
