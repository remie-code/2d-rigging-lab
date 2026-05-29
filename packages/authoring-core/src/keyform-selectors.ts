import type { KeyformSetId, ParameterId } from "@private-2d-rigging-lab/contracts";
import type { KeyformSetDto } from "@private-2d-rigging-lab/package-format";

import type { AuthoringGraph } from "./authoring-graph.js";

export const listKeyformSets = (graph: AuthoringGraph): readonly KeyformSetDto[] =>
  graph.keyformSets;

export const getKeyformSetById = (
  graph: AuthoringGraph,
  keyformSetId: KeyformSetId
): KeyformSetDto | undefined =>
  graph.keyformSets.find((keyformSet) => keyformSet.keyformSetId === keyformSetId);

export const hasKeyformSet = (graph: AuthoringGraph, keyformSetId: KeyformSetId): boolean =>
  getKeyformSetById(graph, keyformSetId) !== undefined;

export const listKeyformSetsForParameter = (
  graph: AuthoringGraph,
  parameterId: ParameterId
): readonly KeyformSetDto[] =>
  graph.keyformSets.filter((keyformSet) => {
    if (keyformSet.evaluator === "linear-1d-v1") {
      return keyformSet.parameterId === parameterId;
    }

    return keyformSet.parameterX === parameterId || keyformSet.parameterY === parameterId;
  });
