import {
  type PackageDocumentDto
} from "./package-document.js";
import { assertPackageRelativePath, assertUniquePackageFilePaths } from "./package-file-paths.js";
import {
  parsePackageDocumentFromFileSet,
  serializePackageDocumentToFileSet,
  type PackageFileSet,
  type PackageTextFileEntry
} from "./package-file-set.js";
import { stringifyJsonDeterministic } from "./package-json-serialization.js";
import {
  createWorkspaceMetadataForPackageDocument,
  WORKSPACE_METADATA_PATH,
  WorkspaceMetadataSchema,
  type WorkspaceMetadataDto
} from "./workspace-metadata.js";

export const WORKSPACE_BINARY_ASSET_INDEX_METADATA_PATH =
  "metadata/binary-asset-index.json";
export const WORKSPACE_BYTE_INTAKE_SUMMARIES_METADATA_PATH =
  "metadata/byte-intake-summaries.json";

export type WorkspaceFileSetWarningCode =
  | "workspace.metadata.binaryAssetIndex.ignored"
  | "workspace.metadata.byteIntakeSummaries.ignored";

export interface WorkspaceFileSetWarning {
  readonly code: WorkspaceFileSetWarningCode;
  readonly path: string;
  readonly message: string;
}

export interface SerializeWorkspacePackageFileSetInput {
  readonly packageDocument: PackageDocumentDto;
  readonly workspaceMetadata?: WorkspaceMetadataDto;
  readonly derivedMetadataEntries?: readonly PackageTextFileEntry[];
}

export interface ParseWorkspacePackageDocumentFromFileSetResult {
  readonly workspaceMetadata: WorkspaceMetadataDto;
  readonly packageDocument: PackageDocumentDto;
  readonly warnings: readonly WorkspaceFileSetWarning[];
}

export class WorkspaceFileSetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceFileSetError";
  }
}

export function serializeWorkspacePackageFileSet(
  input: SerializeWorkspacePackageFileSetInput
): PackageFileSet {
  const workspaceMetadata = WorkspaceMetadataSchema.parse(
    input.workspaceMetadata ?? createWorkspaceMetadataForPackageDocument(input.packageDocument)
  );
  const entries = [
    createTextEntry(WORKSPACE_METADATA_PATH, stringifyJsonDeterministic(workspaceMetadata)),
    ...serializePackageDocumentToFileSet(input.packageDocument),
    ...(input.derivedMetadataEntries ?? []).map((entry) =>
      createDerivedMetadataEntry(entry.path, entry.text)
    )
  ];

  assertUniquePackageFilePaths(entries.map((entry) => entry.path));

  return entries;
}

export function parseWorkspacePackageDocumentFromFileSet(
  fileSet: PackageFileSet
): ParseWorkspacePackageDocumentFromFileSetResult {
  const fileMap = indexWorkspaceFileSet(fileSet);
  const workspaceMetadataText = fileMap.get(WORKSPACE_METADATA_PATH);

  if (workspaceMetadataText === undefined) {
    throw new WorkspaceFileSetError(`Missing required workspace file "${WORKSPACE_METADATA_PATH}"`);
  }

  const workspaceMetadata = WorkspaceMetadataSchema.parse(
    parseJsonFile(WORKSPACE_METADATA_PATH, workspaceMetadataText)
  );
  const packageDocument = parsePackageDocumentFromFileSet(
    fileSet.filter((entry) =>
      entry.path !== WORKSPACE_METADATA_PATH &&
      !isWorkspaceDerivedMetadataPath(entry.path)
    )
  );

  return {
    workspaceMetadata,
    packageDocument,
    warnings: createDerivedMetadataWarnings(fileMap)
  };
}

function indexWorkspaceFileSet(fileSet: PackageFileSet): ReadonlyMap<string, string> {
  const fileMap = new Map<string, string>();

  for (const entry of fileSet) {
    const path = assertPackageRelativePath(entry.path);

    if (fileMap.has(path)) {
      throw new WorkspaceFileSetError(`Duplicate workspace file path "${path}"`);
    }

    fileMap.set(path, entry.text);
  }

  return fileMap;
}

function createTextEntry(path: string, text: string): PackageTextFileEntry {
  return {
    path: assertPackageRelativePath(path),
    text
  };
}

function createDerivedMetadataEntry(path: string, text: string): PackageTextFileEntry {
  if (!isWorkspaceDerivedMetadataPath(path)) {
    throw new WorkspaceFileSetError(
      `Unsupported workspace derived metadata path "${path}"`
    );
  }

  return createTextEntry(path, text);
}

function parseJsonFile(path: string, text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new WorkspaceFileSetError(`Invalid JSON in workspace file "${path}": ${message}`);
  }
}

function createDerivedMetadataWarnings(
  fileMap: ReadonlyMap<string, string>
): readonly WorkspaceFileSetWarning[] {
  const warnings: WorkspaceFileSetWarning[] = [];

  if (fileMap.has(WORKSPACE_BINARY_ASSET_INDEX_METADATA_PATH)) {
    warnings.push({
      code: "workspace.metadata.binaryAssetIndex.ignored",
      path: WORKSPACE_BINARY_ASSET_INDEX_METADATA_PATH,
      message:
        "metadata/binary-asset-index.json is derived workspace metadata; PackageDocument binary refs and verified files are authoritative."
    });
  }

  if (fileMap.has(WORKSPACE_BYTE_INTAKE_SUMMARIES_METADATA_PATH)) {
    warnings.push({
      code: "workspace.metadata.byteIntakeSummaries.ignored",
      path: WORKSPACE_BYTE_INTAKE_SUMMARIES_METADATA_PATH,
      message:
        "metadata/byte-intake-summaries.json is derived workspace metadata; PackageDocument binary refs and verified files are authoritative."
    });
  }

  return warnings;
}

function isWorkspaceDerivedMetadataPath(path: string): boolean {
  return path === WORKSPACE_BINARY_ASSET_INDEX_METADATA_PATH ||
    path === WORKSPACE_BYTE_INTAKE_SUMMARIES_METADATA_PATH;
}
