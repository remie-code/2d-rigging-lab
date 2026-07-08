import path from "node:path";

// Second, main-side enforcement of the workspace root boundary (design
// judgment 3). The renderer already refuses unsafe package paths through
// `assertSafeWorkspacePackagePath`, but the main process must never trust the
// renderer: every fs operation re-derives the absolute path here and rejects any
// value that escapes the picked workspace root.

export class WorkspaceFsPathBoundaryError extends Error {
  readonly rootPath: string;
  readonly relPath: string;

  constructor(input: {
    readonly message: string;
    readonly rootPath: string;
    readonly relPath: string;
  }) {
    super(input.message);
    this.name = "WorkspaceFsPathBoundaryError";
    this.rootPath = input.rootPath;
    this.relPath = input.relPath;
  }
}

/**
 * Resolve `relPath` against the workspace `rootPath`, returning the absolute
 * on-disk path only when it stays inside the root. Absolute member paths,
 * `..` traversal, and cross-drive escapes all throw
 * {@link WorkspaceFsPathBoundaryError}.
 */
export function resolveWorkspaceMemberPath(
  rootPath: string,
  relPath: string
): string {
  if (!path.isAbsolute(rootPath)) {
    throw new WorkspaceFsPathBoundaryError({
      message: `Workspace root path must be absolute: "${rootPath}".`,
      rootPath,
      relPath
    });
  }

  if (path.isAbsolute(relPath)) {
    throw new WorkspaceFsPathBoundaryError({
      message: `Workspace member path must be relative: "${relPath}".`,
      rootPath,
      relPath
    });
  }

  const resolvedRoot = path.resolve(rootPath);
  const resolved = path.resolve(resolvedRoot, relPath);

  if (!isInsideRoot(resolved, resolvedRoot)) {
    throw new WorkspaceFsPathBoundaryError({
      message: `Workspace member path "${relPath}" escapes the workspace root.`,
      rootPath,
      relPath
    });
  }

  return resolved;
}

function isInsideRoot(resolved: string, resolvedRoot: string): boolean {
  if (resolved === resolvedRoot) {
    return true;
  }

  const rootWithSeparator = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : `${resolvedRoot}${path.sep}`;

  return resolved.startsWith(rootWithSeparator);
}
