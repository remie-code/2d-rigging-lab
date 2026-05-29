import { describe, expect, it } from "vitest";

import {
  PackageDocumentSchema,
  ParameterSchema,
  type PackageDocumentDto,
  type ParameterDto
} from "@private-2d-rigging-lab/package-format";

import { projectLoadedPackageState } from "../editor-state/index.js";
import { projectEditorInspectModel, projectEditorInspectTarget } from "./editor-ai-inspection-projector.js";

describe("editor AI inspection projector", () => {
  it("projects stable parameter targets from editor state", () => {
    const state = projectLoadedPackageState({
      identity: {
        packageId: "pkg_ai_inspection",
        packageDisplayName: "AI Inspection",
        formatVersion: "private-2d-package-v1"
      },
      revision: {
        packageRevision: 2,
        authoringRevision: 4
      },
      parameters: [
        createParameter({
          parameterId: "param_faceYaw",
          displayName: "Face Yaw",
          min: -30,
          max: 30,
          default: 0
        }),
        createParameter({
          parameterId: "param_smile",
          displayName: "Smile",
          min: 0,
          max: 1,
          default: 0
        })
      ]
    });

    expect(projectEditorInspectModel({ state })).toEqual({
      schemaVersion: "editor-inspection-projection-v1",
      packageRevision: 2,
      targets: [
        {
          kind: "parameter",
          id: "param_faceYaw",
          path: "/model/parameters/parameters/0"
        },
        {
          kind: "parameter",
          id: "param_smile",
          path: "/model/parameters/parameters/1"
        }
      ],
      editableTargets: [
        {
          kind: "parameter",
          id: "param_faceYaw",
          path: "/model/parameters/parameters/0"
        },
        {
          kind: "parameter",
          id: "param_smile",
          path: "/model/parameters/parameters/1"
        }
      ],
      targetCounts: {
        parameters: 2
      },
      supportedEditableTargetKinds: ["parameter"]
    });
  });

  it("projects compact parameter details and references from a package document", () => {
    const packageDocument = createPackageDocument();

    expect(
      projectEditorInspectTarget(
        { packageDocument },
        {
          kind: "parameter",
          id: "param_faceYaw"
        }
      )
    ).toEqual({
      schemaVersion: "editor-inspection-projection-v1",
      status: "ok",
      target: {
        kind: "parameter",
        id: "param_faceYaw",
        path: "/model/parameters/parameters/0"
      },
      references: [
        {
          kind: "keyformSet",
          id: "keyset_faceYaw_head",
          path: "/model/keyforms/keyformSets/0"
        },
        {
          kind: "rigControl",
          id: "rig_head",
          path: "/model/rigControls/rigControls/rig_head"
        },
        {
          kind: "dynamicsGroup",
          id: "dyn_hair_sway",
          path: "/model/dynamics/dynamicsGroups/0"
        }
      ],
      parameter: {
        parameterId: "param_faceYaw",
        displayName: "Face Yaw",
        semanticRole: "face",
        projectPresetAlias: "ParamAngleX",
        valueSource: "authoredInput",
        min: -30,
        max: 30,
        default: 0,
        recommendedUiStep: 0.1
      }
    });
  });

  it("returns structured missing and unsupported target results without throwing", () => {
    const packageDocument = createPackageDocument();

    expect(
      projectEditorInspectTarget(
        { packageDocument },
        {
          kind: "parameter",
          id: "param_missing"
        }
      )
    ).toMatchObject({
      schemaVersion: "editor-inspection-projection-v1",
      status: "missing",
      reason: "target_not_found",
      target: {
        kind: "parameter",
        id: "param_missing"
      },
      references: [],
      supportedTargetKinds: ["parameter"],
      diagnostics: [
        {
          checkId: "ai.editor.inspectTarget.targetNotFound",
          severity: "warning"
        }
      ]
    });

    expect(
      projectEditorInspectTarget(
        { packageDocument },
        {
          kind: "drawable",
          id: "draw_head"
        }
      )
    ).toMatchObject({
      schemaVersion: "editor-inspection-projection-v1",
      status: "unsupported",
      reason: "unsupported_target_kind",
      target: {
        kind: "drawable",
        id: "draw_head"
      },
      references: [],
      supportedTargetKinds: ["parameter"],
      diagnostics: [
        {
          checkId: "ai.editor.inspectTarget.unsupportedTargetKind",
          severity: "warning"
        }
      ]
    });
  });
});

const createParameter = (input: {
  readonly parameterId: string;
  readonly displayName: string;
  readonly min: number;
  readonly max: number;
  readonly default: number;
  readonly projectPresetAlias?: string;
}): ParameterDto =>
  ParameterSchema.parse({
    parameterId: input.parameterId,
    displayName: input.displayName,
    semanticRole: "face",
    projectPresetAlias: input.projectPresetAlias ?? `preset-${input.parameterId}`,
    valueSource: "authoredInput",
    min: input.min,
    max: input.max,
    default: input.default,
    recommendedUiStep: 0.1
  });

