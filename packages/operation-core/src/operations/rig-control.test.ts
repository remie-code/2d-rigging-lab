import {
  createInitialAuthoringRevision,
  getRigControlById
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
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
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_rotation"))).not.toHaveProperty(
      "partId"
    );
    expect(outcome.logEntry?.operationType).toBe("createRotation2dRigControl");
    expect(outcome.logEntry?.targetIds).toEqual([
      "rig_head_rotation",
      "draw_body"
    ]);
    expect(outcome.logEntry?.precondition.checkedTargetRefs).toEqual([
      { kind: "rigControl", id: "rig_head_rotation" },
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
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_body_warp_lattice"))).not.toHaveProperty(
      "partId"
    );
    expect(outcome.logEntry?.operationType).toBe("createWarpLattice2dRigControl");
    expect(outcome.logEntry?.targetIds).toEqual([
      "rig_body_warp_lattice",
      "draw_body"
    ]);
    expect(outcome.result.modelDiff?.added).toEqual([
      { kind: "rigControl", id: "rig_body_warp_lattice" }
    ]);
    expect(outcome.logEntry?.precondition.checkedTargetRefs).toEqual([
      { kind: "rigControl", id: "rig_body_warp_lattice" },
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
    expect(rigControl).not.toHaveProperty("partId");
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

  it("accepts legacy partId in create rig-control payloads without storing or targeting it", () => {
    const session = createFixtureSession();
    const core = createOperationCore();

    const rotation = core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        displayName: "Legacy Rotation",
        partId: "part_root"
      })
    );
    const warpLattice = core.commitOperation(
      session,
      createWarpLattice2dRigControlRequest({
        dryRun: false,
        basePackageRevision: 1,
        displayName: "Legacy Warp Lattice",
        partId: "part_root"
      })
    );
    const warpDeformer = core.commitOperation(
      session,
      createWarpDeformerRequest({
        dryRun: false,
        basePackageRevision: 2,
        displayName: "Legacy Warp Deformer",
        partId: "part_root"
      })
    );

    expect(rotation.result.status).toBe("committed");
    expect(warpLattice.result.status).toBe("committed");
    expect(warpDeformer.result.status).toBe("committed");
    for (const rigControlId of [
      "rig_legacy_rotation",
      "rig_legacy_warp_lattice",
      "rig_legacy_warp_deformer"
    ]) {
      expect(getRigControlById(session.graph, RigControlIdSchema.parse(rigControlId))).not.toHaveProperty("partId");
    }
    for (const outcome of [rotation, warpLattice, warpDeformer]) {
      expect(outcome.logEntry?.targetIds).not.toContain("part_root");
      expect(outcome.logEntry?.precondition.checkedTargetRefs).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: "part", id: "part_root" })])
      );
    }
  });

  it("inserts createWarpDeformer between an existing parent deformer and drawable child", () => {
    const session = createFixtureSession();
    const core = createOperationCore({
      now: () => new Date("2026-06-01T00:15:00.000Z")
    });
    core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        childDrawableIds: ["draw_body"]
      })
    );

    const dryRun = core.dryRunOperation(
      session,
      createWarpDeformerRequest({
        dryRun: true,
        basePackageRevision: 1,
        parentRigControlId: "rig_head_rotation",
        insertBeforeChild: { kind: "drawable", id: "draw_body" },
        opacityMultiplier: 0.6
      })
    );

    expect(dryRun.status).toBe("dry_run");
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_warp_deformer"))).toBeUndefined();
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_rotation"))).toMatchObject({
      childDrawableIds: ["draw_body"],
      childRigControlIds: []
    });

    const outcome = core.commitOperation(
      session,
      createWarpDeformerRequest({
        dryRun: false,
        basePackageRevision: 1,
        parentRigControlId: "rig_head_rotation",
        insertBeforeChild: { kind: "drawable", id: "draw_body" },
        opacityMultiplier: 0.6
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_rotation"))).toMatchObject({
      childDrawableIds: [],
      childRigControlIds: ["rig_head_warp_deformer"]
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_warp_deformer"))).toMatchObject({
      parentId: "rig_head_rotation",
      childDrawableIds: ["draw_body"],
      opacityMultiplier: 0.6
    });
    expect(outcome.result.modelDiff?.changed.map((change) => change.target)).toEqual(
      expect.arrayContaining([
        { kind: "rigControl", id: "rig_head_rotation" },
        { kind: "drawable", id: "draw_body", path: "/model/rigControls/rigControls/rig_head_warp_deformer/childDrawableIds" }
      ])
    );
  });

  it("inserts createRotation2dRigControl between an existing parent deformer and drawable child", () => {
    const session = createFixtureSession();
    const core = createOperationCore();
    core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        childDrawableIds: ["draw_body"]
      })
    );
    const partsBefore = structuredClone(session.graph.parts);
    const drawablesBefore = structuredClone(session.graph.drawables);
    const drawOrderBefore = structuredClone(session.graph.drawOrder);

    const dryRun = core.dryRunOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: true,
        basePackageRevision: 1,
        displayName: "Inserted Rotation",
        parentRigControlId: "rig_head_rotation",
        insertBeforeChild: { kind: "drawable", id: "draw_body" },
        opacityMultiplier: 0.8
      })
    );

    expect(dryRun.status).toBe("dry_run");
    expect(dryRun.modelDiff?.added).toEqual([{ kind: "rigControl", id: "rig_inserted_rotation" }]);
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_inserted_rotation"))).toBeUndefined();
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_rotation"))).toMatchObject({
      childDrawableIds: ["draw_body"],
      childRigControlIds: []
    });
    expect(session.packageRevision).toBe(1);

    const outcome = core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        basePackageRevision: 1,
        displayName: "Inserted Rotation",
        parentRigControlId: "rig_head_rotation",
        insertBeforeChild: { kind: "drawable", id: "draw_body" },
        opacityMultiplier: 0.8
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(2);
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_rotation"))).toMatchObject({
      childDrawableIds: [],
      childRigControlIds: ["rig_inserted_rotation"]
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_inserted_rotation"))).toMatchObject({
      kind: "rotation2d",
      parentId: "rig_head_rotation",
      childDrawableIds: ["draw_body"],
      opacityMultiplier: 0.8
    });
    expect(session.graph.parts).toEqual(partsBefore);
    expect(session.graph.drawables).toEqual(drawablesBefore);
    expect(session.graph.drawOrder).toEqual(drawOrderBefore);
    expect(findChangedFieldPaths(outcome.result, "rig_head_rotation")).toEqual(
      expect.arrayContaining([
        "/model/rigControls/rigControls/rig_head_rotation/childDrawableIds",
        "/model/rigControls/rigControls/rig_head_rotation/childRigControlIds"
      ])
    );
  });

  it("inserts createWarpDeformer between an existing parent deformer and child rig control", () => {
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
    core.commitOperation(
      session,
      createBindRigControlChildRequest({
        dryRun: false,
        basePackageRevision: 2,
        child: { kind: "rigControl", id: "rig_child_rotation" }
      })
    );
    const partsBefore = structuredClone(session.graph.parts);
    const drawablesBefore = structuredClone(session.graph.drawables);
    const drawOrderBefore = structuredClone(session.graph.drawOrder);

    const dryRun = core.dryRunOperation(
      session,
      createWarpDeformerRequest({
        dryRun: true,
        basePackageRevision: 3,
        displayName: "Inserted Warp Deformer",
        parentRigControlId: "rig_head_rotation",
        insertBeforeChild: { kind: "rigControl", id: "rig_child_rotation" },
        opacityMultiplier: 0.7
      })
    );

    expect(dryRun.status).toBe("dry_run");
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_inserted_warp_deformer"))).toBeUndefined();
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_rotation"))).toMatchObject({
      childRigControlIds: ["rig_child_rotation"]
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_child_rotation"))).toMatchObject({
      parentId: "rig_head_rotation"
    });
    expect(session.packageRevision).toBe(3);
    expect(core.operationLog.entries).toHaveLength(3);

    const outcome = core.commitOperation(
      session,
      createWarpDeformerRequest({
        dryRun: false,
        basePackageRevision: 3,
        displayName: "Inserted Warp Deformer",
        parentRigControlId: "rig_head_rotation",
        insertBeforeChild: { kind: "rigControl", id: "rig_child_rotation" },
        opacityMultiplier: 0.7
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_rotation"))).toMatchObject({
      childRigControlIds: ["rig_inserted_warp_deformer"]
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_inserted_warp_deformer"))).toMatchObject({
      parentId: "rig_head_rotation",
      childRigControlIds: ["rig_child_rotation"],
      opacityMultiplier: 0.7
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_child_rotation"))).toMatchObject({
      parentId: "rig_inserted_warp_deformer"
    });
    expect(session.graph.parts).toEqual(partsBefore);
    expect(session.graph.drawables).toEqual(drawablesBefore);
    expect(session.graph.drawOrder).toEqual(drawOrderBefore);
    expect(outcome.result.modelDiff?.added).toEqual([{ kind: "rigControl", id: "rig_inserted_warp_deformer" }]);
    expect(findChangedFieldPaths(outcome.result, "rig_head_rotation")).toEqual(
      expect.arrayContaining([
        "/model/rigControls/rigControls/rig_head_rotation/childRigControlIds"
      ])
    );
    expect(findChangedFieldPaths(outcome.result, "rig_child_rotation")).toEqual(
      expect.arrayContaining([
        "/model/rigControls/rigControls/rig_child_rotation/parentId"
      ])
    );
  });

  it("commits createRotation2dRigControl with wrapChildren for multiple parented drawable children", () => {
    const session = createFixtureSession();
    const core = createOperationCore();
    addFixtureDrawable(session, "draw_a", "A");
    addFixtureDrawable(session, "draw_b", "B");
    addFixtureDrawable(session, "draw_c", "C");
    core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        displayName: "Parent Rotation",
        childDrawableIds: ["draw_a", "draw_b", "draw_c"]
      })
    );
    const parentBefore = structuredClone(
      getRigControlById(session.graph, RigControlIdSchema.parse("rig_parent_rotation"))
    );
    if (parentBefore === undefined) {
      throw new Error("Expected parent rotation before wrap.");
    }

    const outcome = core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        basePackageRevision: 1,
        displayName: "Wrapped Rotation",
        wrapChildren: [
          { kind: "drawable", id: "draw_a" },
          { kind: "drawable", id: "draw_b" }
        ]
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(outcome.logEntry?.targetIds).toEqual([
      "rig_wrapped_rotation",
      "rig_parent_rotation",
      "draw_a",
      "draw_b"
    ]);
    expect(outcome.result.modelDiff?.added).toEqual([{ kind: "rigControl", id: "rig_wrapped_rotation" }]);
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_parent_rotation"))).toEqual({
      ...parentBefore,
      childDrawableIds: ["draw_c"],
      childRigControlIds: ["rig_wrapped_rotation"]
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_wrapped_rotation"))).toMatchObject({
      parentId: "rig_parent_rotation",
      childDrawableIds: ["draw_a", "draw_b"],
      childRigControlIds: []
    });
    expect(session.graph.rigControlRootIds).toEqual(["rig_parent_rotation"]);
    expect(findChangedFields(outcome.result, "rig_parent_rotation")).toEqual(
      expect.arrayContaining([
        {
          path: "/model/rigControls/rigControls/rig_parent_rotation/childDrawableIds",
          before: ["draw_a", "draw_b", "draw_c"],
          after: ["draw_c"]
        },
        {
          path: "/model/rigControls/rigControls/rig_parent_rotation/childRigControlIds",
          before: [],
          after: ["rig_wrapped_rotation"]
        }
      ])
    );
    expect(findChangedFieldPaths(outcome.result, "rig_parent_rotation")).toEqual(
      expect.arrayContaining([
        "/model/rigControls/rigControls/rig_parent_rotation/childDrawableIds",
        "/model/rigControls/rigControls/rig_parent_rotation/childRigControlIds"
      ])
    );
  });

  it("commits createWarpDeformer with wrapChildren for mixed siblings and an unbound drawable", () => {
    const session = createFixtureSession();
    const core = createOperationCore();
    addFixtureDrawable(session, "draw_a", "A");
    addFixtureDrawable(session, "draw_unbound", "Unbound");
    core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        displayName: "Parent Rotation",
        childDrawableIds: ["draw_a"]
      })
    );
    core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        basePackageRevision: 1,
        displayName: "Child Rotation"
      })
    );
    core.commitOperation(
      session,
      createBindRigControlChildRequest({
        dryRun: false,
        basePackageRevision: 2,
        parentRigControlId: "rig_parent_rotation",
        child: { kind: "rigControl", id: "rig_child_rotation" }
      })
    );
    const parentBefore = structuredClone(
      getRigControlById(session.graph, RigControlIdSchema.parse("rig_parent_rotation"))
    );
    const childBefore = structuredClone(
      getRigControlById(session.graph, RigControlIdSchema.parse("rig_child_rotation"))
    );
    if (parentBefore === undefined || childBefore === undefined) {
      throw new Error("Expected parent and child rig controls before wrap.");
    }

    const outcome = core.commitOperation(
      session,
      createWarpDeformerRequest({
        dryRun: false,
        basePackageRevision: 3,
        displayName: "Wrapped Warp Deformer",
        wrapChildren: [
          { kind: "drawable", id: "draw_a" },
          { kind: "rigControl", id: "rig_child_rotation" },
          { kind: "drawable", id: "draw_unbound" }
        ],
        domainBounds: { x: 10, y: 20, width: 30, height: 40 }
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(outcome.result.modelDiff?.added).toEqual([{ kind: "rigControl", id: "rig_wrapped_warp_deformer" }]);
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_parent_rotation"))).toEqual({
      ...parentBefore,
      childDrawableIds: [],
      childRigControlIds: ["rig_wrapped_warp_deformer"]
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_wrapped_warp_deformer"))).toMatchObject({
      kind: "warpLattice2d",
      parentId: "rig_parent_rotation",
      childDrawableIds: ["draw_a", "draw_unbound"],
      childRigControlIds: ["rig_child_rotation"],
      domainBounds: { x: 10, y: 20, width: 30, height: 40 }
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_child_rotation"))).toEqual({
      ...childBefore,
      parentId: "rig_wrapped_warp_deformer"
    });
    expect(findChangedFields(outcome.result, "rig_parent_rotation")).toEqual(
      expect.arrayContaining([
        {
          path: "/model/rigControls/rigControls/rig_parent_rotation/childDrawableIds",
          before: ["draw_a"],
          after: []
        },
        {
          path: "/model/rigControls/rigControls/rig_parent_rotation/childRigControlIds",
          before: ["rig_child_rotation"],
          after: ["rig_wrapped_warp_deformer"]
        }
      ])
    );
    expect(findChangedFields(outcome.result, "rig_child_rotation")).toEqual([
      {
        path: "/model/rigControls/rigControls/rig_child_rotation/parentId",
        before: "rig_parent_rotation",
        after: "rig_wrapped_warp_deformer"
      }
    ]);
    expect(outcome.result.modelDiff?.changed.map((change) => change.target)).toEqual(
      expect.arrayContaining([
        { kind: "rigControl", id: "rig_parent_rotation" },
        { kind: "rigControl", id: "rig_child_rotation" },
        { kind: "drawable", id: "draw_a", path: "/model/rigControls/rigControls/rig_wrapped_warp_deformer/childDrawableIds" },
        { kind: "drawable", id: "draw_unbound", path: "/model/rigControls/rigControls/rig_wrapped_warp_deformer/childDrawableIds" }
      ])
    );
  });

  it("commits createRotation2dRigControl with wrapChildren for root rig controls", () => {
    const session = createFixtureSession();
    const core = createOperationCore();
    addFixtureDrawable(session, "draw_unbound", "Unbound");
    core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        displayName: "Root A"
      })
    );
    core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        basePackageRevision: 1,
        displayName: "Root B"
      })
    );
    const rootABefore = structuredClone(
      getRigControlById(session.graph, RigControlIdSchema.parse("rig_root_a"))
    );
    const rootBBefore = structuredClone(
      getRigControlById(session.graph, RigControlIdSchema.parse("rig_root_b"))
    );
    if (rootABefore === undefined || rootBBefore === undefined) {
      throw new Error("Expected root rig controls before wrap.");
    }

    const outcome = core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        basePackageRevision: 2,
        displayName: "Root Wrapper",
        wrapChildren: [
          { kind: "rigControl", id: "rig_root_a" },
          { kind: "rigControl", id: "rig_root_b" },
          { kind: "drawable", id: "draw_unbound" }
        ]
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(outcome.logEntry?.targetIds).toEqual([
      "rig_root_wrapper",
      "rig_root_a",
      "rig_root_b",
      "draw_unbound"
    ]);
    expect(outcome.result.modelDiff?.added).toEqual([{ kind: "rigControl", id: "rig_root_wrapper" }]);
    expect(session.graph.rigControlRootIds).toEqual(["rig_root_wrapper"]);
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_root_wrapper"))).toMatchObject({
      childDrawableIds: ["draw_unbound"],
      childRigControlIds: ["rig_root_a", "rig_root_b"]
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_root_a"))).toEqual({
      ...rootABefore,
      parentId: "rig_root_wrapper"
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_root_b"))).toEqual({
      ...rootBBefore,
      parentId: "rig_root_wrapper"
    });
    expect(findChangedFields(outcome.result, "rig_root_a")).toEqual([
      {
        path: "/model/rigControls/rigControls/rig_root_a/parentId",
        before: null,
        after: "rig_root_wrapper"
      }
    ]);
    expect(findChangedFields(outcome.result, "rig_root_b")).toEqual([
      {
        path: "/model/rigControls/rigControls/rig_root_b/parentId",
        before: null,
        after: "rig_root_wrapper"
      }
    ]);
    expect(outcome.result.modelDiff?.changed).toEqual(
      expect.arrayContaining([
        {
          target: {
            kind: "package",
            id: "pkg_rig_control_operation_test",
            path: "/model/graph/rigControlRootIds"
          },
          fields: [
            {
              path: "/model/graph/rigControlRootIds",
              before: ["rig_root_a", "rig_root_b"],
              after: ["rig_root_wrapper"]
            }
          ]
        }
      ])
    );
  });

  it("rejects invalid wrapChildren create operations without mutating", () => {
    const session = createFixtureSession();
    const core = createOperationCore();
    addFixtureDrawable(session, "draw_a", "A");
    addFixtureDrawable(session, "draw_b", "B");
    core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        displayName: "Parent A",
        childDrawableIds: ["draw_a"]
      })
    );
    core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        basePackageRevision: 1,
        displayName: "Parent B",
        childDrawableIds: ["draw_b"]
      })
    );
    core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        basePackageRevision: 2,
        displayName: "Child"
      })
    );
    core.commitOperation(
      session,
      createBindRigControlChildRequest({
        dryRun: false,
        basePackageRevision: 3,
        parentRigControlId: "rig_parent_a",
        child: { kind: "rigControl", id: "rig_child" }
      })
    );
    const beforeGraph = structuredClone(session.graph);

    const mixedParents = core.commitOperation(
      session,
      createWarpDeformerRequest({
        dryRun: false,
        basePackageRevision: 4,
        displayName: "Rejected Mixed Parents",
        wrapChildren: [
          { kind: "drawable", id: "draw_a" },
          { kind: "drawable", id: "draw_b" }
        ]
      })
    );
    const duplicateTargets = core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        basePackageRevision: 4,
        displayName: "Rejected Duplicate",
        wrapChildren: [
          { kind: "drawable", id: "draw_a" },
          { kind: "drawable", id: "draw_a" }
        ]
      })
    );
    const ancestorDescendant = core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        basePackageRevision: 4,
        displayName: "Rejected Ancestor",
        wrapChildren: [
          { kind: "rigControl", id: "rig_parent_a" },
          { kind: "rigControl", id: "rig_child" }
        ]
      })
    );
    const missingChild = core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        basePackageRevision: 4,
        displayName: "Rejected Missing Child",
        wrapChildren: [
          { kind: "drawable", id: "draw_missing" }
        ]
      })
    );
    const parentMismatch = core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        basePackageRevision: 4,
        displayName: "Rejected Parent Mismatch",
        parentRigControlId: "rig_parent_b",
        wrapChildren: [
          { kind: "drawable", id: "draw_a" }
        ]
      })
    );
    const childListMismatch = core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        basePackageRevision: 4,
        displayName: "Rejected Child List Mismatch",
        childDrawableIds: ["draw_b"],
        wrapChildren: [
          { kind: "drawable", id: "draw_a" }
        ]
      })
    );
    const insertAndWrap = core.commitOperation(
      session,
      createWarpDeformerRequest({
        dryRun: false,
        basePackageRevision: 4,
        displayName: "Rejected Insert And Wrap",
        parentRigControlId: "rig_parent_a",
        insertBeforeChild: { kind: "drawable", id: "draw_a" },
        wrapChildren: [
          { kind: "drawable", id: "draw_a" }
        ]
      })
    );

    expect(mixedParents.result.status).toBe("rejected");
    expect(mixedParents.result.diagnostics[0]?.checkId).toBe("operation.createWarpDeformer.parentChildMismatch");
    expect(duplicateTargets.result.status).toBe("rejected");
    expect(duplicateTargets.result.diagnostics[0]?.checkId).toBe("operation.createRotation2dRigControl.duplicateChild");
    expect(ancestorDescendant.result.status).toBe("rejected");
    expect(ancestorDescendant.result.diagnostics[0]?.checkId).toBe("operation.createRotation2dRigControl.cycle");
    expect(missingChild.result.status).toBe("rejected");
    expect(missingChild.result.diagnostics[0]?.checkId).toBe(
      "operation.createRotation2dRigControl.missingChildDrawable"
    );
    expect(parentMismatch.result.status).toBe("rejected");
    expect(parentMismatch.result.diagnostics[0]?.checkId).toBe(
      "operation.createRotation2dRigControl.parentChildMismatch"
    );
    expect(childListMismatch.result.status).toBe("rejected");
    expect(childListMismatch.result.diagnostics[0]?.checkId).toBe(
      "operation.createRotation2dRigControl.parentChildMismatch"
    );
    expect(insertAndWrap.result.status).toBe("rejected");
    expect(insertAndWrap.result.diagnostics[0]?.checkId).toBe("operation.createWarpDeformer.parentChildMismatch");
    expect(session.graph).toEqual(beforeGraph);
    expect(session.packageRevision).toBe(4);
  });

  it("dry-runs and commits drawable deformer binding moves without changing parts or draw order", () => {
    const session = createFixtureSession();
    const core = createOperationCore();
    core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        childDrawableIds: ["draw_body"]
      })
    );
    core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        basePackageRevision: 1,
        displayName: "Target Rotation"
      })
    );
    const partsBefore = structuredClone(session.graph.parts);
    const drawablesBefore = structuredClone(session.graph.drawables);
    const drawOrderBefore = structuredClone(session.graph.drawOrder);

    const dryRun = core.dryRunOperation(
      session,
      createMoveDrawableRigControlBindingRequest({
        dryRun: true,
        basePackageRevision: 2,
        targetRigControlId: "rig_target_rotation"
      })
    );

    expect(dryRun.status).toBe("dry_run");
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_rotation"))).toMatchObject({
      childDrawableIds: ["draw_body"]
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_target_rotation"))).toMatchObject({
      childDrawableIds: []
    });

    const outcome = core.commitOperation(
      session,
      createMoveDrawableRigControlBindingRequest({
        dryRun: false,
        basePackageRevision: 2,
        targetRigControlId: "rig_target_rotation"
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_rotation"))).toMatchObject({
      childDrawableIds: []
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_target_rotation"))).toMatchObject({
      childDrawableIds: ["draw_body"]
    });
    expect(session.graph.parts).toEqual(partsBefore);
    expect(session.graph.drawables).toEqual(drawablesBefore);
    expect(session.graph.drawOrder).toEqual(drawOrderBefore);
    expect(outcome.logEntry?.targetIds).toEqual([
      "draw_body",
      "rig_head_rotation",
      "rig_target_rotation"
    ]);
    expect(findChangedFieldPaths(outcome.result, "rig_head_rotation")).toEqual([
      "/model/rigControls/rigControls/rig_head_rotation/childDrawableIds"
    ]);
    expect(findChangedFieldPaths(outcome.result, "rig_target_rotation")).toEqual([
      "/model/rigControls/rigControls/rig_target_rotation/childDrawableIds"
    ]);
  });

  it("dry-runs and commits rig control reparenting with modelDiff and cycle rejection", () => {
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
    core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        basePackageRevision: 2,
        displayName: "Target Rotation"
      })
    );
    core.commitOperation(
      session,
      createBindRigControlChildRequest({
        dryRun: false,
        basePackageRevision: 3,
        child: { kind: "rigControl", id: "rig_child_rotation" }
      })
    );

    const dryRun = core.dryRunOperation(
      session,
      createReparentRigControlRequest({
        dryRun: true,
        basePackageRevision: 4,
        childRigControlId: "rig_child_rotation",
        parentRigControlId: "rig_target_rotation"
      })
    );

    expect(dryRun.status).toBe("dry_run");
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_child_rotation"))).toMatchObject({
      parentId: "rig_head_rotation"
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_rotation"))).toMatchObject({
      childRigControlIds: ["rig_child_rotation"]
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_target_rotation"))).toMatchObject({
      childRigControlIds: []
    });
    expect(session.packageRevision).toBe(4);
    expect(session.authoringRevision).toBe(4);

    const outcome = core.commitOperation(
      session,
      createReparentRigControlRequest({
        dryRun: false,
        basePackageRevision: 4,
        childRigControlId: "rig_child_rotation",
        parentRigControlId: "rig_target_rotation"
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_child_rotation"))).toMatchObject({
      parentId: "rig_target_rotation"
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_rotation"))).toMatchObject({
      childRigControlIds: []
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_target_rotation"))).toMatchObject({
      childRigControlIds: ["rig_child_rotation"]
    });
    expect(findChangedFieldPaths(outcome.result, "rig_child_rotation")).toEqual([
      "/model/rigControls/rigControls/rig_child_rotation/parentId"
    ]);
    expect(findChangedFieldPaths(outcome.result, "rig_head_rotation")).toEqual([
      "/model/rigControls/rigControls/rig_head_rotation/childRigControlIds"
    ]);
    expect(findChangedFieldPaths(outcome.result, "rig_target_rotation")).toEqual([
      "/model/rigControls/rigControls/rig_target_rotation/childRigControlIds"
    ]);

    const beforeRejected = structuredClone(session.graph.rigControls);
    const rejected = core.commitOperation(
      session,
      createReparentRigControlRequest({
        dryRun: false,
        basePackageRevision: 5,
        childRigControlId: "rig_target_rotation",
        parentRigControlId: "rig_child_rotation"
      })
    );

    expect(rejected.result.status).toBe("rejected");
    expect(rejected.result.diagnostics[0]?.checkId).toBe("operation.reparentRigControl.cycle");
    expect(session.graph.rigControls).toEqual(beforeRejected);
    expect(session.packageRevision).toBe(5);
    expect(session.authoringRevision).toBe(5);
    expect(rejected.operationLogLength).toBe(5);

    const rootOutcome = core.commitOperation(
      session,
      createReparentRigControlRequest({
        dryRun: false,
        basePackageRevision: 5,
        childRigControlId: "rig_child_rotation",
        parentRigControlId: null
      })
    );

    expect(rootOutcome.result.status).toBe("committed");
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_child_rotation"))?.parentId).toBeUndefined();
    expect(session.graph.rigControlRootIds).toEqual([
      "rig_head_rotation",
      "rig_target_rotation",
      "rig_child_rotation"
    ]);
    expect(findChangedFieldPaths(rootOutcome.result, "pkg_rig_control_operation_test")).toEqual([
      "/model/graph/rigControlRootIds"
    ]);
  });

  it("commits rig control inspector field updates with modelDiff fields", () => {
    const session = createFixtureSession();
    const core = createOperationCore();
    core.commitOperation(
      session,
      createWarpDeformerRequest({
        dryRun: false,
        childDrawableIds: ["draw_body"],
        opacityMultiplier: 0.9
      })
    );
    const beforeDryRunRigControl = structuredClone(
      getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_warp_deformer"))
    );
    const beforeDryRunRevision = session.authoringRevision;
    const beforeDryRunDirty = session.dirty;

    const dryRun = core.dryRunOperation(
      session,
      createUpdateRigControlRequest({
        dryRun: true,
        basePackageRevision: 1,
        rigControlId: "rig_head_warp_deformer",
        displayName: "Head Warp Updated",
        opacityMultiplier: 0.4,
        domainBounds: { x: 0, y: 0, width: 2, height: 2 },
        transformColumns: 4,
        transformRows: 3,
        bezierColumns: 4,
        bezierRows: 3
      })
    );

    expect(dryRun.status).toBe("dry_run");
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_warp_deformer"))).toEqual(
      beforeDryRunRigControl
    );
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(beforeDryRunRevision);
    expect(session.dirty).toBe(beforeDryRunDirty);

    const outcome = core.commitOperation(
      session,
      createUpdateRigControlRequest({
        dryRun: false,
        basePackageRevision: 1,
        rigControlId: "rig_head_warp_deformer",
        displayName: "Head Warp Updated",
        opacityMultiplier: 0.4,
        domainBounds: { x: 0, y: 0, width: 2, height: 2 },
        transformColumns: 4,
        transformRows: 3,
        bezierColumns: 4,
        bezierRows: 3
      })
    );
    const rigControl = getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_warp_deformer"));

    expect(outcome.result.status).toBe("committed");
    expect(rigControl).toMatchObject({
      displayName: "Head Warp Updated",
      opacityMultiplier: 0.4,
      domainBounds: { x: 0, y: 0, width: 2, height: 2 },
      latticeColumns: 4,
      latticeRows: 3
    });
    expect(outcome.result.modelDiff?.changed[0]?.fields.map((field) => field.path)).toEqual(
      expect.arrayContaining([
        "/model/rigControls/rigControls/rig_head_warp_deformer/displayName",
        "/model/rigControls/rigControls/rig_head_warp_deformer/opacityMultiplier",
        "/model/rigControls/rigControls/rig_head_warp_deformer/domainBounds",
        "/model/rigControls/rigControls/rig_head_warp_deformer/latticeColumns",
        "/model/rigControls/rigControls/rig_head_warp_deformer/latticeRows",
        "/model/rigControls/rigControls/rig_head_warp_deformer/warpDeformer/bezierEditSurface"
      ])
    );
  });

  it("commits Rotation pivot, rest angle, and rest translation updates with modelDiff fields", () => {
    const session = createFixtureSession();
    const core = createOperationCore();
    core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        childDrawableIds: ["draw_body"],
        opacityMultiplier: 0.9
      })
    );
    const beforeDryRunRigControl = structuredClone(
      getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_rotation"))
    );

    const dryRun = core.dryRunOperation(
      session,
      createUpdateRigControlRequest({
        dryRun: true,
        basePackageRevision: 1,
        rigControlId: "rig_head_rotation",
        displayName: "Head Rotation Updated",
        opacityMultiplier: 0.5,
        pivot: { x: 20, y: 30 },
        restAngleDegrees: 18,
        restTranslation: { x: 9, y: -4 }
      })
    );

    expect(dryRun.status).toBe("dry_run");
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_rotation"))).toEqual(
      beforeDryRunRigControl
    );

    const outcome = core.commitOperation(
      session,
      createUpdateRigControlRequest({
        dryRun: false,
        basePackageRevision: 1,
        rigControlId: "rig_head_rotation",
        displayName: "Head Rotation Updated",
        opacityMultiplier: 0.5,
        pivot: { x: 20, y: 30 },
        restAngleDegrees: 18,
        restTranslation: { x: 9, y: -4 }
      })
    );
    const rigControl = getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_rotation"));

    expect(outcome.result.status).toBe("committed");
    expect(rigControl).toMatchObject({
      kind: "rotation2d",
      childDrawableIds: ["draw_body"],
      displayName: "Head Rotation Updated",
      opacityMultiplier: 0.5,
      pivot: { x: 20, y: 30 },
      restAngleDegrees: 18,
      restTranslation: { x: 9, y: -4 },
      restScale: { x: 1, y: 1 },
      enabled: true
    });
    expect(session.graph.rigControlRootIds).toEqual(["rig_head_rotation"]);
    expect(outcome.result.modelDiff?.changed[0]?.fields.map((field) => field.path)).toEqual(
      expect.arrayContaining([
        "/model/rigControls/rigControls/rig_head_rotation/displayName",
        "/model/rigControls/rigControls/rig_head_rotation/opacityMultiplier",
        "/model/rigControls/rigControls/rig_head_rotation/pivot",
        "/model/rigControls/rigControls/rig_head_rotation/restAngleDegrees",
        "/model/rigControls/rigControls/rig_head_rotation/restTranslation"
      ])
    );
  });

  it("rejects invalid, wrong-kind, and no-op Rotation updates without mutating", () => {
    const session = createFixtureSession();
    const core = createOperationCore();
    core.commitOperation(
      session,
      createRotation2dRigControlRequest({
        dryRun: false,
        childDrawableIds: ["draw_body"]
      })
    );
    core.commitOperation(
      session,
      createWarpDeformerRequest({
        dryRun: false,
        basePackageRevision: 1,
        displayName: "Head Warp Deformer"
      })
    );

    const beforeInvalid = structuredClone(session.graph.rigControls);
    const invalid = core.commitOperation(
      session,
      createUpdateRigControlRequest({
        dryRun: false,
        basePackageRevision: 2,
        rigControlId: "rig_head_rotation",
        restTranslation: { x: Number.NaN, y: 1 }
      })
    );
    expect(invalid.result.status).toBe("rejected");
    expect(invalid.result.diagnostics[0]?.checkId).toBe("operation.request.invalid");
    expect(session.graph.rigControls).toEqual(beforeInvalid);

    const wrongKind = core.commitOperation(
      session,
      createUpdateRigControlRequest({
        dryRun: false,
        basePackageRevision: 2,
        rigControlId: "rig_head_warp_deformer",
        restTranslation: { x: 1, y: 2 }
      })
    );
    expect(wrongKind.result.status).toBe("rejected");
    expect(wrongKind.result.diagnostics[0]?.checkId).toBe(
      "operation.updateRigControl.unsupportedField"
    );
    expect(session.graph.rigControls).toEqual(beforeInvalid);

    const noOp = core.commitOperation(
      session,
      createUpdateRigControlRequest({
        dryRun: false,
        basePackageRevision: 2,
        rigControlId: "rig_head_rotation",
        pivot: { x: 64, y: 64 },
        restAngleDegrees: 0,
        restTranslation: { x: 0, y: 0 }
      })
    );
    expect(noOp.result.status).toBe("rejected");
    expect(noOp.result.diagnostics[0]?.checkId).toBe("operation.updateRigControl.noOp");
    expect(session.graph.rigControls).toEqual(beforeInvalid);
  });

  it("rejects invalid Warp updates atomically when generic fields are present", () => {
    const session = createFixtureSession();
    const core = createOperationCore();
    core.commitOperation(
      session,
      createWarpDeformerRequest({
        dryRun: false,
        childDrawableIds: ["draw_body"],
        opacityMultiplier: 0.9
      })
    );
    const beforeRigControl = structuredClone(
      getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_warp_deformer"))
    );
    const beforePackageRevision = session.packageRevision;
    const beforeAuthoringRevision = session.authoringRevision;
    const beforeDirty = session.dirty;

    const outcome = core.commitOperation(
      session,
      createUpdateRigControlRequest({
        dryRun: false,
        basePackageRevision: beforePackageRevision,
        rigControlId: "rig_head_warp_deformer",
        displayName: "Rejected Warp Name",
        opacityMultiplier: 0.2,
        domainBounds: { x: 0, y: 0, width: 0, height: 2 }
      })
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]?.checkId).toBe("operation.updateRigControl.invalidDomainBounds");
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_warp_deformer"))).toEqual(
      beforeRigControl
    );
    expect(session.packageRevision).toBe(beforePackageRevision);
    expect(session.authoringRevision).toBe(beforeAuthoringRevision);
    expect(session.dirty).toBe(beforeDirty);
    expect(outcome.operationLogLength).toBe(1);
  });

  it("rejects keyform cardinality conflicts atomically when generic fields are present", () => {
    const session = createFixtureSession();
    const core = createOperationCore();
    core.commitOperation(
      session,
      createWarpDeformerRequest({
        dryRun: false,
        childDrawableIds: ["draw_body"],
        opacityMultiplier: 0.9
      })
    );
    session.graph.keyformSets.push({
      keyformSetId: KeyformSetIdSchema.parse("keyset_head_warp_offsets"),
      target: {
        kind: "rigControl",
        id: RigControlIdSchema.parse("rig_head_warp_deformer"),
        property: "controlPointOffsets"
      },
      parameterId: ParameterIdSchema.parse("param_head_warp"),
      evaluator: "linear-1d-v1",
      interpolation: "linear-1d-v1",
      compositionMode: "replace",
      compositionOrder: 0,
      keys: [
        {
          value: 1,
          statePatch: Array.from({ length: 20 }, () => ({ x: 0, y: 0 }))
        }
      ]
    });
    const beforeRigControl = structuredClone(
      getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_warp_deformer"))
    );
    const beforePackageRevision = session.packageRevision;
    const beforeAuthoringRevision = session.authoringRevision;
    const beforeDirty = session.dirty;

    const outcome = core.commitOperation(
      session,
      createUpdateRigControlRequest({
        dryRun: false,
        basePackageRevision: beforePackageRevision,
        rigControlId: "rig_head_warp_deformer",
        displayName: "Rejected Cardinality Name",
        opacityMultiplier: 0.2,
        transformColumns: 6
      })
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]?.checkId).toBe(
      "operation.updateRigControl.keyformCardinalityConflict"
    );
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head_warp_deformer"))).toEqual(
      beforeRigControl
    );
    expect(session.packageRevision).toBe(beforePackageRevision);
    expect(session.authoringRevision).toBe(beforeAuthoringRevision);
    expect(session.dirty).toBe(beforeDirty);
    expect(outcome.operationLogLength).toBe(1);
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

