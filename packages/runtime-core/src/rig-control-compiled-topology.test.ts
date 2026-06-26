import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  ParameterIdSchema,
  RigControlIdSchema,
  RuntimeEvaluationContextSchema
} from "@private-2d-rigging-lab/contracts";
import type { Vec2Dto } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createInitialRuntimeState } from "./initial-state.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import { compileRuntimeModel, evaluateRuntimeFrame } from "./runtime-core.js";
import { defaultRuntimeEvaluationOptions } from "./runtime-options.js";
import type { RuntimeSnapshotDto } from "./snapshot.js";

const PARAMETER_ID = ParameterIdSchema.parse("param_pose");
const DRAWABLE_ID = DrawableIdSchema.parse("draw_subject");
const MESH_ID = MeshIdSchema.parse("mesh_subject");
const PARENT_RIG_ID = RigControlIdSchema.parse("rig_parent");
const CHILD_RIG_ID = RigControlIdSchema.parse("rig_child");

const evaluationOptions = {
  ...defaultRuntimeEvaluationOptions(),
  snapshotDetail: "full" as const
};
const context = RuntimeEvaluationContextSchema.parse({
  source: { surface: "preview" },
  policy: { strictness: "interactive" }
});

describe("compiled rig control topology", () => {
  it("matches legacy nested deformer output while sampling rig keyforms per frame", () => {
    const graph = createNestedRigControlGraph();
    const initialState = createInitialRuntimeState(graph, {
      packageId: graph.packageId,
      packageRevision: graph.packageRevision,
      resetReasons: ["packageLoad"]
    });
    const instance = compileRuntimeModel(graph).createInstance({ initialState });

    const firstInput = createFrameInput(1, 0);
    const firstLegacy = evaluateRuntimeFrame(
      graph,
      firstInput,
      initialState,
      evaluationOptions,
      context,
      undefined,
      { snapshotValidation: "skip" }
    );
    const firstCompiled = instance.evaluateFrame(firstInput, {
      evaluationOptions,
      context,
      controlOptions: { snapshotValidation: "skip" }
    });
    const firstSnapshotBeforeSecond = JSON.parse(JSON.stringify(firstCompiled.snapshot));

    const secondInput = createFrameInput(2, 1);
    const secondLegacy = evaluateRuntimeFrame(
      graph,
      secondInput,
      firstLegacy.nextState,
      evaluationOptions,
      context,
      undefined,
      { snapshotValidation: "skip" }
    );
    const secondCompiled = instance.evaluateFrame(secondInput, {
      evaluationOptions,
      context,
      controlOptions: { snapshotValidation: "skip" }
    });

    expect(firstCompiled).toEqual(firstLegacy);
    expect(secondCompiled).toEqual(secondLegacy);
    expect(firstCompiled.snapshot).toEqual(firstSnapshotBeforeSecond);
    expect(expectRigControl(firstCompiled.snapshot, PARENT_RIG_ID).localTransform?.angleDegrees).toBe(0);
    expect(expectRigControl(secondCompiled.snapshot, PARENT_RIG_ID).localTransform?.angleDegrees).toBe(90);
    expect(expectDrawableVertices(secondCompiled.snapshot)).not.toEqual(expectDrawableVertices(firstCompiled.snapshot));

    const mutatedPreviousVertices = expectDrawableVertices(firstCompiled.snapshot);
    mutatedPreviousVertices[0] = { x: 999, y: 999 };

    const thirdCompiled = instance.evaluateFrame(createFrameInput(3, 1), {
      evaluationOptions,
      context,
      controlOptions: { snapshotValidation: "skip" }
    });

    expect(expectDrawableVertices(thirdCompiled.snapshot)[0]).not.toEqual({ x: 999, y: 999 });
  });

  it("keeps frame-blocked direct parent selection compatible with legacy evaluation", () => {
    const graph = createFrameBlockedDirectParentGraph();
    const initialState = createInitialRuntimeState(graph, {
      packageId: graph.packageId,
      packageRevision: graph.packageRevision,
      resetReasons: ["packageLoad"]
    });
    const input = createFrameInput(1, 1);
    const legacy = evaluateRuntimeFrame(
      graph,
      input,
      initialState,
      evaluationOptions,
      context,
      undefined,
      { snapshotValidation: "skip" }
    );
    const compiled = compileRuntimeModel(graph)
      .createInstance({ initialState })
      .evaluateFrame(input, {
        evaluationOptions,
        context,
        controlOptions: { snapshotValidation: "skip" }
      });

    expect(compiled).toEqual(legacy);
    expect(compiled.snapshot.diagnostics
      .map((diagnostic) => diagnostic.checkId)
      .filter((checkId) => checkId.startsWith("rigControl."))).toEqual([
        "rigControl.invalidPatchShape"
      ]);
    expect(expectRigControl(compiled.snapshot, "rig_a_warp").evaluationStatus).toBe("blocked");
    expect(expectRigControl(compiled.snapshot, "rig_b_rotation").evaluationStatus).toBe("evaluated");
    expect(expectDrawableVertices(compiled.snapshot)).toEqual([
      { x: 0, y: 10 },
      { x: 0, y: 12 },
      { x: -2, y: 12 },
      { x: -2, y: 10 }
    ]);
  });
});

