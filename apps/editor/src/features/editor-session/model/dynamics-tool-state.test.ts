import { listInitializedParameters, type AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { DynamicsGroupIdSchema, ParameterIdSchema, type ParameterId } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createEmptyAuthoringSession } from "./empty-authoring-session";
import {
  addInputToDynamicsDraft,
  advanceDynamicsToolPreviewSimulation,
  clearDynamicsToolPreviewDefinitionOverride,
  createDefaultDynamicsInput,
  createDefaultDynamicsOutput,
  createDynamicsGroupDraftFromSession,
  createDynamicsToolPreviewEvaluation,
  createInitialDynamicsToolPreviewState,
  resetDynamicsToolPreviewSimulation,
  selectDynamicsToolPreviewGroup,
  setDynamicsToolPreviewDefinitionOverride,
  setDynamicsToolPreviewDriverValue,
  validateDynamicsToolDraft,
  type DynamicsToolPreviewState
} from "./dynamics-tool-state";

const DRIVER_X = ParameterIdSchema.parse("param_driver_x");
const DRIVER_Y = ParameterIdSchema.parse("param_driver_y");
const OUTPUT_SWAY = ParameterIdSchema.parse("param_output_sway");
const NON_DRIVER = ParameterIdSchema.parse("param_non_driver_default");
const GROUP_ID = DynamicsGroupIdSchema.parse("dyn_model_sway");

