import {
  DEFAULT_RENDER_BLEND_MODE,
  DEFAULT_RENDER_MESH_COORDINATE_SPACE,
  DEFAULT_RENDER_UV_SPACE,
  createRgba8TextureContentSignature,
  type RenderDrawable,
  type RenderDrawableClipping,
  type RenderMesh,
  type RenderRgba8TextureSource
} from "@private-2d-rigging-lab/render-core";
import type { DrawableId } from "@private-2d-rigging-lab/contracts";
import type { NormalizedMaskRelation } from "@private-2d-rigging-lab/runtime-core";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type {
  RuntimePlayerActiveVariantSelectionState
} from "../../preload/runtime-variant-bridge-contract";
import {
  createRuntimeExportRuntimeGraph,
  type RuntimeExportRuntimeGraphAdapterResult
} from "../runtime-evaluation/runtime-export-runtime-graph-adapter";
import type { StageModelBounds } from "./runtime-export-stage-scene";

export interface RuntimeExportDrawableRenderTemplate {
  readonly drawableId: DrawableId;
  readonly textureRef: RenderDrawable["textureRef"];
  readonly mesh: Pick<RenderMesh, "coordinateSpace" | "uvSpace" | "uvs" | "triangles">;
  readonly stableIndex: number;
  readonly blendMode: RenderDrawable["blendMode"];
  readonly clipping?: RenderDrawableClipping;
}

export interface RuntimeExportEvaluationScaffoldBuildProfile {
  readonly totalDurationMs: number;
  readonly runtimeGraphAdapterBuildDurationMs: number;
  readonly textureSourceBuildDurationMs: number;
  readonly clippingBuildDurationMs: number;
  readonly drawableTemplateBuildDurationMs: number;
  readonly modelBoundsBuildDurationMs: number;
}

export interface RuntimeExportEvaluationScaffold {
  readonly cacheKey: string;
  readonly adapter: RuntimeExportRuntimeGraphAdapterResult;
  readonly textureSource: RenderRgba8TextureSource;
  readonly modelBounds: StageModelBounds;
  readonly drawableTemplatesByDrawableId: ReadonlyMap<
    DrawableId,
    RuntimeExportDrawableRenderTemplate
  >;
  readonly buildProfile: RuntimeExportEvaluationScaffoldBuildProfile;
}

export interface RuntimeExportEvaluationCacheAccess {
  readonly scaffold: RuntimeExportEvaluationScaffold;
  readonly cacheStatus: "hit" | "miss";
  readonly scaffoldBuildProfile: RuntimeExportEvaluationScaffoldBuildProfile;
}

export interface RuntimeExportEvaluationCacheMetricsSnapshot {
  readonly evaluationCacheHitCount: number;
  readonly evaluationCacheMissCount: number;
  readonly evaluationCacheInvalidationCount: number;
}

export class RuntimeExportEvaluationCache {
  readonly #scaffoldsByKey = new Map<string, RuntimeExportEvaluationScaffold>();
  #hitCount = 0;
  #missCount = 0;
  #invalidationCount = 0;

  get size(): number {
    return this.#scaffoldsByKey.size;
  }

  getOrCreate(input: {
    readonly payload: RuntimeExportLoadedPayload;
    readonly activeVariantSelection: RuntimePlayerActiveVariantSelectionState | null;
  }): RuntimeExportEvaluationScaffold {
    return this.getOrCreateWithDiagnostics(input).scaffold;
  }

  getOrCreateWithDiagnostics(input: {
    readonly payload: RuntimeExportLoadedPayload;
    readonly activeVariantSelection: RuntimePlayerActiveVariantSelectionState | null;
  }): RuntimeExportEvaluationCacheAccess {
    const cacheKey = createRuntimeExportEvaluationCacheKey(input);
    const existing = this.#scaffoldsByKey.get(cacheKey);
    if (existing !== undefined) {
      this.#hitCount += 1;
      return {
        scaffold: existing,
        cacheStatus: "hit",
        scaffoldBuildProfile: createZeroScaffoldBuildProfile()
      };
    }

    const scaffold = createRuntimeExportEvaluationScaffold({
      ...input,
      cacheKey
    });
    this.#scaffoldsByKey.set(cacheKey, scaffold);
    this.#missCount += 1;

    return {
      scaffold,
      cacheStatus: "miss",
      scaffoldBuildProfile: scaffold.buildProfile
    };
  }

