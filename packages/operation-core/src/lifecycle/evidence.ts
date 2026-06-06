import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";

import type {
  OperationEvidenceLifecycle,
  OperationEvidenceProviderInput,
  OperationEvidenceProviderLike
} from "../operation-evidence-provider.js";
import { OperationEvidenceResultSchema } from "../operation-evidence-result.js";
import type { OperationRequestDto } from "../operation-request.js";
import { OperationResultSchema } from "../operation-result.js";
import type { OperationResultDto } from "../operation-result.js";

export interface ApplyOperationEvidenceInput {
  readonly provider?: OperationEvidenceProviderLike;
  readonly lifecycle: OperationEvidenceLifecycle;
  readonly baselineSession: AuthoringSession;
  readonly candidateSession: AuthoringSession;
  readonly request: OperationRequestDto;
  readonly result: OperationResultDto;
  readonly targetIds: readonly string[];
}

export const applyOperationEvidence = (
  input: ApplyOperationEvidenceInput
): OperationResultDto => {
  if (input.provider === undefined) {
    return input.result;
  }

  const evidence = OperationEvidenceResultSchema.parse(
    collectOperationEvidence(input.provider, {
      lifecycle: input.lifecycle,
      baselineSession: input.baselineSession,
      candidateSession: input.candidateSession,
      request: input.request,
      result: input.result,
      targetIds: input.targetIds
    })
  );

  return OperationResultSchema.parse({
    ...input.result,
    ...(evidence.runtimeDiff === undefined ? {} : { runtimeDiff: evidence.runtimeDiff }),
    ...(evidence.validationDiff === undefined ? {} : { validationDiff: evidence.validationDiff }),
    generatedRuntimeSnapshotIds: mergeUnique(
      input.result.generatedRuntimeSnapshotIds,
      evidence.generatedRuntimeSnapshotIds
    ),
    generatedRuntimeStateRefs: mergeUnique(
      input.result.generatedRuntimeStateRefs,
      evidence.generatedRuntimeStateRefs
    ),
    generatedRuntimeStateSequenceRefs: mergeUnique(
      input.result.generatedRuntimeStateSequenceRefs,
      evidence.generatedRuntimeStateSequenceRefs
    ),
    ...(evidence.finalRuntimeState === undefined ? {} : { finalRuntimeState: evidence.finalRuntimeState }),
    ...(evidence.finalRuntimeStateRef === undefined ? {} : { finalRuntimeStateRef: evidence.finalRuntimeStateRef }),
    generatedValidationReportIds: mergeUnique(
      input.result.generatedValidationReportIds,
      evidence.generatedValidationReportIds
    ),
    ...(evidence.meshTopologyEvidence === undefined
      ? {}
      : {
          meshTopologyEvidence: [
            ...(input.result.meshTopologyEvidence ?? []),
            ...evidence.meshTopologyEvidence
          ]
        }),
    ...(evidence.psdImportEvidence === undefined
      ? {}
      : {
          psdImportEvidence: [
            ...(input.result.psdImportEvidence ?? []),
            ...evidence.psdImportEvidence
          ]
        }),
    ...(evidence.psdLayerMaterializationEvidence === undefined
      ? {}
      : {
          psdLayerMaterializationEvidence: [
            ...(input.result.psdLayerMaterializationEvidence ?? []),
            ...evidence.psdLayerMaterializationEvidence
          ]
        }),
    ...(evidence.psdLayerMaterializationBatchEvidence === undefined
      ? {}
      : {
          psdLayerMaterializationBatchEvidence: [
            ...(input.result.psdLayerMaterializationBatchEvidence ?? []),
            ...evidence.psdLayerMaterializationBatchEvidence
          ]
        }),
    ...(evidence.psdStructuralScaffoldEvidence === undefined
      ? {}
      : {
          psdStructuralScaffoldEvidence: [
            ...(input.result.psdStructuralScaffoldEvidence ?? []),
            ...evidence.psdStructuralScaffoldEvidence
          ]
        })
  });
};

const collectOperationEvidence = (
  provider: OperationEvidenceProviderLike,
  input: OperationEvidenceProviderInput
) => {
  if (typeof provider === "function") {
    return provider(input);
  }

  return provider.collectOperationEvidence(input);
};

const mergeUnique = <TValue extends string>(
  current: readonly TValue[],
  generated: readonly TValue[]
): readonly TValue[] => [...new Set([...current, ...generated])];
