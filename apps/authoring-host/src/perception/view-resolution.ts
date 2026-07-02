import type { RectDto } from "@private-2d-rigging-lab/contracts";
import type { RenderViewSpec } from "@private-2d-rigging-lab/ai-interface";
import type { RuntimeSnapshotDto } from "@private-2d-rigging-lab/runtime-core";
import type {
  SoftwareRenderView,
  StageViewportRect
} from "@private-2d-rigging-lab/render-software";

import { evaluatedDrawableBounds, modelEvaluatedBounds } from "./evaluated-bounds.js";

/**
 * Framing resolution (Wave104 Domain A, §3.2).
 *
 * Turns a payload view spec into a concrete {@link SoftwareRenderView}:
 *  - absent / `modelBounds`: the union of every evaluated drawable's bounds.
 *  - `stageViewport`: the explicit rectangle as given.
 *  - `drawableFocus`: one drawable's evaluated bbox expanded by `marginRatio` on
 *    each side.
 *
 * The output pixel size defaults to preserve the stage aspect ratio (long edge
 * = 1024 px) when neither dimension is given, so the transform is well defined
 * and deterministic without the caller having to compute it.
 */

const DEFAULT_LONG_EDGE_PIXELS = 1024;

export class ViewResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ViewResolutionError";
  }
}

export interface ResolveRenderViewInput {
  readonly snapshot: RuntimeSnapshotDto;
  readonly view?: RenderViewSpec;
  readonly outputWidth?: number;
  readonly outputHeight?: number;
}

export const resolvePerceptionRenderView = (
  input: ResolveRenderViewInput
): SoftwareRenderView => {
  const stageViewport = resolveStageViewport(input);
  const { outputWidth, outputHeight } = resolveOutputDimensions({
    stageViewport,
    ...(input.outputWidth === undefined ? {} : { outputWidth: input.outputWidth }),
    ...(input.outputHeight === undefined ? {} : { outputHeight: input.outputHeight })
  });

  return { stageViewport, outputWidth, outputHeight };
};

const resolveStageViewport = (input: ResolveRenderViewInput): StageViewportRect => {
  const view = input.view;

  if (view === undefined || view.kind === "modelBounds") {
    const bounds = modelEvaluatedBounds(input.snapshot);
    if (bounds === undefined) {
      throw new ViewResolutionError(
        "Cannot resolve model bounds: no drawable has finite positive evaluated bounds."
      );
    }
    return rectToStageViewport(bounds);
  }

  if (view.kind === "stageViewport") {
    return {
      minX: view.stageViewport.minX,
      minY: view.stageViewport.minY,
      width: view.stageViewport.width,
      height: view.stageViewport.height
    };
  }

  const focus = evaluatedDrawableBounds(input.snapshot, view.drawableId);
  if (focus === undefined) {
    throw new ViewResolutionError(
      `Cannot focus drawable "${view.drawableId}": it is not present in the evaluated snapshot.`
    );
  }
  if (!(focus.bounds.width > 0) || !(focus.bounds.height > 0)) {
    throw new ViewResolutionError(
      `Cannot focus drawable "${view.drawableId}": its evaluated bounds are degenerate (${focus.bounds.width}x${focus.bounds.height}).`
    );
  }

  return applyMargin(focus.bounds, view.marginRatio);
};

const applyMargin = (bounds: RectDto, marginRatio: number): StageViewportRect => {
  const marginX = bounds.width * marginRatio;
  const marginY = bounds.height * marginRatio;

  return {
    minX: bounds.x - marginX,
    minY: bounds.y - marginY,
    width: bounds.width + marginX * 2,
    height: bounds.height + marginY * 2
  };
};

const rectToStageViewport = (rect: RectDto): StageViewportRect => ({
  minX: rect.x,
  minY: rect.y,
  width: rect.width,
  height: rect.height
});

const resolveOutputDimensions = (input: {
  readonly stageViewport: StageViewportRect;
  readonly outputWidth?: number;
  readonly outputHeight?: number;
}): { readonly outputWidth: number; readonly outputHeight: number } => {
  const aspect = input.stageViewport.width / input.stageViewport.height;

  if (input.outputWidth !== undefined && input.outputHeight !== undefined) {
    return { outputWidth: input.outputWidth, outputHeight: input.outputHeight };
  }

  if (input.outputWidth !== undefined) {
    return {
      outputWidth: input.outputWidth,
      outputHeight: Math.max(1, Math.round(input.outputWidth / aspect))
    };
  }

  if (input.outputHeight !== undefined) {
    return {
      outputWidth: Math.max(1, Math.round(input.outputHeight * aspect)),
      outputHeight: input.outputHeight
    };
  }

  // Neither given: fit the long edge to a fixed pixel count, preserving aspect.
  if (aspect >= 1) {
    return {
      outputWidth: DEFAULT_LONG_EDGE_PIXELS,
      outputHeight: Math.max(1, Math.round(DEFAULT_LONG_EDGE_PIXELS / aspect))
    };
  }

  return {
    outputWidth: Math.max(1, Math.round(DEFAULT_LONG_EDGE_PIXELS * aspect)),
    outputHeight: DEFAULT_LONG_EDGE_PIXELS
  };
};
