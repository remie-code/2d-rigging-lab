import {
  createTutorialMiniModelSeed,
  TUTORIAL_MINI_MODEL_IDS,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  RigControlIdSchema
} from "@private-2d-rigging-lab/contracts";
import { createOperationCore } from "@private-2d-rigging-lab/operation-core";
import { describe, expect, it } from "vitest";

import { createPerceptionFixture } from "../test-support/perception-fixtures.js";
import { evaluatePerceptionSnapshot } from "./evaluation-adapter.js";
import { measureEvaluatedGeometry } from "./measurement-command.js";

// Brand plain fixture id strings for the payload types (type-level only: the
// schema parse validates the prefix and returns the same string value).
const asDrawableId = (id: string) => DrawableIdSchema.parse(id);
const asRigControlId = (id: string) => RigControlIdSchema.parse(id);

/**
 * Wave104 Domain C measurement command unit tests (synthetic, rights-clean).
 *
 * The numeric expectations are derived INDEPENDENTLY of the command under test:
 * drawable bounds/vertices are cross-checked against the shared perception
 * snapshot (the same runtime-core evaluation), and the warp control points are
 * checked against the rest control points a rest-pose warp must produce.
 */

describe("measureEvaluatedGeometry — drawables", () => {
  it("returns finite evaluated bounds for a real drawable and marks a missing one not found", () => {
    const { session, ids } = createPerceptionFixture();

    const result = measureEvaluatedGeometry({
      session,
      payload: {
        targets: [
          { kind: "drawable", drawableId: asDrawableId(ids.eyeDrawableId) },
          { kind: "drawable", drawableId: asDrawableId("draw_does_not_exist") }
        ],
        parameterOverrides: {},
        includeVertices: false
      }
    });

    expect(result.schemaVersion).toBe("inspect-evaluated-geometry-result-v1");
    expect(result.results).toHaveLength(2);

    const eye = result.results[0];
    if (eye?.kind !== "drawable") {
      throw new Error("expected drawable result");
    }
    expect(eye.found).toBe(true);
    expect(eye.bounds).toBeDefined();
    const bounds = eye.bounds;
    if (bounds === undefined) {
      throw new Error("expected bounds");
    }
    for (const value of [bounds.x, bounds.y, bounds.width, bounds.height]) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
    // vertices omitted when includeVertices=false
    expect(eye.vertices).toBeUndefined();

    const missing = result.results[1];
    if (missing?.kind !== "drawable") {
      throw new Error("expected drawable result");
    }
    expect(missing.found).toBe(false);
    expect(missing.bounds).toBeUndefined();
  });

  it("matches the shared perception snapshot bounds/vertices exactly (not re-derived)", () => {
    const { session, ids } = createPerceptionFixture();
    const { snapshot } = evaluatePerceptionSnapshot(session);
    const snapshotDrawable = snapshot.drawables.find(
      (drawable) => drawable.drawableId === ids.eyeDrawableId
    );
    if (snapshotDrawable === undefined || snapshotDrawable.vertices === undefined) {
      throw new Error("expected full-detail snapshot drawable");
    }

    const result = measureEvaluatedGeometry({
      session,
      payload: {
        targets: [{ kind: "drawable", drawableId: asDrawableId(ids.eyeDrawableId) }],
        parameterOverrides: {},
        includeVertices: true
      }
    });

    const measured = result.results[0];
    if (measured?.kind !== "drawable") {
      throw new Error("expected drawable result");
    }
    // The command reports the SAME numbers the shared evaluation produced.
    expect(measured.bounds).toEqual(snapshotDrawable.bounds);
    expect(measured.vertices).toEqual(
      snapshotDrawable.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y }))
    );
  });

  it("echoes resolved parameter overrides sorted by parameterId", () => {
    const { session, ids } = createPerceptionFixture();

    const result = measureEvaluatedGeometry({
      session,
      payload: {
        targets: [{ kind: "drawable", drawableId: asDrawableId(ids.eyeDrawableId) }],
        parameterOverrides: { [ids.eyeRegionOpacityParameterId]: 0 },
        includeVertices: false
      }
    });

    expect(result.parameterOverrides).toEqual([
      { parameterId: ids.eyeRegionOpacityParameterId, value: 0 }
    ]);
  });
});

