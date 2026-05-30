import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  RuntimeDiffDtoSchema,
  RuntimeStateDtoSchema,
  RuntimeStateSequenceArtifactSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createStableVertexHash } from "./drawable-geometry.js";
import { createInitialRuntimeState } from "./initial-state.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import {
  buildRuntimeEvidenceArtifacts
} from "./runtime-evidence-artifacts.js";
import {
  createDefaultRuntimeEvidenceContext,
  createDefaultRuntimeEvidenceOptions
} from "./runtime-evidence-defaults.js";
import {
  createRuntimeSnapshotArtifactPath
} from "./runtime-snapshot-artifacts.js";
import {
  evaluateRuntimeStateSequenceArtifact,
  materializeRuntimeStateSequenceArtifact
} from "./runtime-state-sequence-artifacts.js";
import { RuntimeSnapshotSchema } from "./snapshot.js";

describe("runtime evidence artifact materializers", () => {
  it("materializes snapshot artifacts and final state artifact with paths matching generated refs", () => {
    const packageId = PackageIdSchema.parse("pkg_artifacts");
    const parameterId = ParameterIdSchema.parse("param_yaw");
    const drawableId = DrawableIdSchema.parse("draw_body");
    const graph = createGraph(packageId, parameterId, drawableId);
    const result = buildRuntimeEvidenceArtifacts({
      baselineGraph: graph,
      candidateGraph: graph,
      candidate: {
        frame: {
          authoredParameterValues: {
            [parameterId]: 1
          },
          targetIds: [drawableId]
        }
      },
      artifactLabel: "operation-dry-run"
    });

    const artifactPaths = result.artifacts.map((artifact) => artifact.path);
    expect(artifactPaths.filter((path) => path.startsWith("runtime/snapshots/"))).toEqual(
      result.evidence.generatedRuntimeSnapshotIds.map(createRuntimeSnapshotArtifactPath)
    );
    expect(artifactPaths).toContain(result.evidence.finalRuntimeStateRef);
    expect(artifactPaths).toContain(result.evidence.generatedRuntimeStateSequenceRefs[0]);

    const finalStateArtifact = result.artifacts.find((artifact) => artifact.kind === "runtimeState");
    expect(finalStateArtifact?.path).toBe(result.evidence.finalRuntimeStateRef);
    expect(RuntimeStateDtoSchema.parse(JSON.parse(finalStateArtifact?.content ?? "{}"))).toEqual(
      result.evidence.finalRuntimeState
    );

    const sequenceArtifact = result.artifacts.find((artifact) => artifact.kind === "runtimeStateSequence");
    expect(sequenceArtifact?.path).toBe(result.evidence.generatedRuntimeStateSequenceRefs[0]);
    expect(RuntimeStateSequenceArtifactSchema.parse(JSON.parse(sequenceArtifact?.content ?? "{}")).states).toEqual([
      expect.objectContaining({ frameIndex: 0 }),
      expect.objectContaining({ frameIndex: 1 })
    ]);
  });

  it("materializes candidate snapshot artifacts with runtime-visible mesh keyform evidence", () => {
    const fixture = createMeshKeyformEvidenceFixture();
    const keyValueFrame = {
      authoredParameterValues: {
        [fixture.parameterId]: 1
      },
      targetIds: [fixture.drawableId, fixture.meshId, fixture.parameterId]
    };
    const result = buildRuntimeEvidenceArtifacts({
      baselineGraph: fixture.baselineGraph,
      candidateGraph: fixture.candidateGraph,
      baseline: {
        frame: keyValueFrame
      },
      candidate: {
        frame: keyValueFrame
      },
      artifactLabel: "keyform-regression"
    });
    const candidateSnapshotPath = createRuntimeSnapshotArtifactPath(result.evidence.candidateSnapshot.snapshotId);
    const candidateSnapshotArtifact = result.artifacts.find((artifact) =>
      artifact.kind === "runtimeSnapshot" && artifact.path === candidateSnapshotPath
    );
    if (candidateSnapshotArtifact === undefined) {
      throw new Error(`Missing candidate runtime snapshot artifact ${candidateSnapshotPath}.`);
    }

    const candidateSnapshot = RuntimeSnapshotSchema.parse(JSON.parse(candidateSnapshotArtifact.content));
    const candidateDrawable = candidateSnapshot.drawables.find((drawable) => drawable.drawableId === fixture.drawableId);

    expect(result.evidence.baselineSnapshot.keyformSamples).toEqual([]);
    expect(candidateSnapshot.keyformSamples).toEqual([
      expect.objectContaining({
        keyformSetId: fixture.keyformSetId,
        evaluator: "linear-1d-v1",
        sampledCoordinates: {
          [fixture.parameterId]: 1
        },
        target: `mesh:${fixture.meshId}.vertices`,
        samplingStatus: "exact",
        statePatch: fixture.deformedVertices
      })
    ]);
    expect(candidateDrawable).toMatchObject({
      drawableId: fixture.drawableId,
      bounds: { x: 0, y: 0, width: 36, height: 32 },
      vertexHash: createStableVertexHash(fixture.deformedVertices)
    });
    expect(result.evidence.runtimeDiff.parameterChanges).toEqual([]);
    expect(result.evidence.runtimeDiff.drawableChanges).toEqual([
      {
        drawableId: fixture.drawableId,
        boundsChanged: true,
        vertexHashBefore: createStableVertexHash(fixture.baseVertices),
        vertexHashAfter: createStableVertexHash(fixture.deformedVertices)
      }
    ]);
    expect(result.evidence.runtimeDiff.drawableRuntimeStateChanges).toEqual([]);
    expect(result.evidence.runtimeDiff.drawListChanges).toEqual([]);
  });

  it("preserves dedicated drawable runtime state and drawList diff fields through artifact paths", () => {
    const fixture = createDrawableRuntimeStateAndDrawListEvidenceFixture();
    const result = buildRuntimeEvidenceArtifacts({
      baselineGraph: fixture.baselineGraph,
      candidateGraph: fixture.candidateGraph,
      artifactLabel: "runtime-diff-regression"
    });
    const runtimeDiff = RuntimeDiffDtoSchema.parse(result.evidence.runtimeDiff);
    const baselineSnapshotPath = createRuntimeSnapshotArtifactPath(runtimeDiff.beforeSnapshotId);
    const candidateSnapshotPath = createRuntimeSnapshotArtifactPath(runtimeDiff.afterSnapshotId);
    const baselineSnapshot = findRuntimeSnapshotArtifact(result.artifacts, baselineSnapshotPath);
    const candidateSnapshot = findRuntimeSnapshotArtifact(result.artifacts, candidateSnapshotPath);

    expect(baselineSnapshot.snapshotId).toBe(runtimeDiff.beforeSnapshotId);
    expect(candidateSnapshot.snapshotId).toBe(runtimeDiff.afterSnapshotId);
    expect(baselineSnapshot.drawList).toEqual([fixture.frontDrawableId, fixture.midDrawableId, fixture.backDrawableId]);
    expect(candidateSnapshot.drawList).toEqual([fixture.backDrawableId, fixture.midDrawableId]);
    expect(runtimeDiff.drawableRuntimeStateChanges).toHaveLength(2);
    expect(runtimeDiff.drawableRuntimeStateChanges).toEqual(
      expect.arrayContaining([
        {
          drawableId: fixture.frontDrawableId,
          opacityBefore: 1,
          opacityAfter: 0.5,
          visibleBefore: true,
          visibleAfter: false,
          baseDrawOrderBefore: 0,
          baseDrawOrderAfter: 3,
          evaluatedDrawOrderBefore: 0,
          evaluatedDrawOrderAfter: 3
        },
        {
          drawableId: fixture.backDrawableId,
          opacityBefore: 1,
          opacityAfter: 1,
          visibleBefore: true,
          visibleAfter: true,
          baseDrawOrderBefore: 2,
          baseDrawOrderAfter: 2,
          evaluatedDrawOrderBefore: 2,
          evaluatedDrawOrderAfter: 0
        }
      ])
    );
    expect(runtimeDiff.drawListChanges).toEqual([
      {
        before: [fixture.frontDrawableId, fixture.midDrawableId, fixture.backDrawableId],
        after: [fixture.backDrawableId, fixture.midDrawableId],
        membershipChanged: true,
        orderChanged: true,
        positionChanges: [
          {
            drawableId: fixture.frontDrawableId,
            beforeIndex: 0
          },
          {
            drawableId: fixture.backDrawableId,
            beforeIndex: 2,
            afterIndex: 0
          }
        ]
      }
    ]);
    expect(runtimeDiff.parameterChanges).toEqual([
      {
        path: "/drawList",
        before: [fixture.frontDrawableId, fixture.midDrawableId, fixture.backDrawableId],
        after: [fixture.backDrawableId, fixture.midDrawableId]
      }
    ]);
  });

  it("materializes sequence evidence with states[0] initial and states[i + 1] post-frame", () => {
    const packageId = PackageIdSchema.parse("pkg_sequence");
    const parameterId = ParameterIdSchema.parse("param_yaw");
    const drawableId = DrawableIdSchema.parse("draw_body");
    const graph = createGraph(packageId, parameterId, drawableId);
    const initialState = createInitialRuntimeState(graph, {
      packageId,
      packageRevision: 0,
      frameIndex: 0,
      fixedStepMs: 16.6666667,
      authoredParameterValues: {},
      resetReasons: ["validationRunStart"]
    });
    const sequence = evaluateRuntimeStateSequenceArtifact({
      graph,
      initialState,
      frames: [
        {
          frameIndex: 4,
          deltaTimeMs: 16.6666667,
          resetReasons: [],
          authoredParameterValues: { [parameterId]: 0.25 },
          targetIds: [drawableId]
        },
        {
          frameIndex: 5,
          deltaTimeMs: 16.6666667,
          resetReasons: [],
          authoredParameterValues: { [parameterId]: 0.5 },
          targetIds: [drawableId]
        }
      ],
      options: createDefaultRuntimeEvidenceOptions(),
      context: createDefaultRuntimeEvidenceContext(),
      label: "manual-sequence"
    });
    const materialized = materializeRuntimeStateSequenceArtifact({
      path: sequence.ref,
      artifact: sequence.artifact
    });
    const parsedArtifact = RuntimeStateSequenceArtifactSchema.parse(JSON.parse(materialized.content));

    expect(sequence.ref).toBe("runtime/state-sequences/pkg_sequence-r0-manual-sequence.runtime-state-sequence.json");
    expect(parsedArtifact.frameCount).toBe(2);
    expect(parsedArtifact.states.map((state) => state.frameIndex)).toEqual([0, 4, 5]);
    expect(sequence.finalState).toEqual(parsedArtifact.states.at(-1));
  });
});

