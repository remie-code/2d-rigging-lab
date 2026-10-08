import {
  DrawableIdSchema,
  MaskRelationIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { PackageModelFilesDto } from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { createInitialAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { buildPackageDocumentModelFiles } from "./package-document-model-files.js";
import { setMaskRelation } from "./mask-relation-mutations.js";
import { toRuntimeGraph } from "./to-runtime-graph.js";

describe("mask relation authoring mutations", () => {
  it("creates enabled mask relations and materializes them into package model files", () => {
    const session = createFixtureSession();
    const relationId = MaskRelationIdSchema.parse("maskrel_body_clip");

    const result = setMaskRelation(session, {
      maskRelationId: relationId,
      maskDrawableIds: [DrawableIdSchema.parse("draw_mask")],
      targetDrawableIds: [DrawableIdSchema.parse("draw_body")],
      enabled: true
    });

    expect(result.created).toBe(true);
    expect(result.relationAfter).toEqual({
      maskRelationId: "maskrel_body_clip",
      maskDrawableIds: ["draw_mask"],
      targetDrawableIds: ["draw_body"],
      enabled: true
    });
    expect(session.graph.masks).toEqual([result.relationAfter]);
    expect(session.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);
    expect(toRuntimeGraph(session).masks).toEqual([
      {
        maskRelationId: "maskrel_body_clip",
        sourceDrawableIds: ["draw_mask"],
        targetDrawableIds: ["draw_body"]
      }
    ]);

    const modelFiles = buildPackageDocumentModelFiles(session, createBaseModelFiles());
    expect(modelFiles.masks).toEqual({
      schemaVersion: "masks-file-v1",
      masks: [result.relationAfter]
    });
  });

  it("updates existing relations, preserves maskGroupHint, and omits disabled relations from runtime graph", () => {
    const session = createFixtureSession();
    session.graph.masks.push({
      maskRelationId: MaskRelationIdSchema.parse("maskrel_body_clip"),
      maskDrawableIds: [DrawableIdSchema.parse("draw_mask")],
      targetDrawableIds: [DrawableIdSchema.parse("draw_body")],
      maskGroupHint: "body-group",
      enabled: true
    });

    const result = setMaskRelation(session, {
      maskRelationId: MaskRelationIdSchema.parse("maskrel_body_clip"),
      maskDrawableIds: [DrawableIdSchema.parse("draw_mask")],
      targetDrawableIds: [DrawableIdSchema.parse("draw_body")],
      enabled: false
    });

    expect(result.created).toBe(false);
    expect(result.relationBefore).toMatchObject({ enabled: true, maskGroupHint: "body-group" });
    expect(result.relationAfter).toEqual({
      maskRelationId: "maskrel_body_clip",
      maskDrawableIds: ["draw_mask"],
      targetDrawableIds: ["draw_body"],
      maskGroupHint: "body-group",
      enabled: false
    });
    expect(toRuntimeGraph(session).masks).toEqual([]);
    expect(session.authoringRevision).toBe(1);
  });

  it("rejects empty, duplicate, missing, self-mask, and no-op relations without mutation", () => {
    const emptySession = createFixtureSession();
    expect(() =>
      setMaskRelation(emptySession, {
        maskRelationId: MaskRelationIdSchema.parse("maskrel_empty"),
        maskDrawableIds: [],
        targetDrawableIds: [DrawableIdSchema.parse("draw_body")],
        enabled: true
      })
    ).toThrow(expect.objectContaining({ code: "empty_mask_relation" }) as AuthoringMutationError);
    expect(emptySession.authoringRevision).toBe(0);

    const duplicateSession = createFixtureSession();
    expect(() =>
      setMaskRelation(duplicateSession, {
        maskRelationId: MaskRelationIdSchema.parse("maskrel_duplicate"),
        maskDrawableIds: [DrawableIdSchema.parse("draw_mask"), DrawableIdSchema.parse("draw_mask")],
        targetDrawableIds: [DrawableIdSchema.parse("draw_body")],
        enabled: true
      })
    ).toThrow(expect.objectContaining({ code: "duplicate_mask_drawable" }) as AuthoringMutationError);
    expect(duplicateSession.graph.masks).toEqual([]);

    const missingSession = createFixtureSession();
    expect(() =>
      setMaskRelation(missingSession, {
        maskRelationId: MaskRelationIdSchema.parse("maskrel_missing"),
        maskDrawableIds: [DrawableIdSchema.parse("draw_missing")],
        targetDrawableIds: [DrawableIdSchema.parse("draw_body")],
        enabled: true
      })
    ).toThrow(expect.objectContaining({ code: "missing_mask_drawable" }) as AuthoringMutationError);
    expect(missingSession.graph.masks).toEqual([]);

    const selfMaskSession = createFixtureSession();
    expect(() =>
      setMaskRelation(selfMaskSession, {
        maskRelationId: MaskRelationIdSchema.parse("maskrel_self"),
        maskDrawableIds: [DrawableIdSchema.parse("draw_body")],
        targetDrawableIds: [DrawableIdSchema.parse("draw_body")],
        enabled: true
      })
    ).toThrow(expect.objectContaining({ code: "self_mask_relation" }) as AuthoringMutationError);
    expect(selfMaskSession.graph.masks).toEqual([]);

    const noOpSession = createFixtureSession();
    noOpSession.graph.masks.push({
      maskRelationId: MaskRelationIdSchema.parse("maskrel_no_op"),
      maskDrawableIds: [DrawableIdSchema.parse("draw_mask")],
      targetDrawableIds: [DrawableIdSchema.parse("draw_body")],
      enabled: false
    });
    expect(() =>
      setMaskRelation(noOpSession, {
        maskRelationId: MaskRelationIdSchema.parse("maskrel_no_op"),
        maskDrawableIds: [DrawableIdSchema.parse("draw_mask")],
        targetDrawableIds: [DrawableIdSchema.parse("draw_body")],
        enabled: false
      })
    ).toThrow(expect.objectContaining({ code: "no_op_mask_relation_update" }) as AuthoringMutationError);
    expect(noOpSession.authoringRevision).toBe(0);
  });
});

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_mask_relation_mutation_test"),
    packageDisplayName: "Mask Relation Mutation Test",
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
        partId: PartIdSchema.parse("part_root"),
        displayName: "Root",
        childPartIds: [],
        drawableIds: [DrawableIdSchema.parse("draw_mask"), DrawableIdSchema.parse("draw_body")]
      }
    ],
    drawables: [
      createFixtureDrawable("draw_mask", "mesh_mask", "Mask", 0),
      createFixtureDrawable("draw_body", "mesh_body", "Body", 10)
    ],
    meshes: [
      createFixtureMesh("mesh_mask", "draw_mask"),
      createFixtureMesh("mesh_body", "draw_body")
    ],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [
      { drawableId: DrawableIdSchema.parse("draw_mask"), baseDrawOrder: 0, stableOrder: 0 },
      { drawableId: DrawableIdSchema.parse("draw_body"), baseDrawOrder: 10, stableOrder: 1 }
    ],
    rigControlRootIds: [],
    stableOrder: ["draw_mask", "draw_body"],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});

