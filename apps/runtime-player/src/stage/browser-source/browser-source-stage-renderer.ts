import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import type {
  RuntimePlayerBrowserSourceStageViewTransform
} from "../../preload/browser-source-status-contract";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type {
  RuntimePlayerActiveVariantSelectionState
} from "../../preload/runtime-variant-bridge-contract";
import {
  createStaticStageCanvasRenderer,
  type StaticStageCanvasRenderer,
  type StaticStageRenderMetricsSnapshot,
  type StaticStageRenderResult
} from "../stage-renderer/static-stage-canvas-renderer";

export type BrowserSourceStageRendererSetup =
  | {
      readonly webgl2Available: "available";
      readonly renderer: BrowserSourceStageRenderer;
      readonly message: null;
    }
  | {
      readonly webgl2Available: "available" | "unavailable" | "unknown";
      readonly renderer: null;
      readonly message: string;
    };

export interface BrowserSourceStageRenderer {
  setPayload(payload: RuntimeExportLoadedPayload): StaticStageRenderResult;
  setActiveVariantSelection(
    activeVariantSelection: RuntimePlayerActiveVariantSelectionState | null
  ): void;
  setViewTransform(
    transform: RuntimePlayerBrowserSourceStageViewTransform
  ): void;
  setLiveParameterFrame(frame: RuntimePlayerLiveParameterFrame): void;
  clearLiveParameterFrame(): void;
  getRenderMetricsSnapshot(): StaticStageRenderMetricsSnapshot;
  clear(): void;
  dispose(): void;
}

export function createBrowserSourceStageRenderer(
  canvas: HTMLCanvasElement
): BrowserSourceStageRendererSetup {
  const webgl2Available = probeWebGl2Availability(canvas);

  try {
    const renderer = createStaticStageCanvasRenderer(canvas);
    renderer.setViewInteractionEnabled(false);

    return {
      webgl2Available: "available",
      renderer: new BrowserSourceStageRendererAdapter(renderer),
      message: null
    };
  } catch (error) {
    return {
      webgl2Available,
      renderer: null,
      message: toRendererSetupMessage(error)
    };
  }
}

class BrowserSourceStageRendererAdapter implements BrowserSourceStageRenderer {
  constructor(private readonly renderer: StaticStageCanvasRenderer) {}

  setPayload(payload: RuntimeExportLoadedPayload): StaticStageRenderResult {
    return this.renderer.setPayload(payload);
  }

  setActiveVariantSelection(
    activeVariantSelection: RuntimePlayerActiveVariantSelectionState | null
  ): void {
    this.renderer.setActiveVariantSelection(activeVariantSelection);
  }

  setLiveParameterFrame(frame: RuntimePlayerLiveParameterFrame): void {
    this.renderer.setLiveParameterFrame(frame);
  }

  setViewTransform(
    transform: RuntimePlayerBrowserSourceStageViewTransform
  ): void {
    this.renderer.setViewTransform(transform, { notify: false });
  }

  clearLiveParameterFrame(): void {
    this.renderer.clearLiveParameterFrame();
  }

  getRenderMetricsSnapshot(): StaticStageRenderMetricsSnapshot {
    return this.renderer.getRenderMetricsSnapshot();
  }

  clear(): void {
    this.renderer.clear();
  }

  dispose(): void {
    this.renderer.dispose();
  }
}

function probeWebGl2Availability(
  canvas: HTMLCanvasElement
): "available" | "unavailable" {
  try {
    return canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      stencil: false
    }) === null
      ? "unavailable"
      : "available";
  } catch {
    return "unavailable";
  }
}

function toRendererSetupMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Browser Source renderer setup failed.";
}
