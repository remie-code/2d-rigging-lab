import { describe, expect, it } from "vitest";

import {
  type PackageTransportCapabilityIdDto,
  type PackageTransportCapabilityStatusDto
} from "@private-2d-rigging-lab/contracts";

import {
  PackageTransportBoundaryError,
  evaluatePackageTransportBoundary,
  requireSupportedPackageTransportBoundary
} from "./index.js";

describe("package-format transport boundary guards", () => {
  it("represents the portable JSON bundle route as supported and usable", () => {
    const result = evaluatePackageTransportBoundary({
      capabilityId: "projectDefinedJsonBundleV0",
      operation: "export"
    });

    expect(result).toMatchObject({
      outcome: "supported",
      supported: true,
      requestedCapabilityId: "projectDefinedJsonBundleV0",
      operation: "export",
      status: "supported",
      capability: {
        capabilityId: "projectDefinedJsonBundleV0",
        transportKind: "portableBundle",
        status: "supported",
        portableBundle: {
          schemaVersion: "portable-package-bundle-v0",
          bundleKind: "project-defined-json-bundle-v0"
        }
      },
      gates: [],
      issues: []
    });

    expect(requireSupportedPackageTransportBoundary({
      capabilityId: "projectDefinedJsonBundleV0",
      operation: "import"
    })).toMatchObject({
      outcome: "supported",
      supported: true,
      operation: "import"
    });
  });

  it("returns deterministic non-supported results for future and dependency gated routes", () => {
    const cases: readonly ExpectedBoundaryCase[] = [
      {
        capabilityId: "standardArchiveZipV0",
        status: "dependency-gated",
        gateKind: "dependencyApproval",
        issueCode: "transport.dependencyApprovalRequired"
      },
      {
        capabilityId: "fileSystemAccessApiV0",
        status: "future-gated",
        gateKind: "browserApiDecision",
        issueCode: "transport.notImplemented"
      },
      {
        capabilityId: "directoryPickerV0",
        status: "future-gated",
        gateKind: "uxDecision",
        issueCode: "transport.notImplemented"
      },
      {
        capabilityId: "dragDropFileIntakeV0",
        status: "future-gated",
        gateKind: "uxDecision",
        issueCode: "transport.notImplemented"
      }
    ];

    for (const expected of cases) {
      const result = evaluatePackageTransportBoundary({
        capabilityId: expected.capabilityId,
        operation: "import"
      });

      expect(result).toMatchObject({
        outcome: "not-supported",
        supported: false,
        requestedCapabilityId: expected.capabilityId,
        operation: "import",
        status: expected.status,
        capability: {
          capabilityId: expected.capabilityId,
          status: expected.status
        }
      });
      expect(result.gates.map((gate) => gate.gateKind)).toContain(expected.gateKind);
      expect(result.issues.map((issue) => issue.code)).toContain(expected.issueCode);
    }
  });

  it("returns deterministic unsupported result for native filesystem persistence", () => {
    const result = evaluatePackageTransportBoundary({
      capabilityId: "nativeFilesystemPersistenceV0",
      operation: "persist"
    });

    expect(result).toMatchObject({
      outcome: "not-supported",
      supported: false,
      requestedCapabilityId: "nativeFilesystemPersistenceV0",
      operation: "persist",
      status: "unsupported",
      capability: {
        capabilityId: "nativeFilesystemPersistenceV0",
        transportKind: "filesystem",
        status: "unsupported"
      },
      gates: []
    });
    expect(result.issues.map((issue) => issue.code)).toContain("transport.unsupported");
  });

  it("throws a boundary error when callers require a non-supported route", () => {
    expect(() => requireSupportedPackageTransportBoundary({
      capabilityId: "standardArchiveZipV0",
      operation: "export"
    })).toThrowError(PackageTransportBoundaryError);

    try {
      requireSupportedPackageTransportBoundary({
        capabilityId: "standardArchiveZipV0",
        operation: "export"
      });
    } catch (error) {
      expect(error).toMatchObject({
        name: "PackageTransportBoundaryError",
        result: {
          outcome: "not-supported",
          supported: false,
          status: "dependency-gated",
          issues: [
            {
              code: "transport.dependencyApprovalRequired"
            },
            {
              code: "transport.noArchiveCompatibilityClaim"
            }
          ]
        }
      });
      return;
    }

    throw new Error("Expected PackageTransportBoundaryError.");
  });
});

interface ExpectedBoundaryCase {
  readonly capabilityId: PackageTransportCapabilityIdDto;
  readonly status: Exclude<PackageTransportCapabilityStatusDto, "supported">;
  readonly gateKind: string;
  readonly issueCode: string;
}
