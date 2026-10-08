import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { VariantGroupDto } from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import {
  AuthoringMutationError,
  addVariantTargetDrawable,
  createInitialAuthoringRevision,
  createVariant,
  createVariantGroup,
  deleteVariant,
  deleteVariantGroup,
  removeVariantTargetDrawable,
  setVariantDefaultActiveSelection,
  setVariantMembership,
  updateVariant,
  updateVariantGroup
} from "./index.js";
import type { AuthoringSession } from "./authoring-session.js";

describe("variant authoring mutations", () => {
  it("creates, renames, updates, and deletes Variant Groups", () => {
    const session = createVariantFixtureSession();

    createVariantGroup(session, { group: createSingleSelectGroup("vgrp_expression", "Expression") });
    expect(session.graph.variantGroups).toHaveLength(1);
    expect(session.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);

    updateVariantGroup(session, {
      variantGroupId: "vgrp_expression",
      displayName: "Expressions",
      mode: "multiToggle"
    });
    expect(session.graph.variantGroups?.[0]).toMatchObject({
      displayName: "Expressions",
      mode: "multiToggle",
      defaultActive: {
        kind: "multiToggle",
        variantIds: ["var_expression_default"]
      }
    });

    deleteVariantGroup(session, { variantGroupId: "vgrp_expression" });
    expect(session.graph.variantGroups).toEqual([]);
  });

  it("enforces single group ownership for target drawables", () => {
    const session = createVariantFixtureSession();
    createVariantGroup(session, { group: createSingleSelectGroup("vgrp_expression", "Expression") });
    createVariantGroup(session, { group: createSingleSelectGroup("vgrp_outfit", "Outfit") });

    addVariantTargetDrawable(session, {
      variantGroupId: "vgrp_expression",
      drawableId: DrawableIdSchema.parse("draw_face")
    });

    expectAuthoringMutationCode(
      () => addVariantTargetDrawable(session, {
        variantGroupId: "vgrp_outfit",
        drawableId: DrawableIdSchema.parse("draw_face")
      }),
      "variant_target_drawable_already_owned"
    );

    removeVariantTargetDrawable(session, {
      variantGroupId: "vgrp_expression",
      drawableId: DrawableIdSchema.parse("draw_face")
    });
    addVariantTargetDrawable(session, {
      variantGroupId: "vgrp_outfit",
      drawableId: DrawableIdSchema.parse("draw_face")
    });

    expect(session.graph.variantGroups?.find((group) => group.variantGroupId === "vgrp_outfit"))
      .toMatchObject({
        targetDrawableIds: ["draw_face"],
        memberships: [{ drawableId: "draw_face", variantIds: [] }]
      });
  });

  it("adds, renames, and deletes variants while blocking the last single-select variant", () => {
    const session = createVariantFixtureSession();
    createVariantGroup(session, { group: createSingleSelectGroup("vgrp_expression", "Expression") });

    createVariant(session, {
      variantGroupId: "vgrp_expression",
      variantId: "var_expression_smile",
      displayName: "Smile"
    });
    updateVariant(session, {
      variantGroupId: "vgrp_expression",
      variantId: "var_expression_smile",
      displayName: "Big Smile"
    });
    expect(session.graph.variantGroups?.[0]?.variants).toEqual([
      { variantId: "var_expression_default", displayName: "Default" },
      { variantId: "var_expression_smile", displayName: "Big Smile" }
    ]);

    deleteVariant(session, {
      variantGroupId: "vgrp_expression",
      variantId: "var_expression_smile"
    });
    expectAuthoringMutationCode(
      () => deleteVariant(session, {
        variantGroupId: "vgrp_expression",
        variantId: "var_expression_default"
      }),
      "last_variant_delete"
    );
  });

  it("updates membership without changing unrelated drawables or groups", () => {
    const session = createVariantFixtureSession();
    createVariantGroup(session, { group: createSingleSelectGroup("vgrp_expression", "Expression") });
    createVariantGroup(session, { group: createMultiToggleGroup("vgrp_accessory", "Accessory") });
    createVariant(session, {
      variantGroupId: "vgrp_expression",
      variantId: "var_expression_smile",
      displayName: "Smile"
    });
    createVariant(session, {
      variantGroupId: "vgrp_accessory",
      variantId: "var_accessory_glasses",
      displayName: "Glasses"
    });
    addVariantTargetDrawable(session, {
      variantGroupId: "vgrp_expression",
      drawableId: DrawableIdSchema.parse("draw_face")
    });
    addVariantTargetDrawable(session, {
      variantGroupId: "vgrp_expression",
      drawableId: DrawableIdSchema.parse("draw_mouth")
    });
    addVariantTargetDrawable(session, {
      variantGroupId: "vgrp_accessory",
      drawableId: DrawableIdSchema.parse("draw_hat")
    });

    setVariantMembership(session, {
      variantGroupId: "vgrp_expression",
      drawableId: DrawableIdSchema.parse("draw_face"),
      variantId: "var_expression_smile",
      member: true
    });

    expect(session.graph.variantGroups).toEqual([
      expect.objectContaining({
        variantGroupId: "vgrp_expression",
        memberships: [
          { drawableId: "draw_face", variantIds: ["var_expression_smile"] },
          { drawableId: "draw_mouth", variantIds: [] }
        ]
      }),
      expect.objectContaining({
        variantGroupId: "vgrp_accessory",
        memberships: [
          { drawableId: "draw_hat", variantIds: [] }
        ]
      })
    ]);
  });

  it("validates default active selection references", () => {
    const session = createVariantFixtureSession();
    createVariantGroup(session, { group: createSingleSelectGroup("vgrp_expression", "Expression") });
    createVariant(session, {
      variantGroupId: "vgrp_expression",
      variantId: "var_expression_smile",
      displayName: "Smile"
    });

    setVariantDefaultActiveSelection(session, {
      variantGroupId: "vgrp_expression",
      defaultActive: {
        kind: "singleSelect",
        variantId: "var_expression_smile"
      }
    });
    expect(session.graph.variantGroups?.[0]?.defaultActive).toEqual({
      kind: "singleSelect",
      variantId: "var_expression_smile"
    });

    expectAuthoringMutationCode(
      () => setVariantDefaultActiveSelection(session, {
        variantGroupId: "vgrp_expression",
        defaultActive: {
          kind: "singleSelect",
          variantId: "var_expression_missing"
        }
      }),
      "invalid_variant_default_active"
    );
  });

  it("rejects missing references in Variant mutations", () => {
    const missingDrawableSession = createVariantFixtureSession();
    createVariantGroup(missingDrawableSession, {
      group: createSingleSelectGroup("vgrp_expression", "Expression")
    });
    expectAuthoringMutationCode(
      () => addVariantTargetDrawable(missingDrawableSession, {
        variantGroupId: "vgrp_expression",
        drawableId: DrawableIdSchema.parse("draw_missing")
      }),
      "missing_drawable"
    );

    expectAuthoringMutationCode(
      () => updateVariantGroup(createVariantFixtureSession(), {
        variantGroupId: "vgrp_missing",
        displayName: "Missing"
      }),
      "missing_variant_group"
    );

    const missingVariantSession = createVariantFixtureSession();
    createVariantGroup(missingVariantSession, {
      group: createSingleSelectGroup("vgrp_expression", "Expression")
    });
    expectAuthoringMutationCode(
      () => updateVariant(missingVariantSession, {
        variantGroupId: "vgrp_expression",
        variantId: "var_expression_missing",
        displayName: "Missing"
      }),
      "missing_variant"
    );

    const missingMembershipSession = createVariantFixtureSession();
    createVariantGroup(missingMembershipSession, {
      group: createSingleSelectGroup("vgrp_expression", "Expression")
    });
    expectAuthoringMutationCode(
      () => setVariantMembership(missingMembershipSession, {
        variantGroupId: "vgrp_expression",
        drawableId: DrawableIdSchema.parse("draw_face"),
        variantId: "var_expression_default",
        member: true
      }),
      "missing_variant_membership"
    );

    expectAuthoringMutationCode(
      () => createVariantGroup(createVariantFixtureSession(), {
        group: {
          ...createSingleSelectGroup("vgrp_expression", "Expression"),
          targetDrawableIds: [DrawableIdSchema.parse("draw_face")],
          memberships: []
        }
      }),
      "missing_variant_membership"
    );

    expectAuthoringMutationCode(
      () => createVariantGroup(createVariantFixtureSession(), {
        group: {
          ...createSingleSelectGroup("vgrp_expression", "Expression"),
          targetDrawableIds: [],
          memberships: [
            {
              drawableId: DrawableIdSchema.parse("draw_face"),
              variantIds: ["var_expression_default"]
            }
          ]
        }
      }),
      "missing_variant_target_drawable"
    );
  });

  it("rejects invalid multi-toggle default active selection references", () => {
    const session = createVariantFixtureSession();
    createVariantGroup(session, { group: createMultiToggleGroup("vgrp_accessory", "Accessory") });
    createVariant(session, {
      variantGroupId: "vgrp_accessory",
      variantId: "var_accessory_glasses",
      displayName: "Glasses"
    });

    setVariantDefaultActiveSelection(session, {
      variantGroupId: "vgrp_accessory",
      defaultActive: {
        kind: "multiToggle",
        variantIds: ["var_accessory_glasses"]
      }
    });
    expect(session.graph.variantGroups?.[0]?.defaultActive).toEqual({
      kind: "multiToggle",
      variantIds: ["var_accessory_glasses"]
    });

    expectAuthoringMutationCode(
      () => setVariantDefaultActiveSelection(session, {
        variantGroupId: "vgrp_accessory",
        defaultActive: {
          kind: "multiToggle",
          variantIds: ["var_accessory_missing"]
        }
      }),
      "invalid_variant_default_active"
    );
  });
});

