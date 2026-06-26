import { describe, expect, it } from "vitest";

import type {
  DrawableId,
  ParameterId
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
  type RuntimeExportTexturePageMetadataDto
} from "@private-2d-rigging-lab/package-format";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type {
  RuntimePlayerActiveVariantSelectionState
} from "../../preload/runtime-variant-bridge-contract";
import {
  createRuntimeExportRuntimeModelInitialStateRequest
} from "../runtime-evaluation/runtime-export-pose-evaluator";
import { createEvaluatedRuntimeExportStageRenderInput } from "./evaluated-runtime-export-stage-scene";
import {
  RuntimeExportEvaluationCache,
  createRuntimeExportEvaluationCacheKey
} from "./runtime-export-evaluation-cache";
import {
  RuntimeExportRuntimeModelInstanceCache
} from "./runtime-export-runtime-model-instance-cache";

describe("Runtime Export evaluation cache", () => {
  it("reuses invariant scaffold while live parameters, dynamics, and outputs update", () => {
    const payload = createRuntimeExportPayload();
    const cache = new RuntimeExportEvaluationCache();

    const firstFrame = createEvaluatedRuntimeExportStageRenderInput(payload, {
      evaluationCache: cache,
      authoredParameterValues: {
        param_face_angle_x: 0
      },
      frameIndex: 1,
      deltaTimeMs: 0,
      resetReasons: []
    });
    const secondFrame = createEvaluatedRuntimeExportStageRenderInput(payload, {
      evaluationCache: cache,
      authoredParameterValues: {
        param_face_angle_x: 1
      },
      frameIndex: 2,
      deltaTimeMs: 100,
      resetReasons: [],
      previousState: firstFrame.poseEvaluation.nextState
    });

    expect(secondFrame.poseEvaluation.adapter)
      .toBe(firstFrame.poseEvaluation.adapter);
    expect(getRenderFrame(secondFrame))
      .not.toBe(getRenderFrame(firstFrame));
    expect(secondFrame.poseEvaluation.nextState)
      .not.toBe(firstFrame.poseEvaluation.nextState);
    expect(cache.size).toBe(1);

    const firstBody = getSceneDrawable(firstFrame, "draw_body");
    const secondBody = getSceneDrawable(secondFrame, "draw_body");
    expect(firstBody.mesh.vertices).toEqual(createRestVertices());
    expect(secondBody.mesh.vertices).toEqual(createDeformedVertices());
    expect(secondBody).toMatchObject({
      opacity: 0.25,
      drawOrder: 12,
      clipping: {
        mode: "drawable-alpha-mask-v0",
        maskDrawableIds: ["draw_mask"]
      }
    });

    expect(getSceneDrawable(firstFrame, "draw_mask").visible).toBe(false);
    expect(getSceneDrawable(secondFrame, "draw_mask").visible).toBe(false);
    expect(
      secondFrame.poseEvaluation.nextState.dynamicsGroups.dyn_hair_sway?.tick
    ).toBeGreaterThan(
      firstFrame.poseEvaluation.nextState.dynamicsGroups.dyn_hair_sway?.tick ?? -1
    );
  });

  it("stores compiled models on scaffolds while keeping runtime instances target-local", () => {
    const payload = createRuntimeExportPayload();
    const cache = new RuntimeExportEvaluationCache();
    const defaultSelection = createActiveSelection({
      expression: "var_expression_default",
      updatedAtIso: "2026-06-24T00:00:00.000Z"
    });
    const sameDefaultSelection = createActiveSelection({
      expression: "var_expression_default",
      updatedAtIso: "2026-06-24T00:00:01.000Z"
    });
    const smileSelection = createActiveSelection({
      expression: "var_smile",
      updatedAtIso: "2026-06-24T00:00:02.000Z"
    });
    const defaultAccess = cache.getOrCreateWithDiagnostics({
      payload,
      activeVariantSelection: defaultSelection
    });
    const sameDefaultAccess = cache.getOrCreateWithDiagnostics({
      payload,
      activeVariantSelection: sameDefaultSelection
    });
    const nativeInstances = new RuntimeExportRuntimeModelInstanceCache();
    const browserSourceInstances = new RuntimeExportRuntimeModelInstanceCache();
    const initialStateRequest = createRuntimeExportRuntimeModelInitialStateRequest(
      createAdapterInput(payload, defaultSelection),
      {
        frameIndex: 1,
        resetReasons: [],
        authoredParameterValues: {
          param_face_angle_x: 0
        }
      }
    );

    const nativeInstance = nativeInstances.getOrCreate(
      defaultAccess.scaffold,
      { initialStateRequest }
    );
    const browserSourceInstance = browserSourceInstances.getOrCreate(
      defaultAccess.scaffold,
      { initialStateRequest }
    );

    expect(sameDefaultAccess.cacheStatus).toBe("hit");
    expect(sameDefaultAccess.scaffold.compiledRuntimeModel)
      .toBe(defaultAccess.scaffold.compiledRuntimeModel);
    expect(nativeInstance).not.toBe(browserSourceInstance);

    const smileAccess = cache.getOrCreateWithDiagnostics({
      payload,
      activeVariantSelection: smileSelection
    });
    const smileInstance = nativeInstances.getOrCreate(
      smileAccess.scaffold,
      {
        initialStateRequest: createRuntimeExportRuntimeModelInitialStateRequest(
          createAdapterInput(payload, smileSelection),
          {
            frameIndex: 2,
            resetReasons: [],
            authoredParameterValues: {
              param_face_angle_x: 1
            }
          }
        )
      }
    );
    const reloadedPayload = createRuntimeExportPayload({
      loadedAtIso: "2026-06-22T00:01:00.000Z"
    });
    const reloadedAccess = cache.getOrCreateWithDiagnostics({
      payload: reloadedPayload,
      activeVariantSelection: smileSelection
    });
    const reloadedInstance = nativeInstances.getOrCreate(
      reloadedAccess.scaffold,
      {
        initialStateRequest: createRuntimeExportRuntimeModelInitialStateRequest(
          createAdapterInput(reloadedPayload, smileSelection),
          { frameIndex: 3, resetReasons: [] }
        )
      }
    );

    expect(smileAccess.cacheStatus).toBe("miss");
    expect(smileAccess.scaffold.compiledRuntimeModel)
      .not.toBe(defaultAccess.scaffold.compiledRuntimeModel);
    expect(smileInstance).not.toBe(nativeInstance);
    expect(reloadedAccess.scaffold.compiledRuntimeModel)
      .not.toBe(smileAccess.scaffold.compiledRuntimeModel);
    expect(reloadedInstance).not.toBe(smileInstance);
  });

  it("keeps separate target instances visually consistent for the same live frame sequence", () => {
    const payload = createRuntimeExportPayload();
    const cache = new RuntimeExportEvaluationCache();
    const nativeInstances = new RuntimeExportRuntimeModelInstanceCache();
    const browserSourceInstances = new RuntimeExportRuntimeModelInstanceCache();

    const nativeFirstFrame = createEvaluatedRuntimeExportStageRenderInput(
      payload,
      {
        evaluationCache: cache,
        runtimeModelInstanceCache: nativeInstances,
        authoredParameterValues: {
          param_face_angle_x: 0
        },
        frameIndex: 1,
        deltaTimeMs: 0,
        resetReasons: []
      }
    );
    const browserFirstFrame = createEvaluatedRuntimeExportStageRenderInput(
      payload,
      {
        evaluationCache: cache,
        runtimeModelInstanceCache: browserSourceInstances,
        authoredParameterValues: {
          param_face_angle_x: 0
        },
        frameIndex: 1,
        deltaTimeMs: 0,
        resetReasons: []
      }
    );
    const nativeSecondFrame = createEvaluatedRuntimeExportStageRenderInput(
      payload,
      {
        evaluationCache: cache,
        runtimeModelInstanceCache: nativeInstances,
        authoredParameterValues: {
          param_face_angle_x: 1
        },
        frameIndex: 2,
        deltaTimeMs: 100,
        resetReasons: []
      }
    );
    const browserSecondFrame = createEvaluatedRuntimeExportStageRenderInput(
      payload,
      {
        evaluationCache: cache,
        runtimeModelInstanceCache: browserSourceInstances,
        authoredParameterValues: {
          param_face_angle_x: 1
        },
        frameIndex: 2,
        deltaTimeMs: 100,
        resetReasons: []
      }
    );

    expect(browserFirstFrame.scene.drawables)
      .toEqual(nativeFirstFrame.scene.drawables);
    expect(browserSecondFrame.scene.drawables)
      .toEqual(nativeSecondFrame.scene.drawables);
    expect(getRenderFrame(browserSecondFrame))
      .not.toBe(getRenderFrame(nativeSecondFrame));
    expect(getRenderFrame(browserSecondFrame).drawables[1]?.vertices)
      .not.toBe(getRenderFrame(nativeSecondFrame).drawables[1]?.vertices);
    expect(
      browserSecondFrame.poseEvaluation.nextState.dynamicsGroups.dyn_hair_sway
        ?.tick
    ).toBe(
      nativeSecondFrame.poseEvaluation.nextState.dynamicsGroups.dyn_hair_sway
        ?.tick
    );
  });

  it("keys by semantic Variant selection and ignores non-semantic timestamps", () => {
    const payload = createRuntimeExportPayload();
    const cache = new RuntimeExportEvaluationCache();

    const smileFrame = createEvaluatedRuntimeExportStageRenderInput(payload, {
      evaluationCache: cache,
      activeVariantSelection: createActiveSelection({
        expression: "var_smile",
        updatedAtIso: "2026-06-24T00:00:00.000Z"
      })
    });
    const smileTimestampOnlyFrame = createEvaluatedRuntimeExportStageRenderInput(
      payload,
      {
        evaluationCache: cache,
        activeVariantSelection: createActiveSelection({
          expression: "var_smile",
          updatedAtIso: "2026-06-24T00:00:01.000Z"
        })
      }
    );
    const defaultFrame = createEvaluatedRuntimeExportStageRenderInput(payload, {
      evaluationCache: cache,
      activeVariantSelection: createActiveSelection({
        expression: "var_expression_default",
        updatedAtIso: "2026-06-24T00:00:02.000Z"
      })
    });

    expect(smileTimestampOnlyFrame.poseEvaluation.adapter)
      .toBe(smileFrame.poseEvaluation.adapter);
    expect(defaultFrame.poseEvaluation.adapter)
      .not.toBe(smileFrame.poseEvaluation.adapter);
    expect(cache.size).toBe(2);
    expect(getSceneDrawable(smileFrame, "draw_smile").visible).toBe(true);
    expect(getSceneDrawable(smileFrame, "draw_expression_default").visible)
      .toBe(false);
    expect(getSceneDrawable(defaultFrame, "draw_smile").visible).toBe(false);
    expect(getSceneDrawable(defaultFrame, "draw_expression_default").visible)
      .toBe(true);
  });

  it("invalidates scaffolds through clear and separates reload or texture keys", () => {
    const payload = createRuntimeExportPayload();
    const reloadedPayload = createRuntimeExportPayload({
      loadedAtIso: "2026-06-22T00:01:00.000Z"
    });
    const textureChangedPayload = createRuntimeExportPayload({
      textureDigestHex: "fedcba9876543210".repeat(4),
      textureBytes: Uint8Array.from([
        1, 2, 3, 4,
        5, 6, 7, 8,
        9, 10, 11, 12,
        13, 14, 15, 16
      ])
    });
    const cache = new RuntimeExportEvaluationCache();

    expect(cache.getMetricsSnapshot()).toEqual({
      evaluationCacheHitCount: 0,
      evaluationCacheMissCount: 0,
      evaluationCacheInvalidationCount: 0,
      lastRuntimeModelCompileDurationMs: null,
      runtimeModelCompileDurationSampleCount: 0
    });

    const firstAccess = cache.getOrCreateWithDiagnostics({
      payload,
      activeVariantSelection: null
    });
    const first = firstAccess.scaffold;
    const secondAccess = cache.getOrCreateWithDiagnostics({
      payload,
      activeVariantSelection: null
    });

    expect(firstAccess.cacheStatus).toBe("miss");
    expect(firstAccess.scaffoldBuildProfile.totalDurationMs)
      .toBeGreaterThanOrEqual(0);
    expect(secondAccess.cacheStatus).toBe("hit");
    expect(secondAccess.scaffold).toBe(first);
    expect(secondAccess.scaffoldBuildProfile.totalDurationMs).toBe(0);
    expect(cache.getMetricsSnapshot()).toEqual({
      evaluationCacheHitCount: 1,
      evaluationCacheMissCount: 1,
      evaluationCacheInvalidationCount: 0,
      lastRuntimeModelCompileDurationMs:
        firstAccess.scaffoldBuildProfile.runtimeModelCompileDurationMs,
      runtimeModelCompileDurationSampleCount: 1
    });

    cache.clear();
    cache.clear();
    const afterClear = cache.getOrCreate({
      payload,
      activeVariantSelection: null
    });

    expect(afterClear).not.toBe(first);
    expect(cache.getMetricsSnapshot()).toMatchObject({
      evaluationCacheHitCount: 1,
      evaluationCacheMissCount: 2,
      evaluationCacheInvalidationCount: 1,
      runtimeModelCompileDurationSampleCount: 2
    });
    expect(createRuntimeExportEvaluationCacheKey({
      payload,
      activeVariantSelection: null
    })).not.toBe(createRuntimeExportEvaluationCacheKey({
      payload: reloadedPayload,
      activeVariantSelection: null
    }));
    expect(createRuntimeExportEvaluationCacheKey({
      payload,
      activeVariantSelection: null
    })).not.toBe(createRuntimeExportEvaluationCacheKey({
      payload: textureChangedPayload,
      activeVariantSelection: null
    }));
  });

  it("tracks target-local runtime model instance cache metrics", () => {
    const payload = createRuntimeExportPayload();
    const scaffoldCache = new RuntimeExportEvaluationCache();
    const instanceCache = new RuntimeExportRuntimeModelInstanceCache();
    const defaultAccess = scaffoldCache.getOrCreateWithDiagnostics({
      payload,
      activeVariantSelection: null
    });
    const defaultInitialStateRequest =
      createRuntimeExportRuntimeModelInitialStateRequest(
        createAdapterInput(payload, null),
        { frameIndex: 1, resetReasons: [] }
      );

    expect(instanceCache.getMetricsSnapshot()).toEqual({
      runtimeModelInstanceCacheHitCount: 0,
      runtimeModelInstanceCacheMissCount: 0,
      runtimeModelInstanceCacheInvalidationCount: 0
    });

    const firstInstance = instanceCache.getOrCreate(
      defaultAccess.scaffold,
      { initialStateRequest: defaultInitialStateRequest }
    );
    const reusedInstance = instanceCache.getOrCreate(
      defaultAccess.scaffold,
      { initialStateRequest: defaultInitialStateRequest }
    );

    expect(reusedInstance).toBe(firstInstance);
    expect(instanceCache.getMetricsSnapshot()).toEqual({
      runtimeModelInstanceCacheHitCount: 1,
      runtimeModelInstanceCacheMissCount: 1,
      runtimeModelInstanceCacheInvalidationCount: 0
    });

    const smileSelection = createActiveSelection({
      expression: "var_smile",
      updatedAtIso: "2026-06-24T00:00:02.000Z"
    });
    const smileAccess = scaffoldCache.getOrCreateWithDiagnostics({
      payload,
      activeVariantSelection: smileSelection
    });
    const smileInstance = instanceCache.getOrCreate(
      smileAccess.scaffold,
      {
        initialStateRequest: createRuntimeExportRuntimeModelInitialStateRequest(
          createAdapterInput(payload, smileSelection),
          { frameIndex: 2, resetReasons: [] }
        )
      }
    );

    expect(smileInstance).not.toBe(firstInstance);
    expect(instanceCache.getMetricsSnapshot()).toEqual({
      runtimeModelInstanceCacheHitCount: 1,
      runtimeModelInstanceCacheMissCount: 2,
      runtimeModelInstanceCacheInvalidationCount: 1
    });

    instanceCache.clear();
    instanceCache.clear();

    expect(instanceCache.getMetricsSnapshot()).toEqual({
      runtimeModelInstanceCacheHitCount: 1,
      runtimeModelInstanceCacheMissCount: 2,
      runtimeModelInstanceCacheInvalidationCount: 2
    });
  });
});

