import { describe, expect, it } from "vitest";
import { materialFixture } from "./material-command-test-fixtures.js";
import { fingerprintMaterialPackage } from "./material-package-fingerprint.js";

describe("normal candidate operation scope", () => {
  it("rejects shared rig/key/parameter deletion and unrelated geometry without saving clone", async () => {
    const f = await materialFixture("replace", true); const c = await f.next("buildMaterialCandidate", await f.register());
    const before = await f.load(c), baseHash = await fingerprintMaterialPackage({ directory: f.packageDirectory });
    const sharedKey = before.workingPackage!.session.graph.keyformSets.find(k => k.target.id === f.ids.eyeMaskDrawableId)!;
    for (const [operationType, payload] of [
      ["deleteRigControl", { rigControlId: "rig_shared" }],
      ["deleteParameter", { parameterId: f.ids.eyeRegionOpacityParameterId }],
      ["updateDrawable", { drawableId: f.ids.eyeMaskDrawableId, displayName: "Unrelated edit" }],
      ["editKeyformKey", { action: "deleteCurrent", target: { kind: "drawable", id: f.ids.eyeMaskDrawableId }, targetProperty: "opacity", parameterId: f.ids.eyeRegionOpacityParameterId, interpolation: "linear-1d-v1", keyValue: 1 }]
    ] as const) {
      const r = await f.invoke("editMaterialCandidate", { candidateId: c.candidateId, expectedCandidateRevision: c.candidateRevision,
        operation: { schemaVersion: "operation-request-v1", actor: "ai", surface: "structuredApi", dryRun: false, basePackageRevision: before.workingPackage!.session.packageRevision, operationType, payload } });
      expect(r.outcome).toBe("rejected"); expect(r.saved).toBe(false);
      expect((await f.load(c)).candidate).toEqual(c);
    }
    expect(sharedKey).toBeDefined(); expect(await fingerprintMaterialPackage({ directory: f.packageDirectory })).toBe(baseHash);
  }, 45000);
  it("rejects editing an unbound control and allows create-bind-edit", async () => {
    const f = await materialFixture(); let c = await f.next("buildMaterialCandidate", await f.register());
    c = await f.edit(c, "createRotation2dRigControl", { displayName: "Unbound", pivot: { x: 10, y: 10 }, restAngleDegrees: 0 });
    const rig = (await f.load(c)).workingPackage!.session.graph.rigControls.find(r => r.displayName === "Unbound")!;
    await expect(f.edit(c, "updateRigControl", { rigControlId: rig.rigControlId, restAngleDegrees: 5 })).rejects.toThrow();
    c = await f.edit(c, "bindRigControlChild", { parentRigControlId: rig.rigControlId, child: { kind: "drawable", id: f.drawableId } });
    c = await f.edit(c, "updateRigControl", { rigControlId: rig.rigControlId, restAngleDegrees: 5 });
    c = await f.edit(c, "createParameter", { parameterId: "param_candidate", displayName: "Candidate opacity", min: -1, max: 1, default: 0, recommendedUiStep: 0.1 });
    await expect(f.edit(c, "updateParameter", { parameterId: "param_candidate", displayName: "Unbound edit" })).rejects.toThrow();
    c = await f.edit(c, "editKeyformKey", { action: "createEnds", target: { kind: "drawable", id: f.drawableId }, targetProperty: "opacity", parameterId: "param_candidate", interpolation: "linear-1d-v1", statePatches: { min: { propertyPath: "opacity", value: 0 }, max: { propertyPath: "opacity", value: 1 } } });
    c = await f.edit(c, "updateParameter", { parameterId: "param_candidate", displayName: "Bound candidate opacity" });
    expect(c.state).toBe("working");
  }, 65000);
});
