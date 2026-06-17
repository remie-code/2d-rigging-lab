import {
  DynamicsGroupIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  RuntimeDiffDtoSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { buildRuntimeEvidence } from "./runtime-evidence.js";
import { createInitialRuntimeState } from "./initial-state.js";
import type { NormalizedDynamicsGroup, NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import { defaultRuntimeEvaluationOptions } from "./runtime-options.js";
import { evaluateRuntimeFrame, evaluateRuntimeSequence } from "./runtime-core.js";

describe("runtime dynamics evaluation", () => {
  it("evaluates additive pendulum sequences deterministically", () => {
    const fixture = createDynamicsFixture();
    const initialState = createInitialRuntimeState(fixture.graph, {
      packageId: fixture.packageId,
      packageRevision: 0,
      authoredParameterValues: {
        [fixture.driverParameterId]: 0
      },
      resetReasons: ["packageLoad"]
    });
    const frames = [1, 2, 3, 4].map((frameIndex) => ({
      frameIndex,
      deltaTimeMs: 16.6666667,
      authoredParameterValues: {
        [fixture.driverParameterId]: 1
      },
      targetIds: [fixture.outputParameterId]
    }));

    const firstRun = evaluateRuntimeSequence(
      fixture.graph,
      frames,
      initialState,
      defaultRuntimeEvaluationOptions(),
      { source: { surface: "preview" } }
    );
    const secondRun = evaluateRuntimeSequence(
      fixture.graph,
      frames,
      initialState,
      defaultRuntimeEvaluationOptions(),
      { source: { surface: "preview" } }
    );

    expect(secondRun).toEqual(firstRun);
    expect(firstRun.finalState.dynamicsGroups[fixture.dynamicsGroupId]).toMatchObject({
      tick: 4,
      resetCounter: 1
    });
    expect(Number.isFinite(firstRun.finalState.dynamicsGroups[fixture.dynamicsGroupId]?.angle)).toBe(true);
  });

  it("projects additive dynamics state and output offset into runtime snapshots", () => {
    const fixture = createDynamicsFixture();
    const initialState = createInitialRuntimeState(fixture.graph, {
      packageId: fixture.packageId,
      packageRevision: 0,
      authoredParameterValues: {
        [fixture.driverParameterId]: 0
      },
      resetReasons: ["packageLoad"]
    });
    const result = evaluateRuntimeFrame(
      fixture.graph,
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 1,
        deltaTimeMs: 16.6666667,
        authoredParameterValues: {
          [fixture.driverParameterId]: 1
        },
        targetIds: [fixture.outputParameterId]
      },
      initialState,
      {
        ...defaultRuntimeEvaluationOptions(),
        snapshotDetail: "targeted"
      },
      { source: { surface: "preview" } }
    );
    const dynamics = result.snapshot.dynamics[0];
    const computedParameter = result.snapshot.parameters.find(
      (parameter) => parameter.parameterId === fixture.outputParameterId
    );

    expect(dynamics).toMatchObject({
      dynamicsGroupId: fixture.dynamicsGroupId,
      solverKind: "additivePendulumV0",
      inputValues: {
        [fixture.driverParameterId]: 1
      },
      outputParameterId: fixture.outputParameterId,
      outputOffset: result.nextState.dynamicsGroups[fixture.dynamicsGroupId]?.angle,
      effectiveOutputValue: result.nextState.dynamicsGroups[fixture.dynamicsGroupId]?.angle,
      fixedStepMs: 16.6666667,
      debug: {
        rawTarget: 1,
        source: 1,
        outputClamped: false,
        resetApplied: false,
        resetReasons: []
      }
    });
    expect(computedParameter).toMatchObject({
      parameterId: fixture.outputParameterId,
      valueSource: "authoredInput",
      baseValue: 0,
      dynamicsOffset: result.nextState.dynamicsGroups[fixture.dynamicsGroupId]?.angle,
      effectiveValue: result.nextState.dynamicsGroups[fixture.dynamicsGroupId]?.angle,
      source: "dynamicsAdditive"
    });
  });

  it("exposes added dynamics groups and additive output through runtime diff evidence", () => {
    const fixture = createDynamicsFixture();
    const baselineGraph = {
      ...fixture.graph,
      dynamicsGroups: new Map()
    } satisfies NormalizedRuntimeGraph;
    const evidence = buildRuntimeEvidence({
      baselineGraph,
      candidateGraph: fixture.graph,
      baseline: {
        frame: {
          deltaTimeMs: 16.6666667,
          authoredParameterValues: {
            [fixture.driverParameterId]: 1
          },
          targetIds: [fixture.outputParameterId]
        }
      },
      candidate: {
        frame: {
          deltaTimeMs: 16.6666667,
          authoredParameterValues: {
            [fixture.driverParameterId]: 1
          },
          targetIds: [fixture.outputParameterId]
        }
      },
      artifactLabel: "dynamics-preview"
    });
    const runtimeDiff = RuntimeDiffDtoSchema.parse(evidence.runtimeDiff);

    expect(runtimeDiff.parameterChanges).toEqual([
      {
        path: `/parameters/${fixture.outputParameterId}/effectiveValue`,
        before: 0,
        after: 1
      }
    ]);
    expect(runtimeDiff.dynamicsChanges).toEqual([
      {
        dynamicsGroupId: fixture.dynamicsGroupId,
        outputParameterId: fixture.outputParameterId,
        stateChanged: true,
        outputChanged: true,
        angleAfter: 1,
        angularVelocityAfter: 0,
        outputOffsetAfter: 1,
        effectiveOutputValueAfter: 1,
        tickAfter: 1,
        resetCounterAfter: 1
      }
    ]);
    expect(evidence.candidateSnapshot.dynamics[0]).toMatchObject({
      dynamicsGroupId: fixture.dynamicsGroupId,
      outputOffset: 1,
      effectiveOutputValue: 1
    });
    expect(evidence.finalRuntimeState.dynamicsGroups[fixture.dynamicsGroupId]).toMatchObject({
      angle: 1,
      angularVelocity: 0,
      tick: 1,
      resetCounter: 1
    });
  });
});

const createDynamicsFixture = () => {
  const packageId = PackageIdSchema.parse("pkg_runtime_dynamics");
  const driverParameterId = ParameterIdSchema.parse("param_face_yaw");
  const outputParameterId = ParameterIdSchema.parse("param_hair_sway");
  const dynamicsGroupId = DynamicsGroupIdSchema.parse("dyn_hair_sway");
  const dynamicsGroup: NormalizedDynamicsGroup = {
    dynamicsGroupId,
    displayName: "Hair Sway",
    enabled: true,
    inputs: [
      {
        parameterId: driverParameterId,
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
        parameterId: outputParameterId,
        kind: "angle",
        strength: 1,
        invert: false,
        limit: 1
      }
    ]
  };
  const graph: NormalizedRuntimeGraph = {
    packageId,
    packageRevision: 0,
    coordinateSystem: "canvas-y-down-v1",
    parameters: new Map([
      [
        driverParameterId,
        {
          id: driverParameterId,
          displayName: "Face Yaw",
          semanticRole: "face",
          valueSource: "authoredInput",
          min: -1,
          max: 1,
          default: 0
        }
      ],
      [
        outputParameterId,
        {
          id: outputParameterId,
          displayName: "Hair Sway",
          semanticRole: "dynamics",
          valueSource: "authoredInput",
          min: -1,
          max: 1,
          default: 0
        }
      ]
    ]),
    dynamicsGroups: new Map([[dynamicsGroupId, dynamicsGroup]]),
    drawables: new Map(),
    rigControls: new Map(),
    keyformBindings: [],
    masks: [],
    drawOrder: [],
    disabledFutureLayers: []
  };

  return {
    packageId,
    graph,
    driverParameterId,
    outputParameterId,
    dynamicsGroupId
  };
};
