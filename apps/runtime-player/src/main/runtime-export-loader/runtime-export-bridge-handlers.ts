import { dialog, ipcMain } from "electron";

import { runtimeExportBridgeChannels } from "../../preload/runtime-export-bridge-channels";
import type {
  RuntimeExportLoadedPayload,
  RuntimeExportOpenDirectoryResult,
  RuntimeExportRestoreLastDirectoryResult,
  RuntimeExportLoadOperation
} from "../../preload/runtime-export-bridge-contract";
import type { RuntimePlayerStartupStateStore } from "../startup-state/runtime-player-startup-state-store";
import type { RuntimePlayerWindowSet } from "../window-management/runtime-player-windows";
import { loadRuntimeExportDirectory } from "./runtime-export-directory-loader";
import {
  loadRuntimeExportIntoSession,
  toOpenDirectoryResult,
  type RuntimeExportDirectoryLoader,
  type RuntimeExportLifecycleCallbacks
} from "./runtime-export-load-workflow";
import { RuntimeExportSessionState } from "./runtime-export-session-state";

type MaybePromise<T> = T | Promise<T>;

export interface RegisterRuntimeExportBridgeHandlersInput {
  readonly windows: RuntimePlayerWindowSet;
  readonly session?: RuntimeExportSessionState;
  readonly loadDirectory?: RuntimeExportDirectoryLoader;
  readonly startupStateStore?: RuntimePlayerStartupStateStore;
  readonly onRuntimeExportChanging?: () => MaybePromise<void>;
  readonly onRuntimeExportLoaded?: (
    payload: RuntimeExportLoadedPayload
  ) => MaybePromise<void>;
  readonly onRuntimeExportCleared?: () => MaybePromise<void>;
}

export function registerRuntimeExportBridgeHandlers(
  input: RegisterRuntimeExportBridgeHandlersInput
): RuntimeExportSessionState {
  const session = input.session ?? new RuntimeExportSessionState();
  const loadDirectory = input.loadDirectory ?? loadRuntimeExportDirectory;

  ipcMain.handle(runtimeExportBridgeChannels.getStatus, () => session.getStatus());
  ipcMain.handle(runtimeExportBridgeChannels.getLoadedPayload, () =>
    session.getLoadedPayload()
  );
  ipcMain.handle(runtimeExportBridgeChannels.openDirectory, async () =>
    openRuntimeExportDirectory({
      windows: input.windows,
      session,
      loadDirectory,
      ...(input.startupStateStore === undefined
        ? {}
        : { startupStateStore: input.startupStateStore }),
      callbacks: createLifecycleCallbacks(input)
    })
  );
  ipcMain.handle(runtimeExportBridgeChannels.restoreLastDirectory, (_event, request) =>
    restoreLastRuntimeExportDirectory({
      windows: input.windows,
      session,
      loadDirectory,
      operation: readRestoreOperation(request),
      ...(input.startupStateStore === undefined
        ? {}
        : { startupStateStore: input.startupStateStore }),
      callbacks: createLifecycleCallbacks(input)
    })
  );

  return session;
}

async function openRuntimeExportDirectory(input: {
  readonly windows: RuntimePlayerWindowSet;
  readonly session: RuntimeExportSessionState;
  readonly loadDirectory: RuntimeExportDirectoryLoader;
  readonly startupStateStore?: RuntimePlayerStartupStateStore;
  readonly callbacks?: RuntimeExportLifecycleCallbacks;
}): Promise<RuntimeExportOpenDirectoryResult> {
  const selection = await dialog.showOpenDialog(input.windows.controlWindow, {
    title: "Open Runtime Export",
    buttonLabel: "Open Runtime Export",
    properties: ["openDirectory"]
  });

  if (selection.canceled || selection.filePaths[0] === undefined) {
    return {
      result: "canceled",
      runtimeExport: input.session.getStatus()
    };
  }

  const directoryPath = selection.filePaths[0];
  const result = await loadRuntimeExportIntoSession({
    windows: input.windows,
    session: input.session,
    directoryPath,
    operation: "manual-open",
    loadDirectory: input.loadDirectory,
    ...(input.callbacks === undefined ? {} : { callbacks: input.callbacks })
  });

  if (result.result === "loaded") {
    await saveLastRuntimeExportDirectoryIfAvailable(
      input.startupStateStore,
      result.runtimeExport.directoryPath
    );
  }

  return toOpenDirectoryResult(result);
}

async function restoreLastRuntimeExportDirectory(input: {
  readonly windows: RuntimePlayerWindowSet;
  readonly session: RuntimeExportSessionState;
  readonly loadDirectory: RuntimeExportDirectoryLoader;
  readonly operation: RuntimeExportLoadOperation;
  readonly startupStateStore?: RuntimePlayerStartupStateStore;
  readonly callbacks?: RuntimeExportLifecycleCallbacks;
}): Promise<RuntimeExportRestoreLastDirectoryResult> {
  const snapshot = await input.startupStateStore?.getSnapshot();
  const directoryPath = snapshot?.document.lastRuntimeExportDirectory ?? null;

  if (directoryPath === null) {
    return {
      result: "not-configured",
      runtimeExport: input.session.getStatus()
    };
  }

  const result = await loadRuntimeExportIntoSession({
    windows: input.windows,
    session: input.session,
    directoryPath,
    operation: input.operation,
    loadDirectory: input.loadDirectory,
    ...(input.callbacks === undefined ? {} : { callbacks: input.callbacks })
  });

  if (result.result === "loaded") {
    return {
      result: "loaded",
      runtimeExport: result.runtimeExport
    };
  }

  return result;
}

function createLifecycleCallbacks(
  input: RegisterRuntimeExportBridgeHandlersInput
): RuntimeExportLifecycleCallbacks {
  return {
    ...(input.onRuntimeExportChanging === undefined
      ? {}
      : { onRuntimeExportChanging: input.onRuntimeExportChanging }),
    ...(input.onRuntimeExportLoaded === undefined
      ? {}
      : { onRuntimeExportLoaded: input.onRuntimeExportLoaded }),
    ...(input.onRuntimeExportCleared === undefined
      ? {}
      : { onRuntimeExportCleared: input.onRuntimeExportCleared })
  };
}

async function saveLastRuntimeExportDirectoryIfAvailable(
  startupStateStore: RuntimePlayerStartupStateStore | undefined,
  directoryPath: string
): Promise<void> {
  if (startupStateStore === undefined) {
    return;
  }

  try {
    await startupStateStore.saveLastRuntimeExportDirectory(directoryPath);
  } catch {
    // Runtime Export is already loaded; startup-state save failure should not
    // convert a successful manual open into a load failure.
  }
}

function readRestoreOperation(request: unknown): RuntimeExportLoadOperation {
  if (request === undefined) {
    return "startup-restore";
  }

  if (!isRecord(request)) {
    throw new Error("Runtime Export restore request must be an object.");
  }

  if (request.reason === undefined || request.reason === "startup") {
    return "startup-restore";
  }

  if (request.reason === "retry") {
    return "retry-restore";
  }

  throw new Error("Unsupported Runtime Export restore reason.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
