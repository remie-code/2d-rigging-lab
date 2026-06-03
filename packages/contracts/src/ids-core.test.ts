import { describe, expect, it } from "vitest";

import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  KeyformSetIdSchema,
  MaskRelationIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  ProvenanceIdSchema,
  RepairCandidateIdSchema,
  RuntimeSnapshotIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  TransactionIdSchema,
  TriangleIdSchema,
  ValidationReportIdSchema,
  VertexIdSchema,
  MeshIdSchema,
  OperationIdSchema,
  PartIdSchema,
  RigControlIdSchema
} from "./ids.js";

const validIds = [
  [PackageIdSchema, "pkg_avatarClean"],
  [SourceAssetIdSchema, "src_face-psd_01"],
  [TextureIdSchema, "tex_base_0"],
  [PartIdSchema, "part_head"],
  [DrawableIdSchema, "draw_eyeLeft"],
  [MeshIdSchema, "mesh_eyeLeft"],
  [VertexIdSchema, "vtx_eyeLeft_0001"],
  [TriangleIdSchema, "tri_eyeLeft_0001"],
  [ParameterIdSchema, "param_faceYaw"],
  [KeyformSetIdSchema, "keyset_faceYaw"],
  [RigControlIdSchema, "rig_armLeft"],
  [DynamicsGroupIdSchema, "dyn_hairSway"],
  [MaskRelationIdSchema, "maskrel_eyeClip"],
  [OperationIdSchema, "op_createRigControl001"],
  [TransactionIdSchema, "txn_authoring_001"],
  [ValidationReportIdSchema, "val_initial"],
  [RuntimeSnapshotIdSchema, "snap_mvp001"],
  [RepairCandidateIdSchema, "repair_dynamicsDriver"],
  [ProvenanceIdSchema, "prov_psdImport001"]
] as const;

describe("branded ID schemas", () => {
  it.each(validIds)("accepts valid prefixed IDs", (schema, value) => {
    expect(schema.parse(value)).toBe(value);
  });

  it("rejects an ID with the wrong prefix", () => {
    expect(PackageIdSchema.safeParse("src_avatarClean").success).toBe(false);
  });

  it("rejects IDs with spaces", () => {
    expect(DrawableIdSchema.safeParse("draw eyeLeft").success).toBe(false);
  });

  it("rejects empty suffixes", () => {
    expect(OperationIdSchema.safeParse("op_").success).toBe(false);
  });
});
