import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";

import type { OperationEvidenceResultInput } from "./operation-evidence-result.js";
import type { OperationRequestDto } from "./operation-request.js";
import type { OperationResultDto } from "./operation-result.js";

export type OperationEvidenceLifecycle = "dry_run" | "commit";

export interface OperationEvidenceProviderInput {
  readonly lifecycle: OperationEvidenceLifecycle;
  readonly baselineSession: AuthoringSession;
  readonly candidateSession: AuthoringSession;
  readonly request: OperationRequestDto;
  readonly result: OperationResultDto;
  readonly targetIds: readonly string[];
}

export interface OperationEvidenceProvider {
  collectOperationEvidence(input: OperationEvidenceProviderInput): OperationEvidenceResultInput;
}

export type OperationEvidenceProviderFunction = (
  input: OperationEvidenceProviderInput
) => OperationEvidenceResultInput;

export type OperationEvidenceProviderLike =
  | OperationEvidenceProvider
  | OperationEvidenceProviderFunction;
