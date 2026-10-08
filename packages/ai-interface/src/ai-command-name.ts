import { AiMaterialCommandNameSchema } from "./ai-material-command.js";
import { z } from "zod";

export const AiCommandNameSchema = z.enum([
  ...AiMaterialCommandNameSchema.options,
  "getEditorState",
  "inspectModel",
  "inspectTarget",
  "inspectEvaluatedGeometry",
  "validatePackage",
  "dryRunOperation",
  "commitOperation",
  "getOperationLog",
  "renderView",
  "getPsdImportPlanState",
  "setPsdImportPlanApproval",
  "preflightPsdImportPlanIntake",
  "executePsdImportPlanIntake"
]);
export type AiCommandName = z.infer<typeof AiCommandNameSchema>;
