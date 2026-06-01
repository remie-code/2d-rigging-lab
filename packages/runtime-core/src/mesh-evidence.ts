import {
  DrawableIdSchema,
  MeshIdSchema,
  RectDtoSchema,
  RuntimeSnapshotIdSchema,
  Vec2DtoSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  DrawableId,
  MeshId,
  RectDto,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import type { NormalizedDrawable, NormalizedMeshTriangle } from "./normalized-runtime-graph.js";
import type { SnapshotComparisonPolicyInput } from "./snapshot-comparison.js";
import { SnapshotComparisonPolicySchema } from "./snapshot-comparison.js";

export const EvaluatedMeshTopologySummarySchema = z.object({
  vertexCount: z.number().int().nonnegative(),
  stableVertexIdCount: z.number().int().nonnegative(),
  uvCount: z.number().int().nonnegative(),
  triangleCount: z.number().int().nonnegative(),
  triangleIndexCount: z.number().int().nonnegative(),
  hasStableVertexIds: z.boolean(),
  hasUvProjection: z.boolean(),
  hasTriangles: z.boolean()
});
export type EvaluatedMeshTopologySummaryDto = z.infer<typeof EvaluatedMeshTopologySummarySchema>;

export const EvaluatedMeshVertexSchema = z.object({
  vertexIndex: z.number().int().nonnegative(),
  vertexStableId: z.string().optional(),
  vertexRef: z.string(),
  position: Vec2DtoSchema
});
export type EvaluatedMeshVertexDto = z.infer<typeof EvaluatedMeshVertexSchema>;

export const EvaluatedDrawableMeshEvidenceSchema = z.object({
  drawableId: DrawableIdSchema,
  meshId: MeshIdSchema,
  bounds: RectDtoSchema,
  vertexHash: z.string(),
  topology: EvaluatedMeshTopologySummarySchema,
  vertices: z.array(EvaluatedMeshVertexSchema).default([])
});
export type EvaluatedDrawableMeshEvidenceDto = z.infer<typeof EvaluatedDrawableMeshEvidenceSchema>;

export const RuntimeMovedMeshVertexRefSchema = z.object({
  drawableId: DrawableIdSchema,
  meshId: MeshIdSchema,
  vertexIndex: z.number().int().nonnegative(),
  vertexStableId: z.string().optional(),
  vertexRef: z.string(),
  before: Vec2DtoSchema,
  after: Vec2DtoSchema,
  delta: Vec2DtoSchema
});
export type RuntimeMovedMeshVertexRefDto = z.infer<typeof RuntimeMovedMeshVertexRefSchema>;

export const RuntimeDrawableMeshEditEvidenceSchema = z.object({
  drawableId: DrawableIdSchema,
  meshId: MeshIdSchema,
  boundsBefore: RectDtoSchema.optional(),
  boundsAfter: RectDtoSchema,
  vertexHashBefore: z.string().optional(),
  vertexHashAfter: z.string(),
  boundsChanged: z.boolean(),
  vertexHashChanged: z.boolean(),
  topology: EvaluatedMeshTopologySummarySchema,
  vertices: z.array(EvaluatedMeshVertexSchema).default([]),
  movedVertexRefs: z.array(RuntimeMovedMeshVertexRefSchema).default([])
});
export type RuntimeDrawableMeshEditEvidenceDto = z.infer<typeof RuntimeDrawableMeshEditEvidenceSchema>;

export const RuntimeMeshEditEvidenceSchema = z.object({
  schemaVersion: z.literal("runtime-mesh-edit-evidence-v1"),
  baselineSnapshotId: RuntimeSnapshotIdSchema,
  candidateSnapshotId: RuntimeSnapshotIdSchema,
  drawables: z.array(RuntimeDrawableMeshEditEvidenceSchema).default([])
});
export type RuntimeMeshEditEvidenceDto = z.infer<typeof RuntimeMeshEditEvidenceSchema>;

export interface CreateEvaluatedDrawableMeshEvidenceInput {
  readonly drawable: Pick<
    NormalizedDrawable,
    "drawableId" | "meshId" | "vertexStableIds" | "uvs" | "triangles"
  > & {
    readonly bounds: RectDto;
    readonly vertexHash: string;
    readonly vertexCount: number;
    readonly vertices?: readonly Vec2Dto[];
  };
  readonly includeVertices: boolean;
}

export const createEvaluatedDrawableMeshEvidence = (
  input: CreateEvaluatedDrawableMeshEvidenceInput
): EvaluatedDrawableMeshEvidenceDto => {
  const vertices = input.includeVertices
    ? createEvaluatedMeshVertices(input.drawable.meshId, input.drawable.vertices, input.drawable.vertexStableIds)
    : [];

  return EvaluatedDrawableMeshEvidenceSchema.parse({
    drawableId: input.drawable.drawableId,
    meshId: input.drawable.meshId,
    bounds: input.drawable.bounds,
    vertexHash: input.drawable.vertexHash,
    topology: createTopologySummary({
      vertexCount: input.drawable.vertexCount,
      ...(input.drawable.vertexStableIds === undefined ? {} : { vertexStableIds: input.drawable.vertexStableIds }),
      ...(input.drawable.uvs === undefined ? {} : { uvs: input.drawable.uvs }),
      ...(input.drawable.triangles === undefined ? {} : { triangles: input.drawable.triangles })
    }),
    vertices
  });
};

export const createRuntimeMeshEditEvidence = (input: {
  readonly baselineSnapshot: {
    readonly snapshotId: string;
    readonly drawables: readonly RuntimeMeshEvidenceDrawable[];
  };
  readonly candidateSnapshot: {
    readonly snapshotId: string;
    readonly drawables: readonly RuntimeMeshEvidenceDrawable[];
  };
  readonly comparisonPolicy?: SnapshotComparisonPolicyInput | undefined;
}): RuntimeMeshEditEvidenceDto => {
  const policy = SnapshotComparisonPolicySchema.parse(input.comparisonPolicy ?? {});
  const baselineByDrawableId = new Map(input.baselineSnapshot.drawables.map((drawable) => [drawable.drawableId, drawable]));
  const drawables = input.candidateSnapshot.drawables
    .flatMap((candidate) => {
      const candidateMesh = candidate.mesh;
      if (candidateMesh === undefined) {
        return [];
      }

      const baseline = baselineByDrawableId.get(candidate.drawableId);
      return [
        RuntimeDrawableMeshEditEvidenceSchema.parse({
          drawableId: candidate.drawableId,
          meshId: candidate.meshId,
          ...(baseline?.bounds === undefined ? {} : { boundsBefore: baseline.bounds }),
          boundsAfter: candidate.bounds,
          ...(baseline?.vertexHash === undefined ? {} : { vertexHashBefore: baseline.vertexHash }),
          vertexHashAfter: candidate.vertexHash,
          boundsChanged:
            baseline === undefined ? false : boundsChanged(baseline.bounds, candidate.bounds, policy.boundsEpsilon),
          vertexHashChanged: baseline === undefined ? false : baseline.vertexHash !== candidate.vertexHash,
          topology: candidateMesh.topology,
          vertices: candidateMesh.vertices,
          movedVertexRefs:
            baseline?.mesh === undefined
              ? []
              : createMovedVertexRefs({
                  before: baseline.mesh,
                  after: candidateMesh,
                  vertexPositionEpsilon: policy.vertexPositionEpsilon
                })
        })
      ];
    })
    .sort((left, right) => left.drawableId.localeCompare(right.drawableId));

  return RuntimeMeshEditEvidenceSchema.parse({
    schemaVersion: "runtime-mesh-edit-evidence-v1",
    baselineSnapshotId: input.baselineSnapshot.snapshotId,
    candidateSnapshotId: input.candidateSnapshot.snapshotId,
    drawables
  });
};

export const createMeshVertexRef = (
  meshId: MeshId | string,
  vertexIndex: number,
  vertexStableId: string | undefined
): string => (vertexStableId === undefined ? `${meshId}.vertex.${vertexIndex}` : `${meshId}.${vertexStableId}`);

export const shouldEmitDrawableMeshEvidence = (drawable: Pick<
  NormalizedDrawable,
  "vertices" | "vertexStableIds" | "uvs" | "triangles"
>): boolean =>
  drawable.vertices !== undefined ||
  drawable.vertexStableIds !== undefined ||
  drawable.uvs !== undefined ||
  drawable.triangles !== undefined;

type RuntimeMeshEvidenceDrawable = {
  readonly drawableId: DrawableId;
  readonly meshId: MeshId;
  readonly bounds: RectDto;
  readonly vertexHash: string;
  readonly mesh?: EvaluatedDrawableMeshEvidenceDto | undefined;
};

const createTopologySummary = (input: {
  readonly vertexCount: number;
  readonly vertexStableIds?: readonly string[];
  readonly uvs?: readonly Vec2Dto[];
  readonly triangles?: readonly NormalizedMeshTriangle[];
}): EvaluatedMeshTopologySummaryDto => {
  const triangleCount = input.triangles?.length ?? 0;
  const stableVertexIdCount = input.vertexStableIds?.length ?? 0;
  const uvCount = input.uvs?.length ?? 0;

  return EvaluatedMeshTopologySummarySchema.parse({
    vertexCount: input.vertexCount,
    stableVertexIdCount,
    uvCount,
    triangleCount,
    triangleIndexCount: triangleCount * 3,
    hasStableVertexIds: stableVertexIdCount > 0,
    hasUvProjection: uvCount > 0,
    hasTriangles: triangleCount > 0
  });
};

const createEvaluatedMeshVertices = (
  meshId: MeshId,
  vertices: readonly Vec2Dto[] | undefined,
  vertexStableIds: readonly string[] | undefined
): readonly EvaluatedMeshVertexDto[] =>
  (vertices ?? []).map((position, vertexIndex) => {
    const vertexStableId = vertexStableIds?.[vertexIndex];
    return EvaluatedMeshVertexSchema.parse({
      vertexIndex,
      ...(vertexStableId === undefined ? {} : { vertexStableId }),
      vertexRef: createMeshVertexRef(meshId, vertexIndex, vertexStableId),
      position: { x: position.x, y: position.y }
    });
  });

const createMovedVertexRefs = (input: {
  readonly before: EvaluatedDrawableMeshEvidenceDto;
  readonly after: EvaluatedDrawableMeshEvidenceDto;
  readonly vertexPositionEpsilon: number;
}): readonly RuntimeMovedMeshVertexRefDto[] => {
  const beforeByStableId = new Map(
    input.before.vertices.flatMap((vertex) =>
      vertex.vertexStableId === undefined ? [] : [[vertex.vertexStableId, vertex] as const]
    )
  );
  const beforeByIndex = new Map(input.before.vertices.map((vertex) => [vertex.vertexIndex, vertex]));

  return input.after.vertices
    .flatMap((afterVertex) => {
      const beforeVertex =
        afterVertex.vertexStableId === undefined ? beforeByIndex.get(afterVertex.vertexIndex) : beforeByStableId.get(afterVertex.vertexStableId);
      if (beforeVertex === undefined || !vertexMoved(beforeVertex.position, afterVertex.position, input.vertexPositionEpsilon)) {
        return [];
      }

      const vertexStableId = afterVertex.vertexStableId ?? beforeVertex.vertexStableId;
      return [
        RuntimeMovedMeshVertexRefSchema.parse({
          drawableId: input.after.drawableId,
          meshId: input.after.meshId,
          vertexIndex: afterVertex.vertexIndex,
          ...(vertexStableId === undefined ? {} : { vertexStableId }),
          vertexRef: createMeshVertexRef(input.after.meshId, afterVertex.vertexIndex, vertexStableId),
          before: beforeVertex.position,
          after: afterVertex.position,
          delta: {
            x: normalizeZero(afterVertex.position.x - beforeVertex.position.x),
            y: normalizeZero(afterVertex.position.y - beforeVertex.position.y)
          }
        })
      ];
    })
    .sort((left, right) => left.vertexIndex - right.vertexIndex || left.vertexRef.localeCompare(right.vertexRef));
};

const vertexMoved = (
  before: Vec2Dto,
  after: Vec2Dto,
  epsilon: number
): boolean => Math.abs(before.x - after.x) > epsilon || Math.abs(before.y - after.y) > epsilon;

const boundsChanged = (
  before: RectDto,
  after: RectDto,
  epsilon: number
): boolean =>
  Math.abs(before.x - after.x) > epsilon ||
  Math.abs(before.y - after.y) > epsilon ||
  Math.abs(before.width - after.width) > epsilon ||
  Math.abs(before.height - after.height) > epsilon;

const normalizeZero = (value: number): number => (Object.is(value, -0) ? 0 : value);
