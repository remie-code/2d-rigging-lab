import { describe, expect, it } from "vitest";

import { RUNTIME_EXPORT_RAW_RGBA_MEDIA_TYPE } from "@private-2d-rigging-lab/package-format";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import { createEvaluatedRuntimeExportStageRenderInput } from "./evaluated-runtime-export-stage-scene";
import { createRuntimeExportStageRenderInput } from "./runtime-export-stage-scene";
import { createStageViewport } from "./stage-viewport";

type TestPoint = {
  readonly x: number;
  readonly y: number;
};

type TestRect = TestPoint & {
  readonly width: number;
  readonly height: number;
};

type TestDrawable = {
  readonly drawableId: string;
  readonly displayName: string;
  readonly meshId: string;
  readonly partId: string;
  readonly includeReason: "runtime-target-v1" | "mask-source-v1";
  readonly visible: boolean;
  readonly opacity: number;
  readonly baseDrawOrder: number;
  readonly bounds: TestRect;
  readonly texture: TestTextureReference;
};

type TestMesh = {
  readonly meshId: string;
  readonly drawableId: string;
  readonly vertices: readonly TestPoint[];
  readonly atlasUvs: readonly TestPoint[];
  readonly uvSpace: "atlas-normalized-v1";
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly vertexStableIds: readonly string[];
  readonly bounds: TestRect;
  readonly texture: TestTextureReference;
};

type TestDrawOrderEntry = {
  readonly drawableId: string;
  readonly drawOrder: number;
};

type TestParameter = {
  readonly parameterId: string;
  readonly displayName: string;
  readonly semanticRole: "face";
  readonly valueSource: "authoredInput";
  readonly runtimeRole: "external-input";
  readonly externalInput: true;
  readonly readOnly: false;
  readonly min: number;
  readonly max: number;
  readonly default: number;
};

type TestKeyformBinding = {
  readonly evaluator: "linear-1d-v1";
  readonly keyformSetId: string;
  readonly targetId: string;
  readonly targetKind: "mesh" | "drawable";
  readonly targetProperty: "vertices" | "opacity" | "drawOrder";
  readonly parameterId: string;
  readonly keys: readonly {
    readonly value: number;
    readonly statePatch: unknown;
  }[];
  readonly compositionMode: "replace";
  readonly compositionOrder: number;
};

type TestMaskRelation = {
  readonly maskRelationId: string;
  readonly sourceDrawableIds: readonly string[];
  readonly targetDrawableIds: readonly string[];
  readonly clippingMode: "alpha-mask-v1";
  readonly coordinateSpace: "canvas-y-down-v1";
};

type TestTextureReference = {
  readonly pageId: string;
  readonly path: string;
  readonly placementId: string;
};

