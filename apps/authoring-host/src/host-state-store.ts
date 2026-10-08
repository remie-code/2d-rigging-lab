import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  InMemoryAiApprovalPolicy,
  InMemoryAiCommandTranscript,
  createEmptyAiCommandTranscriptDocument,
  hydrateInMemoryAiCommandTranscript,
  serializeAiCommandTranscript
} from "@private-2d-rigging-lab/ai-interface";
import type {
  AiCommandTranscriptDocument,
  AiDryRunApprovalRecord
} from "@private-2d-rigging-lab/ai-interface";
import { z } from "zod";

/**
 * Cross-process persistence of the approval state and the command transcript. These
 * MUST live outside the package directory (the package directory is the sole source
 * of truth for model content); the caller supplies a state directory via `--state-dir`.
 *
 * The approval state records which dry-run commands have been mechanically approved,
 * so a later `commitOperation` in a separate process can satisfy the approval check.
 */
const APPROVAL_STATE_FILE_NAME = "approval-state.json";
const TRANSCRIPT_FILE_NAME = "command-transcript.json";

const ApprovalStateRecordSchema = z.object({
  dryRunCommandId: z.string().min(1),
  agentId: z.string().min(1),
  operationId: z.string().min(1).optional(),
  approvalContextDigest: z.string().min(1).optional(),
  approved: z.boolean()
});
type ApprovalStateRecord = z.infer<typeof ApprovalStateRecordSchema>;

const ApprovalStateDocumentSchema = z.object({
  schemaVersion: z.literal("authoring-host-approval-state-v1"),
  records: z.array(ApprovalStateRecordSchema)
});
export type ApprovalStateDocument = z.infer<typeof ApprovalStateDocumentSchema>;

export interface HostState {
  readonly approvalPolicy: InMemoryAiApprovalPolicy;
  readonly transcript: InMemoryAiCommandTranscript;
}

export interface HostStateStore {
  load(): Promise<HostState>;
  save(state: HostState): Promise<void>;
  readonly approvalStatePath: string;
  readonly transcriptPath: string;
}

export const createHostStateStore = (stateDirectory: string): HostStateStore => {
  const approvalStatePath = join(stateDirectory, APPROVAL_STATE_FILE_NAME);
  const transcriptPath = join(stateDirectory, TRANSCRIPT_FILE_NAME);

  return {
    approvalStatePath,
    transcriptPath,

    async load(): Promise<HostState> {
      const approvalDocument = await readJsonFileOrUndefined(approvalStatePath);
      const transcriptDocument = await readJsonFileOrUndefined(transcriptPath);

      return {
        approvalPolicy: hydrateApprovalPolicy(approvalDocument),
        transcript: hydrateTranscript(transcriptDocument)
      };
    },

    async save(state: HostState): Promise<void> {
      await mkdir(stateDirectory, { recursive: true });
      await writeJsonFile(approvalStatePath, serializeApprovalState(state.approvalPolicy));
      await writeJsonFile(transcriptPath, serializeAiCommandTranscript(state.transcript));
    }
  };
};

const hydrateApprovalPolicy = (approvalDocument: unknown): InMemoryAiApprovalPolicy => {
  const policy = new InMemoryAiApprovalPolicy();
  if (approvalDocument === undefined) {
    return policy;
  }

  const parsed = ApprovalStateDocumentSchema.parse(approvalDocument);
  for (const record of parsed.records) {
    replayApprovalRecord(policy, record);
  }

  return policy;
};

const replayApprovalRecord = (
  policy: InMemoryAiApprovalPolicy,
  record: ApprovalStateRecord
): void => {
  policy.recordDryRun({
    dryRunCommandId: record.dryRunCommandId,
    agentId: record.agentId,
    ...(record.operationId === undefined ? {} : { operationId: record.operationId }),
    ...(record.approvalContextDigest === undefined
      ? {}
      : { approvalContextDigest: record.approvalContextDigest })
  });

  if (record.approved) {
    policy.approveDryRunCommand({
      dryRunCommandId: record.dryRunCommandId,
      ...(record.operationId === undefined ? {} : { operationId: record.operationId })
    });
  }
};

const serializeApprovalState = (
  approvalPolicy: InMemoryAiApprovalPolicy
): ApprovalStateDocument =>
  ApprovalStateDocumentSchema.parse({
    schemaVersion: "authoring-host-approval-state-v1",
    records: approvalPolicy.records.map((record) => ({
      dryRunCommandId: record.dryRunCommandId,
      agentId: record.agentId,
      ...(record.operationId === undefined ? {} : { operationId: record.operationId }),
      ...(record.approvalContextDigest === undefined
        ? {}
        : { approvalContextDigest: record.approvalContextDigest }),
      approved: record.approved
    }))
  });

const hydrateTranscript = (transcriptDocument: unknown): InMemoryAiCommandTranscript => {
  if (transcriptDocument === undefined) {
    return hydrateInMemoryAiCommandTranscript(createEmptyAiCommandTranscriptDocument());
  }

  return hydrateInMemoryAiCommandTranscript(transcriptDocument as AiCommandTranscriptDocument);
};

const readJsonFileOrUndefined = async (filePath: string): Promise<unknown> => {
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return undefined;
    }
    throw error;
  }

  return JSON.parse(text) as unknown;
};

const writeJsonFile = async (filePath: string, value: unknown): Promise<void> => {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const isFileNotFoundError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { readonly code?: string }).code === "ENOENT";
