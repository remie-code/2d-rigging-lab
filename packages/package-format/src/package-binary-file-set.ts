import {
  BinaryAssetByteLengthSchema,
  BinaryAssetEntrySchema,
  BinaryAssetIdSchema,
  BinaryAssetMediaTypeSchema,
  BinaryAssetPackageRelativePathSchema,
  BinaryAssetReferenceSchema,
  type BinaryAssetByteLengthDto,
  type BinaryAssetDigestDto,
  type BinaryAssetEntryDto,
  type BinaryAssetIdDto,
  type BinaryAssetMediaTypeDto,
  type BinaryAssetPackageRelativePathDto,
  type BinaryAssetReferenceDto
} from "./binary-asset.js";
import { assertPackageRelativePath, assertUniquePackageFilePaths } from "./package-file-paths.js";
import {
  PackageFileSetError,
  parsePackageDocumentFromFileSet,
  type PackageFileSet,
  type PackageTextFileEntry
} from "./package-file-set.js";
import type { PackageDocumentDto } from "./package-document.js";

export type PackageBinaryBytes = Uint8Array | ArrayBuffer;

export interface PackageBinaryFileEntry {
  readonly path: BinaryAssetPackageRelativePathDto;
  readonly bytes: Uint8Array;
  readonly mediaType: BinaryAssetMediaTypeDto;
  readonly binaryAssetId?: BinaryAssetIdDto;
}

export type PackageInMemoryFileEntry = PackageTextFileEntry | PackageBinaryFileEntry;
export type PackageInMemoryFileSet = readonly PackageInMemoryFileEntry[];

export interface CreatePackageBinaryFileEntryInput {
  readonly path: string;
  readonly bytes: PackageBinaryBytes;
  readonly mediaType: string;
  readonly binaryAssetId?: string;
}

export type PackageBinaryDigestResult =
  | {
      readonly status: "computed";
      readonly digest: BinaryAssetDigestDto;
    }
  | {
      readonly status: "unsupported";
      readonly reason: "web-crypto-unavailable";
    };

export type PackageBinaryAssetVerificationStatus = "pass" | "fail" | "unsupported";

export type PackageBinaryAssetVerificationIssueCode =
  | "binary.assetId.mismatch"
  | "binary.byteLength.mismatch"
  | "binary.bytes.missing"
  | "binary.digest.mismatch"
  | "binary.digest.unsupported"
  | "binary.mediaType.mismatch";

export interface PackageBinaryAssetVerificationIssue {
  readonly code: PackageBinaryAssetVerificationIssueCode;
  readonly binaryAssetId: BinaryAssetIdDto;
  readonly path: BinaryAssetPackageRelativePathDto;
  readonly expected: string;
  readonly actual: string;
  readonly message: string;
}

export interface PackageBinaryAssetVerificationReport {
  readonly status: PackageBinaryAssetVerificationStatus;
  readonly binaryAssetId: BinaryAssetIdDto;
  readonly packageRelativePath: BinaryAssetPackageRelativePathDto;
  readonly expectedByteLength: BinaryAssetByteLengthDto;
  readonly expectedDigest: BinaryAssetDigestDto;
  readonly expectedMediaType: BinaryAssetMediaTypeDto;
  readonly actualByteLength?: BinaryAssetByteLengthDto;
  readonly actualDigest?: BinaryAssetDigestDto;
  readonly actualMediaType?: BinaryAssetMediaTypeDto;
  readonly issues: readonly PackageBinaryAssetVerificationIssue[];
}

