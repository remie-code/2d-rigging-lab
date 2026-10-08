import { toRuntimeGraph } from "@private-2d-rigging-lab/authoring-core";
import { evaluateViewerRuntimeSnapshot } from "@private-2d-rigging-lab/runtime-core";
import { validatePackageRuntimeWithBinaryAssets } from "@private-2d-rigging-lab/validator-core";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { materialFixture } from "./material-command-test-fixtures.js";
import { fingerprintMaterialPackage } from "./material-package-fingerprint.js";
import { loadAuthoringPackageDirectory } from "./package-directory-io.js";
import { readMaterialTestPng } from "./material-test-fixtures.js";

describe("material production roundtrip", () => {
  for (const kind of ["replace", "add"] as const) it(`${kind}: extract, place, build, normal mesh/rig edits, compare, approve, apply, reopen`, async () => {
    const f = await materialFixture(kind), original = await fingerprintMaterialPackage({ directory: f.packageDirectory });
    const originalPackage = await loadAuthoringPackageDirectory(f.packageDirectory);
    const originalEvaluation = evaluateViewerRuntimeSnapshot(toRuntimeGraph(originalPackage.session), { targetIds: originalPackage.session.graph.drawables.map(d => d.drawableId) });
    const originalValidation = await validatePackageRuntimeWithBinaryAssets({ packageDocument: originalPackage.packageDocument, profile: "editorIncremental", runtimeSnapshot: originalEvaluation.snapshot, viewerEvidence: originalEvaluation.evidence, binaryFileSet: originalPackage.session.binaryAssets!.fileEntries, binaryAssetIndex: originalPackage.session.binaryAssets!.binaryAssetIndex });
    expect(originalValidation.checks.filter(check => check.status === "fail"), JSON.stringify(originalValidation.checks)).toEqual([]);
    const source = await f.call("extractMaterialSource", { drawableId: f.ids.eyeDrawableId, viewport: f.viewport });
    expect(source.result!.sourceContext!.sourceTexture.kind).toBe("source-texture");
    let candidate = await f.register();
    const oldRevision = candidate.candidateRevision;
    candidate = await f.next("setMaterialPlacement", candidate, { alignment: { correspondences: [
      { pixel: { space: "source-image-pixel-edge-v1", x: 0, y: 0 }, stage: { space: "rest-stage-canvas-y-down-v1", x: 8, y: 8 } },
      { pixel: { space: "source-image-pixel-edge-v1", x: 2, y: 2 }, stage: { space: "rest-stage-canvas-y-down-v1", x: 12, y: 12 } }
    ] } });
    expect(candidate.placement.scale).toBe(2); expect(candidate.candidateRevision).toBe(oldRevision + 1);
    const placement = await f.call("previewMaterialCandidate", { candidateId: candidate.candidateId, mode: "placement", viewport: f.viewport });
    expect(placement.result!.previewContext!.sidecar.coverage).toBe("full-alpha-no-old-mesh-clip");
    candidate = await f.next("buildMaterialCandidate", candidate);
    candidate = await f.edit(candidate, "generateMesh", { drawableId: f.drawableId, method: "auto-grid-v1", densityHint: "low" });
    candidate = await f.edit(candidate, "createRotation2dRigControl", { displayName: "Candidate rig", childDrawableIds: [], childRigControlIds: [], pivot: { x: 12, y: 12 }, restAngleDegrees: 0 });
    const rigId = (await f.load(candidate)).workingPackage!.session.graph.rigControls.find(r => r.displayName === "Candidate rig")!.rigControlId;
    candidate = await f.edit(candidate, "bindRigControlChild", { parentRigControlId: rigId, child: { kind: "drawable", id: f.drawableId } });
    candidate = await f.next("approveMaterialCandidate", candidate);
    candidate = await f.edit(candidate, "updateRigControl", { rigControlId: rigId, restAngleDegrees: 20 });
    expect(candidate.state).toBe("working"); expect("approval" in candidate).toBe(false);
    expect((await f.invoke("applyMaterialCandidate", { candidateId: candidate.candidateId, expectedCandidateRevision: candidate.candidateRevision })).outcome).toBe("rejected");
    const working = await f.call("previewMaterialCandidate", { candidateId: candidate.candidateId, mode: "working", viewport: f.viewport });
    expect(working.result!.previewContext!.sidecar.coverage).toBe("evaluated-mesh");
    expect(working.evaluatedRender!.sidecar.packageRevision).toBe((await f.load(candidate)).workingPackage!.session.packageRevision);
    expect(await readFile(working.comparisonAbsolutePath!, "utf8")).toContain("image0");
    const rendered = await readMaterialTestPng(working.result!.previewContext!.artifact.imageAbsolutePath);
    expect(rendered.data.some((v, i) => i % 4 === 3 && v > 0)).toBe(true);
    expect(await fingerprintMaterialPackage({ directory: f.packageDirectory })).toBe(original);
    candidate = await f.next("approveMaterialCandidate", candidate);
    const applied = await f.invoke("applyMaterialCandidate", { candidateId: candidate.candidateId, expectedCandidateRevision: candidate.candidateRevision });
    expect(applied.outcome).toBe("success"); expect(applied.saved).toBe(true);
    const reopened = await loadAuthoringPackageDirectory(f.packageDirectory);
    const evaluated = evaluateViewerRuntimeSnapshot(toRuntimeGraph(reopened.session), { targetIds: reopened.session.graph.drawables.map(d => d.drawableId) });
    const validation = await validatePackageRuntimeWithBinaryAssets({ packageDocument: reopened.packageDocument, profile: "editorIncremental", runtimeSnapshot: evaluated.snapshot, viewerEvidence: evaluated.evidence,
      binaryFileSet: reopened.session.binaryAssets?.fileEntries ?? [], ...(reopened.session.binaryAssets ? { binaryAssetIndex: reopened.session.binaryAssets.binaryAssetIndex } : {}) });
    expect(validation.checks.filter(check => check.status === "fail"), JSON.stringify(validation.checks)).toEqual([]);
    expect(reopened.session.graph.drawables.some(d => d.drawableId === f.drawableId)).toBe(true);
    expect(reopened.session.graph.rigControls.some(r => r.rigControlId === rigId)).toBe(true);
    expect(reopened.session.packageRevision).toBeGreaterThan(f.session.packageRevision);
    const newSource = reopened.session.graph.sourceAssets.find(a => a.sourceAssetId === reopened.session.graph.drawables.find(d => d.drawableId === f.drawableId)!.sourceAssetId)!;
    expect(newSource.layers.some(l => l.mappedDrawableIds.includes(f.drawableId as never))).toBe(true);
    expect(reopened.session.graph.rightsRecords.find(r => r.assetId === newSource.sourceAssetId)).toMatchObject({ rightsStatus: "needs_review", redistributionAllowed: false });
    await writeFile(join(f.root, "evidence.json"), JSON.stringify({ kind, appliedPackage: f.packageDirectory, source, placement, working, applied, validation }, null, 2));
  }, 120000);
});
