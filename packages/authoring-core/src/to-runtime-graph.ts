import type { NormalizedRuntimeGraph } from "@private-2d-rigging-lab/runtime-core";

import type { AuthoringGraph } from "./authoring-graph.js";
import type { AuthoringSession } from "./authoring-session.js";
import { createRuntimeDrawableMap, createRuntimeDrawOrder } from "./runtime-graph-drawables.js";
import { createRuntimeDynamicsGroupMap } from "./runtime-graph-dynamics.js";
import { createRuntimeKeyformBindings } from "./runtime-graph-keyforms.js";
import { createRuntimeParameterMap } from "./runtime-graph-parameters.js";
import { createRuntimeRigControlMap } from "./runtime-graph-rig-controls.js";

export interface RuntimeGraphPackageContext {
  readonly packageId: string;
  readonly packageRevision: number;
  readonly packageHash?: string;
}

export interface RuntimeGraphAdapterOptions {
  readonly packageHash?: string;
}

export const toRuntimeGraph = (
  session: AuthoringSession,
  options: RuntimeGraphAdapterOptions = {}
): NormalizedRuntimeGraph =>
  toRuntimeGraphFromAuthoringGraph(session.graph, {
    packageId: session.packageIdentity.packageId,
    packageRevision: session.packageRevision,
    ...(options.packageHash === undefined ? {} : { packageHash: options.packageHash })
  });

export const toRuntimeGraphFromAuthoringGraph = (
  graph: AuthoringGraph,
  context: RuntimeGraphPackageContext
): NormalizedRuntimeGraph => ({
  packageId: context.packageId,
  packageRevision: context.packageRevision,
  ...(context.packageHash === undefined ? {} : { packageHash: context.packageHash }),
  coordinateSystem: graph.coordinateSystem,
  parameters: createRuntimeParameterMap(graph),
  dynamicsGroups: createRuntimeDynamicsGroupMap(graph),
  drawables: createRuntimeDrawableMap(graph),
  rigControls: createRuntimeRigControlMap(graph),
  keyformBindings: createRuntimeKeyformBindings(graph),
  masks: graph.masks
    .filter((mask) => mask.enabled)
    .map((mask) => ({
      maskRelationId: mask.maskRelationId,
      sourceDrawableIds: [...mask.maskDrawableIds],
      targetDrawableIds: [...mask.targetDrawableIds]
    })),
  drawOrder: createRuntimeDrawOrder(graph),
  disabledFutureLayers: []
});