const createMeshKeyformEvidenceFixture = () => {
  const packageId = PackageIdSchema.parse("pkg_keyform_evidence");
  const parameterId = ParameterIdSchema.parse("param_evidence_body_yaw");
  const drawableId = DrawableIdSchema.parse("draw_body");
  const meshId = MeshIdSchema.parse("mesh_body");
  const keyformSetId = KeyformSetIdSchema.parse("keyset_body_yaw_vertices");
  const baseVertices = [
    { x: 0, y: 0 },
    { x: 32, y: 0 },
    { x: 0, y: 32 }
  ];
  const deformedVertices = [
    { x: 0, y: 0 },
    { x: 36, y: 0 },
    { x: 0, y: 32 }
  ];
  const graphOptions = {
    meshId,
    bounds: { x: 0, y: 0, width: 32, height: 32 },
    vertices: baseVertices,
    vertexHash: createStableVertexHash(baseVertices)
  };
  const baselineGraph = createGraph(packageId, parameterId, drawableId, graphOptions);
  const candidateGraph = createGraph(packageId, parameterId, drawableId, {
    ...graphOptions,
    keyformBindings: [
      {
        evaluator: "linear-1d-v1",
        keyformSetId,
        targetId: meshId,
        targetKind: "mesh",
        targetProperty: "vertices",
        parameterId,
        keys: [
          {
            value: 1,
            statePatch: deformedVertices
          }
        ],
        compositionMode: "replace",
        compositionOrder: 0
      }
    ]
  });

  return {
    baselineGraph,
    candidateGraph,
    parameterId,
    drawableId,
    meshId,
    keyformSetId,
    baseVertices,
    deformedVertices
  };
};

