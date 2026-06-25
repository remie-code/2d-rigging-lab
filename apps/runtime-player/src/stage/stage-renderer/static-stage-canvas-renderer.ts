import {
  createRenderScene,
  type RenderScene
} from "@private-2d-rigging-lab/render-core";
import {
  createWebGl2RendererFromCanvas,
  type WebGl2Renderer
} from "@private-2d-rigging-lab/render-webgl2";
import type { RuntimeStateDto } from "@private-2d-rigging-lab/contracts";

import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import type {
  RuntimePlayerStageRenderMetricsSnapshot
} from "../../preload/performance-diagnostics-contract";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type {
  RuntimePlayerActiveVariantSelectionState
} from "../../preload/runtime-variant-bridge-contract";
import {
  cloneActiveVariantSelectionState
} from "../../shared/runtime-export-variant-selection";
import {
  type RuntimeExportStageRenderInput
} from "./runtime-export-stage-scene";
import {
  createEvaluatedRuntimeExportStageRenderInput,
  type RuntimeExportRenderInputEvaluationProfile
} from "./evaluated-runtime-export-stage-scene";
import { RuntimeExportEvaluationCache } from "./runtime-export-evaluation-cache";
import { createStageRuntimeDiagnosticDetails } from "./stage-render-diagnostics";
import { createStageViewport } from "./stage-viewport";
import {
  applyStagePanDelta,
  applyStageWheelZoom,
  centerStageViewTransform,
  createResetStageViewTransform,
  normalizeStageViewTransform,
  type StageViewTransform,
  type StageViewportPoint
} from "./stage-view-transform";
import { canApplyLiveParameterFrame } from "./stage-live-parameter-frame-match";

export interface StaticStageCanvasRenderer {
  setPayload(
    payload: RuntimeExportLoadedPayload,
    options?: StaticStagePayloadSetOptions
  ): StaticStageRenderResult;
  setActiveVariantSelection(
    activeVariantSelection: RuntimePlayerActiveVariantSelectionState | null
  ): void;
  setLiveParameterFrame(frame: RuntimePlayerLiveParameterFrame): void;
  clearLiveParameterFrame(): void;
  getViewTransform(): StageViewTransform;
  setViewTransform(
    transform: StageViewTransform,
    options?: StaticStageViewTransformSetOptions
  ): void;
  setDisplayViewTransform(transform: StageViewTransform | null): void;
  setViewInteractionEnabled(enabled: boolean): void;
  resetView(): void;
  centerModel(): void;
  getRenderMetricsSnapshot(): StaticStageRenderMetricsSnapshot;
  clear(): void;
  dispose(): void;
}

export interface StaticStageCanvasRendererOptions {
  readonly onViewTransformChanged?: (transform: StageViewTransform) => void;
  readonly onRenderMetricsChanged?: (
    snapshot: StaticStageRenderMetricsSnapshot
  ) => void;
}

export interface StaticStagePayloadSetOptions {
  readonly activeVariantSelection?: RuntimePlayerActiveVariantSelectionState | null;
}

export interface StaticStageViewTransformSetOptions {
  readonly notify?: boolean;
}

export interface StaticStageRenderResult {
  readonly runtimeDiagnosticDetails: readonly string[];
}

export type StaticStageRenderMetricsSnapshot =
  RuntimePlayerStageRenderMetricsSnapshot;

const emptyScene: RenderScene = createRenderScene({
  textureSources: [],
  drawables: []
});

export function createStaticStageCanvasRenderer(
  canvas: HTMLCanvasElement,
  options: StaticStageCanvasRendererOptions = {}
): StaticStageCanvasRenderer {
  const renderer = createWebGl2RendererFromCanvas(canvas);
  if (renderer === undefined) {
    throw new Error("Stage WebGL2 context is unavailable.");
  }

  return new StaticStageCanvasRendererController(canvas, renderer, options);
}

