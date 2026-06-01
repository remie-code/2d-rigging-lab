import {
  DrawableIdSchema,
  MaskRelationIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  RuntimeSnapshotIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import type { RuntimeSnapshotDto } from "./snapshot.js";
import { compareRuntimeSnapshots } from "./snapshot-comparison.js";

describe("runtime snapshot comparison", () => {
  it("observes drawable opacity visibility and draw order changes", () => {
    const before = createSnapshot({
      snapshotId: "snap_compare_before",
      opacity: 1,
      visible: true,
      baseDrawOrder: 0,
      evaluatedDrawOrder: 0,
      drawList: ["draw_body"]
    });
    const after = createSnapshot({
      snapshotId: "snap_compare_after",
      opacity: 0.5,
      visible: false,
      baseDrawOrder: 2,
      evaluatedDrawOrder: 2,
      drawList: []
    });

    const result = compareRuntimeSnapshots(before, after);

    expect(result.equivalent).toBe(false);
    expect(result.diff.drawableChanges).toEqual([
      {
        drawableId: "draw_body",
        boundsChanged: false,
        vertexHashBefore: "hash_same",
        vertexHashAfter: "hash_same"
      }
    ]);
    expect(result.diff.drawableRuntimeStateChanges).toEqual([
      {
        drawableId: "draw_body",
        opacityBefore: 1,
        opacityAfter: 0.5,
        visibleBefore: true,
        visibleAfter: false,
        baseDrawOrderBefore: 0,
        baseDrawOrderAfter: 2,
        evaluatedDrawOrderBefore: 0,
        evaluatedDrawOrderAfter: 2
      }
    ]);
    expect(result.diff.drawListChanges).toEqual([
      {
        before: ["draw_body"],
        after: [],
        membershipChanged: true,
        orderChanged: false,
        positionChanges: [
          {
            drawableId: "draw_body",
            beforeIndex: 0
          }
        ]
      }
    ]);
    expect(result.diff.parameterChanges).toContainEqual({
      path: "/drawList",
      before: ["draw_body"],
      after: []
    });
  });

  it("observes draw list order changes through a dedicated field", () => {
    const before = createSnapshot({
      snapshotId: "snap_compare_order_before",
      opacity: 1,
      visible: true,
      baseDrawOrder: 0,
      evaluatedDrawOrder: 0,
      drawList: ["draw_body", "draw_head"]
    });
    const after = createSnapshot({
      snapshotId: "snap_compare_order_after",
      opacity: 1,
      visible: true,
      baseDrawOrder: 0,
      evaluatedDrawOrder: 0,
      drawList: ["draw_head", "draw_body"]
    });

    const result = compareRuntimeSnapshots(before, after);

    expect(result.equivalent).toBe(false);
    expect(result.diff.drawableRuntimeStateChanges).toEqual([]);
    expect(result.diff.drawListChanges).toEqual([
      {
        before: ["draw_body", "draw_head"],
        after: ["draw_head", "draw_body"],
        membershipChanged: false,
        orderChanged: true,
        positionChanges: [
          {
            drawableId: "draw_body",
            beforeIndex: 0,
            afterIndex: 1
          },
          {
            drawableId: "draw_head",
            beforeIndex: 1,
            afterIndex: 0
          }
        ]
      }
    ]);
    expect(result.diff.parameterChanges).toContainEqual({
      path: "/drawList",
      before: ["draw_body", "draw_head"],
      after: ["draw_head", "draw_body"]
    });
  });

  it("observes added drawables and draw list membership through dedicated fields", () => {
    const before = createSnapshot({
      snapshotId: "snap_compare_added_before",
      opacity: 1,
      visible: true,
      baseDrawOrder: 0,
      evaluatedDrawOrder: 0,
      drawList: ["draw_body"]
    });
    const after = {
      ...createSnapshot({
        snapshotId: "snap_compare_added_after",
        opacity: 1,
        visible: true,
        baseDrawOrder: 0,
        evaluatedDrawOrder: 0,
        drawList: ["draw_body", "draw_runtime_oracle"]
      }),
      drawables: [
        ...before.drawables,
        {
          drawableId: DrawableIdSchema.parse("draw_runtime_oracle"),
          meshId: MeshIdSchema.parse("mesh_runtime_oracle"),
          visible: true,
          opacity: 1,
          baseDrawOrder: 1,
          evaluatedDrawOrder: 1,
          bounds: {
            x: 8,
            y: 8,
            width: 24,
            height: 24
          },
          vertexCount: 0,
          vertexHash: "hash_draw_runtime_oracle_0",
          diagnostics: []
        }
      ]
    } satisfies RuntimeSnapshotDto;

    const result = compareRuntimeSnapshots(before, after);

    expect(result.equivalent).toBe(false);
    expect(result.diff.drawableChanges).toEqual([
      {
        drawableId: "draw_runtime_oracle",
        boundsChanged: false,
        vertexHashAfter: "hash_draw_runtime_oracle_0"
      }
    ]);
    expect(result.diff.drawListChanges).toEqual([
      {
        before: ["draw_body"],
        after: ["draw_body", "draw_runtime_oracle"],
        membershipChanged: true,
        orderChanged: false,
        positionChanges: [
          {
            drawableId: "draw_runtime_oracle",
            afterIndex: 1
          }
        ]
      }
    ]);
  });

  it("observes semantic mask relation changes through stable field paths", () => {
    const before = createSnapshot({
      snapshotId: "snap_compare_mask_before",
      opacity: 1,
      visible: true,
      baseDrawOrder: 0,
      evaluatedDrawOrder: 0,
      drawList: ["draw_body"],
      masks: [
        {
          maskRelationId: MaskRelationIdSchema.parse("maskrel_bodyClip"),
          sourceDrawableIds: [DrawableIdSchema.parse("draw_maskA")],
          targetDrawableIds: [DrawableIdSchema.parse("draw_body")],
          enabled: true,
          clippingIntent: "semanticClipping",
          resolved: true
        },
        {
          maskRelationId: MaskRelationIdSchema.parse("maskrel_removedClip"),
          sourceDrawableIds: [DrawableIdSchema.parse("draw_removedMask")],
          targetDrawableIds: [DrawableIdSchema.parse("draw_body")],
          enabled: true,
          clippingIntent: "semanticClipping",
          resolved: true
        }
      ]
    });
    const after = createSnapshot({
      snapshotId: "snap_compare_mask_after",
      opacity: 1,
      visible: true,
      baseDrawOrder: 0,
      evaluatedDrawOrder: 0,
      drawList: ["draw_body"],
      masks: [
        {
          maskRelationId: MaskRelationIdSchema.parse("maskrel_addedClip"),
          sourceDrawableIds: [DrawableIdSchema.parse("draw_maskAdded")],
          targetDrawableIds: [DrawableIdSchema.parse("draw_body")],
          enabled: true,
          clippingIntent: "semanticClipping",
          resolved: true
        },
        {
          maskRelationId: MaskRelationIdSchema.parse("maskrel_bodyClip"),
          sourceDrawableIds: [DrawableIdSchema.parse("draw_maskB")],
          targetDrawableIds: [DrawableIdSchema.parse("draw_body"), DrawableIdSchema.parse("draw_shadow")],
          enabled: true,
          clippingIntent: "semanticClipping",
          resolved: false
        }
      ]
    });

    const result = compareRuntimeSnapshots(before, after);

    expect(result.equivalent).toBe(false);
    expect(result.diff.parameterChanges).toEqual([
      {
        path: "/masks/maskrel_addedClip",
        before: null,
        after: {
          maskRelationId: "maskrel_addedClip",
          sourceDrawableIds: ["draw_maskAdded"],
          targetDrawableIds: ["draw_body"],
          enabled: true,
          clippingIntent: "semanticClipping",
          resolved: true
        }
      },
      {
        path: "/masks/maskrel_bodyClip/sourceDrawableIds",
        before: ["draw_maskA"],
        after: ["draw_maskB"]
      },
      {
        path: "/masks/maskrel_bodyClip/targetDrawableIds",
        before: ["draw_body"],
        after: ["draw_body", "draw_shadow"]
      },
      {
        path: "/masks/maskrel_bodyClip/resolved",
        before: true,
        after: false
      },
      {
        path: "/masks/maskrel_removedClip",
        before: {
          maskRelationId: "maskrel_removedClip",
          sourceDrawableIds: ["draw_removedMask"],
          targetDrawableIds: ["draw_body"],
          enabled: true,
          clippingIntent: "semanticClipping",
          resolved: true
        },
        after: null
      }
    ]);
  });
});

const createSnapshot = (input: {
  readonly snapshotId: string;
  readonly opacity: number;
  readonly visible: boolean;
  readonly baseDrawOrder: number;
  readonly evaluatedDrawOrder: number;
  readonly drawList: readonly string[];
  readonly masks?: RuntimeSnapshotDto["masks"];
}): RuntimeSnapshotDto => ({
  schemaVersion: "runtime-snapshot-v1",
  runtimeCoreVersion: "test",
  snapshotId: RuntimeSnapshotIdSchema.parse(input.snapshotId),
  context: {
    source: {
      surface: "preview"
    },
    policy: {
      strictness: "interactive"
    }
  },
  packageId: PackageIdSchema.parse("pkg_compare"),
  packageRevision: 0,
  dirty: false,
  evaluation: {
    snapshotDetail: "summary",
    evaluatorVersions: {
      dynamics: "scalarDampedFollowV1",
      keyform1d: "linear-1d-v1",
      keyformGrid2d: "parameter-grid-2d-v1",
      warpLattice: "bilinear-grid-v1",
      rigControlHierarchy: "parent-before-child-v1"
    }
  },
  parameters: [],
  dynamics: [],
  keyformSamples: [],
  rigControls: [],
  drawables: [
    {
      drawableId: DrawableIdSchema.parse("draw_body"),
      meshId: MeshIdSchema.parse("mesh_body"),
      visible: input.visible,
      opacity: input.opacity,
      baseDrawOrder: input.baseDrawOrder,
      evaluatedDrawOrder: input.evaluatedDrawOrder,
      bounds: {
        x: 0,
        y: 0,
        width: 10,
        height: 10
      },
      vertexCount: 4,
      vertexHash: "hash_same",
      diagnostics: []
    }
  ],
  masks: input.masks ?? [],
  drawList: input.drawList.map((drawableId) => DrawableIdSchema.parse(drawableId)),
  disabledFutureLayers: [],
  diagnostics: []
});
