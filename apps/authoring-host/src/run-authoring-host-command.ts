import {
  AiCommandExecutor,
  DiagnosticGatedAutoApprovalPolicy
} from "@private-2d-rigging-lab/ai-interface";
import type {
  AiCommandRequest,
  AiCommandResponse
} from "@private-2d-rigging-lab/ai-interface";
import { serializeOperationLogEntriesToJsonl } from "@private-2d-rigging-lab/operation-core";
import type { OperationRequestDto } from "@private-2d-rigging-lab/operation-core";

import { AuthoringHostCommandHost } from "./authoring-host-command-host.js";
import {
  aiStatusToOutcome,
  type AuthoringHostAutoApprovalReport,
  type AuthoringHostCommandResponse,
  type AuthoringHostOutcome
} from "./authoring-host-response.js";
import { createHostStateStore } from "./host-state-store.js";
import type { HostStateStore } from "./host-state-store.js";
import {
  loadAuthoringPackageDirectory,
  saveAuthoringPackageDirectory
} from "./package-directory-io.js";

export interface RunAuthoringHostCommandInput {
  readonly packageDirectory: string;
  readonly stateDirectory: string;
  readonly command: unknown;
  /** Deterministic clock. Defaults to a fixed timestamp for reproducible output. */
  readonly now?: () => Date;
  /** Operation classes routed back to human approval (auto-approval dial). */
  readonly humanApprovalOperationTypes?: readonly string[];
  readonly stateStore?: HostStateStore;
}

const DEFAULT_HOST_TIMESTAMP = "2026-07-02T00:00:00.000Z";

export const runAuthoringHostCommand = async (
  input: RunAuthoringHostCommandInput
): Promise<AuthoringHostCommandResponse> => {
  const now = input.now ?? (() => new Date(DEFAULT_HOST_TIMESTAMP));
  const stateStore = input.stateStore ?? createHostStateStore(input.stateDirectory);

  const loaded = await loadAuthoringPackageDirectory(input.packageDirectory);
  const hostState = await stateStore.load();

  const autoApprovalPolicy = new DiagnosticGatedAutoApprovalPolicy({
    delegate: hostState.approvalPolicy,
    ...(input.humanApprovalOperationTypes === undefined
      ? {}
      : { humanApprovalOperationTypes: input.humanApprovalOperationTypes })
  });

  const host = new AuthoringHostCommandHost({
    session: loaded.session,
    now,
    initialOperationLogEntries: loaded.operationLogEntries
  });

  const executor = new AiCommandExecutor({
    host,
    approvalPolicy: autoApprovalPolicy,
    transcript: hostState.transcript
  });

  const parsedRequest = safeParseAiCommandRequest(input.command);
  const response = await executor.execute(input.command);

  const autoApproval = maybeAutoApproveDryRun({
    request: parsedRequest,
    response,
    executorApprovalPolicy: executor.approvalPolicy,
    autoApprovalPolicy
  });

  await stateStore.save({
    approvalPolicy: hostState.approvalPolicy,
    transcript: hostState.transcript
  });

  const outcome = aiStatusToOutcome(response.status);
  const saved = await maybePersistPackage({
    outcome,
    request: parsedRequest,
    input,
    host,
    loaded,
    now
  });

  return buildResponse({
    outcome,
    response,
    autoApproval,
    saved,
    packageRevision: host.session.packageRevision
  });
};

interface MaybeAutoApproveInput {
  readonly request: AiCommandRequest | undefined;
  readonly response: AiCommandResponse;
  readonly executorApprovalPolicy: AiCommandExecutor["approvalPolicy"];
  readonly autoApprovalPolicy: DiagnosticGatedAutoApprovalPolicy;
}

const maybeAutoApproveDryRun = (
  input: MaybeAutoApproveInput
): AuthoringHostAutoApprovalReport | undefined => {
  if (input.request?.command !== "dryRunOperation") {
    return undefined;
  }

  const operationResult = input.response.operationResult;
  if (operationResult === undefined) {
    return { evaluated: true, autoApproved: false, reason: "no-operation-result" };
  }

  const decision = input.autoApprovalPolicy.evaluateAutoApproval({
    operationResult,
    operationType: input.request.payload.operationType
  });

  if (!decision.autoApprove) {
    return { evaluated: true, autoApproved: false, reason: decision.reason };
  }

  // Record the mechanical approval through the executor's transcript-wrapped policy so
  // the approval both persists and is written to the command transcript.
  input.executorApprovalPolicy.approveDryRunCommand({
    dryRunCommandId: input.response.commandId,
    ...(operationResult.operationId === undefined
      ? {}
      : { operationId: operationResult.operationId })
  });

  return { evaluated: true, autoApproved: true, reason: decision.reason };
};

interface MaybePersistPackageInput {
  readonly outcome: AuthoringHostOutcome;
  readonly request: AiCommandRequest | undefined;
  readonly input: RunAuthoringHostCommandInput;
  readonly host: AuthoringHostCommandHost;
  readonly loaded: Awaited<ReturnType<typeof loadAuthoringPackageDirectory>>;
  readonly now: () => Date;
}

const maybePersistPackage = async (input: MaybePersistPackageInput): Promise<boolean> => {
  if (input.request?.command !== "commitOperation") {
    return false;
  }

  if (input.outcome !== "success") {
    return false;
  }

  const operationLogText = serializeOperationLogEntriesToJsonl(input.host.operationLogEntries);
  await saveAuthoringPackageDirectory({
    packageDirectory: input.input.packageDirectory,
    session: input.host.session,
    baseDocument: input.loaded.packageDocument,
    workspaceMetadata: input.loaded.workspaceMetadata,
    updatedAt: input.now().toISOString(),
    operationLogText
  });

  return true;
};

interface BuildResponseInput {
  readonly outcome: AuthoringHostOutcome;
  readonly response: AiCommandResponse;
  readonly autoApproval: AuthoringHostAutoApprovalReport | undefined;
  readonly saved: boolean;
  readonly packageRevision: number;
}

const buildResponse = (input: BuildResponseInput): AuthoringHostCommandResponse => ({
  schemaVersion: "authoring-host-command-response-v1",
  outcome: input.outcome,
  command: input.response.command,
  commandId: input.response.commandId,
  aiCommandStatus: input.response.status,
  aiCommandResponse: input.response,
  ...(input.autoApproval === undefined ? {} : { autoApproval: input.autoApproval }),
  saved: input.saved,
  packageRevision: input.packageRevision,
  diagnostics: input.response.diagnostics
});

const safeParseAiCommandRequest = (command: unknown): AiCommandRequest | undefined => {
  if (typeof command !== "object" || command === null) {
    return undefined;
  }

  const candidate = command as { readonly command?: unknown; readonly payload?: unknown };
  if (typeof candidate.command !== "string") {
    return undefined;
  }

  return command as AiCommandRequest;
};
