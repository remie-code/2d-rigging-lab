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
import { flattenDrawableIdsByPartOrder, getPartOrderedChildren } from "./part-children-order.js";
import { moveStructureChild } from "./structure-order-mutations.js";

const PART_ROOT = PartIdSchema.parse("part_root");
const PART_FACE = PartIdSchema.parse("part_face");
const PART_EYE = PartIdSchema.parse("part_eye");
const PART_MOUTH = PartIdSchema.parse("part_mouth");
const DRAW_FRONT = DrawableIdSchema.parse("draw_front");
const DRAW_BACK = DrawableIdSchema.parse("draw_back");
const DRAW_EYE = DrawableIdSchema.parse("draw_eye");
const DRAW_MOUTH = DrawableIdSchema.parse("draw_mouth");

describe("structure order mutations", () => {
  it("flattens mixed part and drawable children in tree order", () => {
    const session = createFixtureSession();

    expect(flattenDrawableIdsByPartOrder(session.graph)).toEqual([
      DRAW_FRONT,
      DRAW_EYE,
      DRAW_BACK,
      DRAW_MOUTH
    ]);
  });

  it("moves a drawable before a part container and syncs draw order mirrors", () => {
    const session = createFixtureSession();

    const result = moveStructureChild(session, {
      moved: { kind: "drawable", drawableId: DRAW_BACK },
      drop: { placement: "before", target: { kind: "part", partId: PART_EYE } }
    });

    const facePart = session.graph.parts.find((part) => part.partId === PART_FACE)!;
    expect(getPartOrderedChildren(session.graph, facePart)).toEqual([
      { kind: "drawable", drawableId: DRAW_FRONT },
      { kind: "drawable", drawableId: DRAW_BACK },
      { kind: "part", partId: PART_EYE },
      { kind: "part", partId: PART_MOUTH }
    ]);
    expect(facePart.drawableIds).toEqual([DRAW_FRONT, DRAW_BACK]);
    expect(result.drawableAfter).toMatchObject({
      drawableId: DRAW_BACK,
      partId: PART_FACE,
      baseDrawOrder: 1
    });
    expect(session.graph.drawOrder.map((entry) => [entry.drawableId, entry.baseDrawOrder])).toEqual([
      [DRAW_FRONT, 0],
      [DRAW_BACK, 1],
      [DRAW_EYE, 2],
      [DRAW_MOUTH, 3]
    ]);
    expect(session.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);
  });

  it("moves a part container after a drawable as a deterministic drawable block", () => {
    const session = createFixtureSession();

    moveStructureChild(session, {
      moved: { kind: "part", partId: PART_EYE },
      drop: { placement: "after", target: { kind: "drawable", drawableId: DRAW_BACK } }
    });

    const facePart = session.graph.parts.find((part) => part.partId === PART_FACE)!;
    expect(getPartOrderedChildren(session.graph, facePart)).toEqual([
      { kind: "drawable", drawableId: DRAW_FRONT },
      { kind: "drawable", drawableId: DRAW_BACK },
      { kind: "part", partId: PART_EYE },
      { kind: "part", partId: PART_MOUTH }
    ]);
    expect(flattenDrawableIdsByPartOrder(session.graph)).toEqual([
      DRAW_FRONT,
      DRAW_BACK,
      DRAW_EYE,
      DRAW_MOUTH
    ]);
  });

  it("moves a drawable inside a part container at the front of the destination block", () => {
    const session = createFixtureSession();

    moveStructureChild(session, {
      moved: { kind: "drawable", drawableId: DRAW_BACK },
      drop: { placement: "inside", parentPartId: PART_EYE }
    });

    const facePart = session.graph.parts.find((part) => part.partId === PART_FACE)!;
    const eyePart = session.graph.parts.find((part) => part.partId === PART_EYE)!;
    expect(getPartOrderedChildren(session.graph, facePart)).toEqual([
      { kind: "drawable", drawableId: DRAW_FRONT },
      { kind: "part", partId: PART_EYE },
      { kind: "part", partId: PART_MOUTH }
    ]);
    expect(getPartOrderedChildren(session.graph, eyePart)).toEqual([
      { kind: "drawable", drawableId: DRAW_BACK },
      { kind: "drawable", drawableId: DRAW_EYE }
    ]);
    expect(session.graph.drawables.find((drawable) => drawable.drawableId === DRAW_BACK)).toMatchObject({
      partId: PART_EYE,
      baseDrawOrder: 1
    });
  });

  it.each([
    {
      label: "Drawable before Drawable",
      moved: { kind: "drawable" as const, drawableId: DRAW_BACK },
      drop: { placement: "before" as const, target: { kind: "drawable" as const, drawableId: DRAW_FRONT } },
      expectedFaceChildren: [
        { kind: "drawable", drawableId: DRAW_BACK },
        { kind: "drawable", drawableId: DRAW_FRONT },
        { kind: "part", partId: PART_EYE },
        { kind: "part", partId: PART_MOUTH }
      ],
      expectedFlatten: [DRAW_BACK, DRAW_FRONT, DRAW_EYE, DRAW_MOUTH]
    },
    {
      label: "Drawable after Drawable",
      moved: { kind: "drawable" as const, drawableId: DRAW_FRONT },
      drop: { placement: "after" as const, target: { kind: "drawable" as const, drawableId: DRAW_BACK } },
      expectedFaceChildren: [
        { kind: "part", partId: PART_EYE },
        { kind: "drawable", drawableId: DRAW_BACK },
        { kind: "drawable", drawableId: DRAW_FRONT },
        { kind: "part", partId: PART_MOUTH }
      ],
      expectedFlatten: [DRAW_EYE, DRAW_BACK, DRAW_FRONT, DRAW_MOUTH]
    },
    {
      label: "Drawable before Part Container",
      moved: { kind: "drawable" as const, drawableId: DRAW_BACK },
      drop: { placement: "before" as const, target: { kind: "part" as const, partId: PART_EYE } },
      expectedFaceChildren: [
        { kind: "drawable", drawableId: DRAW_FRONT },
        { kind: "drawable", drawableId: DRAW_BACK },
        { kind: "part", partId: PART_EYE },
        { kind: "part", partId: PART_MOUTH }
      ],
      expectedFlatten: [DRAW_FRONT, DRAW_BACK, DRAW_EYE, DRAW_MOUTH]
    },
    {
      label: "Drawable after Part Container",
      moved: { kind: "drawable" as const, drawableId: DRAW_FRONT },
      drop: { placement: "after" as const, target: { kind: "part" as const, partId: PART_EYE } },
      expectedFaceChildren: [
        { kind: "part", partId: PART_EYE },
        { kind: "drawable", drawableId: DRAW_FRONT },
        { kind: "drawable", drawableId: DRAW_BACK },
        { kind: "part", partId: PART_MOUTH }
      ],
      expectedFlatten: [DRAW_EYE, DRAW_FRONT, DRAW_BACK, DRAW_MOUTH]
    },
    {
      label: "Drawable inside Part Container",
      moved: { kind: "drawable" as const, drawableId: DRAW_BACK },
      drop: { placement: "inside" as const, parentPartId: PART_EYE },
      expectedFaceChildren: [
        { kind: "drawable", drawableId: DRAW_FRONT },
        { kind: "part", partId: PART_EYE },
        { kind: "part", partId: PART_MOUTH }
      ],
      expectedEyeChildren: [
        { kind: "drawable", drawableId: DRAW_BACK },
        { kind: "drawable", drawableId: DRAW_EYE }
      ],
      expectedFlatten: [DRAW_FRONT, DRAW_BACK, DRAW_EYE, DRAW_MOUTH]
    },
    {
      label: "Part Container before Drawable",
      moved: { kind: "part" as const, partId: PART_EYE },
      drop: { placement: "before" as const, target: { kind: "drawable" as const, drawableId: DRAW_FRONT } },
      expectedFaceChildren: [
        { kind: "part", partId: PART_EYE },
        { kind: "drawable", drawableId: DRAW_FRONT },
        { kind: "drawable", drawableId: DRAW_BACK },
        { kind: "part", partId: PART_MOUTH }
      ],
      expectedFlatten: [DRAW_EYE, DRAW_FRONT, DRAW_BACK, DRAW_MOUTH]
    },
    {
      label: "Part Container after Drawable",
      moved: { kind: "part" as const, partId: PART_EYE },
      drop: { placement: "after" as const, target: { kind: "drawable" as const, drawableId: DRAW_BACK } },
      expectedFaceChildren: [
        { kind: "drawable", drawableId: DRAW_FRONT },
        { kind: "drawable", drawableId: DRAW_BACK },
        { kind: "part", partId: PART_EYE },
        { kind: "part", partId: PART_MOUTH }
      ],
      expectedFlatten: [DRAW_FRONT, DRAW_BACK, DRAW_EYE, DRAW_MOUTH]
    },
    {
      label: "Part Container before Part Container",
      moved: { kind: "part" as const, partId: PART_MOUTH },
      drop: { placement: "before" as const, target: { kind: "part" as const, partId: PART_EYE } },
      expectedFaceChildren: [
        { kind: "drawable", drawableId: DRAW_FRONT },
        { kind: "part", partId: PART_MOUTH },
        { kind: "part", partId: PART_EYE },
        { kind: "drawable", drawableId: DRAW_BACK }
      ],
      expectedFlatten: [DRAW_FRONT, DRAW_MOUTH, DRAW_EYE, DRAW_BACK]
    },
    {
      label: "Part Container after Part Container",
      moved: { kind: "part" as const, partId: PART_EYE },
      drop: { placement: "after" as const, target: { kind: "part" as const, partId: PART_MOUTH } },
      expectedFaceChildren: [
        { kind: "drawable", drawableId: DRAW_FRONT },
        { kind: "drawable", drawableId: DRAW_BACK },
        { kind: "part", partId: PART_MOUTH },
        { kind: "part", partId: PART_EYE }
      ],
      expectedFlatten: [DRAW_FRONT, DRAW_BACK, DRAW_MOUTH, DRAW_EYE]
    },
    {
      label: "Part Container inside Part Container",
      moved: { kind: "part" as const, partId: PART_MOUTH },
      drop: { placement: "inside" as const, parentPartId: PART_EYE },
      expectedFaceChildren: [
        { kind: "drawable", drawableId: DRAW_FRONT },
        { kind: "part", partId: PART_EYE },
        { kind: "drawable", drawableId: DRAW_BACK }
      ],
      expectedEyeChildren: [
        { kind: "part", partId: PART_MOUTH },
        { kind: "drawable", drawableId: DRAW_EYE }
      ],
      expectedFlatten: [DRAW_FRONT, DRAW_MOUTH, DRAW_EYE, DRAW_BACK]
    }
  ])("handles $label moves through one ordered children authority", (input) => {
    const session = createFixtureSession();

    moveStructureChild(session, {
      moved: input.moved,
      drop: input.drop
    });

    const facePart = session.graph.parts.find((part) => part.partId === PART_FACE)!;
    const eyePart = session.graph.parts.find((part) => part.partId === PART_EYE)!;
    expect(getPartOrderedChildren(session.graph, facePart)).toEqual(input.expectedFaceChildren);
    expect(getPartOrderedChildren(session.graph, eyePart)).toEqual(
      input.expectedEyeChildren ?? [{ kind: "drawable", drawableId: DRAW_EYE }]
    );
    expect(flattenDrawableIdsByPartOrder(session.graph)).toEqual(input.expectedFlatten);
    expect(session.graph.drawOrder.map((entry) => entry.drawableId)).toEqual(input.expectedFlatten);
  });

  it("allows root-part drawable membership while rejecting cycles and illegal root part moves", () => {
    const cycleSession = createFixtureSession();
    expect(() =>
      moveStructureChild(cycleSession, {
        moved: { kind: "part", partId: PART_FACE },
        drop: { placement: "inside", parentPartId: PART_EYE }
      })
    ).toThrow(expect.objectContaining({ code: "part_cycle" }) as AuthoringMutationError);

    const drawableRootSession = createFixtureSession();
    moveStructureChild(drawableRootSession, {
      moved: { kind: "drawable", drawableId: DRAW_BACK },
      drop: { placement: "inside", parentPartId: PART_ROOT }
    });
    const rootPart = drawableRootSession.graph.parts.find((part) => part.partId === PART_ROOT)!;
    expect(getPartOrderedChildren(drawableRootSession.graph, rootPart)).toEqual([
      { kind: "drawable", drawableId: DRAW_BACK },
      { kind: "part", partId: PART_FACE }
    ]);
    expect(drawableRootSession.graph.drawables.find((drawable) => drawable.drawableId === DRAW_BACK)).toMatchObject({
      partId: PART_ROOT,
      baseDrawOrder: 0
    });

    const rootMoveSession = createFixtureSession();
    expect(() =>
      moveStructureChild(rootMoveSession, {
        moved: { kind: "part", partId: PART_ROOT },
        drop: { placement: "after", target: { kind: "part", partId: PART_FACE } }
      })
    ).toThrow(expect.objectContaining({ code: "root_part_move" }) as AuthoringMutationError);
  });

  it("rejects drawable no-op structure moves without incrementing authoring revision", () => {
    const session = createFixtureSession();

    expect(() =>
      moveStructureChild(session, {
        moved: { kind: "drawable", drawableId: DRAW_FRONT },
        drop: { placement: "before", target: { kind: "part", partId: PART_EYE } }
      })
    ).toThrow(expect.objectContaining({ code: "no_op_structure_order_move" }) as AuthoringMutationError);

    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
    expect(flattenDrawableIdsByPartOrder(session.graph)).toEqual([
      DRAW_FRONT,
      DRAW_EYE,
      DRAW_BACK,
      DRAW_MOUTH
    ]);
  });
});

