import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { RenderViewResultSchema } from "@private-2d-rigging-lab/ai-interface";
import { createMaterialImageIdSeed, parseOperationLogEntriesFromJsonl } from "@private-2d-rigging-lab/operation-core";

import { loadAuthoringPackageDirectory } from "./package-directory-io.js";
import { materialPixel, readMaterialTestPng } from "./material-test-fixtures.js";
import {
  aiCommand,
  dryRunThenCommit,
  imageFileRef,
  listDirectoryTree,
  operationRequest,
  runMaterialCli,
  snapshotDirectory,
  writeMaterialOperationFixture,
  writeMaterialTestPng,
  type MaterialOperationFixture,
  type MaterialTestImage
} from "./test-support/material-operation-fixtures.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const fixture = async (): Promise<MaterialOperationFixture> => {
  const created = await writeMaterialOperationFixture();
  roots.push(created.root);
  return created;
};

const ADDED_ID = "draw_material_added";
const GREEN = [20, 200, 60] as const;
const PURPLE = [150, 40, 210] as const;

/** 4x4 image at scale 2, to the right of the target: an 8x8 stage square nothing else covers. */
const addPlacement = (f: MaterialOperationFixture) => ({ from: "source-image-pixel-edge-v1", to: "rest-stage-canvas-y-down-v1", scale: 2,
  translation: { x: f.targetBounds.x + f.targetBounds.width + 4, y: f.targetBounds.y } });
const addRect = (f: MaterialOperationFixture) => ({ ...addPlacement(f).translation, width: 8, height: 8 });
const addPayload = (f: MaterialOperationFixture, image: MaterialTestImage, imageOverrides: Record<string, unknown> = {}) => ({
  image: { ...imageFileRef(image), ...imageOverrides }, placement: addPlacement(f), provenanceNote: "Synthetic test image.",
  intent: { kind: "add", drawableId: ADDED_ID, displayName: "Added", parentPartId: f.ids.partId, insertion: { position: "last" },
    rigControlIds: [], maskBindings: [], runtimeVisibility: true, defaultOpacity: 1 }
});
/** Image sized to the target's aspect (68x28 stage = 17x7 pixels at scale 4), placed exactly over it. */
const replaceSize = { width: 17, height: 7 };
const replacePayload = (f: MaterialOperationFixture, image: MaterialTestImage, keyformSetIds = [f.ids.targetGeometryKeyformSetId]) => ({
  image: imageFileRef(image), provenanceNote: "Synthetic replacement.",
  placement: { from: "source-image-pixel-edge-v1", to: "rest-stage-canvas-y-down-v1", scale: f.targetBounds.width / replaceSize.width,
    translation: { x: f.targetBounds.x, y: f.targetBounds.y } },
  intent: { kind: "replace", drawableId: f.ids.targetDrawableId, preserveLogicalDrawableId: true,
    geometryReset: { scope: "target-direct-geometry-keyforms", keyformSetIds }, preserveExistingDeformers: true,
    sharedControlPolicy: "reject-shared-control-key-parameter-deletion" }
});

/** Renders `rect` at one pixel per stage unit (rounded) and returns one pixel, the center by default. */
const renderPixel = async (f: MaterialOperationFixture, rect: { x: number; y: number; width: number; height: number }, name: string, at?: { x: number; y: number }) => {
  const outputWidth = Math.round(rect.width), outputHeight = Math.round(rect.height);
  const { response } = await runMaterialCli(f, aiCommand(`cmd_render_${name}`, "renderView", { outDir: join(f.root, "renders"), outputName: name,
    view: { kind: "stageViewport", stageViewport: { minX: rect.x, minY: rect.y, width: rect.width, height: rect.height } }, outputWidth, outputHeight }));
  expect(response.outcome, JSON.stringify(response)).toBe("success");
  const png = await readMaterialTestPng(RenderViewResultSchema.parse(response.aiCommandResponse?.payload).pngPath);
  return materialPixel(png, at?.x ?? Math.floor(outputWidth / 2), at?.y ?? Math.floor(outputHeight / 2));
};
const expectColor = (pixel: number[], color: readonly number[]) => {
  expect(pixel[3]).toBe(255);
  for (let channel = 0; channel < 3; channel++) expect(Math.abs(pixel[channel]! - color[channel]!), `channel ${channel} of ${pixel}`).toBeLessThanOrEqual(1);
};

/** Nothing outside the package: no stage/backup/lock siblings and no candidate, snapshot or base stores in the state dir. */
const expectNoCopiesOutsidePackage = async (f: MaterialOperationFixture) => {
  const siblings = (await readdir(dirname(f.packageDirectory))).filter((name) => name.startsWith(basename(f.packageDirectory)));
  expect(siblings).toEqual([basename(f.packageDirectory)]);
  expect(await listDirectoryTree(f.stateDirectory)).toEqual(["approval-state.json", "command-transcript.json"]);
};

