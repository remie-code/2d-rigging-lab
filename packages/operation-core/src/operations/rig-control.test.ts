import {
  createInitialAuthoringRevision,
  getRigControlById
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createOperationCore } from "../operation-core.js";

describe("rig control operation handlers", () => {
  it("dry-runs createRotation2dRigControl without mutating the original session", () => {
    const session = createFixtureSession();
    const core = createOperationCore();

    const result = core.dryRunOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: true,
        childDrawableIds: ["draw_body"]
      })
    );

    expect(result.status).toBe("dry_run");
    expect(result.modelDiff?.added).toEqual([{ kind: "rigControl", id: "rig_head_rotation" }]);
    expect(result.modelDiff?.changed.map((change) => change.target)).toEqual(
      expect.arrayContaining([
        { kind: "rigControl", id: "rig_head_rotation" },
        { kind: "drawable", id: "draw_body", path: "/model/rigControls/rigControls/rig_head_rotation/childDrawableIds" }
      ])
    );
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_rotation"))).toBeUndefined();
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
    expect(core.operationLog.entries).toHaveLength(0);
  });

  it("commits createRotation2dRigControl and appends target refs to the operation log", () => {
    const session = createFixtureSession();
    const core = createOperationCore({
      now: () => new Date("2026-06-01T00:00:00.000Z")
    });

    const outcome = core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        childDrawableIds: ["draw_body"]
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(1);
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_rotation"))).toMatchObject({
      kind: "rotation2d",
      childDrawableIds: ["draw_body"],
      restTranslation: { x: 0, y: 0 },
      restScale: { x: 1, y: 1 }
    });
    expect(outcome.logEntry?.operationType).toBe("createRotation2dRigControl");
    expect(outcome.logEntry?.targetIds).toEqual([
      "rig_head_rotation",
      "part_root",
      "draw_body"
    ]);
    expect(outcome.logEntry?.precondition.checkedTargetRefs).toEqual([
      { kind: "rigControl", id: "rig_head_rotation" },
      {
        kind: "part",
        id: "part_root",
        path: "/model/rigControls/rigControls/rig_head_rotation/partId"
      },
      {
        kind: "drawable",
        id: "draw_body",
        path: "/model/rigControls/rigControls/rig_head_rotation/childDrawableIds"
      }
    ]);
  });

  it("commits bindRigControlChild for drawable children", () => {
    const session = createFixtureSession();
    const core = createOperationCore();

    core.commitOperation(session, createRotation2dRigControlRequest({ dryRun: false }));
    const outcome = core.commitOperation(
      session,
      createBindRigControlChildRequest({
        dryRun: false,
        basePackageRevision: 1,
        child: { kind: "drawable", id: "draw_body" }
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(2);
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_rotation"))).toMatchObject({
      childDrawableIds: ["draw_body"]
    });
    expect(outcome.logEntry?.targetIds).toEqual(["rig_head_rotation", "draw_body"]);
    expect(outcome.logEntry?.precondition.checkedTargetRefs).toEqual([
      { kind: "rigControl", id: "rig_head_rotation" },
      {
        kind: "drawable",
        id: "draw_body",
        path: "/model/rigControls/rigControls/rig_head_rotation/childDrawableIds"
      }
    ]);
  });

  it("dry-runs and commits bindRigControlChild for child rig controls", () => {
    const session = createFixtureSession();
    const core = createOperationCore();

    core.commitOperation(session, createRotation2dRigControlRequest({ dryRun: false }));
    core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        basePackageRevision: 1,
        displayName: "Child Rotation"
      })
    );

    const dryRun = core.dryRunOperation(
      session,
      createBindRigControlChildRequest({
        dryRun: true,
        basePackageRevision: 2,
        child: { kind: "rigControl", id: "rig_child_rotation" }
      })
    );
    expect(dryRun.status).toBe("dry_run");
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_child_rotation"))?.parentId).toBeUndefined();
    expect(session.graph.rigControlRootIds).toEqual([
      "rig_head_rotation",
      "rig_child_rotation"
    ]);

    const outcome = core.commitOperation(
      session,
      createBindRigControlChildRequest({
        dryRun: false,
        basePackageRevision: 2,
        child: { kind: "rigControl", id: "rig_child_rotation" }
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(3);
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_rotation"))).toMatchObject({
      childRigControlIds: ["rig_child_rotation"]
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_child_rotation"))).toMatchObject({
      parentId: "rig_head_rotation"
    });
    expect(session.graph.rigControlRootIds).toEqual(["rig_head_rotation"]);
    expect(outcome.result.modelDiff?.changed.map((change) => change.target)).toEqual(
      expect.arrayContaining([
        { kind: "rigControl", id: "rig_head_rotation" },
        { kind: "rigControl", id: "rig_child_rotation" },
        { kind: "package", id: "pkg_rig_control_operation_test", path: "/model/graph/rigControlRootIds" }
      ])
    );
  });

  it("rejects unsupported bindRigControlChild target kinds deterministically", () => {
    const session = createFixtureSession();
    const core = createOperationCore();
    core.commitOperation(session, createRotation2dRigControlRequest({ dryRun: false }));

    const outcome = core.commitOperation(
      session,
      createBindRigControlChildRequest({
        dryRun: false,
        basePackageRevision: 1,
        child: { kind: "parameter", id: "param_face_yaw" }
      })
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]?.checkId).toBe(
      "operation.bindRigControlChild.invalidChildKind"
    );
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(1);
    expect(outcome.operationLogLength).toBe(1);
  });
});

