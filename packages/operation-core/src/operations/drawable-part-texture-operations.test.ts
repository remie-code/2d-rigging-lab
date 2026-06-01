import {
  createInitialAuthoringRevision,
  toPackageDocument
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { OperationId } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createOperationCore } from "../operation-core.js";
import { OperationRequestSchema } from "../operation-request.js";
import type { OperationRequestDto } from "../operation-request.js";
import { getOperationHandler } from "../operation-registry.js";
import { setDrawablePartOperationHandler } from "./set-drawable-part.js";
import { setDrawableTextureOperationHandler } from "./set-drawable-texture.js";

describe("drawable part and texture assignment operation handlers", () => {
  it("registers drawable assignment operations", () => {
    expect(getOperationHandler("setDrawablePart")).toBe(setDrawablePartOperationHandler);
    expect(getOperationHandler("setDrawableTexture")).toBe(setDrawableTextureOperationHandler);
  });

  it("dry-runs drawable part reassignment on a cloned candidate session", () => {
    const session = createFixtureSession();
    const request = createSetDrawablePartRequest({
      dryRun: true,
      drawableId: "draw_eye",
      partId: "part_face"
    });

    const outcome = setDrawablePartOperationHandler.dryRun(
      session,
      request,
      getRequestOperationId(request)
    );

    expect(outcome.result.status).toBe("dry_run");
    expect(outcome.candidateSession).not.toBe(session);
    expect(session.graph.drawables[0]?.partId).toBe("part_head");
    expect(outcome.candidateSession.graph.drawables[0]?.partId).toBe("part_face");
    expect(outcome.result.modelDiff?.changed.map((change) => change.target)).toEqual([
      { kind: "drawable", id: "draw_eye" },
      { kind: "part", id: "part_head" },
      { kind: "part", id: "part_face" }
    ]);
    expect(outcome.result.precondition.checkedTargetRefs).toEqual([
      { kind: "drawable", id: "draw_eye" },
      { kind: "part", id: "part_face" },
      { kind: "part", id: "part_head" }
    ]);
  });

  it("commits drawable texture assignment and materializes drawables plus texture atlas evidence", () => {
    const session = createFixtureSession();
    const core = createOperationCore({
      now: () => new Date("2026-06-01T00:00:00.000Z")
    });
    const baseDocument = createBaseDocument(session);

    const outcome = core.commitOperation(
      session,
      createSetDrawableTextureRequest({
        dryRun: false,
        drawableId: "draw_eye",
        textureId: "tex_eye_alt"
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(1);
    expect(outcome.logEntry?.targetIds).toEqual(["draw_eye", "tex_eye_alt"]);
    expect(outcome.logEntry?.precondition.checkedTargetRefs).toEqual([
      { kind: "drawable", id: "draw_eye" },
      { kind: "texture", id: "tex_eye_alt" }
    ]);
    expect(outcome.result.modelDiff?.changed[0]).toMatchObject({
      target: { kind: "drawable", id: "draw_eye" },
      fields: [
        {
          path: "/model/drawables/draw_eye/textureId",
          before: "tex_eye",
          after: "tex_eye_alt"
        }
      ]
    });

    const materialized = toPackageDocument(session, baseDocument);
    expect(materialized.model.drawables.drawables[0]?.textureId).toBe("tex_eye_alt");
    expect(materialized.assets.textureAtlas?.textures.map((texture) => texture.textureId)).toEqual([
      "tex_eye",
      "tex_eye_alt"
    ]);
  });

  it("rejects invalid drawable, part, texture, and locked targets deterministically", () => {
    const session = createFixtureSession();

    const missingPartRequest = createSetDrawablePartRequest({
      dryRun: false,
      drawableId: "draw_eye",
      partId: "part_missing"
    });
    const missingPart = setDrawablePartOperationHandler.commit(
      session,
      missingPartRequest,
      getRequestOperationId(missingPartRequest)
    );
    expect(missingPart.result.diagnostics[0]).toMatchObject({
      checkId: "operation.setDrawablePart.missingPart",
      target: { kind: "part", id: "part_missing" }
    });

    const missingDrawableRequest = createSetDrawableTextureRequest({
      dryRun: false,
      drawableId: "draw_missing",
      textureId: "tex_eye_alt"
    });
    const missingDrawable = setDrawableTextureOperationHandler.commit(
      session,
      missingDrawableRequest,
      getRequestOperationId(missingDrawableRequest)
    );
    expect(missingDrawable.result.diagnostics[0]).toMatchObject({
      checkId: "operation.setDrawableTexture.missingDrawable",
      target: { kind: "drawable", id: "draw_missing" }
    });

    const missingTextureRequest = createSetDrawableTextureRequest({
      dryRun: false,
      drawableId: "draw_eye",
      textureId: "tex_missing"
    });
    const missingTexture = setDrawableTextureOperationHandler.commit(
      session,
      missingTextureRequest,
      getRequestOperationId(missingTextureRequest)
    );
    expect(missingTexture.result.diagnostics[0]).toMatchObject({
      checkId: "operation.setDrawableTexture.missingTexture",
      target: { kind: "texture", id: "tex_missing" }
    });

    const lockedRequest = createSetDrawablePartRequest({
      dryRun: false,
      drawableId: "draw_eye",
      partId: "part_face",
      lockedTargetIds: ["draw_eye"]
    });
    const locked = setDrawablePartOperationHandler.commit(
      session,
      lockedRequest,
      getRequestOperationId(lockedRequest)
    );
    expect(locked.result.diagnostics[0]).toMatchObject({
      checkId: "operation.setDrawablePart.lockedTarget",
      target: { kind: "drawable", id: "draw_eye" }
    });
    expect(session.authoringRevision).toBe(0);
  });
});

const createSetDrawablePartRequest = (options: {
  readonly dryRun: boolean;
  readonly drawableId: string;
  readonly partId: string;
  readonly lockedTargetIds?: readonly string[];
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_set_drawable_part",
    actor: "test",
    surface: "testFixture",
    dryRun: options.dryRun,
    basePackageRevision: 0,
    operationType: "setDrawablePart",
    payload: {
      drawableId: options.drawableId,
      partId: options.partId,
      ...(options.lockedTargetIds === undefined ? {} : { lockedTargetIds: options.lockedTargetIds })
    }
  });

const createSetDrawableTextureRequest = (options: {
  readonly dryRun: boolean;
  readonly drawableId: string;
  readonly textureId: string;
  readonly lockedTargetIds?: readonly string[];
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_set_drawable_texture",
    actor: "test",
    surface: "testFixture",
    dryRun: options.dryRun,
    basePackageRevision: 0,
    operationType: "setDrawableTexture",
    payload: {
      drawableId: options.drawableId,
      textureId: options.textureId,
      ...(options.lockedTargetIds === undefined ? {} : { lockedTargetIds: options.lockedTargetIds })
    }
  });

const getRequestOperationId = (request: OperationRequestDto): OperationId => {
  if (request.operationId === undefined) {
    throw new Error("Test requests must include an operationId.");
  }

  return request.operationId;
};

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_drawable_assignment_operation_test"),
    packageDisplayName: "Drawable Assignment Operation Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 128, height: 128 },
    parts: [
      {
        partId: PartIdSchema.parse("part_head"),
        displayName: "Head",
        childPartIds: [],
        drawableIds: [DrawableIdSchema.parse("draw_eye")]
      },
      {
        partId: PartIdSchema.parse("part_face"),
        displayName: "Face",
        childPartIds: [],
        drawableIds: []
      }
    ],
    drawables: [createFixtureDrawable()],
    meshes: [createFixtureMesh()],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [{ drawableId: DrawableIdSchema.parse("draw_eye"), baseDrawOrder: 0, stableOrder: 0 }],
    rigControlRootIds: [],
    stableOrder: ["part_head", "part_face", "draw_eye"],
    sourceAssets: [],
    textureAtlas: {
      schemaVersion: "texture-atlas-v1",
      textures: [
        { textureId: TextureIdSchema.parse("tex_eye"), filePath: "assets/textures/eye.png" },
        { textureId: TextureIdSchema.parse("tex_eye_alt"), filePath: "assets/textures/eye-alt.png" }
      ]
    },
    provenanceRecords: [],
    rightsRecords: []
  }
});

