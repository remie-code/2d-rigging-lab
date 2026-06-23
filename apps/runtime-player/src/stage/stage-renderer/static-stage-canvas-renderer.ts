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
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import {
  type RuntimeExportStageRenderInput
} from "./runtime-export-stage-scene";
import { createEvaluatedRuntimeExportStageRenderInput } from "./evaluated-runtime-export-stage-scene";
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
  setPayload(payload: RuntimeExportLoadedPayload): StaticStageRenderResult;
  setLiveParameterFrame(frame: RuntimePlayerLiveParameterFrame): void;
  clearLiveParameterFrame(): void;
  getViewTransform(): StageViewTransform;
  setViewTransform(
    transform: StageViewTransform,
    options?: StaticStageViewTransformSetOptions
  ): void;
  resetView(): void;
  centerModel(): void;
  clear(): void;
  dispose(): void;
}

export interface StaticStageCanvasRendererOptions {
  readonly onViewTransformChanged?: (transform: StageViewTransform) => void;
}

export interface StaticStageViewTransformSetOptions {
  readonly notify?: boolean;
}

export interface StaticStageRenderResult {
  readonly runtimeDiagnosticDetails: readonly string[];
}

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
  private renderInput: RuntimeExportStageRenderInput | null = null;
  private liveRuntimeState: RuntimeStateDto | null = null;
  private latestLiveParameterFrame: RuntimePlayerLiveParameterFrame | null = null;
  private liveAnimationFrameId: number | null = null;
  private lastLiveSourceTimestampMs: number | null = null;
  private viewTransform: StageViewTransform = createResetStageViewTransform();
  private activePanPointerId: number | null = null;
  private lastPanPoint: StageViewportPoint | null = null;
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
            this.renderCurrent();
          });
    this.resizeObserver?.observe(canvas);
    window.addEventListener("resize", this.renderCurrent);
    canvas.addEventListener("wheel", this.handleWheel, { passive: false });
    canvas.addEventListener("pointerdown", this.handlePointerDown);
    canvas.addEventListener("pointermove", this.handlePointerMove);
    canvas.addEventListener("pointerup", this.handlePointerUp);
    canvas.addEventListener("pointercancel", this.handlePointerUp);
    canvas.addEventListener("lostpointercapture", this.handlePointerUp);
    this.renderCurrent();
  }

  setPayload(payload: RuntimeExportLoadedPayload): StaticStageRenderResult {
    const renderInput = createEvaluatedRuntimeExportStageRenderInput(payload);

    this.payload = payload;
    this.renderInput = renderInput;
    this.liveRuntimeState = renderInput.poseEvaluation.nextState;
    this.latestLiveParameterFrame = null;
    this.lastLiveSourceTimestampMs = null;
    this.renderCurrent();

    return {
      runtimeDiagnosticDetails: createStageRuntimeDiagnosticDetails(
        renderInput.poseEvaluation.snapshot.diagnostics
      )
    };
  }

  setLiveParameterFrame(frame: RuntimePlayerLiveParameterFrame): void {
    if (
      this.disposed ||
      !canApplyLiveParameterFrame(frame, this.payload)
    ) {
      return;
    }

    this.latestLiveParameterFrame = frame;
    this.requestLiveRender();
  }

  clearLiveParameterFrame(): void {
    this.latestLiveParameterFrame = null;
    this.lastLiveSourceTimestampMs = null;

    if (this.payload === null || this.disposed) {
      return;
    }

    const renderInput = createEvaluatedRuntimeExportStageRenderInput(this.payload);
    this.renderInput = renderInput;
    this.liveRuntimeState = renderInput.poseEvaluation.nextState;
    this.renderCurrent();
  }

  getViewTransform(): StageViewTransform {
    return this.viewTransform;
  }

  setViewTransform(
    transform: StageViewTransform,
    options: StaticStageViewTransformSetOptions = {}
  ): void {
    this.viewTransform = normalizeStageViewTransform(transform);
    this.renderCurrent();

    if (options.notify ?? true) {
      this.reportViewTransformChanged();
    }
  }

  resetView(): void {
    this.setViewTransform(createResetStageViewTransform());
  }

  centerModel(): void {
    this.setViewTransform(centerStageViewTransform(this.viewTransform));
  }

  clear(): void {
    this.payload = null;
    this.renderInput = null;
    this.liveRuntimeState = null;
    this.latestLiveParameterFrame = null;
    this.lastLiveSourceTimestampMs = null;
    this.cancelLiveRender();
    this.renderCurrent();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.renderCurrent);
    this.canvas.removeEventListener("wheel", this.handleWheel);
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerUp);
    this.canvas.removeEventListener("lostpointercapture", this.handlePointerUp);
    this.cancelLiveRender();
    this.renderer.dispose();
  }

  private requestLiveRender(): void {
    if (this.liveAnimationFrameId !== null) {
      return;
    }

    this.liveAnimationFrameId = window.requestAnimationFrame(() => {
      this.liveAnimationFrameId = null;
      try {
        this.renderLatestLiveParameterFrame();
      } catch (error) {
        console.error("Stage live parameter render failed.", error);
        this.clear();
      }
    });
  }

  private cancelLiveRender(): void {
    if (this.liveAnimationFrameId === null) {
      return;
    }

    window.cancelAnimationFrame(this.liveAnimationFrameId);
    this.liveAnimationFrameId = null;
  }

  private renderLatestLiveParameterFrame(): void {
    const payload = this.payload;
    const liveFrame = this.latestLiveParameterFrame;

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
    const renderInput = createEvaluatedRuntimeExportStageRenderInput(
      payload,
      {
        authoredParameterValues: liveFrame.parameterValues,
        frameIndex: liveFrame.sequence,
        deltaTimeMs,
        resetReasons: [],
        ...(this.liveRuntimeState === null
          ? {}
          : { previousState: this.liveRuntimeState })
      }
    );

    this.renderInput = renderInput;
    this.liveRuntimeState = renderInput.poseEvaluation.nextState;
    this.lastLiveSourceTimestampMs = liveFrame.sourceFrameTimestampMs;
    this.renderCurrent();
  }

  private readonly renderCurrent = (): void => {
    if (this.disposed) {
      return;
    }

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
        viewTransform: this.viewTransform
      })
    );
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    if (this.disposed || this.renderInput === null) {
      return;
    }

    this.viewTransform = applyStageWheelZoom({
      transform: this.viewTransform,
      wheelDeltaY: normalizeWheelDeltaY(event, this.canvas),
      anchor: getCanvasViewportPoint(this.canvas, event.clientX, event.clientY)
    });
    this.renderCurrent();
    this.reportViewTransformChanged();
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (
      this.disposed ||
      this.renderInput === null ||
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
      this.activePanPointerId !== event.pointerId ||
      this.lastPanPoint === null
    ) {
      return;
    }

    if ((event.buttons & 1) !== 1) {
      this.finishPan(event.pointerId);
      return;
    }

    event.preventDefault();
    const nextPanPoint = getCanvasViewportPoint(
      this.canvas,
      event.clientX,
      event.clientY
    );
    this.viewTransform = applyStagePanDelta(this.viewTransform, {
      x: nextPanPoint.x - this.lastPanPoint.x,
      y: nextPanPoint.y - this.lastPanPoint.y
    });
    this.lastPanPoint = nextPanPoint;
    this.renderCurrent();
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
