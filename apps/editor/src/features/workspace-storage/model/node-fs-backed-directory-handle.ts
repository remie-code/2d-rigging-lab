import type { WorkspaceFsApi } from "../../../preload/workspace-fs-bridge-contract";
import { createNotFoundError } from "./node-fs-workspace-error";
import type {
  WorkspaceDirectoryEntryHandleLike,
  WorkspaceDirectoryHandleLike,
  WorkspaceFileHandleLike,
  WorkspaceFileLike,
  WorkspaceWritableFileLike
} from "./workspace-directory-io";

// node:fs-backed implementation of the `WorkspaceDirectoryHandleLike` port. The
// tree is stateless: each handle only carries the picked workspace `rootPath`
// plus its `relPath` within that root, and every operation is a call through the
// `WorkspaceFsApi` bridge (which reaches the main process over IPC). `fake-workspace-directory.ts`
// is the behavioural reference this mirrors.
//
// `queryPermission` / `requestPermission` are intentionally omitted: in Electron
// the picked path is the granted permission, and omitting both makes the port's
// `ensureWorkspaceDirectoryPermission` a no-op.

export class NodeFsBackedDirectoryHandle implements WorkspaceDirectoryHandleLike {
  readonly kind = "directory" as const;
  readonly name: string;
  private readonly bridge: WorkspaceFsApi;
  private readonly rootPath: string;
  private readonly relPath: string;

  constructor(
    bridge: WorkspaceFsApi,
    rootPath: string,
    relPath: string,
    name: string
  ) {
    this.bridge = bridge;
    this.rootPath = rootPath;
    this.relPath = relPath;
    this.name = name;
  }

  async getFileHandle(
    name: string,
    options: { readonly create?: boolean } = {}
  ): Promise<WorkspaceFileHandleLike> {
    const childRelPath = joinRelativePath(this.relPath, name);

    if (options.create !== true) {
      const stat = await this.bridge.statPath(this.rootPath, childRelPath);
      if (!stat.exists || stat.kind !== "file") {
        throw createNotFoundError(`File "${name}" was not found.`);
      }
    }

    return new NodeFsBackedFileHandle(
      this.bridge,
      this.rootPath,
      childRelPath,
      name
    );
  }

  async getDirectoryHandle(
    name: string,
    options: { readonly create?: boolean } = {}
  ): Promise<WorkspaceDirectoryHandleLike> {
    const childRelPath = joinRelativePath(this.relPath, name);

    if (options.create !== true) {
      const stat = await this.bridge.statPath(this.rootPath, childRelPath);
      if (!stat.exists || stat.kind !== "directory") {
        throw createNotFoundError(`Directory "${name}" was not found.`);
      }
    }

    return new NodeFsBackedDirectoryHandle(
      this.bridge,
      this.rootPath,
      childRelPath,
      name
    );
  }

  async *values(): AsyncIterable<WorkspaceDirectoryEntryHandleLike> {
    const entries = await this.bridge.listDirectory(this.rootPath, this.relPath);

    for (const entry of entries) {
      const childRelPath = joinRelativePath(this.relPath, entry.name);

      if (entry.kind === "directory") {
        yield new NodeFsBackedDirectoryHandle(
          this.bridge,
          this.rootPath,
          childRelPath,
          entry.name
        );
        continue;
      }

      yield new NodeFsBackedFileHandle(
        this.bridge,
        this.rootPath,
        childRelPath,
        entry.name
      );
    }
  }
}

class NodeFsBackedFileHandle implements WorkspaceFileHandleLike {
  readonly kind = "file" as const;
  readonly name: string;
  private readonly bridge: WorkspaceFsApi;
  private readonly rootPath: string;
  private readonly relPath: string;

  constructor(
    bridge: WorkspaceFsApi,
    rootPath: string,
    relPath: string,
    name: string
  ) {
    this.bridge = bridge;
    this.rootPath = rootPath;
    this.relPath = relPath;
    this.name = name;
  }

  async getFile(): Promise<WorkspaceFileLike> {
    const bridge = this.bridge;
    const rootPath = this.rootPath;
    const relPath = this.relPath;

    return {
      text: () => bridge.readFile(rootPath, relPath, "utf8"),
      arrayBuffer: async () => {
        const bytes = await bridge.readFile(rootPath, relPath, "binary");
        return toArrayBuffer(bytes);
      }
    };
  }

  async createWritable(): Promise<WorkspaceWritableFileLike> {
    const bridge = this.bridge;
    const rootPath = this.rootPath;
    const relPath = this.relPath;
    let buffered: WorkspaceWritablePayload = { kind: "utf8", text: "" };

    return {
      write: async (data) => {
        buffered = await toWritePayload(data);
      },
      close: async () => {
        await bridge.writeFile(rootPath, relPath, buffered);
      }
    };
  }
}

type WorkspaceWritablePayload =
  | { readonly kind: "utf8"; readonly text: string }
  | { readonly kind: "binary"; readonly bytes: Uint8Array };

function joinRelativePath(relPath: string, name: string): string {
  return relPath.length === 0 ? name : `${relPath}/${name}`;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

async function toWritePayload(
  data: string | Uint8Array | ArrayBuffer | Blob
): Promise<WorkspaceWritablePayload> {
  if (typeof data === "string") {
    return { kind: "utf8", text: data };
  }

  if (data instanceof Uint8Array) {
    return { kind: "binary", bytes: new Uint8Array(data) };
  }

  if (data instanceof ArrayBuffer) {
    return { kind: "binary", bytes: new Uint8Array(data.slice(0)) };
  }

  return { kind: "binary", bytes: new Uint8Array(await data.arrayBuffer()) };
}
