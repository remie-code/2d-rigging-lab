import {
  cloneAuthoringSession,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import {
  CodexProposalDiffPreviewResultDtoSchema,
  CodexProposalPreviewIdDtoSchema,
  CodexProposalValidationResultDtoSchema,
  CodexRiggingEditProposalDtoSchema,
  DiagnosticSchema,
  ModelDiffSchema,
  RuntimeDiffSchema,
  ValidationDiffSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  CodexProposalDiffPreviewResultDto,
  CodexProposalEvidenceRefDto,
  CodexProposalOperationDto,
  CodexProposalPreviewIdDto,
  CodexProposalValidationResultDto,
  CodexRiggingEditProposalDto,
  DiagnosticDto,
  ModelDiffDto,
  RuntimeDiffDto,
  TargetRefDto,
  ValidationDiffDto
} from "@private-2d-rigging-lab/contracts";

import { applyDryRunCandidatePackageRevision } from "./package-revision.js";
import { applyOperationEvidence } from "./lifecycle/evidence.js";
import type { OperationEvidenceProviderLike } from "./operation-evidence-provider.js";
import type { OperationResultDto } from "./operation-result.js";
import type { OperationRequestDto } from "./operation-request.js";
import { getOperationHandler } from "./operation-registry.js";
import {
  createOperationDiagnostic,
  createRejectedOperationResult,
  prepareOperationRequest
} from "./preconditions.js";

export interface CodexProposalPreviewInput {
  readonly session: AuthoringSession;
  readonly proposal: CodexRiggingEditProposalDto;
  readonly validationResult: CodexProposalValidationResultDto;
  readonly previewId?: CodexProposalPreviewIdDto | string;
  readonly generatedAt?: string;
  readonly evidenceProvider?: OperationEvidenceProviderLike;
}

export interface CodexProposalPreviewResult {
  readonly diffPreview: CodexProposalDiffPreviewResultDto;
  readonly previewSession?: AuthoringSession;
  readonly operationResults: readonly OperationResultDto[];
}

export const previewCodexProposalDiff = (
  input: CodexProposalPreviewInput
): CodexProposalPreviewResult => {
  const proposal = CodexRiggingEditProposalDtoSchema.parse(input.proposal);
  const validationResult = CodexProposalValidationResultDtoSchema.parse(input.validationResult);
  const previewId = CodexProposalPreviewIdDtoSchema.parse(
    input.previewId ?? `preview_${stripProposalPrefix(proposal.proposalId)}`
  );
  const generatedAt = input.generatedAt ?? proposal.createdAt;
  const basePackageRevision = proposal.packageContext.basePackageRevision;
  const readinessDiagnostics = evaluatePreviewReadiness({
    proposal,
    validationResult,
    session: input.session
  });

  if (readinessDiagnostics.length > 0) {
    return {
      diffPreview: createBlockedPreview({
        proposal,
        validationResult,
        previewId,
        generatedAt,
        packageId: input.session.packageIdentity.packageId,
        diagnostics: readinessDiagnostics
      }),
      operationResults: []
    };
  }

  let previewSession = cloneAuthoringSession(input.session);
  const operationResults: OperationResultDto[] = [];

  for (const operation of proposal.operations) {
    const requestInput = createPreviewOperationRequest({
      proposal,
      operation,
      basePackageRevision: previewSession.packageRevision
    });
    const prepared = prepareOperationRequest(previewSession, requestInput, true);
    if ("status" in prepared) {
      return {
        diffPreview: createBlockedPreview({
          proposal,
          validationResult,
          previewId,
          generatedAt,
          packageId: previewSession.packageIdentity.packageId,
          diagnostics: prepared.diagnostics
        }),
        operationResults
      };
    }

    const handler = getOperationHandler(prepared.request.operationType);
    if (handler === undefined) {
      const rejected = createRejectedOperationResult({
        operationId: prepared.operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "codexProposal.preview.unsupportedOperation",
            message: `Operation is not supported for Codex proposal preview: ${prepared.request.operationType}.`,
            target: { kind: "operation", id: prepared.operationId }
          })
        ]
      });

      return {
        diffPreview: createBlockedPreview({
          proposal,
          validationResult,
          previewId,
          generatedAt,
          packageId: previewSession.packageIdentity.packageId,
          diagnostics: rejected.diagnostics
        }),
        operationResults
      };
    }

    const applied = handler.dryRun(previewSession, prepared.request, prepared.operationId);
    if (applied.result.status !== "dry_run") {
      return {
        diffPreview: createBlockedPreview({
          proposal,
          validationResult,
          previewId,
          generatedAt,
          packageId: previewSession.packageIdentity.packageId,
          diagnostics: applied.result.diagnostics
        }),
        operationResults: [...operationResults, applied.result]
      };
    }

    applyDryRunCandidatePackageRevision({
      baselineSession: previewSession,
      candidateSession: applied.candidateSession,
      basePackageRevision: prepared.request.basePackageRevision
    });

    const result = applyOperationEvidence({
      ...(input.evidenceProvider === undefined
        ? {}
        : { provider: input.evidenceProvider }),
      lifecycle: "dry_run",
      baselineSession: previewSession,
      candidateSession: applied.candidateSession,
      request: prepared.request,
      result: applied.result,
      targetIds: applied.targetIds
    });

    operationResults.push(result);
    previewSession = applied.candidateSession;
  }

  const diffPreview = CodexProposalDiffPreviewResultDtoSchema.parse({
    schemaVersion: "codex-proposal-diff-preview-result-v0",
    proposalId: proposal.proposalId,
    previewId,
    generatedAt,
    status: "ready",
    summary: `Codex proposal ${proposal.proposalId} preview is ready with ${operationResults.length} dry-run operation(s).`,
    previewOnly: true,
    committed: false,
    basePackageRevision,
    previewPackageRevision: previewSession.packageRevision,
    sourceValidationStatus: validationResult.status,
    ...optionalDiffs(operationResults, basePackageRevision, previewSession.packageRevision),
    diagnostics: operationResults.flatMap((result) => result.diagnostics),
    evidenceRefs: [
      createDiffPreviewEvidenceRef({
        proposal,
        previewId,
        packageId: previewSession.packageIdentity.packageId
      })
    ]
  });

  return {
    diffPreview,
    previewSession,
    operationResults
  };
};

