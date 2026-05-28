import { describe, expect, it } from "vitest";

import {
  RuntimeStateArtifactRefSchema,
  RuntimeStateSequenceArtifactRefSchema
} from "./runtime-artifact-refs.js";
import { RuntimeStateDtoSchema } from "./runtime-state.js";
import {
  RuntimeEvaluationContextSchema,
  RuntimeSequenceEvaluationContextSchema,
  RuntimeSequenceFrameSchema,
  RuntimeStateSequenceArtifactSchema
} from "./runtime-sequence.js";

const runtimeState = {
  schemaVersion: "runtime-state-v1",
  packageId: "pkg_avatarClean",
  packageRevision: 3,
  packageHash: "sha256-package",
  frameIndex: 12,
  fixedStepMs: 16.6667,
  accumulatorMs: 0,
  dynamicsGroups: {
    dyn_hairSway: {
      position: 0.25,
      velocity: -0.1,
      tick: 12,
      resetCounter: 1
    }
  }
} as const;

describe("runtime artifact refs", () => {
  it("accepts generated runtime state and sequence artifact paths", () => {
    expect(RuntimeStateArtifactRefSchema.parse("runtime/states/minimal.runtime-state.json")).toBe(
      "runtime/states/minimal.runtime-state.json"
    );
    expect(
      RuntimeStateSequenceArtifactRefSchema.parse(
        "runtime/state-sequences/minimal-dynamics-hairSway.runtime-state-sequence.json"
      )
    ).toBe("runtime/state-sequences/minimal-dynamics-hairSway.runtime-state-sequence.json");
  });

  it("rejects authored files, nested paths, and wrong evidence suffixes", () => {
    expect(RuntimeStateArtifactRefSchema.safeParse("model/runtime-state.json").success).toBe(false);
    expect(RuntimeStateArtifactRefSchema.safeParse("runtime/states/nested/state.runtime-state.json").success).toBe(
      false
    );
    expect(RuntimeStateSequenceArtifactRefSchema.safeParse("runtime/states/minimal.runtime-state.json").success).toBe(
      false
    );
  });
});

describe("runtime state DTO", () => {
  it("parses runtime dynamics group state keyed by dynamics group IDs", () => {
    expect(RuntimeStateDtoSchema.parse(runtimeState)).toEqual(runtimeState);
  });

  it("rejects invalid package IDs and non-finite dynamics values", () => {
    expect(RuntimeStateDtoSchema.safeParse({ ...runtimeState, packageId: "src_avatarClean" }).success).toBe(false);
    expect(
      RuntimeStateDtoSchema.safeParse({
        ...runtimeState,
        dynamicsGroups: {
          dyn_hairSway: {
            position: Number.POSITIVE_INFINITY,
            velocity: 0,
            tick: 0,
            resetCounter: 0
          }
        }
      }).success
    ).toBe(false);
  });
});

describe("runtime sequence frame DTO", () => {
  it("applies frame-local defaults without adding evaluation context", () => {
    expect(
      RuntimeSequenceFrameSchema.parse({
        frameIndex: 0,
        deltaTimeMs: 16.6667
      })
    ).toEqual({
      frameIndex: 0,
      deltaTimeMs: 16.6667,
      resetReasons: [],
      authoredParameterValues: {},
      targetIds: []
    });
  });

  it("parses authored parameter values keyed by parameter IDs", () => {
    expect(
      RuntimeSequenceFrameSchema.parse({
        frameIndex: 1,
        deltaTimeMs: 16.6667,
        resetReasons: ["previewRestart"],
        authoredParameterValues: {
          param_faceYaw: 0.5
        },
        targetIds: ["draw_eyeLeft"]
      })
    ).toEqual({
      frameIndex: 1,
      deltaTimeMs: 16.6667,
      resetReasons: ["previewRestart"],
      authoredParameterValues: {
        param_faceYaw: 0.5
      },
      targetIds: ["draw_eyeLeft"]
    });
  });
});

describe("runtime evaluation context", () => {
  it("defaults policy strictness to interactive", () => {
    expect(
      RuntimeEvaluationContextSchema.parse({
        source: {
          surface: "preview"
        }
      })
    ).toEqual({
      source: {
        surface: "preview"
      },
      policy: {
        strictness: "interactive"
      }
    });
  });

  it("keeps the sequence evaluation context compatibility alias aligned", () => {
    const context = {
      source: {
        surface: "validator",
        operationId: "op_validateDynamics001"
      },
      policy: {
        strictness: "strict"
      }
    };

    expect(RuntimeSequenceEvaluationContextSchema.parse(context)).toEqual(
      RuntimeEvaluationContextSchema.parse(context)
    );
  });
});

describe("runtime state sequence artifact", () => {
  it("parses valid structural sequence evidence", () => {
    expect(
      RuntimeStateSequenceArtifactSchema.parse({
        schemaVersion: "runtime-state-sequence-v1",
        packageId: "pkg_avatarClean",
        packageRevision: 3,
        packageHash: "sha256-package",
        fixedStepMs: 16.6667,
        frameCount: 1,
        inputFramesHash: "sha256-frames",
        runtimeEvaluationContext: {
          source: {
            surface: "validator"
          },
          policy: {
            strictness: "acceptance"
          }
        },
        evaluatorVersionSummary: {
          runtimeCore: "0.0.0",
          dynamicsSolver: "minimumOpenDynamicsV1"
        },
        states: [
          { ...runtimeState, frameIndex: 0 },
          { ...runtimeState, frameIndex: 1 }
        ]
      })
    ).toEqual({
      schemaVersion: "runtime-state-sequence-v1",
      packageId: "pkg_avatarClean",
      packageRevision: 3,
      packageHash: "sha256-package",
      fixedStepMs: 16.6667,
      frameCount: 1,
      inputFramesHash: "sha256-frames",
      runtimeEvaluationContext: {
        source: {
          surface: "validator"
        },
        policy: {
          strictness: "acceptance"
        }
      },
      evaluatorVersionSummary: {
        runtimeCore: "0.0.0",
        dynamicsSolver: "minimumOpenDynamicsV1"
      },
      states: [
        { ...runtimeState, frameIndex: 0 },
        { ...runtimeState, frameIndex: 1 }
      ]
    });
  });
});
