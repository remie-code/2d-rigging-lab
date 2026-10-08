import type {
  DynamicsGroupId
} from "@private-2d-rigging-lab/contracts";
import { DynamicsGroupSchema, type DynamicsGroupDto } from "@private-2d-rigging-lab/package-format";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { hasDynamicsGroup } from "./dynamics-selectors.js";
import { getInitializedParameterById } from "./parameter-surface.js";

export interface CreateDynamicsGroupMutationResult {
  readonly session: AuthoringSession;
  readonly dynamicsGroup: DynamicsGroupDto;
  readonly authoringRevision: AuthoringRevision;
}

export interface UpdateDynamicsGroupInput {
  readonly dynamicsGroupId: DynamicsGroupId;
  readonly displayName?: string;
  readonly enabled?: boolean;
  readonly presetId?: string;
  readonly inputs?: DynamicsGroupDto["inputs"];
  readonly chain?: DynamicsGroupDto["chain"];
  readonly outputs?: DynamicsGroupDto["outputs"];
}

export interface UpdateDynamicsGroupMutationResult {
  readonly session: AuthoringSession;
  readonly dynamicsGroup: DynamicsGroupDto;
  readonly previousDynamicsGroup: DynamicsGroupDto;
  readonly authoringRevision: AuthoringRevision;
}

export interface DeleteDynamicsGroupMutationResult {
  readonly session: AuthoringSession;
  readonly dynamicsGroup: DynamicsGroupDto;
  readonly authoringRevision: AuthoringRevision;
}

export const createDynamicsGroup = (
  session: AuthoringSession,
  dynamicsGroup: DynamicsGroupDto
): CreateDynamicsGroupMutationResult => {
  const parsedDynamicsGroup = parseDynamicsGroupForMutation(dynamicsGroup);
  assertUniqueDynamicsGroupId(session, parsedDynamicsGroup.dynamicsGroupId);
  assertValidDynamicsGroupParameterBindings(session, parsedDynamicsGroup);
  assertUniqueDynamicsOutputParameter(session, parsedDynamicsGroup);

  const storedDynamicsGroup = structuredClone(parsedDynamicsGroup);
  session.graph.dynamicsGroups.push(storedDynamicsGroup);
  if (!session.graph.stableOrder.includes(storedDynamicsGroup.dynamicsGroupId)) {
    session.graph.stableOrder.push(storedDynamicsGroup.dynamicsGroupId);
  }

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    dynamicsGroup: storedDynamicsGroup,
    authoringRevision: session.authoringRevision
  };
};

export const updateDynamicsGroup = (
  session: AuthoringSession,
  update: UpdateDynamicsGroupInput
): UpdateDynamicsGroupMutationResult => {
  const existingIndex = session.graph.dynamicsGroups.findIndex(
    (group) => group.dynamicsGroupId === update.dynamicsGroupId
  );

  if (existingIndex < 0) {
    throw new AuthoringMutationError(
      "missing_dynamics_group",
      `Dynamics group does not exist: ${update.dynamicsGroupId}`
    );
  }

  const existingDynamicsGroup = session.graph.dynamicsGroups[existingIndex];
  if (existingDynamicsGroup === undefined) {
    throw new AuthoringMutationError(
      "missing_dynamics_group",
      `Dynamics group does not exist: ${update.dynamicsGroupId}`
    );
  }

  const previousDynamicsGroup = structuredClone(existingDynamicsGroup);
  const nextDynamicsGroup: DynamicsGroupDto = {
    ...previousDynamicsGroup,
    ...(update.displayName === undefined ? {} : { displayName: update.displayName }),
    ...(update.enabled === undefined ? {} : { enabled: update.enabled }),
    ...(update.presetId === undefined ? {} : { presetId: update.presetId }),
    ...(update.inputs === undefined ? {} : { inputs: structuredClone(update.inputs) }),
    ...(update.chain === undefined ? {} : { chain: structuredClone(update.chain) }),
    ...(update.outputs === undefined ? {} : { outputs: structuredClone(update.outputs) })
  };
  const parsedNextDynamicsGroup = parseDynamicsGroupForMutation(nextDynamicsGroup);
  assertValidDynamicsGroupParameterBindings(session, parsedNextDynamicsGroup);
  assertUniqueDynamicsOutputParameter(session, parsedNextDynamicsGroup, update.dynamicsGroupId);

  if (JSON.stringify(previousDynamicsGroup) === JSON.stringify(parsedNextDynamicsGroup)) {
    throw new AuthoringMutationError(
      "no_op_dynamics_group_update",
      `Dynamics group update does not change ${update.dynamicsGroupId}`
    );
  }

  session.graph.dynamicsGroups[existingIndex] = parsedNextDynamicsGroup;
  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    dynamicsGroup: parsedNextDynamicsGroup,
    previousDynamicsGroup,
    authoringRevision: session.authoringRevision
  };
};

