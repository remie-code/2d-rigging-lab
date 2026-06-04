import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createInitialAuthoringRevision,
  getPartById,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import {
  CodexProposalDiffPreviewResultDtoSchema,
  CodexProposalValidationResultDtoSchema,
  CodexRiggingEditProposalDtoSchema,
  PackageIdSchema,
  PartIdSchema,
  type CodexProposalValidationResultDto,
  type CodexRiggingEditProposalDto
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { previewCodexProposalDiff } from "./codex-proposal-preview.js";

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

describe("Wave40 Codex proposal diff preview fixtures", () => {
  it("matches the ready diff preview fixture without mutating committed state", () => {
    const proposalCases = ProposalCasesFixtureSchema.parse(readJson("request/proposal-cases.json"));
    const proposal = findProposal(proposalCases, "valid-proposal");
    const expectedPreview = CodexProposalDiffPreviewResultDtoSchema.parse(
      readJson("expected/diff-preview-ready.json")
    );
    const session = createFixtureSession();

    const result = previewCodexProposalDiff({
      session,
      proposal,
      validationResult: createValidValidationResult(proposal, proposalCases.generatedAt),
      generatedAt: proposalCases.generatedAt
    });

    expect(result.diffPreview).toEqual(expectedPreview);
    expect(result.operationResults.map((operationResult) => operationResult.status)).toEqual([
      "dry_run"
    ]);
    expect(session.packageRevision).toBe(0);
    expect(getPartById(session.graph, PartIdSchema.parse("part_wave40CodexFace"))).toBeUndefined();
    expect(result.previewSession).not.toBe(session);
    expect(result.previewSession?.packageRevision).toBe(1);
    expect(getPartById(
      result.previewSession!.graph,
      PartIdSchema.parse("part_wave40CodexFace")
    )).toMatchObject({
      displayName: "Wave40 Codex Face",
      parentPartId: "part_root"
    });
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
    summary: "Proposal is valid for the Wave40 fixture preview.",
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

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_wave40CodexProposal"),
    packageDisplayName: "Wave40 Codex Proposal Fixture",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 128, height: 128 },
    parts: [
      {
        partId: PartIdSchema.parse("part_root"),
        displayName: "Root",
        childPartIds: [],
        drawableIds: []
      }
    ],
    drawables: [],
    meshes: [],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [],
    rigControlRootIds: [],
    stableOrder: ["part_root"],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
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
