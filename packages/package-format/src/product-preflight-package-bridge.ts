import {
  PackageIdSchema,
  ProductPreflightEvidenceRefDtoSchema,
  type PackageId,
  type ProductPreflightCategoryDto,
  type ProductPreflightEvidenceRefDto
} from "@private-2d-rigging-lab/contracts";

import {
  PackageBinaryByteAvailabilityReportSchema,
  PackageBinaryPackageRevisionSchema,
  type PackageBinaryByteAvailabilityReportDto
} from "./byte-availability-contract.js";
import type { PackageTransportBoundaryResult } from "./package-transport-boundary.js";

export interface PackageProductPreflightEvidenceBridgeResult {
  readonly packageId: PackageId;
  readonly packageRevision: number;
  readonly packageHash?: string;
  readonly category: ProductPreflightCategoryDto;
  readonly evidenceRefs: readonly ProductPreflightEvidenceRefDto[];
}

export interface CreateByteAvailabilityProductPreflightEvidenceInput {
  readonly report: PackageBinaryByteAvailabilityReportDto;
  readonly artifactPath?: string;
  readonly evidenceId?: string;
}

export interface CreateTransportCapabilityProductPreflightEvidenceInput {
  readonly packageId: PackageId | string;
  readonly packageRevision: number;
  readonly packageHash?: string;
  readonly boundaryResult: PackageTransportBoundaryResult;
  readonly artifactPath?: string;
  readonly evidenceId?: string;
}

export const createByteAvailabilityProductPreflightEvidence = (
  input: CreateByteAvailabilityProductPreflightEvidenceInput
): PackageProductPreflightEvidenceBridgeResult => {
  const report = PackageBinaryByteAvailabilityReportSchema.parse(input.report);
  const packageId = PackageIdSchema.parse(report.packageId);
  const packageRevision = PackageBinaryPackageRevisionSchema.parse(report.packageRevision);
  const artifactPath = input.artifactPath ?? createGeneratedEvidencePath(
    "byte-availability",
    `${packageId}-r${packageRevision}-${report.binaryAssetId}`
  );
  const evidenceRef = ProductPreflightEvidenceRefDtoSchema.parse({
    evidenceId: input.evidenceId ?? createEvidenceId(
      "byteAvailability",
      packageId,
      `r${packageRevision}`,
      report.binaryAssetId
    ),
    artifactRef: {
      artifactKind: "byteAvailability",
      path: artifactPath
    },
    target: {
      kind: "sourceAsset",
      id: report.binaryAssetId,
      path: report.packageRelativePath
    },
    summary: [
      `Byte availability report ${report.status} for ${report.binaryAssetId}.`,
      `Package ${packageId} revision ${packageRevision}; current-session bytes are ${report.currentSessionBytes}.`
    ].join(" "),
    producer: "packageFormat"
  });

  return {
    packageId,
    packageRevision,
    category: "assetBytes",
    evidenceRefs: [evidenceRef]
  };
};

export const createTransportCapabilityProductPreflightEvidence = (
  input: CreateTransportCapabilityProductPreflightEvidenceInput
): PackageProductPreflightEvidenceBridgeResult => {
  const packageId = PackageIdSchema.parse(input.packageId);
  const packageRevision = PackageBinaryPackageRevisionSchema.parse(input.packageRevision);
  const capability = input.boundaryResult.capability;
  const artifactPath = input.artifactPath ?? createGeneratedEvidencePath(
    "transport-capability",
    `${packageId}-r${packageRevision}-${capability.capabilityId}`
  );
  const evidenceRef = ProductPreflightEvidenceRefDtoSchema.parse({
    evidenceId: input.evidenceId ?? createEvidenceId(
      "transportCapability",
      packageId,
      `r${packageRevision}`,
      capability.capabilityId
    ),
    artifactRef: {
      artifactKind: "transportCapability",
      path: artifactPath
    },
    target: {
      kind: "package",
      id: packageId
    },
    summary: [
      `Transport capability ${capability.capabilityId} is ${capability.status}.`,
      `Package ${packageId} revision ${packageRevision}; evidence records the package transport boundary only.`
    ].join(" "),
    producer: "packageFormat"
  });

  return {
    packageId,
    packageRevision,
    ...(input.packageHash === undefined ? {} : { packageHash: input.packageHash }),
    category: "persistenceTransport",
    evidenceRefs: [evidenceRef]
  };
};

const createGeneratedEvidencePath = (
  directory: "byte-availability" | "transport-capability",
  stem: string
): string => `generated/${directory}/${sanitizePathStem(stem)}.json`;

const createEvidenceId = (...parts: readonly string[]): string =>
  `evidence_${sanitizeIdToken(parts.join("_"))}`;

const sanitizePathStem = (value: string): string =>
  value.replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "") || "preflight";

const sanitizeIdToken = (value: string): string =>
  value.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "preflight";
