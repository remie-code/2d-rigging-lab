import {
  MeshIdSchema,
  MeshTopologyRevisionDtoSchema,
  MeshTriangleVertexIdsDtoSchema,
  TriangleIdSchema,
  Vec2Schema,
  VertexIdSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

const LockedTargetIdsSchema = z.array(z.string().min(1)).default([]);
const OptionalInsertIndexSchema = z.number().int().nonnegative().optional();
const OperationIntentSchema = z.string().max(500);

export const AddMeshVertexPayloadDtoSchema = z.object({
  meshId: MeshIdSchema,
  vertexId: VertexIdSchema,
  position: Vec2Schema,
  uv: Vec2Schema,
  insertIndex: OptionalInsertIndexSchema,
  expectedTopologyRevision: MeshTopologyRevisionDtoSchema.optional(),
  lockedTargetIds: LockedTargetIdsSchema,
  intent: OperationIntentSchema
});
export const AddMeshVertexPayloadSchema = AddMeshVertexPayloadDtoSchema;
export type AddMeshVertexPayloadDto = z.infer<typeof AddMeshVertexPayloadDtoSchema>;

export const RemoveMeshVertexPayloadDtoSchema = z.object({
  meshId: MeshIdSchema,
  vertexId: VertexIdSchema,
  removalPolicy: z.literal("unreferenced-only"),
  expectedTopologyRevision: MeshTopologyRevisionDtoSchema.optional(),
  lockedTargetIds: LockedTargetIdsSchema,
  intent: OperationIntentSchema
});
export const RemoveMeshVertexPayloadSchema = RemoveMeshVertexPayloadDtoSchema;
export type RemoveMeshVertexPayloadDto = z.infer<typeof RemoveMeshVertexPayloadDtoSchema>;

export const AddMeshTrianglePayloadDtoSchema = z.object({
  meshId: MeshIdSchema,
  triangleId: TriangleIdSchema,
  vertexIds: MeshTriangleVertexIdsDtoSchema,
  windingPolicy: z.literal("preserveVertexOrder"),
  insertIndex: OptionalInsertIndexSchema,
  expectedTopologyRevision: MeshTopologyRevisionDtoSchema.optional(),
  lockedTargetIds: LockedTargetIdsSchema,
  intent: OperationIntentSchema
});
export const AddMeshTrianglePayloadSchema = AddMeshTrianglePayloadDtoSchema;
export type AddMeshTrianglePayloadDto = z.infer<typeof AddMeshTrianglePayloadDtoSchema>;

export const RemoveMeshTrianglePayloadDtoSchema = z.object({
  meshId: MeshIdSchema,
  triangleId: TriangleIdSchema,
  removalPolicy: z.literal("remove-triangle-only"),
  expectedTopologyRevision: MeshTopologyRevisionDtoSchema.optional(),
  lockedTargetIds: LockedTargetIdsSchema,
  intent: OperationIntentSchema
});
export const RemoveMeshTrianglePayloadSchema = RemoveMeshTrianglePayloadDtoSchema;
export type RemoveMeshTrianglePayloadDto = z.infer<typeof RemoveMeshTrianglePayloadDtoSchema>;

export const MoveMeshUvPointPayloadDtoSchema = z.object({
  meshId: MeshIdSchema,
  uvDeltas: z
    .array(
      z.object({
        vertexId: VertexIdSchema,
        delta: Vec2Schema
      })
    )
    .min(1),
  expectedTopologyRevision: MeshTopologyRevisionDtoSchema.optional(),
  lockedTargetIds: LockedTargetIdsSchema,
  intent: OperationIntentSchema
});
export const MoveMeshUvPointPayloadSchema = MoveMeshUvPointPayloadDtoSchema;
export type MoveMeshUvPointPayloadDto = z.infer<typeof MoveMeshUvPointPayloadDtoSchema>;
