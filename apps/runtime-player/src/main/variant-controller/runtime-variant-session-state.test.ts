import { describe, expect, it } from "vitest";

import type {
  DrawableId
} from "@private-2d-rigging-lab/contracts";
import type {
  RuntimeExportModelDto
} from "@private-2d-rigging-lab/package-format";

import type {
  RuntimeExportLoadedPayload
} from "../../preload/runtime-export-bridge-contract";
import { RuntimePlayerVariantSessionState } from "./runtime-variant-session-state";

describe("RuntimePlayerVariantSessionState", () => {
  it("initializes active selection from Runtime Export defaults", () => {
    const session = new RuntimePlayerVariantSessionState();
    const status = session.setRuntimeExportPayload(createPayload(), NOW);

    expect(status.state).toBe("ready");
    expect(status.activeVariantSelection).toMatchObject({
      state: "ready",
      activeSelections: [
        {
          variantGroupId: "vgrp_expression",
          activeSelection: {
            kind: "singleSelect",
            variantId: "var_expression_default"
          }
        },
        {
          variantGroupId: "vgrp_accessory",
          activeSelection: {
            kind: "multiToggle",
            variantIds: ["var_glasses"]
          }
        }
      ]
    });
    expect(status.groups[0]?.variants.map((variant) => [
      variant.variantId,
      variant.active
    ])).toEqual([
      ["var_expression_default", true],
      ["var_smile", false]
    ]);
  });

  it("keeps singleSelect groups to exactly one active Variant", () => {
    const session = new RuntimePlayerVariantSessionState();
    session.setRuntimeExportPayload(createPayload(), NOW);

    const status = session.selectSingle({
      variantGroupId: "vgrp_expression",
      variantId: "var_smile"
    }, NOW);

    expect(status.activeVariantSelection.activeSelections[0]).toEqual({
      variantGroupId: "vgrp_expression",
      activeSelection: {
        kind: "singleSelect",
        variantId: "var_smile"
      }
    });
    expect(status.groups[0]?.variants.map((variant) => [
      variant.variantId,
      variant.active
    ])).toEqual([
      ["var_expression_default", false],
      ["var_smile", true]
    ]);
  });

  it("allows multiToggle groups to have zero or more active Variants", () => {
    const session = new RuntimePlayerVariantSessionState();
    session.setRuntimeExportPayload(createPayload(), NOW);

    const withEars = session.toggleMulti({
      variantGroupId: "vgrp_accessory",
      variantId: "var_cat_ears",
      active: true
    }, NOW);
    expect(withEars.activeVariantSelection.activeSelections[1]).toEqual({
      variantGroupId: "vgrp_accessory",
      activeSelection: {
        kind: "multiToggle",
        variantIds: ["var_glasses", "var_cat_ears"]
      }
    });

    const none = session.toggleMulti({
      variantGroupId: "vgrp_accessory",
      variantId: "var_glasses",
      active: false
    }, NOW);
    const off = session.toggleMulti({
      variantGroupId: "vgrp_accessory",
      variantId: "var_cat_ears",
      active: false
    }, NOW);

    expect(none.activeVariantSelection.activeSelections[1]).toEqual({
      variantGroupId: "vgrp_accessory",
      activeSelection: {
        kind: "multiToggle",
        variantIds: ["var_cat_ears"]
      }
    });
    expect(off.activeVariantSelection.activeSelections[1]).toEqual({
      variantGroupId: "vgrp_accessory",
      activeSelection: {
        kind: "multiToggle",
        variantIds: []
      }
    });
  });

  it("resets active selection to Runtime Export defaults", () => {
    const session = new RuntimePlayerVariantSessionState();
    session.setRuntimeExportPayload(createPayload(), NOW);
    session.selectSingle({
      variantGroupId: "vgrp_expression",
      variantId: "var_smile"
    }, NOW);
    session.toggleMulti({
      variantGroupId: "vgrp_accessory",
      variantId: "var_cat_ears",
      active: true
    }, NOW);

    const status = session.resetToDefault(NOW);

    expect(status.activeVariantSelection.activeSelections).toEqual(
      status.defaultActiveSelections
    );
  });

  it("clears Runtime Export state back to no-model with disabled selection", () => {
    const session = new RuntimePlayerVariantSessionState();
    session.setRuntimeExportPayload(createPayload(), NOW);
    session.selectSingle({
      variantGroupId: "vgrp_expression",
      variantId: "var_smile"
    }, NOW);

    const status = session.clearRuntimeExport(NOW);

    expect(status.state).toBe("no-model");
    expect(status.controlsEnabled).toBe(false);
    expect(status.groups).toEqual([]);
    expect(status.activeVariantSelection).toMatchObject({
      state: "disabled",
      activeSelections: []
    });
  });

  it("loads a second Runtime Export from its defaults after local mutation", () => {
    const session = new RuntimePlayerVariantSessionState();
    session.setRuntimeExportPayload(createPayload(), NOW);
    session.selectSingle({
      variantGroupId: "vgrp_expression",
      variantId: "var_smile"
    }, NOW);
    session.toggleMulti({
      variantGroupId: "vgrp_accessory",
      variantId: "var_cat_ears",
      active: true
    }, NOW);

    const status = session.setRuntimeExportPayload(
      createPayload({
        variants: createVariants({
          expressionDefault: "var_expression_default",
          accessoryDefaults: []
        })
      }),
      NOW
    );

    expect(status.activeVariantSelection.activeSelections).toEqual([
      {
        variantGroupId: "vgrp_expression",
        activeSelection: {
          kind: "singleSelect",
          variantId: "var_expression_default"
        }
      },
      {
        variantGroupId: "vgrp_accessory",
        activeSelection: {
          kind: "multiToggle",
          variantIds: []
        }
      }
    ]);
  });

  it("loads legacy exports but disables switching when baseVisible is incomplete", () => {
    const session = new RuntimePlayerVariantSessionState();
    const legacy = session.setRuntimeExportPayload(
      createPayload({
        drawables: createDrawables({ includeBaseVisible: false })
      }),
      NOW
    );

    expect(legacy.state).toBe("legacy-export");
    expect(legacy.controlsEnabled).toBe(false);
    expect(legacy.guidance).toContain("Re-export");
    expect(legacy.activeVariantSelection).toMatchObject({
      state: "disabled",
      activeSelections: []
    });
  });

  it("reports no-variants state for Runtime Exports without Variant Groups", () => {
    const session = new RuntimePlayerVariantSessionState();
    const status = session.setRuntimeExportPayload(
      createPayload({
        variants: undefined
      }),
      NOW
    );

    expect(status.state).toBe("no-variants");
    expect(status.controlsEnabled).toBe(false);
    expect(status.groups).toEqual([]);
  });
});

