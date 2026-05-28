import {
  CheckStatusSchema,
  SeveritySchema
} from "@private-2d-rigging-lab/contracts";
import type {
  CheckStatus,
  DiagnosticDto,
  Severity
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

export const SEVERITY_ORDER: readonly Severity[] = ["info", "warning", "error", "blocking"];

export const ValidationSummarySchema = z.object({
  status: CheckStatusSchema,
  highestSeverity: SeveritySchema,
  counts: z.record(SeveritySchema, z.number().int().nonnegative())
});
export type ValidationSummaryDto = z.infer<typeof ValidationSummarySchema>;

export const createEmptySeverityCounts = (): Record<Severity, number> => ({
  info: 0,
  warning: 0,
  error: 0,
  blocking: 0
});

export const aggregateValidationSummary = (
  checks: readonly Pick<DiagnosticDto, "severity" | "status">[]
): ValidationSummaryDto => {
  const counts = createEmptySeverityCounts();
  let highestSeverity: Severity = "info";
  let status: CheckStatus = "pass";

  for (const check of checks) {
    counts[check.severity] += 1;
    highestSeverity =
      SEVERITY_ORDER.indexOf(check.severity) > SEVERITY_ORDER.indexOf(highestSeverity)
        ? check.severity
        : highestSeverity;

    if (check.status === "fail" || check.severity === "error" || check.severity === "blocking") {
      status = "fail";
    } else if (status === "pass" && (check.status === "needs_review" || check.severity === "warning")) {
      status = check.status === "needs_review" ? "needs_review" : "warning";
    }
  }

  return ValidationSummarySchema.parse({
    status,
    highestSeverity,
    counts
  });
};

