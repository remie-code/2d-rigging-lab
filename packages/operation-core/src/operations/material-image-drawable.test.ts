import {
  createInitialAuthoringRevision,
  getPartOrderedChildren,
  registerMaterialImageBytes
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { createMaterialImageFixture, PackageIdSchema, PartIdSchema } from "@private-2d-rigging-lab/contracts";
import type { MaterialNormalizedImage } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createOperationCore } from "../operation-core.js";
import { createMaterialImageIdSeed, resolveOperationId } from "../operation-ids.js";
import { getOperationHandler } from "../operation-registry.js";
import { OperationRequestSchema } from "../operation-request.js";
import type { OperationRequestDto } from "../operation-request.js";
import {
  addDrawableFromImageOperationHandler,
  replaceDrawableImageOperationHandler
} from "./material-image-drawable.js";

type Graph = AuthoringSession["graph"];
const fixture = createMaterialImageFixture();
const IMAGE_PATH = "C:/materials/shadow.png";

describe("addDrawableFromImage / replaceDrawableImage operations", () => {
  it("are registered in the operation registry", () => {
    expect(getOperationHandler("addDrawableFromImage")).toBe(addDrawableFromImageOperationHandler);
    expect(getOperationHandler("replaceDrawableImage")).toBe(replaceDrawableImageOperationHandler);
  });

  it("dry-runs without touching the session, then commits a drawable with part position, order, deformer, mask and texture", () => {
    const core = createOperationCore({ now: () => new Date("2026-10-20T00:00:00.000Z") });
    const session = createRiggedSession(core);
    const intent = addIntent("draw_new", {
      displayName: "Neck shadow",
      insertion: { position: "after", sibling: { kind: "drawable", drawableId: "draw_a" } },
      rigControlIds: ["rig_parent"],
      maskBindings: [{ maskRelationId: "maskrel_test", role: "target" }],
      runtimeVisibility: false,
      defaultOpacity: 0.4
    });
    const dryRequest = addRequest("op_add_new", intent, { dryRun: true, basePackageRevision: session.packageRevision });
    registerFor(session, dryRequest);
    const snapshot = structuredClone(session);

    const dryRun = core.dryRunOperation(session, dryRequest);
    expect(dryRun.status, JSON.stringify(dryRun.diagnostics)).toBe("dry_run");
    expect(session).toEqual(snapshot);
    expect(dryRun.modelDiff?.added).toEqual([
      { kind: "sourceAsset", id: "src_material_add_new" },
      { kind: "texture", id: "tex_material_add_new" },
      { kind: "drawable", id: "draw_new" },
      { kind: "mesh", id: "mesh_material_add_new" }
    ]);

    const commit = core.commitOperation(session, { ...dryRequest, dryRun: false });
    expect(commit.result.status, JSON.stringify(commit.result.diagnostics)).toBe("committed");
    expect(session.packageRevision).toBe(snapshot.packageRevision + 1);
    const drawable = session.graph.drawables.find((item) => item.drawableId === "draw_new")!;
    expect(drawable).toMatchObject({ displayName: "Neck shadow", partId: "part_root", meshId: "mesh_material_add_new",
      textureId: "tex_material_add_new", sourceAssetId: "src_material_add_new", runtimeVisibility: false, defaultOpacity: 0.4 });
    expect(session.graph.meshes.some((mesh) => mesh.meshId === "mesh_material_add_new" && mesh.drawableId === "draw_new")).toBe(true);
    expect(getPartOrderedChildren(session.graph, session.graph.parts[0]!)).toEqual([
      { kind: "drawable", drawableId: "draw_a" }, { kind: "drawable", drawableId: "draw_new" }, { kind: "drawable", drawableId: "draw_b" }]);
    expect(session.graph.drawOrder.map((entry) => entry.drawableId)).toEqual(["draw_a", "draw_new", "draw_b"]);
    expect(session.graph.rigControls[0]!.childDrawableIds).toEqual(["draw_a", "draw_new"]);
    expect(session.graph.masks[0]!.targetDrawableIds).toEqual(["draw_b", "draw_new"]);
    expect(session.graph.textureAtlas!.textures.find((item) => item.textureId === "tex_material_add_new")).toMatchObject({
      dimensions: { width: 4, height: 4, pixelFormat: "rgba8" }, contentInset: { left: 0, top: 0, right: 0, bottom: 0 } });
    expect(session.graph.rightsRecords.find((item) => item.assetId === "src_material_add_new")?.rightsStatus).toBe("needs_review");
    expect(session.graph.provenanceRecords.find((item) => item.provenanceId === "prov_material_add_new")?.transformHistory[0]).toBe("Synthetic shadow.");
    // The operation log keeps the path and hash, never the bytes.
    expect(commit.logEntry?.payload).toEqual({ operationType: "addDrawableFromImage", payload: {
      image: { imagePath: IMAGE_PATH, rgbaSha256: fixture.image.descriptor.rgbaSha256, width: 4, height: 4,
        contentInset: { left: 0, top: 0, right: 0, bottom: 0 } },
      placement: fixture.placement, provenanceNote: "Synthetic shadow.", lockedTargetIds: [], intent } });
    expect(JSON.stringify(commit.logEntry)).not.toMatch(/"0":\d+,"1":\d+/);
  });

  it("puts the payload content inset on the texture entry", () => {
    const core = createOperationCore();
    const session = createEmptySession();
    const image = createMaterialImageFixture().image;
    image.descriptor.contentInset = { left: 1, top: 1, right: 1, bottom: 1 };
    const request = addRequest("op_inset", addIntent("draw_inset"), { dryRun: false, contentInset: image.descriptor.contentInset });
    registerFor(session, request, image);

    const commit = core.commitOperation(session, request);
    expect(commit.result.status, JSON.stringify(commit.result.diagnostics)).toBe("committed");
    expect(session.graph.textureAtlas!.textures[0]).toMatchObject({ contentInset: { left: 1, top: 1, right: 1, bottom: 1 },
      dimensions: { width: 4, height: 4, pixelFormat: "rgba8" } });
    expect(session.graph.meshes[0]!.bounds).toEqual({ x: 11, y: 11, width: 4, height: 4 });
  });

  it("rejects missing bytes and a registered digest that differs from the payload hash, without logging", () => {
    const core = createOperationCore();
    const missing = createEmptySession();
    const missingSnapshot = structuredClone(missing);
    const missingResult = core.commitOperation(missing, addRequest("op_missing", addIntent("draw_x"), { dryRun: false }));
    expect(missingResult.result.status).toBe("rejected");
    expect(missingResult.result.diagnostics.map((item) => item.checkId)).toEqual(["operation.addDrawableFromImage.imageBytesMissing"]);
    expect(missing).toEqual(missingSnapshot);

    const mismatched = createEmptySession();
    const request = addRequest("op_mismatch", addIntent("draw_x"), { dryRun: true, rgbaSha256: "b".repeat(64) });
    registerFor(mismatched, request);
    const mismatchedSnapshot = structuredClone(mismatched);
    const dryRun = core.dryRunOperation(mismatched, request);
    expect(dryRun.status).toBe("rejected");
    expect(dryRun.diagnostics.map((item) => item.checkId)).toEqual(["operation.addDrawableFromImage.imageDigestMismatch"]);
    const commit = core.commitOperation(mismatched, { ...request, dryRun: false });
    expect(commit.result.diagnostics.map((item) => item.checkId)).toEqual(["operation.addDrawableFromImage.imageDigestMismatch"]);
    expect(mismatched).toEqual(mismatchedSnapshot);
    expect(core.operationLog.entries).toEqual([]);
  });

  it("derives distinct package IDs from distinct operation IDs and a payload-based ID when none is given", () => {
    const core = createOperationCore();
    const session = createEmptySession();
    for (const [operationId, drawableId] of [["op_first", "draw_one"], ["op_second", "draw_two"]] as const) {
      const request = addRequest(operationId, addIntent(drawableId), { dryRun: false, basePackageRevision: session.packageRevision });
      registerFor(session, request);
      expect(core.commitOperation(session, request).result.status).toBe("committed");
    }
    expect(session.graph.textureAtlas!.textures.map((item) => item.textureId)).toEqual(["tex_material_first", "tex_material_second"]);

    const anonymous = addRequest(undefined, addIntent("draw_anon"), { dryRun: true });
    expect(resolveOperationId(anonymous)).toBe(`op_add_drawable_from_image_anon_r0_${fixture.image.descriptor.rgbaSha256.slice(0, 16)}`);
    expect(createMaterialImageIdSeed(resolveOperationId(anonymous))).toBe(`material_add_drawable_from_image_anon_r0_${fixture.image.descriptor.rgbaSha256.slice(0, 16)}`);
  });

  it("replaces the image keeping the drawable ID and deletes only the declared direct geometry keyforms", () => {
    const core = createOperationCore();
    const session = createKeyedSession(core);
    const before = structuredClone(session.graph.drawables.find((item) => item.drawableId === "draw_a")!);
    const wide = createMaterialImageFixture("wide");
    const request = replaceRequest("op_replace_a", "draw_a", ["keyset_geometry", "keyset_drawGeometry"],
      { dryRun: true, basePackageRevision: session.packageRevision, image: wide.image });
    registerFor(session, request, wide.image);
    const snapshot = structuredClone(session);

    const dryRun = core.dryRunOperation(session, request);
    expect(dryRun.status, JSON.stringify(dryRun.diagnostics)).toBe("dry_run");
    expect(session).toEqual(snapshot);
    expect(dryRun.modelDiff?.removed).toEqual([{ kind: "keyformSet", id: "keyset_geometry" }, { kind: "keyformSet", id: "keyset_drawGeometry" }]);

    const commit = core.commitOperation(session, { ...request, dryRun: false });
    expect(commit.result.status, JSON.stringify(commit.result.diagnostics)).toBe("committed");
    const after = session.graph.drawables.find((item) => item.drawableId === "draw_a")!;
    expect(after).toMatchObject({ drawableId: "draw_a", meshId: before.meshId, partId: before.partId, displayName: before.displayName,
      textureId: "tex_material_replace_a", sourceAssetId: "src_material_replace_a" });
    expect(session.graph.keyformSets.map((key) => key.keyformSetId)).toEqual(["keyset_opacity", "keyset_control", "keyset_other"]);
    expect(session.graph.textureAtlas!.textures.find((item) => item.textureId === "tex_material_replace_a")?.dimensions)
      .toEqual({ width: 10, height: 8, pixelFormat: "rgba8" });
    expect(session.graph.drawables.filter((item) => item.drawableId !== "draw_a"))
      .toEqual(snapshot.graph.drawables.filter((item) => item.drawableId !== "draw_a"));
  });

  it("rejects resetting a shared keyform or a shared mesh without changing the session", () => {
    const cases: Array<[string, (graph: Graph) => string[], string]> = [
      ["shared keyform", (graph) => {
        graph.rigControls[0]!.childDrawableIds.push("draw_b" as never);
        return ["keyset_geometry", "keyset_drawGeometry", "keyset_control"];
      }, "operation.replaceDrawableImage.sharedKeyformReset"],
      ["other drawable keyform", () => ["keyset_geometry", "keyset_drawGeometry", "keyset_other"], "operation.replaceDrawableImage.sharedKeyformReset"],
      ["undeclared direct keyform", () => ["keyset_geometry"], "operation.replaceDrawableImage.geometryResetMismatch"],
      ["shared mesh", (graph) => {
        const meshA = graph.drawables.find((item) => item.drawableId === "draw_a")!.meshId;
        graph.drawables.find((item) => item.drawableId === "draw_b")!.meshId = meshA;
        graph.keyformSets = graph.keyformSets.filter((key) => key.keyformSetId !== "keyset_geometry");
        return ["keyset_drawGeometry"];
      }, "operation.replaceDrawableImage.sharedMeshReset"]
    ];

    for (const [name, prepare, checkId] of cases) {
      const core = createOperationCore();
      const session = createKeyedSession(core);
      const ids = prepare(session.graph);
      const request = replaceRequest("op_replace_a", "draw_a", ids, { dryRun: false, basePackageRevision: session.packageRevision });
      registerFor(session, request);
      const snapshot = structuredClone(session);
      const logLength = core.operationLog.entries.length;
      const commit = core.commitOperation(session, request);
      expect(commit.result.status, name).toBe("rejected");
      expect(commit.result.diagnostics.map((item) => item.checkId), name).toEqual([checkId]);
      expect(session, name).toEqual(snapshot);
      expect(core.operationLog.entries.length, name).toBe(logLength);
    }
  });

  it("rejects locked targets, including the insertion sibling and the replaced mesh and texture", () => {
    const addCore = createOperationCore();
    const rigged = createRiggedSession(addCore);
    const sibling = addIntent("draw_x", { insertion: { position: "after", sibling: { kind: "drawable", drawableId: "draw_a" } } });
    for (const locked of ["part_root", "draw_a"]) {
      const request = addRequest("op_locked", sibling, { dryRun: false, basePackageRevision: rigged.packageRevision, lockedTargetIds: [locked] });
      registerFor(rigged, request);
      const result = addCore.commitOperation(rigged, request).result;
      expect(result.diagnostics.map((item) => item.checkId), locked).toEqual(["operation.addDrawableFromImage.lockedTarget"]);
      expect(result.diagnostics[0]!.target.id, locked).toBe(locked);
    }

    const replaceCore = createOperationCore();
    const session = createKeyedSession(replaceCore);
    const target = session.graph.drawables.find((item) => item.drawableId === "draw_a")!;
    for (const locked of [target.meshId, target.textureId]) {
      const request = replaceRequest("op_locked_replace", "draw_a", ["keyset_geometry", "keyset_drawGeometry"],
        { dryRun: false, basePackageRevision: session.packageRevision, lockedTargetIds: [locked] });
      registerFor(session, request);
      const result = replaceCore.commitOperation(session, request).result;
      expect(result.diagnostics.map((item) => item.checkId), locked).toEqual(["operation.replaceDrawableImage.lockedTarget"]);
      expect(result.diagnostics[0]!.target.id, locked).toBe(locked);
    }
  });

  it("rejects fully transparent registered bytes without logging", () => {
    const core = createOperationCore();
    const session = createEmptySession();
    const request = addRequest("op_transparent", addIntent("draw_x"), { dryRun: false });
    registerMaterialImageBytes(session, { idSeed: createMaterialImageIdSeed(resolveOperationId(request)),
      image: fixture.image.descriptor, rgbaBytes: new Uint8Array(fixture.image.rgbaBytes.length) });
    const snapshot = structuredClone(session);
    const result = core.commitOperation(session, request).result;
    expect(result.diagnostics.map((item) => item.checkId)).toEqual(["operation.addDrawableFromImage.imageTransparent"]);
    expect(session).toEqual(snapshot);
    expect(core.operationLog.entries).toEqual([]);
  });

  it("rejects re-running the same operation ID as an ID collision without logging", () => {
    const core = createOperationCore();
    const session = createEmptySession();
    const first = addRequest("op_reused", addIntent("draw_one"), { dryRun: false });
    registerFor(session, first);
    expect(core.commitOperation(session, first).result.status).toBe("committed");

    // An explicit operation ID does not depend on the revision: reusing it later collides.
    const reused = addRequest("op_reused", addIntent("draw_two"), { dryRun: false, basePackageRevision: session.packageRevision });
    registerFor(session, reused);
    const snapshot = structuredClone(session);
    const reusedResult = core.commitOperation(session, reused).result;
    expect(reusedResult.diagnostics.map((item) => item.checkId)).toEqual(["operation.addDrawableFromImage.idCollision"]);
    expect(session).toEqual(snapshot);
    expect(core.operationLog.entries).toHaveLength(1);

    // A derived operation ID repeats only for the same base revision, drawable and image.
    const anonymous = addRequest(undefined, addIntent("draw_three"), { dryRun: false, basePackageRevision: session.packageRevision });
    registerFor(session, anonymous);
    expect(core.commitOperation(session, anonymous).result.status).toBe("committed");
    session.packageRevision = anonymous.basePackageRevision;
    const repeatedSnapshot = structuredClone(session);
    const repeated = core.commitOperation(session, anonymous).result;
    expect(repeated.diagnostics.map((item) => item.checkId)).toEqual(["operation.addDrawableFromImage.idCollision"]);
    expect(session).toEqual(repeatedSnapshot);
    expect(core.operationLog.entries).toHaveLength(2);
  });

  it("replaces A -> B -> A on one drawable with derived operation IDs", () => {
    const core = createOperationCore();
    const session = createRiggedSession(core);
    const compact = createMaterialImageFixture().image;
    const wide = createMaterialImageFixture("wide").image;
    for (const image of [compact, wide, compact]) {
      const request = replaceRequest(undefined, "draw_a", [], { dryRun: false, basePackageRevision: session.packageRevision,
        ...(image === wide ? { image } : {}) });
      registerFor(session, request, image);
      const commit = core.commitOperation(session, request);
      expect(commit.result.status, JSON.stringify(commit.result.diagnostics)).toBe("committed");
      expect(session.graph.drawables.find((item) => item.drawableId === "draw_a")!.textureId)
        .toBe(`tex_material_replace_drawable_image_a_r${request.basePackageRevision}_${image.descriptor.rgbaSha256.slice(0, 16)}`);
    }
    expect(core.operationLog.entries).toHaveLength(5);
  });
});

