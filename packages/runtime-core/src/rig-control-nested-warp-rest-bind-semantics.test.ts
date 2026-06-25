import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  ParameterIdSchema,
  RigControlIdSchema,
  RuntimeEvaluationContextSchema
} from "@private-2d-rigging-lab/contracts";
import type { RectDto, Vec2Dto } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createInitialRuntimeState } from "./initial-state.js";
import type {
  NormalizedRuntimeGraph,
  NormalizedWarpLattice2dRigControl
} from "./normalized-runtime-graph.js";
import { evaluateRuntimeFrame } from "./runtime-core.js";
import { RuntimeEvaluationInputSchema } from "./runtime-input.js";
import { defaultRuntimeEvaluationOptions } from "./runtime-options.js";
import type {
  RuntimeCoreEvaluationProfilingOptions
} from "./runtime-profiling.js";

const PARAMETER_ID = ParameterIdSchema.parse("param_rig_value");
const DRAWABLE_ID = DrawableIdSchema.parse("draw_subject");
const MESH_ID = MeshIdSchema.parse("mesh_subject");
const PARENT_RIG_ID = RigControlIdSchema.parse("rig_parent");
const CHILD_RIG_ID = RigControlIdSchema.parse("rig_child");

describe("runtime nested warp rest/bind semantics", () => {
  it("keeps a rest-inside vertex bound to the parent warp after child warp moves current outside", () => {
    const snapshot = evaluateFullFrame(
      createNestedWarpGraph({
        baseVertex: { x: 5, y: 5 },
        childOffset: { x: 20, y: 0 },
        childDomainBounds: { x: 5, y: 5, width: 1, height: 1 },
        parentDomainBounds: { x: 0, y: 0, width: 10, height: 10 },
        parentControlPointOffsets: createConstantControlPointOffsets({ x: 1, y: 2 })
      })
    );

    expect(expectDrawableVertices(snapshot)).toEqual([{ x: 26, y: 7 }]);
    expect(snapshot.diagnostics.filter((diagnostic) => diagnostic.phase === "rigControl_evaluation")).toEqual([]);
  });

  it("keeps a rest-outside vertex outside the parent warp even when child warp moves current inside", () => {
    const snapshot = evaluateFullFrame(
      createNestedWarpGraph({
        baseVertex: { x: 15, y: 5 },
        childOffset: { x: -10, y: 0 },
        childDomainBounds: { x: 15, y: 5, width: 1, height: 1 },
        parentDomainBounds: { x: 0, y: 0, width: 10, height: 10 },
        parentControlPointOffsets: createConstantControlPointOffsets({ x: 1, y: 2 })
      })
    );

    expect(expectDrawableVertices(snapshot)).toEqual([{ x: 5, y: 5 }]);
    expect(snapshot.diagnostics.filter((diagnostic) => diagnostic.phase === "rigControl_evaluation")).toEqual([]);
  });

  it("samples nonuniform parent warp displacement from rest coordinates instead of current coordinates", () => {
    const snapshot = evaluateFullFrame(
      createNestedWarpGraph({
        baseVertex: { x: 2, y: 5 },
        childOffset: { x: 6, y: 0 },
        childDomainBounds: { x: 2, y: 5, width: 1, height: 1 },
        parentDomainBounds: { x: 0, y: 0, width: 10, height: 10 },
        parentControlPointOffsets: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 0, y: 0 },
          { x: 10, y: 0 }
        ]
      })
    );

    expect(expectDrawableVertices(snapshot)).toEqual([{ x: 10, y: 5 }]);
    expect(snapshot.diagnostics.filter((diagnostic) => diagnostic.phase === "rigControl_evaluation")).toEqual([]);
  });

  it("reports reference/current vertex count mismatch and leaves current vertices as a safe fallback", () => {
    const snapshot = evaluateFullFrame(createVertexCountMismatchGraph());

    expect(expectDrawableVertices(snapshot)).toEqual([
      { x: 5, y: 5 },
      { x: 6, y: 5 }
    ]);
    expect(snapshot.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: "rigControl.vertexStreamLengthMismatch",
          severity: "error",
          phase: "rigControl_evaluation",
          target: { kind: "rigControl", id: "rig_parent" },
          evidence: expect.arrayContaining([
            "drawableId=draw_subject",
            "currentVertices=2",
            "referenceVertices=1"
          ])
        })
      ])
    );
  });

  it("records warpLattice2d vertex transform duration when profiling is enabled", () => {
    let nowMs = 0;
    const result = evaluateFullFrameResult(
      createNestedWarpGraph({
        baseVertex: { x: 5, y: 5 },
        childOffset: { x: 20, y: 0 },
        childDomainBounds: { x: 5, y: 5, width: 1, height: 1 },
        parentDomainBounds: { x: 0, y: 0, width: 10, height: 10 },
        parentControlPointOffsets: createConstantControlPointOffsets({
          x: 1,
          y: 2
        })
      }),
      {
        enabled: true,
        now: () => {
          nowMs += 1;
          return nowMs;
        }
      }
    );

    expect(result.profile?.deformerHierarchyEvaluationDurationMs)
      .toBeGreaterThan(0);
    expect(result.profile?.warpDeformerVertexTransformDurationMs)
      .toBeGreaterThan(0);
    expect(result.profile?.rotationDeformerVertexTransformDurationMs).toBe(0);
  });
});

