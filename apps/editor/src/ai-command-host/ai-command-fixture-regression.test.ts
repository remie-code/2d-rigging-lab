import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createBrowserProjectStore, type StorageLike } from "../project-persistence/index.js";
import { createEditorWorkflowController } from "../editor-workflow/index.js";

const fixtureRoot = join(
  process.cwd(),
  "fixtures/contracts/ai-dry-run-command-foundation"
);

describe("AI dry-run command foundation fixture", () => {
  it("matches the transcript and summary acceptance oracle", async () => {
    const fixture = readJson<AiCommandSequenceFixture>("request/ai-command-sequence.json");
    const expectedTranscript = readJson<unknown>("expected/ai-command-transcript.json");
    const expectedSummary = readJson<unknown>("expected/ai-command-summary.json");
    const workflow = createWorkflow(createMemoryStorage());
    const commandResults: Record<string, unknown> = {};
    const stateSnapshots: Record<string, WorkflowStateSummary> = {};

    for (const step of fixture.steps) {
      if (step.kind === "approval") {
        workflow.aiCommandHost.approvalPolicy.approveDryRunCommand({
          dryRunCommandId: step.dryRunCommandId,
          operationId: step.operationId
        });
        continue;
      }

      commandResults[step.stepId] = await workflow.aiCommandHost.execute(step.request);
      stateSnapshots[step.stepId] = summarizeWorkflowState(workflow);
    }

    const transcript = {
      schemaVersion: "ai-command-transcript-v1",
      entries: workflow.aiCommandHost.transcript.entries
    };
    const summary = summarizeFixtureRun({
      workflow,
      commandResults,
      stateSnapshots
    });

    expect(transcript).toEqual(expectedTranscript);
    expect(summary).toEqual(expectedSummary);
  });
});

interface AiCommandSequenceFixture {
  readonly schemaVersion: "ai-command-sequence-v1";
  readonly steps: readonly AiCommandSequenceStep[];
}

type AiCommandSequenceStep =
  | {
      readonly stepId: string;
      readonly kind: "command";
      readonly request: unknown;
    }
  | {
      readonly stepId: string;
      readonly kind: "approval";
      readonly dryRunCommandId: string;
      readonly operationId: string;
    };

const summarizeFixtureRun = (input: {
  readonly workflow: ReturnType<typeof createWorkflow>;
  readonly commandResults: Readonly<Record<string, unknown>>;
  readonly stateSnapshots: Readonly<Record<string, WorkflowStateSummary>>;
}) => {
  const dryRunResponse = asCommandResponse(input.commandResults["dry-run-smile-parameter"]);
  const unapprovedCommitResponse = asCommandResponse(input.commandResults["commit-without-approval"]);
  const approvedCommitResponse = asCommandResponse(input.commandResults["commit-approved"]);
  const operationLogResponse = asCommandResponse(input.commandResults["read-operation-log"]);
  const operationLogEntries = asOperationLogEntries(operationLogResponse);
  const dryRunState = requireStateSummary(input.stateSnapshots["dry-run-smile-parameter"]);
  const unapprovedCommitState = requireStateSummary(input.stateSnapshots["commit-without-approval"]);
  const approvedCommitState = requireStateSummary(input.stateSnapshots["commit-approved"]);

  return {
    schemaVersion: "ai-command-summary-v1",
    commandStatuses: input.workflow.aiCommandHost.transcript.entries.flatMap((entry) =>
      entry.entryType === "command"
        ? [
            {
              commandId: entry.commandId,
              command: entry.command,
              status: entry.status,
              ...(entry.operationId === undefined ? {} : { operationId: entry.operationId })
            }
          ]
        : []
    ),
    approvalEvents: input.workflow.aiCommandHost.transcript.entries.flatMap((entry) =>
      entry.entryType === "approval"
        ? [
            {
              dryRunCommandId: entry.dryRunCommandId,
              agentId: entry.agentId,
              approvalStatus: entry.approvalStatus,
              ...(entry.operationId === undefined ? {} : { operationId: entry.operationId })
            }
          ]
        : []
    ),
    dryRun: {
      operationId: getOperationResult(dryRunResponse).operationId,
      status: getOperationResult(dryRunResponse).status,
      packageRevisionAfter: dryRunState.packageRevision,
      operationLogEntryCountAfter: dryRunState.operationLogEntryCount,
      parameterPresentAfter: dryRunState.parameterIds.includes("param_ai_fixture_smile"),
      modelDiff: summarizeModelDiff(getOperationResult(dryRunResponse).modelDiff)
    },
    unapprovedCommit: {
      status: unapprovedCommitResponse.status,
      operationStatus: getOperationResult(unapprovedCommitResponse).status,
      packageRevisionAfter: unapprovedCommitState.packageRevision,
      operationLogEntryCountAfter: unapprovedCommitState.operationLogEntryCount,
      parameterPresentAfter: unapprovedCommitState.parameterIds.includes("param_ai_fixture_smile")
    },
    approvedCommit: {
      status: approvedCommitResponse.status,
      operationStatus: getOperationResult(approvedCommitResponse).status,
      packageRevisionAfter: approvedCommitState.packageRevision,
      parameterIdsAfter: approvedCommitState.parameterIds
    },
    operationLog: {
      entryCount: operationLogEntries.length,
      entries: operationLogEntries.map((entry) => ({
        operationId: entry.operationId,
        actor: entry.actor,
        surface: entry.surface,
        operationType: entry.operationType,
        targetIds: entry.targetIds,
        provenanceId: entry.provenanceId,
        runtimeSnapshotIds: entry.runtimeSnapshotIds,
        validationReportIds: entry.validationReportIds,
        reversible: entry.reversible
      }))
    }
  };
};

