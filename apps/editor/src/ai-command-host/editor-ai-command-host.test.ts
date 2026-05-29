import { OperationRequestSchema } from "@private-2d-rigging-lab/operation-core";
import { InMemoryAiCommandTranscript } from "@private-2d-rigging-lab/ai-interface";
import { describe, expect, it } from "vitest";

import { createBrowserProjectStore, type StorageLike } from "../project-persistence/index.js";
import { createEditorWorkflowController } from "../editor-workflow/index.js";
import { createEditorAiCommandHost } from "./editor-ai-command-host.js";

describe("editor AI command host", () => {
  it("returns editor state and dry-runs createParameter without mutating state or log", async () => {
    const workflow = createWorkflow(createMemoryStorage());
    const stateResponse = await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_get_state",
        command: "getEditorState",
        capabilities: ["read"],
        payload: { detail: "summary" }
      })
    );

    const dryRunResponse = await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_dry_run_smile",
        command: "dryRunOperation",
        capabilities: ["dryRunEdit"],
        payload: createAiCreateParameterOperation({
          name: "smile",
          dryRun: true,
          basePackageRevision: 0
        })
      })
    );
    const logResponse = await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_get_log_after_dry_run",
        command: "getOperationLog",
        capabilities: ["read"],
        payload: {}
      })
    );

    expect(stateResponse).toMatchObject({
      status: "ok",
      command: "getEditorState",
      payload: {
        editorState: {
          schemaVersion: "editor-semantic-state-v1",
          packageRevision: 0
        }
      }
    });
    expect(dryRunResponse).toMatchObject({
      status: "ok",
      command: "dryRunOperation",
      payload: {
        operationResult: {
          status: "dry_run",
          operationId: "op_ai_create_parameter_smile"
        }
      }
    });
    expect(workflow.state.parameters).toHaveLength(0);
    expect(workflow.state.revision.packageRevision).toBe(0);
    expect(workflow.state.operationLog.entryCount).toBe(0);
    expect(logResponse).toMatchObject({
      status: "ok",
      command: "getOperationLog",
      payload: {
        entries: []
      }
    });
    expect(workflow.aiCommandHost.transcript.entries).toMatchObject([
      {
        commandId: "cmd_ai_get_state",
        command: "getEditorState",
        status: "ok"
      },
      {
        commandId: "cmd_ai_dry_run_smile",
        command: "dryRunOperation",
        status: "ok"
      },
      {
        commandId: "cmd_ai_get_log_after_dry_run",
        command: "getOperationLog",
        status: "ok"
      }
    ]);
  });

  it("denies commit without approval", async () => {
    const workflow = createWorkflow(createMemoryStorage());
    const response = await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_commit_without_approval",
        command: "commitOperation",
        capabilities: ["commitWithApproval"],
        payload: {
          approvedDryRunCommandId: "cmd_ai_unknown_dry_run",
          operation: createAiCreateParameterOperation({
            name: "smile",
            dryRun: false,
            basePackageRevision: 0
          })
        }
      })
    );

    expect(response).toMatchObject({
      status: "needs_approval",
      command: "commitOperation",
      payload: {
        operationResult: {
          status: "rejected"
        }
      }
    });
    expect(workflow.state.parameters).toHaveLength(0);
    expect(workflow.state.operationLog.entryCount).toBe(0);
  });

  it("commits approved AI operations through operation-core and appends log", async () => {
    const workflow = createWorkflow(createMemoryStorage());

    await dryRunAndApproveAiCreateParameter(workflow, "smile");
    const commitResponse = await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_commit_smile",
        command: "commitOperation",
        capabilities: ["commitWithApproval"],
        payload: {
          approvedDryRunCommandId: "cmd_ai_dry_run_smile",
          operation: createAiCreateParameterOperation({
            name: "smile",
            dryRun: false,
            basePackageRevision: 0
          })
        }
      })
    );
    const logResponse = await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_get_log_after_commit",
        command: "getOperationLog",
        capabilities: ["read"],
        payload: { surface: "structuredApi" }
      })
    );

    expect(commitResponse).toMatchObject({
      status: "ok",
      command: "commitOperation",
      payload: {
        operationResult: {
          status: "committed",
          operationId: "op_ai_create_parameter_smile"
        }
      }
    });
    expect(workflow.state.revision.packageRevision).toBe(1);
    expect(workflow.state.parameters.map((parameter) => parameter.parameterId)).toEqual([
      "param_ai_smile"
    ]);
    expect(workflow.state.operationLog.entryCount).toBe(1);
    expect(logResponse).toMatchObject({
      status: "ok",
      command: "getOperationLog",
      payload: {
        entries: [
          expect.objectContaining({
            operationId: "op_ai_create_parameter_smile",
            actor: "ai",
            surface: "structuredApi",
            operationType: "createParameter"
          })
        ]
      }
    });
  });

  it("rejects AI commits that try to use non-AI operation provenance", async () => {
    const workflow = createWorkflow(createMemoryStorage());

    await dryRunAndApproveAiCreateParameter(workflow, "smile");
    const response = await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_commit_smile_as_gui",
        command: "commitOperation",
        capabilities: ["commitWithApproval"],
        payload: {
          approvedDryRunCommandId: "cmd_ai_dry_run_smile",
          operation: createAiCreateParameterOperation({
            name: "smile",
            dryRun: false,
            basePackageRevision: 0,
            provenance: {
              actor: "human",
              surface: "gui"
            }
          })
        }
      })
    );

    expect(response).toMatchObject({
      status: "rejected",
      command: "commitOperation",
      payload: {
        operationResult: {
          status: "rejected",
          diagnostics: [
            expect.objectContaining({
              checkId: "ai.editor.invalidProvenance"
            })
          ]
        }
      }
    });
    expect(workflow.aiCommandHost.transcript.entries).toContainEqual(
      expect.objectContaining({
        entryType: "command",
        commandId: "cmd_ai_commit_smile_as_gui",
        command: "commitOperation",
        status: "rejected",
        operationId: "op_ai_create_parameter_smile"
      })
    );
    expect(workflow.state.parameters).toHaveLength(0);
    expect(workflow.state.operationLog.entryCount).toBe(0);
  });

  it("keeps existing workflow state when an approved AI commit is rejected by operation-core", async () => {
    const workflow = createWorkflow(createMemoryStorage());

    await dryRunAndApproveAiCreateParameter(workflow, "smile");
    await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_commit_smile",
        command: "commitOperation",
        capabilities: ["commitWithApproval"],
        payload: {
          approvedDryRunCommandId: "cmd_ai_dry_run_smile",
          operation: createAiCreateParameterOperation({
            name: "smile",
            dryRun: false,
            basePackageRevision: 0
          })
        }
      })
    );
    await dryRunAndApproveAiCreateParameter(workflow, "brow");

    const rejected = await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_commit_brow_stale_revision",
        command: "commitOperation",
        capabilities: ["commitWithApproval"],
        payload: {
          approvedDryRunCommandId: "cmd_ai_dry_run_brow",
          operation: createAiCreateParameterOperation({
            name: "brow",
            dryRun: false,
            basePackageRevision: 0
          })
        }
      })
    );

    expect(rejected).toMatchObject({
      status: "rejected",
      command: "commitOperation",
      payload: {
        operationResult: {
          status: "rejected",
          operationId: "op_ai_create_parameter_brow"
        }
      }
    });
    expect(workflow.state.revision.packageRevision).toBe(1);
    expect(workflow.state.parameters.map((parameter) => parameter.parameterId)).toEqual([
      "param_ai_smile"
    ]);
    expect(workflow.state.operationLog.entryCount).toBe(1);
  });

  it("preserves AI operation log entries across save and load", async () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    await dryRunAndApproveAiCreateParameter(first, "smile");
    await first.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_commit_smile",
        command: "commitOperation",
        capabilities: ["commitWithApproval"],
        payload: {
          approvedDryRunCommandId: "cmd_ai_dry_run_smile",
          operation: createAiCreateParameterOperation({
            name: "smile",
            dryRun: false,
            basePackageRevision: 0
          })
        }
      })
    );
    first.saveProject();

    const second = createWorkflow(storage);
    const loadResult = second.loadProject();
    const logResponse = await second.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_get_log_after_load",
        command: "getOperationLog",
        capabilities: ["read"],
        payload: { operationIds: ["op_ai_create_parameter_smile"] }
      })
    );

    expect(loadResult.status).toBe("loaded");
    expect(second.state.revision.packageRevision).toBe(1);
    expect(second.state.operationLog.entryCount).toBe(1);
    expect(logResponse).toMatchObject({
      status: "ok",
      command: "getOperationLog",
      payload: {
        entries: [
          expect.objectContaining({
            operationId: "op_ai_create_parameter_smile",
            actor: "ai",
            surface: "structuredApi",
            operationType: "createParameter"
          })
        ]
      }
    });
  });

  it("clears stale AI approvals when loading or resetting the workflow session", async () => {
    const storage = createMemoryStorage();
    const workflow = createWorkflow(storage);

    await dryRunAndApproveAiCreateParameter(workflow, "smile");
    const staleApprovedDryRunCommit = createAiRequest({
      commandId: "cmd_ai_commit_stale_smile_after_reset",
      command: "commitOperation",
      capabilities: ["commitWithApproval"],
      payload: {
        approvedDryRunCommandId: "cmd_ai_dry_run_smile",
        operation: createAiCreateParameterOperation({
          name: "smile",
          dryRun: false,
          basePackageRevision: 0
        })
      }
    });

    workflow.saveProject();
    workflow.loadProject();
    const afterLoad = await workflow.aiCommandHost.execute(staleApprovedDryRunCommit);

    workflow.resetToSamplePackage();
    const afterReset = await workflow.aiCommandHost.execute(staleApprovedDryRunCommit);

    expect(afterLoad).toMatchObject({
      status: "needs_approval",
      command: "commitOperation",
      payload: {
        operationResult: {
          status: "rejected"
        }
      }
    });
    expect(afterReset).toMatchObject({
      status: "needs_approval",
      command: "commitOperation",
      payload: {
        operationResult: {
          status: "rejected"
        }
      }
    });
    expect(workflow.state.parameters).toHaveLength(0);
    expect(workflow.state.operationLog.entryCount).toBe(0);
  });

  it("uses an injected transcript for restored read-only history", async () => {
    const transcript = new InMemoryAiCommandTranscript();
    const host = createEditorAiCommandHost({
      transcript,
      operationHost: {
        dryRunOperation() {
          throw new Error("dryRunOperation should not be called");
        },
        commitOperation() {
          throw new Error("commitOperation should not be called");
        }
      },
      readHost: {
        getEditorState() {
          return {
            schemaVersion: "editor-semantic-state-v1",
            packageRevision: 0
          };
        },
        getOperationLog() {
          return [];
        }
      }
    });

    await host.execute(
      createAiRequest({
        commandId: "cmd_ai_restored_get_state",
        command: "getEditorState",
        capabilities: ["read"],
        payload: { detail: "summary" }
      })
    );

    expect(host.transcript).toBe(transcript);
    expect(transcript.entries).toEqual([
      expect.objectContaining({
        entryType: "command",
        commandId: "cmd_ai_restored_get_state",
        command: "getEditorState",
        status: "ok"
      })
    ]);
  });
});

