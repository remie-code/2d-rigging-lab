import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  RuntimeDiffSchema,
  RuntimeEvaluationContextSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  DrawableId,
  RuntimeEvaluationContextDto
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createInitialRuntimeState } from "./initial-state.js";
import type {
  KeyformBinding,
  NormalizedDrawable,
  NormalizedParameter,
  NormalizedRuntimeGraph
} from "./normalized-runtime-graph.js";
import { RuntimeEvaluationInputSchema } from "./runtime-input.js";
import type { RuntimeEvaluationInputDto } from "./runtime-input.js";
import { RuntimeEvaluationOptionsSchema } from "./runtime-options.js";
import type { RuntimeEvaluationOptionsDto } from "./runtime-options.js";
import { evaluateRuntimeFrame } from "./runtime-core.js";
import { compareRuntimeSnapshots } from "./snapshot-comparison.js";
import type {
  EvaluatedDrawableDto,
  RuntimeSnapshotDto
} from "./snapshot.js";

describe("runtime-grid2d-keyform-evidence contract fixture", () => {
  it("evaluates a compact Grid2D keyform as runtime-visible drawable evidence", () => {
    const fixture = loadRuntimeGrid2dFixture();
    const graph = createRuntimeGraphFromFixture(fixture.graph);
    const initialState = createInitialRuntimeState(graph, {
      packageId: graph.packageId,
      packageRevision: graph.packageRevision,
      packageHash: graph.packageHash,
      resetReasons: ["validationRunStart"]
    });

    const baseline = evaluateRuntimeFrame(
      graph,
      fixture.baselineFrame,
      initialState,
      fixture.options,
      fixture.context
    ).snapshot;
    const evaluated = evaluateRuntimeFrame(
      graph,
      fixture.evaluatedFrame,
      initialState,
      fixture.options,
      fixture.context
    ).snapshot;
    const baselineDrawable = findDrawable(baseline, fixture.expected.baselineSnapshot.drawable.drawableId);
    const evaluatedDrawable = findDrawable(evaluated, fixture.expected.evaluatedSnapshot.drawable.drawableId);

    expect(fixture.manifest.inputArtifacts).toContain("runtime/runtime-graph.json");
    expect(fixture.graph.parameters).toHaveLength(2);
    expect(fixture.graph.parameters.every((parameter) => parameter.valueSource === "authoredInput")).toBe(true);
    expect(fixture.graph.keyformBindings.every((binding) => binding.evaluator === "parameter-grid-2d-v1")).toBe(true);
    expect(baseline.snapshotId).toBe(fixture.expected.baselineSnapshot.snapshotId);
    expect(baseline.parameters).toEqual(fixture.expected.baselineSnapshot.parameters);
    expect(baseline.keyformSamples).toEqual(fixture.expected.baselineSnapshot.keyformSamples);
    expect(baselineDrawable).toEqual(fixture.expected.baselineSnapshot.drawable);
    expect(baseline.drawList).toEqual(fixture.expected.baselineSnapshot.drawList);
    expect(baseline.diagnostics).toEqual(fixture.expected.baselineSnapshot.diagnostics);
    expect(evaluated.snapshotId).toBe(fixture.expected.evaluatedSnapshot.snapshotId);
    expect(evaluated.parameters).toEqual(fixture.expected.evaluatedSnapshot.parameters);
    expect(evaluated.keyformSamples).toEqual(fixture.expected.evaluatedSnapshot.keyformSamples);
    expect(evaluatedDrawable).toEqual(fixture.expected.evaluatedSnapshot.drawable);
    expect(evaluated.drawList).toEqual(fixture.expected.evaluatedSnapshot.drawList);
    expect(evaluated.diagnostics).toEqual(fixture.expected.evaluatedSnapshot.diagnostics);
    expect(evaluated.keyformSamples.map((sample) => sample.sampledCoordinates)).toEqual([
      {
        param_fixture_face_x: 0,
        param_fixture_face_y: 0
      },
      {
        param_fixture_face_x: 0,
        param_fixture_face_y: 0
      }
    ]);
    const comparison = compareRuntimeSnapshots(baseline, evaluated);
    expect(comparison).toEqual(fixture.expected.runtimeComparison);
    expect(comparison.diff.drawableRuntimeStateChanges).toEqual([
      {
        drawableId: "draw_fixture_face",
        opacityBefore: 1,
        opacityAfter: 0.75,
        visibleBefore: true,
        visibleAfter: true,
        baseDrawOrderBefore: 0,
        baseDrawOrderAfter: 0,
        evaluatedDrawOrderBefore: 0,
        evaluatedDrawOrderAfter: 0
      }
    ]);
    expect(comparison.diff.drawListChanges).toEqual([]);
  });
});