const evaluateFullFrame = (graph: NormalizedRuntimeGraph) =>
  evaluateFullFrameResult(graph).snapshot;

const evaluateFullFrameResult = (
  graph: NormalizedRuntimeGraph,
  profilingOptions?: RuntimeCoreEvaluationProfilingOptions
) => {
  const input = RuntimeEvaluationInputSchema.parse({
    schemaVersion: "runtime-evaluation-input-v1",
    frameIndex: 1,
    deltaTimeMs: 0,
    resetReasons: [],
    authoredParameterValues: { [PARAMETER_ID]: 1 },
    targetIds: [PARENT_RIG_ID, CHILD_RIG_ID, DRAWABLE_ID]
  });
  const state = createInitialRuntimeState(graph, {
    packageId: graph.packageId,
    packageRevision: graph.packageRevision,
    frameIndex: 0,
    authoredParameterValues: input.authoredParameterValues,
    resetReasons: ["packageLoad"]
  });

  return evaluateRuntimeFrame(
    graph,
    input,
    state,
    {
      ...defaultRuntimeEvaluationOptions(),
      snapshotDetail: "full"
    },
    RuntimeEvaluationContextSchema.parse({
      source: { surface: "preview" },
      policy: { strictness: "interactive" }
    }),
    profilingOptions
  );
};

const createNestedWarpGraph = (input: {
  readonly baseVertex: Vec2Dto;
  readonly childOffset: Vec2Dto;
  readonly childDomainBounds: RectDto;
  readonly parentDomainBounds: RectDto;
  readonly parentControlPointOffsets: readonly Vec2Dto[];
}): NormalizedRuntimeGraph => ({
  packageId: "pkg_wave94_runtime_rest_bind",
  packageRevision: 1,
  coordinateSystem: "canvas-y-down-v1",
  parameters: createParameters(),
  dynamicsGroups: new Map(),
  drawables: new Map([
    [
      DRAWABLE_ID,
      {
        drawableId: DRAWABLE_ID,
        meshId: MESH_ID,
        visible: true,
        opacity: 1,
        baseDrawOrder: 0,
        bounds: { x: input.baseVertex.x, y: input.baseVertex.y, width: 0, height: 0 },
        vertices: [input.baseVertex],
        vertexCount: 1
      }
    ]
  ]),
  rigControls: new Map([
    [
      PARENT_RIG_ID,
      createWarpRigControl({
        rigControlId: PARENT_RIG_ID,
        childRigControlIds: [CHILD_RIG_ID],
        childDrawableIds: [],
        domainBounds: input.parentDomainBounds
      })
    ],
    [
      CHILD_RIG_ID,
      createWarpRigControl({
        rigControlId: CHILD_RIG_ID,
        parentId: PARENT_RIG_ID,
        childRigControlIds: [],
        childDrawableIds: [DRAWABLE_ID],
        domainBounds: input.childDomainBounds
      })
    ]
  ]),
  keyformBindings: [
    createWarpOffsetsKeyform({
      keyformSetId: KeyformSetIdSchema.parse("keyset_child_warp_translation"),
      rigControlId: CHILD_RIG_ID,
      compositionOrder: 0,
      controlPointOffsets: createConstantControlPointOffsets(input.childOffset)
    }),
    createWarpOffsetsKeyform({
      keyformSetId: KeyformSetIdSchema.parse("keyset_parent_warp_rest_binding"),
      rigControlId: PARENT_RIG_ID,
      compositionOrder: 1,
      controlPointOffsets: input.parentControlPointOffsets
    })
  ],
  masks: [],
  drawOrder: [{ drawableId: DRAWABLE_ID, drawOrder: 0 }],
  disabledFutureLayers: []
});

