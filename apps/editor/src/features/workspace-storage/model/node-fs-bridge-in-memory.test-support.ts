import type {
  WorkspaceFsApi,
  WorkspaceFsDirectoryEntry,
  WorkspaceFsPickedDirectory,
  WorkspaceFsReadMode,
  WorkspaceFsStatResult,
  WorkspaceFsWritePayload
} from "../../../preload/workspace-fs-bridge-contract";

// In-memory virtual filesystem implementing `WorkspaceFsApi`, standing in for
// the main-process node:fs bridge. Kept pure (no node/electron) so the adapter
// contract and round-trip tests run in a plain renderer-like environment.

type StoredFile = {
  readonly bytes: Uint8Array;
};

export interface InMemoryWorkspaceFsBridge extends WorkspaceFsApi {
  readonly rootPath: string;
  readonly name: string;
  seedTextFile: (relPath: string, text: string) => void;
  seedBinaryFile: (relPath: string, bytes: Uint8Array) => void;
  readStoredText: (relPath: string) => string | undefined;
  readStoredBytes: (relPath: string) => Uint8Array | undefined;
  listStoredPaths: () => readonly string[];
}

export interface InMemoryWorkspaceFsBridgeOptions {
  readonly rootPath?: string;
  readonly name?: string;
}

export function createInMemoryWorkspaceFsBridge(
  options: InMemoryWorkspaceFsBridgeOptions = {}
): InMemoryWorkspaceFsBridge {
  const rootPath = options.rootPath ?? "/virtual/workspace";
  const name = options.name ?? "workspace.ail2d-workspace";
  const files = new Map<string, StoredFile>();

  const readFile = ((
    _rootPath: string,
    relPath: string,
    mode: WorkspaceFsReadMode
  ) => {
    const file = files.get(relPath);
    if (file === undefined) {
      return Promise.reject(createEnoentError(relPath));
    }
    if (mode === "utf8") {
      return Promise.resolve(new TextDecoder().decode(file.bytes));
    }
    return Promise.resolve(new Uint8Array(file.bytes));
  }) as WorkspaceFsApi["readFile"];

  return {
    rootPath,
    name,

    seedTextFile: (relPath, text) => {
      files.set(relPath, { bytes: new TextEncoder().encode(text) });
    },
    seedBinaryFile: (relPath, bytes) => {
      files.set(relPath, { bytes: new Uint8Array(bytes) });
    },
    readStoredText: (relPath) => {
      const file = files.get(relPath);
      return file === undefined ? undefined : new TextDecoder().decode(file.bytes);
    },
    readStoredBytes: (relPath) => {
      const file = files.get(relPath);
      return file === undefined ? undefined : new Uint8Array(file.bytes);
    },
    listStoredPaths: () => [...files.keys()].sort(),

    pickWorkspaceDirectory: (): Promise<WorkspaceFsPickedDirectory | null> =>
      Promise.resolve({ rootPath, name }),

    listDirectory: (
      _rootPath: string,
      relPath: string
    ): Promise<readonly WorkspaceFsDirectoryEntry[]> =>
      Promise.resolve(listImmediateChildren(files, relPath)),

    statPath: (
      _rootPath: string,
      relPath: string
    ): Promise<WorkspaceFsStatResult> =>
      Promise.resolve(statVirtualPath(files, relPath)),

    readFile,

    writeFile: (
      _rootPath: string,
      relPath: string,
      payload: WorkspaceFsWritePayload
    ): Promise<void> => {
      const bytes =
        payload.kind === "utf8"
          ? new TextEncoder().encode(payload.text)
          : new Uint8Array(payload.bytes);
      files.set(relPath, { bytes });
      return Promise.resolve();
    }
  };
}

function statVirtualPath(
  files: ReadonlyMap<string, StoredFile>,
  relPath: string
): WorkspaceFsStatResult {
  if (relPath.length === 0) {
    return { exists: true, kind: "directory" };
  }

  if (files.has(relPath)) {
    return { exists: true, kind: "file" };
  }

  const directoryPrefix = `${relPath}/`;
  for (const path of files.keys()) {
    if (path.startsWith(directoryPrefix)) {
      return { exists: true, kind: "directory" };
    }
  }

  return { exists: false, kind: null };
}

function listImmediateChildren(
  files: ReadonlyMap<string, StoredFile>,
  relPath: string
): readonly WorkspaceFsDirectoryEntry[] {
  const prefix = relPath.length === 0 ? "" : `${relPath}/`;
  const fileNames = new Set<string>();
  const directoryNames = new Set<string>();

  for (const path of files.keys()) {
    if (prefix.length > 0 && !path.startsWith(prefix)) {
      continue;
    }

    const remainder = path.slice(prefix.length);
    const slashIndex = remainder.indexOf("/");

    if (slashIndex === -1) {
      fileNames.add(remainder);
    } else {
      directoryNames.add(remainder.slice(0, slashIndex));
    }
  }

  return [
    ...[...directoryNames].map(
      (dirName): WorkspaceFsDirectoryEntry => ({
        name: dirName,
        kind: "directory"
      })
    ),
    ...[...fileNames].map(
      (fileName): WorkspaceFsDirectoryEntry => ({
        name: fileName,
        kind: "file"
      })
    )
  ];
}

function createEnoentError(relPath: string): Error {
  const error = new Error(`ENOENT: no such file "${relPath}".`) as Error & {
    code?: string;
  };
  error.code = "ENOENT";
  return error;
}
