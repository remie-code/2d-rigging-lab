import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
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
import type { PackageDocumentDto } from "@private-2d-rigging-lab/package-format";
import { parsePackageDocument } from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import { createInitialAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { createAuthoringSessionFromPackageDocument } from "./from-package-document.js";
import { getRigControlById } from "./rig-control-selectors.js";
import {
  bindRigControlChild,
  createRotation2dRigControl,
  createWarpLattice2dRigControl,
  deleteRigControl,
  insertRigControlBetweenParentAndChild,
  moveDrawableRigControlBinding,
  reparentRigControl,
  updateRigControl,
  wrapRigControlChildren
} from "./rig-control-mutations.js";
import { AuthoringMutationError } from "./authoring-mutations.js";
import { toPackageDocument } from "./to-package-document.js";

describe("rig control authoring mutations", () => {
  it("creates a rotation2d rig control as a graph root with drawable children", () => {
    const session = createFixtureSession();

    const result = createRotation2dRigControl(
      session,
      createRotationRigControl("rig_head", "Head", {
        childDrawableIds: ["draw_body"]
      })
    );

    expect(result.rigControl).toMatchObject({
      kind: "rotation2d",
      rigControlId: "rig_head",
      childDrawableIds: ["draw_body"],
      childRigControlIds: []
    });
    expect(result.rigControl).not.toHaveProperty("partId");
    expect(session.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);
    expect(session.graph.rigControlRootIds).toEqual(["rig_head"]);
    expect(session.graph.stableOrder).toContain("rig_head");
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head"))).toEqual(
      result.rigControl
    );
  });

  it("binds child drawable targets to an existing rotation2d rig control", () => {
    const session = createFixtureSession();
    createRotation2dRigControl(session, createRotationRigControl("rig_head", "Head"));

    const result = bindRigControlChild(session, {
      parentRigControlId: RigControlIdSchema.parse("rig_head"),
      child: { kind: "drawable", id: "draw_body" }
    });

    expect(result.parentRigControlBefore.childDrawableIds).toEqual([]);
    expect(result.parentRigControlAfter.childDrawableIds).toEqual(["draw_body"]);
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_head"))).toMatchObject({
      childDrawableIds: ["draw_body"]
    });
    expect(session.graph.rigControlRootIds).toEqual(["rig_head"]);
    expect(session.authoringRevision).toBe(2);
  });

  it("creates a warpLattice2d rig control with deterministic 2x2 package materialization", () => {
    const baseDocument = loadMinimalFixturePackageDocument();
    const session = createAuthoringSessionFromPackageDocument(baseDocument);

    const result = createWarpLattice2dRigControl(
      session,
      createWarpLatticeRigControl("rig_head_warp", "Head Warp", {
        childDrawableIds: ["draw_body"]
      })
    );
    session.packageRevision = 1;

    const document = toPackageDocument(session, baseDocument, {
      updatedAt: baseDocument.manifest.updatedAt
    });

    expect(result.rigControl).toMatchObject({
      kind: "warpLattice2d",
      rigControlId: "rig_head_warp",
      bindSpace: "rigControlLocalRest",
      latticeColumns: 2,
      latticeRows: 2,
      childDrawableIds: ["draw_body"],
      interpolationMethod: "bilinear-grid-v1"
    });
    expect(result.rigControl).not.toHaveProperty("partId");
    expect(result.rigControl.restControlPoints).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 }
    ]);
    expect(session.graph.rigControlRootIds).toContain("rig_head_warp");
    expect(session.graph.stableOrder).toContain("rig_head_warp");
    expect(document.model.rigControls.rigControls).toContainEqual(
      expect.objectContaining({
        rigControlId: "rig_head_warp",
        kind: "warpLattice2d",
        childDrawableIds: ["draw_body"],
        restControlPoints: result.rigControl.restControlPoints
      })
    );
  });

  it("preserves legacy partId metadata when explicit legacy rig controls are authored", () => {
    const session = createFixtureSession();

    const rotation = createRotation2dRigControl(
      session,
      createRotationRigControl("rig_legacy_rotation", "Legacy Rotation", {
        partId: "part_root"
      })
    );
    const warp = createWarpLattice2dRigControl(
      session,
      createWarpLatticeRigControl("rig_legacy_warp", "Legacy Warp", {
        partId: "part_root"
      })
    );

    expect(rotation.rigControl).toHaveProperty("partId", "part_root");
    expect(warp.rigControl).toHaveProperty("partId", "part_root");
  });

  it("binds child rig controls and updates graph roots for package materialization", () => {
    const baseDocument = loadMinimalFixturePackageDocument();
    const session = createAuthoringSessionFromPackageDocument(baseDocument);

    createRotation2dRigControl(session, createRotationRigControl("rig_parent", "Parent"));
    createRotation2dRigControl(session, createRotationRigControl("rig_child", "Child"));
    const result = bindRigControlChild(session, {
      parentRigControlId: RigControlIdSchema.parse("rig_parent"),
      child: { kind: "rigControl", id: "rig_child" }
    });
    session.packageRevision = 1;

    const document = toPackageDocument(session, baseDocument, {
      updatedAt: baseDocument.manifest.updatedAt
    });

    expect(result.parentRigControlAfter.childRigControlIds).toEqual(["rig_child"]);
    expect(result.childRigControlChange?.after.parentId).toBe("rig_parent");
    expect(session.graph.rigControlRootIds).toEqual(["rig_parent"]);
    expect(document.model.graph.rigControlRootIds).toEqual(["rig_parent"]);
    expect(document.model.rigControls.rigControls).toEqual([
      expect.objectContaining({
        rigControlId: "rig_parent",
        childRigControlIds: ["rig_child"]
      }),
      expect.objectContaining({
        rigControlId: "rig_child",
        parentId: "rig_parent"
      })
    ]);
  });

  it("moves a drawable deformer binding without changing parts membership or draw order", () => {
    const session = createFixtureSession();
    createRotation2dRigControl(
      session,
      createRotationRigControl("rig_source", "Source", {
        childDrawableIds: ["draw_body"]
      })
    );
    createRotation2dRigControl(session, createRotationRigControl("rig_target", "Target"));
    const partsBefore = structuredClone(session.graph.parts);
    const drawablesBefore = structuredClone(session.graph.drawables);
    const drawOrderBefore = structuredClone(session.graph.drawOrder);

    const result = moveDrawableRigControlBinding(session, {
      drawableId: DrawableIdSchema.parse("draw_body"),
      targetRigControlId: RigControlIdSchema.parse("rig_target")
    });

    expect(result.sourceRigControlBefore.childDrawableIds).toEqual(["draw_body"]);
    expect(result.sourceRigControlAfter.childDrawableIds).toEqual([]);
    expect(result.targetRigControlAfter.childDrawableIds).toEqual(["draw_body"]);
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_source"))).toMatchObject({
      childDrawableIds: []
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_target"))).toMatchObject({
      childDrawableIds: ["draw_body"]
    });
    expect(session.graph.parts).toEqual(partsBefore);
    expect(session.graph.drawables).toEqual(drawablesBefore);
    expect(session.graph.drawOrder).toEqual(drawOrderBefore);
  });

  it("reparents child rig controls and rejects cycles", () => {
    const session = createFixtureSession();
    createRotation2dRigControl(session, createRotationRigControl("rig_parent", "Parent"));
    createRotation2dRigControl(session, createRotationRigControl("rig_child", "Child"));
    createRotation2dRigControl(session, createRotationRigControl("rig_target", "Target"));
    bindRigControlChild(session, {
      parentRigControlId: RigControlIdSchema.parse("rig_parent"),
      child: { kind: "rigControl", id: "rig_child" }
    });

    const result = reparentRigControl(session, {
      childRigControlId: RigControlIdSchema.parse("rig_child"),
      parentRigControlId: RigControlIdSchema.parse("rig_target")
    });

    expect(result.childRigControlBefore.parentId).toBe("rig_parent");
    expect(result.childRigControlAfter.parentId).toBe("rig_target");
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_parent"))).toMatchObject({
      childRigControlIds: []
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_target"))).toMatchObject({
      childRigControlIds: ["rig_child"]
    });
    expect(session.graph.rigControlRootIds).toEqual(["rig_parent", "rig_target"]);

    let caught: unknown;
    try {
      reparentRigControl(session, {
        childRigControlId: RigControlIdSchema.parse("rig_target"),
        parentRigControlId: RigControlIdSchema.parse("rig_child")
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AuthoringMutationError);
    expect((caught as AuthoringMutationError).code).toBe("rig_control_cycle");
  });

  it("inserts a rig control between an existing parent and drawable child", () => {
    const session = createFixtureSession();
    createRotation2dRigControl(
      session,
      createRotationRigControl("rig_parent", "Parent", {
        childDrawableIds: ["draw_body"]
      })
    );

    const result = insertRigControlBetweenParentAndChild(
      session,
      createWarpLatticeRigControl("rig_inserted_warp", "Inserted Warp", {
        childDrawableIds: ["draw_body"]
      }),
      {
        parentRigControlId: RigControlIdSchema.parse("rig_parent"),
        child: { kind: "drawable", id: "draw_body" }
      }
    );

    expect(result.parentRigControlBefore.childDrawableIds).toEqual(["draw_body"]);
    expect(result.parentRigControlAfter.childDrawableIds).toEqual([]);
    expect(result.parentRigControlAfter.childRigControlIds).toEqual(["rig_inserted_warp"]);
    expect(result.rigControl).toMatchObject({
      rigControlId: "rig_inserted_warp",
      parentId: "rig_parent",
      childDrawableIds: ["draw_body"],
      opacityMultiplier: 1
    });
    expect(session.graph.rigControlRootIds).toEqual(["rig_parent"]);
  });

  it("wraps multiple drawable children under one new parent without moving unselected siblings", () => {
    const session = createFixtureSession();
    addFixtureDrawable(session, "draw_a", "A");
    addFixtureDrawable(session, "draw_b", "B");
    addFixtureDrawable(session, "draw_c", "C");
    createRotation2dRigControl(
      session,
      createRotationRigControl("rig_parent", "Parent", {
        childDrawableIds: ["draw_a", "draw_b", "draw_c"]
      })
    );
    const parentBefore = structuredClone(getRigControlById(session.graph, RigControlIdSchema.parse("rig_parent")));

    const result = wrapRigControlChildren(
      session,
      createRotationRigControl("rig_wrapper", "Wrapper", {
        childDrawableIds: ["draw_a", "draw_b"]
      }),
      {
        wrapChildren: [
          { kind: "drawable", id: DrawableIdSchema.parse("draw_a") },
          { kind: "drawable", id: DrawableIdSchema.parse("draw_b") }
        ]
      }
    );

    expect(result.parentRigControlBefore?.childDrawableIds).toEqual(["draw_a", "draw_b", "draw_c"]);
    expect(result.parentRigControlAfter?.childDrawableIds).toEqual(["draw_c"]);
    expect(result.parentRigControlAfter?.childRigControlIds).toEqual(["rig_wrapper"]);
    expect(result.rigControl).toMatchObject({
      rigControlId: "rig_wrapper",
      parentId: "rig_parent",
      childDrawableIds: ["draw_a", "draw_b"],
      childRigControlIds: []
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_parent"))).toMatchObject({
      pivot: parentBefore?.kind === "rotation2d" ? parentBefore.pivot : undefined,
      restAngleDegrees: parentBefore?.kind === "rotation2d" ? parentBefore.restAngleDegrees : undefined,
      childDrawableIds: ["draw_c"],
      childRigControlIds: ["rig_wrapper"]
    });
    expect(session.graph.rigControlRootIds).toEqual(["rig_parent"]);
  });

  it("wraps mixed direct drawable and child rig-control siblings with an unbound drawable", () => {
    const session = createFixtureSession();
    addFixtureDrawable(session, "draw_a", "A");
    addFixtureDrawable(session, "draw_unbound", "Unbound");
    createRotation2dRigControl(
      session,
      createRotationRigControl("rig_parent", "Parent", {
        childDrawableIds: ["draw_a"]
      })
    );
    createWarpLattice2dRigControl(session, createWarpLatticeRigControl("rig_child_warp", "Child Warp"));
    bindRigControlChild(session, {
      parentRigControlId: RigControlIdSchema.parse("rig_parent"),
      child: { kind: "rigControl", id: "rig_child_warp" }
    });
    const parentBefore = structuredClone(getRigControlById(session.graph, RigControlIdSchema.parse("rig_parent")));
    const childBefore = structuredClone(getRigControlById(session.graph, RigControlIdSchema.parse("rig_child_warp")));

    const result = wrapRigControlChildren(
      session,
      createWarpLatticeRigControl("rig_wrapper_warp", "Wrapper Warp", {
        childDrawableIds: ["draw_a", "draw_unbound"],
        childRigControlIds: ["rig_child_warp"]
      }),
      {
        wrapChildren: [
          { kind: "drawable", id: DrawableIdSchema.parse("draw_a") },
          { kind: "rigControl", id: RigControlIdSchema.parse("rig_child_warp") },
          { kind: "drawable", id: DrawableIdSchema.parse("draw_unbound") }
        ]
      }
    );

    expect(result.parentRigControlBefore).toEqual(parentBefore);
    expect(result.parentRigControlAfter?.childDrawableIds).toEqual([]);
    expect(result.parentRigControlAfter?.childRigControlIds).toEqual(["rig_wrapper_warp"]);
    expect(result.childRigControlChanges).toHaveLength(1);
    expect(result.childRigControlChanges[0]?.before).toEqual(childBefore);
    expect(result.childRigControlChanges[0]?.after).toMatchObject({
      rigControlId: "rig_child_warp",
      parentId: "rig_wrapper_warp"
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_wrapper_warp"))).toMatchObject({
      parentId: "rig_parent",
      childDrawableIds: ["draw_a", "draw_unbound"],
      childRigControlIds: ["rig_child_warp"],
      domainBounds: { x: 0, y: 0, width: 100, height: 100 }
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_child_warp"))).toMatchObject({
      parentId: "rig_wrapper_warp",
      kind: "warpLattice2d",
      domainBounds: childBefore?.kind === "warpLattice2d" ? childBefore.domainBounds : undefined,
      restControlPoints: childBefore?.kind === "warpLattice2d" ? childBefore.restControlPoints : undefined
    });
    expect(session.graph.rigControlRootIds).toEqual(["rig_parent"]);
  });

  it("wraps root rig controls into one new root wrapper", () => {
    const session = createFixtureSession();
    addFixtureDrawable(session, "draw_unbound", "Unbound");
    createRotation2dRigControl(session, createRotationRigControl("rig_root_a", "Root A"));
    createRotation2dRigControl(session, createRotationRigControl("rig_root_b", "Root B"));
    createRotation2dRigControl(session, createRotationRigControl("rig_root_c", "Root C"));

    const result = wrapRigControlChildren(
      session,
      createRotationRigControl("rig_root_wrapper", "Root Wrapper", {
        childDrawableIds: ["draw_unbound"],
        childRigControlIds: ["rig_root_a", "rig_root_b"]
      }),
      {
        wrapChildren: [
          { kind: "rigControl", id: RigControlIdSchema.parse("rig_root_a") },
          { kind: "rigControl", id: RigControlIdSchema.parse("rig_root_b") },
          { kind: "drawable", id: DrawableIdSchema.parse("draw_unbound") }
        ]
      }
    );

    expect(result.rigControlRootIdsBefore).toEqual(["rig_root_a", "rig_root_b", "rig_root_c"]);
    expect(result.rigControlRootIdsAfter).toEqual(["rig_root_wrapper", "rig_root_c"]);
    expect(session.graph.rigControlRootIds).toEqual(["rig_root_wrapper", "rig_root_c"]);
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_root_wrapper"))).toMatchObject({
      childDrawableIds: ["draw_unbound"],
      childRigControlIds: ["rig_root_a", "rig_root_b"]
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_root_a"))).toMatchObject({
      parentId: "rig_root_wrapper"
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_root_b"))).toMatchObject({
      parentId: "rig_root_wrapper"
    });
  });

  it("rejects incoherent bulk wrap selections deterministically", () => {
    const session = createFixtureSession();
    addFixtureDrawable(session, "draw_a", "A");
    addFixtureDrawable(session, "draw_b", "B");
    createRotation2dRigControl(
      session,
      createRotationRigControl("rig_parent_a", "Parent A", {
        childDrawableIds: ["draw_a"]
      })
    );
    createRotation2dRigControl(
      session,
      createRotationRigControl("rig_parent_b", "Parent B", {
        childDrawableIds: ["draw_b"]
      })
    );
    createRotation2dRigControl(session, createRotationRigControl("rig_child", "Child"));
    bindRigControlChild(session, {
      parentRigControlId: RigControlIdSchema.parse("rig_parent_a"),
      child: { kind: "rigControl", id: "rig_child" }
    });

    expectWrapError(
      session,
      createRotationRigControl("rig_dup_wrapper", "Duplicate Wrapper", {
        childDrawableIds: ["draw_a", "draw_a"]
      }),
      [
        { kind: "drawable", id: DrawableIdSchema.parse("draw_a") },
        { kind: "drawable", id: DrawableIdSchema.parse("draw_a") }
      ],
      "duplicate_rig_control_child"
    );
    expectWrapError(
      session,
      createRotationRigControl("rig_missing_wrapper", "Missing Wrapper", {
        childDrawableIds: ["draw_missing"]
      }),
      [{ kind: "drawable", id: DrawableIdSchema.parse("draw_missing") }],
      "missing_drawable"
    );
    expectWrapError(
      session,
      createRotationRigControl("rig_mixed_parent_wrapper", "Mixed Parent Wrapper", {
        childDrawableIds: ["draw_a", "draw_b"]
      }),
      [
        { kind: "drawable", id: DrawableIdSchema.parse("draw_a") },
        { kind: "drawable", id: DrawableIdSchema.parse("draw_b") }
      ],
      "rig_control_parent_child_mismatch"
    );
    expectWrapError(
      session,
      createRotationRigControl("rig_ancestor_wrapper", "Ancestor Wrapper", {
        childRigControlIds: ["rig_parent_a", "rig_child"]
      }),
      [
        { kind: "rigControl", id: RigControlIdSchema.parse("rig_parent_a") },
        { kind: "rigControl", id: RigControlIdSchema.parse("rig_child") }
      ],
      "rig_control_cycle"
    );
    expectWrapError(
      session,
      createRotationRigControl("rig_mismatch_wrapper", "Mismatch Wrapper", {
        childDrawableIds: ["draw_a"]
      }),
      [{ kind: "drawable", id: DrawableIdSchema.parse("draw_a") }],
      "rig_control_parent_child_mismatch",
      RigControlIdSchema.parse("rig_parent_b")
    );
  });

  it("updates committed rig control fields and rejects division cardinality changes with keyforms", () => {
    const session = createFixtureSession();
    createWarpLattice2dRigControl(
      session,
      createWarpLatticeRigControl("rig_face_warp", "Face Warp", {
        childDrawableIds: ["draw_body"]
      })
    );

    const result = updateRigControl(session, {
      rigControlId: RigControlIdSchema.parse("rig_face_warp"),
      displayName: "Face Warp Updated",
      opacityMultiplier: 0.5,
      domainBounds: { x: 0, y: 0, width: 120, height: 80 },
      bezierColumns: 3,
      bezierRows: 2
    });

    expect(result.rigControlAfter).toMatchObject({
      displayName: "Face Warp Updated",
      opacityMultiplier: 0.5,
      domainBounds: { x: 0, y: 0, width: 120, height: 80 }
    });
    if (result.rigControlAfter.kind !== "warpLattice2d") {
      throw new Error("Expected warpLattice2d update result.");
    }
    expect(result.rigControlAfter.warpDeformer?.bezierEditSurface).toMatchObject({
      columns: 3,
      rows: 2
    });

    session.graph.keyformSets.push({
      keyformSetId: KeyformSetIdSchema.parse("keyset_face_warp_offsets"),
      target: {
        kind: "rigControl",
        id: "rig_face_warp",
        property: "controlPointOffsets"
      },
      parameterId: ParameterIdSchema.parse("param_face_warp"),
      evaluator: "linear-1d-v1",
      interpolation: "linear-1d-v1",
      compositionMode: "replace",
      compositionOrder: 0,
      keys: [
        {
          value: 1,
          statePatch: [
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 0, y: 0 }
          ]
        }
      ]
    });

    let caught: unknown;
    try {
      updateRigControl(session, {
        rigControlId: RigControlIdSchema.parse("rig_face_warp"),
        transformColumns: 3
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AuthoringMutationError);
    expect((caught as AuthoringMutationError).code).toBe("rig_control_keyform_cardinality_conflict");
  });

  it("updates rotation pivot, rest angle, and rest translation while preserving hierarchy and keyforms", () => {
    const session = createFixtureSession();
    createRotation2dRigControl(session, createRotationRigControl("rig_parent", "Parent"));
    createRotation2dRigControl(
      session,
      createRotationRigControl("rig_face_rotation", "Face Rotation", {
        childDrawableIds: ["draw_body"]
      })
    );
    bindRigControlChild(session, {
      parentRigControlId: RigControlIdSchema.parse("rig_parent"),
      child: { kind: "rigControl", id: "rig_face_rotation" }
    });
    session.graph.keyformSets.push({
      keyformSetId: KeyformSetIdSchema.parse("keyset_face_rotation_angle"),
      target: {
        kind: "rigControl",
        id: "rig_face_rotation",
        property: "angleDegrees"
      },
      parameterId: ParameterIdSchema.parse("param_face_angle_x"),
      evaluator: "linear-1d-v1",
      interpolation: "linear-1d-v1",
      compositionMode: "replace",
      compositionOrder: 0,
      keys: [
        {
          value: 0,
          statePatch: 0
        }
      ]
    });

    const result = updateRigControl(session, {
      rigControlId: RigControlIdSchema.parse("rig_face_rotation"),
      pivot: { x: 24, y: 36 },
      restAngleDegrees: 15,
      restTranslation: { x: 7, y: -3 }
    });

    expect(result.rigControlAfter).toMatchObject({
      kind: "rotation2d",
      parentId: "rig_parent",
      childDrawableIds: ["draw_body"],
      childRigControlIds: [],
      pivot: { x: 24, y: 36 },
      restAngleDegrees: 15,
      restTranslation: { x: 7, y: -3 },
      restScale: { x: 1, y: 1 },
      enabled: true
    });
    expect(session.graph.rigControlRootIds).toEqual(["rig_parent"]);
    expect(session.graph.keyformSets).toHaveLength(1);
    expect(session.graph.keyformSets[0]?.keys).toEqual([{ value: 0, statePatch: 0 }]);
  });

  it("rejects invalid and wrong-kind rotation field updates without mutating", () => {
    const session = createFixtureSession();
    createRotation2dRigControl(session, createRotationRigControl("rig_face_rotation", "Face Rotation"));
    createWarpLattice2dRigControl(session, createWarpLatticeRigControl("rig_face_warp", "Face Warp"));

    for (const [patch, expectedCode] of [
      [
        {
          pivot: { x: Number.NaN, y: 0 }
        },
        "invalid_rotation_pivot"
      ],
      [
        {
          restAngleDegrees: Number.POSITIVE_INFINITY
        },
        "invalid_rotation_rest_angle"
      ],
      [
        {
          restTranslation: { x: Number.NEGATIVE_INFINITY, y: 0 }
        },
        "invalid_rotation_rest_translation"
      ],
      [
        {
          rigControlId: RigControlIdSchema.parse("rig_face_warp"),
          restTranslation: { x: 1, y: 2 }
        },
        "unsupported_rig_control_update_field"
      ],
      [
        {
          pivot: { x: 64, y: 64 },
          restAngleDegrees: 0,
          restTranslation: { x: 0, y: 0 }
        },
        "no_op_rig_control_update"
      ]
    ] as const) {
      const before = structuredClone(session.graph.rigControls);
      let caught: unknown;
      try {
        updateRigControl(session, {
          rigControlId: RigControlIdSchema.parse("rig_face_rotation"),
          ...patch
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(AuthoringMutationError);
      expect((caught as AuthoringMutationError).code).toBe(expectedCode);
      expect(session.graph.rigControls).toEqual(before);
    }
  });

  it("rejects a rig control binding that would introduce a cycle", () => {
    const session = createFixtureSession();
    createRotation2dRigControl(session, createRotationRigControl("rig_parent", "Parent"));
    createRotation2dRigControl(session, createRotationRigControl("rig_child", "Child"));
    bindRigControlChild(session, {
      parentRigControlId: RigControlIdSchema.parse("rig_parent"),
      child: { kind: "rigControl", id: "rig_child" }
    });

    let caught: unknown;
    try {
      bindRigControlChild(session, {
        parentRigControlId: RigControlIdSchema.parse("rig_child"),
        child: { kind: "rigControl", id: "rig_parent" }
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AuthoringMutationError);
    expect((caught as AuthoringMutationError).code).toBe("rig_control_cycle");
    expect((caught as AuthoringMutationError).message).toBe(
      "Binding rig_parent under rig_child would create a rig control cycle"
    );
  });

  it("deletes a parented deformer and promotes child deformers and drawables to the parent", () => {
    const session = createFixtureSession();
    addFixtureDrawable(session, "draw_child", "Child Drawable");
    createRotation2dRigControl(session, createRotationRigControl("rig_parent", "Parent"));
    createWarpLattice2dRigControl(session, createWarpLatticeRigControl("rig_child", "Child"));
    createWarpLattice2dRigControl(
      session,
      createWarpLatticeRigControl("rig_target", "Target", {
        childDrawableIds: ["draw_child"],
        childRigControlIds: ["rig_child"]
      })
    );
    bindRigControlChild(session, {
      parentRigControlId: RigControlIdSchema.parse("rig_parent"),
      child: { kind: "rigControl", id: "rig_target" }
    });

    const result = deleteRigControl(session, {
      rigControlId: RigControlIdSchema.parse("rig_target")
    });

    expect(result.rigControlBefore.rigControlId).toBe("rig_target");
    expect(result.parentRigControlBefore?.childRigControlIds).toEqual(["rig_target"]);
    expect(result.parentRigControlAfter?.childRigControlIds).toEqual(["rig_child"]);
    expect(result.parentRigControlAfter?.childDrawableIds).toEqual(["draw_child"]);
    expect(result.childRigControlChanges[0]?.before.parentId).toBe("rig_target");
    expect(result.childRigControlChanges[0]?.after.parentId).toBe("rig_parent");
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_target"))).toBeUndefined();
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_parent"))).toMatchObject({
      childDrawableIds: ["draw_child"],
      childRigControlIds: ["rig_child"]
    });
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_child"))).toMatchObject({
      parentId: "rig_parent"
    });
    expect(session.graph.rigControlRootIds).toEqual(["rig_parent"]);
    expect(session.graph.stableOrder).not.toContain("rig_target");
  });

  it("deletes a root deformer and promotes child deformers to roots while unbinding child drawables", () => {
    const session = createFixtureSession();
    addFixtureDrawable(session, "draw_child", "Child Drawable");
    createWarpLattice2dRigControl(session, createWarpLatticeRigControl("rig_child", "Child"));
    createWarpLattice2dRigControl(
      session,
      createWarpLatticeRigControl("rig_target", "Target", {
        childDrawableIds: ["draw_child"],
        childRigControlIds: ["rig_child"]
      })
    );

    const result = deleteRigControl(session, {
      rigControlId: RigControlIdSchema.parse("rig_target")
    });

    expect(result.parentRigControlBefore).toBeUndefined();
    expect(result.rigControlRootIdsBefore).toEqual(["rig_target"]);
    expect(result.rigControlRootIdsAfter).toEqual(["rig_child"]);
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_target"))).toBeUndefined();
    expect(getRigControlById(session.graph, RigControlIdSchema.parse("rig_child"))).not.toHaveProperty("parentId");
    expect(session.graph.rigControls.some((rigControl) =>
      rigControl.childDrawableIds.includes(DrawableIdSchema.parse("draw_child"))
    )).toBe(false);
  });

  it("deletes only keyform sets that target the deleted deformer", () => {
    const session = createFixtureSession();
    createWarpLattice2dRigControl(session, createWarpLatticeRigControl("rig_child", "Child"));
    createWarpLattice2dRigControl(
      session,
      createWarpLatticeRigControl("rig_target", "Target", {
        childRigControlIds: ["rig_child"]
      })
    );
    session.graph.keyformSets.push(
      {
        keyformSetId: KeyformSetIdSchema.parse("keyset_target_offsets"),
        target: {
          kind: "rigControl",
          id: RigControlIdSchema.parse("rig_target"),
          property: "controlPointOffsets"
        },
        parameterId: ParameterIdSchema.parse("param_target"),
        evaluator: "linear-1d-v1",
        interpolation: "linear-1d-v1",
        compositionMode: "replace",
        compositionOrder: 0,
        keys: [{ value: 0, statePatch: Array.from({ length: 4 }, () => ({ x: 0, y: 0 })) }]
      },
      {
        keyformSetId: KeyformSetIdSchema.parse("keyset_child_offsets"),
        target: {
          kind: "rigControl",
          id: RigControlIdSchema.parse("rig_child"),
          property: "controlPointOffsets"
        },
        parameterId: ParameterIdSchema.parse("param_child"),
        evaluator: "linear-1d-v1",
        interpolation: "linear-1d-v1",
        compositionMode: "replace",
        compositionOrder: 0,
        keys: [{ value: 0, statePatch: Array.from({ length: 4 }, () => ({ x: 0, y: 0 })) }]
      }
    );
    session.graph.stableOrder.push("keyset_target_offsets", "keyset_child_offsets");

    const result = deleteRigControl(session, {
      rigControlId: RigControlIdSchema.parse("rig_target")
    });

    expect(result.removedKeyformSets.map((keyformSet) => keyformSet.keyformSetId)).toEqual([
      "keyset_target_offsets"
    ]);
    expect(session.graph.keyformSets.map((keyformSet) => keyformSet.keyformSetId)).toEqual([
      "keyset_child_offsets"
    ]);
    expect(session.graph.stableOrder).not.toContain("keyset_target_offsets");
    expect(session.graph.stableOrder).toContain("keyset_child_offsets");
  });

  it("leaves drawables, meshes, parts, textures, draw order, and dynamics unchanged when deleting a deformer", () => {
    const session = createFixtureSession();
    addFixtureDrawable(session, "draw_child", "Child Drawable");
    session.graph.meshes.push({
      meshId: MeshIdSchema.parse("mesh_child"),
      drawableId: DrawableIdSchema.parse("draw_child"),
      vertices: [{ x: 0, y: 0 }],
      uvs: [{ x: 0, y: 0 }],
      triangles: [],
      vertexStableIds: ["vtx_child_0"],
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      generationProvenanceId: ProvenanceIdSchema.parse("prov_child")
    });
    session.graph.drawOrder.push({
      drawableId: DrawableIdSchema.parse("draw_child"),
      baseDrawOrder: 2,
      stableOrder: 2
    });
    session.graph.textureAtlas = {
      schemaVersion: "texture-atlas-v1",
      textures: [{ textureId: TextureIdSchema.parse("tex_child"), filePath: "assets/textures/child.png" }]
    };
    session.graph.dynamicsGroups.push({
      dynamicsGroupId: DynamicsGroupIdSchema.parse("dyn_child"),
      displayName: "Child Dynamics",
      enabled: true,
      inputs: [
        {
          parameterId: ParameterIdSchema.parse("param_driver"),
          kind: "angle",
          scale: 30
        }
      ],
      chain: {
        rootOffset: { x: 0, y: 0 },
        segmentLengths: [14],
        damping: 2.5,
        gravityScale: 1
      },
      outputs: [
        {
          parameterId: ParameterIdSchema.parse("param_output"),
          segmentIndex: 1,
          scale: 0.0333,
          limit: 1
        }
      ]
    });
    createWarpLattice2dRigControl(
      session,
      createWarpLatticeRigControl("rig_target", "Target", {
        childDrawableIds: ["draw_child"]
      })
    );
    const drawablesBefore = structuredClone(session.graph.drawables);
    const meshesBefore = structuredClone(session.graph.meshes);
    const partsBefore = structuredClone(session.graph.parts);
    const textureAtlasBefore = structuredClone(session.graph.textureAtlas);
    const drawOrderBefore = structuredClone(session.graph.drawOrder);
    const dynamicsBefore = structuredClone(session.graph.dynamicsGroups);

    deleteRigControl(session, {
      rigControlId: RigControlIdSchema.parse("rig_target")
    });

    expect(session.graph.drawables).toEqual(drawablesBefore);
    expect(session.graph.meshes).toEqual(meshesBefore);
    expect(session.graph.parts).toEqual(partsBefore);
    expect(session.graph.textureAtlas).toEqual(textureAtlasBefore);
    expect(session.graph.drawOrder).toEqual(drawOrderBefore);
    expect(session.graph.dynamicsGroups).toEqual(dynamicsBefore);
  });

  it("rejects missing and incoherent delete targets without mutating the graph", () => {
    const missingSession = createFixtureSession();
    expectDeleteError(missingSession, "rig_missing", "missing_rig_control");

    const incoherentSession = createFixtureSession();
    createRotation2dRigControl(incoherentSession, createRotationRigControl("rig_parent", "Parent"));
    createRotation2dRigControl(incoherentSession, createRotationRigControl("rig_child", "Child"));
    bindRigControlChild(incoherentSession, {
      parentRigControlId: RigControlIdSchema.parse("rig_parent"),
      child: { kind: "rigControl", id: "rig_child" }
    });
    const childRigControl = getRigControlById(incoherentSession.graph, RigControlIdSchema.parse("rig_child"));
    if (childRigControl === undefined) {
      throw new Error("Expected child rig control fixture.");
    }
    delete childRigControl.parentId;

    expectDeleteError(incoherentSession, "rig_parent", "rig_control_parent_child_mismatch");
  });

  it("rejects existing rig-control cycles reachable from the delete target without mutating", () => {
    const session = createFixtureSession();
    createRotation2dRigControl(session, createRotationRigControl("rig_a", "A"));
    createRotation2dRigControl(session, createRotationRigControl("rig_b", "B"));
    const rigA = getRigControlById(session.graph, RigControlIdSchema.parse("rig_a"));
    const rigB = getRigControlById(session.graph, RigControlIdSchema.parse("rig_b"));
    if (rigA === undefined || rigB === undefined) {
      throw new Error("Expected cycle fixture rig controls.");
    }

    rigA.parentId = RigControlIdSchema.parse("rig_b");
    rigA.childRigControlIds = [RigControlIdSchema.parse("rig_b")];
    rigB.parentId = RigControlIdSchema.parse("rig_a");
    rigB.childRigControlIds = [RigControlIdSchema.parse("rig_a")];
    session.graph.rigControlRootIds = [];

    expectDeleteError(session, "rig_a", "rig_control_cycle");
  });
});

