import { z } from "zod";

import { TriangleIdSchema, VertexIdSchema } from "./ids.js";

const stableMeshIdTokenPattern = /^[A-Za-z0-9_-]+$/;

export const MeshTopologyRevisionDtoSchema = z.number().int().nonnegative();
export type MeshTopologyRevisionDto = z.infer<typeof MeshTopologyRevisionDtoSchema>;
export const MeshTopologyRevisionSchema = MeshTopologyRevisionDtoSchema;

export const MeshVertexStableIdDtoSchema = z.string().regex(stableMeshIdTokenPattern);
export type MeshVertexStableIdDto = z.infer<typeof MeshVertexStableIdDtoSchema>;
export const MeshVertexStableIdSchema = MeshVertexStableIdDtoSchema;

export const MeshTriangleIndicesDtoSchema = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.number().int().nonnegative()
]);
export type MeshTriangleIndicesDto = z.infer<typeof MeshTriangleIndicesDtoSchema>;
export const MeshTriangleIndicesSchema = MeshTriangleIndicesDtoSchema;

export const MeshTriangleVertexIdsDtoSchema = z.tuple([
  VertexIdSchema,
  VertexIdSchema,
  VertexIdSchema
]);
export type MeshTriangleVertexIdsDto = z.infer<typeof MeshTriangleVertexIdsDtoSchema>;
export const MeshTriangleVertexIdsSchema = MeshTriangleVertexIdsDtoSchema;

export const MeshTriangleStableIdSetDtoSchema = z.array(TriangleIdSchema);
export type MeshTriangleStableIdSetDto = z.infer<typeof MeshTriangleStableIdSetDtoSchema>;
export const MeshTriangleStableIdSetSchema = MeshTriangleStableIdSetDtoSchema;
