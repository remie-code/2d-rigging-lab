import { describe, expect, it } from "vitest";

import {
  createInitialViewerVariantActiveSelections,
  reconcileViewerVariantActiveSelections,
  setViewerVariantSingleSelect,
  toggleViewerVariantMultiToggle,
  type ViewerVariantGroup
} from "./viewer-variant-selection";

const GROUP_EXPRESSION = "vgrp_viewer_variant_selection_expression";
const GROUP_ACCESSORY = "vgrp_viewer_variant_selection_accessory";
const VAR_DEFAULT = "var_viewer_variant_selection_default";
const VAR_SMILE = "var_viewer_variant_selection_smile";
const VAR_GLASSES = "var_viewer_variant_selection_glasses";

describe("viewer variant selection", () => {
  it("initializes from Project defaults and reconciles removed variants", () => {
    const variantGroups = createVariantSelectionGroups();
    const initialSelections = createInitialViewerVariantActiveSelections(variantGroups);
    const smileSelections = setViewerVariantSingleSelect(
      variantGroups,
      initialSelections,
      variantGroups[0],
      VAR_SMILE as never
    );
    const nextVariantGroups = [
      {
        ...variantGroups[0],
        variants: [{ variantId: VAR_DEFAULT as never, displayName: "Default" }],
        memberships: [],
        defaultActive: {
          kind: "singleSelect" as const,
          variantId: VAR_DEFAULT as never
        }
      },
      variantGroups[1]
    ];

    expect(initialSelections).toEqual([
      {
        variantGroupId: GROUP_EXPRESSION,
        activeSelection: {
          kind: "singleSelect",
          variantId: VAR_DEFAULT
        }
      },
      {
        variantGroupId: GROUP_ACCESSORY,
        activeSelection: {
          kind: "multiToggle",
          variantIds: []
        }
      }
    ]);
    expect(smileSelections[0]?.activeSelection).toEqual({
      kind: "singleSelect",
      variantId: VAR_SMILE
    });
    expect(reconcileViewerVariantActiveSelections(nextVariantGroups, smileSelections)).toEqual([
      {
        variantGroupId: GROUP_EXPRESSION,
        activeSelection: {
          kind: "singleSelect",
          variantId: VAR_DEFAULT
        }
      },
      {
        variantGroupId: GROUP_ACCESSORY,
        activeSelection: {
          kind: "multiToggle",
          variantIds: []
        }
      }
    ]);
  });

  it("toggles multi-toggle selections without changing Project defaults", () => {
    const variantGroups = createVariantSelectionGroups();
    const initialSelections = createInitialViewerVariantActiveSelections(variantGroups);
    const enabledSelections = toggleViewerVariantMultiToggle(
      variantGroups,
      initialSelections,
      variantGroups[1],
      VAR_GLASSES as never
    );

    expect(enabledSelections[1]?.activeSelection).toEqual({
      kind: "multiToggle",
      variantIds: [VAR_GLASSES]
    });
    expect(variantGroups[1]?.defaultActive).toEqual({
      kind: "multiToggle",
      variantIds: []
    });
  });
});

function createVariantSelectionGroups(): readonly ViewerVariantGroup[] {
  return [
    {
      variantGroupId: GROUP_EXPRESSION as never,
      displayName: "Expression",
      mode: "singleSelect",
      variants: [
        { variantId: VAR_DEFAULT as never, displayName: "Default" },
        { variantId: VAR_SMILE as never, displayName: "Smile" }
      ],
      targetDrawableIds: [],
      memberships: [],
      defaultActive: {
        kind: "singleSelect",
        variantId: VAR_DEFAULT as never
      }
    },
    {
      variantGroupId: GROUP_ACCESSORY as never,
      displayName: "Accessory",
      mode: "multiToggle",
      variants: [{ variantId: VAR_GLASSES as never, displayName: "Glasses" }],
      targetDrawableIds: [],
      memberships: [],
      defaultActive: {
        kind: "multiToggle",
        variantIds: []
      }
    }
  ];
}
