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
            displayName: "Hair sway",
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
      angle: 0.5,
      angularVelocity: 0,
      previousSource: 0.5,
      previousSourceVelocity: 0,
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
