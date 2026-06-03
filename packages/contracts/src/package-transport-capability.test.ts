import { describe, expect, it } from "vitest";

import {
  PACKAGE_TRANSPORT_CAPABILITY_CATALOG,
  PackageTransportCapabilityCatalogDtoSchema,
  PackageTransportCapabilityDtoSchema,
  type PackageTransportCapabilityIdDto,
  type PackageTransportKindDto
} from "./index.js";

describe("package transport capability contract", () => {
  it("parses the Wave37 transport capability catalog", () => {
    const catalog = PackageTransportCapabilityCatalogDtoSchema.parse(
      PACKAGE_TRANSPORT_CAPABILITY_CATALOG
    );

    expect(catalog.schemaVersion).toBe("package-transport-capabilities-v0");
    expect(catalog.capabilities.map((capability) => capability.capabilityId)).toEqual([
      "projectDefinedJsonBundleV0",
      "standardArchiveZipV0",
      "fileSystemAccessApiV0",
      "directoryPickerV0",
      "dragDropFileIntakeV0",
      "nativeFilesystemPersistenceV0"
    ]);
  });

  it("represents Wave36 portable JSON bundle v0 as the only supported transport", () => {
    const catalog = PackageTransportCapabilityCatalogDtoSchema.parse(
      PACKAGE_TRANSPORT_CAPABILITY_CATALOG
    );
    const supported = catalog.capabilities.filter((capability) =>
      capability.status === "supported"
    );

    expect(supported).toHaveLength(1);
    expect(supported[0]).toMatchObject({
      capabilityId: "projectDefinedJsonBundleV0",
      transportKind: "portableBundle",
      status: "supported",
      portableBundle: {
        schemaVersion: "portable-package-bundle-v0",
        bundleKind: "project-defined-json-bundle-v0"
      },
      gates: [],
      issues: []
    });
  });

  it("rejects supported status claims for archive, filesystem, directory, drag-drop, and native filesystem capabilities", () => {
    const unsupportedSupportedClaimCases: readonly SupportedCapabilityClaimCase[] = [
      {
        capabilityId: "standardArchiveZipV0",
        transportKind: "archive"
      },
      {
        capabilityId: "fileSystemAccessApiV0",
        transportKind: "filesystem"
      },
      {
        capabilityId: "directoryPickerV0",
        transportKind: "filesystem"
      },
      {
        capabilityId: "dragDropFileIntakeV0",
        transportKind: "browserFileIntake"
      },
      {
        capabilityId: "nativeFilesystemPersistenceV0",
        transportKind: "filesystem"
      }
    ];

    for (const claimCase of unsupportedSupportedClaimCases) {
      const result = PackageTransportCapabilityDtoSchema.safeParse(
        createSupportedCapabilityClaim(claimCase)
      );

      expect(result.success, claimCase.capabilityId).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toEqual(expect.arrayContaining([
          expect.objectContaining({
            code: "custom",
            path: ["status"]
          })
        ]));
      }
    }
  });

  it("rejects catalog evidence when a non-portable capability claims supported status", () => {
    const catalogWithFalseArchiveSupport = {
      ...PACKAGE_TRANSPORT_CAPABILITY_CATALOG,
      capabilities: PACKAGE_TRANSPORT_CAPABILITY_CATALOG.capabilities.map((capability) =>
        capability.capabilityId === "standardArchiveZipV0"
          ? createSupportedCapabilityClaim({
              capabilityId: "standardArchiveZipV0",
              transportKind: "archive"
            })
          : capability
      )
    };

    const result = PackageTransportCapabilityCatalogDtoSchema.safeParse(
      catalogWithFalseArchiveSupport
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "custom",
          path: ["capabilities", 1, "status"]
        })
      ]));
    }
  });

  it("keeps archive and filesystem transports out of the supported set", () => {
    const catalog = PackageTransportCapabilityCatalogDtoSchema.parse(
      PACKAGE_TRANSPORT_CAPABILITY_CATALOG
    );
    const capabilitiesById = new Map(
      catalog.capabilities.map((capability) => [capability.capabilityId, capability])
    );

    expect(capabilitiesById.get("standardArchiveZipV0")).toMatchObject({
      transportKind: "archive",
      status: "dependency-gated",
      gates: [
        {
          gateKind: "dependencyApproval",
          gateId: "transport.archiveDependencyApproval",
          status: "open"
        }
      ]
    });
    expect(capabilitiesById.get("standardArchiveZipV0")?.issues.map((issue) => issue.code))
      .toContain("transport.noArchiveCompatibilityClaim");

    for (const capabilityId of [
      "fileSystemAccessApiV0",
      "directoryPickerV0",
      "dragDropFileIntakeV0"
    ] as const) {
      expect(capabilitiesById.get(capabilityId)?.status).toBe("future-gated");
      expect(capabilitiesById.get(capabilityId)?.status).not.toBe("supported");
    }

    expect(capabilitiesById.get("nativeFilesystemPersistenceV0")).toMatchObject({
      transportKind: "filesystem",
      status: "unsupported"
    });
  });

  it("requires deterministic gates and issues for gated or unsupported capabilities", () => {
    expect(PackageTransportCapabilityDtoSchema.safeParse({
      schemaVersion: "package-transport-capability-v0",
      capabilityId: "standardArchiveZipV0",
      transportKind: "archive",
      status: "dependency-gated",
      summary: "Missing dependency gate.",
      gates: [],
      issues: [
        {
          code: "transport.dependencyApprovalRequired",
          severity: "blocking",
          message: "Archive dependency approval is required."
        }
      ]
    }).success).toBe(false);

    expect(PackageTransportCapabilityDtoSchema.safeParse({
      schemaVersion: "package-transport-capability-v0",
      capabilityId: "fileSystemAccessApiV0",
      transportKind: "filesystem",
      status: "future-gated",
      summary: "Missing future gate.",
      gates: [],
      issues: [
        {
          code: "transport.notImplemented",
          severity: "blocking",
          message: "Not implemented."
        }
      ]
    }).success).toBe(false);

    expect(PackageTransportCapabilityDtoSchema.safeParse({
      schemaVersion: "package-transport-capability-v0",
      capabilityId: "nativeFilesystemPersistenceV0",
      transportKind: "filesystem",
      status: "unsupported",
      summary: "Missing unsupported issue.",
      gates: [],
      issues: []
    }).success).toBe(false);
  });

  it("rejects unsupported portable bundle support claims and non-portable bundle bindings", () => {
    expect(PackageTransportCapabilityDtoSchema.safeParse({
      schemaVersion: "package-transport-capability-v0",
      capabilityId: "projectDefinedJsonBundleV0",
      transportKind: "portableBundle",
      status: "future-gated",
      summary: "Invalid future gate for the supported Wave36 bundle.",
      gates: [
        {
          gateKind: "waveImplementation",
          gateId: "transport.invalidPortableBundleGate",
          status: "open",
          summary: "Invalid."
        }
      ],
      issues: [
        {
          code: "transport.futureScope",
          severity: "blocking",
          message: "Invalid."
        }
      ]
    }).success).toBe(false);

    expect(PackageTransportCapabilityDtoSchema.safeParse({
      schemaVersion: "package-transport-capability-v0",
      capabilityId: "standardArchiveZipV0",
      transportKind: "archive",
      status: "dependency-gated",
      summary: "Invalid archive portable bundle binding.",
      portableBundle: {
        schemaVersion: "portable-package-bundle-v0",
        bundleKind: "project-defined-json-bundle-v0"
      },
      gates: [
        {
          gateKind: "dependencyApproval",
          gateId: "transport.archiveDependencyApproval",
          status: "open",
          summary: "Archive dependency approval is required."
        }
      ],
      issues: [
        {
          code: "transport.dependencyApprovalRequired",
          severity: "blocking",
          message: "Archive dependency approval is required."
        }
      ]
    }).success).toBe(false);
  });
});

interface SupportedCapabilityClaimCase {
  readonly capabilityId: PackageTransportCapabilityIdDto;
  readonly transportKind: PackageTransportKindDto;
}

const createSupportedCapabilityClaim = (claimCase: SupportedCapabilityClaimCase) => ({
  schemaVersion: "package-transport-capability-v0",
  capabilityId: claimCase.capabilityId,
  transportKind: claimCase.transportKind,
  status: "supported",
  summary: "False supported transport capability claim.",
  gates: [],
  issues: []
} as const);
