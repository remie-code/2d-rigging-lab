import type { DiagnosticDto } from "@private-2d-rigging-lab/contracts";
import type { OperationResultDto } from "@private-2d-rigging-lab/operation-core";
import { z } from "zod";

import { InMemoryAiApprovalPolicy } from "./ai-approval-policy.js";
import type {
  AiApprovalPolicy,
  AiCommitApprovalCheck,
  AiDryRunApprovalRecord
} from "./ai-approval-policy.js";

/**
 * Auto-approval "dial" for headless operation.
 *
 * The dry-run stage is reinterpreted as a mechanical verification gate: when the
 * dry-run OperationResult carries no blocking diagnostic (and the operation class
 * is not routed to human review), the dry-run command is mechanically approved so
 * a later commit can proceed without a human approval ceremony.
 *
 * This does NOT bypass the approval lifecycle: it still goes through
 * {@link AiApprovalPolicy.recordDryRun} -> {@link AiApprovalPolicy.approveDryRunCommand}
 * -> {@link AiApprovalPolicy.checkCommitApproval}. It only mechanizes the human
 * decision, and keeps a per-operation-class "requiresHumanApproval" dial so a
 * future policy can route specific operation classes back to human approval.
 */
export interface AiAutoApprovalEvaluationInput {
  readonly operationResult: OperationResultDto;
  readonly operationType?: string;
}

export type AiAutoApprovalDecisionReason =
  | "no-blocking-diagnostic"
  | "operation-result-rejected"
  | "blocking-diagnostic-present"
  | "operation-class-requires-human-approval";

export interface AiAutoApprovalDecision {
  readonly autoApprove: boolean;
  readonly reason: AiAutoApprovalDecisionReason;
  readonly blockingDiagnostics: readonly DiagnosticDto[];
}

export interface DiagnosticGatedAutoApprovalPolicyOptions {
  /**
   * The delegate policy that owns the concrete approval records. Defaults to an
   * in-memory policy; a hydrated policy can be injected to cross process boundaries.
   */
  readonly delegate?: AiApprovalPolicy;
  /**
   * Operation classes (operationType values) that must always be routed to human
   * approval, even when the dry-run has no blocking diagnostic. This is the "dial"
   * that lets a future policy return specific operation classes to human review.
   */
  readonly humanApprovalOperationTypes?: readonly string[];
}

const isBlockingDiagnostic = (diagnostic: DiagnosticDto): boolean =>
  diagnostic.severity === "error" || diagnostic.severity === "blocking";

export const collectBlockingDiagnostics = (
  operationResult: OperationResultDto
): readonly DiagnosticDto[] => {
  const preconditionDiagnostics = operationResult.precondition.diagnostics ?? [];
  const resultDiagnostics = operationResult.diagnostics ?? [];

  return [...preconditionDiagnostics, ...resultDiagnostics].filter(isBlockingDiagnostic);
};

export class DiagnosticGatedAutoApprovalPolicy implements AiApprovalPolicy {
  readonly #delegate: AiApprovalPolicy;
  readonly #humanApprovalOperationTypes: ReadonlySet<string>;

  constructor(options: DiagnosticGatedAutoApprovalPolicyOptions = {}) {
    this.#delegate = options.delegate ?? new InMemoryAiApprovalPolicy();
    this.#humanApprovalOperationTypes = new Set(options.humanApprovalOperationTypes ?? []);
  }

  get delegate(): AiApprovalPolicy {
    return this.#delegate;
  }

  recordDryRun(input: {
    readonly dryRunCommandId: string;
    readonly agentId: string;
    readonly operationId?: string;
    readonly approvalContextDigest?: string;
  }): void {
    this.#delegate.recordDryRun(input);
  }

  approveDryRunCommand(input: {
    readonly dryRunCommandId: string;
    readonly operationId?: string;
  }): AiDryRunApprovalRecord {
    return this.#delegate.approveDryRunCommand(input);
  }

  checkCommitApproval(input: {
    readonly approvedDryRunCommandId: string;
    readonly agentId: string;
    readonly operationId?: string;
    readonly approvalContextDigest?: string;
  }): AiCommitApprovalCheck {
    return this.#delegate.checkCommitApproval(input);
  }

