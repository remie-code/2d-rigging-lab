import { describe, expect, it } from "vitest";

import { CheckIdSchema } from "@private-2d-rigging-lab/contracts";

import { createStageRuntimeDiagnosticDetails } from "./stage-render-diagnostics";

describe("stage render diagnostics", () => {
  it("formats runtime diagnostics as Control Window detail strings", () => {
    expect(
      createStageRuntimeDiagnosticDetails([
        {
          checkId: CheckIdSchema.parse("keyform.missingParameter"),
          status: "warning",
          severity: "warning",
          phase: "keyform_sampling",
          target: {
            kind: "parameter",
            id: "param_missing"
          },
          message: "Keyform parameter is missing.",
          evidence: ["keyformSetId=keyset_body"],
          relatedAC: [],
          relatedScenarios: [],
          repairCandidateIds: []
        }
      ])
    ).toEqual([
      "warning keyform.missingParameter (keyform_sampling, parameter:param_missing): Keyform parameter is missing. Evidence: keyformSetId=keyset_body"
    ]);
  });
});
