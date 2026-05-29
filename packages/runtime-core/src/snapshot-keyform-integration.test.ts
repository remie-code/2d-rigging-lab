import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createInitialRuntimeState } from "./initial-state.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import { defaultRuntimeEvaluationOptions } from "./runtime-options.js";
import { evaluateRuntimeFrame } from "./runtime-core.js";
import { compareRuntimeSnapshots } from "./snapshot-comparison.js";
import { RuntimeSnapshotSchema } from "./snapshot.js";

describe("runtime snapshot keyform integration", () => {
  it("samples keyforms and applies target patches during frame evaluation", () => {
    const fixture = createKeyformFixture();
    const state = createInitialRuntimeState(fixture.graph, {
      packageId: fixture.graph.packageId,
      packageRevision: fixture.graph.packageRevision,
      packageHash: "hash-keyform-integration",
      resetReasons: ["packageLoad"]
    });

    const result = evaluateRuntimeFrame(
      fixture.graph,
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 1,
        deltaTimeMs: 0,
        authoredParameterValues: {
          [fixture.parameterId]: 1
        }
      },
      state,
      {
        ...defaultRuntimeEvaluationOptions(),
        includeTrace: true
      },
      { source: { surface: "preview" } }
    );

    expect(result.snapshot.keyformSamples.map((sample) => sample.keyformSetId)).toEqual([
      fixture.meshKeyformSetId,
      fixture.opacityFirstKeyformSetId,
      fixture.opacitySecondKeyformSetId,
      fixture.drawOrderKeyformSetId
    ]);
    expect(result.snapshot.keyformSamples[0]).toMatchObject({
      evaluator: "linear-1d-v1",
      sampledCoordinates: {
        [fixture.parameterId]: 1
      },
      target: `mesh:${fixture.meshId}.vertices`,
      targetMetadata: {
        targetKind: "mesh",
        targetId: fixture.meshId,
        targetProperty: "vertices"
      },
      samplingStatus: "exact"
    });

    const drawable = result.snapshot.drawables.find((candidate) => candidate.drawableId === fixture.drawableId);
    expect(drawable).toBeDefined();
    expect(drawable).toMatchObject({
      bounds: { x: 0, y: 0, width: 2, height: 2 },
      opacity: 0.5,
      evaluatedDrawOrder: 7
    });
    expect(drawable?.vertices).toBeUndefined();
    expect(drawable?.vertexHash).toMatch(/^vhash_/);
    expect(result.snapshot.trace?.phases).toContain("keyform_sampling");
    expect(result.snapshot.diagnostics).toEqual([]);
  });

  it("compares drawable keyform effects even when vertices and bounds are unchanged", () => {
    const fixture = createDrawableOnlyKeyformFixture();
    const state = createInitialRuntimeState(fixture.graph, {
      packageId: fixture.graph.packageId,
      packageRevision: fixture.graph.packageRevision,
      packageHash: "hash-keyform-compare",
      resetReasons: ["packageLoad"]
    });
    const options = defaultRuntimeEvaluationOptions();
    const before = evaluateRuntimeFrame(
      fixture.graph,
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 0,
        deltaTimeMs: 0,
        authoredParameterValues: {
          [fixture.parameterId]: 0
        }
      },
      state,
      options,
      { source: { surface: "validator" } }
    ).snapshot;
    const after = evaluateRuntimeFrame(
      fixture.graph,
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 1,
        deltaTimeMs: 0,
        authoredParameterValues: {
          [fixture.parameterId]: 1
        }
      },
      state,
      options,
      { source: { surface: "validator" } }
    ).snapshot;

    const comparison = compareRuntimeSnapshots(before, after);
    expect(comparison.equivalent).toBe(false);
    expect(comparison.diff.drawableChanges).toEqual([
      {
        drawableId: fixture.drawableId,
        boundsChanged: false,
        vertexHashBefore: "hash_draw_body_4",
        vertexHashAfter: "hash_draw_body_4"
      }
    ]);

    const hidden = RuntimeSnapshotSchema.parse({
      ...before,
      snapshotId: "snap_keyform_compare_hidden",
      drawables: before.drawables.map((drawable) =>
        drawable.drawableId === fixture.drawableId
          ? {
              ...drawable,
              visible: false
            }
          : drawable
      ),
      drawList: []
    });
    const visibilityComparison = compareRuntimeSnapshots(before, hidden);
    expect(visibilityComparison.equivalent).toBe(false);
    expect(visibilityComparison.diff.parameterChanges).toContainEqual({
      path: "/drawList",
      before: [fixture.drawableId],
      after: []
    });
    expect(visibilityComparison.diff.drawableChanges).toHaveLength(1);
  });
});

