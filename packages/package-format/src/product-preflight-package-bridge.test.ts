import { describe, expect, it } from "vitest";

import { ProductPreflightEvidenceRefDtoSchema } from "@private-2d-rigging-lab/contracts";

import {
  PackageBinaryByteAvailabilityReportSchema,
  createByteAvailabilityProductPreflightEvidence,
  createTransportCapabilityProductPreflightEvidence,
  evaluatePackageTransportBoundary
} from "./index.js";

describe("package-format product preflight evidence bridge", () => {
  it("bridges byte availability reports to product preflight evidence refs", () => {
    const report = PackageBinaryByteAvailabilityReportSchema.parse({
      schemaVersion: "package-binary-byte-availability-report-v1",
      packageId: "pkg_preflightBridge",
      packageRevision: 4,
      binaryAssetId: "bin_sample_model_psd",
      packageRelativePath: "assets/sources/uploads/sample_model.psd",
      expectedDigest: {
        algorithm: "sha256",
        hex: "a".repeat(64)
      },
      expectedByteLength: 12,
      currentSessionBytes: "missing-current-session-bytes-v1",
      availability: "missing-current-session-bytes-v1",
      requiresReupload: false,
      verifiedSummaryStatus: "not-supplied-v1",
      currentSessionVerificationStatus: "not-supplied-v1",
      status: "fail-v1",
      issues: [
        {
          code: "byteAvailability.currentSessionBytes.missing",
          source: "current-session-verification-report-v1",
          targetPath: "/currentSessionVerificationReport",
          expected: "current-session-verification-report",
          actual: "missing",
          message: "Current-session bytes are not available without a byte verification report."
        }
      ]
    });

    const bridge = createByteAvailabilityProductPreflightEvidence({ report });

    expect(bridge).toMatchObject({
      packageId: "pkg_preflightBridge",
      packageRevision: 4,
      category: "assetBytes"
    });
    expect(bridge.evidenceRefs).toHaveLength(1);
    expect(ProductPreflightEvidenceRefDtoSchema.parse(bridge.evidenceRefs[0])).toMatchObject({
      evidenceId: "evidence_byteAvailability_pkg_preflightBridge_r4_bin_sample_model_psd",
      artifactRef: {
        artifactKind: "byteAvailability",
        path: "generated/byte-availability/pkg_preflightBridge-r4-bin_sample_model_psd.json"
      },
      target: {
        kind: "sourceAsset",
        id: "bin_sample_model_psd",
        path: "assets/sources/uploads/sample_model.psd"
      },
      producer: "packageFormat"
    });
  });

  it("bridges transport capability boundary results without claiming archive or filesystem implementation", () => {
    const boundaryResult = evaluatePackageTransportBoundary({
      capabilityId: "standardArchiveZipV0",
      operation: "export"
    });

    const bridge = createTransportCapabilityProductPreflightEvidence({
      packageId: "pkg_preflightBridge",
      packageRevision: 5,
      packageHash: "sha256-preflight",
      boundaryResult
    });

    expect(bridge).toMatchObject({
      packageId: "pkg_preflightBridge",
      packageRevision: 5,
      packageHash: "sha256-preflight",
      category: "persistenceTransport"
    });
    expect(bridge.evidenceRefs).toEqual([
      expect.objectContaining({
        evidenceId: "evidence_transportCapability_pkg_preflightBridge_r5_standardArchiveZipV0",
        artifactRef: {
          artifactKind: "transportCapability",
          path: "generated/transport-capability/pkg_preflightBridge-r5-standardArchiveZipV0.json"
        },
        target: {
          kind: "package",
          id: "pkg_preflightBridge"
        },
        summary: expect.stringContaining("dependency-gated"),
        producer: "packageFormat"
      })
    ]);
    expect(bridge.evidenceRefs[0]?.summary).toContain("boundary only");
  });
});