const createFrameInput = (
  frameIndex: number,
  parameterValue: number
) => ({
  schemaVersion: "runtime-evaluation-input-v1" as const,
  frameIndex,
  deltaTimeMs: 0,
  resetReasons: [],
  authoredParameterValues: { [PARAMETER_ID]: parameterValue },
  targetIds: [PARENT_RIG_ID, CHILD_RIG_ID, DRAWABLE_ID]
});

const createNestedRigControlGraph = (): NormalizedRuntimeGraph => ({
  packageId: "pkg_compiled_rig_topology",
  packageRevision: 1,
  coordinateSystem: "canvas-y-down-v1",
  parameters: createParameters(),
  dynamicsGroups: new Map(),
  drawables: createSubjectDrawables(),
  rigControls: new Map([
    [
      PARENT_RIG_ID,
      {
        kind: "rotation2d",
        rigControlId: PARENT_RIG_ID,
        childDrawableIds: [],
        childRigControlIds: [CHILD_RIG_ID],
        pivot: { x: 0, y: 0 },
        restAngleDegrees: 0,
        restTranslation: { x: 0, y: 0 },
        restScale: { x: 1, y: 1 },
        enabled: true
      }
    ],
    [
      CHILD_RIG_ID,
      {
        kind: "warpLattice2d",
        rigControlId: CHILD_RIG_ID,
        parentId: PARENT_RIG_ID,
        childDrawableIds: [DRAWABLE_ID],
        childRigControlIds: [],
        bindSpace: "rigControlLocalRest",
        domainBounds: { x: 10, y: 0, width: 2, height: 2 },
        latticeColumns: 2,
        latticeRows: 2,
        restControlPoints: createRestControlPoints({ x: 10, y: 0, width: 2, height: 2 }),
        interpolationMethod: "bilinear-grid-v1",
        enabled: true
      }
    ]
  ]),
  keyformBindings: [
    {
      evaluator: "linear-1d-v1",
      keyformSetId: KeyformSetIdSchema.parse("keyset_parent_rotation"),
      targetId: PARENT_RIG_ID,
      targetKind: "rigControl",
      targetProperty: "angleDegrees",
      parameterId: PARAMETER_ID,
      keys: [
        { value: 0, statePatch: 0 },
        { value: 1, statePatch: 90 }
      ],
      compositionMode: "replace",
      compositionOrder: 0
    },
    {
      evaluator: "linear-1d-v1",
      keyformSetId: KeyformSetIdSchema.parse("keyset_child_warp_offsets"),
      targetId: CHILD_RIG_ID,
      targetKind: "rigControl",
      targetProperty: "controlPointOffsets",
      parameterId: PARAMETER_ID,
      keys: [
        { value: 0, statePatch: createConstantControlPointOffsets({ x: 0, y: 0 }) },
        { value: 1, statePatch: createConstantControlPointOffsets({ x: 1, y: 0 }) }
      ],
      compositionMode: "replace",
      compositionOrder: 1
    }
  ],
  masks: [],
  drawOrder: [{ drawableId: DRAWABLE_ID, drawOrder: 0 }],
  disabledFutureLayers: []
});

