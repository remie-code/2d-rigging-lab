import type { BrowserWindow } from "electron";

import { runtimeExportBridgeChannels } from "../../preload/runtime-export-bridge-channels";
import type {
  RuntimeExportErrorStatus,
  RuntimeExportLoadedPayload,
  RuntimeExportLoadedStatus,
  RuntimeExportLoadOperation,
  RuntimeExportOpenDirectoryResult,
  RuntimeExportStatus
} from "../../preload/runtime-export-bridge-contract";
import type { RuntimePlayerWindowSet } from "../window-management/runtime-player-windows";
import type {
  RuntimeExportDirectoryLoadResult
} from "./runtime-export-directory-loader";
import { toRuntimeExportLoadError } from "./runtime-export-errors";
import { RuntimeExportSessionState } from "./runtime-export-session-state";

type MaybePromise<T> = T | Promise<T>;

export type RuntimeExportDirectoryLoader = (
  directoryPath: string
) => Promise<RuntimeExportDirectoryLoadResult>;

export type RuntimeExportLifecycleCallbacks = {
  readonly onRuntimeExportChanging?: () => MaybePromise<void>;
  readonly onRuntimeExportLoaded?: (
    payload: RuntimeExportLoadedPayload
  ) => MaybePromise<void>;
  readonly onRuntimeExportCleared?: () => MaybePromise<void>;
};

export type RuntimeExportSessionLoadResult =
  | {
      readonly result: "loaded";
      readonly runtimeExport: RuntimeExportLoadedStatus;
      readonly payload: RuntimeExportLoadedPayload;
    }
  | {
      readonly result: "error";
      readonly runtimeExport: RuntimeExportErrorStatus;
    };

export async function loadRuntimeExportIntoSession(input: {
  readonly windows: RuntimePlayerWindowSet;
  readonly session: RuntimeExportSessionState;
  readonly directoryPath: string;
  readonly operation: RuntimeExportLoadOperation;
  readonly loadDirectory: RuntimeExportDirectoryLoader;
  readonly callbacks?: RuntimeExportLifecycleCallbacks;
}): Promise<RuntimeExportSessionLoadResult> {
  await input.callbacks?.onRuntimeExportChanging?.();
  broadcastStatus(
    input.windows,
    input.session.setLoading(input.directoryPath, input.operation)
  );

  try {
    const loaded = await input.loadDirectory(input.directoryPath);
    const status = input.session.setLoaded({
      directoryPath: loaded.directoryPath,
      payload: loaded.payload,
      operation: input.operation
    });

    await input.callbacks?.onRuntimeExportLoaded?.(loaded.payload);
    broadcastStatus(input.windows, status);
    sendToWindow(
      input.windows.stageWindow,
      runtimeExportBridgeChannels.loadedPayload,
      loaded.payload
    );

    return {
      result: "loaded",
      runtimeExport: status,
      payload: loaded.payload
    };
  } catch (error) {
    const status = input.session.setError({
      directoryPath: input.directoryPath,
      error: toRuntimeExportLoadError(error),
      failedAtIso: new Date().toISOString(),
      operation: input.operation
    });

    await input.callbacks?.onRuntimeExportCleared?.();
    broadcastStatus(input.windows, status);

    return {
      result: "error",
      runtimeExport: status
    };
  }
}

export function toOpenDirectoryResult(
  result: RuntimeExportSessionLoadResult
): RuntimeExportOpenDirectoryResult {
  if (result.result === "loaded") {
    return {
      result: "loaded",
      runtimeExport: result.runtimeExport
    };
  }

  return result;
}

function broadcastStatus(
  windows: RuntimePlayerWindowSet,
  status: RuntimeExportStatus
): void {
  sendToWindow(
    windows.controlWindow,
    runtimeExportBridgeChannels.statusChanged,
    status
  );
  sendToWindow(
    windows.stageWindow,
    runtimeExportBridgeChannels.statusChanged,
    status
  );
}

function sendToWindow(
  window: BrowserWindow,
  channel: string,
  payload: RuntimeExportStatus | RuntimeExportLoadedPayload
): void {
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    return;
  }

  window.webContents.send(channel, payload);
}
