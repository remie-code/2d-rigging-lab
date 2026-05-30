import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createInitialRuntimeState } from "./initial-state.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import { defaultRuntimeEvaluationOptions } from "./runtime-options.js";
import { evaluateRuntimeFrame } from "./runtime-core.js";
import type { NormalizedDrawableTextureReference } from "./texture-projection.js";

describe("runtime texture projection metadata", () => {
  it("carries texture refs and UV projection in full detail without claiming materialized rendering", () => {
    const graph = createTextureGraph();
    const state = createInitialRuntimeState(graph, {
      packageId: graph.packageId,
      packageRevision: graph.packageRevision,
      resetReasons: ["packageLoad"]
    });

    const result = evaluateRuntimeFrame(
      graph,
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 1,
        deltaTimeMs: 0
      },
      state,
      {
        ...defaultRuntimeEvaluationOptions(),
        snapshotDetail: "full"
      },
      { source: { surface: "preview" } }
    );

    const drawable = expectDrawable(result.snapshot.drawables[0]);
    expect(drawable).toMatchObject({
      drawableId: "draw_body",
      vertexCount: 4,
      vertices: [
        { x: 0, y: 0 },
        { x: 64, y: 0 },
        { x: 64, y: 64 },
        { x: 0, y: 64 }
      ],
      texture: {
        status: "not_materialized",
        textureId: "tex_body",
        sourceAssetId: "src_split_body",
        sourceLayerId: "layer_body",
        projection: {
          kind: "uv",
          uvCount: 4,
          uvs: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 }
          ]
        }
      }
    });
  });

  it("keeps texture status and UV counts but omits UV coordinates outside full detail", () => {
    const graph = createTextureGraph({
      status: "resolved"
    });
    const state = createInitialRuntimeState(graph, {
      packageId: graph.packageId,
      packageRevision: graph.packageRevision,
      resetReasons: ["packageLoad"]
    });

    const result = evaluateRuntimeFrame(
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

    const drawable = expectDrawable(result.snapshot.drawables[0]);
    expect(drawable.vertices).toBeUndefined();
    expect(drawable.texture).toEqual({
      status: "resolved",
      textureId: "tex_body",
      sourceAssetId: "src_split_body",
      sourceLayerId: "layer_body",
      projection: {
        kind: "uv",
        uvCount: 4
      },
      diagnostics: []
    });
  });

  it("carries explicit missing texture state with a bounds-fit projection hint", () => {
    const graph = createTextureGraph({
      status: "missing",
      includeTextureId: false,
      projection: { kind: "bounds_fit" }
    });
    const state = createInitialRuntimeState(graph, {
      packageId: graph.packageId,
      packageRevision: graph.packageRevision,
      resetReasons: ["packageLoad"]
    });

    const result = evaluateRuntimeFrame(
      graph,
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 1,
        deltaTimeMs: 0
      },
      state,
      {
        ...defaultRuntimeEvaluationOptions(),
        snapshotDetail: "full"
      },
      { source: { surface: "preview" } }
    );

    expect(result.snapshot.drawables[0]?.texture).toEqual({
      status: "missing",
      sourceAssetId: "src_split_body",
      sourceLayerId: "layer_body",
      projection: {
        kind: "bounds_fit"
      },
      diagnostics: []
    });
  });

  it("falls back to bounds-fit projection when mesh keyforms change the vertex count", () => {
    const parameterId = ParameterIdSchema.parse("param_texture_shape");
    const graph = createTextureGraph({
      parameters: new Map([
        [
          parameterId,
          {
            id: parameterId,
            displayName: "Texture shape",
            valueSource: "authoredInput",
            min: 0,
            max: 1,
            default: 0
          }
        ]
      ]),
      keyformBindings: [
        {
          evaluator: "linear-1d-v1",
          keyformSetId: KeyformSetIdSchema.parse("keyset_texture_shape"),
          targetKind: "mesh",
          targetId: MeshIdSchema.parse("mesh_body"),
          targetProperty: "vertices",
          parameterId,
          keys: [
            {
              value: 1,
              statePatch: [
                { x: 0, y: 0 },
                { x: 64, y: 0 },
                { x: 0, y: 64 }
              ]
            }
          ],
          compositionMode: "replace",
          compositionOrder: 0
        }
      ]
    });
    const state = createInitialRuntimeState(graph, {
      packageId: graph.packageId,
      packageRevision: graph.packageRevision,
      resetReasons: ["packageLoad"]
    });

    const result = evaluateRuntimeFrame(
      graph,
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 1,
        deltaTimeMs: 0,
        authoredParameterValues: {
          [parameterId]: 1
        }
      },
      state,
      {
        ...defaultRuntimeEvaluationOptions(),
        snapshotDetail: "full"
      },
      { source: { surface: "preview" } }
    );

    const drawable = expectDrawable(result.snapshot.drawables[0]);
    expect(drawable.vertexCount).toBe(3);
    expect(drawable.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 64, y: 0 },
      { x: 0, y: 64 }
    ]);
    expect(drawable.texture?.projection).toEqual({ kind: "bounds_fit" });
  });
});

interface TextureGraphOptions extends Pick<NormalizedDrawableTextureReference, "projection" | "status"> {
  readonly includeTextureId?: boolean;
  readonly keyformBindings?: NormalizedRuntimeGraph["keyformBindings"];
  readonly parameters?: NormalizedRuntimeGraph["parameters"];
}

const createTextureGraph = (options: TextureGraphOptions = {}): NormalizedRuntimeGraph => {
  const packageId = PackageIdSchema.parse("pkg_texture_projection");
  const drawableId = DrawableIdSchema.parse("draw_body");
  const meshId = MeshIdSchema.parse("mesh_body");
  const textureId = TextureIdSchema.parse("tex_body");
  const sourceAssetId = SourceAssetIdSchema.parse("src_split_body");

  return {
    packageId,
    packageRevision: 0,
    coordinateSystem: "canvas-y-down-v1",
    parameters: options.parameters ?? new Map(),
    dynamicsGroups: new Map(),
    drawables: new Map([
      [
        drawableId,
        {
          drawableId,
          meshId,
          texture: {
            ...(options.includeTextureId === false ? {} : { textureId }),
            sourceAssetId,
            sourceLayerId: "layer_body",
            projection: options.projection ?? {
              kind: "uv",
              uvs: [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 1, y: 1 },
                { x: 0, y: 1 }
              ]
            },
            ...(options.status === undefined ? {} : { status: options.status })
          },
          visible: true,
          opacity: 1,
          baseDrawOrder: 0,
          bounds: { x: 0, y: 0, width: 64, height: 64 },
          vertices: [
            { x: 0, y: 0 },
            { x: 64, y: 0 },
            { x: 64, y: 64 },
            { x: 0, y: 64 }
          ],
          vertexCount: 4
        }
      ]
    ]),
    rigControls: new Map(),
    keyformBindings: options.keyformBindings ?? [],
    masks: [],
    drawOrder: [{ drawableId, drawOrder: 0 }],
    disabledFutureLayers: []
  };
};

const expectDrawable = <TValue>(value: TValue | undefined): TValue => {
  expect(value).toBeDefined();
  return value as TValue;
};
