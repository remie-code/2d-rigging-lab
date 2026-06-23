import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createBrowserSourceToken } from "./browser-source-token";
import { runtimePlayerBrowserSourceDefaultPort } from "./browser-source-url";

export const runtimePlayerBrowserSourceConfigSchemaVersion =
  "runtime-player-browser-source-config-v1" as const;

export type RuntimePlayerBrowserSourceConfigDocument = {
  readonly schemaVersion: typeof runtimePlayerBrowserSourceConfigSchemaVersion;
  readonly updatedAtIso: string;
  readonly token: string;
  readonly preferredPort: number;
};

export type RuntimePlayerBrowserSourceConfig = {
  readonly token: string;
  readonly preferredPort: number;
};

export type RuntimePlayerBrowserSourceConfigStoreOptions = {
  readonly userDataPath?: string;
  readonly configFilePath?: string;
  readonly createToken?: () => string;
  readonly nowIso?: () => string;
};

export class RuntimePlayerBrowserSourceConfigStore {
  readonly #configFilePath: string;
  readonly #createToken: () => string;
  readonly #nowIso: () => string;
  #document: RuntimePlayerBrowserSourceConfigDocument | null = null;

  constructor(options: RuntimePlayerBrowserSourceConfigStoreOptions) {
    if (options.configFilePath !== undefined) {
      this.#configFilePath = options.configFilePath;
    } else {
      if (options.userDataPath === undefined) {
        throw new Error(
          "RuntimePlayerBrowserSourceConfigStore requires userDataPath or configFilePath."
        );
      }

      this.#configFilePath = path.join(
        options.userDataPath,
        "browser-source",
        "browser-source-config.json"
      );
    }

    this.#createToken = options.createToken ?? createBrowserSourceToken;
    this.#nowIso = options.nowIso ?? (() => new Date().toISOString());
  }

  getConfigFilePath(): string {
    return this.#configFilePath;
  }

  async getOrCreateConfig(): Promise<RuntimePlayerBrowserSourceConfig> {
    if (this.#document !== null) {
      return toConfig(this.#document);
    }

    const persisted = await this.#readPersistedDocument();
    if (persisted !== null) {
      this.#document = persisted;
      return toConfig(persisted);
    }

    const document = this.#createDocument();
    await this.#saveDocument(document);
    return toConfig(document);
  }

  async #readPersistedDocument():
    Promise<RuntimePlayerBrowserSourceConfigDocument | null> {
    let fileText: string;

    try {
      fileText = await readFile(this.#configFilePath, "utf8");
    } catch {
      return null;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(fileText);
    } catch {
      return null;
    }

    return parseRuntimePlayerBrowserSourceConfigDocument(parsedJson);
  }

  #createDocument(): RuntimePlayerBrowserSourceConfigDocument {
    return {
      schemaVersion: runtimePlayerBrowserSourceConfigSchemaVersion,
      updatedAtIso: this.#nowIso(),
      token: this.#createToken(),
      preferredPort: runtimePlayerBrowserSourceDefaultPort
    };
  }

  async #saveDocument(
    document: RuntimePlayerBrowserSourceConfigDocument
  ): Promise<void> {
    await mkdir(path.dirname(this.#configFilePath), { recursive: true });
    await writeFile(
      this.#configFilePath,
      `${JSON.stringify(document, null, 2)}\n`,
      "utf8"
    );
    this.#document = document;
  }
}

export function parseRuntimePlayerBrowserSourceConfigDocument(
  value: unknown
): RuntimePlayerBrowserSourceConfigDocument | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.schemaVersion !== runtimePlayerBrowserSourceConfigSchemaVersion) {
    return null;
  }

  const token = parseToken(value.token);
  if (token === null) {
    return null;
  }

  const updatedAtIso =
    typeof value.updatedAtIso === "string" &&
    value.updatedAtIso.trim().length > 0
      ? value.updatedAtIso
      : new Date(0).toISOString();

  return {
    schemaVersion: runtimePlayerBrowserSourceConfigSchemaVersion,
    updatedAtIso,
    token,
    preferredPort: parsePort(value.preferredPort)
  };
}

function toConfig(
  document: RuntimePlayerBrowserSourceConfigDocument
): RuntimePlayerBrowserSourceConfig {
  return {
    token: document.token,
    preferredPort: document.preferredPort
  };
}

function parseToken(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const token = value.trim();
  return /^[A-Za-z0-9_-]{24,128}$/.test(token) ? token : null;
}

function parsePort(value: unknown): number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 65535
    ? value
    : runtimePlayerBrowserSourceDefaultPort;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
