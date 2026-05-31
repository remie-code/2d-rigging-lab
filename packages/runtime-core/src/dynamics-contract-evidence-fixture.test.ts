import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DynamicsGroupIdSchema,
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  DrawableId,
  RuntimeDiffDto
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { buildRuntimeEvidence } from "./runtime-evidence.js";
import type {
  KeyformBinding,
  NormalizedDrawable,
  NormalizedDynamicsGroup,
  NormalizedParameter,
  NormalizedRuntimeGraph
} from "./normalized-runtime-graph.js";
import type {
  EvaluatedDrawableDto,
  RuntimeSnapshotDto
} from "./snapshot.js";

const PACKAGE_HASH = "sha256:minimum-open-dynamics-v1-evidence";
const ARTIFACT_LABEL = "minimum-open-dynamics-v1-evidence";
const DRIVER_PARAMETER_ID = "param_face_yaw";
const OUTPUT_PARAMETER_ID = "param_hair_sway";
const DRAWABLE_ID = "draw_hair";
const MESH_ID = "mesh_hair";

describe("minimum-open-dynamics-v1-evidence runtime contract fixture", () => {
  it("replays the fixture as deterministic runtime snapshot and diff evidence", () => {
    const evidence = buildFixtureRuntimeEvidence();

    expect(summarizeRuntimeEvidence(evidence)).toEqual(
      loadFixtureJson("expected/runtime-snapshot-summary.json")
    );
    expect(summarizeRuntimeDiff(evidence.runtimeDiff)).toEqual(
      loadFixtureJson("expected/runtime-diff-summary.json").runtimeDiff
    );
  });

  it("matches the editor-facing evidence summary without editor UI implementation", () => {
    const evidence = buildFixtureRuntimeEvidence();
    const editorSummary = loadFixtureJson("expected/editor-facing-evidence-summary.json");
    const candidateSnapshot = evidence.candidateSnapshot;
    const computedOutput = candidateSnapshot.parameters.find(
      (parameter) => parameter.parameterId === OUTPUT_PARAMETER_ID
    );
    const projectedDrawable = findDrawable(candidateSnapshot, DRAWABLE_ID);

    expect(editorSummary.workflow).toMatchObject({
      operationType: "createDynamicsGroup",
      dynamicsGroupId: "dyn_hair_sway",
      driverParameterIds: [DRIVER_PARAMETER_ID],
      outputParameterId: OUTPUT_PARAMETER_ID
    });
    expect(editorSummary.previewEvidence).toMatchObject({
      runtimeSnapshotId: candidateSnapshot.snapshotId,
      computedOutput: {
        parameterId: computedOutput?.parameterId,
        value: computedOutput?.effectiveValue,
        source: computedOutput?.source
      },
      projectedDrawable: {
        drawableId: projectedDrawable.drawableId,
        meshId: projectedDrawable.meshId,
        bounds: projectedDrawable.bounds,
        vertexCount: projectedDrawable.vertexCount
      }
    });
    expect(editorSummary.editorUiScope).toBe("reference-only; no editor UI implementation is required by this fixture");
  });
});

interface RuntimeEvidenceLike {
  readonly baselineSnapshot: RuntimeSnapshotDto;
  readonly candidateSnapshot: RuntimeSnapshotDto;
  readonly generatedRuntimeSnapshotIds: readonly string[];
  readonly finalRuntimeState: {
    readonly packageId: string;
    readonly packageRevision: number;
    readonly frameIndex: number;
    readonly dynamicsGroups: Record<string, unknown>;
  };
  readonly runtimeDiff: RuntimeDiffDto;
}

const buildFixtureRuntimeEvidence = () => {
  const baselinePackage = loadFixtureJson("baseline-package.json");
  const request = loadFixtureJson("request/create-dynamics-group-commit.request.json");
  const baselineGraph = createRuntimeGraphFromPackage(baselinePackage, []);
  const candidateGraph = createRuntimeGraphFromPackage(
    {
      ...baselinePackage,
      manifest: {
        ...baselinePackage.manifest,
        packageRevision: 1
      }
    },
    [createRuntimeDynamicsGroup(request.payload)]
  );

  return buildRuntimeEvidence({
    baselineGraph,
    candidateGraph,
    baseline: createEvaluationInput(0),
    candidate: createEvaluationInput(1),
    options: {
      schemaVersion: "runtime-evaluation-options-v1",
      snapshotDetail: "full"
    },
    context: {
      source: { surface: "validator", operationId: request.operationId },
      policy: { strictness: "strict" }
    },
    artifactLabel: ARTIFACT_LABEL
  });
};

