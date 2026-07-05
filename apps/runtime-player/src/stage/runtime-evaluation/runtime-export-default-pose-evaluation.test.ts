import { describe, expect, it } from "vitest";

import type {
  DrawableId,
  DynamicsGroupId,
  ParameterId,
  RigControlId
} from "@private-2d-rigging-lab/contracts";
import {
  RUNTIME_EXPORT_RAW_RGBA_MEDIA_TYPE,
  type RuntimeExportAtlasDto,
  type RuntimeExportDrawableDto,
  type RuntimeExportDynamicsGroupDto,
  type RuntimeExportKeyformBindingDto,
  type RuntimeExportMeshDto,
  type RuntimeExportModelDto,
  type RuntimeExportParameterDto,
  type RuntimeExportRigControlDto,
  type RuntimeExportTexturePageMetadataDto
} from "@private-2d-rigging-lab/package-format";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import { createEvaluatedRuntimeExportStageRenderInput } from "../stage-renderer/evaluated-runtime-export-stage-scene";
import { evaluateRuntimeExportDefaultPose } from "./default-runtime-pose-evaluator";
import { createRuntimeExportRuntimeGraph } from "./runtime-export-runtime-graph-adapter";

describe("Runtime Export default pose evaluation", () => {
  it("converts Runtime Export fields into a runtime-core graph and render resources", () => {
    const payload = createRuntimeExportPayload({
      modelOverrides: {
        parameters: [
          createParameter("param_face_angle_x", {
            default: 1,
            projectPresetAlias: "face.angle.x"
          }),
          createParameter("param_hair_sway", {
            default: 0,
            valueSource: "computedDynamics",
            runtimeRole: "computed-dynamics-output",
            externalInput: false,
            readOnly: true
          })
        ],
        inputManifest: {
          externalInputParameterIds: [parameterId("param_face_angle_x")],
          computedDynamicsOutputParameterIds: [parameterId("param_hair_sway")],
          hiddenDirectControlParameterIds: [parameterId("param_hair_sway")]
        },
        rigControls: [
          createRotationRigControl({
            rigControlId: "rig_root_rotate",
            childDrawableIds: [],
            childRigControlIds: ["rig_body_rotate"]
          }),
          createRotationRigControl({
            parentId: "rig_root_rotate",
            childRigControlIds: ["rig_body_warp"]
          }),
          createWarpRigControl({
            parentId: "rig_body_rotate"
          })
        ],
        dynamicsGroups: [createDynamicsGroup()],
        keyforms: [
          createMeshKeyform(),
          createOpacityKeyform()
        ]
      }
    });
    const result = createRuntimeExportRuntimeGraph({
      model: payload.artifacts.model,
      atlas: payload.artifacts.atlas,
      texturePages: payload.artifacts.manifest.texturePages
    });

    expect([...result.graph.parameters.keys()]).toEqual([
      "param_face_angle_x",
      "param_hair_sway"
    ]);
    expect(result.graph.parameters.get(parameterId("param_face_angle_x"))).toMatchObject({
      displayName: "Face Angle X",
      semanticRole: "face",
      projectPresetAlias: "face.angle.x",
      valueSource: "authoredInput",
      min: -1,
      max: 1,
      default: 1
    });
    expect(result.graph.dynamicsGroups.get(dynamicsGroupId("dyn_hair_sway"))).toMatchObject({
      displayName: "Hair Sway",
      inputs: [
        {
          parameterId: "param_face_angle_x",
          kind: "angle",
          scale: 1
        }
      ],
      chain: {
        segmentLengths: [14],
        damping: 2.5,
        gravityScale: 1
      },
      outputs: [
        {
          parameterId: "param_hair_sway",
          segmentIndex: 1,
          scale: 0.5,
          limit: 1
        }
      ]
    });
    expect(result.graph.drawables.get(drawableId("draw_body"))).toMatchObject({
      meshId: "mesh_body",
      partId: "part_root",
      visible: true,
      opacity: 1,
      baseDrawOrder: 0,
      vertexCount: 3,
      vertices: createRestVertices(),
      uvs: createAtlasUvs(),
      triangles: [[0, 1, 2]],
      texture: {
        status: "resolved",
        textureId: "tex_atlas_page_0",
        projection: {
          kind: "uv",
          uvs: createAtlasUvs()
        }
      }
    });
    expect(result.graph.masks).toEqual([
      {
        maskRelationId: "maskrel_body",
        sourceDrawableIds: ["draw_mask"],
        targetDrawableIds: ["draw_body"]
      }
    ]);
    expect(result.graph.drawOrder).toEqual([
      { drawableId: "draw_mask", drawOrder: 10 },
      { drawableId: "draw_body", drawOrder: 0 }
    ]);
    expect(result.graph.rigControls.get(rigControlId("rig_body_rotate"))).toEqual({
      kind: "rotation2d",
      rigControlId: "rig_body_rotate",
      parentId: "rig_root_rotate",
      childDrawableIds: ["draw_body"],
      childRigControlIds: ["rig_body_warp"],
      opacityMultiplier: 0.9,
      pivot: {
        x: 16,
        y: 16
      },
      restAngleDegrees: 0,
      restTranslation: {
        x: 0,
        y: 0
      },
      restScale: {
        x: 1,
        y: 1
      },
      enabled: true
    });
    expect(result.graph.rigControls.get(rigControlId("rig_body_warp"))).toEqual({
      kind: "warpLattice2d",
      rigControlId: "rig_body_warp",
      parentId: "rig_body_rotate",
      childDrawableIds: ["draw_mask"],
      childRigControlIds: [],
      opacityMultiplier: 0.8,
      bindSpace: "rigControlLocalRest",
      domainBounds: {
        x: 0,
        y: 0,
        width: 32,
        height: 32
      },
      latticeColumns: 2,
      latticeRows: 2,
      restControlPoints: [
        { x: 0, y: 0 },
        { x: 32, y: 0 },
        { x: 0, y: 32 },
        { x: 32, y: 32 }
      ],
      interpolationMethod: "bilinear-grid-v1",
      enabled: true
    });
    expect(result.graph.keyformBindings).toHaveLength(2);
    expect(result.renderResources.texturePages).toEqual([
      {
        pageId: "atlas_page_0",
        path: "assets/textures/atlas_page_0.raw-rgba",
        textureId: "tex_atlas_page_0",
        width: 2,
        height: 2,
        pixelFormat: "rgba8"
      }
    ]);
    expect(result.renderResources.inputManifest).toEqual({
      externalInputParameterIds: ["param_face_angle_x"],
      computedDynamicsOutputParameterIds: ["param_hair_sway"],
      hiddenDirectControlParameterIds: ["param_hair_sway"]
    });
    expect(result.renderResources.drawableRenderResources.get(drawableId("draw_body"))).toMatchObject({
      drawableId: "draw_body",
      meshId: "mesh_body",
      restVertices: createRestVertices(),
      atlasUvs: createAtlasUvs(),
      triangles: [[0, 1, 2]]
    });
  });

  it("evaluates a full default pose snapshot from empty authored values", () => {
    const payload = createRuntimeExportPayload({
      modelOverrides: {
        parameters: [
          createParameter("param_face_angle_x", {
            default: 1,
            projectPresetAlias: "face.angle.x"
          })
        ],
        keyforms: [
          createMeshKeyform(),
          createOpacityKeyform(),
          createDrawOrderKeyform()
        ]
      }
    });
    const result = evaluateRuntimeExportDefaultPose({
      model: payload.artifacts.model,
      atlas: payload.artifacts.atlas,
      texturePages: payload.artifacts.manifest.texturePages
    });
    const body = result.snapshot.drawables.find((drawable) =>
      drawable.drawableId === "draw_body"
    );

    expect(result.initialState).toMatchObject({
      packageId: "pkg_runtime_player_default_pose",
      frameIndex: 0,
      fixedStepMs: 1000 / 60,
      accumulatorMs: 0
    });
    expect(result.snapshot.context).toEqual({
      source: {
        surface: "viewer"
      },
      policy: {
        strictness: "interactive"
      }
    });
    expect(result.snapshot.evaluation.snapshotDetail).toBe("full");
    expect(result.snapshot.parameters).toContainEqual({
      parameterId: "param_face_angle_x",
      valueSource: "authoredInput",
      baseValue: 1,
      effectiveValue: 1,
      clamped: false,
      source: "default"
    });
    expect(result.snapshot.keyformSamples.map((sample) => sample.keyformSetId)).toEqual([
      "keyset_body_vertices",
      "keyset_body_opacity",
      "keyset_body_draw_order"
    ]);
    expect(body).toMatchObject({
      drawableId: "draw_body",
      vertices: createDeformedVertices(),
      opacity: 0.25,
      evaluatedDrawOrder: 12,
      texture: {
        status: "resolved",
        textureId: "tex_atlas_page_0",
        projection: {
          kind: "uv",
          uvCount: 3,
          uvs: createAtlasUvs()
        }
      }
    });
    expect(body?.vertices).not.toEqual(createRestVertices());
    expect(result.snapshot.drawList).toContain("draw_body");
    expect(result.snapshot.diagnostics).toEqual([]);
  });

  it("evaluates a live render input from fast render frame output", () => {
    const payload = createRuntimeExportPayload({
      modelOverrides: {
        parameters: [
          createParameter("param_face_angle_x", {
            default: 0,
            projectPresetAlias: "face.angle.x"
          })
        ],
        keyforms: [createMeshKeyform()]
      }
    });
    const renderInput = createEvaluatedRuntimeExportStageRenderInput(
      payload,
      {
        authoredParameterValues: {
          param_face_angle_x: 1
        },
        frameIndex: 7,
        resetReasons: []
      }
    );
    const body = renderInput.scene.drawables.find((drawable) =>
      drawable.drawableId === "draw_body"
    );
    const renderFrame = getRenderFrame(renderInput);

    expect("snapshot" in renderInput.poseEvaluation).toBe(false);
    expect(renderFrame.drawables.find((drawable) =>
      drawable.drawableId === "draw_body"
    )).toMatchObject({
      vertices: createDeformedVertices(),
      opacity: 1
    });
    expect(body?.mesh.vertices).toEqual(createDeformedVertices());
    expect(
      renderInput.poseEvaluation.evaluationProfile.runtimeCoreProfile
    ).toBeUndefined();
    expect(
      renderInput.poseEvaluation.evaluationProfile
        .publicSnapshotMaterializationCount
    ).toBe(0);

    const profiledRenderInput = createEvaluatedRuntimeExportStageRenderInput(
      payload,
      {
        authoredParameterValues: {
          param_face_angle_x: 1
        },
        frameIndex: 8,
        resetReasons: [],
        runtimeCoreProfiling: "deep"
      }
    );

    expect(
      profiledRenderInput.poseEvaluation.evaluationProfile.runtimeCoreProfile
        ?.publicSnapshotMaterializationCount
    ).toBe(0);
    expect(
      profiledRenderInput.poseEvaluation.evaluationProfile
        .publicSnapshotMaterializationCount
    ).toBe(0);
    expect(
      profiledRenderInput.poseEvaluation.evaluationProfile.runtimeCoreProfile
        ?.runtimeCoreRenderFrameOutputDurationMs
    ).toBeGreaterThanOrEqual(0);
    expect(
      profiledRenderInput.poseEvaluation.evaluationProfile.runtimeCoreProfile
        ?.snapshotValidationDurationMs
    ).toBe(0);
  });

  it("evaluates Runtime Export rig controls and rig-control keyforms through runtime-core", () => {
    const payload = createRuntimeExportPayload({
      modelOverrides: {
        parameters: [
          createParameter("param_face_angle_x", {
            default: 1,
            projectPresetAlias: "face.angle.x"
          })
        ],
        rigControls: [
          createRotationRigControl({
            opacityMultiplier: 0.5,
            pivot: { x: 0, y: 0 }
          }),
          createWarpRigControl({
            opacityMultiplier: 0.8
          })
        ],
        keyforms: [
          createRigControlAngleKeyform(),
          createWarpControlPointOffsetsKeyform()
        ]
      }
    });
    const result = evaluateRuntimeExportDefaultPose({
      model: payload.artifacts.model,
      atlas: payload.artifacts.atlas,
      texturePages: payload.artifacts.manifest.texturePages
    });
    const body = result.snapshot.drawables.find((drawable) =>
      drawable.drawableId === "draw_body"
    );
    const mask = result.snapshot.drawables.find((drawable) =>
      drawable.drawableId === "draw_mask"
    );
    const rotation = result.snapshot.rigControls.find((rigControl) =>
      rigControl.rigControlId === "rig_body_rotate"
    );
    const warp = result.snapshot.rigControls.find((rigControl) =>
      rigControl.rigControlId === "rig_body_warp"
    );

    expect(result.snapshot.keyformSamples).toEqual([
      expect.objectContaining({
        keyformSetId: "keyset_body_rig_angle",
        target: "rigControl:rig_body_rotate.angleDegrees",
        targetMetadata: {
          targetId: "rig_body_rotate",
          targetKind: "rigControl",
          targetProperty: "angleDegrees"
        },
        statePatch: 90,
        samplingStatus: "exact"
      }),
      expect.objectContaining({
        keyformSetId: "keyset_mask_warp_offsets",
        target: "rigControl:rig_body_warp.controlPointOffsets",
        targetMetadata: {
          targetId: "rig_body_warp",
          targetKind: "rigControl",
          targetProperty: "controlPointOffsets"
        },
        statePatch: createUniformWarpOffsets(),
        samplingStatus: "exact"
      })
    ]);
    expect(rotation).toMatchObject({
      rigControlId: "rig_body_rotate",
      kind: "rotation2d",
      enabled: true,
      evaluationStatus: "evaluated",
      childDrawableIds: ["draw_body"],
      childRigControlIds: [],
      opacityMultiplier: 0.5,
      affectedDrawableIds: ["draw_body"],
      localTransform: {
        pivot: {
          x: 0,
          y: 0
        },
        angleDegrees: 90,
        translation: {
          x: 0,
          y: 0
        },
        scale: {
          x: 1,
          y: 1
        }
      },
      worldTransform: {
        angleDegrees: 90,
        translation: {
          x: 0,
          y: 0
        },
        scale: {
          x: 1,
          y: 1
        }
      }
    });
    expect(warp).toMatchObject({
      rigControlId: "rig_body_warp",
      kind: "warpLattice2d",
      enabled: true,
      evaluationStatus: "evaluated",
      childDrawableIds: ["draw_mask"],
      childRigControlIds: [],
      opacityMultiplier: 0.8,
      affectedDrawableIds: ["draw_mask"],
      bounds: {
        x: 0,
        y: 0,
        width: 32,
        height: 32
      }
    });
    expect(body).toMatchObject({
      drawableId: "draw_body",
      opacity: 0.5,
      vertices: [
        { x: 0, y: 0 },
        { x: 0, y: 32 },
        { x: -32, y: 0 }
      ]
    });
    expect(mask).toMatchObject({
      drawableId: "draw_mask",
      opacity: 0.4,
      vertices: [
        { x: 1, y: 2 },
        { x: 33, y: 2 },
        { x: 1, y: 34 }
      ]
    });
    expect(body?.vertices).not.toEqual(createRestVertices());
    expect(mask?.vertices).not.toEqual(createRestVertices());
    expect(result.snapshot.diagnostics).toEqual([]);
  });

  it("maps evaluated vertices, opacity, draw order, masks, and atlas UVs to render input", () => {
    const textureBytes = Uint8Array.from([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 255, 255
    ]);
    const payload = createRuntimeExportPayload({
      textureBytes,
      modelOverrides: {
        parameters: [
          createParameter("param_face_angle_x", {
            default: 1,
            projectPresetAlias: "face.angle.x"
          })
        ],
        keyforms: [
          createMeshKeyform(),
          createOpacityKeyform(),
          createDrawOrderKeyform()
        ]
      }
    });
    const renderInput = createEvaluatedRuntimeExportStageRenderInput(payload);
    const body = renderInput.scene.drawables.find((drawable) =>
      drawable.drawableId === "draw_body"
    );

    expect(renderInput.scene.textureSources[0]).toMatchObject({
      kind: "rgba8",
      textureId: "tex_atlas_page_0",
      bytes: textureBytes,
      alphaMode: "straight"
    });
    expect(body).toMatchObject({
      drawableId: "draw_body",
      opacity: 0.25,
      drawOrder: 12,
      visible: true,
      clipping: {
        mode: "drawable-alpha-mask-v0",
        maskDrawableIds: ["draw_mask"]
      },
      mesh: {
        vertices: createDeformedVertices(),
        uvs: createAtlasUvs(),
        triangles: [[0, 1, 2]]
      }
    });
    expect(renderInput.modelBounds).toEqual({
      x: 0,
      y: 0,
      width: 64,
      height: 64
    });
    expect(getRenderFrame(renderInput).drawables.find((drawable) =>
      drawable.drawableId === "draw_body"
    )).toMatchObject({
      drawOrder: 12,
      visible: true
    });
  });
});

