import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";

// Test-only helpers that normalize the non-deterministic fields of a saved package so
// load/save round-trips and repeated command runs can be compared for structural
// equality. The normalized fields are:
//   - manifest.json: `updatedAt` (and `createdAt`, which the seed fixes but is normalized
//     defensively) — wall-clock save timestamps.
//   - workspace.json: `updatedAt` / `createdAt` — same wall-clock timestamps.
//   - operations/log.jsonl: each entry's `timestamp` — commit wall-clock time.
// Everything else (model graph, ids, revisions, diffs) is deterministic given a fixed
// operation sequence.

const NORMALIZED_TIMESTAMP = "<normalized-timestamp>";

export interface NormalizedPackageSnapshot {
  readonly files: Record<string, unknown>;
}

/**
 * Reads every `.json` file plus `operations/log.jsonl` under a package directory and
 * returns a normalized snapshot keyed by POSIX package-relative path. Binary files are
 * summarized by byte length so texture round-trips are still compared.
 */
export const readNormalizedPackageSnapshot = async (
  packageDirectory: string
): Promise<NormalizedPackageSnapshot> => {
  const filePaths = await collectRelativeFilePaths(packageDirectory);
  const files: Record<string, unknown> = {};

  for (const relativePath of filePaths.sort()) {
    const absolutePath = join(packageDirectory, ...relativePath.split("/"));

    if (relativePath.endsWith(".json")) {
      files[relativePath] = normalizeJsonValue(
        relativePath,
        JSON.parse(await readFile(absolutePath, "utf8")) as unknown
      );
      continue;
    }

    if (relativePath === "operations/log.jsonl") {
      files[relativePath] = normalizeOperationLog(await readFile(absolutePath, "utf8"));
      continue;
    }

    const bytes = await readFile(absolutePath);
    files[relativePath] = { binaryByteLength: bytes.byteLength };
  }

  return { files };
};

const collectRelativeFilePaths = async (packageDirectory: string): Promise<string[]> => {
  const collected: string[] = [];

  const walk = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }

      collected.push(relative(packageDirectory, absolute).split(sep).join("/"));
    }
  };

  await walk(packageDirectory);
  return collected;
};

const normalizeJsonValue = (relativePath: string, value: unknown): unknown => {
  if (relativePath === "manifest.json" || relativePath === "workspace.json") {
    return normalizeTimestampFields(value);
  }

  return value;
};

const normalizeTimestampFields = (value: unknown): unknown => {
  if (typeof value !== "object" || value === null) {
    return value;
  }

  const record = { ...(value as Record<string, unknown>) };
  for (const field of ["createdAt", "updatedAt"]) {
    if (field in record) {
      record[field] = NORMALIZED_TIMESTAMP;
    }
  }

  return record;
};

const normalizeOperationLog = (jsonlText: string): readonly unknown[] =>
  jsonlText
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const entry = JSON.parse(line) as Record<string, unknown>;
      return { ...entry, timestamp: NORMALIZED_TIMESTAMP };
    });
