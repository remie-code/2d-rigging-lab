import { ParameterIdSchema, type ParameterId } from "@private-2d-rigging-lab/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { EditorParameter } from "../../features/editor-session/model/parameter-keyform-state";
import { RuntimeControls } from "./runtime-controls";
import {
  createInitialRuntimeControlsState,
  createRuntimeControlsProjection,
  createRuntimeParameterValueMap,
  normalizeRuntimeParameterOverrides,
  resetAllRuntimeParameterOverrides,
  resetRuntimeParameterOverride,
  setRuntimeControlsSearch,
  setRuntimeParameterOverride,
  type ViewerRuntimeControlsState
} from "./runtime-controls-state";

const FACE_ANGLE_X = ParameterIdSchema.parse("param_face_angle_x");
const MOUTH_OPEN = ParameterIdSchema.parse("param_mouth_open");
const HAIR_SWAY = ParameterIdSchema.parse("param_hair_sway_output");
const CUSTOM_BROW = ParameterIdSchema.parse("param_custom_brow");

describe("viewer runtime controls state", () => {
  it("filters editable parameters by display name or id and excludes computedDynamics", () => {
    const parameters = [
      createParameter(FACE_ANGLE_X, "Face Angle X", { min: -30, max: 30 }),
      createParameter(MOUTH_OPEN, "Mouth Open", { min: 0, max: 1 }),
      createParameter(HAIR_SWAY, "Hair Sway Output", {
        min: -1,
        max: 1,
        valueSource: "computedDynamics"
      })
    ];

    const byName = createRuntimeControlsProjection(
      parameters,
      setRuntimeControlsSearch(createInitialRuntimeControlsState(), "mouth")
    );
    expect(byName.rows.map((row) => row.parameterId)).toEqual([MOUTH_OPEN]);
    expect(byName.hiddenComputedParameterCount).toBe(1);

    const byId = createRuntimeControlsProjection(
      parameters,
      setRuntimeControlsSearch(createInitialRuntimeControlsState(), "param_face")
    );
    expect(byId.rows.map((row) => row.parameterId)).toEqual([FACE_ANGLE_X]);
    expect(byId.rows.some((row) => row.parameterId === HAIR_SWAY)).toBe(false);
  });

  it("clamps override updates and removes entries when values return to default", () => {
    const parameter = createParameter(FACE_ANGLE_X, "Face Angle X", {
      defaultValue: 0,
      max: 30,
      min: -30
    });
    const clamped = setRuntimeParameterOverride(
      createInitialRuntimeControlsState(),
      parameter,
      99
    );

    expect(clamped.parameterOverrides[FACE_ANGLE_X]).toBe(30);
    expect(createRuntimeControlsProjection([parameter], clamped).rows[0]?.currentValue).toBe(30);

    const resetByDefault = setRuntimeParameterOverride(clamped, parameter, 0);
    expect(resetByDefault.parameterOverrides[FACE_ANGLE_X]).toBeUndefined();

    const resetByNonFinite = setRuntimeParameterOverride(clamped, parameter, Number.NaN);
    expect(resetByNonFinite.parameterOverrides[FACE_ANGLE_X]).toBeUndefined();
  });

  it("normalizes default-valued entries out of parameterOverrides", () => {
    const parameter = createParameter(MOUTH_OPEN, "Mouth Open", {
      defaultValue: 0,
      max: 1,
      min: 0
    });

    expect(
      normalizeRuntimeParameterOverrides([parameter], {
        [MOUTH_OPEN]: 0
      })
    ).toEqual({});
  });

  it("projects changed indication and supports row and all resets", () => {
    const parameters = [
      createParameter(FACE_ANGLE_X, "Face Angle X", { min: -30, max: 30 }),
      createParameter(MOUTH_OPEN, "Mouth Open", { min: 0, max: 1 }),
      createParameter(CUSTOM_BROW, "Custom Brow", { min: -1, max: 1 })
    ];
    const state: ViewerRuntimeControlsState = {
      parameterOverrides: {
        [FACE_ANGLE_X]: 10,
        [MOUTH_OPEN]: 1
      },
      search: ""
    };
    const projection = createRuntimeControlsProjection(parameters, state);

    expect(projection.changedParameterCount).toBe(2);
    expect(
      projection.rows.map((row) => ({
        changed: row.changed,
        id: row.parameterId
      }))
    ).toEqual([
      { changed: true, id: FACE_ANGLE_X },
      { changed: true, id: MOUTH_OPEN },
      { changed: false, id: CUSTOM_BROW }
    ]);

    const rowReset = resetRuntimeParameterOverride(state, FACE_ANGLE_X);
    expect(rowReset.parameterOverrides[FACE_ANGLE_X]).toBeUndefined();
    expect(rowReset.parameterOverrides[MOUTH_OPEN]).toBe(1);

    const allReset = resetAllRuntimeParameterOverrides({
      parameterOverrides: {
        [FACE_ANGLE_X]: 10
      },
      search: "face"
    });
    expect(allReset).toEqual({
      parameterOverrides: {},
      search: "face"
    });
  });

  it("ignores direct override attempts for computedDynamics parameters", () => {
    const computed = createParameter(HAIR_SWAY, "Hair Sway Output", {
      max: 1,
      min: -1,
      valueSource: "computedDynamics"
    });
    const state = setRuntimeParameterOverride(
      {
        parameterOverrides: {
          [HAIR_SWAY]: 0.5
        },
        search: ""
      },
      computed,
      0.75
    );

    expect(state.parameterOverrides[HAIR_SWAY]).toBeUndefined();
    expect(createRuntimeControlsProjection([computed], state).rows).toEqual([]);
  });

  it("creates runtime parameter values without reading or mutating authoring values", () => {
    const parameter = createParameter(FACE_ANGLE_X, "Face Angle X", {
      max: 30,
      min: -30
    });
    const state: ViewerRuntimeControlsState = {
      parameterOverrides: {
        [FACE_ANGLE_X]: 99
      },
      search: ""
    };

    const runtimeValues = createRuntimeParameterValueMap([parameter], state);

    expect(runtimeValues).toEqual({
      [FACE_ANGLE_X]: 30
    });
    expect(state.parameterOverrides[FACE_ANGLE_X]).toBe(99);
  });
});

