import { describe, expect, it } from "vitest";

import {
  applyPreviewParameterValue,
  projectPreviewAuthoredParameterValues,
  projectPreviewParameterValues
} from "./preview-parameter-state.js";

describe("preview parameter state", () => {
  it("rejects disabled non-authored parameter updates", () => {
    const parameters = projectPreviewParameterValues([
      {
        parameterId: "param_hair_sway",
        displayName: "Hair Sway",
        valueSource: "computedDynamics",
        min: -1,
        max: 1,
        default: 0,
        recommendedUiStep: 0.01
      }
    ]);

    const projection = applyPreviewParameterValue(parameters, {
      parameterId: "param_hair_sway",
      value: 0.5
    });

    expect(projection.result).toEqual({
      status: "disabled",
      parameterId: "param_hair_sway",
      requestedValue: 0.5,
      currentValue: 0
    });
    expect(projection.parameters).toBe(parameters);
  });

  it("projects only authored preview values for runtime inputs", () => {
    const parameters = projectPreviewParameterValues([
      {
        parameterId: "param_body_yaw",
        displayName: "Body Yaw",
        valueSource: "authoredInput",
        min: -1,
        max: 1,
        default: 0,
        recommendedUiStep: 0.01
      },
      {
        parameterId: "param_hair_sway",
        displayName: "Hair Sway",
        valueSource: "computedDynamics",
        min: -1,
        max: 1,
        default: 0,
        recommendedUiStep: 0.01
      }
    ]);
    const updated = applyPreviewParameterValue(parameters, {
      parameterId: "param_body_yaw",
      value: 0.4
    });

    expect(projectPreviewAuthoredParameterValues(updated.parameters)).toEqual({
      param_body_yaw: 0.4
    });
  });
});
