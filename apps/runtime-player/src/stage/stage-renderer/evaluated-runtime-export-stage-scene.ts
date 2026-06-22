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
import type { DrawableId } from "@private-2d-rigging-lab/contracts";
import type { RuntimeSnapshotDto } from "@private-2d-rigging-lab/runtime-core";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import {
  evaluateRuntimeExportPose,
  type RuntimeExportPoseEvaluation,
  type RuntimeExportPoseEvaluationOptions
} from "../runtime-evaluation/runtime-export-pose-evaluator";
import type {
  RuntimeExportDrawableRenderResource,
  RuntimeExportRuntimeGraphAdapterInput
} from "../runtime-evaluation/runtime-export-runtime-graph-adapter";
import type {
  RuntimeExportStageRenderInput,
  StageModelBounds
} from "./runtime-export-stage-scene";

export interface EvaluatedRuntimeExportStageRenderInput extends RuntimeExportStageRenderInput {
  readonly poseEvaluation: RuntimeExportPoseEvaluation;
}

export function createEvaluatedRuntimeExportStageRenderInput(
  payload: RuntimeExportLoadedPayload,
  options: RuntimeExportPoseEvaluationOptions = {}
): EvaluatedRuntimeExportStageRenderInput {
  const poseEvaluation = evaluateRuntimeExportPose(
    createPoseEvaluationInput(payload),
    options
  );
  const textureSource = createTextureSource(payload);
  const drawables = createEvaluatedRenderDrawables({
    snapshot: poseEvaluation.snapshot,
    textureSource,
    drawableRenderResources: poseEvaluation.adapter.renderResources.drawableRenderResources
  });

  return {
    scene: createRenderScene({
      textureSources: [textureSource],
      drawables
    }),
    modelBounds: createStageModelBounds(payload),
    poseEvaluation
  };
}

function createPoseEvaluationInput(
  payload: RuntimeExportLoadedPayload
): RuntimeExportRuntimeGraphAdapterInput {
  return {
    model: payload.artifacts.model,
    atlas: payload.artifacts.atlas,
    texturePages: payload.artifacts.manifest.texturePages
  };
}

function createEvaluatedRenderDrawables(input: {
  readonly snapshot: RuntimeSnapshotDto;
  readonly textureSource: RenderRgba8TextureSource;
  readonly drawableRenderResources: ReadonlyMap<DrawableId, RuntimeExportDrawableRenderResource>;
}): readonly RenderDrawable[] {
  const clippingByTargetDrawableId = createClippingByTargetDrawableId(input.snapshot);
  const stableIndexByDrawableId = new Map(
    input.snapshot.drawables.map((drawable, index) => [drawable.drawableId, index])
  );

  return input.snapshot.drawables.map((drawable) => {
    const renderResource = input.drawableRenderResources.get(drawable.drawableId);
    if (renderResource === undefined) {
      throw new Error(`Evaluated drawable "${drawable.drawableId}" is missing render resource data.`);
    }
    if (drawable.vertices === undefined) {
      throw new Error(`Evaluated drawable "${drawable.drawableId}" is missing full snapshot vertices.`);
    }

    const clipping = clippingByTargetDrawableId.get(drawable.drawableId);
    return {
      drawableId: drawable.drawableId,
      textureRef: { textureId: input.textureSource.textureId },
      mesh: {
        coordinateSpace: DEFAULT_RENDER_MESH_COORDINATE_SPACE,
        uvSpace: DEFAULT_RENDER_UV_SPACE,
        vertices: drawable.vertices.map((vertex) => ({
          x: vertex.x,
          y: vertex.y
        })),
        uvs: renderResource.atlasUvs.map((uv) => ({
          x: uv.x,
          y: uv.y
        })),
        triangles: renderResource.triangles.map((triangle) => [
          triangle[0],
          triangle[1],
          triangle[2]
        ])
      } satisfies RenderMesh,
      opacity: drawable.opacity,
      drawOrder: drawable.evaluatedDrawOrder,
      stableIndex: stableIndexByDrawableId.get(drawable.drawableId) ?? 0,
      visible: drawable.visible,
      blendMode: DEFAULT_RENDER_BLEND_MODE,
      ...(clipping === undefined ? {} : { clipping })
    };
  });
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
  snapshot: RuntimeSnapshotDto
): ReadonlyMap<string, RenderDrawableClipping> {
  const maskIdsByTargetDrawableId = new Map<string, string[]>();

  for (const mask of snapshot.masks) {
    if (!mask.resolved) {
      continue;
    }

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
