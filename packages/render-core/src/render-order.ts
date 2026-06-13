import type { CreateRenderSceneInput, RenderDrawable, RenderScene } from "./render-scene.js";
import {
  DEFAULT_RENDER_COORDINATE_SYSTEM,
  DEFAULT_RENDER_SCENE_SCHEMA_VERSION
} from "./render-scene.js";

export const compareRenderDrawablesBackToFront = (
  left: RenderDrawable,
  right: RenderDrawable
): number => {
  const drawOrderDelta = right.drawOrder - left.drawOrder;
  if (drawOrderDelta !== 0) {
    return drawOrderDelta;
  }

  const stableIndexDelta = left.stableIndex - right.stableIndex;
  if (stableIndexDelta !== 0) {
    return stableIndexDelta;
  }

  return left.drawableId.localeCompare(right.drawableId);
};

export const orderRenderDrawablesBackToFront = (
  drawables: readonly RenderDrawable[]
): readonly RenderDrawable[] => [...drawables].sort(compareRenderDrawablesBackToFront);

export const createRenderScene = (input: CreateRenderSceneInput): RenderScene => ({
  schemaVersion: DEFAULT_RENDER_SCENE_SCHEMA_VERSION,
  coordinateSystem: input.coordinateSystem ?? DEFAULT_RENDER_COORDINATE_SYSTEM,
  textureSources: [...input.textureSources],
  drawables: orderRenderDrawablesBackToFront(input.drawables)
});