type EvaluatedRuntimeExportStageRenderInput = ReturnType<
  typeof createEvaluatedRuntimeExportStageRenderInput
>;

function getRenderFrame(
  input: EvaluatedRuntimeExportStageRenderInput
): Extract<
  EvaluatedRuntimeExportStageRenderInput["poseEvaluation"],
  { readonly renderFrame: unknown }
>["renderFrame"] {
  if (!("renderFrame" in input.poseEvaluation)) {
    throw new Error("Expected render-frame pose evaluation.");
  }

  return input.poseEvaluation.renderFrame;
}

function createRuntimeExportPayload(input: {
  readonly textureBytes?: Uint8Array;
  readonly modelOverrides?: Partial<RuntimeExportModelDto>;
} = {}): RuntimeExportLoadedPayload {
  const textureBytes = input.textureBytes ?? new Uint8Array(16);
  const texturePage = createTexturePage(textureBytes);
  const sourcePackage = {
    packageId: "pkg_runtime_player_default_pose",
    packageDisplayName: "Runtime Player Default Pose",
    packageRevision: 3,
    packageHash: "hash_runtime_player_default_pose"
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
  const defaultDrawables = [
    createDrawable("draw_mask", "mesh_mask", {
      includeReason: "mask-source-v1",
      baseDrawOrder: 10,
      opacity: 0.5
    }),
    createDrawable("draw_body", "mesh_body", {
      includeReason: "runtime-target-v1",
      baseDrawOrder: 0
    })
  ];
  const defaultMeshes = [
    createMesh("mesh_mask", "draw_mask", createRestVertices()),
    createMesh("mesh_body", "draw_body", createRestVertices())
  ];
  const model = {
    schemaVersion: "runtime-export-model-v0",
    sourcePackage,
    canvas,
    modelBounds: {
      x: 0,
      y: 0,
      width: 64,
      height: 64
    },
    texturePages: [toTexturePageReference(texturePage)],
    parameters: input.modelOverrides?.parameters ?? [],
    inputManifest: input.modelOverrides?.inputManifest ?? {
      externalInputParameterIds: [],
      computedDynamicsOutputParameterIds: [],
      hiddenDirectControlParameterIds: []
    },
    drawables: input.modelOverrides?.drawables ?? defaultDrawables,
    meshes: input.modelOverrides?.meshes ?? defaultMeshes,
    drawOrder: input.modelOverrides?.drawOrder ?? [
      { drawableId: "draw_mask", drawOrder: 10 },
      { drawableId: "draw_body", drawOrder: 0 }
    ],
    masks: input.modelOverrides?.masks ?? [
      {
        maskRelationId: "maskrel_body",
        sourceDrawableIds: ["draw_mask"],
        targetDrawableIds: ["draw_body"],
        clippingMode: "alpha-mask-v1",
        coordinateSpace: "canvas-y-down-v1"
      }
    ],
    rigControls: input.modelOverrides?.rigControls ?? [],
    keyforms: input.modelOverrides?.keyforms ?? [],
    dynamicsSolver: renderAssumptions.dynamics,
    dynamicsGroups: input.modelOverrides?.dynamicsGroups ?? [],
    renderAssumptions
  } as unknown as RuntimeExportModelDto;
  const atlas = createAtlas({
    texturePage,
    drawables: model.drawables,
    meshes: model.meshes
  });

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
          texturePages: [texturePage.path]
        },
        canvas,
        modelBounds: model.modelBounds,
        texturePages: [texturePage],
        requiredCapabilities: [
          "directory-runtime-export-v0",
          "raw-rgba8-texture-pages-v1",
          "materialized-atlas-uvs-v1",
          "transparent-background-v1",
          "alpha-mask-clipping-v1",
          "dynamics-chain-solver-v1"
        ],
        renderAssumptions
      },
      model,
      atlas
    },
    texturePage: {
      metadata: texturePage,
      bytes: textureBytes
    },
    summary: {
      modelDisplayName: sourcePackage.packageDisplayName,
      packageId: sourcePackage.packageId,
      packageRevision: sourcePackage.packageRevision,
      drawableCount: model.drawables.length,
      meshCount: model.meshes.length,
      parameterCount: model.parameters.length,
      maskCount: model.masks.length,
      texturePage: {
        pageId: texturePage.pageId,
        path: texturePage.path,
        width: texturePage.width,
        height: texturePage.height,
        pixelFormat: texturePage.pixelFormat,
        byteLength: texturePage.byteLength
      },
      requiredCapabilities: [
        "directory-runtime-export-v0",
        "raw-rgba8-texture-pages-v1",
        "materialized-atlas-uvs-v1",
        "transparent-background-v1",
        "alpha-mask-clipping-v1",
        "dynamics-chain-solver-v1"
      ]
    },
    loadedAtIso: "2026-06-22T00:00:00.000Z"
  } as unknown as RuntimeExportLoadedPayload;
}

