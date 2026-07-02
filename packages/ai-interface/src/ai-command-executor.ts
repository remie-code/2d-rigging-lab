import type { DiagnosticDto } from "@private-2d-rigging-lab/contracts";
import { CheckIdSchema, OperationIdSchema } from "@private-2d-rigging-lab/contracts";
import type { OperationRequestDto, OperationResultDto } from "@private-2d-rigging-lab/operation-core";
import { OperationResultSchema } from "@private-2d-rigging-lab/operation-core";
import { ValidationReportSchema } from "@private-2d-rigging-lab/validator-core";

import type { AiCapability } from "./ai-capability.js";
import { InMemoryAiApprovalPolicy } from "./ai-approval-policy.js";
import type { AiApprovalPolicy } from "./ai-approval-policy.js";
import { AiCommandRequestSchema } from "./ai-command-request.js";
import type { AiCommandRequest } from "./ai-command-request.js";
import { AiCommandResponseSchema } from "./ai-command-response.js";
import type { AiCommandResponse, AiCommandStatus } from "./ai-command-response.js";
import {
  InMemoryAiCommandTranscript,
  appendAiApprovalToTranscript,
  appendAiCommandResponseToTranscript
} from "./ai-command-transcript.js";
import type { AiCommandTranscript } from "./ai-command-transcript.js";
import type { AiOperationCommandHost } from "./ai-command-host.js";
import type { RenderViewResult } from "./ai-render-view-command.js";
import { executeAiReadCommand } from "./ai-read-command.js";
import type { AiReadCommandHost } from "./ai-read-command.js";

type DryRunCommandRequest = Extract<AiCommandRequest, { command: "dryRunOperation" }>;
type CommitCommandRequest = Extract<AiCommandRequest, { command: "commitOperation" }>;
/**
 * read-style commands the {@link executeAiReadCommand} mechanism supports and that
 * are dispatched through the injected {@link AiReadCommandHost} when one is present.
 */
type DispatchableReadCommandRequest = Extract<
  AiCommandRequest,
  {
    command:
      | "getEditorState"
      | "inspectModel"
      | "inspectTarget"
      | "inspectEvaluatedGeometry"
      | "validatePackage"
      | "getOperationLog";
  }
>;
type UnsupportedReadCommandRequest = Extract<
  AiCommandRequest,
  {
    command:
      | "getEditorState"
      | "inspectModel"
      | "inspectTarget"
      | "inspectEvaluatedGeometry"
      | "validatePackage"
      | "getOperationLog"
      | "renderView"
      | "getPsdImportPlanState"
      | "setPsdImportPlanApproval"
      | "preflightPsdImportPlanIntake"
      | "executePsdImportPlanIntake";
  }
>;
type RenderViewCommandRequest = Extract<AiCommandRequest, { command: "renderView" }>;

export interface AiCommandExecutorOptions {
  readonly host: AiOperationCommandHost;
  readonly approvalPolicy?: AiApprovalPolicy;
  readonly transcript?: AiCommandTranscript;
  /**
   * Optional read-command host. When provided, the five read commands supported by
   * {@link executeAiReadCommand} (getEditorState / inspectModel / inspectTarget /
   * validatePackage / getOperationLog) are dispatched through it with the executor's
   * own transcript, so capability checks, permission_denied / not_implemented / ok
   * resolution, and transcript recording all flow through the shared read mechanism.
   * When absent, those commands fall back to the legacy not_implemented behavior.
   * PSD import plan read commands are never routed here and always return
   * not_implemented from the executor.
   */
  readonly readHost?: AiReadCommandHost;
}

export class AiCommandExecutor {
  readonly #host: AiOperationCommandHost;
  readonly #approvalPolicy: AiApprovalPolicy;
  readonly #transcript: AiCommandTranscript;
  readonly #readHost: AiReadCommandHost | undefined;

