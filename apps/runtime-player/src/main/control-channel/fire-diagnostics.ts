import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Temporary, local-only trace for correlating Soul Fire observations with the
 * Runtime Player's Control Channel. Records deliberately contain only timing,
 * identifiers, sizes, enumerated outcomes, and close metadata: never tokens,
 * request bodies, speech text, or binary frame contents.
 */
export const runtimePlayerControlChannelDiagnosticRelativePath = path.join(
  "ai-cohost-fire-diagnostics",
  "runtime-player",
  "control-channel.jsonl"
);

export type RuntimePlayerControlChannelDiagnosticEvent = {
  readonly event: string;
  readonly connectionId?: string;
  readonly connectionGeneration?: number;
  readonly requestId?: string;
  readonly requestKind?: string;
  readonly requestBytes?: number;
  readonly result?: "accepted" | "rejected" | "ignored";
  readonly rejectionCode?: string;
  readonly frameOpcode?: number;
  readonly frameFinal?: boolean;
  readonly framePayloadBytes?: number;
  readonly bufferedBytes?: number;
  readonly chunkBytes?: number;
  readonly closeReason?: string;
  readonly terminalEvent?: string;
  readonly connectionDurationMs?: number;
  readonly port?: number;
};

export type RuntimePlayerControlChannelDiagnosticSink = {
  readonly record: (event: RuntimePlayerControlChannelDiagnosticEvent) => void;
};

export const noOpRuntimePlayerControlChannelDiagnosticSink:
  RuntimePlayerControlChannelDiagnosticSink = {
    record: () => undefined
  };

export class RuntimePlayerControlChannelDiagnosticLog implements
  RuntimePlayerControlChannelDiagnosticSink {
  readonly #filePath: string;
  readonly #wallNowMs: () => number;
  readonly #monotonicNowMs: () => number;
  #pendingWrite: Promise<void> = Promise.resolve();
  #enabled: boolean;

  private constructor(input: {
    readonly filePath: string;
    readonly enabled: boolean;
    readonly wallNowMs?: () => number;
    readonly monotonicNowMs?: () => number;
  }) {
    this.#filePath = input.filePath;
    this.#enabled = input.enabled;
    this.#wallNowMs = input.wallNowMs ?? Date.now;
    this.#monotonicNowMs = input.monotonicNowMs ?? (() => performance.now());
  }

  static async create(input: {
    readonly userDataPath: string;
    readonly wallNowMs?: () => number;
    readonly monotonicNowMs?: () => number;
  }): Promise<RuntimePlayerControlChannelDiagnosticLog> {
    const filePath = path.join(
      input.userDataPath,
      runtimePlayerControlChannelDiagnosticRelativePath
    );

    try {
      await mkdir(path.dirname(filePath), { recursive: true });
      // Bounded retention: one current-process file only. Starting a Runtime
      // Player process replaces an earlier run rather than accumulating logs.
      await writeFile(filePath, "", "utf8");
      return new RuntimePlayerControlChannelDiagnosticLog({
        filePath,
        enabled: true,
        ...(input.wallNowMs === undefined
          ? {}
          : { wallNowMs: input.wallNowMs }),
        ...(input.monotonicNowMs === undefined
          ? {}
          : { monotonicNowMs: input.monotonicNowMs })
      });
    } catch {
      // Diagnostics are passive. A read-only/full/missing app-data location must
      // never prevent Runtime Player or Control Channel operation.
      return new RuntimePlayerControlChannelDiagnosticLog({
        filePath,
        enabled: false,
        ...(input.wallNowMs === undefined
          ? {}
          : { wallNowMs: input.wallNowMs }),
        ...(input.monotonicNowMs === undefined
          ? {}
          : { monotonicNowMs: input.monotonicNowMs })
      });
    }
  }

  getFilePath(): string {
    return this.#filePath;
  }

  record(event: RuntimePlayerControlChannelDiagnosticEvent): void {
    if (!this.#enabled) {
      return;
    }

    let line: string;
    try {
      line = `${JSON.stringify({
        schema: "runtime-player-control-channel-diagnostic-v1",
        atIso: new Date(this.#wallNowMs()).toISOString(),
        monotonicMs: this.#monotonicNowMs(),
        ...event
      })}\n`;
    } catch {
      return;
    }

    this.#pendingWrite = this.#pendingWrite
      .catch(() => undefined)
      .then(async () => {
        try {
          await appendFile(this.#filePath, line, "utf8");
        } catch {
          // A later write may still succeed; retaining the trace is best effort.
        }
      });
  }

  /** Test/lifecycle seam only; no production operation waits on diagnostics. */
  async flush(): Promise<void> {
    await this.#pendingWrite;
  }
}
