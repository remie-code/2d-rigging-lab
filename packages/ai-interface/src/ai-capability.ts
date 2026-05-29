import { z } from "zod";

export const AiCapabilitySchema = z.enum([
  "read",
  "dryRunEdit",
  "commitWithApproval",
  "validate",
  "runScenario"
]);
export type AiCapability = z.infer<typeof AiCapabilitySchema>;
