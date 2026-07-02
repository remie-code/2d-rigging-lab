import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import {
  runtimePlayerBrowserSourceProtocolVersion,
  type RuntimePlayerBrowserSourceRuntimeExportPayload,
  type RuntimePlayerBrowserSourceRuntimeExportResponse,
  type RuntimePlayerBrowserSourceServerMessage
} from "../../preload/browser-source-transport-contract";
import type {
  RuntimePlayerBrowserSourceStageDisplayState,
  RuntimePlayerBrowserSourceRuntimeExportStatus
} from "../../preload/browser-source-status-contract";
import {
  runtimePlayerActiveVariantSelectionSchemaVersion,
  type RuntimePlayerActiveVariantSelectionState
} from "../../preload/runtime-variant-bridge-contract";
import {
  runtimePlayerEffectiveDynamicsTuningSchemaVersion,
  type RuntimePlayerDynamicsTuningGroupOverride,
  type RuntimePlayerEffectiveDynamicsTuningProfile
} from "../../preload/dynamics-tuning-bridge-contract";

const RUNTIME_EXPORT_STATUS_STATES = new Set([
  "empty",
  "loading",
  "loaded",
  "error"
]);

export function readBrowserSourceServerMessage(
  data: unknown
): RuntimePlayerBrowserSourceServerMessage | null {
  if (typeof data !== "string") {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }

  return readBrowserSourceServerMessageValue(parsed);
}

export function readBrowserSourceRuntimeExportResponse(
  value: unknown
): RuntimePlayerBrowserSourceRuntimeExportResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const runtimeExportStatus = readRuntimeExportStatus(value.runtimeExportStatus);
  const stageDisplayState = readStageDisplayState(value.stageDisplayState);
  const activeVariantSelection = readActiveVariantSelection(
    value.activeVariantSelection
  );
  const effectiveDynamicsTuning = readEffectiveDynamicsTuning(
    value.effectiveDynamicsTuning
  );
  if (runtimeExportStatus === null) {
    return null;
  }
  if (stageDisplayState === null) {
    return null;
  }
  if (activeVariantSelection === null) {
    return null;
  }
  if (
    effectiveDynamicsTuning === null &&
    value.effectiveDynamicsTuning !== null &&
    value.effectiveDynamicsTuning !== undefined
  ) {
    return null;
  }

  if (value.status === "not-loaded" && value.runtimeExport === null) {
    return {
      status: "not-loaded",
      runtimeExportStatus,
      stageDisplayState,
      activeVariantSelection,
      effectiveDynamicsTuning,
      runtimeExport: null
    };
  }

  if (value.status === "loaded") {
    const runtimeExport = readRuntimeExportPayload(value.runtimeExport);
    if (runtimeExport === null) {
      return null;
    }

    return {
      status: "loaded",
      runtimeExportStatus,
      stageDisplayState,
      activeVariantSelection,
      effectiveDynamicsTuning,
      runtimeExport
    };
  }

  return null;
}

