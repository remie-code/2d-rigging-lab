import { z } from "zod";

import { CheckIdSchema } from "./check-id.js";
import { DiagnosticSchema } from "./diagnostics.js";
import { SeveritySchema } from "./enums.js";
import { ValidationReportIdSchema } from "./ids.js";
import { TargetRefSchema } from "./target-ref.js";

export const ValidationDiffSchema = z.object({
  schemaVersion: z.literal("validation-diff-v1"),
  beforeReportId: ValidationReportIdSchema,
  afterReportId: ValidationReportIdSchema,
  newFailures: z.array(DiagnosticSchema).default([]),
  resolvedFailures: z.array(DiagnosticSchema).default([]),
  severityChanges: z
    .array(
      z.object({
        checkId: CheckIdSchema,
        target: TargetRefSchema,
        before: SeveritySchema,
        after: SeveritySchema
      })
    )
    .default([])
});
export type ValidationDiffDto = z.infer<typeof ValidationDiffSchema>;
export const ValidationDiffDtoSchema = ValidationDiffSchema;
