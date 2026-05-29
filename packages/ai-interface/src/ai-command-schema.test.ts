import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  AiCapabilitySchema,
  AiCommandNameSchema,
  AiCommandRequestSchema,
  AiCommandResponseSchema
} from "./index.js";

const createParameterOperationRequest = {
  schemaVersion: "operation-request-v1",
  operationId: "op_create_ai_parameter",
  actor: "ai",
  surface: "structuredApi",
  dryRun: true,
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
} as const;

const dryRunOperationResult = {
  schemaVersion: "operation-result-v1",
  operationId: "op_create_ai_parameter",
  status: "dry_run",
  precondition: {
    ok: true,
    diagnostics: []
  },
  modelDiff: {
    schemaVersion: "model-diff-v1",
    baseRevision: 0,
    candidateRevision: 1,
    added: [
      {
        kind: "parameter",
        id: "param_ai_parameter"
      }
    ],
    removed: [],
    changed: [],
    operationIds: ["op_create_ai_parameter"]
  },
  reversible: true
} as const;

const committedOperationResult = {
  ...dryRunOperationResult,
  status: "committed"
} as const;

const operationLogEntry = {
  schemaVersion: "operation-log-entry-v1",
  operationId: "op_create_ai_parameter",
  transactionId: "txn_create_ai_parameter",
  timestamp: "2026-05-29T00:00:00.000Z",
  actor: "ai",
  surface: "structuredApi",
  operationType: "createParameter",
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
    operationType: "createParameter",
    payload: createParameterOperationRequest.payload
  },
  result: committedOperationResult,
  provenanceId: "prov_ai_command",
  reversible: true
} as const;

const validationReport = {
  schemaVersion: "validation-report-v1",
  reportId: "val_ai_read_contract",
  createdAt: "2026-05-29T00:00:00.000Z",
  packageId: "pkg_ai_read_contract",
  packageRevision: 0,
  validatorVersion: "validator-test",
  profile: "strict",
  relatedScenarios: ["SC-AGENT-001"],
  summary: {
    status: "pass",
    highestSeverity: "info",
    counts: {
      info: 0,
      warning: 0,
      error: 0,
      blocking: 0
    }
  },
  checks: [],
  repairCandidates: [],
  evidence: {
    operationLogPresent: false,
    runtimeSnapshotIds: [],
    supplementalGuiEvidenceRefs: []
  }
} as const;

