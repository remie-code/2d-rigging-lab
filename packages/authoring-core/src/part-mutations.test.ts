import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { createInitialAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { createPart, deletePart, updatePart } from "./part-mutations.js";

describe("part authoring mutations", () => {
  it("creates a part and links it to its parent", () => {
    const session = createFixtureSession();

    const result = createPart(session, {
      part: {
        partId: PartIdSchema.parse("part_face"),
        displayName: "Face",
        parentPartId: PartIdSchema.parse("part_head"),
        childPartIds: [],
        drawableIds: []
      }
    });

    expect(result.part).toMatchObject({
      partId: "part_face",
      parentPartId: "part_head"
    });
    expect(session.graph.parts.map((part) => part.partId)).toEqual([
      "part_root",
      "part_head",
      "part_face"
    ]);
    expect(session.graph.parts[1]?.childPartIds).toEqual(["part_face"]);
    expect(session.graph.stableOrder).toContain("part_face");
    expect(session.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);
  });

  it("updates a part display name and parent membership", () => {
    const session = createFixtureSession({
      parts: [
        {
          partId: PartIdSchema.parse("part_root"),
          displayName: "Root",
          childPartIds: [PartIdSchema.parse("part_head"), PartIdSchema.parse("part_face")],
          drawableIds: []
        },
        {
          partId: PartIdSchema.parse("part_head"),
          displayName: "Head",
          parentPartId: PartIdSchema.parse("part_root"),
          childPartIds: [],
          drawableIds: []
        },
        {
          partId: PartIdSchema.parse("part_face"),
          displayName: "Face",
          parentPartId: PartIdSchema.parse("part_root"),
          childPartIds: [],
          drawableIds: []
        }
      ]
    });

    const result = updatePart(session, {
      partId: PartIdSchema.parse("part_face"),
      displayName: "Face Controls",
      parentPartId: PartIdSchema.parse("part_head")
    });

    expect(result.partBefore).toMatchObject({
      displayName: "Face",
      parentPartId: "part_root"
    });
    expect(result.partAfter).toMatchObject({
      displayName: "Face Controls",
      parentPartId: "part_head"
    });
    expect(session.graph.parts[0]?.childPartIds).toEqual(["part_head"]);
    expect(session.graph.parts[1]?.childPartIds).toEqual(["part_face"]);
    expect(session.authoringRevision).toBe(1);
  });

  it("deletes an empty leaf part and unlinks it from its parent", () => {
    const session = createFixtureSession({
      parts: [
        {
          partId: PartIdSchema.parse("part_root"),
          displayName: "Root",
          childPartIds: [PartIdSchema.parse("part_head"), PartIdSchema.parse("part_empty")],
          drawableIds: []
        },
        {
          partId: PartIdSchema.parse("part_head"),
          displayName: "Head",
          parentPartId: PartIdSchema.parse("part_root"),
          childPartIds: [],
          drawableIds: []
        },
        {
          partId: PartIdSchema.parse("part_empty"),
          displayName: "Empty",
          parentPartId: PartIdSchema.parse("part_root"),
          childPartIds: [],
          drawableIds: []
        }
      ],
      stableOrder: ["part_root", "part_head", "part_empty", "draw_body"]
    });

    const result = deletePart(session, {
      partId: PartIdSchema.parse("part_empty")
    });

    expect(result.partBefore).toMatchObject({
      partId: "part_empty",
      parentPartId: "part_root"
    });
    expect(result.parentBefore?.childPartIds).toEqual(["part_head", "part_empty"]);
    expect(result.parentAfter?.childPartIds).toEqual(["part_head"]);
    expect(result.stableOrderBefore).toContain("part_empty");
    expect(result.stableOrderAfter).not.toContain("part_empty");
    expect(session.graph.parts.map((part) => part.partId)).toEqual(["part_root", "part_head"]);
    expect(session.graph.parts[0]?.childPartIds).toEqual(["part_head"]);
    expect(session.graph.stableOrder).toEqual(["part_root", "part_head", "draw_body"]);
    expect(session.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);
  });

  it("rejects missing parent, duplicate child, cycle, and no-op updates deterministically", () => {
    const session = createFixtureSession();

    expect(() =>
      createPart(session, {
        part: {
          partId: PartIdSchema.parse("part_missing_parent_child"),
          displayName: "Missing Parent Child",
          parentPartId: PartIdSchema.parse("part_missing"),
          childPartIds: [],
          drawableIds: []
        }
      })
    ).toThrow(expect.objectContaining({ code: "missing_parent_part" }) as AuthoringMutationError);

    session.graph.parts[1]?.childPartIds.push(PartIdSchema.parse("part_face"));
    expect(() =>
      createPart(session, {
        part: {
          partId: PartIdSchema.parse("part_face"),
          displayName: "Face",
          parentPartId: PartIdSchema.parse("part_head"),
          childPartIds: [],
          drawableIds: []
        }
      })
    ).toThrow(expect.objectContaining({ code: "duplicate_child_part" }) as AuthoringMutationError);

    session.graph.parts[1]!.childPartIds = [PartIdSchema.parse("part_eye")];
    session.graph.parts.push({
      partId: PartIdSchema.parse("part_eye"),
      displayName: "Eye",
      parentPartId: PartIdSchema.parse("part_head"),
      childPartIds: [],
      drawableIds: []
    });
    expect(() =>
      updatePart(session, {
        partId: PartIdSchema.parse("part_head"),
        parentPartId: PartIdSchema.parse("part_eye")
      })
    ).toThrow(expect.objectContaining({ code: "part_cycle" }) as AuthoringMutationError);

    expect(() =>
      updatePart(session, {
        partId: PartIdSchema.parse("part_head"),
        displayName: "Head"
      })
    ).toThrow(expect.objectContaining({ code: "no_op_part_update" }) as AuthoringMutationError);
    expect(session.authoringRevision).toBe(0);
  });

  it("rejects non-empty part deletes deterministically", () => {
    const childSession = createFixtureSession();
    expect(() =>
      deletePart(childSession, {
        partId: PartIdSchema.parse("part_root")
      })
    ).toThrow(expect.objectContaining({ code: "part_has_child_parts" }) as AuthoringMutationError);

    const drawableSession = createFixtureSession();
    expect(() =>
      deletePart(drawableSession, {
        partId: PartIdSchema.parse("part_head")
      })
    ).toThrow(expect.objectContaining({ code: "part_has_drawables" }) as AuthoringMutationError);

    const rigSession = createFixtureSession({
      parts: [
        {
          partId: PartIdSchema.parse("part_root"),
          displayName: "Root",
          childPartIds: [PartIdSchema.parse("part_head"), PartIdSchema.parse("part_empty")],
          drawableIds: []
        },
        {
          partId: PartIdSchema.parse("part_head"),
          displayName: "Head",
          parentPartId: PartIdSchema.parse("part_root"),
          childPartIds: [],
          drawableIds: []
        },
        {
          partId: PartIdSchema.parse("part_empty"),
          displayName: "Empty",
          parentPartId: PartIdSchema.parse("part_root"),
          childPartIds: [],
          drawableIds: []
        }
      ],
      stableOrder: ["part_root", "part_head", "part_empty", "draw_body"],
      rigControls: [
        {
          kind: "rotation2d",
          rigControlId: RigControlIdSchema.parse("rig_empty_rotation"),
          displayName: "Empty Rotation",
          partId: PartIdSchema.parse("part_empty"),
          childDrawableIds: [],
          childRigControlIds: [],
          pivot: { x: 0, y: 0 },
          restAngleDegrees: 0,
          restTranslation: { x: 0, y: 0 },
          restScale: { x: 1, y: 1 },
          enabled: true
        }
      ]
    });
    const rigDeleteResult = deletePart(rigSession, {
      partId: PartIdSchema.parse("part_empty")
    });
    expect(rigDeleteResult.partBefore.partId).toBe("part_empty");
    expect(rigSession.graph.parts.map((part) => part.partId)).toEqual(["part_root", "part_head"]);
    expect(rigSession.graph.rigControls).toHaveLength(1);
    expect(rigSession.graph.rigControls[0]).toHaveProperty("partId", "part_empty");

    expect(childSession.authoringRevision).toBe(0);
    expect(drawableSession.authoringRevision).toBe(0);
    expect(rigSession.authoringRevision).toBe(1);
  });
});

const createFixtureSession = (options: {
  readonly parts?: AuthoringSession["graph"]["parts"];
  readonly rigControls?: AuthoringSession["graph"]["rigControls"];
  readonly stableOrder?: AuthoringSession["graph"]["stableOrder"];
} = {}): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_part_mutation_test"),
    packageDisplayName: "Part Mutation Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 128, height: 128 },
    parts:
      options.parts ?? [
        {
          partId: PartIdSchema.parse("part_root"),
          displayName: "Root",
          childPartIds: [PartIdSchema.parse("part_head")],
          drawableIds: []
        },
        {
          partId: PartIdSchema.parse("part_head"),
          displayName: "Head",
          parentPartId: PartIdSchema.parse("part_root"),
          childPartIds: [],
          drawableIds: []
        }
      ],
    drawables: [createFixtureDrawable()],
    meshes: [createFixtureMesh()],
    parameters: [],
    keyformSets: [],
    rigControls: options.rigControls ?? [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [{ drawableId: DrawableIdSchema.parse("draw_body"), baseDrawOrder: 0, stableOrder: 0 }],
    rigControlRootIds: [],
    stableOrder: options.stableOrder ?? ["part_root", "part_head", "draw_body"],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});

const createFixtureDrawable = () => ({
  drawableId: DrawableIdSchema.parse("draw_body"),
  displayName: "Body",
  partId: PartIdSchema.parse("part_head"),
  sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
  textureId: TextureIdSchema.parse("tex_body"),
  meshId: MeshIdSchema.parse("mesh_body"),
  defaultOpacity: 1,
  runtimeVisibility: true,
  baseDrawOrder: 0,
  sourceProvenanceId: ProvenanceIdSchema.parse("prov_body")
});

const createFixtureMesh = () => ({
  meshId: MeshIdSchema.parse("mesh_body"),
  drawableId: DrawableIdSchema.parse("draw_body"),
  vertices: [],
  uvs: [],
  triangles: [],
  vertexStableIds: [],
  bounds: { x: 0, y: 0, width: 16, height: 16 },
  generationProvenanceId: ProvenanceIdSchema.parse("prov_body")
});
