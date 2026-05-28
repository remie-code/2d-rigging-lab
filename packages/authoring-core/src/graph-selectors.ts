import type { ParameterId } from "@private-2d-rigging-lab/contracts";
import type { ParameterDto } from "@private-2d-rigging-lab/package-format";

import type { AuthoringGraph } from "./authoring-graph.js";

export const listParameters = (graph: AuthoringGraph): readonly ParameterDto[] => graph.parameters;

export const getParameterById = (
  graph: AuthoringGraph,
  parameterId: ParameterId
): ParameterDto | undefined =>
  graph.parameters.find((parameter) => parameter.parameterId === parameterId);

export const hasParameter = (graph: AuthoringGraph, parameterId: ParameterId): boolean =>
  getParameterById(graph, parameterId) !== undefined;