const createEvaluationInput = (frameIndex: number) => ({
  frame: {
    frameIndex,
    deltaTimeMs: 16.6666667,
    authoredParameterValues: {
      [DRIVER_PARAMETER_ID]: 1
    },
    targetIds: [OUTPUT_PARAMETER_ID, DRAWABLE_ID, MESH_ID]
  }
});

const summarizeRuntimeEvidence = (evidence: RuntimeEvidenceLike) => ({
  schemaVersion: "minimum-open-dynamics-runtime-snapshot-summary-v1",
  baselineSnapshot: summarizeSnapshot(evidence.baselineSnapshot),
  candidateSnapshot: summarizeSnapshot(evidence.candidateSnapshot),
  generatedRuntimeSnapshotIds: evidence.generatedRuntimeSnapshotIds,
  finalRuntimeState: {
    packageId: evidence.finalRuntimeState.packageId,
    packageRevision: evidence.finalRuntimeState.packageRevision,
    frameIndex: evidence.finalRuntimeState.frameIndex,
    dynamicsGroups: evidence.finalRuntimeState.dynamicsGroups
  }
});

const summarizeSnapshot = (snapshot: RuntimeSnapshotDto) => ({
  snapshotId: snapshot.snapshotId,
  packageId: snapshot.packageId,
  packageRevision: snapshot.packageRevision,
  parameters: snapshot.parameters.map((parameter) => ({
    parameterId: parameter.parameterId,
    valueSource: parameter.valueSource,
    effectiveValue: parameter.effectiveValue,
    source: parameter.source
  })),
  dynamics: snapshot.dynamics.map((dynamics) => ({
    dynamicsGroupId: dynamics.dynamicsGroupId,
    driverValues: dynamics.driverValues,
    outputParameterId: dynamics.outputParameterId,
    outputValue: dynamics.outputValue,
    position: dynamics.stateSummary.position,
    velocity: dynamics.stateSummary.velocity,
    tick: dynamics.tick,
    resetCounter: dynamics.resetCounter,
    debug: dynamics.debug
  })),
  keyformSamples: snapshot.keyformSamples.map((sample) => ({
    keyformSetId: sample.keyformSetId,
    sampledCoordinates: sample.sampledCoordinates,
    target: sample.target,
    samplingStatus: sample.samplingStatus
  })),
  drawable: summarizeDrawable(findDrawable(snapshot, DRAWABLE_ID)),
  diagnostics: snapshot.diagnostics
});

const summarizeDrawable = (drawable: EvaluatedDrawableDto) => ({
  drawableId: drawable.drawableId,
  meshId: drawable.meshId,
  bounds: drawable.bounds,
  vertices: drawable.vertices
});

const summarizeRuntimeDiff = (runtimeDiff: RuntimeDiffDto) => ({
  schemaVersion: runtimeDiff.schemaVersion,
  beforeSnapshotId: runtimeDiff.beforeSnapshotId,
  afterSnapshotId: runtimeDiff.afterSnapshotId,
  parameterChanges: runtimeDiff.parameterChanges,
  dynamicsChanges: runtimeDiff.dynamicsChanges,
  drawableChangeCount: runtimeDiff.drawableChanges.length,
  diagnosticDeltaCount: runtimeDiff.diagnosticDelta.length
});

