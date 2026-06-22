import { ipcMain, type BrowserWindow } from "electron";

import { inputProfileBridgeChannels } from "../preload/input-profile-bridge-channels";
import type {
  RuntimePlayerInputProfileActionResult,
  RuntimePlayerInputProfileMode,
  RuntimePlayerInputProfileStatus,
  RuntimePlayerInputProfileStorageState,
  RuntimePlayerInputProfileSummary
} from "../preload/input-profile-bridge-contract";
import { createTemporaryDefaultInputProfile } from "./input-profiles/input-profile-defaults";
import { createInputProfileId } from "./input-profiles/input-profile-id";
import type { InputProfile } from "./input-profiles/input-profile-document";
import { InputProfileCalibrationSession } from "./input-profiles/input-profile-calibration-session";
import {
  InputProfileStore,
  type InputProfileStoreSnapshot
} from "./input-profiles/input-profile-store";
import {
  readFinishCalibrationRequest,
  readSetActiveProfileRequest,
  readStartCalibrationRequest
} from "./input-profile-bridge-request-validation";
import type { RuntimePlayerInputSessionState } from "./input-session-state";
import type { RuntimePlayerWindowSet } from "./window-management/runtime-player-windows";

export type RegisterInputProfileBridgeHandlersInput = {
  readonly windows: RuntimePlayerWindowSet;
  readonly inputState: RuntimePlayerInputSessionState;
  readonly store?: InputProfileStore;
  readonly userDataPath?: string;
  readonly nowMs?: () => number;
  readonly onProfileChanged?: () => void | Promise<void>;
};

export type RuntimePlayerInputProfileBridgeHandlersRegistration = {
  readonly store: InputProfileStore;
  readonly getStatus: () => Promise<RuntimePlayerInputProfileStatus>;
  readonly getActiveInputProfile: () => Promise<InputProfile | null>;
};

export function registerInputProfileBridgeHandlers(
  input: RegisterInputProfileBridgeHandlersInput
): RuntimePlayerInputProfileBridgeHandlersRegistration {
  const store = input.store ?? new InputProfileStore(
    input.userDataPath === undefined ? {} : { userDataPath: input.userDataPath }
  );
  const nowMs = input.nowMs ?? Date.now;
  let temporaryDefaultsActive = false;
  let calibrationSession: InputProfileCalibrationSession | null = null;

  const getStatus = () =>
    createInputProfileStatus({
      store,
      inputState: input.inputState,
      temporaryDefaultsActive,
      calibrationSession,
      nowMs
    });

  async function publishActionResult(
    result: RuntimePlayerInputProfileActionResult["result"],
    message: string
  ): Promise<RuntimePlayerInputProfileActionResult> {
    const status = await getStatus();
    sendToControlWindow(
      input.windows.controlWindow,
      inputProfileBridgeChannels.statusChanged,
      status
    );
    await input.onProfileChanged?.();

    return {
      result,
      message,
      status
    };
  }

  ipcMain.handle(inputProfileBridgeChannels.getStatus, () => getStatus());
  ipcMain.handle(
    inputProfileBridgeChannels.setActiveProfile,
    async (_event, request: unknown) => {
      const command = readSetActiveProfileRequest(request);
      await store.setActiveProfileId(command.profileId);
      temporaryDefaultsActive = false;

      return publishActionResult("ok", "Input profile selected.");
    }
  );
  ipcMain.handle(inputProfileBridgeChannels.useTemporaryDefaults, async () => {
    temporaryDefaultsActive = true;
    calibrationSession = null;

    return publishActionResult(
      "ok",
      "Temporary defaults are active for this session."
    );
  });
  ipcMain.handle(inputProfileBridgeChannels.lookForward, async () => {
    const result = input.inputState.captureLookForward(nowMs());

    if (result.result === "unavailable") {
      return publishActionResult("unavailable", result.message);
    }

    return publishActionResult(
      "ok",
      "Look Forward captured for this session."
    );
  });
  ipcMain.handle(
    inputProfileBridgeChannels.startCalibration,
    async (_event, request: unknown) => {
      const command = readStartCalibrationRequest(request);
      const startedAtMs = nowMs();
      calibrationSession = new InputProfileCalibrationSession({
        sessionId: `calibration_${startedAtMs}`,
        displayName: command.displayName,
        startedAtMs
      });

      return publishActionResult("ok", "Input calibration started.");
    }
  );
  ipcMain.handle(inputProfileBridgeChannels.cancelCalibration, async () => {
    calibrationSession = null;

    return publishActionResult("ok", "Input calibration canceled.");
  });
  ipcMain.handle(
    inputProfileBridgeChannels.recordCalibrationSample,
    async () => {
      if (calibrationSession === null) {
        return publishActionResult(
          "unavailable",
          "No calibration session is active."
        );
      }

      const frame = input.inputState.getLatestTrackingFrame();
      const result = calibrationSession.recordSample(frame);

      return publishActionResult(
        frame === null ? "unavailable" : "ok",
        result.message
      );
    }
  );
  ipcMain.handle(
    inputProfileBridgeChannels.advanceCalibrationPrompt,
    async () => {
      if (calibrationSession === null) {
        return publishActionResult(
          "unavailable",
          "No calibration session is active."
        );
      }

      const result = calibrationSession.advancePrompt();

      return publishActionResult(
        result.advanced ? "ok" : "unavailable",
        result.message
      );
    }
  );
  ipcMain.handle(
    inputProfileBridgeChannels.finishCalibration,
    async (_event, request: unknown) => {
      if (calibrationSession === null) {
        return publishActionResult(
          "unavailable",
          "No calibration session is active."
        );
      }

      const command = readFinishCalibrationRequest(request);
      const createdAtMs = nowMs();
      const createdAtIso = new Date(createdAtMs).toISOString();
      let profile: InputProfile;

      try {
        profile = calibrationSession.createProfile({
          profileId: createInputProfileId({
            displayName: command.displayName,
            nowMs: createdAtMs
          }),
          displayName: command.displayName,
          createdAtIso
        });
      } catch (error) {
        return publishActionResult("unavailable", toErrorMessage(error));
      }

      await store.saveProfile(profile);
      temporaryDefaultsActive = false;
      calibrationSession = null;

      return publishActionResult("ok", "Input profile saved.");
    }
  );

  return {
    store,
    getStatus,
    getActiveInputProfile: () =>
      getActiveInputProfile({
        store,
        temporaryDefaultsActive,
        nowMs
      })
  };
}

