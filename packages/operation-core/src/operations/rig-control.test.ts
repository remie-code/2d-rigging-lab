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

  it("commits createWarpLattice2dRigControl with deterministic rest control points", () => {
    const session = createFixtureSession();
    const core = createOperationCore({
      now: () => new Date("2026-06-01T00:05:00.000Z")
    });

    const outcome = core.commitOperation(
      session,
      createWarpLattice2dRigControlRequest({
        dryRun: false,
        childDrawableIds: ["draw_body"]
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(1);
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_body_warp_lattice"))).toMatchObject({
      kind: "warpLattice2d",
      childDrawableIds: ["draw_body"],
      bindSpace: "rigControlLocalRest",
      domainBounds: { x: 0, y: 0, width: 1, height: 1 },
      latticeColumns: 2,
      latticeRows: 2,
      restControlPoints: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 }
      ],
      interpolationMethod: "bilinear-grid-v1"
    });
    expect(outcome.logEntry?.operationType).toBe("createWarpLattice2dRigControl");
    expect(outcome.logEntry?.targetIds).toEqual([
      "rig_body_warp_lattice",
      "part_root",
      "draw_body"
    ]);
    expect(outcome.result.modelDiff?.added).toEqual([
      { kind: "rigControl", id: "rig_body_warp_lattice" }
    ]);
    expect(outcome.logEntry?.precondition.checkedTargetRefs).toEqual([
      { kind: "rigControl", id: "rig_body_warp_lattice" },
      {
        kind: "part",
        id: "part_root",
        path: "/model/rigControls/rigControls/rig_body_warp_lattice/partId"
      },
      {
        kind: "drawable",
        id: "draw_body",
        path: "/model/rigControls/rigControls/rig_body_warp_lattice/childDrawableIds"
      }
    ]);
  });

  it("dry-runs and commits createWarpDeformer with transform and Bezier divisions", () => {
    const session = createFixtureSession();
    const core = createOperationCore({
      now: () => new Date("2026-06-01T00:10:00.000Z")
    });
    core.commitOperation(session, createRotation2dRigControlRequest({ dryRun: false }));

    const dryRun = core.dryRunOperation(
      session,
      createWarpDeformerRequest({
        dryRun: true,
        basePackageRevision: 1,
        parentRigControlId: "rig_head_rotation",
        childDrawableIds: ["draw_body"]
      })
    );

    expect(dryRun.status).toBe("dry_run");
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_warp_deformer"))).toBeUndefined();
    expect(session.packageRevision).toBe(1);
    expect(session.graph.rigControlRootIds).toEqual(["rig_head_rotation"]);
    expect(core.operationLog.entries).toHaveLength(1);

    const outcome = core.commitOperation(
      session,
      createWarpDeformerRequest({
        dryRun: false,
        basePackageRevision: 1,
        parentRigControlId: "rig_head_rotation",
        childDrawableIds: ["draw_body"]
      })
    );
    const rigControl = getRigControlById(
      session.graph,
      RigControlIdSchema.parse("rig_head_warp_deformer")
    );

    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(2);
    expect(core.operationLog.entries).toHaveLength(2);
    expect(outcome.logEntry?.operationType).toBe("createWarpDeformer");
    expect(outcome.logEntry?.targetIds).toEqual([
      "rig_head_warp_deformer",
      "part_root",
      "rig_head_rotation",
      "draw_body"
    ]);
    expect(rigControl).toMatchObject({
      kind: "warpLattice2d",
      parentId: "rig_head_rotation",
      childDrawableIds: ["draw_body"],
      domainBounds: { x: 0, y: 0, width: 1, height: 1 },
      latticeColumns: 5,
      latticeRows: 4,
      interpolationMethod: "bilinear-grid-v1",
      warpDeformer: {
        schemaVersion: "warp-deformer-foundation-v0",
        userFacingKind: "warpDeformer",
        transformGrid: {
          columns: 5,
          rows: 4,
          pointCountSemantics: "controlPointCount"
        },
        bezierEditSurface: {
          columns: 3,
          rows: 2,
          editType: "cubicBezierSurfaceV1"
        },
        compatibility: {
          storageKind: "warpLattice2d",
          runtimeEvaluation: "bilinearGridV1",
          bezierEvaluation: "storedNotEvaluatedV0"
        }
      }
    });
    if (rigControl?.kind !== "warpLattice2d") {
      throw new Error("Expected committed Warp Deformer storage rig control.");
    }
    expect(rigControl.restControlPoints).toHaveLength(20);
    expect(rigControl.warpDeformer?.bezierEditSurface.restControlPoints).toHaveLength(6);
    expect(rigControl.warpDeformer?.bezierEditSurface.handles).toHaveLength(6);
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_rotation"))).toMatchObject({
      childRigControlIds: ["rig_head_warp_deformer"]
    });
    expect(session.graph.rigControlRootIds).toEqual(["rig_head_rotation"]);
    expect(outcome.logEntry?.precondition.checkedTargetRefs).toEqual([
      { kind: "rigControl", id: "rig_head_warp_deformer" },
      {
        kind: "part",
        id: "part_root",
        path: "/model/rigControls/rigControls/rig_head_warp_deformer/partId"
      },
      {
        kind: "rigControl",
        id: "rig_head_rotation",
        path: "/model/rigControls/rigControls/rig_head_rotation/childRigControlIds"
      },
      {
        kind: "drawable",
        id: "draw_body",
        path: "/model/rigControls/rigControls/rig_head_warp_deformer/childDrawableIds"
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

const createWarpLattice2dRigControlRequest = (options: {
  readonly dryRun: boolean;
  readonly basePackageRevision?: number;
  readonly displayName?: string;
  readonly childDrawableIds?: readonly string[];
  readonly childRigControlIds?: readonly string[];
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: `op_create_${(options.displayName ?? "Body Warp Lattice").toLowerCase().replaceAll(" ", "_")}`,
  actor: "test",
  surface: "testFixture",
  dryRun: options.dryRun,
  basePackageRevision: options.basePackageRevision ?? 0,
  operationType: "createWarpLattice2dRigControl",
  payload: {
    partId: "part_root",
    displayName: options.displayName ?? "Body Warp Lattice",
    childDrawableIds: options.childDrawableIds ?? [],
    childRigControlIds: options.childRigControlIds ?? [],
    domainBounds: {
      x: 0,
      y: 0,
      width: 1,
      height: 1
    },
    latticeColumns: 2,
    latticeRows: 2,
    interpolationMethod: "bilinear-grid-v1"
  }
});

const createWarpDeformerRequest = (options: {
  readonly dryRun: boolean;
  readonly basePackageRevision?: number;
  readonly displayName?: string;
  readonly parentRigControlId?: string;
  readonly childDrawableIds?: readonly string[];
  readonly childRigControlIds?: readonly string[];
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: `op_create_${(options.displayName ?? "Head Warp Deformer").toLowerCase().replaceAll(" ", "_")}`,
  actor: "test",
  surface: "testFixture",
  dryRun: options.dryRun,
  basePackageRevision: options.basePackageRevision ?? 0,
  operationType: "createWarpDeformer",
  payload: {
    partId: "part_root",
    displayName: options.displayName ?? "Head Warp Deformer",
    ...(options.parentRigControlId === undefined ? {} : { parentRigControlId: options.parentRigControlId }),
    childDrawableIds: options.childDrawableIds ?? [],
    childRigControlIds: options.childRigControlIds ?? [],
    domainBounds: {
      x: 0,
      y: 0,
      width: 1,
      height: 1
    },
    transformColumns: 5,
    transformRows: 4,
    bezierColumns: 3,
    bezierRows: 2,
    bezierEditType: "cubicBezierSurfaceV1"
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
