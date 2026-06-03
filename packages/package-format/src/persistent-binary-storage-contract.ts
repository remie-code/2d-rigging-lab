import { z } from "zod";

import { PackageIdSchema } from "@private-2d-rigging-lab/contracts";

import {
  BinaryAssetByteLengthSchema,
  BinaryAssetDigestSchema,
  BinaryAssetIdSchema,
  BinaryAssetMediaTypeSchema,
  BinaryAssetPackageRelativePathSchema
} from "./binary-asset.js";
import { PackageBinaryPackageRevisionSchema } from "./byte-availability-contract.js";

export const PackageBinaryPersistentStorageBackendSchema = z.enum([
  "indexeddb-same-origin-browser-local-v1"
]);
export type PackageBinaryPersistentStorageBackendDto = z.infer<
  typeof PackageBinaryPersistentStorageBackendSchema
>;
export const PackageBinaryPersistentStorageBackendDtoSchema =
  PackageBinaryPersistentStorageBackendSchema;

export const PackageBinaryPersistentStorageBackendStateSchema = z.enum([
  "available-v1",
  "unavailable-v1",
  "unsupported-v1"
]);
export type PackageBinaryPersistentStorageBackendStateDto = z.infer<
  typeof PackageBinaryPersistentStorageBackendStateSchema
>;
export const PackageBinaryPersistentStorageBackendStateDtoSchema =
  PackageBinaryPersistentStorageBackendStateSchema;

export const PackageBinaryPersistentRecordStatusSchema = z.enum([
  "not-supplied-v1",
  "current-v1",
  "unverified-v1",
  "stale-v1"
]);
export type PackageBinaryPersistentRecordStatusDto = z.infer<
  typeof PackageBinaryPersistentRecordStatusSchema
>;
export const PackageBinaryPersistentRecordStatusDtoSchema =
  PackageBinaryPersistentRecordStatusSchema;

export const PackageBinaryPersistentVerificationStatusSchema = z.enum([
  "not-supplied-v1",
  "pass-v1",
  "fail-v1",
  "unsupported-v1"
]);
export type PackageBinaryPersistentVerificationStatusDto = z.infer<
  typeof PackageBinaryPersistentVerificationStatusSchema
>;
export const PackageBinaryPersistentVerificationStatusDtoSchema =
  PackageBinaryPersistentVerificationStatusSchema;

export const PackageBinaryPersistentByteAvailabilitySchema = z.enum([
  "available-browser-local-persistent-bytes-v1",
  "unavailable-browser-local-persistent-bytes-v1",
  "corrupt-browser-local-persistent-bytes-v1",
  "stale-browser-local-persistent-record-v1",
  "verification-unsupported-v1"
]);
export type PackageBinaryPersistentByteAvailabilityDto = z.infer<
  typeof PackageBinaryPersistentByteAvailabilitySchema
>;
export const PackageBinaryPersistentByteAvailabilityDtoSchema =
  PackageBinaryPersistentByteAvailabilitySchema;

export const PackageBinaryPersistentByteAvailabilityReportStatusSchema = z.enum([
  "pass-v1",
  "fail-v1",
  "unsupported-v1"
]);
export type PackageBinaryPersistentByteAvailabilityReportStatusDto = z.infer<
  typeof PackageBinaryPersistentByteAvailabilityReportStatusSchema
>;
export const PackageBinaryPersistentByteAvailabilityReportStatusDtoSchema =
  PackageBinaryPersistentByteAvailabilityReportStatusSchema;

export const PackageBinaryPersistentByteAvailabilityIssueCodeSchema = z.enum([
  "persistentByteStorage.backend.unavailable",
  "persistentByteStorage.backend.mismatch",
  "persistentByteStorage.record.missing",
  "persistentByteStorage.record.unverified",
  "persistentByteStorage.verification.missing",
  "persistentByteStorage.packageId.mismatch",
  "persistentByteStorage.packageRevision.mismatch",
  "persistentByteStorage.binaryAssetRef.mismatch",
  "persistentByteStorage.digest.mismatch",
  "persistentByteStorage.byteLength.mismatch",
  "persistentByteStorage.mediaType.mismatch",
  "persistentByteStorage.bytes.missing",
  "persistentByteStorage.digest.unsupported"
]);
export type PackageBinaryPersistentByteAvailabilityIssueCodeDto = z.infer<
  typeof PackageBinaryPersistentByteAvailabilityIssueCodeSchema
