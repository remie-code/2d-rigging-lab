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
  const payload = response.payload as import("./ai-material-command.js").AiMaterialCommandResult;
  const fail = (message: string) => context.addIssue({ code: "custom", message });
  if (response.command === "inspectMaterialCandidate") {
    if (response.status === "ok" && !payload.candidate) fail("Completed inspection requires a candidate snapshot.");
    if (payload.result) fail("Inspection does not claim a material mutation result.");
    return;
  }
  const operations = { extractMaterialSource: "extract", registerMaterialCandidate: "register", setMaterialPlacement: "place", previewMaterialCandidate: "preview", buildMaterialCandidate: "build", editMaterialCandidate: "edit", approveMaterialCandidate: "approve", applyMaterialCandidate: "apply", discardMaterialCandidate: "discard" } as const;
  if (response.status === "ok" && !payload.result) fail("Completed material command requires a result.");
  if (payload.result) {
    if (payload.result.operation !== operations[response.command]) fail("Material command and operation must match.");
    if ((response.status === "ok") !== (payload.result.status === "completed")) fail("Only completed material results have ok status.");
    if ((response.status === "failed") !== (payload.result.status === "failed")) fail("Failed material results require failed envelope status.");
  }
});
export type AiCommandResponse = z.infer<typeof AiCommandResponseSchema>;
