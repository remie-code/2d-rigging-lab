import type {
  WorkspaceDirectoryEntryHandleLike,
  WorkspaceDirectoryHandleLike,
  WorkspaceDirectoryPermissionDescriptor,
  WorkspaceDirectoryPermissionState,
  WorkspaceFileHandleLike,
  WorkspaceFileLike,
  WorkspaceWritableFileLike
} from "./workspace-directory-io";

type FakeFileContent = {
  readonly bytes: Uint8Array;
  readonly type?: string;
};

export interface FakeWorkspaceDirectoryOptions {
  readonly name?: string;
  readonly permissionState?: WorkspaceDirectoryPermissionState;
  readonly files?: Readonly<Record<string, string | Uint8Array>>;
}

export interface FakeWorkspaceDirectoryHandle extends WorkspaceDirectoryHandleLike {
  readonly setPermissionState: (state: WorkspaceDirectoryPermissionState) => void;
  readonly setTextFile: (path: string, text: string) => void;
  readonly setBinaryFile: (path: string, bytes: Uint8Array, type?: string) => void;
  readonly deleteFile: (path: string) => boolean;
  readonly readTextFile: (path: string) => string | undefined;
  readonly readBinaryFile: (path: string) => Uint8Array | undefined;
  readonly getWriteCount: (path: string) => number;
  readonly listFilePaths: () => readonly string[];
}

export function createFakeWorkspaceDirectoryHandle(
  options: FakeWorkspaceDirectoryOptions = {}
): FakeWorkspaceDirectoryHandle {
  const root = new FakeWorkspaceDirectoryNode(options.name ?? "test.ail2d-workspace");
  root.permissionState = options.permissionState ?? "granted";

  for (const [path, content] of Object.entries(options.files ?? {})) {
    if (typeof content === "string") {
      root.setTextFile(path, content);
    } else {
      root.setBinaryFile(path, content);
    }
  }

  return root;
}

class FakeWorkspaceDirectoryNode implements FakeWorkspaceDirectoryHandle {
  readonly kind = "directory" as const;
  readonly name: string;
  permissionState: WorkspaceDirectoryPermissionState = "granted";
  private readonly directories = new Map<string, FakeWorkspaceDirectoryNode>();
  private readonly files = new Map<string, FakeWorkspaceFileNode>();

  constructor(name: string) {
    this.name = name;
  }

  async queryPermission(
    _descriptor?: WorkspaceDirectoryPermissionDescriptor
  ): Promise<WorkspaceDirectoryPermissionState> {
    return this.permissionState;
  }

  async requestPermission(
    _descriptor?: WorkspaceDirectoryPermissionDescriptor
  ): Promise<WorkspaceDirectoryPermissionState> {
    return this.permissionState;
  }

  async getFileHandle(
    name: string,
    options: { readonly create?: boolean } = {}
  ): Promise<WorkspaceFileHandleLike> {
    this.assertPermission();
    const current = this.files.get(name);

    if (current !== undefined) {
      return current;
    }

    if (options.create !== true) {
      throw createDomLikeError("NotFoundError", `File "${name}" was not found.`);
    }

    const created = new FakeWorkspaceFileNode(name);
    this.files.set(name, created);
    return created;
  }

  async getDirectoryHandle(
    name: string,
    options: { readonly create?: boolean } = {}
  ): Promise<WorkspaceDirectoryHandleLike> {
    this.assertPermission();
    const current = this.directories.get(name);

    if (current !== undefined) {
      return current;
    }

    if (options.create !== true) {
      throw createDomLikeError("NotFoundError", `Directory "${name}" was not found.`);
    }

    const created = new FakeWorkspaceDirectoryNode(name);
    created.permissionState = this.permissionState;
    this.directories.set(name, created);
    return created;
  }

  async *values(): AsyncIterable<WorkspaceDirectoryEntryHandleLike> {
    this.assertPermission();
    for (const directory of this.directories.values()) {
      yield directory;
    }
    for (const file of this.files.values()) {
      yield file;
    }
  }

  setPermissionState(state: WorkspaceDirectoryPermissionState): void {
    this.permissionState = state;
    for (const directory of this.directories.values()) {
      directory.setPermissionState(state);
    }
  }

  setTextFile(path: string, text: string): void {
    this.writePath(path, {
      bytes: new TextEncoder().encode(text),
      type: "application/json"
    });
  }

  setBinaryFile(path: string, bytes: Uint8Array, type?: string): void {
    this.writePath(path, {
      bytes: new Uint8Array(bytes),
      ...(type === undefined ? {} : { type })
    });
  }