function createParameter(
  parameterId: ParameterId,
  displayName: string,
  options: {
    readonly defaultValue?: number;
    readonly max: number;
    readonly min: number;
    readonly recommendedUiStep?: number;
    readonly valueSource?: EditorParameter["valueSource"];
  }
): EditorParameter {
  return {
    parameterId,
    displayName,
    valueSource: options.valueSource ?? "authoredInput",
    min: options.min,
    max: options.max,
    default: options.defaultValue ?? 0,
    recommendedUiStep: options.recommendedUiStep ?? 0.01,
    kind: "custom",
    parameterType: "scalar",
    group: "custom",
    lockedFields: []
  };
}

describe("RuntimeControls UI", () => {
  it("renders a Viewer runtime controls surface without an EditorSession provider", () => {
    const markup = renderRuntimeControls({
      parameters: [
        createParameter(FACE_ANGLE_X, "Face Angle X", { max: 30, min: -30 }),
        createParameter(MOUTH_OPEN, "Mouth Open", { max: 1, min: 0 }),
        createParameter(HAIR_SWAY, "Hair Sway Output", {
          max: 1,
          min: -1,
          valueSource: "computedDynamics"
        })
      ],
      state: createInitialRuntimeControlsState()
    });

    expect(markup).toContain("Runtime Controls");
    expect(markup).toContain('aria-label="Search parameters"');
    expect(markup).toContain("Face Angle X");
    expect(markup).toContain("Mouth Open");
    expect(markup).not.toContain("Hair Sway Output");
    expect(markup).not.toContain("Parameter Bar");
    expect(markup).not.toContain("Keyform");
    expect(markup).not.toContain("Favorite");
    expect(markup).not.toContain("Group");
  });

  it("renders parameter name search as the top control and filters visible rows", () => {
    const markup = renderRuntimeControls({
      parameters: [
        createParameter(FACE_ANGLE_X, "Face Angle X", { max: 30, min: -30 }),
        createParameter(MOUTH_OPEN, "Mouth Open", { max: 1, min: 0 })
      ],
      state: {
        parameterOverrides: {},
        search: "mouth"
      }
    });

    expect(markup.indexOf('aria-label="Search parameters"')).toBeLessThan(
      markup.indexOf('data-testid="runtime-parameter-list"')
    );
    expect(markup).toContain("Mouth Open");
    expect(markup).not.toContain("Face Angle X");
  });

  it("marks changed rows and renders compact row reset plus icon-only reset all", () => {
    const markup = renderRuntimeControls({
      parameters: [
        createParameter(FACE_ANGLE_X, "Face Angle X", { max: 30, min: -30 }),
        createParameter(MOUTH_OPEN, "Mouth Open", { max: 1, min: 0 })
      ],
      state: {
        parameterOverrides: {
          [FACE_ANGLE_X]: 10
        },
        search: ""
      }
    });

    expect(markup).toContain('aria-label="Reset all parameter overrides"');
    expect(markup).toContain('title="Reset all"');
    expect(markup).toContain('aria-label="Reset Face Angle X"');
    expect(markup).toContain('data-changed="true"');
    expect(markup).toContain('data-changed="false"');
    expect(markup).toContain("grid-cols-[minmax(6.5rem,0.78fr)_minmax(8rem,1fr)_4rem_1.75rem]");
    expect(markup).toContain("h-7");
    expect(markup).not.toContain("Reset changed");
    expect(markup).not.toContain("Changed");
    expect(markup).not.toContain("-30 to 30");
  });

  it("renders the future playback slot as a non-interactive placeholder", () => {
    const markup = renderRuntimeControls({
      parameters: [createParameter(FACE_ANGLE_X, "Face Angle X", { max: 30, min: -30 })],
      state: createInitialRuntimeControlsState()
    });

    expect(markup).toContain('data-testid="future-playback-slot"');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain("Motion / Physics");
    expect(markup).toContain("Not configured");
    expect(markup).not.toContain("Play");
    expect(markup).not.toContain("Pause");
  });
});

function renderRuntimeControls({
  parameters,
  state
}: {
  readonly parameters: readonly EditorParameter[];
  readonly state: ViewerRuntimeControlsState;
}): string {
  return renderToStaticMarkup(
    createElement(RuntimeControls, {
      onStateChange: vi.fn(),
      parameters,
      state
    })
  );
}
