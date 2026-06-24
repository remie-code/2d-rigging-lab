import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  type DrawableId,
  type PartId
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createEmptyAuthoringSession, ROOT_PART_ID } from "../../editor-session/model/empty-authoring-session";
import {
  createVariantDrawablePickerProjection,
  createVariantManagerProjection
} from "./variant-manager-projection";

const PART_FACE = PartIdSchema.parse("part_variant_face");
const PART_CLOTHES = PartIdSchema.parse("part_variant_clothes");
const DRAW_BASE = DrawableIdSchema.parse("draw_variant_base");
const DRAW_HOODIE = DrawableIdSchema.parse("draw_variant_hoodie");
const DRAW_BUTTON = DrawableIdSchema.parse("draw_variant_draft_button");
const DRAW_SMILE = DrawableIdSchema.parse("draw_variant_smile");
const RIG_BODY = RigControlIdSchema.parse("rig_variant_body");
const GROUP_OUTFIT = "vgrp_outfit";
const GROUP_EXPRESSION = "vgrp_expression";
const VAR_DEFAULT = "var_outfit_default";
const VAR_HOODIE = "var_outfit_hoodie";
const VAR_SMILE = "var_expression_smile";

describe("variant manager projection", () => {
  it("renders Parts Container hierarchy collapsed by default with eligible counts", () => {
    const session = createVariantPickerSession();

    const projection = createVariantDrawablePickerProjection(session, {
      variantGroupId: GROUP_OUTFIT as never
    });

    const clothes = findPartRow(projection.rows, PART_CLOTHES);
    expect(clothes.collapsed).toBe(true);
    expect(clothes.eligibleCount).toBe(1);
    expect(clothes.totalCount).toBe(3);
    expect(projection.eligibleCount).toBe(1);
    expect(projection.totalDrawableCount).toBe(4);
    expect(projection.rows.some((row) => row.kind === "drawable" && row.drawableId === DRAW_HOODIE))
      .toBe(false);
  });

  it("classifies picker drawable eligibility states", () => {
    const session = createVariantPickerSession();

    const projection = createVariantDrawablePickerProjection(session, {
      variantGroupId: GROUP_OUTFIT as never,
      collapsedPartIds: new Set(),
      selectedDrawableIds: new Set([DRAW_HOODIE])
    });

    expect(findDrawableRow(projection.rows, DRAW_HOODIE)).toMatchObject({
      eligibility: "eligible",
      checked: true,
      selectable: true,
      selected: true
    });
    expect(findDrawableRow(projection.rows, DRAW_BUTTON)).toMatchObject({
      eligibility: "notBound",
      checked: false,
      selectable: false
    });
    expect(findDrawableRow(projection.rows, DRAW_SMILE)).toMatchObject({
      eligibility: "alreadyInOtherGroup",
      ownerGroupName: "Expression",
      selectable: false
    });
    expect(findDrawableRow(projection.rows, DRAW_BASE)).toMatchObject({
      eligibility: "alreadyInThisGroup",
      checked: true,
      selectable: false
    });
  });

  it("reports no groups, invalid refs, and duplicate ownership checks", () => {
    const empty = createEmptyAuthoringSession();
    expect(createVariantManagerProjection(empty).checks).toEqual([
      {
        id: "variant.noGroups",
        severity: "info",
        message: "No Variant Groups."
      }
    ]);

    const bad = createVariantPickerSession();
    bad.graph.variantGroups = [
      ...bad.graph.variantGroups!,
      {
        variantGroupId: "vgrp_bad" as never,
        displayName: "Bad",
        mode: "singleSelect",
        variants: [{ variantId: "var_bad_default" as never, displayName: "Default" }],
        targetDrawableIds: [DRAW_BASE, DrawableIdSchema.parse("draw_missing_bad")],
        memberships: [
          {
            drawableId: DRAW_BASE,
            variantIds: ["var_missing_bad" as never]
          }
        ],
        defaultActive: {
          kind: "singleSelect",
          variantId: "var_missing_bad" as never
        }
      }
    ];

    const checkMessages = createVariantManagerProjection(bad).checks.map((check) => check.message);
    expect(checkMessages).toContain(
      "draw_variant_base is owned by both Outfit and Bad."
    );
    expect(checkMessages).toContain(
      "Bad targets missing Drawable draw_missing_bad."
    );
    expect(checkMessages).toContain(
      "Bad membership references missing Variant var_missing_bad."
    );
    expect(checkMessages).toContain(
      "Bad target draw_missing_bad has no membership row."
    );
    expect(checkMessages).toContain("Bad default active Variant is missing.");
  });
});

