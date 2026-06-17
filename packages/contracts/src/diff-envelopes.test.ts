import { describe, expect, it } from "vitest";

import { FieldChangeSchema } from "./field-change.js";
import { JsonPointerSchema, JsonValueSchema } from "./json-value.js";
import { ModelDiffSchema } from "./model-diff.js";
import { RuntimeDiffSchema } from "./runtime-diff.js";
import { ValidationDiffSchema } from "./validation-diff.js";

const diagnostic = {
  checkId: "runtime.stateSequenceLengthMismatch",
  status: "fail",
  severity: "error",
  phase: "validation",
  target: {
    kind: "runtimeSnapshot",
    id: "snap_before"
  },
  message: "State sequence length does not match frame count."
} as const;

describe("shared JSON diff values", () => {
  it("parses JSON pointers and recursive JSON values", () => {
    const recursiveValue = {
      scalar: 1,
      nested: {
        array: [null, true, "label", { child: 2 }]
      }
    };

    expect(JsonPointerSchema.parse("")).toBe("");
    expect(JsonPointerSchema.parse("/model/drawables/0")).toBe("/model/drawables/0");
    expect(JsonPointerSchema.safeParse("model/drawables/0").success).toBe(false);
    expect(JsonValueSchema.parse(recursiveValue)).toEqual(recursiveValue);
  });

  it("parses field changes with JSON values", () => {
    expect(
      FieldChangeSchema.parse({
        path: "/parameters/0/value",
        before: { value: 0 },
        after: { value: 1 }
      })
    ).toEqual({
      path: "/parameters/0/value",
      before: { value: 0 },
      after: { value: 1 }
    });
  });
});

describe("model diff envelope", () => {
  it("enforces schemaVersion and defaults array fields", () => {
    expect(
      ModelDiffSchema.parse({
        schemaVersion: "model-diff-v1",
        baseRevision: 1,
        candidateRevision: 2
      })
    ).toEqual({
      schemaVersion: "model-diff-v1",
      baseRevision: 1,
      candidateRevision: 2,
      added: [],
      removed: [],
      changed: [],
      operationIds: []
    });

    expect(
      ModelDiffSchema.safeParse({
        schemaVersion: "runtime-diff-v1",
        baseRevision: 1,
        candidateRevision: 2
      }).success
    ).toBe(false);
  });
});

describe("runtime diff envelope", () => {
  it("parses runtime dynamics change shape and defaults array fields", () => {
    expect(
      RuntimeDiffSchema.parse({
        schemaVersion: "runtime-diff-v1",
        beforeSnapshotId: "snap_before",
        afterSnapshotId: "snap_after",
        dynamicsChanges: [
          {
            dynamicsGroupId: "dyn_hairSway",
            outputParameterId: "param_hairX",
            stateChanged: true,
            outputChanged: true,
            angleBefore: 0,
            angleAfter: 0.5,
            angularVelocityBefore: -0.1,
            angularVelocityAfter: 0.2,
            outputOffsetBefore: 0,
            outputOffsetAfter: 0.5,
            effectiveOutputValueBefore: 0,
            effectiveOutputValueAfter: 0.5,
            tickBefore: 4,
            tickAfter: 5,
            resetCounterBefore: 0,
            resetCounterAfter: 1
          }
        ],
        diagnosticDelta: [diagnostic]
      })
    ).toEqual({
      schemaVersion: "runtime-diff-v1",
      beforeSnapshotId: "snap_before",
      afterSnapshotId: "snap_after",
      parameterChanges: [],
      dynamicsChanges: [
        {
          dynamicsGroupId: "dyn_hairSway",
          outputParameterId: "param_hairX",
          stateChanged: true,
          outputChanged: true,
          angleBefore: 0,
          angleAfter: 0.5,
          angularVelocityBefore: -0.1,
          angularVelocityAfter: 0.2,
          outputOffsetBefore: 0,
          outputOffsetAfter: 0.5,
          effectiveOutputValueBefore: 0,
          effectiveOutputValueAfter: 0.5,
          tickBefore: 4,
          tickAfter: 5,
          resetCounterBefore: 0,
          resetCounterAfter: 1
        }
      ],
      drawableChanges: [],
      drawableRuntimeStateChanges: [],
      drawListChanges: [],
      diagnosticDelta: [
        {
          ...diagnostic,
          evidence: [],
          relatedAC: [],
          relatedScenarios: [],
          repairCandidateIds: []
        }
      ]
    });
  });
});

describe("validation diff envelope", () => {
  it("parses validation severity changes and defaults failure arrays", () => {
    expect(
      ValidationDiffSchema.parse({
        schemaVersion: "validation-diff-v1",
        beforeReportId: "val_before",
        afterReportId: "val_after",
        severityChanges: [
          {
            checkId: "rigControl.cycle",
            target: {
              kind: "rigControl",
              id: "rig_head"
            },
            before: "warning",
            after: "blocking"
          }
        ]
      })
    ).toEqual({
      schemaVersion: "validation-diff-v1",
      beforeReportId: "val_before",
      afterReportId: "val_after",
      newFailures: [],
      resolvedFailures: [],
      severityChanges: [
        {
          checkId: "rigControl.cycle",
          target: {
            kind: "rigControl",
            id: "rig_head"
          },
          before: "warning",
          after: "blocking"
        }
      ]
    });
  });

  it("enforces validation-diff-v1 schemaVersion", () => {
    expect(
      ValidationDiffSchema.safeParse({
        schemaVersion: "model-diff-v1",
        beforeReportId: "val_before",
        afterReportId: "val_after"
      }).success
    ).toBe(false);
  });
});
