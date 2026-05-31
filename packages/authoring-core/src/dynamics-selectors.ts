import type { DynamicsGroupId } from "@private-2d-rigging-lab/contracts";
import type { DynamicsGroupDto } from "@private-2d-rigging-lab/package-format";

import type { AuthoringGraph } from "./authoring-graph.js";

export const listDynamicsGroups = (graph: AuthoringGraph): readonly DynamicsGroupDto[] =>
  graph.dynamicsGroups;

export const getDynamicsGroupById = (
  graph: AuthoringGraph,
  dynamicsGroupId: DynamicsGroupId
): DynamicsGroupDto | undefined =>
  graph.dynamicsGroups.find((group) => group.dynamicsGroupId === dynamicsGroupId);

export const hasDynamicsGroup = (
  graph: AuthoringGraph,
  dynamicsGroupId: DynamicsGroupId
): boolean => getDynamicsGroupById(graph, dynamicsGroupId) !== undefined;
