import { DynamicsGroupIdSchema, ParameterIdSchema } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createEmptyAuthoringSession } from "./empty-authoring-session";
import {
  commitCreateCustomParameter,
  commitDeleteCustomParameter,
  commitUpdateCustomParameter
} from "./parameter-definition-commands";

describe("parameter definition editor commands", () => {
  it("commits custom parameter creation through the operation contract", () => {
    const session = createEmptyAuthoringSession();
    const parameterId = ParameterIdSchema.parse("param_custom_smile");
    const result = commitCreateCustomParameter(session, {
      parameterId,
      displayName: "Custom Smile",
      valueSource: "authoredInput",
      min: 0,
      default: 0.5,
      max: 1,
      recommendedUiStep: 0.01
    });

    expect(result.committed).toBe(true);
    expect(result.session.graph.parameters).toContainEqual(
      expect.objectContaining({
        parameterId,
        displayName: "Custom Smile",
        min: 0,
        default: 0.5,
        max: 1
      })
    );
    expect(session.graph.parameters).toEqual([]);
  });

  it("surfaces preset id collisions as structured operation diagnostics", () => {
    const result = commitCreateCustomParameter(createEmptyAuthoringSession(), {
      parameterId: ParameterIdSchema.parse("param_face_angle_x"),
      displayName: "Duplicate Preset",
      valueSource: "authoredInput",
      min: -1,
      default: 0,
      max: 1,
      recommendedUiStep: 0.01
    });

    expect(result.committed).toBe(false);
    expect(result.diagnostics[0]?.checkId).toBe("operation.createParameter.duplicateParameter");
  });

  it("commits custom parameter updates through the operation contract", () => {
    const session = createEmptyAuthoringSession();
    const parameterId = ParameterIdSchema.parse("param_custom_smile");
    const created = commitCreateCustomParameter(session, {
      parameterId,
      displayName: "Custom Smile",
      valueSource: "authoredInput",
      min: 0,
      default: 0.5,
      max: 1,
      recommendedUiStep: 0.01
    });
    expect(created.committed).toBe(true);

    const updated = commitUpdateCustomParameter(created.session, {
      parameterId,
      displayName: "Updated Smile",
      min: -1,
      default: 0,
      max: 1,
      recommendedUiStep: 0.1
    });

    expect(updated.committed).toBe(true);
    expect(updated.session.graph.parameters).toContainEqual(
      expect.objectContaining({
        parameterId,
        displayName: "Updated Smile",
        min: -1,
        default: 0,
        max: 1,
        recommendedUiStep: 0.1
      })
    );
    expect(created.session.graph.parameters).toContainEqual(
      expect.objectContaining({
        parameterId,
        displayName: "Custom Smile"
      })
    );
  });

  it("commits safe custom parameter deletion through the operation contract", () => {
    const session = createEmptyAuthoringSession();
    const parameterId = ParameterIdSchema.parse("param_custom_smile");
    const created = commitCreateCustomParameter(session, {
      parameterId,
      displayName: "Custom Smile",
      valueSource: "authoredInput",
      min: 0,
      default: 0,
      max: 1,
      recommendedUiStep: 0.01
    });
    expect(created.committed).toBe(true);

    const deleted = commitDeleteCustomParameter(created.session, { parameterId });

    expect(deleted.committed).toBe(true);
    expect(deleted.session.graph.parameters.some((parameter) => parameter.parameterId === parameterId)).toBe(false);
    expect(created.session.graph.parameters.some((parameter) => parameter.parameterId === parameterId)).toBe(true);
  });

  it("surfaces delete rejection diagnostics for dynamics-referenced custom parameters", () => {
    const session = createEmptyAuthoringSession();
    const parameterId = ParameterIdSchema.parse("param_custom_driver");
    const created = commitCreateCustomParameter(session, {
      parameterId,
      displayName: "Custom Driver",
      valueSource: "authoredInput",
      min: 0,
      default: 0,
      max: 1,
      recommendedUiStep: 0.01
    });
    expect(created.committed).toBe(true);
    created.session.graph.dynamicsGroups.push({
      dynamicsGroupId: DynamicsGroupIdSchema.parse("dyn_custom_driver"),
      displayName: "Custom Driver Dynamics",
      enabled: true,
      inputs: [
        {
          parameterId,
          kind: "angle",
          influencePercent: 100,
          invert: false,
          normalization: {
            min: 0,
            center: 0.5,
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
          parameterId: ParameterIdSchema.parse("param_mouth_open"),
          kind: "angle",
          strength: 1,
          invert: false,
          limit: 1
        }
      ]
    });

    const deleted = commitDeleteCustomParameter(created.session, { parameterId });

    expect(deleted.committed).toBe(false);
    expect(deleted.diagnostics[0]?.checkId).toBe("operation.deleteParameter.parameterInUse");
  });
});
