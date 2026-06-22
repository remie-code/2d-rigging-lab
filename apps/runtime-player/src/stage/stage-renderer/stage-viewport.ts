import type { RenderViewport } from "@private-2d-rigging-lab/render-core";

import type { StageModelBounds } from "./runtime-export-stage-scene";
import {
  composeStageViewportTransform,
  createResetStageViewTransform,
  type StageViewTransform
} from "./stage-view-transform";

export interface StageViewportInput {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly modelBounds: StageModelBounds;
  readonly paddingRatio?: number;
  readonly viewTransform?: StageViewTransform;
}

export function createStageViewport(input: StageViewportInput): RenderViewport {
  const viewportWidth = Math.max(1, Math.floor(input.viewportWidth));
  const viewportHeight = Math.max(1, Math.floor(input.viewportHeight));
  const initialTransform = createInitialStageViewportTransform({
    viewportWidth,
    viewportHeight,
    modelBounds: input.modelBounds,
    ...(input.paddingRatio === undefined ? {} : { paddingRatio: input.paddingRatio })
  });

  return {
    width: viewportWidth,
    height: viewportHeight,
    stageToViewport: composeStageViewportTransform(
      initialTransform,
      input.viewTransform ?? createResetStageViewTransform()
    )
  };
}

function createInitialStageViewportTransform(input: {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly modelBounds: StageModelBounds;
  readonly paddingRatio?: number;
}): RenderViewport["stageToViewport"] {
  const paddingRatio = clamp(input.paddingRatio ?? 0.08, 0, 0.45);
  const availableWidth = Math.max(1, input.viewportWidth * (1 - paddingRatio * 2));
  const availableHeight = Math.max(1, input.viewportHeight * (1 - paddingRatio * 2));
  const modelWidth = Math.max(1, input.modelBounds.width);
  const modelHeight = Math.max(1, input.modelBounds.height);
  const scale = Math.min(
    availableWidth / modelWidth,
    availableHeight / modelHeight
  );

  return {
    scale,
    translate: {
      x: (input.viewportWidth - input.modelBounds.width * scale) / 2 -
        input.modelBounds.x * scale,
      y: (input.viewportHeight - input.modelBounds.height * scale) / 2 -
        input.modelBounds.y * scale
    }
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
