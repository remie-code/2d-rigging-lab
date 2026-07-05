import { describe, expect, it } from "vitest";

import type {
  DrawableId,
  PackageId
} from "@private-2d-rigging-lab/contracts";
import type {
  RuntimeExportModelDto
} from "@private-2d-rigging-lab/package-format";

import type {
  RuntimePlayerActiveVariantSelectionState
} from "../../preload/runtime-variant-bridge-contract";
import { createRuntimeExportRuntimeGraph } from "./runtime-export-runtime-graph-adapter";

describe("Runtime Export Variant visibility evaluation", () => {
  it("uses baseVisible and active Variant predicate for new Runtime Exports", () => {
    const graph = createRuntimeExportRuntimeGraph({
      model: createModel(),
      activeVariantSelection: createActiveSelection({
        expression: "var_smile",
        accessories: ["var_glasses", "var_cat_ears"]
      })
    }).graph;

    expect(graph.drawables.get(
      drawableId("draw_expression_default")
    )?.visible).toBe(false);
    expect(graph.drawables.get(drawableId("draw_smile"))?.visible).toBe(true);
    expect(graph.drawables.get(drawableId("draw_glasses"))?.visible).toBe(true);
    expect(graph.drawables.get(drawableId("draw_cat_ears"))?.visible).toBe(true);
    expect(graph.drawables.get(drawableId("draw_non_variant"))?.visible).toBe(true);
  });

  it("keeps baseVisible=false drawables hidden even when active Variant includes them", () => {
    const graph = createRuntimeExportRuntimeGraph({
      model: createModel(),
      activeVariantSelection: createActiveSelection({
        expression: "var_smile",
        accessories: ["var_cat_ears"]
      })
    }).graph;

    expect(graph.drawables.get(
      drawableId("draw_base_hidden")
    )?.visible).toBe(false);
  });

  it("falls back to exported visible for legacy Runtime Exports without complete baseVisible", () => {
    const graph = createRuntimeExportRuntimeGraph({
      model: createModel({
        includeBaseVisible: false,
        smileVisible: false
      }),
      activeVariantSelection: createActiveSelection({
        expression: "var_smile",
        accessories: ["var_cat_ears"]
      })
    }).graph;

    expect(graph.drawables.get(drawableId("draw_smile"))?.visible).toBe(false);
    expect(graph.drawables.get(
      drawableId("draw_expression_default")
    )?.visible).toBe(true);
  });
});

function createActiveSelection(input: {
  readonly expression: "var_expression_default" | "var_smile";
  readonly accessories: readonly ("var_glasses" | "var_cat_ears")[];
}): RuntimePlayerActiveVariantSelectionState {
  return {
    schemaVersion: "runtime-player-active-variant-selection-v1",
    state: "ready",
    updatedAtIso: "2026-06-24T00:00:00.000Z",
    activeSelections: [
      {
        variantGroupId: "vgrp_expression",
        activeSelection: {
          kind: "singleSelect",
          variantId: input.expression
        }
      },
      {
        variantGroupId: "vgrp_accessory",
        activeSelection: {
          kind: "multiToggle",
          variantIds: [...input.accessories]
        }
      }
    ]
  };
}

function createModel(input: {
  readonly includeBaseVisible?: boolean;
  readonly smileVisible?: boolean;
} = {}): RuntimeExportModelDto {
  const includeBaseVisible = input.includeBaseVisible ?? true;
  const drawables = [
    createDrawable("draw_expression_default", {
      includeBaseVisible,
      baseVisible: true,
      visible: true
    }),
    createDrawable("draw_smile", {
      includeBaseVisible,
      baseVisible: true,
      visible: input.smileVisible ?? true
    }),
    createDrawable("draw_glasses", {
      includeBaseVisible,
      baseVisible: true,
      visible: false
    }),
    createDrawable("draw_cat_ears", {
      includeBaseVisible,
      baseVisible: true,
      visible: false
    }),
    createDrawable("draw_base_hidden", {
      includeBaseVisible,
      baseVisible: false,
      visible: false
    }),
    createDrawable("draw_non_variant", {
      includeBaseVisible,
      baseVisible: true,
      visible: true
    })
  ];

  return {
    schemaVersion: "runtime-export-model-v0",
    sourcePackage: {
      packageId: packageId("pkg_variant_visibility"),
      packageDisplayName: "Variant Visibility",
      packageRevision: 1
    },
    canvas: {
      coordinateSystem: "canvas-y-down-v1",
      size: {
        width: 128,
        height: 128
      },
      bounds: {
        x: 0,
        y: 0,
        width: 128,
        height: 128
      }
    },
    modelBounds: {
      x: 0,
      y: 0,
      width: 64,
      height: 64
    },
    texturePages: [
      {
        pageId: "atlas_page_0",
        path: "assets/textures/atlas_page_0.raw-rgba",
        width: 2,
        height: 2,
        pixelFormat: "rgba8"
      }
    ],
    parameters: [],
    inputManifest: {
      externalInputParameterIds: [],
      computedDynamicsOutputParameterIds: [],
      hiddenDirectControlParameterIds: []
    },
    drawables,
    meshes: drawables.map((drawable) =>
      createMesh(`mesh_${drawable.drawableId}`, drawable.drawableId)
    ),
    drawOrder: drawables.map((drawable, index) => ({
      drawableId: drawable.drawableId,
      drawOrder: index
    })),
    masks: [],
    rigControls: [],
    keyforms: [],
    dynamicsSolver: {
      solverVersion: "runtime-dynamics-chain-v1",
      fixedStepMs: 1000 / 60,
      resetPolicy: "reset-to-default-parameters-v1"
    },
    dynamicsGroups: [],
    variants: createVariants(),
    renderAssumptions: {
      transparentBackground: true,
      pixelFormat: "rgba8",
      alphaMode: "straight-alpha-v1",
      colorSpace: "srgb-v1",
      textureFiltering: "linear-v1",
      blendMode: "source-over-v1",
      masking: {
        clippingMode: "alpha-mask-v1",
        coordinateSpace: "canvas-y-down-v1",
        maskChannels: "alpha-v1"
      },
      dynamics: {
        solverVersion: "runtime-dynamics-chain-v1",
        fixedStepMs: 1000 / 60,
        resetPolicy: "reset-to-default-parameters-v1"
      }
    }
  } as RuntimeExportModelDto;
}

