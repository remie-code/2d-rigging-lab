import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  listWorkspaceDirectory,
  readWorkspaceFile,
  statWorkspacePath,
  writeWorkspaceFile
} from "./workspace-fs-store";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "ws2-fs-store-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("statWorkspacePath", () => {
  it("normalizes a missing path to exists:false / kind:null (ENOENT)", async () => {
    await expect(statWorkspacePath(root, "missing.json")).resolves.toEqual({
      exists: false,
      kind: null
    });
  });

  it("reports files and directories", async () => {
    await writeFile(path.join(root, "workspace.json"), "{}", "utf8");
    await writeWorkspaceFile(root, "package/manifest.json", {
      kind: "utf8",
      text: "{}"
    });

    await expect(statWorkspacePath(root, "workspace.json")).resolves.toEqual({
      exists: true,
      kind: "file"
    });
    await expect(statWorkspacePath(root, "package")).resolves.toEqual({
      exists: true,
      kind: "directory"
    });
    await expect(statWorkspacePath(root, "")).resolves.toEqual({
      exists: true,
      kind: "directory"
    });
  });
});

describe("listWorkspaceDirectory", () => {
  it("lists one directory level with entry kinds", async () => {
    await writeFile(path.join(root, "workspace.json"), "{}", "utf8");
    await writeWorkspaceFile(root, "package/manifest.json", {
      kind: "utf8",
      text: "{}"
    });

    const entries = await listWorkspaceDirectory(root, "");
    const byName = new Map(entries.map((entry) => [entry.name, entry.kind]));

    expect(byName.get("workspace.json")).toBe("file");
    expect(byName.get("package")).toBe("directory");
  });
});

describe("readWorkspaceFile", () => {
  it("reads utf8 and binary content", async () => {
    await writeWorkspaceFile(root, "text.json", { kind: "utf8", text: "hello" });
    await writeWorkspaceFile(root, "blob.bin", {
      kind: "binary",
      bytes: new Uint8Array([1, 2, 3])
    });

    await expect(readWorkspaceFile(root, "text.json", "utf8")).resolves.toBe(
      "hello"
    );
    await expect(
      readWorkspaceFile(root, "blob.bin", "binary")
    ).resolves.toEqual(new Uint8Array([1, 2, 3]));
  });

  it("rejects reading a missing file", async () => {
    await expect(readWorkspaceFile(root, "missing.json", "utf8")).rejects.toThrow();
  });
});

describe("writeWorkspaceFile temp+rename crash safety", () => {
  it("writes new content and leaves no .tmp debris", async () => {
    await writeWorkspaceFile(root, "package/model.json", {
      kind: "utf8",
      text: '{"v":1}'
    });

    const modelPath = path.join(root, "package", "model.json");
    expect(await readFile(modelPath, "utf8")).toBe('{"v":1}');

    const packageEntries = await readdir(path.join(root, "package"));
    expect(packageEntries.some((name) => name.endsWith(".tmp"))).toBe(false);
    expect(packageEntries).toEqual(["model.json"]);
  });

  it("overwrites an existing file without truncating it to empty", async () => {
    await writeWorkspaceFile(root, "workspace.json", {
      kind: "utf8",
      text: "old-content"
    });
    await writeWorkspaceFile(root, "workspace.json", {
      kind: "utf8",
      text: "new-content"
    });

    const workspacePath = path.join(root, "workspace.json");
    const text = await readFile(workspacePath, "utf8");
    expect(text).toBe("new-content");
    expect(text.length).toBeGreaterThan(0);

    const rootEntries = await readdir(root);
    expect(rootEntries.some((name) => name.endsWith(".tmp"))).toBe(false);
  });

  it("keeps the real file intact when an orphaned .tmp from a prior crash exists", async () => {
    // A crashed prior write can leave a partial temp file. Because a rename only
    // ever happens after the full content is written, that orphan can never
    // corrupt the real file.
    await writeWorkspaceFile(root, "workspace.json", {
      kind: "utf8",
      text: "committed"
    });
    const orphanTempPath = path.join(root, ".workspace.json.crashed.tmp");
    await writeFile(orphanTempPath, "partial-garbage", "utf8");

    expect(await readFile(path.join(root, "workspace.json"), "utf8")).toBe(
      "committed"
    );

    // A subsequent real write still commits the new content atomically.
    await writeWorkspaceFile(root, "workspace.json", {
      kind: "utf8",
      text: "recommitted"
    });
    expect(await readFile(path.join(root, "workspace.json"), "utf8")).toBe(
      "recommitted"
    );
  });

  it("creates intermediate directories for a nested write", async () => {
    await writeWorkspaceFile(root, "a/b/c/deep.json", {
      kind: "utf8",
      text: "{}"
    });

    const deepStat = await stat(path.join(root, "a", "b", "c", "deep.json"));
    expect(deepStat.isFile()).toBe(true);
  });

  it("refuses to write outside the workspace root", async () => {
    await expect(
      writeWorkspaceFile(root, "../escape.json", { kind: "utf8", text: "x" })
    ).rejects.toThrow();
  });
});