describe("measureEvaluatedGeometry — warp rig control", () => {
  it("returns evaluated warp lattice control points equal to rest control points at rest pose", () => {
    const { session, warpRigControlId, domainBounds } = createWarpFixture();

    // Independent expectation: a rest-pose warp has zero offsets, so the evaluated
    // absolute control points equal the rest control points, which for a
    // `transformColumns x transformRows` grid are the evenly spaced grid nodes of
    // the domain rect (top-left corner is the domain origin).
    const result = measureEvaluatedGeometry({
      session,
      payload: {
        targets: [{ kind: "rigControl", rigControlId: asRigControlId(warpRigControlId) }],
        parameterOverrides: {},
        includeVertices: false
      }
    });

    const warp = result.results[0];
    if (warp?.kind !== "rigControl") {
      throw new Error("expected rigControl result");
    }
    expect(warp.found).toBe(true);
    expect(warp.rigControlKind).toBe("warpLattice2d");
    expect(warp.evaluationStatus).toBe("evaluated");
    expect(warp.bounds).toEqual(domainBounds);

    const points = warp.evaluatedControlPoints;
    if (points === undefined) {
      throw new Error("expected evaluated control points for a warp rig control");
    }
    // Every control point must lie on the domain rect (rest pose).
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(domainBounds.x);
      expect(point.x).toBeLessThanOrEqual(domainBounds.x + domainBounds.width);
      expect(point.y).toBeGreaterThanOrEqual(domainBounds.y);
      expect(point.y).toBeLessThanOrEqual(domainBounds.y + domainBounds.height);
    }
    // The four corners of the domain rect must be present among the rest nodes.
    const hasCorner = (x: number, y: number) =>
      points.some((point) => point.x === x && point.y === y);
    expect(hasCorner(domainBounds.x, domainBounds.y)).toBe(true);
    expect(hasCorner(domainBounds.x + domainBounds.width, domainBounds.y)).toBe(true);
    expect(hasCorner(domainBounds.x, domainBounds.y + domainBounds.height)).toBe(true);
    expect(
      hasCorner(domainBounds.x + domainBounds.width, domainBounds.y + domainBounds.height)
    ).toBe(true);

    // And the rest points equal what the shared snapshot exposes directly.
    const { snapshot } = evaluatePerceptionSnapshot(session);
    const snapshotWarp = snapshot.rigControls.find(
      (rigControl) => rigControl.rigControlId === warpRigControlId
    );
    expect(warp.evaluatedControlPoints).toEqual(snapshotWarp?.evaluatedControlPoints);
  });

  it("returns evaluated warp control points offset from rest under parameterOverrides (non-rest regression)", () => {
    const { session, warpRigControlId, parameterId } = createWarpFixture({
      withOffsetKeyform: true
    });

    const measureAt = (parameterOverrides: Record<string, number>) => {
      const result = measureEvaluatedGeometry({
        session,
        payload: {
          targets: [{ kind: "rigControl", rigControlId: asRigControlId(warpRigControlId) }],
          parameterOverrides,
          includeVertices: false
        }
      });
      const warp = result.results[0];
      if (warp?.kind !== "rigControl" || warp.evaluatedControlPoints === undefined) {
        throw new Error("expected rigControl result with evaluated control points");
      }
      return warp.evaluatedControlPoints;
    };

    // Rest pose (keyform key at parameter default 0 carries zero offsets).
    const restPoints = measureAt({});
    // Driven pose: the keyValue=1 key REPLACEs offsets with a constant
    // WARP_KEYFORM_OFFSET on every lattice node.
    const drivenPoints = measureAt({ [parameterId]: 1 });

    // Independent numeric expectation: driven[i] = rest[i] + WARP_KEYFORM_OFFSET.
    expect(drivenPoints).toEqual(
      restPoints.map((point) => ({
        x: point.x + WARP_KEYFORM_OFFSET.x,
        y: point.y + WARP_KEYFORM_OFFSET.y
      }))
    );
    // And the driven points genuinely differ from rest.
    expect(drivenPoints).not.toEqual(restPoints);
  });
});

/** Constant per-node offset driven by the fixture keyform at keyValue=1. */
const WARP_KEYFORM_OFFSET = { x: 5, y: -3 };

