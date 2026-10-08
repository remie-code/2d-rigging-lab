import {
  DEFAULT_RENDER_BLEND_MODE,
  DEFAULT_RENDER_MESH_COORDINATE_SPACE,
  DEFAULT_RENDER_UV_SPACE,
  createRenderScene,
  createRgba8TextureContentSignature,
  type RenderDrawable,
  type RenderDrawableClipping,
  type RenderMesh,
  type RenderRgba8TextureSource,
  type RenderScene
} from "@private-2d-rigging-lab/render-core";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type {
  RuntimePlayerActiveVariantSelectionState
} from "../../preload/runtime-variant-bridge-contract";
import {
  resolveRuntimeVariantDrawableVisible
} from "../../shared/runtime-export-variant-selection";

export interface StageModelBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface RuntimeExportStageRenderInput {
  readonly scene: RenderScene;
  readonly modelBounds: StageModelBounds;
}

export interface RuntimeExportStageRenderOptions {
  readonly activeVariantSelection?: RuntimePlayerActiveVariantSelectionState | null;
}

export function createRuntimeExportStageRenderInput(
  payload: RuntimeExportLoadedPayload,
  options: RuntimeExportStageRenderOptions = {}
): RuntimeExportStageRenderInput {
  const textureSource = createTextureSource(payload);
  const meshesById = new Map(
    payload.artifacts.model.meshes.map((mesh) => [mesh.meshId, mesh])
  );
  const drawOrderByDrawableId = new Map(
    payload.artifacts.model.drawOrder.map((entry) => [
      entry.drawableId,
      entry.drawOrder
    ])
  );
  const clippingByTargetDrawableId = createClippingByTargetDrawableId(payload);

  const drawables: RenderDrawable[] = payload.artifacts.model.drawables.map(
    (drawable, stableIndex) => {
      const mesh = meshesById.get(drawable.meshId);
      if (mesh === undefined) {
        throw new Error(`Stage drawable "${drawable.drawableId}" is missing mesh "${drawable.meshId}".`);
      }
      const clipping = clippingByTargetDrawableId.get(drawable.drawableId);

      return {
        drawableId: drawable.drawableId,
        textureRef: { textureId: textureSource.textureId },
        mesh: {
          coordinateSpace: DEFAULT_RENDER_MESH_COORDINATE_SPACE,
          uvSpace: DEFAULT_RENDER_UV_SPACE,
          vertices: mesh.vertices.map((vertex) => ({
            x: vertex.x,
            y: vertex.y
          })),
          uvs: mesh.atlasUvs.map((uv) => ({
            x: uv.x,
            y: uv.y
          })),
          triangles: mesh.triangles.map((triangle) => [
            triangle[0],
            triangle[1],
            triangle[2]
          ])
        } satisfies RenderMesh,
        opacity: drawable.opacity,
        drawOrder: drawOrderByDrawableId.get(drawable.drawableId) ??
          drawable.baseDrawOrder,
        stableIndex,
        visible: resolveRuntimeVariantDrawableVisible({
          model: payload.artifacts.model,
          drawable,
          activeVariantSelection: options.activeVariantSelection ?? null
        }),
        blendMode: DEFAULT_RENDER_BLEND_MODE,
        ...(clipping === undefined
          ? {}
          : { clipping })
      };
    }
  );

  return {
    scene: createRenderScene({
      textureSources: [textureSource],
      drawables
    }),
    modelBounds: createStageModelBounds(payload)
  };
}

function createTextureSource(
  payload: RuntimeExportLoadedPayload
): RenderRgba8TextureSource {
  const metadata = payload.texturePage.metadata;
  const textureId = metadata.textureId ??
    payload.artifacts.atlas.pages[0]?.textureId ??
    metadata.pageId;

  return {
    kind: "rgba8",
    textureId,
    width: metadata.width,
    height: metadata.height,
    bytes: payload.texturePage.bytes,
    alphaMode: toRenderAlphaMode(
      payload.artifacts.model.renderAssumptions.alphaMode
    ),
    contentSignature: createRgba8TextureContentSignature({
      textureId,
      width: metadata.width,
      height: metadata.height,
      bytes: payload.texturePage.bytes
    }),
    source: {
      binaryAssetPath: metadata.path,
      ...(metadata.binaryAssetId === undefined
        ? {}
        : { binaryAssetId: metadata.binaryAssetId })
    }
  };
}

function toRenderAlphaMode(
  alphaMode: RuntimeExportLoadedPayload["artifacts"]["model"]["renderAssumptions"]["alphaMode"]
): RenderRgba8TextureSource["alphaMode"] {
  return alphaMode === "premultiplied-alpha-v1" ? "premultiplied" : "straight";
}

function createClippingByTargetDrawableId(
  payload: RuntimeExportLoadedPayload
): ReadonlyMap<string, RenderDrawableClipping> {
  const maskIdsByTargetDrawableId = new Map<string, string[]>();

  for (const mask of payload.artifacts.model.masks) {
    for (const targetDrawableId of mask.targetDrawableIds) {
      const maskIds = maskIdsByTargetDrawableId.get(targetDrawableId) ?? [];
      maskIds.push(...mask.sourceDrawableIds);
      maskIdsByTargetDrawableId.set(targetDrawableId, maskIds);
    }
  }

  return new Map(
    [...maskIdsByTargetDrawableId.entries()].map(([drawableId, maskDrawableIds]) => [
      drawableId,
      {
        mode: "drawable-alpha-mask-v0",
        maskDrawableIds: [...new Set(maskDrawableIds)]
      }
    ])
  );
}

function createStageModelBounds(
  payload: RuntimeExportLoadedPayload
): StageModelBounds {
  const modelBounds = payload.artifacts.model.modelBounds;
  if (modelBounds.width > 0 && modelBounds.height > 0) {
    return modelBounds;
  }

  const manifestBounds = payload.artifacts.manifest.modelBounds;
  if (manifestBounds.width > 0 && manifestBounds.height > 0) {
    return manifestBounds;
  }

  return payload.artifacts.model.canvas.bounds;
}
