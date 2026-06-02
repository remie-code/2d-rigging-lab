import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createInitialRuntimeState } from "./initial-state.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import { RuntimeEvaluationOptionsSchema } from "./runtime-options.js";
import { evaluateRuntimeFrame } from "./runtime-core.js";
import { compareRuntimeSnapshots } from "./snapshot-comparison.js";
import { evaluateViewerRuntimeSnapshot } from "./viewer-evaluation.js";

describe("runtime layer tree evidence", () => {
  it("projects part hierarchy and drawable membership into runtime and viewer evidence", () => {
    const fixture = createLayerTreeFixture();
    const snapshot = evaluateSnapshot(fixture.graph, 0);
    const viewerResult = evaluateViewerRuntimeSnapshot(fixture.graph);

    expect(snapshot.parts).toEqual([
      {
        partId: fixture.rootPartId,
        displayName: "Root",
        childPartIds: [fixture.headPartId],
        drawableIds: [fixture.bodyDrawableId],
        hierarchyPath: [fixture.rootPartId],
        depth: 0,
        drawableCount: 1,
        runtimeVisibleDrawableCount: 1
      },
      {
        partId: fixture.headPartId,
        displayName: "Head",
        parentPartId: fixture.rootPartId,
        childPartIds: [],
        drawableIds: [fixture.faceDrawableId],
        hierarchyPath: [fixture.rootPartId, fixture.headPartId],
        depth: 1,
        drawableCount: 1,
        runtimeVisibleDrawableCount: 0
      }
    ]);
    expect(snapshot.drawables.map((drawable) => ({
      drawableId: drawable.drawableId,
      partId: drawable.partId,
      visible: drawable.visible,
      textureId: drawable.texture?.textureId,
      textureStatus: drawable.texture?.status
    }))).toEqual([
      {
        drawableId: fixture.bodyDrawableId,
        partId: fixture.rootPartId,
        visible: true,
        textureId: fixture.bodyTextureId,
        textureStatus: "resolved"
      },
      {
        drawableId: fixture.faceDrawableId,
        partId: fixture.headPartId,
        visible: false,
        textureId: fixture.faceTextureId,
        textureStatus: "not_materialized"
      }
    ]);
    expect(viewerResult.evidence.partHierarchyEvidence).toEqual(snapshot.parts);
    expect(viewerResult.evidence.drawableLayerEvidence).toEqual([
      {
        drawableId: fixture.bodyDrawableId,
        partId: fixture.rootPartId,
        runtimeVisible: true,
        textureStatus: "resolved",
        textureId: fixture.bodyTextureId
      },
      {
        drawableId: fixture.faceDrawableId,
        partId: fixture.headPartId,
        runtimeVisible: false,
        textureStatus: "not_materialized",
        textureId: fixture.faceTextureId
      }
    ]);
  });

  it("emits stable runtime diff paths for part membership and texture assignment changes", () => {
    const fixture = createLayerTreeFixture();
    const beforeSnapshot = evaluateSnapshot(createLayerTreeFixture({ beforeReassignment: true }).graph, 0);
    const afterSnapshot = evaluateSnapshot(fixture.graph, 1);

    const comparison = compareRuntimeSnapshots(beforeSnapshot, afterSnapshot);

    expect(comparison.diff.parameterChanges).toEqual([
      {
        path: `/parts/${fixture.headPartId}`,
        before: null,
        after: {
          partId: fixture.headPartId,
          displayName: "Head",
          parentPartId: fixture.rootPartId,
          childPartIds: [],
          drawableIds: [fixture.faceDrawableId],
          hierarchyPath: [fixture.rootPartId, fixture.headPartId]
        }
      },
      {
        path: `/parts/${fixture.rootPartId}/childPartIds`,
        before: [],
        after: [fixture.headPartId]
      },
      {
        path: `/parts/${fixture.rootPartId}/drawableIds`,
        before: [fixture.bodyDrawableId, fixture.faceDrawableId],
        after: [fixture.bodyDrawableId]
      },
      {
        path: `/drawables/${fixture.faceDrawableId}/partId`,
        before: fixture.rootPartId,
        after: fixture.headPartId
      },
      {
        path: `/drawables/${fixture.faceDrawableId}/texture/textureId`,
        before: fixture.bodyTextureId,
        after: fixture.faceTextureId
      }
    ]);
    expect(comparison.diff.drawableChanges).toEqual([]);
    expect(comparison.diff.drawableRuntimeStateChanges).toEqual([]);
  });

  it("emits runtime and viewer evidence for part rename and reparent without drawable membership churn", () => {
    const beforeFixture = createPartTreeMutationFixture({ includeEmptyLeaf: true });
    const afterFixture = createPartTreeMutationFixture({
      headDisplayName: "Face Controls",
      reparentHeadUnderBody: true,
      includeEmptyLeaf: true
    });
    const beforeSnapshot = evaluateSnapshot(beforeFixture.graph, 0);
    const afterSnapshot = evaluateSnapshot(afterFixture.graph, 1);
    const viewerResult = evaluateViewerRuntimeSnapshot(afterFixture.graph);
    const comparison = compareRuntimeSnapshots(beforeSnapshot, afterSnapshot);

    expect(afterSnapshot.parts?.find((part) => part.partId === afterFixture.headPartId)).toMatchObject({
      partId: afterFixture.headPartId,
      displayName: "Face Controls",
      parentPartId: afterFixture.bodyPartId,
      hierarchyPath: [afterFixture.rootPartId, afterFixture.bodyPartId, afterFixture.headPartId],
      drawableIds: [afterFixture.faceDrawableId],
      drawableCount: 1,
      runtimeVisibleDrawableCount: 1
    });
    expect(viewerResult.evidence.partHierarchyEvidence.find((part) => part.partId === afterFixture.headPartId))
      .toMatchObject({
        displayName: "Face Controls",
        parentPartId: afterFixture.bodyPartId,
        hierarchyPath: [afterFixture.rootPartId, afterFixture.bodyPartId, afterFixture.headPartId],
        drawableIds: [afterFixture.faceDrawableId]
      });
    expect(createDrawableMembershipSummary(afterSnapshot)).toEqual(createDrawableMembershipSummary(beforeSnapshot));
    expect(createViewerDrawableMembershipSummary(viewerResult.evidence.drawableLayerEvidence)).toEqual(
      createDrawableMembershipSummary(afterSnapshot)
    );
    expect(comparison.diff.parameterChanges).toEqual([
      {
        path: `/parts/${afterFixture.bodyPartId}/childPartIds`,
        before: [],
        after: [afterFixture.headPartId]
      },
      {
        path: `/parts/${afterFixture.headPartId}/displayName`,
        before: "Head",
        after: "Face Controls"
      },
      {
        path: `/parts/${afterFixture.headPartId}/hierarchyPath`,
        before: [afterFixture.rootPartId, afterFixture.headPartId],
        after: [afterFixture.rootPartId, afterFixture.bodyPartId, afterFixture.headPartId]
      },
      {
        path: `/parts/${afterFixture.headPartId}/parentPartId`,
        before: afterFixture.rootPartId,
        after: afterFixture.bodyPartId
      },
      {
        path: `/parts/${afterFixture.rootPartId}/childPartIds`,
        before: [afterFixture.bodyPartId, afterFixture.headPartId, afterFixture.emptyLeafPartId],
        after: [afterFixture.bodyPartId, afterFixture.emptyLeafPartId]
      }
    ]);
    expect(comparison.diff.parameterChanges.filter((change) => change.path.startsWith("/drawables/"))).toEqual([]);
    expect(comparison.diff.drawableChanges).toEqual([]);
    expect(comparison.diff.drawableRuntimeStateChanges).toEqual([]);
  });

  it("observes deleted empty leaf part absence while keeping drawable membership stable", () => {
    const beforeFixture = createPartTreeMutationFixture({ includeEmptyLeaf: true });
    const afterFixture = createPartTreeMutationFixture({ includeEmptyLeaf: false });
    const beforeSnapshot = evaluateSnapshot(beforeFixture.graph, 0);
    const afterSnapshot = evaluateSnapshot(afterFixture.graph, 1);
    const viewerResult = evaluateViewerRuntimeSnapshot(afterFixture.graph);
    const comparison = compareRuntimeSnapshots(beforeSnapshot, afterSnapshot);

    expect(afterSnapshot.parts?.some((part) => part.partId === afterFixture.emptyLeafPartId)).toBe(false);
    expect(viewerResult.evidence.partHierarchyEvidence.some((part) => part.partId === afterFixture.emptyLeafPartId))
      .toBe(false);
    expect(createDrawableMembershipSummary(afterSnapshot)).toEqual(createDrawableMembershipSummary(beforeSnapshot));
    expect(createViewerDrawableMembershipSummary(viewerResult.evidence.drawableLayerEvidence)).toEqual(
      createDrawableMembershipSummary(afterSnapshot)
    );
    expect(comparison.diff.parameterChanges).toEqual([
      {
        path: `/parts/${afterFixture.emptyLeafPartId}`,
        before: {
          partId: beforeFixture.emptyLeafPartId,
          displayName: "Empty Leaf",
          parentPartId: beforeFixture.rootPartId,
          childPartIds: [],
          drawableIds: [],
          hierarchyPath: [beforeFixture.rootPartId, beforeFixture.emptyLeafPartId]
        },
        after: null
      },
      {
        path: `/parts/${afterFixture.rootPartId}/childPartIds`,
        before: [afterFixture.bodyPartId, afterFixture.headPartId, afterFixture.emptyLeafPartId],
        after: [afterFixture.bodyPartId, afterFixture.headPartId]
      }
    ]);
    expect(comparison.diff.parameterChanges.filter((change) => change.path.startsWith("/drawables/"))).toEqual([]);
    expect(comparison.diff.drawableChanges).toEqual([]);
    expect(comparison.diff.drawableRuntimeStateChanges).toEqual([]);
  });
});

