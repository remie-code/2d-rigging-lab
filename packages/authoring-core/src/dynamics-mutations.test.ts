import type { PackageDocumentDto } from "@private-2d-rigging-lab/package-format";
import {
  DynamicsGroupIdSchema,
  PackageIdSchema,
  ParameterIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import type { AuthoringSession } from "./authoring-session.js";
import { AuthoringMutationError } from "./authoring-mutations.js";
import { createInitialAuthoringRevision } from "./authoring-revision.js";
import {
  createDynamicsGroup,
  deleteDynamicsGroup,
  updateDynamicsGroup
} from "./dynamics-mutations.js";
import { getDynamicsGroupById } from "./dynamics-selectors.js";
import { toPackageDocument } from "./to-package-document.js";

const PRESET_DRIVER_ID = ParameterIdSchema.parse("param_face_angle_x");
const PRESET_OUTPUT_ID = ParameterIdSchema.parse("param_hair_front_sway_x");
const UPDATED_PRESET_DRIVER_ID = ParameterIdSchema.parse("param_body_angle_x");
const UPDATED_PRESET_OUTPUT_ID = ParameterIdSchema.parse("param_hair_side_sway_x");

describe("dynamics mutations", () => {
  it("creates a package-valid dynamics-file-v2 group", () => {
    const session = createDynamicsFixtureSession();
    const dynamicsGroup = createTestDynamicsGroup();

    const mutation = createDynamicsGroup(session, dynamicsGroup);
    const materialized = toPackageDocument(session, createBasePackageDocument(), {
      updatedAt: "2026-05-31T00:00:00.000Z"
    });

    expect(mutation.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);
    expect(getDynamicsGroupById(session.graph, dynamicsGroup.dynamicsGroupId)).toEqual(dynamicsGroup);
    expect(session.graph.stableOrder).toEqual([
      "param_face_yaw",
      "param_hair_sway",
      "dyn_hair_sway"
    ]);
    expect(materialized.model.dynamics.dynamicsGroups).toEqual([dynamicsGroup]);
    expect(materialized.model.dynamics.schemaVersion).toBe("dynamics-file-v2");
  });

  it("allows additive outputs to target authored scalar parameters", () => {
    const session = createDynamicsFixtureSession({
      outputValueSource: "authoredInput"
    });
    const dynamicsGroup = createTestDynamicsGroup();

    createDynamicsGroup(session, dynamicsGroup);

    expect(session.graph.dynamicsGroups).toEqual([dynamicsGroup]);
    expect(session.authoringRevision).toBe(1);
  });

  it("creates and updates dynamics groups with initialized preset parameter refs from an empty graph", () => {
    const session = createEmptyPresetDynamicsFixtureSession();
    const dynamicsGroup = createInitializedPresetDynamicsGroup();

    const mutation = createDynamicsGroup(session, dynamicsGroup);

    expect(session.graph.parameters).toEqual([]);
    expect(mutation.dynamicsGroup.inputs[0]?.parameterId).toBe(PRESET_DRIVER_ID);
    expect(mutation.dynamicsGroup.outputs[0]?.parameterId).toBe(PRESET_OUTPUT_ID);

    const update = updateDynamicsGroup(session, {
      dynamicsGroupId: dynamicsGroup.dynamicsGroupId,
      inputs: [
        {
          ...dynamicsGroup.inputs[0]!,
          parameterId: UPDATED_PRESET_DRIVER_ID,
          normalization: {
            min: -10,
            center: 0,
            max: 10
          }
        }
      ],
      outputs: [
        {
          ...dynamicsGroup.outputs[0]!,
          parameterId: UPDATED_PRESET_OUTPUT_ID
        }
      ]
    });

    expect(session.graph.parameters).toEqual([]);
    expect(update.dynamicsGroup.inputs[0]?.parameterId).toBe(UPDATED_PRESET_DRIVER_ID);
    expect(update.dynamicsGroup.outputs[0]?.parameterId).toBe(UPDATED_PRESET_OUTPUT_ID);
    expect(session.authoringRevision).toBe(2);
  });

  it("rejects duplicate additive output parameter ownership", () => {
    const session = createDynamicsFixtureSession();
    createDynamicsGroup(session, createTestDynamicsGroup());

    expect(() =>
      createDynamicsGroup(session, {
        ...createTestDynamicsGroup(),
        dynamicsGroupId: DynamicsGroupIdSchema.parse("dyn_second_hair_sway"),
        displayName: "Second Hair Sway"
      })
    ).toThrow(AuthoringMutationError);
    expect(session.graph.dynamicsGroups).toHaveLength(1);
    expect(session.authoringRevision).toBe(1);
  });

  it("updates and deletes v2 dynamics groups", () => {
    const session = createDynamicsFixtureSession();
    const dynamicsGroup = createTestDynamicsGroup();
    createDynamicsGroup(session, dynamicsGroup);

    const update = updateDynamicsGroup(session, {
      dynamicsGroupId: dynamicsGroup.dynamicsGroupId,
      displayName: "Updated Hair Sway",
      outputs: [
        {
          parameterId: ParameterIdSchema.parse("param_hair_sway"),
          kind: "angle",
          strength: 0.5,
          invert: true,
          limit: 0.4
        }
      ]
    });

    expect(update.dynamicsGroup.displayName).toBe("Updated Hair Sway");
    expect(update.dynamicsGroup.outputs[0]).toMatchObject({ strength: 0.5, invert: true, limit: 0.4 });

    const deletion = deleteDynamicsGroup(session, dynamicsGroup.dynamicsGroupId);

    expect(deletion.dynamicsGroup.dynamicsGroupId).toBe(dynamicsGroup.dynamicsGroupId);
    expect(session.graph.dynamicsGroups).toEqual([]);
    expect(session.graph.stableOrder).toEqual(["param_face_yaw", "param_hair_sway"]);
    expect(session.authoringRevision).toBe(3);
  });
});

const createTestDynamicsGroup = (): Parameters<typeof createDynamicsGroup>[1] => ({
  dynamicsGroupId: DynamicsGroupIdSchema.parse("dyn_hair_sway"),
  displayName: "Hair Sway",
  enabled: true,
  inputs: [
    {
      parameterId: ParameterIdSchema.parse("param_face_yaw"),
      kind: "angle",
      influencePercent: 100,
      invert: false,
      normalization: {
        min: -1,
        center: 0,
        max: 1
      }
    }
  ],
  pendulums: [
    {
      length: 1,
      sway: 0.35,
      reactionSpeed: 8,
      convergenceSpeed: 4
    }
  ],
  outputs: [
    {
      parameterId: ParameterIdSchema.parse("param_hair_sway"),
      kind: "angle",
      strength: 1,
      invert: false,
      limit: 1
    }
  ]
});

const createInitializedPresetDynamicsGroup = (): Parameters<typeof createDynamicsGroup>[1] => ({
  dynamicsGroupId: DynamicsGroupIdSchema.parse("dyn_initialized_preset_sway"),
  displayName: "Initialized Preset Sway",
  enabled: true,
  inputs: [
    {
      parameterId: PRESET_DRIVER_ID,
      kind: "angle",
      influencePercent: 100,
      invert: false,
      normalization: {
        min: -30,
        center: 0,
        max: 30
      }
    }
  ],
  pendulums: [
    {
      length: 1,
      sway: 0.35,
      reactionSpeed: 8,
      convergenceSpeed: 4
    }
  ],
  outputs: [
    {
      parameterId: PRESET_OUTPUT_ID,
      kind: "angle",
      strength: 1,
      invert: false,
      limit: 1
    }
  ]
});

const createEmptyPresetDynamicsFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_empty_preset_dynamics_mutation_test"),
    packageDisplayName: "Empty Preset Dynamics Mutation Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: {
      width: 1024,
      height: 1024
    },
    parts: [],
    drawables: [],
    meshes: [],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [],
    rigControlRootIds: [],
    stableOrder: [],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});

