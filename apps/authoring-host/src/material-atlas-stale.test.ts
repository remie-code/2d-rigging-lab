import { rm } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import { applyTextureAtlasPreview, createTextureAtlasPreview, sameTextureAtlasSourceSignature } from "@private-2d-rigging-lab/authoring-core";

import { loadAuthoringPackageDirectory } from "./package-directory-io.js";
import { dryRunThenCommit, imageFileRef, writeMaterialOperationFixture, writeMaterialTestPng } from "./test-support/material-operation-fixtures.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("material atlas freshness", () => {
  it("an atlas preview made before replaceDrawableImage stays stale after the commit", async () => {
    const f = await writeMaterialOperationFixture();
    roots.push(f.root);
    // Atlas packing only takes drawables bound to the rig.
    const rig = await dryRunThenCommit(f, { name: "rig", operationType: "createRotation2dRigControl", operationId: "op_material_atlas_rig",
      basePackageRevision: f.packageRevision, payload: { displayName: "Atlas rig", childDrawableIds: [f.ids.targetDrawableId, f.ids.otherDrawableId],
        childRigControlIds: [], pivot: { x: 0, y: 0 }, restAngleDegrees: 0 } });
    expect(rig.commit.exitCode, JSON.stringify(rig.commit.response)).toBe(0);
    const settings = { pageWidth: 256, pageHeight: 256, paddingPixels: 1 };
    const oldPreview = createTextureAtlasPreview((await loadAuthoringPackageDirectory(f.packageDirectory)).session, settings);
    expect(oldPreview.status).toBe("ready");
    if (oldPreview.status !== "ready") throw new Error(JSON.stringify(oldPreview));

    const image = await writeMaterialTestPng(f.imageDirectory, "replacement", [150, 40, 210], { width: 17, height: 7 });
    const { commit } = await dryRunThenCommit(f, { name: "atlas", operationType: "replaceDrawableImage", operationId: "op_material_atlas",
      basePackageRevision: f.packageRevision + 1, payload: { image: imageFileRef(image), provenanceNote: "Synthetic replacement.",
        placement: { from: "source-image-pixel-edge-v1", to: "rest-stage-canvas-y-down-v1", scale: 4, translation: { x: f.targetBounds.x, y: f.targetBounds.y } },
        intent: { kind: "replace", drawableId: f.ids.targetDrawableId, preserveLogicalDrawableId: true,
          geometryReset: { scope: "target-direct-geometry-keyforms", keyformSetIds: [f.ids.targetGeometryKeyformSetId] }, preserveExistingDeformers: true,
          sharedControlPolicy: "reject-shared-control-key-parameter-deletion" } } });
    expect(commit.exitCode, JSON.stringify(commit.response)).toBe(0);

    const replaced = (await loadAuthoringPackageDirectory(f.packageDirectory)).session;
    const newPreview = createTextureAtlasPreview(replaced, settings);
    expect(newPreview.status).toBe("ready");
    if (newPreview.status !== "ready") throw new Error(JSON.stringify(newPreview));
    expect(sameTextureAtlasSourceSignature(oldPreview.layoutSummary.sourceSignature, newPreview.layoutSummary.sourceSignature)).toBe(false);
    expect((await applyTextureAtlasPreview(replaced, { preview: oldPreview })).status).toBe("failed");
  }, 60_000);
});
