import {
  CodexProposalDiffPreviewResultDtoSchema,
  CodexProposalRerunValidationResultDtoSchema,
  CodexProposalValidationResultDtoSchema,
  CodexRiggingEditProposalDtoSchema,
  DiagnosticSchema,
  ProductPreflightReportDtoSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  CodexProposalDiffPreviewResultDto,
  CodexProposalEvidenceRefDto,
  CodexProposalRerunValidationResultDto,
  CodexProposalValidationResultDto,
  CodexRiggingEditProposalDto,
  DiagnosticDto,
  ProductPreflightReportDto,
  ProductPreflightStatusDto,
  TargetRefDto,
  ValidationDiffDto
} from "@private-2d-rigging-lab/contracts";

import {
  buildProductPreflightReport,
  type ProductPreflightCategoryEvidenceRefsInput
} from "./product-preflight-report.js";
import { buildValidationDiff } from "./validation-diff-builder.js";
import type { ValidationReportDto } from "./validation-report.js";

export type CodexProposalRerunValidationStateBinding =
  | {
      readonly stateScope: "preview";
      readonly diffPreview: CodexProposalDiffPreviewResultDto;
    }
  | {
      readonly stateScope: "postCommit";
      readonly packageRevision: number;
      readonly packageId?: string;
    };

export interface CodexProposalRerunValidationInput {
  readonly proposal: CodexRiggingEditProposalDto;
  readonly validationResult: CodexProposalValidationResultDto;
  readonly stateBinding: CodexProposalRerunValidationStateBinding;
  readonly rerunValidationReports?: readonly ValidationReportDto[];
  readonly baselineValidationReport?: ValidationReportDto;
  readonly productPreflightReport?: ProductPreflightReportDto;
  readonly categoryEvidenceRefs?: ProductPreflightCategoryEvidenceRefsInput;
  readonly generatedAt?: string;
}

export const createCodexProposalRerunValidationResult = (
  input: CodexProposalRerunValidationInput
): CodexProposalRerunValidationResultDto => {
  const proposal = CodexRiggingEditProposalDtoSchema.parse(input.proposal);
  const validationResult = CodexProposalValidationResultDtoSchema.parse(input.validationResult);
  const stateBinding = parseStateBinding(input.stateBinding);
  const generatedAt = input.generatedAt ?? proposal.createdAt;
  const expectedPackageRevision = getExpectedPackageRevision(stateBinding);
  const expectedPackageId = getExpectedPackageId(proposal, stateBinding);
  const sourceDiagnostics = evaluateSourceState({
    proposal,
    validationResult,
    stateBinding
  });

  if (sourceDiagnostics.length > 0) {
    return createRerunResult({
      proposal,
      stateBinding,
      generatedAt,
      status: "fail",
      summary: `Codex proposal ${proposal.proposalId} rerun validation is blocked before Product Preflight.`,
      diagnostics: sourceDiagnostics
    });
  }

  const rerunValidationReports = input.rerunValidationReports ?? [];
  const productPreflightReport = input.productPreflightReport === undefined
    ? buildProductPreflightReportIfPossible({
        proposal,
        generatedAt,
        validationReports: rerunValidationReports,
        ...(input.categoryEvidenceRefs === undefined
          ? {}
          : { categoryEvidenceRefs: input.categoryEvidenceRefs })
      })
    : ProductPreflightReportDtoSchema.parse(input.productPreflightReport);
  const freshnessDiagnostics = evaluateFreshness({
    expectedPackageRevision,
    expectedPackageId,
    productPreflightReport,
    rerunValidationReports
  });

  if (freshnessDiagnostics.length > 0) {
    return createRerunResult({
      proposal,
      stateBinding,
      generatedAt,
      status: "fail",
      summary: `Codex proposal ${proposal.proposalId} rerun validation rejected stale evidence.`,
      diagnostics: freshnessDiagnostics
    });
  }

  if (productPreflightReport === undefined) {
    return createRerunResult({
      proposal,
      stateBinding,
      generatedAt,
      status: "not_evaluated",
      summary: `Codex proposal ${proposal.proposalId} rerun validation was not evaluated because no rerun validation report was supplied.`,
      diagnostics: [
        createRerunDiagnostic({
          checkId: "codexProposal.rerunValidation.notEvaluated",
          message: "No rerun validation report or Product Preflight report was supplied.",
          target: createStateTarget(proposal, expectedPackageId),
          severity: "warning",
          status: "needs_review"
        })
      ]
    });
  }

  return createRerunResult({
    proposal,
    stateBinding,
    generatedAt,
    status: productPreflightReport.summary.status,
    summary: `Codex proposal ${proposal.proposalId} rerun validation completed with Product Preflight status ${productPreflightReport.summary.status}.`,
    productPreflightReport,
    ...optionalValidationDiff({
      baselineValidationReport: input.baselineValidationReport,
      rerunValidationReports
    }),
    diagnostics: [],
    evidenceRefs: [
      createProductPreflightEvidenceRef({
        proposal,
        report: productPreflightReport
      })
    ]
  });
};

