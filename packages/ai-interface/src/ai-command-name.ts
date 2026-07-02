import { z } from "zod";

export const AiCommandNameSchema = z.enum([
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