async function getActiveInputProfile(input: {
  readonly store: InputProfileStore;
  readonly temporaryDefaultsActive: boolean;
  readonly nowMs: () => number;
}): Promise<InputProfile | null> {
  const snapshot = await input.store.getSnapshot();

  if (input.temporaryDefaultsActive || snapshot.state === "read-failed") {
    return createTemporaryDefaultInputProfile(
      new Date(input.nowMs()).toISOString()
    );
  }

  return findActiveProfile(snapshot);
}

async function createInputProfileStatus(input: {
  readonly store: InputProfileStore;
  readonly inputState: RuntimePlayerInputSessionState;
  readonly temporaryDefaultsActive: boolean;
  readonly calibrationSession: InputProfileCalibrationSession | null;
  readonly nowMs: () => number;
}): Promise<RuntimePlayerInputProfileStatus> {
  const snapshot = await input.store.getSnapshot();
  const readFailed = snapshot.state === "read-failed";
  const temporaryDefaultsActive =
    input.temporaryDefaultsActive || readFailed;
  const temporaryProfile = createTemporaryDefaultInputProfile(
    new Date(input.nowMs()).toISOString()
  );
  const savedActiveProfile = findActiveProfile(snapshot);
  const activeProfile = temporaryDefaultsActive
    ? temporaryProfile
    : savedActiveProfile;
  const profileMode = getProfileMode({
    snapshot,
    temporaryDefaultsActive,
    activeProfile
  });

  return {
    source: "ifacialmocap",
    transport: "udp",
    profileMode,
    ...(activeProfile === null
      ? {}
      : { activeProfileId: activeProfile.profileId }),
    activeProfile: activeProfile === null
      ? null
      : summarizeInputProfile(activeProfile, temporaryDefaultsActive),
    profiles: snapshot.document.profiles.map((profile) =>
      summarizeInputProfile(profile, false)
    ),
    storage: {
      state: toProfileStorageState(snapshot.state),
      warningMessages: snapshot.warningMessages
    },
    temporaryDefaultsActive,
    sessionNeutral: input.inputState.getSessionNeutral(),
    calibration: input.calibrationSession?.getSnapshot() ?? null
  };
}

function getProfileMode(input: {
  readonly snapshot: InputProfileStoreSnapshot;
  readonly temporaryDefaultsActive: boolean;
  readonly activeProfile: InputProfile | null;
}): RuntimePlayerInputProfileMode {
  if (input.snapshot.state === "read-failed") {
    return "load-warning";
  }

  if (input.temporaryDefaultsActive) {
    return "temporary-defaults";
  }

  return input.activeProfile === null ? "missing" : "saved";
}

function findActiveProfile(
  snapshot: InputProfileStoreSnapshot
): InputProfile | null {
  const activeProfileId = snapshot.document.activeProfileId;

  if (activeProfileId !== undefined) {
    const activeProfile = snapshot.document.profiles.find(
      (profile) => profile.profileId === activeProfileId
    );

    if (activeProfile !== undefined) {
      return activeProfile;
    }
  }

  return snapshot.document.profiles[0] ?? null;
}

function summarizeInputProfile(
  profile: InputProfile,
  temporary: boolean
): RuntimePlayerInputProfileSummary {
  return {
    profileId: profile.profileId,
    displayName: profile.displayName,
    source: profile.source,
    transport: profile.transport,
    createdAtIso: profile.createdAtIso,
    updatedAtIso: profile.updatedAtIso,
    rangeStatus: temporary ? "default" : "calibrated"
  };
}

function toProfileStorageState(
  state: InputProfileStoreSnapshot["state"]
): RuntimePlayerInputProfileStorageState {
  return state;
}

function sendToControlWindow(
  window: BrowserWindow,
  channel: string,
  payload: RuntimePlayerInputProfileStatus
): void {
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    return;
  }

  window.webContents.send(channel, payload);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