const NOW = "2026-06-24T00:00:00.000Z";

function createPayload(input: {
  readonly drawables?: RuntimeExportModelDto["drawables"];
  readonly variants?: RuntimeExportModelDto["variants"];
} = {}): RuntimeExportLoadedPayload {
  return {
    artifacts: {
      model: {
        drawables: input.drawables ?? createDrawables(),
        variants: input.variants === undefined && !("variants" in input)
          ? createVariants()
          : input.variants
      } as RuntimeExportModelDto
    }
  } as RuntimeExportLoadedPayload;
}

function createDrawables(input: {
  readonly includeBaseVisible?: boolean;
} = {}): RuntimeExportModelDto["drawables"] {
  const includeBaseVisible = input.includeBaseVisible ?? true;
  return [
    createDrawable("draw_expression_default", includeBaseVisible, true),
    createDrawable("draw_smile", includeBaseVisible, true),
    createDrawable("draw_glasses", includeBaseVisible, true),
    createDrawable("draw_cat_ears", includeBaseVisible, true),
    createDrawable("draw_base_hidden", includeBaseVisible, false)
  ] as RuntimeExportModelDto["drawables"];
}

function createDrawable(
  drawableId: string,
  includeBaseVisible: boolean,
  baseVisible: boolean
): RuntimeExportModelDto["drawables"][number] {
  return {
    drawableId,
    visible: baseVisible,
    ...(includeBaseVisible ? { baseVisible } : {})
  } as RuntimeExportModelDto["drawables"][number];
}

function createVariants(input: {
  readonly expressionDefault?: "var_expression_default" | "var_smile";
  readonly accessoryDefaults?: readonly ("var_glasses" | "var_cat_ears")[];
} = {}): RuntimeExportModelDto["variants"] {
  const expressionDefault = input.expressionDefault ??
    "var_expression_default";
  const accessoryDefaults = input.accessoryDefaults ?? ["var_glasses"];

  return {
    schemaVersion: "runtime-export-variants-v0",
    variantGroups: [
      {
        variantGroupId: "vgrp_expression",
        displayName: "Expression",
        mode: "singleSelect",
        variants: [
          {
            variantId: "var_expression_default",
            displayName: "Default"
          },
          {
            variantId: "var_smile",
            displayName: "Smile"
          }
        ],
        targetDrawableIds: [
          drawableId("draw_expression_default"),
          drawableId("draw_smile")
        ],
        memberships: [
          {
            drawableId: drawableId("draw_expression_default"),
            variantIds: ["var_expression_default"]
          },
          {
            drawableId: drawableId("draw_smile"),
            variantIds: ["var_smile"]
          }
        ],
        defaultActive: {
          kind: "singleSelect",
          variantId: expressionDefault
        }
      },
      {
        variantGroupId: "vgrp_accessory",
        displayName: "Accessory",
        mode: "multiToggle",
        variants: [
          {
            variantId: "var_glasses",
            displayName: "Glasses"
          },
          {
            variantId: "var_cat_ears",
            displayName: "Cat ears"
          }
        ],
        targetDrawableIds: [
          drawableId("draw_glasses"),
          drawableId("draw_cat_ears")
        ],
        memberships: [
          {
            drawableId: drawableId("draw_glasses"),
            variantIds: ["var_glasses"]
          },
          {
            drawableId: drawableId("draw_cat_ears"),
            variantIds: ["var_cat_ears"]
          }
        ],
        defaultActive: {
          kind: "multiToggle",
          variantIds: [...accessoryDefaults]
        }
      }
    ],
    defaultActiveSelections: [
      {
        variantGroupId: "vgrp_expression",
        activeSelection: {
          kind: "singleSelect",
          variantId: expressionDefault
        }
      },
      {
        variantGroupId: "vgrp_accessory",
        activeSelection: {
          kind: "multiToggle",
          variantIds: [...accessoryDefaults]
        }
      }
    ]
  };
}

function drawableId(value: string): DrawableId {
  return value as DrawableId;
}
