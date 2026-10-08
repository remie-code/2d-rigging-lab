import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  KeyformSetIdSchema,
  MaskRelationIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  RigControlIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  DrawableId,
  RuntimeDiffDto
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createInitialRuntimeState } from "./initial-state.js";
import type {
  KeyformBinding,
  DisabledFutureLayer,
  NormalizedDrawable,
  NormalizedDrawOrderEntry,
  NormalizedDynamicsGroup,
  NormalizedMaskRelation,
  NormalizedParameter,
  NormalizedRigControlNode,
  NormalizedRuntimeGraph
} from "./normalized-runtime-graph.js";
import { buildRuntimeDiff } from "./runtime-diff-builder.js";
import { evaluateRuntimeFrame } from "./runtime-core.js";
import { RuntimeEvaluationOptionsSchema } from "./runtime-options.js";
import type { RuntimeSnapshotDto } from "./snapshot.js";
import { evaluateViewerRuntimeSnapshot } from "./viewer-evaluation.js";

const FIXTURE_ID = "preview-viewer-equivalence-keyform-dynamics";

describe("preview-viewer equivalence contract fixture", () => {
  it("matches preview projection and viewer evaluation for the same runtime input", () => {
    const fixture = loadFixture();
    const graph = createRuntimeGraphFromFixture(fixture.graph);
    const preview = evaluatePreviewRuntimeFixture(graph, fixture.request);
    const viewer = evaluateViewerRuntimeSnapshot(graph, {
      baselineFrameIndex: fixture.request.baselineFrameIndex,
      frameIndex: fixture.request.frameIndex,
      deltaTimeMs: fixture.request.deltaTimeMs,
      resetReasons: fixture.request.resetReasons,
      baselineParameterOverrides: fixture.request.baselineParameterOverrides,
      parameterOverrides: fixture.request.parameterOverrides,
      targetIds: fixture.request.targetIds,
      options: fixture.request.options,
      strictness: fixture.request.strictness
    });
    const summary = createEquivalenceSummary({
      request: fixture.request,
      preview,
      viewer
    });

    if (process.env.WAVE106_REGEN === "1") {
      writeFileSync(
        join(fixtureRootDirectory, "expected/preview-viewer-equivalence-summary.json"),
        `${JSON.stringify(summary, null, 2)}\n`,
        "utf8"
      );
    }

    expect(summary.equivalence).toEqual({
      snapshotSummary: true,
      effectiveParameters: true,
      targetedKeyforms: true,
      targetedDrawables: true,
      targetedDynamics: true,
      runtimeDiff: true
    });
    expect(summary).toEqual(fixture.expected);
  });
});

interface EquivalenceFixture {
  readonly graph: any;
  readonly request: any;
  readonly expected: any;
}

interface PreviewRuntimeFixtureEvaluation {
  readonly baselineSnapshot: RuntimeSnapshotDto;
  readonly snapshot: RuntimeSnapshotDto;
  readonly runtimeDiff: RuntimeDiffDto;
  readonly projection: EditorPreviewProjectionDto;
}

interface EditorPreviewProjectionDto {
  readonly schemaVersion: "editor-preview-projection-v1";
  readonly sourceSnapshotId: string;
  readonly packageId: string;
  readonly packageRevision: number;
  readonly snapshotDetail: string;
  readonly drawList: readonly string[];
  readonly drawableCount: number;
  readonly visibleDrawableCount: number;
  readonly keyformSamples: {
    readonly totalCount: number;
  };
  readonly diagnostics: {
    readonly totalCount: number;
  };
  readonly diff?: ReturnType<typeof summarizeRuntimeDiff>;
}

