import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { HostError } from "./host-error.js";
import { packageLockPath, withPackageLock } from "./package-lock.js";
import { runAuthoringHostCommand } from "./run-authoring-host-command.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
const exists = (path: string) => access(path).then(() => true, () => false);

describe("package lock", () => {
  it("holds one lock next to the package and releases it after success or failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "package-lock-"));
    roots.push(root);
    const packageDirectory = join(root, "package");
    expect(await withPackageLock(packageDirectory, async () => exists(packageLockPath(packageDirectory)))).toBe(true);
    expect(await exists(packageLockPath(packageDirectory))).toBe(false);
    await expect(withPackageLock(packageDirectory, async () => { throw new Error("inner"); })).rejects.toThrow("inner");
    expect(await exists(packageLockPath(packageDirectory))).toBe(false);
    await withPackageLock(packageDirectory, async () => {
      await expect(withPackageLock(packageDirectory, async () => "nested")).rejects.toSatisfy((error: unknown) => error instanceof HostError && error.code === "package-busy");
    });
  });

  it("a busy package rejects every host command with authoringHost.packageBusy and leaves the other owner's lock", async () => {
    const root = await mkdtemp(join(tmpdir(), "package-lock-"));
    roots.push(root);
    const packageDirectory = join(root, "package");
    await writeFile(packageLockPath(packageDirectory), "");
    const response = await runAuthoringHostCommand({ packageDirectory, stateDirectory: join(root, "state"),
      command: { schemaVersion: "ai-command-request-v1", commandId: "cmd_busy", command: "getEditorState" } });
    expect(response).toMatchObject({ outcome: "rejected", command: "getEditorState", commandId: "cmd_busy", saved: false });
    expect(response.diagnostics?.map((item) => item.checkId)).toEqual(["authoringHost.packageBusy"]);
    expect(await exists(packageLockPath(packageDirectory))).toBe(true);
  });
});