function findPartRow(
  rows: ReturnType<typeof createVariantDrawablePickerProjection>["rows"],
  partId: PartId
) {
  const row = rows.find((candidate) => candidate.kind === "part" && candidate.partId === partId);
  if (row === undefined || row.kind !== "part") {
    throw new Error(`Expected part row ${partId}.`);
  }
  return row;
}

function findDrawableRow(
  rows: ReturnType<typeof createVariantDrawablePickerProjection>["rows"],
  drawableId: DrawableId
) {
  const row = rows.find((candidate) =>
    candidate.kind === "drawable" && candidate.drawableId === drawableId
  );
  if (row === undefined || row.kind !== "drawable") {
    throw new Error(`Expected drawable row ${drawableId}.`);
  }
  return row;
}

function createVariantPickerSession(): AuthoringSession {
  const session = createEmptyAuthoringSession();
  session.graph.parts = [
    {
      partId: ROOT_PART_ID,
      displayName: "Project Root",
      childPartIds: [PART_FACE, PART_CLOTHES],
      drawableIds: []
    },
    {
      partId: PART_FACE,
      displayName: "Face",
      parentPartId: ROOT_PART_ID,
      childPartIds: [],
      drawableIds: [DRAW_SMILE]
    },
    {
      partId: PART_CLOTHES,
      displayName: "Clothes",
      parentPartId: ROOT_PART_ID,
      childPartIds: [],
      drawableIds: [DRAW_BASE, DRAW_HOODIE, DRAW_BUTTON]
    }
  ];
  session.graph.drawables = [
    createDrawable(DRAW_SMILE, PART_FACE, "Smile"),
    createDrawable(DRAW_BASE, PART_CLOTHES, "Base Clothes"),
    createDrawable(DRAW_HOODIE, PART_CLOTHES, "Hoodie"),
    createDrawable(DRAW_BUTTON, PART_CLOTHES, "Draft Button")
  ];
  session.graph.rigControls = [
    {
      kind: "warpLattice2d",
      rigControlId: RIG_BODY,
      displayName: "Body Warp",
      partId: PART_CLOTHES,
      childDrawableIds: [DRAW_BASE, DRAW_HOODIE, DRAW_SMILE],
      childRigControlIds: [],
      bindSpace: "rigControlLocalRest",
      domainBounds: { x: 0, y: 0, width: 100, height: 100 },
      latticeColumns: 2,
      latticeRows: 2,
      restControlPoints: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
        { x: 100, y: 100 }
      ],
      interpolationMethod: "bilinear-grid-v1",
      enabled: true
    }
  ];
  session.graph.variantGroups = [
    {
      variantGroupId: GROUP_OUTFIT as never,
      displayName: "Outfit",
      mode: "singleSelect",
      variants: [
        { variantId: VAR_DEFAULT as never, displayName: "Default" },
        { variantId: VAR_HOODIE as never, displayName: "Hoodie" }
      ],
      targetDrawableIds: [DRAW_BASE],
      memberships: [
        {
          drawableId: DRAW_BASE,
          variantIds: [VAR_DEFAULT as never]
        }
      ],
      defaultActive: {
        kind: "singleSelect",
        variantId: VAR_DEFAULT as never
      }
    },
    {
      variantGroupId: GROUP_EXPRESSION as never,
      displayName: "Expression",
      mode: "singleSelect",
      variants: [{ variantId: VAR_SMILE as never, displayName: "Smile" }],
      targetDrawableIds: [DRAW_SMILE],
      memberships: [
        {
          drawableId: DRAW_SMILE,
          variantIds: [VAR_SMILE as never]
        }
      ],
      defaultActive: {
        kind: "singleSelect",
        variantId: VAR_SMILE as never
      }
    }
  ];
  return session;
}

function createDrawable(drawableId: DrawableId, partId: PartId, displayName: string) {
  const token = drawableId.replace(/^draw_variant_/, "");
  return {
    drawableId,
    displayName,
    partId,
    sourceAssetId: SourceAssetIdSchema.parse("src_variant_projection"),
    textureId: TextureIdSchema.parse(`tex_variant_${token}`),
    meshId: MeshIdSchema.parse(`mesh_variant_${token}`),
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder: 0,
    sourceProvenanceId: ProvenanceIdSchema.parse("prov_variant_projection")
  };
}