const evaluatePreviewReadiness = (input: {
  readonly proposal: CodexRiggingEditProposalDto;
  readonly validationResult: CodexProposalValidationResultDto;
  readonly session: AuthoringSession;
}): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [];

  if (input.validationResult.proposalId !== input.proposal.proposalId) {
    diagnostics.push(createPreviewDiagnostic({
      checkId: "codexProposal.preview.proposalMismatch",
      message: `Validation result ${input.validationResult.proposalId} does not match proposal ${input.proposal.proposalId}.`,
      target: { kind: "package", id: input.session.packageIdentity.packageId }
    }));
  }

  if (input.validationResult.status !== "valid" || !input.validationResult.canPreview) {
    diagnostics.push(createPreviewDiagnostic({
      checkId: "codexProposal.preview.validationNotReady",
      message: `Proposal validation status ${input.validationResult.status} is not preview-ready.`,
      target: { kind: "package", id: input.session.packageIdentity.packageId },
      severity: "blocking"
    }));
  }

  const nonValidOperationResults = input.validationResult.operationResults.filter(
    (operationResult) => operationResult.status !== "valid"
  );
  diagnostics.push(
    ...nonValidOperationResults.map((operationResult) =>
      createPreviewDiagnostic({
        checkId: "codexProposal.preview.operationValidationNotReady",
        message: `Proposal step ${operationResult.stepId} is ${operationResult.status} and cannot be previewed.`,
        target: { kind: "operation", id: operationResult.stepId },
        severity: "blocking"
      })
    )
  );

  if (
    input.proposal.packageContext.packageId !== undefined &&
    input.proposal.packageContext.packageId !== input.session.packageIdentity.packageId
  ) {
    diagnostics.push(createPreviewDiagnostic({
      checkId: "codexProposal.preview.packageMismatch",
      message: [
        `Proposal package ${input.proposal.packageContext.packageId}`,
        `does not match current session package ${input.session.packageIdentity.packageId}.`
      ].join(" "),
      target: { kind: "package", id: input.session.packageIdentity.packageId },
      severity: "blocking"
    }));
  }

  if (input.session.packageRevision !== input.proposal.packageContext.basePackageRevision) {
    diagnostics.push(createPreviewDiagnostic({
      checkId: "codexProposal.preview.stalePackageRevision",
      message: [
        `Proposal base revision ${input.proposal.packageContext.basePackageRevision}`,
        `does not match current session revision ${input.session.packageRevision}.`
      ].join(" "),
      target: { kind: "package", id: input.session.packageIdentity.packageId },
      severity: "blocking"
    }));
  }

  return diagnostics;
};

