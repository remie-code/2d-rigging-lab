import { listInitializedParameters, type AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { DynamicsGroupIdSchema, ParameterIdSchema, type ParameterId } from "@private-2d-rigging-lab/contracts";
import { stepDynamics, type NormalizedDynamicsGroup } from "@private-2d-rigging-lab/runtime-core";
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
  getDynamicsToolPreset,
  resetDynamicsToolPreviewSimulation,
  selectDynamicsToolPreviewGroup,
  setDynamicsToolPreviewDefinitionOverride,
  setDynamicsToolPreviewDriverValue,
  validateDynamicsToolDraft,
  type DynamicsToolDraft,
  type DynamicsToolGroup,
  type DynamicsToolPreviewState
} from "./dynamics-tool-state";

const DRIVER_X = ParameterIdSchema.parse("param_driver_x");
const DRIVER_Y = ParameterIdSchema.parse("param_driver_y");
const OUTPUT_SWAY = ParameterIdSchema.parse("param_output_sway");
const NON_DRIVER = ParameterIdSchema.parse("param_non_driver_default");
const GROUP_ID = DynamicsGroupIdSchema.parse("dyn_model_sway");

// §3.2 anchor: φ = (v − d)·scale [deg]. With scale 1.0 and default 0, driver value 30 → φ = 30°.
// §3.5 output: at rest the chain hangs straight down (θ_world = 0), θ_local = θ_world − φ = −30°.
// Output scale 1/30 → rawOffset = −30·(1/30) = −1.0.
const EXPECTED_REST_OFFSET_AT_30DEG = -1;