const createDynamicsFixtureSession = (options: {
  readonly outputValueSource?: "authoredInput" | "computedDynamics" | "debugOverride";
} = {}): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_dynamics_mutation_test"),
    packageDisplayName: "Dynamics Mutation Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: {
      width: 1024,
      height: 1024
    },
    parts: [],
    drawables: [],
    meshes: [],
    parameters: [
      {
        parameterId: ParameterIdSchema.parse("param_face_yaw"),
        displayName: "Face Yaw",
        semanticRole: "face",
        valueSource: "authoredInput",
        min: -1,
        max: 1,
        default: 0,
        recommendedUiStep: 0.01
      },
      {
        parameterId: ParameterIdSchema.parse("param_hair_sway"),
        displayName: "Hair Sway",
        semanticRole: "dynamics",
        valueSource: options.outputValueSource ?? "authoredInput",
        min: -1,
        max: 1,
        default: 0,
        recommendedUiStep: 0.01
      }
    ],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [],
    rigControlRootIds: [],
    stableOrder: ["param_face_yaw", "param_hair_sway"],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});

const createBasePackageDocument = (): PackageDocumentDto => ({
  manifest: {
    schemaVersion: "open-model-package-manifest-v1",
    packageId: PackageIdSchema.parse("pkg_dynamics_mutation_test"),
    packageDisplayName: "Dynamics Mutation Test",
    formatVersion: "open-model-package-v1",
    packageRevision: 0,
    createdAt: "2026-05-31T00:00:00.000Z",
    updatedAt: "2026-05-31T00:00:00.000Z",
    schemaVersions: {
      manifest: "open-model-package-manifest-v1"
    },
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
        width: 1024,
        height: 1024
      },
      parts: [],
      rigControlRootIds: [],
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
      parameters: []
    },
    keyforms: {
      schemaVersion: "keyforms-file-v1",
      keyformSets: []
    },
    rigControls: {
      schemaVersion: "rig-controls-file-v1",
      rigControls: []
    },
    dynamics: {
      schemaVersion: "dynamics-file-v2",
      dynamicsGroups: []
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