class StaticStageCanvasRendererController implements StaticStageCanvasRenderer {
  private payload: RuntimeExportLoadedPayload | null = null;
  private readonly evaluationCache = new RuntimeExportEvaluationCache();
  private renderInput: RuntimeExportStageRenderInput | null = null;
  private liveRuntimeState: RuntimeStateDto | null = null;
  private activeVariantSelection: RuntimePlayerActiveVariantSelectionState | null =
    null;
  private latestLiveParameterFrame: RuntimePlayerLiveParameterFrame | null = null;
  private hasPendingLiveParameterFrame = false;
  private scheduledAnimationFrameId: number | null = null;
  private lastLiveSourceTimestampMs: number | null = null;
  private lastAnimationFrameTimestampMs: number | null = null;
  private renderCount = 0;
  private scheduledRenderCount = 0;
  private immediateRenderCount = 0;
  private liveFrameMessageCount = 0;
  private stageViewTransformMessageCount = 0;
  private stageDisplayTransformMessageCount = 0;
  private duplicateTransformSkipCount = 0;
  private coalescedLiveFrameCount = 0;
  private lastRafDeltaMs: number | null = null;
  private rafDeltaSampleCount = 0;
  private lastRenderDurationMs: number | null = null;
  private renderDurationSampleCount = 0;
  private lastLiveRenderInputEvaluationDurationMs: number | null = null;
  private liveRenderInputEvaluationDurationSampleCount = 0;
  private lastRuntimeCoreEvaluationDurationMs: number | null = null;
  private runtimeCoreEvaluationDurationSampleCount = 0;
  private lastRuntimeCoreInputValidationDurationMs: number | null = null;
  private runtimeCoreInputValidationDurationSampleCount = 0;
  private lastRuntimeCoreStateCompatibilityDurationMs: number | null = null;
  private runtimeCoreStateCompatibilityDurationSampleCount = 0;
  private lastRuntimeCoreDynamicsEvaluationDurationMs: number | null = null;
  private runtimeCoreDynamicsEvaluationDurationSampleCount = 0;
  private lastRuntimeCoreSnapshotCreationDurationMs: number | null = null;
  private runtimeCoreSnapshotCreationDurationSampleCount = 0;
  private lastRuntimeCoreParameterResolutionDurationMs: number | null = null;
  private runtimeCoreParameterResolutionDurationSampleCount = 0;
  private lastRuntimeCoreKeyformSamplingDurationMs: number | null = null;
  private runtimeCoreKeyformSamplingDurationSampleCount = 0;
  private lastRuntimeCoreKeyformApplicationDurationMs: number | null = null;
  private runtimeCoreKeyformApplicationDurationSampleCount = 0;
  private lastRuntimeCoreDeformerHierarchyEvaluationDurationMs: number | null =
    null;
  private runtimeCoreDeformerHierarchyEvaluationDurationSampleCount = 0;
  private lastRuntimeCoreWarpDeformerVertexTransformDurationMs: number | null =
    null;
  private runtimeCoreWarpDeformerVertexTransformDurationSampleCount = 0;
  private lastRuntimeCoreRotationDeformerVertexTransformDurationMs:
    number | null = null;
  private runtimeCoreRotationDeformerVertexTransformDurationSampleCount = 0;
  private lastRuntimeCoreDrawableSnapshotCreationDurationMs: number | null =
    null;
  private runtimeCoreDrawableSnapshotCreationDurationSampleCount = 0;
  private lastRuntimeCoreVisibilityDrawOrderEvaluationDurationMs: number | null =
    null;
  private runtimeCoreVisibilityDrawOrderEvaluationDurationSampleCount = 0;
  private lastRuntimeCoreMaskEvaluationDurationMs: number | null = null;
  private runtimeCoreMaskEvaluationDurationSampleCount = 0;
  private lastRuntimeCoreSnapshotValidationDurationMs: number | null = null;
  private runtimeCoreSnapshotValidationDurationSampleCount = 0;
  private lastPoseEvaluationDurationMs: number | null = null;
  private poseEvaluationDurationSampleCount = 0;
  private lastSnapshotToRenderDrawableDurationMs: number | null = null;
  private snapshotToRenderDrawableDurationSampleCount = 0;
  private lastRenderInputSceneBuildDurationMs: number | null = null;
  private renderInputSceneBuildDurationSampleCount = 0;
  private lastRenderInputScaffoldBuildDurationMs: number | null = null;
  private renderInputScaffoldBuildDurationSampleCount = 0;
  private lastRenderInputClippingBuildDurationMs: number | null = null;
  private renderInputClippingBuildDurationSampleCount = 0;
  private lastScheduledFrameDurationMs: number | null = null;
  private scheduledFrameDurationSampleCount = 0;
  private viewTransform: StageViewTransform = createResetStageViewTransform();
  private displayViewTransform: StageViewTransform | null = null;
  private activePanPointerId: number | null = null;
  private lastPanPoint: StageViewportPoint | null = null;
  private viewInteractionEnabled = true;
  private readonly resizeObserver: ResizeObserver | undefined;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly renderer: WebGl2Renderer,
    private readonly options: StaticStageCanvasRendererOptions
  ) {
    this.resizeObserver =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => {
            this.requestScheduledRender();
          });
    this.resizeObserver?.observe(canvas);
    window.addEventListener("resize", this.requestScheduledRender);
    canvas.addEventListener("wheel", this.handleWheel, { passive: false });
    canvas.addEventListener("pointerdown", this.handlePointerDown);
    canvas.addEventListener("pointermove", this.handlePointerMove);
    canvas.addEventListener("pointerup", this.handlePointerUp);
    canvas.addEventListener("pointercancel", this.handlePointerUp);
    canvas.addEventListener("lostpointercapture", this.handlePointerUp);
    this.renderCurrentImmediate();
  }

  setPayload(
    payload: RuntimeExportLoadedPayload,
    options: StaticStagePayloadSetOptions = {}
  ): StaticStageRenderResult {
    if ("activeVariantSelection" in options) {
      this.activeVariantSelection = cloneActiveVariantSelectionState(
        options.activeVariantSelection ?? null
      );
    }
    this.evaluationCache.clear();
    const renderInput = createEvaluatedRuntimeExportStageRenderInput(payload, {
      activeVariantSelection: this.activeVariantSelection,
      evaluationCache: this.evaluationCache
    });

    this.payload = payload;
    this.renderInput = renderInput;
    this.liveRuntimeState = renderInput.poseEvaluation.nextState;
    this.latestLiveParameterFrame = null;
    this.lastLiveSourceTimestampMs = null;
    this.hasPendingLiveParameterFrame = false;
    this.cancelScheduledRender();
    this.renderCurrentImmediate();

    return {
      runtimeDiagnosticDetails: createStageRuntimeDiagnosticDetails(
        renderInput.poseEvaluation.snapshot.diagnostics
      )
    };
  }

  setActiveVariantSelection(
    activeVariantSelection: RuntimePlayerActiveVariantSelectionState | null
  ): void {
    this.activeVariantSelection = cloneActiveVariantSelectionState(
      activeVariantSelection
    );

    if (this.payload === null || this.disposed) {
      return;
    }

    if (
      this.latestLiveParameterFrame !== null &&
      canApplyLiveParameterFrame(this.latestLiveParameterFrame, this.payload)
    ) {
      this.hasPendingLiveParameterFrame = false;
      this.cancelScheduledRender();
      this.applyLatestLiveParameterFrameToRenderInput();
      this.renderCurrentImmediate();
      return;
    }

    const renderInput = createEvaluatedRuntimeExportStageRenderInput(
      this.payload,
      {
        activeVariantSelection: this.activeVariantSelection,
        evaluationCache: this.evaluationCache
      }
    );
    this.renderInput = renderInput;
    this.liveRuntimeState = renderInput.poseEvaluation.nextState;
    this.cancelScheduledRender();
    this.renderCurrentImmediate();
  }

  setLiveParameterFrame(frame: RuntimePlayerLiveParameterFrame): void {
    if (
      this.disposed ||
      !canApplyLiveParameterFrame(frame, this.payload)
    ) {
      return;
    }

    this.liveFrameMessageCount += 1;
    if (this.hasPendingLiveParameterFrame) {
      this.coalescedLiveFrameCount += 1;
      this.reportRenderMetricsChanged();
    }

    this.latestLiveParameterFrame = frame;
    this.hasPendingLiveParameterFrame = true;
    this.requestScheduledRender();
  }

  clearLiveParameterFrame(): void {
    this.latestLiveParameterFrame = null;
    this.hasPendingLiveParameterFrame = false;
    this.lastLiveSourceTimestampMs = null;
    this.cancelScheduledRender();

    if (this.payload === null || this.disposed) {
      return;
    }

    const renderInput = createEvaluatedRuntimeExportStageRenderInput(
      this.payload,
      {
        activeVariantSelection: this.activeVariantSelection,
        evaluationCache: this.evaluationCache
      }
    );
    this.renderInput = renderInput;
    this.liveRuntimeState = renderInput.poseEvaluation.nextState;
    this.renderCurrentImmediate();
  }

  getViewTransform(): StageViewTransform {
    return this.viewTransform;
  }

  setViewTransform(
    transform: StageViewTransform,
    options: StaticStageViewTransformSetOptions = {}
  ): void {
    const nextTransform = normalizeStageViewTransform(transform);
    this.stageViewTransformMessageCount += 1;
    if (
      this.displayViewTransform === null &&
      areStageViewTransformsEqual(this.viewTransform, nextTransform)
    ) {
      this.recordDuplicateTransformSkip();
      return;
    }

    this.viewTransform = nextTransform;
    this.displayViewTransform = null;
    this.requestScheduledRender();

    if (options.notify ?? true) {
      this.reportViewTransformChanged();
    }
  }

  setDisplayViewTransform(transform: StageViewTransform | null): void {
    const nextTransform = transform === null
      ? null
      : normalizeStageViewTransform(transform);
    this.stageDisplayTransformMessageCount += 1;

    if (areNullableStageViewTransformsEqual(this.displayViewTransform, nextTransform)) {
      this.recordDuplicateTransformSkip();
      return;
    }

    this.displayViewTransform = nextTransform;
    this.requestScheduledRender();
  }

  setViewInteractionEnabled(enabled: boolean): void {
    this.viewInteractionEnabled = enabled;

    if (!enabled && this.activePanPointerId !== null) {
      this.finishPan(this.activePanPointerId);
    }
  }

  resetView(): void {
    this.setViewTransform(createResetStageViewTransform());
  }

  centerModel(): void {
    this.setViewTransform(centerStageViewTransform(this.viewTransform));
  }

  getRenderMetricsSnapshot(): StaticStageRenderMetricsSnapshot {
    const evaluationCacheMetrics = this.evaluationCache.getMetricsSnapshot();

    return {
      renderCount: this.renderCount,
      scheduledRenderCount: this.scheduledRenderCount,
      immediateRenderCount: this.immediateRenderCount,
      liveFrameMessageCount: this.liveFrameMessageCount,
      stageViewTransformMessageCount: this.stageViewTransformMessageCount,
      stageDisplayTransformMessageCount: this.stageDisplayTransformMessageCount,
      duplicateTransformSkipCount: this.duplicateTransformSkipCount,
      coalescedLiveFrameCount: this.coalescedLiveFrameCount,
      lastRafDeltaMs: this.lastRafDeltaMs,
      rafDeltaSampleCount: this.rafDeltaSampleCount,
      lastRenderDurationMs: this.lastRenderDurationMs,
      renderDurationSampleCount: this.renderDurationSampleCount,
      lastLiveRenderInputEvaluationDurationMs:
        this.lastLiveRenderInputEvaluationDurationMs,
      liveRenderInputEvaluationDurationSampleCount:
        this.liveRenderInputEvaluationDurationSampleCount,
      evaluationCacheHitCount:
        evaluationCacheMetrics.evaluationCacheHitCount,
      evaluationCacheMissCount:
        evaluationCacheMetrics.evaluationCacheMissCount,
      evaluationCacheInvalidationCount:
        evaluationCacheMetrics.evaluationCacheInvalidationCount,
      lastRuntimeCoreEvaluationDurationMs:
        this.lastRuntimeCoreEvaluationDurationMs,
      runtimeCoreEvaluationDurationSampleCount:
        this.runtimeCoreEvaluationDurationSampleCount,
      lastRuntimeCoreInputValidationDurationMs:
        this.lastRuntimeCoreInputValidationDurationMs,
      runtimeCoreInputValidationDurationSampleCount:
        this.runtimeCoreInputValidationDurationSampleCount,
      lastRuntimeCoreStateCompatibilityDurationMs:
        this.lastRuntimeCoreStateCompatibilityDurationMs,
      runtimeCoreStateCompatibilityDurationSampleCount:
        this.runtimeCoreStateCompatibilityDurationSampleCount,
      lastRuntimeCoreDynamicsEvaluationDurationMs:
        this.lastRuntimeCoreDynamicsEvaluationDurationMs,
      runtimeCoreDynamicsEvaluationDurationSampleCount:
        this.runtimeCoreDynamicsEvaluationDurationSampleCount,
      lastRuntimeCoreSnapshotCreationDurationMs:
        this.lastRuntimeCoreSnapshotCreationDurationMs,
      runtimeCoreSnapshotCreationDurationSampleCount:
        this.runtimeCoreSnapshotCreationDurationSampleCount,
      lastRuntimeCoreParameterResolutionDurationMs:
        this.lastRuntimeCoreParameterResolutionDurationMs,
      runtimeCoreParameterResolutionDurationSampleCount:
        this.runtimeCoreParameterResolutionDurationSampleCount,
      lastRuntimeCoreKeyformSamplingDurationMs:
        this.lastRuntimeCoreKeyformSamplingDurationMs,
      runtimeCoreKeyformSamplingDurationSampleCount:
        this.runtimeCoreKeyformSamplingDurationSampleCount,
      lastRuntimeCoreKeyformApplicationDurationMs:
        this.lastRuntimeCoreKeyformApplicationDurationMs,
      runtimeCoreKeyformApplicationDurationSampleCount:
        this.runtimeCoreKeyformApplicationDurationSampleCount,
      lastRuntimeCoreDeformerHierarchyEvaluationDurationMs:
        this.lastRuntimeCoreDeformerHierarchyEvaluationDurationMs,
      runtimeCoreDeformerHierarchyEvaluationDurationSampleCount:
        this.runtimeCoreDeformerHierarchyEvaluationDurationSampleCount,
      lastRuntimeCoreWarpDeformerVertexTransformDurationMs:
        this.lastRuntimeCoreWarpDeformerVertexTransformDurationMs,
      runtimeCoreWarpDeformerVertexTransformDurationSampleCount:
        this.runtimeCoreWarpDeformerVertexTransformDurationSampleCount,
      lastRuntimeCoreRotationDeformerVertexTransformDurationMs:
        this.lastRuntimeCoreRotationDeformerVertexTransformDurationMs,
      runtimeCoreRotationDeformerVertexTransformDurationSampleCount:
        this.runtimeCoreRotationDeformerVertexTransformDurationSampleCount,
      lastRuntimeCoreDrawableSnapshotCreationDurationMs:
        this.lastRuntimeCoreDrawableSnapshotCreationDurationMs,
      runtimeCoreDrawableSnapshotCreationDurationSampleCount:
        this.runtimeCoreDrawableSnapshotCreationDurationSampleCount,
      lastRuntimeCoreVisibilityDrawOrderEvaluationDurationMs:
        this.lastRuntimeCoreVisibilityDrawOrderEvaluationDurationMs,
      runtimeCoreVisibilityDrawOrderEvaluationDurationSampleCount:
        this.runtimeCoreVisibilityDrawOrderEvaluationDurationSampleCount,
      lastRuntimeCoreMaskEvaluationDurationMs:
        this.lastRuntimeCoreMaskEvaluationDurationMs,
      runtimeCoreMaskEvaluationDurationSampleCount:
        this.runtimeCoreMaskEvaluationDurationSampleCount,
      lastRuntimeCoreSnapshotValidationDurationMs:
        this.lastRuntimeCoreSnapshotValidationDurationMs,
      runtimeCoreSnapshotValidationDurationSampleCount:
        this.runtimeCoreSnapshotValidationDurationSampleCount,
      lastPoseEvaluationDurationMs: this.lastPoseEvaluationDurationMs,
      poseEvaluationDurationSampleCount:
        this.poseEvaluationDurationSampleCount,
      lastSnapshotToRenderDrawableDurationMs:
        this.lastSnapshotToRenderDrawableDurationMs,
      snapshotToRenderDrawableDurationSampleCount:
        this.snapshotToRenderDrawableDurationSampleCount,
      lastRenderInputSceneBuildDurationMs:
        this.lastRenderInputSceneBuildDurationMs,
      renderInputSceneBuildDurationSampleCount:
        this.renderInputSceneBuildDurationSampleCount,
      lastRenderInputScaffoldBuildDurationMs:
        this.lastRenderInputScaffoldBuildDurationMs,
      renderInputScaffoldBuildDurationSampleCount:
        this.renderInputScaffoldBuildDurationSampleCount,
      lastRenderInputClippingBuildDurationMs:
        this.lastRenderInputClippingBuildDurationMs,
      renderInputClippingBuildDurationSampleCount:
        this.renderInputClippingBuildDurationSampleCount,
      lastScheduledFrameDurationMs: this.lastScheduledFrameDurationMs,
      scheduledFrameDurationSampleCount:
        this.scheduledFrameDurationSampleCount,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      devicePixelRatio: getDevicePixelRatio()
    };
  }

  clear(): void {
    this.payload = null;
    this.renderInput = null;
    this.liveRuntimeState = null;
    this.latestLiveParameterFrame = null;
    this.hasPendingLiveParameterFrame = false;
    this.lastLiveSourceTimestampMs = null;
    this.evaluationCache.clear();
    this.cancelScheduledRender();
    this.renderCurrentImmediate();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.requestScheduledRender);
    this.canvas.removeEventListener("wheel", this.handleWheel);
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerUp);
    this.canvas.removeEventListener("lostpointercapture", this.handlePointerUp);
    this.cancelScheduledRender();
    this.evaluationCache.clear();
    this.renderer.dispose();
  }

  private readonly requestScheduledRender = (): void => {
    if (this.disposed || this.scheduledAnimationFrameId !== null) {
      return;
    }

    this.scheduledAnimationFrameId = window.requestAnimationFrame((timestampMs) => {
      this.scheduledAnimationFrameId = null;
      this.recordAnimationFrameDelta(timestampMs);
      try {
        this.renderScheduledFrame();
      } catch (error) {
        console.error("Stage scheduled render failed.", error);
        this.clear();
      }
    });
  };

  private cancelScheduledRender(): void {
    if (this.scheduledAnimationFrameId === null) {
      return;
    }

    window.cancelAnimationFrame(this.scheduledAnimationFrameId);
    this.scheduledAnimationFrameId = null;
  }

  private renderScheduledFrame(): void {
    if (this.disposed) {
      return;
    }

    const scheduledFrameStartedAtMs = readCurrentTimeMs();
    if (this.hasPendingLiveParameterFrame) {
      this.applyLatestLiveParameterFrameToRenderInput();
    }

    this.renderCurrentScheduled(scheduledFrameStartedAtMs);
  }

  private applyLatestLiveParameterFrameToRenderInput(): void {
    const payload = this.payload;
    const liveFrame = this.latestLiveParameterFrame;
    this.hasPendingLiveParameterFrame = false;

    if (
      this.disposed ||
      liveFrame === null ||
      !canApplyLiveParameterFrame(liveFrame, payload)
    ) {
      return;
    }

    const deltaTimeMs = this.lastLiveSourceTimestampMs === null
      ? 0
      : Math.max(0, liveFrame.sourceFrameTimestampMs - this.lastLiveSourceTimestampMs);
    const evaluationStartedAtMs = readCurrentTimeMs();
    const renderInput = createEvaluatedRuntimeExportStageRenderInput(
      payload,
      {
        activeVariantSelection: this.activeVariantSelection,
        evaluationCache: this.evaluationCache,
        authoredParameterValues: liveFrame.parameterValues,
        frameIndex: liveFrame.sequence,
        deltaTimeMs,
        resetReasons: [],
        ...(this.liveRuntimeState === null
          ? {}
          : { previousState: this.liveRuntimeState })
      }
    );
    const evaluationDurationMs = Math.max(
      0,
      readCurrentTimeMs() - evaluationStartedAtMs
    );

    this.renderInput = renderInput;
    this.liveRuntimeState = renderInput.poseEvaluation.nextState;
    this.lastLiveSourceTimestampMs = liveFrame.sourceFrameTimestampMs;
    this.lastLiveRenderInputEvaluationDurationMs = evaluationDurationMs;
    this.liveRenderInputEvaluationDurationSampleCount += 1;
    this.recordLiveRenderInputEvaluationProfile(
      renderInput.evaluationProfile
    );
  }

  private renderCurrentScheduled(scheduledFrameStartedAtMs: number): void {
    this.renderCurrent("scheduled", {
      scheduledFrameStartedAtMs
    });
  }

  private renderCurrentImmediate(): void {
    this.renderCurrent("immediate");
  }

  private renderCurrent(
    mode: "scheduled" | "immediate",
    options: {
      readonly scheduledFrameStartedAtMs?: number;
    } = {}
  ): void {
    if (this.disposed) {
      return;
    }

    const startedAtMs = readCurrentTimeMs();
    const canvasSize = resizeCanvasToDisplaySize(this.canvas);
    const renderInput = this.renderInput;
    const scene = renderInput?.scene ?? emptyScene;
    const modelBounds = renderInput?.modelBounds ?? {
      x: 0,
      y: 0,
      width: canvasSize.width,
      height: canvasSize.height
    };

    this.renderer.render(
      scene,
      createStageViewport({
        viewportWidth: canvasSize.width,
        viewportHeight: canvasSize.height,
        modelBounds,
        viewTransform: this.displayViewTransform ?? this.viewTransform
      })
    );
    const endedAtMs = readCurrentTimeMs();
    const durationMs = Math.max(0, endedAtMs - startedAtMs);
    this.lastRenderDurationMs = durationMs;
    this.renderDurationSampleCount += 1;
    this.renderCount += 1;
    if (mode === "scheduled") {
      this.scheduledRenderCount += 1;
      if (options.scheduledFrameStartedAtMs !== undefined) {
        this.lastScheduledFrameDurationMs = Math.max(
          0,
          endedAtMs - options.scheduledFrameStartedAtMs
        );
        this.scheduledFrameDurationSampleCount += 1;
      }
    } else {
      this.immediateRenderCount += 1;
    }
    this.reportRenderMetricsChanged();
  }

  private readonly handleWheel = (event: WheelEvent): void => {
    if (
      !shouldHandleStageViewInteraction({
        disposed: this.disposed,
        viewInteractionEnabled: this.viewInteractionEnabled,
        hasRenderInput: this.renderInput !== null
      })
    ) {
      return;
    }

    event.preventDefault();
    const hadDisplayViewTransform = this.displayViewTransform !== null;
    this.displayViewTransform = null;
    const nextTransform = applyStageWheelZoom({
      transform: this.viewTransform,
      wheelDeltaY: normalizeWheelDeltaY(event, this.canvas),
      anchor: getCanvasViewportPoint(this.canvas, event.clientX, event.clientY)
    });
    if (
      !hadDisplayViewTransform &&
      areStageViewTransformsEqual(this.viewTransform, nextTransform)
    ) {
      this.recordDuplicateTransformSkip();
      return;
    }

    this.viewTransform = nextTransform;
    this.requestScheduledRender();
    this.reportViewTransformChanged();
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (
      !shouldHandleStageViewInteraction({
        disposed: this.disposed,
        viewInteractionEnabled: this.viewInteractionEnabled,
        hasRenderInput: this.renderInput !== null
      }) ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();
    this.activePanPointerId = event.pointerId;
    this.lastPanPoint = getCanvasViewportPoint(
      this.canvas,
      event.clientX,
      event.clientY
    );
    safelySetPointerCapture(this.canvas, event.pointerId);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (
      this.disposed ||
      !this.viewInteractionEnabled ||
      this.activePanPointerId !== event.pointerId ||
      this.lastPanPoint === null
    ) {
      if (!this.viewInteractionEnabled) {
        this.finishPan(event.pointerId);
      }
      return;
    }

    if ((event.buttons & 1) !== 1) {
      this.finishPan(event.pointerId);
      return;
    }

    event.preventDefault();
    const hadDisplayViewTransform = this.displayViewTransform !== null;
    this.displayViewTransform = null;
    const nextPanPoint = getCanvasViewportPoint(
      this.canvas,
      event.clientX,
      event.clientY
    );
    const nextTransform = applyStagePanDelta(this.viewTransform, {
      x: nextPanPoint.x - this.lastPanPoint.x,
      y: nextPanPoint.y - this.lastPanPoint.y
    });
    this.lastPanPoint = nextPanPoint;
    if (
      !hadDisplayViewTransform &&
      areStageViewTransformsEqual(this.viewTransform, nextTransform)
    ) {
      this.recordDuplicateTransformSkip();
      return;
    }

    this.viewTransform = nextTransform;
    this.requestScheduledRender();
    this.reportViewTransformChanged();
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    this.finishPan(event.pointerId);
  };

  private finishPan(pointerId: number): void {
    if (this.activePanPointerId !== pointerId) {
      return;
    }

    safelyReleasePointerCapture(this.canvas, pointerId);
    this.activePanPointerId = null;
    this.lastPanPoint = null;
  }

  private reportViewTransformChanged(): void {
    this.options.onViewTransformChanged?.(this.viewTransform);
  }

  private recordDuplicateTransformSkip(): void {
    this.duplicateTransformSkipCount += 1;
    this.reportRenderMetricsChanged();
  }

  private recordAnimationFrameDelta(timestampMs: number): void {
    const resolvedTimestampMs = Number.isFinite(timestampMs)
      ? timestampMs
      : readCurrentTimeMs();

    if (this.lastAnimationFrameTimestampMs !== null) {
      this.lastRafDeltaMs = Math.max(
        0,
        resolvedTimestampMs - this.lastAnimationFrameTimestampMs
      );
      this.rafDeltaSampleCount += 1;
    }

    this.lastAnimationFrameTimestampMs = resolvedTimestampMs;
  }

  private recordLiveRenderInputEvaluationProfile(
    profile: RuntimeExportRenderInputEvaluationProfile | undefined
  ): void {
    if (profile === undefined) {
      return;
    }

    this.lastRuntimeCoreEvaluationDurationMs =
      profile.runtimeCoreEvaluationDurationMs;
    this.runtimeCoreEvaluationDurationSampleCount += 1;
    if (profile.runtimeCoreProfile !== undefined) {
      this.lastRuntimeCoreInputValidationDurationMs =
        profile.runtimeCoreProfile.inputValidationDurationMs;
      this.runtimeCoreInputValidationDurationSampleCount += 1;
      this.lastRuntimeCoreStateCompatibilityDurationMs =
        profile.runtimeCoreProfile.stateCompatibilityDurationMs;
      this.runtimeCoreStateCompatibilityDurationSampleCount += 1;
      this.lastRuntimeCoreDynamicsEvaluationDurationMs =
        profile.runtimeCoreProfile.dynamicsEvaluationDurationMs;
      this.runtimeCoreDynamicsEvaluationDurationSampleCount += 1;
      this.lastRuntimeCoreSnapshotCreationDurationMs =
        profile.runtimeCoreProfile.runtimeSnapshotCreationDurationMs;
      this.runtimeCoreSnapshotCreationDurationSampleCount += 1;
      this.lastRuntimeCoreParameterResolutionDurationMs =
        profile.runtimeCoreProfile.parameterResolutionDurationMs;
      this.runtimeCoreParameterResolutionDurationSampleCount += 1;
      this.lastRuntimeCoreKeyformSamplingDurationMs =
        profile.runtimeCoreProfile.keyformSamplingDurationMs;
      this.runtimeCoreKeyformSamplingDurationSampleCount += 1;
      this.lastRuntimeCoreKeyformApplicationDurationMs =
        profile.runtimeCoreProfile.keyformApplicationDurationMs;
      this.runtimeCoreKeyformApplicationDurationSampleCount += 1;
      this.lastRuntimeCoreDeformerHierarchyEvaluationDurationMs =
        profile.runtimeCoreProfile.deformerHierarchyEvaluationDurationMs;
      this.runtimeCoreDeformerHierarchyEvaluationDurationSampleCount += 1;
      this.lastRuntimeCoreWarpDeformerVertexTransformDurationMs =
        profile.runtimeCoreProfile.warpDeformerVertexTransformDurationMs;
      this.runtimeCoreWarpDeformerVertexTransformDurationSampleCount += 1;
      this.lastRuntimeCoreRotationDeformerVertexTransformDurationMs =
        profile.runtimeCoreProfile.rotationDeformerVertexTransformDurationMs;
      this.runtimeCoreRotationDeformerVertexTransformDurationSampleCount += 1;
      this.lastRuntimeCoreDrawableSnapshotCreationDurationMs =
        profile.runtimeCoreProfile.drawableSnapshotCreationDurationMs;
      this.runtimeCoreDrawableSnapshotCreationDurationSampleCount += 1;
      this.lastRuntimeCoreVisibilityDrawOrderEvaluationDurationMs =
        profile.runtimeCoreProfile.visibilityDrawOrderEvaluationDurationMs;
      this.runtimeCoreVisibilityDrawOrderEvaluationDurationSampleCount += 1;
      this.lastRuntimeCoreMaskEvaluationDurationMs =
        profile.runtimeCoreProfile.maskEvaluationDurationMs;
      this.runtimeCoreMaskEvaluationDurationSampleCount += 1;
      this.lastRuntimeCoreSnapshotValidationDurationMs =
        profile.runtimeCoreProfile.snapshotValidationDurationMs;
      this.runtimeCoreSnapshotValidationDurationSampleCount += 1;
    }
    this.lastPoseEvaluationDurationMs = profile.poseEvaluationDurationMs;
    this.poseEvaluationDurationSampleCount += 1;
    this.lastSnapshotToRenderDrawableDurationMs =
      profile.snapshotToRenderDrawableDurationMs;
    this.snapshotToRenderDrawableDurationSampleCount += 1;
    this.lastRenderInputSceneBuildDurationMs =
      profile.renderInputSceneBuildDurationMs;
    this.renderInputSceneBuildDurationSampleCount += 1;
    this.lastRenderInputScaffoldBuildDurationMs =
      profile.renderInputScaffoldBuildDurationMs;
    this.renderInputScaffoldBuildDurationSampleCount += 1;
    this.lastRenderInputClippingBuildDurationMs =
      profile.renderInputClippingBuildDurationMs;
    this.renderInputClippingBuildDurationSampleCount += 1;
  }

  private reportRenderMetricsChanged(): void {
    if (this.options.onRenderMetricsChanged === undefined) {
      return;
    }

    this.options.onRenderMetricsChanged(this.getRenderMetricsSnapshot());
  }
}

