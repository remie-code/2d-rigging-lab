import {
  CodexProposalIdDtoSchema,
  CodexProposalOperationCatalogDtoSchema,
  CodexProposalValidationResultDtoSchema,
  CodexRiggingEditProposalDtoSchema,
  ProductPreflightReportDtoSchema,
  type CodexProposalOperationCatalogDto,
  type CodexProposalOperationCatalogEntryDto,
  type CodexProposalOperationValidationResultDto,
  type CodexProposalValidationIssueCodeDto,
  type CodexProposalValidationIssueDto,
  type CodexProposalValidationResultDto,
  type CodexRiggingEditProposalDto,
  type ProductPreflightDiagnosticRefDto,
  type ProductPreflightReportDto,
  type TargetRefDto
} from "@private-2d-rigging-lab/contracts";
import { OperationPayloadSchema } from "@private-2d-rigging-lab/operation-core";
import type { z } from "zod";

import { getCodexProposalOperationCatalog } from "./ai-codex-proposal-operation-catalog.js";

export interface ValidateCodexProposalInput {
  readonly proposal: unknown;
  readonly operationCatalog?: unknown;
  readonly productPreflightReport?: unknown;
  readonly checkedAt?: string;
}

const DEFAULT_CHECKED_AT = "1970-01-01T00:00:00.000Z";
const FALLBACK_PROPOSAL_ID = "proposal_unparseable";

type ValidationIssueDraft = {
  readonly code: CodexProposalValidationIssueDto["code"];
  readonly severity: CodexProposalValidationIssueDto["severity"];
  readonly message: string;
  readonly stepId?: CodexProposalValidationIssueDto["stepId"];
  readonly target?: CodexProposalValidationIssueDto["target"];
  readonly diagnosticRefs?: readonly CodexProposalValidationIssueDto["diagnosticRefs"][number][];
  readonly evidenceRefs?: readonly CodexProposalValidationIssueDto["evidenceRefs"][number][];
};

export const validateCodexProposal = (
  input: ValidateCodexProposalInput
): CodexProposalValidationResultDto => {
  const checkedAt = input.checkedAt ?? DEFAULT_CHECKED_AT;
  const issueBuilder = new ValidationIssueBuilder(extractProposalId(input.proposal));
  const proposalParse = CodexRiggingEditProposalDtoSchema.safeParse(input.proposal);

  if (!proposalParse.success) {
    issueBuilder.add({
      code: "schemaInvalid",
      severity: "blocking",
      message: `Codex proposal schema validation failed: ${formatZodIssues(proposalParse.error.issues)}`
    });

    return buildValidationResult({
      proposalId: issueBuilder.proposalId,
      checkedAt,
      issues: issueBuilder.issues,
      operationResults: []
    });
  }

  const catalogParse =
    input.operationCatalog === undefined
      ? { success: true as const, data: getCodexProposalOperationCatalog() }
      : CodexProposalOperationCatalogDtoSchema.safeParse(input.operationCatalog);

  if (!catalogParse.success) {
    issueBuilder.add({
      code: "operationCatalogMismatch",
      severity: "blocking",
      message: `Codex proposal operation catalog validation failed: ${formatZodIssues(catalogParse.error.issues)}`
    });

    return buildValidationResult({
      proposalId: proposalParse.data.proposalId,
      checkedAt,
      issues: issueBuilder.issues,
      operationResults: []
    });
  }

  const productPreflightReport = parseProductPreflightReport(input.productPreflightReport, issueBuilder);
  validatePreflightContext(proposalParse.data, productPreflightReport, issueBuilder);

  const operationResults = validateOperations({
    proposal: proposalParse.data,
    catalog: catalogParse.data,
    issueBuilder
  });

  return buildValidationResult({
    proposalId: proposalParse.data.proposalId,
    checkedAt,
    catalogId: catalogParse.data.catalogId,
    issues: issueBuilder.issues,
    operationResults
  });
};

const parseProductPreflightReport = (
  reportInput: unknown,
  issueBuilder: ValidationIssueBuilder
): ProductPreflightReportDto | undefined => {
  if (reportInput === undefined) {
    return undefined;
  }

  const reportParse = ProductPreflightReportDtoSchema.safeParse(reportInput);
  if (!reportParse.success) {
    issueBuilder.add({
      code: "schemaInvalid",
      severity: "blocking",
      message: `Product Preflight report schema validation failed: ${formatZodIssues(reportParse.error.issues)}`
    });
    return undefined;
  }

  return reportParse.data;
};

