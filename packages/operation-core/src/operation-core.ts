import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";

import { commitOperation, commitOperationAsync } from "./lifecycle/commit.js";
import type { CommitOperationOutcome } from "./lifecycle/commit.js";
import { dryRunOperation, dryRunOperationAsync } from "./lifecycle/dry-run.js";
import type { OperationEvidenceProviderLike } from "./operation-evidence-provider.js";
import { createOperationLog } from "./operation-log.js";
import type { OperationLog } from "./operation-log.js";
import type { OperationLogEntryDto } from "./operation-log-entry.js";
import type { OperationResultDto } from "./operation-result.js";

export interface OperationCoreOptions {
  readonly now?: () => Date;
  readonly evidenceProvider?: OperationEvidenceProviderLike;
  readonly initialOperationLogEntries?: readonly OperationLogEntryDto[];
}

export interface OperationCore {
  readonly operationLog: OperationLog;
  dryRunOperation(session: AuthoringSession, requestInput: unknown): OperationResultDto;
  dryRunOperationAsync(session: AuthoringSession, requestInput: unknown): Promise<OperationResultDto>;
  commitOperation(session: AuthoringSession, requestInput: unknown): CommitOperationOutcome;
  commitOperationAsync(session: AuthoringSession, requestInput: unknown): Promise<CommitOperationOutcome>;
}

export const createOperationCore = (options: OperationCoreOptions = {}): OperationCore => {
  const operationLog = createOperationLog(options.initialOperationLogEntries);

  return {
    operationLog,
    dryRunOperation: (session, requestInput) =>
      dryRunOperation(session, requestInput, {
        ...(options.evidenceProvider === undefined
          ? {}
          : { evidenceProvider: options.evidenceProvider })
      }),
    dryRunOperationAsync: (session, requestInput) =>
      dryRunOperationAsync(session, requestInput, {
        ...(options.evidenceProvider === undefined
          ? {}
          : { evidenceProvider: options.evidenceProvider })
      }),
    commitOperation: (session, requestInput) =>
      commitOperation(session, requestInput, {
        operationLog,
        ...(options.now === undefined ? {} : { now: options.now }),
        ...(options.evidenceProvider === undefined
          ? {}
          : { evidenceProvider: options.evidenceProvider })
      }),
    commitOperationAsync: (session, requestInput) =>
      commitOperationAsync(session, requestInput, {
        operationLog,
        ...(options.now === undefined ? {} : { now: options.now }),
        ...(options.evidenceProvider === undefined
          ? {}
          : { evidenceProvider: options.evidenceProvider })
      })
  };
};