function createParameter(
  parameterId: string,
  options: Partial<RuntimeExportParameterDto> = {}
): RuntimeExportParameterDto {
  return {
    parameterId,
    displayName: options.displayName ?? "Face Angle X",
    semanticRole: options.semanticRole ?? "face",
    ...(options.projectPresetAlias === undefined
      ? {}
      : { projectPresetAlias: options.projectPresetAlias }),
    valueSource: options.valueSource ?? "authoredInput",
    runtimeRole: options.runtimeRole ?? "external-input",
    externalInput: options.externalInput ?? true,
    readOnly: options.readOnly ?? false,
    min: options.min ?? -1,
    max: options.max ?? 1,
    default: options.default ?? 0
  } as unknown as RuntimeExportParameterDto;
}

function createDrawable(
  drawableId: string,
  meshId: string,
  options: {
    readonly includeReason: "runtime-target-v1" | "mask-source-v1";
    readonly baseDrawOrder: number;
    readonly opacity?: number;
  }
): RuntimeExportDrawableDto {
  return {
    drawableId,
    displayName: drawableId,
    meshId,
    partId: "part_root",
    includeReason: options.includeReason,
    visible: true,
    opacity: options.opacity ?? 1,
    baseDrawOrder: options.baseDrawOrder,
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
  } as unknown as RuntimeExportDrawableDto;
}

