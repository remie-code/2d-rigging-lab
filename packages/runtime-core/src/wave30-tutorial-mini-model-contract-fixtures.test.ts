import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createTutorialMiniModelSeed,
  toRuntimeGraph,
  TUTORIAL_MINI_MODEL_IDS
} from "../../authoring-core/src/index.js";
import {
  createOperationCore,
  createTutorialMiniModelOperationRequests,
  TUTORIAL_MINI_MODEL_RECIPE_TIMESTAMP
} from "../../operation-core/src/index.js";
import { describe, expect, it } from "vitest";

import type {
  NormalizedDrawable,
  NormalizedPart,
  NormalizedRuntimeGraph,
  TutorialRuntimeViewerEvidenceSummaryDto
} from "./index.js";
import { buildRuntimeEvidence } from "./runtime-evidence.js";
import { defaultRuntimeEvaluationOptions } from "./runtime-options.js";
import { createTutorialRuntimeViewerEvidenceSummary } from "./tutorial-evidence-summary.js";
import { evaluateViewerRuntimeSnapshot } from "./viewer-evaluation.js";

describe("wave30 tutorial mini model runtime/viewer contract fixture", () => {
  it("pins semantic runtime and viewer tutorial evidence without renderer or pixel oracle claims", () => {
    const { beforeMeshEditGraph, finalGraph } = createTutorialRuntimeGraphsFromRecipe();
    const runtimeEvidence = buildRuntimeEvidence({
      baselineGraph: beforeMeshEditGraph,
      candidateGraph: finalGraph,
      baseline: {
        frame: {
          frameIndex: 30,
          authoredParameterValues: {},
          targetIds: [...tutorialRuntimeTargetIds]
        }
      },
      candidate: {
        frame: {
          frameIndex: 31,
          authoredParameterValues: {},
          targetIds: [...tutorialRuntimeTargetIds]
        }
      },
      options: {
        ...defaultRuntimeEvaluationOptions(),
        snapshotDetail: "full"
      },
      context: {
        source: {
          surface: "validator",
          operationId: "op_wave30_tutorial_mini_model_contract_runtime"
        },
        policy: {
          strictness: "strict"
        }
      },
      artifactLabel: "wave30-tutorial-mini-model-contract"
    });
    const viewerResult = evaluateViewerRuntimeSnapshot(finalGraph, {
      baselineFrameIndex: 40,
      frameIndex: 41,
      operationId: "op_wave30_tutorial_mini_model_contract_viewer",
      strictness: "strict",
      targetIds: [...tutorialRuntimeTargetIds],
      options: {
        ...defaultRuntimeEvaluationOptions(),
        snapshotDetail: "full"
      }
    });
    const summary = createTutorialRuntimeViewerEvidenceSummary({ runtimeEvidence, viewerResult });

    expect(summarizeRuntimeViewerEvidence(summary)).toEqual(
      loadFixtureJson("expected/runtime-viewer-evidence-summary.json")
    );
  });
});

const createTutorialRuntimeGraphsFromRecipe = (): {
  readonly beforeMeshEditGraph: NormalizedRuntimeGraph;
  readonly finalGraph: NormalizedRuntimeGraph;
} => {
  const seed = createTutorialMiniModelSeed();
  const core = createOperationCore({
    now: () => new Date(TUTORIAL_MINI_MODEL_RECIPE_TIMESTAMP)
  });
  let beforeMeshEditGraph: NormalizedRuntimeGraph | undefined;

  for (const request of createTutorialMiniModelOperationRequests()) {
    if (request.operationId === "op_tutorial_move_front_hair_mesh_vertices") {
      beforeMeshEditGraph = withRuntimePartEvidence(toRuntimeGraph(seed.session, {
        packageHash: "sha256:tutorial-mini-model-before-mesh-edit-v1"
      }), seed.session.graph.parts, seed.session.graph.drawables);
    }

    const outcome = core.commitOperation(seed.session, request);
    if (outcome.result.status !== "committed") {
      throw new Error(`Expected ${request.operationId} to commit.`);
    }
  }

  if (beforeMeshEditGraph === undefined) {
    throw new Error("Expected tutorial recipe to include the front hair mesh edit operation.");
  }

  return {
    beforeMeshEditGraph,
    finalGraph: withRuntimePartEvidence(toRuntimeGraph(seed.session, {
      packageHash: "sha256:tutorial-mini-model-final-v1"
    }), seed.session.graph.parts, seed.session.graph.drawables)
  };
};

const withRuntimePartEvidence = (
  graph: NormalizedRuntimeGraph,
  parts: readonly RuntimePartInput[],
  drawables: readonly RuntimeDrawableMembershipInput[]
): NormalizedRuntimeGraph => ({
  ...graph,
  parts: new Map(parts.map((part) => [part.partId, toNormalizedPart(part)])),
  drawables: withRuntimeDrawablePartIds(graph, drawables)
});

type RuntimePartInput = Omit<NormalizedPart, "parentPartId"> & {
  readonly parentPartId?: NormalizedPart["parentPartId"] | undefined;
};

const toNormalizedPart = (part: RuntimePartInput): NormalizedPart => ({
  partId: part.partId,
  displayName: part.displayName,
  ...(part.parentPartId === undefined ? {} : { parentPartId: part.parentPartId }),
  childPartIds: [...part.childPartIds],
  drawableIds: [...part.drawableIds]
});

type RuntimeDrawableMembershipInput = {
  readonly drawableId: NormalizedDrawable["drawableId"];
  readonly partId: NonNullable<NormalizedDrawable["partId"]>;
};