const createRotationRigControl = (
  rigControlId: string,
  displayName: string,
  overrides: Partial<{
    readonly partId: string;
    readonly childDrawableIds: readonly string[];
    readonly childRigControlIds: readonly string[];
  }> = {}
) => ({
  kind: "rotation2d" as const,
  rigControlId: RigControlIdSchema.parse(rigControlId),
  displayName,
  ...(overrides.partId === undefined ? {} : { partId: PartIdSchema.parse(overrides.partId) }),
  childDrawableIds: (overrides.childDrawableIds ?? []).map((drawableId) =>
    DrawableIdSchema.parse(drawableId)
  ),
  childRigControlIds: (overrides.childRigControlIds ?? []).map((childRigControlId) =>
    RigControlIdSchema.parse(childRigControlId)
  ),
  pivot: { x: 64, y: 64 },
  restAngleDegrees: 0,
  restTranslation: { x: 0, y: 0 },
  restScale: { x: 1, y: 1 },
  enabled: true
});

const createWarpLatticeRigControl = (
  rigControlId: string,
  displayName: string,
  overrides: Partial<{
    readonly partId: string;
    readonly childDrawableIds: readonly string[];
    readonly childRigControlIds: readonly string[];
  }> = {}
) => ({
  kind: "warpLattice2d" as const,
  rigControlId: RigControlIdSchema.parse(rigControlId),
  displayName,
  ...(overrides.partId === undefined ? {} : { partId: PartIdSchema.parse(overrides.partId) }),
  childDrawableIds: (overrides.childDrawableIds ?? []).map((drawableId) =>
    DrawableIdSchema.parse(drawableId)
  ),
  childRigControlIds: (overrides.childRigControlIds ?? []).map((childRigControlId) =>
    RigControlIdSchema.parse(childRigControlId)
  ),
  bindSpace: "rigControlLocalRest" as const,
  domainBounds: { x: 0, y: 0, width: 100, height: 100 },
  latticeColumns: 2,
  latticeRows: 2,
  restControlPoints: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 100 },
    { x: 100, y: 100 }
  ],
  interpolationMethod: "bilinear-grid-v1" as const,
  enabled: true
});

