import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  ipcMainHandle: vi.fn(),
  showOpenDialog: vi.fn()
}));

vi.mock("electron", () => ({
  dialog: {
    showOpenDialog: electronMocks.showOpenDialog
  },
  ipcMain: {
    handle: electronMocks.ipcMainHandle
  }
}));

import { runtimeExportBridgeChannels } from "../../preload/runtime-export-bridge-channels";
import type {
  RuntimeExportLoadedPayload,
  RuntimeExportOpenDirectoryResult,
  RuntimeExportRestoreLastDirectoryResult,
  RuntimeExportSummary
} from "../../preload/runtime-export-bridge-contract";
import { RuntimePlayerStartupStateStore } from "../startup-state/runtime-player-startup-state-store";
import type { RuntimePlayerWindowSet } from "../window-management/runtime-player-windows";
import { RuntimeExportLoaderError } from "./runtime-export-errors";
import { registerRuntimeExportBridgeHandlers } from "./runtime-export-bridge-handlers";

type IpcHandler = (event?: unknown, ...args: unknown[]) => unknown;

let handlers: Map<string, IpcHandler>;

beforeEach(() => {
  handlers = new Map();
  electronMocks.ipcMainHandle.mockReset();
  electronMocks.showOpenDialog.mockReset();
  electronMocks.ipcMainHandle.mockImplementation(
    (channel: string, handler: IpcHandler) => {
      handlers.set(channel, handler);
    }
  );
});

describe("registerRuntimeExportBridgeHandlers startup restore", () => {
  it("saves the last successful Runtime Export directory after manual open", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-runtime-export-")
    );
    const selectedPath = "C:/exports/manual.runtime-export";
    const payload = createLoadedPayload("Manual Model");
    const loadDirectory = vi.fn(async () => ({
      directoryPath: selectedPath,
      payload
    }));
    const startupStateStore = new RuntimePlayerStartupStateStore({
      userDataPath
    });
    const windows = createFakeWindows();

    electronMocks.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [selectedPath]
    });
    registerRuntimeExportBridgeHandlers({
      windows,
      loadDirectory,
      startupStateStore
    });

    const result = await invokeHandler<Promise<RuntimeExportOpenDirectoryResult>>(
      runtimeExportBridgeChannels.openDirectory
    );
    const snapshot = await startupStateStore.getSnapshot();

    expect(result).toMatchObject({
      result: "loaded",
      runtimeExport: {
        directoryPath: selectedPath,
        operation: "manual-open"
      }
    });
    expect(snapshot.document.lastRuntimeExportDirectory).toBe(selectedPath);
    expect(loadDirectory).toHaveBeenCalledWith(selectedPath);
    expect(windows.stageWindow.webContents.send).toHaveBeenCalledWith(
      runtimeExportBridgeChannels.loadedPayload,
      payload
    );
  });

  it("restores the saved Runtime Export directory on startup through the shared load path", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-runtime-export-")
    );
    const savedPath = "D:/exports/saved.runtime-export";
    const payload = createLoadedPayload("Restored Model");
    const onRuntimeExportLoaded = vi.fn();
    const loadDirectory = vi.fn(async () => ({
      directoryPath: savedPath,
      payload
    }));
    const startupStateStore = new RuntimePlayerStartupStateStore({
      userDataPath
    });
    const windows = createFakeWindows();
    await startupStateStore.saveLastRuntimeExportDirectory(
      savedPath,
      "2026-06-23T00:00:00.000Z"
    );

    registerRuntimeExportBridgeHandlers({
      windows,
      loadDirectory,
      startupStateStore,
      onRuntimeExportLoaded
    });

    const result = await invokeHandler<
      Promise<RuntimeExportRestoreLastDirectoryResult>
    >(runtimeExportBridgeChannels.restoreLastDirectory, { reason: "startup" });

    expect(result).toMatchObject({
      result: "loaded",
      runtimeExport: {
        statusLabel: "Runtime Export restored",
        directoryPath: savedPath,
        operation: "startup-restore"
      }
    });
    expect(onRuntimeExportLoaded).toHaveBeenCalledWith(payload);
    expect(electronMocks.showOpenDialog).not.toHaveBeenCalled();
    expect(windows.controlWindow.webContents.send).toHaveBeenCalledWith(
      runtimeExportBridgeChannels.statusChanged,
      expect.objectContaining({
        status: "loading",
        statusLabel: "Restoring Runtime Export",
        directoryPath: savedPath
      })
    );
  });

  it("reports a retry restore error without clearing the saved invalid path", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-runtime-export-")
    );
    const savedPath = "Z:/missing/saved.runtime-export";
    const startupStateStore = new RuntimePlayerStartupStateStore({
      userDataPath
    });
    await startupStateStore.saveLastRuntimeExportDirectory(
      savedPath,
      "2026-06-23T00:00:00.000Z"
    );
    const loadDirectory = vi.fn(async () => {
      throw new RuntimeExportLoaderError(
        "runtimeExport.missingArtifact",
        "Runtime Export is missing required artifact \"runtime-export.json\".",
        "runtime-export.json"
      );
    });
    const windows = createFakeWindows();

    registerRuntimeExportBridgeHandlers({
      windows,
      loadDirectory,
      startupStateStore
    });

    const result = await invokeHandler<
      Promise<RuntimeExportRestoreLastDirectoryResult>
    >(runtimeExportBridgeChannels.restoreLastDirectory, { reason: "retry" });
    const snapshot = await startupStateStore.getSnapshot();

    expect(result).toMatchObject({
      result: "error",
      runtimeExport: {
        statusLabel: "Runtime Export restore failed",
        directoryPath: savedPath,
        operation: "retry-restore",
        error: {
          code: "runtimeExport.missingArtifact",
          artifactPath: "runtime-export.json"
        }
      }
    });
    expect(snapshot.document.lastRuntimeExportDirectory).toBe(savedPath);
    expect(windows.controlWindow.webContents.send).toHaveBeenCalledWith(
      runtimeExportBridgeChannels.statusChanged,
      expect.objectContaining({
        status: "error",
        directoryPath: savedPath
      })
    );
  });

  it("reports a startup restore error without clearing the saved invalid path", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-runtime-export-")
    );
    const savedPath = "Z:/missing/startup.runtime-export";
    const startupStateStore = new RuntimePlayerStartupStateStore({
      userDataPath
    });
    await startupStateStore.saveLastRuntimeExportDirectory(
      savedPath,
      "2026-06-23T00:00:00.000Z"
    );
    const loadDirectory = vi.fn(async () => {
      throw new RuntimeExportLoaderError(
        "runtimeExport.missingArtifact",
        "Runtime Export is missing required artifact \"runtime-export.json\".",
        "runtime-export.json"
      );
    });
    const windows = createFakeWindows();

    registerRuntimeExportBridgeHandlers({
      windows,
      loadDirectory,
      startupStateStore
    });

    const result = await invokeHandler<
      Promise<RuntimeExportRestoreLastDirectoryResult>
    >(runtimeExportBridgeChannels.restoreLastDirectory, { reason: "startup" });
    const snapshot = await startupStateStore.getSnapshot();

    expect(result).toMatchObject({
      result: "error",
      runtimeExport: {
        statusLabel: "Runtime Export restore failed",
        directoryPath: savedPath,
        operation: "startup-restore",
        error: {
          code: "runtimeExport.missingArtifact",
          artifactPath: "runtime-export.json"
        }
      }
    });
    expect(snapshot.document.lastRuntimeExportDirectory).toBe(savedPath);
    expect(windows.controlWindow.webContents.send).toHaveBeenCalledWith(
      runtimeExportBridgeChannels.statusChanged,
      expect.objectContaining({
        status: "error",
        statusLabel: "Runtime Export restore failed",
        directoryPath: savedPath,
        operation: "startup-restore"
      })
    );
  });

  it("returns not-configured when no saved Runtime Export path exists", async () => {
    const startupStateStore = new RuntimePlayerStartupStateStore({
      userDataPath: await mkdtemp(
        path.join(os.tmpdir(), "runtime-player-runtime-export-")
      )
    });
    const loadDirectory = vi.fn();

    registerRuntimeExportBridgeHandlers({
      windows: createFakeWindows(),
      loadDirectory,
      startupStateStore
    });

    const result = await invokeHandler<
      Promise<RuntimeExportRestoreLastDirectoryResult>
    >(runtimeExportBridgeChannels.restoreLastDirectory, { reason: "startup" });

    expect(result).toEqual({
      result: "not-configured",
      runtimeExport: {
        status: "empty",
        loaded: false,
        statusLabel: "No Runtime Export loaded"
      }
    });
    expect(loadDirectory).not.toHaveBeenCalled();
  });
});

