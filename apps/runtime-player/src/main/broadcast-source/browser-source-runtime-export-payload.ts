import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type {
  RuntimePlayerBrowserSourceRuntimeExportPayload,
  RuntimePlayerBrowserSourceRuntimeExportResponse
} from "../../preload/browser-source-transport-contract";
import type {
  RuntimePlayerBrowserSourceStageDisplayState,
  RuntimePlayerBrowserSourceRuntimeExportStatus
} from "../../preload/browser-source-status-contract";
import type {
  RuntimePlayerActiveVariantSelectionState
} from "../../preload/runtime-variant-bridge-contract";

export function toBrowserSourceRuntimeExportPayload(
  payload: RuntimeExportLoadedPayload
): RuntimePlayerBrowserSourceRuntimeExportPayload {
  return {
    schemaVersion: "runtime-player-browser-source-runtime-export-v1",
    artifacts: payload.artifacts,
    texturePage: {
      metadata: payload.texturePage.metadata,
      encoding: "base64",
      bytesBase64: Buffer.from(payload.texturePage.bytes).toString("base64"),
      byteLength: payload.texturePage.bytes.byteLength
    },
    summary: payload.summary,
    loadedAtIso: payload.loadedAtIso
  };
}

export function createBrowserSourceLoadedRuntimeExportStatus(
  payload: RuntimeExportLoadedPayload
): RuntimePlayerBrowserSourceRuntimeExportStatus {
  return {
    state: "loaded",
    loaded: true,
    statusLabel: "Runtime Export loaded",
    loadedAtIso: payload.loadedAtIso,
    summary: {
      modelDisplayName: payload.summary.modelDisplayName,
      packageId: payload.summary.packageId,
      packageRevision: payload.summary.packageRevision,
      drawableCount: payload.summary.drawableCount,
      meshCount: payload.summary.meshCount,
      parameterCount: payload.summary.parameterCount,
      maskCount: payload.summary.maskCount
    }
  };
}

export function createBrowserSourceEmptyRuntimeExportStatus(
  statusLabel = "No Runtime Export loaded"
): RuntimePlayerBrowserSourceRuntimeExportStatus {
  return {
    state: "empty",
    loaded: false,
    statusLabel,
    loadedAtIso: null,
    summary: null
  };
}

export function createBrowserSourceRuntimeExportResponse(input: {
  readonly runtimeExportStatus: RuntimePlayerBrowserSourceRuntimeExportStatus;
  readonly stageDisplayState: RuntimePlayerBrowserSourceStageDisplayState;
  readonly activeVariantSelection: RuntimePlayerActiveVariantSelectionState;
  readonly runtimeExport:
    RuntimePlayerBrowserSourceRuntimeExportPayload
    | null;
}): RuntimePlayerBrowserSourceRuntimeExportResponse {
  if (input.runtimeExport !== null) {
    return {
      status: "loaded",
      runtimeExportStatus: input.runtimeExportStatus,
      stageDisplayState: input.stageDisplayState,
      activeVariantSelection: input.activeVariantSelection,
      runtimeExport: input.runtimeExport
    };
  }

  return {
    status: "not-loaded",
    runtimeExportStatus: input.runtimeExportStatus,
    stageDisplayState: input.stageDisplayState,
    activeVariantSelection: input.activeVariantSelection,
    runtimeExport: null
  };
}