describe("stage scene adapter", () => {
  it("preserves raw texture bytes and materialized atlas uvs", () => {
    const textureBytes = Uint8Array.from([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 255, 255
    ]);
    const renderInput = createRuntimeExportStageRenderInput(
      createStagePayload({ textureBytes })
    );

    expect(renderInput.scene.textureSources).toHaveLength(1);
    expect(renderInput.scene.textureSources[0]).toMatchObject({
      kind: "rgba8",
      textureId: "tex_atlas_page_0",
      width: 2,
      height: 2,
      bytes: textureBytes,
      alphaMode: "straight",
      source: {
        binaryAssetId: "bin_atlas_page_0",
        binaryAssetPath: "assets/textures/atlas_page_0.raw-rgba"
      }
    });
    expect(renderInput.scene.textureSources[0]?.contentSignature).toMatch(
      /^rgba8-fnv1a32:[0-9a-f]{8}$/
    );

    const body = renderInput.scene.drawables.find((drawable) =>
      drawable.drawableId === "draw_body"
    );
    expect(body?.mesh.uvs).toEqual([
      { x: 0.2, y: 0.3 },
      { x: 0.7, y: 0.3 },
      { x: 0.2, y: 0.8 }
    ]);
  });

  it("maps draw order, opacity, visibility, and clipping relations", () => {
    const renderInput = createRuntimeExportStageRenderInput(createStagePayload({
      drawables: [
        createDrawable("draw_body", "mesh_body", {
          opacity: 0.625,
          visible: true,
          baseDrawOrder: 0
        }),
        createDrawable("draw_mask", "mesh_mask", {
          opacity: 0.4,
          visible: false,
          baseDrawOrder: 10
        })
      ],
      meshes: [
        createMesh("mesh_body", "draw_body", [
          { x: 0.2, y: 0.3 },
          { x: 0.7, y: 0.3 },
          { x: 0.2, y: 0.8 }
        ]),
        createMesh("mesh_mask", "draw_mask", [
          { x: 0.1, y: 0.1 },
          { x: 0.9, y: 0.1 },
          { x: 0.1, y: 0.9 }
        ])
      ],
      drawOrder: [
        { drawableId: "draw_body", drawOrder: 4 },
        { drawableId: "draw_mask", drawOrder: 8 }
      ],
      masks: [
        {
          maskRelationId: "mask_body",
          sourceDrawableIds: ["draw_mask"],
          targetDrawableIds: ["draw_body"],
          clippingMode: "alpha-mask-v1",
          coordinateSpace: "canvas-y-down-v1"
        }
      ]
    }));

    expect(renderInput.scene.drawables.map((drawable) => drawable.drawableId)).toEqual([
      "draw_mask",
      "draw_body"
    ]);
    expect(renderInput.scene.drawables.map((drawable) => drawable.drawOrder)).toEqual([
      8,
      4
    ]);

    const body = renderInput.scene.drawables.find((drawable) =>
      drawable.drawableId === "draw_body"
    );
    expect(body).toMatchObject({
      opacity: 0.625,
      visible: true,
      clipping: {
        mode: "drawable-alpha-mask-v0",
        maskDrawableIds: ["draw_mask"]
      }
    });

    const mask = renderInput.scene.drawables.find((drawable) =>
      drawable.drawableId === "draw_mask"
    );
    expect(mask).toMatchObject({
      opacity: 0.4,
      visible: false
    });
    expect(mask?.clipping).toBeUndefined();
  });

  it("maps evaluated default pose data for Stage rendering", () => {
    const textureBytes = Uint8Array.from([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 255, 255
    ]);
    const payload = createStagePayload({
      textureBytes,
      parameters: [createParameter("param_pose_default", 1)],
      keyforms: [
        createMeshKeyform("param_pose_default"),
        createOpacityKeyform("param_pose_default"),
        createDrawOrderKeyform("param_pose_default")
      ]
    });
    const rawRenderInput = createRuntimeExportStageRenderInput(payload);
    const evaluatedRenderInput = createEvaluatedRuntimeExportStageRenderInput(payload);
    const rawBody = rawRenderInput.scene.drawables.find((drawable) =>
      drawable.drawableId === "draw_body"
    );
    const evaluatedBody = evaluatedRenderInput.scene.drawables.find((drawable) =>
      drawable.drawableId === "draw_body"
    );

    expect(rawBody).toMatchObject({
      opacity: 1,
      drawOrder: 3,
      mesh: {
        vertices: createRestVertices()
      }
    });
    expect(evaluatedRenderInput.scene.textureSources[0]).toMatchObject({
      kind: "rgba8",
      textureId: "tex_atlas_page_0",
      bytes: textureBytes,
      alphaMode: "straight"
    });
    expect(evaluatedBody).toMatchObject({
      opacity: 0.25,
      drawOrder: 12,
      visible: true,
      mesh: {
        vertices: createDeformedVertices(),
        uvs: [
          { x: 0.2, y: 0.3 },
          { x: 0.7, y: 0.3 },
          { x: 0.2, y: 0.8 }
        ],
        triangles: [[0, 1, 2]]
      }
    });
    expect(evaluatedBody?.mesh.vertices).not.toEqual(rawBody?.mesh.vertices);
    expect(evaluatedRenderInput.modelBounds).toEqual({
      x: 0,
      y: 0,
      width: 64,
      height: 64
    });
    expect("renderFrame" in evaluatedRenderInput.poseEvaluation).toBe(true);
  });

  it("fits and centers model bounds in the stage viewport", () => {
    const viewport = createStageViewport({
      viewportWidth: 400,
      viewportHeight: 200,
      paddingRatio: 0.1,
      modelBounds: {
        x: 10,
        y: 20,
        width: 100,
        height: 50
      }
    });

    expect(viewport).toEqual({
      width: 400,
      height: 200,
      stageToViewport: {
        scale: 3.2,
        translate: {
          x: 8,
          y: -44
        }
      }
    });
  });
});

