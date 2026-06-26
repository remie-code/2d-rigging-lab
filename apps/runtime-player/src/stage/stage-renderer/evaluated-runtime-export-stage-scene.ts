import {
  createRenderScene,
  type RenderDrawable,
  type RenderMesh,
  type RenderScene
} from "@private-2d-rigging-lab/render-core";
import type { DrawableId } from "@private-2d-rigging-lab/contracts";
import type {
  RuntimeCoreEvaluationProfile,
  RuntimeSnapshotDto
} from "@private-2d-rigging-lab/runtime-core";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type {
  RuntimePlayerActiveVariantSelectionState
} from "../../preload/runtime-variant-bridge-contract";
import {
  createRuntimeExportRuntimeModelInitialStateRequest,
  evaluateRuntimeExportPose,
  type RuntimeExportPoseEvaluation,
  type RuntimeExportPoseEvaluationOptions
} from "../runtime-evaluation/runtime-export-pose-evaluator";
import type {
  RuntimeExportRuntimeGraphAdapterInput
} from "../runtime-evaluation/runtime-export-runtime-graph-adapter";
import type {
  RuntimeExportStageRenderInput
} from "./runtime-export-stage-scene";
import {
  createRuntimeExportEvaluationScaffold,
  type RuntimeExportEvaluationCache,
  type RuntimeExportEvaluationScaffoldBuildProfile,
  type RuntimeExportEvaluationScaffold
} from "./runtime-export-evaluation-cache";
import type {
  RuntimeExportRuntimeModelInstanceCache
} from "./runtime-export-runtime-model-instance-cache";

export interface EvaluatedRuntimeExportStageRenderInput extends RuntimeExportStageRenderInput {
  readonly poseEvaluation: RuntimeExportPoseEvaluation;
  readonly evaluationProfile: RuntimeExportRenderInputEvaluationProfile;
}

export interface RuntimeExportRenderInputEvaluationProfile {
  readonly evaluationCacheStatus: "hit" | "miss" | "not-used";
  readonly runtimeCoreEvaluationDurationMs: number;
  readonly runtimeCoreProfile?: RuntimeCoreEvaluationProfile;
  readonly compiledEvaluatorFrameCount: number;
  readonly transientCompileCount: number;
  readonly transientInstanceCount: number;
  readonly poseEvaluationDurationMs: number;
  readonly snapshotToRenderDrawableDurationMs: number;
  readonly renderInputSceneBuildDurationMs: number;
  readonly renderInputScaffoldBuildDurationMs: number;
  readonly runtimeModelCompileDurationMs: number;
  readonly renderInputClippingBuildDurationMs: number;
}

export type EvaluatedRuntimeExportStageRenderInputOptions =
  RuntimeExportPoseEvaluationOptions & {
    readonly evaluationCache?: RuntimeExportEvaluationCache;
    readonly runtimeModelInstanceCache?: RuntimeExportRuntimeModelInstanceCache;
  };

export function createEvaluatedRuntimeExportStageRenderInput(
  payload: RuntimeExportLoadedPayload,
  options: EvaluatedRuntimeExportStageRenderInputOptions = {}
): EvaluatedRuntimeExportStageRenderInput {
  const activeVariantSelection = options.activeVariantSelection ?? null;
  const scaffoldAccess = createEvaluationScaffoldAccess({
    payload,
    activeVariantSelection,
    evaluationCache: options.evaluationCache
  });
  const scaffold = scaffoldAccess.scaffold;
  const poseEvaluationInput = createPoseEvaluationInput(payload, {
    ...options,
    activeVariantSelection
  });
  const runtimeModelInstance = options.runtimeModelInstance ??
    options.runtimeModelInstanceCache?.getOrCreate(scaffold, {
      initialStateRequest: createRuntimeExportRuntimeModelInitialStateRequest(
        poseEvaluationInput,
        options
      )
    });
  const poseEvaluationStartedAtMs = readCurrentTimeMs();
  const poseEvaluation = evaluateRuntimeExportPose(
    poseEvaluationInput,
    {
      ...options,
      activeVariantSelection,
      adapter: scaffold.adapter,
      compiledRuntimeModel: scaffold.compiledRuntimeModel,
      ...(runtimeModelInstance === undefined
        ? {}
        : { runtimeModelInstance })
    }
  );
  const poseEvaluationDurationMs = Math.max(
    0,
    readCurrentTimeMs() - poseEvaluationStartedAtMs
  );
  const snapshotToRenderDrawableStartedAtMs = readCurrentTimeMs();
  const drawables = createEvaluatedRenderDrawables({
    snapshot: poseEvaluation.snapshot,
    scaffold
  });
  const snapshotToRenderDrawableDurationMs = Math.max(
    0,
    readCurrentTimeMs() - snapshotToRenderDrawableStartedAtMs
  );
  const sceneBuildStartedAtMs = readCurrentTimeMs();
  const scene = createRenderScene({
    textureSources: [scaffold.textureSource],
    drawables
  });
  const renderInputSceneBuildDurationMs = Math.max(
    0,
    readCurrentTimeMs() - sceneBuildStartedAtMs
  );

  return {
    scene,
    modelBounds: scaffold.modelBounds,
    poseEvaluation,
    evaluationProfile: {
      evaluationCacheStatus: scaffoldAccess.cacheStatus,
      runtimeCoreEvaluationDurationMs:
        poseEvaluation.evaluationProfile.runtimeCoreEvaluationDurationMs,
      compiledEvaluatorFrameCount:
        poseEvaluation.evaluationProfile.compiledEvaluatorFrameCount,
      transientCompileCount:
        poseEvaluation.evaluationProfile.transientCompileCount,
      transientInstanceCount:
        poseEvaluation.evaluationProfile.transientInstanceCount,
      ...(poseEvaluation.evaluationProfile.runtimeCoreProfile === undefined
        ? {}
        : {
            runtimeCoreProfile:
              poseEvaluation.evaluationProfile.runtimeCoreProfile
          }),
      poseEvaluationDurationMs,
      snapshotToRenderDrawableDurationMs,
      renderInputSceneBuildDurationMs,
      renderInputScaffoldBuildDurationMs:
        scaffoldAccess.scaffoldBuildProfile.totalDurationMs,
      runtimeModelCompileDurationMs:
        scaffoldAccess.scaffoldBuildProfile.runtimeModelCompileDurationMs,
      renderInputClippingBuildDurationMs:
        scaffoldAccess.scaffoldBuildProfile.clippingBuildDurationMs
    }
  };
}

