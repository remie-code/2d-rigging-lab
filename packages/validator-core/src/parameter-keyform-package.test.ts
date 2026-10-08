import { describe, expect, it } from "vitest";

import { validatePackageRuntime } from "./validators/package-runtime.js";

const CREATED_AT = "2026-06-12T00:00:00.000Z";

describe("parameter and keyform package validation", () => {
  it("reports duplicate parameters, bad keyform refs, out-of-range positions, missing targets, unsupported properties, and preset mutations", () => {
    const report = validatePackageRuntime({
      packageDocument: createPackage({
        parameters: [
          createParameter("param_custom"),
          createParameter("param_custom", { displayName: "Duplicate Custom" }),
          createParameter("param_face_angle_x", {
            displayName: "Mutated Face Angle X",
            kind: "custom",
            min: -10,
            max: 10
          })
        ],
        keyformSets: [
          createLinearKeyformSet("keyset_missing_param", {
            parameterId: "param_missing",
            target: { kind: "drawable", id: "draw_face", property: "opacity" }
          }),
          createLinearKeyformSet("keyset_out_of_range", {
            parameterId: "param_custom",
            target: { kind: "drawable", id: "draw_face", property: "opacity" },
            keys: [
              { value: 2, statePatch: 0.5 },
              { value: 2, statePatch: 0.75 }
            ]
          }),
          createLinearKeyformSet("keyset_out_of_range", {
            parameterId: "param_custom",
            target: { kind: "drawable", id: "draw_face", property: "opacity" }
          }),
          createLinearKeyformSet("keyset_missing_target", {
            parameterId: "param_custom",
            target: { kind: "drawable", id: "draw_missing", property: "opacity" }
          }),
          createLinearKeyformSet("keyset_unsupported_property", {
            parameterId: "param_custom",
            target: { kind: "rigControl", id: "rig_rotation", property: "pivot" }
          })
        ]
      }),
      createdAt: CREATED_AT
    });

    expect(report.checks.map((check) => check.checkId)).toEqual(
      expect.arrayContaining([
        "parameter.duplicateId",
        "parameter.presetLockedMutation",
        "keyform.duplicateSetId",
        "keyform.parameterMissing",
        "keyform.keyOutOfRange",
        "keyform.targetMissing",
        "keyform.unsupportedTargetProperty",
        "keyform.linear1dDuplicateKey"
      ])
    );
  });

  it("treats preset catalog parameters as initialized for keyform refs", () => {
    const report = validatePackageRuntime({
      packageDocument: createPackage({
        parameters: [],
        keyformSets: [
          createLinearKeyformSet("keyset_preset_param_ref", {
            parameterId: "param_face_angle_x",
            target: { kind: "drawable", id: "draw_face", property: "opacity" },
            keys: [
              { value: -30, statePatch: 1 },
              { value: 30, statePatch: 0 }
            ]
          })
        ]
      }),
      createdAt: CREATED_AT
    });

    expect(report.checks.map((check) => check.checkId)).not.toContain("keyform.parameterMissing");
    expect(report.checks.map((check) => check.checkId)).not.toContain("keyform.keyOutOfRange");
  });
});

const createParameter = (parameterId: string, overrides: Record<string, unknown> = {}) => ({
  parameterId,
  displayName: parameterId,
  valueSource: "authoredInput",
  min: 0,
  max: 1,
  default: 0,
  recommendedUiStep: 0.01,
  ...overrides
});

const createLinearKeyformSet = (
  keyformSetId: string,
  overrides: {
    readonly parameterId: string;
    readonly target: { readonly kind: string; readonly id: string; readonly property: string };
    readonly keys?: readonly { readonly value: number; readonly statePatch: unknown }[];
  }
) => ({
  keyformSetId,
  target: overrides.target,
  parameterId: overrides.parameterId,
  evaluator: "linear-1d-v1",
  interpolation: "linear-1d-v1",
  compositionMode: "replace",
  compositionOrder: 0,
  keys: overrides.keys ?? [{ value: 0, statePatch: 1 }]
});

