import {
  createInitialAuthoringRevision,
  getVariantGroupById
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createOperationCore } from "../operation-core.js";

describe("variant operations", () => {
  it("dry-runs createVariantGroup without mutating the original session", () => {
    const session = createVariantOperationFixtureSession();
    const core = createOperationCore();

    const result = core.dryRunOperation(session, createVariantGroupRequest({ dryRun: true }));

    expect(result.status).toBe("dry_run");
    expect(result.reversible).toBe(true);
    expect(result.modelDiff?.added).toEqual([
      {
        kind: "package",
        id: "pkg_variant_operation_test",
        path: "/model/variants/variantGroups/vgrp_expression"
      }
    ]);
    expect(getVariantGroupById(session.graph, "vgrp_expression")).toBeUndefined();
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
    expect(core.operationLog.entries).toHaveLength(0);
  });

  it("commits create, rename, and delete Variant Group operations through lifecycle logging", () => {
    const session = createVariantOperationFixtureSession();
    const core = createOperationCore({
      now: () => new Date("2026-06-24T00:00:00.000Z")
    });

    const creation = core.commitOperation(session, createVariantGroupRequest({ dryRun: false }));
    const update = core.commitOperation(session, createUpdateVariantGroupRequest());
    const deletion = core.commitOperation(session, createDeleteVariantGroupRequest());

    expect(creation.result.status).toBe("committed");
    expect(update.result.status).toBe("committed");
    expect(deletion.result.status).toBe("committed");
    expect(session.packageRevision).toBe(3);
    expect(session.authoringRevision).toBe(3);
    expect(session.dirty).toBe(true);
    expect(session.graph.variantGroups).toEqual([]);
    expect(core.operationLog.entries.map((entry) => entry.operationType)).toEqual([
      "createVariantGroup",
      "updateVariantGroup",
      "deleteVariantGroup"
    ]);
    expect(core.operationLog.entries[0]?.targetIds).toEqual(["vgrp_expression"]);
    expect(core.operationLog.entries[0]?.result.modelDiff?.changed[0]?.fields[0]).toMatchObject({
      path: "/model/variants/variantGroups"
    });
  });

  it("adds and removes target drawables while enforcing single group ownership", () => {
    const session = createVariantOperationFixtureSession();
    const core = createOperationCore();

    core.commitOperation(session, createVariantGroupRequest({ dryRun: false }));
    core.commitOperation(session, createOutfitGroupRequest());

    const add = core.commitOperation(session, createAddTargetDrawableRequest({
      operationId: "op_add_face_to_expression",
      basePackageRevision: 2,
      variantGroupId: "vgrp_expression",
      drawableId: "draw_face"
    }));
    const duplicate = core.commitOperation(session, createAddTargetDrawableRequest({
      operationId: "op_add_face_to_outfit",
      basePackageRevision: 3,
      variantGroupId: "vgrp_outfit",
      drawableId: "draw_face"
    }));
    const remove = core.commitOperation(session, createRemoveTargetDrawableRequest({
      basePackageRevision: 3,
      variantGroupId: "vgrp_expression",
      drawableId: "draw_face"
    }));

    expect(add.result.status).toBe("committed");
    expect(duplicate.result.status).toBe("rejected");
    expect(duplicate.result.diagnostics[0]?.checkId).toBe(
      "operation.addVariantTargetDrawable.targetDrawableAlreadyOwned"
    );
    expect(remove.result.status).toBe("committed");
    expect(session.packageRevision).toBe(4);
    expect(getVariantGroupById(session.graph, "vgrp_expression")?.targetDrawableIds).toEqual([]);
  });

  it("adds, renames, deletes variants, and rejects last single-select variant deletion", () => {
    const session = createVariantOperationFixtureSession();
    const core = createOperationCore();

    core.commitOperation(session, createVariantGroupRequest({ dryRun: false }));
    const creation = core.commitOperation(session, createVariantRequest({ basePackageRevision: 1 }));
    const update = core.commitOperation(session, createUpdateVariantRequest());
    const deletion = core.commitOperation(session, createDeleteVariantRequest({
      basePackageRevision: 3,
      variantId: "var_expression_smile"
    }));
    const lastDelete = core.commitOperation(session, createDeleteVariantRequest({
      basePackageRevision: 4,
      operationId: "op_delete_default_variant",
      variantId: "var_expression_default"
    }));

    expect(creation.result.status).toBe("committed");
    expect(update.result.status).toBe("committed");
    expect(deletion.result.status).toBe("committed");
    expect(lastDelete.result.status).toBe("rejected");
    expect(lastDelete.result.diagnostics[0]?.checkId).toBe("operation.deleteVariant.lastVariantDelete");
    expect(getVariantGroupById(session.graph, "vgrp_expression")?.variants).toEqual([
      { variantId: "var_expression_default", displayName: "Default" }
    ]);
  });

  it("updates membership and validates default active selection references", () => {
    const session = createVariantOperationFixtureSession();
    const core = createOperationCore();

    core.commitOperation(session, createVariantGroupRequest({ dryRun: false }));
    core.commitOperation(session, createVariantRequest({ basePackageRevision: 1 }));
    core.commitOperation(session, createAddTargetDrawableRequest({
      operationId: "op_add_face_to_expression",
      basePackageRevision: 2,
      variantGroupId: "vgrp_expression",
      drawableId: "draw_face"
    }));

    const membership = core.commitOperation(session, createSetMembershipRequest());
    const defaultActive = core.commitOperation(session, createSetDefaultActiveRequest({
      basePackageRevision: 4,
      variantId: "var_expression_smile"
    }));
    const invalidDefault = core.commitOperation(session, createSetDefaultActiveRequest({
      basePackageRevision: 5,
      operationId: "op_set_missing_default_active",
      variantId: "var_expression_missing"
    }));

    expect(membership.result.status).toBe("committed");
    expect(defaultActive.result.status).toBe("committed");
    expect(invalidDefault.result.status).toBe("rejected");
    expect(invalidDefault.result.diagnostics[0]?.checkId)
      .toBe("operation.setVariantDefaultActiveSelection.invalidDefaultActive");
    expect(getVariantGroupById(session.graph, "vgrp_expression")).toMatchObject({
      memberships: [{ drawableId: "draw_face", variantIds: ["var_expression_smile"] }],
      defaultActive: { kind: "singleSelect", variantId: "var_expression_smile" }
    });
  });

  it("rejects invalid references routed through Variant operation handlers", () => {
    const session = createVariantOperationFixtureSession();
    const core = createOperationCore();

    core.commitOperation(session, createVariantGroupRequest({ dryRun: false }));
    const missingDrawable = core.commitOperation(session, createAddTargetDrawableRequest({
      operationId: "op_add_missing_drawable_to_expression",
      basePackageRevision: 1,
      variantGroupId: "vgrp_expression",
      drawableId: "draw_missing"
    }));
    const addTarget = core.commitOperation(session, createAddTargetDrawableRequest({
      operationId: "op_add_face_to_expression",
      basePackageRevision: 1,
      variantGroupId: "vgrp_expression",
      drawableId: "draw_face"
    }));
    const missingVariant = core.commitOperation(session, createSetMembershipRequest({
      operationId: "op_set_missing_variant_membership",
      basePackageRevision: 2,
      variantId: "var_expression_missing"
    }));

    expect(missingDrawable.result.status).toBe("rejected");
    expect(missingDrawable.result.diagnostics[0]?.checkId)
      .toBe("operation.addVariantTargetDrawable.missingDrawable");
    expect(addTarget.result.status).toBe("committed");
    expect(missingVariant.result.status).toBe("rejected");
    expect(missingVariant.result.diagnostics[0]?.checkId)
      .toBe("operation.setVariantMembership.missingVariant");
    expect(session.packageRevision).toBe(2);
    expect(session.authoringRevision).toBe(2);
    expect(getVariantGroupById(session.graph, "vgrp_expression")?.memberships).toEqual([
      { drawableId: "draw_face", variantIds: [] }
    ]);
  });
});

