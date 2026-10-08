import { VariantGroupSchema } from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import {
  resolveVariantSelections,
  VariantSelectionResolutionError
} from "./variant-selection-resolution.js";

/**
 * Wave105 Domain A — variant selection resolver (validation layer).
 *
 * The pure predicate silently tolerates bad input; this layer is where an
 * unknown group / variant reference or a mode mismatch becomes a deterministic
 * error, and where an omitted request resolves to `defaultActive`. multiToggle
 * is exercised so the resolver is not singleSelect-only.
 */

const singleSelectGroup = VariantGroupSchema.parse({
  variantGroupId: "vgrp_outfit",
  displayName: "Outfit",
  mode: "singleSelect",
  variants: [
    { variantId: "var_default", displayName: "Default" },
    { variantId: "var_alt", displayName: "Alt" }
  ],
  targetDrawableIds: ["draw_body"],
  memberships: [{ drawableId: "draw_body", variantIds: ["var_default"] }],
  defaultActive: { kind: "singleSelect", variantId: "var_default" }
});

const multiToggleGroup = VariantGroupSchema.parse({
  variantGroupId: "vgrp_accessories",
  displayName: "Accessories",
  mode: "multiToggle",
  variants: [
    { variantId: "var_hat", displayName: "Hat" },
    { variantId: "var_scarf", displayName: "Scarf" }
  ],
  targetDrawableIds: ["draw_hat", "draw_scarf"],
  memberships: [
    { drawableId: "draw_hat", variantIds: ["var_hat"] },
    { drawableId: "draw_scarf", variantIds: ["var_scarf"] }
  ],
  defaultActive: { kind: "multiToggle", variantIds: ["var_hat"] }
});

describe("resolveVariantSelections — defaults", () => {
  it("returns an empty selection for a package with no Variant Groups", () => {
    expect(resolveVariantSelections({ variantGroups: undefined, variantSelections: undefined }))
      .toEqual({ activeSelections: [], resolved: [] });
    expect(resolveVariantSelections({ variantGroups: [], variantSelections: undefined }))
      .toEqual({ activeSelections: [], resolved: [] });
  });

  it("resolves defaultActive per group when the payload is omitted", () => {
    const resolved = resolveVariantSelections({
      variantGroups: [singleSelectGroup, multiToggleGroup],
      variantSelections: undefined
    });
    // Sorted by variantGroupId: vgrp_accessories < vgrp_outfit.
    expect(resolved.resolved).toEqual([
      { kind: "multiToggle", variantGroupId: "vgrp_accessories", variantIds: ["var_hat"] },
      { kind: "singleSelect", variantGroupId: "vgrp_outfit", variantId: "var_default" }
    ]);
  });
});

describe("resolveVariantSelections — explicit overrides", () => {
  it("overrides only the named group and leaves others at default", () => {
    const resolved = resolveVariantSelections({
      variantGroups: [singleSelectGroup, multiToggleGroup],
      variantSelections: [
        { kind: "singleSelect", variantGroupId: "vgrp_outfit", variantId: "var_alt" }
      ]
    });
    expect(resolved.resolved).toEqual([
      // Untouched group stays at default.
      { kind: "multiToggle", variantGroupId: "vgrp_accessories", variantIds: ["var_hat"] },
      // Overridden group carries the requested variant.
      { kind: "singleSelect", variantGroupId: "vgrp_outfit", variantId: "var_alt" }
    ]);
  });

  it("accepts a multiToggle selection with multiple variants", () => {
    const resolved = resolveVariantSelections({
      variantGroups: [multiToggleGroup],
      variantSelections: [
        {
          kind: "multiToggle",
          variantGroupId: "vgrp_accessories",
          variantIds: ["var_hat", "var_scarf"]
        }
      ]
    });
    expect(resolved.resolved).toEqual([
      {
        kind: "multiToggle",
        variantGroupId: "vgrp_accessories",
        variantIds: ["var_hat", "var_scarf"]
      }
    ]);
  });

  it("accepts an empty multiToggle selection (everything toggled off)", () => {
    const resolved = resolveVariantSelections({
      variantGroups: [multiToggleGroup],
      variantSelections: [
        { kind: "multiToggle", variantGroupId: "vgrp_accessories", variantIds: [] }
      ]
    });
    expect(resolved.resolved).toEqual([
      { kind: "multiToggle", variantGroupId: "vgrp_accessories", variantIds: [] }
    ]);
  });
});

describe("resolveVariantSelections — deterministic rejects", () => {
  it("rejects an unknown group id", () => {
    expect(() =>
      resolveVariantSelections({
        variantGroups: [singleSelectGroup],
        variantSelections: [
          { kind: "singleSelect", variantGroupId: "vgrp_nope", variantId: "var_default" }
        ]
      })
    ).toThrowError(VariantSelectionResolutionError);
  });

  it("rejects a group reference even when the package has no groups", () => {
    expect(() =>
      resolveVariantSelections({
        variantGroups: [],
        variantSelections: [
          { kind: "singleSelect", variantGroupId: "vgrp_outfit", variantId: "var_default" }
        ]
      })
    ).toThrowError(VariantSelectionResolutionError);
  });

  it("rejects an unknown variant id within a known group", () => {
    expect(() =>
      resolveVariantSelections({
        variantGroups: [singleSelectGroup],
        variantSelections: [
          { kind: "singleSelect", variantGroupId: "vgrp_outfit", variantId: "var_ghost" }
        ]
      })
    ).toThrowError(VariantSelectionResolutionError);
  });

  it("rejects a mode mismatch (singleSelect payload against a multiToggle group)", () => {
    expect(() =>
      resolveVariantSelections({
        variantGroups: [multiToggleGroup],
        variantSelections: [
          { kind: "singleSelect", variantGroupId: "vgrp_accessories", variantId: "var_hat" }
        ]
      })
    ).toThrowError(VariantSelectionResolutionError);
  });

  it("rejects a mode mismatch (multiToggle payload against a singleSelect group)", () => {
    expect(() =>
      resolveVariantSelections({
        variantGroups: [singleSelectGroup],
        variantSelections: [
          { kind: "multiToggle", variantGroupId: "vgrp_outfit", variantIds: ["var_default"] }
        ]
      })
    ).toThrowError(VariantSelectionResolutionError);
  });

  it("rejects a duplicate variant id inside a multiToggle selection", () => {
    expect(() =>
      resolveVariantSelections({
        variantGroups: [multiToggleGroup],
        variantSelections: [
          {
            kind: "multiToggle",
            variantGroupId: "vgrp_accessories",
            variantIds: ["var_hat", "var_hat"]
          }
        ]
      })
    ).toThrowError(VariantSelectionResolutionError);
  });
});