>;
export const PackageBinaryPersistentByteAvailabilityIssueCodeDtoSchema =
  PackageBinaryPersistentByteAvailabilityIssueCodeSchema;

export const PackageBinaryPersistentByteAvailabilityIssueSourceSchema = z.enum([
  "storage-backend-state-v1",
  "persistent-storage-record-v1",
  "persistent-storage-verification-report-v1"
]);
export type PackageBinaryPersistentByteAvailabilityIssueSourceDto = z.infer<
  typeof PackageBinaryPersistentByteAvailabilityIssueSourceSchema
>;
export const PackageBinaryPersistentByteAvailabilityIssueSourceDtoSchema =
  PackageBinaryPersistentByteAvailabilityIssueSourceSchema;

export const PackageBinaryPersistentByteAvailabilityIssueSchema = z.object({
  code: PackageBinaryPersistentByteAvailabilityIssueCodeSchema,
  source: PackageBinaryPersistentByteAvailabilityIssueSourceSchema,
  targetPath: z.string().min(1),
  expected: z.string(),
  actual: z.string(),
  message: z.string().min(1)
}).strict();
export type PackageBinaryPersistentByteAvailabilityIssueDto = z.infer<
  typeof PackageBinaryPersistentByteAvailabilityIssueSchema
>;
export const PackageBinaryPersistentByteAvailabilityIssueDtoSchema =
  PackageBinaryPersistentByteAvailabilityIssueSchema;

export const PackageBinaryPersistentByteRecordSchema = z.object({
  schemaVersion: z.literal("package-binary-persistent-byte-record-v1"),
  packageId: PackageIdSchema,
  packageRevision: PackageBinaryPackageRevisionSchema,
  binaryAssetId: BinaryAssetIdSchema,
  packageRelativePath: BinaryAssetPackageRelativePathSchema,
  digest: BinaryAssetDigestSchema,
  byteLength: BinaryAssetByteLengthSchema,
  mediaType: BinaryAssetMediaTypeSchema,
  storageBackend: PackageBinaryPersistentStorageBackendSchema,
  storedAt: z.string().datetime(),
  verifiedAt: z.string().datetime().optional()
}).strict();
export type PackageBinaryPersistentByteRecordDto = z.infer<
  typeof PackageBinaryPersistentByteRecordSchema
>;
export const PackageBinaryPersistentByteRecordDtoSchema =
  PackageBinaryPersistentByteRecordSchema;

export const PackageBinaryPersistentByteAvailabilityReportSchema = z.object({
  schemaVersion: z.literal("package-binary-persistent-byte-availability-report-v1"),
  packageId: PackageIdSchema,
  packageRevision: PackageBinaryPackageRevisionSchema,
  binaryAssetId: BinaryAssetIdSchema,
  packageRelativePath: BinaryAssetPackageRelativePathSchema,
  expectedDigest: BinaryAssetDigestSchema,
  expectedByteLength: BinaryAssetByteLengthSchema,
  expectedMediaType: BinaryAssetMediaTypeSchema,
  storageBackend: PackageBinaryPersistentStorageBackendSchema,
  storageBackendState: PackageBinaryPersistentStorageBackendStateSchema,
  recordStatus: PackageBinaryPersistentRecordStatusSchema,
  persistentVerificationStatus: PackageBinaryPersistentVerificationStatusSchema,
  availability: PackageBinaryPersistentByteAvailabilitySchema,
  requiresReupload: z.boolean(),
  status: PackageBinaryPersistentByteAvailabilityReportStatusSchema,
  storedAt: z.string().datetime().optional(),
  verifiedAt: z.string().datetime().optional(),
  actualDigest: BinaryAssetDigestSchema.optional(),
  actualByteLength: BinaryAssetByteLengthSchema.optional(),
  actualMediaType: BinaryAssetMediaTypeSchema.optional(),
  issues: z.array(PackageBinaryPersistentByteAvailabilityIssueSchema)
}).strict();
export type PackageBinaryPersistentByteAvailabilityReportDto = z.infer<
  typeof PackageBinaryPersistentByteAvailabilityReportSchema
>;
export const PackageBinaryPersistentByteAvailabilityReportDtoSchema =
  PackageBinaryPersistentByteAvailabilityReportSchema;
