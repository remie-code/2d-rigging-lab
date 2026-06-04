import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CODEX_PROPOSAL_REQUIRED_UNSUPPORTED_BOUNDARY_KINDS,
  CodexRiggingEditProposalDtoSchema,
  ProductPreflightReportDtoSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { getCodexProposalOperationCatalog } from "./ai-codex-proposal-operation-catalog.js";
import { validateCodexProposal } from "./ai-codex-proposal-validation.js";

const CASE_IDS = [
  "valid-proposal",
  "invalid-proposal",
  "unsupported-proposal"
] as const;

const ProposalCaseSchema = z.object({
  caseId: z.enum(CASE_IDS),
  proposal: CodexRiggingEditProposalDtoSchema
}).strict();

const ProposalCasesFixtureSchema = z.object({
  schemaVersion: z.literal("wave40-codex-proposal-cases-v1"),
  fixtureId: z.literal("wave40-codex-proposal-fixtures"),
  checkedAt: z.string().datetime(),
  cases: z.array(ProposalCaseSchema)
}).passthrough();

const ExpectedValidationOutcomesSchema = z.object({
  schemaVersion: z.literal("wave40-codex-proposal-validation-outcomes-v1"),
  fixtureId: z.literal("wave40-codex-proposal-fixtures"),
  checkedAt: z.string().datetime(),
  cases: z.array(z.object({
    caseId: z.enum(CASE_IDS),
    proposalId: z.string(),
    expectedStatus: z.string(),
    expectedCanPreview: z.boolean(),
    expectedCanRequestApproval: z.boolean(),
    expectedApprovalReady: z.boolean(),
    expectedOperationStatuses: z.array(z.object({
      stepId: z.string(),
      operationType: z.string(),
      status: z.string(),
      issueIds: z.array(z.string())
    }).strict()),
    expectedIssueCodes: z.array(z.string()),
    expectedIssueIds: z.array(z.string())
  }).strict())
}).strict();

const CatalogSummarySchema = z.object({
  schemaVersion: z.literal("wave40-codex-proposal-operation-catalog-summary-v1"),
  fixtureId: z.literal("wave40-codex-proposal-fixtures"),
  catalogId: z.string(),
  requiredUnsupportedBoundaryKinds: z.array(z.string()),
  representativeOperations: z.array(z.object({
    operationType: z.string(),
    availability: z.string(),
    targetKinds: z.array(z.string()),
    previewSupport: z.object({
      dryRunSupported: z.boolean(),
      standaloneDiffSupported: z.boolean(),
      rerunValidationSupported: z.boolean(),
      productPreflightSupported: z.boolean()
    }).strict(),
    unsupportedBoundaryKinds: z.array(z.string())
  }).strict())
}).strict();

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/wave40-codex-proposal-fixtures"
);

const proposalCases = ProposalCasesFixtureSchema.parse(readJson("request/proposal-cases.json"));
const productPreflightReport = ProductPreflightReportDtoSchema.parse(
  readJson("request/product-preflight-pass.json")
);
const expectedValidationOutcomes = ExpectedValidationOutcomesSchema.parse(
  readJson("expected/proposal-validation-outcomes.json")
);
const expectedValidationByCase = new Map(
  expectedValidationOutcomes.cases.map((entry) => [entry.caseId, entry])
);

describe("Wave40 Codex proposal fixture validation", () => {
  it("matches representative operation catalog outcomes", () => {
    const expected = CatalogSummarySchema.parse(
      readJson("expected/operation-catalog-summary.json")
    );
    const catalog = getCodexProposalOperationCatalog();

    expect(catalog.catalogId).toBe(expected.catalogId);
    expect(catalog.unsupportedBoundaries.map((boundary) => boundary.boundaryKind)).toEqual([
      ...CODEX_PROPOSAL_REQUIRED_UNSUPPORTED_BOUNDARY_KINDS
    ]);
    expect(catalog.unsupportedBoundaries.map((boundary) => boundary.boundaryKind)).toEqual(
      expected.requiredUnsupportedBoundaryKinds
    );

    for (const expectedOperation of expected.representativeOperations) {
      const operation = catalog.operations.find(
        (entry) => entry.operationType === expectedOperation.operationType
      );
      expect(operation).toBeDefined();
      expect(operation).toMatchObject(expectedOperation);
    }
  });

  for (const fixtureCase of proposalCases.cases) {
    it(`validates the ${fixtureCase.caseId} fixture outcome`, () => {
      const expected = expectedValidationByCase.get(fixtureCase.caseId);
      expect(expected).toBeDefined();
      if (expected === undefined) {
        throw new Error(`Missing expected validation outcome for ${fixtureCase.caseId}.`);
      }

      const result = validateCodexProposal({
        proposal: fixtureCase.proposal,
        productPreflightReport,
        checkedAt: proposalCases.checkedAt
      });

      expect(result.proposalId).toBe(expected.proposalId);
      expect(result.status).toBe(expected.expectedStatus);
      expect(result.canPreview).toBe(expected.expectedCanPreview);
      expect(result.canRequestApproval).toBe(expected.expectedCanRequestApproval);
      expect(result.approvalGate.approvalReady).toBe(expected.expectedApprovalReady);
      expect(result.operationResults.map((operationResult) => ({
        stepId: operationResult.stepId,
        operationType: operationResult.operationType,
        status: operationResult.status,
        issueIds: operationResult.issueIds
      }))).toEqual(expected.expectedOperationStatuses);
      expect(result.issues.map((issue) => issue.code)).toEqual(expected.expectedIssueCodes);
      expect(result.issues.map((issue) => issue.issueId)).toEqual(expected.expectedIssueIds);
      expect(result.evidenceRefs).toEqual([]);
    });
  }
});

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));
}
