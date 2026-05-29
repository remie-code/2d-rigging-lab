import { OperationIdSchema } from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import { AiCapabilitySchema } from "./ai-capability.js";
import { AiCommandNameSchema } from "./ai-command-name.js";
import type { AiCommandRequest } from "./ai-command-request.js";
import { AiCommandBasisSchema } from "./ai-command-request.js";
import type { AiCommandResponse } from "./ai-command-response.js";
import { AiCommandStatusSchema } from "./ai-command-response.js";
import type { AiDryRunApprovalRecord } from "./ai-approval-policy.js";

export const AiCommandTranscriptCommandEntrySchema = z.object({
  schemaVersion: z.literal("ai-command-transcript-entry-v1"),
  entryType: z.literal("command").default("command"),
  commandId: z.string().min(1),
  agentId: z.string().min(1),
  command: AiCommandNameSchema,
  capabilities: z.array(AiCapabilitySchema),
  basis: AiCommandBasisSchema,
  status: AiCommandStatusSchema,
  evidenceRefs: z.array(z.string().min(1)).default([]),
  operationId: OperationIdSchema.optional()
});
export type AiCommandTranscriptCommandEntry = z.infer<typeof AiCommandTranscriptCommandEntrySchema>;

export const AiCommandTranscriptApprovalEntrySchema = z.object({
  schemaVersion: z.literal("ai-command-transcript-entry-v1"),
  entryType: z.literal("approval"),
  dryRunCommandId: z.string().min(1),
  agentId: z.string().min(1),
  approvalStatus: z.literal("approved"),
  evidenceRefs: z.array(z.string().min(1)).default([]),
  operationId: OperationIdSchema.optional()
});
export type AiCommandTranscriptApprovalEntry = z.infer<typeof AiCommandTranscriptApprovalEntrySchema>;

export const AiCommandTranscriptEntrySchema = z.union([
  AiCommandTranscriptCommandEntrySchema,
  AiCommandTranscriptApprovalEntrySchema
]);
export type AiCommandTranscriptEntry = z.infer<typeof AiCommandTranscriptEntrySchema>;

export const AiCommandTranscriptSchema = z.object({
  schemaVersion: z.literal("ai-command-transcript-v1"),
  entries: z.array(AiCommandTranscriptEntrySchema)
});
export type AiCommandTranscriptDocument = z.infer<typeof AiCommandTranscriptSchema>;

export interface AiCommandTranscript {
  readonly entries: readonly AiCommandTranscriptEntry[];
  append(entry: AiCommandTranscriptEntry): void;
}

export class InMemoryAiCommandTranscript implements AiCommandTranscript {
  readonly #entries: AiCommandTranscriptEntry[] = [];

  get entries(): readonly AiCommandTranscriptEntry[] {
    return this.#entries;
  }

  append(entry: AiCommandTranscriptEntry): void {
    this.#entries.push(AiCommandTranscriptEntrySchema.parse(entry));
  }
}

export const appendAiCommandResponseToTranscript = (input: {
  readonly transcript: AiCommandTranscript;
  readonly request: AiCommandRequest;
  readonly response: AiCommandResponse;
  readonly operationId?: string;
}): void => {
  const operationId = input.operationId ?? input.response.operationResult?.operationId;

  input.transcript.append({
    schemaVersion: "ai-command-transcript-entry-v1",
    entryType: "command",
    commandId: input.response.commandId,
    agentId: input.request.session.agentId,
    command: input.response.command,
    capabilities: input.request.session.capabilities,
    basis: input.request.basis,
    status: input.response.status,
    evidenceRefs: input.response.evidenceRefs,
    ...(operationId === undefined ? {} : { operationId: OperationIdSchema.parse(operationId) })
  });
};

export const appendAiApprovalToTranscript = (input: {
  readonly transcript: AiCommandTranscript;
  readonly record: AiDryRunApprovalRecord;
}): void => {
  input.transcript.append({
    schemaVersion: "ai-command-transcript-entry-v1",
    entryType: "approval",
    dryRunCommandId: input.record.dryRunCommandId,
    agentId: input.record.agentId,
    approvalStatus: "approved",
    evidenceRefs: [],
    ...(input.record.operationId === undefined
      ? {}
      : { operationId: OperationIdSchema.parse(input.record.operationId) })
  });
};