describe("AI command schema foundation", () => {
  it("parses valid minimal command requests", () => {
    const editorStateRequest = AiCommandRequestSchema.parse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_get_editor_state",
      session: {
        agentId: "agent_test",
        capabilities: ["read"]
      },
      basis: {
        packageRevision: 0,
        relatedAC: ["AC-MVP-014"],
        relatedScenarios: ["SC-AGENT-002"]
      },
      command: "getEditorState",
      payload: {}
    });
    const inspectModelRequest = AiCommandRequestSchema.parse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_inspect_model",
      session: {
        agentId: "agent_test",
        capabilities: ["read"]
      },
      basis: {
        relatedAC: ["AC-AGENT-001"],
        relatedScenarios: ["SC-AGENT-001"]
      },
      command: "inspectModel",
      payload: {}
    });
    const inspectTargetRequest = AiCommandRequestSchema.parse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_inspect_target",
      session: {
        agentId: "agent_test",
        capabilities: ["read"]
      },
      basis: {
        relatedAC: ["AC-AGENT-001"],
        relatedScenarios: ["SC-AGENT-001"]
      },
      command: "inspectTarget",
      payload: {
        target: {
          kind: "parameter",
          id: "param_faceYaw"
        }
      }
    });
    const validatePackageRequest = AiCommandRequestSchema.parse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_validate_package",
      session: {
        agentId: "agent_test",
        capabilities: ["validate"]
      },
      basis: {
        packageRevision: 0,
        relatedAC: ["AC-AGENT-001"],
        relatedScenarios: ["SC-AGENT-001"]
      },
      command: "validatePackage",
      payload: {
        profile: "strict"
      }
    });
    const dryRunRequest = AiCommandRequestSchema.parse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_dry_run_create_parameter",
      session: {
        agentId: "agent_test",
        capabilities: ["read", "dryRunEdit"]
      },
      basis: {
        packageRevision: 0,
        relatedAC: [],
        relatedScenarios: []
      },
      command: "dryRunOperation",
      payload: createParameterOperationRequest
    });
    const commitRequest = AiCommandRequestSchema.parse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_commit_create_parameter",
      session: {
        agentId: "agent_test",
        capabilities: ["read", "dryRunEdit", "commitWithApproval"]
      },
      basis: {
        packageRevision: 0,
        relatedAC: [],
        relatedScenarios: []
      },
      command: "commitOperation",
      payload: {
        approvedDryRunCommandId: "cmd_dry_run_create_parameter",
        operation: {
          ...createParameterOperationRequest,
          dryRun: false
        }
      }
    });
    const operationLogRequest = AiCommandRequestSchema.parse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_get_operation_log",
      session: {
        agentId: "agent_test",
        capabilities: ["read"]
      },
      basis: {
        relatedAC: [],
        relatedScenarios: []
      },
      command: "getOperationLog",
      payload: {
        operationIds: ["op_create_ai_parameter"],
        surface: "structuredApi"
      }
    });

    expect(editorStateRequest).toMatchObject({
      command: "getEditorState",
      payload: {
        detail: "summary"
      }
    });
    expect(inspectModelRequest).toMatchObject({
      command: "inspectModel",
      payload: {
        includeEditorOnly: false,
        includeRuntimeOnly: true
      }
    });
    expect(inspectTargetRequest).toMatchObject({
      command: "inspectTarget",
      payload: {
        includeReferences: true,
        target: {
          kind: "parameter",
          id: "param_faceYaw"
        }
      }
    });
    expect(validatePackageRequest).toMatchObject({
      command: "validatePackage",
      payload: {
        profile: "strict"
      }
    });
    expect(dryRunRequest).toMatchObject({
      command: "dryRunOperation",
      payload: {
        dryRun: true
      }
    });
    expect(commitRequest).toMatchObject({
      command: "commitOperation",
      payload: {
        operation: {
          dryRun: false
        }
      }
    });
    expect(operationLogRequest).toMatchObject({
      command: "getOperationLog",
      payload: {
        operationIds: ["op_create_ai_parameter"]
      }
    });
  });

  it("parses valid minimal command responses", () => {
    const editorStateResponse = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: "cmd_get_editor_state",
      status: "ok",
      command: "getEditorState",
      payload: {
        editorState: {
          schemaVersion: "editor-semantic-state-v1",
          packageRevision: 0,
          activeMode: "authoring"
        }
      }
    });
    const inspectModelResponse = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: "cmd_inspect_model",
      status: "ok",
      command: "inspectModel",
      payload: {
        targets: [
          {
            kind: "parameter",
            id: "param_faceYaw"
          }
        ]
      }
    });
    const inspectTargetResponse = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: "cmd_inspect_target",
      status: "ok",
      command: "inspectTarget",
      payload: {
        target: {
          kind: "parameter",
          id: "param_faceYaw"
        }
      }
    });
    const validatePackageResponse = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: "cmd_validate_package",
      status: "ok",
      command: "validatePackage",
      payload: {
        reportId: "val_ai_read_contract",
        report: validationReport
      }
    });
    const dryRunResponse = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: "cmd_dry_run_create_parameter",
      status: "ok",
      modelDiff: dryRunOperationResult.modelDiff,
      operationResult: dryRunOperationResult,
      evidenceRefs: ["runtime/snapshots/snap_ai_preview.runtime-snapshot.json"],
      command: "dryRunOperation",
      payload: {
        operationResult: dryRunOperationResult
      }
    });
    const commitResponse = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: "cmd_commit_create_parameter",
      status: "ok",
      operationResult: committedOperationResult,
      evidenceRefs: ["operations/log.jsonl#op_create_ai_parameter"],
      command: "commitOperation",
      payload: {
        operationResult: committedOperationResult
      }
    });
    const operationLogResponse = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: "cmd_get_operation_log",
      status: "ok",
      command: "getOperationLog",
      payload: {
        entries: [operationLogEntry]
      }
    });

    expect(editorStateResponse).toMatchObject({
      payload: {
        editorState: {
          packageRevision: 0
        }
      }
    });
    expect(editorStateResponse.diagnostics).toEqual([]);
    expect(inspectModelResponse).toMatchObject({
      payload: {
        targets: [
          {
            id: "param_faceYaw"
          }
        ],
        editableTargets: []
      }
    });
    expect(inspectTargetResponse).toMatchObject({
      payload: {
        target: {
          id: "param_faceYaw"
        },
        references: []
      }
    });
    expect(validatePackageResponse).toMatchObject({
      payload: {
        reportId: "val_ai_read_contract",
        report: {
          schemaVersion: "validation-report-v1"
        }
      }
    });
    expect(dryRunResponse).toMatchObject({
      payload: {
        operationResult: {
          status: "dry_run"
        }
      }
    });
    expect(dryRunResponse.evidenceRefs).toEqual(["runtime/snapshots/snap_ai_preview.runtime-snapshot.json"]);
    expect(commitResponse).toMatchObject({
      payload: {
        operationResult: {
          status: "committed"
        }
      }
    });
    expect(operationLogResponse).toMatchObject({
      payload: {
        entries: [
          {
            operationType: "createParameter"
          }
        ]
      }
    });
  });

  it("rejects dryRunOperation requests when the operation is not dry-run", () => {
    const result = AiCommandRequestSchema.safeParse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_invalid_dry_run",
      session: {
        agentId: "agent_test",
        capabilities: ["dryRunEdit"]
      },
      basis: {
        relatedAC: [],
        relatedScenarios: []
      },
      command: "dryRunOperation",
      payload: {
        ...createParameterOperationRequest,
        dryRun: false
      }
    });

    expect(result.success).toBe(false);
  });

  it("rejects commitOperation requests when the nested operation is dry-run", () => {
    const result = AiCommandRequestSchema.safeParse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_invalid_commit",
      session: {
        agentId: "agent_test",
        capabilities: ["commitWithApproval"]
      },
      basis: {
        relatedAC: [],
        relatedScenarios: []
      },
      command: "commitOperation",
      payload: {
        approvedDryRunCommandId: "cmd_dry_run_create_parameter",
        operation: createParameterOperationRequest
      }
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid capabilities and command names", () => {
    expect(AiCapabilitySchema.safeParse("mutateDirectly").success).toBe(false);
    expect(AiCommandNameSchema.parse("inspectModel")).toBe("inspectModel");
    expect(AiCommandNameSchema.parse("inspectTarget")).toBe("inspectTarget");
    expect(AiCommandNameSchema.parse("validatePackage")).toBe("validatePackage");
    expect(AiCommandNameSchema.safeParse("getRuntimeSnapshot").success).toBe(false);
    expect(
      AiCommandRequestSchema.safeParse({
        schemaVersion: "ai-command-request-v1",
        commandId: "cmd_invalid_command",
        session: {
          agentId: "agent_test",
          capabilities: ["read"]
        },
        basis: {
          relatedAC: [],
          relatedScenarios: []
        },
        command: "getRuntimeSnapshot",
        payload: {}
      }).success
    ).toBe(false);
  });

  it("keeps the public index as a barrel-only entrypoint", () => {
    const sourceDirectory = dirname(fileURLToPath(import.meta.url));
    const indexText = readFileSync(join(sourceDirectory, "index.ts"), "utf8");
    const nonBarrelLines = indexText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !line.startsWith("export "));

    expect(nonBarrelLines).toEqual([]);
  });
});