const expectAuthoringMutationCode = (
  action: () => void,
  expectedCode: AuthoringMutationError["code"]
): void => {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(AuthoringMutationError);
    expect((error as AuthoringMutationError).code).toBe(expectedCode);
    return;
  }

  throw new Error(`Expected AuthoringMutationError ${expectedCode}.`);
};

const createSingleSelectGroup = (
  variantGroupId: "vgrp_expression" | "vgrp_outfit",
  displayName: string
): VariantGroupDto => ({
  variantGroupId,
  displayName,
  mode: "singleSelect",
  variants: [
    {
      variantId: variantGroupId === "vgrp_expression"
        ? "var_expression_default"
        : "var_outfit_default",
      displayName: "Default"
    }
  ],
  targetDrawableIds: [],
  memberships: [],
  defaultActive: {
    kind: "singleSelect",
    variantId: variantGroupId === "vgrp_expression"
      ? "var_expression_default"
      : "var_outfit_default"
  }
});

const createMultiToggleGroup = (
  variantGroupId: "vgrp_accessory",
  displayName: string
): VariantGroupDto => ({
  variantGroupId,
  displayName,
  mode: "multiToggle",
  variants: [],
  targetDrawableIds: [],
  memberships: [],
  defaultActive: {
    kind: "multiToggle",
    variantIds: []
  }
});

const createVariantFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_variant_mutations_test"),
    packageDisplayName: "Variant Mutations Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 1024, height: 1024 },
    parts: [],
    drawables: [
      createDrawable("draw_face", "Face"),
      createDrawable("draw_mouth", "Mouth"),
      createDrawable("draw_hat", "Hat")
    ],
    meshes: [],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [],
    variantGroups: [],
    rigControlRootIds: [],
    stableOrder: [],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});

const createDrawable = (drawableIdText: string, displayName: string) => ({
  drawableId: DrawableIdSchema.parse(drawableIdText),
  displayName,
  partId: PartIdSchema.parse("part_root"),
  sourceAssetId: SourceAssetIdSchema.parse("src_split_png"),
  textureId: TextureIdSchema.parse(`tex_${drawableIdText.replace(/^draw_/, "")}`),
  meshId: MeshIdSchema.parse(`mesh_${drawableIdText.replace(/^draw_/, "")}`),
  defaultOpacity: 1,
  runtimeVisibility: true,
  baseDrawOrder: 0,
  sourceProvenanceId: ProvenanceIdSchema.parse("prov_variant_fixture")
});