  constructor(options: AiCommandExecutorOptions) {
    this.#host = options.host;
    this.#transcript = options.transcript ?? new InMemoryAiCommandTranscript();
    this.#approvalPolicy = new TranscriptingAiApprovalPolicy(
      options.approvalPolicy ?? new InMemoryAiApprovalPolicy(),
      this.#transcript
    );
    this.#readHost = options.readHost;
  }

  get approvalPolicy(): AiApprovalPolicy {
    return this.#approvalPolicy;
  }

  get transcript(): AiCommandTranscript {
    return this.#transcript;
  }

  async execute(input: unknown): Promise<AiCommandResponse> {
    const request = AiCommandRequestSchema.parse(input);

    switch (request.command) {
      case "dryRunOperation":
        return this.#executeDryRun(request);
      case "commitOperation":
        return this.#executeCommit(request);
      case "getEditorState":
      case "inspectModel":
      case "inspectTarget":
      case "inspectEvaluatedGeometry":
      case "validatePackage":
      case "getOperationLog":
        return this.#executeReadCommand(request);
      case "renderView":
        return this.#executeRenderView(request);
      case "getPsdImportPlanState":
      case "setPsdImportPlanApproval":
      case "preflightPsdImportPlanIntake":
      case "executePsdImportPlanIntake":
        return this.#unsupportedReadCommand(request);
    }
  }

  async #executeReadCommand(request: DispatchableReadCommandRequest): Promise<AiCommandResponse> {
    if (this.#readHost === undefined) {
      // No read host configured: preserve the legacy behavior where read commands
      // routed to the operation executor resolve to a command-matching not_implemented.
      return this.#unsupportedReadCommand(request);
    }

    // Dispatch through the shared read mechanism, passing the executor's transcript so
    // capability checks, permission_denied / not_implemented / ok resolution, and
    // transcript recording all happen there (and are not duplicated by the executor).
    return executeAiReadCommand(request, this.#readHost, this.#transcript);
  }

  /**
   * `renderView` is a perception command whose concrete implementation (session
   * evaluation, RenderScene assembly, rasterization, PNG + sidecar file output)
   * lives in the authoring-host, so ai-interface never gains a renderer or
   * filesystem dependency. The executor only enforces the `render` capability
   * gate here; when the capability is present it returns `not_implemented`,
   * which signals callers to route the render through the authoring-host render
   * path. A caller that lacks the capability is stopped with `permission_denied`.
   */
  #executeRenderView(request: RenderViewCommandRequest): AiCommandResponse {
    if (!hasCapability(request, "render")) {
      const response = AiCommandResponseSchema.parse({
        schemaVersion: "ai-command-response-v1",
        commandId: request.commandId,
        status: "permission_denied",
        evidenceRefs: [],
        command: request.command,
        payload: renderViewNotImplementedPayload(request)
      });
      appendAiCommandResponseToTranscript({
        transcript: this.#transcript,
        request,
        response
      });
      return response;
    }

    return this.#unsupportedReadCommand(request);
  }

  async #executeDryRun(request: DryRunCommandRequest): Promise<AiCommandResponse> {
    if (!hasCapability(request, "dryRunEdit")) {
      return this.#operationResponse({
        request,
        status: "permission_denied",
        operationResult: createRejectedOperationResult({
          request,
          operation: request.payload,
          checkId: "ai.permissionDenied",
          message: "dryRunOperation requires the dryRunEdit capability."
        })
      });
    }

    const operationResult = OperationResultSchema.parse(await this.#host.dryRunOperation(request.payload));
    this.#approvalPolicy.recordDryRun({
      dryRunCommandId: request.commandId,
      agentId: request.session.agentId,
      operationId: operationResult.operationId
    });

    return this.#operationResponse({
      request,
      status: operationResult.status === "rejected" ? "rejected" : "ok",
      operationResult
    });
  }

  async #executeCommit(request: CommitCommandRequest): Promise<AiCommandResponse> {
    if (!hasCapability(request, "commitWithApproval")) {
      return this.#operationResponse({
        request,
        status: "permission_denied",
        operationResult: createRejectedOperationResult({
          request,
          operation: request.payload.operation,
          checkId: "ai.permissionDenied",
          message: "commitOperation requires the commitWithApproval capability."
        })
      });
    }

    const approvalCheck = this.#approvalPolicy.checkCommitApproval({
      approvedDryRunCommandId: request.payload.approvedDryRunCommandId,
      agentId: request.session.agentId,
      ...(request.payload.operation.operationId === undefined
        ? {}
        : { operationId: request.payload.operation.operationId })
    });
    if (approvalCheck.status !== "approved") {
      return this.#operationResponse({
        request,
        status: approvalCheck.status,
        operationResult: createRejectedOperationResult({
          request,
          operation: request.payload.operation,
          checkId: approvalCheck.status === "needs_approval" ? "ai.approvalRequired" : "ai.approvalRejected",
          message: approvalCheck.reason ?? "Commit operation is not approved."
        })
      });
    }

    const operationResult = OperationResultSchema.parse(await this.#host.commitOperation(request.payload.operation));

    return this.#operationResponse({
      request,
      status: operationResult.status === "rejected" ? "rejected" : "ok",
      operationResult,
      includeOperationLogRef: operationResult.status === "committed"
    });
  }

  #unsupportedReadCommand(request: UnsupportedReadCommandRequest): AiCommandResponse {
    const response = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: request.commandId,
      status: "not_implemented",
      evidenceRefs: [],
      command: request.command,
      payload: unsupportedReadPayload(request)
    });

    appendAiCommandResponseToTranscript({
      transcript: this.#transcript,
      request,
      response
    });

    return response;
  }

  #operationResponse(input: {
    readonly request: DryRunCommandRequest | CommitCommandRequest;
    readonly status: AiCommandStatus;
    readonly operationResult: OperationResultDto;
    readonly includeOperationLogRef?: boolean;
  }): AiCommandResponse {
    const evidenceRefs = collectOperationEvidenceRefs(input.operationResult, input.includeOperationLogRef === true);
    const response = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: input.request.commandId,
      status: input.status,
      diagnostics: input.operationResult.diagnostics,
      modelDiff: input.operationResult.modelDiff,
      runtimeDiff: input.operationResult.runtimeDiff,
      validationDiff: input.operationResult.validationDiff,
      operationResult: input.operationResult,
      evidenceRefs,
      command: input.request.command,
      payload: {
        operationResult: input.operationResult
      }
    });

    appendAiCommandResponseToTranscript({
      transcript: this.#transcript,
      request: input.request,
      response,
      operationId: input.operationResult.operationId
    });

    return response;
  }
}

