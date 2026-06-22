import type {
  RuntimePlayerInputStatus
} from "../preload/input-bridge-contract";
import type {
  RuntimePlayerInputProfileStatus
} from "../preload/input-profile-bridge-contract";
import type {
  RuntimePlayerStageViewStatus
} from "../preload/runtime-player-bridge-contract";
import type {
  RuntimePlayerMappingStatus
} from "../preload/model-mapping-bridge-contract";
import type {
  RuntimeExportStatus
} from "../preload/runtime-export-bridge-contract";

export const pendingStatusLabel = "Checking Runtime Player shell";

export function isInputReceiverActive(
  status: RuntimePlayerInputStatus | null
): boolean {
  return (
    status?.connectionState === "listening" ||
    status?.connectionState === "receiving" ||
    status?.connectionState === "stale"
  );
}

export function getInputStatusPillTone(
  status: RuntimePlayerInputStatus | null
): "amber" | "teal" | "red" {
  if (status?.connectionState === "receiving") {
    return "teal";
  }

  if (status?.connectionState === "error") {
    return "red";
  }

  return "amber";
}

export function getInputStatusPillLabel(
  status: RuntimePlayerInputStatus | null
): string {
  if (status === null) {
    return "Input checking";
  }

  if (status.connectionState === "receiving") {
    return "Input receiving";
  }

  if (status.connectionState === "listening") {
    return "Input listening";
  }

  if (status.connectionState === "stale") {
    return "Input stale";
  }

  if (status.connectionState === "error") {
    return "Input error";
  }

  return "Input idle";
}

export function getInputConnectionLabel(
  status: RuntimePlayerInputStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  if (status.connectionState === "error") {
    return status.errorMessage ?? "Error";
  }

  return status.connectionState;
}

export function formatInputLocalIps(
  status: RuntimePlayerInputStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  if (status.localIpCandidates.length === 0) {
    return "None detected";
  }

  return status.localIpCandidates.join(", ");
}

export function formatInputRemote(
  status: RuntimePlayerInputStatus | null
): string {
  if (status?.remote === undefined) {
    return "None";
  }

  return `${status.remote.address}:${status.remote.port}`;
}

export function formatInputFps(
  status: RuntimePlayerInputStatus | null
): string {
  if (status?.estimatedFps === undefined) {
    return "Unknown";
  }

  return `${formatControlNumber(status.estimatedFps)} fps`;
}

export function formatInputLastPacket(
  status: RuntimePlayerInputStatus | null
): string {
  if (status?.lastPacketAgeMs === undefined) {
    return "None";
  }

  return `${status.lastPacketAgeMs} ms ago`;
}

export function getInputActivityLabel(
  status: RuntimePlayerInputStatus | null
): string {
  if (status === null) {
    return "Checking input receiver.";
  }

  if (status.connectionState === "listening") {
    return "Listening for iFacialMocap UDP packets.";
  }

  if (status.connectionState === "receiving") {
    return `${status.packetCount} packets received.`;
  }

  if (status.connectionState === "stale") {
    return "No recent packet received.";
  }

  if (status.connectionState === "error") {
    return status.errorMessage ?? "Input receiver error.";
  }

  return "Receiver is idle.";
}

export function getRuntimeExportDirectoryLabel(
  status: RuntimeExportStatus | null
): string {
  if (
    status?.status === "loaded" ||
    status?.status === "loading" ||
    status?.status === "error"
  ) {
    return status.directoryPath;
  }

  return "None selected";
}

export function getRuntimeExportLoadedLabel(
  status: RuntimeExportStatus | null
): string {
  if (status?.status === "loaded") {
    return "Loaded";
  }

  if (status?.status === "loading") {
    return "Loading";
  }

  if (status?.status === "error") {
    return "Error";
  }

  return "No";
}

export function getRuntimeExportTone(
  status: RuntimeExportStatus | null
): "amber" | "teal" | "red" {
  if (status?.status === "loaded") {
    return "teal";
  }

  if (status?.status === "error") {
    return "red";
  }

  return "amber";
}

export function shouldShowStageStatusNotice(
  status: RuntimePlayerStageViewStatus | null
): status is RuntimePlayerStageViewStatus {
  return status !== null && (
    status.tone === "warning" ||
    status.tone === "error" ||
    status.details.length > 0
  );
}

export function getProfileStatusLabel(
  status: RuntimePlayerInputProfileStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  if (status.profileMode === "load-warning") {
    return "Temporary defaults";
  }

  if (status.temporaryDefaultsActive) {
    return "Temporary defaults";
  }

  if (status.activeProfile !== null) {
    return status.activeProfile.displayName;
  }

  return "No profile";
}

export function getProfileTone(
  status: RuntimePlayerInputProfileStatus | null
): "amber" | "teal" | "red" {
  if (status?.profileMode === "load-warning") {
    return "red";
  }

  if (status?.activeProfile !== null && status !== null) {
    return status.temporaryDefaultsActive ? "amber" : "teal";
  }

  return "amber";
}

export function getLiveReadinessLabel(input: {
  readonly runtimeExportStatus: RuntimeExportStatus | null;
  readonly inputStatus: RuntimePlayerInputStatus | null;
  readonly profileStatus: RuntimePlayerInputProfileStatus | null;
  readonly mappingStatus?: RuntimePlayerMappingStatus | null;
}): string {
  if (input.runtimeExportStatus?.status !== "loaded") {
    return "Unavailable";
  }

  if (input.inputStatus?.connectionState !== "receiving") {
    return "Waiting for input";
  }

  if (input.profileStatus?.activeProfile === null || input.profileStatus === null) {
    return "Needs input profile";
  }

  if (input.mappingStatus?.status !== "ready") {
    return "Mapping not configured";
  }

  if (input.mappingStatus.enabledSlotCount === 0) {
    return "No mapping slots enabled";
  }

  if (input.mappingStatus.mappedSlotCount === 0) {
    return "No mapped targets";
  }

  return "Live active";
}

export function getAutoMappingLabel(
  status: RuntimePlayerMappingStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  if (status.status !== "ready") {
    return "Not configured";
  }

  if (status.missingSlotCount > 0) {
    return `Auto mapped ${status.mappedSlotCount} / ${status.slots.length}; ${status.missingSlotCount} missing`;
  }

  return `Auto mapped ${status.mappedSlotCount} / ${status.slots.length}`;
}

export function formatControlNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
