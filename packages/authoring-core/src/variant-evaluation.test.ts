import { DrawableIdSchema } from "@private-2d-rigging-lab/contracts";
import type { VariantGroupDto } from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import {
  createVariantVisibilityPredicate,
  resolveDefaultVariantActiveSelections,
  resolveVariantVisibilityForDrawable
} from "./variant-evaluation.js";

const DRAW_FACE = DrawableIdSchema.parse("draw_face");
const DRAW_MOUTH = DrawableIdSchema.parse("draw_mouth");
const DRAW_GLASSES = DrawableIdSchema.parse("draw_glasses");
const DRAW_TEARS = DrawableIdSchema.parse("draw_tears");

describe("variant visibility evaluation", () => {
  it("resolves missing and empty variants as visible for every drawable", () => {
    expect(resolveVariantVisibilityForDrawable({
      drawableId: "draw_any"
    })).toBe(true);

    const predicate = createVariantVisibilityPredicate({
      variantGroups: []
    });
    expect(predicate("draw_any")).toBe(true);
  });

  it("resolves variant-neutral drawables as visible", () => {
    expect(resolveVariantVisibilityForDrawable({
      variantGroups: [createSingleSelectGroup()],
      drawableId: "draw_neutral"
    })).toBe(true);
  });

  it("handles singleSelect groups from explicit active selection", () => {
    const group = createSingleSelectGroup();
    const predicate = createVariantVisibilityPredicate({
      variantGroups: [group],
      activeSelections: [
        {
          variantGroupId: "vgrp_expression",
          activeSelection: {
            kind: "singleSelect",
            variantId: "var_expression_smile"
          }
        }
      ]
    });

    expect(predicate("draw_face")).toBe(true);
    expect(predicate("draw_mouth")).toBe(true);
  });

  it("handles multiToggle groups from explicit active selection", () => {
    const group = createMultiToggleGroup();
    const predicate = createVariantVisibilityPredicate({
      variantGroups: [group],
      activeSelections: [
        {
          variantGroupId: "vgrp_accessory",
          activeSelection: {
            kind: "multiToggle",
            variantIds: ["var_accessory_glasses", "var_accessory_tears"]
          }
        }
      ]
    });

    expect(predicate("draw_glasses")).toBe(true);
    expect(predicate("draw_tears")).toBe(true);
    expect(predicate("draw_neutral")).toBe(true);
  });

  it("blocks assigned drawables when the active selection does not include their membership", () => {
    const group = createSingleSelectGroup();
    const predicate = createVariantVisibilityPredicate({
      variantGroups: [group],
      activeSelections: [
        {
          variantGroupId: "vgrp_expression",
          activeSelection: {
            kind: "singleSelect",
            variantId: "var_expression_default"
          }
        }
      ]
    });

    expect(predicate("draw_face")).toBe(false);
    expect(predicate("draw_mouth")).toBe(true);
  });

  it("uses resolved default active selections when explicit active selection is omitted", () => {
    const group = createMultiToggleGroup();

    expect(resolveDefaultVariantActiveSelections([group])).toEqual([
      {
        variantGroupId: "vgrp_accessory",
        activeSelection: {
          kind: "multiToggle",
          variantIds: ["var_accessory_glasses"]
        }
      }
    ]);

    const predicate = createVariantVisibilityPredicate({
      variantGroups: [group]
    });

    expect(predicate("draw_glasses")).toBe(true);
    expect(predicate("draw_tears")).toBe(false);
  });
});

const createSingleSelectGroup = (): VariantGroupDto => ({
  variantGroupId: "vgrp_expression",
  displayName: "Expression",
  mode: "singleSelect",
  variants: [
    { variantId: "var_expression_default", displayName: "Default" },
    { variantId: "var_expression_smile", displayName: "Smile" }
  ],
  targetDrawableIds: [DRAW_FACE, DRAW_MOUTH],
  memberships: [
    { drawableId: DRAW_FACE, variantIds: ["var_expression_smile"] },
    {
      drawableId: DRAW_MOUTH,
      variantIds: ["var_expression_default", "var_expression_smile"]
    }
  ],
  defaultActive: {
    kind: "singleSelect",
    variantId: "var_expression_default"
  }
});

const createMultiToggleGroup = (): VariantGroupDto => ({
  variantGroupId: "vgrp_accessory",
  displayName: "Accessory",
  mode: "multiToggle",
  variants: [
    { variantId: "var_accessory_glasses", displayName: "Glasses" },
    { variantId: "var_accessory_tears", displayName: "Tears" }
  ],
  targetDrawableIds: [DRAW_GLASSES, DRAW_TEARS],
  memberships: [
    { drawableId: DRAW_GLASSES, variantIds: ["var_accessory_glasses"] },
    { drawableId: DRAW_TEARS, variantIds: ["var_accessory_tears"] }
  ],
  defaultActive: {
    kind: "multiToggle",
    variantIds: ["var_accessory_glasses"]
  }
});