  deleteFile(path: string): boolean {
    const segments = path.split("/");
    const fileName = segments.at(-1);
    if (fileName === undefined) {
      return false;
    }

    let directory: FakeWorkspaceDirectoryNode = this;
    for (const segment of segments.slice(0, -1)) {
      const next = directory.directories.get(segment);
      if (next === undefined) {
        return false;
      }
      directory = next;
    }

    return directory.files.delete(fileName);
  }

  readTextFile(path: string): string | undefined {
    const file = this.findFile(path);
    if (file === undefined) {
      return undefined;
    }

    return new TextDecoder().decode(file.content.bytes);
  }

  readBinaryFile(path: string): Uint8Array | undefined {
    const file = this.findFile(path);
    if (file === undefined) {
      return undefined;
    }

    return new Uint8Array(file.content.bytes);
  }

  getWriteCount(path: string): number {
    return this.findFile(path)?.writeCount ?? 0;
  }

  listFilePaths(): readonly string[] {
    const paths: string[] = [];
    this.collectFilePaths("", paths);
    return paths.sort();
  }

  private writePath(path: string, content: FakeFileContent): void {
    const segments = path.split("/");
    const fileName = segments.at(-1);
    if (fileName === undefined) {
      throw new Error(`Invalid fake workspace path "${path}".`);
    }

    let directory: FakeWorkspaceDirectoryNode = this;
    for (const segment of segments.slice(0, -1)) {
      const current = directory.directories.get(segment);
      if (current !== undefined) {
        directory = current;
        continue;
      }

      const created = new FakeWorkspaceDirectoryNode(segment);
      created.permissionState = this.permissionState;
      directory.directories.set(segment, created);
      directory = created;
    }

    const file = directory.files.get(fileName) ?? new FakeWorkspaceFileNode(fileName);
    file.content = content;
    directory.files.set(fileName, file);
  }

  private findFile(path: string): FakeWorkspaceFileNode | undefined {
    const segments = path.split("/");
    const fileName = segments.at(-1);
    if (fileName === undefined) {
      return undefined;
    }

    let directory: FakeWorkspaceDirectoryNode = this;
    for (const segment of segments.slice(0, -1)) {
      const next = directory.directories.get(segment);
      if (next === undefined) {
        return undefined;
      }
      directory = next;
    }

    return directory.files.get(fileName);
  }

  private collectFilePaths(prefix: string, paths: string[]): void {
    for (const [name, directory] of this.directories) {
      directory.collectFilePaths(prefix.length === 0 ? name : `${prefix}/${name}`, paths);
    }
    for (const name of this.files.keys()) {
      paths.push(prefix.length === 0 ? name : `${prefix}/${name}`);
    }
  }

  private assertPermission(): void {
    if (this.permissionState === "granted") {
      return;
    }

    throw createDomLikeError("NotAllowedError", "Fake workspace permission denied.");
  }
}

class FakeWorkspaceFileNode implements WorkspaceFileHandleLike {
  readonly kind = "file" as const;
  readonly name: string;
  content: FakeFileContent = { bytes: new Uint8Array() };
  writeCount = 0;

  constructor(name: string) {
    this.name = name;
  }

  async getFile(): Promise<WorkspaceFileLike> {
    const content = this.content;
    return {
      ...(content.type === undefined ? {} : { type: content.type }),
      text: async () => new TextDecoder().decode(content.bytes),
      arrayBuffer: async () => content.bytes.buffer.slice(
        content.bytes.byteOffset,
        content.bytes.byteOffset + content.bytes.byteLength
      )
    };
  }

  async createWritable(): Promise<WorkspaceWritableFileLike> {
    return {
      write: async (data) => {
        this.content = {
          bytes: await toUint8Array(data),
          ...(this.content.type === undefined ? {} : { type: this.content.type })
        };
        this.writeCount += 1;
      },
      close: async () => undefined
    };
  }
}

async function toUint8Array(data: string | Uint8Array | ArrayBuffer | Blob): Promise<Uint8Array> {
  if (typeof data === "string") {
    return new TextEncoder().encode(data);
  }

  if (data instanceof Uint8Array) {
    return new Uint8Array(data);
  }

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data.slice(0));
  }

  return new Uint8Array(await data.arrayBuffer());
}

function createDomLikeError(name: string, message: string): Error {
  const error = new Error(message);
  Object.defineProperty(error, "name", {
    value: name
  });
  return error;
}
