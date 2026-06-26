import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createInitialRuntimeState } from "./initial-state.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import { defaultRuntimeEvaluationOptions } from "./runtime-options.js";
import { evaluateRuntimeFrame, evaluateRuntimeSequence } from "./runtime-core.js";
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
