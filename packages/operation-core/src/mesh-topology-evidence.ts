import {
  MeshIdSchema,
  MeshTopologyRevisionDtoSchema,
  MeshTriangleVertexIdsDtoSchema,
  TriangleIdSchema,
  Vec2Schema,
  VertexIdSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

export const MeshTopologyEditOperationTypeSchema = z.enum([
  "addMeshVertex",
  "removeMeshVertex",
  "addMeshTriangle",
  "removeMeshTriangle",
  "moveMeshUvPoint"
]);
export type MeshTopologyEditOperationType = z.infer<typeof MeshTopologyEditOperationTypeSchema>;

const MeshElementIndexSchema = z.number().int().nonnegative();

export const MeshTopologyEvidenceChangeDtoSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("vertexAdded"),
    vertexId: VertexIdSchema,
    vertexIndex: MeshElementIndexSchema,
    position: Vec2Schema,
    uv: Vec2Schema
  }),
  z.object({
    kind: z.literal("vertexRemoved"),
    vertexId: VertexIdSchema,
    vertexIndex: MeshElementIndexSchema
  }),
  z.object({
    kind: z.literal("triangleAdded"),
    triangleId: TriangleIdSchema,
    triangleIndex: MeshElementIndexSchema,
    vertexIds: MeshTriangleVertexIdsDtoSchema
  }),
  z.object({
    kind: z.literal("triangleRemoved"),
    triangleId: TriangleIdSchema,
    triangleIndex: MeshElementIndexSchema
  }),
  z.object({
    kind: z.literal("uvMoved"),
    vertexId: VertexIdSchema,
    vertexIndex: MeshElementIndexSchema,
    before: Vec2Schema,
    after: Vec2Schema
  })
]);
export type MeshTopologyEvidenceChangeDto = z.infer<typeof MeshTopologyEvidenceChangeDtoSchema>;

export const MeshTopologyOperationEvidenceDtoSchema = z.object({
  schemaVersion: z.literal("mesh-topology-operation-evidence-v1"),
  operationType: MeshTopologyEditOperationTypeSchema,
  meshId: MeshIdSchema,
  topologyRevisionBefore: MeshTopologyRevisionDtoSchema.optional(),
  topologyRevisionAfter: MeshTopologyRevisionDtoSchema.optional(),
  vertexCountBefore: z.number().int().nonnegative().optional(),
  vertexCountAfter: z.number().int().nonnegative().optional(),
  triangleCountBefore: z.number().int().nonnegative().optional(),
  triangleCountAfter: z.number().int().nonnegative().optional(),
  changes: z.array(MeshTopologyEvidenceChangeDtoSchema).min(1),
  rendererCorrectnessClaim: z.literal("none"),
  textureSamplingCorrectnessClaim: z.literal("none")
});
export const MeshTopologyOperationEvidenceSchema = MeshTopologyOperationEvidenceDtoSchema;
export type MeshTopologyOperationEvidenceDto = z.infer<typeof MeshTopologyOperationEvidenceDtoSchema>;
