import type {
  DynamicsGroupId,
  ParameterId
} from "@private-2d-rigging-lab/contracts";
import type { DynamicsGroupDto } from "@private-2d-rigging-lab/package-format";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { hasDynamicsGroup } from "./dynamics-selectors.js";
import { getParameterById } from "./graph-selectors.js";

export interface CreateDynamicsGroupMutationResult {
  readonly session: AuthoringSession;
  readonly dynamicsGroup: DynamicsGroupDto;
  readonly authoringRevision: AuthoringRevision;
}

export interface UpdateDynamicsGroupInput {
  readonly dynamicsGroupId: DynamicsGroupId;
  readonly displayName?: string;
  readonly enabled?: boolean;
  readonly resetPolicy?: DynamicsGroupDto["resetPolicy"];
  readonly settings?: DynamicsGroupDto["settings"];
}

export interface UpdateDynamicsGroupMutationResult {
  readonly session: AuthoringSession;
  readonly dynamicsGroup: DynamicsGroupDto;
  readonly previousDynamicsGroup: DynamicsGroupDto;
  readonly authoringRevision: AuthoringRevision;
}

export const createDynamicsGroup = (
  session: AuthoringSession,
  dynamicsGroup: DynamicsGroupDto
): CreateDynamicsGroupMutationResult => {
  assertUniqueDynamicsGroupId(session, dynamicsGroup.dynamicsGroupId);
  assertValidDynamicsGroupParameterBindings(session, dynamicsGroup);
  assertUniqueDynamicsDriverIds(dynamicsGroup);
  assertUniqueDynamicsOutputParameter(session, dynamicsGroup);

  const storedDynamicsGroup = structuredClone(dynamicsGroup);
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
    ...(update.resetPolicy === undefined ? {} : { resetPolicy: update.resetPolicy }),
    ...(update.settings === undefined ? {} : { settings: structuredClone(update.settings) })
  };

  if (JSON.stringify(previousDynamicsGroup) === JSON.stringify(nextDynamicsGroup)) {
    throw new AuthoringMutationError(
      "no_op_dynamics_group_update",
      `Dynamics group update does not change ${update.dynamicsGroupId}`
    );
  }

  session.graph.dynamicsGroups[existingIndex] = nextDynamicsGroup;
  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    dynamicsGroup: nextDynamicsGroup,
    previousDynamicsGroup,
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

const assertValidDynamicsGroupParameterBindings = (
  session: AuthoringSession,
  dynamicsGroup: DynamicsGroupDto
): void => {
  const driverParameterIds = new Set<ParameterId>();

  for (const driver of dynamicsGroup.drivers) {
    const parameter = getParameterById(session.graph, driver.sourceParameterId);
    if (parameter === undefined) {
      throw new AuthoringMutationError(
        "missing_dynamics_driver_parameter",
        `Dynamics parameter does not exist: ${driver.sourceParameterId}`
      );
    }
    if (parameter.valueSource !== "authoredInput") {
      throw new AuthoringMutationError(
        "invalid_dynamics_driver_parameter_source",
        `Dynamics driver parameter must use valueSource=authoredInput: ${driver.sourceParameterId}`
      );
    }
    driverParameterIds.add(driver.sourceParameterId);
  }

  const outputParameter = getParameterById(session.graph, dynamicsGroup.output.targetParameterId);
  if (outputParameter === undefined) {
    throw new AuthoringMutationError(
      "missing_dynamics_output_parameter",
      `Dynamics parameter does not exist: ${dynamicsGroup.output.targetParameterId}`
    );
  }
  if (outputParameter.valueSource !== "computedDynamics") {
    throw new AuthoringMutationError(
      "invalid_dynamics_output_parameter_source",
      `Dynamics output parameter must use valueSource=computedDynamics: ${dynamicsGroup.output.targetParameterId}`
    );
  }

  if (driverParameterIds.has(dynamicsGroup.output.targetParameterId)) {
    throw new AuthoringMutationError(
      "dynamics_output_used_as_driver",
      `Dynamics output parameter cannot also be a driver: ${dynamicsGroup.output.targetParameterId}`
    );
  }
};

const assertUniqueDynamicsDriverIds = (dynamicsGroup: DynamicsGroupDto): void => {
  const driverIds = new Set<string>();

  for (const driver of dynamicsGroup.drivers) {
    if (driverIds.has(driver.driverId)) {
      throw new AuthoringMutationError(
        "duplicate_dynamics_driver",
        `Dynamics driver ID is duplicated: ${driver.driverId}`
      );
    }

    driverIds.add(driver.driverId);
  }
};

const assertUniqueDynamicsOutputParameter = (
  session: AuthoringSession,
  dynamicsGroup: DynamicsGroupDto
): void => {
  const existingGroup = session.graph.dynamicsGroups.find(
    (group) => group.output.targetParameterId === dynamicsGroup.output.targetParameterId
  );

  if (existingGroup !== undefined) {
    throw new AuthoringMutationError(
      "duplicate_dynamics_output_parameter",
      `Dynamics output parameter is already produced by ${existingGroup.dynamicsGroupId}: ${dynamicsGroup.output.targetParameterId}`
    );
  }
};
