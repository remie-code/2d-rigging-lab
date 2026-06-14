import {
  createGeneratedMeshForDrawable,
  createInitialAuthoringRevision,
  getV6MeshGenerationContractFixture,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
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
  TextureIdSchema,
  type RectDto,
  type RigControlId
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import {
  commitBindDrawableToRigControl,
  commitCreateRotationDeformer,
  commitCreateWarpDeformer,
  commitDrawableReorder,
  commitDrawableReparent,
  commitEditKeyformKey,
  commitGenerateMesh,
  commitMoveDrawableRigControlBinding,
  commitPartReparent,
  commitReparentRigControl,
  commitUpdateRigControl
} from "./editor-session-commands";
import { createStructureTreeRows, type StructureTreeRow } from "./session-tree";

const PART_ROOT = PartIdSchema.parse("part_root");
const PART_A = PartIdSchema.parse("part_a");
const PART_B = PartIdSchema.parse("part_b");
const PART_C = PartIdSchema.parse("part_c");
const DRAW_A = DrawableIdSchema.parse("draw_a");
const DRAW_B = DrawableIdSchema.parse("draw_b");
const DRAW_C = DrawableIdSchema.parse("draw_c");

describe("editor session commands", () => {
  it("reparents a drawable and resyncs Canvas draw order to projected tree order", () => {
    const session = createFixtureSession([DRAW_C, DRAW_A, DRAW_B]);
    const result = commitDrawableReparent(session, DRAW_B, PART_A);

    expect(result.committed).toBe(true);
    expect(findDrawablePart(result.session, DRAW_B)).toBe(PART_A);
    expect(projectedDrawableOrder(result.session)).toEqual([DRAW_C, DRAW_B, DRAW_A]);
    expect(globalDrawableOrder(result.session)).toEqual(projectedDrawableOrder(result.session));
    expect(findDrawablePart(session, DRAW_B)).toBe(PART_B);
  });

  it("reparents a cross-part drawable reorder drop and preserves top-row-is-front draw order", () => {
    const session = createFixtureSession([DRAW_A, DRAW_B, DRAW_C]);
    const result = commitDrawableReorder(session, DRAW_C, DRAW_A, "before");

    expect(result.committed).toBe(true);
    expect(findDrawablePart(result.session, DRAW_C)).toBe(PART_A);
    expect(projectedDrawableOrder(result.session)).toEqual([DRAW_C, DRAW_A, DRAW_B]);
    expect(globalDrawableOrder(result.session)).toEqual(projectedDrawableOrder(result.session));
  });

  it("reparents a part and resyncs Canvas draw order to the new subtree row order", () => {
    const session = createFixtureSession([DRAW_A, DRAW_B, DRAW_C]);
    const result = commitPartReparent(session, PART_B, PART_A);

    expect(result.committed).toBe(true);
    expect(result.session.graph.parts.find((part) => part.partId === PART_B)?.parentPartId).toBe(PART_A);
    expect(projectedDrawableOrder(result.session)).toEqual([DRAW_B, DRAW_A, DRAW_C]);
    expect(globalDrawableOrder(result.session)).toEqual(projectedDrawableOrder(result.session));
  });

  it("commits a Warp Deformer through the package operation contract", () => {
    const session = createFixtureSession([DRAW_A, DRAW_B, DRAW_C]);
    const result = commitCreateWarpDeformer(session, {
      partId: PART_A,
      displayName: "Part A Warp",
      childDrawableIds: [DRAW_A],
      childRigControlIds: [],
      domainBounds: { x: 0, y: 0, width: 32, height: 32 },
      transformColumns: 5,
      transformRows: 4,
      bezierColumns: 3,
      bezierRows: 2,
      bezierEditType: "cubicBezierSurfaceV1"
    });

    expect(result.committed).toBe(true);
    expect(result.rigControlId).toBeDefined();
    expect(session.graph.rigControls).toHaveLength(0);

    const rigControl = result.session.graph.rigControls.find(
      (candidate) => candidate.rigControlId === result.rigControlId
    );
    expect(rigControl).toMatchObject({
      kind: "warpLattice2d",
      displayName: "Part A Warp",
      partId: PART_A,
      childDrawableIds: [DRAW_A],
      latticeColumns: 5,
      latticeRows: 4,
      warpDeformer: {
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
        }
      }
    });
  });

  it("routes Deformer Tree bind, rebind, and reparent operations without changing Parts or draw order", () => {
    const session = createFixtureSession([DRAW_A, DRAW_B, DRAW_C]);
    const parentResult = commitCreateWarpDeformer(session, {
      partId: PART_A,
      displayName: "Parent Warp",
      childDrawableIds: [DRAW_A],
      childRigControlIds: [],
      domainBounds: { x: 0, y: 0, width: 32, height: 32 },
      transformColumns: 5,
      transformRows: 5,
      bezierColumns: 3,
      bezierRows: 3,
      bezierEditType: "cubicBezierSurfaceV1"
    });
    const targetResult = commitCreateWarpDeformer(parentResult.session, {
      partId: PART_B,
      displayName: "Target Warp",
      childDrawableIds: [DRAW_B],
      childRigControlIds: [],
      domainBounds: { x: 0, y: 0, width: 32, height: 32 },
      transformColumns: 5,
      transformRows: 5,
      bezierColumns: 3,
      bezierRows: 3,
      bezierEditType: "cubicBezierSurfaceV1"
    });

    const parentRigControlId = parentResult.rigControlId!;
    const targetRigControlId = targetResult.rigControlId!;
    const partsBefore = targetResult.session.graph.drawables.map((drawable) => [
      drawable.drawableId,
      drawable.partId
    ]);
    const drawOrderBefore = globalDrawableOrder(targetResult.session);

    const poolBind = commitBindDrawableToRigControl(
      targetResult.session,
      DRAW_C,
      parentRigControlId
    );
    expect(poolBind.committed).toBe(true);
    expect(
      poolBind.session.graph.rigControls.find(
        (rigControl) => rigControl.rigControlId === parentRigControlId
      )?.childDrawableIds
    ).toEqual([DRAW_A, DRAW_C]);

    const rebind = commitMoveDrawableRigControlBinding(
      poolBind.session,
      DRAW_A,
      targetRigControlId
    );
    expect(rebind.committed).toBe(true);
    expect(
      rebind.session.graph.rigControls.find(
        (rigControl) => rigControl.rigControlId === parentRigControlId
      )?.childDrawableIds
    ).toEqual([DRAW_C]);
    expect(
      rebind.session.graph.rigControls.find(
        (rigControl) => rigControl.rigControlId === targetRigControlId
      )?.childDrawableIds
    ).toEqual([DRAW_B, DRAW_A]);

    const reparent = commitReparentRigControl(
      rebind.session,
      targetRigControlId,
      parentRigControlId
    );
    expect(reparent.committed).toBe(true);
    expect(
      reparent.session.graph.rigControls.find(
        (rigControl) => rigControl.rigControlId === targetRigControlId
      )?.parentId
    ).toBe(parentRigControlId);
    expect(reparent.session.graph.drawables.map((drawable) => [drawable.drawableId, drawable.partId])).toEqual(
      partsBefore
    );
    expect(globalDrawableOrder(reparent.session)).toEqual(drawOrderBefore);
  });

  it("maps invalid Deformer Tree drops to rejected operation results without mutating", () => {
    const session = createFixtureSession([DRAW_A, DRAW_B]);
    const parentResult = commitCreateWarpDeformer(session, {
      partId: PART_A,
      displayName: "Parent Warp",
      childDrawableIds: [DRAW_A],
      childRigControlIds: [],
      domainBounds: { x: 0, y: 0, width: 32, height: 32 },
      transformColumns: 5,
      transformRows: 5,
      bezierColumns: 3,
      bezierRows: 3,
      bezierEditType: "cubicBezierSurfaceV1"
    });

    const rejected = commitMoveDrawableRigControlBinding(
      parentResult.session,
      DRAW_A,
      parentResult.rigControlId!
    );
    expect(rejected.committed).toBe(false);
    expect(rejected.diagnostics[0]?.checkId).toBe(
      "operation.moveDrawableRigControlBinding.noOp"
    );
    expect(rejected.session).toBe(parentResult.session);
    expect(
      parentResult.session.graph.rigControls.find(
        (rigControl) => rigControl.rigControlId === parentResult.rigControlId
      )?.childDrawableIds
    ).toEqual([DRAW_A]);

    const missingTarget = commitBindDrawableToRigControl(
      parentResult.session,
      DRAW_B,
      RigControlIdSchema.parse("rig_missing_target")
    );
    expect(missingTarget.committed).toBe(false);
    expect(missingTarget.diagnostics[0]?.checkId).toBe(
      "operation.bindRigControlChild.missingParentRigControl"
    );
  });

  it("surfaces duplicate and root no-op rig operation rejections without mutating", () => {
    const session = createFixtureSession([DRAW_A, DRAW_B]);
    const sourceResult = commitCreateWarpDeformer(session, {
      partId: PART_A,
      displayName: "Source Warp",
      childDrawableIds: [DRAW_A],
      childRigControlIds: [],
      domainBounds: { x: 0, y: 0, width: 32, height: 32 },
      transformColumns: 5,
      transformRows: 5,
      bezierColumns: 3,
      bezierRows: 3,
      bezierEditType: "cubicBezierSurfaceV1"
    });
    const targetResult = commitCreateWarpDeformer(sourceResult.session, {
      partId: PART_B,
      displayName: "Target Warp",
      childDrawableIds: [DRAW_B],
      childRigControlIds: [],
      domainBounds: { x: 0, y: 0, width: 32, height: 32 },
      transformColumns: 5,
      transformRows: 5,
      bezierColumns: 3,
      bezierRows: 3,
      bezierEditType: "cubicBezierSurfaceV1"
    });
    const rigControlsBefore = structuredClone(targetResult.session.graph.rigControls);
    const rootIdsBefore = [...targetResult.session.graph.rigControlRootIds];

    const alreadyBound = commitBindDrawableToRigControl(
      targetResult.session,
      DRAW_A,
      targetResult.rigControlId!
    );
    expect(alreadyBound.committed).toBe(false);
    expect(alreadyBound.diagnostics[0]?.checkId).toBe(
      "operation.bindRigControlChild.childAlreadyParented"
    );
    expect(alreadyBound.diagnostics[0]?.message).toContain(String(sourceResult.rigControlId));
    expect(alreadyBound.session).toBe(targetResult.session);
    expect(targetResult.session.graph.rigControls).toEqual(rigControlsBefore);
    expect(targetResult.session.graph.rigControlRootIds).toEqual(rootIdsBefore);

    const rootNoOp = commitReparentRigControl(
      targetResult.session,
      sourceResult.rigControlId!,
      null
    );
    expect(rootNoOp.committed).toBe(false);
    expect(rootNoOp.diagnostics[0]?.checkId).toBe("operation.reparentRigControl.noOp");
    expect(rootNoOp.session).toBe(targetResult.session);
    expect(targetResult.session.graph.rigControls).toEqual(rigControlsBefore);
    expect(targetResult.session.graph.rigControlRootIds).toEqual(rootIdsBefore);
  });

  it("commits Rotation Deformer creation and Deformer Inspector updates, rejecting cardinality conflicts", () => {
    const session = createFixtureSession([DRAW_A, DRAW_B]);
    const rotation = commitCreateRotationDeformer(session, {
      partId: PART_A,
      displayName: "Drawable A Rotation",
      childDrawableIds: [DRAW_A],
      childRigControlIds: [],
      opacityMultiplier: 1,
      pivot: { x: 10, y: 20 },
      restAngleDegrees: 0
    });
    expect(rotation.committed).toBe(true);
    expect(
      rotation.session.graph.rigControls.find(
        (rigControl) => rigControl.rigControlId === rotation.rigControlId
      )
    ).toMatchObject({
      kind: "rotation2d",
      childDrawableIds: [DRAW_A]
    });

    const warp = commitCreateWarpDeformer(rotation.session, {
      partId: PART_B,
      displayName: "Drawable B Warp",
      childDrawableIds: [DRAW_B],
      childRigControlIds: [],
      domainBounds: { x: 0, y: 0, width: 32, height: 32 },
      transformColumns: 5,
      transformRows: 5,
      bezierColumns: 3,
      bezierRows: 3,
      bezierEditType: "cubicBezierSurfaceV1"
    });
    const updated = commitUpdateRigControl(warp.session, {
      rigControlId: warp.rigControlId!,
      displayName: "Drawable B Warp Updated",
      domainBounds: { x: 2, y: 3, width: 48, height: 40 },
      opacityMultiplier: 0.5,
      transformColumns: 6,
      transformRows: 4,
      bezierColumns: 4,
      bezierRows: 2
    });
    expect(updated.committed).toBe(true);
    expect(
      updated.session.graph.rigControls.find(
        (rigControl) => rigControl.rigControlId === warp.rigControlId
      )
    ).toMatchObject({
      displayName: "Drawable B Warp Updated",
      domainBounds: { x: 2, y: 3, width: 48, height: 40 },
      opacityMultiplier: 0.5,
      latticeColumns: 6,
      latticeRows: 4,
      warpDeformer: {
        transformGrid: {
          rows: 4
        },
        bezierEditSurface: {
          columns: 4,
          rows: 2
        }
      }
    });

    updated.session.graph.keyformSets.push({
      keyformSetId: KeyformSetIdSchema.parse("keyset_drawable_b_warp_offsets"),
      target: {
        kind: "rigControl",
        id: warp.rigControlId!,
        property: "controlPointOffsets"
      },
      parameterId: ParameterIdSchema.parse("param_drawable_b_warp"),
      evaluator: "linear-1d-v1",
      interpolation: "linear-1d-v1",
      compositionMode: "replace",
      compositionOrder: 0,
      keys: [
        {
          value: 0,
          statePatch: Array.from({ length: 24 }, () => ({ x: 0, y: 0 }))
        }
      ]
    });

    const rejected = commitUpdateRigControl(updated.session, {
      rigControlId: warp.rigControlId!,
      transformRows: 6
    });
    expect(rejected.committed).toBe(false);
    expect(rejected.diagnostics[0]?.checkId).toBe(
      "operation.updateRigControl.keyformCardinalityConflict"
    );
  });

  it("commits drawable opacity keyform add, update, and delete through the editor command wrapper", () => {
    const session = createFixtureSession([DRAW_A]);
    const parameterId = ParameterIdSchema.parse("param_face_angle_x");
    const add = commitEditKeyformKey(session, {
      action: "addCurrent",
      target: { kind: "drawable", id: DRAW_A },
      targetProperty: "opacity",
      parameterId,
      keyValue: 0,
      interpolation: "linear-1d-v1",
      statePatch: {
        propertyPath: "opacity",
        value: 0.5
      }
    });
    expect(add.committed).toBe(true);
    expect(session.graph.keyformSets).toEqual([]);
    expect(findDrawableOpacityKeyformSet(add.session)?.keys).toEqual([
      { value: 0, statePatch: 0.5 }
    ]);

    const update = commitEditKeyformKey(add.session, {
      action: "updateCurrent",
      target: { kind: "drawable", id: DRAW_A },
      targetProperty: "opacity",
      parameterId,
      keyValue: 0,
      interpolation: "linear-1d-v1",
      statePatch: {
        propertyPath: "opacity",
        value: 0.25
      }
    });
    expect(update.committed).toBe(true);
    expect(findDrawableOpacityKeyformSet(update.session)?.keys).toEqual([
      { value: 0, statePatch: 0.25 }
    ]);

    const deleted = commitEditKeyformKey(update.session, {
      action: "deleteCurrent",
      target: { kind: "drawable", id: DRAW_A },
      targetProperty: "opacity",
      parameterId,
      keyValue: 0,
      interpolation: "linear-1d-v1"
    });
    expect(deleted.committed).toBe(true);
    expect(findDrawableOpacityKeyformSet(deleted.session)).toBeUndefined();
  });

  it("commits Rotation rig-control angle keyform add, update, and delete through the editor command wrapper", () => {
    const session = createFixtureSession([DRAW_A]);
    const rotation = commitCreateRotationDeformer(session, {
      partId: PART_A,
      displayName: "Drawable A Rotation",
      childDrawableIds: [DRAW_A],
      childRigControlIds: [],
      opacityMultiplier: 1,
      pivot: { x: 16, y: 16 },
      restAngleDegrees: 0
    });
    expect(rotation.committed).toBe(true);
    const rigControlId = rotation.rigControlId!;
    const parameterId = ParameterIdSchema.parse("param_face_angle_x");

    const add = commitEditKeyformKey(rotation.session, {
      action: "addCurrent",
      target: { kind: "rigControl", id: rigControlId },
      targetProperty: "angleDegrees",
      parameterId,
      keyValue: 0,
      interpolation: "linear-1d-v1",
      statePatch: {
        propertyPath: "angleDegrees",
        value: 15
      }
    });
    expect(add.committed).toBe(true);
    expect(findRigControlKeyformSet(add.session, rigControlId, "angleDegrees")?.keys).toEqual([
      { value: 0, statePatch: 15 }
    ]);

    const update = commitEditKeyformKey(add.session, {
      action: "updateCurrent",
      target: { kind: "rigControl", id: rigControlId },
      targetProperty: "angleDegrees",
      parameterId,
      keyValue: 0,
      interpolation: "linear-1d-v1",
      statePatch: {
        propertyPath: "angleDegrees",
        value: -20
      }
    });
    expect(update.committed).toBe(true);
    expect(findRigControlKeyformSet(update.session, rigControlId, "angleDegrees")?.keys).toEqual([
      { value: 0, statePatch: -20 }
    ]);

    const deleted = commitEditKeyformKey(update.session, {
      action: "deleteCurrent",
      target: { kind: "rigControl", id: rigControlId },
      targetProperty: "angleDegrees",
      parameterId,
      keyValue: 0,
      interpolation: "linear-1d-v1"
    });
    expect(deleted.committed).toBe(true);
    expect(findRigControlKeyformSet(deleted.session, rigControlId, "angleDegrees")).toBeUndefined();
  });

  it("creates parent Warp and Rotation Deformers above selected Deformers", () => {
    const session = createFixtureSession([DRAW_A, DRAW_B]);
    const child = commitCreateWarpDeformer(session, {
      partId: PART_A,
      displayName: "Child Warp",
      childDrawableIds: [DRAW_A],
      childRigControlIds: [],
      domainBounds: { x: 0, y: 0, width: 32, height: 32 },
      transformColumns: 5,
      transformRows: 5,
      bezierColumns: 3,
      bezierRows: 3,
      bezierEditType: "cubicBezierSurfaceV1"
    });
    expect(child.committed).toBe(true);

    const parentWarp = commitCreateWarpDeformer(child.session, {
      partId: PART_A,
      displayName: "Parent Warp",
      childDrawableIds: [],
      childRigControlIds: [child.rigControlId!],
      domainBounds: { x: 0, y: 0, width: 32, height: 32 },
      transformColumns: 5,
      transformRows: 5,
      bezierColumns: 3,
      bezierRows: 3,
      bezierEditType: "cubicBezierSurfaceV1"
    });
    expect(parentWarp.committed).toBe(true);
    expect(
      parentWarp.session.graph.rigControls.find(
        (rigControl) => rigControl.rigControlId === child.rigControlId
      )?.parentId
    ).toBe(parentWarp.rigControlId);
    expect(parentWarp.session.graph.rigControlRootIds).toEqual([parentWarp.rigControlId]);

    const parentRotation = commitCreateRotationDeformer(parentWarp.session, {
      partId: PART_A,
      displayName: "Parent Rotation",
      childDrawableIds: [],
      childRigControlIds: [],
      opacityMultiplier: 1,
      pivot: { x: 16, y: 16 },
      restAngleDegrees: 0,
      parentRigControlId: parentWarp.rigControlId!,
      insertBeforeChild: {
        kind: "rigControl",
        id: child.rigControlId!
      }
    });
    expect(parentRotation.committed).toBe(true);
    const warpAfter = parentRotation.session.graph.rigControls.find(
      (rigControl) => rigControl.rigControlId === parentWarp.rigControlId
    );
    const childAfter = parentRotation.session.graph.rigControls.find(
      (rigControl) => rigControl.rigControlId === child.rigControlId
    );
    expect(warpAfter?.childRigControlIds).toEqual([parentRotation.rigControlId]);
    expect(childAfter?.parentId).toBe(parentRotation.rigControlId);
  });

  it("rejects cycle and missing-target Deformer reparent operations without mutating", () => {
    const session = createFixtureSession([DRAW_A, DRAW_B]);
    const parent = commitCreateWarpDeformer(session, {
      partId: PART_A,
      displayName: "Parent Warp",
      childDrawableIds: [],
      childRigControlIds: [],
      domainBounds: { x: 0, y: 0, width: 32, height: 32 },
      transformColumns: 5,
      transformRows: 5,
      bezierColumns: 3,
      bezierRows: 3,
      bezierEditType: "cubicBezierSurfaceV1"
    });
    const child = commitCreateWarpDeformer(parent.session, {
      partId: PART_A,
      displayName: "Child Warp",
      parentRigControlId: parent.rigControlId!,
      childDrawableIds: [DRAW_A],
      childRigControlIds: [],
      domainBounds: { x: 0, y: 0, width: 32, height: 32 },
      transformColumns: 5,
      transformRows: 5,
      bezierColumns: 3,
      bezierRows: 3,
      bezierEditType: "cubicBezierSurfaceV1"
    });

    const cycle = commitReparentRigControl(child.session, parent.rigControlId!, child.rigControlId!);
    expect(cycle.committed).toBe(false);
    expect(cycle.diagnostics[0]?.checkId).toBe("operation.reparentRigControl.cycle");
    expect(cycle.session).toBe(child.session);

    const missing = commitReparentRigControl(
      child.session,
      child.rigControlId!,
      RigControlIdSchema.parse("rig_missing_parent")
    );
    expect(missing.committed).toBe(false);
    expect(missing.diagnostics[0]?.checkId).toBe(
      "operation.reparentRigControl.missingParentRigControl"
    );
  });

  it("defaults Mesh Tool generation commands to auto-outline-v2.6-soft-apron", () => {
    const session = createFixtureSession([DRAW_A]);
    const bytes = createAlphaBytes(4, 4, [
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2]
    ]);
    session.graph.meshes = [
      {
        meshId: MeshIdSchema.parse("mesh_a"),
        drawableId: DRAW_A,
        vertices: [],
        uvs: [],
        triangles: [],
        vertexStableIds: [],
        triangleStableIds: [],
        topologyRevision: 0,
        bounds: { x: 0, y: 0, width: 4, height: 4 },
        generationProvenanceId: ProvenanceIdSchema.parse("prov_a")
      }
    ];
    session.graph.textureAtlas = {
      schemaVersion: "texture-atlas-v1",
      textures: [
        {
          textureId: TextureIdSchema.parse("tex_a"),
          filePath: "assets/textures/a.raw-rgba",
          sourceAssetId: SourceAssetIdSchema.parse("src_fixture"),
          binaryAssetRef: {
            referenceKind: "package-binary-asset-ref-v1",
            binaryAssetId: "bin_a_rgba",
            packageRelativePath: "assets/textures/a.raw-rgba",
            digest: {
              algorithm: "sha256",
              hex: "0".repeat(64)
            },
            byteLength: bytes.byteLength,
            mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
            storageStatus: "stored-package-local-v1",
            provenanceId: ProvenanceIdSchema.parse("prov_a"),
            rightsAssetId: "rights_a"
          }
        }
      ]
    };
    session.binaryAssets = {
      fileEntries: [
        {
          path: "assets/textures/a.raw-rgba",
          bytes,
          mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
          binaryAssetId: "bin_a_rgba"
        }
      ],
      binaryAssetIndex: {
        schemaVersion: "binary-asset-index-v1",
        assets: []
      },
      byteIntakeSummaries: []
    };

    const result = commitGenerateMesh(session, DRAW_A, "medium");

    expect(result.committed).toBe(true);
    expect(result.session.graph.provenanceRecords.at(-1)?.transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v2.6-soft-apron",
        "fallback:auto-outline-v2.6-soft-apron:soft-boundary-generation-failed",
        "meshSource:outline-v2-rgba"
      ])
    );
  });

  it("commits v6 preview mesh geometry with the previewed method provenance", () => {
    const session = createFixtureSession([DRAW_A]);
    const fixture = getV6MeshGenerationContractFixture("v6-simple-rectangle");
    attachDrawableMeshTextureBytes(session, {
      meshBounds: fixture.meshBounds,
      textureSize: fixture.textureSize,
      bytes: createAlphaBytes(
        fixture.textureSize.width,
        fixture.textureSize.height,
        fixture.opaquePixels
      )
    });

    const preview = createGeneratedMeshForDrawable({
      session,
      drawableId: DRAW_A,
      provenanceId: ProvenanceIdSchema.parse("prov_preview_v6a"),
      method: "auto-outline-v6a-local",
      densityHint: "medium"
    });
    expect(preview).toBeDefined();
    expect(preview?.qualityMetrics?.v6Metrics?.methodId).toBe("auto-outline-v6a-local");

    const result = commitGenerateMesh(
      session,
      DRAW_A,
      "medium",
      preview?.mesh,
      "auto-outline-v6a-local",
      preview === undefined
        ? undefined
        : {
            source: preview.source,
            ...(preview.fallbackReason === undefined ? {} : { fallbackReason: preview.fallbackReason }),
            ...(preview.fallbackSteps === undefined ? {} : { fallbackSteps: preview.fallbackSteps }),
            ...(preview.qualityMetrics === undefined ? {} : { qualityMetrics: preview.qualityMetrics })
          }
    );

    expect(result.committed).toBe(true);
    const committedMesh = result.session.graph.meshes.find((mesh) => mesh.meshId === MeshIdSchema.parse("mesh_a"));
    expect(committedMesh?.vertices).toEqual(preview?.mesh.vertices);
    expect(committedMesh?.uvs).toEqual(preview?.mesh.uvs);
    expect(committedMesh?.triangles).toEqual(preview?.mesh.triangles);
    expect(committedMesh?.vertexStableIds).toEqual(preview?.mesh.vertexStableIds);
    expect(result.session.graph.provenanceRecords.at(-1)?.transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v6a-local",
        "meshSource:previewMesh",
        "previewMeshSource:outline-v6a-local-rgba",
        "meshQuality:v6ActualSource=outline-v6a-local-rgba",
        "meshQuality:v6Output=backend-output"
      ])
    );
  });
});

