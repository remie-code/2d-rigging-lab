import {
  describe,
  expect,
  it
} from "vitest";

import {
  BinaryAssetReferenceSchema,
  PackageBinaryByteVerifiedSummarySnapshotSchema,
  computePackageBinarySha256Digest,
  createPackageBinaryByteIntakeSummary,
  createPackageBinaryFileEntry,
  createPackageInMemoryFileSet,
  verifyPackageBinaryAssetBytes,
  type BinaryAssetDigestDto,
  type BinaryAssetReferenceDto,
  type PackageBinaryAssetVerificationReport,
  type PackageBinaryByteVerifiedSummarySnapshotDto,
  type PackageBinaryBytes
} from "@private-2d-rigging-lab/package-format";

import { defaultCheckCatalog } from "./check-catalog.js";
import type { ValidationCheckResultDto } from "./validation-report.js";
import { validateByteIntakePreflight } from "./validators/byte-intake-preflight.js";

const PACKAGE_ID = "pkg_byteAvailabilityValidator";
const PACKAGE_REVISION = 7;
const SOURCE_BYTES = new Uint8Array([0x61, 0x62, 0x63]);
const OTHER_BYTES = new Uint8Array([0x64, 0x65, 0x66, 0x67]);

describe("byte-intake current-session byte availability diagnostics", () => {
  it("registers Domain A byte availability diagnostics in the check catalog", () => {
    expect(defaultCheckCatalog.has("byteAvailability.currentSessionBytes.missing")).toBe(true);
    expect(defaultCheckCatalog.has("byteAvailability.requiresReupload")).toBe(true);
    expect(defaultCheckCatalog.has("byteAvailability.verifiedSummary.stale")).toBe(true);
    expect(defaultCheckCatalog.has("byteAvailability.packageId.mismatch")).toBe(true);
    expect(defaultCheckCatalog.has("byteAvailability.packageRevision.mismatch")).toBe(true);
    expect(defaultCheckCatalog.has("byteAvailability.binaryAssetRef.mismatch")).toBe(true);
    expect(defaultCheckCatalog.has("byteAvailability.digest.mismatch")).toBe(true);
    expect(defaultCheckCatalog.has("byteAvailability.byteLength.mismatch")).toBe(true);
    expect(defaultCheckCatalog.has("byteAvailability.mediaType.mismatch")).toBe(true);
    expect(defaultCheckCatalog.has("byteAvailability.digest.unsupported")).toBe(true);
  });

  it("accepts valid current-session verification evidence without raw bytes", async () => {
    const binaryAssetRef = await createBinaryAssetReference({
      binaryAssetId: "bin_byteAvailability_valid",
      packageRelativePath: "assets/sources/valid.bin",
      bytes: SOURCE_BYTES
    });
    const verificationReport = await createVerificationReport(binaryAssetRef, SOURCE_BYTES);
    const verifiedSummary = createVerifiedSummary(binaryAssetRef, verificationReport);

    const checks = await validateByteIntakePreflight({
      packageId: PACKAGE_ID,
      packageRevision: PACKAGE_REVISION,
      assets: [{
        intakeSummary: verifiedSummary.summary,
        currentSessionVerificationReport: verificationReport,
        targetKind: "sourceAsset",
        targetId: "src_byteAvailability"
      }]
    });

    expect(checks).toEqual([]);
  });

  it("rejects a verified summary when current-session byte evidence is missing", async () => {
    const binaryAssetRef = await createBinaryAssetReference({
      binaryAssetId: "bin_byteAvailability_stale",
      packageRelativePath: "assets/sources/stale.bin",
      bytes: SOURCE_BYTES
    });
    const verificationReport = await createVerificationReport(binaryAssetRef, SOURCE_BYTES);
    const verifiedSummary = createVerifiedSummary(binaryAssetRef, verificationReport);

    const checks = await validateByteIntakePreflight({
      packageId: PACKAGE_ID,
      packageRevision: PACKAGE_REVISION,
      assets: [{
        verifiedSummary,
        intakeSummary: verifiedSummary.summary,
        targetKind: "sourceAsset",
        targetId: "src_byteAvailability"
      }]
    });

    expect(checks.map((check) => check.checkId)).toEqual([
      "byteAvailability.currentSessionBytes.missing",
      "byteAvailability.verifiedSummary.stale"
    ]);
    expectByteAvailabilityCheck(checks, {
      checkId: "byteAvailability.currentSessionBytes.missing",
      availabilityIssueTargetPath: "/currentSessionVerificationReport",
      evidence: [
        "availability=stale-verified-summary-v1",
        "currentSessionBytes=missing-current-session-bytes-v1",
        "availabilityIssueSource=current-session-verification-report-v1",
        `packageId=${PACKAGE_ID}`,
        `packageRevision=${PACKAGE_REVISION}`
      ]
    });
    expectByteAvailabilityCheck(checks, {
      checkId: "byteAvailability.verifiedSummary.stale",
      availabilityIssueTargetPath: "/verifiedSummary/summary",
      evidence: [
        "verifiedSummaryStatus=stale-v1",
        "availabilityIssueSource=verified-summary-v1",
        "expected=current-session-verified-bytes",
        "actual=missing-current-session-verification-report"
      ]
    });
  });

  it("reports plain missing current-session bytes for a binary asset reference without stale summary or reupload state", async () => {
    const binaryAssetRef = await createBinaryAssetReference({
      binaryAssetId: "bin_byteAvailability_missing",
      packageRelativePath: "assets/sources/missing-current-session.bin",
      bytes: SOURCE_BYTES
    });

    const checks = await validateByteIntakePreflight({
      packageId: PACKAGE_ID,
      packageRevision: PACKAGE_REVISION,
      assets: [{
        binaryAssetRef,
        targetKind: "sourceAsset",
        targetId: "src_byteAvailability"
      }]
    });

    expect(checks.map((check) => check.checkId)).toEqual([
      "byteAvailability.currentSessionBytes.missing"
    ]);
    expectByteAvailabilityCheck(checks, {
      checkId: "byteAvailability.currentSessionBytes.missing",
      availabilityIssueTargetPath: "/currentSessionVerificationReport",
      evidence: [
        "availability=missing-current-session-bytes-v1",
        "availabilityStatus=fail-v1",
        "currentSessionBytes=missing-current-session-bytes-v1",
        "currentSessionVerificationStatus=not-supplied-v1",
        "requiresReupload=false",
        "verifiedSummaryStatus=not-supplied-v1",
        "availabilityIssueSource=current-session-verification-report-v1",
        "expected=current-session-verification-report",
        "actual=missing",
        `packageId=${PACKAGE_ID}`,
        `packageRevision=${PACKAGE_REVISION}`
      ]
    });
  });

  it("reports stale package identity, revision, and verified-summary metadata mismatches", async () => {
    const originalRef = await createBinaryAssetReference({
      binaryAssetId: "bin_byteAvailability_original",
      packageRelativePath: "assets/sources/original.bin",
      bytes: SOURCE_BYTES
    });
    const changedRef = await createBinaryAssetReference({
      binaryAssetId: "bin_byteAvailability_changed",
      packageRelativePath: "assets/sources/changed.bin",
      bytes: OTHER_BYTES
    });
    const verificationReport = await createVerificationReport(originalRef, SOURCE_BYTES);
    const verifiedSummary = createVerifiedSummary(originalRef, verificationReport, {
      packageId: "pkg_byteAvailability_previous",
      packageRevision: PACKAGE_REVISION - 1
    });

    const checks = await validateByteIntakePreflight({
      packageId: PACKAGE_ID,
      packageRevision: PACKAGE_REVISION,
      assets: [{
        binaryAssetRef: changedRef,
        verifiedSummary,
        targetKind: "sourceAsset",
        targetId: "src_byteAvailability"
      }]
    });

    expect(checks.map((check) => check.checkId)).toEqual([
      "byteAvailability.currentSessionBytes.missing",
      "byteAvailability.packageId.mismatch",
      "byteAvailability.packageRevision.mismatch",
      "byteAvailability.binaryAssetRef.mismatch",
      "byteAvailability.digest.mismatch",
      "byteAvailability.byteLength.mismatch",
      "byteAvailability.verifiedSummary.stale"
    ]);
    expectByteAvailabilityCheck(checks, {
      checkId: "byteAvailability.packageId.mismatch",
      availabilityIssueTargetPath: "/verifiedSummary/packageId",
      evidence: [
        "availabilityIssueSource=verified-summary-v1",
        `expected=${PACKAGE_ID}`,
        "actual=pkg_byteAvailability_previous"
      ]
    });
    expectByteAvailabilityCheck(checks, {
      checkId: "byteAvailability.packageRevision.mismatch",
      availabilityIssueTargetPath: "/verifiedSummary/packageRevision",
      evidence: [
        "availabilityIssueSource=verified-summary-v1",
        `expected=${PACKAGE_REVISION}`,
        `actual=${PACKAGE_REVISION - 1}`
      ]
    });
    expectByteAvailabilityCheck(checks, {
      checkId: "byteAvailability.binaryAssetRef.mismatch",
      availabilityIssueTargetPath: "/verifiedSummary/summary/binaryAssetRef"
    });
    expectByteAvailabilityCheck(checks, {
      checkId: "byteAvailability.digest.mismatch",
      availabilityIssueTargetPath: "/verifiedSummary/summary/digest"
    });
    expectByteAvailabilityCheck(checks, {
      checkId: "byteAvailability.byteLength.mismatch",
      availabilityIssueTargetPath: "/verifiedSummary/summary/byteLength"
    });
    expect(checks.flatMap((check) => check.evidence)).toEqual(expect.arrayContaining([
      "availability=stale-verified-summary-v1",
      "availabilityIssueCode=byteAvailability.packageId.mismatch",
      "availabilityIssueCode=byteAvailability.packageRevision.mismatch",
      `expected=${PACKAGE_REVISION}`,
      `actual=${PACKAGE_REVISION - 1}`,
      "availabilityIssueCode=byteAvailability.binaryAssetRef.mismatch",
      "availabilityIssueCode=byteAvailability.digest.mismatch",
      "availabilityIssueCode=byteAvailability.byteLength.mismatch"
    ]));
  });

  it("reports current-session availability metadata mismatches", async () => {
    const expectedRef = await createBinaryAssetReference({
      binaryAssetId: "bin_byteAvailability_expected",
      packageRelativePath: "assets/sources/expected.bin",
      bytes: SOURCE_BYTES
    });
    const mismatchedRef = await createBinaryAssetReference({
      binaryAssetId: "bin_byteAvailability_mismatch",
      packageRelativePath: "assets/sources/mismatch.bin",
      bytes: OTHER_BYTES,
      mediaType: "text/plain"
    });
    const verificationReport = await createVerificationReport(expectedRef, SOURCE_BYTES);

    const checks = await validateByteIntakePreflight({
      packageId: PACKAGE_ID,
      packageRevision: PACKAGE_REVISION,
      assets: [{
        binaryAssetRef: mismatchedRef,
        currentSessionVerificationReport: verificationReport,
        targetKind: "sourceAsset",
        targetId: "src_byteAvailability"
      }]
    });

    expect(checks.map((check) => check.checkId)).toEqual([
      "byteAvailability.binaryAssetRef.mismatch",
      "byteAvailability.digest.mismatch",
      "byteAvailability.byteLength.mismatch",
      "byteAvailability.mediaType.mismatch"
    ]);
    expectByteAvailabilityCheck(checks, {
      checkId: "byteAvailability.binaryAssetRef.mismatch",
      availabilityIssueTargetPath: "/currentSessionVerificationReport/binaryAssetRef"
    });
    expectByteAvailabilityCheck(checks, {
      checkId: "byteAvailability.digest.mismatch",
      availabilityIssueTargetPath: "/currentSessionVerificationReport/expectedDigest"
    });
    expectByteAvailabilityCheck(checks, {
      checkId: "byteAvailability.byteLength.mismatch",
      availabilityIssueTargetPath: "/currentSessionVerificationReport/expectedByteLength"
    });
    expectByteAvailabilityCheck(checks, {
      checkId: "byteAvailability.mediaType.mismatch",
      availabilityIssueTargetPath: "/currentSessionVerificationReport/expectedMediaType",
      evidence: [
        "expected=text/plain",
        "actual=application/octet-stream"
      ]
    });
    expect(checks.flatMap((check) => check.evidence)).toEqual(expect.arrayContaining([
      "availability=available-current-session-metadata-mismatch-v1",
      "currentSessionBytes=available-current-session-bytes-v1",
      "currentSessionVerificationStatus=pass-v1",
      "availabilityIssueSource=current-session-verification-report-v1"
    ]));
  });

  it("reports requires-reupload without claiming parser, archive, or image decode support", async () => {
    const binaryAssetRef = await createBinaryAssetReference({
      binaryAssetId: "bin_byteAvailability_reupload",
      packageRelativePath: "assets/sources/reupload.bin",
      bytes: SOURCE_BYTES,
      storageStatus: "storage-unsupported-v1"
    });

    const checks = await validateByteIntakePreflight({
      packageId: PACKAGE_ID,
      packageRevision: PACKAGE_REVISION,
      assets: [{
        binaryAssetRef,
        bytesAvailability: "requiresReupload",
        targetKind: "sourceAsset",
        targetId: "src_byteAvailability"
      }]
    });

    expect(checks.map((check) => check.checkId)).toEqual([
      "byteAvailability.currentSessionBytes.missing",
      "byteAvailability.requiresReupload"
    ]);
    expectByteAvailabilityCheck(checks, {
      checkId: "byteAvailability.currentSessionBytes.missing",
      availabilityIssueTargetPath: "/currentSessionVerificationReport",
      evidence: [
        "availability=requires-reupload-v1",
        "requiresReupload=true"
      ]
    });
    expectByteAvailabilityCheck(checks, {
      checkId: "byteAvailability.requiresReupload",
      availabilityIssueTargetPath: "/requiresReupload",
      evidence: [
        "availability=requires-reupload-v1",
        "requiresReupload=true",
        "expected=current-session-bytes",
        "actual=requires-reupload"
      ]
    });
    expect(checks.flatMap((check) => check.evidence)).toEqual(expect.arrayContaining([
      "availability=requires-reupload-v1",
      "requiresReupload=true",
      "availabilityIssueCode=byteAvailability.requiresReupload",
      "expected=current-session-bytes",
      "actual=requires-reupload"
    ]));
    for (const check of checks) {
      expect(check.message).not.toMatch(/parser|archive|decode|raster/i);
      expect(check.impact).not.toMatch(/parser|archive|decode|raster/i);
    }
  });
});

