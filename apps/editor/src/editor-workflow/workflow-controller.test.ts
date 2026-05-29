import { describe, expect, it } from "vitest";

import { createBrowserProjectStore } from "../project-persistence/index.js";
import type { StorageLike } from "../project-persistence/index.js";
import { createEditorWorkflowController } from "./workflow-controller.js";

describe("editor workflow controller", () => {
  it("restores parameter and reload summary after commit, save, and load", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    first.commitCreateParameter(createParameterCommand("smile"));
    const saved = first.saveProject();

    const second = createWorkflow(storage);
    const loaded = second.loadProject();

    expect(saved.status).toBe("saved");
    expect(loaded.status).toBe("loaded");
    expect(second.state.parameters).toEqual([
      expect.objectContaining({
        parameterId: "param_workflow_smile",
        displayName: "Workflow Smile"
      })
    ]);
    expect(second.state.reload).toMatchObject({
      status: "reloaded",
      packageRevision: 1,
      parameterCount: 1,
      parameterIds: ["param_workflow_smile"]
    });
    expect(second.state.operationLog.entryCount).toBe(1);
    expect(second.state.generatedEvidence.validationReportArtifactPaths).toEqual(
      expect.arrayContaining([
        "validation/reports/val_editor_workflow_create_parameter_smile_baseline.validation.json",
        "validation/reports/val_editor_workflow_create_parameter_smile_candidate.validation.json"
      ])
    );
  });

  it("appends operation log entries after loading a persisted project", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);
    first.commitCreateParameter(createParameterCommand("smile"));
    first.saveProject();

    const second = createWorkflow(storage);
    second.loadProject();
    const commit = second.commitCreateParameter(createParameterCommand("brow"));

    expect(commit.operationLogEntries.map((entry) => entry.operationId)).toEqual([
      "op_workflow_create_parameter_smile",
      "op_workflow_create_parameter_brow"
    ]);
    expect(commit.operationLogJsonl.trim().split("\n")).toHaveLength(2);
    expect(second.state.operationLog.entryCount).toBe(2);
    expect(second.state.parameters.map((parameter) => parameter.parameterId)).toEqual([
      "param_workflow_smile",
      "param_workflow_brow"
    ]);
  });

  it("clears persisted state and returns to the sample package on reset", () => {
    const storage = createMemoryStorage();
    const workflow = createWorkflow(storage);
    workflow.commitCreateParameter(createParameterCommand("smile"));
    workflow.saveProject();

    const reset = workflow.resetToSamplePackage();

    expect(reset.status).toBe("reset");
    expect(workflow.state.loadedPackage?.packageId).toBe("pkg_editor_browser_sample");
    expect(workflow.state.revision.packageRevision).toBe(0);
    expect(workflow.state.parameters).toEqual([]);
    expect(workflow.state.operationLog.entryCount).toBe(0);
    expect(workflow.state.reload.status).toBe("not_reloaded");
    expect(storage.getItem(reset.clearResult.storageKey)).toBeNull();
  });

  it("dry-runs deterministic AI createParameter and leaves package state unmutated", async () => {
    const workflow = createWorkflow(createMemoryStorage());

    const dryRun = await workflow.dryRunAiCreateParameterCommand();

    expect(dryRun.status).toBe("pending_approval");
    expect(dryRun.response).toMatchObject({
      status: "ok",
      command: "dryRunOperation",
      payload: {
        operationResult: {
          status: "dry_run",
          operationId: "op_editor_ai_create_parameter_r0_1"
        }
      }
    });
    expect(workflow.state.parameters).toEqual([]);
    expect(workflow.state.operationLog.entryCount).toBe(0);
    expect(workflow.viewModel.aiApproval).toMatchObject({
      status: "pending_approval",
      latestDryRunCommandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
      latestDryRunOperationId: "op_editor_ai_create_parameter_r0_1",
      canApproveLatestDryRun: true,
      canCommitApprovedOperation: false,
      canRejectPendingDryRun: true
    });
  });

  it("rejects and clears a pending AI dry-run without mutating package state", async () => {
    const workflow = createWorkflow(createMemoryStorage());
    await workflow.dryRunAiCreateParameterCommand();

    const rejected = workflow.rejectLatestAiDryRun();

    expect(rejected.status).toBe("cleared");
    expect(workflow.state.parameters).toEqual([]);
    expect(workflow.state.operationLog.entryCount).toBe(0);
    expect(workflow.viewModel.aiApproval).toMatchObject({
      status: "idle",
      latestDryRunCommandId: null,
      latestDryRunOperationId: null,
      canApproveLatestDryRun: false,
      canCommitApprovedOperation: false,
      canRejectPendingDryRun: false
    });
  });

  it("approves and commits an AI dry-run through operation-core", async () => {
    const workflow = createWorkflow(createMemoryStorage());
    await workflow.dryRunAiCreateParameterCommand();

    const approval = workflow.approveLatestAiDryRun();
    const committed = await workflow.commitApprovedAiOperation();

    expect(approval.status).toBe("approved");
    expect(committed.status).toBe("committed");
    expect(committed.response).toMatchObject({
      status: "ok",
      command: "commitOperation",
      payload: {
        operationResult: {
          status: "committed",
          operationId: "op_editor_ai_create_parameter_r0_1"
        }
      }
    });
    expect(workflow.state.parameters.map((parameter) => parameter.parameterId)).toEqual([
      "param_editor_ai_r0_1"
    ]);
    expect(workflow.state.operationLog).toMatchObject({
      entryCount: 1,
      latestEntry: expect.objectContaining({
        operationId: "op_editor_ai_create_parameter_r0_1",
        operationType: "createParameter",
        surface: "structuredApi"
      })
    });
    expect(workflow.viewModel.aiApproval).toMatchObject({
      status: "idle",
      canApproveLatestDryRun: false,
      canCommitApprovedOperation: false,
      canRejectPendingDryRun: false
    });
  });

  it("does not let stale approval survive reset", async () => {
    const workflow = createWorkflow(createMemoryStorage());
    await workflow.dryRunAiCreateParameterCommand();
    workflow.approveLatestAiDryRun();

    workflow.resetToSamplePackage();
    const committed = await workflow.commitApprovedAiOperation();

    expect(committed.status).toBe("no_approved_operation");
    expect(workflow.state.parameters).toEqual([]);
    expect(workflow.state.operationLog.entryCount).toBe(0);
    expect(workflow.viewModel.aiApproval.status).toBe("idle");
    expect(workflow.viewModel.aiApproval.transcriptEntries).toEqual([]);
  });

  it("does not let pending approval survive an empty load", async () => {
    const workflow = createWorkflow(createMemoryStorage());
    await workflow.dryRunAiCreateParameterCommand();

    const loaded = workflow.loadProject();

    expect(loaded.status).toBe("empty");
    expect(workflow.viewModel.aiApproval.status).toBe("idle");
    expect(workflow.viewModel.aiApproval.transcriptEntries).toEqual([]);
    expect(workflow.state.parameters).toEqual([]);
    expect(workflow.state.operationLog.entryCount).toBe(0);
  });

  it("summarizes AI command and approval transcript entries for the view model", async () => {
    const workflow = createWorkflow(createMemoryStorage());
    await workflow.dryRunAiCreateParameterCommand();

    workflow.approveLatestAiDryRun();

    expect(workflow.viewModel.aiApproval.transcriptEntries).toEqual([
      expect.objectContaining({
        entryType: "command",
        commandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
        command: "dryRunOperation",
        status: "ok",
        operationId: "op_editor_ai_create_parameter_r0_1",
        evidenceCount: 6
      }),
      expect.objectContaining({
        entryType: "approval",
        dryRunCommandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
        approvalStatus: "approved",
        operationId: "op_editor_ai_create_parameter_r0_1",
        evidenceCount: 0
      })
    ]);
  });

  it("saves a non-empty AI transcript and restores it into the loaded view model", async () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    await first.dryRunAiCreateParameterCommand();
    first.approveLatestAiDryRun();
    const saved = first.saveProject();

    const second = createWorkflow(storage);
    const loaded = second.loadProject();

    expect(saved.storeResult.project.aiCommandTranscript.entries).toEqual([
      expect.objectContaining({
        entryType: "command",
        commandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
        command: "dryRunOperation",
        status: "ok",
        operationId: "op_editor_ai_create_parameter_r0_1"
      }),
      expect.objectContaining({
        entryType: "approval",
        dryRunCommandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
        approvalStatus: "approved",
        operationId: "op_editor_ai_create_parameter_r0_1"
      })
    ]);
    expect(loaded.status).toBe("loaded");
    expect(second.viewModel.aiApproval).toMatchObject({
      status: "idle",
      canApproveLatestDryRun: false,
      canCommitApprovedOperation: false,
      canRejectPendingDryRun: false
    });
    expect(second.viewModel.aiApproval.transcriptEntries).toEqual([
      expect.objectContaining({
        entryType: "command",
        commandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
        command: "dryRunOperation",
        status: "ok",
        operationId: "op_editor_ai_create_parameter_r0_1"
      }),
      expect.objectContaining({
        entryType: "approval",
        dryRunCommandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
        approvalStatus: "approved",
        operationId: "op_editor_ai_create_parameter_r0_1"
      })
    ]);
  });

  it("loads AI transcript history without restoring actionable approval state", async () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);
    await first.dryRunAiCreateParameterCommand();
    first.approveLatestAiDryRun();
    first.saveProject();

    const second = createWorkflow(storage);
    second.loadProject();

    const approval = second.approveLatestAiDryRun();
    const commit = await second.commitApprovedAiOperation();

    expect(second.viewModel.aiApproval.transcriptEntries).toHaveLength(2);
    expect(approval.status).toBe("no_pending_dry_run");
    expect(commit.status).toBe("no_approved_operation");
    expect(second.viewModel.aiApproval).toMatchObject({
      status: "idle",
      canApproveLatestDryRun: false,
      canCommitApprovedOperation: false,
      canRejectPendingDryRun: false
    });
    expect(second.state.parameters).toEqual([]);
    expect(second.state.operationLog.entryCount).toBe(0);
  });
});

const createWorkflow = (storage: StorageLike) =>
  createEditorWorkflowController({
    projectStore: createBrowserProjectStore({
      storage,
      now: () => new Date("2026-05-29T04:00:00.000Z")
    }),
    now: () => new Date("2026-05-29T04:00:00.000Z")
  });

const createParameterCommand = (name: "smile" | "brow") => ({
  operationId: `op_workflow_create_parameter_${name}`,
  parameterId: `param_workflow_${name}`,
  displayName: `Workflow ${capitalize(name)}`,
  semanticRole: name === "smile" ? "mouth" : "brow",
  projectPresetAlias: `private-workflow-${name}-control`,
  min: 0,
  max: 1,
  defaultValue: 0,
  recommendedUiStep: 0.01
} as const);

const capitalize = (text: string): string =>
  `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`;

const createMemoryStorage = (
  entries: readonly (readonly [string, string])[] = []
): StorageLike => {
  const values = new Map(entries);

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    }
  };
};
