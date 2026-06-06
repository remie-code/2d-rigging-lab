import type { DiagnosticDto } from "@private-2d-rigging-lab/contracts";
import { CheckIdSchema, OperationIdSchema } from "@private-2d-rigging-lab/contracts";
import type { OperationResultDto } from "@private-2d-rigging-lab/operation-core";
import { OperationResultSchema } from "@private-2d-rigging-lab/operation-core";

import type { AiApprovalPolicy } from "./ai-approval-policy.js";
import { AiCommandRequestSchema, type AiCommandRequest } from "./ai-command-request.js";
import { AiCommandResponseSchema, type AiCommandResponse, type AiCommandStatus } from "./ai-command-response.js";
import {
  appendAiCommandResponseToTranscript,
  type AiCommandTranscript
} from "./ai-command-transcript.js";
import {
  AiPsdImportPlanCommandResultSchema,
  createAiPsdImportPlanApprovalContextDigest,
  createEmptyAiPsdImportPlanCommandResult,
  parseAiPsdImportPlanCommandHostResult,
  type AiPsdImportPlanCommandHost,
  type AiPsdImportPlanCommandHostResult
} from "./ai-psd-import-plan-command.js";

type PsdImportPlanCommandName =
  | "getPsdImportPlanState"
  | "setPsdImportPlanApproval"
  | "preflightPsdImportPlanIntake"
  | "executePsdImportPlanIntake";

type PsdImportPlanCommandRequest = Extract<
  AiCommandRequest,
  { readonly command: PsdImportPlanCommandName }
>;

export interface ExecuteAiPsdImportPlanCommandOptions {
  readonly host?: AiPsdImportPlanCommandHost;
  readonly approvalPolicy: AiApprovalPolicy;
  readonly transcript?: AiCommandTranscript;
}

export const isAiPsdImportPlanCommandRequest = (
  request: AiCommandRequest
): request is PsdImportPlanCommandRequest =>
  request.command === "getPsdImportPlanState" ||
  request.command === "setPsdImportPlanApproval" ||
  request.command === "preflightPsdImportPlanIntake" ||
  request.command === "executePsdImportPlanIntake";

export const executeAiPsdImportPlanCommand = async (
  requestInput: unknown,
  options: ExecuteAiPsdImportPlanCommandOptions
): Promise<AiCommandResponse> => {
  const request = AiCommandRequestSchema.parse(requestInput);
  if (!isAiPsdImportPlanCommandRequest(request)) {
    throw new Error(`Unsupported PSD import-plan command: ${request.command}.`);
  }

  const capabilityStatus = checkCapability(request);
  if (capabilityStatus !== "ok") {
    return recordPsdImportPlanResponse(
      request,
      createPsdImportPlanResponse({
        request,
        status: capabilityStatus.status,
        result: createEmptyAiPsdImportPlanCommandResult([{
          checkId: "ai.permissionDenied",
          severity: "error",
          message: capabilityStatus.reason
        }])
      }),
      options.transcript
    );
  }

  if (options.host === undefined) {
    return recordPsdImportPlanResponse(
      request,
      createPsdImportPlanResponse({
        request,
        status: "not_implemented",
        result: createEmptyAiPsdImportPlanCommandResult([{
          checkId: "ai.psdImportPlanCommand.hostMissing",
          severity: "error",
          message: "The current command host does not expose PSD import-plan workflow commands."
        }])
      }),
      options.transcript
    );
  }

  if (request.command === "executePsdImportPlanIntake") {
    const approvalContextDigest = await createAiPsdImportPlanApprovalContextDigest({
      payload: request.payload,
      operationId: request.payload.expectedOperationId
    });
    const approvalCheck = options.approvalPolicy.checkCommitApproval({
      approvedDryRunCommandId: request.payload.approvedPreflightCommandId,
      agentId: request.session.agentId,
      operationId: request.payload.expectedOperationId,
      approvalContextDigest
    });
    if (approvalCheck.status !== "approved") {
      return recordPsdImportPlanResponse(
        request,
        createPsdImportPlanResponse({
          request,
          status: approvalCheck.status,
          result: createEmptyAiPsdImportPlanCommandResult([{
            checkId: approvalCheck.status === "needs_approval"
              ? "ai.approvalRequired"
              : "ai.approvalRejected",
            severity: "error",
            message: approvalCheck.reason ?? "PSD import-plan execution requires approval."
          }])
        }),
        options.transcript
      );
    }
  }

  try {
    const hostResult = await callHost(request, options.host);
    const parsed = parseAiPsdImportPlanCommandHostResult(hostResult);
    const operationResult = parsed.operationResult === undefined
      ? undefined
      : OperationResultSchema.parse(parsed.operationResult);

    if (
      request.command === "preflightPsdImportPlanIntake" &&
      operationResult?.status === "dry_run"
    ) {
      const approvalContextDigest = await createAiPsdImportPlanApprovalContextDigest({
        payload: request.payload,
        operationId: operationResult.operationId
      });
      options.approvalPolicy.recordDryRun({
        dryRunCommandId: request.commandId,
        agentId: request.session.agentId,
        operationId: operationResult.operationId,
        approvalContextDigest
      });
    }

    return recordPsdImportPlanResponse(
      request,
      createPsdImportPlanResponse({
        request,
        status: deriveResponseStatus(request, operationResult),
        result: parsed.result,
        operationResult,
        diagnostics: parsed.diagnostics,
        evidenceRefs: parsed.evidenceRefs,
        includeOperationLogRef:
          request.command === "executePsdImportPlanIntake" &&
          operationResult?.status === "committed"
      }),
      options.transcript
    );
  } catch (error) {
    return recordPsdImportPlanResponse(
      request,
      createPsdImportPlanResponse({
        request,
        status: "failed",
        result: createEmptyAiPsdImportPlanCommandResult([{
          checkId: "ai.psdImportPlanCommand.failed",
          severity: "error",
          message: error instanceof Error ? error.message : "PSD import-plan command failed."
        }])
      }),
      options.transcript
    );
  }
};

