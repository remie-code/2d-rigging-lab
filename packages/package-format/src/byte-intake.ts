import { z } from "zod";

import { ProvenanceIdSchema } from "@private-2d-rigging-lab/contracts";

import {
  BinaryAssetByteLengthSchema,
  BinaryAssetDigestSchema,
  BinaryAssetIdSchema,
  BinaryAssetMediaTypeSchema,
  BinaryAssetPackageRelativePathSchema,
  BinaryAssetReferenceSchema,
  BinaryAssetStorageStatusSchema,
  type BinaryAssetReferenceDto,
  type BinaryAssetStorageStatusDto
} from "./binary-asset.js";
import type { PackageBinaryAssetVerificationReport } from "./package-binary-file-set.js";

const BROWSER_FILE_NAME_PATTERN = /^[^\u0000-\u001f\u007f/\\]+$/u;

export const PackageBinaryByteIntakeFilenameSchema = z.string()
  .min(1)
  .max(1024)
  .regex(BROWSER_FILE_NAME_PATTERN);
export type PackageBinaryByteIntakeFilenameDto = z.infer<
  typeof PackageBinaryByteIntakeFilenameSchema
>;
export const PackageBinaryByteIntakeFilenameDtoSchema =
  PackageBinaryByteIntakeFilenameSchema;

export const PackageBinaryByteAvailabilitySchema = z.enum([
  "available-package-local-bytes-v1",
  "available-metadata-mismatch-v1",
  "ephemeral-browser-file-v1",
  "missing-package-local-bytes-v1",
  "requires-reupload-v1",
  "verification-unsupported-v1"
]);
export type PackageBinaryByteAvailabilityDto = z.infer<
  typeof PackageBinaryByteAvailabilitySchema
>;
export const PackageBinaryByteAvailabilityDtoSchema = PackageBinaryByteAvailabilitySchema;

export const PackageBinaryByteIntakeVerificationStatusSchema = z.enum([
  "not-verified-v1",
  "verified-pass-v1",
  "verified-fail-v1",
  "verification-unsupported-v1"
]);
export type PackageBinaryByteIntakeVerificationStatusDto = z.infer<
  typeof PackageBinaryByteIntakeVerificationStatusSchema
>;
export const PackageBinaryByteIntakeVerificationStatusDtoSchema =
  PackageBinaryByteIntakeVerificationStatusSchema;

export const PackageBinaryByteIntakeSummarySchema = z.object({
  schemaVersion: z.literal("package-binary-byte-intake-summary-v1"),
  intakeKind: z.literal("browser-file-input-v1"),
  filename: PackageBinaryByteIntakeFilenameSchema,
  binaryAssetId: BinaryAssetIdSchema,
  packageRelativePath: BinaryAssetPackageRelativePathSchema,
  digest: BinaryAssetDigestSchema,
  byteLength: BinaryAssetByteLengthSchema,
  mediaType: BinaryAssetMediaTypeSchema,
  storageStatus: BinaryAssetStorageStatusSchema,
  availability: PackageBinaryByteAvailabilitySchema,
  provenanceId: ProvenanceIdSchema,
  rightsAssetId: z.string().min(1),
  verificationStatus: PackageBinaryByteIntakeVerificationStatusSchema
}).strict();
export type PackageBinaryByteIntakeSummaryDto = z.infer<
  typeof PackageBinaryByteIntakeSummarySchema
>;
export const PackageBinaryByteIntakeSummaryDtoSchema =
  PackageBinaryByteIntakeSummarySchema;

export interface CreatePackageBinaryByteIntakeSummaryInput {
  readonly filename: string;
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly verificationReport?: PackageBinaryAssetVerificationReport;
  readonly availability?: PackageBinaryByteAvailabilityDto;
}

export class PackageBinaryByteIntakeSummaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackageBinaryByteIntakeSummaryError";
  }
}