interface PackageBinaryAssetExpectedMetadata {
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

export function createPackageBinaryFileEntry(
  input: CreatePackageBinaryFileEntryInput
): PackageBinaryFileEntry {
  const binaryAssetId = input.binaryAssetId === undefined
    ? undefined
    : BinaryAssetIdSchema.parse(input.binaryAssetId);
  const entry = {
    path: BinaryAssetPackageRelativePathSchema.parse(input.path),
    bytes: copyBinaryBytes(input.bytes),
    mediaType: BinaryAssetMediaTypeSchema.parse(input.mediaType),
    ...(binaryAssetId === undefined ? {} : { binaryAssetId })
  };

  return entry;
}

export function createPackageInMemoryFileSet(
  entries: readonly PackageInMemoryFileEntry[]
): PackageInMemoryFileSet {
  const normalizedEntries = entries.map(normalizePackageInMemoryFileEntry);
  assertUniquePackageFilePaths(normalizedEntries.map((entry) => entry.path));

  return normalizedEntries;
}

export function isPackageBinaryFileEntry(
  entry: PackageInMemoryFileEntry
): entry is PackageBinaryFileEntry {
  return "bytes" in entry;
}

export function isPackageTextFileEntry(
  entry: PackageInMemoryFileEntry
): entry is PackageTextFileEntry {
  return "text" in entry;
}

export function extractPackageTextFileSet(fileSet: PackageInMemoryFileSet): PackageFileSet {
  return createPackageInMemoryFileSet(fileSet)
    .filter(isPackageTextFileEntry)
    .map((entry) => ({
      path: assertPackageRelativePath(entry.path),
      text: entry.text
    }));
}

export function parsePackageDocumentFromInMemoryFileSet(
  fileSet: PackageInMemoryFileSet
): PackageDocumentDto {
  return parsePackageDocumentFromFileSet(extractPackageTextFileSet(fileSet));
}

export function readPackageBinaryFileEntry(
  fileSet: PackageInMemoryFileSet,
  target: string | BinaryAssetReferenceDto | BinaryAssetEntryDto
): PackageBinaryFileEntry | undefined {
  const packageRelativePath = getBinaryAssetTargetPath(target);

  return createPackageInMemoryFileSet(fileSet)
    .filter(isPackageBinaryFileEntry)
    .find((entry) => entry.path === packageRelativePath);
}

export function getPackageBinaryByteLength(bytes: PackageBinaryBytes): BinaryAssetByteLengthDto {
  return BinaryAssetByteLengthSchema.parse(copyBinaryBytes(bytes).byteLength);
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

  const digestBuffer = await crypto.subtle.digest("SHA-256", copyBinaryBytes(bytes));

  return {
    status: "computed",
    digest: {
      algorithm: "sha256",
      hex: toLowerHex(new Uint8Array(digestBuffer))
    }
  };
}

export async function verifyPackageBinaryAssetBytes(
  fileSet: PackageInMemoryFileSet,
  expectedAsset: BinaryAssetReferenceDto | BinaryAssetEntryDto
): Promise<PackageBinaryAssetVerificationReport> {
  const expected = getBinaryAssetExpectedMetadata(expectedAsset);
  const binaryEntry = readPackageBinaryFileEntry(fileSet, expected.packageRelativePath);
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

function normalizePackageInMemoryFileEntry(
  entry: PackageInMemoryFileEntry
): PackageInMemoryFileEntry {
  if (isPackageBinaryFileEntry(entry) && isPackageTextFileEntry(entry)) {
    throw new PackageFileSetError(`Package file "${entry.path}" cannot be both text and binary`);
  }

  if (isPackageBinaryFileEntry(entry)) {
    return createPackageBinaryFileEntry(entry);
  }

  return {
    path: assertPackageRelativePath(entry.path),
    text: entry.text
  };
}

function getBinaryAssetTargetPath(
  target: string | BinaryAssetReferenceDto | BinaryAssetEntryDto
): BinaryAssetPackageRelativePathDto {
  if (typeof target === "string") {
    return BinaryAssetPackageRelativePathSchema.parse(target);
  }

  return getBinaryAssetExpectedMetadata(target).packageRelativePath;
}

function getBinaryAssetExpectedMetadata(
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

function copyBinaryBytes(bytes: PackageBinaryBytes): Uint8Array {
  if (bytes instanceof Uint8Array) {
    return new Uint8Array(bytes);
  }

  return new Uint8Array(bytes.slice(0));
}

function getPackageBinaryDigestCrypto(): PackageBinaryDigestCrypto | undefined {
  return (globalThis as typeof globalThis & {
    readonly crypto?: PackageBinaryDigestCrypto;
  }).crypto;
}

function toLowerHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