describe("addDrawableFromImage through the CLI", () => {
  it("dry-run leaves the package intact; commit saves the drawable and its texture; the reloaded package renders it", async () => {
    const f = await fixture();
    const image = await writeMaterialTestPng(f.imageDirectory, "added", GREEN);
    const before = await snapshotDirectory(f.packageDirectory);
    expect((await renderPixel(f, addRect(f), "before"))[3]).toBe(0);

    const operation = { operationType: "addDrawableFromImage", operationId: "op_material_add", basePackageRevision: f.packageRevision, payload: addPayload(f, image) };
    const dryRun = await runMaterialCli(f, aiCommand("cmd_add_dry", "dryRunOperation", operationRequest({ ...operation, dryRun: true })));
    expect(dryRun.exitCode, JSON.stringify(dryRun.response)).toBe(0);
    expect(dryRun.response.saved).toBe(false);
    expect(dryRun.response.autoApproval?.autoApproved).toBe(true);
    expect(await snapshotDirectory(f.packageDirectory)).toEqual(before);

    const commit = await runMaterialCli(f, aiCommand("cmd_add_commit", "commitOperation",
      { approvedDryRunCommandId: "cmd_add_dry", operation: operationRequest({ ...operation, dryRun: false }) }));
    expect(commit.exitCode, JSON.stringify(commit.response)).toBe(0);
    expect(commit.response.saved).toBe(true);
    expect(commit.response.packageRevision).toBe(f.packageRevision + 1);

    const reopened = await loadAuthoringPackageDirectory(f.packageDirectory);
    const drawable = reopened.session.graph.drawables.find((item) => item.drawableId === ADDED_ID)!;
    expect(drawable).toBeDefined();
    const seed = createMaterialImageIdSeed("op_material_add" as never);
    expect(drawable.textureId).toBe(`tex_${seed}`);
    expect(new Uint8Array(await readFile(join(f.packageDirectory, "assets", "textures", `${seed}.rgba`)))).toEqual(image.rgbaBytes);
    expectColor(await renderPixel(f, addRect(f), "after"), GREEN);

    const logText = await readFile(join(f.packageDirectory, reopened.packageDocument.manifest.operationLog), "utf8");
    const entry = parseOperationLogEntriesFromJsonl(logText).find((item) => item.operationId === "op_material_add")!;
    expect(JSON.stringify(entry)).toContain(image.imagePath.replaceAll("\\", "\\\\"));
    expect(JSON.stringify(entry)).toContain(image.rgbaSha256);
    expect(logText).not.toContain("rgbaBytes");
    expect(logText.length).toBeLessThan(200_000);
    await expectNoCopiesOutsidePackage(f);
  }, 120_000);

  it("derives the operationId when omitted, and rejects reusing an operationId as an ID collision", async () => {
    const f = await fixture();
    const image = await writeMaterialTestPng(f.imageDirectory, "added", GREEN);
    const dryRun = await runMaterialCli(f, aiCommand("cmd_first_dry", "dryRunOperation", operationRequest({ operationType: "addDrawableFromImage",
      basePackageRevision: f.packageRevision, dryRun: true, payload: addPayload(f, image) })));
    const operationId = dryRun.response.aiCommandResponse?.operationResult?.operationId ?? "op_missing";
    expect(operationId).toBe(`op_add_drawable_from_image_material_added_r${f.packageRevision}_${image.rgbaSha256.slice(0, 16)}`);
    // An approved dry-run binds its operationId; the commit names it explicitly.
    const commit = await runMaterialCli(f, aiCommand("cmd_first_commit", "commitOperation", { approvedDryRunCommandId: "cmd_first_dry",
      operation: operationRequest({ operationType: "addDrawableFromImage", operationId, basePackageRevision: f.packageRevision, dryRun: false, payload: addPayload(f, image) }) }));
    expect(commit.exitCode, JSON.stringify(commit.response)).toBe(0);

    const saved = await snapshotDirectory(f.packageDirectory);
    const again = await runMaterialCli(f, aiCommand("cmd_again", "dryRunOperation", operationRequest({ operationType: "addDrawableFromImage", operationId,
      basePackageRevision: f.packageRevision + 1, dryRun: true, payload: { ...addPayload(f, image), intent: { ...addPayload(f, image).intent, drawableId: "draw_material_again" } } })));
    expect(again.exitCode).toBe(2);
    expect(again.response.diagnostics?.map((item) => item.checkId)).toEqual(["operation.addDrawableFromImage.idCollision"]);
    expect(await snapshotDirectory(f.packageDirectory)).toEqual(saved);
  }, 120_000);
});

