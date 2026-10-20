import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ExtractMaterialSourceResultSchema, PreviewMaterialPlacementResultSchema } from "@private-2d-rigging-lab/ai-interface";
import { MaterialCoordinateSidecarSchema } from "@private-2d-rigging-lab/contracts";

import { materialPixel, readMaterialTestPng } from "./material-test-fixtures.js";
import {
  aiCommand,
  imageFileRef,
  runMaterialCli,
  snapshotDirectory,
  writeMaterialOperationFixture,
  writeMaterialTestPng,
  type MaterialOperationFixture
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

const viewportOf = (f: MaterialOperationFixture) => ({ stageRect: { space: "rest-stage-canvas-y-down-v1", x: f.targetBounds.x - 10, y: f.targetBounds.y - 10,
  width: 100, height: 50 }, outputWidth: 100, outputHeight: 50 });
const addIntent = (f: MaterialOperationFixture) => ({ kind: "add", drawableId: "draw_material_preview", displayName: "Preview", parentPartId: f.ids.partId,
  insertion: { position: "last" }, rigControlIds: [], maskBindings: [], runtimeVisibility: true, defaultOpacity: 1 });

describe("read-only material commands through the CLI", () => {
  it("extractMaterialSource returns the original texture, context and mapping, records package ID and revision, and changes nothing", async () => {
    const f = await fixture();
    const before = await snapshotDirectory(f.packageDirectory);
    const { exitCode, response } = await runMaterialCli(f, aiCommand("cmd_extract", "extractMaterialSource", { drawableId: f.ids.targetDrawableId, viewport: viewportOf(f) }, ["render"]));
    expect(exitCode, JSON.stringify(response)).toBe(0);
    expect(response.saved).toBe(false);
    const result = ExtractMaterialSourceResultSchema.parse((response.aiCommandResponse?.payload as { result: unknown }).result);
    expect(result.packageRef).toEqual({ packageId: expect.any(String), packageRevision: f.packageRevision });
    expect(result.sourceContext.packageRef).toEqual(result.packageRef);
    expect(result.sourceContext.sourceImageToStage).toMatchObject({ scale: 1, translation: { x: f.targetBounds.x, y: f.targetBounds.y } });
    for (const artifact of result.artifacts) {
      expect(artifact.imageAbsolutePath.startsWith(join(f.stateDirectory, "material-artifacts"))).toBe(true);
      const sidecar = MaterialCoordinateSidecarSchema.parse(JSON.parse(await readFile(artifact.sidecarAbsolutePath, "utf8")));
      expect(sidecar.packageRef).toEqual(result.packageRef);
    }
    expect(await snapshotDirectory(f.packageDirectory)).toEqual(before);
  }, 60_000);

  it("previewMaterialPlacement draws the PNG at a placement or fitted correspondences, beside the unchanged package", async () => {
    const f = await fixture();
    const image = await writeMaterialTestPng(f.imageDirectory, "preview", [20, 200, 60]);
    const before = await snapshotDirectory(f.packageDirectory);
    const viewport = viewportOf(f), x = f.targetBounds.x + f.targetBounds.width + 2, y = f.targetBounds.y;
    const placement = { from: "source-image-pixel-edge-v1", to: "rest-stage-canvas-y-down-v1", scale: 2, translation: { x, y } };
    const run = (commandId: string, alignment: unknown, extra: Record<string, unknown> = {}) => runMaterialCli(f, aiCommand(commandId, "previewMaterialPlacement",
      { image: { ...imageFileRef(image), ...extra }, alignment, intent: addIntent(f), viewport }, ["render"]));

    const explicit = await run("cmd_preview", { placement });
    expect(explicit.exitCode, JSON.stringify(explicit.response)).toBe(0);
    const result = PreviewMaterialPlacementResultSchema.parse((explicit.response.aiCommandResponse?.payload as { result: unknown }).result);
    expect(result.preview.sidecar).toMatchObject({ kind: "placement-alpha-preview", packageRef: result.packageRef, materialPlacement: placement, materialRgbaSha256: image.rgbaSha256 });
    const px = Math.floor(x - viewport.stageRect.x + 4), py = Math.floor(y - viewport.stageRect.y + 4);
    expect(materialPixel(await readMaterialTestPng(result.preview.artifact.imageAbsolutePath), px, py)).toEqual([20, 200, 60, 255]);
    expect(materialPixel(await readMaterialTestPng(result.context.imageAbsolutePath), px, py)[3]).toBe(0);

    const fitted = await run("cmd_fit", { correspondences: [
      { pixel: { space: "source-image-pixel-edge-v1", x: 0, y: 0 }, stage: { space: "rest-stage-canvas-y-down-v1", x, y } },
      { pixel: { space: "source-image-pixel-edge-v1", x: 4, y: 4 }, stage: { space: "rest-stage-canvas-y-down-v1", x: x + 8, y: y + 8 } }] });
    const fit = PreviewMaterialPlacementResultSchema.parse((fitted.response.aiCommandResponse?.payload as { result: unknown }).result);
    expect(fit.placement).toEqual(placement);
    expect(fit.fitEvidence?.maxErrorStage).toBe(0);

    const mismatch = await run("cmd_mismatch", { placement }, { rgbaSha256: "0".repeat(64) });
    expect(mismatch.exitCode).toBe(2);
    expect(mismatch.response.diagnostics?.map((item) => item.checkId)).toEqual(["material.imageDigestMismatch"]);
    expect(await snapshotDirectory(f.packageDirectory)).toEqual(before);
  }, 60_000);

  it("requires render and a current basis revision", async () => {
    const f = await fixture();
    const payload = { drawableId: f.ids.targetDrawableId, viewport: viewportOf(f) };
    const denied = await runMaterialCli(f, aiCommand("cmd_denied", "extractMaterialSource", payload, ["read"]));
    expect(denied.exitCode).toBe(2);
    expect(denied.response.aiCommandStatus).toBe("permission_denied");
    const stale = await runMaterialCli(f, { ...aiCommand("cmd_stale", "extractMaterialSource", payload, ["render"]),
      basis: { relatedAC: [], relatedScenarios: [], packageRevision: f.packageRevision + 5 } });
    expect(stale.exitCode).toBe(2);
    expect(stale.response.diagnostics?.map((item) => item.checkId)).toEqual(["material.basisStale"]);
  }, 60_000);
});