function projectedDrawableOrder(session: AuthoringSession) {
  return createStructureTreeRows(session, null)
    .filter(
      (row): row is Extract<StructureTreeRow, { readonly kind: "drawable" }> =>
        row.kind === "drawable"
    )
    .map((row) => row.id);
}

function globalDrawableOrder(session: AuthoringSession) {
  return [...session.graph.drawOrder]
    .sort((left, right) => left.stableOrder - right.stableOrder)
    .map((entry) => entry.drawableId);
}

function findDrawablePart(session: AuthoringSession, drawableId: typeof DRAW_A) {
  return session.graph.drawables.find((drawable) => drawable.drawableId === drawableId)?.partId;
}

function findDrawableOpacityKeyformSet(session: AuthoringSession) {
  return session.graph.keyformSets.find(
    (keyformSet) =>
      keyformSet.evaluator === "linear-1d-v1" &&
      keyformSet.target.kind === "drawable" &&
      keyformSet.target.id === DRAW_A &&
      keyformSet.target.property === "opacity"
  );
}

function findRigControlKeyformSet(
  session: AuthoringSession,
  rigControlId: RigControlId,
  targetProperty: string
) {
  return session.graph.keyformSets.find(
    (keyformSet) =>
      keyformSet.evaluator === "linear-1d-v1" &&
      keyformSet.target.kind === "rigControl" &&
      keyformSet.target.id === rigControlId &&
      keyformSet.target.property === targetProperty
  );
}

