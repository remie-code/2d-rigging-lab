import type { RigControlId } from "@private-2d-rigging-lab/contracts";
import type { RigControlDto } from "@private-2d-rigging-lab/package-format";

import type { AuthoringGraph } from "./authoring-graph.js";

export const listRigControls = (graph: AuthoringGraph): readonly RigControlDto[] =>
  graph.rigControls;

export const getRigControlById = (
  graph: AuthoringGraph,
  rigControlId: RigControlId
): RigControlDto | undefined =>
  graph.rigControls.find((rigControl) => rigControl.rigControlId === rigControlId);

export const hasRigControl = (graph: AuthoringGraph, rigControlId: RigControlId): boolean =>
  getRigControlById(graph, rigControlId) !== undefined;
