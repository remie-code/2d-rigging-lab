import { describe, expect, it } from "vitest";

import {
  AiCommandTranscriptApprovalEntrySchema,
  AiCommandTranscriptCommandEntrySchema,
  AiCommandTranscriptDocumentSchema,
  createEmptyAiCommandTranscriptDocument,
  hydrateInMemoryAiCommandTranscript,
  InMemoryAiCommandTranscript,
  parseAiCommandTranscriptDocument,
  serializeAiCommandTranscript
} from "./ai-command-transcript.js";

const commandEntry = AiCommandTranscriptCommandEntrySchema.parse({
  schemaVersion: "ai-command-transcript-entry-v1",
  entryType: "command",
  commandId: "cmd_dry_run_create_parameter",
  agentId: "agent_test",
  command: "dryRunOperation",
  capabilities: ["dryRunEdit"],
  basis: {
    packageRevision: 0,
    relatedAC: ["AC-MVP-014"],
    relatedScenarios: ["SC-AGENT-002"]
  },
  status: "ok",
  evidenceRefs: ["runtime/snapshots/snap_ai_preview.runtime-snapshot.json"],
  operationId: "op_create_ai_parameter"
});

const approvalEntry = AiCommandTranscriptApprovalEntrySchema.parse({
  schemaVersion: "ai-command-transcript-entry-v1",
  entryType: "approval",
  dryRunCommandId: "cmd_dry_run_create_parameter",
  agentId: "agent_test",
  approvalStatus: "approved",
  evidenceRefs: [],
  operationId: "op_create_ai_parameter"
});

describe("AI command transcript document contract", () => {
  it("creates an empty transcript document", () => {
    const document = createEmptyAiCommandTranscriptDocument();

    expect(document).toEqual({
      schemaVersion: "ai-command-transcript-v1",
      entries: []
    });
    expect(AiCommandTranscriptDocumentSchema.parse(document)).toEqual(document);
  });

  it("round-trips command and approval events through document serialization", () => {
    const transcript = new InMemoryAiCommandTranscript();
    transcript.append(commandEntry);
    transcript.append(approvalEntry);

    const document = serializeAiCommandTranscript(transcript);
    const persistedJson = JSON.stringify(document);
    const parsedDocument = parseAiCommandTranscriptDocument(JSON.parse(persistedJson));
    const hydratedTranscript = hydrateInMemoryAiCommandTranscript(parsedDocument);

    expect(parsedDocument).toEqual({
      schemaVersion: "ai-command-transcript-v1",
      entries: [commandEntry, approvalEntry]
    });
    expect(serializeAiCommandTranscript(hydratedTranscript)).toEqual(parsedDocument);
  });

  it("rejects invalid transcript events", () => {
    const result = AiCommandTranscriptDocumentSchema.safeParse({
      schemaVersion: "ai-command-transcript-v1",
      entries: [
        {
          ...approvalEntry,
          approvalStatus: "rejected"
        }
      ]
    });

    expect(result.success).toBe(false);
  });

  it("hydrates an in-memory transcript and preserves existing entries when appending", () => {
    const document = parseAiCommandTranscriptDocument({
      schemaVersion: "ai-command-transcript-v1",
      entries: [commandEntry]
    });
    const transcript = hydrateInMemoryAiCommandTranscript(document);

    transcript.append(approvalEntry);

    expect(transcript.entries).toEqual([commandEntry, approvalEntry]);
    expect(serializeAiCommandTranscript(transcript)).toEqual({
      schemaVersion: "ai-command-transcript-v1",
      entries: [commandEntry, approvalEntry]
    });
  });
});