function createFixtureSession(drawableOrder: readonly (typeof DRAW_A)[]): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_editor_session_commands_fixture"),
      packageDisplayName: "Editor Session Commands Fixture",
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
          partId: PART_ROOT,
          displayName: "Root",
          childPartIds: [PART_A, PART_B, PART_C],
          drawableIds: []
        },
        {
          partId: PART_A,
          displayName: "Part A",
          parentPartId: PART_ROOT,
          childPartIds: [],
          drawableIds: [DRAW_A]
        },
        {
          partId: PART_B,
          displayName: "Part B",
          parentPartId: PART_ROOT,
          childPartIds: [],
          drawableIds: [DRAW_B]
        },
        {
          partId: PART_C,
          displayName: "Part C",
          parentPartId: PART_ROOT,
          childPartIds: [],
          drawableIds: [DRAW_C]
        }
      ],
      drawables: [
        createDrawable(DRAW_A, PART_A),
        createDrawable(DRAW_B, PART_B),
        createDrawable(DRAW_C, PART_C)
      ],
      meshes: [],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: drawableOrder.map((drawableId, stableOrder) => ({
        drawableId,
        baseDrawOrder: stableOrder,
        stableOrder
      })),
      rigControlRootIds: [],
      stableOrder: [PART_ROOT, PART_A, PART_B, PART_C, DRAW_A, DRAW_B, DRAW_C],
      sourceAssets: [],
      provenanceRecords: [],
      rightsRecords: []
    }
  };
}

