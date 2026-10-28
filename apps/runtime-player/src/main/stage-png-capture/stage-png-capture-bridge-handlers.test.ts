import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  ipcMainHandle: vi.fn(),
  shellOpenPath: vi.fn()
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: electronMocks.ipcMainHandle
  },
  shell: {
    openPath: electronMocks.shellOpenPath
  }
}));

import type { RuntimeExportStatus } from "../../preload/runtime-export-bridge-contract";
import { stagePngCaptureBridgeChannels } from "../../preload/stage-png-capture-bridge-channels";
import type {
  RuntimePlayerStagePngCaptureFolderResult,
  RuntimePlayerStagePngCaptureRequest,
  RuntimePlayerStagePngCaptureResult
} from "../../preload/stage-png-capture-bridge-contract";
import { registerStagePngCaptureBridgeHandlers } from "./stage-png-capture-bridge-handlers";
import { StagePngCaptureRequestBroker } from "./stage-png-capture-request-broker";

type IpcHandler = (event?: unknown, ...args: unknown[]) => unknown;

const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01
]);

let handlers: Map<string, IpcHandler>;
let tempRoot: string;

beforeEach(async () => {
  handlers = new Map();
  electronMocks.ipcMainHandle.mockReset();
  electronMocks.ipcMainHandle.mockImplementation(
    (channel: string, handler: IpcHandler) => {
      handlers.set(channel, handler);
    }
  );
  electronMocks.shellOpenPath.mockReset();
  electronMocks.shellOpenPath.mockResolvedValue("");
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "runtime-player-png-"));
});

afterEach(async () => {
  vi.useRealTimers();
  await rm(tempRoot, { recursive: true, force: true });
});

describe("registerStagePngCaptureBridgeHandlers", () => {
  it("asks the Stage, saves its PNG under the folder name, and reports the file", async () => {
    const harness = createHarness({
      answer: (request) => ({
        requestId: request.requestId,
        result: "ok",
        pngBytes
      })
    });

    const result = await invoke<RuntimePlayerStagePngCaptureResult>(
      stagePngCaptureBridgeChannels.capturePng
    );

    expect(harness.stageWindow.webContents.send).toHaveBeenCalledWith(
      stagePngCaptureBridgeChannels.captureRequested,
      { requestId: expect.any(String) }
    );
    expect(result).toMatchObject({
      result: "ok",
      message: "Stage PNG saved: astra-chan-runtime-20261028-153012.png",
      fileName: "astra-chan-runtime-20261028-153012.png",
      filePath: path.join(
        harness.folderPath,
        "astra-chan-runtime-20261028-153012.png"
      )
    });
    expect(new Uint8Array(await readFile(result.filePath ?? ""))).toEqual(
      pngBytes
    );
  });

  it("does not overwrite when captured twice in the same second", async () => {
    createHarness({
      answer: (request) => ({
        requestId: request.requestId,
        result: "ok",
        pngBytes
      })
    });

    const first = await invoke<RuntimePlayerStagePngCaptureResult>(
      stagePngCaptureBridgeChannels.capturePng
    );
    const second = await invoke<RuntimePlayerStagePngCaptureResult>(
      stagePngCaptureBridgeChannels.capturePng
    );

    expect(first.fileName).toBe("astra-chan-runtime-20261028-153012.png");
    expect(second.fileName).toBe("astra-chan-runtime-20261028-153012-2.png");
  });

  it("refuses without a loaded model and does not ask the Stage", async () => {
    const harness = createHarness({
      runtimeExportStatus: {
        status: "empty",
        loaded: false,
        statusLabel: "No Runtime Export loaded"
      }
    });

    const result = await invoke<RuntimePlayerStagePngCaptureResult>(
      stagePngCaptureBridgeChannels.capturePng
    );

    expect(result).toMatchObject({
      result: "error",
      message: "Capture PNG needs a loaded model.",
      fileName: null,
      filePath: null
    });
    expect(harness.stageWindow.webContents.send).not.toHaveBeenCalled();
  });

  it("refuses when the Stage Window is gone", async () => {
    const harness = createHarness({ stageWindowDestroyed: true });

    const result = await invoke<RuntimePlayerStagePngCaptureResult>(
      stagePngCaptureBridgeChannels.capturePng
    );

    expect(result).toMatchObject({
      result: "error",
      message: "Stage Window is not available."
    });
    expect(harness.stageWindow.webContents.send).not.toHaveBeenCalled();
  });

  it("fails with a reason when the Stage does not answer in time", async () => {
    vi.useFakeTimers();
    const harness = createHarness({ timeoutMs: 300 });

    const pending = invoke<RuntimePlayerStagePngCaptureResult>(
      stagePngCaptureBridgeChannels.capturePng
    );
    await vi.advanceTimersByTimeAsync(300);
    const result = await pending;

    expect(result).toMatchObject({
      result: "error",
      message: "Stage PNG capture failed: Stage Window did not answer in time.",
      fileName: null
    });
    await expect(stat(harness.folderPath)).rejects.toThrow();
  });

  it("passes the Stage's failure reason through", async () => {
    createHarness({
      answer: (request) => ({
        requestId: request.requestId,
        result: "error",
        message: "Stage renderer is unavailable."
      })
    });

    const result = await invoke<RuntimePlayerStagePngCaptureResult>(
      stagePngCaptureBridgeChannels.capturePng
    );

    expect(result).toMatchObject({
      result: "error",
      message: "Stage PNG capture failed: Stage renderer is unavailable."
    });
  });

  it("Open Folder creates the folder before opening it", async () => {
    const harness = createHarness();

    const result = await invoke<RuntimePlayerStagePngCaptureFolderResult>(
      stagePngCaptureBridgeChannels.openFolder
    );

    expect((await stat(harness.folderPath)).isDirectory()).toBe(true);
    expect(electronMocks.shellOpenPath).toHaveBeenCalledWith(harness.folderPath);
    expect(result).toMatchObject({
      result: "ok",
      message: `Capture folder opened: ${harness.folderPath}`,
      folderPath: harness.folderPath
    });
  });

  it("Open Folder reports the shell's error message", async () => {
    createHarness();
    electronMocks.shellOpenPath.mockResolvedValue("Access is denied.");

    const result = await invoke<RuntimePlayerStagePngCaptureFolderResult>(
      stagePngCaptureBridgeChannels.openFolder
    );

    expect(result).toMatchObject({
      result: "error",
      message: "Capture folder could not be opened: Access is denied."
    });
  });
});