const createPreviewOperationRequest = (input: {
  readonly proposal: CodexRiggingEditProposalDto;
  readonly operation: CodexProposalOperationDto;
  readonly basePackageRevision: number;
}): unknown => ({
  schemaVersion: "operation-request-v1",
  ...(input.operation.operationId === undefined
    ? {}
    : { operationId: input.operation.operationId }),
  actor: "ai",
  surface: "structuredApi",
  dryRun: true,
  basePackageRevision: input.basePackageRevision,
  trace: {
    relatedAC: input.proposal.metadata.relatedAC,
    relatedScenarios: input.proposal.metadata.relatedScenarios
  },
  operationType: input.operation.operationType,
  payload: input.operation.payload
});

const createBlockedPreview = (input: {
  readonly proposal: CodexRiggingEditProposalDto;
  readonly validationResult: CodexProposalValidationResultDto;
  readonly previewId: CodexProposalPreviewIdDto;
  readonly generatedAt: string;
  readonly packageId: string;
  readonly diagnostics: readonly DiagnosticDto[];
}): CodexProposalDiffPreviewResultDto =>
  CodexProposalDiffPreviewResultDtoSchema.parse({
    schemaVersion: "codex-proposal-diff-preview-result-v0",
    proposalId: input.proposal.proposalId,
    previewId: input.previewId,
    generatedAt: input.generatedAt,
    status: "blocked",
    summary: `Codex proposal ${input.proposal.proposalId} preview is blocked.`,
    previewOnly: true,
    committed: false,
    basePackageRevision: input.proposal.packageContext.basePackageRevision,
    sourceValidationStatus: input.validationResult.status,
    diagnostics: [...input.diagnostics],
    evidenceRefs: [
      createDiffPreviewEvidenceRef({
        proposal: input.proposal,
        previewId: input.previewId,
        packageId: input.packageId
      })
    ]
  });

const optionalDiffs = (
  operationResults: readonly OperationResultDto[],
  basePackageRevision: number,
  previewPackageRevision: number
) => ({
  ...optionalModelDiff(operationResults, basePackageRevision, previewPackageRevision),
  ...optionalRuntimeDiff(operationResults),
  ...optionalValidationDiff(operationResults)
});

const optionalModelDiff = (
  operationResults: readonly OperationResultDto[],
  basePackageRevision: number,
  previewPackageRevision: number
): { readonly modelDiff?: ModelDiffDto } => {
  const diffs = operationResults.flatMap((result) =>
    result.modelDiff === undefined ? [] : [result.modelDiff]
  );
  if (diffs.length === 0) {
    return {};
  }

  return {
    modelDiff: ModelDiffSchema.parse({
      schemaVersion: "model-diff-v1",
      baseRevision: basePackageRevision,
      candidateRevision: previewPackageRevision,
      added: dedupeTargetRefs(diffs.flatMap((diff) => diff.added)),
      removed: dedupeTargetRefs(diffs.flatMap((diff) => diff.removed)),
      changed: diffs.flatMap((diff) => diff.changed),
      operationIds: uniqueStrings([
        ...operationResults.map((result) => result.operationId),
        ...diffs.flatMap((diff) => diff.operationIds)
      ])
    })
  };
};

