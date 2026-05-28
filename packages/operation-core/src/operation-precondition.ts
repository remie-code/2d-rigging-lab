import { DiagnosticSchema, TargetRefSchema } from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

export const OperationPreconditionResultSchema = z.object({
  ok: z.boolean(),
  diagnostics: z.array(DiagnosticSchema),
  checkedTargetRefs: z.array(TargetRefSchema).default([])
});
export type OperationPreconditionResultDto = z.infer<typeof OperationPreconditionResultSchema>;