const evaluatePreviewRuntimeFixture = (
  graph: NormalizedRuntimeGraph,
  request: any
): PreviewRuntimeFixtureEvaluation => {
  const options = RuntimeEvaluationOptionsSchema.parse(request.options);
  const context = {
    source: {
      surface: "preview" as const
    },
    policy: {
      strictness: request.strictness
    }
  };
  const baselineState = createInitialRuntimeState(graph, {
    ...createRuntimeStateRequestPackageIdentity(graph),
    frameIndex: request.baselineFrameIndex,
    authoredParameterValues: request.baselineParameterOverrides,
    resetReasons: request.resetReasons
  });
  const baseline = evaluateRuntimeFrame(
    graph,
    {
      schemaVersion: "runtime-evaluation-input-v1",
      frameIndex: request.baselineFrameIndex,
      deltaTimeMs: request.deltaTimeMs,
      resetReasons: request.resetReasons,
      authoredParameterValues: request.baselineParameterOverrides,
      targetIds: request.targetIds
    },
    baselineState,
    options,
    context
  );
  const previousState = createInitialRuntimeState(graph, {
    ...createRuntimeStateRequestPackageIdentity(graph),
    frameIndex: request.frameIndex === 0 ? 0 : request.frameIndex - 1,
    authoredParameterValues: request.parameterOverrides,
    resetReasons: request.resetReasons
  });
  const current = evaluateRuntimeFrame(
    graph,
    {
      schemaVersion: "runtime-evaluation-input-v1",
      frameIndex: request.frameIndex,
      deltaTimeMs: request.deltaTimeMs,
      resetReasons: request.resetReasons,
      authoredParameterValues: request.parameterOverrides,
      targetIds: request.targetIds
    },
    previousState,
    options,
    context
  );
  const runtimeDiff = buildRuntimeDiff({
    baselineSnapshot: baseline.snapshot,
    candidateSnapshot: current.snapshot,
    comparisonPolicy: options.epsilonPolicy
  });

  return {
    baselineSnapshot: baseline.snapshot,
    snapshot: current.snapshot,
    runtimeDiff,
    projection: projectEditorPreview({
      snapshot: current.snapshot,
      runtimeDiff,
      drawableNames: request.drawableNames
    })
  };
};

const createEquivalenceSummary = (input: {
  readonly request: any;
  readonly preview: PreviewRuntimeFixtureEvaluation;
  readonly viewer: ReturnType<typeof evaluateViewerRuntimeSnapshot>;
}) => {
  const previewComparable = createComparableRuntimeSummary(
    input.preview.snapshot,
    input.preview.runtimeDiff
  );
  const viewerComparable = createComparableRuntimeSummary(
    input.viewer.snapshot,
    input.viewer.runtimeDiff
  );

  return {
    schemaVersion: "preview-viewer-equivalence-summary-v1",
    fixtureId: FIXTURE_ID,
    runtimeInput: {
      baselineFrameIndex: input.request.baselineFrameIndex,
      frameIndex: input.request.frameIndex,
      deltaTimeMs: input.request.deltaTimeMs,
      resetReasons: input.request.resetReasons,
      parameterOverrides: input.request.parameterOverrides,
      targetIds: input.request.targetIds
    },
    preview: {
      surface: "preview",
      projection: summarizePreviewProjection(input.preview.projection),
      comparable: previewComparable
    },
    viewer: {
      surface: "viewer",
      evidence: {
        schemaVersion: input.viewer.evidence.schemaVersion,
        surface: input.viewer.evidence.surface,
        baselineSnapshotId: input.viewer.evidence.baselineSnapshotId,
        snapshotId: input.viewer.evidence.snapshotId,
        parameterOverrides: input.viewer.evidence.parameterOverrides,
        runtimeDiffEquivalent: input.viewer.evidence.runtimeDiffEquivalent
      },
      comparable: viewerComparable
    },
    equivalence: {
      snapshotSummary: deepEqual(previewComparable.snapshot, viewerComparable.snapshot),
      effectiveParameters: deepEqual(previewComparable.effectiveParameters, viewerComparable.effectiveParameters),
      targetedKeyforms: deepEqual(previewComparable.targetedKeyforms, viewerComparable.targetedKeyforms),
      targetedDrawables: deepEqual(previewComparable.targetedDrawables, viewerComparable.targetedDrawables),
      targetedDynamics: deepEqual(previewComparable.targetedDynamics, viewerComparable.targetedDynamics),
      runtimeDiff: deepEqual(previewComparable.runtimeDiff, viewerComparable.runtimeDiff)
    },
    oracleScope: "summary-effective-parameters-targeted-runtime-fields; no pixel renderer oracle"
  };
};