const validatePreflightContext = (
  proposal: CodexRiggingEditProposalDto,
  report: ProductPreflightReportDto | undefined,
  issueBuilder: ValidationIssueBuilder
): void => {
  if (report === undefined) {
    issueBuilder.add({
      code: "preflightContextMissing",
      severity: "warning",
      message:
        "A current Product Preflight report was not supplied, so proposal validation cannot evaluate blocking, unsupported, or not-evaluated preflight context."
    });
    return;
  }

  const context = proposal.packageContext;

  if (context.packageId !== undefined && context.packageId !== report.packageId) {
    issueBuilder.add({
      code: "preflightContextMissing",
      severity: "error",
      message: `Proposal packageId ${context.packageId} does not match Product Preflight packageId ${report.packageId}.`
    });
  }

  if (
    context.productPreflightReportId !== undefined &&
    context.productPreflightReportId !== report.reportId
  ) {
    issueBuilder.add({
      code: "preflightContextMissing",
      severity: "error",
      message:
        `Proposal Product Preflight report id ${context.productPreflightReportId} does not match supplied report ${report.reportId}.`
    });
  }

  if (
    context.productPreflightStatus !== undefined &&
    context.productPreflightStatus !== report.summary.status
  ) {
    issueBuilder.add({
      code: "preflightContextMissing",
      severity: "error",
      message:
        `Proposal Product Preflight status ${context.productPreflightStatus} does not match supplied report status ${report.summary.status}.`
    });
  }

  if (context.packageHash !== undefined && report.packageHash !== context.packageHash) {
    issueBuilder.add({
      code: "preflightContextMissing",
      severity: "error",
      message: "Proposal package hash does not match the supplied Product Preflight report hash."
    });
  }

  if (context.basePackageRevision !== report.packageRevision) {
    issueBuilder.add({
      code: "stalePackageRevision",
      severity: "blocking",
      message:
        `Proposal base package revision ${context.basePackageRevision} does not match Product Preflight revision ${report.packageRevision}.`
    });
  }

  const missingValidationReportIds = context.validationReportIds.filter(
    (reportId) => !report.sourceValidationReportIds.includes(reportId)
  );
  if (missingValidationReportIds.length > 0) {
    issueBuilder.add({
      code: "preflightContextMissing",
      severity: "error",
      message:
        `Product Preflight report does not include proposal validation reports: ${missingValidationReportIds.join(", ")}.`
    });
  }

  switch (report.summary.status) {
    case "pass":
      return;
    case "warn":
      issueBuilder.add({
        code: "requiresUserDecision",
        severity: "warning",
        message:
          "Product Preflight status is warn; user review is required before this proposal can request approval.",
        diagnosticRefs: collectReportDiagnosticRefs(report)
      });
      return;
    case "fail":
      issueBuilder.add({
        code: "preflightBlocking",
        severity: "blocking",
        message:
          "Product Preflight status is fail; blocking preflight reasons must be resolved outside proposal validation.",
        diagnosticRefs: collectReportDiagnosticRefs(report)
      });
      return;
    case "not_supported":
      issueBuilder.add({
        code: "unsupportedBoundary",
        severity: "blocking",
        message:
          "Product Preflight status is not_supported; proposal validation will not convert unsupported capabilities into repair actions.",
        diagnosticRefs: collectReportDiagnosticRefs(report)
      });
      return;
    case "not_evaluated":
      issueBuilder.add({
        code: "notEvaluated",
        severity: "warning",
        message:
          "Product Preflight status is not_evaluated; required preflight evidence must be supplied before the proposal can proceed.",
        diagnosticRefs: collectReportDiagnosticRefs(report)
      });
      return;
  }
};

