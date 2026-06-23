import {
  runtimePlayerStageViewCoordinateSpace,
  type RuntimePlayerStageViewTransform,
  type RuntimePlayerWindowBounds
} from "../../preload/runtime-player-bridge-contract";

export const runtimePlayerWindowStateSchemaVersion =
  "runtime-player-window-state-v1" as const;

export type RuntimePlayerWindowKey = "control" | "stage";

export type RuntimePlayerWindowStateDocument = {
  readonly schemaVersion: typeof runtimePlayerWindowStateSchemaVersion;
  readonly updatedAtIso: string;
  readonly windows: Partial<
    Record<
      RuntimePlayerWindowKey,
      {
        readonly bounds: RuntimePlayerWindowBounds;
      }
    >
  >;
  readonly stageView: {
    readonly transform: RuntimePlayerStageViewTransform;
  };
};

export type RuntimePlayerWindowStateDocumentParseResult =
  | {
      readonly ok: true;
      readonly document: RuntimePlayerWindowStateDocument;
      readonly warningMessages: readonly string[];
    }
  | {
      readonly ok: false;
      readonly warningMessages: readonly string[];
    };

export function createResetRuntimePlayerStageViewTransform(): RuntimePlayerStageViewTransform {
  return {
    zoomScale: 1,
    pan: {
      x: 0,
      y: 0
    },
    coordinateSpace: runtimePlayerStageViewCoordinateSpace
  };
}

export function centerRuntimePlayerStageViewTransform(
  transform: RuntimePlayerStageViewTransform
): RuntimePlayerStageViewTransform {
  return {
    zoomScale: transform.zoomScale,
    pan: {
      x: 0,
      y: 0
    },
    coordinateSpace: runtimePlayerStageViewCoordinateSpace
  };
}

export function createEmptyRuntimePlayerWindowStateDocument(
  updatedAtIso = new Date(0).toISOString()
): RuntimePlayerWindowStateDocument {
  return {
    schemaVersion: runtimePlayerWindowStateSchemaVersion,
    updatedAtIso,
    windows: {},
    stageView: {
      transform: createResetRuntimePlayerStageViewTransform()
    }
  };
}

export function parseRuntimePlayerWindowStateDocument(
  value: unknown
): RuntimePlayerWindowStateDocumentParseResult {
  const warningMessages: string[] = [];

  if (!isRecord(value)) {
    return {
      ok: false,
      warningMessages: ["Window state document must be an object."]
    };
  }

  if (value.schemaVersion !== runtimePlayerWindowStateSchemaVersion) {
    return {
      ok: false,
      warningMessages: ["Window state document schema version is unsupported."]
    };
  }

  const updatedAtIso =
    typeof value.updatedAtIso === "string" &&
    value.updatedAtIso.trim().length > 0
      ? value.updatedAtIso
      : new Date(0).toISOString();
  const windows = parseWindows(value.windows, warningMessages);
  const transform = parseRuntimePlayerStageViewTransform(
    isRecord(value.stageView) ? value.stageView.transform : undefined
  );

  if (transform === null && value.stageView !== undefined) {
    warningMessages.push(
      "Stage view transform was invalid and was reset."
    );
  }

  return {
    ok: true,
    document: {
      schemaVersion: runtimePlayerWindowStateSchemaVersion,
      updatedAtIso,
      windows,
      stageView: {
        transform: transform ?? createResetRuntimePlayerStageViewTransform()
      }
    },
    warningMessages
  };
}

export function parseRuntimePlayerStageViewTransform(
  value: unknown
): RuntimePlayerStageViewTransform | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.coordinateSpace !== runtimePlayerStageViewCoordinateSpace) {
    return null;
  }

  const zoomScale = readPositiveNumber(value.zoomScale);
  const pan = parsePan(value.pan);

  if (zoomScale === null || pan === null) {
    return null;
  }

  return {
    zoomScale,
    pan,
    coordinateSpace: runtimePlayerStageViewCoordinateSpace
  };
}

export function normalizeRuntimePlayerStageViewTransform(
  value: unknown
): RuntimePlayerStageViewTransform {
  return parseRuntimePlayerStageViewTransform(value) ??
    createResetRuntimePlayerStageViewTransform();
}

export function normalizeWindowBounds(
  value: RuntimePlayerWindowBounds
): RuntimePlayerWindowBounds {
  return {
    x: Math.round(value.x),
    y: Math.round(value.y),
    width: Math.max(1, Math.round(value.width)),
    height: Math.max(1, Math.round(value.height))
  };
}

function parseWindows(
  value: unknown,
  warningMessages: string[]
): RuntimePlayerWindowStateDocument["windows"] {
  if (!isRecord(value)) {
    return {};
  }

  return {
    ...parseWindowRecord(value, "control", warningMessages),
    ...parseWindowRecord(value, "stage", warningMessages)
  };
}

function parseWindowRecord(
  value: Record<string, unknown>,
  key: RuntimePlayerWindowKey,
  warningMessages: string[]
): RuntimePlayerWindowStateDocument["windows"] {
  const windowValue = value[key];
  if (windowValue === undefined) {
    return {};
  }

  if (!isRecord(windowValue)) {
    warningMessages.push(`${key} window state was invalid and was ignored.`);
    return {};
  }

  const bounds = parseWindowBounds(windowValue.bounds);
  if (bounds === null) {
    warningMessages.push(`${key} window bounds were invalid and were ignored.`);
    return {};
  }

  return {
    [key]: {
      bounds
    }
  };
}

function parseWindowBounds(
  value: unknown
): RuntimePlayerWindowBounds | null {
  if (!isRecord(value)) {
    return null;
  }

  const x = readFiniteNumber(value.x);
  const y = readFiniteNumber(value.y);
  const width = readPositiveNumber(value.width);
  const height = readPositiveNumber(value.height);

  if (x === null || y === null || width === null || height === null) {
    return null;
  }

  return normalizeWindowBounds({
    x,
    y,
    width,
    height
  });
}

function parsePan(
  value: unknown
): RuntimePlayerStageViewTransform["pan"] | null {
  if (!isRecord(value)) {
    return null;
  }

  const x = readFiniteNumber(value.x);
  const y = readFiniteNumber(value.y);

  if (x === null || y === null) {
    return null;
  }

  return { x, y };
}

function readPositiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
