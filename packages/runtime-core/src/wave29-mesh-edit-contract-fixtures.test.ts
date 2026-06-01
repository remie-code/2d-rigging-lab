import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { RuntimeDiffDto } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { buildRuntimeEvidence } from "./runtime-evidence.js";
import type {
  NormalizedDrawable,
  NormalizedPart,
  NormalizedRuntimeGraph,
  RuntimeDrawableMeshEditEvidenceDto,
  RuntimeEvidenceResult,
  ViewerRuntimeEvaluationResult
} from "./index.js";
import { evaluateViewerRuntimeSnapshot } from "./viewer-evaluation.js";

describe("wave29 mesh edit runtime/viewer contract fixture", () => {
  it("pins semantic mesh edit evidence without a renderer or pixel oracle", () => {
    const baselineGraph = createRuntimeGraphFromFixture(loadFixtureJson("runtime/baseline-runtime-graph.json"));
    const finalGraph = createRuntimeGraphFromFixture(loadFixtureJson("runtime/final-runtime-graph.json"));
    const runtimeEvidence = buildRuntimeEvidence({
      baselineGraph,
      candidateGraph: finalGraph,
      baseline: {
        frame: {
          targetIds: ["draw_wave29_mesh", "mesh_wave29_mesh"]
        }
      },
      candidate: {
        frame: {
          targetIds: ["draw_wave29_mesh", "mesh_wave29_mesh"]
        }
      },
      options: {
        schemaVersion: "runtime-evaluation-options-v1",
        snapshotDetail: "full"
      },
      context: {
        source: { surface: "validator", operationId: "op_wave29_move_mesh_vertices" },
        policy: { strictness: "strict" }
      },
      artifactLabel: "wave29-mesh-edit-contract"
    });
    const viewerResult = evaluateViewerRuntimeSnapshot(finalGraph, {
      baselineFrameIndex: 20,
      frameIndex: 21,
      operationId: "op_wave29_viewer_contract_evidence",
      strictness: "strict",
      targetIds: ["draw_wave29_mesh", "mesh_wave29_mesh"],
      options: {
        schemaVersion: "runtime-evaluation-options-v1",
        snapshotDetail: "full"
      }
    });

    expect(summarizeRuntimeViewerEvidence(runtimeEvidence, viewerResult)).toEqual(
      loadFixtureJson("expected/runtime-viewer-evidence-summary.json")
    );
  });
});

interface RuntimeGraphFixture {
  readonly packageId: string;
  readonly packageRevision: number;
  readonly packageHash?: string;
  readonly coordinateSystem: "canvas-y-down-v1";
  readonly parts: readonly NormalizedPart[];
  readonly drawables: readonly NormalizedDrawable[];
  readonly drawOrder: readonly { readonly drawableId: string; readonly drawOrder: number }[];
}

const summarizeRuntimeViewerEvidence = (
  runtimeEvidence: RuntimeEvidenceResult,
  viewerResult: ViewerRuntimeEvaluationResult
) => ({
  schemaVersion: "wave29-mesh-edit-runtime-viewer-evidence-summary-v1",
  runtimeEvidence: {
    baselineSnapshotId: runtimeEvidence.baselineSnapshot.snapshotId,
    candidateSnapshotId: runtimeEvidence.candidateSnapshot.snapshotId,
    generatedRuntimeSnapshotIds: runtimeEvidence.generatedRuntimeSnapshotIds,
    generatedRuntimeStateRefs: runtimeEvidence.generatedRuntimeStateRefs,
    generatedRuntimeStateSequenceRefs: runtimeEvidence.generatedRuntimeStateSequenceRefs,
    meshEditEvidence: runtimeEvidence.meshEditEvidence.drawables.map(summarizeMeshEditEvidence),
    runtimeDiff: summarizeRuntimeDiff(runtimeEvidence.runtimeDiff)
  },
  viewerEvidence: {
    surface: viewerResult.evidence.surface,
    baselineSnapshotId: viewerResult.evidence.baselineSnapshotId,
    snapshotId: viewerResult.evidence.snapshotId,
    finalRuntimeStateRef: viewerResult.evidence.finalRuntimeStateRef,
    targetIds: viewerResult.evidence.targetIds,
    meshEditEvidence: viewerResult.evidence.meshEditEvidence?.drawables.map((drawable) => ({
      drawableId: drawable.drawableId,
      meshId: drawable.meshId,
      boundsChanged: drawable.boundsChanged,
      vertexHashChanged: drawable.vertexHashChanged,
      movedVertexRefs: drawable.movedVertexRefs.map(summarizeMovedVertexRef)
    })) ?? [],
    runtimeDiffEquivalent: viewerResult.evidence.runtimeDiffEquivalent,
    runtimeEvaluationContext: viewerResult.evidence.runtimeEvaluationContext
  },
  semanticBoundary: {
    pixelOracle: false,
    rendererOracle: false,
    editorOnlyStateInRuntimeCore: false
  }
});

