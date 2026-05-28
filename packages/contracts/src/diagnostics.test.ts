import { describe, expect, it } from "vitest";

import { CheckIdSchema } from "./check-id.js";
import { DiagnosticSchema } from "./diagnostics.js";
import { TargetKindSchema, TargetRefSchema } from "./target-ref.js";

const targetKinds = [
  "package",
  "sourceAsset",
  "texture",
  "part",
  "drawable",
  "mesh",
  "vertex",
  "parameter",
  "keyformSet",
  "rigControl",
  "dynamicsGroup",
  "maskRelation",
  "operation",
  "runtimeSnapshot",
  "validationReport",
  "guiEvidence"
] as const;

describe("CheckIdSchema", () => {
  it.each(["runtime.stateSequenceLengthMismatch", "rigControl.cycle", "demo.unsafeForbiddenTerm"])(
    "accepts dot-separated lower camelCase check IDs",
    (checkId) => {
      expect(CheckIdSchema.parse(checkId)).toBe(checkId);
    }
  );

  it.each(["runtime", "Runtime.state", "runtime.State", "runtime.1state", "runtime.state_sequence", "runtime.state sequence"])(
    "rejects invalid check IDs",
    (checkId) => {
      expect(CheckIdSchema.safeParse(checkId).success).toBe(false);
    }
  );
});

describe("TargetRefSchema", () => {
  it.each(targetKinds)("accepts target kind %s", (kind) => {
    expect(TargetKindSchema.parse(kind)).toBe(kind);
    expect(TargetRefSchema.parse({ kind, id: `${kind}_id` })).toEqual({ kind, id: `${kind}_id` });
  });

  it("keeps target IDs generic strings and preserves optional paths", () => {
    expect(TargetRefSchema.parse({ kind: "drawable", id: "external-id-001", path: "/model/drawables/0" })).toEqual({
      kind: "drawable",
      id: "external-id-001",
      path: "/model/drawables/0"
    });
  });

  it("rejects invalid target refs", () => {
    expect(TargetRefSchema.safeParse({ kind: "rig control", id: "rig_armLeft" }).success).toBe(false);
    expect(TargetRefSchema.safeParse({ kind: "rigControl" }).success).toBe(false);
    expect(TargetRefSchema.safeParse({ kind: "rigControl", id: 1 }).success).toBe(false);
  });
});

describe("DiagnosticSchema", () => {
  const minimalDiagnostic = {
    checkId: "runtime.stateSequenceLengthMismatch",
    status: "fail",
    severity: "error",
    phase: "validation",
    target: {
      kind: "runtimeSnapshot",
      id: "snap_mvp001",
      path: "/runtime/states/0"
    },
    message: "State sequence length does not match frame count."
  };

  it("defaults related array fields", () => {
    expect(DiagnosticSchema.parse(minimalDiagnostic)).toEqual({
      ...minimalDiagnostic,
      evidence: [],
      relatedAC: [],
      relatedScenarios: [],
      repairCandidateIds: []
    });
  });

  it("preserves explicit diagnostic relation fields", () => {
    expect(
      DiagnosticSchema.parse({
        ...minimalDiagnostic,
        status: "warning",
        severity: "warning",
        evidence: ["runtime/state-sequences/demo.runtime-state-sequence.json"],
        relatedAC: ["AC-MVP-013"],
        relatedScenarios: ["SC-VALIDATOR-005"],
        repairCandidateIds: ["repair_dynamicsDriver"]
      })
    ).toEqual({
      ...minimalDiagnostic,
      status: "warning",
      severity: "warning",
      evidence: ["runtime/state-sequences/demo.runtime-state-sequence.json"],
      relatedAC: ["AC-MVP-013"],
      relatedScenarios: ["SC-VALIDATOR-005"],
      repairCandidateIds: ["repair_dynamicsDriver"]
    });
  });

  it("rejects diagnostics with invalid core fields", () => {
    expect(DiagnosticSchema.safeParse({ ...minimalDiagnostic, checkId: "runtime" }).success).toBe(false);
    expect(DiagnosticSchema.safeParse({ ...minimalDiagnostic, status: "blocked" }).success).toBe(false);
    expect(DiagnosticSchema.safeParse({ ...minimalDiagnostic, severity: "fatal" }).success).toBe(false);
    expect(DiagnosticSchema.safeParse({ ...minimalDiagnostic, target: { kind: "unknown", id: "target" } }).success).toBe(
      false
    );
  });
});
