import { describe, expect, it } from "vitest";
import { ParameterIdSchema } from "@private-2d-rigging-lab/contracts";

import {
  PRESET_PARAMETER_CATALOG,
  createInitializedParameterSurface,
  getPresetParameterById
} from "./parameter-presets.js";

describe("parameter preset catalog", () => {
  it("exposes a stable always-present preset catalog without duplicate ids", () => {
    const ids = PRESET_PARAMETER_CATALOG.map((parameter) => parameter.parameterId);

    expect(new Set(ids).size).toBe(ids.length);
    expect(getPresetParameterById("param_face_angle_x")).toMatchObject({
      kind: "preset",
      parameterId: "param_face_angle_x",
      displayName: "Face Angle X",
      group: "face",
      presetRole: "face.angle.x",
      min: -30,
      default: 0,
      max: 30,
      lockedFields: expect.arrayContaining(["min", "max", "default", "signConvention"])
    });
  });

  it("creates an initialized surface with presets first and custom parameters after them", () => {
    const surface = createInitializedParameterSurface([
      {
        parameterId: ParameterIdSchema.parse("param_custom_smile"),
        displayName: "Custom Smile",
        valueSource: "authoredInput",
        min: 0,
        max: 1,
        default: 0,
        recommendedUiStep: 0.01
      }
    ]);

    expect(surface[0]).toMatchObject({
      kind: "preset",
      parameterId: "param_face_angle_x"
    });
    expect(surface[surface.length - 1]).toMatchObject({
      kind: "custom",
      parameterType: "scalar",
      group: "custom",
      lockedFields: [],
      parameterId: "param_custom_smile"
    });
  });

  it("normalizes custom parameters as role-less even when legacy semantic fields are stored", () => {
    const surface = createInitializedParameterSurface([
      {
        parameterId: ParameterIdSchema.parse("param_custom_legacy"),
        displayName: "Custom Legacy",
        semanticRole: "mouth",
        projectPresetAlias: "mouth.smile",
        valueSource: "authoredInput",
        min: 0,
        max: 1,
        default: 0,
        recommendedUiStep: 0.01
      }
    ]);

    const custom = surface[surface.length - 1];
    expect(custom).toMatchObject({
      kind: "custom",
      group: "custom",
      parameterId: "param_custom_legacy"
    });
    expect(custom).not.toHaveProperty("semanticRole");
    expect(custom).not.toHaveProperty("projectPresetAlias");
  });
});