const parseStateBinding = (
  stateBinding: CodexProposalRerunValidationStateBinding
): CodexProposalRerunValidationStateBinding => {
  if (stateBinding.stateScope === "preview") {
    return {
      stateScope: "preview",
      diffPreview: CodexProposalDiffPreviewResultDtoSchema.parse(stateBinding.diffPreview)
    };
  }

  return {
    stateScope: "postCommit",
    packageRevision: stateBinding.packageRevision,
    ...(stateBinding.packageId === undefined ? {} : { packageId: stateBinding.packageId })
  };
};

const evaluateSourceState = (input: {
  readonly proposal: CodexRiggingEditProposalDto;
  readonly validationResult: CodexProposalValidationResultDto;
  readonly stateBinding: CodexProposalRerunValidationStateBinding;
}): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [];

  if (input.validationResult.proposalId !== input.proposal.proposalId) {
    diagnostics.push(createRerunDiagnostic({
      checkId: "codexProposal.rerunValidation.proposalMismatch",
      message: `Validation result ${input.validationResult.proposalId} does not match proposal ${input.proposal.proposalId}.`,
      target: createStateTarget(input.proposal),
      severity: "blocking"
    }));
  }

  if (input.validationResult.status !== "valid") {
    diagnostics.push(createRerunDiagnostic({
      checkId: "codexProposal.rerunValidation.validationNotReady",
      message: `Proposal validation status ${input.validationResult.status} is not ready for rerun validation.`,
      target: createStateTarget(input.proposal),
      severity: "blocking"
    }));
  }

  if (input.stateBinding.stateScope === "preview") {
    const diffPreview = input.stateBinding.diffPreview;
    if (diffPreview.proposalId !== input.proposal.proposalId) {
      diagnostics.push(createRerunDiagnostic({
        checkId: "codexProposal.rerunValidation.previewMismatch",
        message: `Diff preview ${diffPreview.proposalId} does not match proposal ${input.proposal.proposalId}.`,
        target: createStateTarget(input.proposal),
        severity: "blocking"
      }));
    }

    if (diffPreview.status !== "ready" || diffPreview.previewPackageRevision === undefined) {
      diagnostics.push(createRerunDiagnostic({
        checkId: "codexProposal.rerunValidation.previewNotReady",
        message: `Diff preview ${diffPreview.previewId} is ${diffPreview.status} and cannot be used for rerun validation.`,
        target: {
          kind: "package",
          id: input.proposal.packageContext.packageId ?? "pkg_codexProposalPreview"
        },
        severity: "blocking"
      }));
    }
  }

  if (
    input.stateBinding.stateScope === "postCommit" &&
    input.proposal.packageContext.packageId !== undefined &&
    input.stateBinding.packageId !== undefined &&
    input.stateBinding.packageId !== input.proposal.packageContext.packageId
  ) {
    diagnostics.push(createRerunDiagnostic({
      checkId: "codexProposal.rerunValidation.packageMismatch",
      message: [
        `Post-commit package ${input.stateBinding.packageId}`,
        `does not match proposal package ${input.proposal.packageContext.packageId}.`
      ].join(" "),
      target: {
        kind: "package",
        id: input.stateBinding.packageId
      },
      severity: "blocking"
    }));
  }

  return diagnostics;
};

const evaluateFreshness = (input: {
  readonly expectedPackageRevision: number;
  readonly expectedPackageId: string | undefined;
  readonly productPreflightReport: ProductPreflightReportDto | undefined;
  readonly rerunValidationReports: readonly ValidationReportDto[];
}): DiagnosticDto[] => [
  ...evaluateReportFreshness({
    reportLabel: "Product Preflight report",
    packageRevision: input.productPreflightReport?.packageRevision,
    packageId: input.productPreflightReport?.packageId,
    expectedPackageRevision: input.expectedPackageRevision,
    expectedPackageId: input.expectedPackageId
  }),
  ...input.rerunValidationReports.flatMap((report) =>
    evaluateReportFreshness({
      reportLabel: `Validation report ${report.reportId}`,
      packageRevision: report.packageRevision,
      packageId: report.packageId,
      expectedPackageRevision: input.expectedPackageRevision,
      expectedPackageId: input.expectedPackageId
    })
  )
];