function createEvaluationScaffoldAccess(input: {
  readonly payload: RuntimeExportLoadedPayload;
  readonly activeVariantSelection:
    RuntimePlayerActiveVariantSelectionState | null;
  readonly evaluationCache?: RuntimeExportEvaluationCache;
}): {
  readonly scaffold: RuntimeExportEvaluationScaffold;
  readonly cacheStatus: RuntimeExportRenderInputEvaluationProfile["evaluationCacheStatus"];
  readonly scaffoldBuildProfile: RuntimeExportEvaluationScaffoldBuildProfile;
} {
  if (input.evaluationCache !== undefined) {
    return input.evaluationCache.getOrCreateWithDiagnostics({
      payload: input.payload,
      activeVariantSelection: input.activeVariantSelection
    });
  }

  const scaffold = createRuntimeExportEvaluationScaffold({
    payload: input.payload,
    activeVariantSelection: input.activeVariantSelection
  });

  return {
    scaffold,
    cacheStatus: "not-used",
    scaffoldBuildProfile: scaffold.buildProfile
  };
}

function createPoseEvaluationInput(
  payload: RuntimeExportLoadedPayload,
  options: RuntimeExportPoseEvaluationOptions
): RuntimeExportRuntimeGraphAdapterInput {
  return {
    model: payload.artifacts.model,
    atlas: payload.artifacts.atlas,
    texturePages: payload.artifacts.manifest.texturePages,
    activeVariantSelection: options.activeVariantSelection ?? null
  };
}

function createEvaluatedRenderDrawables(input: {
  readonly snapshot: RuntimeSnapshotDto;
  readonly scaffold: RuntimeExportEvaluationScaffold;
}): readonly RenderDrawable[] {
  return input.snapshot.drawables.map((drawable) => {
    const template = input.scaffold.drawableTemplatesByDrawableId.get(
      drawable.drawableId
    );
    if (template === undefined) {
      throw new Error(`Evaluated drawable "${drawable.drawableId}" is missing render template data.`);
    }
    if (drawable.vertices === undefined) {
      throw new Error(`Evaluated drawable "${drawable.drawableId}" is missing full snapshot vertices.`);
    }

    return {
      drawableId: drawable.drawableId,
      textureRef: template.textureRef,
      mesh: {
        coordinateSpace: template.mesh.coordinateSpace,
        uvSpace: template.mesh.uvSpace,
        vertices: drawable.vertices.map((vertex) => ({
          x: vertex.x,
          y: vertex.y
        })),
        uvs: template.mesh.uvs,
        triangles: template.mesh.triangles
      } satisfies RenderMesh,
      opacity: drawable.opacity,
      drawOrder: drawable.evaluatedDrawOrder,
      stableIndex: template.stableIndex,
      visible: drawable.visible,
      blendMode: template.blendMode,
      ...(template.clipping === undefined ? {} : { clipping: template.clipping })
    };
  });
}

function readCurrentTimeMs(): number {
  return typeof performance === "undefined"
    ? Date.now()
    : performance.now();
}