function createMesh(
  meshId: string,
  drawableId: string,
  vertices: readonly { readonly x: number; readonly y: number }[]
): RuntimeExportMeshDto {
  return {
    meshId,
    drawableId,
    vertices: vertices.map((vertex) => ({ ...vertex })),
    atlasUvs: createAtlasUvs(),
    uvSpace: "atlas-normalized-v1",
    triangles: [[0, 1, 2]],
    vertexStableIds: ["vtx_0", "vtx_1", "vtx_2"],
    triangleStableIds: ["tri_0"],
    topologyRevision: 1,
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
  } as unknown as RuntimeExportMeshDto;
}

function createMeshKeyform(): RuntimeExportKeyformBindingDto {
  return {
    evaluator: "linear-1d-v1",
    keyformSetId: "keyset_body_vertices",
    targetId: "mesh_body",
    targetKind: "mesh",
    targetProperty: "vertices",
    parameterId: "param_face_angle_x",
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
  } as unknown as RuntimeExportKeyformBindingDto;
}

function createOpacityKeyform(): RuntimeExportKeyformBindingDto {
  return {
    evaluator: "linear-1d-v1",
    keyformSetId: "keyset_body_opacity",
    targetId: "draw_body",
    targetKind: "drawable",
    targetProperty: "opacity",
    parameterId: "param_face_angle_x",
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
  } as unknown as RuntimeExportKeyformBindingDto;
}

