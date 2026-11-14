import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { RenderViewResultSchema } from "@private-2d-rigging-lab/ai-interface";
import { REFERENCE_IMAGE_STATE_PATH, referenceImageBinaryPath } from "@private-2d-rigging-lab/authoring-core";
import { ReferenceImageStateSchema } from "@private-2d-rigging-lab/contracts";
import { encodeRgba8ToPng } from "@private-2d-rigging-lab/render-software";

import { materialPixel, readMaterialTestPng } from "./material-test-fixtures.js";
import { aiCommand, runMaterialCli, writeMaterialOperationFixture } from "./test-support/material-operation-fixtures.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("saved workspace reference image through the Host CLI", () => {
  it("keeps original PNG bytes and opacity, isolates model mode, and allows removal after damage", async () => {
    const fixture = await writeMaterialOperationFixture();
    roots.push(fixture.root);
    const packageDirectory = fixture.packageDirectory;
    const manifest = join(packageDirectory, "manifest.json");
    const manifestBefore = await readFile(manifest);
    const imagePath = join(fixture.imageDirectory, "reference.png");
    const pixels = Uint8Array.of(255, 0, 0, 127, 0, 255, 0, 255, 0, 0, 255, 0, 255, 255, 255, 255);
    const png = encodeRgba8ToPng(pixels, 2, 2);
    await writeFile(imagePath, png);
    const referenceCommand = (action: string, payload: object = {}, capabilities = ["read", "editReference"]) =>
      runMaterialCli(fixture, aiCommand(`cmd_reference_${action}`, "referenceImage", { action, ...payload }, capabilities));
    const render = (referenceMode?: string) => runMaterialCli(fixture, aiCommand("cmd_reference_render", "renderView", {
      outDir: join(fixture.root, "out"),
      view: { kind: "stageViewport", stageViewport: { minX: 0, minY: 0, width: 2, height: 2 } },
      outputWidth: 2,
      outputHeight: 2,
      referenceMode
    }));

    const denied = await referenceCommand("register", { imagePath }, ["read"]);
    expect(denied.response.aiCommandStatus).toBe("permission_denied");
    const registration = await referenceCommand("register", { imagePath, settings: { displayMode: "reference", opacity: 1 } });
    expect(registration.exitCode).toBe(0);
    const registered = registration.response.aiCommandResponse;
    if (registered?.command !== "referenceImage") throw new Error("Expected referenceImage response.");
    const state = ReferenceImageStateSchema.parse(registered.payload.result?.reference);
    const storedPng = join(packageDirectory, referenceImageBinaryPath(state.image));
    expect(await readFile(storedPng)).toEqual(Buffer.from(png));
    await rm(imagePath);
    const reopened = await referenceCommand("get");
    expect(reopened.response.aiCommandResponse?.payload).toEqual(registered.payload);

    const full = RenderViewResultSchema.parse((await render()).response.aiCommandResponse?.payload);
    const fullPng = await readMaterialTestPng(full.pngPath);
    expect(full.sidecar.referenceMode).toBe("reference");
    expect(full.sidecar.referenceImage).toEqual(state);
    expect(materialPixel(fullPng, 0, 0)).toEqual([255, 0, 0, 127]);
    expect(materialPixel(fullPng, 0, 1)).toEqual([0, 0, 0, 0]);
    expect((await referenceCommand("update", { settings: { opacity: 0.5 } })).exitCode).toBe(0);
    const half = RenderViewResultSchema.parse((await render("reference")).response.aiCommandResponse?.payload);
    expect(materialPixel(await readMaterialTestPng(half.pngPath), 0, 0)).toEqual([255, 0, 0, 64]);

    expect((await referenceCommand("register", { imagePath })).exitCode).toBe(2);
    const stillRegistered = await referenceCommand("get");
    expect(stillRegistered.response.aiCommandResponse?.payload).toEqual({ result: { reference: { ...state, opacity: 0.5 } } });
    await rm(storedPng);
    expect((await render("overlay")).response.error?.message).toContain("Missing workspace reference PNG");
    expect((await render("model")).exitCode).toBe(0);
    await writeFile(join(packageDirectory, REFERENCE_IMAGE_STATE_PATH), "{bad");
    expect((await render()).response.error?.message).toContain("Cannot read workspace reference state");
    expect((await render("model")).exitCode).toBe(0);
    expect((await referenceCommand("remove")).exitCode).toBe(0);
    expect((await referenceCommand("get")).response.aiCommandResponse?.payload).toEqual({ result: { reference: null } });
    expect((await render("reference")).response.error?.message).toContain("requires a registered reference PNG");
    expect(await readFile(manifest)).toEqual(manifestBefore);
  }, 15_000);
});