const createVariantGroupRequest = (options: {
  readonly dryRun: boolean;
  readonly basePackageRevision?: number;
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: "op_create_expression_group",
  actor: "test",
  surface: "testFixture",
  dryRun: options.dryRun,
  basePackageRevision: options.basePackageRevision ?? 0,
  operationType: "createVariantGroup",
  payload: {
    variantGroupId: "vgrp_expression",
    displayName: "Expression",
    mode: "singleSelect",
    initialVariantId: "var_expression_default",
    initialVariantName: "Default"
  }
});

const createOutfitGroupRequest = () => ({
  schemaVersion: "operation-request-v1",
  operationId: "op_create_outfit_group",
  actor: "test",
  surface: "testFixture",
  dryRun: false,
  basePackageRevision: 1,
  operationType: "createVariantGroup",
  payload: {
    variantGroupId: "vgrp_outfit",
    displayName: "Outfit",
    mode: "singleSelect",
    initialVariantId: "var_outfit_default",
    initialVariantName: "Default"
  }
});

const createUpdateVariantGroupRequest = () => ({
  schemaVersion: "operation-request-v1",
  operationId: "op_update_expression_group",
  actor: "test",
  surface: "testFixture",
  dryRun: false,
  basePackageRevision: 1,
  operationType: "updateVariantGroup",
  payload: {
    variantGroupId: "vgrp_expression",
    displayName: "Expressions"
  }
});