type EvaluatedInput = ReturnType<typeof createEvaluatedRuntimeExportStageRenderInput>;

function getSceneDrawable(
  input: EvaluatedInput,
  drawableId: string
): EvaluatedInput["scene"]["drawables"][number] {
  const drawable = input.scene.drawables.find((candidate) =>
    candidate.drawableId === drawableId
  );
  if (drawable === undefined) {
    throw new Error(`Expected drawable ${drawableId}.`);
  }

  return drawable;
}

function getRenderFrame(
  input: EvaluatedInput
): Extract<EvaluatedInput["poseEvaluation"], { readonly renderFrame: unknown }>["renderFrame"] {
  if (!("renderFrame" in input.poseEvaluation)) {
    throw new Error("Expected render-frame pose evaluation.");
  }

  return input.poseEvaluation.renderFrame;
}

function createAdapterInput(
  payload: RuntimeExportLoadedPayload,
  activeVariantSelection: RuntimePlayerActiveVariantSelectionState | null
) {
  return {
    model: payload.artifacts.model,
    atlas: payload.artifacts.atlas,
    texturePages: payload.artifacts.manifest.texturePages,
    activeVariantSelection
  };
}

function createRuntimeExportPayload(input: {
  readonly textureBytes?: Uint8Array;
  readonly loadedAtIso?: string;
  readonly textureDigestHex?: string;
} = {}): RuntimeExportLoadedPayload {
  const textureBytes = input.textureBytes ?? new Uint8Array(16);
  const texturePage = createTexturePage({
    bytes: textureBytes,
    digestHex: input.textureDigestHex
  });
  const sourcePackage = {
    packageId: "pkg_runtime_eval_cache",
    packageDisplayName: "Runtime Evaluation Cache",
    packageRevision: 5,
    packageHash: "hash_runtime_eval_cache"
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
  const drawables = [
    createDrawable("draw_mask", "mesh_mask", {
      includeReason: "mask-source-v1",
      baseVisible: false,
      visible: false,
      baseDrawOrder: 0,
      opacity: 0.4
    }),
    createDrawable("draw_body", "mesh_body", {
      includeReason: "runtime-target-v1",
      baseVisible: true,
      visible: true,
      baseDrawOrder: 1
    }),
    createDrawable("draw_expression_default", "mesh_expression_default", {
      includeReason: "runtime-target-v1",
      baseVisible: true,
      visible: true,
      baseDrawOrder: 2
    }),
    createDrawable("draw_smile", "mesh_smile", {
      includeReason: "runtime-target-v1",
      baseVisible: true,
      visible: false,
      baseDrawOrder: 3
    })
  ];
  const meshes = drawables.map((drawable) =>
    createMesh(`mesh_${drawable.drawableId.replace(/^draw_/, "")}`, drawable.drawableId)
  );
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
    parameters: [
      createParameter("param_face_angle_x", {
        valueSource: "authoredInput",
        runtimeRole: "external-input",
        externalInput: true,
        readOnly: false
      }),
      createParameter("param_hair_sway", {
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
    drawables,
    meshes,
    drawOrder: drawables.map((drawable, index) => ({
      drawableId: drawable.drawableId,
      drawOrder: index
    })),
    masks: [
      {
        maskRelationId: "maskrel_body",
        sourceDrawableIds: ["draw_mask"],
        targetDrawableIds: ["draw_body"],
        clippingMode: "alpha-mask-v1",
        coordinateSpace: "canvas-y-down-v1"
      }
    ],
    rigControls: [],
    keyforms: [
      createMeshKeyform(),
      createOpacityKeyform(),
      createDrawOrderKeyform()
    ],
    dynamicsSolver: renderAssumptions.dynamics,
    dynamicsGroups: [createDynamicsGroup()],
    variants: createVariants(),
    renderAssumptions
  } as unknown as RuntimeExportModelDto;
  const atlas = createAtlas({
    texturePage,
    drawables,
    meshes
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
          "dynamics-pendulum-solver-v1"
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
        "dynamics-pendulum-solver-v1"
      ]
    },
    loadedAtIso: input.loadedAtIso ?? "2026-06-22T00:00:00.000Z"
  } as unknown as RuntimeExportLoadedPayload;
}

function createActiveSelection(input: {
  readonly expression: "var_expression_default" | "var_smile";
  readonly updatedAtIso: string;
}): RuntimePlayerActiveVariantSelectionState {
  return {
    schemaVersion: "runtime-player-active-variant-selection-v1",
    state: "ready",
    updatedAtIso: input.updatedAtIso,
    activeSelections: [
      {
        variantGroupId: "vgrp_expression",
        activeSelection: {
          kind: "singleSelect",
          variantId: input.expression
        }
      }
    ]
  };
}

function createParameter(
  parameterId: string,
  options: Partial<RuntimeExportParameterDto>
): RuntimeExportParameterDto {
  return {
    parameterId,
    displayName: parameterId,
    semanticRole: "face",
    valueSource: options.valueSource ?? "authoredInput",
    runtimeRole: options.runtimeRole ?? "external-input",
    externalInput: options.externalInput ?? true,
    readOnly: options.readOnly ?? false,
    min: -1,
    max: 1,
    default: 0
  } as unknown as RuntimeExportParameterDto;
}

function createDrawable(
  drawableId: string,
  meshId: string,
  options: {
    readonly includeReason: "runtime-target-v1" | "mask-source-v1";
    readonly baseVisible: boolean;
    readonly visible: boolean;
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
    baseVisible: options.baseVisible,
    visible: options.visible,
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
  drawableId: DrawableId
): RuntimeExportMeshDto {
  return {
    meshId,
    drawableId,
    vertices: createRestVertices(),
    atlasUvs: createAtlasUvs(),
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
        statePatch: 1
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

function createDynamicsGroup(): RuntimeExportDynamicsGroupDto {
  return {
    dynamicsGroupId: "dyn_hair_sway",
    displayName: "Hair Sway",
    enabled: true,
    inputs: [
      {
        parameterId: "param_face_angle_x",
        kind: "angle",
        influencePercent: 100,
        invert: false,
        normalization: {
          min: -1,
          center: 0,
          max: 1
        }
      }
    ],
    pendulums: [
      {
        length: 1,
        sway: 1,
        reactionSpeed: 1,
        convergenceSpeed: 1
      }
    ],
    outputs: [
      {
        parameterId: "param_hair_sway",
        kind: "angle",
        strength: 0.5,
        invert: false,
        limit: 1
      }
    ]
  } as unknown as RuntimeExportDynamicsGroupDto;
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
          variantId: "var_expression_default"
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
      }
    ]
  };
}

function createTexturePage(input: {
  readonly bytes: Uint8Array;
  readonly digestHex?: string;
}): RuntimeExportTexturePageMetadataDto {
  return {
    pageId: "atlas_page_0",
    path: "assets/textures/atlas_page_0.raw-rgba",
    textureId: "tex_atlas_page_0",
    width: 2,
    height: 2,
    pixelFormat: "rgba8",
    mediaType: RUNTIME_EXPORT_RAW_RGBA_MEDIA_TYPE,
    byteLength: input.bytes.byteLength,
    digest: {
      algorithm: "sha256",
      hex: input.digestHex ?? "0123456789abcdef".repeat(4)
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
      solverVersion: "runtime-dynamics-pendulum-v1",
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

function drawableId(value: string): DrawableId {
  return value as DrawableId;
}

function parameterId(value: string): ParameterId {
  return value as ParameterId;
}