interface WorkflowStateSummary {
  readonly packageRevision: number;
  readonly operationLogEntryCount: number;
  readonly parameterIds: readonly string[];
}

const summarizeWorkflowState = (
  workflow: ReturnType<typeof createWorkflow>
): WorkflowStateSummary => ({
  packageRevision: workflow.state.revision.packageRevision,
  operationLogEntryCount: workflow.state.operationLog.entryCount,
  parameterIds: workflow.state.parameters.map((parameter) => parameter.parameterId)
});

const requireStateSummary = (summary: WorkflowStateSummary | undefined): WorkflowStateSummary => {
  if (summary === undefined) {
    throw new Error("Expected fixture state summary to be captured.");
  }

  return summary;
};

const summarizeModelDiff = (modelDiff: unknown) => {
  const diff = asRecord(modelDiff);

  return {
    baseRevision: diff["baseRevision"],
    candidateRevision: diff["candidateRevision"],
    added: asArray(diff["added"]).map((entry) => {
      const record = asRecord(entry);

      return {
        kind: record["kind"],
        id: record["id"]
      };
    }),
    removedCount: asArray(diff["removed"]).length,
    changedCount: asArray(diff["changed"]).length
  };
};

const getOperationResult = (response: Record<string, unknown>) => {
  const payload = asRecord(response["payload"]);

  return asRecord(payload["operationResult"]);
};

const asOperationLogEntries = (response: Record<string, unknown>) => {
  const payload = asRecord(response["payload"]);

  return asArray(payload["entries"]).map((entry) => asRecord(entry));
};

const asCommandResponse = (value: unknown): Record<string, unknown> => asRecord(value);

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected an object fixture value.");
  }

  return value as Record<string, unknown>;
};

const asArray = (value: unknown): readonly unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error("Expected an array fixture value.");
  }

  return value;
};

const readJson = <TValue>(path: string): TValue =>
  JSON.parse(readFileSync(join(fixtureRoot, path), "utf8")) as TValue;

const createWorkflow = (storage: StorageLike) =>
  createEditorWorkflowController({
    projectStore: createBrowserProjectStore({
      storage,
      now: () => new Date("2026-05-29T05:00:00.000Z")
    }),
    now: () => new Date("2026-05-29T05:00:00.000Z")
  });

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
