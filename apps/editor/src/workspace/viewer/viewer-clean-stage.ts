import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { PartId } from "@private-2d-rigging-lab/contracts";

import type { ParameterValueMap } from "../../features/editor-session/model/parameter-keyform-state";
import {
  createCanvasRenderProjection,
  type CanvasRenderProjection,
  type CanvasViewState
} from "../canvas/canvas-projection";
import {
  renderCanvasProjection,
  type CanvasBitmapCache,
  type CanvasOverlayState
} from "../canvas/canvas-renderer";
import {
  createViewerRenderSourceProjection,
  type ViewerRenderSourceMode,
  type ViewerRenderSourceProjectionResult
} from "./viewer-render-source";

export interface ViewerCleanStageProjectionOptions {
  readonly editorHiddenPartIds?: ReadonlySet<PartId>;
  readonly parameterValues?: ParameterValueMap;
  readonly renderSourceMode?: ViewerRenderSourceMode;
}

export interface ViewerCleanStageRenderInput {
  readonly canvas: HTMLCanvasElement;
  readonly projection: CanvasRenderProjection;
  readonly view: CanvasViewState;
  readonly cache: CanvasBitmapCache;
}

export const VIEWER_CLEAN_STAGE_BACKGROUND_COLOR = "#6b7280";

export const VIEWER_CLEAN_STAGE_OVERLAYS = {
  grid: false,
  originGuide: false,
  canvasBounds: false,
  selectionBounds: false,
  mesh: false,
  deformer: false,
  isolateSelected: false
} as const satisfies CanvasOverlayState;

export function createViewerCleanStageProjection(
  session: AuthoringSession,
  options: ViewerCleanStageProjectionOptions = {}
): CanvasRenderProjection {
  return createViewerCleanStageRenderSourceProjection(session, options).projection;
}

export function createViewerCleanStageRenderSourceProjection(
  session: AuthoringSession,
  options: ViewerCleanStageProjectionOptions = {}
): ViewerRenderSourceProjectionResult {
  const originalProjection = createCanvasRenderProjection(session, null, {
    parameterValues: options.parameterValues ?? {},
    ...(options.editorHiddenPartIds === undefined
      ? {}
      : { editorHiddenPartIds: options.editorHiddenPartIds })
  });

  return createViewerRenderSourceProjection({
    session,
    originalProjection,
    requestedMode: options.renderSourceMode ?? "original"
  });
}

export function renderViewerCleanStageProjection(input: ViewerCleanStageRenderInput): void {
  renderCanvasProjection({
    canvas: input.canvas,
    projection: input.projection,
    view: input.view,
    cache: input.cache,
    backgroundColor: VIEWER_CLEAN_STAGE_BACKGROUND_COLOR,
    overlays: VIEWER_CLEAN_STAGE_OVERLAYS
  });
}
