import { type AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DynamicsGroupIdSchema,
  ParameterIdSchema,
  type RuntimeStateDto
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createEmptyAuthoringSession } from "../../features/editor-session/model/empty-authoring-session";
import {
  createViewerRuntimeInitialState,
  createViewerRuntimePlaybackModel,
  isViewerRuntimePlaybackStateSettled,
  VIEWER_RUNTIME_FIXED_STEP_MS,
  VIEWER_RUNTIME_SETTLED_MIN_EVALUATED_FRAMES,
  type ViewerRuntimePlaybackModel
} from "./viewer-runtime-playback";

// §3.7 settled judgement is redesigned for the world-frame Verlet chain: a group is settled when
// the max particle speed (|x − px| / dt) and the per-frame output-offset change are both below
// their epsilons. These tests fix physically meaningful transitions (a still chain vs a swinging
// chain vs a chain whose driver just changed), not the raw epsilon constants.

const DRIVER = ParameterIdSchema.parse("param_playback_driver");
const OUTPUT = ParameterIdSchema.parse("param_playback_output");
const GROUP_ID = DynamicsGroupIdSchema.parse("dyn_playback_settled");

const ABOVE_MIN_FRAMES = VIEWER_RUNTIME_SETTLED_MIN_EVALUATED_FRAMES + 1;

describe("isViewerRuntimePlaybackStateSettled (world-frame chain, §3.7)", () => {
  it("reports settled when the chain hangs straight down at rest", () => {
    const { model, restState } = createSettledFixture(0);

    expect(
      isViewerRuntimePlaybackStateSettled({
        authoredParameterValues: { [DRIVER]: 0 },
        evaluatedFrameCount: ABOVE_MIN_FRAMES,
        model,
        state: restState
      })
    ).toBe(true);
  });

  it("reports not settled while the tip particle is still swinging", () => {
    const { model, restState } = createSettledFixture(0);
    // Give the single particle a large per-frame displacement (x far from px): it is moving fast.
    const movingState = withGroupParticles(restState, [{ x: 4, y: 20, px: 0, py: 10 }]);

    expect(
      isViewerRuntimePlaybackStateSettled({
        authoredParameterValues: { [DRIVER]: 0 },
        evaluatedFrameCount: ABOVE_MIN_FRAMES,
        model,
        state: movingState
      })
    ).toBe(false);
  });

  it("reports not settled when the output offset is still changing between frames", () => {
    const { model, restState } = createSettledFixture(30);
    // The tip particle swings sideways across frames: |x − px| drives a changing segment angle, so
    // both the particle-speed and output-offset-delta (§3.7) terms flag the group as not settled
    // while the driver excites it. This keeps the RAF loop alive during visible sway.
    const swungState = withGroupParticles(restState, [{ x: 3, y: 9, px: 1, py: 9.5 }]);

    expect(
      isViewerRuntimePlaybackStateSettled({
        authoredParameterValues: { [DRIVER]: 30 },
        evaluatedFrameCount: ABOVE_MIN_FRAMES,
        model,
        state: swungState
      })
    ).toBe(false);
  });

  it("is never settled before the minimum evaluated-frame count", () => {
    const { model, restState } = createSettledFixture(0);

    expect(
      isViewerRuntimePlaybackStateSettled({
        authoredParameterValues: { [DRIVER]: 0 },
        evaluatedFrameCount: VIEWER_RUNTIME_SETTLED_MIN_EVALUATED_FRAMES - 1,
        model,
        state: restState
      })
    ).toBe(false);
  });
});

const withGroupParticles = (
  state: RuntimeStateDto,
  particles: readonly { x: number; y: number; px: number; py: number }[]
): RuntimeStateDto => ({
  ...state,
  dynamicsGroups: {
    ...state.dynamicsGroups,
    [GROUP_ID]: {
      particles: particles.map((particle) => ({ ...particle })),
      tick: 10,
      resetCounter: 1
    }
  }
});

function createSettledFixture(driverValue: number): {
  readonly model: ViewerRuntimePlaybackModel;
  readonly restState: RuntimeStateDto;
} {
  const session = createDynamicsPlaybackSession();
  const model = createViewerRuntimePlaybackModel(session);
  const initialState = createViewerRuntimeInitialState(model, { [DRIVER]: driverValue });
  // The single chain particle hangs straight below the pin (rootOffset 0, φ = 0 → pin at origin):
  // x === px and y === py so the particle speed is zero.
  const restState = withGroupParticles(initialState, [{ x: 0, y: 10, px: 0, py: 10 }]);
  return { model, restState };
}

function createDynamicsPlaybackSession(): AuthoringSession {
  const session = createEmptyAuthoringSession();
  session.graph.parameters.push(
    {
      parameterId: DRIVER,
      displayName: "Driver",
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
      parameterId: OUTPUT,
      displayName: "Output",
      valueSource: "authoredInput",
      min: -20,
      default: 0,
      max: 20,
      recommendedUiStep: 0.1,
      kind: "custom",
      parameterType: "scalar",
      group: "custom",
      lockedFields: []
    }
  );
  session.graph.dynamicsGroups.push({
    dynamicsGroupId: GROUP_ID,
    displayName: "Playback Settled",
    enabled: true,
    presetId: "hair",
    inputs: [{ parameterId: DRIVER, kind: "angle", scale: 1 }],
    chain: { rootOffset: { x: 0, y: 0 }, segmentLengths: [10], damping: 2.5, gravityScale: 1 },
    outputs: [{ parameterId: OUTPUT, segmentIndex: 1, scale: 1, limit: 20 }]
  });
  return session;
}