function createStagePayload(input: {
  readonly textureBytes?: Uint8Array;
  readonly drawables?: readonly TestDrawable[];
  readonly meshes?: readonly TestMesh[];
  readonly drawOrder?: readonly TestDrawOrderEntry[];
  readonly masks?: readonly TestMaskRelation[];
  readonly parameters?: readonly TestParameter[];
  readonly keyforms?: readonly TestKeyformBinding[];
} = {}): RuntimeExportLoadedPayload {
  const textureBytes = input.textureBytes ?? new Uint8Array(16);
  const page = createTexturePage(textureBytes);
  const sourcePackage = {
    packageId: "pkg_stage_adapter",
    packageDisplayName: "Stage Adapter Model",
    packageRevision: 1,
    packageHash: "hash_stage_adapter"
  };
  const canvas = {
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
  };
  const renderAssumptions = createRenderAssumptions();
  const drawables = input.drawables ?? [
    createDrawable("draw_body", "mesh_body")
  ];
  const meshes = input.meshes ?? [
    createMesh("mesh_body", "draw_body", [
      { x: 0.2, y: 0.3 },
      { x: 0.7, y: 0.3 },
      { x: 0.2, y: 0.8 }
    ])
  ];
  const drawOrder = input.drawOrder ?? [
    { drawableId: "draw_body", drawOrder: 3 }
  ];

  return {
    artifacts: {
      manifest: {
        schemaVersion: "runtime-export-manifest-v0",
        exportFormatVersion: "runtime-export-v0",
        sourcePackage,
        createdAt: "2026-06-22T00:00:00.000Z",
        paths: {
          manifest: "runtime-export.json",
          model: "runtime/model.json",
          atlas: "runtime/atlas.json",
          texturePages: [page.path]
        },
        canvas,
        modelBounds: {
          x: 0,
          y: 0,
          width: 64,
          height: 64
        },
        texturePages: [page],
        requiredCapabilities: [
          "directory-runtime-export-v0",
          "raw-rgba8-texture-pages-v1",
          "materialized-atlas-uvs-v1",
          "transparent-background-v1",
          "alpha-mask-clipping-v1",
          "dynamics-pendulum-solver-v1"
        ],
        renderAssumptions
      },
      model: {
        schemaVersion: "runtime-export-model-v0",
        sourcePackage,
        canvas,
        modelBounds: {
          x: 0,
          y: 0,
          width: 64,
          height: 64
        },
        texturePages: [toTexturePageReference(page)],
        parameters: input.parameters ?? [],
        inputManifest: {
          externalInputParameterIds:
            input.parameters?.map((parameter) => parameter.parameterId) ?? [],
          computedDynamicsOutputParameterIds: [],
          hiddenDirectControlParameterIds: []
        },
        drawables,
        meshes,
        drawOrder,
        masks: input.masks ?? [],
        rigControls: [],
        keyforms: input.keyforms ?? [],
        dynamicsSolver: renderAssumptions.dynamics,
        dynamicsGroups: [],
        renderAssumptions
      },
      atlas: {
        schemaVersion: "runtime-export-atlas-v0",
        sourceSignature: {
          schemaVersion: "texture-atlas-source-signature-v1",
          inputVersion: "atlas-source-inputs-v1",
          algorithmId: "stable-json-fnv1a32-v1",
          digest: "fnv1a32:0123abcd",
          boundDrawableIds: drawables.map((drawable) => drawable.drawableId),
          packableDrawableIds: drawables.map((drawable) => drawable.drawableId)
        },
        settings: {
          algorithmId: "single-page-shelf-v1",
          pageWidth: 2,
          pageHeight: 2,
          paddingPixels: 0,
          edgeExtrusion: {
            enabled: true,
            pixels: 0
          }
        },
        pages: [page],
        placements: drawables.map((drawable) => ({
          placementId: drawable.texture.placementId,
          pageId: page.pageId,
          drawableId: drawable.drawableId,
          meshId: drawable.meshId,
          originalTextureId: `tex_${drawable.drawableId}`,
          atlasTextureId: page.textureId,
          sourceTextureSize: {
            width: 2,
            height: 2
          },
          sourceRectPixels: {
            x: 0,
            y: 0,
            width: 2,
            height: 2
          },
          contentRectPixels: {
            x: 0,
            y: 0,
            width: 2,
            height: 2
          },
          paddedRectPixels: {
            x: 0,
            y: 0,
            width: 2,
            height: 2
          },
          uvRect: {
            topLeft: {
              x: 0,
              y: 0
            },
            bottomRight: {
              x: 1,
              y: 1
            }
          },
          hiddenAtApply: false,
          hiddenReasons: [],
          runtimeTexturePagePath: page.path
        }))
      }
    },
    texturePage: {
      metadata: page,
      bytes: textureBytes
    },
    summary: {
      modelDisplayName: sourcePackage.packageDisplayName,
      packageId: sourcePackage.packageId,
      packageRevision: sourcePackage.packageRevision,
      drawableCount: drawables.length,
      meshCount: meshes.length,
      parameterCount: input.parameters?.length ?? 0,
      maskCount: input.masks?.length ?? 0,
      texturePage: {
        pageId: page.pageId,
        path: page.path,
        width: page.width,
        height: page.height,
        pixelFormat: page.pixelFormat,
        byteLength: page.byteLength
      },
      requiredCapabilities: [
        "directory-runtime-export-v0",
        "raw-rgba8-texture-pages-v1",
        "materialized-atlas-uvs-v1",
        "transparent-background-v1",
        "alpha-mask-clipping-v1",
        "dynamics-pendulum-solver-v1"
      ]
    },
    loadedAtIso: "2026-06-22T00:00:00.000Z"
  } as unknown as RuntimeExportLoadedPayload;
}