const validateOperations = (input: {
  readonly proposal: CodexRiggingEditProposalDto;
  readonly catalog: CodexProposalOperationCatalogDto;
  readonly issueBuilder: ValidationIssueBuilder;
}): readonly CodexProposalOperationValidationResultDto[] => {
  const catalogByOperationType = new Map(
    input.catalog.operations.map((operation) => [operation.operationType, operation])
  );

  return input.proposal.operations.map((operation) => {
    const issueIds: string[] = [];
    const addOperationIssue = (
      issue: Omit<ValidationIssueDraft, "stepId">
    ): void => {
      const createdIssue = input.issueBuilder.add({
        ...issue,
        stepId: operation.stepId
      });
      issueIds.push(createdIssue.issueId);
    };

    const catalogEntry = catalogByOperationType.get(operation.operationType);
    if (catalogEntry === undefined) {
      addOperationIssue({
        code: "unsupportedOperation",
        severity: "blocking",
        message:
          `Operation ${operation.operationType} is not present in catalog ${input.catalog.catalogId}.`
      });

      return buildOperationResult(operation, "invalid", issueIds);
    }

    if (catalogEntry.availability !== "available") {
      addOperationIssue({
        code: "unsupportedOperation",
        severity: "blocking",
        message:
          `Operation ${operation.operationType} is ${catalogEntry.availability} and cannot be previewed or approved.`
      });
      addOperationIssue({
        code: "unsupportedBoundary",
        severity: "blocking",
        message:
          `Operation ${operation.operationType} crosses unsupported boundaries: ${catalogEntry.unsupportedBoundaryKinds.join(", ")}.`
      });

      return buildOperationResult(operation, "unsupported", issueIds);
    }

    validateOperationTargets(operation, catalogEntry, addOperationIssue);
    validateCatalogRequiredInputs(operation, catalogEntry, addOperationIssue);

    const payloadParse = OperationPayloadSchema.safeParse({
      operationType: operation.operationType,
      payload: operation.payload
    });
    if (!payloadParse.success) {
      addOperationIssue({
        code: "schemaInvalid",
        severity: "blocking",
        message: `Operation payload schema validation failed: ${formatZodIssues(payloadParse.error.issues)}`
      });
    }

    validateExpectedPreconditions(operation, addOperationIssue);

    return buildOperationResult(operation, deriveOperationStatus(issueIds, input.issueBuilder.issues), issueIds);
  });
};

const validateOperationTargets = (
  operation: CodexRiggingEditProposalDto["operations"][number],
  catalogEntry: CodexProposalOperationCatalogEntryDto,
  addOperationIssue: (
    issue: Omit<ValidationIssueDraft, "stepId">
  ) => void
): void => {
  const requiresTarget = catalogEntry.requiredInputs.some(
    (input) => input.required && input.inputKind === "targetRef"
  );
  if (requiresTarget && operation.targetRefs.length === 0) {
    addOperationIssue({
      code: "targetRefInvalid",
      severity: "error",
      message: `Operation ${operation.operationType} requires at least one target ref.`
    });
  }

  const allowedTargetKinds = new Set(catalogEntry.targetKinds);
  for (const targetRef of operation.targetRefs) {
    if (targetRef.id.trim().length === 0) {
      addOperationIssue({
        code: "targetRefInvalid",
        severity: "error",
        message: `Operation ${operation.operationType} has an empty target ref id.`,
        target: targetRef
      });
    }

    if (allowedTargetKinds.size > 0 && !allowedTargetKinds.has(targetRef.kind)) {
      addOperationIssue({
        code: "targetRefInvalid",
        severity: "error",
        message:
          `Target kind ${targetRef.kind} is not listed for operation ${operation.operationType} in the catalog.`,
        target: targetRef
      });
    }
  }
};

const validateCatalogRequiredInputs = (
  operation: CodexRiggingEditProposalDto["operations"][number],
  catalogEntry: CodexProposalOperationCatalogEntryDto,
  addOperationIssue: (
    issue: Omit<ValidationIssueDraft, "stepId">
  ) => void
): void => {
  for (const descriptor of catalogEntry.requiredInputs) {
    if (!descriptor.required || descriptor.inputKind !== "payloadField") {
      continue;
    }

    const payloadPath = descriptor.inputId.replace(/^payload\./, "");
    if (!hasPath(operation.payload, payloadPath)) {
      addOperationIssue({
        code: "schemaInvalid",
        severity: "error",
        message:
          `Operation ${operation.operationType} is missing required catalog payload field ${payloadPath}.`
      });
    }
  }
};