function createDrawOrderKeyform(): RuntimeExportKeyformBindingDto {
  return {
    evaluator: "linear-1d-v1",
    keyformSetId: "keyset_body_draw_order",
    targetId: "draw_body",
    targetKind: "drawable",
    targetProperty: "drawOrder",
    parameterId: "param_face_angle_x",
    keys: [
      {
        value: 0,
        statePatch: 0
      },
      {
        value: 1,
        statePatch: 12
      }
    ],
    compositionMode: "replace",
    compositionOrder: 2
  } as unknown as RuntimeExportKeyformBindingDto;
}

function createRotationRigControl(options: {
  readonly rigControlId?: string;
  readonly parentId?: string;
  readonly childDrawableIds?: readonly string[];
  readonly childRigControlIds?: readonly string[];
  readonly opacityMultiplier?: number;
  readonly pivot?: { readonly x: number; readonly y: number };
  readonly restAngleDegrees?: number;
  readonly restTranslation?: { readonly x: number; readonly y: number };
  readonly restScale?: { readonly x: number; readonly y: number };
  readonly enabled?: boolean;
} = {}): RuntimeExportRigControlDto {
  return {
    kind: "rotation2d",
    rigControlId: options.rigControlId ?? "rig_body_rotate",
    displayName: "Body Rotate",
    ...(options.parentId === undefined ? {} : { parentId: options.parentId }),
    childDrawableIds: options.childDrawableIds ?? ["draw_body"],
    childRigControlIds: options.childRigControlIds ?? [],
    opacityMultiplier: options.opacityMultiplier ?? 0.9,
    pivot: options.pivot ?? {
      x: 16,
      y: 16
    },
    restAngleDegrees: options.restAngleDegrees ?? 0,
    restTranslation: options.restTranslation ?? {
      x: 0,
      y: 0
    },
    restScale: options.restScale ?? {
      x: 1,
      y: 1
    },
    enabled: options.enabled ?? true
  } as unknown as RuntimeExportRigControlDto;
}

