import {
  BinaryAssetByteLengthSchema,
  BinaryAssetPackageRelativePathSchema,
  type BinaryAssetByteLengthDto,
  type BinaryAssetDigestDto,
  type BinaryAssetEntryDto,
  type BinaryAssetIdDto,
  type BinaryAssetMediaTypeDto,
  type BinaryAssetPackageRelativePathDto,
  type BinaryAssetReferenceDto
} from "./binary-asset.js";
import {
  getBinaryAssetExpectedMetadata,
  verifyIndexedPackageBinaryAssetBytes
} from "./package-binary-asset-verification.js";
import {
  copyPackageBinaryBytes,
  indexPackageInMemoryFileSet,
  normalizePackageBinaryFileEntry,
  normalizePackageInMemoryFileEntry,
  readIndexedPackageBinaryFileEntry
} from "./package-binary-file-index.js";
import { assertPackageRelativePath, assertUniquePackageFilePaths } from "./package-file-paths.js";
import {
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

export { computePackageBinarySha256Digest } from "./package-binary-asset-verification.js";

export function createPackageBinaryFileEntry(
  input: CreatePackageBinaryFileEntryInput
): PackageBinaryFileEntry {
  return normalizePackageBinaryFileEntry(input, "copy");
}

export function createPackageInMemoryFileSet(
  entries: readonly PackageInMemoryFileEntry[]
): PackageInMemoryFileSet {
  const normalizedEntries = entries.map((entry) => normalizePackageInMemoryFileEntry(entry, "copy"));
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
  // Checks every entry like createPackageInMemoryFileSet, without copying binary bytes it drops.
  return indexPackageInMemoryFileSet(fileSet).entries
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

  // Every entry is still checked (path safety, duplicates); only the returned entry's bytes are copied.
  return readIndexedPackageBinaryFileEntry(
    indexPackageInMemoryFileSet(fileSet),
    packageRelativePath
  );
}

export function getPackageBinaryByteLength(bytes: PackageBinaryBytes): BinaryAssetByteLengthDto {
  return BinaryAssetByteLengthSchema.parse(copyPackageBinaryBytes(bytes).byteLength);
}

export async function verifyPackageBinaryAssetBytes(
  fileSet: PackageInMemoryFileSet,
  expectedAsset: BinaryAssetReferenceDto | BinaryAssetEntryDto
): Promise<PackageBinaryAssetVerificationReport> {
  const expected = getBinaryAssetExpectedMetadata(expectedAsset);

  // Every entry is still checked (path safety, duplicates); no entry's bytes are copied here.
  return verifyIndexedPackageBinaryAssetBytes(indexPackageInMemoryFileSet(fileSet), expected);
}

function getBinaryAssetTargetPath(
  target: string | BinaryAssetReferenceDto | BinaryAssetEntryDto
): BinaryAssetPackageRelativePathDto {
  if (typeof target === "string") {
    return BinaryAssetPackageRelativePathSchema.parse(target);
  }

  return getBinaryAssetExpectedMetadata(target).packageRelativePath;
}