describe("replaceDrawableImage through the CLI", () => {
  it("keeps the drawable ID, rebuilds the mesh, drops only the declared key, and renders the new image", async () => {
    const f = await fixture();
    const image = await writeMaterialTestPng(f.imageDirectory, "replacement", PURPLE, replaceSize);
    const original = await loadAuthoringPackageDirectory(f.packageDirectory);
    const oldMesh = original.session.graph.meshes.find((mesh) => mesh.meshId === f.ids.targetMeshId)!;
    const before = await snapshotDirectory(f.packageDirectory);
    const beforePixel = await renderPixel(f, f.targetBounds, "original", { x: 1, y: 14 });

    const { dryRun, commit } = await dryRunThenCommit(f, { name: "replace", operationType: "replaceDrawableImage", operationId: "op_material_replace",
      basePackageRevision: f.packageRevision, payload: replacePayload(f, image) });
    expect(dryRun.exitCode, JSON.stringify(dryRun.response)).toBe(0);
    expect(commit.exitCode, JSON.stringify(commit.response)).toBe(0);
    expect(commit.response.saved).toBe(true);

    const reopened = await loadAuthoringPackageDirectory(f.packageDirectory);
    const graph = reopened.session.graph;
    const target = graph.drawables.find((item) => item.drawableId === f.ids.targetDrawableId)!;
    expect(target.meshId).toBe(f.ids.targetMeshId);
    expect(target.textureId).toBe(`tex_${createMaterialImageIdSeed("op_material_replace" as never)}`);
    expect(graph.drawables).toHaveLength(original.session.graph.drawables.length);
    const mesh = graph.meshes.find((item) => item.meshId === f.ids.targetMeshId)!;
    expect(mesh.topologyRevision).toBe((oldMesh.topologyRevision ?? 0) + 1);
    const keys = graph.keyformSets.map((key) => key.keyformSetId);
    expect(keys).not.toContain(f.ids.targetGeometryKeyformSetId);
    expect(keys).toEqual(expect.arrayContaining([f.ids.targetOpacityKeyformSetId, f.ids.otherGeometryKeyformSetId]));
    expect(keys).toHaveLength(original.session.graph.keyformSets.length - 1);
    const after = await snapshotDirectory(f.packageDirectory);
    expect(Object.keys(after).filter((path) => !(path in before))).toEqual([`assets/textures/${createMaterialImageIdSeed("op_material_replace" as never)}.rgba`]);
    // The eye is drawn over the middle of the target; its left 6 stage units show only the target.
    const t = f.targetBounds, rect = { x: t.x, y: t.y, width: t.width, height: t.height };
    const afterPixel = await renderPixel(f, rect, "replaced", { x: 1, y: 14 });
    expect(afterPixel).not.toEqual(beforePixel);
    expectColor(afterPixel, PURPLE);
    await expectNoCopiesOutsidePackage(f);
  }, 120_000);

  it("rejects a reset list that omits the drawable's direct geometry key without touching the package", async () => {
    const f = await fixture();
    const image = await writeMaterialTestPng(f.imageDirectory, "replacement", PURPLE, replaceSize);
    const before = await snapshotDirectory(f.packageDirectory);
    const dryRun = await runMaterialCli(f, aiCommand("cmd_reset", "dryRunOperation", operationRequest({ operationType: "replaceDrawableImage",
      basePackageRevision: f.packageRevision, dryRun: true, payload: replacePayload(f, image, []) })));
    expect(dryRun.exitCode).toBe(2);
    expect(dryRun.response.diagnostics?.map((item) => item.checkId)).toEqual(["operation.replaceDrawableImage.geometryResetMismatch"]);
    expect(await snapshotDirectory(f.packageDirectory)).toEqual(before);
  }, 60_000);
});

