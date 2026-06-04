import { z } from "zod";

import { SeveritySchema } from "./enums.js";
import {
  CodexProposalOperationTypeDtoSchema,
  CodexProposalEvidenceRefDtoSchema
} from "./codex-proposal.js";
import { TargetKindSchema } from "./target-ref.js";

const MACHINE_ID_PATTERN = /^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)*$/;

export const CODEX_PROPOSAL_REQUIRED_UNSUPPORTED_BOUNDARY_KINDS = [
  "repoSideProposalGeneration",
  "repairCandidateGeneration",
  "candidateRanking",
  "llmProvider",
  "naturalLanguageRepair",
  "autoFix",
  "automaticCommit",
  "externalTransport",
  "parserImageDecode",
  "archiveFilesystem",
  "rendererPixelOracle",
  "cubismCompatibility"
] as const;

export const CodexProposalOperationCatalogVersionDtoSchema = z.literal(
  "codex-proposal-operation-catalog-v0"
);
export type CodexProposalOperationCatalogVersionDto = z.infer<
  typeof CodexProposalOperationCatalogVersionDtoSchema
>;

export const CodexProposalOperationFamilyDtoSchema = z.enum([
  "modelStructure",
  "meshTopologyUv",
  "composition",
  "rigControl",
  "dynamics",
  "assetMetadata",
  "rightsProvenance"
]);
export type CodexProposalOperationFamilyDto = z.infer<
  typeof CodexProposalOperationFamilyDtoSchema
>;

export const CodexProposalOperationAvailabilityDtoSchema = z.enum([
  "available",
  "unsupported",
  "future_gated",
  "dependency_gated"
]);
export type CodexProposalOperationAvailabilityDto = z.infer<
  typeof CodexProposalOperationAvailabilityDtoSchema
>;

export const CodexProposalApprovalRequirementDtoSchema = z.object({
  requiresUserApproval: z.literal(true),
  allowAutomaticCommit: z.literal(false),
  approvalScope: z.enum(["wholeProposal", "perOperation"]).default("wholeProposal")
}).strict();
export type CodexProposalApprovalRequirementDto = z.infer<
  typeof CodexProposalApprovalRequirementDtoSchema
>;

export const CodexProposalPreviewSupportDtoSchema = z.object({
  dryRunSupported: z.boolean(),
  standaloneDiffSupported: z.boolean(),
  rerunValidationSupported: z.boolean(),
  productPreflightSupported: z.boolean()
}).strict();
export type CodexProposalPreviewSupportDto = z.infer<
  typeof CodexProposalPreviewSupportDtoSchema
>;

export const CodexProposalOperationInputKindDtoSchema = z.enum([
  "targetRef",
  "payloadField",
  "packageContext",
  "validationReport",
  "productPreflightReport",
  "userDecision"
]);
export type CodexProposalOperationInputKindDto = z.infer<
  typeof CodexProposalOperationInputKindDtoSchema
>;

export const CodexProposalOperationInputDescriptorDtoSchema = z.object({
  inputId: z.string().regex(MACHINE_ID_PATTERN),
  inputKind: CodexProposalOperationInputKindDtoSchema,
  required: z.boolean(),
  summary: z.string().min(1)
}).strict();
export type CodexProposalOperationInputDescriptorDto = z.infer<
  typeof CodexProposalOperationInputDescriptorDtoSchema
>;

export const CodexProposalUnsupportedBoundaryKindDtoSchema = z.enum(
  CODEX_PROPOSAL_REQUIRED_UNSUPPORTED_BOUNDARY_KINDS
);
export type CodexProposalUnsupportedBoundaryKindDto = z.infer<
  typeof CodexProposalUnsupportedBoundaryKindDtoSchema
>;

export const CodexProposalUnsupportedBoundaryStatusDtoSchema = z.enum([
  "unsupported",
  "future_gated",
  "dependency_gated"
]);
export type CodexProposalUnsupportedBoundaryStatusDto = z.infer<
  typeof CodexProposalUnsupportedBoundaryStatusDtoSchema
>;

