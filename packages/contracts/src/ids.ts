import { z } from "zod";

import type { Brand } from "./brand.js";

export type PackageId = Brand<string, "PackageId">;
export type SourceAssetId = Brand<string, "SourceAssetId">;
export type TextureId = Brand<string, "TextureId">;
export type PartId = Brand<string, "PartId">;
export type DrawableId = Brand<string, "DrawableId">;
export type MeshId = Brand<string, "MeshId">;
export type VertexId = Brand<string, "VertexId">;
export type TriangleId = Brand<string, "TriangleId">;
export type ParameterId = Brand<string, "ParameterId">;
export type KeyformSetId = Brand<string, "KeyformSetId">;
export type RigControlId = Brand<string, "RigControlId">;
export type DynamicsGroupId = Brand<string, "DynamicsGroupId">;
export type MaskRelationId = Brand<string, "MaskRelationId">;
export type OperationId = Brand<string, "OperationId">;
export type TransactionId = Brand<string, "TransactionId">;
export type ValidationReportId = Brand<string, "ValidationReportId">;
export type RuntimeSnapshotId = Brand<string, "RuntimeSnapshotId">;
export type RepairCandidateId = Brand<string, "RepairCandidateId">;
export type ProvenanceId = Brand<string, "ProvenanceId">;

const idTokenPattern = "[A-Za-z0-9_-]+";

const brandedIdSchema = <TId extends Brand<string, string>>(prefix: string): z.ZodType<TId> =>
  z.string().regex(new RegExp(`^${prefix}_${idTokenPattern}$`)) as unknown as z.ZodType<TId>;

export const PackageIdSchema = brandedIdSchema<PackageId>("pkg");
export const SourceAssetIdSchema = brandedIdSchema<SourceAssetId>("src");
export const TextureIdSchema = brandedIdSchema<TextureId>("tex");
export const PartIdSchema = brandedIdSchema<PartId>("part");
export const DrawableIdSchema = brandedIdSchema<DrawableId>("draw");
export const MeshIdSchema = brandedIdSchema<MeshId>("mesh");
export const VertexIdSchema = brandedIdSchema<VertexId>("vtx");
export const TriangleIdSchema = brandedIdSchema<TriangleId>("tri");
export const ParameterIdSchema = brandedIdSchema<ParameterId>("param");
export const KeyformSetIdSchema = brandedIdSchema<KeyformSetId>("keyset");
export const RigControlIdSchema = brandedIdSchema<RigControlId>("rig");
export const DynamicsGroupIdSchema = brandedIdSchema<DynamicsGroupId>("dyn");
export const MaskRelationIdSchema = brandedIdSchema<MaskRelationId>("maskrel");
export const OperationIdSchema = brandedIdSchema<OperationId>("op");
export const TransactionIdSchema = brandedIdSchema<TransactionId>("txn");
export const ValidationReportIdSchema = brandedIdSchema<ValidationReportId>("val");
export const RuntimeSnapshotIdSchema = brandedIdSchema<RuntimeSnapshotId>("snap");
export const RepairCandidateIdSchema = brandedIdSchema<RepairCandidateId>("repair");
export const ProvenanceIdSchema = brandedIdSchema<ProvenanceId>("prov");