const createBinaryAssetReference = async (input: {
  readonly binaryAssetId: string;
  readonly packageRelativePath: string;
  readonly bytes: PackageBinaryBytes;
  readonly mediaType?: string;
  readonly storageStatus?: BinaryAssetReferenceDto["storageStatus"];
}): Promise<BinaryAssetReferenceDto> =>
  BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: input.binaryAssetId,
    packageRelativePath: input.packageRelativePath,
    digest: await computeDigest(input.bytes),
    byteLength: input.bytes.byteLength,
    mediaType: input.mediaType ?? "application/octet-stream",
    storageStatus: input.storageStatus ?? "stored-package-local-v1",
    provenanceId: "prov_byteAvailability",
    rightsAssetId: "src_byteAvailability"
  });

const createVerificationReport = async (
  binaryAssetRef: BinaryAssetReferenceDto,
  bytes: PackageBinaryBytes
): Promise<PackageBinaryAssetVerificationReport> => {
  const report = await verifyPackageBinaryAssetBytes(
    createPackageInMemoryFileSet([
      createPackageBinaryFileEntry({
        path: binaryAssetRef.packageRelativePath,
        bytes,
        mediaType: binaryAssetRef.mediaType,
        binaryAssetId: binaryAssetRef.binaryAssetId
      })
    ]),
    binaryAssetRef
  );

  expect(report.status).toBe("pass");
  return report;
};

