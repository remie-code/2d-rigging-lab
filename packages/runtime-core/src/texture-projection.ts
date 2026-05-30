import {
  DiagnosticSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  Vec2DtoSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  SourceAssetId,
  TextureId,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

export const DrawableTextureStatusSchema = z.enum(["resolved", "missing", "not_materialized"]);
export type DrawableTextureStatusDto = z.infer<typeof DrawableTextureStatusSchema>;

export const EvaluatedDrawableTextureProjectionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("bounds_fit")
  }),
  z.object({
    kind: z.literal("uv"),
    uvCount: z.number().int().nonnegative(),
    uvs: z.array(Vec2DtoSchema).optional()
  })
]);
export type EvaluatedDrawableTextureProjectionDto = z.infer<typeof EvaluatedDrawableTextureProjectionSchema>;

export const EvaluatedDrawableTextureSchema = z.object({
  status: DrawableTextureStatusSchema,
  textureId: TextureIdSchema.optional(),
  sourceAssetId: SourceAssetIdSchema.optional(),
  sourceLayerId: z.string().optional(),
  projection: EvaluatedDrawableTextureProjectionSchema,
  diagnostics: z.array(DiagnosticSchema).default([])
});
export type EvaluatedDrawableTextureDto = z.infer<typeof EvaluatedDrawableTextureSchema>;

export type NormalizedDrawableTextureProjection =
  | {
      readonly kind: "bounds_fit";
    }
  | {
      readonly kind: "uv";
      readonly uvs: readonly Vec2Dto[];
    };

export interface NormalizedDrawableTextureReference {
  readonly status?: DrawableTextureStatusDto;
  readonly textureId?: TextureId;
  readonly sourceAssetId?: SourceAssetId;
  readonly sourceLayerId?: string;
  readonly projection?: NormalizedDrawableTextureProjection;
}

export const createEvaluatedDrawableTexture = (input: {
  readonly texture: NormalizedDrawableTextureReference;
  readonly vertexCount: number;
  readonly includeUvCoordinates: boolean;
}): EvaluatedDrawableTextureDto =>
  EvaluatedDrawableTextureSchema.parse({
    status: resolveTextureStatus(input.texture),
    ...(input.texture.textureId === undefined ? {} : { textureId: input.texture.textureId }),
    ...(input.texture.sourceAssetId === undefined ? {} : { sourceAssetId: input.texture.sourceAssetId }),
    ...(input.texture.sourceLayerId === undefined ? {} : { sourceLayerId: input.texture.sourceLayerId }),
    projection: createProjectionHint(input),
    diagnostics: []
  });

export const omitTextureProjectionCoordinates = (
  texture: EvaluatedDrawableTextureDto
): EvaluatedDrawableTextureDto => {
  if (texture.projection.kind !== "uv" || texture.projection.uvs === undefined) {
    return texture;
  }

  return EvaluatedDrawableTextureSchema.parse({
    ...texture,
    projection: {
      kind: "uv",
      uvCount: texture.projection.uvCount
    }
  });
};

export const reconcileTextureProjectionWithVertexCount = (input: {
  readonly texture: EvaluatedDrawableTextureDto;
  readonly vertexCount: number;
}): EvaluatedDrawableTextureDto => {
  if (input.texture.projection.kind !== "uv" || input.texture.projection.uvCount === input.vertexCount) {
    return input.texture;
  }

  return EvaluatedDrawableTextureSchema.parse({
    ...input.texture,
    projection: {
      kind: "bounds_fit"
    }
  });
};

const resolveTextureStatus = (texture: NormalizedDrawableTextureReference): DrawableTextureStatusDto => {
  if (texture.status === "missing") {
    return "missing";
  }

  if (texture.status === "resolved" && texture.textureId !== undefined) {
    return "resolved";
  }

  if (texture.textureId === undefined) {
    return "missing";
  }

  return "not_materialized";
};

const createProjectionHint = (input: {
  readonly texture: NormalizedDrawableTextureReference;
  readonly vertexCount: number;
  readonly includeUvCoordinates: boolean;
}): EvaluatedDrawableTextureProjectionDto => {
  if (input.texture.projection?.kind === "uv" && input.texture.projection.uvs.length === input.vertexCount) {
    return EvaluatedDrawableTextureProjectionSchema.parse({
      kind: "uv",
      uvCount: input.texture.projection.uvs.length,
      ...(input.includeUvCoordinates ? { uvs: cloneVec2Array(input.texture.projection.uvs) } : {})
    });
  }

  return EvaluatedDrawableTextureProjectionSchema.parse({ kind: "bounds_fit" });
};

const cloneVec2Array = (values: readonly Vec2Dto[]): Vec2Dto[] =>
  values.map((value) => ({
    x: value.x,
    y: value.y
  }));
