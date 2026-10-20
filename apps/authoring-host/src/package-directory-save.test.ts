import { rm } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import { loadAuthoringPackageDirectory, saveAuthoringPackageDirectory } from "./package-directory-io.js";
import { snapshotDirectory, writeMaterialOperationFixture } from "./test-support/material-operation-fixtures.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("package save", () => {
  it("refuses before writing any JSON when a referenced texture has no bytes", async () => {
    const f = await writeMaterialOperationFixture();
    roots.push(f.root);
    const loaded = await loadAuthoringPackageDirectory(f.packageDirectory);
    const before = await snapshotDirectory(f.packageDirectory);
    const drawable = loaded.session.graph.drawables.find((item) => item.drawableId === f.ids.targetDrawableId)!;
    const texture = loaded.session.graph.textureAtlas!.textures.find((item) => item.textureId === drawable.textureId)!;
    texture.binaryAssetRef = { ...texture.binaryAssetRef!, binaryAssetId: "bin_unregistered", packageRelativePath: "assets/textures/unregistered.rgba" };
    texture.filePath = "assets/textures/unregistered.rgba";
    drawable.displayName = "Changed before a failing save";

    await expect(saveAuthoringPackageDirectory({ packageDirectory: f.packageDirectory, session: loaded.session, baseDocument: loaded.packageDocument,
      workspaceMetadata: loaded.workspaceMetadata, updatedAt: "2026-10-20T00:00:00.000Z" })).rejects.toThrow("Cannot save binary asset");
    expect(await snapshotDirectory(f.packageDirectory)).toEqual(before);
  }, 60_000);
});
