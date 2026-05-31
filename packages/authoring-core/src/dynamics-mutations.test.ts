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
import { createDynamicsGroup } from "./dynamics-mutations.js";
import { getDynamicsGroupById } from "./dynamics-selectors.js";
import { toPackageDocument } from "./to-package-document.js";

describe("dynamics mutations", () => {
  it("creates a package-valid Minimum Open Dynamics v1 group", () => {
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
  });

  it("rejects output parameters that are not computedDynamics", () => {
    const session = createDynamicsFixtureSession({
      outputValueSource: "authoredInput"
    });

    expect(() => createDynamicsGroup(session, createTestDynamicsGroup())).toThrow(
      AuthoringMutationError
    );
    expect(session.graph.dynamicsGroups).toEqual([]);
    expect(session.authoringRevision).toBe(0);
  });

  it("rejects duplicate computed output parameter ownership", () => {
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
});

const createTestDynamicsGroup = (): Parameters<typeof createDynamicsGroup>[1] => ({
  dynamicsGroupId: DynamicsGroupIdSchema.parse("dyn_hair_sway"),
  displayName: "Hair Sway",
  enabled: true,
  solverKind: "scalarDampedFollowV1",
  drivers: [
    {
      driverId: "driver_hair_sway_face_yaw",
      sourceParameterId: ParameterIdSchema.parse("param_face_yaw"),
      inputScale: 1,
      inputOffset: 0,
      invert: false
    }
  ],
  output: {
    outputId: "output_hair_sway",
    targetParameterId: ParameterIdSchema.parse("param_hair_sway"),
    outputScale: 1,
    outputOffset: 0,
    min: -1,
    max: 1,
    clampPolicy: "clamp-to-output-range"
  },
  settings: {
    stiffness: 0.35,
    damping: 0.7
  },
  resetPolicy: "reset-on-load"
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
        valueSource: options.outputValueSource ?? "computedDynamics",
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
      schemaVersion: "dynamics-file-v1",
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
