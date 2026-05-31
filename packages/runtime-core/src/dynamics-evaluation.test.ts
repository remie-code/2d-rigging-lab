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
  it("evaluates scalar damped follow sequences deterministically", () => {
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
    expect(firstRun.finalState.dynamicsGroups[fixture.dynamicsGroupId]?.position).toBeCloseTo(0.971817, 5);
  });

  it("projects dynamics state and computed output into runtime snapshots", () => {
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
      solverKind: "scalarDampedFollowV1",
      driverValues: {
        [fixture.driverParameterId]: 1
      },
      outputParameterId: fixture.outputParameterId,
      outputValue: result.nextState.dynamicsGroups[fixture.dynamicsGroupId]?.position,
      fixedStepMs: 16.6666667,
      debug: {
        rawTarget: 1,
        clampedTarget: 1,
        outputClamped: false,
        resetApplied: false,
        resetReasons: []
      }
    });
    expect(computedParameter).toMatchObject({
      parameterId: fixture.outputParameterId,
      valueSource: "computedDynamics",
      computedValue: result.nextState.dynamicsGroups[fixture.dynamicsGroupId]?.position,
      effectiveValue: result.nextState.dynamicsGroups[fixture.dynamicsGroupId]?.position,
      source: "dynamicsComputed"
    });
  });

  it("exposes added dynamics groups and computed output through runtime diff evidence", () => {
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
        positionAfter: 1,
        velocityAfter: 0,
        tickAfter: 1,
        resetCounterAfter: 1
      }
    ]);
    expect(evidence.candidateSnapshot.dynamics[0]).toMatchObject({
      dynamicsGroupId: fixture.dynamicsGroupId,
      outputValue: 1
    });
    expect(evidence.finalRuntimeState.dynamicsGroups[fixture.dynamicsGroupId]).toMatchObject({
      position: 1,
      velocity: 0,
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
    solverKind: "scalarDampedFollowV1",
    drivers: [
      {
        driverId: "driver_face_yaw",
        sourceParameterId: driverParameterId,
        inputScale: 1,
        inputOffset: 0,
        invert: false
      }
    ],
    output: {
      outputId: "output_hair_sway",
      targetParameterId: outputParameterId,
      outputScale: 1,
      outputOffset: 0,
      min: -1,
      max: 1,
      clampPolicy: "clamp-to-output-range"
    },
    settings: {
      stiffness: 0.35,
      damping: 0.7
    },
    resetPolicy: "reset-on-load"
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
          valueSource: "computedDynamics",
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
