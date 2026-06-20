import {
  RUNTIME_EXPORT_ATLAS_PATH,
  RUNTIME_EXPORT_MANIFEST_PATH,
  RUNTIME_EXPORT_MODEL_PATH,
  RUNTIME_EXPORT_RAW_RGBA_MEDIA_TYPE,
  RuntimeExportArtifactsSchema,
  RuntimeExportAtlasSchema,
  RuntimeExportFilePathSchema,
  RuntimeExportRawRgbaMediaTypeSchema,
  RuntimeExportTextArtifactPathSchema,
  RuntimeExportTexturePagePathSchema,
  assertRuntimeExportV0SinglePageArtifacts,
  type RuntimeExportArtifactsDto,
  type RuntimeExportFilePathDto,
  type RuntimeExportRawRgbaMediaTypeDto,
  type RuntimeExportTextArtifactPathDto,
  type RuntimeExportTexturePagePathDto
} from "./runtime-export.js";
import { stringifyJsonDeterministic } from "./package-json-serialization.js";

export interface RuntimeExportTextFileEntry {
  readonly path: RuntimeExportTextArtifactPathDto;
  readonly text: string;
}

export interface RuntimeExportBinaryTextureFileEntry {
  readonly path: RuntimeExportTexturePagePathDto;
  readonly bytes: Uint8Array;
  readonly mediaType: RuntimeExportRawRgbaMediaTypeDto;
}

export type RuntimeExportFileEntry =
  | RuntimeExportTextFileEntry
  | RuntimeExportBinaryTextureFileEntry;

export type RuntimeExportFileSet = readonly RuntimeExportFileEntry[];
export type RuntimeExportTextFileSet = readonly RuntimeExportTextFileEntry[];

export interface CreateRuntimeExportBinaryTextureFileEntryInput {
  readonly path: string;
  readonly bytes: Uint8Array | ArrayBuffer;
  readonly mediaType?: string;
}

export class RuntimeExportFileSetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeExportFileSetError";
  }
}

export function assertRuntimeExportFilePath(path: string): RuntimeExportFilePathDto {
  const parsed = RuntimeExportFilePathSchema.safeParse(path);

  if (!parsed.success) {
    throw new RuntimeExportFileSetError(`Unsupported Runtime Export file path "${path}"`);
  }

  return parsed.data;
}

export function assertRuntimeExportTextArtifactPath(
  path: string
): RuntimeExportTextArtifactPathDto {
  const parsed = RuntimeExportTextArtifactPathSchema.safeParse(path);

  if (!parsed.success) {
    throw new RuntimeExportFileSetError(
      `Unsupported Runtime Export text artifact path "${path}"`
    );
  }

  return parsed.data;
}

export function assertRuntimeExportTexturePagePath(
  path: string
): RuntimeExportTexturePagePathDto {
  const parsed = RuntimeExportTexturePagePathSchema.safeParse(path);

  if (!parsed.success) {
    throw new RuntimeExportFileSetError(
      `Unsupported Runtime Export texture page path "${path}"`
    );
  }

  return parsed.data;
}

export function createRuntimeExportTextFileEntry(
  path: string,
  text: string
): RuntimeExportTextFileEntry {
  return {
    path: assertRuntimeExportTextArtifactPath(path),
    text
  };
}

export function createRuntimeExportBinaryTextureFileEntry(
  input: CreateRuntimeExportBinaryTextureFileEntryInput
): RuntimeExportBinaryTextureFileEntry {
  return {
    path: assertRuntimeExportTexturePagePath(input.path),
    bytes: copyRuntimeExportBytes(input.bytes),
    mediaType: RuntimeExportRawRgbaMediaTypeSchema.parse(
      input.mediaType ?? RUNTIME_EXPORT_RAW_RGBA_MEDIA_TYPE
    )
  };
}

export function createRuntimeExportFileSet(
  entries: readonly RuntimeExportFileEntry[]
): RuntimeExportFileSet {
  const normalizedEntries = entries.map(normalizeRuntimeExportFileEntry);
  assertUniqueRuntimeExportFilePaths(normalizedEntries.map((entry) => entry.path));

  return normalizedEntries;
}

export function assertUniqueRuntimeExportFilePaths(paths: readonly string[]): void {
  const seen = new Set<string>();

  for (const path of paths) {
    const validPath = assertRuntimeExportFilePath(path);

    if (seen.has(validPath)) {
      throw new RuntimeExportFileSetError(`Duplicate Runtime Export file path "${validPath}"`);
    }

    seen.add(validPath);
  }
}