describe("Dynamics Tool state", () => {
  it("derives input normalization defaults and output angle defaults from parameters", () => {
    const session = createDynamicsSession();
    const input = createDefaultDynamicsInput(requireInitializedParameter(session, DRIVER_X));
    const output = createDefaultDynamicsOutput(requireInitializedParameter(session, OUTPUT_SWAY));

    expect(input).toMatchObject({
      parameterId: DRIVER_X,
      kind: "angle",
      influencePercent: 100,
      normalization: {
        min: -30,
        center: 0,
        max: 30
      }
    });
    expect(output).toMatchObject({
      parameterId: OUTPUT_SWAY,
      kind: "angle"
    });
  });

  it("adds multiple driver inputs without replacing the first input", () => {
    const session = createDynamicsSession();
    const driverX = requireInitializedParameter(session, DRIVER_X);
    const outputSway = requireInitializedParameter(session, OUTPUT_SWAY);
    const draft = addInputToDynamicsDraft(session, {
      ...createDynamicsGroupDraftFromSession(session),
      inputs: [createDefaultDynamicsInput(driverX)],
      outputs: [createDefaultDynamicsOutput(outputSway)]
    });

    expect(draft.inputs).toHaveLength(2);
    expect(draft.inputs[0]?.parameterId).toBe(DRIVER_X);
    expect(new Set(draft.inputs.map((input) => input.parameterId)).size).toBe(2);
  });

  it("blocks invalid normalization and duplicate output ownership", () => {
    const session = createDynamicsSession();
    const driverX = requireInitializedParameter(session, DRIVER_X);
    const outputSway = requireInitializedParameter(session, OUTPUT_SWAY);
    session.graph.dynamicsGroups.push({
      dynamicsGroupId: DynamicsGroupIdSchema.parse("dyn_existing_output"),
      displayName: "Existing Output",
      enabled: true,
      presetId: "hair",
      inputs: [createDefaultDynamicsInput(driverX)],
      pendulums: [
        {
          length: 0.8,
          sway: 0.7,
          reactionSpeed: 12,
          convergenceSpeed: 4
        }
      ],
      outputs: [createDefaultDynamicsOutput(outputSway)]
    });

    const draft = {
      ...createDynamicsGroupDraftFromSession(session),
      inputs: [
        {
          ...createDefaultDynamicsInput(driverX),
          normalization: {
            min: 0,
            center: 0,
            max: 30
          }
        }
      ],
      outputs: [createDefaultDynamicsOutput(outputSway)]
    };

    const issues = validateDynamicsToolDraft(session, draft);

    expect(issues.map((issue) => issue.code)).toContain("dynamicsTool.normalizationInvalid");
    expect(issues.map((issue) => issue.code)).toContain("dynamicsTool.outputOwnershipDuplicate");
    expect(issues.filter((issue) => issue.severity === "error")).toHaveLength(2);
  });

  it("uses non-driver defaults, local driver values, and additive output offset in preview", () => {
    const session = createDynamicsSession();
    session.graph.dynamicsGroups.push(createDynamicsGroup());
    const state = setDynamicsToolPreviewDriverValue(
      session,
      {
        selectedGroupId: GROUP_ID,
        driverValuesByGroupId: {},
        simulationStatesByGroupId: {
          [GROUP_ID]: {
            angle: 0.5,
            angularVelocity: 0,
            previousSource: 0,
            previousSourceVelocity: 0,
            tick: 1,
            resetCounter: 1
          }
        },
        definitionOverridesByGroupId: {},
        resetSerial: 0
      },
      {
        dynamicsGroupId: GROUP_ID,
        parameterId: DRIVER_X,
        value: 30
      }
    );
    const evaluation = createDynamicsToolPreviewEvaluation(session, {
      ...state,
      simulationStatesByGroupId: {
        [GROUP_ID]: {
          angle: 0.5,
          angularVelocity: 0,
          previousSource: 0,
          previousSourceVelocity: 0,
          tick: 1,
          resetCounter: 1
        }
      }
    });

    expect(evaluation.parameterValues[DRIVER_X]).toBe(30);
    expect(evaluation.parameterValues[NON_DRIVER]).toBe(0.25);
    expect(evaluation.output).toMatchObject({
      baseValue: 0,
      offset: 5,
      effectiveValue: 5
    });
    expect(evaluation.parameterValues[OUTPUT_SWAY]).toBe(5);
  });

  it("advances preview simulation across frames using elapsed time", () => {
    const session = createDynamicsSession();
    session.graph.dynamicsGroups.push(createDynamicsGroup());
    let state = selectDynamicsToolPreviewGroup(
      session,
      createInitialDynamicsToolPreviewState(),
      GROUP_ID
    );
    state = setDynamicsToolPreviewDriverValue(session, state, {
      dynamicsGroupId: GROUP_ID,
      parameterId: DRIVER_X,
      value: 30
    });

    const first = advanceDynamicsToolPreviewSimulation(session, state, {
      dynamicsGroupId: GROUP_ID,
      dtMs: 16.6666667
    });
    const second = advanceDynamicsToolPreviewSimulation(session, first, {
      dynamicsGroupId: GROUP_ID,
      dtMs: 16.6666667
    });

    expect(first.simulationStatesByGroupId[GROUP_ID]?.tick).toBe(1);
    expect(second.simulationStatesByGroupId[GROUP_ID]?.tick).toBe(2);
    expect(second.simulationStatesByGroupId[GROUP_ID]?.angle).not.toBe(
      first.simulationStatesByGroupId[GROUP_ID]?.angle
    );
  });

  it("uses later driver values on subsequent frames", () => {
    const session = createDynamicsSession();
    session.graph.dynamicsGroups.push(createDynamicsGroup());
    let state = selectDynamicsToolPreviewGroup(
      session,
      createInitialDynamicsToolPreviewState(),
      GROUP_ID
    );
    state = setDynamicsToolPreviewDriverValue(session, state, {
      dynamicsGroupId: GROUP_ID,
      parameterId: DRIVER_X,
      value: 30
    });
    state = advanceDynamicsToolPreviewSimulation(session, state, {
      dynamicsGroupId: GROUP_ID,
      dtMs: 16.6666667
    });

    state = setDynamicsToolPreviewDriverValue(session, state, {
      dynamicsGroupId: GROUP_ID,
      parameterId: DRIVER_X,
      value: -30
    });
    const afterDriverChange = advanceDynamicsToolPreviewSimulation(session, state, {
      dynamicsGroupId: GROUP_ID,
      dtMs: 16.6666667
    });

    expect(afterDriverChange.driverValuesByGroupId[GROUP_ID]?.[DRIVER_X]).toBe(-30);
    expect(afterDriverChange.simulationStatesByGroupId[GROUP_ID]).toMatchObject({
      previousSource: -1,
      tick: 2
    });
  });

  it("keeps moving after driver input stops and settles toward the held source", () => {
    const session = createDynamicsSession();
    const group = createDynamicsGroup();
    group.pendulums = [
      {
        length: 1,
        sway: 0.05,
        reactionSpeed: 8,
        convergenceSpeed: 10
      }
    ];
    session.graph.dynamicsGroups.push(group);
    let state = selectDynamicsToolPreviewGroup(
      session,
      createInitialDynamicsToolPreviewState(),
      GROUP_ID
    );
    state = setDynamicsToolPreviewDriverValue(session, state, {
      dynamicsGroupId: GROUP_ID,
      parameterId: DRIVER_X,
      value: 30
    });
    const first = advanceDynamicsToolPreviewSimulation(session, state, {
      dynamicsGroupId: GROUP_ID,
      dtMs: 16.6666667
    });
    let settled = first;
    for (let index = 0; index < 120; index += 1) {
      settled = advanceDynamicsToolPreviewSimulation(session, settled, {
        dynamicsGroupId: GROUP_ID,
        dtMs: 16.6666667
      });
    }

    const firstState = first.simulationStatesByGroupId[GROUP_ID];
    const settledState = settled.simulationStatesByGroupId[GROUP_ID];
    expect(firstState?.tick).toBe(1);
    expect(settledState?.tick).toBe(121);
    expect(Math.abs(settledState?.angularVelocity ?? 0)).toBeLessThan(
      Math.abs(firstState?.angularVelocity ?? 0)
    );
    expect(Math.abs((settledState?.angle ?? 0) - 1)).toBeLessThan(
      Math.abs((firstState?.angle ?? 0) - 1)
    );
  });

  it("uses session-local definition overrides for immediate Quick Tune preview", () => {
    const session = createDynamicsSession();
    const group = createDynamicsGroup();
    session.graph.dynamicsGroups.push(group);
    const state: DynamicsToolPreviewState = {
      selectedGroupId: GROUP_ID,
      driverValuesByGroupId: {},
      simulationStatesByGroupId: {
        [GROUP_ID]: {
          angle: 0.5,
          angularVelocity: 0,
          previousSource: 0,
          previousSourceVelocity: 0,
          tick: 1,
          resetCounter: 1
        }
      },
      definitionOverridesByGroupId: {},
      resetSerial: 0
    };
    const tuned = setDynamicsToolPreviewDefinitionOverride(session, state, {
      dynamicsGroupId: GROUP_ID,
      definition: {
        ...group,
        outputs: [
          {
            ...group.outputs[0]!,
            strength: 4
          }
        ]
      }
    });

    expect(createDynamicsToolPreviewEvaluation(session, tuned).output).toMatchObject({
      offset: 2,
      effectiveValue: 2
    });

    const cleared = clearDynamicsToolPreviewDefinitionOverride(tuned, GROUP_ID);
    expect(createDynamicsToolPreviewEvaluation(session, cleared).output).toMatchObject({
      offset: 5,
      effectiveValue: 5
    });
  });

  it("resets only the session-local simulation state", () => {
    const session = createDynamicsSession();
    session.graph.dynamicsGroups.push(createDynamicsGroup());
    const initialState: DynamicsToolPreviewState = {
      selectedGroupId: GROUP_ID,
      driverValuesByGroupId: {
        [GROUP_ID]: {
          [DRIVER_X]: 20
        }
      },
      simulationStatesByGroupId: {
        [GROUP_ID]: {
          angle: 0.4,
          angularVelocity: 3,
          previousSource: 0.2,
          previousSourceVelocity: 1,
          tick: 4,
          resetCounter: 2
        }
      },
      definitionOverridesByGroupId: {},
      resetSerial: 0
    };

    const reset = resetDynamicsToolPreviewSimulation(session, initialState, GROUP_ID);

    expect(reset.driverValuesByGroupId[GROUP_ID]?.[DRIVER_X]).toBe(20);
    expect(reset.simulationStatesByGroupId[GROUP_ID]).toMatchObject({
      angularVelocity: 0,
      tick: 0,
      resetCounter: 3
    });
    expect(reset.resetSerial).toBe(1);
  });

  it("skips same-value preview driver updates without advancing the simulation", () => {
    const session = createDynamicsSession();
    session.graph.dynamicsGroups.push(createDynamicsGroup());
    const state: DynamicsToolPreviewState = {
      selectedGroupId: GROUP_ID,
      driverValuesByGroupId: {
        [GROUP_ID]: {
          [DRIVER_X]: 20
        }
      },
      simulationStatesByGroupId: {
        [GROUP_ID]: {
          angle: 0.4,
          angularVelocity: 3,
          previousSource: 0.2,
          previousSourceVelocity: 1,
          tick: 4,
          resetCounter: 2
        }
      },
      definitionOverridesByGroupId: {},
      resetSerial: 0
    };

    const same = setDynamicsToolPreviewDriverValue(session, state, {
      dynamicsGroupId: GROUP_ID,
      parameterId: DRIVER_X,
      value: 20
    });

    expect(same).toBe(state);
    expect(same.simulationStatesByGroupId[GROUP_ID]?.tick).toBe(4);
  });
});