const evaluateReportFreshness = (input: {
  readonly reportLabel: string;
  readonly packageRevision: number | undefined;
  readonly packageId: string | undefined;
  readonly expectedPackageRevision: number;
  readonly expectedPackageId: string | undefined;
}): DiagnosticDto[] => {
  if (input.packageRevision === undefined) {
    return [];
  }

  const diagnostics: DiagnosticDto[] = [];
  if (input.packageRevision !== input.expectedPackageRevision) {
    diagnostics.push(createRerunDiagnostic({
      checkId: "codexProposal.rerunValidation.staleEvidence",
      message: [
        `${input.reportLabel} package revision ${input.packageRevision}`,
        `does not match expected state revision ${input.expectedPackageRevision}.`
      ].join(" "),
      target: {
        kind: "package",
        id: input.packageId ?? input.expectedPackageId ?? "pkg_codexProposalRerun"
      },
      severity: "blocking"
    }));
  }

  if (
    input.expectedPackageId !== undefined &&
    input.packageId !== undefined &&
    input.packageId !== input.expectedPackageId
  ) {
    diagnostics.push(createRerunDiagnostic({
      checkId: "codexProposal.rerunValidation.staleEvidence",
      message: `${input.reportLabel} package id ${input.packageId} does not match expected package ${input.expectedPackageId}.`,
      target: {
        kind: "package",
        id: input.packageId
      },
      severity: "blocking"
    }));
  }

  return diagnostics;
};

const buildProductPreflightReportIfPossible = (input: {
  readonly proposal: CodexRiggingEditProposalDto;
  readonly generatedAt: string;
  readonly validationReports: readonly ValidationReportDto[];
  readonly categoryEvidenceRefs?: ProductPreflightCategoryEvidenceRefsInput;
}): ProductPreflightReportDto | undefined => {
  if (input.validationReports.length === 0) {
    return undefined;
  }

  return buildProductPreflightReport({
    reportId: `preflight_${sanitizeToken(input.proposal.proposalId)}`,
    createdAt: input.generatedAt,
    validationReports: input.validationReports,
    ...(input.categoryEvidenceRefs === undefined
      ? {}
      : { categoryEvidenceRefs: input.categoryEvidenceRefs })
  });
};

const optionalValidationDiff = (input: {
  readonly baselineValidationReport: ValidationReportDto | undefined;
  readonly rerunValidationReports: readonly ValidationReportDto[];
}): { readonly validationDiff?: ValidationDiffDto } => {
  const candidate = input.rerunValidationReports[0];
  if (input.baselineValidationReport === undefined || candidate === undefined) {
    return {};
  }

  return {
    validationDiff: buildValidationDiff({
      baseline: input.baselineValidationReport,
      candidate
    })
  };
};

const createRerunResult = (input: {
  readonly proposal: CodexRiggingEditProposalDto;
  readonly stateBinding: CodexProposalRerunValidationStateBinding;
  readonly generatedAt: string;
  readonly status: ProductPreflightStatusDto;
  readonly summary: string;
  readonly validationDiff?: ValidationDiffDto;
  readonly productPreflightReport?: ProductPreflightReportDto;
  readonly diagnostics: readonly DiagnosticDto[];
  readonly evidenceRefs?: readonly CodexProposalEvidenceRefDto[];
}): CodexProposalRerunValidationResultDto =>
  CodexProposalRerunValidationResultDtoSchema.parse({
    schemaVersion: "codex-proposal-rerun-validation-result-v0",
    proposalId: input.proposal.proposalId,
    ...(input.stateBinding.stateScope === "preview"
      ? { previewId: input.stateBinding.diffPreview.previewId }
      : {}),
    generatedAt: input.generatedAt,
    stateScope: input.stateBinding.stateScope,
    status: input.status,
    summary: input.summary,
    ...(input.validationDiff === undefined ? {} : { validationDiff: input.validationDiff }),
    ...(input.productPreflightReport === undefined
      ? {}
      : { productPreflightReport: input.productPreflightReport }),
    diagnostics: [...input.diagnostics],
    evidenceRefs: [
      createRerunValidationEvidenceRef({
        proposal: input.proposal,
        stateBinding: input.stateBinding
      }),
      ...(input.evidenceRefs ?? [])
    ]
  });

