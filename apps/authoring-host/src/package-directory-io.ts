import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, posix, sep } from "node:path";

import {
  createAuthoringWorkspaceSavePlan,
  getAuthoringSessionBinaryFileEntries,
  hydrateAuthoringWorkspaceSessionBinaryAssets,
  openAuthoringWorkspaceFromTextFileSet
} from "@private-2d-rigging-lab/authoring-core";
import type {
  AuthoringSession,
  AuthoringWorkspaceBinaryFileEntry,
  AuthoringWorkspaceBinaryRegistrationTarget,
  AuthoringWorkspaceTextFileEntry
} from "@private-2d-rigging-lab/authoring-core";
import { parseOperationLogEntriesFromJsonl } from "@private-2d-rigging-lab/operation-core";
import type { OperationLogEntryDto } from "@private-2d-rigging-lab/operation-core";
import type {
  PackageBinaryFileEntry,
  PackageDocumentDto,
  WorkspaceMetadataDto
} from "@private-2d-rigging-lab/package-format";

export interface LoadedAuthoringPackage {
  readonly session: AuthoringSession;
  readonly packageDocument: PackageDocumentDto;
  readonly workspaceMetadata: WorkspaceMetadataDto;
  readonly operationLogEntries: readonly OperationLogEntryDto[];
}

export class PackageDirectoryIoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackageDirectoryIoError";
  }
}

/**
 * Loads an open-model-package-v1 directory from disk into an AuthoringSession using
 * the same package structure the browser Editor reads: all package-relative `.json`
 * text files plus binary assets (textures) referenced by the parsed document. The
 * text file set is parsed via authoring-core's workspace open path, and binary bytes
 * are hydrated into the session so a later save can round-trip them.
 */
export const loadAuthoringPackageDirectory = async (
  packageDirectory: string
): Promise<LoadedAuthoringPackage> => {
  const textEntries = await readTextFileSet(packageDirectory);
  if (textEntries.length === 0) {
    throw new PackageDirectoryIoError(
      `No package JSON files found under directory "${packageDirectory}".`
    );
  }

  const opened = openAuthoringWorkspaceFromTextFileSet({ fileSet: textEntries });
  const binaryEntries = await readBinaryEntriesForTargets(
    packageDirectory,
    opened.binaryRegistrationTargets
  );

  hydrateAuthoringWorkspaceSessionBinaryAssets({
    session: opened.session,
    binaryRegistrationTargets: opened.binaryRegistrationTargets,
    binaryEntries
  });

  const operationLogText = await readOperationLogText(
    packageDirectory,
    opened.packageDocument.manifest.operationLog
  );

  return {
    session: opened.session,
    packageDocument: opened.packageDocument,
    workspaceMetadata: opened.workspaceMetadata,
    operationLogEntries: parseOperationLogEntriesFromJsonl(operationLogText)
  };
};

export interface SaveAuthoringPackageDirectoryInput {
  readonly packageDirectory: string;
  readonly session: AuthoringSession;
  readonly baseDocument: PackageDocumentDto;
  readonly workspaceMetadata: WorkspaceMetadataDto;
  readonly updatedAt: string;
  readonly operationLogText: string;
}

export interface SaveAuthoringPackageDirectoryResult {
  readonly packageDocument: PackageDocumentDto;
  readonly writtenTextPaths: readonly string[];
  readonly writtenBinaryPaths: readonly string[];
}

/**
 * Serializes an AuthoringSession back to the package directory: the workspace text
 * file set (workspace metadata + manifest + model/asset JSON), the operation-log
 * JSONL, and any binary texture bytes whose on-disk copies are missing or stale.
 */
export const saveAuthoringPackageDirectory = async (
  input: SaveAuthoringPackageDirectoryInput
): Promise<SaveAuthoringPackageDirectoryResult> => {
  const existingBinaryFileEntries = await readExistingWorkspaceBinaryFileEntries(
    input.packageDirectory,
    input.session
  );

  const { packageDocument, savePlan } = await createAuthoringWorkspaceSavePlan({
    session: input.session,
    baseDocument: input.baseDocument,
    updatedAt: input.updatedAt,
    workspaceMetadata: input.workspaceMetadata,
    existingWorkspaceBinaryFileEntries: existingBinaryFileEntries
  });

  const textEntries = [
    ...savePlan.workspaceTextFileSet,
    { path: packageDocument.manifest.operationLog, text: input.operationLogText }
  ];

  const writtenTextPaths: string[] = [];
  for (const entry of textEntries) {
    await writePackageFile(input.packageDirectory, entry.path, entry.text);
    writtenTextPaths.push(entry.path);
  }

  const writtenBinaryPaths: string[] = [];
  for (const decision of savePlan.binaryDecisions) {
    if (decision.action === "error") {
      throw new PackageDirectoryIoError(
        `Cannot save binary asset "${decision.candidate.packageRelativePath}": ${decision.message}`
      );
    }

    if (decision.action !== "write") {
      continue;
    }

    await writePackageFile(
      input.packageDirectory,
      decision.binaryEntry.path,
      decision.binaryEntry.bytes
    );
    writtenBinaryPaths.push(decision.binaryEntry.path);
  }

  return {
    packageDocument,
    writtenTextPaths,
    writtenBinaryPaths
  };
};

