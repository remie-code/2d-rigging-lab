import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
  insertRigControlBetweenParentAndChild,
  moveDrawableRigControlBinding,
  reparentRigControl,
  updateRigControl
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
});

const createRotationRigControl = (
  rigControlId: string,
  displayName: string,
  overrides: Partial<{
    readonly childDrawableIds: readonly string[];
    readonly childRigControlIds: readonly string[];
  }> = {}
) => ({
  kind: "rotation2d" as const,
  rigControlId: RigControlIdSchema.parse(rigControlId),
  displayName,
  partId: PartIdSchema.parse("part_root"),
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
    readonly childDrawableIds: readonly string[];
    readonly childRigControlIds: readonly string[];
  }> = {}
) => ({
  kind: "warpLattice2d" as const,
  rigControlId: RigControlIdSchema.parse(rigControlId),
  displayName,
  partId: PartIdSchema.parse("part_root"),
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
