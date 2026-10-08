import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  WorkspaceFsDirectoryEntry,
  WorkspaceFsReadMode,
  WorkspaceFsStatResult,
  WorkspaceFsWritePayload
} from "../../preload/workspace-fs-bridge-contract";
import { resolveWorkspaceMemberPath } from "./workspace-fs-path-boundary";

// node:fs implementations behind the workspace bridge. Every operation runs the
// path boundary check first, so callers cannot reach outside the workspace root.

export async function listWorkspaceDirectory(
  rootPath: string,
  relPath: string
): Promise<readonly WorkspaceFsDirectoryEntry[]> {
  const absolutePath = resolveWorkspaceMemberPath(rootPath, relPath);
  const dirEntries = await readdir(absolutePath, { withFileTypes: true });

  return dirEntries.map((entry) => ({
    name: entry.name,
    kind: entry.isDirectory() ? "directory" : "file"
  }));
}

export async function statWorkspacePath(
  rootPath: string,
  relPath: string
): Promise<WorkspaceFsStatResult> {
  const absolutePath = resolveWorkspaceMemberPath(rootPath, relPath);

  try {
    const stats = await stat(absolutePath);
    return {
      exists: true,
      kind: stats.isDirectory() ? "directory" : "file"
    };
  } catch (error) {
    if (isNodeErrorCode(error, "ENOENT")) {
      return { exists: false, kind: null };
    }
    throw error;
  }
}

export function readWorkspaceFile(
  rootPath: string,
  relPath: string,
  mode: "utf8"
): Promise<string>;
export function readWorkspaceFile(
  rootPath: string,
  relPath: string,
  mode: "binary"
): Promise<Uint8Array>;
export async function readWorkspaceFile(
  rootPath: string,
  relPath: string,
  mode: WorkspaceFsReadMode
): Promise<string | Uint8Array> {
  const absolutePath = resolveWorkspaceMemberPath(rootPath, relPath);

  if (mode === "utf8") {
    return readFile(absolutePath, "utf8");
  }

  const buffer = await readFile(absolutePath);
  return new Uint8Array(buffer);
}

/**
 * Write a workspace file atomically (design judgment 1): the full contents are
 * written to a sibling temp file which is then `rename`d over the destination.
 * A same-directory rename is atomic on the underlying filesystem, so each file
 * is always either its old contents or its new contents — never a truncated or
 * half-written state, and no `.tmp` debris survives a successful write.
 */
export async function writeWorkspaceFile(
  rootPath: string,
  relPath: string,
  payload: WorkspaceFsWritePayload
): Promise<void> {
  const absolutePath = resolveWorkspaceMemberPath(rootPath, relPath);
  const directoryPath = path.dirname(absolutePath);
  await mkdir(directoryPath, { recursive: true });

  const tempPath = path.join(
    directoryPath,
    `.${path.basename(absolutePath)}.${randomUUID()}.tmp`
  );

  try {
    if (payload.kind === "utf8") {
      await writeFile(tempPath, payload.text, "utf8");
    } else {
      await writeFile(tempPath, payload.bytes);
    }
    await rename(tempPath, absolutePath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}
