import {
  BinaryAssetByteLengthSchema,
  BinaryAssetEntrySchema,
  BinaryAssetReferenceSchema,
  type BinaryAssetByteLengthDto,
  type BinaryAssetDigestDto,
  type BinaryAssetEntryDto,
  type BinaryAssetIdDto,
  type BinaryAssetMediaTypeDto,
  type BinaryAssetPackageRelativePathDto,
  type BinaryAssetReferenceDto
} from "./binary-asset.js";
import { copyPackageBinaryBytes, type PackageInMemoryFileIndex } from "./package-binary-file-index.js";
import type {
  PackageBinaryAssetVerificationIssue,
  PackageBinaryAssetVerificationIssueCode,
  PackageBinaryAssetVerificationReport,
  PackageBinaryAssetVerificationStatus,
  PackageBinaryBytes,
  PackageBinaryDigestResult,
  PackageBinaryFileEntry
} from "./package-binary-file-set.js";

/**
 * Internal to package-format (not re-exported from index.ts, except
 * computePackageBinarySha256Digest, which package-binary-file-set.ts re-exports).
 */
export interface PackageBinaryAssetExpectedMetadata {
  readonly binaryAssetId: BinaryAssetIdDto;
  readonly packageRelativePath: BinaryAssetPackageRelativePathDto;
  readonly digest: BinaryAssetDigestDto;
  readonly byteLength: BinaryAssetByteLengthDto;
  readonly mediaType: BinaryAssetMediaTypeDto;
}

interface PackageBinaryDigestCrypto {
  readonly subtle?: {
    digest(algorithm: "SHA-256", data: Uint8Array): Promise<ArrayBuffer>;
  };
}

export async function computePackageBinarySha256Digest(
  bytes: PackageBinaryBytes
): Promise<PackageBinaryDigestResult> {
  const crypto = getPackageBinaryDigestCrypto();

  if (crypto?.subtle === undefined) {
    return {
      status: "unsupported",
      reason: "web-crypto-unavailable"
    };
  }

  const digestBuffer = await crypto.subtle.digest("SHA-256", copyPackageBinaryBytes(bytes));

  return {
    status: "computed",
    digest: {
      algorithm: "sha256",
      hex: toLowerHex(new Uint8Array(digestBuffer))
    }
  };
}

export function getBinaryAssetExpectedMetadata(
  expectedAsset: BinaryAssetReferenceDto | BinaryAssetEntryDto
): PackageBinaryAssetExpectedMetadata {
  const parsedAsset = "referenceKind" in expectedAsset
    ? BinaryAssetReferenceSchema.parse(expectedAsset)
    : BinaryAssetEntrySchema.parse(expectedAsset);

  return {
    binaryAssetId: parsedAsset.binaryAssetId,
    packageRelativePath: parsedAsset.packageRelativePath,
    digest: parsedAsset.digest,
    byteLength: parsedAsset.byteLength,
    mediaType: parsedAsset.mediaType
  };
}

/** Verifies one asset against an already checked file set, without copying the whole set. */
export async function verifyIndexedPackageBinaryAssetBytes(
  index: PackageInMemoryFileIndex,
  expected: PackageBinaryAssetExpectedMetadata
): Promise<PackageBinaryAssetVerificationReport> {
  return verifyPackageBinaryFileEntryAgainstExpected(
    index.binaryEntriesByPath.get(expected.packageRelativePath),
    expected
  );
}