const Vec2FixtureSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite()
});

const RectFixtureSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().nonnegative(),
  height: z.number().finite().nonnegative()
});

const MeshTopologyFixtureSchema = z.object({
  vertexCount: z.number().int().nonnegative(),
  stableVertexIdCount: z.number().int().nonnegative(),
  uvCount: z.number().int().nonnegative(),
  triangleCount: z.number().int().nonnegative(),
  triangleIndexCount: z.number().int().nonnegative(),
  hasStableVertexIds: z.boolean(),
  hasUvProjection: z.boolean(),
  hasTriangles: z.boolean()
});

const MeshVertexFixtureSchema = z.object({
  vertexIndex: z.number().int().nonnegative(),
  vertexStableId: z.string().optional(),
  vertexRef: z.string().min(1),
  position: Vec2FixtureSchema
});

const DrawableMeshEvidenceFixtureSchema = z.object({
  drawableId: z.string(),
  meshId: z.string(),
  bounds: RectFixtureSchema,
  vertexHash: z.string(),
  topology: MeshTopologyFixtureSchema,
  vertices: z.array(MeshVertexFixtureSchema)
});

const RuntimeGrid2dFixtureManifestSchema = z.object({
  schemaVersion: z.literal("contract-fixture-manifest-v1"),
  fixtureId: z.literal("runtime-grid2d-keyform-evidence"),
  title: z.string().min(1),
  coversAC: z.array(z.string()),
  coversScenarios: z.array(z.string()),
  modulesBlocked: z.array(z.string()),
  inputArtifacts: z.array(z.string()),
  expectedArtifacts: z.array(
    z.object({
      kind: z.literal("runtimeGrid2dKeyformEvidenceSummary"),
      path: z.string(),
      id: z.string(),
      comparison: z.literal("semantic-json")
    })
  ),
  updateRule: z.literal("requires-contract-review")
});
type RuntimeGrid2dFixtureManifest = z.infer<typeof RuntimeGrid2dFixtureManifestSchema>;

