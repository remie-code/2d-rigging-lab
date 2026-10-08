import { describe, expect, it } from "vitest";
import { createMaterialCandidateFixture, createMaterialImageFixture, DrawableIdSchema, type MaterialCandidate } from "@private-2d-rigging-lab/contracts";
import { VariantGroupSchema } from "@private-2d-rigging-lab/package-format";
import { buildMaterialCandidate } from "./material-candidate-build.js";
import { addCandidate, buildWorking, control, emptyMaterialSession, keyform, materialSession, parameter } from "./material-test-fixtures.js";
import { materialSha256 } from "./material-validation.js";
import { createGeneratedMeshForDrawable } from "./mesh-generation.js";
import { moveMeshVertices, replaceDrawableMesh } from "./mesh-mutations.js";
import { getPartOrderedChildren } from "./part-children-order.js";
import { createAuthoringWorkspaceSavePlan } from "./workspace-save.js";

const replacement = (ids: string[] = []): MaterialCandidate => {
  const c = createMaterialCandidateFixture();
  if (c.intent.kind === "replace") c.intent.geometryReset.keyformSetIds = ids as typeof c.intent.geometryReset.keyformSetIds;
  return c;
};

describe("material candidate build", () => {
  it("adds ordered editable geometry and consistent source, rights, bytes without changing input", async () => {
    const input = emptyMaterialSession();
    const snapshot = structuredClone(input);
    const image = createMaterialImageFixture().image;
    const bytes = image.rgbaBytes.slice();
    const { workingSession: next, impact } = await buildWorking(input, addCandidate(), image);
    expect(input).toEqual(snapshot);
    expect(image.rgbaBytes).toEqual(bytes);
    const drawable = next.graph.drawables[0]!;
    const layer = next.graph.sourceAssets[0]!.layers[0]!;
    expect(layer.bounds).toEqual({ x: 9, y: 9, width: 8, height: 8 });
    expect(layer.mappedDrawableIds).toEqual([drawable.drawableId]);
    const texture = next.graph.textureAtlas!.textures[0]!;
    expect(texture.sourceAssetId).toBe(drawable.sourceAssetId);
    expect(texture.sourceLayerId).toBe(layer.sourceLayerId);
    expect(texture.dimensions).toEqual({ width: 4, height: 4, pixelFormat: "rgba8" });
    expect(next.binaryAssets!.fileEntries[0]!.bytes).toEqual(bytes);
    expect(next.binaryAssets!.fileEntries[0]!.bytes).not.toBe(image.rgbaBytes);
    expect(next.graph.rightsRecords[0]!.rightsStatus).toBe("needs_review");
    expect(next.graph.provenanceRecords[0]!.assetKind).toBe("aiEdit");
    expect(next.graph.meshes[0]!.triangles).toHaveLength(2);
    expect(impact.created.map((item) => item.kind)).toEqual(["sourceAsset", "texture", "drawable", "mesh"]);
    const save = await createAuthoringWorkspaceSavePlan({ session: next, updatedAt: "2026-09-26T00:00:00.000Z" });
    expect(save.packageDocument.model.drawables.drawables[0]).toEqual(drawable);
  });

  it("supports add Part order, rig membership, visibility and directed masks", async () => {
    const session = (await buildWorking(await materialSession(), addCandidate("draw_maskTarget"))).workingSession;
    session.graph.rigControls.push(control("rig_parent", ["draw_fixture"]));
    session.graph.rigControlRootIds.push(session.graph.rigControls[0]!.rigControlId);
    const first = session.graph.drawables[0]!;
    session.graph.masks.push({ maskRelationId: "maskrel_test" as never, maskDrawableIds: [first.drawableId], targetDrawableIds: [session.graph.drawables[1]!.drawableId], enabled: true });
    const c = addCandidate("draw_added");
    if (c.intent.kind !== "add") throw new Error("fixture");
    c.intent.insertion = { position: "before", sibling: { kind: "drawable", drawableId: first.drawableId } };
    c.intent.rigControlIds = [session.graph.rigControls[0]!.rigControlId];
    c.intent.maskBindings = [{ maskRelationId: session.graph.masks[0]!.maskRelationId, role: "target" }];
    c.intent.runtimeVisibility = false; c.intent.defaultOpacity = 0.4;
    const { workingSession: next, impact } = await buildWorking(session, c);
    expect(getPartOrderedChildren(next.graph, next.graph.parts[0]!)).toEqual([
      { kind: "drawable", drawableId: "draw_added" }, { kind: "drawable", drawableId: "draw_fixture" }, { kind: "drawable", drawableId: "draw_maskTarget" }]);
    expect(next.graph.rigControls[0]!.childDrawableIds).toEqual(["draw_fixture", "draw_added"]);
    expect(impact.sharedReferences.find((ref) => ref.target.id === "rig_parent")?.affectedDrawableIds).toEqual(["draw_fixture", "draw_added"]);
    expect(next.graph.masks[0]!.targetDrawableIds).toEqual(["draw_maskTarget", "draw_added"]);
    expect(next.graph.drawables[2]).toMatchObject({ runtimeVisibility: false, defaultOpacity: 0.4 });
  });

  it("replaces same-area material, retaining shared texture, rig, order, mask and variant references", async () => {
    const session = (await buildWorking(await materialSession(), addCandidate("draw_other"))).workingSession;
    const other = session.graph.drawables[1]!;
    session.graph.sourceAssets[1]!.layers[0]!.mappedDrawableIds = [];
    other.sourceAssetId = session.graph.drawables[0]!.sourceAssetId;
    other.textureId = session.graph.drawables[0]!.textureId;
    other.sourceProvenanceId = session.graph.drawables[0]!.sourceProvenanceId;
    session.graph.sourceAssets[0]!.layers[0]!.mappedDrawableIds.push(other.drawableId);
    session.graph.rigControls.push(control("rig_shared", ["draw_fixture", "draw_other"]));
    session.graph.rigControlRootIds = [session.graph.rigControls[0]!.rigControlId];
    session.graph.masks.push({ maskRelationId: "maskrel_shared" as never, maskDrawableIds: [other.drawableId], targetDrawableIds: [session.graph.drawables[0]!.drawableId], enabled: true });
    session.graph.variantGroups = [VariantGroupSchema.parse({ variantGroupId: "vgrp_test", displayName: "Test", mode: "singleSelect",
      variants: [{ variantId: "var_one", displayName: "One" }], targetDrawableIds: ["draw_fixture"], memberships: [{ drawableId: "draw_fixture", variantIds: ["var_one"] }], defaultActive: { kind: "singleSelect", variantId: "var_one" } })];
    const original = structuredClone(session);
    const { workingSession: next, impact } = await buildWorking(session, replacement());
    expect(session).toEqual(original);
    for (const field of ["parts", "rigControls", "masks", "variantGroups", "drawOrder"] as const) expect(next.graph[field]).toEqual(session.graph[field]);
    expect(next.graph.drawables[1]).toEqual(other);
    expect(next.graph.textureAtlas!.textures[0]).toEqual(session.graph.textureAtlas!.textures[0]);
    expect(next.graph.drawables[0]).toMatchObject({ drawableId: "draw_fixture", displayName: "draw_fixture", meshId: session.graph.drawables[0]!.meshId });
    expect(next.graph.sourceAssets[0]!.layers[0]!.mappedDrawableIds).toEqual([other.drawableId]);
    expect(next.graph.sourceAssets[2]!.layers[0]!.mappedDrawableIds).toEqual(["draw_fixture"]);
    expect(impact.sharedReferences.map((ref) => ref.target.kind)).toContain("rigControl");
    expect(impact.sharedReferences.map((ref) => ref.target.kind)).toContain("texture");
  });

  it("requires exact direct geometry resets and preserves opacity and control keyforms", async () => {
    const session = await materialSession();
    session.graph.parameters.push(parameter("param_x"));
    session.graph.rigControls.push(control("rig_one", ["draw_fixture"]));
    session.graph.keyformSets.push(keyform("keyset_geometry", "mesh", session.graph.meshes[0]!.meshId),
      keyform("keyset_drawGeometry", "drawable", "draw_fixture"), keyform("keyset_opacity", "drawable", "draw_fixture", "opacity"),
      keyform("keyset_control", "rigControl", "rig_one", "angleDegrees"));
    for (const ids of [[], ["keyset_geometry"], ["keyset_geometry", "keyset_drawGeometry", "keyset_opacity"], ["keyset_geometry", "keyset_geometry"]]) {
      const snapshot = structuredClone(session);
      const result = await buildMaterialCandidate(session, replacement(ids), createMaterialImageFixture().image);
      expect(result.status).toBe("rejected"); expect(result).not.toHaveProperty("workingSession"); expect(session).toEqual(snapshot);
    }
    const result = await buildWorking(session, replacement(["keyset_geometry", "keyset_drawGeometry"]));
    expect(result.workingSession.graph.keyformSets.map((key) => key.keyformSetId)).toEqual(["keyset_opacity", "keyset_control"]);
  });

  it("covers expanded alpha with new geometry, then supports normal alpha-aware remesh and vertex editing", async () => {
    const session = await materialSession();
    const wide = createMaterialImageFixture("wide");
    const c = replacement(); c.image = wide.image.descriptor; c.placement = { ...wide.placement, scale: 3 };
    const { workingSession: next } = await buildWorking(session, c, wide.image);
    expect(next.graph.meshes[0]!.bounds).toEqual({ x: 8, y: 9, width: 30, height: 24 });
    const generated = createGeneratedMeshForDrawable({ session: next, drawableId: c.intent.drawableId,
      provenanceId: next.graph.meshes[0]!.generationProvenanceId, method: "auto-grid-v1" })!;
    expect(generated.source).toBe("alpha-aware-rgba");
    replaceDrawableMesh(next, generated.mesh);
    const mesh = next.graph.meshes[0]!;
    moveMeshVertices(next, { meshId: mesh.meshId, vertexDeltas: [{ vertexId: mesh.vertexStableIds[0] as never, delta: { x: 1, y: 0 } }] });
    expect(next.graph.meshes[0]!.vertices[0]!.x).toBe(generated.mesh.vertices[0]!.x + 1);
  });

  it("preserves content inset pixel to stage and content UV mapping", async () => {
    const fixture = createMaterialImageFixture();
    fixture.image.descriptor.contentInset = { left: 1, top: 1, right: 1, bottom: 1 };
    const c = addCandidate(); c.image = fixture.image.descriptor;
    const { workingSession: next } = await buildWorking(emptyMaterialSession(), c, fixture.image);
    expect(next.graph.meshes[0]!.bounds).toEqual({ x: 11, y: 11, width: 4, height: 4 });
    expect(next.graph.meshes[0]!.uvs).toContainEqual({ x: 0, y: 0 });
    expect(next.graph.meshes[0]!.uvs).toContainEqual({ x: 1, y: 1 });
    const result = createGeneratedMeshForDrawable({ session: next, drawableId: c.intent.drawableId,
      provenanceId: next.graph.meshes[0]!.generationProvenanceId, method: "auto-grid-v1" });
    expect(result?.source).toBe("alpha-aware-rgba");
  });

  it("rejects late missing rig/mask and insertion failures without partially registered assets", async () => {
    for (const failure of ["rig", "mask", "sibling"]) {
      const session = emptyMaterialSession(); const snapshot = structuredClone(session); const c = addCandidate();
      if (c.intent.kind !== "add") throw new Error("fixture");
      if (failure === "rig") c.intent.rigControlIds = ["rig_missing" as never];
      if (failure === "mask") c.intent.maskBindings = [{ maskRelationId: "maskrel_missing" as never, role: "target" }];
      if (failure === "sibling") c.intent.insertion = { position: "after", sibling: { kind: "drawable", drawableId: "draw_missing" as never } };
      const result = await buildMaterialCandidate(session, c, createMaterialImageFixture().image);
      expect(result.status).toBe("rejected"); expect(result).not.toHaveProperty("workingSession"); expect(session).toEqual(snapshot);
    }
  });

  it("rejects hash mismatch, descriptor mismatch, stale revision and transparent material", async () => {
    for (const failure of ["hash", "descriptor", "revision", "transparent"]) {
      const input = emptyMaterialSession(); const c = addCandidate(); const image = createMaterialImageFixture().image;
      if (failure === "hash") image.rgbaBytes[0] = 50;
      if (failure === "descriptor") c.image.originalFileSha256 = "b".repeat(64);
      if (failure === "revision") c.basePackage.packageRevision++;
      if (failure === "transparent") {
        image.rgbaBytes.fill(0); image.descriptor.alpha = { bounds: null, nonTransparentPixelCount: 0, translucentPixelCount: 0 };
        image.descriptor.rgbaSha256 = await materialSha256(image.rgbaBytes); c.image = image.descriptor;
      }
      const snapshot = structuredClone(input); const imageSnapshot = structuredClone(image);
      const result = await buildMaterialCandidate(input, c, image);
      expect(result.status).toBe("rejected"); expect(input).toEqual(snapshot); expect(image).toEqual(imageSnapshot);
    }
  });
});