const expectWrapError = (
  session: AuthoringSession,
  rigControl: ReturnType<typeof createRotationRigControl> | ReturnType<typeof createWarpLatticeRigControl>,
  wrapChildren: Parameters<typeof wrapRigControlChildren>[2]["wrapChildren"],
  expectedCode: AuthoringMutationError["code"],
  parentRigControlId?: Parameters<typeof wrapRigControlChildren>[2]["parentRigControlId"]
): void => {
  const before = structuredClone(session.graph);
  let caught: unknown;
  try {
    wrapRigControlChildren(session, rigControl, {
      wrapChildren,
      ...(parentRigControlId === undefined ? {} : { parentRigControlId })
    });
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(AuthoringMutationError);
  expect((caught as AuthoringMutationError).code).toBe(expectedCode);
  expect(session.graph).toEqual(before);
};

const expectDeleteError = (
  session: AuthoringSession,
  rigControlId: string,
  expectedCode: AuthoringMutationError["code"]
): void => {
  const before = structuredClone(session.graph);
  let caught: unknown;
  try {
    deleteRigControl(session, {
      rigControlId: RigControlIdSchema.parse(rigControlId)
    });
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(AuthoringMutationError);
  expect((caught as AuthoringMutationError).code).toBe(expectedCode);
  expect(session.graph).toEqual(before);
};

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
  session.graph.stableOrder.push(parsedDrawableId);
};

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_rig_control_mutations_test"),
    packageDisplayName: "Rig Control Mutations Test",
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
    meshes: [],
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

const loadMinimalFixturePackageDocument = (): PackageDocumentDto => {
  const fixtureDirectory = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../fixtures/contracts/minimal-valid-package"
  );
  const parsed = parsePackageDocument({
    manifest: readJson(join(fixtureDirectory, "manifest.json")),
    model: {
      graph: readJson(join(fixtureDirectory, "model/graph.json")),
      drawables: readJson(join(fixtureDirectory, "model/drawables.json")),
      meshes: readJson(join(fixtureDirectory, "model/meshes.json")),
      parameters: readJson(join(fixtureDirectory, "model/parameters.json")),
      keyforms: readJson(join(fixtureDirectory, "model/keyforms.json")),
      rigControls: readJson(join(fixtureDirectory, "model/rig-controls.json")),
      dynamics: readJson(join(fixtureDirectory, "model/dynamics.json")),
      masks: readJson(join(fixtureDirectory, "model/masks.json")),
      drawOrder: readJson(join(fixtureDirectory, "model/draw-order.json"))
    },
    assets: {
      sourceManifest: readJson(join(fixtureDirectory, "assets/sources/source-manifest.json")),
      provenance: readJson(join(fixtureDirectory, "assets/provenance.json")),
      rights: readJson(join(fixtureDirectory, "assets/rights.json"))
    }
  });

  if (!parsed.success) {
    throw new Error(parsed.issues.map((issue) => issue.message).join("\n"));
  }

  return parsed.data;
};

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