const createRotation2dRigControlRequest = (options: {
  readonly dryRun: boolean;
  readonly basePackageRevision?: number;
  readonly displayName?: string;
  readonly childDrawableIds?: readonly string[];
  readonly childRigControlIds?: readonly string[];
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: `op_create_${(options.displayName ?? "Head Rotation").toLowerCase().replaceAll(" ", "_")}`,
  actor: "test",
  surface: "testFixture",
  dryRun: options.dryRun,
  basePackageRevision: options.basePackageRevision ?? 0,
  operationType: "createRotation2dRigControl",
  payload: {
    partId: "part_root",
    displayName: options.displayName ?? "Head Rotation",
    childDrawableIds: options.childDrawableIds ?? [],
    childRigControlIds: options.childRigControlIds ?? [],
    pivot: {
      x: 64,
      y: 64
    },
    restAngleDegrees: 0
  }
});

const createBindRigControlChildRequest = (options: {
  readonly dryRun: boolean;
  readonly basePackageRevision?: number;
  readonly child: { readonly kind: string; readonly id: string };
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: `op_bind_rig_child_${options.child.id}`,
  actor: "test",
  surface: "testFixture",
  dryRun: options.dryRun,
  basePackageRevision: options.basePackageRevision ?? 0,
  operationType: "bindRigControlChild",
  payload: {
    parentRigControlId: "rig_head_rotation",
    child: options.child
  }
});

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_rig_control_operation_test"),
    packageDisplayName: "Rig Control Operation Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 128, height: 128 },
    parts: [
      {
        partId: PartIdSchema.parse("part_root"),
        displayName: "Root",
        childPartIds: [],
        drawableIds: [DrawableIdSchema.parse("draw_body")]
      }
    ],
    drawables: [
      {
        drawableId: DrawableIdSchema.parse("draw_body"),
        displayName: "Body",
        partId: PartIdSchema.parse("part_root"),
        sourceAssetId: SourceAssetIdSchema.parse("src_body"),
        textureId: TextureIdSchema.parse("tex_body"),
        meshId: MeshIdSchema.parse("mesh_body"),
        defaultOpacity: 1,
        runtimeVisibility: true,
        baseDrawOrder: 0,
        sourceProvenanceId: ProvenanceIdSchema.parse("prov_body")
      }
    ],
    meshes: [
      {
        meshId: MeshIdSchema.parse("mesh_body"),
        drawableId: DrawableIdSchema.parse("draw_body"),
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
        vertexStableIds: ["vtx_body_0", "vtx_body_1", "vtx_body_2"],
        bounds: { x: 0, y: 0, width: 1, height: 1 },
        generationProvenanceId: ProvenanceIdSchema.parse("prov_body")
      }
    ],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [],
    rigControlRootIds: [],
    stableOrder: ["draw_body"],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});