export const executeAiCommand = (input: unknown, options: AiCommandExecutorOptions): Promise<AiCommandResponse> =>
  new AiCommandExecutor(options).execute(input);

const hasCapability = (request: AiCommandRequest, capability: AiCapability): boolean =>
  request.session.capabilities.includes(capability);

/**
 * Schema-valid placeholder render result. The executor does not render; the
 * authoring-host render path produces the real artifacts. This payload only
 * satisfies the response union so capability gating and transcript recording
 * work at the ai-interface layer.
 */
const renderViewNotImplementedPayload = (
  request: RenderViewCommandRequest
): RenderViewResult => ({
  schemaVersion: "render-view-result-v1",
  packageRevision: request.basis.packageRevision ?? 0,
  pngPath: "not-implemented",
  sidecarPath: "not-implemented",
  outputWidth: 1,
  outputHeight: 1,
  sidecar: {
    schemaVersion: "render-view-sidecar-v1",
    packagePath: "not-implemented",
    packageId: "pkg_unknown",
    packageRevision: request.basis.packageRevision ?? 0,
    pngPath: "not-implemented",
    parameterOverrides: [],
    resolvedView: {
      stageViewport: { minX: 0, minY: 0, width: 1, height: 1 },
      outputWidth: 1,
      outputHeight: 1,
      pixelsPerStageX: 1,
      pixelsPerStageY: 1
    }
  }
});

