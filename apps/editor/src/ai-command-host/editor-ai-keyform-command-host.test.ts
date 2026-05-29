import { OperationRequestSchema } from "@private-2d-rigging-lab/operation-core";
import { describe, expect, it } from "vitest";

import { createEditorWorkflowController } from "../editor-workflow/index.js";
import { createBrowserProjectStore, type StorageLike } from "../project-persistence/index.js";

const BODY_YAW_PARAMETER_ID = "param_ai_body_yaw";
const BODY_YAW_KEYFORM_OPERATION_ID = "op_ai_add_keyform_body_yaw";
const BODY_YAW_KEYFORM_SET_ID = "keyset_mesh_mesh_body_vertices_ai_body_yaw_1";

describe("editor AI keyform command host regression", () => {
  it("dry-runs, approves, commits, inspects, validates, and logs addKeyform", async () => {
    const workflow = createWorkflow(createMemoryStorage());

    await dryRunApproveAndCommitAiParameter(workflow, "body_yaw");

    const keyformDryRunResponse = await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_dry_run_body_yaw_keyform",
        command: "dryRunOperation",
        capabilities: ["dryRunEdit"],
        payload: createAiAddKeyformOperation({
          dryRun: true,
          basePackageRevision: workflow.state.revision.packageRevision
        })
      })
    );

    expect(keyformDryRunResponse).toMatchObject({
      status: "ok",
      command: "dryRunOperation",
      payload: {
        operationResult: {
          status: "dry_run",
          operationId: BODY_YAW_KEYFORM_OPERATION_ID,
          modelDiff: {
            added: [{ kind: "keyformSet", id: BODY_YAW_KEYFORM_SET_ID }]
          }
        }
      }
    });
    expect(workflow.state.revision.packageRevision).toBe(1);
    expect(workflow.state.operationLog.entryCount).toBe(1);

    workflow.aiCommandHost.approvalPolicy.approveDryRunCommand({
      dryRunCommandId: "cmd_ai_dry_run_body_yaw_keyform",
      operationId: BODY_YAW_KEYFORM_OPERATION_ID
    });

    const keyformCommitResponse = await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_commit_body_yaw_keyform",
        command: "commitOperation",
        capabilities: ["commitWithApproval"],
        payload: {
          approvedDryRunCommandId: "cmd_ai_dry_run_body_yaw_keyform",
          operation: createAiAddKeyformOperation({
            dryRun: false,
            basePackageRevision: workflow.state.revision.packageRevision
          })
        }
      })
    );

    expect(keyformCommitResponse).toMatchObject({
      status: "ok",
      command: "commitOperation",
      evidenceRefs: expect.arrayContaining([
        expect.stringMatching(/^runtime\/states\/.+editor-add-keyform-final.+\.runtime-state\.json$/),
        expect.stringMatching(/^runtime\/state-sequences\/.+editor-add-keyform\.runtime-state-sequence\.json$/),
        `operations/log.jsonl#${BODY_YAW_KEYFORM_OPERATION_ID}`
      ]),
      payload: {
        operationResult: {
          status: "committed",
          operationId: BODY_YAW_KEYFORM_OPERATION_ID,
          generatedRuntimeStateRefs: [
            expect.stringMatching(/editor-add-keyform-final/)
          ],
          generatedRuntimeStateSequenceRefs: [
            expect.stringMatching(/editor-add-keyform\.runtime-state-sequence\.json$/)
          ],
          generatedValidationReportIds: [
            "val_editor_ai_add_keyform_body_yaw_baseline",
            "val_editor_ai_add_keyform_body_yaw_candidate"
          ]
        }
      }
    });
    expect(workflow.state.revision.packageRevision).toBe(2);
    expect(workflow.state.operationLog.entryCount).toBe(2);
    expect(workflow.aiCommandHost.transcript.entries).toContainEqual(
      expect.objectContaining({
        entryType: "approval",
        dryRunCommandId: "cmd_ai_dry_run_body_yaw_keyform",
        approvalStatus: "approved",
        operationId: BODY_YAW_KEYFORM_OPERATION_ID
      })
    );

    const inspectResponse = await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_inspect_body_yaw_after_keyform",
        command: "inspectTarget",
        capabilities: ["read"],
        payload: {
          target: {
            kind: "parameter",
            id: BODY_YAW_PARAMETER_ID
          },
          includeReferences: true
        }
      })
    );

    expect(inspectResponse).toMatchObject({
      status: "ok",
      command: "inspectTarget",
      payload: {
        status: "ok",
        target: {
          kind: "parameter",
          id: BODY_YAW_PARAMETER_ID,
          path: "/model/parameters/parameters/0"
        },
        references: expect.arrayContaining([
          {
            kind: "keyformSet",
            id: BODY_YAW_KEYFORM_SET_ID,
            path: "/model/keyforms/keyformSets/0"
          },
          {
            kind: "mesh",
            id: "mesh_body",
            path: "/model/meshes/meshes/mesh_body"
          }
        ])
      }
    });

    const validationResponse = await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_validate_after_keyform",
        command: "validatePackage",
        capabilities: ["validate"],
        payload: {
          profile: "strict",
          packageRevision: workflow.state.revision.packageRevision
        }
      })
    );

    expect(validationResponse).toMatchObject({
      status: "ok",
      command: "validatePackage",
      payload: {
        report: {
          packageId: "pkg_editor_browser_sample",
          packageRevision: 2,
          profile: "strict",
          summary: {
            status: "pass"
          },
          checks: []
        }
      }
    });

    const operationLogResponse = await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_get_keyform_operation_log",
        command: "getOperationLog",
        capabilities: ["read"],
        payload: {
          operationIds: [BODY_YAW_KEYFORM_OPERATION_ID],
          targetIds: [BODY_YAW_KEYFORM_SET_ID],
          surface: "structuredApi"
        }
      })
    );

    expect(operationLogResponse).toMatchObject({
      status: "ok",
      command: "getOperationLog"
    });
    const operationLogEntries = asArray(asRecord(operationLogResponse.payload)["entries"]);
    expect(operationLogEntries).toHaveLength(1);
    const keyformOperationLogEntry = asRecord(operationLogEntries[0]);

    expect(keyformOperationLogEntry).toMatchObject({
      operationId: BODY_YAW_KEYFORM_OPERATION_ID,
      actor: "ai",
      surface: "structuredApi",
      operationType: "addKeyform",
      targetIds: [
        BODY_YAW_KEYFORM_SET_ID,
        BODY_YAW_PARAMETER_ID,
        "mesh_body"
      ],
      validationReportIds: [
        "val_editor_ai_add_keyform_body_yaw_baseline",
        "val_editor_ai_add_keyform_body_yaw_candidate"
      ],
      payload: {
        operationType: "addKeyform",
        payload: {
          target: {
            kind: "mesh",
            id: "mesh_body"
          },
          parameterId: BODY_YAW_PARAMETER_ID
        }
      }
    });
    expect(asArray(keyformOperationLogEntry["runtimeSnapshotIds"])).toEqual(
      expect.arrayContaining([expect.stringMatching(/^snap_/)])
    );
    expect(asRecord(keyformOperationLogEntry["result"])).toMatchObject({
      operationId: BODY_YAW_KEYFORM_OPERATION_ID,
      status: "committed",
      modelDiff: {
        added: [{ kind: "keyformSet", id: BODY_YAW_KEYFORM_SET_ID }]
      }
    });
  });
});

