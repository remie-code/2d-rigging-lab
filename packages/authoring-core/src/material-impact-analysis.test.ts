import { describe, expect, it } from "vitest";
import { DrawableIdSchema } from "@private-2d-rigging-lab/contracts";
import { analyzeMaterialImpact, guardMaterialCandidateOperation } from "./material-impact-analysis.js";
import { addCandidate, buildWorking, control, keyform, materialSession, parameter } from "./material-test-fixtures.js";
import { cloneAuthoringSession } from "./authoring-session.js";
import { createRotation2dRigControl, bindRigControlChild, updateRigControl, deleteRigControl } from "./rig-control-mutations.js";
import { createParameter } from "./authoring-mutations.js";

const target = DrawableIdSchema.parse("draw_fixture");
const rigSession = async () => {
  const session = (await buildWorking(await materialSession(), addCandidate("draw_other"))).workingSession;
  session.graph.rigControls.push(control("rig_shared", [], ["rig_dedicated", "rig_other"]), control("rig_dedicated", [target]), control("rig_other", ["draw_other"]));
  session.graph.rigControls[1]!.parentId = session.graph.rigControls[0]!.rigControlId;
  session.graph.rigControls[2]!.parentId = session.graph.rigControls[0]!.rigControlId;
  session.graph.rigControlRootIds = [session.graph.rigControls[0]!.rigControlId];
  session.graph.parameters.push(parameter("param_shared"), parameter("param_dedicated"), parameter("param_other"));
  session.graph.keyformSets.push(keyform("keyset_shared", "rigControl", "rig_shared", "angleDegrees", "param_shared"),
    keyform("keyset_dedicated", "rigControl", "rig_dedicated", "angleDegrees", "param_dedicated"),
    keyform("keyset_other", "rigControl", "rig_other", "angleDegrees", "param_other"));
  return session;
};