  clear(): void {
    if (this.#scaffoldsByKey.size > 0) {
      this.#invalidationCount += 1;
    }
    this.#scaffoldsByKey.clear();
  }

  getMetricsSnapshot(): RuntimeExportEvaluationCacheMetricsSnapshot {
    return {
      evaluationCacheHitCount: this.#hitCount,
      evaluationCacheMissCount: this.#missCount,
      evaluationCacheInvalidationCount: this.#invalidationCount
    };
  }
}

export function createRuntimeExportEvaluationCacheKey(input: {
  readonly payload: RuntimeExportLoadedPayload;
  readonly activeVariantSelection: RuntimePlayerActiveVariantSelectionState | null;
}): string {
  const payload = input.payload;
  const sourcePackage = payload.artifacts.model.sourcePackage;
  const textureMetadata = payload.texturePage.metadata;
  const textureDigest = textureMetadata.digest;

  return JSON.stringify({
    packageId: sourcePackage.packageId,
    packageRevision: sourcePackage.packageRevision,
    packageHash: sourcePackage.packageHash ?? null,
    loadedAtIso: payload.loadedAtIso,
    texture: {
      pageId: textureMetadata.pageId,
      path: textureMetadata.path,
      textureId: textureMetadata.textureId ?? null,
      width: textureMetadata.width,
      height: textureMetadata.height,
      pixelFormat: textureMetadata.pixelFormat,
      byteLength: textureMetadata.byteLength,
      digest: {
        algorithm: textureDigest.algorithm,
        hex: textureDigest.hex
      },
      binaryAssetId: textureMetadata.binaryAssetId ?? null,
      decodedByteLength: payload.texturePage.bytes.byteLength
    },
    atlasSourceSignature: payload.artifacts.atlas.sourceSignature.digest,
    activeVariantSelection: createSemanticActiveVariantSelectionKey(
      input.activeVariantSelection
    )
  });
}

