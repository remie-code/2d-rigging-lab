import {
  cloneAuthoringSessionForGraphEdit,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import {
  createOperationCore,
  OperationRequestSchema,
  type AddVariantTargetDrawablePayloadDto,
  type CreateVariantGroupPayloadDto,
  type CreateVariantPayloadDto,
  type DeleteVariantGroupPayloadDto,
  type DeleteVariantPayloadDto,
  type RemoveVariantTargetDrawablePayloadDto,
  type SetVariantDefaultActiveSelectionPayloadDto,
  type SetVariantMembershipPayloadDto,
  type UpdateVariantGroupPayloadDto,
  type UpdateVariantPayloadDto
} from "@private-2d-rigging-lab/operation-core";

import type { EditorSessionCommandResult } from "../../editor-session/model/editor-session-commands";

type VariantOperationType =
  | "createVariantGroup"
  | "updateVariantGroup"
  | "deleteVariantGroup"
  | "createVariant"
  | "updateVariant"
  | "deleteVariant"
  | "addVariantTargetDrawable"
  | "removeVariantTargetDrawable"
  | "setVariantMembership"
  | "setVariantDefaultActiveSelection";

type VariantOperationDraft = {
  readonly operationType: VariantOperationType;
  readonly payload: unknown;
};

export function commitCreateVariantGroup(
  session: AuthoringSession,
  payload: CreateVariantGroupPayloadDto
): EditorSessionCommandResult {
  return commitVariantOperation(session, {
    operationType: "createVariantGroup",
    payload
  });
}

export function commitUpdateVariantGroup(
  session: AuthoringSession,
  payload: UpdateVariantGroupPayloadDto
): EditorSessionCommandResult {
  return commitVariantOperation(session, {
    operationType: "updateVariantGroup",
    payload
  });
}

export function commitDeleteVariantGroup(
  session: AuthoringSession,
  payload: DeleteVariantGroupPayloadDto
): EditorSessionCommandResult {
  return commitVariantOperation(session, {
    operationType: "deleteVariantGroup",
    payload
  });
}

export function commitCreateVariant(
  session: AuthoringSession,
  payload: CreateVariantPayloadDto
): EditorSessionCommandResult {
  return commitVariantOperation(session, {
    operationType: "createVariant",
    payload
  });
}

export function commitUpdateVariant(
  session: AuthoringSession,
  payload: UpdateVariantPayloadDto
): EditorSessionCommandResult {
  return commitVariantOperation(session, {
    operationType: "updateVariant",
    payload
  });
}

export function commitDeleteVariant(
  session: AuthoringSession,
  payload: DeleteVariantPayloadDto
): EditorSessionCommandResult {
  return commitVariantOperation(session, {
    operationType: "deleteVariant",
    payload
  });
}

export function commitAddVariantTargetDrawable(
  session: AuthoringSession,
  payload: AddVariantTargetDrawablePayloadDto
): EditorSessionCommandResult {
  return commitVariantOperation(session, {
    operationType: "addVariantTargetDrawable",
    payload
  });
}

export function commitRemoveVariantTargetDrawable(
  session: AuthoringSession,
  payload: RemoveVariantTargetDrawablePayloadDto
): EditorSessionCommandResult {
  return commitVariantOperation(session, {
    operationType: "removeVariantTargetDrawable",
    payload
  });
}

export function commitSetVariantMembership(
  session: AuthoringSession,
  payload: SetVariantMembershipPayloadDto
): EditorSessionCommandResult {
  return commitVariantOperation(session, {
    operationType: "setVariantMembership",
    payload
  });
}

export function commitSetVariantDefaultActiveSelection(
  session: AuthoringSession,
  payload: SetVariantDefaultActiveSelectionPayloadDto
): EditorSessionCommandResult {
  return commitVariantOperation(session, {
    operationType: "setVariantDefaultActiveSelection",
    payload
  });
}

function commitVariantOperation(
  session: AuthoringSession,
  draft: VariantOperationDraft
): EditorSessionCommandResult {
  const nextSession = cloneAuthoringSessionForGraphEdit(session);
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
  const outcome = operationCore.commitOperation(nextSession, request);

  return outcome.result.status === "committed"
    ? {
        committed: true,
        session: nextSession,
        diagnostics: outcome.result.diagnostics,
        operationResult: outcome.result
      }
    : {
        committed: false,
        session,
        diagnostics: outcome.result.diagnostics,
        operationResult: outcome.result
      };
}
