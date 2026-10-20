import {
  BinaryAssetIdSchema,
  BinaryAssetMediaTypeSchema,
  BinaryAssetPackageRelativePathSchema,
  type BinaryAssetPackageRelativePathDto
} from "./binary-asset.js";
import { assertPackageRelativePath, assertUniquePackageFilePaths } from "./package-file-paths.js";
import { PackageFileSetError } from "./package-file-set.js";
import type {
  CreatePackageBinaryFileEntryInput,
  PackageBinaryBytes,
  PackageBinaryFileEntry,
  PackageInMemoryFileEntry
} from "./package-binary-file-set.js";

/**
 * Internal to package-format (not re-exported from index.ts).
 *
 * How a normalized binary entry holds its bytes:
 * - "copy": the entry owns a private copy (what the public API returns).
 * - "share": a Uint8Array is kept by reference; only the entry's metadata is validated.
 *   Used for read-only lookups so that checking an entry set does not copy every texture.
 */
export type PackageBinaryByteHandling = "copy" | "share";

/**
 * A file set whose entries have all been checked once (path safety, text/binary exclusivity,
 * binary metadata schemas, duplicate paths), with binary entries indexed by path.
 * With byteHandling "share" (the default), binary entries share the caller's bytes; read them
 * through readIndexedPackageBinaryFileEntry to get an isolated copy. With "copy", the index owns
 * a private copy of every binary entry, taken when the index is built.
 */
export interface PackageInMemoryFileIndex {
  readonly entries: readonly PackageInMemoryFileEntry[];
  readonly binaryEntriesByPath: ReadonlyMap<BinaryAssetPackageRelativePathDto, PackageBinaryFileEntry>;
}

export function indexPackageInMemoryFileSet(
  entries: readonly PackageInMemoryFileEntry[],
  byteHandling: PackageBinaryByteHandling = "share"
): PackageInMemoryFileIndex {
  const normalizedEntries = entries.map((entry) => normalizePackageInMemoryFileEntry(entry, byteHandling));
  assertUniquePackageFilePaths(normalizedEntries.map((entry) => entry.path));

  const binaryEntriesByPath = new Map<BinaryAssetPackageRelativePathDto, PackageBinaryFileEntry>();

  for (const entry of normalizedEntries) {
    if (isBinaryEntry(entry)) {
      binaryEntriesByPath.set(entry.path, entry);
    }
  }

  return {
    entries: normalizedEntries,
    binaryEntriesByPath
  };
}

/** Returns a copy of the indexed binary entry so callers cannot reach the source bytes. */
export function readIndexedPackageBinaryFileEntry(
  index: PackageInMemoryFileIndex,
  packageRelativePath: BinaryAssetPackageRelativePathDto
): PackageBinaryFileEntry | undefined {
  const entry = index.binaryEntriesByPath.get(packageRelativePath);

  if (entry === undefined) {
    return undefined;
  }

  return {
    path: entry.path,
    bytes: copyPackageBinaryBytes(entry.bytes),
    mediaType: entry.mediaType,
    ...(entry.binaryAssetId === undefined ? {} : { binaryAssetId: entry.binaryAssetId })
  };
}

export function normalizePackageInMemoryFileEntry(
  entry: PackageInMemoryFileEntry,
  byteHandling: PackageBinaryByteHandling
): PackageInMemoryFileEntry {
  if (isBinaryEntry(entry) && "text" in entry) {
    throw new PackageFileSetError(`Package file "${entry.path}" cannot be both text and binary`);
  }

  if (isBinaryEntry(entry)) {
    return normalizePackageBinaryFileEntry(entry, byteHandling);
  }

  return {
    path: assertPackageRelativePath(entry.path),
    text: entry.text
  };
}

export function normalizePackageBinaryFileEntry(
  input: CreatePackageBinaryFileEntryInput,
  byteHandling: PackageBinaryByteHandling
): PackageBinaryFileEntry {
  const binaryAssetId = input.binaryAssetId === undefined
    ? undefined
    : BinaryAssetIdSchema.parse(input.binaryAssetId);
  const entry = {
    path: BinaryAssetPackageRelativePathSchema.parse(input.path),
    bytes: byteHandling === "share" && input.bytes instanceof Uint8Array
      ? input.bytes
      : copyPackageBinaryBytes(input.bytes),
    mediaType: BinaryAssetMediaTypeSchema.parse(input.mediaType),
    ...(binaryAssetId === undefined ? {} : { binaryAssetId })
  };

  return entry;
}

export function copyPackageBinaryBytes(bytes: PackageBinaryBytes): Uint8Array {
  if (bytes instanceof Uint8Array) {
    return new Uint8Array(bytes);
  }

  return new Uint8Array(bytes.slice(0));
}

function isBinaryEntry(entry: PackageInMemoryFileEntry): entry is PackageBinaryFileEntry {
  return "bytes" in entry;
}