function readBrowserSourceServerMessageValue(
  value: unknown
): RuntimePlayerBrowserSourceServerMessage | null {
  if (
    !isRecord(value) ||
    value.protocolVersion !== runtimePlayerBrowserSourceProtocolVersion ||
    typeof value.type !== "string" ||
    typeof value.sentAtIso !== "string"
  ) {
    return null;
  }

  if (value.type === "browser-source-server-hello") {
    return {
      type: "browser-source-server-hello",
      protocolVersion: runtimePlayerBrowserSourceProtocolVersion,
      sentAtIso: value.sentAtIso
    };
  }

  if (value.type === "runtime-export-resync") {
    const runtimeExportStatus = readRuntimeExportStatus(value.runtimeExportStatus);
    const runtimeExport = value.runtimeExport === null
      ? null
      : readRuntimeExportPayload(value.runtimeExport);
    const latestFrame = value.latestFrame === null
      ? null
      : readLiveParameterFrame(value.latestFrame);
    const stageDisplayState = readStageDisplayState(value.stageDisplayState);
    const activeVariantSelection = readActiveVariantSelection(
      value.activeVariantSelection
    );
    const effectiveDynamicsTuning = readEffectiveDynamicsTuning(
      value.effectiveDynamicsTuning
    );

    if (
      runtimeExportStatus === null ||
      runtimeExport === null && value.runtimeExport !== null ||
      latestFrame === null && value.latestFrame !== null ||
      stageDisplayState === null ||
      activeVariantSelection === null ||
      effectiveDynamicsTuning === null &&
        value.effectiveDynamicsTuning !== null &&
        value.effectiveDynamicsTuning !== undefined
    ) {
      return null;
    }

    return {
      type: "runtime-export-resync",
      protocolVersion: runtimePlayerBrowserSourceProtocolVersion,
      runtimeExport,
      runtimeExportStatus,
      latestFrame,
      stageDisplayState,
      activeVariantSelection,
      effectiveDynamicsTuning,
      sentAtIso: value.sentAtIso
    };
  }

  if (value.type === "runtime-export-changed") {
    const runtimeExportStatus = readRuntimeExportStatus(value.runtimeExportStatus);
    const runtimeExport = value.runtimeExport === null
      ? null
      : readRuntimeExportPayload(value.runtimeExport);
    const activeVariantSelection = readActiveVariantSelection(
      value.activeVariantSelection
    );
    const effectiveDynamicsTuning = readEffectiveDynamicsTuning(
      value.effectiveDynamicsTuning
    );

    if (
      runtimeExportStatus === null ||
      runtimeExport === null && value.runtimeExport !== null ||
      activeVariantSelection === null ||
      effectiveDynamicsTuning === null &&
        value.effectiveDynamicsTuning !== null &&
        value.effectiveDynamicsTuning !== undefined
    ) {
      return null;
    }

    return {
      type: "runtime-export-changed",
      protocolVersion: runtimePlayerBrowserSourceProtocolVersion,
      runtimeExport,
      runtimeExportStatus,
      activeVariantSelection,
      effectiveDynamicsTuning,
      sentAtIso: value.sentAtIso
    };
  }

  if (value.type === "dynamics-tuning-changed") {
    const effectiveDynamicsTuning = readEffectiveDynamicsTuning(
      value.effectiveDynamicsTuning
    );
    if (
      effectiveDynamicsTuning === null &&
      value.effectiveDynamicsTuning !== null
    ) {
      return null;
    }

    return {
      type: "dynamics-tuning-changed",
      protocolVersion: runtimePlayerBrowserSourceProtocolVersion,
      effectiveDynamicsTuning,
      sentAtIso: value.sentAtIso
    };
  }

  if (value.type === "active-variant-selection-changed") {
    const activeVariantSelection = readActiveVariantSelection(
      value.activeVariantSelection
    );
    if (activeVariantSelection === null) {
      return null;
    }

    return {
      type: "active-variant-selection-changed",
      protocolVersion: runtimePlayerBrowserSourceProtocolVersion,
      activeVariantSelection,
      sentAtIso: value.sentAtIso
    };
  }

  if (value.type === "live-parameter-frame") {
    const frame = readLiveParameterFrame(value.frame);
    if (frame === null) {
      return null;
    }

    return {
      type: "live-parameter-frame",
      protocolVersion: runtimePlayerBrowserSourceProtocolVersion,
      frame,
      sentAtIso: value.sentAtIso
    };
  }

  if (value.type === "live-parameter-cleared") {
    return {
      type: "live-parameter-cleared",
      protocolVersion: runtimePlayerBrowserSourceProtocolVersion,
      sentAtIso: value.sentAtIso
    };
  }

  if (value.type === "stage-display-state-changed") {
    const stageDisplayState = readStageDisplayState(value.stageDisplayState);
    if (stageDisplayState === null) {
      return null;
    }

    return {
      type: "stage-display-state-changed",
      protocolVersion: runtimePlayerBrowserSourceProtocolVersion,
      stageDisplayState,
      sentAtIso: value.sentAtIso
    };
  }

  if (value.type === "browser-source-server-heartbeat") {
    return {
      type: "browser-source-server-heartbeat",
      protocolVersion: runtimePlayerBrowserSourceProtocolVersion,
      sentAtIso: value.sentAtIso
    };
  }

  if (
    value.type === "browser-source-error" &&
    (value.errorCode === "invalid-message" ||
      value.errorCode === "unsupported-message") &&
    typeof value.message === "string"
  ) {
    return {
      type: "browser-source-error",
      protocolVersion: runtimePlayerBrowserSourceProtocolVersion,
      errorCode: value.errorCode,
      message: value.message.slice(0, 240),
      sentAtIso: value.sentAtIso
    };
  }

  return null;
}

