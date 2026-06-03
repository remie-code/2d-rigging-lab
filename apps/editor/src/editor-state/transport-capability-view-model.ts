import type {
  PackageTransportCapabilityIdDto,
  PackageTransportCapabilityStatusDto,
  PackageTransportKindDto
} from "@private-2d-rigging-lab/contracts";
import {
  PACKAGE_FORMAT_TRANSPORT_CAPABILITY_CATALOG,
  evaluatePackageTransportBoundary
} from "@private-2d-rigging-lab/package-format";

export interface ProjectTransportCapabilityViewRow {
  readonly capabilityId: PackageTransportCapabilityIdDto;
  readonly label: string;
  readonly transportKindLabel: string;
  readonly status: PackageTransportCapabilityStatusDto;
  readonly statusLabel: string;
  readonly availabilityLabel: string;
  readonly summary: string;
  readonly gateSummaries: readonly string[];
  readonly issueSummaries: readonly string[];
  readonly unavailableActionLabel: string | null;
}

const CAPABILITY_LABELS: Record<PackageTransportCapabilityIdDto, string> = {
  projectDefinedJsonBundleV0: "Portable JSON bundle",
  standardArchiveZipV0: "Standard ZIP package archive",
  fileSystemAccessApiV0: "File System Access API",
  directoryPickerV0: "Directory picker",
  dragDropFileIntakeV0: "Drag-drop file intake",
  nativeFilesystemPersistenceV0: "Native filesystem persistence"
};

const STATUS_LABELS: Record<PackageTransportCapabilityStatusDto, string> = {
  supported: "Supported",
  unsupported: "Unsupported",
  "future-gated": "Future-gated",
  "dependency-gated": "Dependency-gated"
};

const TRANSPORT_KIND_LABELS: Record<PackageTransportKindDto, string> = {
  portableBundle: "Portable JSON bundle",
  archive: "Archive",
  filesystem: "Filesystem",
  browserFileIntake: "Browser file intake"
};

export const projectTransportCapabilityViewRows = ():
  readonly ProjectTransportCapabilityViewRow[] =>
  PACKAGE_FORMAT_TRANSPORT_CAPABILITY_CATALOG.capabilities.map((capability) => {
    const boundary = evaluatePackageTransportBoundary({
      capabilityId: capability.capabilityId
    });

    return {
      capabilityId: boundary.requestedCapabilityId,
      label: CAPABILITY_LABELS[boundary.requestedCapabilityId],
      transportKindLabel: TRANSPORT_KIND_LABELS[boundary.capability.transportKind],
      status: boundary.status,
      statusLabel: STATUS_LABELS[boundary.status],
      availabilityLabel: boundary.supported
        ? "Available in this editor"
        : "Unavailable in this editor",
      summary: boundary.capability.summary,
      gateSummaries: boundary.gates.map((gate) => `${gate.gateId}: ${gate.summary}`),
      issueSummaries: boundary.issues.map((issue) => `${issue.code}: ${issue.message}`),
      unavailableActionLabel: boundary.supported ? null : "Unavailable"
    };
  });
