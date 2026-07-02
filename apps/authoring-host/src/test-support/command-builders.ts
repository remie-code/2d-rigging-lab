// Test-only builders for the AI command envelopes the host executes. Keeping these in one
// place lets each test focus on the operation payload rather than the ai-command-request-v1
// envelope boilerplate.

export const HEADLESS_AGENT_ID = "agent_headless";

export interface OperationPayloadInput {
  readonly operationType: string;
  readonly operationId: string;
  readonly basePackageRevision: number;
  readonly payload: unknown;
  readonly dryRun: boolean;
}

const buildOperationRequest = (input: OperationPayloadInput): unknown => ({
  schemaVersion: "operation-request-v1",
  operationId: input.operationId,
  actor: "ai",
  surface: "structuredApi",
  dryRun: input.dryRun,
  basePackageRevision: input.basePackageRevision,
  operationType: input.operationType,
  payload: input.payload,
  trace: { relatedAC: [], relatedScenarios: [] }
});

export const buildDryRunCommand = (input: {
  readonly commandId: string;
  readonly operation: Omit<OperationPayloadInput, "dryRun">;
}): unknown => ({
  schemaVersion: "ai-command-request-v1",
  commandId: input.commandId,
  session: {
    agentId: HEADLESS_AGENT_ID,
    capabilities: ["dryRunEdit", "commitWithApproval"]
  },
  basis: { relatedAC: [], relatedScenarios: [] },
  command: "dryRunOperation",
  payload: buildOperationRequest({ ...input.operation, dryRun: true })
});

export const buildCommitCommand = (input: {
  readonly commandId: string;
  readonly approvedDryRunCommandId: string;
  readonly operation: Omit<OperationPayloadInput, "dryRun">;
}): unknown => ({
  schemaVersion: "ai-command-request-v1",
  commandId: input.commandId,
  session: {
    agentId: HEADLESS_AGENT_ID,
    capabilities: ["dryRunEdit", "commitWithApproval"]
  },
  basis: { relatedAC: [], relatedScenarios: [] },
  command: "commitOperation",
  payload: {
    approvedDryRunCommandId: input.approvedDryRunCommandId,
    operation: buildOperationRequest({ ...input.operation, dryRun: false })
  }
});

export const createParameterPayload = (input: {
  readonly parameterId: string;
  readonly displayName: string;
  readonly min: number;
  readonly max: number;
  readonly default: number;
}): unknown => ({
  parameterId: input.parameterId,
  displayName: input.displayName,
  valueSource: "authoredInput",
  min: input.min,
  max: input.max,
  default: input.default,
  recommendedUiStep: 0.01
});
