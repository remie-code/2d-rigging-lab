import {
  DynamicsGroupIdSchema,
  PackageIdSchema,
  ParameterIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createInitialRuntimeState } from "./initial-state.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";

describe("createInitialRuntimeState", () => {
  it("creates an empty runtime state for a graph without active dynamics groups", () => {
    const packageId = PackageIdSchema.parse("pkg_empty");
    const graph = createGraph({ packageId });

    const state = createInitialRuntimeState(graph, {
      packageId,
      packageRevision: 0,
      resetReasons: ["packageLoad"]
    });

    expect(state).toEqual({
      schemaVersion: "runtime-state-v1",
      packageId,
      packageRevision: 0,
      frameIndex: 0,
      fixedStepMs: 16.6666667,
      accumulatorMs: 0,
      dynamicsGroups: {}
    });
  });

  it("creates identity state entries for active dynamics groups", () => {
    const packageId = PackageIdSchema.parse("pkg_dynamics");
    const driverParameterId = ParameterIdSchema.parse("param_yaw");
    const outputParameterId = ParameterIdSchema.parse("param_hairSway");
    const dynamicsGroupId = DynamicsGroupIdSchema.parse("dyn_hair");
    const graph = createGraph({
      packageId,
      parameters: new Map([
        [
          driverParameterId,
          {
            id: driverParameterId,
            displayName: "Yaw",
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
            displayName: "Hair sway",
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
            displayName: "Hair sway",
            enabled: true,
            solverKind: "scalarDampedFollowV1",
            drivers: [
              {
                driverId: "driver-yaw",
                sourceParameterId: driverParameterId,
                inputScale: 1,
                inputOffset: 0,
                invert: false
              }
            ],
            output: {
              outputId: "output-hair",
              targetParameterId: outputParameterId,
              outputScale: 1,
              outputOffset: 0,
              min: -1,
              max: 1,
              clampPolicy: "clamp-to-output-range"
            },
            settings: {
              stiffness: 0.5,
              damping: 0.2
            },
            resetPolicy: "reset-on-load"
          }
        ]
      ])
    });

    const state = createInitialRuntimeState(graph, {
      packageId,
      packageRevision: 0,
      authoredParameterValues: {
        [driverParameterId]: 0.5
      },
      resetReasons: ["packageLoad"]
    });

    expect(Object.keys(state.dynamicsGroups)).toEqual([dynamicsGroupId]);
    expect(state.dynamicsGroups[dynamicsGroupId]).toEqual({
      position: 0.5,
      velocity: 0,
      tick: 0,
      resetCounter: 1
    });
  });
});

const createGraph = (
  overrides: Pick<NormalizedRuntimeGraph, "packageId"> & Partial<NormalizedRuntimeGraph>
): NormalizedRuntimeGraph => ({
  packageId: overrides.packageId,
  packageRevision: overrides.packageRevision ?? 0,
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
