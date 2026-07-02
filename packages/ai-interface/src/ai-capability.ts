import { z } from "zod";

export const AiCapabilitySchema = z.enum([
  "read",
  "dryRunEdit",
  "commitWithApproval",
  "validate",
  "runScenario",
  "render"
]);
export type AiCapability = z.infer<typeof AiCapabilitySchema>;
