import { describe, expect, it } from "vitest";

import { OperationLogEntrySchema } from "@private-2d-rigging-lab/operation-core";
import { ValidationReportSchema } from "@private-2d-rigging-lab/validator-core";

import { executeAiReadCommand, type AiReadCommandHost } from "./ai-read-command.js";
import { InMemoryAiCommandTranscript } from "./ai-command-transcript.js";
import type { AiEditorState } from "./ai-editor-state.js";
import type { AiOperationLogQuery } from "./ai-operation-log-query.js";

const operationResult = {
  schemaVersion: "operation-result-v1",
  operationId: "op_create_ai_parameter",
  status: "committed",
  precondition: {
    ok: true,
    diagnostics: []
  },
  reversible: true
} as const;

const createOperationLogEntry = (operationId: string, targetIds: string[], surface = "structuredApi") =>
  OperationLogEntrySchema.parse({
    schemaVersion: "operation-log-entry-v1",
    operationId,
    transactionId: `txn_${operationId}`,
    timestamp: "2026-05-29T00:00:00.000Z",
    actor: "ai",
    surface,
    operationType: "createParameter",
    targetIds,
    precondition: {
      ok: true,
      diagnostics: []
    },
    payload: {
      operationType: "createParameter",
      payload: {
        parameterId: targetIds[0] ?? "param_ai",
        displayName: "AI Parameter",
        semanticRole: "custom",
        min: 0,
        max: 1,
        default: 0.5,
        recommendedUiStep: 0.01
      }
    },
    result: {
      ...operationResult,
      operationId
    },
    provenanceId: `prov_${operationId}`,
    validationReportIds: [],
    runtimeSnapshotIds: [],
    reversible: true
  });

const validationReport = ValidationReportSchema.parse({
  schemaVersion: "validation-report-v1",
  reportId: "val_ai_read_contract",
  createdAt: "2026-05-29T00:00:00.000Z",
  packageId: "pkg_ai_read_contract",
  packageRevision: 7,
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
});

const createReadHost = (overrides: Partial<AiReadCommandHost> = {}): AiReadCommandHost => ({
  getEditorState: () => ({ schemaVersion: "editor-semantic-state-v1", packageRevision: 0 }),
  inspectModel: () => ({ targets: [], editableTargets: [] }),
  inspectTarget: (payload) => ({ target: payload.target, references: [] }),
  validatePackage: () => ({ reportId: validationReport.reportId, report: validationReport }),
  getOperationLog: () => [],
  ...overrides
});

const createReadRequest = (command: string, payload: object, capabilities = ["read"]) => ({
  schemaVersion: "ai-command-request-v1",
  commandId: `cmd_${command}`,
  session: {
    agentId: "agent_test",
    capabilities
  },
  basis: {
    relatedAC: [],
    relatedScenarios: []
  },
  command,
  payload
});

