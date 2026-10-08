export type WorkspaceDirectoryPermissionMode = "read" | "readwrite";
export type WorkspaceDirectoryPermissionState = "granted" | "denied" | "prompt";

export interface WorkspaceTextFileEntry {
  readonly path: string;
  readonly text: string;
}

export interface WorkspaceBinaryFileEntry {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly mediaType: string;
  readonly binaryAssetId?: string;
}

export interface WorkspaceDirectoryPermissionDescriptor {
  readonly mode?: WorkspaceDirectoryPermissionMode;
}

export interface WorkspaceFileLike {
  readonly text: () => Promise<string>;
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
  readonly type?: string;
}

export interface WorkspaceWritableFileLike {
  readonly write: (data: string | Uint8Array | ArrayBuffer | Blob) => Promise<void>;
  readonly close: () => Promise<void>;
}

export interface WorkspaceFileHandleLike {
  readonly kind: "file";
  readonly name: string;
  readonly getFile: () => Promise<WorkspaceFileLike>;
  readonly createWritable: () => Promise<WorkspaceWritableFileLike>;
}

export interface WorkspaceDirectoryHandleLike {
  readonly kind: "directory";
  readonly name: string;
  readonly queryPermission?: (
    descriptor?: WorkspaceDirectoryPermissionDescriptor
  ) => Promise<WorkspaceDirectoryPermissionState>;
  readonly requestPermission?: (
    descriptor?: WorkspaceDirectoryPermissionDescriptor
  ) => Promise<WorkspaceDirectoryPermissionState>;
  readonly getFileHandle: (
    name: string,
    options?: { readonly create?: boolean }
  ) => Promise<WorkspaceFileHandleLike>;
  readonly getDirectoryHandle: (
    name: string,
    options?: { readonly create?: boolean }
  ) => Promise<WorkspaceDirectoryHandleLike>;
  readonly values?: () => AsyncIterable<WorkspaceDirectoryEntryHandleLike>;
}

export type WorkspaceDirectoryEntryHandleLike =
  | WorkspaceDirectoryHandleLike
  | WorkspaceFileHandleLike;

export type WorkspaceDirectoryIoErrorCode =
  | "unsupported"
  | "permission-denied"
  | "permission-lost"
  | "path-traversal"
  | "read-failed"
  | "write-failed";

export class WorkspaceDirectoryIoError extends Error {
  readonly code: WorkspaceDirectoryIoErrorCode;
  readonly path?: string;

  constructor(input: {
    readonly code: WorkspaceDirectoryIoErrorCode;
    readonly message: string;
    readonly path?: string;
  }) {
    super(input.message);
    this.name = "WorkspaceDirectoryIoError";
    this.code = input.code;
    if (input.path !== undefined) {
      this.path = input.path;
    }
  }
}

interface DirectoryPickerGlobal {
  readonly showDirectoryPicker?: (
    options?: { readonly mode?: WorkspaceDirectoryPermissionMode }
  ) => Promise<WorkspaceDirectoryHandleLike>;
}

export interface WorkspaceDirectoryAccessCapability {
  readonly supported: boolean;
  readonly reason?: "show-directory-picker-unavailable";
}

export function detectWorkspaceDirectoryAccess(
  globalObject: unknown = globalThis
): WorkspaceDirectoryAccessCapability {
  const candidate = globalObject as DirectoryPickerGlobal;

  if (typeof candidate.showDirectoryPicker !== "function") {
    return {
      supported: false,
      reason: "show-directory-picker-unavailable"
    };
  }

  return { supported: true };
}

export async function pickWorkspaceDirectory(
  options: {
    readonly mode?: WorkspaceDirectoryPermissionMode;
    readonly globalObject?: unknown;
  } = {}
): Promise<WorkspaceDirectoryHandleLike> {
  const globalObject = (options.globalObject ?? globalThis) as DirectoryPickerGlobal;
  const showDirectoryPicker = globalObject.showDirectoryPicker;

  if (typeof showDirectoryPicker !== "function") {
    throw new WorkspaceDirectoryIoError({
      code: "unsupported",
      message: "Workspace directory access is not supported in this browser."
    });
  }

  return showDirectoryPicker({ mode: options.mode ?? "readwrite" });
}