const findChangedFieldPaths = (
  result: ReturnType<ReturnType<typeof createOperationCore>["commitOperation"]>["result"],
  targetId: string
): readonly string[] =>
  result.modelDiff?.changed
    .find((change) => change.target.id === targetId)
    ?.fields.map((field) => field.path) ?? [];

const findChangedFields = (
  result: ReturnType<ReturnType<typeof createOperationCore>["commitOperation"]>["result"],
  targetId: string
): readonly { readonly path: string; readonly before: unknown; readonly after: unknown }[] =>
  result.modelDiff?.changed
    .find((change) => change.target.id === targetId)
    ?.fields ?? [];

const createRotation2dRigControlRequest = (options: {
  readonly dryRun: boolean;
  readonly basePackageRevision?: number;
  readonly displayName?: string;
  readonly partId?: string;
  readonly parentRigControlId?: string;
  readonly childDrawableIds?: readonly string[];
  readonly childRigControlIds?: readonly string[];
  readonly insertBeforeChild?: { readonly kind: "drawable" | "rigControl"; readonly id: string };
  readonly wrapChildren?: readonly { readonly kind: "drawable" | "rigControl"; readonly id: string }[];
  readonly opacityMultiplier?: number;
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: `op_create_${(options.displayName ?? "Head Rotation").toLowerCase().replaceAll(" ", "_")}`,
  actor: "test",
  surface: "testFixture",
  dryRun: options.dryRun,
  basePackageRevision: options.basePackageRevision ?? 0,
  operationType: "createRotation2dRigControl",
  payload: {
    ...(options.partId === undefined ? {} : { partId: options.partId }),
    displayName: options.displayName ?? "Head Rotation",
    ...(options.parentRigControlId === undefined ? {} : { parentRigControlId: options.parentRigControlId }),
    ...(options.insertBeforeChild === undefined ? {} : { insertBeforeChild: options.insertBeforeChild }),
    ...(options.wrapChildren === undefined ? {} : { wrapChildren: options.wrapChildren }),
    childDrawableIds: options.childDrawableIds ?? [],
    childRigControlIds: options.childRigControlIds ?? [],
    ...(options.opacityMultiplier === undefined ? {} : { opacityMultiplier: options.opacityMultiplier }),
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
  readonly partId?: string;
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
    ...(options.partId === undefined ? {} : { partId: options.partId }),
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
  readonly partId?: string;
  readonly parentRigControlId?: string;
  readonly childDrawableIds?: readonly string[];
  readonly childRigControlIds?: readonly string[];
  readonly insertBeforeChild?: { readonly kind: "drawable" | "rigControl"; readonly id: string };
  readonly wrapChildren?: readonly { readonly kind: "drawable" | "rigControl"; readonly id: string }[];
  readonly opacityMultiplier?: number;
  readonly domainBounds?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly transformColumns?: number;
  readonly transformRows?: number;
  readonly bezierColumns?: number;
  readonly bezierRows?: number;
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: `op_create_${(options.displayName ?? "Head Warp Deformer").toLowerCase().replaceAll(" ", "_")}`,
  actor: "test",
  surface: "testFixture",
  dryRun: options.dryRun,
  basePackageRevision: options.basePackageRevision ?? 0,
  operationType: "createWarpDeformer",
  payload: {
    ...(options.partId === undefined ? {} : { partId: options.partId }),
    displayName: options.displayName ?? "Head Warp Deformer",
    ...(options.parentRigControlId === undefined ? {} : { parentRigControlId: options.parentRigControlId }),
    ...(options.insertBeforeChild === undefined ? {} : { insertBeforeChild: options.insertBeforeChild }),
    ...(options.wrapChildren === undefined ? {} : { wrapChildren: options.wrapChildren }),
    childDrawableIds: options.childDrawableIds ?? [],
    childRigControlIds: options.childRigControlIds ?? [],
    opacityMultiplier: options.opacityMultiplier ?? 1,
    domainBounds: options.domainBounds ?? {
      x: 0,
      y: 0,
      width: 1,
      height: 1
    },
    transformColumns: options.transformColumns ?? 5,
    transformRows: options.transformRows ?? 4,
    bezierColumns: options.bezierColumns ?? 3,
    bezierRows: options.bezierRows ?? 2,
    bezierEditType: "cubicBezierSurfaceV1"
  }
});

const createBindRigControlChildRequest = (options: {
  readonly dryRun: boolean;
  readonly basePackageRevision?: number;
  readonly parentRigControlId?: string;
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
    parentRigControlId: options.parentRigControlId ?? "rig_head_rotation",
    child: options.child
  }
});

