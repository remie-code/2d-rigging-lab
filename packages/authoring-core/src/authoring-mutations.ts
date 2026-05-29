import type { ParameterDto } from "@private-2d-rigging-lab/package-format";

import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { hasParameter } from "./graph-selectors.js";

export type AuthoringMutationErrorCode =
  | "duplicate_parameter"
  | "duplicate_keyform_set"
  | "missing_parameter"
  | "missing_keyform_target"
  | "unsupported_keyform_target_property"
  | "duplicate_keyform_grid_axis_parameter"
  | "duplicate_keyform_grid_coordinate";

export class AuthoringMutationError extends Error {
  readonly code: AuthoringMutationErrorCode;

  constructor(code: AuthoringMutationErrorCode, message: string) {
    super(message);
    this.name = "AuthoringMutationError";
    this.code = code;
  }
}

export interface CreateParameterMutationResult {
  readonly session: AuthoringSession;
  readonly parameter: ParameterDto;
  readonly authoringRevision: AuthoringRevision;
}

export const createParameter = (
  session: AuthoringSession,
  parameter: ParameterDto
): CreateParameterMutationResult => {
  if (hasParameter(session.graph, parameter.parameterId)) {
    throw new AuthoringMutationError(
      "duplicate_parameter",
      `Parameter already exists: ${parameter.parameterId}`
    );
  }

  const storedParameter = structuredClone(parameter);
  session.graph.parameters.push(storedParameter);
  if (!session.graph.stableOrder.includes(storedParameter.parameterId)) {
    session.graph.stableOrder.push(storedParameter.parameterId);
  }

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    parameter: storedParameter,
    authoringRevision: session.authoringRevision
  };
};