export const deleteDynamicsGroup = (
  session: AuthoringSession,
  dynamicsGroupId: DynamicsGroupId
): DeleteDynamicsGroupMutationResult => {
  const existingIndex = session.graph.dynamicsGroups.findIndex(
    (group) => group.dynamicsGroupId === dynamicsGroupId
  );
  const existingDynamicsGroup = existingIndex < 0 ? undefined : session.graph.dynamicsGroups[existingIndex];

  if (existingDynamicsGroup === undefined) {
    throw new AuthoringMutationError(
      "missing_dynamics_group",
      `Dynamics group does not exist: ${dynamicsGroupId}`
    );
  }

  session.graph.dynamicsGroups.splice(existingIndex, 1);
  session.graph.stableOrder = session.graph.stableOrder.filter((id) => id !== dynamicsGroupId);
  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    dynamicsGroup: structuredClone(existingDynamicsGroup),
    authoringRevision: session.authoringRevision
  };
};

const assertUniqueDynamicsGroupId = (
  session: AuthoringSession,
  dynamicsGroupId: DynamicsGroupId
): void => {
  if (hasDynamicsGroup(session.graph, dynamicsGroupId)) {
    throw new AuthoringMutationError(
      "duplicate_dynamics_group",
      `Dynamics group already exists: ${dynamicsGroupId}`
    );
  }
};

const parseDynamicsGroupForMutation = (dynamicsGroup: DynamicsGroupDto): DynamicsGroupDto => {
  const parsed = DynamicsGroupSchema.safeParse(dynamicsGroup);
  if (!parsed.success) {
    throw new AuthoringMutationError(
      "invalid_dynamics_group",
      parsed.error.issues.map((issue) => issue.message).join("; ")
    );
  }

  return parsed.data;
};

const assertValidDynamicsGroupParameterBindings = (
  session: AuthoringSession,
  dynamicsGroup: DynamicsGroupDto
): void => {
  for (const input of dynamicsGroup.inputs) {
    const parameter = getInitializedParameterById(session.graph, input.parameterId);
    if (parameter === undefined) {
      throw new AuthoringMutationError(
        "missing_dynamics_driver_parameter",
        `Dynamics input parameter does not exist: ${input.parameterId}`
      );
    }
  }

  const output = dynamicsGroup.outputs[0];
  if (output === undefined) {
    throw new AuthoringMutationError(
      "missing_dynamics_output",
      `Dynamics group must have one output: ${dynamicsGroup.dynamicsGroupId}`
    );
  }

  for (const candidate of dynamicsGroup.outputs) {
    const outputParameter = getInitializedParameterById(session.graph, candidate.parameterId);
    if (outputParameter === undefined) {
      throw new AuthoringMutationError(
        "missing_dynamics_output_parameter",
        `Dynamics output parameter does not exist: ${candidate.parameterId}`
      );
    }
  }
};

const assertUniqueDynamicsOutputParameter = (
  session: AuthoringSession,
  dynamicsGroup: DynamicsGroupDto,
  ignoredDynamicsGroupId?: DynamicsGroupId
): void => {
  for (const output of dynamicsGroup.outputs) {
    const existingGroup = session.graph.dynamicsGroups.find(
      (group) =>
        group.dynamicsGroupId !== ignoredDynamicsGroupId &&
        group.outputs.some((candidate) => candidate.parameterId === output.parameterId)
    );

    if (existingGroup !== undefined) {
      throw new AuthoringMutationError(
        "duplicate_dynamics_output_parameter",
        `Dynamics output parameter is already owned by ${existingGroup.dynamicsGroupId}: ${output.parameterId}`
      );
    }
  }
};
