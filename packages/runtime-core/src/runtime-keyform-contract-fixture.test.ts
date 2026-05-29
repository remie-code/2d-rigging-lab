import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
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

describe("runtime-keyform-evaluation-foundation contract fixture", () => {
  it("evaluates a compact 1D mesh vertices keyform as runtime-visible snapshot output", () => {
    const fixture = loadRuntimeKeyformFixture();
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

    expect(baseline.snapshotId).toBe(fixture.expected.baselineSnapshot.snapshotId);
    expect(baseline.keyformSamples).toEqual(fixture.expected.baselineSnapshot.keyformSamples);
    expect(baselineDrawable).toMatchObject(fixture.expected.baselineSnapshot.drawable);
    expect(baseline.drawList).toEqual(fixture.expected.baselineSnapshot.drawList);
    expect(baseline.diagnostics).toEqual(fixture.expected.baselineSnapshot.diagnostics);
    expect(evaluated.snapshotId).toBe(fixture.expected.evaluatedSnapshot.snapshotId);
    expect(evaluated.keyformSamples).toEqual(fixture.expected.evaluatedSnapshot.keyformSamples);
    expect(evaluatedDrawable).toMatchObject(fixture.expected.evaluatedSnapshot.drawable);
    expect(evaluated.drawList).toEqual(fixture.expected.evaluatedSnapshot.drawList);
    expect(evaluated.diagnostics).toEqual(fixture.expected.evaluatedSnapshot.diagnostics);
    expect(compareRuntimeSnapshots(baseline, evaluated)).toEqual(fixture.expected.runtimeComparison);
    expect(fixture.grid2dCoverageNote).toMatchObject({
      topic: "parameter-grid-2d-v1",
      status: "covered-by-runtime-core-unit-tests"
    });
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

const RuntimeGraphFixtureSchema = z.object({
  schemaVersion: z.literal("runtime-keyform-graph-fixture-v1"),
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
      evaluator: z.literal("linear-1d-v1"),
      keyformSetId: z.string(),
      targetId: z.string(),
      targetKind: z.enum(["mesh", "rigControl", "drawable"]),
      targetProperty: z.string(),
      parameterId: z.string(),
      keys: z.array(
        z.object({
          value: z.number().finite(),
          statePatch: z.unknown()
        })
      ),
      compositionMode: z.enum(["replace", "additiveDelta", "multiplyOpacity"]),
      compositionOrder: z.number().int()
    })
  ),
  masks: z.array(z.never()),
  drawOrder: z.array(z.never()),
  disabledFutureLayers: z.array(z.never())
});
type RuntimeGraphFixture = z.infer<typeof RuntimeGraphFixtureSchema>;

const Grid2dCoverageNoteSchema = z.object({
  schemaVersion: z.literal("runtime-keyform-fixture-coverage-note-v1"),
  topic: z.literal("parameter-grid-2d-v1"),
  status: z.literal("covered-by-runtime-core-unit-tests"),
  rationale: z.string().min(1)
});
type Grid2dCoverageNote = z.infer<typeof Grid2dCoverageNoteSchema>;

const ExpectedEffectSummarySchema = z.object({
  schemaVersion: z.literal("runtime-keyform-evaluation-foundation-summary-v1"),
  baselineSnapshot: z.object({
    snapshotId: z.string(),
    keyformSamples: z.array(z.unknown()),
    drawable: z.object({
      drawableId: z.string(),
      meshId: z.string(),
      bounds: RectFixtureSchema,
      vertexHash: z.string(),
      vertices: z.array(Vec2FixtureSchema)
    }),
    drawList: z.array(z.string()),
    diagnostics: z.array(z.unknown())
  }),
  evaluatedSnapshot: z.object({
    snapshotId: z.string(),
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
      diagnostics: z.array(z.unknown())
    }),
    drawList: z.array(z.string()),
    diagnostics: z.array(z.unknown())
  }),
  runtimeComparison: z.unknown()
});
type ExpectedEffectSummary = z.infer<typeof ExpectedEffectSummarySchema>;

interface RuntimeKeyformFixture {
  readonly graph: RuntimeGraphFixture;
  readonly grid2dCoverageNote: Grid2dCoverageNote;
  readonly options: RuntimeEvaluationOptionsDto;
  readonly context: RuntimeEvaluationContextDto;
  readonly baselineFrame: RuntimeEvaluationInputDto;
  readonly evaluatedFrame: RuntimeEvaluationInputDto;
  readonly expected: ExpectedEffectSummary;
}

const loadRuntimeKeyformFixture = (): RuntimeKeyformFixture => {
  const fixtureDirectory = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../fixtures/contracts/runtime-keyform-evaluation-foundation"
  );

  return {
    graph: RuntimeGraphFixtureSchema.parse(readJson(join(fixtureDirectory, "runtime/runtime-graph.json"))),
    grid2dCoverageNote: Grid2dCoverageNoteSchema.parse(
      readJson(join(fixtureDirectory, "runtime/grid2d-coverage-note.json"))
    ),
    options: RuntimeEvaluationOptionsSchema.parse(readJson(join(fixtureDirectory, "request/evaluation-options.json"))),
    context: RuntimeEvaluationContextSchema.parse(readJson(join(fixtureDirectory, "request/evaluation-context.json"))),
    baselineFrame: RuntimeEvaluationInputSchema.parse(readJson(join(fixtureDirectory, "request/baseline-frame.json"))),
    evaluatedFrame: RuntimeEvaluationInputSchema.parse(readJson(join(fixtureDirectory, "request/evaluated-frame.json"))),
    expected: ExpectedEffectSummarySchema.parse(
      readJson(join(fixtureDirectory, "expected/runtime-keyform-effect-summary.json"))
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
  parameterId: ParameterIdSchema.parse(binding.parameterId),
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
