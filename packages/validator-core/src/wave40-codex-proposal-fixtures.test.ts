import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CodexProposalDiffPreviewResultDtoSchema,
  CodexProposalValidationResultDtoSchema,
  CodexRiggingEditProposalDtoSchema,
  PackageIdSchema,
  ValidationProfileSchema,
  type CodexProposalValidationResultDto,
  type CodexRiggingEditProposalDto
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createCodexProposalRerunValidationResult } from "./codex-proposal-rerun-validation.js";
import { buildValidationReport } from "./report-builder.js";
import {
  ValidationCheckResultSchema,
  ValidationReportEvidenceSchema
} from "./validation-report.js";

const ProposalCaseSchema = z.object({
  caseId: z.string(),
  proposal: CodexRiggingEditProposalDtoSchema
}).strict();

const ProposalCasesFixtureSchema = z.object({
  schemaVersion: z.literal("wave40-codex-proposal-cases-v1"),
  fixtureId: z.literal("wave40-codex-proposal-fixtures"),
  generatedAt: z.string().datetime(),
  cases: z.array(ProposalCaseSchema)
}).passthrough();

const RerunValidationReportInputSchema = z.object({
  schemaVersion: z.literal("wave40-codex-proposal-rerun-validation-report-input-v1"),
  fixtureId: z.literal("wave40-codex-proposal-fixtures"),
  reportId: z.string(),
  createdAt: z.string().datetime(),
  packageId: PackageIdSchema,
  packageRevision: z.number().int().nonnegative(),
  packageHash: z.string().optional(),
  profile: ValidationProfileSchema,
  relatedScenarios: z.array(z.string()).default([]),
  evidence: ValidationReportEvidenceSchema,
  checks: z.array(ValidationCheckResultSchema).default([])
}).strict();

const RerunSummarySchema = z.object({
  schemaVersion: z.literal("wave40-codex-proposal-rerun-validation-summary-v1"),
  fixtureId: z.literal("wave40-codex-proposal-fixtures"),
  caseId: z.literal("valid-proposal"),
  proposalId: z.string(),
  previewId: z.string(),
  generatedAt: z.string().datetime(),
  stateScope: z.literal("preview"),
  expectedStatus: z.string(),
  expectedProductPreflightReportId: z.string(),
  expectedProductPreflightStatus: z.string(),
  expectedProductPreflightPackageId: z.string(),
  expectedProductPreflightPackageRevision: z.number().int().nonnegative(),
  expectedDiagnosticCheckIds: z.array(z.string()),
  expectedEvidenceKinds: z.array(z.string()),
  expectedEvidencePaths: z.array(z.string())
}).strict();

describe("Wave40 Codex proposal rerun validation fixtures", () => {
  it("matches the preview-scoped rerun validation summary fixture", () => {
    const proposalCases = ProposalCasesFixtureSchema.parse(readJson("request/proposal-cases.json"));
    const proposal = findProposal(proposalCases, "valid-proposal");
    const diffPreview = CodexProposalDiffPreviewResultDtoSchema.parse(
      readJson("expected/diff-preview-ready.json")
    );
    const reportInput = RerunValidationReportInputSchema.parse(
      readJson("request/rerun-validation-report-input.json")
    );
    const expected = RerunSummarySchema.parse(
      readJson("expected/rerun-validation-summary.json")
    );
    const validationReport = buildValidationReport({
      reportId: reportInput.reportId,
      createdAt: reportInput.createdAt,
      packageId: reportInput.packageId,
      packageRevision: reportInput.packageRevision,
      ...(reportInput.packageHash === undefined ? {} : { packageHash: reportInput.packageHash }),
      profile: reportInput.profile,
      relatedScenarios: reportInput.relatedScenarios,
      evidence: reportInput.evidence,
      checks: reportInput.checks
    });

    const result = createCodexProposalRerunValidationResult({
      proposal,
      validationResult: createValidValidationResult(proposal, proposalCases.generatedAt),
      stateBinding: {
        stateScope: "preview",
        diffPreview
      },
      rerunValidationReports: [validationReport],
      generatedAt: proposalCases.generatedAt
    });

    expect(result.proposalId).toBe(expected.proposalId);
    expect(result.previewId).toBe(expected.previewId);
    expect(result.generatedAt).toBe(expected.generatedAt);
    expect(result.stateScope).toBe(expected.stateScope);
    expect(result.status).toBe(expected.expectedStatus);
    expect(result.productPreflightReport?.reportId).toBe(
      expected.expectedProductPreflightReportId
    );
    expect(result.productPreflightReport?.summary.status).toBe(
      expected.expectedProductPreflightStatus
    );
    expect(result.productPreflightReport?.packageId).toBe(
      expected.expectedProductPreflightPackageId
    );
    expect(result.productPreflightReport?.packageRevision).toBe(
      expected.expectedProductPreflightPackageRevision
    );
    expect(result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual(
      expected.expectedDiagnosticCheckIds
    );
    expect(result.evidenceRefs.map((evidenceRef) => evidenceRef.evidenceKind)).toEqual(
      expected.expectedEvidenceKinds
    );
    expect(result.evidenceRefs.map((evidenceRef) => evidenceRef.artifactRef.path)).toEqual(
      expected.expectedEvidencePaths
    );
  });
});

const createValidValidationResult = (
  proposal: CodexRiggingEditProposalDto,
  checkedAt: string
): CodexProposalValidationResultDto =>
  CodexProposalValidationResultDtoSchema.parse({
    schemaVersion: "codex-proposal-validation-result-v0",
    proposalId: proposal.proposalId,
    checkedAt,
    status: "valid",
    summary: "Proposal is valid for the Wave40 fixture rerun validation.",
    canPreview: true,
    canRequestApproval: true,
    approvalGate: {
      requiresUserApproval: true,
      automaticCommitAllowed: false,
      approvalReady: true
    },
    operationResults: proposal.operations.map((operation) => ({
      stepId: operation.stepId,
      operationType: operation.operationType,
      status: "valid",
      issueIds: [],
      diagnosticRefs: [],
      checkedTargetRefs: operation.targetRefs
    })),
    issues: [],
    evidenceRefs: []
  });

const findProposal = (
  fixture: z.infer<typeof ProposalCasesFixtureSchema>,
  caseId: string
): CodexRiggingEditProposalDto => {
  const fixtureCase = fixture.cases.find((entry) => entry.caseId === caseId);
  expect(fixtureCase).toBeDefined();
  if (fixtureCase === undefined) {
    throw new Error(`Missing proposal fixture case ${caseId}.`);
  }
  return fixtureCase.proposal;
};

const readJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/wave40-codex-proposal-fixtures"
);