const readTextFileSet = async (
  packageDirectory: string
): Promise<AuthoringWorkspaceTextFileEntry[]> => {
  const entries: AuthoringWorkspaceTextFileEntry[] = [];
  await collectJsonFiles(packageDirectory, "", entries);

  return entries.sort((left, right) => left.path.localeCompare(right.path));
};

const collectJsonFiles = async (
  rootDirectory: string,
  relativePrefix: string,
  entries: AuthoringWorkspaceTextFileEntry[]
): Promise<void> => {
  const absoluteDirectory = relativePrefix.length === 0
    ? rootDirectory
    : join(rootDirectory, toNativePath(relativePrefix));
  const directoryEntries = await readdir(absoluteDirectory, { withFileTypes: true });

  for (const directoryEntry of directoryEntries) {
    const childRelativePath = relativePrefix.length === 0
      ? directoryEntry.name
      : posix.join(relativePrefix, directoryEntry.name);

    if (directoryEntry.isDirectory()) {
      await collectJsonFiles(rootDirectory, childRelativePath, entries);
      continue;
    }

    if (!directoryEntry.name.endsWith(".json")) {
      continue;
    }

    const text = await readFile(join(rootDirectory, toNativePath(childRelativePath)), "utf8");
    entries.push({ path: childRelativePath, text });
  }
};

const readBinaryEntriesForTargets = async (
  packageDirectory: string,
  targets: readonly AuthoringWorkspaceBinaryRegistrationTarget[]
): Promise<AuthoringWorkspaceBinaryFileEntry[]> => {
  const entries: AuthoringWorkspaceBinaryFileEntry[] = [];

  for (const target of targets) {
    const relativePath = target.binaryAssetRef.packageRelativePath;
    const bytes = await tryReadBinaryFile(packageDirectory, relativePath);

    if (bytes === undefined) {
      if (target.requiredForWorkspaceOpen) {
        throw new PackageDirectoryIoError(
          `Missing required binary asset file "${relativePath}" in package directory.`
        );
      }
      continue;
    }

    entries.push({ path: relativePath, bytes });
  }

  return entries;
};

const readExistingWorkspaceBinaryFileEntries = async (
  packageDirectory: string,
  session: AuthoringSession
): Promise<readonly PackageBinaryFileEntry[]> => {
  const sessionEntries = getAuthoringSessionBinaryFileEntries(session);
  const existingEntries: PackageBinaryFileEntry[] = [];

  for (const sessionEntry of sessionEntries) {
    const bytes = await tryReadBinaryFile(packageDirectory, sessionEntry.path);
    if (bytes === undefined) {
      continue;
    }

    existingEntries.push({
      path: sessionEntry.path,
      bytes,
      mediaType: sessionEntry.mediaType,
      ...(sessionEntry.binaryAssetId === undefined
        ? {}
        : { binaryAssetId: sessionEntry.binaryAssetId })
    });
  }

  return existingEntries;
};

const readOperationLogText = async (
  packageDirectory: string,
  operationLogRelativePath: string
): Promise<string> => {
  const absolutePath = join(packageDirectory, toNativePath(operationLogRelativePath));

  try {
    return await readFile(absolutePath, "utf8");
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error &&
      (error as { readonly code?: string }).code === "ENOENT") {
      return "";
    }
    throw error;
  }
};

const tryReadBinaryFile = async (
  packageDirectory: string,
  relativePath: string
): Promise<Uint8Array | undefined> => {
  const absolutePath = join(packageDirectory, toNativePath(relativePath));

  try {
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) {
      return undefined;
    }
  } catch {
    return undefined;
  }

  const buffer = await readFile(absolutePath);
  return new Uint8Array(buffer);
};

const writePackageFile = async (
  packageDirectory: string,
  relativePath: string,
  data: string | Uint8Array
): Promise<void> => {
  const absolutePath = join(packageDirectory, toNativePath(relativePath));
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, data);
};

const toNativePath = (relativePath: string): string =>
  sep === "/" ? relativePath : relativePath.split("/").join(sep);