const createBaseModelFiles = (): PackageModelFilesDto => ({
  graph: {
    schemaVersion: "model-graph-v1",
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 128, height: 128 },
    parts: [],
    rigControlRootIds: [],
    stableOrder: []
  },
  drawables: { schemaVersion: "drawables-file-v1", drawables: [] },
  meshes: { schemaVersion: "meshes-file-v1", meshes: [] },
  parameters: { schemaVersion: "parameters-file-v1", parameters: [] },
  keyforms: { schemaVersion: "keyforms-file-v1", keyformSets: [] },
  rigControls: { schemaVersion: "rig-controls-file-v1", rigControls: [] },
  dynamics: { schemaVersion: "dynamics-file-v3", dynamicsGroups: [] },
  masks: { schemaVersion: "masks-file-v1", masks: [] },
  drawOrder: { schemaVersion: "draw-order-file-v1", entries: [] }
});

const createFixtureDrawable = (
  drawableId: string,
  meshId: string,
  displayName: string,
  baseDrawOrder: number
) => ({
  drawableId: DrawableIdSchema.parse(drawableId),
  displayName,
  partId: PartIdSchema.parse("part_root"),
  sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
  textureId: TextureIdSchema.parse(`tex_${drawableId.replace(/^draw_/, "")}`),
  meshId: MeshIdSchema.parse(meshId),
  defaultOpacity: 1,
  runtimeVisibility: true,
  baseDrawOrder,
  sourceProvenanceId: ProvenanceIdSchema.parse(`prov_${drawableId.replace(/^draw_/, "")}`)
});

const createFixtureMesh = (meshId: string, drawableId: string) => ({
  meshId: MeshIdSchema.parse(meshId),
  drawableId: DrawableIdSchema.parse(drawableId),
  vertices: [],
  uvs: [],
  triangles: [],
  vertexStableIds: [],
  bounds: { x: 0, y: 0, width: 16, height: 16 },
  generationProvenanceId: ProvenanceIdSchema.parse(`prov_${drawableId.replace(/^draw_/, "")}`)
});
