import type {
  OperationLogEntryDto,
  OperationRequestDto,
  OperationResultDto
} from "@private-2d-rigging-lab/operation-core";
import {
  OperationLogEntrySchema,
  OperationRequestSchema,
  OperationResultSchema
} from "@private-2d-rigging-lab/operation-core";
import { describe, expect, it } from "vitest";

import { InMemoryAiApprovalPolicy } from "./ai-approval-policy.js";
import { AiCommandExecutor } from "./ai-command-executor.js";
import type { AiOperationCommandHost } from "./ai-command-host.js";
import { InMemoryAiCommandTranscript } from "./ai-command-transcript.js";

const operationId = "op_create_ai_parameter";
const dryRunCommandId = "cmd_dry_run_create_parameter";
const commitCommandId = "cmd_commit_create_parameter";
const agentId = "agent_test";

class FakeOperationCommandHost implements AiOperationCommandHost {
  readonly dryRunCalls: OperationRequestDto[] = [];
  readonly commitCalls: OperationRequestDto[] = [];
  readonly operationLogEntries: OperationLogEntryDto[] = [];

  dryRunOperation(request: OperationRequestDto): OperationResultDto {
    this.dryRunCalls.push(request);

    return createOperationResult("dry_run", request);
  }

  commitOperation(request: OperationRequestDto): OperationResultDto {
    this.commitCalls.push(request);
    const result = createOperationResult("committed", request);
    this.operationLogEntries.push(createOperationLogEntry(request, result));

    return result;
  }
}

