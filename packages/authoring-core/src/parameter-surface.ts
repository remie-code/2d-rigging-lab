import type { ParameterId } from "@private-2d-rigging-lab/contracts";
import {
  createInitializedParameterSurface,
  getPresetParameterById,
  isPresetParameterId,
  type InitializedParameterDto
} from "@private-2d-rigging-lab/package-format";

import type { AuthoringGraph } from "./authoring-graph.js";

export const listInitializedParameters = (
  graph: AuthoringGraph
): readonly InitializedParameterDto[] =>
  createInitializedParameterSurface(graph.parameters);

export const getInitializedParameterById = (
  graph: AuthoringGraph,
  parameterId: ParameterId
): InitializedParameterDto | undefined =>
  listInitializedParameters(graph).find((parameter) => parameter.parameterId === parameterId);

export const hasInitializedParameter = (
  graph: AuthoringGraph,
  parameterId: ParameterId
): boolean =>
  getInitializedParameterById(graph, parameterId) !== undefined;

export const isLockedPresetParameter = (
  graph: AuthoringGraph,
  parameterId: ParameterId
): boolean =>
  isPresetParameterId(parameterId) ||
  graph.parameters.some((parameter) => parameter.parameterId === parameterId && parameter.kind === "preset") ||
  getPresetParameterById(parameterId) !== undefined;