const createMoveDrawableRigControlBindingRequest = (options: {
  readonly dryRun: boolean;
  readonly basePackageRevision?: number;
  readonly drawableId?: string;
  readonly targetRigControlId: string;
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: `op_move_drawable_deformer_binding_${options.drawableId ?? "draw_body"}`,
  actor: "test",
  surface: "testFixture",
  dryRun: options.dryRun,
  basePackageRevision: options.basePackageRevision ?? 0,
  operationType: "moveDrawableRigControlBinding",
  payload: {
    drawableId: options.drawableId ?? "draw_body",
    targetRigControlId: options.targetRigControlId
  }
});

const createReparentRigControlRequest = (options: {
  readonly dryRun: boolean;
  readonly basePackageRevision?: number;
  readonly childRigControlId: string;
  readonly parentRigControlId: string | null;
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: `op_reparent_${options.childRigControlId}`,
  actor: "test",
  surface: "testFixture",
  dryRun: options.dryRun,
  basePackageRevision: options.basePackageRevision ?? 0,
  operationType: "reparentRigControl",
  payload: {
    childRigControlId: options.childRigControlId,
    parentRigControlId: options.parentRigControlId
  }
});

const createUpdateRigControlRequest = (options: {
  readonly dryRun: boolean;
  readonly basePackageRevision?: number;
  readonly rigControlId: string;
  readonly displayName?: string;
  readonly opacityMultiplier?: number;
  readonly pivot?: { readonly x: number; readonly y: number };
  readonly restAngleDegrees?: number;
  readonly restTranslation?: { readonly x: number; readonly y: number };
  readonly domainBounds?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly transformColumns?: number;
  readonly transformRows?: number;
  readonly bezierColumns?: number;
  readonly bezierRows?: number;
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: `op_update_${options.rigControlId}`,
  actor: "test",
  surface: "testFixture",
  dryRun: options.dryRun,
  basePackageRevision: options.basePackageRevision ?? 0,
  operationType: "updateRigControl",
  payload: {
    rigControlId: options.rigControlId,
    ...(options.displayName === undefined ? {} : { displayName: options.displayName }),
    ...(options.opacityMultiplier === undefined ? {} : { opacityMultiplier: options.opacityMultiplier }),
    ...(options.pivot === undefined ? {} : { pivot: options.pivot }),
    ...(options.restAngleDegrees === undefined ? {} : { restAngleDegrees: options.restAngleDegrees }),
    ...(options.restTranslation === undefined ? {} : { restTranslation: options.restTranslation }),
    ...(options.domainBounds === undefined ? {} : { domainBounds: options.domainBounds }),
    ...(options.transformColumns === undefined ? {} : { transformColumns: options.transformColumns }),
    ...(options.transformRows === undefined ? {} : { transformRows: options.transformRows }),
    ...(options.bezierColumns === undefined ? {} : { bezierColumns: options.bezierColumns }),
    ...(options.bezierRows === undefined ? {} : { bezierRows: options.bezierRows })
  }
});