const RuntimeGraphFixtureSchema = z.object({
  schemaVersion: z.literal("runtime-grid2d-keyform-evidence-graph-v1"),
  packageId: z.string(),
  packageRevision: z.number().int().nonnegative(),
  packageHash: z.string().optional(),
  coordinateSystem: z.literal("canvas-y-down-v1"),
  parameters: z.array(
    z.object({
      id: z.string(),
      displayName: z.string(),
      semanticRole: z.enum(["eye", "brow", "mouth", "face", "body", "arm", "hair", "dynamics", "custom"]).optional(),
      valueSource: z.enum(["authoredInput", "computedDynamics", "debugOverride"]),
      min: z.number().finite(),
      max: z.number().finite(),
      default: z.number().finite()
    })
  ),
  drawables: z.array(
    z.object({
      drawableId: z.string(),
      meshId: z.string(),
      visible: z.boolean(),
      opacity: z.number().finite(),
      baseDrawOrder: z.number().int(),
      bounds: RectFixtureSchema,
      vertices: z.array(Vec2FixtureSchema).optional(),
      vertexCount: z.number().int().nonnegative(),
      vertexHash: z.string().optional()
    })
  ),
  keyformBindings: z.array(
    z.object({
      evaluator: z.literal("parameter-grid-2d-v1"),
      keyformSetId: z.string(),
      targetId: z.string(),
      targetKind: z.enum(["mesh", "rigControl", "drawable"]),
      targetProperty: z.string(),
      parameterX: z.string(),
      parameterY: z.string(),
      interpolation: z.literal("bilinear-grid-v1"),
      clampPolicy: z.literal("clamp-to-parameter-range"),
      missingKeyPolicy: z.literal("diagnostic-error"),
      keys: z.array(
        z.object({
          x: z.number().finite(),
          y: z.number().finite(),
          statePatch: z.unknown()
        })
      ),
      compositionMode: z.enum(["replace", "additiveDelta"]),
      compositionOrder: z.number().int()
    })
  ),
  masks: z.array(z.never()),
  drawOrder: z.array(z.never()),
  disabledFutureLayers: z.array(z.never())
});
type RuntimeGraphFixture = z.infer<typeof RuntimeGraphFixtureSchema>;

const ExpectedGrid2dEvidenceSummarySchema = z.object({
  schemaVersion: z.literal("runtime-grid2d-keyform-evidence-summary-v1"),
  baselineSnapshot: z.object({
    snapshotId: z.string(),
    parameters: z.array(z.unknown()),
    keyformSamples: z.array(z.unknown()),
    drawable: z.object({
      drawableId: z.string(),
      meshId: z.string(),
      visible: z.boolean(),
      opacity: z.number().finite(),
      baseDrawOrder: z.number().int(),
      evaluatedDrawOrder: z.number().int(),
      bounds: RectFixtureSchema,
      vertexCount: z.number().int().nonnegative(),
      vertexHash: z.string(),
      vertices: z.array(Vec2FixtureSchema),
      mesh: DrawableMeshEvidenceFixtureSchema,
      diagnostics: z.array(z.unknown())
    }),
    drawList: z.array(z.string()),
    diagnostics: z.array(z.unknown())
  }),
  evaluatedSnapshot: z.object({
    snapshotId: z.string(),
    parameters: z.array(z.unknown()),
    keyformSamples: z.array(z.unknown()),
    drawable: z.object({
      drawableId: z.string(),
      meshId: z.string(),
      visible: z.boolean(),
      opacity: z.number().finite(),
      baseDrawOrder: z.number().int(),
      evaluatedDrawOrder: z.number().int(),
      bounds: RectFixtureSchema,
      vertexCount: z.number().int().nonnegative(),
      vertexHash: z.string(),
      vertices: z.array(Vec2FixtureSchema),
      mesh: DrawableMeshEvidenceFixtureSchema,
      diagnostics: z.array(z.unknown())
    }),
    drawList: z.array(z.string()),
    diagnostics: z.array(z.unknown())
  }),
  runtimeComparison: z.object({
    equivalent: z.boolean(),
    diff: RuntimeDiffSchema
  })
});
type ExpectedGrid2dEvidenceSummary = z.infer<typeof ExpectedGrid2dEvidenceSummarySchema>;

interface RuntimeGrid2dFixture {
  readonly manifest: RuntimeGrid2dFixtureManifest;
  readonly graph: RuntimeGraphFixture;
  readonly options: RuntimeEvaluationOptionsDto;
  readonly context: RuntimeEvaluationContextDto;
  readonly baselineFrame: RuntimeEvaluationInputDto;
  readonly evaluatedFrame: RuntimeEvaluationInputDto;
  readonly expected: ExpectedGrid2dEvidenceSummary;
}