function createDynamicsSession() {
  const session = createEmptyAuthoringSession();
  session.graph.parameters.push(
    {
      parameterId: DRIVER_X,
      displayName: "Driver X",
      valueSource: "authoredInput",
      min: -30,
      default: 0,
      max: 30,
      recommendedUiStep: 1,
      kind: "custom",
      parameterType: "scalar",
      group: "custom",
      lockedFields: []
    },
    {
      parameterId: DRIVER_Y,
      displayName: "Driver Y",
      valueSource: "authoredInput",
      min: -10,
      default: 0,
      max: 10,
      recommendedUiStep: 0.5,
      kind: "custom",
      parameterType: "scalar",
      group: "custom",
      lockedFields: []
    },
    {
      parameterId: OUTPUT_SWAY,
      displayName: "Output Sway",
      valueSource: "authoredInput",
      min: -20,
      default: 0,
      max: 20,
      recommendedUiStep: 0.1,
      kind: "custom",
      parameterType: "scalar",
      group: "custom",
      lockedFields: []
    },
    {
      parameterId: NON_DRIVER,
      displayName: "Non Driver",
      valueSource: "authoredInput",
      min: 0,
      default: 0.25,
      max: 1,
      recommendedUiStep: 0.01,
      kind: "custom",
      parameterType: "scalar",
      group: "custom",
      lockedFields: []
    }
  );
  return session;
}

function requireInitializedParameter(session: AuthoringSession, parameterId: ParameterId) {
  const parameter = listInitializedParameters(session.graph).find(
    (candidate) => candidate.parameterId === parameterId
  );
  if (parameter === undefined) {
    throw new Error(`Expected initialized parameter ${parameterId}.`);
  }

  return parameter;
}

function createDynamicsGroup() {
  return {
    dynamicsGroupId: GROUP_ID,
    displayName: "Model Sway",
    enabled: true,
    presetId: "hair",
    inputs: [
      {
        parameterId: DRIVER_X,
        kind: "angle" as const,
        influencePercent: 100,
        invert: false,
        normalization: {
          min: -30,
          center: 0,
          max: 30
        }
      }
    ],
    pendulums: [
      {
        length: 0.8,
        sway: 0.7,
        reactionSpeed: 12,
        convergenceSpeed: 4
      }
    ],
    outputs: [
      {
        parameterId: OUTPUT_SWAY,
        kind: "angle" as const,
        strength: 10,
        invert: false,
        limit: 15
      }
    ]
  };
}