const createDrawableRuntimeStateAndDrawListEvidenceFixture = () => {
  const packageId = PackageIdSchema.parse("pkg_runtime_diff_artifact_paths");
  const parameterId = ParameterIdSchema.parse("param_runtime_diff_unused");
  const frontDrawableId = DrawableIdSchema.parse("draw_front");
  const midDrawableId = DrawableIdSchema.parse("draw_mid");
  const backDrawableId = DrawableIdSchema.parse("draw_back");
  const drawableSpecs = {
    baseline: [
      {
        drawableId: frontDrawableId,
        meshId: MeshIdSchema.parse("mesh_front"),
        visible: true,
        opacity: 1,
        baseDrawOrder: 0,
        drawOrder: 0
      },
      {
        drawableId: midDrawableId,
        meshId: MeshIdSchema.parse("mesh_mid"),
        visible: true,
        opacity: 1,
        baseDrawOrder: 1,
        drawOrder: 1
      },
      {
        drawableId: backDrawableId,
        meshId: MeshIdSchema.parse("mesh_back"),
        visible: true,
        opacity: 1,
        baseDrawOrder: 2,
        drawOrder: 2
      }
    ],
    candidate: [
      {
        drawableId: frontDrawableId,
        meshId: MeshIdSchema.parse("mesh_front"),
        visible: false,
        opacity: 0.5,
        baseDrawOrder: 3,
        drawOrder: 3
      },
      {
        drawableId: midDrawableId,
        meshId: MeshIdSchema.parse("mesh_mid"),
        visible: true,
        opacity: 1,
        baseDrawOrder: 1,
        drawOrder: 1
      },
      {
        drawableId: backDrawableId,
        meshId: MeshIdSchema.parse("mesh_back"),
        visible: true,
        opacity: 1,
        baseDrawOrder: 2,
        drawOrder: 0
      }
    ]
  } satisfies Record<string, readonly DrawableRuntimeStateAndDrawListSpec[]>;

  return {
    baselineGraph: createGraphFromDrawableSpecs(packageId, parameterId, drawableSpecs.baseline),
    candidateGraph: createGraphFromDrawableSpecs(packageId, parameterId, drawableSpecs.candidate),
    frontDrawableId,
    midDrawableId,
    backDrawableId
  };
};

