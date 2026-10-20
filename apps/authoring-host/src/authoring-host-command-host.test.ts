import { rm } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import { createMaterialImageIdSeed, OperationRequestSchema, type OperationRequestDto } from "@private-2d-rigging-lab/operation-core";

import { AuthoringHostCommandHost } from "./authoring-host-command-host.js";
import { loadAuthoringPackageDirectory } from "./package-directory-io.js";
import {
  imageFileRef,
  operationRequest,
  writeMaterialOperationFixture,
  writeMaterialTestPng,
  type MaterialOperationFixture,
  type MaterialTestImage
} from "./test-support/material-operation-fixtures.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const createHost = async () => {
  const f = await writeMaterialOperationFixture();
  roots.push(f.root);
  const loaded = await loadAuthoringPackageDirectory(f.packageDirectory);
  const host = new AuthoringHostCommandHost({ session: loaded.session, packageDocument: loaded.packageDocument, packageDirectory: f.packageDirectory });
  return { f, host };
};

/** What image registration could change: the binary file paths, the binary index and the revision. */
const bytesState = (host: AuthoringHostCommandHost) => ({
  packageRevision: host.session.packageRevision,
  paths: (host.session.binaryAssets?.fileEntries ?? []).map((entry) => entry.path).sort(),
  index: (host.session.binaryAssets?.binaryAssetIndex.assets ?? []).map((entry) => entry.binaryAssetId).sort()
});

const replaceRequest = (f: MaterialOperationFixture, image: MaterialTestImage, dryRun: boolean, keyformSetIds: string[], rgbaSha256 = image.rgbaSha256): OperationRequestDto =>
  OperationRequestSchema.parse(operationRequest({ operationType: "replaceDrawableImage", operationId: "op_host_replace", basePackageRevision: f.packageRevision, dryRun,
    payload: { image: { ...imageFileRef(image), rgbaSha256 }, provenanceNote: "Synthetic replacement.",
      placement: { from: "source-image-pixel-edge-v1", to: "rest-stage-canvas-y-down-v1", scale: 4, translation: { x: f.targetBounds.x, y: f.targetBounds.y } },
      intent: { kind: "replace", drawableId: f.ids.targetDrawableId, preserveLogicalDrawableId: true,
        geometryReset: { scope: "target-direct-geometry-keyforms", keyformSetIds }, preserveExistingDeformers: true,
        sharedControlPolicy: "reject-shared-control-key-parameter-deletion" } } }));

describe("AuthoringHostCommandHost image operations", () => {
  it("keeps image bytes out of the host session unless the commit succeeds", async () => {
    const { f, host } = await createHost();
    const image = await writeMaterialTestPng(f.imageDirectory, "replacement", [150, 40, 210], { width: 17, height: 7 });
    const initial = bytesState(host);
    const texturePath = `assets/textures/${createMaterialImageIdSeed("op_host_replace" as never)}.rgba`;
    expect(initial.paths).not.toContain(texturePath);

    expect((await host.dryRunOperation(replaceRequest(f, image, true, [f.ids.targetGeometryKeyformSetId]))).status).toBe("dry_run");
    expect(bytesState(host)).toEqual(initial);

    const intakeRejected = await host.commitOperation(replaceRequest(f, image, false, [f.ids.targetGeometryKeyformSetId], "0".repeat(64)));
    expect(intakeRejected.diagnostics.map((item) => item.checkId)).toEqual(["operation.replaceDrawableImage.imageDigestMismatch"]);
    expect(bytesState(host)).toEqual(initial);

    const operationRejected = await host.commitOperation(replaceRequest(f, image, false, []));
    expect(operationRejected.diagnostics.map((item) => item.checkId)).toEqual(["operation.replaceDrawableImage.geometryResetMismatch"]);
    expect(bytesState(host)).toEqual(initial);

    expect((await host.commitOperation(replaceRequest(f, image, false, [f.ids.targetGeometryKeyformSetId]))).status).toBe("committed");
    const committed = bytesState(host);
    expect(committed.packageRevision).toBe(initial.packageRevision + 1);
    expect(committed.paths).toEqual([...initial.paths, texturePath].sort());
    expect(host.session.binaryAssets!.fileEntries.find((entry) => entry.path === texturePath)!.bytes).toEqual(image.rgbaBytes);
  }, 60_000);
});
