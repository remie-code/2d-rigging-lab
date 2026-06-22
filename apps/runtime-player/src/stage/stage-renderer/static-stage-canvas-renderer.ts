import {
  createRenderScene,
  type RenderScene
} from "@private-2d-rigging-lab/render-core";
import {
  createWebGl2RendererFromCanvas,
  type WebGl2Renderer
} from "@private-2d-rigging-lab/render-webgl2";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import {
  createRuntimeExportStageRenderInput,
  type RuntimeExportStageRenderInput
} from "./runtime-export-stage-scene";
import { createStageViewport } from "./stage-viewport";

export interface StaticStageCanvasRenderer {
  setPayload(payload: RuntimeExportLoadedPayload): void;
  clear(): void;
  dispose(): void;
}

const emptyScene: RenderScene = createRenderScene({
  textureSources: [],
  drawables: []
});

export function createStaticStageCanvasRenderer(
  canvas: HTMLCanvasElement
): StaticStageCanvasRenderer {
  const renderer = createWebGl2RendererFromCanvas(canvas);
  if (renderer === undefined) {
    throw new Error("Stage WebGL2 context is unavailable.");
  }

  return new StaticStageCanvasRendererController(canvas, renderer);
}

class StaticStageCanvasRendererController implements StaticStageCanvasRenderer {
  private renderInput: RuntimeExportStageRenderInput | null = null;
  private readonly resizeObserver: ResizeObserver | undefined;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly renderer: WebGl2Renderer
  ) {
    this.resizeObserver =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => {
            this.renderCurrent();
          });
    this.resizeObserver?.observe(canvas);
    window.addEventListener("resize", this.renderCurrent);
    this.renderCurrent();
  }

  setPayload(payload: RuntimeExportLoadedPayload): void {
    this.renderInput = createRuntimeExportStageRenderInput(payload);
    this.renderCurrent();
  }

  clear(): void {
    this.renderInput = null;
    this.renderCurrent();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.renderCurrent);
    this.renderer.dispose();
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
        modelBounds
      })
    );
  };
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
