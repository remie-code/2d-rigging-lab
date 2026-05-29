import { ValidationDiffSchema } from "@private-2d-rigging-lab/contracts";
import type { DiagnosticDto, Severity, ValidationDiffDto } from "@private-2d-rigging-lab/contracts";

import type { ValidationCheckResultDto, ValidationReportDto } from "./validation-report.js";

export interface ValidationDiffBuildInput {
  readonly baseline: ValidationReportDto;
  readonly candidate: ValidationReportDto;
}

export const buildValidationDiff = (input: ValidationDiffBuildInput): ValidationDiffDto => {
  const baselineFailures = indexChecks(input.baseline.checks.filter(isFailure));
  const candidateFailures = indexChecks(input.candidate.checks.filter(isFailure));
  const baselineChecks = indexChecks(input.baseline.checks);
  const candidateChecks = indexChecks(input.candidate.checks);

  const newFailures = [...candidateFailures.entries()]
    .filter(([key]) => !baselineFailures.has(key))
    .map(([, check]) => toDiagnostic(check));
  const resolvedFailures = [...baselineFailures.entries()]
    .filter(([key]) => !candidateFailures.has(key))
    .map(([, check]) => toDiagnostic(check));
  const severityChanges = [...candidateChecks.entries()]
    .flatMap(([key, candidateCheck]) => {
      const baselineCheck = baselineChecks.get(key);
      if (baselineCheck === undefined || baselineCheck.severity === candidateCheck.severity) {
        return [];
      }

      return [
        {
          checkId: candidateCheck.checkId,
          target: candidateCheck.target,
          before: baselineCheck.severity as Severity,
          after: candidateCheck.severity as Severity
        }
      ];
    });

  return ValidationDiffSchema.parse({
    schemaVersion: "validation-diff-v1",
    beforeReportId: input.baseline.reportId,
    afterReportId: input.candidate.reportId,
    newFailures,
    resolvedFailures,
    severityChanges
  });
};

const isFailure = (check: ValidationCheckResultDto): boolean => check.status === "fail";

const indexChecks = (
  checks: readonly ValidationCheckResultDto[]
): ReadonlyMap<string, ValidationCheckResultDto> => {
  const indexed = new Map<string, ValidationCheckResultDto>();
  for (const check of checks) {
    const key = checkIdentityKey(check);
    if (!indexed.has(key)) {
      indexed.set(key, check);
    }
  }

  return indexed;
};

const checkIdentityKey = (check: ValidationCheckResultDto): string =>
  JSON.stringify({
    checkId: check.checkId,
    target: check.target
  });

const toDiagnostic = (check: ValidationCheckResultDto): DiagnosticDto => ({
  checkId: check.checkId,
  status: check.status,
  severity: check.severity,
  phase: check.phase,
  target: check.target,
  message: check.message,
  evidence: check.evidence,
  relatedAC: check.relatedAC,
  relatedScenarios: check.relatedScenarios,
  repairCandidateIds: check.repairCandidateIds
});
