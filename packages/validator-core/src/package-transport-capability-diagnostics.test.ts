import {
  describe,
  expect,
  it
} from "vitest";

import {
  PACKAGE_TRANSPORT_CAPABILITY_CATALOG,
  PackageTransportCapabilityCatalogDtoSchema,
  type PackageTransportCapabilityDto,
  type PackageTransportCapabilityIdDto,
  type PackageTransportKindDto
} from "@private-2d-rigging-lab/contracts";

import { defaultCheckCatalog } from "./check-catalog.js";
import { validatePackageRuntime } from "./validators/package-runtime.js";
import { validatePackageTransportCapabilityEvidence } from "./validators/package-transport-capability-diagnostics.js";

const TRANSPORT_CATALOG = PackageTransportCapabilityCatalogDtoSchema.parse(
  PACKAGE_TRANSPORT_CAPABILITY_CATALOG
);

describe("package transport capability diagnostics", () => {
  it("registers transport capability diagnostics in the check catalog", () => {
    expect(defaultCheckCatalog.has("transportCapability.evidenceMissing")).toBe(true);
    expect(defaultCheckCatalog.has("transportCapability.schemaInvalid")).toBe(true);
    expect(defaultCheckCatalog.has("transportCapability.unsupported")).toBe(true);
    expect(defaultCheckCatalog.has("transportCapability.futureGated")).toBe(true);
    expect(defaultCheckCatalog.has("transportCapability.dependencyGated")).toBe(true);
  });

  it("accepts supported project-defined JSON portable bundle capability evidence", () => {
    const checks = validatePackageTransportCapabilityEvidence({
      transportCapabilityEvidence: findCapability("projectDefinedJsonBundleV0")
    });

    expect(checks).toEqual([]);
  });

  it("reports schema-invalid evidence when non-portable capabilities claim supported status", () => {
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
      const checks = validatePackageTransportCapabilityEvidence({
        transportCapabilityEvidence: createSupportedCapabilityClaim(claimCase)
      });

      expect(checks, claimCase.capabilityId).toHaveLength(1);
      expect(checks[0]).toMatchObject({
        checkId: "transportCapability.schemaInvalid",
        status: "fail",
        severity: "blocking",
        targetPath: "/transportCapabilityEvidence/status"
      });
      expect(checks[0]?.evidence).toEqual(expect.arrayContaining([
        "transportCapabilityEvidenceShape=capability",
        "transportCapabilitySchemaVersion=package-transport-capability-v0",
        "issueCode=custom",
        "issueTargetPath=/transportCapabilityEvidence/status",
        "verificationIssueCode=transportCapability.schemaInvalid"
      ]));
    }
  });

  it("reports gated and unsupported capabilities from the Domain A catalog without flagging the supported portable transport", () => {
    const checks = validatePackageTransportCapabilityEvidence({
      transportCapabilityEvidence: TRANSPORT_CATALOG
    });

    expect(checks.map((check) => check.checkId)).toEqual([
      "transportCapability.dependencyGated",
      "transportCapability.futureGated",
      "transportCapability.futureGated",
      "transportCapability.futureGated",
      "transportCapability.unsupported"
    ]);
    expect(checks.map((check) => check.targetPath)).toEqual([
      "/transportCapabilityEvidence/capabilities/1",
      "/transportCapabilityEvidence/capabilities/2",
      "/transportCapabilityEvidence/capabilities/3",
      "/transportCapabilityEvidence/capabilities/4",
      "/transportCapabilityEvidence/capabilities/5"
    ]);
    expect(checks.flatMap((check) => check.evidence)).not.toContain("capabilityId=projectDefinedJsonBundleV0");
  });

  it("reports dependency-gated ZIP/archive evidence with stable gate and issue evidence", () => {
    const checks = validatePackageTransportCapabilityEvidence({
      transportCapabilityEvidence: findCapability("standardArchiveZipV0")
    });

    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({
      checkId: "transportCapability.dependencyGated",
      status: "fail",
      severity: "blocking",
      phase: "source_import",
      targetPath: "/transportCapabilityEvidence"
    });
    expect(checks[0]?.evidence).toEqual(expect.arrayContaining([
      "transportCapabilityEvidenceShape=capability",
      "capabilityId=standardArchiveZipV0",
      "transportKind=archive",
      "status=dependency-gated",
      "gate.0=dependencyApproval:transport.archiveDependencyApproval:open",
      "issue.0=transport.dependencyApprovalRequired:blocking",
      "issue.1=transport.noArchiveCompatibilityClaim:blocking",
      "verificationIssueCode=transportCapability.dependencyGated"
    ]));
  });

  it("reports future-gated filesystem and drag-drop capability evidence", () => {
    const checks = [
      ...validatePackageTransportCapabilityEvidence({
        transportCapabilityEvidence: findCapability("fileSystemAccessApiV0")
      }),
      ...validatePackageTransportCapabilityEvidence({
        transportCapabilityEvidence: findCapability("directoryPickerV0")
      }),
      ...validatePackageTransportCapabilityEvidence({
        transportCapabilityEvidence: findCapability("dragDropFileIntakeV0")
      })
    ];

    expect(checks.map((check) => check.checkId)).toEqual([
      "transportCapability.futureGated",
      "transportCapability.futureGated",
      "transportCapability.futureGated"
    ]);
    expect(checks.flatMap((check) => check.evidence)).toEqual(expect.arrayContaining([
      "capabilityId=fileSystemAccessApiV0",
      "transportKind=filesystem",
      "capabilityId=directoryPickerV0",
      "capabilityId=dragDropFileIntakeV0",
      "transportKind=browserFileIntake"
    ]));
  });

  it("reports unsupported native filesystem persistence evidence", () => {
    const checks = validatePackageTransportCapabilityEvidence({
      transportCapabilityEvidence: findCapability("nativeFilesystemPersistenceV0")
    });

    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({
      checkId: "transportCapability.unsupported",
      status: "fail",
      severity: "blocking"
    });
    expect(checks[0]?.evidence).toEqual(expect.arrayContaining([
      "capabilityId=nativeFilesystemPersistenceV0",
      "transportKind=filesystem",
      "status=unsupported",
      "issue.0=transport.unsupported:blocking",
      "issue.1=transport.noFilesystemCompatibilityClaim:blocking",
      "verificationIssueCode=transportCapability.unsupported"
    ]));
  });

  it("reports missing transport evidence only when explicitly required", () => {
    expect(validatePackageTransportCapabilityEvidence({})).toEqual([]);

    const checks = validatePackageTransportCapabilityEvidence({
      requireTransportCapabilityEvidence: true
    });

    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({
      checkId: "transportCapability.evidenceMissing",
      status: "fail",
      severity: "blocking",
      targetPath: "/transportCapabilityEvidence"
    });
    expect(checks[0]?.evidence).toEqual(expect.arrayContaining([
      "transportCapabilityEvidence=missing",
      "requireTransportCapabilityEvidence=true",
      "verificationIssueCode=transportCapability.evidenceMissing"
    ]));
  });

  it("reports malformed transport capability evidence deterministically", () => {
    const checks = validatePackageTransportCapabilityEvidence({
      transportCapabilityEvidence: {
        schemaVersion: "package-transport-capability-v0",
        capabilityId: "projectDefinedJsonBundleV0",
        transportKind: "portableBundle",
        status: "supported",
        summary: "Corrupt supported portable transport evidence without portable bundle binding.",
        gates: [],
        issues: []
      }
    });

    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({
      checkId: "transportCapability.schemaInvalid",
      status: "fail",
      severity: "blocking",
      targetPath: "/transportCapabilityEvidence/portableBundle"
    });
    expect(checks[0]?.evidence).toEqual(expect.arrayContaining([
      "transportCapabilityEvidenceShape=capability",
      "transportCapabilitySchemaVersion=package-transport-capability-v0",
      "issueCode=custom",
      "issueTargetPath=/transportCapabilityEvidence/portableBundle",
      "verificationIssueCode=transportCapability.schemaInvalid"
    ]));
  });

  it("keeps validatePackageRuntime transport diagnostics explicitly gated", () => {
    const noTransportReport = validatePackageRuntime({
      packageDocument: {}
    });
    expect(noTransportReport.checks.map((check) => check.checkId)).not.toContain(
      "transportCapability.evidenceMissing"
    );

    const requiredTransportReport = validatePackageRuntime({
      packageDocument: {},
      requireTransportCapabilityEvidence: true
    });
    expect(requiredTransportReport.checks.map((check) => check.checkId)).toContain(
      "transportCapability.evidenceMissing"
    );
  });
});

const findCapability = (
  capabilityId: PackageTransportCapabilityIdDto
): PackageTransportCapabilityDto => {
  const capability = TRANSPORT_CATALOG.capabilities.find((candidate) =>
    candidate.capabilityId === capabilityId
  );

  if (capability === undefined) {
    throw new Error(`Missing transport capability fixture ${capabilityId}.`);
  }

  return capability;
};

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
