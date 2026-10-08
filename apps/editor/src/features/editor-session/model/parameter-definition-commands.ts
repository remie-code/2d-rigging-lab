import {
  cloneAuthoringSessionForGraphEdit,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import {
  createOperationCore,
  OperationRequestSchema,
  type CreateParameterPayloadDto,
  type DeleteParameterPayloadDto,
  type OperationRequestDto,
  type UpdateParameterPayloadDto
} from "@private-2d-rigging-lab/operation-core";

import type { EditorSessionCommandResult } from "./editor-session-commands";

type ParameterOperationDraft = {
  readonly operationType: Extract<
    OperationRequestDto["operationType"],
    "createParameter" | "updateParameter" | "deleteParameter"
  >;
  readonly payload: unknown;
};

export function commitCreateCustomParameter(
  session: AuthoringSession,
  payload: CreateParameterPayloadDto
): EditorSessionCommandResult {
  return commitSingleParameterOperation(session, {
    operationType: "createParameter",
    payload
  });
}

export function commitUpdateCustomParameter(
  session: AuthoringSession,
  payload: UpdateParameterPayloadDto
): EditorSessionCommandResult {
  return commitSingleParameterOperation(session, {
    operationType: "updateParameter",
    payload
  });
}

export function commitDeleteCustomParameter(
  session: AuthoringSession,
  payload: DeleteParameterPayloadDto
): EditorSessionCommandResult {
  return commitSingleParameterOperation(session, {
    operationType: "deleteParameter",
    payload
  });
}

function commitSingleParameterOperation(
  session: AuthoringSession,
  draft: ParameterOperationDraft
): EditorSessionCommandResult {
  const nextSession = cloneAuthoringSessionForGraphEdit(session);
  const result = commitParameterOperationInPlace(nextSession, draft);
  return result.committed ? { ...result, session: nextSession } : { ...result, session };
}

function commitParameterOperationInPlace(
  session: AuthoringSession,
  draft: ParameterOperationDraft
): EditorSessionCommandResult {
  const operationCore = createOperationCore();
  const request = OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision: session.packageRevision,
    operationType: draft.operationType,
    payload: draft.payload
  });
  const outcome = operationCore.commitOperation(session, request);

  return {
    committed: outcome.result.status === "committed",
    session,
    diagnostics: outcome.result.diagnostics
  };
}
