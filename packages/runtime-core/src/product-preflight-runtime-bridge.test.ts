import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import {
  buildRuntimeEvidenceArtifacts,
  createRuntimeEvidenceProductPreflightEvidence,
  createViewerRuntimeProductPreflightEvidence,
  evaluateViewerRuntimeSnapshot
} from "./index.js";

describe("runtime-core product preflight evidence bridge", () => {
  it("bridges runtime evidence artifact refs without renderer or pixel fields", () => {
    const fixture = createRuntimeBridgeFixture();
    const runtimeEvidence = buildRuntimeEvidenceArtifacts({
      baselineGraph: fixture.graph,
      candidateGraph: fixture.graph,
      artifactLabel: "preflight"
    }).evidence;

    const bridge = createRuntimeEvidenceProductPreflightEvidence({
      evidence: runtimeEvidence
    });

    expect(bridge).toMatchObject({
      packageId: "pkg_runtimePreflight",
      packageRevision: 7,
      packageHash: "sha256-runtime-preflight",
      category: "runtimeViewerEvidence"
    });
    expect(bridge.evidenceRefs.map((evidenceRef) => evidenceRef.artifactRef.artifactKind)).toEqual([
      "runtimeSnapshot",
      "runtimeSnapshot",
      "runtimeState",
      "runtimeStateSequence"
    ]);
    expect(bridge.evidenceRefs[0]).toMatchObject({
      artifactRef: {
        artifactKind: "runtimeSnapshot",
        path: "runtime/snapshots/snap_runtimePreflight_0.runtime-snapshot.json",
        snapshotId: "snap_runtimePreflight_0"
      },
      target: {
        kind: "runtimeSnapshot",
        id: "snap_runtimePreflight_0"
      },
      producer: "runtimeCore"
    });
    expect(bridge.evidenceRefs.every((evidenceRef) =>
      !("runtimeDiffEquivalent" in evidenceRef) &&
      !("pixelDiff" in evidenceRef)
    )).toBe(true);
  });

  it("bridges viewer evidence snapshot and runtime-state refs deterministically", () => {
    const fixture = createRuntimeBridgeFixture();
    const viewerResult = evaluateViewerRuntimeSnapshot(fixture.graph, {
      parameterOverrides: {
        [fixture.parameterId]: 1
      },
      targetIds: [fixture.drawableId]
    });

    const first = createViewerRuntimeProductPreflightEvidence({
      evidence: viewerResult.evidence
    });
    const second = createViewerRuntimeProductPreflightEvidence({
      evidence: viewerResult.evidence
    });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      packageId: "pkg_runtimePreflight",
      packageRevision: 7,
      packageHash: "sha256-runtime-preflight",
      category: "runtimeViewerEvidence"
    });
    expect(first.evidenceRefs.map((evidenceRef) => evidenceRef.artifactRef)).toEqual([
      {
        artifactKind: "runtimeSnapshot",
        path: "runtime/snapshots/snap_runtimePreflight_0.runtime-snapshot.json",
        snapshotId: "snap_runtimePreflight_0"
      },
      {
        artifactKind: "runtimeSnapshot",
        path: "runtime/snapshots/snap_runtimePreflight_1.runtime-snapshot.json",
        snapshotId: "snap_runtimePreflight_1"
      },
      {
        artifactKind: "runtimeState",
        path: "runtime/states/pkg_runtimePreflight-r7-viewer-f1.runtime-state.json"
      }
    ]);
    expect(first.evidenceRefs.map((evidenceRef) => evidenceRef.producer)).toEqual([
      "viewer",
      "viewer",
      "viewer"
    ]);
  });
});

const createRuntimeBridgeFixture = () => {
  const packageId = PackageIdSchema.parse("pkg_runtimePreflight");
  const parameterId = ParameterIdSchema.parse("param_runtimePreflight_yaw");
  const drawableId = DrawableIdSchema.parse("draw_runtimePreflight_body");
  const meshId = MeshIdSchema.parse("mesh_runtimePreflight_body");
  const keyformSetId = KeyformSetIdSchema.parse("keyset_runtimePreflight_body");
  const graph: NormalizedRuntimeGraph = {
    packageId,
    packageRevision: 7,
    packageHash: "sha256-runtime-preflight",
    coordinateSystem: "canvas-y-down-v1",
    parameters: new Map([
      [
        parameterId,
        {
          id: parameterId,
          displayName: "Yaw",
          valueSource: "authoredInput",
          min: -1,
          max: 1,
          default: 0
        }
      ]
    ]),
    dynamicsGroups: new Map(),
    drawables: new Map([
      [
        drawableId,
        {
          drawableId,
          meshId,
          visible: true,
          opacity: 1,
          baseDrawOrder: 0,
          bounds: { x: 0, y: 0, width: 16, height: 16 },
          vertexCount: 3
        }
      ]
    ]),
    rigControls: new Map(),
    keyformBindings: [
      {
        evaluator: "linear-1d-v1",
        keyformSetId,
        targetId: meshId,
        targetKind: "mesh",
        targetProperty: "vertices",
        parameterId,
        compositionMode: "replace",
        compositionOrder: 0,
        keys: [
          {
            value: 0,
            statePatch: [
              { x: 0, y: 0 },
              { x: 16, y: 0 },
              { x: 8, y: 16 }
            ]
          },
          {
            value: 1,
            statePatch: [
              { x: 2, y: 0 },
              { x: 18, y: 2 },
              { x: 10, y: 14 }
            ]
          }
        ]
      }
    ],
    masks: [],
    drawOrder: [{ drawableId, drawOrder: 0 }],
    disabledFutureLayers: []
  };

  return {
    graph,
    parameterId,
    drawableId
  };
};