function createFixtureSession(): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_structure_order_fixture"),
      packageDisplayName: "Structure Order Fixture",
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
          partId: PART_ROOT,
          displayName: "Root",
          childPartIds: [PART_FACE],
          drawableIds: [],
          children: [{ kind: "part", partId: PART_FACE }]
        },
        {
          partId: PART_FACE,
          displayName: "Face",
          parentPartId: PART_ROOT,
          childPartIds: [PART_EYE, PART_MOUTH],
          drawableIds: [DRAW_FRONT, DRAW_BACK],
          children: [
            { kind: "drawable", drawableId: DRAW_FRONT },
            { kind: "part", partId: PART_EYE },
            { kind: "drawable", drawableId: DRAW_BACK },
            { kind: "part", partId: PART_MOUTH }
          ]
        },
        {
          partId: PART_EYE,
          displayName: "Eye",
          parentPartId: PART_FACE,
          childPartIds: [],
          drawableIds: [DRAW_EYE],
          children: [{ kind: "drawable", drawableId: DRAW_EYE }]
        },
        {
          partId: PART_MOUTH,
          displayName: "Mouth",
          parentPartId: PART_FACE,
          childPartIds: [],
          drawableIds: [DRAW_MOUTH],
          children: [{ kind: "drawable", drawableId: DRAW_MOUTH }]
        }
      ],
      drawables: [
        createDrawable(DRAW_FRONT, PART_FACE, 0),
        createDrawable(DRAW_BACK, PART_FACE, 2),
        createDrawable(DRAW_EYE, PART_EYE, 1),
        createDrawable(DRAW_MOUTH, PART_MOUTH, 3)
      ],
      meshes: [],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [
        { drawableId: DRAW_FRONT, baseDrawOrder: 0, stableOrder: 0 },
        { drawableId: DRAW_EYE, baseDrawOrder: 1, stableOrder: 1 },
        { drawableId: DRAW_BACK, baseDrawOrder: 2, stableOrder: 2 },
        { drawableId: DRAW_MOUTH, baseDrawOrder: 3, stableOrder: 3 }
      ],
      rigControlRootIds: [],
      stableOrder: [PART_ROOT, PART_FACE, PART_EYE, PART_MOUTH, DRAW_FRONT, DRAW_EYE, DRAW_BACK, DRAW_MOUTH],
      sourceAssets: [],
      provenanceRecords: [],
      rightsRecords: []
    }
  };
}

function createDrawable(
  drawableId: ReturnType<typeof DrawableIdSchema.parse>,
  partId: ReturnType<typeof PartIdSchema.parse>,
  baseDrawOrder: number
) {
  const suffix = drawableId.replace(/^draw_/, "");

  return {
    drawableId,
    displayName: suffix,
    partId,
    sourceAssetId: SourceAssetIdSchema.parse("src_structure_order_fixture"),
    textureId: TextureIdSchema.parse(`tex_${suffix}`),
    meshId: MeshIdSchema.parse(`mesh_${suffix}`),
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder,
    sourceProvenanceId: ProvenanceIdSchema.parse(`prov_${suffix}`)
  };
}
