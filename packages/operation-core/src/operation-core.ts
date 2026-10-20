import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";

import { commitOperation, commitOperationAsync } from "./lifecycle/commit.js";
import type { CommitOperationOutcome } from "./lifecycle/commit.js";
import { dryRunOperation, dryRunOperationAsync } from "./lifecycle/dry-run.js";
import type { OperationEvidenceProviderLike } from "./operation-evidence-provider.js";
import type { OperationResultDto } from "./operation-result.js";

export interface OperationCoreOptions {
  readonly evidenceProvider?: OperationEvidenceProviderLike;
}

export interface OperationCore {
  dryRunOperation(session: AuthoringSession, requestInput: unknown): OperationResultDto;
  dryRunOperationAsync(session: AuthoringSession, requestInput: unknown): Promise<OperationResultDto>;
  commitOperation(session: AuthoringSession, requestInput: unknown): CommitOperationOutcome;
  commitOperationAsync(session: AuthoringSession, requestInput: unknown): Promise<CommitOperationOutcome>;
}

export const createOperationCore = (options: OperationCoreOptions = {}): OperationCore => {
  const lifecycleOptions =
    options.evidenceProvider === undefined ? {} : { evidenceProvider: options.evidenceProvider };

  return {
    dryRunOperation: (session, requestInput) =>
      dryRunOperation(session, requestInput, lifecycleOptions),
    dryRunOperationAsync: (session, requestInput) =>
      dryRunOperationAsync(session, requestInput, lifecycleOptions),
    commitOperation: (session, requestInput) =>
      commitOperation(session, requestInput, lifecycleOptions),
    commitOperationAsync: (session, requestInput) =>
      commitOperationAsync(session, requestInput, lifecycleOptions)
  };
};