function readRuntimeExportPayload(
  value: unknown
): RuntimePlayerBrowserSourceRuntimeExportPayload | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== "runtime-player-browser-source-runtime-export-v1" ||
    !isRecord(value.artifacts) ||
    !isRecord(value.texturePage) ||
    !isRecord(value.summary) ||
    typeof value.loadedAtIso !== "string"
  ) {
    return null;
  }

  const texturePage = value.texturePage;
  if (
    !isRecord(texturePage.metadata) ||
    texturePage.encoding !== "base64" ||
    typeof texturePage.bytesBase64 !== "string" ||
    !isFiniteNumber(texturePage.byteLength)
  ) {
    return null;
  }

  return {
    schemaVersion: "runtime-player-browser-source-runtime-export-v1",
    artifacts: value.artifacts as RuntimePlayerBrowserSourceRuntimeExportPayload["artifacts"],
    texturePage: {
      metadata: texturePage.metadata as RuntimePlayerBrowserSourceRuntimeExportPayload["texturePage"]["metadata"],
      encoding: "base64",
      bytesBase64: texturePage.bytesBase64,
      byteLength: texturePage.byteLength
    },
    summary: value.summary as RuntimePlayerBrowserSourceRuntimeExportPayload["summary"],
    loadedAtIso: value.loadedAtIso
  };
}

function readRuntimeExportStatus(
  value: unknown
): RuntimePlayerBrowserSourceRuntimeExportStatus | null {
  if (
    !isRecord(value) ||
    typeof value.state !== "string" ||
    !RUNTIME_EXPORT_STATUS_STATES.has(value.state) ||
    typeof value.loaded !== "boolean" ||
    typeof value.statusLabel !== "string" ||
    !(typeof value.loadedAtIso === "string" || value.loadedAtIso === null)
  ) {
    return null;
  }

  const summary = value.summary === null
    ? null
    : readRuntimeExportStatusSummary(value.summary);
  if (summary === null && value.summary !== null) {
    return null;
  }

  return {
    state: value.state as RuntimePlayerBrowserSourceRuntimeExportStatus["state"],
    loaded: value.loaded,
    statusLabel: value.statusLabel.slice(0, 120),
    loadedAtIso: value.loadedAtIso,
    summary
  };
}

function readEffectiveDynamicsTuning(
  value: unknown
): RuntimePlayerEffectiveDynamicsTuningProfile | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    !isRecord(value) ||
    value.schemaVersion !== runtimePlayerEffectiveDynamicsTuningSchemaVersion ||
    !isFiniteNumber(value.revision) ||
    typeof value.fingerprint !== "string" ||
    typeof value.updatedAtIso !== "string" ||
    !isRecord(value.exportIdentity) ||
    typeof value.dynamicsSignatureHash !== "string" ||
    !isRecord(value.groups)
  ) {
    return null;
  }

  const exportIdentity = readDynamicsTuningExportIdentity(
    value.exportIdentity
  );
  if (exportIdentity === null) {
    return null;
  }

  const groups: Record<string, RuntimePlayerDynamicsTuningGroupOverride> = {};
  for (const [groupId, overrideValue] of Object.entries(value.groups)) {
    if (groupId.trim().length === 0) {
      return null;
    }

    const override = readDynamicsTuningGroupOverride(overrideValue);
    if (override === null) {
      return null;
    }

    groups[groupId] = override;
  }

  return {
    schemaVersion: runtimePlayerEffectiveDynamicsTuningSchemaVersion,
    revision: value.revision,
    fingerprint: value.fingerprint,
    updatedAtIso: value.updatedAtIso,
    exportIdentity,
    dynamicsSignatureHash: value.dynamicsSignatureHash,
    groups
  };
}

function readDynamicsTuningExportIdentity(
  value: Record<string, unknown>
): RuntimePlayerEffectiveDynamicsTuningProfile["exportIdentity"] | null {
  if (
    typeof value.packageId !== "string" ||
    !isFiniteNumber(value.packageRevision) ||
    typeof value.parameterSignatureHash !== "string"
  ) {
    return null;
  }

  if (
    value.packageHash !== undefined &&
    typeof value.packageHash !== "string"
  ) {
    return null;
  }

  return {
    packageId: value.packageId,
    packageRevision: value.packageRevision,
    ...(value.packageHash === undefined
      ? {}
      : { packageHash: value.packageHash }),
    parameterSignatureHash: value.parameterSignatureHash
  };
}