describe("AI operation command executor", () => {
  it("denies dry-run when the session is read-only", async () => {
    const host = new FakeOperationCommandHost();
    const executor = createExecutor(host);

    const response = await executor.execute(createDryRunCommand(["read"]));

    expect(response).toMatchObject({
      commandId: dryRunCommandId,
      command: "dryRunOperation",
      status: "permission_denied",
      payload: {
        operationResult: {
          status: "rejected"
        }
      }
    });
    expect(host.dryRunCalls).toHaveLength(0);
    expect(host.commitCalls).toHaveLength(0);
  });

  it("runs dry-run with dryRunEdit and leaves the fake operation log unchanged", async () => {
    const host = new FakeOperationCommandHost();
    const executor = createExecutor(host);

    const response = await executor.execute(createDryRunCommand(["dryRunEdit"]));

    expect(response).toMatchObject({
      commandId: dryRunCommandId,
      command: "dryRunOperation",
      status: "ok",
      payload: {
        operationResult: {
          operationId,
          status: "dry_run"
        }
      }
    });
    expect(host.dryRunCalls).toHaveLength(1);
    expect(host.commitCalls).toHaveLength(0);
    expect(host.operationLogEntries).toHaveLength(0);
  });

  it("denies commit without commitWithApproval capability", async () => {
    const host = new FakeOperationCommandHost();
    const executor = createExecutor(host);

    const response = await executor.execute(createCommitCommand(["dryRunEdit"]));

    expect(response).toMatchObject({
      commandId: commitCommandId,
      command: "commitOperation",
      status: "permission_denied",
      payload: {
        operationResult: {
          status: "rejected"
        }
      }
    });
    expect(host.commitCalls).toHaveLength(0);
  });

  it("requires approval before commit even with commit capability", async () => {
    const host = new FakeOperationCommandHost();
    const executor = createExecutor(host);

    const response = await executor.execute(createCommitCommand(["commitWithApproval"]));

    expect(response).toMatchObject({
      commandId: commitCommandId,
      command: "commitOperation",
      status: "needs_approval",
      payload: {
        operationResult: {
          status: "rejected"
        }
      }
    });
    expect(host.commitCalls).toHaveLength(0);
  });

  it("commits exactly once when the dry-run command has approval", async () => {
    const host = new FakeOperationCommandHost();
    const approvalPolicy = new InMemoryAiApprovalPolicy();
    const executor = createExecutor(host, approvalPolicy);

    await executor.execute(createDryRunCommand(["dryRunEdit"]));
    executor.approvalPolicy.approveDryRunCommand({
      dryRunCommandId,
      operationId
    });
    const response = await executor.execute(createCommitCommand(["commitWithApproval"]));

    expect(response).toMatchObject({
      commandId: commitCommandId,
      command: "commitOperation",
      status: "ok",
      payload: {
        operationResult: {
          operationId,
          status: "committed"
        }
      }
    });
    expect(host.commitCalls).toHaveLength(1);
    expect(host.operationLogEntries).toHaveLength(1);
  });

  it("rejects approved commit when the commit operation omits the approved operation ID", async () => {
    const host = new FakeOperationCommandHost();
    const approvalPolicy = new InMemoryAiApprovalPolicy();
    const executor = createExecutor(host, approvalPolicy);

    await executor.execute(createDryRunCommand(["dryRunEdit"]));
    executor.approvalPolicy.approveDryRunCommand({
      dryRunCommandId,
      operationId
    });
    const response = await executor.execute(
      createCommitCommand(["commitWithApproval"], {
        operation: createOperationRequest(false, { includeOperationId: false })
      })
    );

    expect(response).toMatchObject({
      commandId: commitCommandId,
      command: "commitOperation",
      status: "rejected",
      payload: {
        operationResult: {
          status: "rejected"
        }
      }
    });
    expect(host.commitCalls).toHaveLength(0);
  });

  it("rejects approved commit when the commit operation ID does not match the dry-run approval", async () => {
    const host = new FakeOperationCommandHost();
    const approvalPolicy = new InMemoryAiApprovalPolicy();
    const executor = createExecutor(host, approvalPolicy);

    await executor.execute(createDryRunCommand(["dryRunEdit"]));
    approvalPolicy.approveDryRunCommand({
      dryRunCommandId,
      operationId
    });
    const response = await executor.execute(
      createCommitCommand(["commitWithApproval"], {
        operation: createOperationRequest(false, { operationId: "op_other_ai_parameter" })
      })
    );

    expect(response).toMatchObject({
      commandId: commitCommandId,
      command: "commitOperation",
      status: "rejected",
      payload: {
        operationResult: {
          status: "rejected"
        }
      }
    });
    expect(host.commitCalls).toHaveLength(0);
  });

  it("rejects approved commit when another agent reuses the dry-run approval", async () => {
    const host = new FakeOperationCommandHost();
    const approvalPolicy = new InMemoryAiApprovalPolicy();
    const executor = createExecutor(host, approvalPolicy);

    await executor.execute(createDryRunCommand(["dryRunEdit"]));
    approvalPolicy.approveDryRunCommand({
      dryRunCommandId,
      operationId
    });
    const response = await executor.execute(
      createCommitCommand(["commitWithApproval"], {
        agentId: "agent_other"
      })
    );

    expect(response).toMatchObject({
      commandId: commitCommandId,
      command: "commitOperation",
      status: "rejected",
      payload: {
        operationResult: {
          status: "rejected"
        }
      }
    });
    expect(host.commitCalls).toHaveLength(0);
  });

  it("does not transfer approval when another agent reuses the dry-run command ID", async () => {
    const host = new FakeOperationCommandHost();
    const approvalPolicy = new InMemoryAiApprovalPolicy();
    const executor = createExecutor(host, approvalPolicy);

    await executor.execute(createDryRunCommand(["dryRunEdit"]));
    approvalPolicy.approveDryRunCommand({
      dryRunCommandId,
      operationId
    });
    await executor.execute(
      createDryRunCommand(["dryRunEdit"], {
        agentId: "agent_other"
      })
    );
    const response = await executor.execute(
      createCommitCommand(["commitWithApproval"], {
        agentId: "agent_other"
      })
    );

    expect(response).toMatchObject({
      commandId: commitCommandId,
      command: "commitOperation",
      status: "needs_approval",
      payload: {
        operationResult: {
          status: "rejected"
        }
      }
    });
    expect(host.dryRunCalls).toHaveLength(2);
    expect(host.commitCalls).toHaveLength(0);
  });

  it("records command identity, agent identity, status, evidence refs, and operation refs in transcript", async () => {
    const host = new FakeOperationCommandHost();
    const approvalPolicy = new InMemoryAiApprovalPolicy();
    const transcript = new InMemoryAiCommandTranscript();
    const executor = new AiCommandExecutor({
      host,
      approvalPolicy,
      transcript
    });

    await executor.execute(createDryRunCommand(["dryRunEdit"]));
    executor.approvalPolicy.approveDryRunCommand({
      dryRunCommandId,
      operationId
    });
    await executor.execute(createCommitCommand(["commitWithApproval"]));

    expect(transcript.entries).toEqual([
      expect.objectContaining({
        commandId: dryRunCommandId,
        entryType: "command",
        agentId,
        command: "dryRunOperation",
        capabilities: ["dryRunEdit"],
        basis: {
          packageRevision: 0,
          relatedAC: ["AC-MVP-014"],
          relatedScenarios: ["SC-AGENT-002"]
        },
        status: "ok",
        operationId,
        evidenceRefs: ["runtime/snapshots/snap_ai_preview.runtime-snapshot.json"]
      }),
      expect.objectContaining({
        entryType: "approval",
        dryRunCommandId,
        agentId,
        approvalStatus: "approved",
        operationId,
        evidenceRefs: []
      }),
      expect.objectContaining({
        commandId: commitCommandId,
        entryType: "command",
        agentId,
        command: "commitOperation",
        capabilities: ["commitWithApproval"],
        basis: {
          packageRevision: 0,
          relatedAC: ["AC-MVP-014"],
          relatedScenarios: ["SC-AGENT-002"]
        },
        status: "ok",
        operationId,
        evidenceRefs: [
          "runtime/snapshots/snap_ai_preview.runtime-snapshot.json",
          `operations/log.jsonl#${operationId}`
        ]
      })
    ]);
  });
});

