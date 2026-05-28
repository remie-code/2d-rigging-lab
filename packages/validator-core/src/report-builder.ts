import {
  PackageIdSchema,
  ValidationProfileSchema,
  ValidationReportIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  PackageId,
  RuntimeSnapshotId,
  ValidationProfile,
  ValidationReportId
} from "@private-2d-rigging-lab/contracts";

import { aggregateValidationSummary } from "./validation-summary.js";
import {
  RepairCandidateSchema,
  ValidationCheckResultSchema,
  ValidationReportEvidenceSchema,
  ValidationReportSchema
} from "./validation-report.js";
import type {
  RepairCandidateDto,
  ValidationCheckResultInput,
  ValidationReportDto,
  ValidationReportEvidenceInput
} from "./validation-report.js";

export const VALIDATOR_CORE_VERSION = "validator-core-wave2-foundation";

export interface ValidationReportBuildInput {
  readonly reportId?: ValidationReportId | string;
  readonly createdAt?: string;
  readonly packageId: PackageId | string;
  readonly packageRevision: number;
  readonly packageHash?: string;
  readonly validatorVersion?: string;
  readonly profile?: ValidationProfile | string;
  readonly relatedScenarios?: readonly string[];
  readonly checks?: readonly ValidationCheckResultInput[];
  readonly repairCandidates?: readonly RepairCandidateDto[];
  readonly evidence?: ValidationReportEvidenceInput;
}

export const buildValidationReport = (input: ValidationReportBuildInput): ValidationReportDto => {
  const packageId = PackageIdSchema.parse(input.packageId);
  const profile = ValidationProfileSchema.parse(input.profile ?? "strict");
  const checks = (input.checks ?? []).map((check) => ValidationCheckResultSchema.parse(check));
  const repairCandidates = (input.repairCandidates ?? []).map((candidate) => RepairCandidateSchema.parse(candidate));

  return ValidationReportSchema.parse({
    schemaVersion: "validation-report-v1",
    reportId: input.reportId ?? createValidationReportId(packageId, profile),
    createdAt: input.createdAt ?? new Date().toISOString(),
    packageId,
    packageRevision: input.packageRevision,
    ...(input.packageHash === undefined ? {} : { packageHash: input.packageHash }),
    validatorVersion: input.validatorVersion ?? VALIDATOR_CORE_VERSION,
    profile,
    relatedScenarios: input.relatedScenarios ?? [],
    summary: aggregateValidationSummary(checks),
    checks,
    repairCandidates,
    evidence: ValidationReportEvidenceSchema.parse(input.evidence ?? createDefaultEvidence())
  });
};

export const createDefaultEvidence = (
  runtimeSnapshotIds: readonly RuntimeSnapshotId[] = []
): ReturnType<typeof ValidationReportEvidenceSchema.parse> =>
  ValidationReportEvidenceSchema.parse({
    operationLogPresent: false,
    runtimeSnapshotIds,
    supplementalGuiEvidenceRefs: []
  });

const createValidationReportId = (packageId: PackageId, profile: ValidationProfile): ValidationReportId =>
  ValidationReportIdSchema.parse(`val_${packageId.replace(/^pkg_/, "")}_${profile}`);