const withRuntimeDrawablePartIds = (
  graph: NormalizedRuntimeGraph,
  drawables: readonly RuntimeDrawableMembershipInput[]
): NormalizedRuntimeGraph["drawables"] => {
  const partIdsByDrawableId = new Map(drawables.map((drawable) => [drawable.drawableId, drawable.partId]));

  return new Map([...graph.drawables].map(([drawableId, drawable]) => {
    const partId = partIdsByDrawableId.get(drawableId);

    return [
      drawableId,
      partId === undefined
        ? drawable
        : {
            ...drawable,
            partId
          }
    ];
  }));
};

const summarizeRuntimeViewerEvidence = (summary: TutorialRuntimeViewerEvidenceSummaryDto) => {
  const runtimeSliceStatus = createSlicePresenceMap(summary.runtimeSummary.semanticReadiness.sliceStatus);
  const frontHairMeshEdit = summary.runtimeSummary.meshEdits.refs.find(
    (meshEdit) => meshEdit.meshId === TUTORIAL_MINI_MODEL_IDS.meshes.frontHair
  );

  return {
    schemaVersion: "wave30-tutorial-mini-model-runtime-viewer-evidence-summary-v1",
    packageRef: summary.packageRef,
    semanticReadiness: {
      status: summary.semanticReadiness.status,
      ready: summary.semanticReadiness.ready,
      missingSlices: summary.semanticReadiness.missingSlices,
      presentSlices: summary.semanticReadiness.presentSlices
    },
    runtimeEvidence: {
      baselineSnapshotId: summary.runtimeSummary.evidenceRefs.baselineSnapshotId,
      candidateSnapshotId: summary.runtimeSummary.evidenceRefs.candidateSnapshotId,
      generatedRuntimeSnapshotIds: summary.runtimeSummary.evidenceRefs.generatedRuntimeSnapshotIds,
      finalRuntimeStateRef: summary.runtimeSummary.evidenceRefs.finalRuntimeStateRef,
      finalRuntimeStateSequenceRef:
        summary.runtimeSummary.evidenceRefs.generatedRuntimeStateSequenceRefs[0],
      requiredSliceEvidencePresent: runtimeSliceStatus,
      counts: {
        parts: summary.runtimeSummary.parts.count,
        layers: summary.runtimeSummary.layers.count,
        drawables: summary.runtimeSummary.drawables.count,
        meshes: summary.runtimeSummary.meshes.count,
        maskRelations: summary.runtimeSummary.maskOpacity.maskRelationCount,
        rigControls: summary.runtimeSummary.rigControls.count,
        rigControlKeyforms: summary.runtimeSummary.rigControlKeyforms.count,
        dynamicsGroups: summary.runtimeSummary.dynamics.count
      },
      frontHairMeshEditPresent: frontHairMeshEdit !== undefined,
      authoredMovedVertexRefsPreservedThroughRuntimeKeyform: [
        "mesh_tutorial_front_hair.vtx_tutorial_front_hair_0_1",
        "mesh_tutorial_front_hair.vtx_tutorial_front_hair_0_2"
      ].every((vertexRef) => frontHairMeshEdit?.movedVertexRefs.includes(vertexRef) === true)
    },
    viewerEvidence: {
      baselineSnapshotId: summary.viewerSummary.evidenceRefs.baselineSnapshotId,
      snapshotId: summary.viewerSummary.evidenceRefs.candidateSnapshotId,
      finalRuntimeStateRef: summary.viewerSummary.evidenceRefs.finalRuntimeStateRef,
      surface: summary.viewerSummary.source,
      runtimeDiffEquivalent:
        summary.viewerSummary.evidenceRefs.runtimeDiff?.diagnosticDeltaCount === 0 &&
        summary.viewerSummary.evidenceRefs.runtimeDiff?.drawableGeometryChangeCount === 0 &&
        summary.viewerSummary.evidenceRefs.runtimeDiff?.drawableRuntimeStateChangeCount === 0,
      targetIds: tutorialRuntimeTargetIds,
      tutorialSummaryStatus: summary.viewerSummary.semanticReadiness.status,
      tutorialSummaryMissingSlices: summary.viewerSummary.semanticReadiness.missingSlices
    },
    renderedCorrectness: summary.renderedCorrectness
  };
};

const createSlicePresenceMap = (
  sliceStatus: TutorialRuntimeViewerEvidenceSummaryDto["semanticReadiness"]["sliceStatus"]
) =>
  Object.fromEntries(sliceStatus.map((slice) => [slice.sliceId, slice.present]));

const tutorialRuntimeTargetIds = [
  TUTORIAL_MINI_MODEL_IDS.drawables.body,
  TUTORIAL_MINI_MODEL_IDS.drawables.head,
  TUTORIAL_MINI_MODEL_IDS.drawables.face,
  TUTORIAL_MINI_MODEL_IDS.drawables.mouth,
  TUTORIAL_MINI_MODEL_IDS.drawables.eyeMask,
  TUTORIAL_MINI_MODEL_IDS.drawables.eye,
  TUTORIAL_MINI_MODEL_IDS.drawables.frontHair,
  TUTORIAL_MINI_MODEL_IDS.drawables.arm,
  TUTORIAL_MINI_MODEL_IDS.rigControls.headRotation,
  TUTORIAL_MINI_MODEL_IDS.dynamicsGroups.hairSway
] as const;

const loadFixtureJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/wave30-tutorial-mini-model-contract-fixtures"
);