export function shouldHandleStageViewInteraction(input: {
  readonly disposed: boolean;
  readonly viewInteractionEnabled: boolean;
  readonly hasRenderInput: boolean;
}): boolean {
  return (
    !input.disposed &&
    input.viewInteractionEnabled &&
    input.hasRenderInput
  );
}

function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): {
  readonly width: number;
  readonly height: number;
} {
  const pixelRatio = getDevicePixelRatio();
  const canvasRect = canvas.getBoundingClientRect();
  const cssWidth = canvas.clientWidth || canvasRect.width || window.innerWidth;
  const cssHeight = canvas.clientHeight || canvasRect.height || window.innerHeight;
  const width = Math.max(1, Math.floor(cssWidth * pixelRatio));
  const height = Math.max(1, Math.floor(cssHeight * pixelRatio));

  if (canvas.width !== width) {
    canvas.width = width;
  }
  if (canvas.height !== height) {
    canvas.height = height;
  }

  return { width, height };
}

function areNullableStageViewTransformsEqual(
  left: StageViewTransform | null,
  right: StageViewTransform | null
): boolean {
  if (left === null || right === null) {
    return left === right;
  }

  return areStageViewTransformsEqual(left, right);
}

function areStageViewTransformsEqual(
  left: StageViewTransform,
  right: StageViewTransform
): boolean {
  return (
    left.zoomScale === right.zoomScale &&
    left.pan.x === right.pan.x &&
    left.pan.y === right.pan.y
  );
}

