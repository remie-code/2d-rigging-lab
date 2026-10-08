import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MaskRelationIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { Vec2Dto } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createStableVertexHash } from "./drawable-geometry.js";
import { createInitialRuntimeState } from "./initial-state.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import { defaultRuntimeEvaluationOptions } from "./runtime-options.js";
import { compileRuntimeModel, evaluateRuntimeFrame } from "./runtime-core.js";
import type { EvaluatedDrawableDto, RuntimeSnapshotDto } from "./snapshot.js";

describe("compiled runtime snapshot static templates", () => {
  it("preserves legacy full snapshot output while keyforms change drawable state", () => {
    const fixture = createStaticTemplateFixture();
    const initialState = createInitialRuntimeState(fixture.graph, {
      packageId: fixture.graph.packageId,
      packageRevision: fixture.graph.packageRevision,
      packageHash: fixture.graph.packageHash,
      resetReasons: ["packageLoad"]
    });
    const options = {
      ...defaultRuntimeEvaluationOptions(),
      snapshotDetail: "full" as const
    };
    const input = createEvaluationInput(fixture, {
      frameIndex: 1,
      parameterValue: 1
    });
    const context = { source: { surface: "preview" as const } };
    const legacy = evaluateRuntimeFrame(
      fixture.graph,
      input,
      initialState,
      options,
      context,
      undefined,
      { snapshotValidation: "skip" }
    );
    const compiled = compileRuntimeModel(fixture.graph)
      .createInstance({ initialState })
      .evaluateFrame(input, {
        evaluationOptions: options,
        context,
        controlOptions: { snapshotValidation: "skip" }
      });

    expect(compiled).toEqual(legacy);
    expect(compiled.snapshot.drawables.map((drawable) => drawable.drawableId)).toEqual([
      fixture.keyedDrawableId,
      fixture.staticDrawableId
    ]);
    expect(compiled.snapshot.drawList).toEqual([fixture.keyedDrawableId]);

    const keyedDrawable = expectDrawable(compiled.snapshot, fixture.keyedDrawableId);
    expect(keyedDrawable).toMatchObject({
      opacity: 0.25,
      evaluatedDrawOrder: -2,
      bounds: { x: -1, y: 0, width: 4, height: 3 },
      vertexCount: 4,
      vertexHash: createStableVertexHash(fixture.deformedVertices)
    });
    expect(keyedDrawable.vertices).toEqual(fixture.deformedVertices);
    expect(getTextureUvs(keyedDrawable)).toEqual(fixture.uvs);
    expect(compiled.snapshot.masks).toEqual([
      {
        maskRelationId: fixture.maskRelationId,
        sourceDrawableIds: [fixture.keyedDrawableId],
        targetDrawableIds: [fixture.staticDrawableId],
        enabled: true,
        clippingIntent: "semanticClipping",
        resolved: true
      }
    ]);
  });

  it("materializes fresh nested arrays for consecutive compiled frames", () => {
    const fixture = createStaticTemplateFixture();
    const options = {
      ...defaultRuntimeEvaluationOptions(),
      snapshotDetail: "full" as const
    };
    const context = { source: { surface: "preview" as const } };
    const instance = compileRuntimeModel(fixture.graph).createInstance();

    const first = instance.evaluateFrame(
      createEvaluationInput(fixture, {
        frameIndex: 1,
        parameterValue: 0
      }),
      {
        evaluationOptions: options,
        context,
        controlOptions: { snapshotValidation: "skip" }
      }
    );
    const firstBeforeSecond = JSON.parse(JSON.stringify(first.snapshot)) as RuntimeSnapshotDto;
    const second = instance.evaluateFrame(
      createEvaluationInput(fixture, {
        frameIndex: 2,
        parameterValue: 1
      }),
      {
        evaluationOptions: options,
        context,
        controlOptions: { snapshotValidation: "skip" }
      }
    );

    expect(first.snapshot).toEqual(firstBeforeSecond);
    expect(first.snapshot).not.toBe(second.snapshot);
    expect(first.snapshot.drawList).not.toBe(second.snapshot.drawList);
    expect(expectDefined(first.snapshot.masks[0])).not.toBe(expectDefined(second.snapshot.masks[0]));
    expect(expectDefined(first.snapshot.masks[0]).sourceDrawableIds)
      .not.toBe(expectDefined(second.snapshot.masks[0]).sourceDrawableIds);

    const firstDrawable = expectDrawable(first.snapshot, fixture.keyedDrawableId);
    const secondDrawable = expectDrawable(second.snapshot, fixture.keyedDrawableId);
    expect(firstDrawable).not.toBe(secondDrawable);
    expect(firstDrawable.vertices).not.toBe(secondDrawable.vertices);
    expect(getTextureUvs(firstDrawable)).not.toBe(getTextureUvs(secondDrawable));

    expectDefined(expectDefined(firstDrawable.vertices)[0]).x = 999;
    expectDefined(getTextureUvs(firstDrawable)[0]).x = 999;
    expectDefined(first.snapshot.masks[0]).sourceDrawableIds.push(fixture.staticDrawableId);
    first.snapshot.drawList.push(fixture.staticDrawableId);

    const third = instance.evaluateFrame(
      createEvaluationInput(fixture, {
        frameIndex: 3,
        parameterValue: 0
      }),
      {
        evaluationOptions: options,
        context,
        controlOptions: { snapshotValidation: "skip" }
      }
    );
    const thirdDrawable = expectDrawable(third.snapshot, fixture.keyedDrawableId);
    expect(thirdDrawable.vertices).toEqual(fixture.baseVertices);
    expect(getTextureUvs(thirdDrawable)).toEqual(fixture.uvs);
    expect(third.snapshot.masks[0]?.sourceDrawableIds).toEqual([fixture.keyedDrawableId]);
    expect(third.snapshot.drawList).toEqual([fixture.keyedDrawableId]);
  });
});

