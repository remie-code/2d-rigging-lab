import type {
  DynamicsGroupId,
  ParameterId,
  RuntimeDynamicsGroupState,
  RuntimeDynamicsParticle,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";

import type {
  NormalizedDynamicsGroup,
  NormalizedRuntimeGraph
} from "./normalized-runtime-graph.js";

// dynamics v1: world-frame Verlet chain. The full physics specification is fixed in
// discussion/design/dynamics-world-frame-chain.md §3; the code here is a direct transcription
// of that spec (do not re-interpret the formulae).

// §3.1 constants.
const GRAVITY_G0 = 980; // cm/s²
const MAX_STABLE_STEP_MS = 100;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Anchor pose (§3.2). φ [deg] is the total rotation of the head frame, P is the world-space pin
 * position (chain root x_0). Both are derived directly from the current parameter values.
 */
export interface DynamicsAnchorPose {
  readonly phiDeg: number;
  readonly pin: Vec2Dto;
}

export interface DynamicsSourceSample {
  readonly inputValues: Readonly<Record<ParameterId, number>>;
  readonly anchor: DynamicsAnchorPose;
}

export interface DynamicsOutputOffset {
  readonly outputParameterId: ParameterId;
  readonly segmentIndex: number;
  readonly thetaLocalDeg: number;
  readonly rawOffset: number;
  readonly offset: number;
  readonly outputClamped: boolean;
}

export interface StepDynamicsInput {
  readonly definition: NormalizedDynamicsGroup;
  readonly previousState: RuntimeDynamicsGroupState | undefined;
  readonly inputValues: Readonly<Record<ParameterId, number>>;
  readonly parameterDefaults: Readonly<Record<ParameterId, number>>;
  readonly dtMs: number;
  readonly resetApplied: boolean;
}

export interface StepDynamicsResult {
  readonly state: RuntimeDynamicsGroupState;
  readonly source: DynamicsSourceSample;
  readonly outputOffsets: readonly DynamicsOutputOffset[];
}

export interface AdvanceDynamicsGroupStateInput {
  readonly graph: NormalizedRuntimeGraph;
  readonly group: NormalizedDynamicsGroup;
  readonly previousState: RuntimeDynamicsGroupState | undefined;
  readonly authoredParameterValues: Readonly<Record<string, number>>;
  readonly fixedStepMs: number;
  readonly subSteps: number;
  readonly resetApplied: boolean;
}

export interface AdvancedDynamicsGroupState {
  readonly dynamicsGroupId: DynamicsGroupId;
  readonly state: RuntimeDynamicsGroupState;
  readonly source: DynamicsSourceSample;
  readonly outputOffsets: readonly DynamicsOutputOffset[];
}

// --- §3.2 anchor pose -------------------------------------------------------

const createParameterDefaults = (
  graph: NormalizedRuntimeGraph,
  group: NormalizedDynamicsGroup
): Readonly<Record<ParameterId, number>> =>
  Object.fromEntries(
    group.inputs.map((dynamicsInput) => [
      dynamicsInput.parameterId,
      graph.parameters.get(dynamicsInput.parameterId)?.default ?? 0
    ])
  ) as Readonly<Record<ParameterId, number>>;

const createDynamicsInputValues = (
  graph: NormalizedRuntimeGraph,
  group: NormalizedDynamicsGroup,
  authoredParameterValues: Readonly<Record<string, number>>
): Readonly<Record<ParameterId, number>> =>
  Object.fromEntries(
    group.inputs.map((dynamicsInput) => {
      const parameterDefault = graph.parameters.get(dynamicsInput.parameterId)?.default ?? 0;
      return [dynamicsInput.parameterId, authoredParameterValues[dynamicsInput.parameterId] ?? parameterDefault];
    })
  ) as Readonly<Record<ParameterId, number>>;

/**
 * §3.2: φ_deg = Σ_{kind=angle} (v_i − d_i)·scale_i ; T = (Σ_x, Σ_y) ;
 *        P = T + R(φ)·r0 with R(φ) = [[cosφ, −sinφ], [sinφ, cosφ]].
 */
const computeAnchorPose = (
  group: NormalizedDynamicsGroup,
  inputValues: Readonly<Record<ParameterId, number>>,
  parameterDefaults: Readonly<Record<ParameterId, number>>
): DynamicsAnchorPose => {
  let phiDeg = 0;
  let translationX = 0;
  let translationY = 0;

  for (const dynamicsInput of group.inputs) {
    const value = inputValues[dynamicsInput.parameterId] ?? parameterDefaults[dynamicsInput.parameterId] ?? 0;
    const rest = parameterDefaults[dynamicsInput.parameterId] ?? 0;
    const contribution = (value - rest) * dynamicsInput.scale;

    if (dynamicsInput.kind === "angle") {
      phiDeg += contribution;
    } else if (dynamicsInput.kind === "positionX") {
      translationX += contribution;
    } else {
      translationY += contribution;
    }
  }

  const phiRad = phiDeg * DEG_TO_RAD;
  const cos = Math.cos(phiRad);
  const sin = Math.sin(phiRad);
  const { x: r0x, y: r0y } = group.chain.rootOffset;
  const pin: Vec2Dto = {
    x: translationX + (cos * r0x - sin * r0y),
    y: translationY + (sin * r0x + cos * r0y)
  };

  return { phiDeg, pin };
};

const computeDynamicsSourceFromInputValues = (
  group: NormalizedDynamicsGroup,
  inputValues: Readonly<Record<ParameterId, number>>,
  parameterDefaults: Readonly<Record<ParameterId, number>>
): DynamicsSourceSample => ({
  inputValues,
  anchor: computeAnchorPose(group, inputValues, parameterDefaults)
});

export const computeDynamicsSourceSample = (
  graph: NormalizedRuntimeGraph,
  group: NormalizedDynamicsGroup,
  authoredParameterValues: Readonly<Record<string, number>>
): DynamicsSourceSample => {
  const inputValues = createDynamicsInputValues(graph, group, authoredParameterValues);
  const parameterDefaults = createParameterDefaults(graph, group);
  return computeDynamicsSourceFromInputValues(group, inputValues, parameterDefaults);
};

// --- §3.4 reset / initial state --------------------------------------------

/**
 * §3.4: given the current anchor pin P, align every particle straight below with zero velocity:
 *   x_i = P + (0, Σ_{j≤i} L_j),  x̂_i = x_i.
 */
export const createResetDynamicsState = (
  group: NormalizedDynamicsGroup,
  anchor: DynamicsAnchorPose,
  previousResetCounter: number,
  resetApplied: boolean
): RuntimeDynamicsGroupState => {
  const particles: RuntimeDynamicsParticle[] = [];
  let cumulativeLength = 0;
  for (const length of group.chain.segmentLengths) {
    cumulativeLength += length;
    const position = { x: anchor.pin.x, y: anchor.pin.y + cumulativeLength };
    particles.push({ x: position.x, y: position.y, px: position.x, py: position.y });
  }

  return {
    particles,
    tick: 0,
    resetCounter: previousResetCounter + (resetApplied || previousResetCounter === 0 ? 1 : 0)
  };
};

export const createResetDynamicsStateFromGraph = (
  graph: NormalizedRuntimeGraph,
  group: NormalizedDynamicsGroup,
  authoredParameterValues: Readonly<Record<string, number>>,
  previousResetCounter: number,
  resetApplied: boolean
): RuntimeDynamicsGroupState => {
  const source = computeDynamicsSourceSample(graph, group, authoredParameterValues);
  return createResetDynamicsState(group, source.anchor, previousResetCounter, resetApplied);
};

// --- §3.3 Verlet integration + constraint projection -----------------------

const isStateShapeCompatible = (
  state: RuntimeDynamicsGroupState,
  group: NormalizedDynamicsGroup
): boolean => state.particles.length === group.chain.segmentLengths.length;

/**
 * §3.3: one fixed sub-step of Verlet integration followed by a single root→tip constraint
 * projection (only the child particle moves; degenerate direction falls straight down).
 */
const stepChain = (
  group: NormalizedDynamicsGroup,
  previousParticles: readonly RuntimeDynamicsParticle[],
  anchor: DynamicsAnchorPose,
  dtSeconds: number
): RuntimeDynamicsParticle[] => {
  const dampingFactor = Math.exp(-group.chain.damping * dtSeconds);
  const gravityStep = GRAVITY_G0 * group.chain.gravityScale * dtSeconds * dtSeconds;

  // Verlet integration (§3.3 step 2).
  const integrated: RuntimeDynamicsParticle[] = previousParticles.map((particle) => {
    const velocityX = (particle.x - particle.px) * dampingFactor;
    const velocityY = (particle.y - particle.py) * dampingFactor;
    return {
      // x̂_i ← x_i (updated-before position saved), then x_i ← x_i + v_i + gravity·dt².
      px: particle.x,
      py: particle.y,
      x: particle.x + velocityX,
      y: particle.y + velocityY + gravityStep
    };
  });

  // Constraint projection (§3.3 step 3): root→tip forward pass, children only.
  let previousX = anchor.pin.x;
  let previousY = anchor.pin.y;
  group.chain.segmentLengths.forEach((segmentLength, index) => {
    const particle = integrated[index];
    if (particle === undefined) {
      return;
    }

    let deltaX = particle.x - previousX;
    let deltaY = particle.y - previousY;
    let distance = Math.hypot(deltaX, deltaY);
    if (distance === 0) {
      // Degenerate: point straight down.
      deltaX = 0;
      deltaY = segmentLength;
      distance = segmentLength;
    }
    const scale = segmentLength / distance;
    const projectedX = previousX + deltaX * scale;
    const projectedY = previousY + deltaY * scale;
    integrated[index] = { ...particle, x: projectedX, y: projectedY };
    previousX = projectedX;
    previousY = projectedY;
  });

  return integrated;
};

export const stepDynamics = (input: StepDynamicsInput): StepDynamicsResult => {
  const source = computeDynamicsSourceFromInputValues(
    input.definition,
    input.inputValues,
    input.parameterDefaults
  );
  const dtSeconds = clamp(input.dtMs, 0, MAX_STABLE_STEP_MS) / 1000;

  const previousState =
    input.resetApplied || input.previousState === undefined || !isStateShapeCompatible(input.previousState, input.definition)
      ? createResetDynamicsState(
          input.definition,
          source.anchor,
          input.previousState?.resetCounter ?? 0,
          input.resetApplied
        )
      : input.previousState;

  // §3.4: dt = 0 or reset applied → hold the state.
  if (dtSeconds === 0 || input.resetApplied) {
    return {
      state: previousState,
      source,
      outputOffsets: computeDynamicsOutputOffsetsWithAnchor(input.definition, previousState, source.anchor)
    };
  }

  const particles = stepChain(input.definition, previousState.particles, source.anchor, dtSeconds);
  const state: RuntimeDynamicsGroupState = {
    particles,
    tick: previousState.tick + 1,
    resetCounter: previousState.resetCounter
  };

  return {
    state,
    source,
    outputOffsets: computeDynamicsOutputOffsetsWithAnchor(input.definition, state, source.anchor)
  };
};

export const advanceDynamicsGroupState = (
  input: AdvanceDynamicsGroupStateInput
): AdvancedDynamicsGroupState => {
  const inputValues = createDynamicsInputValues(input.graph, input.group, input.authoredParameterValues);
  const parameterDefaults = createParameterDefaults(input.graph, input.group);
  const initialSource = computeDynamicsSourceFromInputValues(input.group, inputValues, parameterDefaults);
  let state =
    input.resetApplied || input.previousState === undefined || !isStateShapeCompatible(input.previousState, input.group)
      ? createResetDynamicsState(
          input.group,
          initialSource.anchor,
          input.previousState?.resetCounter ?? 0,
          input.resetApplied
        )
      : input.previousState;
  let source = initialSource;
  let outputOffsets = computeDynamicsOutputOffsetsWithAnchor(input.group, state, initialSource.anchor);

  if (!input.resetApplied && input.subSteps > 0) {
    for (let stepIndex = 0; stepIndex < input.subSteps; stepIndex += 1) {
      const stepped = stepDynamics({
        definition: input.group,
        previousState: state,
        inputValues,
        parameterDefaults,
        dtMs: input.fixedStepMs,
        resetApplied: false
      });
      state = stepped.state;
      source = stepped.source;
      outputOffsets = stepped.outputOffsets;
    }
  }

  return {
    dynamicsGroupId: input.group.dynamicsGroupId,
    state,
    source,
    outputOffsets
  };
};

// --- §3.5 output mapping ----------------------------------------------------

/**
 * §3.5: for a segment s, d = x_s − x_{s−1}; θ_world = atan2(d.x, d.y) [deg] (0 = straight down,
 * +x side positive). x_0 = pin (kinematic).
 */
export const computeSegmentThetaWorldDeg = (
  group: NormalizedDynamicsGroup,
  particles: readonly RuntimeDynamicsParticle[],
  segmentIndex: number,
  pin: Vec2Dto
): number => {
  const childIndex = segmentIndex - 1;
  const child = particles[childIndex];
  if (child === undefined) {
    return 0;
  }
  const parent = childIndex === 0 ? pin : particles[childIndex - 1];
  if (parent === undefined) {
    return 0;
  }
  const deltaX = child.x - parent.x;
  const deltaY = child.y - parent.y;
  return Math.atan2(deltaX, deltaY) * RAD_TO_DEG;
};

/**
 * §3.5: θ_local = θ_world − φ_deg ; rawOffset = θ_local·scale ; offset = clamp(rawOffset, −limit, +limit).
 * The anchor (φ_deg, pin) is a pure function of the *current* inputs (§3.2) and is not stored in the
 * state, so callers must supply it. The pin (x_0) is kinematic and cannot be reconstructed from the
 * stored particles alone; the head-frame angle depends on φ, so an incorrect anchor would break the
 * equilibrium invariant θ_local = −φ.
 */
export const computeDynamicsOutputOffsetsWithAnchor = (
  group: NormalizedDynamicsGroup,
  state: RuntimeDynamicsGroupState,
  anchor: DynamicsAnchorPose
): readonly DynamicsOutputOffset[] =>
  group.outputs.map((output) => {
    const thetaWorldDeg = computeSegmentThetaWorldDeg(group, state.particles, output.segmentIndex, anchor.pin);
    const thetaLocalDeg = thetaWorldDeg - anchor.phiDeg;
    const rawOffset = thetaLocalDeg * output.scale;
    const limit = Math.abs(output.limit);
    const offset = clamp(rawOffset, -limit, limit);

    return {
      outputParameterId: output.parameterId,
      segmentIndex: output.segmentIndex,
      thetaLocalDeg,
      rawOffset,
      offset,
      outputClamped: offset !== rawOffset
    };
  });

/**
 * Graph-aware output offsets: derives the current anchor from the graph + authored parameter values
 * (§3.2) so θ_local is measured in the head frame. This is the correct entry point for callers that
 * own the graph and inputs (parameter resolution, evidence projection).
 */
export const computeDynamicsOutputOffsetsFromGraph = (
  graph: NormalizedRuntimeGraph,
  group: NormalizedDynamicsGroup,
  state: RuntimeDynamicsGroupState,
  authoredParameterValues: Readonly<Record<string, number>>
): readonly DynamicsOutputOffset[] => {
  const source = computeDynamicsSourceSample(graph, group, authoredParameterValues);
  return computeDynamicsOutputOffsetsWithAnchor(group, state, source.anchor);
};

export const getDynamicsOutputOffsetForParameter = (
  graph: NormalizedRuntimeGraph,
  group: NormalizedDynamicsGroup,
  state: RuntimeDynamicsGroupState | undefined,
  authoredParameterValues: Readonly<Record<string, number>>,
  parameterId: ParameterId
): DynamicsOutputOffset | undefined => {
  if (state === undefined) {
    return undefined;
  }

  return computeDynamicsOutputOffsetsFromGraph(graph, group, state, authoredParameterValues).find(
    (offset) => offset.outputParameterId === parameterId
  );
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
