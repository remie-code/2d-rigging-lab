import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  CodexProposalDiffPreviewResultDtoSchema,
  CodexProposalOperationAvailabilityDtoSchema,
  CodexProposalOperationValidationStatusDtoSchema,
  CodexProposalValidationIssueCodeDtoSchema,
  CodexProposalValidationStatusDtoSchema,
  CodexRiggingEditProposalDtoSchema,
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  ProductPreflightReportDtoSchema,
  ProductPreflightStatusDtoSchema
} from "./index.js";

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
  createdAt: z.string().datetime(),
  checkedAt: z.string().datetime(),
  generatedAt: z.string().datetime(),
  packageId: z.string(),
  basePackageRevision: z.number().int().nonnegative(),
  cases: z.array(ProposalCaseSchema)
}).strict();

const CatalogSummarySchema = z.object({
  schemaVersion: z.literal("wave40-codex-proposal-operation-catalog-summary-v1"),
  fixtureId: z.literal("wave40-codex-proposal-fixtures"),
  catalogId: z.string(),
  requiredUnsupportedBoundaryKinds: z.array(z.string()),
  representativeOperations: z.array(z.object({
    operationType: z.string(),
    availability: CodexProposalOperationAvailabilityDtoSchema,
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

const ExpectedValidationOutcomesSchema = z.object({
  schemaVersion: z.literal("wave40-codex-proposal-validation-outcomes-v1"),
  fixtureId: z.literal("wave40-codex-proposal-fixtures"),
  checkedAt: z.string().datetime(),
  cases: z.array(z.object({
    caseId: z.enum(CASE_IDS),
    proposalId: z.string(),
    expectedStatus: CodexProposalValidationStatusDtoSchema,
    expectedCanPreview: z.boolean(),
    expectedCanRequestApproval: z.boolean(),
    expectedApprovalReady: z.boolean(),
    expectedOperationStatuses: z.array(z.object({
      stepId: z.string(),
      operationType: z.string(),
      status: CodexProposalOperationValidationStatusDtoSchema,
      issueIds: z.array(z.string())
    }).strict()),
    expectedIssueCodes: z.array(CodexProposalValidationIssueCodeDtoSchema),
    expectedIssueIds: z.array(z.string())
  }).strict())
}).strict();

const RerunSummarySchema = z.object({
  schemaVersion: z.literal("wave40-codex-proposal-rerun-validation-summary-v1"),
  fixtureId: z.literal("wave40-codex-proposal-fixtures"),
  caseId: z.literal("valid-proposal"),
  proposalId: z.string(),
  previewId: z.string(),
  generatedAt: z.string().datetime(),
  stateScope: z.literal("preview"),
  expectedStatus: ProductPreflightStatusDtoSchema,
  expectedProductPreflightReportId: z.string(),
  expectedProductPreflightStatus: ProductPreflightStatusDtoSchema,
  expectedProductPreflightPackageId: z.string(),
  expectedProductPreflightPackageRevision: z.number().int().nonnegative(),
  expectedDiagnosticCheckIds: z.array(z.string()),
  expectedEvidenceKinds: z.array(z.string()),
  expectedEvidencePaths: z.array(z.string())
}).strict();

const FixtureManifestSchema = z.object({
  schemaVersion: z.literal("contract-fixture-manifest-v1"),
  fixtureId: z.literal("wave40-codex-proposal-fixtures"),
  rightsClean: z.object({
    realAssetBytes: z.literal(false),
    imageDecode: z.literal(false),
    externalDependency: z.literal(false),
    parserOracle: z.literal(false),
    rendererOracle: z.literal(false),
    pixelOracle: z.literal(false),
    archiveFilesystem: z.literal(false),
    cubismCompatibility: z.literal(false)
  }).passthrough(),
  truthfulness: z.object({
    repoSideProposalGenerationClaimed: z.literal(false),
    repairCandidateGenerationClaimed: z.literal(false),
    candidateRankingClaimed: z.literal(false),
    llmProviderClaimed: z.literal(false),
    naturalLanguageRepairClaimed: z.literal(false),
    autoFixClaimed: z.literal(false),
    automaticCommitClaimed: z.literal(false),
    externalTransportClaimed: z.literal(false),
    realParserClaimed: z.literal(false),
    realRendererClaimed: z.literal(false)
  }).passthrough()
}).passthrough();

describe("Wave40 Codex proposal contract fixtures", () => {
  it("validates proposal, Product Preflight, catalog, diff, and rerun fixture schemas", () => {
    const proposalCases = ProposalCasesFixtureSchema.parse(readJson("request/proposal-cases.json"));
    const productPreflight = ProductPreflightReportDtoSchema.parse(
      readJson("request/product-preflight-pass.json")
    );
    const catalogSummary = CatalogSummarySchema.parse(
      readJson("expected/operation-catalog-summary.json")
    );
    const validationOutcomes = ExpectedValidationOutcomesSchema.parse(
      readJson("expected/proposal-validation-outcomes.json")
    );
    const diffPreview = CodexProposalDiffPreviewResultDtoSchema.parse(
      readJson("expected/diff-preview-ready.json")
    );
    const rerunSummary = RerunSummarySchema.parse(
      readJson("expected/rerun-validation-summary.json")
    );

    expect(proposalCases.cases.map((entry) => entry.caseId)).toEqual([...CASE_IDS]);
    expect(validationOutcomes.cases.map((entry) => entry.caseId)).toEqual([...CASE_IDS]);
    expect(productPreflight.categories.map((category) => category.category)).toEqual([
      ...PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS
    ]);
    expect(productPreflight.summary.status).toBe("pass");
    expect(catalogSummary.representativeOperations.map((entry) => entry.operationType)).toEqual([
      "createPart",
      "renderPixelOracle"
    ]);
    expect(diffPreview.proposalId).toBe("proposal_wave40CodexValid");
    expect(diffPreview.status).toBe("ready");
    expect(rerunSummary.expectedStatus).toBe("not_evaluated");
  });

  it("records rights-clean semantic JSON and no unsupported implementation claims", () => {
    const manifest = FixtureManifestSchema.parse(readJson("fixture-manifest.json"));

    expect(manifest.rightsClean).toMatchObject({
      realAssetBytes: false,
      imageDecode: false,
      externalDependency: false,
      parserOracle: false,
      rendererOracle: false,
      pixelOracle: false,
      archiveFilesystem: false,
      cubismCompatibility: false
    });
    expect(manifest.truthfulness).toMatchObject({
      repoSideProposalGenerationClaimed: false,
      repairCandidateGenerationClaimed: false,
      candidateRankingClaimed: false,
      llmProviderClaimed: false,
      naturalLanguageRepairClaimed: false,
      autoFixClaimed: false,
      automaticCommitClaimed: false,
      externalTransportClaimed: false,
      realParserClaimed: false,
      realRendererClaimed: false
    });
  });
});

const readJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/wave40-codex-proposal-fixtures"
);
