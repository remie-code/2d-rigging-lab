import { describe, expect, it } from "vitest";

import { NodeFsBackedDirectoryHandle } from "./node-fs-backed-directory-handle";
import { createInMemoryWorkspaceFsBridge } from "./node-fs-bridge-in-memory.test-support";
import type { WorkspaceDirectoryEntryHandleLike } from "./workspace-directory-io";

function createRootHandle(
  bridge = createInMemoryWorkspaceFsBridge()
): { readonly bridge: ReturnType<typeof createInMemoryWorkspaceFsBridge>; readonly root: NodeFsBackedDirectoryHandle } {
  const root = new NodeFsBackedDirectoryHandle(
    bridge,
    bridge.rootPath,
    "",
    bridge.name
  );
  return { bridge, root };
}

async function collectEntries(
  handle: NodeFsBackedDirectoryHandle
): Promise<readonly WorkspaceDirectoryEntryHandleLike[]> {
  const entries: WorkspaceDirectoryEntryHandleLike[] = [];
  for await (const entry of handle.values()) {
    entries.push(entry);
  }
  return entries;
}

describe("NodeFsBackedDirectoryHandle", () => {
  it("exposes the picked directory name and kind", () => {
    const { root } = createRootHandle();
    expect(root.kind).toBe("directory");
    expect(root.name).toBe("workspace.ail2d-workspace");
  });

  it("throws a NotFoundError when getFileHandle(create:false) misses", async () => {
    const { root } = createRootHandle();

    await expect(
      root.getFileHandle("workspace.json", { create: false })
    ).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("throws a NotFoundError when getDirectoryHandle(create:false) misses", async () => {
    const { root } = createRootHandle();

    await expect(
      root.getDirectoryHandle("package", { create: false })
    ).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("reads an existing file via getFileHandle(create:false)", async () => {
    const bridge = createInMemoryWorkspaceFsBridge();
    bridge.seedTextFile("workspace.json", '{"schemaVersion":1}');
    const { root } = createRootHandle(bridge);

    const handle = await root.getFileHandle("workspace.json", { create: false });
    const file = await handle.getFile();

    expect(handle.kind).toBe("file");
    expect(await file.text()).toBe('{"schemaVersion":1}');
  });

  it("writes a root file through createWritable write then close", async () => {
    const { bridge, root } = createRootHandle();

    const handle = await root.getFileHandle("workspace.json", { create: true });
    const writable = await handle.createWritable();
    await writable.write('{"ok":true}');
    await writable.close();

    expect(bridge.readStoredText("workspace.json")).toBe('{"ok":true}');
  });

  it("does not persist until the writable is closed", async () => {
    const { bridge, root } = createRootHandle();

    const handle = await root.getFileHandle("pending.json", { create: true });
    const writable = await handle.createWritable();
    await writable.write("draft");

    expect(bridge.readStoredText("pending.json")).toBeUndefined();

    await writable.close();
    expect(bridge.readStoredText("pending.json")).toBe("draft");
  });

  it("creates nested directories and writes a nested file", async () => {
    const { bridge, root } = createRootHandle();

    const packageDir = await root.getDirectoryHandle("package", { create: true });
    const modelDir = await packageDir.getDirectoryHandle("model", {
      create: true
    });
    const fileHandle = await modelDir.getFileHandle("model.json", {
      create: true
    });
    const writable = await fileHandle.createWritable();
    await writable.write('{"id":"m1"}');
    await writable.close();

    expect(bridge.readStoredText("package/model/model.json")).toBe('{"id":"m1"}');
  });

  it("resolves an existing nested directory with create:false", async () => {
    const bridge = createInMemoryWorkspaceFsBridge();
    bridge.seedTextFile("package/manifest.json", "{}");
    const { root } = createRootHandle(bridge);

    const packageDir = await root.getDirectoryHandle("package", {
      create: false
    });
    const manifest = await packageDir.getFileHandle("manifest.json", {
      create: false
    });

    expect(await (await manifest.getFile()).text()).toBe("{}");
  });

  it("enumerates one directory level via values()", async () => {
    const bridge = createInMemoryWorkspaceFsBridge();
    bridge.seedTextFile("workspace.json", "{}");
    bridge.seedTextFile("package/manifest.json", "{}");
    bridge.seedBinaryFile("textures/atlas.png", new Uint8Array([1, 2, 3]));
    const { root } = createRootHandle(bridge);

    const entries = await collectEntries(root);
    const byName = new Map(entries.map((entry) => [entry.name, entry.kind]));

    expect(byName.get("workspace.json")).toBe("file");
    expect(byName.get("package")).toBe("directory");
    expect(byName.get("textures")).toBe("directory");
  });

  it("round-trips binary bytes through getFile().arrayBuffer()", async () => {
    const bridge = createInMemoryWorkspaceFsBridge();
    const bytes = new Uint8Array([9, 8, 7, 0, 255]);
    bridge.seedBinaryFile("textures/atlas.png", bytes);
    const { root } = createRootHandle(bridge);

    const texturesDir = await root.getDirectoryHandle("textures", {
      create: false
    });
    const handle = await texturesDir.getFileHandle("atlas.png", {
      create: false
    });
    const buffer = await (await handle.getFile()).arrayBuffer();

    expect(new Uint8Array(buffer)).toEqual(bytes);
  });

  it("writes binary payloads through createWritable", async () => {
    const { bridge, root } = createRootHandle();
    const bytes = new Uint8Array([4, 5, 6]);

    const handle = await root.getFileHandle("blob.bin", { create: true });
    const writable = await handle.createWritable();
    await writable.write(bytes);
    await writable.close();

    expect(bridge.readStoredBytes("blob.bin")).toEqual(bytes);
  });

  it("omits permission hooks so the permission check is a no-op", () => {
    const { root } = createRootHandle();
    const handle = root as {
      readonly queryPermission?: unknown;
      readonly requestPermission?: unknown;
    };

    expect(handle.queryPermission).toBeUndefined();
    expect(handle.requestPermission).toBeUndefined();
  });
});
