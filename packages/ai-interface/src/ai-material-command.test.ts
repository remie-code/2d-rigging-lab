import { describe, expect, it } from "vitest";
import { createMaterialCandidateFixture, MaterialOperationResultSchema } from "@private-2d-rigging-lab/contracts";
import { AiCommandRequestSchema } from "./ai-command-request.js";
import { AiCommandResponseSchema } from "./ai-command-response.js";
import { AiCommandExecutor } from "./ai-command-executor.js";
const c = createMaterialCandidateFixture();
const result = MaterialOperationResultSchema.parse({ schemaVersion: "material-operation-result-v1", operationId: "op_test", operation: "register", status: "completed", candidateId: c.candidateId, candidate: c, basePackage: c.basePackage, changedTargets: [], baseChanged: false, artifacts: [], diagnostics: [] });
const response = (command: string, payload: unknown, status = "ok") => ({ schemaVersion: "ai-command-response-v1", commandId: "test", status, command, payload });
describe("public material envelope", () => {
  it("requires completed result and matching operation for ok; inspect requires snapshot", () => {
    expect(AiCommandResponseSchema.safeParse(response("registerMaterialCandidate", { result })).success).toBe(true);
    expect(AiCommandResponseSchema.safeParse(response("registerMaterialCandidate", {})).success).toBe(false);
    expect(AiCommandResponseSchema.safeParse(response("applyMaterialCandidate", { result })).success).toBe(false);
    expect(AiCommandResponseSchema.safeParse(response("registerMaterialCandidate", { result }, "failed")).success).toBe(false);
    expect(AiCommandResponseSchema.safeParse(response("inspectMaterialCandidate", {})).success).toBe(false);
    expect(AiCommandResponseSchema.safeParse(response("inspectMaterialCandidate", { candidate: c })).success).toBe(true);
  });
  it("registers candidate commands and executor refuses missing capability without host mutation", async () => {
    const request = AiCommandRequestSchema.parse({ schemaVersion: "ai-command-request-v1", commandId: "test", session: { agentId: "test", capabilities: [] }, command: "approveMaterialCandidate", payload: { candidateId: c.candidateId, expectedCandidateRevision: 0 } });
    const executor = new AiCommandExecutor({ host: { dryRunOperation: () => { throw new Error("must not run"); }, commitOperation: () => { throw new Error("must not run"); } } });
    expect((await executor.execute(request)).status).toBe("permission_denied");
    expect((await executor.execute({ ...request, session: { agentId: "test", capabilities: ["commitWithApproval"] } })).status).toBe("not_implemented");
  });
});