const createRerunValidationEvidenceRef = (input: {
  readonly proposal: CodexRiggingEditProposalDto;
  readonly stateBinding: CodexProposalRerunValidationStateBinding;
}): CodexProposalEvidenceRefDto => {
  const stateToken = input.stateBinding.stateScope === "preview"
    ? input.stateBinding.diffPreview.previewId
    : `postCommit_r${input.stateBinding.packageRevision}`;
  const packageId =
    getExpectedPackageId(input.proposal, input.stateBinding) ?? "pkg_codexProposalRerun";

  return {
    evidenceId: `evidence_${sanitizeToken(input.proposal.proposalId)}_${sanitizeToken(stateToken)}_rerunValidation`,
    evidenceKind: "rerunValidation",
    artifactRef: {
      artifactKind: "rerunValidation",
      path: `generated/codex-proposals/${sanitizePathStem(input.proposal.proposalId)}.${sanitizePathStem(stateToken)}.rerun-validation.json`
    },
    target: {
      kind: "package",
      id: packageId
    },
    summary: `Rerun validation evidence for proposal ${input.proposal.proposalId} and ${input.stateBinding.stateScope} state.`,
    producer: "validatorCore"
  };
};

const createProductPreflightEvidenceRef = (input: {
  readonly proposal: CodexRiggingEditProposalDto;
  readonly report: ProductPreflightReportDto;
}): CodexProposalEvidenceRefDto => ({
  evidenceId: `evidence_${sanitizeToken(input.proposal.proposalId)}_${sanitizeToken(input.report.reportId)}_productPreflight`,
  evidenceKind: "productPreflight",
  artifactRef: {
    artifactKind: "productPreflightReport",
    path: `generated/product-preflight/${sanitizePathStem(input.report.reportId)}.product-preflight.json`
  },
  target: {
    kind: "package",
    id: input.report.packageId
  },
  summary: `Product Preflight report ${input.report.reportId} for proposal ${input.proposal.proposalId}.`,
  producer: "validatorCore"
});

const getExpectedPackageRevision = (
  stateBinding: CodexProposalRerunValidationStateBinding
): number =>
  stateBinding.stateScope === "preview"
    ? stateBinding.diffPreview.previewPackageRevision ?? stateBinding.diffPreview.basePackageRevision
    : stateBinding.packageRevision;

const getExpectedPackageId = (
  proposal: CodexRiggingEditProposalDto,
  stateBinding: CodexProposalRerunValidationStateBinding
): string | undefined =>
  stateBinding.stateScope === "postCommit"
    ? proposal.packageContext.packageId ?? stateBinding.packageId
    : proposal.packageContext.packageId ?? getPreviewEvidencePackageId(stateBinding.diffPreview);

const getPreviewEvidencePackageId = (
  diffPreview: CodexProposalDiffPreviewResultDto
): string | undefined => {
  const dryRunDiffPreviewTarget = diffPreview.evidenceRefs.find(
    (evidenceRef) =>
      evidenceRef.evidenceKind === "dryRunDiffPreview" &&
      evidenceRef.target?.kind === "package"
  )?.target;
  if (dryRunDiffPreviewTarget?.kind === "package") {
    return dryRunDiffPreviewTarget.id;
  }

  const packageTarget = diffPreview.evidenceRefs.find(
    (evidenceRef) => evidenceRef.target?.kind === "package"
  )?.target;
  return packageTarget?.kind === "package" ? packageTarget.id : undefined;
};

const createStateTarget = (
  proposal: CodexRiggingEditProposalDto,
  packageId?: string
): TargetRefDto => ({
  kind: "package",
  id: packageId ?? proposal.packageContext.packageId ?? "pkg_codexProposalRerun"
});

const createRerunDiagnostic = (input: {
  readonly checkId: string;
  readonly message: string;
  readonly target: TargetRefDto;
  readonly severity?: DiagnosticDto["severity"];
  readonly status?: DiagnosticDto["status"];
}): DiagnosticDto =>
  DiagnosticSchema.parse({
    checkId: input.checkId,
    status: input.status ?? "fail",
    severity: input.severity ?? "error",
    phase: "codexProposal.rerunValidation",
    target: input.target,
    message: input.message,
    evidence: [],
    relatedAC: [],
    relatedScenarios: [],
    repairCandidateIds: []
  });

const sanitizeToken = (value: string): string =>
  value.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "rerun";

const sanitizePathStem = (value: string): string =>
  value.replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "") || "rerun";