const loadRuntimeGrid2dFixture = (): RuntimeGrid2dFixture => {
  const fixtureDirectory = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../fixtures/contracts/runtime-grid2d-keyform-evidence"
  );

  return {
    manifest: RuntimeGrid2dFixtureManifestSchema.parse(readJson(join(fixtureDirectory, "fixture-manifest.json"))),
    graph: RuntimeGraphFixtureSchema.parse(readJson(join(fixtureDirectory, "runtime/runtime-graph.json"))),
    options: RuntimeEvaluationOptionsSchema.parse(readJson(join(fixtureDirectory, "request/evaluation-options.json"))),
    context: RuntimeEvaluationContextSchema.parse(readJson(join(fixtureDirectory, "request/evaluation-context.json"))),
    baselineFrame: RuntimeEvaluationInputSchema.parse(readJson(join(fixtureDirectory, "request/baseline-frame.json"))),
    evaluatedFrame: RuntimeEvaluationInputSchema.parse(readJson(join(fixtureDirectory, "request/evaluated-frame.json"))),
    expected: ExpectedGrid2dEvidenceSummarySchema.parse(
      readJson(join(fixtureDirectory, "expected/runtime-grid2d-keyform-evidence-summary.json"))
    )
  };
};

const createRuntimeGraphFromFixture = (fixture: RuntimeGraphFixture): NormalizedRuntimeGraph => ({
  packageId: PackageIdSchema.parse(fixture.packageId),
  packageRevision: fixture.packageRevision,
  ...(fixture.packageHash === undefined ? {} : { packageHash: fixture.packageHash }),
  coordinateSystem: fixture.coordinateSystem,
  parameters: new Map(fixture.parameters.map((parameter) => createParameterEntry(parameter))),
  dynamicsGroups: new Map(),
  drawables: new Map(fixture.drawables.map((drawable) => createDrawableEntry(drawable))),
  rigControls: new Map(),
  keyformBindings: fixture.keyformBindings.map((binding) => createKeyformBinding(binding)),
  masks: [],
  drawOrder: [],
  disabledFutureLayers: []
});

const createParameterEntry = (
  parameter: RuntimeGraphFixture["parameters"][number]
): readonly [NormalizedParameter["id"], NormalizedParameter] => {
  const parameterId = ParameterIdSchema.parse(parameter.id);

  return [
    parameterId,
    {
      id: parameterId,
      displayName: parameter.displayName,
      ...(parameter.semanticRole === undefined ? {} : { semanticRole: parameter.semanticRole }),
      valueSource: parameter.valueSource,
      min: parameter.min,
      max: parameter.max,
      default: parameter.default
    }
  ];
};

const createDrawableEntry = (
  drawable: RuntimeGraphFixture["drawables"][number]
): readonly [DrawableId, NormalizedDrawable] => {
  const drawableId = DrawableIdSchema.parse(drawable.drawableId);
  const meshId = MeshIdSchema.parse(drawable.meshId);

  return [
    drawableId,
    {
      drawableId,
      meshId,
      visible: drawable.visible,
      opacity: drawable.opacity,
      baseDrawOrder: drawable.baseDrawOrder,
      bounds: drawable.bounds,
      ...(drawable.vertices === undefined ? {} : { vertices: drawable.vertices }),
      vertexCount: drawable.vertexCount,
      ...(drawable.vertexHash === undefined ? {} : { vertexHash: drawable.vertexHash })
    }
  ];
};

const createKeyformBinding = (
  binding: RuntimeGraphFixture["keyformBindings"][number]
): KeyformBinding => ({
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
});

const findDrawable = (snapshot: RuntimeSnapshotDto, drawableId: string): EvaluatedDrawableDto => {
  const parsedDrawableId = DrawableIdSchema.parse(drawableId);
  const drawable = snapshot.drawables.find((candidate) => candidate.drawableId === parsedDrawableId);
  if (drawable === undefined) {
    throw new Error(`Expected fixture drawable ${drawableId} in snapshot ${snapshot.snapshotId}.`);
  }

  return drawable;
};

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