const createFixtureDrawable = () => ({
  drawableId: DrawableIdSchema.parse("draw_eye"),
  displayName: "Eye",
  partId: PartIdSchema.parse("part_head"),
  sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
  textureId: TextureIdSchema.parse("tex_eye"),
  meshId: MeshIdSchema.parse("mesh_eye"),
  defaultOpacity: 1,
  runtimeVisibility: true,
  baseDrawOrder: 0,
  sourceProvenanceId: ProvenanceIdSchema.parse("prov_eye")
});

const createFixtureMesh = () => ({
  meshId: MeshIdSchema.parse("mesh_eye"),
  drawableId: DrawableIdSchema.parse("draw_eye"),
  vertices: [],
  uvs: [],
  triangles: [],
  vertexStableIds: [],
  bounds: { x: 0, y: 0, width: 16, height: 16 },
  generationProvenanceId: ProvenanceIdSchema.parse("prov_eye")
});

const createBaseDocument = (session: AuthoringSession): Parameters<typeof toPackageDocument>[1] =>
  ({
    manifest: {
      schemaVersion: "open-model-package-manifest-v1",
      packageId: session.packageIdentity.packageId,
      packageDisplayName: session.packageIdentity.packageDisplayName,
      formatVersion: session.packageIdentity.formatVersion,
      packageRevision: 0,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
      schemaVersions: { manifest: "open-model-package-manifest-v1" },
      evaluatorVersions: {},
      modelFiles: {
        graph: "model/graph.json",
        drawables: "model/drawables.json",
        meshes: "model/meshes.json",
        parameters: "model/parameters.json",
        keyforms: "model/keyforms.json",
        rigControls: "model/rig-controls.json",
        dynamics: "model/dynamics.json",
        masks: "model/masks.json",
        drawOrder: "model/draw-order.json"
      },
      assetIndex: "assets/sources/source-manifest.json",
      operationLog: "operations/log.jsonl",
      rightsSummary: { status: "cleared" },
      provenanceSummary: { sourceAssetCount: 0 },
      packageStableOrderVersion: "stable-order-v1"
    },
    model: {
      graph: {
        schemaVersion: "model-graph-v1",
        coordinateSystem: session.graph.coordinateSystem,
        canvasSize: session.graph.canvasSize,
        parts: session.graph.parts,
        rigControlRootIds: session.graph.rigControlRootIds,
        stableOrder: session.graph.stableOrder
      },
      drawables: { schemaVersion: "drawables-file-v1", drawables: session.graph.drawables },
      meshes: { schemaVersion: "meshes-file-v1", meshes: session.graph.meshes },
      parameters: { schemaVersion: "parameters-file-v1", parameters: session.graph.parameters },
      keyforms: { schemaVersion: "keyforms-file-v1", keyformSets: session.graph.keyformSets },
      rigControls: { schemaVersion: "rig-controls-file-v1", rigControls: session.graph.rigControls },
      dynamics: { schemaVersion: "dynamics-file-v1", dynamicsGroups: session.graph.dynamicsGroups },
      masks: { schemaVersion: "masks-file-v1", masks: session.graph.masks },
      drawOrder: { schemaVersion: "draw-order-file-v1", entries: session.graph.drawOrder }
    },
    assets: {
      sourceManifest: { schemaVersion: "source-manifest-v1", sourceAssets: [] },
      ...(session.graph.textureAtlas === undefined ? {} : { textureAtlas: session.graph.textureAtlas }),
      provenance: { schemaVersion: "provenance-file-v1", records: session.graph.provenanceRecords },
      rights: { schemaVersion: "rights-file-v1", records: session.graph.rightsRecords }
    }
  }) as Parameters<typeof toPackageDocument>[1];
