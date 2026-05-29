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
  it("resolves authored defaults, clamps authored input, and overlays computed dynamics values", () => {
    const fixture = createParameterResolutionFixture();
    const state = createRuntimeState(fixture.graph, {
      [fixture.dynamicsGroupId]: {
        position: 0.25,
        velocity: 0,
        tick: 1,
        resetCounter: 1
      }
    });

    const resolution = resolveEffectiveParameterValues({
      graph: fixture.graph,
      authoredParameterValues: {
        [fixture.yawParameterId]: 2,
        [fixture.hairSwayParameterId]: 0.9
      },
      state
    });

    expect(resolution.values).toEqual([
      {
        parameterId: fixture.yawParameterId,
        valueSource: "authoredInput",
        authoredValue: 2,
        effectiveValue: 1,
        clamped: true,
        source: "viewerOverride"
      },
      {
        parameterId: fixture.hairSwayParameterId,
        valueSource: "computedDynamics",
        authoredValue: 0.9,
        computedValue: 0.25,
        effectiveValue: 0.25,
        clamped: false,
        source: "dynamicsComputed"
      }
    ]);
    expect(resolution.effectiveParameterValues.get(fixture.yawParameterId)).toBe(1);
    expect(resolution.effectiveParameterValues.get(fixture.hairSwayParameterId)).toBe(0.25);
  });

  it("keeps snapshot parameter output and empty keyform samples unchanged without keyforms", () => {
    const fixture = createParameterResolutionFixture();
    const state = createRuntimeState(fixture.graph, {
      [fixture.dynamicsGroupId]: {
        position: -0.5,
        velocity: 0,
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
          valueSource: "computedDynamics",
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
          solverKind: "scalarDampedFollowV1",
          drivers: [
            {
              driverId: "driver_yaw",
              sourceParameterId: yawParameterId,
              inputScale: 1,
              inputOffset: 0,
              invert: false
            }
          ],
          output: {
            outputId: "output_hair",
            targetParameterId: hairSwayParameterId,
            outputScale: 1,
            outputOffset: 0,
            min: -1,
            max: 1,
            clampPolicy: "clamp-to-output-range"
          },
          settings: {
            stiffness: 4,
            damping: 1
          },
          resetPolicy: "reset-on-load"
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