const callHost = (
  request: PsdImportPlanCommandRequest,
  host: AiPsdImportPlanCommandHost
): Promise<AiPsdImportPlanCommandHostResult> | AiPsdImportPlanCommandHostResult => {
  switch (request.command) {
    case "getPsdImportPlanState":
      return Promise.resolve(host.getPsdImportPlanState(request.payload)).then((result) => ({
        result
      }));
    case "setPsdImportPlanApproval":
      return Promise.resolve(host.setPsdImportPlanApproval(request.payload)).then((result) => ({
        result
      }));
    case "preflightPsdImportPlanIntake":
      return host.preflightPsdImportPlanIntake(request.payload);
    case "executePsdImportPlanIntake":
      return host.executePsdImportPlanIntake(request.payload);
  }
};

const checkCapability = (
  request: PsdImportPlanCommandRequest
): "ok" | { readonly status: "permission_denied"; readonly reason: string } => {
  switch (request.command) {
    case "getPsdImportPlanState":
      return request.session.capabilities.includes("read")
        ? "ok"
        : {
            status: "permission_denied",
            reason: "getPsdImportPlanState requires the read capability."
          };
    case "setPsdImportPlanApproval":
    case "preflightPsdImportPlanIntake":
      return request.session.capabilities.includes("dryRunEdit")
        ? "ok"
        : {
            status: "permission_denied",
            reason: `${request.command} requires the dryRunEdit capability.`
          };
    case "executePsdImportPlanIntake":
      return request.session.capabilities.includes("commitWithApproval")
        ? "ok"
        : {
            status: "permission_denied",
            reason: "executePsdImportPlanIntake requires the commitWithApproval capability."
          };
  }
};

const deriveResponseStatus = (
  request: PsdImportPlanCommandRequest,
  operationResult: OperationResultDto | undefined
): AiCommandStatus => {
  if (operationResult === undefined) {
    return "ok";
  }

  if (operationResult.status === "rejected") {
    return "rejected";
  }

  if (
    request.command === "preflightPsdImportPlanIntake" &&
    operationResult.status !== "dry_run"
  ) {
    return "failed";
  }

  if (
    request.command === "executePsdImportPlanIntake" &&
    operationResult.status !== "committed"
  ) {
    return "failed";
  }

  return "ok";
};

