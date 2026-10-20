import { describe, expect, it } from "vitest";
import { createMaterialImageFixture, type MaskRelationId } from "@private-2d-rigging-lab/contracts";
import { addDrawableFromImage, replaceDrawableImage } from "./material-image-drawable.js";
import { planMaterialImageAssets, registerMaterialImageBytes } from "./material-image-assets.js";
import { addImageDrawable, completedSession, imageAddIntent, imageReplaceIntent, replaceImageDrawable,
  withRegisteredImage } from "./material-image-drawable-test-fixtures.js";
import { control, emptyMaterialSession, keyform, parameter } from "./material-test-fixtures.js";
import { getPartOrderedChildren } from "./part-children-order.js";
import { createAuthoringWorkspaceSavePlan } from "./workspace-save.js";

const fixture = createMaterialImageFixture();
const input = (idSeed: string) => ({ image: fixture.image.descriptor, placement: fixture.placement, provenanceNote: "note", idSeed });

/** draw_a and draw_b under part_root, rig_parent binding draw_a, mask draw_a -> draw_b. */
const baseSession = () => {
  const first = completedSession(addImageDrawable(emptyMaterialSession(), "seed_a", imageAddIntent("draw_a")));
  const session = completedSession(addImageDrawable(first, "seed_b", imageAddIntent("draw_b")));
  session.graph.rigControls.push(control("rig_parent", ["draw_a"]));
  session.graph.rigControlRootIds.push(session.graph.rigControls[0]!.rigControlId);
  session.graph.masks.push({ maskRelationId: "maskrel_test" as MaskRelationId, maskDrawableIds: ["draw_a" as never], targetDrawableIds: ["draw_b" as never], enabled: true });
  return session;
};