function createParameter(
  parameterId: string,
  defaultValue: number
): TestParameter {
  return {
    parameterId,
    displayName: "Default Pose",
    semanticRole: "face",
    valueSource: "authoredInput",
    runtimeRole: "external-input",
    externalInput: true,
    readOnly: false,
    min: -1,
    max: 1,
    default: defaultValue
  };
}

function createDrawable(
  drawableId: string,
  meshId: string,
  options: {
    readonly opacity?: number;
    readonly visible?: boolean;
    readonly baseDrawOrder?: number;
  } = {}
): TestDrawable {
  return {
    drawableId,
    displayName: drawableId,
    meshId,
    partId: "part_root",
    includeReason: drawableId.includes("mask")
      ? "mask-source-v1"
      : "runtime-target-v1",
    visible: options.visible ?? true,
    opacity: options.opacity ?? 1,
    baseDrawOrder: options.baseDrawOrder ?? 0,
    bounds: {
      x: 0,
      y: 0,
      width: 32,
      height: 32
    },
    texture: {
      pageId: "atlas_page_0",
      path: "assets/textures/atlas_page_0.raw-rgba",
      placementId: `place_${drawableId}`
    }
  };
}

function createMesh(
  meshId: string,
  drawableId: string,
  atlasUvs: readonly { readonly x: number; readonly y: number }[]
): TestMesh {
  return {
    meshId,
    drawableId,
    vertices: createRestVertices(),
    atlasUvs: atlasUvs.map((uv) => ({
      x: uv.x,
      y: uv.y
    })),
    uvSpace: "atlas-normalized-v1",
    triangles: [[0, 1, 2]],
    vertexStableIds: ["v0", "v1", "v2"],
    bounds: {
      x: 0,
      y: 0,
      width: 32,
      height: 32
    },
    texture: {
      pageId: "atlas_page_0",
      path: "assets/textures/atlas_page_0.raw-rgba",
      placementId: `place_${drawableId}`
    }
  };
}

