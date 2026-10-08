import { DiagnosticSchema } from "@private-2d-rigging-lab/contracts";
import { MaterialHostError } from "./material-host-error.js";
import { withMaterialPackageLock } from "./material-package-transaction.js";
import { isMaterialCommand, runMaterialCommand } from "./run-material-command.js";
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
import {
  isRenderViewCommand,
  runRenderViewCommand
} from "./run-render-view-command.js";
import { isStateDirectoryInsidePackageDirectory } from "./state-directory-guard.js";

export class AuthoringHostStateDirectoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthoringHostStateDirectoryError";
  }
}

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

const runUnlockedAuthoringHostCommand = async (
  input: RunAuthoringHostCommandInput
): Promise<AuthoringHostCommandResponse> => {
  if (isMaterialCommand(input.command)) return runMaterialCommand(input);
  const now = input.now ?? (() => new Date(DEFAULT_HOST_TIMESTAMP));

  // Guard against writing approval/transcript state inside the package directory even on
  // the direct (non-CLI) entry path. The CLI argument parser also rejects this earlier,
  // so this is defense-in-depth for callers that bypass argument parsing. A custom
  // state store is exempt: it manages its own location.
  if (
    input.stateStore === undefined &&
    isStateDirectoryInsidePackageDirectory(input.packageDirectory, input.stateDirectory)
  ) {
    throw new AuthoringHostStateDirectoryError(
      `stateDirectory (${input.stateDirectory}) must live outside packageDirectory (${input.packageDirectory}); ` +
        "writing approval/transcript state inside the package directory would corrupt the package."
    );
  }

  const stateStore = input.stateStore ?? createHostStateStore(input.stateDirectory);

  const loaded = await loadAuthoringPackageDirectory(input.packageDirectory);

  // renderView is a non-mutating perception command handled entirely in the
  // authoring-host (the ai-interface executor is renderer/filesystem-free). It
  // renders against the loaded session and writes PNG + sidecar files; it never
  // advances the package revision or touches the approval transcript.
  if (isRenderViewCommand(input.command)) {
    return runRenderViewCommand({
      command: input.command,
      session: loaded.session,
      packageDirectory: input.packageDirectory
    });
  }

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
    initialOperationLogEntries: loaded.operationLogEntries,
    packageDocument: loaded.packageDocument
  });

  const executor = new AiCommandExecutor({
    host,
    // The same host serves both operation (dry-run/commit) and read (validatePackage)
    // dispatch. Read commands flow through the shared read mechanism via readHost.
    readHost: host,
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

export const runAuthoringHostCommand = async (input: RunAuthoringHostCommandInput): Promise<AuthoringHostCommandResponse> => {
  try { return await withMaterialPackageLock(input.packageDirectory, () => runUnlockedAuthoringHostCommand(input)); }
  catch (error) {
    if (!(error instanceof MaterialHostError) || error.code !== "package-busy") throw error;
    const raw = input.command as { command?: unknown; commandId?: unknown } | null;
    return { schemaVersion: "authoring-host-command-response-v1", outcome: "rejected", command: typeof raw?.command === "string" ? raw.command : "unknown",
      ...(typeof raw?.commandId === "string" ? { commandId: raw.commandId } : {}), aiCommandStatus: "rejected", saved: false,
      diagnostics: [DiagnosticSchema.parse({ checkId: "material.packageBusy", status: "fail", severity: "error", phase: "authoring-host", target: { kind: "operation", id: "op_authoring_lock" }, message: error.message })] };
  }
};