const createKeyformFixture = () => {
  const packageId = PackageIdSchema.parse("pkg_keyform_integration");
  const parameterId = ParameterIdSchema.parse("param_yaw");
  const drawableId = DrawableIdSchema.parse("draw_body");
  const meshId = MeshIdSchema.parse("mesh_body");
  const meshKeyformSetId = KeyformSetIdSchema.parse("keyset_meshVertices");
  const opacityFirstKeyformSetId = KeyformSetIdSchema.parse("keyset_zOpacity");
  const opacitySecondKeyformSetId = KeyformSetIdSchema.parse("keyset_aOpacity");
  const drawOrderKeyformSetId = KeyformSetIdSchema.parse("keyset_drawOrder");
  const graph = createGraph({
    packageId,
    packageHash: "hash-keyform-integration",
    parameters: new Map([
      [
        parameterId,
        {
          id: parameterId,
          displayName: "Yaw",
          valueSource: "authoredInput",
          min: 0,
          max: 1,
          default: 0
        }
      ]
    ]),
    drawables: new Map([
      [
        drawableId,
        {
          drawableId,
          meshId,
          visible: true,
          opacity: 1,
          baseDrawOrder: 10,
          bounds: { x: 0, y: 0, width: 1, height: 1 },
          vertices: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 }
          ],
          vertexCount: 3
        }
      ]
    ]),
    keyformBindings: [
      {
        evaluator: "linear-1d-v1",
        keyformSetId: meshKeyformSetId,
        targetKind: "mesh",
        targetId: meshId,
        targetProperty: "vertices",
        parameterId,
        keys: [
          {
            value: 0,
            statePatch: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 0, y: 1 }
            ]
          },
          {
            value: 1,
            statePatch: [
              { x: 0, y: 0 },
              { x: 2, y: 0 },
              { x: 0, y: 2 }
            ]
          }
        ],
        compositionMode: "replace",
        compositionOrder: 0
      },
      {
        evaluator: "linear-1d-v1",
        keyformSetId: opacityFirstKeyformSetId,
        targetKind: "drawable",
        targetId: drawableId,
        targetProperty: "opacity",
        parameterId,
        keys: [
          { value: 0, statePatch: 1 },
          { value: 1, statePatch: 0.2 }
        ],
        compositionMode: "replace",
        compositionOrder: 1
      },
      {
        evaluator: "linear-1d-v1",
        keyformSetId: opacitySecondKeyformSetId,
        targetKind: "drawable",
        targetId: drawableId,
        targetProperty: "opacity",
        parameterId,
        keys: [
          { value: 0, statePatch: 1 },
          { value: 1, statePatch: 0.5 }
        ],
        compositionMode: "replace",
        compositionOrder: 1
      },
      {
        evaluator: "linear-1d-v1",
        keyformSetId: drawOrderKeyformSetId,
        targetKind: "drawable",
        targetId: drawableId,
        targetProperty: "drawOrder",
        parameterId,
        keys: [
          { value: 0, statePatch: 10 },
          { value: 1, statePatch: 7 }
        ],
        compositionMode: "replace",
        compositionOrder: 2
      }
    ]
  });

  return {
    graph,
    parameterId,
    drawableId,
    meshId,
    meshKeyformSetId,
    opacityFirstKeyformSetId,
    opacitySecondKeyformSetId,
    drawOrderKeyformSetId
  };
};

const createDrawableOnlyKeyformFixture = () => {
  const packageId = PackageIdSchema.parse("pkg_keyform_compare");
  const parameterId = ParameterIdSchema.parse("param_yaw");
  const drawableId = DrawableIdSchema.parse("draw_body");
  const meshId = MeshIdSchema.parse("mesh_body");
  const opacityKeyformSetId = KeyformSetIdSchema.parse("keyset_opacity");
  const drawOrderKeyformSetId = KeyformSetIdSchema.parse("keyset_order");
  const graph = createGraph({
    packageId,
    packageHash: "hash-keyform-compare",
    parameters: new Map([
      [
        parameterId,
        {
          id: parameterId,
          displayName: "Yaw",
          valueSource: "authoredInput",
          min: 0,
          max: 1,
          default: 0
        }
      ]
    ]),
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
    ]),
    keyformBindings: [
      {
        evaluator: "linear-1d-v1",
        keyformSetId: opacityKeyformSetId,
        targetKind: "drawable",
        targetId: drawableId,
        targetProperty: "opacity",
        parameterId,
        keys: [
          { value: 0, statePatch: 1 },
          { value: 1, statePatch: 0.25 }
        ],
        compositionMode: "replace",
        compositionOrder: 0
      },
      {
        evaluator: "linear-1d-v1",
        keyformSetId: drawOrderKeyformSetId,
        targetKind: "drawable",
        targetId: drawableId,
        targetProperty: "drawOrder",
        parameterId,
        keys: [
          { value: 0, statePatch: 10 },
          { value: 1, statePatch: 8 }
        ],
        compositionMode: "replace",
        compositionOrder: 1
      }
    ]
  });

  return {
    graph,
    parameterId,
    drawableId
  };
};

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