const createFrameBlockedDirectParentGraph = (): NormalizedRuntimeGraph => {
  const firstRigId = RigControlIdSchema.parse("rig_a_warp");
  const secondRigId = RigControlIdSchema.parse("rig_b_rotation");

  return {
    packageId: "pkg_compiled_rig_topology_blocked_parent",
    packageRevision: 1,
    coordinateSystem: "canvas-y-down-v1",
    parameters: createParameters(),
    dynamicsGroups: new Map(),
    drawables: createSubjectDrawables(),
    rigControls: new Map([
      [
        firstRigId,
        {
          kind: "warpLattice2d",
          rigControlId: firstRigId,
          childDrawableIds: [DRAWABLE_ID],
          childRigControlIds: [],
          bindSpace: "rigControlLocalRest",
          domainBounds: { x: 10, y: 0, width: 2, height: 2 },
          latticeColumns: 2,
          latticeRows: 2,
          restControlPoints: createRestControlPoints({ x: 10, y: 0, width: 2, height: 2 }),
          interpolationMethod: "bilinear-grid-v1",
          enabled: true
        }
      ],
      [
        secondRigId,
        {
          kind: "rotation2d",
          rigControlId: secondRigId,
          childDrawableIds: [DRAWABLE_ID],
          childRigControlIds: [],
          pivot: { x: 0, y: 0 },
          restAngleDegrees: 90,
          restTranslation: { x: 0, y: 0 },
          restScale: { x: 1, y: 1 },
          enabled: true
        }
      ]
    ]),
    keyformBindings: [
      {
        evaluator: "linear-1d-v1",
        keyformSetId: KeyformSetIdSchema.parse("keyset_invalid_first_parent_offsets"),
        targetId: firstRigId,
        targetKind: "rigControl",
        targetProperty: "controlPointOffsets",
        parameterId: PARAMETER_ID,
        keys: [
          { value: 0, statePatch: createConstantControlPointOffsets({ x: 0, y: 0 }) },
          {
            value: 1,
            statePatch: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 0, y: 1 }
            ]
          }
        ],
        compositionMode: "replace",
        compositionOrder: 0
      }
    ],
    masks: [],
    drawOrder: [{ drawableId: DRAWABLE_ID, drawOrder: 0 }],
    disabledFutureLayers: []
  };
};

const createParameters = () =>
  new Map([
    [
      PARAMETER_ID,
      {
        id: PARAMETER_ID,
        displayName: "Pose",
        valueSource: "authoredInput" as const,
        min: 0,
        max: 1,
        default: 0
      }
    ]
  ]);

const createSubjectDrawables = () =>
  new Map([
    [
      DRAWABLE_ID,
      {
        drawableId: DRAWABLE_ID,
        meshId: MESH_ID,
        visible: true,
        opacity: 1,
        baseDrawOrder: 0,
        bounds: { x: 10, y: 0, width: 2, height: 2 },
        vertices: [
          { x: 10, y: 0 },
          { x: 12, y: 0 },
          { x: 12, y: 2 },
          { x: 10, y: 2 }
        ],
        vertexCount: 4
      }
    ]
  ]);

const createRestControlPoints = (rect: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}): readonly Vec2Dto[] => [
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

const expectRigControl = (
  snapshot: RuntimeSnapshotDto,
  rigControlId: string
) => {
  const rigControl = snapshot.rigControls.find((candidate) => candidate.rigControlId === rigControlId);
  expect(rigControl).toBeDefined();
  if (rigControl === undefined) {
    throw new Error(`Expected rig control ${rigControlId}.`);
  }

  return rigControl;
};

const expectDrawableVertices = (snapshot: RuntimeSnapshotDto): Vec2Dto[] => {
  const drawable = snapshot.drawables.find((candidate) => candidate.drawableId === DRAWABLE_ID);
  expect(drawable?.vertices).toBeDefined();
  if (drawable?.vertices === undefined) {
    throw new Error("Expected full snapshot drawable vertices.");
  }

  return drawable.vertices;
};