const createRuntimeGraphFromPackage = (
  packageDocument: any,
  dynamicsGroups: readonly NormalizedDynamicsGroup[]
): NormalizedRuntimeGraph => {
  const drawablesById = new Map(
    packageDocument.model.drawables.drawables.map((drawable: any) => [drawable.drawableId, drawable])
  );
  const meshesByDrawableId = new Map(
    packageDocument.model.meshes.meshes.map((mesh: any) => [mesh.drawableId, mesh])
  );

  return {
    packageId: PackageIdSchema.parse(packageDocument.manifest.packageId),
    packageRevision: packageDocument.manifest.packageRevision,
    packageHash: PACKAGE_HASH,
    coordinateSystem: packageDocument.model.graph.coordinateSystem,
    parameters: new Map(
      packageDocument.model.parameters.parameters.map((parameter: any) => createParameterEntry(parameter))
    ),
    dynamicsGroups: new Map(dynamicsGroups.map((group) => [group.dynamicsGroupId, group])),
    drawables: new Map(
      [...drawablesById.values()].map((drawable: any) =>
        createDrawableEntry(drawable, meshesByDrawableId.get(drawable.drawableId))
      )
    ),
    rigControls: new Map(),
    keyformBindings: packageDocument.model.keyforms.keyformSets.map((keyformSet: any) =>
      createKeyformBinding(keyformSet)
    ),
    masks: [],
    drawOrder: packageDocument.model.drawOrder.entries.map((entry: any) => ({
      drawableId: DrawableIdSchema.parse(entry.drawableId),
      drawOrder: entry.baseDrawOrder
    })),
    disabledFutureLayers: []
  };
};

const createParameterEntry = (
  parameter: any
): readonly [NormalizedParameter["id"], NormalizedParameter] => {
  const parameterId = ParameterIdSchema.parse(parameter.parameterId);

  return [
    parameterId,
    {
      id: parameterId,
      displayName: parameter.displayName,
      semanticRole: parameter.semanticRole,
      valueSource: parameter.valueSource,
      min: parameter.min,
      max: parameter.max,
      default: parameter.default
    }
  ];
};

const createDrawableEntry = (
  drawable: any,
  mesh: any
): readonly [DrawableId, NormalizedDrawable] => {
  const drawableId = DrawableIdSchema.parse(drawable.drawableId);

  return [
    drawableId,
    {
      drawableId,
      meshId: MeshIdSchema.parse(drawable.meshId),
      visible: drawable.runtimeVisibility,
      opacity: drawable.defaultOpacity,
      baseDrawOrder: drawable.baseDrawOrder,
      bounds: mesh.bounds,
      vertices: mesh.vertices,
      vertexCount: mesh.vertices.length
    }
  ];
};

const createRuntimeDynamicsGroup = (payload: any): NormalizedDynamicsGroup => ({
  dynamicsGroupId: DynamicsGroupIdSchema.parse(payload.dynamicsGroupId),
  displayName: payload.displayName,
  enabled: payload.enabled,
  solverKind: payload.solverKind,
  drivers: payload.drivers.map((driver: any) => ({
    driverId: driver.driverId,
    sourceParameterId: ParameterIdSchema.parse(driver.sourceParameterId),
    inputScale: driver.inputScale,
    inputOffset: driver.inputOffset,
    invert: driver.invert
  })),
  output: {
    outputId: payload.output.outputId,
    targetParameterId: ParameterIdSchema.parse(payload.output.targetParameterId),
    outputScale: payload.output.outputScale,
    outputOffset: payload.output.outputOffset,
    min: payload.output.min,
    max: payload.output.max,
    clampPolicy: payload.output.clampPolicy
  },
  settings: payload.settings,
  resetPolicy: payload.resetPolicy
});

const createKeyformBinding = (keyformSet: any): KeyformBinding => ({
  evaluator: keyformSet.evaluator,
  keyformSetId: KeyformSetIdSchema.parse(keyformSet.keyformSetId),
  targetId: keyformSet.target.id,
  targetKind: keyformSet.target.kind === "mesh" || keyformSet.target.kind === "rigControl"
    ? keyformSet.target.kind
    : "drawable",
  targetProperty: keyformSet.target.property,
  parameterId: ParameterIdSchema.parse(keyformSet.parameterId),
  keys: keyformSet.keys,
  compositionMode: keyformSet.compositionMode,
  compositionOrder: keyformSet.compositionOrder
});

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

const loadFixtureJson = (relativePath: string): any =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/minimum-open-dynamics-v1-evidence"
);
