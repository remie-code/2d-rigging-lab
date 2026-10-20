import { describe, expect, it } from "vitest";
import { evaluateViewerRuntimeSnapshot } from "@private-2d-rigging-lab/runtime-core";
import { createMaterialImageFixture } from "@private-2d-rigging-lab/contracts";
import { toRuntimeGraph } from "../../authoring-core/src/to-runtime-graph.js";
import { addImageDrawable, completedSession, imageAddIntent, imageReplaceIntent,
  replaceImageDrawable } from "../../authoring-core/src/material-image-drawable-test-fixtures.js";
import { control, emptyMaterialSession, keyform, parameter } from "../../authoring-core/src/material-test-fixtures.js";
import { createPackageDocumentBaseFromAuthoringSession } from "../../authoring-core/src/package-document-from-authoring-session.js";
import type { AuthoringSession } from "../../authoring-core/src/authoring-session.js";
import { validatePackageRuntimeWithBinaryAssets } from "./validators/package-runtime.js";

const validate = async (session: AuthoringSession) => {
  const packageDocument = createPackageDocumentBaseFromAuthoringSession(session, { createdAt: "2026-10-20T00:00:00.000Z" });
  const evaluated = evaluateViewerRuntimeSnapshot(toRuntimeGraph(session), { targetIds: session.graph.drawables.map((item) => item.drawableId) });
  const report = await validatePackageRuntimeWithBinaryAssets({ packageDocument, profile: "editorIncremental", runtimeSnapshot: evaluated.snapshot,
    viewerEvidence: evaluated.evidence, binaryFileSet: session.binaryAssets?.fileEntries ?? [],
    ...(session.binaryAssets ? { binaryAssetIndex: session.binaryAssets.binaryAssetIndex } : {}) });
  // Rights remain needs_review because the material contract conveys no license grant.
  expect(report.checks.filter((check) => check.status === "fail"), JSON.stringify(report.checks, null, 2)).toEqual([]);
  return report;
};

/** draw_a and draw_b with rig_parent binding draw_a and mask draw_a -> draw_b. */
const riggedSession = () => {
  const first = completedSession(addImageDrawable(emptyMaterialSession(), "seed_a", imageAddIntent("draw_a")));
  const session = completedSession(addImageDrawable(first, "seed_b", imageAddIntent("draw_b")));
  session.graph.rigControls.push(control("rig_parent", ["draw_a"]));
  session.graph.rigControlRootIds.push(session.graph.rigControls[0]!.rigControlId);
  session.graph.masks.push({ maskRelationId: "maskrel_test" as never, maskDrawableIds: ["draw_a" as never], targetDrawableIds: ["draw_b" as never], enabled: true });
  return session;
};

describe("image drawables pass the normal package, reference and binary validators", () => {
  it("validates an added drawable with part insertion, deformer membership, mask and content inset", async () => {
    const session = riggedSession();
    await validate(session);
    const image = createMaterialImageFixture().image;
    image.descriptor.contentInset = { left: 1, top: 1, right: 1, bottom: 1 };
    const next = completedSession(addImageDrawable(session, "seed_new", imageAddIntent("draw_new", {
      insertion: { position: "before", sibling: { kind: "drawable", drawableId: "draw_b" as never } },
      rigControlIds: ["rig_parent" as never], maskBindings: [{ maskRelationId: "maskrel_test" as never, role: "target" }] }), { image }));
    await validate(next);
  });

  it("validates a replaced image with reset geometry keyforms and a larger scaled image", async () => {
    const session = riggedSession();
    const meshA = session.graph.drawables[0]!.meshId;
    session.graph.parameters.push(parameter("param_x"));
    session.graph.keyformSets.push(keyform("keyset_geometry", "mesh", meshA), keyform("keyset_opacity", "drawable", "draw_a", "opacity"),
      keyform("keyset_control", "rigControl", "rig_parent", "angleDegrees"));
    const wide = createMaterialImageFixture("wide");
    const next = completedSession(replaceImageDrawable(session, "seed_r", imageReplaceIntent("draw_a", ["keyset_geometry"]),
      { image: wide.image, placement: { ...wide.placement, scale: 2.5 } }));
    expect(next.graph.keyformSets.map((key) => key.keyformSetId)).toEqual(["keyset_opacity", "keyset_control"]);
    const report = await validate(next);
    expect(report.checks.some((check) => check.message.includes("drawable-texture-source-layer-mismatch"))).toBe(false);
  });
});
