import {
  DynamicsGroupIdSchema,
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createInitialRuntimeState } from "./initial-state.js";
import type {
  NormalizedDynamicsGroup,
  NormalizedRuntimeGraph
} from "./normalized-runtime-graph.js";
import { defaultRuntimeEvaluationOptions } from "./runtime-options.js";
import {
  compileRuntimeModel,
  evaluateRuntimeFrame,
  evaluateRuntimeSequence,
  runtimeCore
} from "./runtime-core.js";
import { createRuntimeSnapshot } from "./snapshot.js";

describe("runtime-core foundation evaluation", () => {
  it("generates a minimal non-empty draw list snapshot", () => {
    const packageId = PackageIdSchema.parse("pkg_snapshot");
    const drawableId = DrawableIdSchema.parse("draw_body");
    const meshId = MeshIdSchema.parse("mesh_body");
    const graph = createGraph({
      packageId,
      drawables: new Map([
        [
          drawableId,
          {
            drawableId,
            meshId,
            visible: true,
            opacity: 1,
            baseDrawOrder: 10,
            bounds: { x: 0, y: 0, width: 64, height: 64 },
            vertexCount: 4
          }
        ]
      ])
    });
    const state = createInitialRuntimeState(graph, {
      packageId,
      packageRevision: 0,
      resetReasons: ["packageLoad"]
    });

    const result = evaluateRuntimeFrame(
      graph,
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 1,
        deltaTimeMs: 16.6666667
      },
      state,
      defaultRuntimeEvaluationOptions(),
      { source: { surface: "preview" } }
    );

    expect(result.snapshot.drawList).toEqual([drawableId]);
    expect(result.snapshot.drawables).toHaveLength(1);
    expect(result.snapshot.drawables[0]).toMatchObject({
      drawableId,
      meshId,
      evaluatedDrawOrder: 10,
      vertexHash: "hash_draw_body_4"
    });
  });

  it("returns stable package identity diagnostics for mismatched and hashless state", () => {
    const packageId = PackageIdSchema.parse("pkg_identity");
    const parameterId = ParameterIdSchema.parse("param_yaw");
    const graph = createGraph({
      packageId,
      packageHash: "hash-graph",
      parameters: new Map([
        [
          parameterId,
          {
            id: parameterId,
            displayName: "Yaw",
            valueSource: "authoredInput",
            min: -1,
            max: 1,
            default: 0
          }
        ]
      ])
    });
    const staleState = {
      ...createInitialRuntimeState(graph, {
        packageId,
        packageRevision: 0,
        packageHash: "hash-state",
        resetReasons: ["packageLoad"]
      }),
      packageHash: "hash-state"
    };

    const mismatch = evaluateRuntimeFrame(
      graph,
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 1,
        deltaTimeMs: 0
      },
      staleState,
      defaultRuntimeEvaluationOptions(),
      { source: { surface: "validator" }, policy: { strictness: "strict" } }
    );

    expect(mismatch.snapshot.diagnostics.map((diagnostic) => diagnostic.checkId)).toContain(
      "runtime.statePackageMismatch"
    );

    const hashlessGraph = createGraph({ packageId });
    const hashlessState = createInitialRuntimeState(hashlessGraph, {
      packageId,
      packageRevision: 0,
      resetReasons: ["packageLoad"]
    });
    const hashless = evaluateRuntimeFrame(
      hashlessGraph,
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 1,
        deltaTimeMs: 0
      },
      hashlessState,
      defaultRuntimeEvaluationOptions(),
      { source: { surface: "preview" } }
    );

    expect(hashless.snapshot.diagnostics.map((diagnostic) => diagnostic.checkId)).toContain(
      "runtime.statePackageHashUnavailable"
    );
  });

  it("evaluates a sequence while preserving the public result shape", () => {
    const packageId = PackageIdSchema.parse("pkg_sequence");
    const graph = createGraph({ packageId });
    const initialState = createInitialRuntimeState(graph, {
      packageId,
      packageRevision: 0,
      resetReasons: ["validationRunStart"]
    });

    const result = evaluateRuntimeSequence(
      graph,
      [
        {
          frameIndex: 1,
          deltaTimeMs: 16
        },
        {
          frameIndex: 2,
          deltaTimeMs: 16
        }
      ],
      initialState,
      defaultRuntimeEvaluationOptions(),
      { source: { surface: "validator" }, policy: { strictness: "strict" } }
    );

    expect(result.snapshots).toHaveLength(2);
    expect(result.finalState.frameIndex).toBe(2);
  });

  it("returns a runtime-core profiling breakdown only when requested", () => {
    const packageId = PackageIdSchema.parse("pkg_profile");
    const drawableId = DrawableIdSchema.parse("draw_profile");
    const meshId = MeshIdSchema.parse("mesh_profile");
    const graph = createGraph({
      packageId,
      drawables: new Map([
        [
          drawableId,
          {
            drawableId,
            meshId,
            visible: true,
            opacity: 1,
            baseDrawOrder: 0,
            bounds: { x: 0, y: 0, width: 10, height: 10 },
            vertexCount: 4
          }
        ]
      ])
    });
    const state = createInitialRuntimeState(graph, {
      packageId,
      packageRevision: 0,
      resetReasons: ["packageLoad"]
    });

    const unprofiled = evaluateRuntimeFrame(
      graph,
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 1,
        deltaTimeMs: 0
      },
      state,
      defaultRuntimeEvaluationOptions(),
      { source: { surface: "preview" } }
    );

    let nowMs = 0;
    const profiled = evaluateRuntimeFrame(
      graph,
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 2,
        deltaTimeMs: 0
      },
      state,
      defaultRuntimeEvaluationOptions(),
      { source: { surface: "preview" } },
      {
        enabled: true,
        now: () => {
          nowMs += 1;
          return nowMs;
        }
      },
      {
        snapshotValidation: "schema"
      }
    );

    expect(unprofiled.profile).toBeUndefined();
    expect(profiled.profile).toMatchObject({
      runtimeCoreEvaluationDurationMs: expect.any(Number),
      inputValidationDurationMs: expect.any(Number),
      stateCompatibilityDurationMs: expect.any(Number),
      dynamicsEvaluationDurationMs: expect.any(Number),
      runtimeSnapshotCreationDurationMs: expect.any(Number),
      parameterResolutionDurationMs: expect.any(Number),
      keyformSamplingDurationMs: expect.any(Number),
      keyformApplicationDurationMs: expect.any(Number),
      deformerHierarchyEvaluationDurationMs: expect.any(Number),
      drawableSnapshotCreationDurationMs: expect.any(Number),
      visibilityDrawOrderEvaluationDurationMs: expect.any(Number),
      maskEvaluationDurationMs: expect.any(Number),
      snapshotValidationDurationMs: expect.any(Number)
    });
    expect(profiled.profile?.runtimeCoreEvaluationDurationMs)
      .toBeGreaterThan(0);
    expect(profiled.profile?.parameterResolutionDurationMs)
      .toBeGreaterThan(0);
    expect(profiled.profile?.snapshotValidationDurationMs)
      .toBeGreaterThan(0);
  });

  it("skips snapshot schema validation when requested without changing snapshot output", () => {
    const packageId = PackageIdSchema.parse("pkg_validation_skip");
    const drawableId = DrawableIdSchema.parse("draw_validation_skip");
    const meshId = MeshIdSchema.parse("mesh_validation_skip");
    const graph = createGraph({
      packageId,
      drawables: new Map([
        [
          drawableId,
          {
            drawableId,
            meshId,
            visible: true,
            opacity: 1,
            baseDrawOrder: 0,
            bounds: { x: 0, y: 0, width: 10, height: 10 },
            vertexCount: 4
          }
        ]
      ])
    });
    const state = createInitialRuntimeState(graph, {
      packageId,
      packageRevision: 0,
      resetReasons: ["packageLoad"]
    });
    const input = {
      schemaVersion: "runtime-evaluation-input-v1" as const,
      frameIndex: 1,
      deltaTimeMs: 0
    };
    const context = { source: { surface: "preview" as const } };
    let schemaNowMs = 0;
    const schemaValidated = evaluateRuntimeFrame(
      graph,
      input,
      state,
      defaultRuntimeEvaluationOptions(),
      context,
      {
        enabled: true,
        now: () => {
          schemaNowMs += 1;
          return schemaNowMs;
        }
      },
      {
        snapshotValidation: "schema"
      }
    );
    let skipNowMs = 0;
    const validationSkipped = evaluateRuntimeFrame(
      graph,
      input,
      state,
      defaultRuntimeEvaluationOptions(),
      context,
      {
        enabled: true,
        now: () => {
          skipNowMs += 1;
          return skipNowMs;
        }
      },
      {
        snapshotValidation: "skip"
      }
    );

    expect(validationSkipped.snapshot).toEqual(schemaValidated.snapshot);
    expect(validationSkipped.profile?.snapshotValidationDurationMs).toBe(0);
    expect(schemaValidated.profile?.snapshotValidationDurationMs)
      .toBeGreaterThan(0);
  });

  it("preserves schema validation when snapshot validation is requested", () => {
    const packageId = PackageIdSchema.parse("pkg_validation_schema");
    const graph = createGraph({
      packageId,
      packageRevision: -1
    });

    expect(() =>
      createRuntimeSnapshot({
        graph,
        evaluationInput: {
          schemaVersion: "runtime-evaluation-input-v1",
          frameIndex: 0,
          deltaTimeMs: 0,
          resetReasons: [],
          authoredParameterValues: {},
          targetIds: []
        },
        state: {
          schemaVersion: "runtime-state-v1",
          packageId,
          packageRevision: 0,
          frameIndex: 0,
          fixedStepMs: 16.6666667,
          accumulatorMs: 0,
          dynamicsGroups: {}
        },
        options: defaultRuntimeEvaluationOptions(),
        context: {
          source: { surface: "validator" },
          policy: { strictness: "strict" }
        },
        diagnostics: [],
        snapshotValidationMode: "schema"
      })
    ).toThrow();
  });

  it("exposes a compiled runtime model API that matches legacy frame evaluation", () => {
    const packageId = PackageIdSchema.parse("pkg_compiled_api");
    const drawableId = DrawableIdSchema.parse("draw_compiled_api");
    const meshId = MeshIdSchema.parse("mesh_compiled_api");
    const graph = createGraph({
      packageId,
      drawables: new Map([
        [
          drawableId,
          {
            drawableId,
            meshId,
            visible: true,
            opacity: 0.8,
            baseDrawOrder: 4,
            bounds: { x: 1, y: 2, width: 32, height: 48 },
            vertexCount: 4
          }
        ]
      ])
    });
    const initialState = createInitialRuntimeState(graph, {
      packageId,
      packageRevision: 0,
      resetReasons: ["packageLoad"]
    });
    const input = {
      schemaVersion: "runtime-evaluation-input-v1" as const,
      frameIndex: 1,
      deltaTimeMs: 0,
      authoredParameterValues: {}
    };
    const evaluationOptions = defaultRuntimeEvaluationOptions();
    const context = { source: { surface: "preview" as const } };

    const legacy = evaluateRuntimeFrame(
      graph,
      input,
      initialState,
      evaluationOptions,
      context
    );
    const compiled = compileRuntimeModel(graph);
    const instance = compiled.createInstance({ initialState });
    const compiledResult = instance.evaluateFrame(input, {
      evaluationOptions,
      context
    });

    expect(runtimeCore.compileRuntimeModel).toBe(compileRuntimeModel);
    expect(compiledResult).toEqual(legacy);
  });

  it("exposes renderer-facing render frame output with dynamic drawable fields", () => {
    const packageId = PackageIdSchema.parse("pkg_render_frame_api");
    const parameterId = ParameterIdSchema.parse("param_render_frame");
    const bodyDrawableId = DrawableIdSchema.parse("draw_render_body");
    const faceDrawableId = DrawableIdSchema.parse("draw_render_face");
    const bodyMeshId = MeshIdSchema.parse("mesh_render_body");
    const faceMeshId = MeshIdSchema.parse("mesh_render_face");
    const bodyVertices = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 4 }
    ];
    const faceVertices = [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
      { x: 1, y: 3 }
    ];
    const graph = createGraph({
      packageId,
      parameters: new Map([
        [
          parameterId,
          {
            id: parameterId,
            displayName: "Render Frame Control",
            valueSource: "authoredInput",
            min: 0,
            max: 1,
            default: 0
          }
        ]
      ]),
      drawables: new Map([
        [
          bodyDrawableId,
          {
            drawableId: bodyDrawableId,
            meshId: bodyMeshId,
            visible: true,
            opacity: 1,
            baseDrawOrder: 0,
            bounds: { x: 0, y: 0, width: 4, height: 4 },
            vertexCount: bodyVertices.length,
            vertices: bodyVertices
          }
        ],
        [
          faceDrawableId,
          {
            drawableId: faceDrawableId,
            meshId: faceMeshId,
            visible: false,
            opacity: 0.5,
            baseDrawOrder: 5,
            bounds: { x: 1, y: 1, width: 2, height: 2 },
            vertexCount: faceVertices.length,
            vertices: faceVertices
          }
        ]
      ]),
      keyformBindings: [
        {
          evaluator: "linear-1d-v1",
          keyformSetId: KeyformSetIdSchema.parse("keyset_render_frame_opacity"),
          targetId: faceDrawableId,
          targetKind: "drawable",
          targetProperty: "opacity",
          parameterId,
          keys: [
            { value: 0, statePatch: 0.5 },
            { value: 1, statePatch: 0.75 }
          ],
          compositionMode: "replace",
          compositionOrder: 0
        },
        {
          evaluator: "linear-1d-v1",
          keyformSetId: KeyformSetIdSchema.parse("keyset_render_frame_draw_order"),
          targetId: faceDrawableId,
          targetKind: "drawable",
          targetProperty: "drawOrder",
          parameterId,
          keys: [
            { value: 0, statePatch: 5 },
            { value: 1, statePatch: -1 }
          ],
          compositionMode: "replace",
          compositionOrder: 1
        }
      ]
    });
    const initialState = createInitialRuntimeState(graph, {
      packageId,
      packageRevision: 0,
      resetReasons: ["packageLoad"]
    });
    const input = {
      schemaVersion: "runtime-evaluation-input-v1" as const,
      frameIndex: 1,
      deltaTimeMs: 0,
      authoredParameterValues: {
        [parameterId]: 1
      }
    };
    const evaluationOptions = defaultRuntimeEvaluationOptions();
    const context = { source: { surface: "preview" as const } };

    const publicResult = evaluateRuntimeFrame(
      graph,
      input,
      initialState,
      evaluationOptions,
      context
    );
    const instance = compileRuntimeModel(graph).createInstance({ initialState });
    const renderResult = instance.evaluateRenderFrame(input, {
      evaluationOptions,
      context
    });

    expect(typeof instance.evaluateRenderFrame).toBe("function");
    expect("snapshot" in renderResult).toBe(false);
    expect(publicResult.snapshot.evaluation.snapshotDetail).toBe("summary");
    expect(publicResult.snapshot.drawables.find((drawable) =>
      drawable.drawableId === faceDrawableId
    )?.vertices).toBeUndefined();
    expect(renderResult.nextState.frameIndex).toBe(1);
    expect(renderResult.frame.drawables.map((drawable) => drawable.drawableId)).toEqual([
      faceDrawableId,
      bodyDrawableId
    ]);
    expect(renderResult.frame.drawables.find((drawable) =>
      drawable.drawableId === faceDrawableId
    )).toMatchObject({
      drawableId: faceDrawableId,
      index: 1,
      vertices: faceVertices,
      opacity: 0.75,
      drawOrder: -1,
      visible: false
    });
    expect(renderResult.frame.drawables.find((drawable) =>
      drawable.drawableId === bodyDrawableId
    )).toMatchObject({
      drawableId: bodyDrawableId,
      index: 0,
      vertices: bodyVertices,
      opacity: 1,
      drawOrder: 0,
      visible: true
    });
  });

  it("matches full public snapshot render values without public snapshot materialization", () => {
    const packageId = PackageIdSchema.parse("pkg_render_frame_fast_path");
    const poseParameterId = ParameterIdSchema.parse("param_fast_pose");
    const driverParameterId = ParameterIdSchema.parse("param_fast_driver");
    const dynamicOpacityParameterId = ParameterIdSchema.parse("param_fast_dynamic_opacity");
    const dynamicsGroupId = DynamicsGroupIdSchema.parse("dyn_fast_opacity");
    const bodyDrawableId = DrawableIdSchema.parse("draw_fast_body");
    const faceDrawableId = DrawableIdSchema.parse("draw_fast_face");
    const bodyMeshId = MeshIdSchema.parse("mesh_fast_body");
    const faceMeshId = MeshIdSchema.parse("mesh_fast_face");
    const bodyVertices = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 4 }
    ];
    const deformedBodyVertices = [
      { x: -1, y: 1 },
      { x: 5, y: 1 },
      { x: -1, y: 6 }
    ];
    const faceVertices = [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
      { x: 1, y: 3 }
    ];
    const dynamicsGroup: NormalizedDynamicsGroup = {
      dynamicsGroupId,
      displayName: "Fast Opacity",
      enabled: true,
      inputs: [
        {
          parameterId: driverParameterId,
          kind: "angle",
          scale: -45
        }
      ],
      chain: {
        rootOffset: { x: 0, y: 0 },
        segmentLengths: [1],
        damping: 2.5,
        gravityScale: 1
      },
      outputs: [
        {
          parameterId: dynamicOpacityParameterId,
          segmentIndex: 1,
          scale: 1,
          limit: 1
        }
      ]
    };
    const graph = createGraph({
      packageId,
      parameters: new Map([
        [
          poseParameterId,
          {
            id: poseParameterId,
            displayName: "Fast Pose",
            valueSource: "authoredInput",
            min: 0,
            max: 1,
            default: 0
          }
        ],
        [
          driverParameterId,
          {
            id: driverParameterId,
            displayName: "Fast Driver",
            valueSource: "authoredInput",
            min: 0,
            max: 1,
            default: 0
          }
        ],
        [
          dynamicOpacityParameterId,
          {
            id: dynamicOpacityParameterId,
            displayName: "Fast Dynamic Opacity",
            valueSource: "authoredInput",
            min: 0,
            max: 1,
            default: 0
          }
        ]
      ]),
      dynamicsGroups: new Map([[dynamicsGroupId, dynamicsGroup]]),
      drawables: new Map([
        [
          bodyDrawableId,
          {
            drawableId: bodyDrawableId,
            meshId: bodyMeshId,
            visible: false,
            opacity: 0.2,
            baseDrawOrder: 4,
            bounds: { x: 0, y: 0, width: 4, height: 4 },
            vertexCount: bodyVertices.length,
            vertices: bodyVertices
          }
        ],
        [
          faceDrawableId,
          {
            drawableId: faceDrawableId,
            meshId: faceMeshId,
            visible: true,
            opacity: 0.5,
            baseDrawOrder: 0,
            bounds: { x: 1, y: 1, width: 2, height: 2 },
            vertexCount: faceVertices.length,
            vertices: faceVertices
          }
        ]
      ]),
      keyformBindings: [
        {
          evaluator: "linear-1d-v1",
          keyformSetId: KeyformSetIdSchema.parse("keyset_fast_vertices"),
          targetId: bodyMeshId,
          targetKind: "mesh",
          targetProperty: "vertices",
          parameterId: poseParameterId,
          keys: [
            { value: 0, statePatch: bodyVertices },
            { value: 1, statePatch: deformedBodyVertices }
          ],
          compositionMode: "replace",
          compositionOrder: 0
        },
        {
          evaluator: "linear-1d-v1",
          keyformSetId: KeyformSetIdSchema.parse("keyset_fast_draw_order"),
          targetId: bodyDrawableId,
          targetKind: "drawable",
          targetProperty: "drawOrder",
          parameterId: poseParameterId,
          keys: [
            { value: 0, statePatch: 4 },
            { value: 1, statePatch: -2 }
          ],
          compositionMode: "replace",
          compositionOrder: 2
        },
        {
          evaluator: "linear-1d-v1",
          keyformSetId: KeyformSetIdSchema.parse("keyset_fast_dynamic_opacity"),
          targetId: bodyDrawableId,
          targetKind: "drawable",
          targetProperty: "opacity",
          parameterId: dynamicOpacityParameterId,
          keys: [
            { value: 0, statePatch: 0.2 },
            { value: 1, statePatch: 0.9 }
          ],
          compositionMode: "replace",
          compositionOrder: 3
        }
      ]
    });
    const initialState = createInitialRuntimeState(graph, {
      packageId,
      packageRevision: 0,
      authoredParameterValues: {
        [driverParameterId]: 0,
        [poseParameterId]: 0
      },
      resetReasons: ["packageLoad"]
    });
    const input = {
      schemaVersion: "runtime-evaluation-input-v1" as const,
      frameIndex: 1,
      deltaTimeMs: 0,
      resetReasons: ["previewRestart" as const],
      authoredParameterValues: {
        [driverParameterId]: 1,
        [poseParameterId]: 1
      }
    };
    const context = { source: { surface: "preview" as const } };
    let publicNowMs = 0;
    const publicResult = evaluateRuntimeFrame(
      graph,
      input,
      initialState,
      {
        ...defaultRuntimeEvaluationOptions(),
        snapshotDetail: "full" as const
      },
      context,
      {
        enabled: true,
        now: () => {
          publicNowMs += 1;
          return publicNowMs;
        }
      },
      {
        snapshotValidation: "skip"
      }
    );
    const instance = compileRuntimeModel(graph).createInstance({ initialState });
    let renderNowMs = 0;
    const renderResult = instance.evaluateRenderFrame(input, {
      evaluationOptions: defaultRuntimeEvaluationOptions(),
      context,
      profilingOptions: {
        enabled: true,
        now: () => {
          renderNowMs += 1;
          return renderNowMs;
        }
      },
      controlOptions: {
        snapshotValidation: "skip"
      }
    });
    const drawableIndexById = new Map([
      [faceDrawableId, 0],
      [bodyDrawableId, 1]
    ]);

    expect(renderResult.frame.drawables).toEqual(
      publicResult.snapshot.drawables.map((drawable, fallbackIndex) => ({
        drawableId: drawable.drawableId,
        index: drawableIndexById.get(drawable.drawableId) ?? fallbackIndex,
        vertices: drawable.vertices ?? [],
        opacity: drawable.opacity,
        drawOrder: drawable.evaluatedDrawOrder,
        visible: drawable.visible
      }))
    );
    expect(renderResult.frame.drawables.find((drawable) =>
      drawable.drawableId === bodyDrawableId
    )).toMatchObject({
      vertices: deformedBodyVertices,
      opacity: 0.9,
      drawOrder: -2,
      visible: false
    });
    // deltaTimeMs 0 + previewRestart reset → chain aligned straight below the pin (§3.4);
    // driver 1 with input scale −45 gives φ = −45°, so θ_local = +45° and the output clamps to 1.
    expect(renderResult.nextState.dynamicsGroups[dynamicsGroupId]).toMatchObject({
      particles: [{ x: 0, y: 1, px: 0, py: 1 }],
      resetCounter: 2
    });
    expect("snapshot" in renderResult).toBe(false);
    expect(publicResult.profile?.publicSnapshotMaterializationCount).toBe(1);
    expect(renderResult.profile?.publicSnapshotMaterializationCount).toBe(0);
    expect(renderResult.profile?.runtimeSnapshotCreationDurationMs).toBe(0);
    expect(renderResult.profile?.snapshotValidationDurationMs).toBe(0);
    expect(renderResult.profile?.runtimeCoreRenderFrameOutputDurationMs)
      .toBeGreaterThan(0);
  });

  it("keeps previous public snapshots isolated when render frames are evaluated", () => {
    const packageId = PackageIdSchema.parse("pkg_render_frame_freshness");
    const drawableId = DrawableIdSchema.parse("draw_render_frame_freshness");
    const meshId = MeshIdSchema.parse("mesh_render_frame_freshness");
    const vertices = [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 0, y: 8 }
    ];
    const graph = createGraph({
      packageId,
      drawables: new Map([
        [
          drawableId,
          {
            drawableId,
            meshId,
            visible: true,
            opacity: 0.9,
            baseDrawOrder: 3,
            bounds: { x: 0, y: 0, width: 8, height: 8 },
            vertexCount: vertices.length,
            vertices
          }
        ]
      ])
    });
    const instance = compileRuntimeModel(graph).createInstance();
    const context = { source: { surface: "preview" as const } };
    const first = instance.evaluateFrame(
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 1,
        deltaTimeMs: 0
      },
      {
        evaluationOptions: {
          ...defaultRuntimeEvaluationOptions(),
          snapshotDetail: "full" as const
        },
        context
      }
    );
    const firstSnapshotBefore = JSON.parse(JSON.stringify(first.snapshot));
    const renderFrame = instance.evaluateRenderFrame(
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 2,
        deltaTimeMs: 0
      },
      {
        evaluationOptions: defaultRuntimeEvaluationOptions(),
        context
      }
    );

    expect(first.snapshot).toEqual(firstSnapshotBefore);
    expect(renderFrame.frame.drawables[0]?.vertices).toEqual(vertices);
    expect(renderFrame.frame.drawables[0]?.vertices)
      .not.toBe(first.snapshot.drawables[0]?.vertices);
    expect(first.nextState.frameIndex).toBe(1);
    expect(renderFrame.nextState.frameIndex).toBe(2);
  });

  it("advances compiled runtime model instance state without reusing snapshots", () => {
    const packageId = PackageIdSchema.parse("pkg_compiled_state");
    const drawableId = DrawableIdSchema.parse("draw_compiled_state");
    const meshId = MeshIdSchema.parse("mesh_compiled_state");
    const graph = createGraph({
      packageId,
      drawables: new Map([
        [
          drawableId,
          {
            drawableId,
            meshId,
            visible: true,
            opacity: 1,
            baseDrawOrder: 2,
            bounds: { x: 0, y: 0, width: 16, height: 16 },
            vertexCount: 4
          }
        ]
      ])
    });
    const instance = compileRuntimeModel(graph).createInstance();
    const evaluationOptions = defaultRuntimeEvaluationOptions();
    const context = { source: { surface: "preview" as const } };

    const first = instance.evaluateFrame(
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 1,
        deltaTimeMs: 0
      },
      {
        evaluationOptions,
        context
      }
    );
    const firstSnapshotBefore = JSON.parse(JSON.stringify(first.snapshot));
    const second = instance.evaluateFrame(
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 2,
        deltaTimeMs: 0
      },
      {
        evaluationOptions,
        context
      }
    );

    expect(first.snapshot).not.toBe(second.snapshot);
    expect(first.snapshot.drawables[0]).not.toBe(second.snapshot.drawables[0]);
    expect(first.snapshot).toEqual(firstSnapshotBefore);
    expect(first.nextState.frameIndex).toBe(1);
    expect(second.nextState.frameIndex).toBe(2);
    expect(instance.getState().frameIndex).toBe(2);
  });
});

const createGraph = (
  overrides: Pick<NormalizedRuntimeGraph, "packageId"> & Partial<NormalizedRuntimeGraph>
): NormalizedRuntimeGraph => ({
  packageId: overrides.packageId,
  packageRevision: overrides.packageRevision ?? 0,
  ...(overrides.packageHash === undefined ? {} : { packageHash: overrides.packageHash }),
  coordinateSystem: "canvas-y-down-v1",
  parameters: overrides.parameters ?? new Map(),
  dynamicsGroups: overrides.dynamicsGroups ?? new Map(),
  drawables: overrides.drawables ?? new Map(),
  rigControls: overrides.rigControls ?? new Map(),
  keyformBindings: overrides.keyformBindings ?? [],
  masks: overrides.masks ?? [],
  drawOrder: overrides.drawOrder ?? [],
  disabledFutureLayers: overrides.disabledFutureLayers ?? []
});
