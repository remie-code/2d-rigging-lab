import { mkdir } from "node:fs/promises";

import { ipcMain, shell, type BrowserWindow } from "electron";

import type { RuntimeExportStatus } from "../../preload/runtime-export-bridge-contract";
import { stagePngCaptureBridgeChannels } from "../../preload/stage-png-capture-bridge-channels";
import type {
  RuntimePlayerStagePngCaptureFolderResult,
  RuntimePlayerStagePngCaptureResult
} from "../../preload/stage-png-capture-bridge-contract";
import { readStagePngCaptureBaseName } from "./stage-png-capture-file-name";
import {
  writeStagePngCaptureFile,
  type StagePngCaptureWrittenFile
} from "./stage-png-capture-file-writer";
import { StagePngCaptureRequestBroker } from "./stage-png-capture-request-broker";

export interface RegisterStagePngCaptureBridgeHandlersInput {
  readonly windows: {
    readonly stageWindow: BrowserWindow;
  };
  readonly getRuntimeExportStatus: () => RuntimeExportStatus;
  /** `Pictures\Runtime Player`; resolved per action so a failure reads as one. */
  readonly getCaptureFolderPath: () => string;
  readonly broker?: StagePngCaptureRequestBroker;
  readonly now?: () => Date;
  readonly writeCaptureFile?: (input: {
    readonly folderPath: string;
    readonly baseName: string;
    readonly capturedAt: Date;
    readonly pngBytes: Uint8Array;
  }) => Promise<StagePngCaptureWrittenFile>;
  readonly ensureFolder?: (folderPath: string) => Promise<void>;
  /** Resolves to "" on success or an error message, like `shell.openPath`. */
  readonly openPath?: (folderPath: string) => Promise<string>;
}

export function registerStagePngCaptureBridgeHandlers(
  input: RegisterStagePngCaptureBridgeHandlersInput
): void {
  const broker = input.broker ?? new StagePngCaptureRequestBroker();

  ipcMain.handle(stagePngCaptureBridgeChannels.capturePng, () =>
    captureStagePng(input, broker)
  );
  ipcMain.handle(stagePngCaptureBridgeChannels.openFolder, () =>
    openStagePngCaptureFolder(input)
  );
  ipcMain.handle(
    stagePngCaptureBridgeChannels.reportCapture,
    (event, report: unknown) => {
      broker.handleReport(event.sender, report);
    }
  );
}

async function captureStagePng(
  input: RegisterStagePngCaptureBridgeHandlersInput,
  broker: StagePngCaptureRequestBroker
): Promise<RuntimePlayerStagePngCaptureResult> {
  // Control disables Capture PNG for these too; main re-checks because the
  // state can change between the click and the invoke.
  const runtimeExportStatus = input.getRuntimeExportStatus();
  if (runtimeExportStatus.status !== "loaded") {
    return createCaptureResult({
      result: "error",
      message: "Capture PNG needs a loaded model."
    });
  }

  const stageWindow = input.windows.stageWindow;
  if (stageWindow.isDestroyed() || stageWindow.webContents.isDestroyed()) {
    return createCaptureResult({
      result: "error",
      message: "Stage Window is not available."
    });
  }

  const capturedAt = (input.now ?? (() => new Date()))();

  try {
    const pngBytes = await broker.request(stageWindow.webContents);
    const written = await (input.writeCaptureFile ?? writeStagePngCaptureFile)({
      folderPath: input.getCaptureFolderPath(),
      baseName: readStagePngCaptureBaseName(runtimeExportStatus.directoryPath),
      capturedAt,
      pngBytes
    });

    return createCaptureResult({
      result: "ok",
      message: `Stage PNG saved: ${written.fileName}`,
      file: written
    });
  } catch (error) {
    return createCaptureResult({
      result: "error",
      message: `Stage PNG capture failed: ${toErrorMessage(error)}`
    });
  }
}

async function openStagePngCaptureFolder(
  input: RegisterStagePngCaptureBridgeHandlersInput
): Promise<RuntimePlayerStagePngCaptureFolderResult> {
  let folderPath: string | null = null;

  try {
    folderPath = input.getCaptureFolderPath();
    await (input.ensureFolder ?? ensureFolder)(folderPath);
    const openPath =
      input.openPath ?? ((target: string) => shell.openPath(target));
    const openError = await openPath(folderPath);

    if (openError.length > 0) {
      return createFolderResult({
        result: "error",
        message: `Capture folder could not be opened: ${openError}`,
        folderPath
      });
    }

    return createFolderResult({
      result: "ok",
      message: `Capture folder opened: ${folderPath}`,
      folderPath
    });
  } catch (error) {
    return createFolderResult({
      result: "error",
      message: `Capture folder could not be opened: ${toErrorMessage(error)}`,
      folderPath
    });
  }
}

async function ensureFolder(folderPath: string): Promise<void> {
  await mkdir(folderPath, { recursive: true });
}

function createCaptureResult(input: {
  readonly result: RuntimePlayerStagePngCaptureResult["result"];
  readonly message: string;
  readonly file?: StagePngCaptureWrittenFile;
}): RuntimePlayerStagePngCaptureResult {
  return {
    result: input.result,
    message: input.message,
    fileName: input.file?.fileName ?? null,
    filePath: input.file?.filePath ?? null,
    atIso: new Date().toISOString()
  };
}

function createFolderResult(input: {
  readonly result: RuntimePlayerStagePngCaptureFolderResult["result"];
  readonly message: string;
  readonly folderPath: string | null;
}): RuntimePlayerStagePngCaptureFolderResult {
  return {
    result: input.result,
    message: input.message,
    folderPath: input.folderPath,
    atIso: new Date().toISOString()
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
