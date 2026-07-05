import {
  DynamicsGroupIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  type ParameterId,
  type RuntimeDynamicsGroupState
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import {
  computeDynamicsOutputOffsetsWithAnchor,
  computeDynamicsSourceSample,
  computeSegmentThetaWorldDeg,
  createResetDynamicsState,
  stepDynamics,
  type DynamicsAnchorPose
} from "./dynamics-evaluation.js";
import type {
  NormalizedDynamicsChain,
  NormalizedDynamicsGroup,
  NormalizedDynamicsInput,
  NormalizedDynamicsOutput,
  NormalizedParameter,
  NormalizedRuntimeGraph
} from "./normalized-runtime-graph.js";

// World-frame Verlet chain physics validation. The spec is fixed in
// discussion/design/dynamics-world-frame-chain.md §3; the numeric expectations below are derived
// independently from the spec formulae (not copied from the implementation).

const GRAVITY_G0 = 980;

const packageId = PackageIdSchema.parse("pkg_runtime_dynamics");
const driverParameterId = ParameterIdSchema.parse("param_face_yaw");
const driverXParameterId = ParameterIdSchema.parse("param_face_x");
const outputParameterId = ParameterIdSchema.parse("param_hair_sway");
const outputTipParameterId = ParameterIdSchema.parse("param_hair_sway_tip");
const dynamicsGroupId = DynamicsGroupIdSchema.parse("dyn_hair_sway");

interface FixtureOptions {
  readonly inputs?: readonly NormalizedDynamicsInput[];
  readonly chain?: Partial<NormalizedDynamicsChain>;
  readonly outputs?: readonly NormalizedDynamicsOutput[];
}

const createFixture = (options: FixtureOptions = {}) => {
  const inputs: readonly NormalizedDynamicsInput[] = options.inputs ?? [
    { parameterId: driverParameterId, kind: "angle", scale: 1 }
  ];
  const chain: NormalizedDynamicsChain = {
    rootOffset: { x: 0, y: 0 },
    segmentLengths: [14],
    damping: 0,
    gravityScale: 1,
    ...options.chain
  };
  const outputs: readonly NormalizedDynamicsOutput[] = options.outputs ?? [
    { parameterId: outputParameterId, segmentIndex: 1, scale: 1, limit: 360 }
  ];

  const group: NormalizedDynamicsGroup = {
    dynamicsGroupId,
    displayName: "Hair Sway",
    enabled: true,
    inputs,
    chain,
    outputs
  };

  const parameterEntries: [ParameterId, NormalizedParameter][] = [
    [driverParameterId, makeParameter(driverParameterId, "Face Yaw", "face")],
    [driverXParameterId, makeParameter(driverXParameterId, "Face X", "face")],
    [outputParameterId, makeParameter(outputParameterId, "Hair Sway", "dynamics")],
    [outputTipParameterId, makeParameter(outputTipParameterId, "Hair Sway Tip", "dynamics")]
  ];

  const graph: NormalizedRuntimeGraph = {
    packageId,
    packageRevision: 0,
    coordinateSystem: "canvas-y-down-v1",
    parameters: new Map(parameterEntries),
    dynamicsGroups: new Map([[dynamicsGroupId, group]]),
    drawables: new Map(),
    rigControls: new Map(),
    keyformBindings: [],
    masks: [],
    drawOrder: [],
    disabledFutureLayers: []
  };

  return { graph, group };
};

const makeParameter = (
  id: string,
  displayName: string,
  semanticRole: NonNullable<NormalizedParameter["semanticRole"]>
): NormalizedParameter => ({
  id: ParameterIdSchema.parse(id),
  displayName,
  semanticRole,
  valueSource: "authoredInput",
  min: -1000,
  max: 1000,
  default: 0
});

// Drives the solver directly with a fixed dt for a number of steps, holding the given input values.
const runHeldInput = (
  fixture: ReturnType<typeof createFixture>,
  inputValues: Readonly<Record<string, number>>,
  steps: number,
  dtMs: number,
  initialState?: RuntimeDynamicsGroupState
): { state: RuntimeDynamicsGroupState; anchor: DynamicsAnchorPose } => {
  const source = computeDynamicsSourceSample(fixture.graph, fixture.group, inputValues);
  const parameterDefaults = Object.fromEntries(
    fixture.group.inputs.map((input) => [input.parameterId, fixture.graph.parameters.get(input.parameterId)?.default ?? 0])
  );
  let state =
    initialState ?? createResetDynamicsState(fixture.group, source.anchor, 0, true);
  for (let step = 0; step < steps; step += 1) {
    state = stepDynamics({
      definition: fixture.group,
      previousState: state,
      inputValues: source.inputValues,
      parameterDefaults,
      dtMs,
      resetApplied: false
    }).state;
  }
  return { state, anchor: source.anchor };
};

const outputThetaLocalDeg = (
  fixture: ReturnType<typeof createFixture>,
  state: RuntimeDynamicsGroupState,
  anchor: DynamicsAnchorPose,
  outputIndex = 0
): number => {
  const offsets = computeDynamicsOutputOffsetsWithAnchor(fixture.group, state, anchor);
  return offsets[outputIndex]?.thetaLocalDeg ?? Number.NaN;
};

describe("world-frame chain equilibrium (§3.6, symptom fix)", () => {
  it("converges to θ_local = −φ when an angle input is held (angle → head-frame reverse)", () => {
    const phiDeg = 30;
    const fixture = createFixture({ chain: { damping: 4 } });
    const { state, anchor } = runHeldInput(fixture, { [driverParameterId]: phiDeg }, 4000, 16.6666667);
    // World chain settles straight down (θ_world → 0), so θ_local = θ_world − φ → −φ.
    expect(outputThetaLocalDeg(fixture, state, anchor)).toBeCloseTo(-phiDeg, 2);
  });

  it("converges to θ_local = 0 when a positionX input is held (translation → zero steady output)", () => {
    const fixture = createFixture({
      inputs: [{ parameterId: driverXParameterId, kind: "positionX", scale: 3 }],
      chain: { damping: 4 }
    });
    const { state, anchor } = runHeldInput(fixture, { [driverXParameterId]: 5 }, 4000, 16.6666667);
    // φ = 0 for translation; the chain hangs straight down under the (moved) pin → θ_world = 0 → θ_local = 0.
    expect(outputThetaLocalDeg(fixture, state, anchor)).toBeCloseTo(0, 2);
  });

  it("converges to θ_local = 0 when a positionY input is held", () => {
    const fixture = createFixture({
      inputs: [{ parameterId: driverXParameterId, kind: "positionY", scale: 2 }],
      chain: { damping: 4 }
    });
    const { state, anchor } = runHeldInput(fixture, { [driverXParameterId]: 3 }, 4000, 16.6666667);
    expect(outputThetaLocalDeg(fixture, state, anchor)).toBeCloseTo(0, 2);
  });

  it("converges to θ_local = −φ under a combined angle + translation input (φ dominates steady state)", () => {
    const phiDeg = 20;
    const fixture = createFixture({
      inputs: [
        { parameterId: driverParameterId, kind: "angle", scale: 1 },
        { parameterId: driverXParameterId, kind: "positionX", scale: 3 }
      ],
      chain: { damping: 4 }
    });
    const { state, anchor } = runHeldInput(
      fixture,
      { [driverParameterId]: phiDeg, [driverXParameterId]: 4 },
      4000,
      16.6666667
    );
    expect(outputThetaLocalDeg(fixture, state, anchor)).toBeCloseTo(-phiDeg, 2);
  });

  it("makes kind meaningful: angle steady state (−φ) differs from translation steady state (0)", () => {
    const phiDeg = 25;
    const angleFixture = createFixture({ chain: { damping: 4 } });
    const angleRun = runHeldInput(angleFixture, { [driverParameterId]: phiDeg }, 4000, 16.6666667);
    const angleTheta = outputThetaLocalDeg(angleFixture, angleRun.state, angleRun.anchor);

    const translationFixture = createFixture({
      inputs: [{ parameterId: driverXParameterId, kind: "positionX", scale: 3 }],
      chain: { damping: 4 }
    });
    const translationRun = runHeldInput(translationFixture, { [driverXParameterId]: phiDeg }, 4000, 16.6666667);
    const translationTheta = outputThetaLocalDeg(translationFixture, translationRun.state, translationRun.anchor);

    expect(angleTheta).toBeCloseTo(-phiDeg, 2);
    expect(translationTheta).toBeCloseTo(0, 2);
    expect(Math.abs(angleTheta - translationTheta)).toBeGreaterThan(1);
  });
});

describe("world-frame chain pendulum period (√ law)", () => {
  // Measure the full period of a single-segment pendulum released from a small angular displacement
  // with zero damping, and compare against the analytic small-angle period 2π√(L/(g0·gravityScale)).
  const measureFullPeriodSeconds = (
    segmentLength: number,
    gravityScale: number,
    initialAngleRad: number
  ): number => {
    const dtMs = 1; // 1 ms sub-step for integration accuracy
    const dt = dtMs / 1000;
    const pin = { x: 0, y: 0 };
    const fixture = createFixture({ chain: { segmentLengths: [segmentLength], damping: 0, gravityScale } });
    // Initial state: displace the single particle by initialAngleRad from straight down.
    const startX = segmentLength * Math.sin(initialAngleRad);
    const startY = segmentLength * Math.cos(initialAngleRad);
    let state: RuntimeDynamicsGroupState = {
      particles: [{ x: startX, y: startY, px: startX, py: startY }],
      tick: 0,
      resetCounter: 1
    };
    const anchor: DynamicsAnchorPose = { phiDeg: 0, pin };
    const parameterDefaults = { [driverParameterId]: 0 };

    const downwardCrossings: number[] = [];
    let previousX = state.particles[0]?.x ?? 0;
    let elapsed = 0;
    for (let step = 0; step < 400_000 && downwardCrossings.length < 6; step += 1) {
      state = stepDynamics({
        definition: fixture.group,
        previousState: state,
        inputValues: { [driverParameterId]: 0 },
        parameterDefaults,
        dtMs,
        resetApplied: false
      }).state;
      elapsed += dt;
      const x = state.particles[0]?.x ?? 0;
      if (previousX > 0 && x <= 0) {
        downwardCrossings.push(elapsed);
      }
      previousX = x;
    }

    expect(downwardCrossings.length).toBeGreaterThanOrEqual(3);
    let periodSum = 0;
    for (let index = 1; index < downwardCrossings.length; index += 1) {
      periodSum += (downwardCrossings[index] ?? 0) - (downwardCrossings[index - 1] ?? 0);
    }
    return periodSum / (downwardCrossings.length - 1);
  };

  it("matches 2π√(L/(g0·gravityScale)) within a few percent", () => {
    const segmentLength = 14;
    const gravityScale = 1;
    const expected = 2 * Math.PI * Math.sqrt(segmentLength / (GRAVITY_G0 * gravityScale));
    const measured = measureFullPeriodSeconds(segmentLength, gravityScale, 0.03);
    // 0.03 rad initial angle keeps the small-angle approximation valid; ±3% tolerance covers the
    // finite integration step and the (tiny) large-angle correction.
    expect(measured).toBeGreaterThan(expected * 0.97);
    expect(measured).toBeLessThan(expected * 1.03);
  });

  it("follows the √ law when gravityScale changes (×4 gravity → ×0.5 period)", () => {
    const segmentLength = 14;
    const basePeriod = measureFullPeriodSeconds(segmentLength, 1, 0.03);
    const fasterPeriod = measureFullPeriodSeconds(segmentLength, 4, 0.03);
    // T ∝ 1/√gravityScale, so quadrupling gravity halves the period.
    expect(fasterPeriod / basePeriod).toBeGreaterThan(0.48);
    expect(fasterPeriod / basePeriod).toBeLessThan(0.52);
  });
});

describe("world-frame chain damping and stability", () => {
  it("monotonically shrinks the oscillation envelope when damping > 0", () => {
    const fixture = createFixture({ chain: { segmentLengths: [14], damping: 3, gravityScale: 1 } });
    const pin = { x: 0, y: 0 };
    const anchor: DynamicsAnchorPose = { phiDeg: 0, pin };
    const parameterDefaults = { [driverParameterId]: 0 };
    const initialAngle = 0.3;
    let state: RuntimeDynamicsGroupState = {
      particles: [
        {
          x: 14 * Math.sin(initialAngle),
          y: 14 * Math.cos(initialAngle),
          px: 14 * Math.sin(initialAngle),
          py: 14 * Math.cos(initialAngle)
        }
      ],
      tick: 0,
      resetCounter: 1
    };
    const dtMs = 2;

    // Track successive local maxima of |x|; the envelope must be non-increasing.
    const peaks: number[] = [];
    let previousX = state.particles[0]?.x ?? 0;
    let previousSlopePositive = true;
    for (let step = 0; step < 40_000; step += 1) {
      state = stepDynamics({
        definition: fixture.group,
        previousState: state,
        inputValues: { [driverParameterId]: 0 },
        parameterDefaults,
        dtMs,
        resetApplied: false
      }).state;
      const x = state.particles[0]?.x ?? 0;
      const slopePositive = x > previousX;
      if (previousSlopePositive && !slopePositive) {
        peaks.push(Math.abs(previousX));
      }
      previousSlopePositive = slopePositive;
      previousX = x;
    }

    expect(peaks.length).toBeGreaterThanOrEqual(3);
    for (let index = 1; index < peaks.length; index += 1) {
      expect(peaks[index] ?? 0).toBeLessThanOrEqual((peaks[index - 1] ?? 0) + 1e-6);
    }
  });

  it("does not diverge with damping = 0 (Verlet + rigid constraint stays bounded)", () => {
    const fixture = createFixture({ chain: { segmentLengths: [14], damping: 0, gravityScale: 1 } });
    const pin = { x: 0, y: 0 };
    const parameterDefaults = { [driverParameterId]: 0 };
    const initialAngle = 0.4;
    let state: RuntimeDynamicsGroupState = {
      particles: [
        {
          x: 14 * Math.sin(initialAngle),
          y: 14 * Math.cos(initialAngle),
          px: 14 * Math.sin(initialAngle),
          py: 14 * Math.cos(initialAngle)
        }
      ],
      tick: 0,
      resetCounter: 1
    };
    let maxRadius = 0;
    for (let step = 0; step < 60_000; step += 1) {
      state = stepDynamics({
        definition: fixture.group,
        previousState: state,
        inputValues: { [driverParameterId]: 0 },
        parameterDefaults,
        dtMs: 16.6666667,
        resetApplied: false
      }).state;
      const particle = state.particles[0];
      if (particle !== undefined) {
        maxRadius = Math.max(maxRadius, Math.hypot(particle.x - pin.x, particle.y - pin.y));
      }
    }
    // The rigid constraint pins the radius to L; energy cannot accumulate without bound.
    expect(maxRadius).toBeLessThan(14 + 0.01);
  });
});

describe("world-frame chain constraint rigidity (§3.3 projection)", () => {
  it("keeps every segment length equal to L_i at every step", () => {
    const segmentLengths = [10, 8, 6];
    const fixture = createFixture({ chain: { segmentLengths, damping: 1, gravityScale: 1 } });
    const source = computeDynamicsSourceSample(fixture.graph, fixture.group, { [driverParameterId]: 15 });
    const parameterDefaults = { [driverParameterId]: 0 };
    let state = createResetDynamicsState(fixture.group, source.anchor, 0, true);

    for (let step = 0; step < 200; step += 1) {
      state = stepDynamics({
        definition: fixture.group,
        previousState: state,
        inputValues: source.inputValues,
        parameterDefaults,
        dtMs: 16.6666667,
        resetApplied: false
      }).state;

      let parentX = source.anchor.pin.x;
      let parentY = source.anchor.pin.y;
      state.particles.forEach((particle, index) => {
        const length = Math.hypot(particle.x - parentX, particle.y - parentY);
        expect(length).toBeCloseTo(segmentLengths[index] ?? 0, 6);
        parentX = particle.x;
        parentY = particle.y;
      });
    }
  });
});

describe("world-frame chain multi-segment output routing (segmentIndex)", () => {
  it("returns independent angles for segmentIndex 1 and 2 (N = 2)", () => {
    const phiDeg = 15;
    const fixture = createFixture({
      chain: { segmentLengths: [12, 9], damping: 4, gravityScale: 1 },
      outputs: [
        { parameterId: outputParameterId, segmentIndex: 1, scale: 1, limit: 360 },
        { parameterId: outputTipParameterId, segmentIndex: 2, scale: 1, limit: 360 }
      ]
    });
    const { state, anchor } = runHeldInput(fixture, { [driverParameterId]: phiDeg }, 6000, 16.6666667);
    const offsets = computeDynamicsOutputOffsetsWithAnchor(fixture.group, state, anchor);

    // Both segments settle straight down in the world frame → θ_local = −φ for each.
    expect(offsets[0]?.segmentIndex).toBe(1);
    expect(offsets[1]?.segmentIndex).toBe(2);
    expect(offsets[0]?.thetaLocalDeg).toBeCloseTo(-phiDeg, 1);
    expect(offsets[1]?.thetaLocalDeg).toBeCloseTo(-phiDeg, 1);
    expect(offsets[0]?.outputParameterId).toBe(outputParameterId);
    expect(offsets[1]?.outputParameterId).toBe(outputTipParameterId);
  });

  it("reads the second segment angle relative to the first particle, not the pin", () => {
    // Construct a bent chain by hand: segment 1 straight down, segment 2 kicked to +x.
    const fixture = createFixture({ chain: { segmentLengths: [10, 10] } });
    const pin = { x: 0, y: 0 };
    const particles = [
      { x: 0, y: 10, px: 0, py: 10 },
      { x: 10, y: 10, px: 10, py: 10 }
    ];
    const thetaSeg1 = computeSegmentThetaWorldDeg(fixture.group, particles, 1, pin);
    const thetaSeg2 = computeSegmentThetaWorldDeg(fixture.group, particles, 2, pin);
    // Segment 1 points straight down → 0°. Segment 2 points along +x from particle 1 → atan2(10,0)=90°.
    expect(thetaSeg1).toBeCloseTo(0, 6);
    expect(thetaSeg2).toBeCloseTo(90, 6);
  });
});

describe("world-frame chain output clamping and limit", () => {
  it("clamps rawOffset to ±limit", () => {
    const fixture = createFixture({
      chain: { damping: 4 },
      outputs: [{ parameterId: outputParameterId, segmentIndex: 1, scale: 1, limit: 10 }]
    });
    const { state, anchor } = runHeldInput(fixture, { [driverParameterId]: 45 }, 4000, 16.6666667);
    const offset = computeDynamicsOutputOffsetsWithAnchor(fixture.group, state, anchor)[0];
    // θ_local ≈ −45, scale 1 → rawOffset ≈ −45, clamped to −10.
    expect(offset?.rawOffset).toBeCloseTo(-45, 0);
    expect(offset?.offset).toBeCloseTo(-10, 6);
    expect(offset?.outputClamped).toBe(true);
  });

  it("applies output scale to convert degrees to parameter units", () => {
    const fixture = createFixture({
      chain: { damping: 4 },
      outputs: [{ parameterId: outputParameterId, segmentIndex: 1, scale: 0.5, limit: 360 }]
    });
    const { state, anchor } = runHeldInput(fixture, { [driverParameterId]: 20 }, 4000, 16.6666667);
    const offset = computeDynamicsOutputOffsetsWithAnchor(fixture.group, state, anchor)[0];
    // θ_local ≈ −20 deg, scale 0.5 → offset ≈ −10.
    expect(offset?.offset).toBeCloseTo(-10, 1);
  });
});

describe("world-frame chain reset and determinism", () => {
  it("aligns particles straight below the pin with zero velocity on reset (§3.4)", () => {
    const fixture = createFixture({ chain: { segmentLengths: [10, 8], rootOffset: { x: 0, y: 0 } } });
    const source = computeDynamicsSourceSample(fixture.graph, fixture.group, { [driverParameterId]: 0 });
    const state = createResetDynamicsState(fixture.group, source.anchor, 0, true);
    expect(state.particles).toEqual([
      { x: 0, y: 10, px: 0, py: 10 },
      { x: 0, y: 18, px: 0, py: 18 }
    ]);
    expect(state.tick).toBe(0);
    expect(state.resetCounter).toBe(1);
  });

  it("holds the state when dt = 0", () => {
    const fixture = createFixture();
    const source = computeDynamicsSourceSample(fixture.graph, fixture.group, { [driverParameterId]: 0 });
    const initial = createResetDynamicsState(fixture.group, source.anchor, 0, true);
    const result = stepDynamics({
      definition: fixture.group,
      previousState: initial,
      inputValues: source.inputValues,
      parameterDefaults: { [driverParameterId]: 0 },
      dtMs: 0,
      resetApplied: false
    });
    expect(result.state).toEqual(initial);
  });

  it("produces identical results for two runs of the same input (determinism)", () => {
    const runOnce = () => {
      const fixture = createFixture({ chain: { damping: 2 } });
      return runHeldInput(fixture, { [driverParameterId]: 30 }, 300, 16.6666667).state;
    };
    expect(runOnce()).toEqual(runOnce());
  });
});
