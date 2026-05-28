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