function readCurrentTimeMs(): number {
  return typeof performance === "undefined"
    ? Date.now()
    : performance.now();
}

function getDevicePixelRatio(): number {
  return Number.isFinite(window.devicePixelRatio)
    ? Math.max(1, window.devicePixelRatio)
    : 1;
}

function getCanvasViewportPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): StageViewportPoint {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = rect.width || canvas.clientWidth || window.innerWidth || 1;
  const cssHeight = rect.height || canvas.clientHeight || window.innerHeight || 1;

  return {
    x: (clientX - rect.left) * (canvas.width / cssWidth),
    y: (clientY - rect.top) * (canvas.height / cssHeight)
  };
}

function normalizeWheelDeltaY(
  event: WheelEvent,
  canvas: HTMLCanvasElement
): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * 16;
  }

  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * (canvas.clientHeight || window.innerHeight || 1);
  }

  return event.deltaY;
}

function safelySetPointerCapture(
  canvas: HTMLCanvasElement,
  pointerId: number
): void {
  try {
    canvas.setPointerCapture(pointerId);
  } catch {
    // Pointer capture is best-effort; panning still works while events arrive.
  }
}

function safelyReleasePointerCapture(
  canvas: HTMLCanvasElement,
  pointerId: number
): void {
  try {
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
  } catch {
    // Ignore release races from pointer cancel/lostpointercapture.
  }
}