function createWarpRigControl(options: {
  readonly parentId?: string;
  readonly childDrawableIds?: readonly string[];
  readonly childRigControlIds?: readonly string[];
  readonly opacityMultiplier?: number;
  readonly enabled?: boolean;
} = {}): RuntimeExportRigControlDto {
  return {
    kind: "warpLattice2d",
    rigControlId: "rig_body_warp",
    displayName: "Body Warp",
    ...(options.parentId === undefined ? {} : { parentId: options.parentId }),
    childDrawableIds: options.childDrawableIds ?? ["draw_mask"],
    childRigControlIds: options.childRigControlIds ?? [],
    ...(options.opacityMultiplier === undefined
      ? { opacityMultiplier: 0.8 }
      : { opacityMultiplier: options.opacityMultiplier }),
    bindSpace: "rigControlLocalRest",
    domainBounds: {
      x: 0,
      y: 0,
      width: 32,
      height: 32
    },
    latticeColumns: 2,
    latticeRows: 2,
    restControlPoints: [
      { x: 0, y: 0 },
      { x: 32, y: 0 },
      { x: 0, y: 32 },
      { x: 32, y: 32 }
    ],
    interpolationMethod: "bilinear-grid-v1",
    enabled: options.enabled ?? true
  } as unknown as RuntimeExportRigControlDto;
}

