import { describe, expect, it } from "vitest";
import { createMaterialCandidateFixture } from "./material-contract-fixtures.js";
import { MaterialOperationResultSchema } from "./material-operation-result.js";
import { MaterialAbsolutePathSchema, MaterialCoordinateSidecarSchema } from "./material-artifacts.js";

const createResult = () => {
  const candidate = createMaterialCandidateFixture();
  return { schemaVersion: "material-operation-result-v1", operationId: "op_fixture", operation: "register",
    status: "completed", candidateId: candidate.candidateId, basePackage: candidate.basePackage, candidate,
    changedTargets: [], baseChanged: false, artifacts: [], diagnostics: [] };
};
const diagnostic = { checkId: "material.stale", status: "fail", severity: "error", phase: "apply",
  target: { kind: "package", id: "pkg_fixture" }, message: "Base changed." };

describe("material results and artifacts", () => {
  it("does not let incomplete/failing operations look completed", () => {
    const result = createResult();
    expect(MaterialOperationResultSchema.safeParse(result).success).toBe(true);
    for (const status of ["pending", "failed", "rejected"]) {
      expect(MaterialOperationResultSchema.safeParse({ ...result, status }).success).toBe(false);
      expect(MaterialOperationResultSchema.safeParse({ ...result, status, diagnostics: [diagnostic] }).success).toBe(true);
      expect(MaterialOperationResultSchema.safeParse({ ...result, status, diagnostics: [diagnostic], baseChanged: true }).success).toBe(false);
      expect(MaterialOperationResultSchema.safeParse({ ...result, status, diagnostics: [diagnostic], changedTargets: [{ kind: "drawable", id: "draw_fixture" }] }).success).toBe(false);
    }
    expect(MaterialOperationResultSchema.safeParse({ ...result, diagnostics: [diagnostic] }).success).toBe(false);
    expect(MaterialOperationResultSchema.safeParse({ ...result, candidateId: "material_other" }).success).toBe(false);
    expect(MaterialOperationResultSchema.safeParse({ ...result, candidate: undefined }).success).toBe(false);
  });
  it("requires approved/applied state and impact evidence for a completed apply", () => {
    const r = createResult(), c = r.candidate;
    expect(MaterialOperationResultSchema.safeParse({ ...r, operation: "apply", baseChanged: true }).success).toBe(false);
    const workingPackage = { ...c.basePackage, packageRevision: 2, contentFingerprint: "b".repeat(64) };
    const candidate = { ...c, state: "applied", workingPackage, appliedPackage: workingPackage,
      approval: { candidateRevision: 0, workingPackage, approvedBy: "root", approvedAt: "2026-09-26T00:00:00Z" } };
    const impact = { drawableId: "draw_fixture", preserved: [], reset: [], created: [], sharedReferences: [], refusedDeletions: [], existingDeformersChanged: false };
    const applied = { ...r, operation: "apply", baseChanged: true, candidate, impact };
    expect(MaterialOperationResultSchema.safeParse(applied).success).toBe(true);
    expect(MaterialOperationResultSchema.safeParse({ ...applied, baseChanged: false }).success).toBe(false);
    expect(MaterialOperationResultSchema.safeParse({ ...applied, impact: { ...impact, refusedDeletions: [
      { target: { kind: "rigControl", id: "rig_shared" }, affectedDrawableIds: ["draw_other"], reason: "shared-control-key-parameter" }
    ] } }).success).toBe(false);
  });
  it("requires image artifacts on successful extraction/preview", () => {
    expect(MaterialOperationResultSchema.safeParse({ ...createResult(), operation: "preview" }).success).toBe(false);
  });
  it("requires the preview artifact, exact candidate sidecar and current working package", () => {
    const r = createResult(), c = r.candidate;
    const artifact = { kind: "placement-alpha-preview", imageAbsolutePath: "/tmp/preview.png", sidecarAbsolutePath: "/tmp/preview.json" };
    const sidecar = { schemaVersion: "material-coordinate-sidecar-v1", kind: artifact.kind,
      candidateId: c.candidateId, candidateRevision: c.candidateRevision, packageVersion: c.basePackage, restPose: c.restPose,
      viewport: { stageRect: { space: "rest-stage-canvas-y-down-v1", x: 0, y: 0, width: 20, height: 20 }, outputWidth: 100, outputHeight: 100 },
      imageToStage: { ...c.placement, scale: 0.2, translation: { x: 0, y: 0 } }, materialPlacement: c.placement, coverage: "full-alpha-no-old-mesh-clip" };
    const preview = { ...r, operation: "preview", artifacts: [artifact], previewContext: { artifact, sidecar } };
    expect(MaterialOperationResultSchema.safeParse(preview).success).toBe(true);
    expect(MaterialOperationResultSchema.safeParse({ ...preview, previewContext: undefined }).success).toBe(false);
    expect(MaterialOperationResultSchema.safeParse({ ...preview, artifacts: [{ ...artifact, kind: "source-texture" }] }).success).toBe(false);
    expect(MaterialOperationResultSchema.safeParse({ ...preview, previewContext: { artifact: { ...artifact, kind: "source-texture" }, sidecar: { ...sidecar, kind: "source-texture" } }, artifacts: [{ ...artifact, kind: "source-texture" }] }).success).toBe(false);
    for (const mismatch of [{ candidateId: "material_other" }, { candidateRevision: 1 }, { packageVersion: { ...c.basePackage, packageRevision: 2 } }]) {
      expect(MaterialOperationResultSchema.safeParse({ ...preview, previewContext: { artifact, sidecar: { ...sidecar, ...mismatch } } }).success).toBe(false);
    }
    const workingPackage = { ...c.basePackage, packageRevision: 2, contentFingerprint: "b".repeat(64) };
    const workingArtifact = { ...artifact, kind: "working-mesh-rig-preview" };
    const workingSidecar = { ...sidecar, kind: workingArtifact.kind, coverage: "evaluated-mesh", workingPackage };
    const working = { ...preview, candidate: { ...c, state: "working", workingPackage }, artifacts: [workingArtifact], previewContext: { artifact: workingArtifact, sidecar: workingSidecar } };
    expect(MaterialOperationResultSchema.safeParse(working).success).toBe(true);
    expect(MaterialOperationResultSchema.safeParse({ ...working, candidate: c }).success).toBe(false);
    expect(MaterialOperationResultSchema.safeParse({ ...working, previewContext: { artifact: workingArtifact, sidecar: { ...workingSidecar, workingPackage: { ...workingPackage, contentFingerprint: "c".repeat(64) } } } }).success).toBe(false);
    expect(MaterialOperationResultSchema.safeParse({ ...working, previewContext: { artifact: workingArtifact, sidecar: { ...workingSidecar, workingPackage: undefined } } }).success).toBe(false);
  });
  it("requires original texture, context composite and related structure for completed extraction", () => {
    const r = createResult(), c = r.candidate;
    const sourceTexture = { kind: "source-texture", imageAbsolutePath: "/tmp/source.png", sidecarAbsolutePath: "/tmp/source.json" };
    const contextComposite = { kind: "context-composite", imageAbsolutePath: "/tmp/context.png", sidecarAbsolutePath: "/tmp/context.json" };
    const sourceContext = { packageVersion: c.basePackage, drawableId: "draw_fixture", meshId: "mesh_fixture", parentPartId: "part_fixture",
      rigControlIds: [], maskRelationIds: [], variantRefs: [], relatedTargets: [], sourceTexture, contextComposite,
      sourceImageToStage: c.placement, sourceLayerStageBounds: { space: "rest-stage-canvas-y-down-v1", x: 9, y: 9, width: 8, height: 8 }, restPose: c.restPose };
    const extraction = { ...r, operation: "extract", sourceContext, artifacts: [sourceTexture, contextComposite] };
    expect(MaterialOperationResultSchema.safeParse(extraction).success).toBe(true);
    expect(MaterialOperationResultSchema.safeParse({ ...extraction, sourceContext: undefined }).success).toBe(false);
    expect(MaterialOperationResultSchema.safeParse({ ...extraction, artifacts: [contextComposite] }).success).toBe(false);
    expect(MaterialOperationResultSchema.safeParse({ ...extraction, artifacts: [{ ...sourceTexture, kind: "placement-alpha-preview" }] }).success).toBe(false);
    expect(MaterialOperationResultSchema.safeParse({ ...extraction, sourceContext: { ...sourceContext, packageVersion: { ...c.basePackage, packageRevision: 2 } } }).success).toBe(false);
  });
  it.each(["C:/artifacts/image.png", "C:\\artifacts\\image.png", "/tmp/image.png", "\\\\server\\share\\image.png"])("accepts absolute artifact path %s", (path) => {
    expect(MaterialAbsolutePathSchema.safeParse(path).success).toBe(true);
  });
  it.each(["image.png", "./image.png", "C:image.png", ""])("rejects relative artifact path %s", (path) => {
    expect(MaterialAbsolutePathSchema.safeParse(path).success).toBe(false);
  });
  it("separates placement alpha and working mesh previews with explicit coordinate sidecars", () => {
    const c = createMaterialCandidateFixture();
    const sidecar = { schemaVersion: "material-coordinate-sidecar-v1", kind: "placement-alpha-preview",
      candidateId: c.candidateId, candidateRevision: 0, packageVersion: c.basePackage, restPose: c.restPose,
      viewport: { stageRect: { space: "rest-stage-canvas-y-down-v1", x: 0, y: 0, width: 20, height: 20 }, outputWidth: 100, outputHeight: 100 },
      imageToStage: { ...c.placement, scale: 0.2, translation: { x: 0, y: 0 } }, materialPlacement: c.placement, coverage: "full-alpha-no-old-mesh-clip" };
    expect(MaterialCoordinateSidecarSchema.safeParse(sidecar).success).toBe(true);
    expect(MaterialCoordinateSidecarSchema.safeParse({ ...sidecar, imageToStage: c.placement }).success).toBe(false);
    expect(MaterialCoordinateSidecarSchema.safeParse({ ...sidecar, materialPlacement: undefined }).success).toBe(false);
    expect(MaterialCoordinateSidecarSchema.safeParse({ ...sidecar, coverage: "evaluated-mesh" }).success).toBe(false);
    expect(MaterialCoordinateSidecarSchema.safeParse({ ...sidecar, kind: "working-mesh-rig-preview", coverage: "evaluated-mesh" }).success).toBe(false);
    expect(MaterialCoordinateSidecarSchema.safeParse({ ...sidecar, kind: "working-mesh-rig-preview", coverage: "evaluated-mesh", workingPackage: c.basePackage }).success).toBe(true);
  });
});
