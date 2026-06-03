import { describe, expect, it } from "vitest";
import { PACKAGE_FORMAT_TRANSPORT_CAPABILITY_CATALOG } from "@private-2d-rigging-lab/package-format";

import { projectTransportCapabilityViewRows } from "./transport-capability-view-model.js";

describe("project transport capability view model", () => {
  it("projects every package-format transport capability in catalog order", () => {
    const rows = projectTransportCapabilityViewRows();

    expect(rows.map((row) => row.capabilityId)).toEqual(
      PACKAGE_FORMAT_TRANSPORT_CAPABILITY_CATALOG.capabilities.map(
        (capability) => capability.capabilityId
      )
    );
  });

  it("keeps portable JSON bundle supported and active", () => {
    expect(projectTransportCapabilityViewRows().find((row) =>
      row.capabilityId === "projectDefinedJsonBundleV0"
    )).toMatchObject({
      label: "Portable JSON bundle",
      status: "supported",
      statusLabel: "Supported",
      availabilityLabel: "Available in this editor",
      unavailableActionLabel: null,
      gateSummaries: [],
      issueSummaries: []
    });
  });

  it("projects unavailable archive and filesystem routes from capability boundaries", () => {
    const rowsById = new Map(
      projectTransportCapabilityViewRows().map((row) => [row.capabilityId, row])
    );

    expect(rowsById.get("standardArchiveZipV0")).toMatchObject({
      status: "dependency-gated",
      statusLabel: "Dependency-gated",
      availabilityLabel: "Unavailable in this editor",
      unavailableActionLabel: "Unavailable"
    });
    expect(rowsById.get("standardArchiveZipV0")?.gateSummaries.join(" ")).toContain(
      "transport.archiveDependencyApproval"
    );

    for (const capabilityId of [
      "fileSystemAccessApiV0",
      "directoryPickerV0",
      "dragDropFileIntakeV0"
    ] as const) {
      expect(rowsById.get(capabilityId)).toMatchObject({
        status: "future-gated",
        statusLabel: "Future-gated",
        availabilityLabel: "Unavailable in this editor",
        unavailableActionLabel: "Unavailable"
      });
    }

    expect(rowsById.get("nativeFilesystemPersistenceV0")).toMatchObject({
      status: "unsupported",
      statusLabel: "Unsupported",
      availabilityLabel: "Unavailable in this editor",
      unavailableActionLabel: "Unavailable"
    });
  });
});