const evaluateSnapshot = (
  graph: NormalizedRuntimeGraph,
  frameIndex: number
) => {
  const state = createInitialRuntimeState(graph, {
    packageId: graph.packageId,
    packageRevision: graph.packageRevision,
    packageHash: graph.packageHash,
    resetReasons: ["packageLoad"]
  });

  return evaluateRuntimeFrame(
    graph,
    {
      schemaVersion: "runtime-evaluation-input-v1",
      frameIndex,
      deltaTimeMs: 0
    },
    state,
    RuntimeEvaluationOptionsSchema.parse({
      schemaVersion: "runtime-evaluation-options-v1",
      snapshotDetail: "summary"
    }),
    { source: { surface: "preview" }, policy: { strictness: "interactive" } }
  ).snapshot;
};

const createLayerTreeFixture = (
  options: { readonly beforeReassignment?: boolean } = {}
) => {
  const packageId = PackageIdSchema.parse("pkg_layer_tree_evidence");
  const rootPartId = PartIdSchema.parse("part_root");
  const headPartId = PartIdSchema.parse("part_head");
  const bodyDrawableId = DrawableIdSchema.parse("draw_body");
  const faceDrawableId = DrawableIdSchema.parse("draw_face");
  const bodyMeshId = MeshIdSchema.parse("mesh_body");
  const faceMeshId = MeshIdSchema.parse("mesh_face");
  const bodyTextureId = TextureIdSchema.parse("tex_body");
  const faceTextureId = TextureIdSchema.parse("tex_face");
  const sourceAssetId = SourceAssetIdSchema.parse("src_layer_tree");
  const facePartId = options.beforeReassignment === true ? rootPartId : headPartId;
  const faceTexture = options.beforeReassignment === true ? bodyTextureId : faceTextureId;

  const graph: NormalizedRuntimeGraph = {
    packageId,
    packageRevision: 2,
    packageHash: "sha256:layer-tree-evidence",
    coordinateSystem: "canvas-y-down-v1",
    parameters: new Map(),
    parts: new Map([
      [
        rootPartId,
        {
          partId: rootPartId,
          displayName: "Root",
          childPartIds: options.beforeReassignment === true ? [] : [headPartId],
          drawableIds: options.beforeReassignment === true ? [bodyDrawableId, faceDrawableId] : [bodyDrawableId]
        }
      ],
      ...(options.beforeReassignment === true
        ? []
        : [
            [
              headPartId,
              {
                partId: headPartId,
                displayName: "Head",
                parentPartId: rootPartId,
                childPartIds: [],
                drawableIds: [faceDrawableId]
              }
            ] as const
          ])
    ]),
    dynamicsGroups: new Map(),
    drawables: new Map([
      [
        bodyDrawableId,
        {
          drawableId: bodyDrawableId,
          meshId: bodyMeshId,
          partId: rootPartId,
          texture: {
            status: "resolved",
            textureId: bodyTextureId,
            sourceAssetId,
            sourceLayerId: "layer_body",
            projection: { kind: "bounds_fit" }
          },
          visible: true,
          opacity: 1,
          baseDrawOrder: 0,
          bounds: { x: 0, y: 0, width: 32, height: 48 },
          vertexCount: 4
        }
      ],
      [
        faceDrawableId,
        {
          drawableId: faceDrawableId,
          meshId: faceMeshId,
          partId: facePartId,
          texture: {
            textureId: faceTexture,
            sourceAssetId,
            sourceLayerId: "layer_face",
            projection: { kind: "bounds_fit" }
          },
          visible: false,
          opacity: 1,
          baseDrawOrder: 1,
          bounds: { x: 4, y: 4, width: 16, height: 16 },
          vertexCount: 4
        }
      ]
    ]),
    rigControls: new Map(),
    keyformBindings: [],
    masks: [],
    drawOrder: [
      { drawableId: bodyDrawableId, drawOrder: 0 },
      { drawableId: faceDrawableId, drawOrder: 1 }
    ],
    disabledFutureLayers: []
  };

  return {
    graph,
    rootPartId,
    headPartId,
    bodyDrawableId,
    faceDrawableId,
    bodyTextureId,
    faceTextureId
  };
};

