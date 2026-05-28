import { z } from "zod";

import { CheckStatusSchema, SeveritySchema } from "./enums.js";
import { CheckIdSchema } from "./check-id.js";
import { TargetRefSchema } from "./target-ref.js";

export const DiagnosticSchema = z.object({
  checkId: CheckIdSchema,
  status: CheckStatusSchema,
  severity: SeveritySchema,
  phase: z.string(),
  target: TargetRefSchema,
  message: z.string(),
  evidence: z.array(z.string()).default([]),
  relatedAC: z.array(z.string()).default([]),
  relatedScenarios: z.array(z.string()).default([]),
  repairCandidateIds: z.array(z.string()).default([])
});
export type DiagnosticDto = z.infer<typeof DiagnosticSchema>;
