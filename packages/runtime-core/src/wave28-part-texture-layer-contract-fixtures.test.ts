import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { buildRuntimeEvidence } from "./runtime-evidence.js";
import type {
  NormalizedDrawable,
  NormalizedPart,
  NormalizedRuntimeGraph
} from "./normalized-runtime-graph.js";
import { evaluateViewerRuntimeSnapshot } from "./viewer-evaluation.js";
import type { RuntimeDiffDto } from "@private-2d-rigging-lab/contracts";
import type {
  RuntimeEvidenceResult,
  RuntimeSnapshotDto,
  ViewerRuntimeEvaluationResult
} from "./index.js";

describe("wave28 part, texture, and layer runtime/viewer fixture", () => {
  it("pins semantic runtime and viewer evidence without a pixel oracle", () => {
    const baselineGraph = createRuntimeGraphFromFixture(loadFixtureJson("runtime/baseline-runtime-graph.json"));
    const finalGraph = createRuntimeGraphFromFixture(loadFixtureJson("runtime/final-runtime-graph.json"));
    const runtimeEvidence = buildRuntimeEvidence({
      baselineGraph,
      candidateGraph: finalGraph,
      baseline: { frame: { frameIndex: 0, targetIds: ["draw_body", "draw_eye"] } },
      candidate: { frame: { frameIndex: 1, targetIds: ["draw_body", "draw_eye", "part_face"] } },
      context: {
        source: { surface: "validator", operationId: "op_wave28_set_drawable_texture" },
        policy: { strictness: "strict" }
      },
      artifactLabel: "wave28-part-texture-layer"
    });
    const viewerResult = evaluateViewerRuntimeSnapshot(finalGraph, {
      baselineFrameIndex: 10,
      frameIndex: 11,
      operationId: "op_wave28_viewer_contract_evidence",
      strictness: "strict",
      targetIds: ["draw_body", "draw_eye", "part_face"]
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
  schemaVersion: "wave28-part-texture-layer-runtime-viewer-evidence-summary-v1",
  runtimeEvidence: {
    baselineSnapshotId: runtimeEvidence.baselineSnapshot.snapshotId,
    candidateSnapshotId: runtimeEvidence.candidateSnapshot.snapshotId,
    generatedRuntimeSnapshotIds: runtimeEvidence.generatedRuntimeSnapshotIds,
    generatedRuntimeStateRefs: runtimeEvidence.generatedRuntimeStateRefs,
    generatedRuntimeStateSequenceRefs: runtimeEvidence.generatedRuntimeStateSequenceRefs,
    candidateParts: summarizeParts(runtimeEvidence.candidateSnapshot),
    candidateDrawableLayers: summarizeDrawableLayers(runtimeEvidence.candidateSnapshot),
    drawList: runtimeEvidence.candidateSnapshot.drawList,
    runtimeDiff: summarizeRuntimeDiff(runtimeEvidence.runtimeDiff)
  },
  viewerEvidence: {
    surface: viewerResult.evidence.surface,
    baselineSnapshotId: viewerResult.evidence.baselineSnapshotId,
    snapshotId: viewerResult.evidence.snapshotId,
    finalRuntimeStateRef: viewerResult.evidence.finalRuntimeStateRef,
    targetIds: viewerResult.evidence.targetIds,
    partHierarchyEvidence: viewerResult.evidence.partHierarchyEvidence,
    drawableLayerEvidence: viewerResult.evidence.drawableLayerEvidence,
    runtimeDiffEquivalent: viewerResult.evidence.runtimeDiffEquivalent,
    runtimeEvaluationContext: viewerResult.evidence.runtimeEvaluationContext
  },
  semanticBoundary: {
    pixelOracle: false,
    rendererOracle: false,
    editorOnlyStateInRuntimeCore: false
  }
});

const summarizeParts = (snapshot: RuntimeSnapshotDto) =>
  snapshot.parts?.map((part) => ({
    partId: part.partId,
    displayName: part.displayName,
    parentPartId: part.parentPartId ?? null,
    childPartIds: part.childPartIds,
    drawableIds: part.drawableIds,
    hierarchyPath: part.hierarchyPath,
    depth: part.depth,
    drawableCount: part.drawableCount,
    runtimeVisibleDrawableCount: part.runtimeVisibleDrawableCount
  })) ?? [];

const summarizeDrawableLayers = (snapshot: RuntimeSnapshotDto) =>
  snapshot.drawables.map((drawable) => ({
    drawableId: drawable.drawableId,
    partId: drawable.partId ?? null,
    runtimeVisible: drawable.visible,
    textureStatus: drawable.texture?.status ?? "missing",
    textureId: drawable.texture?.textureId ?? null,
    sourceLayerId: drawable.texture?.sourceLayerId ?? null
  }));

const summarizeRuntimeDiff = (runtimeDiff: RuntimeDiffDto) => ({
  schemaVersion: runtimeDiff.schemaVersion,
  beforeSnapshotId: runtimeDiff.beforeSnapshotId,
  afterSnapshotId: runtimeDiff.afterSnapshotId,
  parameterChangePaths: runtimeDiff.parameterChanges.map((change) => change.path),
  drawableChangeCount: runtimeDiff.drawableChanges.length,
  drawableRuntimeStateChangeCount: runtimeDiff.drawableRuntimeStateChanges.length,
  diagnosticDeltaCount: runtimeDiff.diagnosticDelta.length
});

const createRuntimeGraphFromFixture = (fixture: RuntimeGraphFixture): NormalizedRuntimeGraph => ({
  packageId: PackageIdSchema.parse(fixture.packageId),
  packageRevision: fixture.packageRevision,
  ...(fixture.packageHash === undefined ? {} : { packageHash: fixture.packageHash }),
  coordinateSystem: fixture.coordinateSystem,
  parameters: new Map(),
  parts: new Map(fixture.parts.map((part) => [PartIdSchema.parse(part.partId), createPart(part)])),
  dynamicsGroups: new Map(),
  drawables: new Map(fixture.drawables.map((drawable) => createDrawableEntry(drawable))),
  rigControls: new Map(),
  keyformBindings: [],
  masks: [],
  drawOrder: fixture.drawOrder.map((entry) => ({
    drawableId: DrawableIdSchema.parse(entry.drawableId),
    drawOrder: entry.drawOrder
  })),
  disabledFutureLayers: []
});

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
      ...(drawable.partId === undefined ? {} : { partId: PartIdSchema.parse(drawable.partId) }),
      ...(drawable.texture === undefined
        ? {}
        : {
            texture: {
              ...drawable.texture,
              ...(drawable.texture.textureId === undefined ? {} : { textureId: TextureIdSchema.parse(drawable.texture.textureId) }),
              ...(drawable.texture.sourceAssetId === undefined ? {} : { sourceAssetId: SourceAssetIdSchema.parse(drawable.texture.sourceAssetId) })
            }
          })
    }
  ];
};

const loadFixtureJson = (relativePath: string): any =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/wave28-part-texture-layer-contract-fixtures"
);