const createPartTreeMutationFixture = (
  options: {
    readonly headDisplayName?: string;
    readonly reparentHeadUnderBody?: boolean;
    readonly includeEmptyLeaf?: boolean;
  } = {}
) => {
  const packageId = PackageIdSchema.parse("pkg_layer_tree_mutation_evidence");
  const rootPartId = PartIdSchema.parse("part_root");
  const bodyPartId = PartIdSchema.parse("part_body");
  const headPartId = PartIdSchema.parse("part_head");
  const emptyLeafPartId = PartIdSchema.parse("part_empty_leaf");
  const bodyDrawableId = DrawableIdSchema.parse("draw_body");
  const faceDrawableId = DrawableIdSchema.parse("draw_face");
  const bodyMeshId = MeshIdSchema.parse("mesh_body");
  const faceMeshId = MeshIdSchema.parse("mesh_face");
  const bodyTextureId = TextureIdSchema.parse("tex_body");
  const faceTextureId = TextureIdSchema.parse("tex_face");
  const sourceAssetId = SourceAssetIdSchema.parse("src_layer_tree_mutation");
  const includeEmptyLeaf = options.includeEmptyLeaf ?? true;
  const reparentHeadUnderBody = options.reparentHeadUnderBody ?? false;

  const graph: NormalizedRuntimeGraph = {
    packageId,
    packageRevision: 3,
    packageHash: "sha256:layer-tree-mutation-evidence",
    coordinateSystem: "canvas-y-down-v1",
    parameters: new Map(),
    parts: new Map([
      [
        rootPartId,
        {
          partId: rootPartId,
          displayName: "Root",
          childPartIds: [
            bodyPartId,
            ...(reparentHeadUnderBody ? [] : [headPartId]),
            ...(includeEmptyLeaf ? [emptyLeafPartId] : [])
          ],
          drawableIds: []
        }
      ],
      [
        bodyPartId,
        {
          partId: bodyPartId,
          displayName: "Body",
          parentPartId: rootPartId,
          childPartIds: reparentHeadUnderBody ? [headPartId] : [],
          drawableIds: [bodyDrawableId]
        }
      ],
      [
        headPartId,
        {
          partId: headPartId,
          displayName: options.headDisplayName ?? "Head",
          parentPartId: reparentHeadUnderBody ? bodyPartId : rootPartId,
          childPartIds: [],
          drawableIds: [faceDrawableId]
        }
      ],
      ...(includeEmptyLeaf
        ? [
            [
              emptyLeafPartId,
              {
                partId: emptyLeafPartId,
                displayName: "Empty Leaf",
                parentPartId: rootPartId,
                childPartIds: [],
                drawableIds: []
              }
            ] as const
          ]
        : [])
    ]),
    dynamicsGroups: new Map(),
    drawables: new Map([
      [
        bodyDrawableId,
        {
          drawableId: bodyDrawableId,
          meshId: bodyMeshId,
          partId: bodyPartId,
          texture: {
            status: "resolved",
            textureId: bodyTextureId,
            sourceAssetId,
            sourceLayerId: "layer_body",
            projection: { kind: "bounds_fit" }
          },
          visible: true,
          opacity: 1,
          baseDrawOrder: 0,
          bounds: { x: 0, y: 0, width: 32, height: 48 },
          vertexCount: 4
        }
      ],
      [
        faceDrawableId,
        {
          drawableId: faceDrawableId,
          meshId: faceMeshId,
          partId: headPartId,
          texture: {
            status: "resolved",
            textureId: faceTextureId,
            sourceAssetId,
            sourceLayerId: "layer_face",
            projection: { kind: "bounds_fit" }
          },
          visible: true,
          opacity: 1,
          baseDrawOrder: 1,
          bounds: { x: 4, y: 4, width: 16, height: 16 },
          vertexCount: 4
        }
      ]
    ]),
    rigControls: new Map(),
    keyformBindings: [],
    masks: [],
    drawOrder: [
      { drawableId: bodyDrawableId, drawOrder: 0 },
      { drawableId: faceDrawableId, drawOrder: 1 }
    ],
    disabledFutureLayers: []
  };

  return {
    graph,
    rootPartId,
    bodyPartId,
    headPartId,
    emptyLeafPartId,
    bodyDrawableId,
    faceDrawableId
  };
};

const createDrawableMembershipSummary = (
  snapshot: ReturnType<typeof evaluateSnapshot>
): readonly { readonly drawableId: string; readonly partId: string | null }[] =>
  snapshot.drawables
    .map((drawable) => ({
      drawableId: drawable.drawableId,
      partId: drawable.partId ?? null
    }))
    .sort((left, right) => left.drawableId.localeCompare(right.drawableId));

const createViewerDrawableMembershipSummary = (
  evidence: ReturnType<typeof evaluateViewerRuntimeSnapshot>["evidence"]["drawableLayerEvidence"]
): readonly { readonly drawableId: string; readonly partId: string | null }[] =>
  evidence
    .map((drawable) => ({
      drawableId: drawable.drawableId,
      partId: drawable.partId ?? null
    }))
    .sort((left, right) => left.drawableId.localeCompare(right.drawableId));