function invokeHandler<TResult>(
  channel: string,
  ...args: unknown[]
): TResult {
  const handler = handlers.get(channel);
  expect(handler).toBeTypeOf("function");
  return handler?.({}, ...args) as TResult;
}

function createFakeWindows(): RuntimePlayerWindowSet {
  return {
    controlWindow: createFakeWindow() as unknown as RuntimePlayerWindowSet["controlWindow"],
    stageWindow: createFakeWindow() as unknown as RuntimePlayerWindowSet["stageWindow"]
  };
}

function createFakeWindow() {
  return {
    webContents: {
      isDestroyed: vi.fn(() => false),
      send: vi.fn()
    },
    isDestroyed: vi.fn(() => false)
  };
}

function createLoadedPayload(modelDisplayName: string): RuntimeExportLoadedPayload {
  return {
    artifacts: {
      manifest: {},
      model: {},
      atlas: {}
    },
    texturePage: {
      metadata: {},
      bytes: new Uint8Array([1, 2, 3, 4])
    },
    summary: createSummary(modelDisplayName),
    loadedAtIso: "2026-06-23T01:00:00.000Z"
  } as unknown as RuntimeExportLoadedPayload;
}

function createSummary(modelDisplayName: string): RuntimeExportSummary {
  return {
    modelDisplayName,
    packageId: "pkg_fixture",
    packageRevision: 1,
    drawableCount: 1,
    meshCount: 1,
    parameterCount: 1,
    maskCount: 0,
    texturePage: {
      pageId: "atlas_page_0",
      path: "assets/textures/atlas_page_0.raw-rgba",
      width: 1,
      height: 1,
      pixelFormat: "rgba8",
      byteLength: 4
    },
    requiredCapabilities: [
      "directory-runtime-export-v0",
      "raw-rgba8-texture-pages-v1",
      "materialized-atlas-uvs-v1",
      "transparent-background-v1"
    ]
  };
}