describe("addDrawableFromImage", () => {
  it("creates drawable, mesh, part position, draw order, deformer, mask, texture, source, provenance and rights", async () => {
    const before = withRegisteredImage(baseSession(), "seed_new");
    const snapshot = structuredClone(before);
    const result = addDrawableFromImage(before, { ...input("seed_new"), intent: imageAddIntent("draw_new", {
      displayName: "New shadow", insertion: { position: "after", sibling: { kind: "drawable", drawableId: "draw_a" as never } },
      rigControlIds: ["rig_parent" as never], maskBindings: [{ maskRelationId: "maskrel_test" as MaskRelationId, role: "target" }],
      runtimeVisibility: false, defaultOpacity: 0.4 }) });
    expect(before).toEqual(snapshot);
    const next = completedSession(result);
    if (result.status !== "completed") throw new Error("unreachable");
    expect(result.assets).toMatchObject({ sourceAssetId: "src_seed_new", textureId: "tex_seed_new", meshId: "mesh_seed_new", provenanceId: "prov_seed_new" });
    const drawable = next.graph.drawables.find((item) => item.drawableId === "draw_new")!;
    expect(drawable).toMatchObject({ displayName: "New shadow", partId: "part_root", meshId: "mesh_seed_new", textureId: "tex_seed_new",
      sourceAssetId: "src_seed_new", sourceProvenanceId: "prov_seed_new", runtimeVisibility: false, defaultOpacity: 0.4 });
    expect(next.graph.meshes.find((mesh) => mesh.meshId === "mesh_seed_new")).toMatchObject({ drawableId: "draw_new", bounds: { x: 9, y: 9, width: 8, height: 8 } });
    expect(getPartOrderedChildren(next.graph, next.graph.parts[0]!).map((child) => "drawableId" in child ? child.drawableId : child.partId))
      .toEqual(["draw_a", "draw_new", "draw_b"]);
    expect(next.graph.drawOrder.map((entry) => entry.drawableId)).toEqual(["draw_a", "draw_new", "draw_b"]);
    expect(["draw_a", "draw_new", "draw_b"].map((id) => next.graph.drawables.find((item) => item.drawableId === id)!.baseDrawOrder)).toEqual([0, 1, 2]);
    expect(next.graph.rigControls[0]!.childDrawableIds).toEqual(["draw_a", "draw_new"]);
    expect(next.graph.masks[0]!.targetDrawableIds).toEqual(["draw_b", "draw_new"]);
    const texture = next.graph.textureAtlas!.textures.find((item) => item.textureId === "tex_seed_new")!;
    expect(texture).toMatchObject({ dimensions: { width: 4, height: 4, pixelFormat: "rgba8" }, contentInset: { left: 0, top: 0, right: 0, bottom: 0 },
      sourceAssetId: "src_seed_new", sourceLayerId: "layer_seed_new", contentHash: fixture.image.descriptor.rgbaSha256 });
    expect(texture.binaryAssetRef).toEqual(result.assets.binaryAssetRef);
    const source = next.graph.sourceAssets.find((item) => item.sourceAssetId === "src_seed_new")!;
    expect(source.layers[0]).toMatchObject({ sourceLayerId: "layer_seed_new", originalName: "New shadow", mappedDrawableIds: ["draw_new"] });
    expect(next.graph.provenanceRecords.find((item) => item.provenanceId === "prov_seed_new")).toMatchObject({ assetKind: "aiEdit", aiUsed: true });
    expect(next.graph.provenanceRecords.find((item) => item.provenanceId === "prov_seed_new")!.transformHistory[0]).toBe("note");
    expect(next.graph.rightsRecords.find((item) => item.assetId === "src_seed_new")).toMatchObject({ rightsStatus: "needs_review", redistributionAllowed: false });
    expect(result.impact.created.map((item) => `${item.kind}:${item.id}`)).toEqual(
      ["sourceAsset:src_seed_new", "texture:tex_seed_new", "drawable:draw_new", "mesh:mesh_seed_new"]);
    // Bytes are the ones the caller registered; the function added no binary entry of its own.
    expect(next.binaryAssets!.fileEntries.map((entry) => entry.path)).toEqual(before.binaryAssets!.fileEntries.map((entry) => entry.path));
    const save = await createAuthoringWorkspaceSavePlan({ session: next, updatedAt: "2026-10-20T00:00:00.000Z" });
    expect(save.packageDocument.model.drawables.drawables.find((item) => item.drawableId === "draw_new")).toEqual(drawable);
  });

  it("records content inset on the texture and maps only storage content to the stage", () => {
    const image = createMaterialImageFixture().image;
    image.descriptor.contentInset = { left: 1, top: 1, right: 1, bottom: 1 };
    const result = addImageDrawable(emptyMaterialSession(), "seed_inset", imageAddIntent(), { image });
    const next = completedSession(result);
    expect(next.graph.textureAtlas!.textures[0]!.contentInset).toEqual({ left: 1, top: 1, right: 1, bottom: 1 });
    expect(next.graph.meshes[0]!.bounds).toEqual({ x: 11, y: 11, width: 4, height: 4 });
  });

  it("rejects missing bytes, digest mismatch, other-seed bytes, transparent bytes and seed collisions without changing input", () => {
    const empty = emptyMaterialSession();
    const cases: Array<[string, () => ReturnType<typeof addDrawableFromImage>, string]> = [
      ["missing", () => addDrawableFromImage(empty, { ...input("seed_x"), intent: imageAddIntent() }), "material.imageBytesMissing"],
      ["other seed", () => addDrawableFromImage(withRegisteredImage(empty, "seed_other"), { ...input("seed_x"), intent: imageAddIntent() }), "material.imageBytesMissing"],
      ["digest", () => {
        const session = structuredClone(empty);
        registerMaterialImageBytes(session, { idSeed: "seed_x", image: { ...fixture.image.descriptor, rgbaSha256: "b".repeat(64) }, rgbaBytes: fixture.image.rgbaBytes });
        return addDrawableFromImage(session, { ...input("seed_x"), intent: imageAddIntent() });
      }, "material.imageDigestMismatch"],
      ["transparent", () => {
        const session = structuredClone(empty);
        registerMaterialImageBytes(session, { idSeed: "seed_x", image: fixture.image.descriptor, rgbaBytes: new Uint8Array(fixture.image.rgbaBytes.length) });
        return addDrawableFromImage(session, { ...input("seed_x"), intent: imageAddIntent() });
      }, "material.imageTransparent"],
      ["collision", () => {
        const once = completedSession(addImageDrawable(empty, "seed_x"));
        return addImageDrawable(once, "seed_x", imageAddIntent("draw_again"));
      }, "material.idCollision"]
    ];
    for (const [name, run, checkId] of cases) {
      const snapshot = structuredClone(empty);
      const result = run();
      expect(result.status, name).toBe("rejected");
      expect(result, name).not.toHaveProperty("session");
      expect(result.diagnostics.map((item) => item.checkId), name).toEqual([checkId]);
      expect(empty, name).toEqual(snapshot);
    }
  });

  it("leaves the input unchanged when the seed collides with existing assets", () => {
    const once = completedSession(addImageDrawable(emptyMaterialSession(), "seed_x"));
    const input2 = withRegisteredImage(once, "seed_x");
    const snapshot = structuredClone(input2);
    const result = addDrawableFromImage(input2, { ...input("seed_x"), intent: imageAddIntent("draw_again") });
    expect(result.diagnostics.map((item) => item.checkId)).toEqual(["material.idCollision"]);
    expect(result).not.toHaveProperty("session");
    expect(input2).toEqual(snapshot);
  });

  it("plans the same package IDs and binary reference from a seed regardless of session", () => {
    const plan = planMaterialImageAssets("seed_q", fixture.image.descriptor);
    expect(plan.binaryAssetRef).toMatchObject({ binaryAssetId: "bin_seed_q", packageRelativePath: "assets/textures/seed_q.rgba",
      digest: { algorithm: "sha256", hex: fixture.image.descriptor.rgbaSha256 }, byteLength: 64, provenanceId: "prov_seed_q", rightsAssetId: "src_seed_q" });
    expect(() => planMaterialImageAssets("bad seed", fixture.image.descriptor)).toThrow();
  });
});