interface RequestOptions {
  readonly dryRun: boolean;
  readonly basePackageRevision?: number;
  readonly rgbaSha256?: string;
  readonly contentInset?: { left: number; top: number; right: number; bottom: number };
  readonly lockedTargetIds?: readonly string[];
  readonly image?: MaterialNormalizedImage;
}

const addIntent = (drawableId: string, overrides: Record<string, unknown> = {}) => ({
  kind: "add", drawableId, displayName: drawableId, parentPartId: "part_root", insertion: { position: "last" },
  rigControlIds: [], maskBindings: [], runtimeVisibility: true, defaultOpacity: 1, ...overrides
});

const requestBase = (operationId: string | undefined, options: RequestOptions) => ({
  schemaVersion: "operation-request-v1",
  ...(operationId === undefined ? {} : { operationId }),
  actor: "test",
  surface: "testFixture",
  dryRun: options.dryRun,
  basePackageRevision: options.basePackageRevision ?? 0
});

const imagePayload = (options: RequestOptions) => {
  const descriptor = (options.image ?? fixture.image).descriptor;
  return {
    image: { imagePath: IMAGE_PATH, rgbaSha256: options.rgbaSha256 ?? descriptor.rgbaSha256, width: descriptor.width, height: descriptor.height,
      ...(options.contentInset === undefined ? {} : { contentInset: options.contentInset }) },
    placement: options.image === undefined ? fixture.placement : { ...createMaterialImageFixture("wide").placement, scale: 2 },
    provenanceNote: "Synthetic shadow.",
    ...(options.lockedTargetIds === undefined ? {} : { lockedTargetIds: options.lockedTargetIds })
  };
};