const optionalRuntimeDiff = (
  operationResults: readonly OperationResultDto[]
): { readonly runtimeDiff?: RuntimeDiffDto } => {
  const diffs = operationResults.flatMap((result) =>
    result.runtimeDiff === undefined ? [] : [result.runtimeDiff]
  );
  const firstDiff = diffs[0];
  const lastDiff = diffs.at(-1);
  if (firstDiff === undefined || lastDiff === undefined) {
    return {};
  }

  const rigControlChanges = diffs.flatMap((diff) => diff.rigControlChanges ?? []);

  return {
    runtimeDiff: RuntimeDiffSchema.parse({
      schemaVersion: "runtime-diff-v1",
      beforeSnapshotId: firstDiff.beforeSnapshotId,
      afterSnapshotId: lastDiff.afterSnapshotId,
      parameterChanges: diffs.flatMap((diff) => diff.parameterChanges),
      dynamicsChanges: diffs.flatMap((diff) => diff.dynamicsChanges),
      ...(rigControlChanges.length === 0 ? {} : { rigControlChanges }),
      drawableChanges: diffs.flatMap((diff) => diff.drawableChanges),
      drawableRuntimeStateChanges: diffs.flatMap((diff) => diff.drawableRuntimeStateChanges),
      drawListChanges: diffs.flatMap((diff) => diff.drawListChanges),
      diagnosticDelta: diffs.flatMap((diff) => diff.diagnosticDelta)
    })
  };
};

const optionalValidationDiff = (
  operationResults: readonly OperationResultDto[]
): { readonly validationDiff?: ValidationDiffDto } => {
  const diffs = operationResults.flatMap((result) =>
    result.validationDiff === undefined ? [] : [result.validationDiff]
  );
  const firstDiff = diffs[0];
  const lastDiff = diffs.at(-1);
  if (firstDiff === undefined || lastDiff === undefined) {
    return {};
  }

  return {
    validationDiff: ValidationDiffSchema.parse({
      schemaVersion: "validation-diff-v1",
      beforeReportId: firstDiff.beforeReportId,
      afterReportId: lastDiff.afterReportId,
      newFailures: diffs.flatMap((diff) => diff.newFailures),
      resolvedFailures: diffs.flatMap((diff) => diff.resolvedFailures),
      severityChanges: diffs.flatMap((diff) => diff.severityChanges)
    })
  };
};

const createDiffPreviewEvidenceRef = (input: {
  readonly proposal: CodexRiggingEditProposalDto;
  readonly previewId: CodexProposalPreviewIdDto;
  readonly packageId: string;
}): CodexProposalEvidenceRefDto => ({
  evidenceId: `evidence_${sanitizeToken(input.proposal.proposalId)}_${sanitizeToken(input.previewId)}_diffPreview`,
  evidenceKind: "dryRunDiffPreview",
  artifactRef: {
    artifactKind: "diffPreview",
    path: `generated/codex-proposals/${sanitizePathStem(input.proposal.proposalId)}.${sanitizePathStem(input.previewId)}.diff-preview.json`
  },
  target: {
    kind: "package",
    id: input.packageId
  },
  summary: `Dry-run diff preview evidence for proposal ${input.proposal.proposalId} and preview ${input.previewId}.`,
  producer: "operationCore"
});

const createPreviewDiagnostic = (input: {
  readonly checkId: string;
  readonly message: string;
  readonly target: TargetRefDto;
  readonly severity?: DiagnosticDto["severity"];
}): DiagnosticDto =>
  DiagnosticSchema.parse({
    checkId: input.checkId,
    status: "fail",
    severity: input.severity ?? "error",
    phase: "codexProposal.preview",
    target: input.target,
    message: input.message,
    evidence: [],
    relatedAC: [],
    relatedScenarios: [],
    repairCandidateIds: []
  });

const dedupeTargetRefs = (targetRefs: readonly TargetRefDto[]): TargetRefDto[] => [
  ...new Map(targetRefs.map((targetRef) => [targetRefKey(targetRef), targetRef])).values()
];

const targetRefKey = (targetRef: TargetRefDto): string =>
  `${targetRef.kind}:${targetRef.id}:${targetRef.path ?? ""}`;

const uniqueStrings = <TValue extends string>(values: readonly TValue[]): TValue[] => [
  ...new Set(values)
];

const stripProposalPrefix = (proposalId: string): string =>
  sanitizeToken(proposalId.replace(/^proposal_/, ""));

const sanitizeToken = (value: string): string =>
  value.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "preview";

const sanitizePathStem = (value: string): string =>
  value.replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "") || "preview";