const createStaticTemplateFixture = () => {
  const packageId = PackageIdSchema.parse("pkg_compiled_snapshot_templates");
  const parameterId = ParameterIdSchema.parse("param_template_pose");
  const keyedDrawableId = DrawableIdSchema.parse("draw_template_keyed");
  const staticDrawableId = DrawableIdSchema.parse("draw_template_static");
  const keyedMeshId = MeshIdSchema.parse("mesh_template_keyed");
  const staticMeshId = MeshIdSchema.parse("mesh_template_static");
  const textureId = TextureIdSchema.parse("tex_template_keyed");
  const sourceAssetId = SourceAssetIdSchema.parse("src_template_texture");
  const maskRelationId = MaskRelationIdSchema.parse("maskrel_template");
  const baseVertices = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 2 },
    { x: 0, y: 2 }
  ];
  const deformedVertices = [
    { x: -1, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 3 },
    { x: -1, y: 3 }
  ];
  const uvs = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 }
  ];
  const graph = createGraph({
    packageId,
    packageHash: "hash-compiled-snapshot-templates",
    parameters: new Map([
      [
        parameterId,
        {
          id: parameterId,
          displayName: "Template Pose",
          valueSource: "authoredInput",
          min: 0,
          max: 1,
          default: 0
        }
      ]
    ]),
    drawables: new Map([
      [
        keyedDrawableId,
        {
          drawableId: keyedDrawableId,
          meshId: keyedMeshId,
          texture: {
            textureId,
            sourceAssetId,
            sourceLayerId: "layer_template_keyed",
            projection: {
              kind: "uv",
              uvs
            }
          },
          visible: true,
          opacity: 1,
          baseDrawOrder: 10,
          bounds: { x: 0, y: 0, width: 2, height: 2 },
          vertices: baseVertices,
          vertexCount: baseVertices.length
        }
      ],
      [
        staticDrawableId,
        {
          drawableId: staticDrawableId,
          meshId: staticMeshId,
          visible: false,
          opacity: 0.75,
          baseDrawOrder: 5,
          bounds: { x: 10, y: 0, width: 4, height: 4 },
          vertexCount: 4
        }
      ]
    ]),
    keyformBindings: [
      {
        evaluator: "linear-1d-v1",
        keyformSetId: KeyformSetIdSchema.parse("keyset_template_vertices"),
        targetKind: "mesh",
        targetId: keyedMeshId,
        targetProperty: "vertices",
        parameterId,
        keys: [
          { value: 0, statePatch: baseVertices },
          { value: 1, statePatch: deformedVertices }
        ],
        compositionMode: "replace",
        compositionOrder: 0
      },
      {
        evaluator: "linear-1d-v1",
        keyformSetId: KeyformSetIdSchema.parse("keyset_template_opacity"),
        targetKind: "drawable",
        targetId: keyedDrawableId,
        targetProperty: "opacity",
        parameterId,
        keys: [
          { value: 0, statePatch: 1 },
          { value: 1, statePatch: 0.25 }
        ],
        compositionMode: "replace",
        compositionOrder: 1
      },
      {
        evaluator: "linear-1d-v1",
        keyformSetId: KeyformSetIdSchema.parse("keyset_template_draw_order"),
        targetKind: "drawable",
        targetId: keyedDrawableId,
        targetProperty: "drawOrder",
        parameterId,
        keys: [
          { value: 0, statePatch: 10 },
          { value: 1, statePatch: -2 }
        ],
        compositionMode: "replace",
        compositionOrder: 2
      }
    ],
    masks: [
      {
        maskRelationId,
        sourceDrawableIds: [keyedDrawableId],
        targetDrawableIds: [staticDrawableId]
      }
    ],
    drawOrder: [
      { drawableId: keyedDrawableId, drawOrder: 10 },
      { drawableId: staticDrawableId, drawOrder: 5 }
    ]
  });

  return {
    graph,
    parameterId,
    keyedDrawableId,
    staticDrawableId,
    maskRelationId,
    baseVertices,
    deformedVertices,
    uvs
  };
};

const createEvaluationInput = (
  fixture: ReturnType<typeof createStaticTemplateFixture>,
  input: {
    readonly frameIndex: number;
    readonly parameterValue: number;
  }
) => ({
  schemaVersion: "runtime-evaluation-input-v1" as const,
  frameIndex: input.frameIndex,
  deltaTimeMs: 0,
  authoredParameterValues: {
    [fixture.parameterId]: input.parameterValue
  }
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

const expectDrawable = (
  snapshot: RuntimeSnapshotDto,
  drawableId: string
): EvaluatedDrawableDto => {
  const drawable = snapshot.drawables.find((candidate) => candidate.drawableId === drawableId);
  expect(drawable).toBeDefined();
  return drawable as EvaluatedDrawableDto;
};

const getTextureUvs = (drawable: EvaluatedDrawableDto): Vec2Dto[] => {
  expect(drawable.texture?.projection.kind).toBe("uv");
  const projection = drawable.texture?.projection;
  if (projection?.kind !== "uv") {
    throw new Error("Expected UV projection.");
  }
  expect(projection.uvs).toBeDefined();
  return projection.uvs as Vec2Dto[];
};

const expectDefined = <TValue>(value: TValue | undefined): TValue => {
  expect(value).toBeDefined();
  return value as TValue;
};
