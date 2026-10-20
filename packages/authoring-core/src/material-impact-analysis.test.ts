import { describe, expect, it } from "vitest";
import { DrawableIdSchema } from "@private-2d-rigging-lab/contracts";
import { analyzeMaterialImpact, materialAffectedDrawables } from "./material-impact-analysis.js";
import { addImageDrawable, completedSession, imageAddIntent, imageReplaceIntent } from "./material-image-drawable-test-fixtures.js";
import { control, emptyMaterialSession, keyform, parameter } from "./material-test-fixtures.js";

const target = DrawableIdSchema.parse("draw_fixture");
const rigSession = () => {
  const first = completedSession(addImageDrawable(emptyMaterialSession(), "seed_target", imageAddIntent(target)));
  const session = completedSession(addImageDrawable(first, "seed_other", imageAddIntent("draw_other")));
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

describe("material impact analysis", () => {
  it("reports nested shared controls, keys and parameters from graph reachability", () => {
    const session = rigSession();
    const impact = analyzeMaterialImpact(session, imageReplaceIntent(target));
    for (const id of ["rig_shared", "keyset_shared", "param_shared"]) {
      expect(impact.sharedReferences.find((ref) => ref.target.id === id)?.affectedDrawableIds).toEqual([target, "draw_other"]);
    }
    expect(impact.sharedReferences.some((ref) => ref.target.id === "rig_dedicated")).toBe(false);
    expect(impact.preserved).toEqual(expect.arrayContaining([{ kind: "rigControl", id: "rig_dedicated" }, { kind: "keyformSet", id: "keyset_dedicated" }]));
  });

  it("follows 2D keyform parameters to the drawables they move", () => {
    const session = rigSession();
    session.graph.keyformSets[2] = { keyformSetId: "keyset_grid" as never, target: { kind: "rigControl", id: "rig_other", property: "angleDegrees" },
      parameterX: "param_dedicated" as never, parameterY: "param_other" as never, evaluator: "parameter-grid-2d-v1", interpolation: "bilinear-grid-v1",
      clampPolicy: "clamp-to-parameter-range", missingKeyPolicy: "diagnostic-error", compositionMode: "replace", compositionOrder: 0,
      keys: [{ x: 0, y: 0, statePatch: 0 }] };
    expect(materialAffectedDrawables(session, { kind: "parameter", id: "param_dedicated" })).toEqual([target, "draw_other"]);
  });
});