interface DrawableRuntimeStateAndDrawListSpec {
  readonly drawableId: ReturnType<typeof DrawableIdSchema.parse>;
  readonly meshId: ReturnType<typeof MeshIdSchema.parse>;
  readonly visible: boolean;
  readonly opacity: number;
  readonly baseDrawOrder: number;
  readonly drawOrder: number;
}

const createGraphFromDrawableSpecs = (
  packageId: string,
  parameterId: ReturnType<typeof ParameterIdSchema.parse>,
  drawables: readonly DrawableRuntimeStateAndDrawListSpec[]
): NormalizedRuntimeGraph => ({
  packageId,
  packageRevision: 0,
  coordinateSystem: "canvas-y-down-v1",
  parameters: new Map([
    [
      parameterId,
      {
        id: parameterId,
        displayName: "Unused",
        valueSource: "authoredInput",
        min: -1,
        max: 1,
        default: 0
      }
    ]
  ]),
  dynamicsGroups: new Map(),
  drawables: new Map(
    drawables.map((drawable) => [
      drawable.drawableId,
      {
        drawableId: drawable.drawableId,
        meshId: drawable.meshId,
        visible: drawable.visible,
        opacity: drawable.opacity,
        baseDrawOrder: drawable.baseDrawOrder,
        bounds: { x: 0, y: 0, width: 16, height: 16 },
        vertexCount: 4
      }
    ])
  ),
  rigControls: new Map(),
  keyformBindings: [],
  masks: [],
  drawOrder: drawables.map((drawable) => ({
    drawableId: drawable.drawableId,
    drawOrder: drawable.drawOrder
  })),
  disabledFutureLayers: []
});

const findRuntimeSnapshotArtifact = (
  artifacts: ReturnType<typeof buildRuntimeEvidenceArtifacts>["artifacts"],
  path: ReturnType<typeof createRuntimeSnapshotArtifactPath>
) => {
  const artifact = artifacts.find((candidate) => candidate.kind === "runtimeSnapshot" && candidate.path === path);
  if (artifact === undefined) {
    throw new Error(`Missing runtime snapshot artifact ${path}.`);
  }

  return RuntimeSnapshotSchema.parse(JSON.parse(artifact.content));
};

const createGraph = (
  packageId: string,
  parameterId: ReturnType<typeof ParameterIdSchema.parse>,
  drawableId: ReturnType<typeof DrawableIdSchema.parse>,
  options: {
    readonly meshId?: ReturnType<typeof MeshIdSchema.parse>;
    readonly bounds?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
    readonly vertices?: readonly { readonly x: number; readonly y: number }[];
    readonly vertexHash?: string;
    readonly keyformBindings?: NormalizedRuntimeGraph["keyformBindings"];
  } = {}
): NormalizedRuntimeGraph => {
  const meshId = options.meshId ?? MeshIdSchema.parse("mesh_body");

  return {
    packageId,
    packageRevision: 0,
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
          bounds: options.bounds ?? { x: 0, y: 0, width: 16, height: 16 },
          vertexCount: options.vertices?.length ?? 4,
          ...(options.vertices === undefined ? {} : { vertices: options.vertices }),
          ...(options.vertexHash === undefined ? {} : { vertexHash: options.vertexHash })
        }
      ]
    ]),
    rigControls: new Map(),
    keyformBindings: options.keyformBindings ?? [],
    masks: [],
    drawOrder: [{ drawableId, drawOrder: 0 }],
    disabledFutureLayers: []
  };
};
