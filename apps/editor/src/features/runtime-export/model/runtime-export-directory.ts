import type { RuntimeExportAssemblyResult } from "@private-2d-rigging-lab/authoring-core";

import {
  ensureWorkspaceDirectoryPermission,
  pickWorkspaceDirectory,
  writeWorkspaceBinaryEntry,
  writeWorkspaceTextEntries,
  type WorkspaceDirectoryHandleLike
} from "../../workspace-storage/model/workspace-directory-io";

export interface RuntimeExportDirectoryPicker {
  readonly pickDirectory: () => Promise<WorkspaceDirectoryHandleLike>;
}

type RuntimeExportFileSet = Extract<
  RuntimeExportAssemblyResult,
  { readonly status: "ready" }
>["fileSet"];

export interface RuntimeExportDirectoryWriteResult {
  readonly textFileCount: number;
  readonly texturePageCount: number;
  readonly totalFileCount: number;
}

export async function writeRuntimeExportToPickedDirectory(input: {
  readonly fileSet: RuntimeExportFileSet;
  readonly picker?: RuntimeExportDirectoryPicker;
  readonly globalObject?: unknown;
}): Promise<RuntimeExportDirectoryWriteResult> {
  const directory = input.picker === undefined
    ? await pickWorkspaceDirectory({
        mode: "readwrite",
        ...(input.globalObject === undefined ? {} : { globalObject: input.globalObject })
      })
    : await input.picker.pickDirectory();

  return writeRuntimeExportDirectory({
    directory,
    fileSet: input.fileSet
  });
}

export async function writeRuntimeExportDirectory(input: {
  readonly directory: WorkspaceDirectoryHandleLike;
  readonly fileSet: RuntimeExportFileSet;
}): Promise<RuntimeExportDirectoryWriteResult> {
  await ensureWorkspaceDirectoryPermission({
    directory: input.directory,
    mode: "readwrite"
  });

  const textEntries = input.fileSet
    .filter(isRuntimeExportTextFileEntry)
    .map((entry) => ({
      path: entry.path,
      text: entry.text
    }));
  const textureEntries = input.fileSet
    .filter(isRuntimeExportBinaryTextureFileEntry)
    .map((entry) => ({
      path: entry.path,
      bytes: entry.bytes,
      mediaType: entry.mediaType
    }));

  await writeWorkspaceTextEntries({
    directory: input.directory,
    entries: textEntries
  });

  for (const entry of textureEntries) {
    await writeWorkspaceBinaryEntry(input.directory, entry);
  }

  return {
    textFileCount: textEntries.length,
    texturePageCount: textureEntries.length,
    totalFileCount: textEntries.length + textureEntries.length
  };
}

function isRuntimeExportTextFileEntry(
  entry: RuntimeExportFileSet[number]
): entry is Extract<RuntimeExportFileSet[number], { readonly text: string }> {
  return "text" in entry;
}

function isRuntimeExportBinaryTextureFileEntry(
  entry: RuntimeExportFileSet[number]
): entry is Extract<RuntimeExportFileSet[number], { readonly bytes: Uint8Array }> {
  return "bytes" in entry;
}