const createPackage = (overrides: {
  readonly parameters: readonly unknown[];
  readonly keyformSets: readonly unknown[];
}) => ({
  manifest: {
    schemaVersion: "open-model-package-manifest-v1",
    packageId: "pkg_parameter_keyform_validator",
    packageDisplayName: "Parameter Keyform Validator",
    formatVersion: "open-model-package-v1",
    packageRevision: 0,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    schemaVersions: {},
    evaluatorVersions: {},
    modelFiles: {
      graph: "model/graph.json",
      drawables: "model/drawables.json",
      meshes: "model/meshes.json",
      parameters: "model/parameters.json",
      keyforms: "model/keyforms.json",
      rigControls: "model/rig-controls.json",
      dynamics: "model/dynamics.json",
      masks: "model/masks.json",
      drawOrder: "model/draw-order.json"
    },
    assetIndex: "assets/sources/source-manifest.json",
    operationLog: "operations/log.jsonl",
    rightsSummary: { status: "cleared" },
    provenanceSummary: { sourceAssetCount: 1 },
    packageStableOrderVersion: "stable-order-v1"
  },
  model: {
    graph: {
      schemaVersion: "model-graph-v1",
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { width: 512, height: 512 },
      parts: [
        {
          partId: "part_root",
          displayName: "Root",
          childPartIds: [],
          drawableIds: ["draw_face"]
        }
      ],
      rigControlRootIds: ["rig_rotation"],
      stableOrder: ["draw_face", "rig_rotation"]
    },
    drawables: {
      schemaVersion: "drawables-file-v1",
      drawables: [
        {
          drawableId: "draw_face",
          displayName: "Face",
          partId: "part_root",
          sourceAssetId: "src_generated",
          textureId: "tex_face",
          meshId: "mesh_face",
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 0,
          sourceProvenanceId: "prov_generated"
        }
      ]
    },
    meshes: {
      schemaVersion: "meshes-file-v1",
      meshes: [
        {
          meshId: "mesh_face",
          drawableId: "draw_face",
          vertices: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 }
          ],
          uvs: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 }
          ],
          triangles: [[0, 1, 2]],
          vertexStableIds: ["v0", "v1", "v2"],
          bounds: { x: 0, y: 0, width: 1, height: 1 },
          generationProvenanceId: "prov_generated"
        }
      ]
    },
    parameters: {
      schemaVersion: "parameters-file-v1",
      parameters: overrides.parameters
    },
    keyforms: {
      schemaVersion: "keyforms-file-v1",
      keyformSets: overrides.keyformSets
    },
    rigControls: {
      schemaVersion: "rig-controls-file-v1",
      rigControls: [
        {
          kind: "rotation2d",
          rigControlId: "rig_rotation",
          displayName: "Rotation",
          partId: "part_root",
          childDrawableIds: ["draw_face"],
          childRigControlIds: [],
          pivot: { x: 0, y: 0 },
          restAngleDegrees: 0,
          restTranslation: { x: 0, y: 0 },
          restScale: { x: 1, y: 1 },
          enabled: true
        }
      ]
    },
    dynamics: {
      schemaVersion: "dynamics-file-v3",
      dynamicsGroups: []
    },
    masks: {
      schemaVersion: "masks-file-v1",
      masks: []
    },
    drawOrder: {
      schemaVersion: "draw-order-file-v1",
      entries: [
        {
          drawableId: "draw_face",
          baseDrawOrder: 0,
          stableOrder: 0
        }
      ]
    }
  },
  assets: {
    sourceManifest: {
      schemaVersion: "source-manifest-v1",
      sourceAssets: [
        {
          sourceAssetId: "src_generated",
          kind: "generated-fixture-v1",
          filePath: "assets/sources/generated.png",
          contentHash: "hash_generated",
          importProfile: "split-png-fallback-v1",
          layers: [],
          diagnostics: []
        }
      ]
    },
    provenance: {
      schemaVersion: "provenance-file-v1",
      records: [
        {
          provenanceId: "prov_generated",
          assetId: "src_generated",
          assetKind: "generatedFixture",
          filePath: "assets/sources/generated.png",
          creator: "test",
          license: "internal-test",
          redistributionAllowed: false,
          aiUsed: false,
          transformHistory: [],
          relatedOperationIds: []
        }
      ]
    },
    rights: {
      schemaVersion: "rights-file-v1",
      records: [
        {
          assetId: "src_generated",
          rightsStatus: "cleared",
          license: "internal-test",
          redistributionAllowed: false
        }
      ]
    }
  }
});
