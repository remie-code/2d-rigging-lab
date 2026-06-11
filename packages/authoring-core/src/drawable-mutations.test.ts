import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  type ProvenanceId,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createInitialAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { AuthoringMutationError } from "./authoring-mutations.js";
import { createDrawableWithMesh, updateDrawable } from "./drawable-mutations.js";
import { createGeneratedMesh, createManualEmptyMesh } from "./mesh-generation.js";
import { replaceDrawableMesh } from "./mesh-mutations.js";

describe("drawable and mesh authoring mutations", () => {
  it("creates a runtime-safe drawable with placeholder mesh, draw order, stable order, and source mapping", () => {
    const session = createFixtureSession();
    const drawable = createFixtureDrawable();
    const mesh = createManualEmptyMesh({
      meshId: drawable.meshId,
      drawableId: drawable.drawableId,
      bounds: { x: 4, y: 8, width: 40, height: 20 },
      provenanceId: drawable.sourceProvenanceId
    });

    const result = createDrawableWithMesh(session, {
      drawable,
      mesh,
      sourceLayerId: "layer_body",
      sourceProvenanceRecord: createFixtureProvenanceRecord(drawable.sourceProvenanceId)
    });

    expect(result.drawable).toEqual(drawable);
    expect(result.mesh).toEqual(mesh);
    expect(session.graph.drawables).toEqual([drawable]);
    expect(session.graph.meshes).toEqual([mesh]);
    expect(session.graph.parts[0]?.drawableIds).toEqual(["draw_body"]);
    expect(session.graph.sourceAssets[0]?.layers[0]?.mappedDrawableIds).toEqual(["draw_body"]);
    expect(session.graph.drawOrder).toEqual([
      {
        drawableId: "draw_body",
        baseDrawOrder: 0,
        stableOrder: 0
      }
    ]);
    expect(session.graph.stableOrder).toEqual(["draw_body"]);
    expect(session.graph.provenanceRecords).toHaveLength(1);
    expect(session.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);
  });

  it("rejects duplicate drawable ids before mutating graph order", () => {
    const session = createFixtureSession();
    const drawable = createFixtureDrawable();
    const mesh = createManualEmptyMesh({
      meshId: drawable.meshId,
      drawableId: drawable.drawableId,
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      provenanceId: drawable.sourceProvenanceId
    });
    createDrawableWithMesh(session, { drawable, mesh });
    const revisionAfterFirstCreate = session.authoringRevision;

    expect(() => createDrawableWithMesh(session, { drawable, mesh })).toThrow(
      expect.objectContaining({
        code: "duplicate_drawable"
      }) as AuthoringMutationError
    );
    expect(session.graph.drawOrder).toHaveLength(1);
    expect(session.authoringRevision).toBe(revisionAfterFirstCreate);
  });

  it("updates drawable display name and default opacity", () => {
    const session = createFixtureSession();
    const drawable = createFixtureDrawable();
    const mesh = createManualEmptyMesh({
      meshId: drawable.meshId,
      drawableId: drawable.drawableId,
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      provenanceId: drawable.sourceProvenanceId
    });
    createDrawableWithMesh(session, { drawable, mesh });

    const result = updateDrawable(session, {
      drawableId: drawable.drawableId,
      displayName: "Body Paint",
      defaultOpacity: 0.5
    });

    expect(result.drawableBefore).toMatchObject({
      displayName: "Body",
      defaultOpacity: 1
    });
    expect(result.drawableAfter).toMatchObject({
      displayName: "Body Paint",
      defaultOpacity: 0.5
    });
    expect(session.graph.drawables[0]).toMatchObject({
      displayName: "Body Paint",
      defaultOpacity: 0.5
    });
    expect(session.authoringRevision).toBe(2);
    expect(session.dirty).toBe(true);
  });

  it("rejects missing, invalid, and no-op drawable updates", () => {
    const session = createFixtureSession();
    const drawable = createFixtureDrawable();
    const mesh = createManualEmptyMesh({
      meshId: drawable.meshId,
      drawableId: drawable.drawableId,
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      provenanceId: drawable.sourceProvenanceId
    });
    createDrawableWithMesh(session, { drawable, mesh });
    const revisionAfterCreate = session.authoringRevision;

    expect(() =>
      updateDrawable(session, {
        drawableId: DrawableIdSchema.parse("draw_missing"),
        displayName: "Missing"
      })
    ).toThrow(expect.objectContaining({ code: "missing_drawable" }) as AuthoringMutationError);

    expect(() =>
      updateDrawable(session, {
        drawableId: drawable.drawableId,
        displayName: "   "
      })
    ).toThrow(
      expect.objectContaining({ code: "invalid_drawable_display_name" }) as AuthoringMutationError
    );

    expect(() =>
      updateDrawable(session, {
        drawableId: drawable.drawableId,
        defaultOpacity: 1.2
      })
    ).toThrow(
      expect.objectContaining({ code: "invalid_drawable_opacity" }) as AuthoringMutationError
    );

    expect(() =>
      updateDrawable(session, {
        drawableId: drawable.drawableId,
        displayName: drawable.displayName,
        defaultOpacity: drawable.defaultOpacity
      })
    ).toThrow(
      expect.objectContaining({ code: "no_op_drawable_update" }) as AuthoringMutationError
    );
    expect(session.authoringRevision).toBe(revisionAfterCreate);
  });

  it("replaces the drawable mesh with deterministic grid geometry", () => {
    const session = createFixtureSession();
    const drawable = createFixtureDrawable();
    const placeholder = createManualEmptyMesh({
      meshId: drawable.meshId,
      drawableId: drawable.drawableId,
      bounds: { x: 10, y: 20, width: 30, height: 40 },
      provenanceId: drawable.sourceProvenanceId
    });
    createDrawableWithMesh(session, { drawable, mesh: placeholder });
    const generated = createGeneratedMesh({
      meshId: drawable.meshId,
      drawableId: drawable.drawableId,
      bounds: placeholder.bounds,
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body_mesh"),
      method: "auto-grid-v1",
      densityHint: "medium"
    });

    const result = replaceDrawableMesh(session, generated);

    expect(result.mesh.vertices).toHaveLength(9);
    expect(result.mesh.triangles).toHaveLength(8);
    expect(result.mesh.vertices[0]).toEqual({ x: 10, y: 20 });
    expect(result.mesh.vertices[8]).toEqual({ x: 40, y: 60 });
    expect(result.mesh.vertexStableIds).toEqual([
      "vtx_body_0_0",
      "vtx_body_0_1",
      "vtx_body_0_2",
      "vtx_body_1_0",
      "vtx_body_1_1",
      "vtx_body_1_2",
      "vtx_body_2_0",
      "vtx_body_2_1",
      "vtx_body_2_2"
    ]);
    expect(session.graph.meshes).toEqual([generated]);
    expect(session.authoringRevision).toBe(2);
  });

  it("rejects mesh replacement when the drawable references a missing mesh", () => {
    const session = createFixtureSession();
    const drawable = createFixtureDrawable();
    session.graph.drawables.push(drawable);

    expect(() =>
      replaceDrawableMesh(
        session,
        createManualEmptyMesh({
          meshId: drawable.meshId,
          drawableId: drawable.drawableId,
          bounds: { x: 0, y: 0, width: 1, height: 1 },
          provenanceId: drawable.sourceProvenanceId
        })
      )
    ).toThrow(
      expect.objectContaining({
        code: "missing_mesh"
      }) as AuthoringMutationError
    );
    expect(session.authoringRevision).toBe(0);
  });
});

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_drawable_mutation_test"),
    packageDisplayName: "Drawable Mutation Test",
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
        drawableIds: []
      }
    ],
    drawables: [],
    meshes: [],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [],
    rigControlRootIds: [],
    stableOrder: [],
    sourceAssets: [
      {
        sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
        kind: "generated-fixture-v1",
        filePath: "assets/sources/generated/body.json",
        contentHash: "sha256:body",
        importProfile: "split-png-fallback-v1",
        layers: [
          {
            sourceLayerId: "layer_body",
            sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
            originalName: "Body",
            normalizedName: "body",
            groupPath: ["Root"],
            bounds: { x: 4, y: 8, width: 40, height: 20 },
            visibleInSource: true,
            opacityInSource: 1,
            role: "editableLayer",
            unsupportedFeatures: [],
            mappedDrawableIds: []
          }
        ],
        diagnostics: []
      }
    ],
    provenanceRecords: [],
    rightsRecords: []
  }
});

const createFixtureDrawable = () => ({
  drawableId: DrawableIdSchema.parse("draw_body"),
  displayName: "Body",
  partId: PartIdSchema.parse("part_root"),
  sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
  textureId: TextureIdSchema.parse("tex_body"),
  meshId: MeshIdSchema.parse("mesh_body"),
  defaultOpacity: 1,
  runtimeVisibility: true,
  baseDrawOrder: 0,
  sourceProvenanceId: ProvenanceIdSchema.parse("prov_create_body")
});

const createFixtureProvenanceRecord = (provenanceId: ProvenanceId) => ({
  provenanceId,
  assetId: "src_generated",
  assetKind: "generatedFixture" as const,
  filePath: "assets/sources/generated/body.json",
  contentHash: "sha256:body",
  creator: "test",
  license: "internal-test",
  redistributionAllowed: false,
  aiUsed: false,
  transformHistory: [],
  relatedOperationIds: []
});
