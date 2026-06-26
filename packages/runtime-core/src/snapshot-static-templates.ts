import type {
  DiagnosticDto,
  DrawableId,
  MeshId,
  PartId,
  RectDto,
  SourceAssetId,
  TextureId,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";

import { createStableVertexHash as createStableGeometryVertexHash } from "./drawable-geometry.js";
import {
  createEvaluatedMaskRelations,
  type EvaluatedMaskRelationDto
} from "./mask-relation-evidence.js";
import type { NormalizedDrawable, NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import type { RuntimeEvaluationOptionsDto } from "./runtime-options.js";
import type { EvaluatedDrawableDto } from "./snapshot.js";
import {
  createEvaluatedDrawableTexture,
  type DrawableTextureStatusDto,
  type NormalizedDrawableTextureReference
} from "./texture-projection.js";

export interface RuntimeSnapshotStaticTemplates {
  readonly drawables: readonly RuntimeDrawableSnapshotTemplate[];
  readonly referenceVerticesByDrawableId: ReadonlyMap<DrawableId, readonly Vec2Dto[]>;
  readonly masks: readonly RuntimeMaskRelationTemplate[];
}

export interface RuntimeDrawableSnapshotTemplate {
  readonly drawableId: DrawableId;
  readonly meshId: MeshId;
  readonly partId?: PartId;
  readonly texture?: RuntimeDrawableTextureTemplate;
  readonly visible: boolean;
  readonly opacity: number;
  readonly baseDrawOrder: number;
  readonly evaluatedDrawOrder: number;
  readonly bounds: Readonly<RectDto>;
  readonly vertexCount: number;
  readonly authoredVertexHash?: string;
  readonly vertices?: readonly Vec2Dto[];
}

export interface RuntimeDrawableTextureTemplate {
  readonly status: DrawableTextureStatusDto;
  readonly textureId?: TextureId;
  readonly sourceAssetId?: SourceAssetId;
  readonly sourceLayerId?: string;
  readonly projection: RuntimeDrawableTextureProjectionTemplate;
  readonly diagnostics: readonly DiagnosticDto[];
}

export type RuntimeDrawableTextureProjectionTemplate =
  | {
      readonly kind: "bounds_fit";
    }
  | {
      readonly kind: "uv";
      readonly uvCount: number;
      readonly uvs?: readonly Vec2Dto[];
    };

export interface RuntimeMaskRelationTemplate {
  readonly maskRelationId: EvaluatedMaskRelationDto["maskRelationId"];
  readonly sourceDrawableIds: readonly DrawableId[];
  readonly targetDrawableIds: readonly DrawableId[];
  readonly enabled: true;
  readonly clippingIntent: "semanticClipping";
  readonly resolved: boolean;
}

export const compileRuntimeSnapshotStaticTemplates = (
  graph: NormalizedRuntimeGraph
): RuntimeSnapshotStaticTemplates => Object.freeze({
  drawables: compileRuntimeDrawableSnapshotTemplates(graph),
  referenceVerticesByDrawableId: compileRuntimeReferenceVerticesByDrawableId(graph),
  masks: compileRuntimeMaskRelationTemplates(graph)
});

export const compileRuntimeDrawableSnapshotTemplates = (
  graph: NormalizedRuntimeGraph
): readonly RuntimeDrawableSnapshotTemplate[] => {
  const explicitOrder = new Map(graph.drawOrder.map((entry) => [entry.drawableId, entry.drawOrder]));

  return freezeArray(
    [...graph.drawables.values()]
      .map((drawable) => compileRuntimeDrawableSnapshotTemplate({
        drawable,
        evaluatedDrawOrder: explicitOrder.get(drawable.drawableId) ?? drawable.baseDrawOrder
      }))
      .sort(compareDrawableTemplates)
  );
};

export const compileRuntimeReferenceVerticesByDrawableId = (
  graph: NormalizedRuntimeGraph
): ReadonlyMap<DrawableId, readonly Vec2Dto[]> =>
  new Map(
    [...graph.drawables.values()]
      .filter((drawable): drawable is NormalizedDrawable & { readonly vertices: readonly Vec2Dto[] } => drawable.vertices !== undefined)
      .map((drawable) => [
        drawable.drawableId,
        cloneReadonlyVec2Array(drawable.vertices)
      ] as const)
  );

export const compileRuntimeMaskRelationTemplates = (
  graph: NormalizedRuntimeGraph
): readonly RuntimeMaskRelationTemplate[] =>
  freezeArray(createEvaluatedMaskRelations(graph).map(freezeMaskRelationTemplate));

export const materializeRuntimeDrawableSnapshots = (input: {
  readonly templates: readonly RuntimeDrawableSnapshotTemplate[];
  readonly options: RuntimeEvaluationOptionsDto;
  readonly includeVertices: boolean;
}): EvaluatedDrawableDto[] =>
  input.templates.map((template) => ({
    drawableId: template.drawableId,
    meshId: template.meshId,
    ...(template.partId === undefined ? {} : { partId: template.partId }),
    ...(template.texture === undefined
      ? {}
      : {
          texture: materializeDrawableTextureTemplate({
            template: template.texture,
            includeUvCoordinates: input.options.snapshotDetail === "full"
          })
        }),
    visible: template.visible,
    opacity: template.opacity,
    baseDrawOrder: template.baseDrawOrder,
    evaluatedDrawOrder: template.evaluatedDrawOrder,
    bounds: cloneRect(template.bounds),
    vertexCount: template.vertexCount,
    vertexHash: createDrawableVertexHash(
      template,
      input.options.epsilonPolicy.hashPrecisionDecimals
    ),
    ...((input.options.snapshotDetail === "full" || input.includeVertices) && template.vertices !== undefined
      ? { vertices: cloneVec2Array(template.vertices) }
      : {}),
    diagnostics: []
  }));

export const materializeRuntimeMaskRelations = (
  templates: readonly RuntimeMaskRelationTemplate[]
): EvaluatedMaskRelationDto[] =>
  templates.map((template) => ({
    maskRelationId: template.maskRelationId,
    sourceDrawableIds: [...template.sourceDrawableIds],
    targetDrawableIds: [...template.targetDrawableIds],
    enabled: template.enabled,
    clippingIntent: template.clippingIntent,
    resolved: template.resolved
  }));

const compileRuntimeDrawableSnapshotTemplate = (input: {
  readonly drawable: NormalizedDrawable;
  readonly evaluatedDrawOrder: number;
}): RuntimeDrawableSnapshotTemplate => {
  const texture = input.drawable.texture;
  const textureTemplate = texture === undefined
    ? undefined
    : compileRuntimeDrawableTextureTemplate({
        texture,
        vertexCount: input.drawable.vertexCount
      });

  return Object.freeze({
    drawableId: input.drawable.drawableId,
    meshId: input.drawable.meshId,
    ...(input.drawable.partId === undefined ? {} : { partId: input.drawable.partId }),
    ...(textureTemplate === undefined ? {} : { texture: textureTemplate }),
    visible: input.drawable.visible,
    opacity: clamp(input.drawable.opacity, 0, 1),
    baseDrawOrder: input.drawable.baseDrawOrder,
    evaluatedDrawOrder: input.evaluatedDrawOrder,
    bounds: cloneReadonlyRect(input.drawable.bounds),
    vertexCount: input.drawable.vertexCount,
    ...(input.drawable.vertexHash === undefined ? {} : { authoredVertexHash: input.drawable.vertexHash }),
    ...(input.drawable.vertices === undefined ? {} : { vertices: cloneReadonlyVec2Array(input.drawable.vertices) })
  });
};

const compileRuntimeDrawableTextureTemplate = (input: {
  readonly texture: NormalizedDrawableTextureReference;
  readonly vertexCount: number;
}): RuntimeDrawableTextureTemplate => {
  const texture = createEvaluatedDrawableTexture({
    texture: input.texture,
    vertexCount: input.vertexCount,
    includeUvCoordinates: true
  });

  return Object.freeze({
    status: texture.status,
    ...(texture.textureId === undefined ? {} : { textureId: texture.textureId }),
    ...(texture.sourceAssetId === undefined ? {} : { sourceAssetId: texture.sourceAssetId }),
    ...(texture.sourceLayerId === undefined ? {} : { sourceLayerId: texture.sourceLayerId }),
    projection:
      texture.projection.kind === "uv"
        ? Object.freeze({
            kind: "uv" as const,
            uvCount: texture.projection.uvCount,
            ...(texture.projection.uvs === undefined ? {} : { uvs: cloneReadonlyVec2Array(texture.projection.uvs) })
          })
        : Object.freeze({ kind: "bounds_fit" as const }),
    diagnostics: freezeArray(texture.diagnostics)
  });
};

const materializeDrawableTextureTemplate = (input: {
  readonly template: RuntimeDrawableTextureTemplate;
  readonly includeUvCoordinates: boolean;
}) => ({
  status: input.template.status,
  ...(input.template.textureId === undefined ? {} : { textureId: input.template.textureId }),
  ...(input.template.sourceAssetId === undefined ? {} : { sourceAssetId: input.template.sourceAssetId }),
  ...(input.template.sourceLayerId === undefined ? {} : { sourceLayerId: input.template.sourceLayerId }),
  projection: materializeDrawableTextureProjectionTemplate({
    template: input.template.projection,
    includeUvCoordinates: input.includeUvCoordinates
  }),
  diagnostics: [...input.template.diagnostics]
});

const materializeDrawableTextureProjectionTemplate = (input: {
  readonly template: RuntimeDrawableTextureProjectionTemplate;
  readonly includeUvCoordinates: boolean;
}) => {
  if (input.template.kind === "bounds_fit") {
    return { kind: "bounds_fit" as const };
  }

  return {
    kind: "uv" as const,
    uvCount: input.template.uvCount,
    ...(input.includeUvCoordinates && input.template.uvs !== undefined
      ? { uvs: cloneVec2Array(input.template.uvs) }
      : {})
  };
};

const freezeMaskRelationTemplate = (
  mask: EvaluatedMaskRelationDto
): RuntimeMaskRelationTemplate =>
  Object.freeze({
    maskRelationId: mask.maskRelationId,
    sourceDrawableIds: freezeArray(mask.sourceDrawableIds),
    targetDrawableIds: freezeArray(mask.targetDrawableIds),
    enabled: mask.enabled,
    clippingIntent: mask.clippingIntent,
    resolved: mask.resolved
  });

const createDrawableVertexHash = (
  template: RuntimeDrawableSnapshotTemplate,
  hashPrecisionDecimals: number
): string => {
  if (template.authoredVertexHash !== undefined) {
    return template.authoredVertexHash;
  }

  if (template.vertices === undefined) {
    return `hash_${template.drawableId}_${template.vertexCount}`;
  }

  return createStableGeometryVertexHash(template.vertices, { hashPrecisionDecimals });
};

const compareDrawableTemplates = (
  left: RuntimeDrawableSnapshotTemplate,
  right: RuntimeDrawableSnapshotTemplate
): number =>
  left.evaluatedDrawOrder - right.evaluatedDrawOrder ||
  left.drawableId.localeCompare(right.drawableId);

const cloneReadonlyRect = (value: RectDto): Readonly<RectDto> =>
  Object.freeze({
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height
  });

const cloneRect = (value: Readonly<RectDto>): RectDto => ({
  x: value.x,
  y: value.y,
  width: value.width,
  height: value.height
});

const cloneReadonlyVec2Array = (values: readonly Vec2Dto[]): readonly Vec2Dto[] =>
  freezeArray(values.map((value) =>
    Object.freeze({
      x: value.x,
      y: value.y
    })
  ));

const cloneVec2Array = (values: readonly Vec2Dto[]): Vec2Dto[] =>
  values.map((value) => ({
    x: value.x,
    y: value.y
  }));

const freezeArray = <TValue>(values: readonly TValue[]): readonly TValue[] =>
  Object.freeze([...values]);

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
