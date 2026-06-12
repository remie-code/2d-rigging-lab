import type { ParameterDto } from "@private-2d-rigging-lab/package-format";
import type { ParameterId } from "@private-2d-rigging-lab/contracts";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { getParameterById } from "./graph-selectors.js";
import { isLockedPresetParameter } from "./parameter-surface.js";

export interface UpdateParameterInput {
  readonly parameterId: ParameterId;
  readonly displayName?: string;
  readonly min?: number;
  readonly max?: number;
  readonly default?: number;
  readonly recommendedUiStep?: number;
}

export interface UpdateParameterMutationResult {
  readonly session: AuthoringSession;
  readonly parameterBefore: ParameterDto;
  readonly parameterAfter: ParameterDto;
  readonly authoringRevision: AuthoringRevision;
}

export interface DeleteParameterMutationResult {
  readonly session: AuthoringSession;
  readonly parameterBefore: ParameterDto;
  readonly authoringRevision: AuthoringRevision;
}

export const updateParameter = (
  session: AuthoringSession,
  input: UpdateParameterInput
): UpdateParameterMutationResult => {
  const parameterIndex = session.graph.parameters.findIndex(
    (parameter) => parameter.parameterId === input.parameterId
  );
  const parameter = parameterIndex < 0 ? undefined : session.graph.parameters[parameterIndex];

  if (parameter === undefined) {
    if (isLockedPresetParameter(session.graph, input.parameterId)) {
      throw new AuthoringMutationError(
        "preset_parameter_locked",
        `Preset parameter fields are locked: ${input.parameterId}`
      );
    }

    throw new AuthoringMutationError(
      "missing_parameter",
      `Parameter does not exist: ${input.parameterId}`
    );
  }

  if (isLockedPresetParameter(session.graph, input.parameterId)) {
    throw new AuthoringMutationError(
      "preset_parameter_locked",
      `Preset parameter fields are locked: ${input.parameterId}`
    );
  }

  const parameterBefore = structuredClone(parameter);
  const parameterAfter = createUpdatedParameter(parameterBefore, input);
  assertParameterRange(parameterAfter);

  if (parametersEqual(parameterBefore, parameterAfter)) {
    throw new AuthoringMutationError(
      "no_op_parameter_update",
      `Parameter update would not change ${input.parameterId}.`
    );
  }

  session.graph.parameters[parameterIndex] = structuredClone(parameterAfter);
  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    parameterBefore,
    parameterAfter: structuredClone(parameterAfter),
    authoringRevision: session.authoringRevision
  };
};

export const deleteParameter = (
  session: AuthoringSession,
  parameterId: ParameterId
): DeleteParameterMutationResult => {
  if (isLockedPresetParameter(session.graph, parameterId)) {
    throw new AuthoringMutationError(
      "preset_parameter_locked",
      `Preset parameter cannot be deleted: ${parameterId}`
    );
  }

  const parameter = getParameterById(session.graph, parameterId);
  if (parameter === undefined) {
    throw new AuthoringMutationError(
      "missing_parameter",
      `Parameter does not exist: ${parameterId}`
    );
  }

  const refs = listParameterReferences(session, parameterId);
  if (refs.length > 0) {
    throw new AuthoringMutationError(
      "parameter_in_use",
      `Parameter ${parameterId} is still referenced: ${refs.join(", ")}`
    );
  }

  const parameterBefore = structuredClone(parameter);
  session.graph.parameters = session.graph.parameters.filter(
    (candidate) => candidate.parameterId !== parameterId
  );
  session.graph.stableOrder = session.graph.stableOrder.filter((id) => id !== parameterId);
  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    parameterBefore,
    authoringRevision: session.authoringRevision
  };
};

const createUpdatedParameter = (
  parameter: ParameterDto,
  input: UpdateParameterInput
): ParameterDto => ({
  ...parameter,
  ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
  ...(input.min === undefined ? {} : { min: input.min }),
  ...(input.max === undefined ? {} : { max: input.max }),
  ...(input.default === undefined ? {} : { default: input.default }),
  ...(input.recommendedUiStep === undefined
    ? {}
    : { recommendedUiStep: input.recommendedUiStep })
});

const assertParameterRange = (parameter: ParameterDto): void => {
  if (
    !Number.isFinite(parameter.min) ||
    !Number.isFinite(parameter.max) ||
    !Number.isFinite(parameter.default) ||
    parameter.min > parameter.max ||
    parameter.default < parameter.min ||
    parameter.default > parameter.max ||
    !Number.isFinite(parameter.recommendedUiStep) ||
    parameter.recommendedUiStep <= 0
  ) {
    throw new AuthoringMutationError(
      "invalid_parameter_range",
      `Parameter range/default/step is invalid: ${parameter.parameterId}`
    );
  }
};

const listParameterReferences = (
  session: AuthoringSession,
  parameterId: ParameterId
): readonly string[] => {
  const keyformRefs = session.graph.keyformSets.flatMap((keyformSet) => {
    if (keyformSet.evaluator === "linear-1d-v1") {
      return keyformSet.parameterId === parameterId
        ? [`keyformSet:${keyformSet.keyformSetId}`]
        : [];
    }

    return [keyformSet.parameterX, keyformSet.parameterY].includes(parameterId)
      ? [`keyformSet:${keyformSet.keyformSetId}`]
      : [];
  });
  const dynamicsRefs = session.graph.dynamicsGroups.flatMap((group) => [
    ...group.drivers
      .filter((driver) => driver.sourceParameterId === parameterId)
      .map((driver) => `dynamicsDriver:${group.dynamicsGroupId}/${driver.driverId}`),
    ...(group.output.targetParameterId === parameterId
      ? [`dynamicsOutput:${group.dynamicsGroupId}/${group.output.outputId}`]
      : [])
  ]);

  return [...keyformRefs, ...dynamicsRefs].sort();
};

const parametersEqual = (left: ParameterDto, right: ParameterDto): boolean =>
  JSON.stringify(left) === JSON.stringify(right);
