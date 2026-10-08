export const runtimePlayerStartupStateSchemaVersion =
  "runtime-player-startup-state-v1" as const;

export type RuntimePlayerStartupStateDocument = {
  readonly schemaVersion: typeof runtimePlayerStartupStateSchemaVersion;
  readonly updatedAtIso: string;
  readonly lastRuntimeExportDirectory: string | null;
};

export type RuntimePlayerStartupStateDocumentParseResult =
  | {
      readonly ok: true;
      readonly document: RuntimePlayerStartupStateDocument;
      readonly warningMessages: readonly string[];
    }
  | {
      readonly ok: false;
      readonly warningMessages: readonly string[];
    };

export function createEmptyRuntimePlayerStartupStateDocument(
  updatedAtIso = new Date(0).toISOString()
): RuntimePlayerStartupStateDocument {
  return {
    schemaVersion: runtimePlayerStartupStateSchemaVersion,
    updatedAtIso,
    lastRuntimeExportDirectory: null
  };
}

export function createRuntimePlayerStartupStateDocument(input: {
  readonly lastRuntimeExportDirectory: string;
  readonly updatedAtIso?: string;
}): RuntimePlayerStartupStateDocument {
  return {
    schemaVersion: runtimePlayerStartupStateSchemaVersion,
    updatedAtIso: input.updatedAtIso ?? new Date().toISOString(),
    lastRuntimeExportDirectory: input.lastRuntimeExportDirectory
  };
}

export function parseRuntimePlayerStartupStateDocument(
  value: unknown
): RuntimePlayerStartupStateDocumentParseResult {
  const warningMessages: string[] = [];

  if (!isRecord(value)) {
    return {
      ok: false,
      warningMessages: ["Startup state document must be an object."]
    };
  }

  if (value.schemaVersion !== runtimePlayerStartupStateSchemaVersion) {
    return {
      ok: false,
      warningMessages: ["Startup state document schema version is unsupported."]
    };
  }

  const updatedAtIso =
    typeof value.updatedAtIso === "string" &&
    value.updatedAtIso.trim().length > 0
      ? value.updatedAtIso
      : new Date(0).toISOString();
  const lastRuntimeExportDirectory = parseLastRuntimeExportDirectory(
    value.lastRuntimeExportDirectory,
    warningMessages
  );

  return {
    ok: true,
    document: {
      schemaVersion: runtimePlayerStartupStateSchemaVersion,
      updatedAtIso,
      lastRuntimeExportDirectory
    },
    warningMessages
  };
}

function parseLastRuntimeExportDirectory(
  value: unknown,
  warningMessages: string[]
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    warningMessages.push(
      "Last Runtime Export directory was invalid and was ignored."
    );
    return null;
  }

  const directoryPath = value.trim();
  if (directoryPath.length === 0) {
    warningMessages.push(
      "Last Runtime Export directory was empty and was ignored."
    );
    return null;
  }

  return directoryPath;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