const createPsdImportPlanResponse = (input: {
  readonly request: AiCommandRequest;
  readonly status: AiCommandStatus;
  readonly result: unknown;
  readonly operationResult?: OperationResultDto | undefined;
  readonly diagnostics?: readonly DiagnosticDto[] | undefined;
  readonly evidenceRefs?: readonly string[] | undefined;
  readonly includeOperationLogRef?: boolean | undefined;
}): AiCommandResponse => {
  const result = AiPsdImportPlanCommandResultSchema.parse(input.result);
  const operationResult = input.operationResult === undefined
    ? undefined
    : OperationResultSchema.parse(input.operationResult);
  const diagnostics = [
    ...result.diagnostics.map(createDiagnosticFromPsdDiagnostic),
    ...(input.diagnostics ?? []),
    ...(operationResult?.diagnostics ?? [])
  ];
  const evidenceRefs = sortAndDedupeStrings([
    ...result.evidenceRefs,
    ...result.latestBatch.evidenceRefs,
    ...(input.evidenceRefs ?? []),
    ...collectOperationEvidenceRefs(operationResult, input.includeOperationLogRef === true)
  ]);

  return AiCommandResponseSchema.parse({
    schemaVersion: "ai-command-response-v1",
    commandId: input.request.commandId,
    status: input.status,
    diagnostics,
    ...(operationResult?.modelDiff === undefined ? {} : { modelDiff: operationResult.modelDiff }),
    ...(operationResult?.runtimeDiff === undefined ? {} : { runtimeDiff: operationResult.runtimeDiff }),
    ...(operationResult?.validationDiff === undefined ? {} : { validationDiff: operationResult.validationDiff }),
    ...(operationResult === undefined ? {} : { operationResult }),
    evidenceRefs,
    command: input.request.command,
    payload: {
      result,
      ...(operationResult === undefined ? {} : { operationResult })
    }
  });
};

const createDiagnosticFromPsdDiagnostic = (
  diagnostic: { readonly checkId: string; readonly severity: string; readonly message: string }
): DiagnosticDto => ({
  checkId: CheckIdSchema.parse(diagnostic.checkId),
  status: diagnostic.severity === "info" ? "pass" : "fail",
  severity: diagnostic.severity === "blocking" ? "blocking" : (diagnostic.severity as DiagnosticDto["severity"]),
  phase: "ai-psd-import-plan-command",
  target: {
    kind: "operation",
    id: OperationIdSchema.parse("op_ai_psd_import_plan_command")
  },
  message: diagnostic.message,
  evidence: [],
  relatedAC: [],
  relatedScenarios: [],
  repairCandidateIds: []
});

const recordPsdImportPlanResponse = (
  request: AiCommandRequest,
  response: AiCommandResponse,
  transcript: AiCommandTranscript | undefined
): AiCommandResponse => {
  if (transcript !== undefined) {
    appendAiCommandResponseToTranscript({
      transcript,
      request,
      response
    });
  }

  return response;
};

const collectOperationEvidenceRefs = (
  operationResult: OperationResultDto | undefined,
  includeOperationLogRef: boolean
): readonly string[] => {
  if (operationResult === undefined) {
    return [];
  }

  const refs = [
    ...operationResult.generatedRuntimeStateRefs,
    ...operationResult.generatedRuntimeStateSequenceRefs,
    ...operationResult.generatedRuntimeSnapshotIds.map(
      (snapshotId) => `runtime/snapshots/${snapshotId}.runtime-snapshot.json`
    ),
    ...operationResult.generatedValidationReportIds.map(
      (reportId) => `validation/reports/${reportId}.validation-report.json`
    ),
    ...(operationResult.psdLayerMaterializationBatchEvidence ?? []).flatMap((evidence) => [
      ...(evidence.evidenceId === undefined
        ? []
        : [`operations/${operationResult.operationId}#${evidence.evidenceId}`]),
      ...evidence.entries.flatMap((entry) =>
        entry.resultRefs === undefined
          ? []
          : [
              `operations/${operationResult.operationId}#${entry.resultRefs.materializationEvidenceId}`,
              `operations/${operationResult.operationId}#${entry.resultRefs.materializationId}`,
              ...([
                entry.resultRefs.partId,
                entry.resultRefs.drawableId,
                entry.resultRefs.textureId,
                entry.resultRefs.meshId
              ].map((targetId) => `operations/${operationResult.operationId}#${targetId}`))
            ]
      )
    ])
  ];

  if (includeOperationLogRef) {
    refs.push(`operations/log.jsonl#${operationResult.operationId}`);
  }

  return sortAndDedupeStrings(refs);
};

const sortAndDedupeStrings = (values: readonly string[]): readonly string[] =>
  [...new Set(values.filter((value) => value.trim().length > 0))].sort();