const validateExpectedPreconditions = (
  operation: CodexRiggingEditProposalDto["operations"][number],
  addOperationIssue: (
    issue: Omit<ValidationIssueDraft, "stepId">
  ) => void
): void => {
  for (const precondition of operation.expectedPreconditions) {
    switch (precondition.preconditionKind) {
      case "targetExists":
      case "targetEditable":
        addOperationIssue({
          code: "notEvaluated",
          severity: "warning",
          message:
            `${precondition.preconditionKind} cannot be proven by proposal validation without a target inventory from the host.`,
          ...(precondition.target === undefined ? {} : { target: precondition.target })
        });
        break;
      case "validationReportAvailable":
        addOperationIssue({
          code: "notEvaluated",
          severity: "warning",
          message:
            "validationReportAvailable is recorded as an expected precondition; proposal validation does not rerun or inspect validation reports in Domain B."
        });
        break;
      case "userDecisionRequired":
        addOperationIssue({
          code: "requiresUserDecision",
          severity: "warning",
          message: precondition.summary,
          ...(precondition.target === undefined ? {} : { target: precondition.target })
        });
        break;
      case "packageRevisionMatches":
      case "preflightAllowsPreview":
        break;
    }
  }
};

const buildOperationResult = (
  operation: CodexRiggingEditProposalDto["operations"][number],
  status: CodexProposalOperationValidationResultDto["status"],
  issueIds: readonly string[]
): CodexProposalOperationValidationResultDto => ({
  stepId: operation.stepId,
  operationType: operation.operationType,
  status,
  issueIds: [...issueIds],
  diagnosticRefs: [],
  checkedTargetRefs: [...sortAndDedupeTargetRefs(operation.targetRefs)]
});

const buildValidationResult = (input: {
  readonly proposalId: string;
  readonly checkedAt: string;
  readonly catalogId?: string;
  readonly issues: readonly CodexProposalValidationIssueDto[];
  readonly operationResults: readonly CodexProposalOperationValidationResultDto[];
}): CodexProposalValidationResultDto => {
  const status = deriveValidationStatus(input.issues);

  return CodexProposalValidationResultDtoSchema.parse({
    schemaVersion: "codex-proposal-validation-result-v0",
    proposalId: input.proposalId,
    checkedAt: input.checkedAt,
    status,
    summary: summarizeValidationStatus(status),
    ...(input.catalogId === undefined ? {} : { catalogId: input.catalogId }),
    canPreview: status === "valid",
    canRequestApproval: status === "valid",
    approvalGate: {
      requiresUserApproval: true,
      automaticCommitAllowed: false,
      approvalReady: status === "valid"
    },
    operationResults: input.operationResults,
    issues: input.issues,
    evidenceRefs: []
  });
};

const deriveOperationStatus = (
  issueIds: readonly string[],
  issues: readonly CodexProposalValidationIssueDto[]
): CodexProposalOperationValidationResultDto["status"] => {
  const operationIssues = issues.filter((issue) => issueIds.includes(issue.issueId));
  if (operationIssues.some((issue) => issue.code === "unsupportedOperation" || issue.code === "unsupportedBoundary")) {
    return "unsupported";
  }
  if (operationIssues.some((issue) => INVALID_ISSUE_CODES.has(issue.code))) {
    return "invalid";
  }
  if (operationIssues.some((issue) => NOT_EVALUATED_ISSUE_CODES.has(issue.code))) {
    return "not_evaluated";
  }
  if (operationIssues.some((issue) => issue.code === "requiresUserDecision")) {
    return "requires_user_decision";
  }
  return "valid";
};

const deriveValidationStatus = (
  issues: readonly CodexProposalValidationIssueDto[]
): CodexProposalValidationResultDto["status"] => {
  if (issues.some((issue) => INVALID_ISSUE_CODES.has(issue.code))) {
    return "invalid";
  }
  if (issues.some((issue) => NOT_EVALUATED_ISSUE_CODES.has(issue.code))) {
    return "not_evaluated";
  }
  if (issues.some((issue) => issue.code === "requiresUserDecision")) {
    return "requires_user_decision";
  }
  return "valid";
};

const INVALID_ISSUE_CODES = new Set<CodexProposalValidationIssueCodeDto>([
  "schemaInvalid",
  "operationCatalogMismatch",
  "unsupportedOperation",
  "unsupportedBoundary",
  "targetRefInvalid",
  "preflightBlocking",
  "stalePackageRevision"
]);

