import {
  DrawableIdSchema,
  type DiagnosticDto,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import { sampleRuntimeKeyforms } from "./keyform-sampling.js";

describe("runtime keyform sampling", () => {
  it("samples sorted linear and grid bindings with target and composition metadata", () => {
    const fixture = createSamplingFixture();

    const result = sampleRuntimeKeyforms({
      graph: fixture.graph,
      effectiveParameterValues: new Map([
        [fixture.yawParameterId, 0],
        [fixture.pitchParameterId, 0.5]
      ])
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.samples).toEqual([
      {
        keyformSetId: fixture.linearKeyformSetId,
        evaluator: "linear-1d-v1",
        sampledCoordinates: {
          [fixture.yawParameterId]: 0
        },
        target: "drawable:draw_body.opacity",
        targetMetadata: {
          targetId: "draw_body",
          targetKind: "drawable",
          targetProperty: "opacity"
        },
        compositionMode: "multiplyOpacity",
        compositionOrder: 0,
        statePatch: 0.75,
        samplingStatus: "interpolated"
      },
      {
        keyformSetId: fixture.gridKeyformSetId,
        evaluator: "parameter-grid-2d-v1",
        sampledCoordinates: {
          [fixture.yawParameterId]: 0,
          [fixture.pitchParameterId]: 0.5
        },
        target: "mesh:mesh_body.vertices",
        targetMetadata: {
          targetId: "mesh_body",
          targetKind: "mesh",
          targetProperty: "vertices"
        },
        compositionMode: "additiveDelta",
        compositionOrder: 1,
        statePatch: [{ x: 0, y: 0.5 }],
        samplingStatus: "interpolated"
      }
    ]);
  });

  it("clamps grid coordinates and emits diagnostics without dropping the sample", () => {
    const fixture = createSamplingFixture();

    const result = sampleRuntimeKeyforms({
      graph: fixture.graph,
      effectiveParameterValues: new Map([
        [fixture.yawParameterId, 2],
        [fixture.pitchParameterId, 0.5]
      ])
    });

    expect(result.diagnostics.map((diagnostic) => diagnostic.checkId)).toContain("keyform.grid2dCoordinateClamped");
    expect(result.samples[1]).toMatchObject({
      keyformSetId: fixture.gridKeyformSetId,
      sampledCoordinates: {
        [fixture.yawParameterId]: 1,
        [fixture.pitchParameterId]: 0.5
      },
      statePatch: [{ x: 1, y: 0.5 }]
    });
  });

  it("emits duplicate key diagnostics with stable severity, targets, and evidence", () => {
    const fixture = createSamplingFixture({
      includeLinearDuplicateKey: true,
      includeGridDuplicateCoordinate: true
    });

    const result = sampleRuntimeKeyforms({
      graph: fixture.graph,
      effectiveParameterValues: new Map([
        [fixture.yawParameterId, 0],
        [fixture.pitchParameterId, 0]
      ])
    });

    expect(result.samples).toHaveLength(2);
    expect(findDiagnostic(result.diagnostics, "keyform.linear1dDuplicateKey")).toMatchObject({
      checkId: "keyform.linear1dDuplicateKey",
      severity: "warning",
      phase: "keyform_sampling",
      target: { kind: "keyformSet", id: fixture.linearKeyformSetId },
      evidence: ["value=1"]
    });
    expect(findDiagnostic(result.diagnostics, "keyform.grid2dDuplicateKey")).toMatchObject({
      checkId: "keyform.grid2dDuplicateKey",
      severity: "error",
      phase: "keyform_sampling",
      target: { kind: "keyformSet", id: fixture.gridKeyformSetId },
      evidence: ["x=1,y=1"]
    });
  });

  it("emits a missing parameter diagnostic with parameter presence evidence", () => {
    const fixture = createSamplingFixture();
    const gridBinding = findGridBinding(fixture.graph, fixture.gridKeyformSetId);

    const result = sampleRuntimeKeyforms({
      graph: {
        ...fixture.graph,
        keyformBindings: [gridBinding]
      },
      effectiveParameterValues: new Map([[fixture.yawParameterId, 0]])
    });

    expect(result.samples).toEqual([]);
    expect(findDiagnostic(result.diagnostics, "keyform.missingParameter")).toMatchObject({
      checkId: "keyform.missingParameter",
      severity: "error",
      phase: "keyform_sampling",
      target: { kind: "keyformSet", id: fixture.gridKeyformSetId },
      evidence: [
        `parameterX=${fixture.yawParameterId}`,
        `parameterY=${fixture.pitchParameterId}`,
        "hasParameterX=true",
        "hasParameterY=true",
        "hasValueX=true",
        "hasValueY=false"
      ]
    });
  });

  it("emits a diagnostic for unsupported evaluators instead of silently ignoring them", () => {
    const fixture = createSamplingFixture();
    const linearBinding = findLinearBinding(fixture.graph, fixture.linearKeyformSetId);
    const unsupportedEvaluatorKeyformSetId = KeyformSetIdSchema.parse("keyset_unsupported_evaluator");

    const result = sampleRuntimeKeyforms({
      graph: {
        ...fixture.graph,
        keyformBindings: [
          {
            ...linearBinding,
            evaluator: "nearest-neighbor-v0",
            keyformSetId: unsupportedEvaluatorKeyformSetId
          } as unknown as NormalizedRuntimeGraph["keyformBindings"][number]
        ]
      },
      effectiveParameterValues: new Map([[fixture.yawParameterId, 0]])
    });

    expect(result.samples).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      checkId: "keyform.unsupportedEvaluator",
      severity: "error",
      phase: "keyform_sampling",
      target: { kind: "keyformSet", id: unsupportedEvaluatorKeyformSetId },
      evidence: []
    });
  });

  it("emits a diagnostic for unsupported patch shapes instead of silently ignoring them", () => {
    const fixture = createSamplingFixture({ linearPatch: "unsupported" });
    const linearBinding = findLinearBinding(fixture.graph, fixture.linearKeyformSetId);

    const result = sampleRuntimeKeyforms({
      graph: {
        ...fixture.graph,
        keyformBindings: [linearBinding]
      },
      effectiveParameterValues: new Map([[fixture.yawParameterId, 0]])
    });

    expect(result.samples).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      checkId: "keyform.unsupportedPatchShape",
      severity: "warning",
      phase: "keyform_sampling",
      target: { kind: "keyformSet", id: fixture.linearKeyformSetId },
      evidence: []
    });
  });

  it("distinguishes Grid2D key-range clamp diagnostics from missing surrounding keys", () => {
    const fixture = createSamplingFixture();
    const gridBinding = findGridBinding(fixture.graph, fixture.gridKeyformSetId);

    const keyRangeClampResult = sampleRuntimeKeyforms({
      graph: {
        ...fixture.graph,
        keyformBindings: [
          {
            ...gridBinding,
            keys: [
              { x: 0, y: -0.5, statePatch: [{ x: 0, y: -0.5 }] },
              { x: 0.5, y: -0.5, statePatch: [{ x: 0.5, y: -0.5 }] },
              { x: 0, y: 0.5, statePatch: [{ x: 0, y: 0.5 }] },
              { x: 0.5, y: 0.5, statePatch: [{ x: 0.5, y: 0.5 }] }
            ]
          }
        ]
      },
      effectiveParameterValues: new Map([
        [fixture.yawParameterId, 0.75],
        [fixture.pitchParameterId, 0.25]
      ])
    });

    expect(keyRangeClampResult.diagnostics).toHaveLength(1);
    expect(keyRangeClampResult.samples[0]).toMatchObject({
      keyformSetId: fixture.gridKeyformSetId,
      sampledCoordinates: {
        [fixture.yawParameterId]: 0.5,
        [fixture.pitchParameterId]: 0.25
      },
      samplingStatus: "clamped-key-range"
    });
    expect(keyRangeClampResult.diagnostics[0]).toMatchObject({
      checkId: "keyform.grid2dCoordinateClamped",
      severity: "warning",
      phase: "keyform_sampling",
      target: { kind: "keyformSet", id: fixture.gridKeyformSetId },
      evidence: ["x=0.5,y=0.25"]
    });
    expect(keyRangeClampResult.diagnostics[0]?.message).toContain("available key range");

    const missingKeyFixture = createSamplingFixture({ includeGridUpperRight: false });
    const missingGridBinding = findGridBinding(missingKeyFixture.graph, missingKeyFixture.gridKeyformSetId);

    const missingKeyResult = sampleRuntimeKeyforms({
      graph: {
        ...missingKeyFixture.graph,
        keyformBindings: [missingGridBinding]
      },
      effectiveParameterValues: new Map([
        [missingKeyFixture.yawParameterId, 0],
        [missingKeyFixture.pitchParameterId, 0]
      ])
    });

    expect(missingKeyResult.samples).toEqual([]);
    expect(missingKeyResult.diagnostics).toHaveLength(1);
    expect(missingKeyResult.diagnostics[0]).toMatchObject({
      checkId: "keyform.grid2dMissingKey",
      severity: "error",
      phase: "keyform_sampling",
      target: { kind: "keyformSet", id: missingKeyFixture.gridKeyformSetId },
      evidence: ["x=1,y=1"]
    });
  });

  it("emits diagnostics for missing grid keys and unsupported patches", () => {
    const fixture = createSamplingFixture({
      includeGridUpperRight: false,
      linearPatch: "unsupported"
    });

    const result = sampleRuntimeKeyforms({
      graph: fixture.graph,
      effectiveParameterValues: new Map([
        [fixture.yawParameterId, 0],
        [fixture.pitchParameterId, 0]
      ])
    });

    expect(result.samples).toEqual([]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual([
      "keyform.unsupportedPatchShape",
      "keyform.grid2dMissingKey"
    ]);
  });

  it("emits a diagnostic instead of sampling when the target is missing", () => {
    const fixture = createSamplingFixture({ includeDrawableTarget: false });

    const result = sampleRuntimeKeyforms({
      graph: fixture.graph,
      effectiveParameterValues: new Map([
        [fixture.yawParameterId, 0],
        [fixture.pitchParameterId, 0]
      ])
    });

    expect(result.samples).toEqual([]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual([
      "keyform.targetMissing",
      "keyform.targetMissing"
    ]);
  });
});

