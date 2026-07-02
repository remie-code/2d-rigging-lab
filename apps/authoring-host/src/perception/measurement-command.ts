import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  InspectEvaluatedGeometryPayload,
  InspectEvaluatedGeometryResult,
  InspectGeometryTarget,
  InspectGeometryTargetResult
} from "@private-2d-rigging-lab/ai-interface";
import { InspectEvaluatedGeometryResultSchema } from "@private-2d-rigging-lab/ai-interface";
import type { RuntimeSnapshotDto } from "@private-2d-rigging-lab/runtime-core";

import { evaluatePerceptionSnapshot } from "./evaluation-adapter.js";

/**
 * Measurement (`inspectEvaluatedGeometry`) resolver for the authoring-host
 * (Wave104 Domain C, §3.3).
 *
 * Shares the exact same runtime-core evaluation path as `renderView` (the
 * perception oracle, L0 3.1-1): it evaluates the session through
 * {@link evaluatePerceptionSnapshot} and reads geometry from the resulting
 * `full`-detail snapshot. It does NOT re-implement bbox math — drawable bounds
 * come straight off `snapshot.drawables[].bounds`, and warp lattice
 * control-point coordinates come from the runtime-core-computed
 * `rigControls[].evaluatedControlPoints` (the narrow Wave104 export). This
 * keeps measurement and rendering describing the same evaluated pose.
 */

type EvaluatedDrawable = RuntimeSnapshotDto["drawables"][number];
type EvaluatedRigControl = RuntimeSnapshotDto["rigControls"][number];

export const measureEvaluatedGeometry = (input: {
  readonly session: AuthoringSession;
  readonly payload: InspectEvaluatedGeometryPayload;
}): InspectEvaluatedGeometryResult => {
  const { session, payload } = input;
  const { snapshot } = evaluatePerceptionSnapshot(session, {
    parameterOverrides: payload.parameterOverrides
  });

  const drawableById = new Map<string, EvaluatedDrawable>(
    snapshot.drawables.map((drawable) => [drawable.drawableId, drawable])
  );
  const rigControlById = new Map<string, EvaluatedRigControl>(
    snapshot.rigControls.map((rigControl) => [rigControl.rigControlId, rigControl])
  );

  const results: InspectGeometryTargetResult[] = payload.targets.map((target) =>
    resolveTarget({
      target,
      drawableById,
      rigControlById,
      includeVertices: payload.includeVertices
    })
  );

  // Echo the resolved overrides deterministically (sorted by parameterId) so a
  // reader can confirm which pose the numbers describe.
  const parameterOverrides = Object.entries(payload.parameterOverrides)
    .map(([parameterId, value]) => ({ parameterId, value }))
    .sort((left, right) => left.parameterId.localeCompare(right.parameterId));

  return InspectEvaluatedGeometryResultSchema.parse({
    schemaVersion: "inspect-evaluated-geometry-result-v1",
    packageRevision: snapshot.packageRevision,
    parameterOverrides,
    results
  });
};

const resolveTarget = (input: {
  readonly target: InspectGeometryTarget;
  readonly drawableById: ReadonlyMap<string, EvaluatedDrawable>;
  readonly rigControlById: ReadonlyMap<string, EvaluatedRigControl>;
  readonly includeVertices: boolean;
}): InspectGeometryTargetResult => {
  if (input.target.kind === "drawable") {
    const drawable = input.drawableById.get(input.target.drawableId);
    if (drawable === undefined) {
      return {
        kind: "drawable",
        drawableId: input.target.drawableId,
        found: false
      };
    }

    return {
      kind: "drawable",
      drawableId: input.target.drawableId,
      found: true,
      bounds: drawable.bounds,
      ...(input.includeVertices && drawable.vertices !== undefined
        ? { vertices: drawable.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y })) }
        : {})
    };
  }

  const rigControl = input.rigControlById.get(input.target.rigControlId);
  if (rigControl === undefined) {
    return {
      kind: "rigControl",
      rigControlId: input.target.rigControlId,
      found: false
    };
  }

  return {
    kind: "rigControl",
    rigControlId: input.target.rigControlId,
    found: true,
    rigControlKind: rigControl.kind,
    evaluationStatus: rigControl.evaluationStatus,
    ...(rigControl.bounds === undefined ? {} : { bounds: rigControl.bounds }),
    ...(rigControl.evaluatedControlPoints === undefined
      ? {}
      : {
          evaluatedControlPoints: rigControl.evaluatedControlPoints.map((point) => ({
            x: point.x,
            y: point.y
          }))
        })
  };
};