const createComparableRuntimeSummary = (
  snapshot: RuntimeSnapshotDto,
  runtimeDiff: RuntimeDiffDto
) => ({
  snapshot: {
    snapshotId: snapshot.snapshotId,
    packageId: snapshot.packageId,
    packageRevision: snapshot.packageRevision,
    snapshotDetail: snapshot.evaluation.snapshotDetail,
    drawList: snapshot.drawList,
    drawableCount: snapshot.drawables.length,
    visibleDrawableCount: snapshot.drawables.filter((drawable) => drawable.visible).length,
    keyformSampleCount: snapshot.keyformSamples.length,
    dynamicsCount: snapshot.dynamics.length,
    diagnosticCount: snapshot.diagnostics.length
  },
  effectiveParameters: snapshot.parameters.map((parameter) => ({
    parameterId: parameter.parameterId,
    valueSource: parameter.valueSource,
    ...(parameter.authoredValue === undefined ? {} : { authoredValue: parameter.authoredValue }),
    baseValue: parameter.baseValue,
    ...(parameter.dynamicsOffset === undefined ? {} : { dynamicsOffset: parameter.dynamicsOffset }),
    effectiveValue: parameter.effectiveValue,
    clamped: parameter.clamped,
    source: parameter.source
  })),
  targetedKeyforms: snapshot.keyformSamples.map((sample) => ({
    keyformSetId: sample.keyformSetId,
    evaluator: sample.evaluator,
    sampledCoordinates: sample.sampledCoordinates,
    target: sample.target,
    compositionMode: sample.compositionMode,
    compositionOrder: sample.compositionOrder,
    samplingStatus: sample.samplingStatus
  })),
  targetedDrawables: snapshot.drawables.map((drawable) => ({
    drawableId: drawable.drawableId,
    meshId: drawable.meshId,
    visible: drawable.visible,
    opacity: drawable.opacity,
    baseDrawOrder: drawable.baseDrawOrder,
    evaluatedDrawOrder: drawable.evaluatedDrawOrder,
    bounds: drawable.bounds,
    vertexCount: drawable.vertexCount,
    ...(drawable.vertices === undefined
      ? {}
      : {
          vertices: drawable.vertices.map((vertex) => ({
            x: vertex.x,
            y: vertex.y
          }))
        })
  })),
  targetedDynamics: snapshot.dynamics.map((dynamics) => ({
    dynamicsGroupId: dynamics.dynamicsGroupId,
    solverKind: dynamics.solverKind,
    inputValues: dynamics.inputValues,
    outputParameterId: dynamics.outputParameterId,
    outputOffset: dynamics.outputOffset,
    effectiveOutputValue: dynamics.effectiveOutputValue,
    particleCount: dynamics.stateSummary.particleCount,
    maxParticleSpeed: dynamics.stateSummary.maxParticleSpeed,
    tipAngleLocalDeg: dynamics.stateSummary.tipAngleLocalDeg,
    tick: dynamics.tick,
    resetCounter: dynamics.resetCounter
  })),
  runtimeDiff: summarizeRuntimeDiff(runtimeDiff)
});

const projectEditorPreview = (input: {
  readonly snapshot: RuntimeSnapshotDto;
  readonly runtimeDiff: RuntimeDiffDto;
  readonly drawableNames: Readonly<Record<string, string>>;
}): EditorPreviewProjectionDto => ({
  schemaVersion: "editor-preview-projection-v1",
  sourceSnapshotId: input.snapshot.snapshotId,
  packageId: input.snapshot.packageId,
  packageRevision: input.snapshot.packageRevision,
  snapshotDetail: input.snapshot.evaluation.snapshotDetail,
  drawList: input.snapshot.drawList,
  drawableCount: input.snapshot.drawables.length,
  visibleDrawableCount: input.snapshot.drawables.filter((drawable) => drawable.visible).length,
  keyformSamples: {
    totalCount: input.snapshot.keyformSamples.length
  },
  diagnostics: {
    totalCount: input.snapshot.diagnostics.length
  },
  diff: summarizeRuntimeDiff(input.runtimeDiff)
});