const createExecutor = (
  host: AiOperationCommandHost,
  approvalPolicy = new InMemoryAiApprovalPolicy()
): AiCommandExecutor =>
  new AiCommandExecutor({
    host,
    approvalPolicy
  });

const createDryRunCommand = (
  capabilities: readonly string[],
  options: { readonly agentId?: string } = {}
) => ({
  schemaVersion: "ai-command-request-v1",
  commandId: dryRunCommandId,
  session: {
    agentId: options.agentId ?? agentId,
    capabilities
  },
  basis: {
    packageRevision: 0,
    relatedAC: ["AC-MVP-014"],
    relatedScenarios: ["SC-AGENT-002"]
  },
  command: "dryRunOperation",
  payload: createOperationRequest(true)
});

const createCommitCommand = (
  capabilities: readonly string[],
  options: {
    readonly agentId?: string;
    readonly approvedDryRunCommandId?: string;
    readonly operation?: OperationRequestDto;
  } = {}
) => ({
  schemaVersion: "ai-command-request-v1",
  commandId: commitCommandId,
  session: {
    agentId: options.agentId ?? agentId,
    capabilities
  },
  basis: {
    packageRevision: 0,
    relatedAC: ["AC-MVP-014"],
    relatedScenarios: ["SC-AGENT-002"]
  },
  command: "commitOperation",
  payload: {
    approvedDryRunCommandId: options.approvedDryRunCommandId ?? dryRunCommandId,
    operation: options.operation ?? createOperationRequest(false)
  }
});

const createOperationRequest = (
  dryRun: boolean,
  options: {
    readonly includeOperationId?: boolean;
    readonly operationId?: string;
  } = {}
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(options.includeOperationId === false
      ? {}
      : { operationId: options.operationId ?? operationId }),
    actor: "ai",
    surface: "structuredApi",
    dryRun,
    basePackageRevision: 0,
    trace: {
      relatedAC: ["AC-MVP-014"],
      relatedScenarios: ["SC-AGENT-002"]
    },
    operationType: "createParameter",
    payload: {
      parameterId: "param_ai_parameter",
      displayName: "AI Parameter",
      semanticRole: "custom",
      min: 0,
      max: 1,
      default: 0.5,
      recommendedUiStep: 0.01
    }
  });

const createOperationResult = (
  status: "dry_run" | "committed",
  request: OperationRequestDto
): OperationResultDto =>
  OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: request.operationId ?? operationId,
    status,
    precondition: {
      ok: true,
      diagnostics: []
    },
    modelDiff: {
      schemaVersion: "model-diff-v1",
      baseRevision: 0,
      candidateRevision: status === "committed" ? 1 : 0,
      added: [
        {
          kind: "parameter",
          id: "param_ai_parameter"
        }
      ],
      removed: [],
      changed: [],
      operationIds: [request.operationId ?? operationId]
    },
    generatedRuntimeSnapshotIds: ["snap_ai_preview"],
    reversible: true
  });

const createOperationLogEntry = (
  request: OperationRequestDto,
  result: OperationResultDto
): OperationLogEntryDto =>
  OperationLogEntrySchema.parse({
    schemaVersion: "operation-log-entry-v1",
    operationId: result.operationId,
    transactionId: "txn_create_ai_parameter",
    timestamp: "2026-05-29T00:00:00.000Z",
    actor: request.actor,
    surface: request.surface,
    operationType: request.operationType,
    targetIds: ["param_ai_parameter"],
    precondition: {
      ok: true,
      diagnostics: [],
      checkedTargetRefs: [
        {
          kind: "parameter",
          id: "param_ai_parameter"
        }
      ]
    },
    payload: {
      operationType: request.operationType,
      payload: request.payload
    },
    result,
    provenanceId: "prov_ai_command",
    reversible: true
  });