describe("replaceDrawableImage", () => {
  const keyedSession = () => {
    const session = baseSession();
    const meshA = session.graph.drawables.find((item) => item.drawableId === "draw_a")!.meshId;
    session.graph.parameters.push(parameter("param_x"));
    session.graph.rigControls.push(control("rig_shared", ["draw_b"]));
    session.graph.rigControls[0]!.childRigControlIds = [];
    session.graph.keyformSets.push(keyform("keyset_geometry", "mesh", meshA), keyform("keyset_drawGeometry", "drawable", "draw_a"),
      keyform("keyset_opacity", "drawable", "draw_a", "opacity"), keyform("keyset_control", "rigControl", "rig_parent", "angleDegrees"),
      keyform("keyset_other", "drawable", "draw_b"));
    return session;
  };

  it("keeps the drawable ID, rebuilds its mesh and deletes only the declared direct geometry keyforms", () => {
    const session = keyedSession();
    const snapshot = structuredClone(session);
    const before = session.graph.drawables.find((item) => item.drawableId === "draw_a")!;
    const oldMesh = session.graph.meshes.find((item) => item.meshId === before.meshId)!;
    const wide = createMaterialImageFixture("wide");
    const result = replaceImageDrawable(session, "seed_r", imageReplaceIntent("draw_a", ["keyset_geometry", "keyset_drawGeometry"]),
      { image: wide.image, placement: { ...wide.placement, scale: 2 } });
    expect(session).toEqual(snapshot);
    const next = completedSession(result);
    const after = next.graph.drawables.find((item) => item.drawableId === "draw_a")!;
    expect(after).toMatchObject({ drawableId: "draw_a", displayName: before.displayName, partId: before.partId, meshId: before.meshId,
      textureId: "tex_seed_r", sourceAssetId: "src_seed_r", sourceProvenanceId: "prov_seed_r" });
    const mesh = next.graph.meshes.find((item) => item.meshId === before.meshId)!;
    expect(mesh.bounds).toEqual({ x: 8, y: 9, width: 20, height: 16 });
    expect(mesh.topologyRevision).toBe((oldMesh.topologyRevision ?? 0) + 1);
    expect(next.graph.keyformSets.map((key) => key.keyformSetId)).toEqual(["keyset_opacity", "keyset_control", "keyset_other"]);
    for (const field of ["parts", "rigControls", "masks", "drawOrder"] as const) expect(next.graph[field]).toEqual(session.graph[field]);
    expect(next.graph.drawables.find((item) => item.drawableId === "draw_b")).toEqual(session.graph.drawables.find((item) => item.drawableId === "draw_b"));
    expect(next.graph.sourceAssets.find((item) => item.sourceAssetId === before.sourceAssetId)!.layers[0]!.mappedDrawableIds).toEqual([]);
    expect(next.graph.textureAtlas!.textures.find((item) => item.textureId === "tex_seed_r")).toMatchObject({
      dimensions: { width: 10, height: 8, pixelFormat: "rgba8" }, contentInset: { left: 0, top: 0, right: 0, bottom: 0 } });
    if (result.status !== "completed") throw new Error("unreachable");
    expect(result.impact.reset.map((item) => item.id)).toEqual(["keyset_geometry", "keyset_drawGeometry", before.meshId]);
  });

  it("rejects partial resets, shared keyforms and shared meshes without changing input", () => {
    const cases: Array<[string, (session: ReturnType<typeof keyedSession>) => string[], string]> = [
      ["partial", () => ["keyset_geometry"], "material.geometryResetMismatch"],
      ["extra direct", () => ["keyset_geometry", "keyset_drawGeometry", "keyset_opacity"], "material.geometryResetMismatch"],
      ["shared keyform", (session) => {
        session.graph.rigControls[0]!.childDrawableIds.push("draw_b" as never);
        return ["keyset_geometry", "keyset_drawGeometry", "keyset_control"];
      }, "material.sharedKeyformReset"],
      ["other drawable", () => ["keyset_geometry", "keyset_drawGeometry", "keyset_other"], "material.sharedKeyformReset"],
      ["shared mesh", (session) => {
        const meshA = session.graph.drawables.find((item) => item.drawableId === "draw_a")!.meshId;
        session.graph.drawables.find((item) => item.drawableId === "draw_b")!.meshId = meshA;
        session.graph.keyformSets = session.graph.keyformSets.filter((key) => key.keyformSetId !== "keyset_geometry");
        return ["keyset_drawGeometry"];
      }, "material.sharedMeshReset"]
    ];
    for (const [name, prepare, checkId] of cases) {
      const session = keyedSession();
      const ids = prepare(session);
      const registered = withRegisteredImage(session, "seed_r");
      const snapshot = structuredClone(registered);
      const result = replaceDrawableImage(registered, { ...input("seed_r"), intent: imageReplaceIntent("draw_a", ids) });
      expect(result.status, name).toBe("rejected");
      expect(result.diagnostics.map((item) => item.checkId), name).toEqual([checkId]);
      expect(registered, name).toEqual(snapshot);
      if (checkId === "material.sharedKeyformReset") expect(result.impact?.refusedDeletions.length, name).toBeGreaterThan(0);
    }
  });

  it("rejects a missing target and unregistered bytes", () => {
    const session = keyedSession();
    expect(replaceImageDrawable(session, "seed_r", imageReplaceIntent("draw_missing")).diagnostics[0]!.checkId).toBe("material.targetMissing");
    expect(replaceDrawableImage(session, { ...input("seed_r"), intent: imageReplaceIntent("draw_a", ["keyset_geometry", "keyset_drawGeometry"]) })
      .diagnostics[0]!.checkId).toBe("material.imageBytesMissing");
  });
});
