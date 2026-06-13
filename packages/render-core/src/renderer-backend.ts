import type { RenderScene } from "./render-scene.js";

export interface RenderViewportTransform {
  readonly scale: number;
  readonly translate: {
    readonly x: number;
    readonly y: number;
  };
}

export interface RenderViewport {
  readonly width: number;
  readonly height: number;
  readonly stageToViewport: RenderViewportTransform;
}

export interface RendererBackend {
  render(scene: RenderScene, viewport: RenderViewport): void;
  dispose(): void;
}