function createDrawable(
  drawableId: string,
  input: {
    readonly includeBaseVisible: boolean;
    readonly baseVisible: boolean;
    readonly visible: boolean;
  }
): RuntimeExportModelDto["drawables"][number] {
  return {
    drawableId,
    displayName: drawableId,
    meshId: `mesh_${drawableId}`,
    includeReason: "runtime-target-v1",
    ...(input.includeBaseVisible ? { baseVisible: input.baseVisible } : {}),
    visible: input.visible,
    opacity: 1,
    baseDrawOrder: 0,
    bounds: {
      x: 0,
      y: 0,
      width: 32,
      height: 32
    },
    texture: {
      pageId: "atlas_page_0",
      path: "assets/textures/atlas_page_0.raw-rgba",
      placementId: `atlas_place_${drawableId}`
    }
  } as RuntimeExportModelDto["drawables"][number];
}

function createMesh(
  meshId: string,
  drawableId: string
): RuntimeExportModelDto["meshes"][number] {
  return {
    meshId,
    drawableId,
    vertices: [
      { x: 0, y: 0 },
      { x: 32, y: 0 },
      { x: 0, y: 32 }
    ],
    atlasUvs: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 }
    ],
    uvSpace: "atlas-normalized-v1",
    triangles: [[0, 1, 2]],
    vertexStableIds: ["vtx_0", "vtx_1", "vtx_2"],
    bounds: {
      x: 0,
      y: 0,
      width: 32,
      height: 32
    },
    texture: {
      pageId: "atlas_page_0",
      path: "assets/textures/atlas_page_0.raw-rgba",
      placementId: `atlas_place_${drawableId}`
    }
  } as RuntimeExportModelDto["meshes"][number];
}

function createVariants(): RuntimeExportModelDto["variants"] {
  return {
    schemaVersion: "runtime-export-variants-v0",
    variantGroups: [
      {
        variantGroupId: "vgrp_expression",
        displayName: "Expression",
        mode: "singleSelect",
        variants: [
          { variantId: "var_expression_default", displayName: "Default" },
          { variantId: "var_smile", displayName: "Smile" }
        ],
        targetDrawableIds: [
          drawableId("draw_expression_default"),
          drawableId("draw_smile"),
          drawableId("draw_base_hidden")
        ],
        memberships: [
          {
            drawableId: drawableId("draw_expression_default"),
            variantIds: ["var_expression_default"]
          },
          {
            drawableId: drawableId("draw_smile"),
            variantIds: ["var_smile"]
          },
          {
            drawableId: drawableId("draw_base_hidden"),
            variantIds: ["var_smile"]
          }
        ],
        defaultActive: {
          kind: "singleSelect",
          variantId: "var_expression_default"
        }
      },
      {
        variantGroupId: "vgrp_accessory",
        displayName: "Accessory",
        mode: "multiToggle",
        variants: [
          { variantId: "var_glasses", displayName: "Glasses" },
          { variantId: "var_cat_ears", displayName: "Cat ears" }
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
          variantIds: []
        }
      }
    ],
    defaultActiveSelections: [
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
    ]
  };
}

function drawableId(value: string): DrawableId {
  return value as DrawableId;
}

function packageId(value: string): PackageId {
  return value as PackageId;
}
