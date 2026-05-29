import { describe, expect, it } from "vitest";

import { OperationLogEntrySchema } from "@private-2d-rigging-lab/operation-core";

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

const createReadRequest = (command: "getEditorState" | "getOperationLog", payload: object, capabilities = ["read"]) => ({
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
    const host: AiReadCommandHost = {
      getEditorState: () => ({
        schemaVersion: "editor-semantic-state-v1",
        packageRevision: 7,
        activeMode: "authoring"
      }),
      getOperationLog: () => []
    };

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
    const host: AiReadCommandHost = {
      getEditorState: () => ({ schemaVersion: "editor-semantic-state-v1", packageRevision: 0 }),
      getOperationLog: (query) => {
        observedQueries.push(query);
        return entries;
      }
    };

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
    const host: AiReadCommandHost = {
      getEditorState: () => ({ schemaVersion: "editor-semantic-state-v1", packageRevision: 0 }),
      getOperationLog: () => entries
    };

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

  it("returns permission_denied when read capability is missing", async () => {
    const host: AiReadCommandHost = {
      getEditorState: () => ({ schemaVersion: "editor-semantic-state-v1", packageRevision: 0 }),
      getOperationLog: () => []
    };

    const response = await executeAiReadCommand(
      createReadRequest("getEditorState", {}, ["dryRunEdit"]),
      host
    );

    expect(response).toMatchObject({
      status: "permission_denied",
      command: "getEditorState"
    });
  });

  it("records read command responses in the supplied transcript", async () => {
    const transcript = new InMemoryAiCommandTranscript();
    const host: AiReadCommandHost = {
      getEditorState: () => ({ schemaVersion: "editor-semantic-state-v1", packageRevision: 3 }),
      getOperationLog: () => []
    };

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
      getEditorState: (): AiEditorState => {
        getEditorStateCalls += 1;
        return { schemaVersion: "editor-semantic-state-v1", packageRevision: 3 };
      },
      getOperationLog: () => [],
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