const addRequest = (operationId: string | undefined, intent: Record<string, unknown>, options: RequestOptions): OperationRequestDto =>
  OperationRequestSchema.parse({ ...requestBase(operationId, options), operationType: "addDrawableFromImage",
    payload: { ...imagePayload(options), intent } });

const replaceRequest = (operationId: string | undefined, drawableId: string, keyformSetIds: readonly string[], options: RequestOptions): OperationRequestDto =>
  OperationRequestSchema.parse({ ...requestBase(operationId, options), operationType: "replaceDrawableImage",
    payload: { ...imagePayload(options), intent: { kind: "replace", drawableId, preserveLogicalDrawableId: true,
      geometryReset: { scope: "target-direct-geometry-keyforms", keyformSetIds }, preserveExistingDeformers: true,
      sharedControlPolicy: "reject-shared-control-key-parameter-deletion" } } });

/** What a host does before dry-run/commit: register the normalized bytes for the request's ID seed. */
const registerFor = (session: AuthoringSession, request: OperationRequestDto, image: MaterialNormalizedImage = fixture.image): void => {
  registerMaterialImageBytes(session, { idSeed: createMaterialImageIdSeed(resolveOperationId(request)),
    image: image.descriptor, rgbaBytes: image.rgbaBytes });
};

const createEmptySession = (): AuthoringSession => ({
  packageIdentity: { packageId: PackageIdSchema.parse("pkg_material_image_operation_test"), packageDisplayName: "Material image test",
    formatVersion: "open-model-package-v1" },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 100, height: 100 },
    parts: [{ partId: PartIdSchema.parse("part_root"), displayName: "Root", childPartIds: [], drawableIds: [] }],
    drawables: [], meshes: [], parameters: [], keyformSets: [], rigControls: [], dynamicsGroups: [], masks: [], drawOrder: [],
    rigControlRootIds: [], stableOrder: [], sourceAssets: [], provenanceRecords: [], rightsRecords: [], variantGroups: []
  }
});

