import { z } from "zod";

export const AiCommandNameSchema = z.enum([
  "getEditorState",
  "inspectModel",
  "inspectTarget",
  "validatePackage",
  "dryRunOperation",
  "commitOperation",
  "getOperationLog"
]);
export type AiCommandName = z.infer<typeof AiCommandNameSchema>;