const createVerifiedSummary = (
  binaryAssetRef: BinaryAssetReferenceDto,
  verificationReport: PackageBinaryAssetVerificationReport,
  overrides: {
    readonly packageId?: string;
    readonly packageRevision?: number;
  } = {}
): PackageBinaryByteVerifiedSummarySnapshotDto =>
  PackageBinaryByteVerifiedSummarySnapshotSchema.parse({
    schemaVersion: "package-binary-byte-verified-summary-snapshot-v1",
    packageId: overrides.packageId ?? PACKAGE_ID,
    packageRevision: overrides.packageRevision ?? PACKAGE_REVISION,
    summary: createPackageBinaryByteIntakeSummary({
      filename: getFileName(binaryAssetRef.packageRelativePath),
      binaryAssetRef,
      verificationReport
    })
  });

const computeDigest = async (bytes: PackageBinaryBytes): Promise<BinaryAssetDigestDto> => {
  const result = await computePackageBinarySha256Digest(bytes);

  if (result.status === "unsupported") {
    throw new Error("Test environment does not support SHA-256 digest verification.");
  }

  return result.digest;
};

const expectByteAvailabilityCheck = (
  checks: readonly ValidationCheckResultDto[],
  expected: {
    readonly checkId: string;
    readonly availabilityIssueTargetPath: string;
    readonly targetPath?: string;
    readonly evidence?: readonly string[];
  }
): ValidationCheckResultDto => {
  const targetPath = expected.targetPath ?? "/byteIntake/assets/0";
  const check = checks.find((candidate) =>
    candidate.checkId === expected.checkId &&
    candidate.evidence.includes(`availabilityIssueTargetPath=${expected.availabilityIssueTargetPath}`)
  );

  if (check === undefined) {
    throw new Error(
      `Expected ${expected.checkId} at ${expected.availabilityIssueTargetPath}. Found: ${checks.map((candidate) =>
        `${candidate.checkId}:${candidate.evidence.find((item) => item.startsWith("availabilityIssueTargetPath=")) ?? "missing-target-path"}`
      ).join(", ")}`
    );
  }

  expect(check).toMatchObject({
    checkId: expected.checkId,
    status: "fail",
    severity: "error",
    phase: "reference",
    target: {
      kind: "sourceAsset",
      id: "src_byteAvailability",
      path: targetPath
    },
    targetPath
  });
  expect(check.evidence).toEqual(expect.arrayContaining([
    `availabilityIssueCode=${expected.checkId}`,
    `availabilityIssueTargetPath=${expected.availabilityIssueTargetPath}`,
    ...(expected.evidence ?? [])
  ]));

  return check;
};

const getFileName = (path: string): string => {
  const pathParts = path.split("/");
  return pathParts[pathParts.length - 1] ?? path;
};
