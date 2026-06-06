export interface AiDryRunApprovalRecord {
  readonly dryRunCommandId: string;
  readonly agentId: string;
  readonly operationId?: string;
  readonly approvalContextDigest?: string;
  readonly approved: boolean;
}

export type AiCommitApprovalStatus = "approved" | "needs_approval" | "rejected";

export interface AiCommitApprovalCheck {
  readonly status: AiCommitApprovalStatus;
  readonly reason?: string;
}

export interface AiApprovalPolicy {
  recordDryRun(input: {
    readonly dryRunCommandId: string;
    readonly agentId: string;
    readonly operationId?: string;
    readonly approvalContextDigest?: string;
  }): void;
  approveDryRunCommand(input: {
    readonly dryRunCommandId: string;
    readonly operationId?: string;
  }): AiDryRunApprovalRecord;
  checkCommitApproval(input: {
    readonly approvedDryRunCommandId: string;
    readonly agentId: string;
    readonly operationId?: string;
    readonly approvalContextDigest?: string;
  }): AiCommitApprovalCheck;
}

export class InMemoryAiApprovalPolicy implements AiApprovalPolicy {
  readonly #records = new Map<string, AiDryRunApprovalRecord>();

  get records(): readonly AiDryRunApprovalRecord[] {
    return [...this.#records.values()];
  }

  recordDryRun(input: {
    readonly dryRunCommandId: string;
    readonly agentId: string;
    readonly operationId?: string;
    readonly approvalContextDigest?: string;
  }): void {
    const existing = this.#records.get(input.dryRunCommandId);
    const preservesExistingApproval =
      existing?.approved === true &&
      existing.agentId === input.agentId &&
      existing.operationId !== undefined &&
      existing.operationId === input.operationId &&
      existing.approvalContextDigest === input.approvalContextDigest;
    const record: AiDryRunApprovalRecord = {
      dryRunCommandId: input.dryRunCommandId,
      agentId: input.agentId,
      ...(input.operationId === undefined ? {} : { operationId: input.operationId }),
      ...(input.approvalContextDigest === undefined
        ? {}
        : { approvalContextDigest: input.approvalContextDigest }),
      approved: preservesExistingApproval
    };

    this.#records.set(input.dryRunCommandId, record);
  }

  approveDryRunCommand(input: {
    readonly dryRunCommandId: string;
    readonly operationId?: string;
  }): AiDryRunApprovalRecord {
    const existing = this.#records.get(input.dryRunCommandId);
    if (existing === undefined) {
      throw new Error(`Cannot approve unknown dry-run command: ${input.dryRunCommandId}`);
    }

    if (existing.operationId !== undefined && input.operationId !== undefined && existing.operationId !== input.operationId) {
      throw new Error(
        `Cannot approve dry-run command ${input.dryRunCommandId} for mismatched operation: ${input.operationId}`
      );
    }

    const operationId = existing.operationId ?? input.operationId;
    const record: AiDryRunApprovalRecord = {
      dryRunCommandId: existing.dryRunCommandId,
      agentId: existing.agentId,
      ...(operationId === undefined ? {} : { operationId }),
      ...(existing.approvalContextDigest === undefined
        ? {}
        : { approvalContextDigest: existing.approvalContextDigest }),
      approved: true
    };
    this.#records.set(input.dryRunCommandId, record);

    return record;
  }

  checkCommitApproval(input: {
    readonly approvedDryRunCommandId: string;
    readonly agentId: string;
    readonly operationId?: string;
    readonly approvalContextDigest?: string;
  }): AiCommitApprovalCheck {
    const record = this.#records.get(input.approvedDryRunCommandId);
    if (record === undefined || !record.approved) {
      return {
        status: "needs_approval",
        reason: "No approval is registered for the requested dry-run command."
      };
    }

    if (record.agentId !== input.agentId) {
      return {
        status: "rejected",
        reason: `Approved dry-run command ${record.dryRunCommandId} belongs to agent ${record.agentId}.`
      };
    }

    if (record.operationId !== undefined && input.operationId === undefined) {
      return {
        status: "rejected",
        reason: `Approved dry-run operation ${record.operationId} requires a matching commit operation ID.`
      };
    }

    if (record.operationId !== undefined && input.operationId !== undefined && record.operationId !== input.operationId) {
      return {
        status: "rejected",
        reason: `Approved dry-run operation ${record.operationId} does not match commit operation ${input.operationId}.`
      };
    }

    if (record.approvalContextDigest !== undefined && input.approvalContextDigest === undefined) {
      return {
        status: "rejected",
        reason: `Approved dry-run command ${record.dryRunCommandId} requires a matching approval context digest.`
      };
    }

    if (record.approvalContextDigest === undefined && input.approvalContextDigest !== undefined) {
      return {
        status: "rejected",
        reason: `Approved dry-run command ${record.dryRunCommandId} was not recorded with an approval context digest.`
      };
    }

    if (
      record.approvalContextDigest !== undefined &&
      input.approvalContextDigest !== undefined &&
      record.approvalContextDigest !== input.approvalContextDigest
    ) {
      return {
        status: "rejected",
        reason:
          `Approved dry-run context ${record.approvalContextDigest} does not match commit context ${input.approvalContextDigest}.`
      };
    }

    return { status: "approved" };
  }
}
