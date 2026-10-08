import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";

export function canApplyLiveParameterFrame(
  frame: RuntimePlayerLiveParameterFrame,
  payload: RuntimeExportLoadedPayload | null
): payload is RuntimeExportLoadedPayload {
  return (
    payload !== null &&
    frame.runtimeExport.packageId === payload.summary.packageId &&
    frame.runtimeExport.packageRevision === payload.summary.packageRevision &&
    frame.runtimeExport.loadedAtIso === payload.loadedAtIso
  );
}