export function createPackageBinaryByteIntakeSummary(
  input: CreatePackageBinaryByteIntakeSummaryInput
): PackageBinaryByteIntakeSummaryDto {
  const binaryAssetRef = BinaryAssetReferenceSchema.parse(input.binaryAssetRef);
  assertVerificationReportMatchesRef(binaryAssetRef, input.verificationReport);
  const availabilityInput = input.verificationReport === undefined
    ? { binaryAssetRef }
    : { binaryAssetRef, verificationReport: input.verificationReport };
  const derivedAvailability = derivePackageBinaryByteAvailability(availabilityInput);

  if (input.availability !== undefined && input.availability !== derivedAvailability) {
    throw new PackageBinaryByteIntakeSummaryError(
      `Availability override "${input.availability}" does not match derived availability "${derivedAvailability}".`
    );
  }

  return PackageBinaryByteIntakeSummarySchema.parse({
    schemaVersion: "package-binary-byte-intake-summary-v1",
    intakeKind: "browser-file-input-v1",
    filename: input.filename,
    binaryAssetId: binaryAssetRef.binaryAssetId,
    packageRelativePath: binaryAssetRef.packageRelativePath,
    digest: binaryAssetRef.digest,
    byteLength: binaryAssetRef.byteLength,
    mediaType: binaryAssetRef.mediaType,
    storageStatus: binaryAssetRef.storageStatus,
    availability: derivedAvailability,
    provenanceId: binaryAssetRef.provenanceId,
    rightsAssetId: binaryAssetRef.rightsAssetId,
    verificationStatus: getPackageBinaryByteIntakeVerificationStatus(input.verificationReport)
  });
}

export function derivePackageBinaryByteAvailability(input: {
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly verificationReport?: PackageBinaryAssetVerificationReport;
}): PackageBinaryByteAvailabilityDto {
  const binaryAssetRef = BinaryAssetReferenceSchema.parse(input.binaryAssetRef);
  assertVerificationReportMatchesRef(binaryAssetRef, input.verificationReport);

  if (input.verificationReport === undefined) {
    return deriveUnverifiedAvailability(binaryAssetRef.storageStatus);
  }

  if (input.verificationReport.status === "pass") {
    return binaryAssetRef.storageStatus === "storage-unsupported-v1"
      ? "ephemeral-browser-file-v1"
      : "available-package-local-bytes-v1";
  }

  if (input.verificationReport.status === "unsupported") {
    return "verification-unsupported-v1";
  }

  if (input.verificationReport.issues.some((issue) => issue.code === "binary.bytes.missing")) {
    return binaryAssetRef.storageStatus === "storage-unsupported-v1"
      ? "requires-reupload-v1"
      : "missing-package-local-bytes-v1";
  }

  return "available-metadata-mismatch-v1";
}

function deriveUnverifiedAvailability(
  storageStatus: BinaryAssetStorageStatusDto
): PackageBinaryByteAvailabilityDto {
  switch (storageStatus) {
    case "stored-package-local-v1":
      return "available-package-local-bytes-v1";
    case "missing-package-local-bytes-v1":
      return "missing-package-local-bytes-v1";
    case "storage-unsupported-v1":
      return "requires-reupload-v1";
  }
}

function getPackageBinaryByteIntakeVerificationStatus(
  report?: PackageBinaryAssetVerificationReport
): PackageBinaryByteIntakeVerificationStatusDto {
  if (report === undefined) {
    return "not-verified-v1";
  }

  switch (report.status) {
    case "pass":
      return "verified-pass-v1";
    case "fail":
      return "verified-fail-v1";
    case "unsupported":
      return "verification-unsupported-v1";
  }
}

function assertVerificationReportMatchesRef(
  binaryAssetRef: BinaryAssetReferenceDto,
  report?: PackageBinaryAssetVerificationReport
): void {
  if (report === undefined) {
    return;
  }

  if (
    report.binaryAssetId !== binaryAssetRef.binaryAssetId ||
    report.packageRelativePath !== binaryAssetRef.packageRelativePath ||
    report.expectedByteLength !== binaryAssetRef.byteLength ||
    report.expectedDigest.algorithm !== binaryAssetRef.digest.algorithm ||
    report.expectedDigest.hex !== binaryAssetRef.digest.hex ||
    report.expectedMediaType !== binaryAssetRef.mediaType
  ) {
    throw new PackageBinaryByteIntakeSummaryError(
      `Verification report does not match binary asset "${binaryAssetRef.binaryAssetId}".`
    );
  }
}