const summarizePreviewProjection = (projection: EditorPreviewProjectionDto) => ({
  schemaVersion: projection.schemaVersion,
  sourceSnapshotId: projection.sourceSnapshotId,
  packageId: projection.packageId,
  packageRevision: projection.packageRevision,
  snapshotDetail: projection.snapshotDetail,
  drawList: projection.drawList,
  drawableCount: projection.drawableCount,
  visibleDrawableCount: projection.visibleDrawableCount,
  keyformSampleCount: projection.keyformSamples.totalCount,
  diagnosticCount: projection.diagnostics.totalCount,
  ...(projection.diff === undefined ? {} : { diff: projection.diff })
});

const summarizeRuntimeDiff = (runtimeDiff: RuntimeDiffDto) => ({
  beforeSnapshotId: runtimeDiff.beforeSnapshotId,
  afterSnapshotId: runtimeDiff.afterSnapshotId,
  parameterChangeCount: runtimeDiff.parameterChanges.length,
  dynamicsChangeCount: runtimeDiff.dynamicsChanges.length,
  drawableGeometryChangeCount: runtimeDiff.drawableChanges.length,
  drawableRuntimeStateChangeCount: runtimeDiff.drawableRuntimeStateChanges.length,
  drawListChangeCount: runtimeDiff.drawListChanges.length,
  diagnosticDeltaCount: runtimeDiff.diagnosticDelta.length,
  affectedDrawableIds: collectAffectedDrawableIds(runtimeDiff)
});

const collectAffectedDrawableIds = (runtimeDiff: RuntimeDiffDto): readonly DrawableId[] => {
  const ids = new Set<DrawableId>();

  for (const change of runtimeDiff.drawableChanges) {
    ids.add(change.drawableId);
  }
  for (const change of runtimeDiff.drawableRuntimeStateChanges) {
    ids.add(change.drawableId);
  }
  for (const change of runtimeDiff.drawListChanges) {
    for (const positionChange of change.positionChanges) {
      ids.add(positionChange.drawableId);
    }
  }

  return [...ids].sort((left, right) => left.localeCompare(right));
};

const createRuntimeGraphFromFixture = (fixtureGraph: any): NormalizedRuntimeGraph => ({
  packageId: PackageIdSchema.parse(fixtureGraph.packageId),
  packageRevision: fixtureGraph.packageRevision,
  packageHash: fixtureGraph.packageHash,
  coordinateSystem: fixtureGraph.coordinateSystem,
  parameters: new Map(
    fixtureGraph.parameters.map((parameter: any) => createParameterEntry(parameter))
  ),
  dynamicsGroups: new Map(
    fixtureGraph.dynamicsGroups.map((group: any) => createDynamicsGroupEntry(group))
  ),
  drawables: new Map(
    fixtureGraph.drawables.map((drawable: any) => createDrawableEntry(drawable))
  ),
  rigControls: new Map(
    fixtureGraph.rigControls.map((rigControl: any) => createRigControlEntry(rigControl))
  ),
  keyformBindings: fixtureGraph.keyformBindings.map((binding: any) =>
    createKeyformBinding(binding)
  ),
  masks: fixtureGraph.masks.map((mask: any) => createMaskRelation(mask)),
  drawOrder: fixtureGraph.drawOrder.map((entry: any) => createDrawOrderEntry(entry)),
  disabledFutureLayers: fixtureGraph.disabledFutureLayers.map((layer: any) =>
    createDisabledFutureLayer(layer)
  )
});

const createParameterEntry = (
  parameter: any
): readonly [NormalizedParameter["id"], NormalizedParameter] => {
  const parameterId = ParameterIdSchema.parse(parameter.id);

  return [
    parameterId,
    {
      id: parameterId,
      displayName: parameter.displayName,
      ...(parameter.semanticRole === undefined ? {} : { semanticRole: parameter.semanticRole }),
      ...(parameter.projectPresetAlias === undefined ? {} : { projectPresetAlias: parameter.projectPresetAlias }),
      valueSource: parameter.valueSource,
      min: parameter.min,
      max: parameter.max,
      default: parameter.default
    }
  ];
};

