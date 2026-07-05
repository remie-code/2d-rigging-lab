import {
  DynamicsGroupIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  RuntimeEvaluationContextSchema
} from "@private-2d-rigging-lab/contracts";
import type { RuntimeStateDto } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { computeDynamicsOutputOffsetsFromGraph } from "./dynamics-evaluation.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import { resolveEffectiveParameterValues } from "./parameter-resolution.js";
import { defaultRuntimeEvaluationOptions } from "./runtime-options.js";
import { createRuntimeSnapshot } from "./snapshot.js";

// A single-segment chain bent so its world angle is known; the dynamics offset is then θ_local·scale.
// θ_world = atan2(x, y). Placing the particle at (sin θ, cos θ) (L = 1) gives θ_world = θ [deg].
const bentParticleState = (thetaWorldDeg: number) => {
  const thetaRad = (thetaWorldDeg * Math.PI) / 180;
  const x = Math.sin(thetaRad);
  const y = Math.cos(thetaRad);
  return { particles: [{ x, y, px: x, py: y }], tick: 1, resetCounter: 1 };
};

describe("effective parameter resolution", () => {
  it("resolves authored defaults, clamps authored input, and adds dynamics offsets", () => {
    const fixture = createParameterResolutionFixture();
    // Yaw authored 2 → φ_deg = (2 − 0)·1 = 2°. A particle bent to θ_world = 12° gives
    // θ_local = 12 − 2 = 10°, and with output scale 0.025 the offset is 0.25.
    const state = createRuntimeState(fixture.graph, {
      [fixture.dynamicsGroupId]: bentParticleState(12)
    });
    const authoredParameterValues = {
      [fixture.yawParameterId]: 2,
      [fixture.hairSwayParameterId]: 0.4
    };

    const expectedOffset = computeDynamicsOutputOffsetsFromGraph(
      fixture.graph,
      fixture.graph.dynamicsGroups.get(fixture.dynamicsGroupId)!,
      state.dynamicsGroups[fixture.dynamicsGroupId]!,
      authoredParameterValues
    )[0]!.offset;
    expect(expectedOffset).toBeCloseTo(0.25, 6);

    const resolution = resolveEffectiveParameterValues({
      graph: fixture.graph,
      authoredParameterValues,
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
        dynamicsOffset: expectedOffset,
        effectiveValue: 0.4 + expectedOffset,
        clamped: false,
        source: "dynamicsAdditive"
      }
    ]);
    expect(resolution.effectiveParameterValues.get(fixture.yawParameterId)).toBe(1);
    expect(resolution.effectiveParameterValues.get(fixture.hairSwayParameterId)).toBeCloseTo(0.65, 6);
  });

  it("keeps snapshot parameter output and empty keyform samples unchanged without keyforms", () => {
    const fixture = createParameterResolutionFixture();
    const state = createRuntimeState(fixture.graph, {
      [fixture.dynamicsGroupId]: bentParticleState(-12)
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
              scale: 1
            }
          ],
          chain: {
            rootOffset: { x: 0, y: 0 },
            segmentLengths: [1],
            damping: 2.5,
            gravityScale: 1
          },
          outputs: [
            {
              parameterId: hairSwayParameterId,
              segmentIndex: 1,
              scale: 0.025,
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