function createMeshKeyform(parameterId: string): TestKeyformBinding {
  return {
    evaluator: "linear-1d-v1",
    keyformSetId: "keyset_stage_body_vertices",
    targetId: "mesh_body",
    targetKind: "mesh",
    targetProperty: "vertices",
    parameterId,
    keys: [
      {
        value: 0,
        statePatch: createRestVertices()
      },
      {
        value: 1,
        statePatch: createDeformedVertices()
      }
    ],
    compositionMode: "replace",
    compositionOrder: 0
  };
}

function createOpacityKeyform(parameterId: string): TestKeyformBinding {
  return {
    evaluator: "linear-1d-v1",
    keyformSetId: "keyset_stage_body_opacity",
    targetId: "draw_body",
    targetKind: "drawable",
    targetProperty: "opacity",
    parameterId,
    keys: [
      {
        value: 0,
        statePatch: 1
      },
      {
        value: 1,
        statePatch: 0.25
      }
    ],
    compositionMode: "replace",
    compositionOrder: 1
  };
}

function createDrawOrderKeyform(parameterId: string): TestKeyformBinding {
  return {
    evaluator: "linear-1d-v1",
    keyformSetId: "keyset_stage_body_draw_order",
    targetId: "draw_body",
    targetKind: "drawable",
    targetProperty: "drawOrder",
    parameterId,
    keys: [
      {
        value: 0,
        statePatch: 3
      },
      {
        value: 1,
        statePatch: 12
      }
    ],
    compositionMode: "replace",
    compositionOrder: 2
  };
}

function createTexturePage(textureBytes: Uint8Array) {
  return {
    pageId: "atlas_page_0",
    path: "assets/textures/atlas_page_0.raw-rgba",
    textureId: "tex_atlas_page_0",
    width: 2,
    height: 2,
    pixelFormat: "rgba8",
    mediaType: RUNTIME_EXPORT_RAW_RGBA_MEDIA_TYPE,
    byteLength: textureBytes.byteLength,
    digest: {
      algorithm: "sha256",
      hex: "0123456789abcdef".repeat(4)
    },
    binaryAssetId: "bin_atlas_page_0"
  } as const;
}

function createRestVertices() {
  return [
    { x: 0, y: 0 },
    { x: 32, y: 0 },
    { x: 0, y: 32 }
  ];
}

function createDeformedVertices() {
  return [
    { x: -8, y: 1 },
    { x: 96, y: 3 },
    { x: 1, y: 90 }
  ];
}

function toTexturePageReference(page: ReturnType<typeof createTexturePage>) {
  return {
    pageId: page.pageId,
    path: page.path,
    width: page.width,
    height: page.height,
    pixelFormat: page.pixelFormat
  };
}

function createRenderAssumptions() {
  return {
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
      solverVersion: "runtime-dynamics-pendulum-v1",
      fixedStepMs: 1000 / 60,
      resetPolicy: "reset-to-default-parameters-v1"
    }
  } as const;
}