export async function ensureWorkspaceDirectoryPermission(input: {
  readonly directory: WorkspaceDirectoryHandleLike;
  readonly mode: WorkspaceDirectoryPermissionMode;
}): Promise<void> {
  const descriptor = { mode: input.mode };
  const current = await input.directory.queryPermission?.(descriptor);

  if (current === "granted") {
    return;
  }

  if (current === undefined && input.directory.requestPermission === undefined) {
    return;
  }

  const requested = await input.directory.requestPermission?.(descriptor);
  if (requested === "granted") {
    return;
  }

  throw new WorkspaceDirectoryIoError({
    code: "permission-denied",
    message: "Workspace directory permission was denied."
  });
}

export async function readWorkspaceTextFileSet(
  directory: WorkspaceDirectoryHandleLike
): Promise<readonly WorkspaceTextFileEntry[]> {
  if (directory.values === undefined) {
    throw new WorkspaceDirectoryIoError({
      code: "read-failed",
      message: "Workspace directory handles must support recursive file listing."
    });
  }

  const entries: WorkspaceTextFileEntry[] = [];
  await collectWorkspaceTextEntries(directory, "", entries);

  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

export async function readWorkspaceBinaryEntriesForRefs(
  directory: WorkspaceDirectoryHandleLike,
  refs: readonly {
    readonly packageRelativePath: string;
    readonly mediaType: string;
    readonly binaryAssetId?: string;
  }[]
): Promise<readonly WorkspaceBinaryFileEntry[]> {
  const entries: WorkspaceBinaryFileEntry[] = [];

  for (const ref of refs) {
    const entry = await readWorkspaceBinaryEntry(directory, ref);
    if (entry !== undefined) {
      entries.push(entry);
    }
  }

  return entries;
}

export async function writeWorkspaceTextEntries(input: {
  readonly directory: WorkspaceDirectoryHandleLike;
  readonly entries: readonly WorkspaceTextFileEntry[];
}): Promise<void> {
  for (const entry of input.entries) {
    const path = assertSafeWorkspacePackagePath(entry.path);
    const fileHandle = await getWorkspaceFileHandleForWrite(input.directory, path);
    const writable = await fileHandle.createWritable();
    await writable.write(entry.text);
    await writable.close();
  }
}

export async function writeWorkspaceBinaryDecisions(input: {
  readonly directory: WorkspaceDirectoryHandleLike;
  readonly decisions: readonly {
    readonly action: string;
    readonly binaryEntry?: WorkspaceBinaryFileEntry;
  }[];
}): Promise<number> {
  let writeCount = 0;

  for (const decision of input.decisions) {
    if (decision.action !== "write" || decision.binaryEntry === undefined) {
      continue;
    }

    await writeWorkspaceBinaryEntry(input.directory, decision.binaryEntry);
    writeCount += 1;
  }

  return writeCount;
}

export async function writeWorkspaceBinaryEntry(
  directory: WorkspaceDirectoryHandleLike,
  entry: WorkspaceBinaryFileEntry
): Promise<void> {
  const path = assertSafeWorkspacePackagePath(entry.path);
  const fileHandle = await getWorkspaceFileHandleForWrite(directory, path);
  const writable = await fileHandle.createWritable();
  await writable.write(entry.bytes);
  await writable.close();
}

export function assertSafeWorkspacePackagePath(path: string): string {
  const reason = getUnsafeWorkspacePackagePathReason(path);
  if (reason !== undefined) {
    throw new WorkspaceDirectoryIoError({
      code: "path-traversal",
      message: `Unsafe package file path "${path}": ${reason}`,
      path
    });
  }

  return path;
}

async function collectWorkspaceTextEntries(
  directory: WorkspaceDirectoryHandleLike,
  prefix: string,
  entries: WorkspaceTextFileEntry[]
): Promise<void> {
  const values = directory.values;
  if (values === undefined) {
    throw new WorkspaceDirectoryIoError({
      code: "read-failed",
      message: "Workspace directory handles must support recursive file listing.",
      ...(prefix.length === 0 ? {} : { path: prefix })
    });
  }

  for await (const child of values.call(directory)) {
    const childPath = assertSafeWorkspacePackagePath(
      prefix.length === 0 ? child.name : `${prefix}/${child.name}`
    );

    if (child.kind === "directory") {
      await collectWorkspaceTextEntries(child, childPath, entries);
      continue;
    }

    if (!childPath.endsWith(".json")) {
      continue;
    }

    const file = await child.getFile();
    entries.push({
      path: childPath,
      text: await file.text()
    });
  }
}

async function readWorkspaceBinaryEntry(
  directory: WorkspaceDirectoryHandleLike,
  ref: {
    readonly packageRelativePath: string;
    readonly mediaType: string;
    readonly binaryAssetId?: string;
  }
): Promise<WorkspaceBinaryFileEntry | undefined> {
  const path = assertSafeWorkspacePackagePath(ref.packageRelativePath);
  const fileHandle = await getWorkspaceFileHandleForRead(directory, path);

  if (fileHandle === undefined) {
    return undefined;
  }

  const file = await fileHandle.getFile();
  const bytes = new Uint8Array(await file.arrayBuffer());

  return {
    path,
    bytes,
    mediaType: ref.mediaType,
    ...(ref.binaryAssetId === undefined ? {} : { binaryAssetId: ref.binaryAssetId })
  };
}

async function getWorkspaceFileHandleForRead(
  directory: WorkspaceDirectoryHandleLike,
  path: string
): Promise<WorkspaceFileHandleLike | undefined> {
  const segments = path.split("/");
  let current = directory;

  for (const segment of segments.slice(0, -1)) {
    try {
      current = await current.getDirectoryHandle(segment, { create: false });
    } catch (error) {
      if (isMissingHandleError(error)) {
        return undefined;
      }
      throw toWorkspaceDirectoryIoError(error, "read-failed", path);
    }
  }

  const fileName = segments.at(-1);
  if (fileName === undefined) {
    return undefined;
  }

  try {
    return await current.getFileHandle(fileName, { create: false });
  } catch (error) {
    if (isMissingHandleError(error)) {
      return undefined;
    }
    throw toWorkspaceDirectoryIoError(error, "read-failed", path);
  }
}

async function getWorkspaceFileHandleForWrite(
  directory: WorkspaceDirectoryHandleLike,
  path: string
): Promise<WorkspaceFileHandleLike> {
  const segments = path.split("/");
  let current = directory;

  for (const segment of segments.slice(0, -1)) {
    try {
      current = await current.getDirectoryHandle(segment, { create: true });
    } catch (error) {
      throw toWorkspaceDirectoryIoError(error, "write-failed", path);
    }
  }

  const fileName = segments.at(-1);
  if (fileName === undefined) {
    throw new WorkspaceDirectoryIoError({
      code: "path-traversal",
      message: `Unsafe package file path "${path}": missing file name`,
      path
    });
  }

  try {
    return await current.getFileHandle(fileName, { create: true });
  } catch (error) {
    throw toWorkspaceDirectoryIoError(error, "write-failed", path);
  }
}

function toWorkspaceDirectoryIoError(
  error: unknown,
  fallbackCode: WorkspaceDirectoryIoErrorCode,
  path?: string
): WorkspaceDirectoryIoError {
  if (error instanceof WorkspaceDirectoryIoError) {
    return error;
  }

  if (isPermissionError(error)) {
    return new WorkspaceDirectoryIoError({
      code: "permission-lost",
      message: "Workspace directory permission was lost.",
      ...(path === undefined ? {} : { path })
    });
  }

  const message = error instanceof Error ? error.message : String(error);
  return new WorkspaceDirectoryIoError({
    code: fallbackCode,
    message,
    ...(path === undefined ? {} : { path })
  });
}

function isMissingHandleError(error: unknown): boolean {
  return error instanceof Error &&
    (error.name === "NotFoundError" || error.message.includes("not found"));
}

function isPermissionError(error: unknown): boolean {
  return error instanceof Error &&
    (error.name === "NotAllowedError" || error.name === "SecurityError");
}

function getUnsafeWorkspacePackagePathReason(path: string): string | undefined {
  if (path.length === 0) {
    return "path must not be empty";
  }

  if (path.includes("\\")) {
    return "backslash separators are not allowed";
  }

  if (path.startsWith("/") || path.startsWith("//") || /^[A-Za-z]:/.test(path)) {
    return "absolute paths are not allowed";
  }

  const segments = path.split("/");

  if (segments.some((segment) => segment.length === 0)) {
    return "empty path segments are not allowed";
  }

  if (segments.some((segment) => segment === "." || segment === "..")) {
    return "path traversal segments are not allowed";
  }

  return undefined;
}