describe("AI read command execution", () => {
  it("returns current package revision and schema version through the host", async () => {
    const host = createReadHost({
      getEditorState: () => ({
        schemaVersion: "editor-semantic-state-v1",
        packageRevision: 7,
        activeMode: "authoring"
      })
    });

    const response = await executeAiReadCommand(createReadRequest("getEditorState", {}), host);

    expect(response).toMatchObject({
      schemaVersion: "ai-command-response-v1",
      status: "ok",
      command: "getEditorState",
      payload: {
        editorState: {
          schemaVersion: "editor-semantic-state-v1",
          packageRevision: 7
        }
      }
    });
  });

  it("filters getOperationLog results by operation ID", async () => {
    const entries = [
      createOperationLogEntry("op_create_ai_parameter", ["param_ai_parameter"]),
      createOperationLogEntry("op_other_parameter", ["param_other"])
    ];
    const observedQueries: AiOperationLogQuery[] = [];
    const host = createReadHost({
      getOperationLog: (query) => {
        observedQueries.push(query);
        return entries;
      }
    });

    const response = await executeAiReadCommand(
      createReadRequest("getOperationLog", { operationIds: ["op_create_ai_parameter"] }),
      host
    );

    expect(observedQueries).toEqual([{ operationIds: ["op_create_ai_parameter"] }]);
    expect(response).toMatchObject({
      status: "ok",
      command: "getOperationLog",
      payload: {
        entries: [
          {
            operationId: "op_create_ai_parameter"
          }
        ]
      }
    });
  });

  it("returns getOperationLog entries when no filter is supplied", async () => {
    const entries = [
      createOperationLogEntry("op_create_ai_parameter", ["param_ai_parameter"]),
      createOperationLogEntry("op_other_parameter", ["param_other"])
    ];
    const host = createReadHost({
      getOperationLog: () => entries
    });

    const response = await executeAiReadCommand(createReadRequest("getOperationLog", {}), host);

    expect(response).toMatchObject({
      status: "ok",
      command: "getOperationLog",
      payload: {
        entries: [
          {
            operationId: "op_create_ai_parameter"
          },
          {
            operationId: "op_other_parameter"
          }
        ]
      }
    });
  });

  it("dispatches inspectModel through the read host", async () => {
    const host = createReadHost({
      inspectModel: (payload) => ({
        targets: [{ kind: "parameter", id: "param_faceYaw" }],
        editableTargets: payload.includeEditorOnly ? [{ kind: "rigControl", id: "rig_face" }] : []
      })
    });

    const response = await executeAiReadCommand(
      createReadRequest("inspectModel", { includeEditorOnly: true }),
      host
    );

    expect(response).toMatchObject({
      status: "ok",
      command: "inspectModel",
      payload: {
        targets: [{ kind: "parameter", id: "param_faceYaw" }],
        editableTargets: [{ kind: "rigControl", id: "rig_face" }]
      }
    });
  });

  it("dispatches inspectTarget through the read host", async () => {
    const host = createReadHost({
      inspectTarget: (payload) => ({
        target: payload.target,
        references: [{ kind: "keyformSet", id: "keyset_faceYaw" }]
      })
    });

    const response = await executeAiReadCommand(
      createReadRequest("inspectTarget", {
        target: { kind: "parameter", id: "param_faceYaw" }
      }),
      host
    );

    expect(response).toMatchObject({
      status: "ok",
      command: "inspectTarget",
      payload: {
        target: { kind: "parameter", id: "param_faceYaw" },
        references: [{ kind: "keyformSet", id: "keyset_faceYaw" }]
      }
    });
  });

  it("dispatches validatePackage through the read host with validate capability", async () => {
    const host = createReadHost({
      validatePackage: (payload) => ({
        reportId: validationReport.reportId,
        report: {
          ...validationReport,
          profile: payload.profile,
          packageRevision: payload.packageRevision ?? validationReport.packageRevision
        }
      })
    });

    const response = await executeAiReadCommand(
      createReadRequest("validatePackage", { profile: "strict", packageRevision: 7 }, ["validate"]),
      host
    );

    expect(response).toMatchObject({
      status: "ok",
      command: "validatePackage",
      payload: {
        reportId: "val_ai_read_contract",
        report: {
          schemaVersion: "validation-report-v1",
          profile: "strict",
          packageRevision: 7
        }
      }
    });
  });

  it("returns permission_denied when read capability is missing", async () => {
    const host = createReadHost();

    const response = await executeAiReadCommand(
      createReadRequest("getEditorState", {}, ["dryRunEdit"]),
      host
    );

    expect(response).toMatchObject({
      status: "permission_denied",
      command: "getEditorState"
    });
  });

  it("returns permission_denied when validatePackage lacks validate capability", async () => {
    const response = await executeAiReadCommand(
      createReadRequest("validatePackage", { profile: "strict" }, ["read"]),
      createReadHost()
    );

    expect(response).toMatchObject({
      status: "permission_denied",
      command: "validatePackage",
      payload: {
        reportId: "val_ai_permission_denied"
      }
    });
  });

  it("returns not_implemented when a supported read command has no host method yet", async () => {
    const host: AiReadCommandHost = {
      getEditorState: () => ({ schemaVersion: "editor-semantic-state-v1", packageRevision: 0 }),
      getOperationLog: () => []
    };

    const response = await executeAiReadCommand(
      createReadRequest("inspectModel", {}, ["read"]),
      host
    );

    expect(response).toMatchObject({
      status: "not_implemented",
      command: "inspectModel",
      payload: {
        targets: [],
        editableTargets: []
      }
    });
  });

  it("records read command responses in the supplied transcript", async () => {
    const transcript = new InMemoryAiCommandTranscript();
    const host = createReadHost({
      getEditorState: () => ({ schemaVersion: "editor-semantic-state-v1", packageRevision: 3 })
    });

    await executeAiReadCommand(createReadRequest("getEditorState", {}), host, transcript);
    await executeAiReadCommand(
      createReadRequest("getOperationLog", {}, ["dryRunEdit"]),
      host,
      transcript
    );

    expect(transcript.entries).toMatchObject([
      {
        entryType: "command",
        commandId: "cmd_getEditorState",
        agentId: "agent_test",
        command: "getEditorState",
        capabilities: ["read"],
        basis: {
          relatedAC: [],
          relatedScenarios: []
        },
        status: "ok"
      },
      {
        entryType: "command",
        commandId: "cmd_getOperationLog",
        agentId: "agent_test",
        command: "getOperationLog",
        capabilities: ["dryRunEdit"],
        basis: {
          relatedAC: [],
          relatedScenarios: []
        },
        status: "permission_denied"
      }
    ]);
  });

  it("does not call operation mutation host methods", async () => {
    let getEditorStateCalls = 0;
    let dryRunOperationCalls = 0;
    let commitOperationCalls = 0;
    const host = {
      ...createReadHost({
        getEditorState: (): AiEditorState => {
          getEditorStateCalls += 1;
          return { schemaVersion: "editor-semantic-state-v1", packageRevision: 3 };
        }
      }),
      dryRunOperation: () => {
        dryRunOperationCalls += 1;
      },
      commitOperation: () => {
        commitOperationCalls += 1;
      }
    };

    await executeAiReadCommand(createReadRequest("getEditorState", {}), host);

    expect(getEditorStateCalls).toBe(1);
    expect(dryRunOperationCalls).toBe(0);
    expect(commitOperationCalls).toBe(0);
  });
});
