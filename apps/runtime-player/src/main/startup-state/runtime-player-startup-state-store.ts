import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createEmptyRuntimePlayerStartupStateDocument,
  createRuntimePlayerStartupStateDocument,
  parseRuntimePlayerStartupStateDocument,
  type RuntimePlayerStartupStateDocument
} from "./runtime-player-startup-state-document";

export type RuntimePlayerStartupStateStoreLoadState =
  | "missing"
  | "loaded"
  | "read-failed";

export type RuntimePlayerStartupStateStoreSnapshot = {
  readonly document: RuntimePlayerStartupStateDocument;
  readonly state: RuntimePlayerStartupStateStoreLoadState;
  readonly warningMessages: readonly string[];
};

export type RuntimePlayerStartupStateStoreOptions = {
  readonly userDataPath?: string;
  readonly startupStateFilePath?: string;
};

export class RuntimePlayerStartupStateStore {
  private readonly startupStateFilePath: string;
  private snapshot: RuntimePlayerStartupStateStoreSnapshot | null = null;

  constructor(options: RuntimePlayerStartupStateStoreOptions) {
    if (options.startupStateFilePath !== undefined) {
      this.startupStateFilePath = options.startupStateFilePath;
      return;
    }

    if (options.userDataPath === undefined) {
      throw new Error(
        "RuntimePlayerStartupStateStore requires userDataPath or startupStateFilePath."
      );
    }

    this.startupStateFilePath = path.join(
      options.userDataPath,
      "startup-state",
      "runtime-player-startup.json"
    );
  }

  getStartupStateFilePath(): string {
    return this.startupStateFilePath;
  }

  async getSnapshot(): Promise<RuntimePlayerStartupStateStoreSnapshot> {
    if (this.snapshot !== null) {
      return this.snapshot;
    }

    this.snapshot = await this.readSnapshot();
    return this.snapshot;
  }

  async saveLastRuntimeExportDirectory(
    lastRuntimeExportDirectory: string,
    updatedAtIso?: string
  ): Promise<RuntimePlayerStartupStateStoreSnapshot> {
    return this.saveDocument(
      createRuntimePlayerStartupStateDocument({
        lastRuntimeExportDirectory,
        ...(updatedAtIso === undefined ? {} : { updatedAtIso })
      })
    );
  }

  async saveDocument(
    document: RuntimePlayerStartupStateDocument
  ): Promise<RuntimePlayerStartupStateStoreSnapshot> {
    await mkdir(path.dirname(this.startupStateFilePath), { recursive: true });
    await writeFile(
      this.startupStateFilePath,
      `${JSON.stringify(document, null, 2)}\n`,
      "utf8"
    );

    this.snapshot = {
      document,
      state: "loaded",
      warningMessages: []
    };

    return this.snapshot;
  }

  private async readSnapshot(): Promise<RuntimePlayerStartupStateStoreSnapshot> {
    let fileText: string;

    try {
      fileText = await readFile(this.startupStateFilePath, "utf8");
    } catch (error) {
      if (isNodeErrorCode(error, "ENOENT")) {
        return {
          document: createEmptyRuntimePlayerStartupStateDocument(),
          state: "missing",
          warningMessages: []
        };
      }

      return {
        document: createEmptyRuntimePlayerStartupStateDocument(),
        state: "read-failed",
        warningMessages: [
          `Startup state file could not be read: ${toErrorMessage(error)}`
        ]
      };
    }

    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(fileText);
    } catch (error) {
      return {
        document: createEmptyRuntimePlayerStartupStateDocument(),
        state: "read-failed",
        warningMessages: [
          `Startup state file contains invalid JSON: ${toErrorMessage(error)}`
        ]
      };
    }

    const parsedDocument = parseRuntimePlayerStartupStateDocument(parsedJson);

    if (!parsedDocument.ok) {
      return {
        document: createEmptyRuntimePlayerStartupStateDocument(),
        state: "read-failed",
        warningMessages: parsedDocument.warningMessages
      };
    }

    return {
      document: parsedDocument.document,
      state: "loaded",
      warningMessages: parsedDocument.warningMessages
    };
  }
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
