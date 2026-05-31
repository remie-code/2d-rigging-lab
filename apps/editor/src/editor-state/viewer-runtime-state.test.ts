import { describe, expect, it } from "vitest";

import {
  applyViewerParameterValue,
  closeViewerRuntimeSurface,
  openViewerRuntimeSurface,
  projectViewerParameterOverrides,
  projectViewerRuntimeState,
  resetViewerParameterValues
} from "./viewer-runtime-state.js";

describe("viewer runtime state", () => {
  const parameters = [
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
  ] as const;

  it("tracks viewer surface open state separately from authored parameters", () => {
    const closed = projectViewerRuntimeState(parameters);
    const open = openViewerRuntimeSurface(closed);

    expect(closed.surface).toBe("closed");
    expect(open.surface).toBe("open");
    expect(closeViewerRuntimeSurface(open).surface).toBe("closed");
  });

  it("applies authored viewer overrides and omits disabled computed parameters", () => {
    const opened = openViewerRuntimeSurface(projectViewerRuntimeState(parameters));
    const bodyYaw = applyViewerParameterValue(opened, {
      parameterId: "param_body_yaw",
      value: 2
    });
    const hairSway = applyViewerParameterValue(bodyYaw.viewerRuntime, {
      parameterId: "param_hair_sway",
      value: 0.5
    });

    expect(bodyYaw.result).toMatchObject({
      status: "updated",
      currentValue: 1
    });
    expect(hairSway.result.status).toBe("disabled");
    expect(projectViewerParameterOverrides(bodyYaw.viewerRuntime.parameters)).toEqual({
      param_body_yaw: 1
    });
  });

  it("resets viewer parameters to package defaults", () => {
    const opened = openViewerRuntimeSurface(projectViewerRuntimeState(parameters));
    const changed = applyViewerParameterValue(opened, {
      parameterId: "param_body_yaw",
      value: 0.75
    }).viewerRuntime;

    expect(projectViewerParameterOverrides(changed.parameters)).toEqual({
      param_body_yaw: 0.75
    });
    expect(projectViewerParameterOverrides(resetViewerParameterValues(changed).parameters)).toEqual({});
  });
});
