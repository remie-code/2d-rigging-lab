import { z } from "zod";

export const AiCapabilitySchema = z.enum([
  "read",
  "dryRunEdit",
  "commitWithApproval",
  "validate",
  "runScenario",
  "render",
  "editReference"
]);
export type AiCapability = z.infer<typeof AiCapabilitySchema>;