const createSamplingFixture = (
  options: {
    readonly includeDrawableTarget?: boolean;
    readonly includeGridUpperRight?: boolean;
    readonly includeGridDuplicateCoordinate?: boolean;
    readonly includeLinearDuplicateKey?: boolean;
    readonly linearPatch?: unknown;
  } = {}
) => {
  const packageId = PackageIdSchema.parse("pkg_keyform_sampling");
  const yawParameterId = ParameterIdSchema.parse("param_face_yaw");
  const pitchParameterId = ParameterIdSchema.parse("param_face_pitch");
  const drawableId = DrawableIdSchema.parse("draw_body");
  const meshId = MeshIdSchema.parse("mesh_body");
  const linearKeyformSetId = KeyformSetIdSchema.parse("keyset_linear_opacity");
  const gridKeyformSetId = KeyformSetIdSchema.parse("keyset_grid_vertices");
  const includeDrawableTarget = options.includeDrawableTarget ?? true;
  const includeGridUpperRight = options.includeGridUpperRight ?? true;
  const includeGridDuplicateCoordinate = options.includeGridDuplicateCoordinate ?? false;
  const includeLinearDuplicateKey = options.includeLinearDuplicateKey ?? false;
  const linearPatch = options.linearPatch;
  const graph: NormalizedRuntimeGraph = {
    packageId,
    packageRevision: 0,
    coordinateSystem: "canvas-y-down-v1",
    parameters: new Map([
      [
        yawParameterId,
        {
          id: yawParameterId,
          displayName: "Face Yaw",
          valueSource: "authoredInput",
          min: -1,
          max: 1,
          default: 0
        }
      ],
      [
        pitchParameterId,
        {
          id: pitchParameterId,
          displayName: "Face Pitch",
          valueSource: "authoredInput",
          min: -1,
          max: 1,
          default: 0
        }
      ]
    ]),
    dynamicsGroups: new Map(),
    drawables: includeDrawableTarget
      ? new Map([
          [
            drawableId,
            {
              drawableId,
              meshId,
              visible: true,
              opacity: 1,
              baseDrawOrder: 0,
              bounds: { x: 0, y: 0, width: 2, height: 2 },
              vertexCount: 1,
              vertices: [{ x: 0, y: 0 }]
            }
          ]
        ])
      : new Map(),
    rigControls: new Map(),
    keyformBindings: [
      {
        evaluator: "parameter-grid-2d-v1",
        keyformSetId: gridKeyformSetId,
        targetId: meshId,
        targetKind: "mesh",
        targetProperty: "vertices",
        parameterX: yawParameterId,
        parameterY: pitchParameterId,
        interpolation: "bilinear-grid-v1",
        clampPolicy: "clamp-to-parameter-range",
        missingKeyPolicy: "diagnostic-error",
        compositionMode: "additiveDelta",
        compositionOrder: 1,
        keys: [
          { x: -1, y: -1, statePatch: [{ x: -1, y: -1 }] },
          { x: 1, y: -1, statePatch: [{ x: 1, y: -1 }] },
          { x: -1, y: 1, statePatch: [{ x: -1, y: 1 }] },
          ...(includeGridUpperRight ? [{ x: 1, y: 1, statePatch: [{ x: 1, y: 1 }] }] : []),
          ...(includeGridDuplicateCoordinate ? [{ x: 1, y: 1, statePatch: [{ x: 99, y: 99 }] }] : [])
        ]
      },
      {
        evaluator: "linear-1d-v1",
        keyformSetId: linearKeyformSetId,
        targetId: drawableId,
        targetKind: "drawable",
        targetProperty: "opacity",
        parameterId: yawParameterId,
        compositionMode: "multiplyOpacity",
        compositionOrder: 0,
        keys: [
          { value: -1, statePatch: linearPatch ?? 0.5 },
          { value: 1, statePatch: linearPatch ?? 1 },
          ...(includeLinearDuplicateKey ? [{ value: 1, statePatch: linearPatch ?? 99 }] : [])
        ]
      }
    ],
    masks: [],
    drawOrder: [],
    disabledFutureLayers: []
  };

  return {
    graph,
    yawParameterId,
    pitchParameterId,
    linearKeyformSetId,
    gridKeyformSetId
  };
};

const findDiagnostic = (diagnostics: readonly DiagnosticDto[], checkId: string): DiagnosticDto => {
  const diagnostic = diagnostics.find((candidate) => candidate.checkId === checkId);
  if (diagnostic === undefined) {
    throw new Error(`Missing diagnostic ${checkId}.`);
  }

  return diagnostic;
};

const findLinearBinding = (graph: NormalizedRuntimeGraph, keyformSetId: string) => {
  const binding = graph.keyformBindings.find((candidate) => candidate.keyformSetId === keyformSetId);
  if (binding?.evaluator !== "linear-1d-v1") {
    throw new Error(`Missing linear binding ${keyformSetId}.`);
  }

  return binding;
};

const findGridBinding = (graph: NormalizedRuntimeGraph, keyformSetId: string) => {
  const binding = graph.keyformBindings.find((candidate) => candidate.keyformSetId === keyformSetId);
  if (binding?.evaluator !== "parameter-grid-2d-v1") {
    throw new Error(`Missing Grid2D binding ${keyformSetId}.`);
  }

  return binding;
};
