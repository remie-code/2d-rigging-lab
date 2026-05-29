import {
  KeyformSetIdSchema,
  ParameterIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  KeyformSetDto,
  Linear1dKeyformSetDto,
  ParameterGrid2dKeyformSetDto
} from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import type { AuthoringGraph } from "./authoring-graph.js";
import { createRuntimeKeyformBindings } from "./runtime-graph-keyforms.js";

describe("runtime keyform binding adapter", () => {
  it("preserves keyform set identity for linear and grid bindings", () => {
    const yawParameterId = ParameterIdSchema.parse("param_face_yaw");
    const pitchParameterId = ParameterIdSchema.parse("param_face_pitch");
    const linearKeyformSet = createLinearKeyformSet("keyset_face_yaw_body", yawParameterId);
    const gridKeyformSet = createGridKeyformSet({
      keyformSetId: "keyset_face_grid_body",
      parameterX: yawParameterId,
      parameterY: pitchParameterId
    });

    const bindings = createRuntimeKeyformBindings(createGraph([linearKeyformSet, gridKeyformSet]));

    expect(bindings).toEqual([
      {
        evaluator: "linear-1d-v1",
        keyformSetId: linearKeyformSet.keyformSetId,
        targetId: "mesh_body",
        targetKind: "mesh",
        targetProperty: "vertices",
        parameterId: yawParameterId,
        keys: [
          { value: -1, statePatch: [{ x: -1, y: 0 }] },
          { value: 1, statePatch: [{ x: 1, y: 0 }] }
        ],
        compositionMode: "additiveDelta",
        compositionOrder: 0
      },
      {
        evaluator: "parameter-grid-2d-v1",
        keyformSetId: gridKeyformSet.keyformSetId,
        targetId: "mesh_body",
        targetKind: "mesh",
        targetProperty: "vertices",
        parameterX: yawParameterId,
        parameterY: pitchParameterId,
        interpolation: "bilinear-grid-v1",
        clampPolicy: "clamp-to-parameter-range",
        missingKeyPolicy: "diagnostic-error",
        keys: [
          { x: -1, y: -1, statePatch: [{ x: -1, y: -1 }] },
          { x: 1, y: 1, statePatch: [{ x: 1, y: 1 }] }
        ],
        compositionMode: "additiveDelta",
        compositionOrder: 1
      }
    ]);
  });
});

const createLinearKeyformSet = (
  keyformSetId: string,
  parameterId: Linear1dKeyformSetDto["parameterId"]
): Linear1dKeyformSetDto => ({
  keyformSetId: KeyformSetIdSchema.parse(keyformSetId),
  target: {
    kind: "mesh",
    id: "mesh_body",
    property: "vertices"
  },
  parameterId,
  evaluator: "linear-1d-v1",
  interpolation: "linear-1d-v1",
  compositionMode: "additiveDelta",
  compositionOrder: 0,
  keys: [
    { value: -1, statePatch: [{ x: -1, y: 0 }] },
    { value: 1, statePatch: [{ x: 1, y: 0 }] }
  ]
});

const createGridKeyformSet = (input: {
  readonly keyformSetId: string;
  readonly parameterX: ParameterGrid2dKeyformSetDto["parameterX"];
  readonly parameterY: ParameterGrid2dKeyformSetDto["parameterY"];
}): ParameterGrid2dKeyformSetDto => ({
  keyformSetId: KeyformSetIdSchema.parse(input.keyformSetId),
  target: {
    kind: "mesh",
    id: "mesh_body",
    property: "vertices"
  },
  parameterX: input.parameterX,
  parameterY: input.parameterY,
  evaluator: "parameter-grid-2d-v1",
  interpolation: "bilinear-grid-v1",
  clampPolicy: "clamp-to-parameter-range",
  missingKeyPolicy: "diagnostic-error",
  compositionMode: "additiveDelta",
  compositionOrder: 1,
  keys: [
    { x: -1, y: -1, statePatch: [{ x: -1, y: -1 }] },
    { x: 1, y: 1, statePatch: [{ x: 1, y: 1 }] }
  ]
});

const createGraph = (keyformSets: KeyformSetDto[]): AuthoringGraph => ({
  coordinateSystem: "canvas-y-down-v1",
  canvasSize: {
    width: 128,
    height: 128
  },
  parts: [],
  drawables: [],
  meshes: [],
  parameters: [],
  keyformSets,
  rigControls: [],
  dynamicsGroups: [],
  masks: [],
  drawOrder: [],
  rigControlRootIds: [],
  stableOrder: [],
  sourceAssets: [],
  provenanceRecords: [],
  rightsRecords: []
});