function createRigControlAngleKeyform(): RuntimeExportKeyformBindingDto {
  return {
    evaluator: "linear-1d-v1",
    keyformSetId: "keyset_body_rig_angle",
    targetId: "rig_body_rotate",
    targetKind: "rigControl",
    targetProperty: "angleDegrees",
    parameterId: "param_face_angle_x",
    keys: [
      {
        value: 0,
        statePatch: 0
      },
      {
        value: 1,
        statePatch: 90
      }
    ],
    compositionMode: "replace",
    compositionOrder: 0
  } as unknown as RuntimeExportKeyformBindingDto;
}

function createWarpControlPointOffsetsKeyform(): RuntimeExportKeyformBindingDto {
  return {
    evaluator: "linear-1d-v1",
    keyformSetId: "keyset_mask_warp_offsets",
    targetId: "rig_body_warp",
    targetKind: "rigControl",
    targetProperty: "controlPointOffsets",
    parameterId: "param_face_angle_x",
    keys: [
      {
        value: 0,
        statePatch: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 }
        ]
      },
      {
        value: 1,
        statePatch: createUniformWarpOffsets()
      }
    ],
    compositionMode: "replace",
    compositionOrder: 1
  } as unknown as RuntimeExportKeyformBindingDto;
}

function createDynamicsGroup(): RuntimeExportDynamicsGroupDto {
  return {
    dynamicsGroupId: "dyn_hair_sway",
    displayName: "Hair Sway",
    enabled: true,
    inputs: [
      {
        parameterId: "param_face_angle_x",
        kind: "angle",
        scale: 1
      }
    ],
    chain: {
      rootOffset: { x: 0, y: 0 },
      segmentLengths: [14],
      damping: 2.5,
      gravityScale: 1
    },
    outputs: [
      {
        parameterId: "param_hair_sway",
        segmentIndex: 1,
        scale: 0.5,
        limit: 1
      }
    ]
  } as unknown as RuntimeExportDynamicsGroupDto;
}