function readDynamicsTuningGroupOverride(
  value: unknown
): RuntimePlayerDynamicsTuningGroupOverride | null {
  if (!isRecord(value)) {
    return null;
  }

  const enabled = readOptionalBoolean(value.enabled);
  const strength = readOptionalFiniteNumber(value.strength);
  const limit = readOptionalNonNegativeNumber(value.limit);
  const length = readOptionalPositiveNumber(value.length);
  const sway = readOptionalNonNegativeNumber(value.sway);
  const reactionSpeed = readOptionalNonNegativeNumber(value.reactionSpeed);
  const convergenceSpeed = readOptionalNonNegativeNumber(
    value.convergenceSpeed
  );

  if (
    enabled === null ||
    strength === null ||
    limit === null ||
    length === null ||
    sway === null ||
    reactionSpeed === null ||
    convergenceSpeed === null
  ) {
    return null;
  }

  return {
    ...(enabled === undefined ? {} : { enabled }),
    ...(strength === undefined ? {} : { strength }),
    ...(limit === undefined ? {} : { limit }),
    ...(length === undefined ? {} : { length }),
    ...(sway === undefined ? {} : { sway }),
    ...(reactionSpeed === undefined ? {} : { reactionSpeed }),
    ...(convergenceSpeed === undefined ? {} : { convergenceSpeed })
  };
}

function readOptionalBoolean(value: unknown): boolean | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === "boolean" ? value : null;
}

function readOptionalFiniteNumber(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return isFiniteNumber(value) ? value : null;
}

function readOptionalNonNegativeNumber(
  value: unknown
): number | null | undefined {
  const numberValue = readOptionalFiniteNumber(value);
  if (numberValue === undefined || numberValue === null) {
    return numberValue;
  }

  return numberValue >= 0 ? numberValue : null;
}

function readOptionalPositiveNumber(
  value: unknown
): number | null | undefined {
  const numberValue = readOptionalFiniteNumber(value);
  if (numberValue === undefined || numberValue === null) {
    return numberValue;
  }

  return numberValue > 0 ? numberValue : null;
}

function readActiveVariantSelection(
  value: unknown
): RuntimePlayerActiveVariantSelectionState | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== runtimePlayerActiveVariantSelectionSchemaVersion ||
    !(value.state === "ready" || value.state === "disabled") ||
    !Array.isArray(value.activeSelections) ||
    !(typeof value.updatedAtIso === "string" || value.updatedAtIso === null)
  ) {
    return null;
  }

  const activeSelections = value.activeSelections.map(readActiveSelectionEntry);
  if (activeSelections.some((entry) => entry === null)) {
    return null;
  }

  return {
    schemaVersion: runtimePlayerActiveVariantSelectionSchemaVersion,
    state: value.state,
    activeSelections:
      activeSelections as RuntimePlayerActiveVariantSelectionState["activeSelections"],
    updatedAtIso: value.updatedAtIso
  };
}

function readActiveSelectionEntry(
  value: unknown
): RuntimePlayerActiveVariantSelectionState["activeSelections"][number] | null {
  if (!isRecord(value) || typeof value.variantGroupId !== "string") {
    return null;
  }

  const activeSelection = readVariantActiveSelection(value.activeSelection);
  if (activeSelection === null) {
    return null;
  }

  return {
    variantGroupId: value.variantGroupId,
    activeSelection
  };
}

function readVariantActiveSelection(
  value: unknown
): RuntimePlayerActiveVariantSelectionState["activeSelections"][number]["activeSelection"] | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.kind === "singleSelect" && typeof value.variantId === "string") {
    return {
      kind: "singleSelect",
      variantId: value.variantId
    };
  }

  if (value.kind === "multiToggle" && Array.isArray(value.variantIds)) {
    const variantIds = value.variantIds.filter((variantId): variantId is string =>
      typeof variantId === "string"
    );
    if (variantIds.length !== value.variantIds.length) {
      return null;
    }

    return {
      kind: "multiToggle",
      variantIds: [...new Set(variantIds)]
    };
  }

  return null;
}

