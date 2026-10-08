import type {
  OperationRequestDto,
  OperationResultDto
} from "@private-2d-rigging-lab/operation-core";
import { ValidationReportSchema } from "@private-2d-rigging-lab/validator-core";
import { describe, expect, it } from "vitest";

import { AiCommandExecutor } from "./ai-command-executor.js";
import type { AiOperationCommandHost } from "./ai-command-host.js";
import type { AiReadCommandHost } from "./ai-read-command.js";
import { InMemoryAiCommandTranscript } from "./ai-command-transcript.js";

const agentId = "agent_test";

class NoopOperationHost implements AiOperationCommandHost {
  dryRunOperation(_request: OperationRequestDto): OperationResultDto {
    throw new Error("dryRunOperation should not be called by read dispatch");
  }

  commitOperation(_request: OperationRequestDto): OperationResultDto {
    throw new Error("commitOperation should not be called by read dispatch");
  }
}

const healthyReport = ValidationReportSchema.parse({
  schemaVersion: "validation-report-v1",
  reportId: "val_executor_read_integration",
  createdAt: "2026-07-02T00:00:00.000Z",
  packageId: "pkg_executor_read_integration",
  packageRevision: 3,
  validatorVersion: "validator-test",
  profile: "strict",
  relatedScenarios: [],
  summary: {
    status: "pass",
    highestSeverity: "info",
    counts: { info: 0, warning: 0, error: 0, blocking: 0 }
  },
  checks: [],
  repairCandidates: [],
  evidence: {
    operationLogPresent: false,
    runtimeSnapshotIds: [],
    supplementalGuiEvidenceRefs: []
  }
});

/** A read host implementing only validatePackage — every other read command is unimplemented. */
const validateOnlyReadHost: AiReadCommandHost = {
  validatePackage: (payload) => ({
    reportId: healthyReport.reportId,
    report: {
      ...healthyReport,
      profile: payload.profile,
      packageRevision: payload.packageRevision ?? healthyReport.packageRevision
    }
  })
};

const createReadRequest = (command: string, payload: object, capabilities: readonly string[]) => ({
  schemaVersion: "ai-command-request-v1",
  commandId: `cmd_${command}`,
  session: { agentId, capabilities },
  basis: { relatedAC: [], relatedScenarios: [] },
  command,
  payload
});

describe("AiCommandExecutor read-command integration", () => {
  it("dispatches validatePackage through the read host and returns ok", async () => {
    const executor = new AiCommandExecutor({
      host: new NoopOperationHost(),
      readHost: validateOnlyReadHost
    });

    const response = await executor.execute(
      createReadRequest("validatePackage", { profile: "strict", packageRevision: 3 }, ["validate"])
    );

    expect(response).toMatchObject({
      status: "ok",
      command: "validatePackage",
      payload: {
        reportId: "val_executor_read_integration",
        report: { schemaVersion: "validation-report-v1", profile: "strict", packageRevision: 3 }
      }
    });
  });

  it("returns not_implemented for a supported read command the host does not implement", async () => {
    const executor = new AiCommandExecutor({
      host: new NoopOperationHost(),
      readHost: validateOnlyReadHost
    });

    const response = await executor.execute(
      createReadRequest("getEditorState", {}, ["read"])
    );

    expect(response).toMatchObject({ status: "not_implemented", command: "getEditorState" });
  });

  it("returns not_implemented for getOperationLog when the host does not implement it", async () => {
    const executor = new AiCommandExecutor({
      host: new NoopOperationHost(),
      readHost: validateOnlyReadHost
    });

    const response = await executor.execute(createReadRequest("getOperationLog", {}, ["read"]));

    expect(response).toMatchObject({ status: "not_implemented", command: "getOperationLog" });
  });

  it("returns permission_denied when validatePackage lacks the validate capability", async () => {
    const executor = new AiCommandExecutor({
      host: new NoopOperationHost(),
      readHost: validateOnlyReadHost
    });

    const response = await executor.execute(
      createReadRequest("validatePackage", { profile: "strict" }, ["read"])
    );

    expect(response).toMatchObject({ status: "permission_denied", command: "validatePackage" });
  });

  it("records read-command responses in the executor's transcript exactly once", async () => {
    const transcript = new InMemoryAiCommandTranscript();
    const executor = new AiCommandExecutor({
      host: new NoopOperationHost(),
      readHost: validateOnlyReadHost,
      transcript
    });

    await executor.execute(
      createReadRequest("validatePackage", { profile: "strict", packageRevision: 3 }, ["validate"])
    );

    const validateEntries = transcript.entries.filter(
      (entry) => entry.entryType === "command" && entry.command === "validatePackage"
    );
    expect(validateEntries).toHaveLength(1);
    expect(validateEntries[0]).toMatchObject({
      commandId: "cmd_validatePackage",
      agentId,
      status: "ok"
    });
  });

  it("falls back to legacy not_implemented when no read host is configured", async () => {
    const executor = new AiCommandExecutor({ host: new NoopOperationHost() });

    const response = await executor.execute(
      createReadRequest("validatePackage", { profile: "strict", packageRevision: 0 }, ["validate"])
    );

    expect(response).toMatchObject({
      status: "not_implemented",
      command: "validatePackage",
      payload: { reportId: "val_ai_operation_executor_not_implemented" }
    });
  });
});