const summarizeMeshEditEvidence = (drawable: RuntimeDrawableMeshEditEvidenceDto) => ({
  drawableId: drawable.drawableId,
  meshId: drawable.meshId,
  boundsBefore: drawable.boundsBefore,
  boundsAfter: drawable.boundsAfter,
  vertexHashBefore: drawable.vertexHashBefore,
  vertexHashAfter: drawable.vertexHashAfter,
  boundsChanged: drawable.boundsChanged,
  vertexHashChanged: drawable.vertexHashChanged,
  topology: drawable.topology,
  movedVertexRefs: drawable.movedVertexRefs.map(summarizeMovedVertexRef)
});

const summarizeMovedVertexRef = (
  vertex: RuntimeDrawableMeshEditEvidenceDto["movedVertexRefs"][number]
) => ({
  vertexIndex: vertex.vertexIndex,
  vertexStableId: vertex.vertexStableId,
  vertexRef: vertex.vertexRef,
  before: vertex.before,
  after: vertex.after,
  delta: vertex.delta
});

const summarizeRuntimeDiff = (runtimeDiff: RuntimeDiffDto) => ({
  schemaVersion: runtimeDiff.schemaVersion,
  beforeSnapshotId: runtimeDiff.beforeSnapshotId,
  afterSnapshotId: runtimeDiff.afterSnapshotId,
  drawableChanges: runtimeDiff.drawableChanges,
  drawableRuntimeStateChangeCount: runtimeDiff.drawableRuntimeStateChanges.length,
  diagnosticDeltaCount: runtimeDiff.diagnosticDelta.length
});

const createRuntimeGraphFromFixture = (fixture: unknown): NormalizedRuntimeGraph => {
  const parsed = fixture as RuntimeGraphFixture;

  return {
    packageId: PackageIdSchema.parse(parsed.packageId),
    packageRevision: parsed.packageRevision,
    ...(parsed.packageHash === undefined ? {} : { packageHash: parsed.packageHash }),
    coordinateSystem: parsed.coordinateSystem,
    parameters: new Map(),
    parts: new Map(parsed.parts.map((part) => [PartIdSchema.parse(part.partId), createPart(part)])),
    dynamicsGroups: new Map(),
    drawables: new Map(parsed.drawables.map((drawable) => createDrawableEntry(drawable))),
    rigControls: new Map(),
    keyformBindings: [],
    masks: [],
    drawOrder: parsed.drawOrder.map((entry) => ({
      drawableId: DrawableIdSchema.parse(entry.drawableId),
      drawOrder: entry.drawOrder
    })),
    disabledFutureLayers: []
  };
};

const createPart = (part: NormalizedPart): NormalizedPart => ({
  partId: PartIdSchema.parse(part.partId),
  displayName: part.displayName,
  ...(part.parentPartId === undefined ? {} : { parentPartId: PartIdSchema.parse(part.parentPartId) }),
  childPartIds: part.childPartIds.map((partId) => PartIdSchema.parse(partId)),
  drawableIds: part.drawableIds.map((drawableId) => DrawableIdSchema.parse(drawableId))
});

const createDrawableEntry = (
  drawable: NormalizedDrawable
): readonly [NormalizedDrawable["drawableId"], NormalizedDrawable] => {
  const drawableId = DrawableIdSchema.parse(drawable.drawableId);

  return [
    drawableId,
    {
      ...drawable,
      drawableId,
      meshId: MeshIdSchema.parse(drawable.meshId),
      ...(drawable.partId === undefined ? {} : { partId: PartIdSchema.parse(drawable.partId) })
    }
  ];
};

const loadFixtureJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/wave29-mesh-edit-contract-fixtures"
);