export const CodexProposalUnsupportedBoundaryDtoSchema = z.object({
  boundaryKind: CodexProposalUnsupportedBoundaryKindDtoSchema,
  status: CodexProposalUnsupportedBoundaryStatusDtoSchema,
  severity: SeveritySchema,
  summary: z.string().min(1),
  gateIds: z.array(z.string().regex(MACHINE_ID_PATTERN)).default([]),
  evidenceRefs: z.array(CodexProposalEvidenceRefDtoSchema).default([])
}).strict().superRefine((boundary, context) => {
  if (boundary.status !== "unsupported" && boundary.gateIds.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["gateIds"],
      message: "Gated Codex proposal boundaries need at least one gate id."
    });
  }

  if (boundary.severity === "info") {
    context.addIssue({
      code: "custom",
      path: ["severity"],
      message: "Unsupported Codex proposal boundaries must not be informational pass-throughs."
    });
  }
});
export type CodexProposalUnsupportedBoundaryDto = z.infer<
  typeof CodexProposalUnsupportedBoundaryDtoSchema
>;

export const CodexProposalOperationCatalogEntryDtoSchema = z.object({
  operationType: CodexProposalOperationTypeDtoSchema,
  operationFamily: CodexProposalOperationFamilyDtoSchema,
  availability: CodexProposalOperationAvailabilityDtoSchema,
  displayName: z.string().min(1),
  summary: z.string().min(1),
  targetKinds: z.array(TargetKindSchema).default([]),
  payloadSchemaRef: z.string().regex(MACHINE_ID_PATTERN),
  requiredInputs: z.array(CodexProposalOperationInputDescriptorDtoSchema).default([]),
  approvalRequirement: CodexProposalApprovalRequirementDtoSchema,
  previewSupport: CodexProposalPreviewSupportDtoSchema,
  unsupportedBoundaryKinds: z
    .array(CodexProposalUnsupportedBoundaryKindDtoSchema)
    .default([])
}).strict().superRefine((entry, context) => {
  if (entry.availability === "available" && entry.unsupportedBoundaryKinds.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["unsupportedBoundaryKinds"],
      message: "Available Codex proposal operations cannot carry unsupported boundaries."
    });
  }

  if (entry.availability !== "available" && entry.unsupportedBoundaryKinds.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["unsupportedBoundaryKinds"],
      message: "Unavailable Codex proposal operations must explain their unsupported boundary."
    });
  }
});
export type CodexProposalOperationCatalogEntryDto = z.infer<
  typeof CodexProposalOperationCatalogEntryDtoSchema
>;

export const CodexProposalOperationCatalogDtoSchema = z.object({
  schemaVersion: CodexProposalOperationCatalogVersionDtoSchema,
  catalogId: z.string().regex(/^catalog_[A-Za-z0-9_-]+$/),
  generatedAt: z.string().datetime().optional(),
  operations: z.array(CodexProposalOperationCatalogEntryDtoSchema).default([]),
  unsupportedBoundaries: z.array(CodexProposalUnsupportedBoundaryDtoSchema).min(
    CODEX_PROPOSAL_REQUIRED_UNSUPPORTED_BOUNDARY_KINDS.length
  )
}).strict().superRefine((catalog, context) => {
  const seenOperationTypes = new Set<string>();
  catalog.operations.forEach((operation, index) => {
    if (seenOperationTypes.has(operation.operationType)) {
      context.addIssue({
        code: "custom",
        path: ["operations", index, "operationType"],
        message: `Duplicate Codex proposal operation type "${operation.operationType}".`
      });
    }
    seenOperationTypes.add(operation.operationType);
  });

  const seenBoundaryKinds = new Set<CodexProposalUnsupportedBoundaryKindDto>();
  catalog.unsupportedBoundaries.forEach((boundary, index) => {
    if (seenBoundaryKinds.has(boundary.boundaryKind)) {
      context.addIssue({
        code: "custom",
        path: ["unsupportedBoundaries", index, "boundaryKind"],
        message: `Duplicate Codex proposal unsupported boundary "${boundary.boundaryKind}".`
      });
    }
    seenBoundaryKinds.add(boundary.boundaryKind);
  });

  for (const requiredBoundaryKind of CODEX_PROPOSAL_REQUIRED_UNSUPPORTED_BOUNDARY_KINDS) {
    if (!seenBoundaryKinds.has(requiredBoundaryKind)) {
      context.addIssue({
        code: "custom",
        path: ["unsupportedBoundaries"],
        message: `Missing required Codex proposal unsupported boundary "${requiredBoundaryKind}".`
      });
    }
  }
});
export type CodexProposalOperationCatalogDto = z.infer<
  typeof CodexProposalOperationCatalogDtoSchema
>;
