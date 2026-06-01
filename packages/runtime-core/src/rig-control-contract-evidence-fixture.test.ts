import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  RigControlIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { buildRuntimeEvidence } from "./runtime-evidence.js";
import type {
  NormalizedDrawable,
  NormalizedRigControlNode,
  NormalizedRuntimeGraph
} from "./normalized-runtime-graph.js";
import type { RuntimeDiffDto } from "@private-2d-rigging-lab/contracts";
import type {
  EvaluatedDrawableDto,
  RuntimeSnapshotDto
} from "./snapshot.js";

const FIXTURE_ID = "parent-child-rigControl-diagonal";
const DRAWABLE_ID = "draw_arm";

describe("parent-child-rigControl-diagonal runtime contract fixture", () => {
  it("pins parent-before-child hierarchy, transformed drawable evidence, and runtime diff", () => {
    const evidence = buildFixtureRuntimeEvidence();

    expect(summarizeRuntimeEvidence(evidence)).toEqual(
      loadFixtureJson("expected/runtime-hierarchy-evidence-summary.json")
    );
    expect(summarizeRuntimeDiff(evidence.runtimeDiff)).toEqual(
      loadFixtureJson("expected/runtime-diff-summary.json")
    );
  });

  it("keeps viewer-facing semantic evidence deterministic without a pixel oracle", () => {
    const evidence = buildFixtureRuntimeEvidence();
    const candidateSnapshot = evidence.candidateSnapshot;
    const viewerSummary = loadFixtureJson("expected/viewer-facing-evidence-summary.json");
    const drawable = findDrawable(candidateSnapshot, DRAWABLE_ID);

    expect(viewerSummary.workflow).toEqual({
      fixtureId: FIXTURE_ID,
      operationTypes: [
        "createRotation2dRigControl",
        "bindRigControlChild"
      ],
      rootRigControlId: "rig_body_rotation",
      childRigControlId: "rig_arm_rotation",
      affectedDrawableId: DRAWABLE_ID
    });
    expect(viewerSummary.viewerEvidence).toMatchObject({
      runtimeSnapshotId: candidateSnapshot.snapshotId,
      rigControlOrder: candidateSnapshot.rigControls.map((rigControl) => rigControl.rigControlId),
      drawableBoundsChanged: true,
      drawableVertexHash: drawable.vertexHash
    });
    expect(viewerSummary.editorUiScope).toBe("reference-only; no editor UI implementation is required by this fixture");
  });
});

interface RuntimeEvidenceLike {
  readonly baselineSnapshot: RuntimeSnapshotDto;
  readonly candidateSnapshot: RuntimeSnapshotDto;
  readonly runtimeDiff: RuntimeDiffDto;
}

const buildFixtureRuntimeEvidence = () => {
  const fixtureGraph = loadFixtureJson("runtime/runtime-graph.json");
  const candidateGraph = createRuntimeGraphFromFixture(fixtureGraph);
  const baselineGraph: NormalizedRuntimeGraph = {
    ...candidateGraph,
    packageRevision: 0,
    rigControls: new Map()
  };

  return buildRuntimeEvidence({
    baselineGraph,
    candidateGraph,
    baseline: {
      frame: createEvaluationFrame(0)
    },
    candidate: {
      frame: createEvaluationFrame(1)
    },
    options: {
      schemaVersion: "runtime-evaluation-options-v1",
      snapshotDetail: "full"
    },
    context: {
      source: { surface: "validator", operationId: "op_fixture_bind_arm_drawable" },
      policy: { strictness: "strict" }
    },
    artifactLabel: "parent-child-rigControl-diagonal"
  });
};

const createEvaluationFrame = (frameIndex: number) => ({
  frameIndex,
  deltaTimeMs: 0,
  authoredParameterValues: {},
  targetIds: [DRAWABLE_ID, "rig_body_rotation", "rig_arm_rotation"]
});

const summarizeRuntimeEvidence = (evidence: RuntimeEvidenceLike) => ({
  schemaVersion: "parent-child-rigControl-runtime-hierarchy-summary-v1",
  baselineSnapshot: {
    snapshotId: evidence.baselineSnapshot.snapshotId,
    rigControlOrder: evidence.baselineSnapshot.rigControls.map((rigControl) => rigControl.rigControlId),
    drawable: summarizeDrawable(findDrawable(evidence.baselineSnapshot, DRAWABLE_ID), false)
  },
  candidateSnapshot: {
    snapshotId: evidence.candidateSnapshot.snapshotId,
    rigControlOrder: evidence.candidateSnapshot.rigControls.map((rigControl) => rigControl.rigControlId),
    rigControls: evidence.candidateSnapshot.rigControls.map((rigControl) => ({
      rigControlId: rigControl.rigControlId,
      parentId: rigControl.parentId ?? null,
      hierarchyIndex: rigControl.hierarchyIndex,
      evaluationStatus: rigControl.evaluationStatus,
      affectedDrawableIds: rigControl.affectedDrawableIds,
      affectedRigControlIds: rigControl.affectedRigControlIds,
      localAngleDegrees: roundNumber(rigControl.localTransform?.angleDegrees),
      worldAngleDegrees: roundNumber(rigControl.worldTransform?.angleDegrees)
    })),
    drawable: summarizeDrawable(findDrawable(evidence.candidateSnapshot, DRAWABLE_ID), true),
    diagnostics: evidence.candidateSnapshot.diagnostics
  }
});