function createTexturePage(
  textureBytes: Uint8Array
): RuntimeExportTexturePageMetadataDto {
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
  } as unknown as RuntimeExportTexturePageMetadataDto;
}

function toTexturePageReference(page: RuntimeExportTexturePageMetadataDto) {
  return {
    pageId: page.pageId,
    path: page.path,
    width: page.width,
    height: page.height,
    pixelFormat: page.pixelFormat
  };
}

function createAtlas(input: {
  readonly texturePage: RuntimeExportTexturePageMetadataDto;
  readonly drawables: readonly RuntimeExportDrawableDto[];
  readonly meshes: readonly RuntimeExportMeshDto[];
}): RuntimeExportAtlasDto {
  return {
    schemaVersion: "runtime-export-atlas-v0",
    sourceSignature: {
      schemaVersion: "texture-atlas-source-signature-v1",
      inputVersion: "atlas-source-inputs-v1",
      algorithmId: "stable-json-fnv1a32-v1",
      digest: "fnv1a32:0123abcd",
      boundDrawableIds: input.drawables.map((drawable) => drawable.drawableId),
      packableDrawableIds: input.drawables.map((drawable) => drawable.drawableId)
    },
    settings: {
      algorithmId: "single-page-shelf-v1",
      pageWidth: input.texturePage.width,
      pageHeight: input.texturePage.height,
      paddingPixels: 0,
      edgeExtrusion: {
        enabled: true,
        pixels: 0
      }
    },
    pages: [input.texturePage],
    placements: input.drawables.map((drawable) => ({
      placementId: drawable.texture.placementId,
      pageId: input.texturePage.pageId,
      drawableId: drawable.drawableId,
      meshId: drawable.meshId,
      originalTextureId: `tex_original_${drawable.drawableId}`,
      atlasTextureId: input.texturePage.textureId ?? "tex_atlas_page_0",
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
      runtimeTexturePagePath: input.texturePage.path
    }))
  } as unknown as RuntimeExportAtlasDto;
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
      solverVersion: "runtime-dynamics-chain-v1",
      fixedStepMs: 1000 / 60,
      resetPolicy: "reset-to-default-parameters-v1"
    }
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
    { x: 2, y: 1 },
    { x: 34, y: 3 },
    { x: 1, y: 35 }
  ];
}

function createAtlasUvs() {
  return [
    { x: 0.1, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.1, y: 0.9 }
  ];
}

function createUniformWarpOffsets() {
  return [
    { x: 1, y: 2 },
    { x: 1, y: 2 },
    { x: 1, y: 2 },
    { x: 1, y: 2 }
  ];
}

function parameterId(value: string): ParameterId {
  return value as ParameterId;
}

function drawableId(value: string): DrawableId {
  return value as DrawableId;
}

function rigControlId(value: string): RigControlId {
  return value as RigControlId;
}

function dynamicsGroupId(value: string): DynamicsGroupId {
  return value as DynamicsGroupId;
}