const createPackageDocument = (): PackageDocumentDto =>
  PackageDocumentSchema.parse({
  manifest: {
    schemaVersion: "open-model-package-manifest-v1",
    packageId: "pkg_ai_inspection",
    packageDisplayName: "AI Inspection",
    packageRevision: 3,
    formatVersion: "open-model-package-v1",
    createdAt: "2026-05-29T00:00:00.000Z",
    updatedAt: "2026-05-29T00:00:00.000Z",
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
    rightsSummary: {
      status: "cleared"
    },
    provenanceSummary: {
      sourceAssetCount: 0
    },
    packageStableOrderVersion: "stable-order-v1"
  },
  model: {
    graph: {
      schemaVersion: "model-graph-v1",
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: {
        width: 1000,
        height: 1000
      },
      parts: [],
      rigControlRootIds: ["rig_head"],
      stableOrder: []
    },
    drawables: {
      schemaVersion: "drawables-file-v1",
      drawables: []
    },
    meshes: {
      schemaVersion: "meshes-file-v1",
      meshes: []
    },
    parameters: {
      schemaVersion: "parameters-file-v1",
      parameters: [
        createParameter({
          parameterId: "param_faceYaw",
          displayName: "Face Yaw",
          min: -30,
          max: 30,
          default: 0,
          projectPresetAlias: "ParamAngleX"
        }),
        createParameter({
          parameterId: "param_hairSway",
          displayName: "Hair Sway",
          min: -1,
          max: 1,
          default: 0
        })
      ]
    },
    keyforms: {
      schemaVersion: "keyforms-file-v1",
      keyformSets: [
        {
          keyformSetId: "keyset_faceYaw_head",
          target: {
            kind: "rigControl",
            id: "rig_head",
            property: "angleDegrees"
          },
          parameterId: "param_faceYaw",
          evaluator: "linear-1d-v1",
          interpolation: "linear-1d-v1",
          compositionMode: "replace",
          compositionOrder: 0,
          keys: [
            {
              value: -30,
              statePatch: -15
            },
            {
              value: 30,
              statePatch: 15
            }
          ]
        },
        {
          keyformSetId: "keyset_hairSway_mesh",
          target: {
            kind: "mesh",
            id: "mesh_hair",
            property: "vertices"
          },
          parameterId: "param_hairSway",
          evaluator: "linear-1d-v1",
          interpolation: "linear-1d-v1",
          compositionMode: "additiveDelta",
          compositionOrder: 1,
          keys: [
            {
              value: -1,
              statePatch: []
            },
            {
              value: 1,
              statePatch: []
            }
          ]
        }
      ]
    },
    rigControls: {
      schemaVersion: "rig-controls-file-v1",
      rigControls: [
        {
          kind: "rotation2d",
          rigControlId: "rig_head",
          displayName: "Head",
          partId: "part_head",
          childDrawableIds: [],
          childRigControlIds: [],
          pivot: {
            x: 0,
            y: 0
          },
          restAngleDegrees: 0,
          restTranslation: {
            x: 0,
            y: 0
          },
          restScale: {
            x: 1,
            y: 1
          },
          enabled: true
        }
      ]
    },
    dynamics: {
      schemaVersion: "dynamics-file-v1",
      dynamicsGroups: [
        {
          dynamicsGroupId: "dyn_hair_sway",
          displayName: "Hair Sway",
          enabled: true,
          solverKind: "scalarDampedFollowV1",
          drivers: [
            {
              driverId: "driver_faceYaw",
              sourceParameterId: "param_faceYaw",
              inputScale: 1,
              inputOffset: 0,
              invert: false
            }
          ],
          output: {
            outputId: "out_hairSway",
            targetParameterId: "param_hairSway",
            outputScale: 1,
            outputOffset: 0,
            min: -1,
            max: 1,
            clampPolicy: "clamp-to-output-range"
          },
          settings: {
            stiffness: 0.5,
            damping: 0.2
          },
          resetPolicy: "reset-on-load"
        }
      ]
    },
    masks: {
      schemaVersion: "masks-file-v1",
      masks: []
    },
    drawOrder: {
      schemaVersion: "draw-order-file-v1",
      entries: []
    }
  },
  assets: {
    sourceManifest: {
      schemaVersion: "source-manifest-v1",
      sourceAssets: []
    },
    provenance: {
      schemaVersion: "provenance-file-v1",
      records: []
    },
    rights: {
      schemaVersion: "rights-file-v1",
      records: []
    }
  }
});