const unsupportedReadPayload = (request: UnsupportedReadCommandRequest) => {
  switch (request.command) {
    case "getEditorState":
      return { editorState: { schemaVersion: "editor-semantic-state-v1" } };
    case "inspectModel":
      return { targets: [], editableTargets: [] };
    case "inspectTarget":
      return { target: request.payload.target, references: [] };
    case "inspectEvaluatedGeometry":
      return {
        schemaVersion: "inspect-evaluated-geometry-result-v1",
        packageRevision: 0,
        parameterOverrides: [],
        results: []
      };
    case "validatePackage":
      return {
        reportId: "val_ai_operation_executor_not_implemented",
        report: ValidationReportSchema.parse({
          schemaVersion: "validation-report-v1",
          reportId: "val_ai_operation_executor_not_implemented",
          createdAt: "2026-05-29T00:00:00.000Z",
          packageId: "pkg_unknown",
          packageRevision: request.payload.packageRevision ?? 0,
          validatorVersion: "ai-interface",
          profile: request.payload.profile,
          relatedScenarios: [],
          summary: {
            status: "not_applicable",
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
        })
      };
    case "getOperationLog":
      return { entries: [] };
    case "renderView":
      return renderViewNotImplementedPayload(request);
    case "getPsdImportPlanState":
    case "setPsdImportPlanApproval":
    case "preflightPsdImportPlanIntake":
    case "executePsdImportPlanIntake":
      return {
        result: {
          schemaVersion: "ai-psd-import-plan-command-result-v0",
          importPlan: null,
          latestBatch: {
            status: "none",
            selectedLayerNodeRefs: [],
            approvedLayerNodeRefs: [],
            generatedResultRefs: [],
            operationIds: [],
            evidenceRefs: [],
            issues: [],
            diagnostics: []
          },
          diagnostics: [],
          evidenceRefs: []
        }
      };
  }
};

class TranscriptingAiApprovalPolicy implements AiApprovalPolicy {
  readonly #policy: AiApprovalPolicy;
  readonly #transcript: AiCommandTranscript;

  constructor(policy: AiApprovalPolicy, transcript: AiCommandTranscript) {
    this.#policy = policy;
    this.#transcript = transcript;
  }

  recordDryRun(input: {
    readonly dryRunCommandId: string;
    readonly agentId: string;
    readonly operationId?: string;
    readonly approvalContextDigest?: string;
  }): void {
    this.#policy.recordDryRun(input);
  }

  approveDryRunCommand(input: {
    readonly dryRunCommandId: string;
    readonly operationId?: string;
  }) {
    const record = this.#policy.approveDryRunCommand(input);
    appendAiApprovalToTranscript({
      transcript: this.#transcript,
      record
    });

    return record;
  }

  checkCommitApproval(input: {
    readonly approvedDryRunCommandId: string;
    readonly agentId: string;
    readonly operationId?: string;
    readonly approvalContextDigest?: string;
  }) {
    return this.#policy.checkCommitApproval(input);
  }
}

const createRejectedOperationResult = (input: {
  readonly request: DryRunCommandRequest | CommitCommandRequest;
  readonly operation: OperationRequestDto;
  readonly checkId: string;
  readonly message: string;
}): OperationResultDto => {
  const operationId = OperationIdSchema.parse(input.operation.operationId ?? createSyntheticOperationId(input.request.commandId));
  const diagnostic: DiagnosticDto = {
    checkId: CheckIdSchema.parse(input.checkId),
    status: "fail",
    severity: "error",
    phase: "ai-command-executor",
    target: {
      kind: "operation",
      id: operationId
    },
    message: input.message,
    evidence: [],
    relatedAC: input.request.basis.relatedAC,
    relatedScenarios: input.request.basis.relatedScenarios,
    repairCandidateIds: []
  };

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId,
    status: "rejected",
    precondition: {
      ok: false,
      diagnostics: [diagnostic]
    },
    diagnostics: [diagnostic],
    reversible: false
  });
};

const createSyntheticOperationId = (commandId: string): string =>
  `op_ai_${commandId.replace(/[^A-Za-z0-9_-]/g, "_")}`;

const collectOperationEvidenceRefs = (
  operationResult: OperationResultDto,
  includeOperationLogRef: boolean
): string[] => {
  const refs = [
    ...operationResult.generatedRuntimeStateRefs,
    ...operationResult.generatedRuntimeStateSequenceRefs,
    ...operationResult.generatedRuntimeSnapshotIds.map(
      (snapshotId) => `runtime/snapshots/${snapshotId}.runtime-snapshot.json`
    ),
    ...operationResult.generatedValidationReportIds.map(
      (reportId) => `validation/reports/${reportId}.validation-report.json`
    )
  ];

  if (includeOperationLogRef) {
    refs.push(`operations/log.jsonl#${operationResult.operationId}`);
  }

  return refs;
};
