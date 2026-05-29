import { z } from "zod";

import { AiCapabilitySchema } from "./ai-capability.js";
import { AiCommandPayloadSchema } from "./ai-command-payload.js";

export const AiCommandSessionSchema = z.object({
  agentId: z.string().min(1),
  capabilities: z.array(AiCapabilitySchema)
});
export type AiCommandSession = z.infer<typeof AiCommandSessionSchema>;

export const AiCommandBasisSchema = z
  .object({
    packageRevision: z.number().int().nonnegative().optional(),
    relatedAC: z.array(z.string()).default([]),
    relatedScenarios: z.array(z.string()).default([]),
    screenshotRef: z.string().min(1).optional()
  })
  .default({
    relatedAC: [],
    relatedScenarios: []
  });
export type AiCommandBasis = z.infer<typeof AiCommandBasisSchema>;

export const AiCommandRequestSchema = z.intersection(
  z.object({
    schemaVersion: z.literal("ai-command-request-v1"),
    commandId: z.string().min(1),
    session: AiCommandSessionSchema,
    basis: AiCommandBasisSchema
  }),
  AiCommandPayloadSchema
);
export type AiCommandRequest = z.infer<typeof AiCommandRequestSchema>;