const createVertexCountMismatchGraph = (): NormalizedRuntimeGraph => ({
  packageId: "pkg_wave94_runtime_mismatch",
  packageRevision: 1,
  coordinateSystem: "canvas-y-down-v1",
  parameters: createParameters(),
  dynamicsGroups: new Map(),
  drawables: new Map([
    [
      DRAWABLE_ID,
      {
        drawableId: DRAWABLE_ID,
        meshId: MESH_ID,
        visible: true,
        opacity: 1,
        baseDrawOrder: 0,
        bounds: { x: 5, y: 5, width: 0, height: 0 },
        vertices: [{ x: 5, y: 5 }],
        vertexCount: 1
      }
    ]
  ]),
  rigControls: new Map([
    [
      PARENT_RIG_ID,
      createWarpRigControl({
        rigControlId: PARENT_RIG_ID,
        childRigControlIds: [],
        childDrawableIds: [DRAWABLE_ID],
        domainBounds: { x: 0, y: 0, width: 10, height: 10 }
      })
    ]
  ]),
  keyformBindings: [
    {
      evaluator: "linear-1d-v1",
      keyformSetId: KeyformSetIdSchema.parse("keyset_mesh_vertex_count_change"),
      targetId: MESH_ID,
      targetKind: "mesh",
      targetProperty: "vertices",
      parameterId: PARAMETER_ID,
      keys: [
        { value: 0, statePatch: [{ x: 5, y: 5 }] },
        {
          value: 1,
          statePatch: [
            { x: 5, y: 5 },
            { x: 6, y: 5 }
          ]
        }
      ],
      compositionMode: "replace",
      compositionOrder: 0
    },
    createWarpOffsetsKeyform({
      keyformSetId: KeyformSetIdSchema.parse("keyset_parent_warp_after_mismatch"),
      rigControlId: PARENT_RIG_ID,
      compositionOrder: 1,
      controlPointOffsets: createConstantControlPointOffsets({ x: 10, y: 0 })
    })
  ],
  masks: [],
  drawOrder: [{ drawableId: DRAWABLE_ID, drawOrder: 0 }],
  disabledFutureLayers: []
});

const createParameters = () =>
  new Map([
    [
      PARAMETER_ID,
      {
        id: PARAMETER_ID,
        displayName: "Rig Value",
        valueSource: "authoredInput" as const,
        min: 0,
        max: 1,
        default: 0
      }
    ]
  ]);

const createWarpRigControl = (input: {
  readonly rigControlId: typeof PARENT_RIG_ID;
  readonly parentId?: typeof PARENT_RIG_ID;
  readonly childRigControlIds: readonly typeof CHILD_RIG_ID[];
  readonly childDrawableIds: readonly typeof DRAWABLE_ID[];
  readonly domainBounds: RectDto;
}): NormalizedWarpLattice2dRigControl => ({
  kind: "warpLattice2d",
  rigControlId: input.rigControlId,
  ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
  childDrawableIds: input.childDrawableIds,
  childRigControlIds: input.childRigControlIds,
  bindSpace: "rigControlLocalRest",
  domainBounds: input.domainBounds,
  latticeColumns: 2,
  latticeRows: 2,
  restControlPoints: createRestControlPoints(input.domainBounds),
  interpolationMethod: "bilinear-grid-v1",
  enabled: true
});

const createWarpOffsetsKeyform = (input: {
  readonly keyformSetId: ReturnType<typeof KeyformSetIdSchema.parse>;
  readonly rigControlId: ReturnType<typeof RigControlIdSchema.parse>;
  readonly compositionOrder: number;
  readonly controlPointOffsets: readonly Vec2Dto[];
}): NormalizedRuntimeGraph["keyformBindings"][number] => ({
  evaluator: "linear-1d-v1",
  keyformSetId: input.keyformSetId,
  targetId: input.rigControlId,
  targetKind: "rigControl",
  targetProperty: "controlPointOffsets",
  parameterId: PARAMETER_ID,
  keys: [
    {
      value: 0,
      statePatch: createConstantControlPointOffsets({ x: 0, y: 0 })
    },
    {
      value: 1,
      statePatch: input.controlPointOffsets
    }
  ],
  compositionMode: "replace",
  compositionOrder: input.compositionOrder
});

const createRestControlPoints = (rect: RectDto): readonly Vec2Dto[] => [
  { x: rect.x, y: rect.y },
  { x: rect.x + rect.width, y: rect.y },
  { x: rect.x, y: rect.y + rect.height },
  { x: rect.x + rect.width, y: rect.y + rect.height }
];

const createConstantControlPointOffsets = (offset: Vec2Dto): readonly Vec2Dto[] => [
  { x: offset.x, y: offset.y },
  { x: offset.x, y: offset.y },
  { x: offset.x, y: offset.y },
  { x: offset.x, y: offset.y }
];

const expectDrawableVertices = (
  snapshot: ReturnType<typeof evaluateFullFrame>
): readonly Vec2Dto[] => {
  const drawable = snapshot.drawables.find((candidate) => candidate.drawableId === DRAWABLE_ID);
  expect(drawable).toBeDefined();
  if (drawable === undefined || drawable.vertices === undefined) {
    throw new Error("Expected full snapshot drawable vertices.");
  }

  return drawable.vertices;
};