/** draw_a and draw_b added through the operation, rig_parent binding draw_a, mask draw_a -> draw_b. */
const createRiggedSession = (core: ReturnType<typeof createOperationCore>): AuthoringSession => {
  const session = createEmptySession();
  for (const drawableId of ["draw_a", "draw_b"]) {
    const request = addRequest(`op_${drawableId}`, addIntent(drawableId), { dryRun: false, basePackageRevision: session.packageRevision });
    registerFor(session, request);
    const commit = core.commitOperation(session, request);
    if (commit.result.status !== "committed") throw new Error(JSON.stringify(commit.result.diagnostics));
  }
  session.graph.rigControls.push(rotationControl("rig_parent", ["draw_a"]));
  session.graph.rigControlRootIds.push("rig_parent" as never);
  session.graph.masks.push({ maskRelationId: "maskrel_test", maskDrawableIds: ["draw_a"], targetDrawableIds: ["draw_b"], enabled: true } as never);
  return session;
};

const createKeyedSession = (core: ReturnType<typeof createOperationCore>): AuthoringSession => {
  const session = createRiggedSession(core);
  const meshA = session.graph.drawables.find((item) => item.drawableId === "draw_a")!.meshId;
  session.graph.parameters.push({ parameterId: "param_x", displayName: "param_x", min: -1, max: 1, default: 0, recommendedUiStep: 0.1 } as never);
  session.graph.keyformSets.push(keyform("keyset_geometry", "mesh", meshA), keyform("keyset_drawGeometry", "drawable", "draw_a"),
    keyform("keyset_opacity", "drawable", "draw_a", "opacity"), keyform("keyset_control", "rigControl", "rig_parent", "angleDegrees"),
    keyform("keyset_other", "drawable", "draw_b"));
  return session;
};

const rotationControl = (rigControlId: string, childDrawableIds: string[]): Graph["rigControls"][number] => ({
  kind: "rotation2d", rigControlId, displayName: rigControlId, childDrawableIds, childRigControlIds: [], pivot: { x: 0, y: 0 },
  restAngleDegrees: 0, restTranslation: { x: 0, y: 0 }, restScale: { x: 1, y: 1 }, enabled: true
}) as never;

const keyform = (keyformSetId: string, kind: string, id: string, property = "vertices"): Graph["keyformSets"][number] => ({
  keyformSetId, target: { kind, id, property }, parameterId: "param_x", evaluator: "linear-1d-v1", interpolation: "linear-1d-v1",
  compositionMode: "replace", compositionOrder: 0, keys: [{ value: 0, statePatch: property === "vertices" ? [{ x: 0, y: 0 }] : 0 }]
}) as never;