describe("material operation scope guard", () => {
  it("reports nested shared controls, keys and parameters from graph reachability", async () => {
    const session = await rigSession();
    const impact = analyzeMaterialImpact(session, { kind: "replace", drawableId: target, preserveLogicalDrawableId: true,
      geometryReset: { scope: "target-direct-geometry-keyforms", keyformSetIds: [] }, preserveExistingDeformers: true,
      sharedControlPolicy: "reject-shared-control-key-parameter-deletion" });
    for (const id of ["rig_shared", "keyset_shared", "param_shared"]) {
      expect(impact.sharedReferences.find((ref) => ref.target.id === id)?.affectedDrawableIds).toEqual([target, "draw_other"]);
    }
  });

  it("allows ordinary dedicated control edits and revision bookkeeping", async () => {
    const before = await rigSession(); const after = cloneAuthoringSession(before);
    updateRigControl(after, { rigControlId: "rig_dedicated" as never, displayName: "Edited" });
    after.packageRevision++;
    expect(guardMaterialCandidateOperation(before, after, target).allowed).toBe(true);
  });

  it("allows dedicated control deletion and reconnection under a shared parent", async () => {
    const before = await rigSession(); const after = cloneAuthoringSession(before);
    deleteRigControl(after, { rigControlId: "rig_dedicated" as never });
    expect(after.graph.rigControls[0]!.childDrawableIds).toContain(target);
    expect(guardMaterialCandidateOperation(before, after, target).allowed).toBe(true);
    const shared = after.graph.rigControls[0]!;
    if (shared.kind === "rotation2d") shared.pivot.x++;
    expect(guardMaterialCandidateOperation(before, after, target).allowed).toBe(false);
  });

  it("rejects ordinary shared control deletion including its implicit keyform deletion", async () => {
    const before = await rigSession(); const after = cloneAuthoringSession(before);
    deleteRigControl(after, { rigControlId: "rig_shared" as never });
    const result = guardMaterialCandidateOperation(before, after, target);
    expect(result.allowed).toBe(false);
    expect(result.impact.refusedDeletions.map((ref) => ref.target.id)).toEqual(expect.arrayContaining(["rig_shared", "keyset_shared"]));
    expect(before.graph.rigControls).toHaveLength(3);
  });

  it("rejects shared parameter deletion and 2D keyform parameter reverse references", async () => {
    const before = await rigSession();
    before.graph.keyformSets[2] = { keyformSetId: "keyset_grid" as never, target: { kind: "rigControl", id: "rig_other", property: "angleDegrees" },
      parameterX: "param_dedicated" as never, parameterY: "param_other" as never, evaluator: "parameter-grid-2d-v1", interpolation: "bilinear-grid-v1",
      clampPolicy: "clamp-to-parameter-range", missingKeyPolicy: "diagnostic-error", compositionMode: "replace", compositionOrder: 0,
      keys: [{ x: 0, y: 0, statePatch: 0 }] };
    const after = cloneAuthoringSession(before);
    after.graph.parameters = after.graph.parameters.filter((item) => item.parameterId !== "param_dedicated");
    after.graph.keyformSets = [];
    const result = guardMaterialCandidateOperation(before, after, target);
    expect(result.allowed).toBe(false);
    expect(result.impact.refusedDeletions.find((ref) => ref.target.id === "param_dedicated")?.affectedDrawableIds).toEqual([target, "draw_other"]);
  });

  it("rejects unrelated empty controls/parameters and other geometry/mask/structure changes", async () => {
    const before = await rigSession();
    before.graph.rigControls.push(control("rig_empty", [])); before.graph.parameters.push(parameter("param_empty"));
    for (const kind of ["control", "parameter", "mesh", "source", "rootOrder", "sharedEdit", "part", "drawable"]) {
      const after = cloneAuthoringSession(before);
      if (kind === "control") after.graph.rigControls.pop();
      if (kind === "parameter") after.graph.parameters.pop();
      if (kind === "mesh") after.graph.meshes[1]!.vertices[0]!.x++;
      if (kind === "source") after.graph.sourceAssets[0]!.layers[0]!.bounds.x++;
      if (kind === "rootOrder") after.graph.rigControlRootIds = [];
      if (kind === "sharedEdit") after.graph.rigControls[0]!.displayName = "changed";
      if (kind === "part") after.graph.parts[0]!.displayName = "changed";
      if (kind === "drawable") after.graph.drawables[1]!.runtimeVisibility = false;
      expect(guardMaterialCandidateOperation(before, after, target).allowed, kind).toBe(false);
    }
  });

  it("allows new rig/control parameter creation and subsequent dedicated binding", async () => {
    const before = await materialSession(); const created = cloneAuthoringSession(before);
    createRotation2dRigControl(created, control("rig_new", []));
    createParameter(created, parameter("param_new"));
    expect(guardMaterialCandidateOperation(before, created, target).allowed).toBe(true);
    const bound = cloneAuthoringSession(created);
    bindRigControlChild(bound, { parentRigControlId: "rig_new" as never, child: { kind: "drawable", id: target } });
    expect(guardMaterialCandidateOperation(created, bound, target).allowed).toBe(true);
    const edited = cloneAuthoringSession(bound);
    updateRigControl(edited, { rigControlId: "rig_new" as never, displayName: "New dedicated" });
    expect(guardMaterialCandidateOperation(bound, edited, target).allowed).toBe(true);
    const unrelated = cloneAuthoringSession(created);
    unrelated.graph.rigControls[0]!.childDrawableIds = ["draw_other" as never];
    expect(guardMaterialCandidateOperation(created, unrelated, target).allowed).toBe(false);
  });

  it("protects binary bytes and package identity", async () => {
    const before = await materialSession(); const after = cloneAuthoringSession(before);
    after.binaryAssets!.fileEntries[0]!.bytes[0] = 19;
    expect(guardMaterialCandidateOperation(before, after, target).allowed).toBe(false);
    expect(before.binaryAssets!.fileEntries[0]!.bytes[0]).toBe(0);
  });
});
