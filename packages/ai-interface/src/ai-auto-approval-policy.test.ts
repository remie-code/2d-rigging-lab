import { OperationResultSchema } from "@private-2d-rigging-lab/operation-core";
import type { OperationResultDto } from "@private-2d-rigging-lab/operation-core";
import { describe, expect, it } from "vitest";

import { DiagnosticGatedAutoApprovalPolicy } from "./ai-auto-approval-policy.js";

const createOperationResult = (input: {
  readonly status: OperationResultDto["status"];
  readonly diagnostics?: readonly unknown[];
  readonly preconditionOk?: boolean;
  readonly preconditionDiagnostics?: readonly unknown[];
}): OperationResultDto =>
  OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: "op_auto_approval_test",
    status: input.status,
    precondition: {
      ok: input.preconditionOk ?? true,
      diagnostics: input.preconditionDiagnostics ?? []
    },
    diagnostics: input.diagnostics ?? [],
    reversible: true
  });

const createBlockingDiagnostic = (severity: "error" | "blocking"): unknown => ({
  checkId: "operation.editKeyformKey.duplicateKey",
  status: "fail" as const,
  severity,
  phase: "operation-core",
  target: { kind: "operation", id: "op_auto_approval_test" },
  message: "blocking issue",
  evidence: [],
  relatedAC: [],
  relatedScenarios: [],
  repairCandidateIds: []
});

describe("DiagnosticGatedAutoApprovalPolicy", () => {
  it("auto-approves a dry-run result with no blocking diagnostics", () => {
    const policy = new DiagnosticGatedAutoApprovalPolicy();

    const decision = policy.evaluateAutoApproval({
      operationResult: createOperationResult({ status: "dry_run" }),
      operationType: "createParameter"
    });

    expect(decision.autoApprove).toBe(true);
    expect(decision.reason).toBe("no-blocking-diagnostic");
    expect(decision.blockingDiagnostics).toEqual([]);
  });

  it("does not auto-approve a rejected dry-run result", () => {
    const policy = new DiagnosticGatedAutoApprovalPolicy();

    const decision = policy.evaluateAutoApproval({
      operationResult: createOperationResult({
        status: "rejected",
        diagnostics: [createBlockingDiagnostic("error")]
      })
    });

    expect(decision.autoApprove).toBe(false);
    expect(decision.reason).toBe("operation-result-rejected");
    expect(decision.blockingDiagnostics).toHaveLength(1);
  });

  it("does not auto-approve when a blocking diagnostic is present in a non-rejected result", () => {
    const policy = new DiagnosticGatedAutoApprovalPolicy();

    const decision = policy.evaluateAutoApproval({
      operationResult: createOperationResult({
        status: "dry_run",
        diagnostics: [createBlockingDiagnostic("blocking")]
      })
    });

    expect(decision.autoApprove).toBe(false);
    expect(decision.reason).toBe("blocking-diagnostic-present");
  });

  it("collects blocking diagnostics from the precondition as well as the result", () => {
    const policy = new DiagnosticGatedAutoApprovalPolicy();

    const decision = policy.evaluateAutoApproval({
      operationResult: createOperationResult({
        status: "dry_run",
        preconditionOk: false,
        preconditionDiagnostics: [createBlockingDiagnostic("error")]
      })
    });

    expect(decision.autoApprove).toBe(false);
    expect(decision.reason).toBe("blocking-diagnostic-present");
    expect(decision.blockingDiagnostics).toHaveLength(1);
  });

  it("routes gated operation classes back to human approval even without diagnostics", () => {
    const policy = new DiagnosticGatedAutoApprovalPolicy({
      humanApprovalOperationTypes: ["deleteRigControl"]
    });

    const gatedDecision = policy.evaluateAutoApproval({
      operationResult: createOperationResult({ status: "dry_run" }),
      operationType: "deleteRigControl"
    });
    const ungatedDecision = policy.evaluateAutoApproval({
      operationResult: createOperationResult({ status: "dry_run" }),
      operationType: "createParameter"
    });

    expect(gatedDecision.autoApprove).toBe(false);
    expect(gatedDecision.reason).toBe("operation-class-requires-human-approval");
    expect(ungatedDecision.autoApprove).toBe(true);
  });

  it("delegates the approval lifecycle to the underlying policy without bypassing it", () => {
    const policy = new DiagnosticGatedAutoApprovalPolicy();

    policy.recordDryRun({ dryRunCommandId: "cmd_1", agentId: "agent_headless", operationId: "op_1" });

    // Before approval, commit must not be approved.
    expect(
      policy.checkCommitApproval({
        approvedDryRunCommandId: "cmd_1",
        agentId: "agent_headless",
        operationId: "op_1"
      }).status
    ).toBe("needs_approval");

    policy.approveDryRunCommand({ dryRunCommandId: "cmd_1", operationId: "op_1" });

    expect(
      policy.checkCommitApproval({
        approvedDryRunCommandId: "cmd_1",
        agentId: "agent_headless",
        operationId: "op_1"
      }).status
    ).toBe("approved");
  });
});