describe("image intake rejections", () => {
  const cases: readonly { name: string; checkId: string; payload: (f: MaterialOperationFixture, image: MaterialTestImage) => Promise<unknown> }[] = [
    { name: "declared size differs", checkId: "imageDimensionsMismatch", payload: async (f, image) => addPayload(f, image, { width: 5 }) },
    { name: "nonzero content inset", checkId: "contentInsetUnsupported", payload: async (f, image) => addPayload(f, image, { contentInset: { left: 1, top: 0, right: 0, bottom: 0 } }) },
    { name: "hash differs", checkId: "imageDigestMismatch", payload: async (f, image) => addPayload(f, image, { rgbaSha256: "0".repeat(64) }) },
    { name: "file is not a PNG", checkId: "invalidPng", payload: async (f, image) => {
      const path = join(f.imageDirectory, "not-a-png.png");
      await writeFile(path, "not a png");
      return addPayload(f, image, { imagePath: path });
    } },
    { name: "PNG is corrupted", checkId: "invalidPng", payload: async (f, image) => {
      const bytes = new Uint8Array(await readFile(image.imagePath));
      bytes[bytes.length - 20] = bytes[bytes.length - 20]! ^ 0xff;
      const path = join(f.imageDirectory, "corrupt.png");
      await writeFile(path, bytes);
      return addPayload(f, image, { imagePath: path });
    } },
    { name: "path does not exist", checkId: "imageUnreadable", payload: async (f, image) => addPayload(f, image, { imagePath: join(f.imageDirectory, "missing.png") }) }
  ];

  it.each(cases)("$name: dry-run is rejected and no package byte changes", async ({ checkId, payload }) => {
    const f = await fixture();
    const image = await writeMaterialTestPng(f.imageDirectory, "added", GREEN);
    const before = await snapshotDirectory(f.packageDirectory);
    const response = await runMaterialCli(f, aiCommand("cmd_reject", "dryRunOperation", operationRequest({ operationType: "addDrawableFromImage",
      operationId: "op_material_reject", basePackageRevision: f.packageRevision, dryRun: true, payload: await payload(f, image) })));
    expect(response.exitCode).toBe(2);
    expect(response.response.saved).toBe(false);
    expect(response.response.diagnostics?.map((item) => item.checkId)).toEqual([`operation.addDrawableFromImage.${checkId}`]);
    expect(response.response.aiCommandResponse?.operationResult?.operationId).toBe("op_material_reject");
    expect(await snapshotDirectory(f.packageDirectory)).toEqual(before);
    await expectNoCopiesOutsidePackage(f);
  }, 60_000);

  it("a file the package JSON does not reference at the texture path is never overwritten; identical bytes are accepted", async () => {
    const f = await fixture();
    const image = await writeMaterialTestPng(f.imageDirectory, "added", GREEN);
    const texture = join(f.packageDirectory, "assets", "textures", `${createMaterialImageIdSeed("op_material_stray" as never)}.rgba`);
    const dryRun = (commandId: string) => runMaterialCli(f, aiCommand(commandId, "dryRunOperation", operationRequest({ operationType: "addDrawableFromImage",
      operationId: "op_material_stray", basePackageRevision: f.packageRevision, dryRun: true, payload: addPayload(f, image) })));
    const stray = new Uint8Array(image.rgbaBytes);
    stray[0] = stray[0]! ^ 0xff;
    await writeFile(texture, stray);
    const before = await snapshotDirectory(f.packageDirectory);
    const rejected = await dryRun("cmd_stray_different");
    expect(rejected.exitCode).toBe(2);
    expect(rejected.response.diagnostics?.map((item) => item.checkId)).toEqual(["operation.addDrawableFromImage.idCollision"]);
    expect(await snapshotDirectory(f.packageDirectory)).toEqual(before);

    await writeFile(texture, image.rgbaBytes);
    const accepted = await dryRun("cmd_stray_same");
    expect(accepted.exitCode, JSON.stringify(accepted.response)).toBe(0);
  }, 60_000);

  it("commit reads the image again: a PNG changed after an approved dry-run is rejected and nothing is written", async () => {
    const f = await fixture();
    const image = await writeMaterialTestPng(f.imageDirectory, "added", GREEN);
    const operation = { operationType: "addDrawableFromImage", operationId: "op_material_changed", basePackageRevision: f.packageRevision, payload: addPayload(f, image) };
    const dryRun = await runMaterialCli(f, aiCommand("cmd_changed_dry", "dryRunOperation", operationRequest({ ...operation, dryRun: true })));
    expect(dryRun.response.autoApproval?.autoApproved).toBe(true);
    const before = await snapshotDirectory(f.packageDirectory);
    await writeMaterialTestPng(f.imageDirectory, "added", PURPLE);
    const commit = await runMaterialCli(f, aiCommand("cmd_changed_commit", "commitOperation",
      { approvedDryRunCommandId: "cmd_changed_dry", operation: operationRequest({ ...operation, dryRun: false }) }));
    expect(commit.exitCode).toBe(2);
    expect(commit.response.saved).toBe(false);
    expect(commit.response.diagnostics?.map((item) => item.checkId)).toEqual(["operation.addDrawableFromImage.imageDigestMismatch"]);
    expect(await snapshotDirectory(f.packageDirectory)).toEqual(before);
  }, 60_000);
});