export function createRuntimeExportEvaluationScaffold(input: {
  readonly payload: RuntimeExportLoadedPayload;
  readonly activeVariantSelection: RuntimePlayerActiveVariantSelectionState | null;
  readonly cacheKey?: string;
}): RuntimeExportEvaluationScaffold {
  const startedAtMs = readCurrentTimeMs();
  const adapterStartedAtMs = startedAtMs;
  const adapter = createRuntimeExportRuntimeGraph({
    model: input.payload.artifacts.model,
    atlas: input.payload.artifacts.atlas,
    texturePages: input.payload.artifacts.manifest.texturePages,
    activeVariantSelection: input.activeVariantSelection
  });
  const adapterEndedAtMs = readCurrentTimeMs();
  const textureSourceStartedAtMs = adapterEndedAtMs;
  const textureSource = createTextureSource(input.payload);
  const textureSourceEndedAtMs = readCurrentTimeMs();
  const clippingStartedAtMs = textureSourceEndedAtMs;
  const clippingByTargetDrawableId = createClippingByTargetDrawableId(
    adapter.graph.masks
  );
  const clippingEndedAtMs = readCurrentTimeMs();
  const drawableTemplateStartedAtMs = clippingEndedAtMs;
  const stableIndexByDrawableId = new Map(
    [...adapter.graph.drawables.keys()].map((drawableId, index) => [
      drawableId,
      index
    ])
  );
  const drawableTemplatesByDrawableId = new Map(
    [...adapter.renderResources.drawableRenderResources.entries()].map(
      ([drawableId, renderResource]) => {
        const clipping = clippingByTargetDrawableId.get(drawableId);
        return [
          drawableId,
          {
            drawableId,
            textureRef: { textureId: textureSource.textureId },
            mesh: {
              coordinateSpace: DEFAULT_RENDER_MESH_COORDINATE_SPACE,
              uvSpace: DEFAULT_RENDER_UV_SPACE,
              uvs: renderResource.atlasUvs.map((uv) => ({
                x: uv.x,
                y: uv.y
              })),
              triangles: renderResource.triangles.map((triangle) => [
                triangle[0],
                triangle[1],
                triangle[2]
              ])
            },
            stableIndex: stableIndexByDrawableId.get(drawableId) ?? 0,
            blendMode: DEFAULT_RENDER_BLEND_MODE,
            ...(clipping === undefined ? {} : { clipping })
          }
        ];
      }
    )
  );
  const drawableTemplateEndedAtMs = readCurrentTimeMs();
  const modelBoundsStartedAtMs = drawableTemplateEndedAtMs;
  const modelBounds = createStageModelBounds(input.payload);
  const modelBoundsEndedAtMs = readCurrentTimeMs();

  return {
    cacheKey: input.cacheKey ??
      createRuntimeExportEvaluationCacheKey(input),
    adapter,
    textureSource,
    modelBounds,
    drawableTemplatesByDrawableId,
    buildProfile: {
      totalDurationMs: readDurationMs(startedAtMs, modelBoundsEndedAtMs),
      runtimeGraphAdapterBuildDurationMs: readDurationMs(
        adapterStartedAtMs,
        adapterEndedAtMs
      ),
      textureSourceBuildDurationMs: readDurationMs(
        textureSourceStartedAtMs,
        textureSourceEndedAtMs
      ),
      clippingBuildDurationMs: readDurationMs(
        clippingStartedAtMs,
        clippingEndedAtMs
      ),
      drawableTemplateBuildDurationMs: readDurationMs(
        drawableTemplateStartedAtMs,
        drawableTemplateEndedAtMs
      ),
      modelBoundsBuildDurationMs: readDurationMs(
        modelBoundsStartedAtMs,
        modelBoundsEndedAtMs
      )
    }
  };
}

function createSemanticActiveVariantSelectionKey(
  selection: RuntimePlayerActiveVariantSelectionState | null
): unknown {
  if (selection?.state !== "ready") {
    return {
      state: selection?.state ?? "none"
    };
  }

  return {
    state: "ready",
    activeSelections: selection.activeSelections
      .map((entry) => ({
        variantGroupId: entry.variantGroupId,
        activeSelection: entry.activeSelection.kind === "singleSelect"
          ? {
              kind: entry.activeSelection.kind,
              variantId: entry.activeSelection.variantId
            }
          : {
              kind: entry.activeSelection.kind,
              variantIds: [...entry.activeSelection.variantIds].sort(
                compareStrings
              )
            }
      }))
      .sort((left, right) =>
        left.variantGroupId.localeCompare(right.variantGroupId)
      )
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
  masks: readonly NormalizedMaskRelation[]
): ReadonlyMap<DrawableId, RenderDrawableClipping> {
  const maskIdsByTargetDrawableId = new Map<DrawableId, DrawableId[]>();

  for (const mask of masks) {
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

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function createZeroScaffoldBuildProfile():
  RuntimeExportEvaluationScaffoldBuildProfile {
  return {
    totalDurationMs: 0,
    runtimeGraphAdapterBuildDurationMs: 0,
    textureSourceBuildDurationMs: 0,
    clippingBuildDurationMs: 0,
    drawableTemplateBuildDurationMs: 0,
    modelBoundsBuildDurationMs: 0
  };
}

function readDurationMs(startedAtMs: number, endedAtMs: number): number {
  return Math.max(0, endedAtMs - startedAtMs);
}

function readCurrentTimeMs(): number {
  return typeof performance === "undefined"
    ? Date.now()
    : performance.now();
}