const NOT_EVALUATED_ISSUE_CODES = new Set<CodexProposalValidationIssueCodeDto>([
  "operationCatalogMissing",
  "preflightContextMissing",
  "notEvaluated"
]);

const summarizeValidationStatus = (
  status: CodexProposalValidationResultDto["status"]
): string => {
  switch (status) {
    case "valid":
      return "Proposal validates against the deterministic catalog and supplied Product Preflight context.";
    case "invalid":
      return "Proposal is not committable because schema, catalog, target, unsupported boundary, stale context, or blocking preflight checks failed.";
    case "not_evaluated":
      return "Proposal could not be fully evaluated because required context or target evidence is missing.";
    case "requires_user_decision":
      return "Proposal requires a user decision before it can request approval.";
  }
};

class ValidationIssueBuilder {
  readonly proposalId: string;
  readonly #issues: CodexProposalValidationIssueDto[] = [];

  constructor(proposalId: string) {
    this.proposalId = proposalId;
  }

  get issues(): readonly CodexProposalValidationIssueDto[] {
    return this.#issues;
  }

  add(
    issue: ValidationIssueDraft
  ): CodexProposalValidationIssueDto {
    const createdIssue: CodexProposalValidationIssueDto = {
      issueId: `issue_${sanitizeIssueToken(this.proposalId)}_${String(this.#issues.length + 1).padStart(3, "0")}`,
      code: issue.code,
      severity: issue.severity,
      message: issue.message,
      ...(issue.stepId === undefined ? {} : { stepId: issue.stepId }),
      ...(issue.target === undefined ? {} : { target: issue.target }),
      diagnosticRefs: [...(issue.diagnosticRefs ?? [])],
      evidenceRefs: [...(issue.evidenceRefs ?? [])]
    };
    this.#issues.push(createdIssue);
    return createdIssue;
  }
}

const extractProposalId = (proposal: unknown): string => {
  if (!isRecord(proposal)) {
    return FALLBACK_PROPOSAL_ID;
  }

  const proposalIdParse = CodexProposalIdDtoSchema.safeParse(proposal.proposalId);
  return proposalIdParse.success ? proposalIdParse.data : FALLBACK_PROPOSAL_ID;
};

const formatZodIssues = (issues: readonly z.ZodIssue[]): string =>
  issues
    .map((issue) => {
      const path = issue.path.length === 0 ? "<root>" : issue.path.join(".");
      return `${path}: ${issue.message}`;
    })
    .sort()
    .join("; ");

const collectReportDiagnosticRefs = (
  report: ProductPreflightReportDto
): readonly ProductPreflightDiagnosticRefDto[] => [
  ...report.categories.flatMap((category) => category.diagnosticRefs),
  ...report.categories.flatMap((category) =>
    category.blockingReasons.flatMap((reason) => reason.diagnosticRefs)
  ),
  ...report.categories.flatMap((category) =>
    category.unsupportedClaims.flatMap((claim) => claim.diagnosticRefs)
  ),
  ...report.categories.flatMap((category) =>
    category.notEvaluatedClaims.flatMap((claim) => claim.diagnosticRefs)
  )
];

const sortAndDedupeTargetRefs = (targetRefs: readonly TargetRefDto[]): readonly TargetRefDto[] => {
  const sortedRefs = [...targetRefs].sort(compareTargetRefs);
  const byKey = new Map<string, TargetRefDto>();
  for (const targetRef of sortedRefs) {
    const key = `${targetRef.kind}:${targetRef.id}:${targetRef.path ?? ""}`;
    if (!byKey.has(key)) {
      byKey.set(key, targetRef);
    }
  }
  return [...byKey.values()];
};

const compareTargetRefs = (left: TargetRefDto, right: TargetRefDto): number =>
  left.kind.localeCompare(right.kind) ||
  left.id.localeCompare(right.id) ||
  (left.path ?? "").localeCompare(right.path ?? "");

const hasPath = (value: unknown, path: string): boolean => {
  let cursor: unknown = value;
  for (const segment of path.split(".")) {
    if (!isRecord(cursor) || !(segment in cursor)) {
      return false;
    }
    cursor = cursor[segment];
  }
  return cursor !== undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sanitizeIssueToken = (value: string): string =>
  value.replace(/^proposal_/, "").replace(/[^A-Za-z0-9_-]/g, "_");
