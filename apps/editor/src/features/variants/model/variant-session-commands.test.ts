import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  CreateVariantGroupPayloadDto,
  CreateVariantPayloadDto
} from "@private-2d-rigging-lab/operation-core";
import { describe, expect, it } from "vitest";

import { createEmptyAuthoringSession, ROOT_PART_ID } from "../../editor-session/model/empty-authoring-session";
import {
  commitAddVariantTargetDrawable,
  commitCreateVariant,
  commitCreateVariantGroup,
  commitDeleteVariant,
  commitDeleteVariantGroup,
  commitSetVariantDefaultActiveSelection,
  commitSetVariantMembership,
  commitUpdateVariantGroup,
  commitUpdateVariant
} from "./variant-session-commands";

const DRAW_BASE = DrawableIdSchema.parse("draw_variant_base");
const GROUP_OUTFIT = "vgrp_outfit" as CreateVariantGroupPayloadDto["variantGroupId"];
const VAR_DEFAULT = "var_outfit_default" as CreateVariantPayloadDto["variantId"];
const VAR_HOODIE = "var_outfit_hoodie" as CreateVariantPayloadDto["variantId"];
const VAR_JACKET = "var_outfit_jacket" as CreateVariantPayloadDto["variantId"];

describe("variant session commands", () => {
  it("creates a single-select group with a default Variant", () => {
    const result = commitCreateVariantGroup(createDrawableSession(), {
      variantGroupId: GROUP_OUTFIT,
      displayName: "Outfit",
      mode: "singleSelect"
    });

    expect(result.committed).toBe(true);
    expect(result.session.dirty).toBe(true);
    expect(result.session.graph.variantGroups?.[0]).toMatchObject({
      variantGroupId: GROUP_OUTFIT,
      displayName: "Outfit",
      mode: "singleSelect",
      variants: [{ variantId: VAR_DEFAULT, displayName: "Default" }],
      defaultActive: { kind: "singleSelect", variantId: VAR_DEFAULT }
    });
  });

  it("deletes a group without deleting its target drawables", () => {
    const created = createOutfitGroup(createDrawableSession());
    const withTarget = commitAddVariantTargetDrawable(created.session, {
      variantGroupId: GROUP_OUTFIT,
      drawableId: DRAW_BASE
    });

    const deleted = commitDeleteVariantGroup(withTarget.session, {
      variantGroupId: GROUP_OUTFIT
    });

    expect(deleted.committed).toBe(true);
    expect(deleted.session.graph.variantGroups).toEqual([]);
    expect(deleted.session.graph.drawables.map((drawable) => drawable.drawableId)).toEqual([
      DRAW_BASE
    ]);
  });

  it("renames and updates a group mode", () => {
    const created = createOutfitGroup(createDrawableSession());

    const updated = commitUpdateVariantGroup(created.session, {
      variantGroupId: GROUP_OUTFIT,
      displayName: "Accessory",
      mode: "multiToggle"
    });

    expect(updated.committed).toBe(true);
    expect(updated.session.graph.variantGroups?.[0]).toMatchObject({
      displayName: "Accessory",
      mode: "multiToggle",
      defaultActive: {
        kind: "multiToggle",
        variantIds: [VAR_DEFAULT]
      }
    });
  });

  it("creates, renames, deletes, and blocks deleting the last single-select Variant", () => {
    const created = createOutfitGroup(createDrawableSession());
    const added = commitCreateVariant(created.session, {
      variantGroupId: GROUP_OUTFIT,
      variantId: VAR_HOODIE,
      displayName: "Hoodie"
    });
    const renamed = commitUpdateVariant(added.session, {
      variantGroupId: GROUP_OUTFIT,
      variantId: VAR_HOODIE,
      displayName: "Hoodie Alt"
    });
    const deleted = commitDeleteVariant(renamed.session, {
      variantGroupId: GROUP_OUTFIT,
      variantId: VAR_HOODIE
    });
    const blocked = commitDeleteVariant(deleted.session, {
      variantGroupId: GROUP_OUTFIT,
      variantId: VAR_DEFAULT
    });

    expect(added.committed).toBe(true);
    expect(renamed.session.graph.variantGroups?.[0]?.variants[1]).toMatchObject({
      variantId: VAR_HOODIE,
      displayName: "Hoodie Alt"
    });
    expect(deleted.committed).toBe(true);
    expect(deleted.session.graph.variantGroups?.[0]?.variants).toEqual([
      { variantId: VAR_DEFAULT, displayName: "Default" }
    ]);
    expect(blocked.committed).toBe(false);
    expect(blocked.diagnostics[0]?.checkId).toBe("operation.deleteVariant.lastVariantDelete");
  });

  it("updates membership for multiple variants and saves default active selection", () => {
    const created = createOutfitGroup(createDrawableSession());
    const withHoodie = commitCreateVariant(created.session, {
      variantGroupId: GROUP_OUTFIT,
      variantId: VAR_HOODIE,
      displayName: "Hoodie"
    });
    const withJacket = commitCreateVariant(withHoodie.session, {
      variantGroupId: GROUP_OUTFIT,
      variantId: VAR_JACKET,
      displayName: "Jacket"
    });
    const withTarget = commitAddVariantTargetDrawable(withJacket.session, {
      variantGroupId: GROUP_OUTFIT,
      drawableId: DRAW_BASE
    });
    const inHoodie = commitSetVariantMembership(withTarget.session, {
      variantGroupId: GROUP_OUTFIT,
      drawableId: DRAW_BASE,
      variantId: VAR_HOODIE,
      member: true
    });
    const inJacket = commitSetVariantMembership(inHoodie.session, {
      variantGroupId: GROUP_OUTFIT,
      drawableId: DRAW_BASE,
      variantId: VAR_JACKET,
      member: true
    });
    const defaultActive = commitSetVariantDefaultActiveSelection(inJacket.session, {
      variantGroupId: GROUP_OUTFIT,
      defaultActive: {
        kind: "singleSelect",
        variantId: VAR_JACKET
      }
    });

    const group = defaultActive.session.graph.variantGroups?.[0];
    expect(inJacket.committed).toBe(true);
    expect(group?.memberships).toEqual([
      {
        drawableId: DRAW_BASE,
        variantIds: [VAR_HOODIE, VAR_JACKET]
      }
    ]);
    expect(group?.defaultActive).toEqual({
      kind: "singleSelect",
      variantId: VAR_JACKET
    });
  });
});

function createOutfitGroup(session: AuthoringSession) {
  const result = commitCreateVariantGroup(session, {
    variantGroupId: GROUP_OUTFIT,
    displayName: "Outfit",
    mode: "singleSelect"
  });
  if (!result.committed) {
    throw new Error("Expected Variant Group creation to commit.");
  }
  return result;
}

function createDrawableSession(): AuthoringSession {
  const session = createEmptyAuthoringSession();
  session.graph.parts[0] = {
    ...session.graph.parts[0]!,
    drawableIds: [DRAW_BASE]
  };
  session.graph.drawables.push({
    drawableId: DRAW_BASE,
    displayName: "Base Clothes",
    partId: ROOT_PART_ID,
    sourceAssetId: SourceAssetIdSchema.parse("src_variant_commands"),
    textureId: TextureIdSchema.parse("tex_variant_commands"),
    meshId: MeshIdSchema.parse("mesh_variant_commands"),
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder: 0,
    sourceProvenanceId: ProvenanceIdSchema.parse("prov_variant_commands")
  });
  return session;
}