  /**
   * Decide whether a dry-run result clears the mechanical verification gate.
   * A `false` decision means the dry-run must not be auto-approved and a later
   * commit will fail the approval check (needs_approval).
   */
  evaluateAutoApproval(input: AiAutoApprovalEvaluationInput): AiAutoApprovalDecision {
    const blockingDiagnostics = collectBlockingDiagnostics(input.operationResult);

    if (input.operationResult.status === "rejected") {
      return {
        autoApprove: false,
        reason: "operation-result-rejected",
        blockingDiagnostics
      };
    }

    if (blockingDiagnostics.length > 0) {
      return {
        autoApprove: false,
        reason: "blocking-diagnostic-present",
        blockingDiagnostics
      };
    }

    if (
      input.operationType !== undefined &&
      this.#humanApprovalOperationTypes.has(input.operationType)
    ) {
      return {
        autoApprove: false,
        reason: "operation-class-requires-human-approval",
        blockingDiagnostics
      };
    }

    return {
      autoApprove: true,
      reason: "no-blocking-diagnostic",
      blockingDiagnostics
    };
  }

  /**
   * Serialize the approval records so a dry-run approval recorded in one process
   * can be committed in a later process. Only the concrete
   * {@link InMemoryAiApprovalPolicy} delegate carries records; any other delegate
   * serializes to an empty record set.
   */
  serializeApprovalState(): AiApprovalStateDocument {
    const records =
      this.#delegate instanceof InMemoryAiApprovalPolicy ? this.#delegate.records : [];

    return AiApprovalStateDocumentSchema.parse({
      schemaVersion: "ai-approval-state-v1",
      records: records.map((record) => ({
        dryRunCommandId: record.dryRunCommandId,
        agentId: record.agentId,
        approved: record.approved,
        ...(record.operationId === undefined ? {} : { operationId: record.operationId }),
        ...(record.approvalContextDigest === undefined
          ? {}
          : { approvalContextDigest: record.approvalContextDigest })
      }))
    });
  }
}

export const AiApprovalRecordSchema = z.object({
  dryRunCommandId: z.string().min(1),
  agentId: z.string().min(1),
  operationId: z.string().min(1).optional(),
  approvalContextDigest: z.string().min(1).optional(),
  approved: z.boolean()
});
export type AiApprovalRecordDto = z.infer<typeof AiApprovalRecordSchema>;

export const AiApprovalStateDocumentSchema = z.object({
  schemaVersion: z.literal("ai-approval-state-v1"),
  records: z.array(AiApprovalRecordSchema)
});
export type AiApprovalStateDocument = z.infer<typeof AiApprovalStateDocumentSchema>;

export const createEmptyAiApprovalStateDocument = (): AiApprovalStateDocument =>
  AiApprovalStateDocumentSchema.parse({
    schemaVersion: "ai-approval-state-v1",
    records: []
  });

export const parseAiApprovalStateDocument = (input: unknown): AiApprovalStateDocument =>
  AiApprovalStateDocumentSchema.parse(input);

/**
 * Rebuild an {@link InMemoryAiApprovalPolicy} from a persisted approval-state
 * state record set. This is how the headless host carries a recorded dry-run
 * approval across a process boundary into the commit process.
 */
export const hydrateInMemoryAiApprovalPolicy = (input: unknown): InMemoryAiApprovalPolicy => {
  const stateDocument = AiApprovalStateDocumentSchema.parse(input);
  const policy = new InMemoryAiApprovalPolicy();

  for (const record of stateDocument.records) {
    policy.recordDryRun({
      dryRunCommandId: record.dryRunCommandId,
      agentId: record.agentId,
      ...(record.operationId === undefined ? {} : { operationId: record.operationId }),
      ...(record.approvalContextDigest === undefined
        ? {}
        : { approvalContextDigest: record.approvalContextDigest })
    });
    if (record.approved) {
      policy.approveDryRunCommand({
        dryRunCommandId: record.dryRunCommandId,
        ...(record.operationId === undefined ? {} : { operationId: record.operationId })
      });
    }
  }

  return policy;
};

/**
 * Construct a {@link DiagnosticGatedAutoApprovalPolicy} whose delegate is
 * hydrated from a persisted approval-state record set.
 */
export const createDiagnosticGatedAutoApprovalPolicyFromState = (
  input: unknown,
  options: Omit<DiagnosticGatedAutoApprovalPolicyOptions, "delegate"> = {}
): DiagnosticGatedAutoApprovalPolicy =>
  new DiagnosticGatedAutoApprovalPolicy({
    delegate: hydrateInMemoryAiApprovalPolicy(input),
    ...(options.humanApprovalOperationTypes === undefined
      ? {}
      : { humanApprovalOperationTypes: options.humanApprovalOperationTypes })
  });
