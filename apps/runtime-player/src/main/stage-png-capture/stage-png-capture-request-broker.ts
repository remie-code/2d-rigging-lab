import { randomUUID } from "node:crypto";

import { stagePngCaptureBridgeChannels } from "../../preload/stage-png-capture-bridge-channels";
import type {
  RuntimePlayerStagePngCaptureRequest
} from "../../preload/stage-png-capture-bridge-contract";

export const runtimePlayerStagePngCaptureTimeoutMs = 10_000;

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface StagePngCaptureTargetWebContents {
  readonly id: number;
  isDestroyed(): boolean;
  send(channel: string, request: RuntimePlayerStagePngCaptureRequest): void;
  once(event: "destroyed", listener: () => void): unknown;
  removeListener(event: "destroyed", listener: () => void): unknown;
}

export interface StagePngCaptureReportSender {
  readonly id: number;
}

interface PendingStagePngCapture {
  readonly webContentsId: number;
  readonly resolve: (pngBytes: Uint8Array) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
  readonly release: () => void;
}

/**
 * The main → Stage → main round trip. main sends an id-tagged request; the
 * Stage answers through `reportCapture` (an invoke) with the same id. Only the
 * webContents the request went to may answer it. A request fails at once when
 * that webContents is (or becomes) destroyed, and after `timeoutMs` when nobody
 * answers.
 */
export class StagePngCaptureRequestBroker {
  readonly #pending = new Map<string, PendingStagePngCapture>();
  readonly #timeoutMs: number;
  readonly #createRequestId: () => string;

  constructor(options: {
    readonly timeoutMs?: number;
    readonly createRequestId?: () => string;
  } = {}) {
    this.#timeoutMs = options.timeoutMs ?? runtimePlayerStagePngCaptureTimeoutMs;
    this.#createRequestId =
      options.createRequestId ?? (() => `stage-png-${randomUUID()}`);
  }

  request(webContents: StagePngCaptureTargetWebContents): Promise<Uint8Array> {
    if (webContents.isDestroyed()) {
      return Promise.reject(new Error("Stage Window is not available."));
    }

    const requestId = this.#createRequestId();

    return new Promise<Uint8Array>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#settle(requestId)?.reject(
          new Error("Stage Window did not answer in time.")
        );
      }, this.#timeoutMs);
      // Closing the Stage Window mid-capture should not wait out the timeout.
      const handleDestroyed = (): void => {
        this.#settle(requestId)?.reject(
          new Error("Stage Window closed before the capture finished.")
        );
      };
      webContents.once("destroyed", handleDestroyed);

      this.#pending.set(requestId, {
        webContentsId: webContents.id,
        resolve,
        reject,
        timer,
        release: () => {
          webContents.removeListener("destroyed", handleDestroyed);
        }
      });

      try {
        webContents.send(stagePngCaptureBridgeChannels.captureRequested, {
          requestId
        });
      } catch (error) {
        this.#settle(requestId)?.reject(
          new Error(`Stage Window could not be asked: ${toErrorMessage(error)}`)
        );
      }
    });
  }

  /** Handles one Stage → main answer. Unknown or foreign answers are ignored. */
  handleReport(sender: StagePngCaptureReportSender, report: unknown): void {
    if (!isRecord(report) || typeof report.requestId !== "string") {
      return;
    }

    const pending = this.#pending.get(report.requestId);
    if (pending === undefined || pending.webContentsId !== sender.id) {
      return;
    }

    this.#settle(report.requestId);

    if (report.result === "ok") {
      if (!isPngBytes(report.pngBytes)) {
        pending.reject(new Error("Stage Window returned bytes that are not a PNG."));
        return;
      }

      pending.resolve(report.pngBytes);
      return;
    }

    pending.reject(
      new Error(
        typeof report.message === "string" && report.message.length > 0
          ? report.message
          : "Stage Window could not read the canvas."
      )
    );
  }

  getPendingRequestCount(): number {
    return this.#pending.size;
  }

  #settle(requestId: string): PendingStagePngCapture | undefined {
    const pending = this.#pending.get(requestId);
    if (pending === undefined) {
      return undefined;
    }

    clearTimeout(pending.timer);
    pending.release();
    this.#pending.delete(requestId);
    return pending;
  }
}

function isPngBytes(value: unknown): value is Uint8Array {
  return (
    value instanceof Uint8Array &&
    value.byteLength > pngSignature.length &&
    pngSignature.every((byte, index) => value[index] === byte)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
