import {
  DrawableIdSchema,
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
    expect(result.diff.parameterChanges).toContainEqual({
      path: "/drawList",
      before: ["draw_body"],
      after: []
    });
  });
});

const createSnapshot = (input: {
  readonly snapshotId: string;
  readonly opacity: number;
  readonly visible: boolean;
  readonly baseDrawOrder: number;
  readonly evaluatedDrawOrder: number;
  readonly drawList: readonly string[];
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
  masks: [],
  drawList: input.drawList.map((drawableId) => DrawableIdSchema.parse(drawableId)),
  disabledFutureLayers: [],
  diagnostics: []
});
