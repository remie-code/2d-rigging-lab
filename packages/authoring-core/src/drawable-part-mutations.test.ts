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
import { setDrawablePart } from "./drawable-part-mutations.js";

describe("drawable part authoring mutations", () => {
  it("reassigns a drawable and keeps part membership arrays coherent", () => {
    const session = createFixtureSession();

    const result = setDrawablePart(session, {
      drawableId: DrawableIdSchema.parse("draw_eye"),
      partId: PartIdSchema.parse("part_face")
    });

    expect(result.drawableBefore.partId).toBe("part_head");
    expect(result.drawableAfter.partId).toBe("part_face");
    expect(session.graph.drawables[0]?.partId).toBe("part_face");
    expect(session.graph.parts[0]?.drawableIds).toEqual([]);
    expect(session.graph.parts[1]?.drawableIds).toEqual(["draw_eye"]);
    expect(session.authoringRevision).toBe(1);
  });

  it("rejects missing targets and no-op part assignments", () => {
    const session = createFixtureSession();

    expect(() =>
      setDrawablePart(session, {
        drawableId: DrawableIdSchema.parse("draw_missing"),
        partId: PartIdSchema.parse("part_face")
      })
    ).toThrow(expect.objectContaining({ code: "missing_drawable" }) as AuthoringMutationError);

    expect(() =>
      setDrawablePart(session, {
        drawableId: DrawableIdSchema.parse("draw_eye"),
        partId: PartIdSchema.parse("part_missing")
      })
    ).toThrow(expect.objectContaining({ code: "missing_part" }) as AuthoringMutationError);

    expect(() =>
      setDrawablePart(session, {
        drawableId: DrawableIdSchema.parse("draw_eye"),
        partId: PartIdSchema.parse("part_head")
      })
    ).toThrow(
      expect.objectContaining({ code: "no_op_drawable_part_update" }) as AuthoringMutationError
    );
    expect(session.authoringRevision).toBe(0);
  });
});

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_drawable_part_mutation_test"),
    packageDisplayName: "Drawable Part Mutation Test",
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