const dryRunAndApproveAiCreateParameter = async (
  workflow: ReturnType<typeof createWorkflow>,
  name: "smile" | "brow"
): Promise<void> => {
  const dryRunCommandId = `cmd_ai_dry_run_${name}`;
  const operationId = `op_ai_create_parameter_${name}`;

  const dryRunResponse = await workflow.aiCommandHost.execute(
    createAiRequest({
      commandId: dryRunCommandId,
      command: "dryRunOperation",
      capabilities: ["dryRunEdit"],
      payload: createAiCreateParameterOperation({
        name,
        dryRun: true,
        basePackageRevision: workflow.state.revision.packageRevision
      })
    })
  );

  expect(dryRunResponse).toMatchObject({
    status: "ok",
    payload: {
      operationResult: {
        status: "dry_run",
        operationId
      }
    }
  });
  workflow.aiCommandHost.approvalPolicy.approveDryRunCommand({
    dryRunCommandId,
    operationId
  });
};

const createAiRequest = (input: {
  readonly commandId: string;
  readonly command: "getEditorState" | "dryRunOperation" | "commitOperation" | "getOperationLog";
  readonly capabilities: readonly ("read" | "dryRunEdit" | "commitWithApproval")[];
  readonly payload: unknown;
}) => ({
  schemaVersion: "ai-command-request-v1",
  commandId: input.commandId,
  session: {
    agentId: "agent_editor_ai_test",
    capabilities: input.capabilities
  },
  basis: {
    packageRevision: 0,
    relatedAC: ["AC-MVP-014"],
    relatedScenarios: ["SC-AGENT-002"]
  },
  command: input.command,
  payload: input.payload
});

