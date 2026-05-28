import {
  CheckIdSchema,
  CheckStatusSchema,
  DiagnosticSchema,
  ModelDiffSchema,
  OperationIdSchema,
  PackageIdSchema,
  RepairCandidateIdSchema,
  RuntimeDiffSchema,
  RuntimeSnapshotIdSchema,
  SeveritySchema,
  ValidationDiffSchema,
  ValidationProfileSchema,
  ValidationReportIdSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import { ValidationSummarySchema } from "./validation-summary.js";

export const ValidationCheckResultSchema = DiagnosticSchema.extend({
  status: CheckStatusSchema,
  severity: SeveritySchema,
  targetPath: z.string().optional(),
  impact: z.string(),
  repairCandidateIds: z.array(RepairCandidateIdSchema).default([]),
  snapshotIds: z.array(RuntimeSnapshotIdSchema).default([]),
  operationIds: z.array(OperationIdSchema).default([])
});
export type ValidationCheckResultDto = z.infer<typeof ValidationCheckResultSchema>;
export type ValidationCheckResultInput = z.input<typeof ValidationCheckResultSchema>;

export const RepairCandidateSchema = z.object({
  schemaVersion: z.literal("repair-candidate-v1"),
  candidateId: RepairCandidateIdSchema,
  createdBy: z.enum(["validator", "ai", "human"]),
  problemCheckIds: z.array(CheckIdSchema),
  targetIds: z.array(z.string()),
  rationale: z.string(),
  operationDraft: z.object({
    operationType: z.string(),
    payload: z.record(z.string(), z.unknown())
  }),
  expectedModelDiff: ModelDiffSchema.optional(),
  expectedRuntimeDiff: RuntimeDiffSchema.optional(),
  expectedValidationDiff: ValidationDiffSchema.optional(),
  risk: z.enum(["low", "medium", "high", "unknown"]),
  requiresUserApproval: z.literal(true),
  provenance: z.object({
    sourceReportId: ValidationReportIdSchema.optional(),
    sourceOperationIds: z.array(OperationIdSchema).default([])
  }),
  revalidationSteps: z.array(z.string())
});
export type RepairCandidateDto = z.infer<typeof RepairCandidateSchema>;

export const ValidationReportEvidenceSchema = z.object({
  operationLogPresent: z.boolean(),
  operationLogPath: z.string().optional(),
  runtimeSnapshotIds: z.array(RuntimeSnapshotIdSchema).default([]),
  supplementalGuiEvidenceRefs: z.array(z.string()).default([])
});
export type ValidationReportEvidenceDto = z.infer<typeof ValidationReportEvidenceSchema>;
export type ValidationReportEvidenceInput = z.input<typeof ValidationReportEvidenceSchema>;

export const ValidationReportSchema = z.object({
  schemaVersion: z.literal("validation-report-v1"),
  reportId: ValidationReportIdSchema,
  createdAt: z.string().datetime(),
  packageId: PackageIdSchema,
  packageRevision: z.number().int().nonnegative(),
  packageHash: z.string().optional(),
  validatorVersion: z.string(),
  profile: ValidationProfileSchema,
  relatedScenarios: z.array(z.string()).default([]),
  summary: ValidationSummarySchema,
  checks: z.array(ValidationCheckResultSchema),
  repairCandidates: z.array(RepairCandidateSchema).default([]),
  evidence: ValidationReportEvidenceSchema
});
export type ValidationReportDto = z.infer<typeof ValidationReportSchema>;
export type ValidationReportInput = z.input<typeof ValidationReportSchema>;

