import { z } from "zod";

import { PackageIdSchema } from "@private-2d-rigging-lab/contracts";

import {
  BinaryAssetByteLengthSchema,
  BinaryAssetDigestSchema,
  BinaryAssetIdSchema,
  BinaryAssetPackageRelativePathSchema
} from "./binary-asset.js";
import { PackageBinaryByteIntakeSummarySchema } from "./byte-intake.js";

export const PackageBinaryPackageRevisionSchema = z.number().int().nonnegative();

export const PackageBinaryCurrentSessionBytesStateSchema = z.enum([
  "available-current-session-bytes-v1",
  "missing-current-session-bytes-v1"
]);
export type PackageBinaryCurrentSessionBytesStateDto = z.infer<
  typeof PackageBinaryCurrentSessionBytesStateSchema
>;
export const PackageBinaryCurrentSessionBytesStateDtoSchema =
  PackageBinaryCurrentSessionBytesStateSchema;

export const PackageBinaryDirectCallByteAvailabilitySchema = z.enum([
  "available-current-session-bytes-v1",
  "available-current-session-metadata-mismatch-v1",
  "missing-current-session-bytes-v1",
  "requires-reupload-v1",
  "stale-verified-summary-v1",
  "verification-unsupported-v1"
]);
export type PackageBinaryDirectCallByteAvailabilityDto = z.infer<
  typeof PackageBinaryDirectCallByteAvailabilitySchema
>;
export const PackageBinaryDirectCallByteAvailabilityDtoSchema =
  PackageBinaryDirectCallByteAvailabilitySchema;

export const PackageBinaryVerifiedSummaryStatusSchema = z.enum([
  "not-supplied-v1",
  "current-v1",
  "stale-v1"
]);
export type PackageBinaryVerifiedSummaryStatusDto = z.infer<
  typeof PackageBinaryVerifiedSummaryStatusSchema
>;
export const PackageBinaryVerifiedSummaryStatusDtoSchema =
  PackageBinaryVerifiedSummaryStatusSchema;

export const PackageBinaryCurrentSessionVerificationStatusSchema = z.enum([
  "not-supplied-v1",
  "pass-v1",
  "fail-v1",
  "unsupported-v1"
]);
export type PackageBinaryCurrentSessionVerificationStatusDto = z.infer<
  typeof PackageBinaryCurrentSessionVerificationStatusSchema
>;
export const PackageBinaryCurrentSessionVerificationStatusDtoSchema =
  PackageBinaryCurrentSessionVerificationStatusSchema;

export const PackageBinaryByteAvailabilityReportStatusSchema = z.enum([
  "pass-v1",
  "fail-v1",
  "unsupported-v1"
]);
export type PackageBinaryByteAvailabilityReportStatusDto = z.infer<
  typeof PackageBinaryByteAvailabilityReportStatusSchema
>;
export const PackageBinaryByteAvailabilityReportStatusDtoSchema =
  PackageBinaryByteAvailabilityReportStatusSchema;

export const PackageBinaryByteAvailabilityIssueCodeSchema = z.enum([
  "byteAvailability.currentSessionBytes.missing",
  "byteAvailability.requiresReupload",
  "byteAvailability.verifiedSummary.stale",
  "byteAvailability.packageId.mismatch",
  "byteAvailability.packageRevision.mismatch",
  "byteAvailability.binaryAssetRef.mismatch",
  "byteAvailability.digest.mismatch",
  "byteAvailability.byteLength.mismatch",
  "byteAvailability.mediaType.mismatch",
  "byteAvailability.digest.unsupported"
]);
export type PackageBinaryByteAvailabilityIssueCodeDto = z.infer<
  typeof PackageBinaryByteAvailabilityIssueCodeSchema
>;
export const PackageBinaryByteAvailabilityIssueCodeDtoSchema =
  PackageBinaryByteAvailabilityIssueCodeSchema;

export const PackageBinaryByteAvailabilityIssueSourceSchema = z.enum([
  "current-session-verification-report-v1",
  "verified-summary-v1",
  "caller-reupload-state-v1"
]);
export type PackageBinaryByteAvailabilityIssueSourceDto = z.infer<
  typeof PackageBinaryByteAvailabilityIssueSourceSchema
>;
export const PackageBinaryByteAvailabilityIssueSourceDtoSchema =
  PackageBinaryByteAvailabilityIssueSourceSchema;

export const PackageBinaryByteAvailabilityIssueSchema = z.object({
  code: PackageBinaryByteAvailabilityIssueCodeSchema,
  source: PackageBinaryByteAvailabilityIssueSourceSchema,
  targetPath: z.string().min(1),
  expected: z.string(),
  actual: z.string(),
  message: z.string().min(1)
}).strict();
export type PackageBinaryByteAvailabilityIssueDto = z.infer<
  typeof PackageBinaryByteAvailabilityIssueSchema
>;
export const PackageBinaryByteAvailabilityIssueDtoSchema =
  PackageBinaryByteAvailabilityIssueSchema;

export const PackageBinaryByteVerifiedSummarySnapshotSchema = z.object({
  schemaVersion: z.literal("package-binary-byte-verified-summary-snapshot-v1"),
  packageId: PackageIdSchema,
  packageRevision: PackageBinaryPackageRevisionSchema,
  summary: PackageBinaryByteIntakeSummarySchema
}).strict();
export type PackageBinaryByteVerifiedSummarySnapshotDto = z.infer<
  typeof PackageBinaryByteVerifiedSummarySnapshotSchema
>;
export const PackageBinaryByteVerifiedSummarySnapshotDtoSchema =
  PackageBinaryByteVerifiedSummarySnapshotSchema;

export const PackageBinaryByteAvailabilityReportSchema = z.object({
  schemaVersion: z.literal("package-binary-byte-availability-report-v1"),
  packageId: PackageIdSchema,
  packageRevision: PackageBinaryPackageRevisionSchema,
  binaryAssetId: BinaryAssetIdSchema,
  packageRelativePath: BinaryAssetPackageRelativePathSchema,
  expectedDigest: BinaryAssetDigestSchema,
  expectedByteLength: BinaryAssetByteLengthSchema,
  currentSessionBytes: PackageBinaryCurrentSessionBytesStateSchema,
  availability: PackageBinaryDirectCallByteAvailabilitySchema,
  requiresReupload: z.boolean(),
  verifiedSummaryStatus: PackageBinaryVerifiedSummaryStatusSchema,
  currentSessionVerificationStatus: PackageBinaryCurrentSessionVerificationStatusSchema,
  status: PackageBinaryByteAvailabilityReportStatusSchema,
  actualDigest: BinaryAssetDigestSchema.optional(),
  actualByteLength: BinaryAssetByteLengthSchema.optional(),
  issues: z.array(PackageBinaryByteAvailabilityIssueSchema)
}).strict();
export type PackageBinaryByteAvailabilityReportDto = z.infer<
  typeof PackageBinaryByteAvailabilityReportSchema
>;
export const PackageBinaryByteAvailabilityReportDtoSchema =
  PackageBinaryByteAvailabilityReportSchema;
