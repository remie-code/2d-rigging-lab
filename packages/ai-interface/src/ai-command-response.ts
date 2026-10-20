import { isMaterialCommandName } from "./ai-material-command.js";
import {
  DiagnosticSchema,
  ModelDiffSchema,
  RuntimeDiffSchema,
  ValidationDiffSchema
} from "@private-2d-rigging-lab/contracts";
import { OperationResultSchema } from "@private-2d-rigging-lab/operation-core";
import { z } from "zod";

import { AiCommandResponsePayloadSchema } from "./ai-command-response-payload.js";

export const AiCommandStatusSchema = z.enum([
  "ok",
  "needs_approval",
  "rejected",
  "failed",
  "not_implemented",
  "permission_denied"
]);
export type AiCommandStatus = z.infer<typeof AiCommandStatusSchema>;

export const AiCommandResponseSchema = z.intersection(
  z.object({
    schemaVersion: z.literal("ai-command-response-v1"),
    commandId: z.string().min(1),
    status: AiCommandStatusSchema,
    diagnostics: z.array(DiagnosticSchema).default([]),
    modelDiff: ModelDiffSchema.optional(),
    runtimeDiff: RuntimeDiffSchema.optional(),
    validationDiff: ValidationDiffSchema.optional(),
    operationResult: OperationResultSchema.optional(),
    evidenceRefs: z.array(z.string().min(1)).default([])
  }),
  AiCommandResponsePayloadSchema
).superRefine((response, context) => {
  if (!isMaterialCommandName(response.command)) return;
  // Read-only material commands carry a result exactly when they completed.
  const payload = response.payload as import("./ai-material-command.js").AiMaterialCommandResponsePayload;
  if ((response.status === "ok") !== (payload.result !== undefined)) {
    context.addIssue({ code: "custom", message: "A material command carries a result exactly when its status is ok." });
  }
});
export type AiCommandResponse = z.infer<typeof AiCommandResponseSchema>;