const addFixtureDrawable = (
  session: AuthoringSession,
  drawableId: string,
  displayName: string
): void => {
  const parsedDrawableId = DrawableIdSchema.parse(drawableId);
  const suffix = drawableId.replace(/^draw_/, "");
  session.graph.parts[0]?.drawableIds.push(parsedDrawableId);
  session.graph.drawables.push({
    drawableId: parsedDrawableId,
    displayName,
    partId: PartIdSchema.parse("part_root"),
    sourceAssetId: SourceAssetIdSchema.parse(`src_${suffix}`),
    textureId: TextureIdSchema.parse(`tex_${suffix}`),
    meshId: MeshIdSchema.parse(`mesh_${suffix}`),
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder: session.graph.drawables.length,
    sourceProvenanceId: ProvenanceIdSchema.parse(`prov_${suffix}`)
  });
  session.graph.meshes.push({
    meshId: MeshIdSchema.parse(`mesh_${suffix}`),
    drawableId: parsedDrawableId,
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
    vertexStableIds: [`vtx_${suffix}_0`, `vtx_${suffix}_1`, `vtx_${suffix}_2`],
    bounds: { x: 0, y: 0, width: 1, height: 1 },
    generationProvenanceId: ProvenanceIdSchema.parse(`prov_${suffix}`)
  });
  session.graph.stableOrder.push(parsedDrawableId);
};

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
