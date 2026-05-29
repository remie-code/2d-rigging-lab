import type { OperationLogEntryDto } from "@private-2d-rigging-lab/operation-core";

import type { GetEditorStatePayload } from "./ai-command-payload.js";
import { AiCommandRequestSchema, type AiCommandRequest } from "./ai-command-request.js";
import { AiCommandResponseSchema, type AiCommandResponse } from "./ai-command-response.js";
import {
  appendAiCommandResponseToTranscript,
  type AiCommandTranscript
} from "./ai-command-transcript.js";
import { AiEditorStateSchema, type AiEditorState } from "./ai-editor-state.js";
import {
  filterAiOperationLogEntries,
  parseAiOperationLogQuery,
  type AiOperationLogQuery
} from "./ai-operation-log-query.js";

export interface AiReadCommandHost {
  getEditorState(payload: GetEditorStatePayload): AiEditorState | Promise<AiEditorState>;
  getOperationLog(
    query: AiOperationLogQuery
  ): readonly OperationLogEntryDto[] | Promise<readonly OperationLogEntryDto[]>;
}

const hasReadCapability = (request: AiCommandRequest): boolean =>
  request.session.capabilities.includes("read");

const permissionDeniedResponse = (request: AiCommandRequest): AiCommandResponse =>
  AiCommandResponseSchema.parse({
    schemaVersion: "ai-command-response-v1",
    commandId: request.commandId,
    status: "permission_denied",
    command: request.command,
    payload:
      request.command === "getEditorState"
        ? { editorState: { schemaVersion: "editor-semantic-state-v1", packageRevision: 0 } }
        : { entries: [] }
  });

export const executeAiReadCommand = async (
  requestInput: unknown,
  host: AiReadCommandHost,
  transcript?: AiCommandTranscript
): Promise<AiCommandResponse> => {
  const request = AiCommandRequestSchema.parse(requestInput);

  if (request.command !== "getEditorState" && request.command !== "getOperationLog") {
    return recordReadResponse(
      request,
      AiCommandResponseSchema.parse({
        schemaVersion: "ai-command-response-v1",
        commandId: request.commandId,
        status: "not_implemented",
        command: "getOperationLog",
        payload: {
          entries: []
        }
      }),
      transcript
    );
  }

  if (!hasReadCapability(request)) {
    return recordReadResponse(request, permissionDeniedResponse(request), transcript);
  }

  if (request.command === "getEditorState") {
    const editorState = AiEditorStateSchema.parse(await host.getEditorState(request.payload));

    return recordReadResponse(
      request,
      AiCommandResponseSchema.parse({
        schemaVersion: "ai-command-response-v1",
        commandId: request.commandId,
        status: "ok",
        command: "getEditorState",
        payload: {
          editorState
        }
      }),
      transcript
    );
  }

  const query = parseAiOperationLogQuery(request.payload);
  const entries = filterAiOperationLogEntries(await host.getOperationLog(query), query);

  return recordReadResponse(
    request,
    AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: request.commandId,
      status: "ok",
      command: "getOperationLog",
      payload: {
        entries
      }
    }),
    transcript
  );
};

const recordReadResponse = (
  request: AiCommandRequest,
  response: AiCommandResponse,
  transcript?: AiCommandTranscript
): AiCommandResponse => {
  if (transcript !== undefined) {
    appendAiCommandResponseToTranscript({
      transcript,
      request,
      response
    });
  }

  return response;
};