const createDeleteVariantGroupRequest = () => ({
  schemaVersion: "operation-request-v1",
  operationId: "op_delete_expression_group",
  actor: "test",
  surface: "testFixture",
  dryRun: false,
  basePackageRevision: 2,
  operationType: "deleteVariantGroup",
  payload: {
    variantGroupId: "vgrp_expression"
  }
});

const createVariantRequest = (options: { readonly basePackageRevision: number }) => ({
  schemaVersion: "operation-request-v1",
  operationId: "op_create_smile_variant",
  actor: "test",
  surface: "testFixture",
  dryRun: false,
  basePackageRevision: options.basePackageRevision,
  operationType: "createVariant",
  payload: {
    variantGroupId: "vgrp_expression",
    variantId: "var_expression_smile",
    displayName: "Smile"
  }
});

const createUpdateVariantRequest = () => ({
  schemaVersion: "operation-request-v1",
  operationId: "op_update_smile_variant",
  actor: "test",
  surface: "testFixture",
  dryRun: false,
  basePackageRevision: 2,
  operationType: "updateVariant",
  payload: {
    variantGroupId: "vgrp_expression",
    variantId: "var_expression_smile",
    displayName: "Big Smile"
  }
});

const createDeleteVariantRequest = (options: {
  readonly basePackageRevision: number;
  readonly variantId: string;
  readonly operationId?: string;
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: options.operationId ?? "op_delete_smile_variant",
  actor: "test",
  surface: "testFixture",
  dryRun: false,
  basePackageRevision: options.basePackageRevision,
  operationType: "deleteVariant",
  payload: {
    variantGroupId: "vgrp_expression",
    variantId: options.variantId
  }
});

const createAddTargetDrawableRequest = (options: {
  readonly operationId: string;
  readonly basePackageRevision: number;
  readonly variantGroupId: string;
  readonly drawableId: string;
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: options.operationId,
  actor: "test",
  surface: "testFixture",
  dryRun: false,
  basePackageRevision: options.basePackageRevision,
  operationType: "addVariantTargetDrawable",
  payload: {
    variantGroupId: options.variantGroupId,
    drawableId: options.drawableId
  }
});

const createRemoveTargetDrawableRequest = (options: {
  readonly basePackageRevision: number;
  readonly variantGroupId: string;
  readonly drawableId: string;
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: "op_remove_face_from_expression",
  actor: "test",
  surface: "testFixture",
  dryRun: false,
  basePackageRevision: options.basePackageRevision,
  operationType: "removeVariantTargetDrawable",
  payload: {
    variantGroupId: options.variantGroupId,
    drawableId: options.drawableId
  }
});

const createSetMembershipRequest = (options?: {
  readonly operationId?: string;
  readonly basePackageRevision?: number;
  readonly variantGroupId?: string;
  readonly drawableId?: string;
  readonly variantId?: string;
  readonly member?: boolean;
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: options?.operationId ?? "op_set_face_smile_membership",
  actor: "test",
  surface: "testFixture",
  dryRun: false,
  basePackageRevision: options?.basePackageRevision ?? 3,
  operationType: "setVariantMembership",
  payload: {
    variantGroupId: options?.variantGroupId ?? "vgrp_expression",
    drawableId: options?.drawableId ?? "draw_face",
    variantId: options?.variantId ?? "var_expression_smile",
    member: options?.member ?? true
  }
});

const createSetDefaultActiveRequest = (options: {
  readonly basePackageRevision: number;
  readonly variantId: string;
  readonly operationId?: string;
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: options.operationId ?? "op_set_expression_default_active",
  actor: "test",
  surface: "testFixture",
  dryRun: false,
  basePackageRevision: options.basePackageRevision,
  operationType: "setVariantDefaultActiveSelection",
  payload: {
    variantGroupId: "vgrp_expression",
    defaultActive: {
      kind: "singleSelect",
      variantId: options.variantId
    }
  }
});

const createVariantOperationFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_variant_operation_test"),
    packageDisplayName: "Variant Operation Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 1024, height: 1024 },
    parts: [],
    drawables: [createDrawable("draw_face", "Face")],
    meshes: [],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [],
    variantGroups: [],
    rigControlRootIds: [],
    stableOrder: [],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});

const createDrawable = (drawableIdText: string, displayName: string) => ({
  drawableId: DrawableIdSchema.parse(drawableIdText),
  displayName,
  partId: PartIdSchema.parse("part_root"),
  sourceAssetId: SourceAssetIdSchema.parse("src_split_png"),
  textureId: TextureIdSchema.parse(`tex_${drawableIdText.replace(/^draw_/, "")}`),
  meshId: MeshIdSchema.parse(`mesh_${drawableIdText.replace(/^draw_/, "")}`),
  defaultOpacity: 1,
  runtimeVisibility: true,
  baseDrawOrder: 0,
  sourceProvenanceId: ProvenanceIdSchema.parse("prov_variant_operation")
});
