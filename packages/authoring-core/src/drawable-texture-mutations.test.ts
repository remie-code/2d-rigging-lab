import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { createInitialAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { setDrawableTexture } from "./drawable-texture-mutations.js";
import { getTextureAtlasEntryById } from "./texture-asset-selectors.js";

describe("drawable texture authoring mutations", () => {
  it("assigns a drawable to an existing texture atlas entry", () => {
    const session = createFixtureSession();

    const result = setDrawableTexture(session, {
      drawableId: DrawableIdSchema.parse("draw_eye"),
      textureId: TextureIdSchema.parse("tex_eye_alt")
    });

    expect(result.drawableBefore.textureId).toBe("tex_eye");
    expect(result.drawableAfter.textureId).toBe("tex_eye_alt");
    expect(result.textureEntry.filePath).toBe("assets/textures/eye-alt.png");
    expect(session.graph.drawables[0]?.textureId).toBe("tex_eye_alt");
    expect(getTextureAtlasEntryById(session.graph, TextureIdSchema.parse("tex_eye_alt"))).toBeDefined();
    expect(session.authoringRevision).toBe(1);
  });

  it("rejects missing drawable, missing texture, and no-op assignments", () => {
    const session = createFixtureSession();

    expect(() =>
      setDrawableTexture(session, {
        drawableId: DrawableIdSchema.parse("draw_missing"),
        textureId: TextureIdSchema.parse("tex_eye_alt")
      })
    ).toThrow(expect.objectContaining({ code: "missing_drawable" }) as AuthoringMutationError);

    expect(() =>
      setDrawableTexture(session, {
        drawableId: DrawableIdSchema.parse("draw_eye"),
        textureId: TextureIdSchema.parse("tex_missing")
      })
    ).toThrow(expect.objectContaining({ code: "missing_texture" }) as AuthoringMutationError);

    expect(() =>
      setDrawableTexture(session, {
        drawableId: DrawableIdSchema.parse("draw_eye"),
        textureId: TextureIdSchema.parse("tex_eye")
      })
    ).toThrow(
      expect.objectContaining({ code: "no_op_drawable_texture_update" }) as AuthoringMutationError
    );
    expect(session.authoringRevision).toBe(0);
  });
});

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_drawable_texture_mutation_test"),
    packageDisplayName: "Drawable Texture Mutation Test",
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
    stableOrder: ["part_head", "draw_eye"],
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
