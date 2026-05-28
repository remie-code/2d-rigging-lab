import { describe, expect, it } from "vitest";

import {
  CheckIdSchema,
  DiagnosticSchema,
  FieldChangeSchema,
  JsonValueSchema,
  ModelDiffSchema,
  PackageIdSchema,
  RectDtoSchema,
  RuntimeDiffSchema,
  RuntimeEvaluationContextSchema,
  RuntimeSequenceFrameSchema,
  RuntimeSourceSurfaceSchema,
  RuntimeStateArtifactRefSchema,
  RuntimeStateDtoSchema,
  RuntimeStateSequenceArtifactSchema,
  RuntimeStateSequenceArtifactRefSchema,
  SeveritySchema,
  TargetRefSchema,
  Transform2DDtoSchema,
  ValidationDiffSchema,
  Vec2DtoSchema,
  contractsPackageInfo
} from "./index.js";
import type {
  Brand,
  DiagnosticDto,
  ModelDiffDto,
  PackageId,
  RuntimeDiffDto,
  RuntimeStateDto,
  ValidationDiffDto,
  Vec2Dto
} from "./index.js";

const runtimeState = {
  schemaVersion: "runtime-state-v1",
  packageId: "pkg_integration",
  packageRevision: 1,
  frameIndex: 0,
  fixedStepMs: 16.6667,
  accumulatorMs: 0,
  dynamicsGroups: {
    dyn_hairSway: {
      position: 0,
      velocity: 0,
      tick: 0,
      resetCounter: 0
    }
  }
} as const;

describe("contracts public surface integration", () => {
  it("exports package metadata, branded IDs, primitives, and enums", () => {
    const packageId: PackageId = PackageIdSchema.parse("pkg_integration");
    const brandedPackageId: Brand<string, "PackageId"> = packageId;
    const vec2: Vec2Dto = Vec2DtoSchema.parse({ x: 1, y: -1 });

    expect(contractsPackageInfo.moduleId).toBe("contracts");
    expect(brandedPackageId).toBe("pkg_integration");
    expect(vec2).toEqual({ x: 1, y: -1 });
    expect(RectDtoSchema.parse({ x: 0, y: 0, width: 10, height: 20 })).toEqual({
      x: 0,
      y: 0,
      width: 10,
      height: 20
    });
    expect(
      Transform2DDtoSchema.parse({
        translation: { x: 0, y: 1 },
        rotationDegrees: 15,
        scale: { x: 1, y: 1 }
      })
    ).toEqual({
      translation: { x: 0, y: 1 },
      rotationDegrees: 15,
      scale: { x: 1, y: 1 }
    });
    expect(SeveritySchema.parse("blocking")).toBe("blocking");
    expect(RuntimeSourceSurfaceSchema.parse("validator")).toBe("validator");
  });

  it("exports diagnostic schemas", () => {
    const diagnostic: DiagnosticDto = DiagnosticSchema.parse({
      checkId: CheckIdSchema.parse("runtime.stateSequenceLengthMismatch"),
      status: "fail",
      severity: "error",
      phase: "validation",
      target: TargetRefSchema.parse({
        kind: "runtimeSnapshot",
        id: "snap_before"
      }),
      message: "State sequence length does not match frame count."
    });

    expect(diagnostic).toEqual({
      checkId: "runtime.stateSequenceLengthMismatch",
      status: "fail",
      severity: "error",
      phase: "validation",
      target: {
        kind: "runtimeSnapshot",
        id: "snap_before"
      },
      message: "State sequence length does not match frame count.",
      evidence: [],
      relatedAC: [],
      relatedScenarios: [],
      repairCandidateIds: []
    });
  });

  it("exports runtime artifact refs, state, and sequence contracts", () => {
    const state: RuntimeStateDto = RuntimeStateDtoSchema.parse(runtimeState);

    expect(RuntimeStateArtifactRefSchema.parse("runtime/states/integration.runtime-state.json")).toBe(
      "runtime/states/integration.runtime-state.json"
    );
    expect(
      RuntimeStateSequenceArtifactRefSchema.parse(
        "runtime/state-sequences/integration.runtime-state-sequence.json"
      )
    ).toBe("runtime/state-sequences/integration.runtime-state-sequence.json");
    expect(RuntimeSequenceFrameSchema.parse({ frameIndex: 0, deltaTimeMs: 16 })).toEqual({
      frameIndex: 0,
      deltaTimeMs: 16,
      resetReasons: [],
      authoredParameterValues: {},
      targetIds: []
    });
    expect(RuntimeEvaluationContextSchema.parse({ source: { surface: "preview" } })).toEqual({
      source: { surface: "preview" },
      policy: { strictness: "interactive" }
    });
    expect(
      RuntimeStateSequenceArtifactSchema.parse({
        schemaVersion: "runtime-state-sequence-v1",
        packageId: "pkg_integration",
        packageRevision: 1,
        fixedStepMs: 16.6667,
        frameCount: 0,
        states: [state]
      })
    ).toEqual({
      schemaVersion: "runtime-state-sequence-v1",
      packageId: "pkg_integration",
      packageRevision: 1,
      fixedStepMs: 16.6667,
      frameCount: 0,
      states: [state]
    });
  });

  it("exports JSON, field change, and diff envelope contracts", () => {
    expect(JsonValueSchema.parse({ nested: [null, true, 1, "value"] })).toEqual({
      nested: [null, true, 1, "value"]
    });
    expect(FieldChangeSchema.parse({ path: "/parameters/0", before: 0, after: 1 })).toEqual({
      path: "/parameters/0",
      before: 0,
      after: 1
    });

    const modelDiff: ModelDiffDto = ModelDiffSchema.parse({
      schemaVersion: "model-diff-v1",
      baseRevision: 1,
      candidateRevision: 2
    });
    const runtimeDiff: RuntimeDiffDto = RuntimeDiffSchema.parse({
      schemaVersion: "runtime-diff-v1",
      beforeSnapshotId: "snap_before",
      afterSnapshotId: "snap_after"
    });
    const validationDiff: ValidationDiffDto = ValidationDiffSchema.parse({
      schemaVersion: "validation-diff-v1",
      beforeReportId: "val_before",
      afterReportId: "val_after"
    });

    expect(modelDiff.operationIds).toEqual([]);
    expect(runtimeDiff.dynamicsChanges).toEqual([]);
    expect(validationDiff.newFailures).toEqual([]);
  });
});
