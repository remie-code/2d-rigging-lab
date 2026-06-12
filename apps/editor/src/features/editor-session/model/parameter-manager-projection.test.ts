import {
  DynamicsGroupIdSchema,
  KeyformSetIdSchema,
  ParameterIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createEmptyAuthoringSession } from "./empty-authoring-session";
import { createParameterBarProjection } from "./parameter-keyform-state";
import { createParameterManagerProjection } from "./parameter-manager-projection";

describe("parameter manager projection", () => {
  it("shows initialized preset parameters from an empty project without unused preset warnings", () => {
    const projection = createParameterManagerProjection(createEmptyAuthoringSession());

    expect(projection.rows.map((row) => row.parameterId)).toContain(
      ParameterIdSchema.parse("param_face_angle_x")
    );
    expect(projection.rows.find((row) => row.parameterId === "param_face_angle_x")).toMatchObject({
      displayName: "Face Angle X",
      kind: "preset",
      groupLabel: "Face"
    });
    expect(projection.checks).toEqual([]);
  });

  it("filters by group and search text", () => {
    const projection = createParameterManagerProjection(createEmptyAuthoringSession(), {
      groupFilter: "face",
      search: "Angle X"
    });

    expect(projection.filteredRows.map((row) => row.parameterId)).toEqual([
      ParameterIdSchema.parse("param_face_angle_x")
    ]);
  });

  it("counts keyform usage and warns only for unused custom parameters", () => {
    const session = createEmptyAuthoringSession();
    const customParameterId = ParameterIdSchema.parse("param_custom_smile");
    const usedCustomParameterId = ParameterIdSchema.parse("param_used_custom");
    session.graph.parameters.push(
      {
        parameterId: customParameterId,
        displayName: "Custom Smile",
        valueSource: "authoredInput",
        min: 0,
        default: 0,
        max: 1,
        recommendedUiStep: 0.01
      },
      {
        parameterId: usedCustomParameterId,
        displayName: "Used Custom",
        valueSource: "authoredInput",
        min: 0,
        default: 0,
        max: 1,
        recommendedUiStep: 0.01
      }
    );
    session.graph.keyformSets.push({
      keyformSetId: KeyformSetIdSchema.parse("keyset_used_custom"),
      target: {
        kind: "drawable",
        id: "draw_missing",
        property: "opacity"
      },
      parameterId: usedCustomParameterId,
      evaluator: "linear-1d-v1",
      interpolation: "linear-1d-v1",
      compositionMode: "replace",
      compositionOrder: 0,
      keys: [
        {
          value: 0,
          statePatch: 1
        }
      ]
    });

    const projection = createParameterManagerProjection(session);
    const usedCustom = projection.rows.find((row) => row.parameterId === usedCustomParameterId);

    expect(usedCustom?.usageCount).toBe(1);
    expect(projection.checks).toContainEqual(
      expect.objectContaining({
        checkId: "parameterManager.unusedCustom",
        parameterId: customParameterId,
        severity: "warning"
      })
    );
    expect(projection.checks).not.toContainEqual(
      expect.objectContaining({
        parameterId: ParameterIdSchema.parse("param_face_angle_x")
      })
    );
  });

  it("counts dynamics-only usage without treating preset or used custom parameters as unused", () => {
    const session = createEmptyAuthoringSession();
    const dynamicsDriverParameterId = ParameterIdSchema.parse("param_custom_driver");
    const dynamicsOutputParameterId = ParameterIdSchema.parse("param_custom_output");
    session.graph.parameters.push(
      {
        parameterId: dynamicsDriverParameterId,
        displayName: "Custom Driver",
        valueSource: "authoredInput",
        min: 0,
        default: 0,
        max: 1,
        recommendedUiStep: 0.01
      },
      {
        parameterId: dynamicsOutputParameterId,
        displayName: "Custom Output",
        valueSource: "authoredInput",
        min: 0,
        default: 0,
        max: 1,
        recommendedUiStep: 0.01
      }
    );
    session.graph.dynamicsGroups.push({
      dynamicsGroupId: DynamicsGroupIdSchema.parse("dyn_smile_follow"),
      displayName: "Smile Follow",
      enabled: true,
      solverKind: "scalarDampedFollowV1",
      drivers: [
        {
          driverId: "driver_smile",
          sourceParameterId: dynamicsDriverParameterId,
          inputScale: 1,
          inputOffset: 0,
          invert: false
        }
      ],
      output: {
        outputId: "output_smile",
        targetParameterId: dynamicsOutputParameterId,
        outputScale: 1,
        outputOffset: 0,
        min: 0,
        max: 1,
        clampPolicy: "clamp-to-output-range"
      },
      settings: {
        stiffness: 0.5,
        damping: 0.25
      },
      resetPolicy: "reset-on-load"
    });

    const projection = createParameterManagerProjection(session);
    const driverRow = projection.rows.find(
      (row) => row.parameterId === dynamicsDriverParameterId
    );
    const outputRow = projection.rows.find(
      (row) => row.parameterId === dynamicsOutputParameterId
    );

    expect(driverRow).toMatchObject({
      usageCount: 1,
      usageSummary: "Used by 1 target"
    });
    expect(driverRow?.usageItems[0]).toMatchObject({
      targetLabel: "Dynamics: Smile Follow",
      propertyLabel: "driver input parameter",
      detailLabel: "Driver driver_smile"
    });
    expect(outputRow).toMatchObject({
      usageCount: 1,
      usageSummary: "Used by 1 target"
    });
    expect(outputRow?.usageItems[0]).toMatchObject({
      targetLabel: "Dynamics: Smile Follow",
      propertyLabel: "output target parameter",
      detailLabel: "Output output_smile"
    });
    expect(projection.checks).not.toContainEqual(
      expect.objectContaining({
        checkId: "parameterManager.unusedCustom",
        parameterId: dynamicsDriverParameterId
      })
    );
    expect(projection.checks).not.toContainEqual(
      expect.objectContaining({
        checkId: "parameterManager.unusedCustom",
        parameterId: dynamicsOutputParameterId
      })
    );
    expect(projection.checks).not.toContainEqual(
      expect.objectContaining({
        parameterId: ParameterIdSchema.parse("param_face_angle_x")
      })
    );
  });

  it("shares active parameter id and current value with the Parameter Bar projection", () => {
    const session = createEmptyAuthoringSession();
    const parameterId = ParameterIdSchema.parse("param_face_angle_x");
    const bar = createParameterBarProjection(session, parameterId, {
      [parameterId]: 12
    });

    expect(bar.activeParameter?.parameterId).toBe(parameterId);
    expect(bar.activeParameter?.displayName).toBe("Face Angle X");
    expect(bar.currentValue).toBe(12);
  });
});