describe("Dynamics Tool state", () => {
  it("derives v3 input scale defaults and output scale/limit defaults from parameters", () => {
    const session = createDynamicsSession();
    const input = createDefaultDynamicsInput(requireInitializedParameter(session, DRIVER_X));
    const output = createDefaultDynamicsOutput(requireInitializedParameter(session, OUTPUT_SWAY));

    expect(input).toEqual({
      parameterId: DRIVER_X,
      kind: "angle",
      scale: 1
    });
    // OUTPUT_SWAY range = 40 (min −20 .. max 20). scale = 1/30 (§8), limit = range/2 = 20.
    expect(output).toEqual({
      parameterId: OUTPUT_SWAY,
      segmentIndex: 1,
      scale: Number((1 / 30).toFixed(6)),
      limit: 20
    });
  });

  it("uses the §8 preset chain values", () => {
    expect(getDynamicsToolPreset("hair").chain).toEqual({
      rootOffset: { x: 0, y: 0 },
      segmentLengths: [14],
      damping: 2.5,
      gravityScale: 1.0
    });
    expect(getDynamicsToolPreset("ribbon").chain).toMatchObject({
      segmentLengths: [10],
      damping: 1.2,
      gravityScale: 0.8
    });
    expect(getDynamicsToolPreset("softCloth").chain).toMatchObject({
      segmentLengths: [18],
      damping: 4.0,
      gravityScale: 1.0
    });
    expect(getDynamicsToolPreset("rigidAccessory").chain).toMatchObject({
      segmentLengths: [6],
      damping: 8.0,
      gravityScale: 1.0
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

  it("emits new v3 diagnostics and never the retired v0 diagnostics", () => {
    const session = createDynamicsSession();
    const driverX = requireInitializedParameter(session, DRIVER_X);
    const outputSway = requireInitializedParameter(session, OUTPUT_SWAY);
    const baseDraft = createDynamicsGroupDraftFromSession(session);

    // Single-segment chain but output segmentIndex 3 → outputSegmentIndexOutOfRange; zero
    // input/output scale → warnings.
    const draft: DynamicsToolDraft = {
      ...baseDraft,
      inputs: [{ parameterId: DRIVER_X, kind: "angle", scale: 0 }],
      chain: { rootOffset: { x: 0, y: 0 }, segmentLengths: [14], damping: 2.5, gravityScale: 1 },
      outputs: [{ parameterId: OUTPUT_SWAY, segmentIndex: 3, scale: 0, limit: 20 }]
    };

    const codes = validateDynamicsToolDraft(session, draft).map((issue) => issue.code);

    expect(codes).toContain("dynamicsTool.outputSegmentIndexOutOfRange");
    expect(codes).toContain("dynamicsTool.zeroInputScale");
    expect(codes).toContain("dynamicsTool.outputScaleZero");

    // And an empty chain triggers chainSegmentsInvalid.
    const emptyChainDraft: DynamicsToolDraft = {
      ...baseDraft,
      chain: { rootOffset: { x: 0, y: 0 }, segmentLengths: [], damping: 2.5, gravityScale: 1 }
    };
    expect(
      validateDynamicsToolDraft(session, emptyChainDraft).map((issue) => issue.code)
    ).toContain("dynamicsTool.chainSegmentsInvalid");

    // Retired v0 diagnostics must not appear.
    const retired = [
      "dynamicsTool.normalizationInvalid",
      "dynamicsTool.pendulumCardinalityInvalid",
      "dynamicsTool.pendulumLengthInvalid",
      "dynamicsTool.pendulumCoefficientInvalid",
      "dynamicsTool.pendulumCoefficientExtreme",
      "dynamicsTool.outputCardinalityInvalid",
      "dynamicsTool.outputStrengthZero",
      "dynamicsTool.inputInfluenceZero"
    ];
    for (const code of retired) {
      expect(codes).not.toContain(code);
    }

    void driverX;
    void outputSway;
  });

  it("warns on unstable chain settings using the §7 revised basis", () => {
    const session = createDynamicsSession();
    const draft: DynamicsToolDraft = {
      ...createDynamicsGroupDraftFromSession(session),
      inputs: [createDefaultDynamicsInput(requireInitializedParameter(session, DRIVER_X))],
      chain: { rootOffset: { x: 0, y: 0 }, segmentLengths: [14], damping: 80, gravityScale: 1 },
      outputs: [createDefaultDynamicsOutput(requireInitializedParameter(session, OUTPUT_SWAY))]
    };

    const codes = validateDynamicsToolDraft(session, draft).map((issue) => issue.code);
    expect(codes).toContain("dynamicsTool.unstableSettings");
  });

  it("blocks duplicate output ownership across groups", () => {
    const session = createDynamicsSession();
    const driverX = requireInitializedParameter(session, DRIVER_X);
    const outputSway = requireInitializedParameter(session, OUTPUT_SWAY);
    session.graph.dynamicsGroups.push({
      dynamicsGroupId: DynamicsGroupIdSchema.parse("dyn_existing_output"),
      displayName: "Existing Output",
      enabled: true,
      presetId: "hair",
      inputs: [createDefaultDynamicsInput(driverX)],
      chain: getDynamicsToolPreset("hair").chain,
      outputs: [createDefaultDynamicsOutput(outputSway)]
    });

    const draft: DynamicsToolDraft = {
      ...createDynamicsGroupDraftFromSession(session),
      inputs: [createDefaultDynamicsInput(driverX)],
      outputs: [createDefaultDynamicsOutput(outputSway)]
    };

    const codes = validateDynamicsToolDraft(session, draft).map((issue) => issue.code);
    expect(codes).toContain("dynamicsTool.outputOwnershipDuplicate");
  });

  it("uses non-driver defaults, local driver values, and additive anchor-based output offset", () => {
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
    // Reset so the chain hangs straight down under the current φ = 30°.
    state = resetDynamicsToolPreviewSimulation(session, state, GROUP_ID);

    const evaluation = createDynamicsToolPreviewEvaluation(session, state);

    expect(evaluation.parameterValues[DRIVER_X]).toBe(30);
    expect(evaluation.parameterValues[NON_DRIVER]).toBe(0.25);
    expect(evaluation.anchor.phiDeg).toBe(30);
    expect(evaluation.output?.thetaLocalDeg ?? 0).toBeCloseTo(-30, 6);
    // Output scale is rounded to 6 dp (1/30 → 0.033333), so the offset lands within ~1e-4 of −1.
    expect(evaluation.output?.offset ?? 0).toBeCloseTo(EXPECTED_REST_OFFSET_AT_30DEG, 3);
    expect(evaluation.output?.effectiveValue ?? 0).toBeCloseTo(EXPECTED_REST_OFFSET_AT_30DEG, 3);
    expect(evaluation.parameterValues[OUTPUT_SWAY]).toBeCloseTo(EXPECTED_REST_OFFSET_AT_30DEG, 3);
  });

  it("advances preview simulation across frames using elapsed time and moves the tip particle", () => {
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
    // Gravity has begun pulling the free particle: its position changes between frames.
    const firstParticle = first.simulationStatesByGroupId[GROUP_ID]?.particles[0];
    const secondParticle = second.simulationStatesByGroupId[GROUP_ID]?.particles[0];
    expect(secondParticle?.y).not.toBe(firstParticle?.y);
  });

  it("matches runtime-core stepDynamics for a representative preview step", () => {
    const session = createDynamicsSession();
    const group = createDynamicsGroup();
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
    const previousState = state.simulationStatesByGroupId[GROUP_ID];
    const advanced = advanceDynamicsToolPreviewSimulation(session, state, {
      dynamicsGroupId: GROUP_ID,
      dtMs: 16.6666667
    });
    const expected = stepDynamics({
      definition: group as NormalizedDynamicsGroup,
      previousState,
      inputValues: {
        [DRIVER_X]: 30
      },
      parameterDefaults: {
        [DRIVER_X]: 0
      },
      resetApplied: false,
      dtMs: 16.6666667
    });

    expect(advanced.simulationStatesByGroupId[GROUP_ID]).toEqual(expected.state);
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
    expect(afterDriverChange.simulationStatesByGroupId[GROUP_ID]?.tick).toBe(2);
    // With the driver flipped to −30°, the pin (and therefore the root particle) swings to the
    // opposite side of the head frame: the anchor evaluation reflects φ = −30°.
    const evaluation = createDynamicsToolPreviewEvaluation(session, afterDriverChange);
    expect(evaluation.anchor.phiDeg).toBe(-30);
  });

  it("keeps moving after driver input stops and settles toward straight-down", () => {
    const session = createDynamicsSession();
    const group = createDynamicsGroup();
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
    for (let index = 0; index < 240; index += 1) {
      settled = advanceDynamicsToolPreviewSimulation(session, settled, {
        dynamicsGroupId: GROUP_ID,
        dtMs: 16.6666667
      });
    }

    const firstState = first.simulationStatesByGroupId[GROUP_ID];
    const settledState = settled.simulationStatesByGroupId[GROUP_ID];
    expect(firstState?.tick).toBe(1);
    expect(settledState?.tick).toBe(241);

    // Particle speed (|x − px|) shrinks as the chain settles.
    const speed = (s: typeof settledState) => {
      const particle = s?.particles[0];
      return particle === undefined ? 0 : Math.hypot(particle.x - particle.px, particle.y - particle.py);
    };
    expect(speed(settledState)).toBeLessThan(speed(firstState));

    // Settled straight-down: the root particle sits directly below the pin, so its x matches the
    // pin x. pin = R(30°)·(5,0) → x = 5·cos30° ≈ 4.330.
    const pinX = 5 * Math.cos((30 * Math.PI) / 180);
    expect(settledState?.particles[0]?.x ?? 999).toBeCloseTo(pinX, 1);
  });

  it("uses session-local definition overrides for immediate Quick Tune preview", () => {
    const session = createDynamicsSession();
    const group = createDynamicsGroup();
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
    state = resetDynamicsToolPreviewSimulation(session, state, GROUP_ID);

    // Double the output scale via a definition override: offset magnitude doubles (−1 → −2),
    // still within the ±20 limit.
    const tuned = setDynamicsToolPreviewDefinitionOverride(session, state, {
      dynamicsGroupId: GROUP_ID,
      definition: {
        ...group,
        outputs: [
          {
            ...group.outputs[0]!,
            scale: group.outputs[0]!.scale * 2
          }
        ]
      }
    });

    expect(createDynamicsToolPreviewEvaluation(session, tuned).output?.offset ?? 0).toBeCloseTo(
      EXPECTED_REST_OFFSET_AT_30DEG * 2,
      3
    );

    const cleared = clearDynamicsToolPreviewDefinitionOverride(tuned, GROUP_ID);
    expect(createDynamicsToolPreviewEvaluation(session, cleared).output?.offset ?? 0).toBeCloseTo(
      EXPECTED_REST_OFFSET_AT_30DEG,
      3
    );
  });

  it("resets only the session-local simulation state", () => {
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
      value: 20
    });
    // Advance a few frames so particle velocity is non-zero, then reset.
    for (let index = 0; index < 5; index += 1) {
      state = advanceDynamicsToolPreviewSimulation(session, state, {
        dynamicsGroupId: GROUP_ID,
        dtMs: 16.6666667
      });
    }

    const reset = resetDynamicsToolPreviewSimulation(session, state, GROUP_ID);

    expect(reset.driverValuesByGroupId[GROUP_ID]?.[DRIVER_X]).toBe(20);
    const resetState = reset.simulationStatesByGroupId[GROUP_ID];
    expect(resetState?.tick).toBe(0);
    // §3.4 reset aligns particles straight down with zero velocity (x === px, y === py).
    for (const particle of resetState?.particles ?? []) {
      expect(particle.x).toBe(particle.px);
      expect(particle.y).toBe(particle.py);
    }
    expect(reset.resetSerial).toBe(1);
  });

  it("skips same-value preview driver updates without advancing the simulation", () => {
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
      value: 20
    });
    const advanced = advanceDynamicsToolPreviewSimulation(session, state, {
      dynamicsGroupId: GROUP_ID,
      dtMs: 16.6666667
    });
    const beforeTick = advanced.simulationStatesByGroupId[GROUP_ID]?.tick;

    const same = setDynamicsToolPreviewDriverValue(session, advanced, {
      dynamicsGroupId: GROUP_ID,
      parameterId: DRIVER_X,
      value: 20
    });

    expect(same).toBe(advanced);
    expect(same.simulationStatesByGroupId[GROUP_ID]?.tick).toBe(beforeTick);
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

function createDynamicsGroup(): DynamicsToolGroup {
  return {
    dynamicsGroupId: GROUP_ID,
    displayName: "Model Sway",
    enabled: true,
    presetId: "hair",
    inputs: [
      {
        parameterId: DRIVER_X,
        kind: "angle" as const,
        scale: 1
      }
    ],
    // rootOffset != 0 gives the head rotation a lever arm (§3.6): angle input swings the pin on an
    // arc and excites the chain. With rootOffset 0 the pin sits at the rotation center and angle
    // input alone produces no particle motion (only the output θ_local shifts).
    chain: {
      rootOffset: { x: 5, y: 0 },
      segmentLengths: [14],
      damping: 2.5,
      gravityScale: 1.0
    },
    outputs: [
      {
        parameterId: OUTPUT_SWAY,
        segmentIndex: 1,
        scale: Number((1 / 30).toFixed(6)),
        limit: 20
      }
    ]
  };
}