function createHarness(options: {
  readonly runtimeExportStatus?: RuntimeExportStatus;
  readonly stageWindowDestroyed?: boolean;
  readonly timeoutMs?: number;
  readonly answer?: (request: RuntimePlayerStagePngCaptureRequest) => unknown;
} = {}) {
  const folderPath = path.join(tempRoot, "Pictures", "Runtime Player");
  const webContents = {
    id: 41,
    isDestroyed: vi.fn(() => false),
    once: vi.fn(),
    removeListener: vi.fn(),
    send: vi.fn(
      (channel: string, request: RuntimePlayerStagePngCaptureRequest) => {
        const answer = options.answer;
        if (
          answer === undefined ||
          channel !== stagePngCaptureBridgeChannels.captureRequested
        ) {
          return;
        }

        // The Stage answers on a later task, through its own invoke.
        queueMicrotask(() => {
          void handlers.get(stagePngCaptureBridgeChannels.reportCapture)?.(
            { sender: { id: 41 } },
            answer(request)
          );
        });
      }
    )
  };
  const stageWindow = {
    isDestroyed: vi.fn(() => options.stageWindowDestroyed ?? false),
    webContents
  };

  registerStagePngCaptureBridgeHandlers({
    windows: {
      stageWindow: stageWindow as never
    },
    getRuntimeExportStatus: () =>
      options.runtimeExportStatus ?? createLoadedStatus(),
    getCaptureFolderPath: () => folderPath,
    broker: new StagePngCaptureRequestBroker({
      timeoutMs: options.timeoutMs ?? 1_000
    }),
    now: () => new Date(2026, 9, 28, 15, 30, 12)
  });

  return { folderPath, stageWindow };
}

function createLoadedStatus(): RuntimeExportStatus {
  return {
    status: "loaded",
    loaded: true,
    statusLabel: "Runtime Export loaded",
    directoryPath:
      "C:\\workspace\\remie\\rigging\\astra-chan\\exports\\astra-chan-runtime",
    loadedAtIso: "2026-10-28T06:00:00.000Z",
    summary: {} as never,
    operation: "manual-open"
  };
}

async function invoke<TResult>(channel: string): Promise<TResult> {
  const handler = handlers.get(channel);
  if (handler === undefined) {
    throw new Error(`No handler for ${channel}`);
  }

  return (await handler({ sender: { id: 41 } })) as TResult;
}