function readRuntimeExportStatusSummary(
  value: unknown
): RuntimePlayerBrowserSourceRuntimeExportStatus["summary"] | null {
  if (
    !isRecord(value) ||
    typeof value.modelDisplayName !== "string" ||
    typeof value.packageId !== "string" ||
    !isFiniteNumber(value.packageRevision) ||
    !isFiniteNumber(value.drawableCount) ||
    !isFiniteNumber(value.meshCount) ||
    !isFiniteNumber(value.parameterCount) ||
    !isFiniteNumber(value.maskCount)
  ) {
    return null;
  }

  return {
    modelDisplayName: value.modelDisplayName,
    packageId: value.packageId,
    packageRevision: value.packageRevision,
    drawableCount: value.drawableCount,
    meshCount: value.meshCount,
    parameterCount: value.parameterCount,
    maskCount: value.maskCount
  };
}

function readStageDisplayState(
  value: unknown
): RuntimePlayerBrowserSourceStageDisplayState | null {
  if (!isRecord(value) || !isRecord(value.stageWindow) ||
    !isRecord(value.stageView) ||
    !(typeof value.updatedAtIso === "string" || value.updatedAtIso === null)) {
    return null;
  }

  const bounds = value.stageWindow.bounds === null
    ? null
    : readStageWindowBounds(value.stageWindow.bounds);
  const transform = value.stageView.transform === null
    ? null
    : readStageViewTransform(value.stageView.transform);

  if (
    bounds === null && value.stageWindow.bounds !== null ||
    transform === null && value.stageView.transform !== null
  ) {
    return null;
  }

  return {
    stageWindow: {
      bounds
    },
    stageView: {
      transform
    },
    updatedAtIso: value.updatedAtIso
  };
}

function readStageWindowBounds(
  value: unknown
): RuntimePlayerBrowserSourceStageDisplayState["stageWindow"]["bounds"] {
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

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height))
  };
}

function readStageViewTransform(
  value: unknown
): RuntimePlayerBrowserSourceStageDisplayState["stageView"]["transform"] {
  if (!isRecord(value) || value.coordinateSpace !== "stage-viewport-px-v1") {
    return null;
  }

  const zoomScale = readPositiveNumber(value.zoomScale);
  const pan = isRecord(value.pan)
    ? {
        x: readFiniteNumber(value.pan.x),
        y: readFiniteNumber(value.pan.y)
      }
    : null;

  if (
    zoomScale === null ||
    pan === null ||
    pan.x === null ||
    pan.y === null
  ) {
    return null;
  }

  return {
    zoomScale,
    pan: {
      x: pan.x,
      y: pan.y
    },
    coordinateSpace: "stage-viewport-px-v1"
  };
}

function readLiveParameterFrame(
  value: unknown
): RuntimePlayerLiveParameterFrame | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== "runtime-player-live-parameter-frame-v1" ||
    !isRecord(value.runtimeExport) ||
    !isFiniteNumber(value.sequence) ||
    typeof value.producedAtIso !== "string" ||
    !isFiniteNumber(value.sourceFrameTimestampMs)
  ) {
    return null;
  }

  const runtimeExport = value.runtimeExport;
  if (
    typeof runtimeExport.packageId !== "string" ||
    !isFiniteNumber(runtimeExport.packageRevision) ||
    typeof runtimeExport.loadedAtIso !== "string"
  ) {
    return null;
  }

  const parameterValues = readFiniteNumberRecord(value.parameterValues);
  if (parameterValues === null) {
    return null;
  }

  return {
    schemaVersion: "runtime-player-live-parameter-frame-v1",
    runtimeExport: {
      packageId: runtimeExport.packageId,
      packageRevision: runtimeExport.packageRevision,
      loadedAtIso: runtimeExport.loadedAtIso
    },
    sequence: value.sequence,
    producedAtIso: value.producedAtIso,
    sourceFrameTimestampMs: value.sourceFrameTimestampMs,
    parameterValues
  };
}

function readFiniteNumberRecord(
  value: unknown
): Readonly<Record<string, number>> | null {
  if (!isRecord(value)) {
    return null;
  }

  const result: Record<string, number> = {};
  for (const [key, parameterValue] of Object.entries(value)) {
    if (!isFiniteNumber(parameterValue)) {
      continue;
    }
    result[key] = parameterValue;
  }
  return result;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readFiniteNumber(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}

function readPositiveNumber(value: unknown): number | null {
  return isFiniteNumber(value) && value > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
