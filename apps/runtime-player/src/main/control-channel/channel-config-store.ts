import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createControlChannelToken } from "./channel-token";
import { runtimePlayerControlChannelDefaultPort } from "./channel-slot-ports";

/**
 * Control Channel per-slot config store (C4 §3.1, 裁定3). A parallel duplicate of
 * the Browser Source config store: the channel persists its OWN token +
 * preferred port to its OWN file (`channel/channel-config.json` under the slot's
 * userData), fully independent from Browser Source's
 * `browser-source/browser-source-config.json`. Neither subsystem's secret
 * touches the other's file.
 */

export const runtimePlayerControlChannelConfigSchemaVersion =
  "runtime-player-control-channel-config-v1" as const;

export type RuntimePlayerControlChannelConfigDocument = {
  readonly schemaVersion: typeof runtimePlayerControlChannelConfigSchemaVersion;
  readonly updatedAtIso: string;
  readonly token: string;
  readonly preferredPort: number;
};

export type RuntimePlayerControlChannelConfig = {
  readonly token: string;
  readonly preferredPort: number;
};

export type RuntimePlayerControlChannelConfigStoreOptions = {
  readonly userDataPath?: string;
  readonly configFilePath?: string;
  readonly createToken?: () => string;
  readonly nowIso?: () => string;
  /**
   * Preferred port to persist the first time this slot's config is created.
   * Defaults to the fixed channel default port. Later runs reuse the persisted
   * port, so this factory only runs once per slot. Custom autonomous slots pass
   * an async `findFreeLoopbackPort`.
   */
  readonly createPreferredPort?: () => number | Promise<number>;
};

export class RuntimePlayerControlChannelConfigStore {
  readonly #configFilePath: string;
  readonly #createToken: () => string;
  readonly #nowIso: () => string;
  readonly #createPreferredPort: () => number | Promise<number>;
  #document: RuntimePlayerControlChannelConfigDocument | null = null;

  constructor(options: RuntimePlayerControlChannelConfigStoreOptions) {
    if (options.configFilePath !== undefined) {
      this.#configFilePath = options.configFilePath;
    } else {
      if (options.userDataPath === undefined) {
        throw new Error(
          "RuntimePlayerControlChannelConfigStore requires userDataPath or configFilePath."
        );
      }

      this.#configFilePath = path.join(
        options.userDataPath,
        "channel",
        "channel-config.json"
      );
    }

    this.#createToken = options.createToken ?? createControlChannelToken;
    this.#nowIso = options.nowIso ?? (() => new Date().toISOString());
    this.#createPreferredPort =
      options.createPreferredPort ??
      (() => runtimePlayerControlChannelDefaultPort);
  }

  getConfigFilePath(): string {
    return this.#configFilePath;
  }

  async getOrCreateConfig(): Promise<RuntimePlayerControlChannelConfig> {
    if (this.#document !== null) {
      return toConfig(this.#document);
    }

    const persisted = await this.#readPersistedDocument();
    if (persisted !== null) {
      this.#document = persisted;
      return toConfig(persisted);
    }

    const document = await this.#createDocument();
    await this.#saveDocument(document);
    return toConfig(document);
  }

  async #readPersistedDocument():
    Promise<RuntimePlayerControlChannelConfigDocument | null> {
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

    return parseRuntimePlayerControlChannelConfigDocument(parsedJson);
  }

  async #createDocument(): Promise<RuntimePlayerControlChannelConfigDocument> {
    const preferredPort = await this.#createPreferredPort();
    return {
      schemaVersion: runtimePlayerControlChannelConfigSchemaVersion,
      updatedAtIso: this.#nowIso(),
      token: this.#createToken(),
      preferredPort
    };
  }

  async #saveDocument(
    document: RuntimePlayerControlChannelConfigDocument
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

export function parseRuntimePlayerControlChannelConfigDocument(
  value: unknown
): RuntimePlayerControlChannelConfigDocument | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.schemaVersion !== runtimePlayerControlChannelConfigSchemaVersion) {
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
    schemaVersion: runtimePlayerControlChannelConfigSchemaVersion,
    updatedAtIso,
    token,
    preferredPort: parsePort(value.preferredPort)
  };
}

function toConfig(
  document: RuntimePlayerControlChannelConfigDocument
): RuntimePlayerControlChannelConfig {
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
    : runtimePlayerControlChannelDefaultPort;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