const createAiCreateParameterOperation = (input: {
  readonly name: "smile" | "brow";
  readonly dryRun: boolean;
  readonly basePackageRevision: number;
  readonly provenance?: {
    readonly actor: "ai" | "human";
    readonly surface: "structuredApi" | "gui";
  };
}) =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: `op_ai_create_parameter_${input.name}`,
    actor: input.provenance?.actor ?? "ai",
    surface: input.provenance?.surface ?? "structuredApi",
    dryRun: input.dryRun,
    basePackageRevision: input.basePackageRevision,
    idempotencyKey: `ai-create-parameter-${input.name}`,
    trace: {
      relatedAC: ["AC-MVP-014"],
      relatedScenarios: ["SC-AGENT-002"]
    },
    operationType: "createParameter",
    payload: {
      parameterId: `param_ai_${input.name}`,
      displayName: `AI ${capitalize(input.name)}`,
      semanticRole: input.name === "smile" ? "mouth" : "brow",
      projectPresetAlias: `private-ai-${input.name}-control`,
      valueSource: "authoredInput",
      min: 0,
      max: 1,
      default: 0,
      recommendedUiStep: 0.01
    }
  });

const createWorkflow = (storage: StorageLike) =>
  createEditorWorkflowController({
    projectStore: createBrowserProjectStore({
      storage,
      now: () => new Date("2026-05-29T05:00:00.000Z")
    }),
    now: () => new Date("2026-05-29T05:00:00.000Z")
  });

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
