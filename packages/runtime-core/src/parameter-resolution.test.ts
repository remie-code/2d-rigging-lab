import {
  DynamicsGroupIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  RuntimeEvaluationContextSchema
} from "@private-2d-rigging-lab/contracts";
import type { RuntimeStateDto } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import { resolveEffectiveParameterValues } from "./parameter-resolution.js";
import { defaultRuntimeEvaluationOptions } from "./runtime-options.js";
import { createRuntimeSnapshot } from "./snapshot.js";

describe("effective parameter resolution", () => {
  it("resolves authored defaults, clamps authored input, and adds dynamics offsets", () => {
    const fixture = createParameterResolutionFixture();
    const state = createRuntimeState(fixture.graph, {
      [fixture.dynamicsGroupId]: {
        angle: 0.25,
        angularVelocity: 0,
        previousSource: 0.25,
        previousSourceVelocity: 0,
        tick: 1,
        resetCounter: 1
      }
    });

    const resolution = resolveEffectiveParameterValues({
      graph: fixture.graph,
      authoredParameterValues: {
        [fixture.yawParameterId]: 2,
        [fixture.hairSwayParameterId]: 0.4
      },
      state
    });

    expect(resolution.values).toEqual([
      {
        parameterId: fixture.yawParameterId,
        valueSource: "authoredInput",
        authoredValue: 2,
        baseValue: 1,
        effectiveValue: 1,
        clamped: true,
        source: "viewerOverride"
      },
      {
        parameterId: fixture.hairSwayParameterId,
        valueSource: "authoredInput",
        authoredValue: 0.4,
        baseValue: 0.4,
        dynamicsOffset: 0.25,
        effectiveValue: 0.65,
        clamped: false,
        source: "dynamicsAdditive"
      }
    ]);
    expect(resolution.effectiveParameterValues.get(fixture.yawParameterId)).toBe(1);
    expect(resolution.effectiveParameterValues.get(fixture.hairSwayParameterId)).toBe(0.65);
  });

  it("keeps snapshot parameter output and empty keyform samples unchanged without keyforms", () => {
    const fixture = createParameterResolutionFixture();
    const state = createRuntimeState(fixture.graph, {
      [fixture.dynamicsGroupId]: {
        angle: -0.5,
        angularVelocity: 0,
        previousSource: -0.5,
        previousSourceVelocity: 0,
        tick: 1,
        resetCounter: 1
      }
    });
    const authoredParameterValues = {
      [fixture.yawParameterId]: -2
    };

    const snapshot = createRuntimeSnapshot({
      graph: fixture.graph,
      evaluationInput: {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 0,
        deltaTimeMs: 0,
        resetReasons: [],
        authoredParameterValues,
        targetIds: []
      },
      state,
      options: defaultRuntimeEvaluationOptions(),
      context: RuntimeEvaluationContextSchema.parse({ source: { surface: "preview" } }),
      diagnostics: []
    });
    const resolution = resolveEffectiveParameterValues({
      graph: fixture.graph,
      authoredParameterValues,
      state
    });

    expect(snapshot.parameters).toEqual(resolution.values);
    expect(snapshot.keyformSamples).toEqual([]);
    expect(snapshot.drawables).toEqual([]);
    expect(snapshot.drawList).toEqual([]);
  });
});

const createParameterResolutionFixture = () => {
  const packageId = PackageIdSchema.parse("pkg_parameter_resolution");
  const yawParameterId = ParameterIdSchema.parse("param_face_yaw");
  const hairSwayParameterId = ParameterIdSchema.parse("param_hair_sway");
  const dynamicsGroupId = DynamicsGroupIdSchema.parse("dyn_hair_sway");
  const graph: NormalizedRuntimeGraph = {
    packageId,
    packageRevision: 0,
    coordinateSystem: "canvas-y-down-v1",
    parameters: new Map([
      [
        yawParameterId,
        {
          id: yawParameterId,
          displayName: "Face Yaw",
          valueSource: "authoredInput",
          min: -1,
          max: 1,
          default: 0
        }
      ],
      [
        hairSwayParameterId,
        {
          id: hairSwayParameterId,
          displayName: "Hair Sway",
          valueSource: "authoredInput",
          min: -1,
          max: 1,
          default: 0
        }
      ]
    ]),
    dynamicsGroups: new Map([
      [
        dynamicsGroupId,
        {
          dynamicsGroupId,
          displayName: "Hair Sway",
          enabled: true,
          inputs: [
            {
              parameterId: yawParameterId,
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
              sway: 0.35,
              reactionSpeed: 8,
              convergenceSpeed: 4
            }
          ],
          outputs: [
            {
              parameterId: hairSwayParameterId,
              kind: "angle",
              strength: 1,
              invert: false,
              limit: 1
            }
          ]
        }
      ]
    ]),
    drawables: new Map(),
    rigControls: new Map(),
    keyformBindings: [],
    masks: [],
    drawOrder: [],
    disabledFutureLayers: []
  };

  return {
    graph,
    yawParameterId,
    hairSwayParameterId,
    dynamicsGroupId
  };
};

const createRuntimeState = (
  graph: NormalizedRuntimeGraph,
  dynamicsGroups: RuntimeStateDto["dynamicsGroups"]
): RuntimeStateDto => ({
  schemaVersion: "runtime-state-v1",
  packageId: PackageIdSchema.parse(graph.packageId),
  packageRevision: graph.packageRevision,
  frameIndex: 0,
  fixedStepMs: 16.6666667,
  accumulatorMs: 0,
  dynamicsGroups
});
