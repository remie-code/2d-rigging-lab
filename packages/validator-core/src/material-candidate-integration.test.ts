import { describe, expect, it } from "vitest";
import { evaluateViewerRuntimeSnapshot } from "@private-2d-rigging-lab/runtime-core";
import { toRuntimeGraph } from "../../authoring-core/src/to-runtime-graph.js";
import { createMaterialCandidateFixture, createMaterialImageFixture } from "@private-2d-rigging-lab/contracts";
import { addCandidate, buildWorking, control, emptyMaterialSession } from "../../authoring-core/src/material-test-fixtures.js";
import { createPackageDocumentBaseFromAuthoringSession } from "../../authoring-core/src/package-document-from-authoring-session.js";
import type { AuthoringSession } from "../../authoring-core/src/authoring-session.js";
import { validatePackageRuntimeWithBinaryAssets } from "./validators/package-runtime.js";

const validate = async (session: AuthoringSession) => {
  const packageDocument = createPackageDocumentBaseFromAuthoringSession(session, { createdAt: "2026-09-26T00:00:00.000Z" });
  const evaluated = evaluateViewerRuntimeSnapshot(toRuntimeGraph(session), { targetIds: session.graph.drawables.map((item) => item.drawableId) });
  const report = await validatePackageRuntimeWithBinaryAssets({ packageDocument, profile: "editorIncremental", runtimeSnapshot: evaluated.snapshot, viewerEvidence: evaluated.evidence,
    binaryFileSet: session.binaryAssets?.fileEntries ?? [], ...(session.binaryAssets ? { binaryAssetIndex: session.binaryAssets.binaryAssetIndex } : {}) });
  // Rights remain needs_review because the material contract conveys no license grant.
  expect(report.checks.filter((check) => check.status === "fail"), JSON.stringify(report.checks, null, 2)).toEqual([]);
  return report;
};

describe("material candidates retain normal package reference and binary validity", () => {
  it("validates add with Part insertion, direct rig binding and non-self mask", async () => {
    const base = (await buildWorking(emptyMaterialSession())).workingSession;
    const second = (await buildWorking(base, addCandidate("draw_second"))).workingSession;
    second.graph.rigControls.push(control("rig_parent", ["draw_second"]));
    second.graph.rigControlRootIds.push(second.graph.rigControls[0]!.rigControlId);
    second.graph.masks.push({ maskRelationId: "maskrel_test" as never, maskDrawableIds: [base.graph.drawables[0]!.drawableId],
      targetDrawableIds: [second.graph.drawables[1]!.drawableId], enabled: true });
    await validate(second);
    const candidate = addCandidate("draw_new");
    if (candidate.intent.kind !== "add") throw new Error("fixture");
    candidate.intent.rigControlIds = [second.graph.rigControls[0]!.rigControlId];
    candidate.intent.maskBindings = [{ maskRelationId: second.graph.masks[0]!.maskRelationId, role: "target" }];
    candidate.intent.insertion = { position: "before", sibling: { kind: "drawable", drawableId: base.graph.drawables[0]!.drawableId } };
    await validate((await buildWorking(second, candidate)).workingSession);
  });

  it("validates replacement of a shared texture and a larger scaled image without source mismatch", async () => {
    const base = (await buildWorking(emptyMaterialSession())).workingSession;
    const second = (await buildWorking(base, addCandidate("draw_second"))).workingSession;
    const first = second.graph.drawables[0]!;
    Object.assign(second.graph.drawables[1]!, { textureId: first.textureId, sourceAssetId: first.sourceAssetId, sourceProvenanceId: first.sourceProvenanceId });
    second.graph.sourceAssets[1]!.layers[0]!.mappedDrawableIds = [];
    second.graph.sourceAssets[0]!.layers[0]!.mappedDrawableIds.push(second.graph.drawables[1]!.drawableId);
    second.graph.rigControls.push(control("rig_shared", ["draw_fixture", "draw_second"]));
    second.graph.rigControlRootIds.push(second.graph.rigControls[0]!.rigControlId);
    await validate(second);
    const candidate = createMaterialCandidateFixture();
    const fixture = createMaterialImageFixture("wide");
    candidate.image = fixture.image.descriptor; candidate.placement = { ...fixture.placement, scale: 2.5 };
    const result = await buildWorking(second, candidate, fixture.image);
    const report = await validate(result.workingSession);
    expect(report.checks.some((check) => check.message.includes("drawable-texture-source-layer-mismatch"))).toBe(false);
  });
});