const createDynamicsGroupEntry = (
  group: any
): readonly [NormalizedDynamicsGroup["dynamicsGroupId"], NormalizedDynamicsGroup] => {
  const dynamicsGroupId = DynamicsGroupIdSchema.parse(group.dynamicsGroupId);

  return [
    dynamicsGroupId,
    {
      dynamicsGroupId,
      displayName: group.displayName,
      enabled: group.enabled,
      inputs: group.inputs.map((input: any) => ({
        parameterId: ParameterIdSchema.parse(input.parameterId),
        kind: input.kind,
        scale: input.scale
      })),
      chain: {
        rootOffset: group.chain.rootOffset ?? { x: 0, y: 0 },
        segmentLengths: group.chain.segmentLengths,
        damping: group.chain.damping,
        gravityScale: group.chain.gravityScale
      },
      outputs: group.outputs.map((output: any) => ({
        parameterId: ParameterIdSchema.parse(output.parameterId),
        segmentIndex: output.segmentIndex ?? 1,
        scale: output.scale,
        limit: output.limit
      }))
    }
  ];
};

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
      vertexCount: drawable.vertexCount
    }
  ];
};

const createRigControlEntry = (
  rigControl: any
): readonly [NormalizedRigControlNode["rigControlId"], NormalizedRigControlNode] => [
  RigControlIdSchema.parse(rigControl.rigControlId),
  {
    ...rigControl,
    rigControlId: RigControlIdSchema.parse(rigControl.rigControlId)
  }
];

const createKeyformBinding = (binding: any): KeyformBinding => {
  if (binding.evaluator === "parameter-grid-2d-v1") {
    return {
      evaluator: binding.evaluator,
      keyformSetId: KeyformSetIdSchema.parse(binding.keyformSetId),
      targetId: binding.targetId,
      targetKind: binding.targetKind,
      targetProperty: binding.targetProperty,
      parameterX: ParameterIdSchema.parse(binding.parameterX),
      parameterY: ParameterIdSchema.parse(binding.parameterY),
      interpolation: binding.interpolation,
      clampPolicy: binding.clampPolicy,
      missingKeyPolicy: binding.missingKeyPolicy,
      keys: binding.keys,
      compositionMode: binding.compositionMode,
      compositionOrder: binding.compositionOrder
    };
  }

  return {
    evaluator: binding.evaluator,
    keyformSetId: KeyformSetIdSchema.parse(binding.keyformSetId),
    targetId: binding.targetId,
    targetKind: binding.targetKind,
    targetProperty: binding.targetProperty,
    parameterId: ParameterIdSchema.parse(binding.parameterId),
    keys: binding.keys,
    compositionMode: binding.compositionMode,
    compositionOrder: binding.compositionOrder
  };
};

const createMaskRelation = (mask: any): NormalizedMaskRelation => ({
  maskRelationId: MaskRelationIdSchema.parse(mask.maskRelationId),
  sourceDrawableIds: mask.sourceDrawableIds.map((drawableId: string) =>
    DrawableIdSchema.parse(drawableId)
  ),
  targetDrawableIds: mask.targetDrawableIds.map((drawableId: string) =>
    DrawableIdSchema.parse(drawableId)
  )
});

const createDrawOrderEntry = (entry: any): NormalizedDrawOrderEntry => ({
  drawableId: DrawableIdSchema.parse(entry.drawableId),
  drawOrder: entry.drawOrder
});

interface DisabledFutureLayerFixture {
  readonly layerId: string;
  readonly reason: string;
}

const createDisabledFutureLayer = (
  layer: DisabledFutureLayerFixture
): DisabledFutureLayer => ({
  layerId: layer.layerId,
  reason: layer.reason
});

const createRuntimeStateRequestPackageIdentity = (
  graph: NormalizedRuntimeGraph
) => ({
  packageId: graph.packageId,
  packageRevision: graph.packageRevision,
  ...(graph.packageHash === undefined ? {} : { packageHash: graph.packageHash })
});

const deepEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const loadFixture = (): EquivalenceFixture => ({
  graph: loadFixtureJson("runtime/runtime-graph.json"),
  request: loadFixtureJson("request/evaluation-request.json"),
  expected: loadFixtureJson("expected/preview-viewer-equivalence-summary.json")
});

const loadFixtureJson = (relativePath: string): any =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/preview-viewer-equivalence-keyform-dynamics"
);