export function isRuntimeExportTextFileEntry(
  entry: RuntimeExportFileEntry
): entry is RuntimeExportTextFileEntry {
  return "text" in entry;
}

export function isRuntimeExportBinaryTextureFileEntry(
  entry: RuntimeExportFileEntry
): entry is RuntimeExportBinaryTextureFileEntry {
  return "bytes" in entry;
}

export function serializeRuntimeExportArtifactsToTextFileSet(
  artifacts: RuntimeExportArtifactsDto
): RuntimeExportTextFileSet {
  const parsedArtifacts = RuntimeExportArtifactsSchema.parse(artifacts);

  return [
    createJsonFileEntry(RUNTIME_EXPORT_MANIFEST_PATH, parsedArtifacts.manifest),
    createJsonFileEntry(RUNTIME_EXPORT_MODEL_PATH, parsedArtifacts.model),
    createJsonFileEntry(RUNTIME_EXPORT_ATLAS_PATH, parsedArtifacts.atlas)
  ];
}

export function parseRuntimeExportArtifactsFromFileSet(
  fileSet: RuntimeExportFileSet
): RuntimeExportArtifactsDto {
  const fileMap = indexRuntimeExportTextArtifacts(createRuntimeExportFileSet(fileSet));

  const artifacts = {
    manifest: parseJsonFile(RUNTIME_EXPORT_MANIFEST_PATH, fileMap),
    model: parseJsonFile(RUNTIME_EXPORT_MODEL_PATH, fileMap),
    atlas: parseJsonFile(RUNTIME_EXPORT_ATLAS_PATH, fileMap)
  };

  return assertRuntimeExportV0SinglePageArtifacts(artifacts);
}

export function parseRuntimeExportAtlasFromFileSet(
  fileSet: RuntimeExportFileSet
): RuntimeExportArtifactsDto["atlas"] {
  const fileMap = indexRuntimeExportTextArtifacts(createRuntimeExportFileSet(fileSet));

  return RuntimeExportAtlasSchema.parse(
    parseJsonFile(RUNTIME_EXPORT_ATLAS_PATH, fileMap)
  );
}

function normalizeRuntimeExportFileEntry(
  entry: RuntimeExportFileEntry
): RuntimeExportFileEntry {
  if (isRuntimeExportTextFileEntry(entry) && isRuntimeExportBinaryTextureFileEntry(entry)) {
    throw new RuntimeExportFileSetError(
      `Runtime Export file "${entry.path}" cannot be both text and binary`
    );
  }

  if (isRuntimeExportBinaryTextureFileEntry(entry)) {
    return createRuntimeExportBinaryTextureFileEntry(entry);
  }

  return createRuntimeExportTextFileEntry(entry.path, entry.text);
}

function indexRuntimeExportTextArtifacts(
  fileSet: RuntimeExportFileSet
): ReadonlyMap<RuntimeExportTextArtifactPathDto, string> {
  const fileMap = new Map<RuntimeExportTextArtifactPathDto, string>();

  for (const entry of fileSet) {
    if (!isRuntimeExportTextFileEntry(entry)) {
      continue;
    }

    if (fileMap.has(entry.path)) {
      throw new RuntimeExportFileSetError(
        `Duplicate Runtime Export text artifact path "${entry.path}"`
      );
    }

    fileMap.set(entry.path, entry.text);
  }

  return fileMap;
}

function createJsonFileEntry(
  path: RuntimeExportTextArtifactPathDto,
  value: unknown
): RuntimeExportTextFileEntry {
  return createRuntimeExportTextFileEntry(path, stringifyJsonDeterministic(value));
}

function parseJsonFile(
  path: RuntimeExportTextArtifactPathDto,
  fileMap: ReadonlyMap<RuntimeExportTextArtifactPathDto, string>
): unknown {
  const text = fileMap.get(path);

  if (text === undefined) {
    throw new RuntimeExportFileSetError(`Missing required Runtime Export file "${path}"`);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new RuntimeExportFileSetError(
      `Invalid JSON in Runtime Export file "${path}": ${message}`
    );
  }
}

function copyRuntimeExportBytes(bytes: Uint8Array | ArrayBuffer): Uint8Array {
  if (bytes instanceof Uint8Array) {
    return new Uint8Array(bytes);
  }

  return new Uint8Array(bytes.slice(0));
}