const summarizeDrawable = (
  drawable: EvaluatedDrawableDto,
  includeVertices: boolean
) => ({
  drawableId: drawable.drawableId,
  bounds: roundRecord(drawable.bounds),
  vertexHash: drawable.vertexHash,
  ...(includeVertices ? { vertices: drawable.vertices?.map(roundRecord) } : {})
});

const summarizeRuntimeDiff = (runtimeDiff: RuntimeDiffDto) => ({
  schemaVersion: "parent-child-rigControl-runtime-diff-summary-v1",
  runtimeDiff: {
    schemaVersion: runtimeDiff.schemaVersion,
    beforeSnapshotId: runtimeDiff.beforeSnapshotId,
    afterSnapshotId: runtimeDiff.afterSnapshotId,
    parameterChanges: runtimeDiff.parameterChanges.map((change) => ({
      path: change.path,
      afterRigControlId: isRecord(change.after) && typeof change.after.rigControlId === "string"
        ? change.after.rigControlId
        : undefined
    })),
    drawableChanges: runtimeDiff.drawableChanges,
    diagnosticDeltaCount: runtimeDiff.diagnosticDelta.length
  }
});

const createRuntimeGraphFromFixture = (fixture: any): NormalizedRuntimeGraph => ({
  packageId: PackageIdSchema.parse(fixture.packageId),
  packageRevision: fixture.packageRevision,
  packageHash: fixture.packageHash,
  coordinateSystem: fixture.coordinateSystem,
  parameters: new Map(),
  dynamicsGroups: new Map(),
  drawables: new Map(fixture.drawables.map((drawable: any) => createDrawableEntry(drawable))),
  rigControls: new Map(fixture.rigControls.map((rigControl: any) => createRigControlEntry(rigControl))),
  keyformBindings: [],
  masks: [],
  drawOrder: fixture.drawOrder,
  disabledFutureLayers: []
});

const createDrawableEntry = (
  drawable: any
): readonly [NormalizedDrawable["drawableId"], NormalizedDrawable] => {
  const drawableId = DrawableIdSchema.parse(drawable.drawableId);

  return [
    drawableId,
    {
      drawableId,
      meshId: MeshIdSchema.parse(drawable.meshId),
      visible: drawable.visible,
      opacity: drawable.opacity,
      baseDrawOrder: drawable.baseDrawOrder,
      bounds: drawable.bounds,
      vertices: drawable.vertices,
      vertexCount: drawable.vertices.length
    }
  ];
};

const createRigControlEntry = (
  rigControl: any
): readonly [NormalizedRigControlNode["rigControlId"], NormalizedRigControlNode] => {
  const rigControlId = RigControlIdSchema.parse(rigControl.rigControlId);

  return [
    rigControlId,
    {
      ...rigControl,
      rigControlId,
      ...(rigControl.parentId === undefined
        ? {}
        : { parentId: RigControlIdSchema.parse(rigControl.parentId) }),
      childDrawableIds: rigControl.childDrawableIds.map((drawableId: string) => DrawableIdSchema.parse(drawableId)),
      childRigControlIds: rigControl.childRigControlIds.map((childRigControlId: string) =>
        RigControlIdSchema.parse(childRigControlId)
      )
    }
  ];
};

const findDrawable = (
  snapshot: RuntimeSnapshotDto,
  drawableId: string
): EvaluatedDrawableDto => {
  const drawable = snapshot.drawables.find((candidate) => candidate.drawableId === drawableId);
  if (drawable === undefined) {
    throw new Error(`Expected drawable ${drawableId} in snapshot ${snapshot.snapshotId}.`);
  }

  return drawable;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const roundNumber = (value: number | undefined): number | undefined =>
  value === undefined ? undefined : Number(value.toFixed(6));

const roundRecord = <TValue extends Record<string, number>>(value: TValue): TValue =>
  Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [key, roundNumber(entryValue)])
  ) as TValue;

const loadFixtureJson = (relativePath: string): any =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/parent-child-rigControl-diagonal"
);