export async function verifyPackageBinaryFileEntryAgainstExpected(
  binaryEntry: PackageBinaryFileEntry | undefined,
  expected: PackageBinaryAssetExpectedMetadata
): Promise<PackageBinaryAssetVerificationReport> {
  const issues: PackageBinaryAssetVerificationIssue[] = [];

  if (binaryEntry === undefined) {
    issues.push(createVerificationIssue({
      code: "binary.bytes.missing",
      expected,
      expectedValue: expected.packageRelativePath,
      actualValue: "missing",
      message: `Missing binary bytes for package file "${expected.packageRelativePath}"`
    }));

    return createVerificationReport({ expected, issues });
  }

  if (binaryEntry.binaryAssetId !== undefined && binaryEntry.binaryAssetId !== expected.binaryAssetId) {
    issues.push(createVerificationIssue({
      code: "binary.assetId.mismatch",
      expected,
      expectedValue: expected.binaryAssetId,
      actualValue: binaryEntry.binaryAssetId,
      message: `Binary asset id mismatch for "${expected.packageRelativePath}"`
    }));
  }

  const actualByteLength = BinaryAssetByteLengthSchema.parse(binaryEntry.bytes.byteLength);

  if (actualByteLength !== expected.byteLength) {
    issues.push(createVerificationIssue({
      code: "binary.byteLength.mismatch",
      expected,
      expectedValue: String(expected.byteLength),
      actualValue: String(actualByteLength),
      message: `Binary byte length mismatch for "${expected.packageRelativePath}"`
    }));
  }

  if (binaryEntry.mediaType !== expected.mediaType) {
    issues.push(createVerificationIssue({
      code: "binary.mediaType.mismatch",
      expected,
      expectedValue: expected.mediaType,
      actualValue: binaryEntry.mediaType,
      message: `Binary media type mismatch for "${expected.packageRelativePath}"`
    }));
  }

  const digestResult = await computePackageBinarySha256Digest(binaryEntry.bytes);

  if (digestResult.status === "unsupported") {
    issues.push(createVerificationIssue({
      code: "binary.digest.unsupported",
      expected,
      expectedValue: "sha256",
      actualValue: digestResult.reason,
      message: `SHA-256 digest verification is unsupported for "${expected.packageRelativePath}"`
    }));

    return createVerificationReport({
      expected,
      issues,
      actualByteLength,
      actualMediaType: binaryEntry.mediaType
    });
  }

  if (digestResult.digest.hex !== expected.digest.hex) {
    issues.push(createVerificationIssue({
      code: "binary.digest.mismatch",
      expected,
      expectedValue: expected.digest.hex,
      actualValue: digestResult.digest.hex,
      message: `Binary SHA-256 digest mismatch for "${expected.packageRelativePath}"`
    }));
  }

  return createVerificationReport({
    expected,
    issues,
    actualByteLength,
    actualDigest: digestResult.digest,
    actualMediaType: binaryEntry.mediaType
  });
}

function createVerificationIssue(input: {
  readonly code: PackageBinaryAssetVerificationIssueCode;
  readonly expected: PackageBinaryAssetExpectedMetadata;
  readonly expectedValue: string;
  readonly actualValue: string;
  readonly message: string;
}): PackageBinaryAssetVerificationIssue {
  return {
    code: input.code,
    binaryAssetId: input.expected.binaryAssetId,
    path: input.expected.packageRelativePath,
    expected: input.expectedValue,
    actual: input.actualValue,
    message: input.message
  };
}

function createVerificationReport(input: {
  readonly expected: PackageBinaryAssetExpectedMetadata;
  readonly issues: readonly PackageBinaryAssetVerificationIssue[];
  readonly actualByteLength?: BinaryAssetByteLengthDto;
  readonly actualDigest?: BinaryAssetDigestDto;
  readonly actualMediaType?: BinaryAssetMediaTypeDto;
}): PackageBinaryAssetVerificationReport {
  const hasFailure = input.issues.some((issue) => issue.code !== "binary.digest.unsupported");
  const hasUnsupported = input.issues.some((issue) => issue.code === "binary.digest.unsupported");
  const status: PackageBinaryAssetVerificationStatus = hasFailure
    ? "fail"
    : hasUnsupported
      ? "unsupported"
      : "pass";

  return {
    status,
    binaryAssetId: input.expected.binaryAssetId,
    packageRelativePath: input.expected.packageRelativePath,
    expectedByteLength: input.expected.byteLength,
    expectedDigest: input.expected.digest,
    expectedMediaType: input.expected.mediaType,
    ...(input.actualByteLength === undefined ? {} : { actualByteLength: input.actualByteLength }),
    ...(input.actualDigest === undefined ? {} : { actualDigest: input.actualDigest }),
    ...(input.actualMediaType === undefined ? {} : { actualMediaType: input.actualMediaType }),
    issues: input.issues
  };
}

function getPackageBinaryDigestCrypto(): PackageBinaryDigestCrypto | undefined {
  return (globalThis as typeof globalThis & {
    readonly crypto?: PackageBinaryDigestCrypto;
  }).crypto;
}

function toLowerHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