function createDrawable(drawableId: typeof DRAW_A, partId: typeof PART_A) {
  const token = drawableId.replace(/^draw_/, "");

  return {
    drawableId,
    displayName: `Drawable ${token.toUpperCase()}`,
    partId,
    sourceAssetId: SourceAssetIdSchema.parse("src_fixture"),
    textureId: TextureIdSchema.parse(`tex_${token}`),
    meshId: MeshIdSchema.parse(`mesh_${token}`),
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder: 0,
    sourceProvenanceId: ProvenanceIdSchema.parse(`prov_${token}`)
  };
}

function attachDrawableMeshTextureBytes(
  session: AuthoringSession,
  input: {
    readonly meshBounds: RectDto;
    readonly textureSize: { readonly width: number; readonly height: number };
    readonly bytes: Uint8Array;
  }
): void {
  const drawable = session.graph.drawables.find((candidate) => candidate.drawableId === DRAW_A);
  if (drawable === undefined) {
    throw new Error("Expected fixture drawable.");
  }
  if (input.bytes.byteLength !== input.textureSize.width * input.textureSize.height * 4) {
    throw new Error("Fixture texture bytes do not match texture dimensions.");
  }

  const texturePath = "assets/textures/a.raw-rgba";
  session.graph.meshes = [
    {
      meshId: MeshIdSchema.parse("mesh_a"),
      drawableId: DRAW_A,
      vertices: [],
      uvs: [],
      triangles: [],
      vertexStableIds: [],
      triangleStableIds: [],
      topologyRevision: 0,
      bounds: input.meshBounds,
      generationProvenanceId: ProvenanceIdSchema.parse("prov_a")
    }
  ];
  session.graph.textureAtlas = {
    schemaVersion: "texture-atlas-v1",
    textures: [
      {
        textureId: drawable.textureId,
        filePath: texturePath,
        sourceAssetId: SourceAssetIdSchema.parse("src_fixture"),
        binaryAssetRef: {
          referenceKind: "package-binary-asset-ref-v1",
          binaryAssetId: "bin_a_rgba",
          packageRelativePath: texturePath,
          digest: {
            algorithm: "sha256",
            hex: "0".repeat(64)
          },
          byteLength: input.bytes.byteLength,
          mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
          storageStatus: "stored-package-local-v1",
          provenanceId: ProvenanceIdSchema.parse("prov_a"),
          rightsAssetId: "rights_a"
        }
      }
    ]
  };
  session.binaryAssets = {
    fileEntries: [
      {
        path: texturePath,
        bytes: input.bytes,
        mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
        binaryAssetId: "bin_a_rgba"
      }
    ],
    binaryAssetIndex: {
      schemaVersion: "binary-asset-index-v1",
      assets: []
    },
    byteIntakeSummaries: []
  };
}

function createAlphaBytes(
  width: number,
  height: number,
  opaquePixels: readonly (readonly [number, number])[]
): Uint8Array {
  const bytes = new Uint8Array(width * height * 4);

  for (const [x, y] of opaquePixels) {
    const index = (y * width + x) * 4;
    bytes[index] = 255;
    bytes[index + 1] = 255;
    bytes[index + 2] = 255;
    bytes[index + 3] = 255;
  }

  return bytes;
}
