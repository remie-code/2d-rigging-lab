import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createEmptyRuntimePlayerWindowStateDocument,
  parseRuntimePlayerWindowStateDocument,
  type RuntimePlayerWindowStateDocument
} from "./window-state-document";

export type RuntimePlayerWindowStateStoreLoadState =
  | "missing"
  | "loaded"
  | "read-failed";

export type RuntimePlayerWindowStateStoreSnapshot = {
  readonly document: RuntimePlayerWindowStateDocument;
  readonly state: RuntimePlayerWindowStateStoreLoadState;
  readonly warningMessages: readonly string[];
};

export type RuntimePlayerWindowStateStoreOptions = {
  readonly userDataPath?: string;
  readonly windowStateFilePath?: string;
};

export class RuntimePlayerWindowStateStore {
  private readonly windowStateFilePath: string;
  private snapshot: RuntimePlayerWindowStateStoreSnapshot | null = null;

  constructor(options: RuntimePlayerWindowStateStoreOptions) {
    if (options.windowStateFilePath !== undefined) {
      this.windowStateFilePath = options.windowStateFilePath;
      return;
    }

    if (options.userDataPath === undefined) {
      throw new Error(
        "RuntimePlayerWindowStateStore requires userDataPath or windowStateFilePath."
      );
    }

    this.windowStateFilePath = path.join(
      options.userDataPath,
      "window-state",
      "runtime-player.json"
    );
  }

  getWindowStateFilePath(): string {
    return this.windowStateFilePath;
  }

  async getSnapshot(): Promise<RuntimePlayerWindowStateStoreSnapshot> {
    if (this.snapshot !== null) {
      return this.snapshot;
    }

    this.snapshot = await this.readSnapshot();
    return this.snapshot;
  }

  async saveDocument(
    document: RuntimePlayerWindowStateDocument
  ): Promise<RuntimePlayerWindowStateStoreSnapshot> {
    await mkdir(path.dirname(this.windowStateFilePath), { recursive: true });
    await writeFile(
      this.windowStateFilePath,
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

  private async readSnapshot(): Promise<RuntimePlayerWindowStateStoreSnapshot> {
    let fileText: string;

    try {
      fileText = await readFile(this.windowStateFilePath, "utf8");
    } catch (error) {
      if (isNodeErrorCode(error, "ENOENT")) {
        return {
          document: createEmptyRuntimePlayerWindowStateDocument(),
          state: "missing",
          warningMessages: []
        };
      }

      return {
        document: createEmptyRuntimePlayerWindowStateDocument(),
        state: "read-failed",
        warningMessages: [
          `Window state file could not be read: ${toErrorMessage(error)}`
        ]
      };
    }

    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(fileText);
    } catch (error) {
      return {
        document: createEmptyRuntimePlayerWindowStateDocument(),
        state: "read-failed",
        warningMessages: [
          `Window state file contains invalid JSON: ${toErrorMessage(error)}`
        ]
      };
    }

    const parsedDocument = parseRuntimePlayerWindowStateDocument(parsedJson);

    if (!parsedDocument.ok) {
      return {
        document: createEmptyRuntimePlayerWindowStateDocument(),
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