interface WarpFixture {
  readonly session: AuthoringSession;
  readonly warpRigControlId: string;
  readonly domainBounds: { x: number; y: number; width: number; height: number };
  /** Present when withOffsetKeyform: the parameter driving the offsets. */
  readonly parameterId: string;
}

const createWarpFixture = (
  options: { readonly withOffsetKeyform?: boolean } = {}
): WarpFixture => {
  const seed = createTutorialMiniModelSeed();
  const core = createOperationCore({ now: () => new Date("2026-07-02T00:00:00.000Z") });
  const ids = TUTORIAL_MINI_MODEL_IDS;
  const domainBounds = { x: 0, y: 0, width: 100, height: 200 };
  let basePackageRevision = seed.session.packageRevision;
  let sequence = 0;

  const commit = (operationType: string, payload: unknown): void => {
    sequence += 1;
    const outcome = core.commitOperation(seed.session, {
      schemaVersion: "operation-request-v1",
      operationId: `op_warp_fixture_${operationType}_${sequence}`,
      actor: "test",
      surface: "testFixture",
      dryRun: false,
      basePackageRevision,
      operationType,
      payload,
      trace: { relatedAC: [], relatedScenarios: [] }
    } as never);
    if (outcome.result.status !== "committed") {
      throw new Error(
        `warp fixture op ${operationType} not committed (${outcome.result.status}): ` +
          outcome.result.diagnostics.map((d) => `${d.checkId}:${d.message}`).join("; ")
      );
    }
    basePackageRevision = seed.session.packageRevision;
  };

  commit("createPart", { partId: ids.parts.body, displayName: "Body", lockedTargetIds: [] });
  commit("createDrawable", {
    sourceAssetId: ids.sourceAssetId,
    sourceLayerId: ids.layers.eye,
    textureId: ids.textures.eye,
    partId: ids.parts.body,
    displayName: "Eye"
  });
  const eye = seed.session.graph.drawables.find((drawable) => drawable.displayName === "Eye");
  if (eye === undefined) {
    throw new Error("warp fixture eye drawable missing");
  }
  commit("generateMesh", {
    drawableId: eye.drawableId,
    method: "auto-grid-v1",
    densityHint: "low"
  });
  commit("createWarpDeformer", {
    displayName: "Eye Warp",
    childDrawableIds: [eye.drawableId],
    domainBounds,
    transformColumns: 3,
    transformRows: 3,
    bezierColumns: 2,
    bezierRows: 2
  });

  const warp = seed.session.graph.rigControls.find(
    (rigControl) => rigControl.kind === "warpLattice2d"
  );
  if (warp === undefined) {
    throw new Error("warp fixture rig control missing");
  }

  const parameterId = "param_warp_measure_drive";
  if (options.withOffsetKeyform === true) {
    const restControlPointCount =
      (warp as { readonly restControlPoints?: readonly unknown[] }).restControlPoints
        ?.length ?? 0;
    if (restControlPointCount === 0) {
      throw new Error("warp fixture rig control has no rest control points");
    }

    commit("createParameter", {
      parameterId,
      displayName: "Warp Measure Drive",
      valueSource: "authoredInput",
      min: 0,
      max: 1,
      default: 0,
      recommendedUiStep: 0.01
    });
    // A single keyform set with end keys: zero offsets at the parameter min
    // (= default 0, so rest stays rest) and a constant per-node offset at max
    // (keyValue 1). createEnds keeps both keys in ONE set — two single-key
    // addKeyform sets would each apply unconditionally.
    const constantOffsets = (offset: { readonly x: number; readonly y: number }) =>
      Array.from({ length: restControlPointCount }, () => ({ x: offset.x, y: offset.y }));
    commit("editKeyformKey", {
      action: "createEnds",
      target: { kind: "rigControl", id: warp.rigControlId },
      targetProperty: "controlPointOffsets",
      parameterId,
      interpolation: "linear-1d-v1",
      statePatches: {
        min: { propertyPath: "controlPointOffsets", value: constantOffsets({ x: 0, y: 0 }) },
        max: { propertyPath: "controlPointOffsets", value: constantOffsets(WARP_KEYFORM_OFFSET) }
      }
    });
  }

  return {
    session: seed.session,
    warpRigControlId: warp.rigControlId,
    domainBounds,
    parameterId
  };
};