const dryRunApproveAndCommitAiParameter = async (
  workflow: ReturnType<typeof createWorkflow>,
  name: "body_yaw"
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

  const commitResponse = await workflow.aiCommandHost.execute(
    createAiRequest({
      commandId: `cmd_ai_commit_${name}`,
      command: "commitOperation",
      capabilities: ["commitWithApproval"],
      payload: {
        approvedDryRunCommandId: dryRunCommandId,
        operation: createAiCreateParameterOperation({
          name,
          dryRun: false,
          basePackageRevision: workflow.state.revision.packageRevision
        })
      }
    })
  );

  expect(commitResponse).toMatchObject({
    status: "ok",
    payload: {
      operationResult: {
        status: "committed",
        operationId
      }
    }
  });
  expect(workflow.state.parameters.map((parameter) => parameter.parameterId)).toEqual([
    BODY_YAW_PARAMETER_ID
  ]);
};

const createAiRequest = (input: {
  readonly commandId: string;
  readonly command:
    | "inspectTarget"
    | "validatePackage"
    | "dryRunOperation"
    | "commitOperation"
    | "getOperationLog";
  readonly capabilities: readonly ("read" | "dryRunEdit" | "commitWithApproval" | "validate")[];
  readonly payload: unknown;
}) => ({
  schemaVersion: "ai-command-request-v1",
  commandId: input.commandId,
  session: {
    agentId: "agent_editor_ai_keyform_test",
    capabilities: input.capabilities
  },
  basis: {
    packageRevision: 0,
    relatedAC: ["AC-AI-006", "AC-MVP-014"],
    relatedScenarios: ["SC-AGENT-002"]
  },
  command: input.command,
  payload: input.payload
});

const createAiCreateParameterOperation = (input: {
  readonly name: "body_yaw";
  readonly dryRun: boolean;
  readonly basePackageRevision: number;
}) =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: `op_ai_create_parameter_${input.name}`,
    actor: "ai",
    surface: "structuredApi",
    dryRun: input.dryRun,
    basePackageRevision: input.basePackageRevision,
    idempotencyKey: `ai-create-parameter-${input.name}`,
    trace: {
      relatedAC: ["AC-AI-006", "AC-MVP-014"],
      relatedScenarios: ["SC-AGENT-002"]
    },
    operationType: "createParameter",
    payload: {
      parameterId: BODY_YAW_PARAMETER_ID,
      displayName: "AI Body Yaw",
      semanticRole: "body",
      projectPresetAlias: "private-ai-body-yaw-control",
      valueSource: "authoredInput",
      min: -1,
      max: 1,
      default: 0,
      recommendedUiStep: 0.01
    }
  });

const createAiAddKeyformOperation = (input: {
  readonly dryRun: boolean;
  readonly basePackageRevision: number;
}) =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: BODY_YAW_KEYFORM_OPERATION_ID,
    actor: "ai",
    surface: "structuredApi",
    dryRun: input.dryRun,
    basePackageRevision: input.basePackageRevision,
    idempotencyKey: "ai-add-keyform-body-yaw-mesh-body",
    trace: {
      relatedAC: ["AC-AI-006", "AC-MVP-014"],
      relatedScenarios: ["SC-AGENT-002"]
    },
    operationType: "addKeyform",
    payload: {
      target: {
        kind: "mesh",
        id: "mesh_body"
      },
      targetProperty: "vertices",
      parameterId: BODY_YAW_PARAMETER_ID,
      keyValue: 1,
      interpolation: "linear-1d-v1",
      statePatch: {
        propertyPath: "vertices",
        value: [
          { x: 0, y: 0 },
          { x: 36, y: 0 },
          { x: 0, y: 32 }
        ],
        valueSchemaHint: "mesh.vertices"
      }
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

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected an object value.");
  }

  return value as Record<string, unknown>;
};

const asArray = (value: unknown): readonly unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error("Expected an array value.");
  }

  return value;
};

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
