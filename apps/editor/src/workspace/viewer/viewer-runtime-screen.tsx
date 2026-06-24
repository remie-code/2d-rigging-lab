import {
  createVariantVisibilityPredicate,
  type AuthoringSession,
  type VariantActiveSelectionEntry,
  type VariantVisibilityPredicate
} from "@private-2d-rigging-lab/authoring-core";
import type { PartId, RuntimeStateDto } from "@private-2d-rigging-lab/contracts";
import {
  recordLive2dPerformanceTiming,
  startLive2dPerformanceTiming
} from "@private-2d-rigging-lab/render-core";
import {
  ArrowLeft,
  Focus,
  Maximize2,
  Scan,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent
} from "react";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import {
  listEditorParameters,
  type EditorParameter,
  type ParameterValueMap
} from "../../features/editor-session/model/parameter-keyform-state";
import { cn } from "../../lib/class-name";
import { useEditorUiStore, type WorkspaceEntryId } from "../../state/editor-ui-store";
import { IconButton } from "../../ui/icon-button";
import {
  INITIAL_CANVAS_AUTO_FIT_POLICY_STATE,
  resolveCanvasAutoFitPolicy
} from "../canvas/canvas-auto-fit-policy";
import {
  createCanvasRenderProjection,
  fitArtworkView,
  fitCanvasView,
  formatZoomPercent,
  isRenderableDrawable,
  nudgeZoomAtViewportCenter,
  resetOneToOneView,
  zoomViewAtScreenPoint,
  type CanvasPoint,
  type CanvasRenderProjection,
  type CanvasViewState,
  type CanvasViewportSize
} from "../canvas/canvas-projection";
import {
  createCanvasBitmapCache,
  disposeCanvasBitmapCache
} from "../canvas/canvas-renderer";
import { RuntimeControls } from "./runtime-controls";
import {
  createInitialRuntimeControlsState,
  createRuntimeParameterValueMap,
  type ViewerRuntimeControlsState
} from "./runtime-controls-state";
import { renderViewerCleanStageProjection } from "./viewer-clean-stage";
import {
  createViewerAtlasRuntimeSourceCache,
  createViewerRenderSourceProjection,
  type ViewerAtlasRuntimeSourceCache,
  type ViewerAtlasRuntimeAvailability,
  type ViewerRenderSourceMode
} from "./viewer-render-source";
import {
  createInitialViewerVariantActiveSelections,
  createViewerVariantGroupsSignature,
  getViewerVariantGroups,
  reconcileViewerVariantActiveSelections,
  sameViewerVariantActiveSelections
} from "./viewer-variant-selection";
import {
  createViewerRuntimeParameterSignature,
  createViewerRuntimeInitialState,
  createViewerRuntimePlaybackModel,
  createViewerRuntimeReusableParameterValues,
  evaluateViewerRuntimePlaybackFrame,
  isViewerRuntimePlaybackStateCompatible,
  isViewerRuntimePlaybackStateSettled,
  resolveViewerRuntimeParameterValues,
  VIEWER_RUNTIME_FIXED_STEP_MS,
  type ViewerRuntimeReusableParameterValues,
  type ViewerRuntimePlaybackModel
} from "./viewer-runtime-playback";

const DEFAULT_VIEW: CanvasViewState = {
  zoom: 1,
  pan: { x: 0, y: 0 }
};

const DEFAULT_VIEWPORT: CanvasViewportSize = {
  width: 0,
  height: 0
};

export interface ViewerRuntimeCleanStageProjectionInput {
  readonly baseParameterValues: ParameterValueMap;
  readonly atlasRuntimeAvailability: ViewerAtlasRuntimeAvailability;
  readonly parameterValues: ParameterValueMap;
  readonly parameters: readonly EditorParameter[];
  readonly projection: CanvasRenderProjection;
  readonly renderSourceMode: ViewerRenderSourceMode;
  readonly requestedRenderSourceMode: ViewerRenderSourceMode;
  readonly runtimePlaybackModel: ViewerRuntimePlaybackModel;
}

export function ViewerRuntimeScreen() {
  const { editorHiddenPartIds, parameterValues, session } = useEditorSession();
  const setActiveEntry = useEditorUiStore((state) => state.setActiveEntry);
  const [runtimeControlsState, setRuntimeControlsState] =
    useState<ViewerRuntimeControlsState>(() => createInitialRuntimeControlsState());
  const [renderSourceMode, setRenderSourceMode] =
    useState<ViewerRenderSourceMode>("original");
  const variantGroups = getViewerVariantGroups(session);
  const variantGroupsSignature = createViewerVariantGroupsSignature(variantGroups);
  const [viewerVariantActiveSelections, setViewerVariantActiveSelections] = useState<
    readonly VariantActiveSelectionEntry[]
  >(() => createInitialViewerVariantActiveSelections(variantGroups));
  const [runtimePlaybackFrame, setRuntimePlaybackFrame] =
    useState<ViewerRuntimePlaybackScreenFrame | null>(null);
  const runtimePlaybackFrameRef = useRef<ViewerRuntimePlaybackScreenFrame | null>(null);
  const [runtimeSimulationResetToken, setRuntimeSimulationResetToken] = useState(0);
  const setRuntimePlaybackFrameAndRef = useCallback(
    (frame: ViewerRuntimePlaybackScreenFrame | null) => {
      runtimePlaybackFrameRef.current = frame;
      setRuntimePlaybackFrame(frame);
    },
    []
  );
  const setRuntimePlaybackStateAndRef = useCallback((state: RuntimeStateDto | null) => {
    setRuntimePlaybackFrameAndRef(state === null ? null : { state });
  }, [setRuntimePlaybackFrameAndRef]);
  const setRuntimePlaybackResultAndRef = useCallback(
    (input: {
      readonly authoredParameterValues: ParameterValueMap;
      readonly model: ViewerRuntimePlaybackModel;
      readonly result: ReturnType<typeof evaluateViewerRuntimePlaybackFrame>;
    }) => {
      setRuntimePlaybackFrameAndRef({
        state: input.result.nextState,
        reusableParameterValues: createViewerRuntimeReusableParameterValues({
          authoredParameterValues: input.authoredParameterValues,
          model: input.model,
          parameterValues: input.result.parameterValues,
          state: input.result.nextState
        })
      });
    },
    [setRuntimePlaybackFrameAndRef]
  );
  const atlasRuntimeSourceCache = useMemo(() => createViewerAtlasRuntimeSourceCache(), []);
  const runtimePlaybackRef = useRef<ViewerRuntimePlaybackLoopInput | null>(null);
  useEffect(() => {
    setViewerVariantActiveSelections((current) => {
      const reconciled = reconcileViewerVariantActiveSelections(variantGroups, current);

      return sameViewerVariantActiveSelections(current, reconciled) ? current : reconciled;
    });
  }, [variantGroups, variantGroupsSignature]);
  const variantVisibilityPredicate = useMemo(
    () =>
      createVariantVisibilityPredicate({
        variantGroups,
        activeSelections: viewerVariantActiveSelections
      }),
    [variantGroups, variantGroupsSignature, viewerVariantActiveSelections]
  );
  const setViewerVariantActiveSelection = useCallback(
    (entry: VariantActiveSelectionEntry) => {
      setViewerVariantActiveSelections((current) => {
        const reconciled = reconcileViewerVariantActiveSelections(variantGroups, [
          ...current.filter((candidate) => candidate.variantGroupId !== entry.variantGroupId),
          entry
        ]);

        return sameViewerVariantActiveSelections(current, reconciled) ? current : reconciled;
      });
    },
    [variantGroups, variantGroupsSignature]
  );
  const resetViewerVariants = useCallback(() => {
    setViewerVariantActiveSelections((current) => {
      const defaults = createInitialViewerVariantActiveSelections(variantGroups);

      return sameViewerVariantActiveSelections(current, defaults) ? current : defaults;
    });
  }, [variantGroups, variantGroupsSignature]);
  const runtimePlaybackModel = useMemo(
    () => createViewerRuntimePlaybackModel(session),
    [session]
  );
  const runtimePlaybackState = runtimePlaybackFrame?.state ?? null;
  const compatibleRuntimePlaybackState =
    runtimePlaybackState !== null &&
    isViewerRuntimePlaybackStateCompatible(runtimePlaybackModel, runtimePlaybackState)
      ? runtimePlaybackState
      : null;
  const compatibleRuntimeReusableParameterValues =
    compatibleRuntimePlaybackState === null
      ? null
      : runtimePlaybackFrame?.reusableParameterValues ?? null;
  const cleanStage = useMemo(
    () =>
      createViewerRuntimeCleanStageProjection({
        authoringParameterValues: parameterValues,
        editorHiddenPartIds,
        runtimePlaybackModel,
        runtimeReusableParameterValues: compatibleRuntimeReusableParameterValues,
        runtimePlaybackState: compatibleRuntimePlaybackState,
        runtimeControlsState,
        renderSourceMode,
        atlasRuntimeSourceCache,
        variantVisibilityPredicate,
        session
      }),
    [
      editorHiddenPartIds,
      parameterValues,
      runtimeControlsState,
      renderSourceMode,
      atlasRuntimeSourceCache,
      compatibleRuntimePlaybackState,
      compatibleRuntimeReusableParameterValues,
      runtimePlaybackModel,
      variantVisibilityPredicate,
      session
    ]
  );
  const runtimeParameterSignature = useMemo(
    () =>
      createViewerRuntimeParameterSignature(
        runtimePlaybackModel,
        cleanStage.baseParameterValues
      ),
    [cleanStage.baseParameterValues, runtimePlaybackModel]
  );
  runtimePlaybackRef.current = {
    authoredParameterValues: cleanStage.baseParameterValues,
    model: runtimePlaybackModel
  };
  const resetRuntimeSimulation = useCallback(() => {
    const playback = runtimePlaybackRef.current;
    if (playback === null || playback.model.enabledDynamicsGroupCount === 0) {
      return;
    }

    setRuntimePlaybackStateAndRef(
      createViewerRuntimeInitialState(
        playback.model,
        playback.authoredParameterValues,
        "manualCommand"
      )
    );
    setRuntimeSimulationResetToken((token) => token + 1);
  }, [setRuntimePlaybackStateAndRef]);

  useEffect(() => {
    const currentState = runtimePlaybackFrameRef.current?.state ?? null;
    if (
      currentState !== null &&
      !isViewerRuntimePlaybackStateCompatible(runtimePlaybackModel, currentState)
    ) {
      setRuntimePlaybackStateAndRef(null);
    }
  }, [runtimePlaybackModel, setRuntimePlaybackStateAndRef]);

  useEffect(() => {
    if (runtimePlaybackModel.enabledDynamicsGroupCount === 0) {
      setRuntimePlaybackStateAndRef(null);
      return undefined;
    }

    let lastTimestamp: number | null = null;
    let frameRequest: number | null = null;
    let evaluatedFrameCount = 0;
    let active = true;
    const scheduleNextFrame = () => {
      if (!active || frameRequest !== null) {
        return;
      }

      frameRequest = requestAnimationFrame(tick);
    };
    const tick = (timestamp: number) => {
      frameRequest = null;
      if (!active) {
        return;
      }

      const deltaTimeMs =
        lastTimestamp === null ? VIEWER_RUNTIME_FIXED_STEP_MS : timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      const playback = runtimePlaybackRef.current;
      if (playback === null || playback.model.enabledDynamicsGroupCount === 0) {
        return;
      }
      const previousState = runtimePlaybackFrameRef.current?.state ?? null;
      const compatiblePreviousState =
        previousState !== null &&
        isViewerRuntimePlaybackStateCompatible(playback.model, previousState)
          ? previousState
          : null;
      const result = evaluateViewerRuntimePlaybackFrame({
        authoredParameterValues: playback.authoredParameterValues,
        deltaTimeMs,
        frameIndex: (compatiblePreviousState?.frameIndex ?? 0) + 1,
        model: playback.model,
        ...(compatiblePreviousState === null ? {} : { previousState: compatiblePreviousState })
      });
      evaluatedFrameCount += 1;
      setRuntimePlaybackResultAndRef({
        authoredParameterValues: playback.authoredParameterValues,
        model: playback.model,
        result
      });

      if (
        !isViewerRuntimePlaybackStateSettled({
          authoredParameterValues: playback.authoredParameterValues,
          evaluatedFrameCount,
          model: playback.model,
          state: result.nextState
        })
      ) {
        scheduleNextFrame();
      }
    };
    scheduleNextFrame();

    return () => {
      active = false;
      if (frameRequest !== null) {
        cancelAnimationFrame(frameRequest);
      }
    };
  }, [
    runtimeParameterSignature,
    runtimePlaybackModel,
    runtimeSimulationResetToken,
    setRuntimePlaybackResultAndRef,
    setRuntimePlaybackStateAndRef
  ]);

  useEffect(() => {
    if (renderSourceMode !== cleanStage.renderSourceMode) {
      setRenderSourceMode(cleanStage.renderSourceMode);
    }
  }, [cleanStage.renderSourceMode, renderSourceMode]);

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-neutral-800 bg-[#111110]"
      data-testid="viewer-runtime-screen"
    >
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(18rem,1fr)_minmax(18rem,42%)] overflow-hidden xl:grid-cols-[minmax(0,1fr)_440px] xl:grid-rows-1">
        <ViewerCleanStageCanvas
          onBackToAuthoringWorkspace={() => returnToAuthoringWorkspace(setActiveEntry)}
          projection={cleanStage.projection}
        />
        <RuntimeControls
          excludedParameterIds={cleanStage.runtimePlaybackModel.dynamicsOutputParameterIds}
          hasDynamicsSimulation={cleanStage.runtimePlaybackModel.enabledDynamicsGroupCount > 0}
          onRenderSourceModeChange={setRenderSourceMode}
          onResetVariants={resetViewerVariants}
          onStateChange={setRuntimeControlsState}
          onVariantActiveSelectionChange={setViewerVariantActiveSelection}
          onResetSimulation={resetRuntimeSimulation}
          parameters={cleanStage.parameters}
          renderSourceMode={cleanStage.renderSourceMode}
          state={runtimeControlsState}
          variantActiveSelections={viewerVariantActiveSelections}
          variantGroups={variantGroups}
          {...(cleanStage.atlasRuntimeAvailability.status === "unavailable"
            ? { atlasRuntimeDisabledReason: cleanStage.atlasRuntimeAvailability.disabledReason }
            : {})}
        />
      </div>
    </section>
  );
}

export function createViewerRuntimeCleanStageProjection({
  atlasRuntimeSourceCache,
  authoringParameterValues,
  editorHiddenPartIds,
  runtimePlaybackModel,
  runtimePlaybackState,
  runtimeReusableParameterValues,
  runtimeControlsState,
  renderSourceMode = "original",
  variantVisibilityPredicate,
  session
}: {
  readonly authoringParameterValues: ParameterValueMap;
  readonly editorHiddenPartIds?: ReadonlySet<PartId>;
  readonly runtimeControlsState: ViewerRuntimeControlsState;
  readonly renderSourceMode?: ViewerRenderSourceMode;
  readonly runtimePlaybackModel?: ViewerRuntimePlaybackModel;
  readonly runtimePlaybackState?: RuntimeStateDto | null;
  readonly runtimeReusableParameterValues?: ViewerRuntimeReusableParameterValues | null;
  readonly session: AuthoringSession;
  readonly atlasRuntimeSourceCache?: ViewerAtlasRuntimeSourceCache;
  readonly variantVisibilityPredicate?: VariantVisibilityPredicate;
}): ViewerRuntimeCleanStageProjectionInput {
  const timingStart = startLive2dPerformanceTiming();
  try {
    const parameters = listEditorParameters(session);
    const playbackModel = runtimePlaybackModel ?? createViewerRuntimePlaybackModel(session);
    const runtimeParameterValues = createRuntimeParameterValueMap(
      parameters,
      runtimeControlsState,
      {
        excludedParameterIds: playbackModel.dynamicsOutputParameterIds
      }
    );
    const baseParameterValues = {
      ...authoringParameterValues,
      ...runtimeParameterValues
    };
    const parameterValues = resolveViewerRuntimeParameterValues({
      authoredParameterValues: baseParameterValues,
      model: playbackModel,
      reusableParameterValues: runtimeReusableParameterValues,
      ...(runtimePlaybackState === undefined || runtimePlaybackState === null
        ? {}
        : { state: runtimePlaybackState })
    });
    const originalProjection = createCanvasRenderProjection(session, null, {
      parameterValues,
      ...(editorHiddenPartIds === undefined ? {} : { editorHiddenPartIds }),
      ...(variantVisibilityPredicate === undefined ? {} : { variantVisibilityPredicate })
    });
    const renderSourceProjection = createViewerRenderSourceProjection({
      session,
      originalProjection,
      atlasRuntimeSourceCache,
      requestedMode: renderSourceMode
    });

    return {
      atlasRuntimeAvailability: renderSourceProjection.atlasRuntimeAvailability,
      baseParameterValues,
      parameterValues,
      parameters,
      renderSourceMode: renderSourceProjection.effectiveMode,
      requestedRenderSourceMode: renderSourceProjection.requestedMode,
      runtimePlaybackModel: playbackModel,
      projection: renderSourceProjection.projection
    };
  } finally {
    recordLive2dPerformanceTiming("viewer.cleanStageProjection.ms", timingStart);
  }
}

interface ViewerRuntimePlaybackLoopInput {
  readonly authoredParameterValues: ParameterValueMap;
  readonly model: ViewerRuntimePlaybackModel;
}

interface ViewerRuntimePlaybackScreenFrame {
  readonly reusableParameterValues?: ViewerRuntimeReusableParameterValues;
  readonly state: RuntimeStateDto;
}

export function returnToAuthoringWorkspace(
  setActiveEntry: (entry: WorkspaceEntryId) => void
): void {
  setActiveEntry("workspace");
}

function ViewerCleanStageCanvas({
  onBackToAuthoringWorkspace,
  projection
}: {
  readonly onBackToAuthoringWorkspace: () => void;
  readonly projection: CanvasRenderProjection;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const bitmapCacheRef = useRef(createCanvasBitmapCache());
  const autoFitPolicyStateRef = useRef(INITIAL_CANVAS_AUTO_FIT_POLICY_STATE);
  const pointerDragRef = useRef<ViewerStagePointerDrag | undefined>(undefined);
  const [viewport, setViewport] = useState<CanvasViewportSize>(DEFAULT_VIEWPORT);
  const [view, setView] = useState<CanvasViewState>(DEFAULT_VIEW);
  const [isPanning, setIsPanning] = useState(false);
  const visibleDrawableCount = useMemo(
    () => projection.drawables.filter((drawable) => drawable.visible).length,
    [projection]
  );
  const renderableDrawableCount = useMemo(
    () =>
      projection.drawables.filter((drawable) => drawable.visible && isRenderableDrawable(drawable))
        .length,
    [projection]
  );
  const firstDrawableBounds = projection.drawables[0]?.bounds;

  useEffect(() => {
    const frame = frameRef.current;
    if (frame === null || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) {
        return;
      }

      setViewport({
        height: Math.max(0, Math.round(entry.contentRect.height)),
        width: Math.max(0, Math.round(entry.contentRect.width))
      });
    });
    observer.observe(frame);

    return () => observer.disconnect();
  }, []);

  useEffect(() => () => disposeCanvasBitmapCache(bitmapCacheRef.current), []);

  useEffect(() => {
    const decision = resolveCanvasAutoFitPolicy({
      hasRenderableArtwork: projection.hasRenderableArtwork,
      state: autoFitPolicyStateRef.current,
      viewport
    });
    autoFitPolicyStateRef.current = decision.nextState;
    if (!decision.shouldFit) {
      return;
    }

    setView(fitArtworkView(projection, viewport));
  }, [projection, viewport]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    renderViewerCleanStageProjection({
      cache: bitmapCacheRef.current,
      canvas,
      projection,
      view
    });
  }, [projection, view, viewport]);

  const fitArtwork = useCallback(() => {
    setView(fitArtworkView(projection, viewport));
  }, [projection, viewport]);
  const fitCanvas = useCallback(() => {
    setView(fitCanvasView(projection, viewport));
  }, [projection, viewport]);
  const resetZoom = useCallback(() => {
    setView(resetOneToOneView(projection, viewport));
  }, [projection, viewport]);
  const zoomOut = useCallback(() => {
    setView((current) => nudgeZoomAtViewportCenter(current, viewport, 1 / 1.2));
  }, [viewport]);
  const zoomIn = useCallback(() => {
    setView((current) => nudgeZoomAtViewportCenter(current, viewport, 1.2));
  }, [viewport]);
  const onWheel = useCallback((event: ReactWheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const localPoint = toViewerStageLocalPoint(event.currentTarget, event.clientX, event.clientY);
    setView((current) =>
      zoomViewerStageViewAtPoint({
        deltaY: event.deltaY,
        localPoint,
        view: current
      })
    );
  }, []);
  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.focus();
    pointerDragRef.current = {
      lastPoint: toViewerStageLocalPoint(event.currentTarget, event.clientX, event.clientY),
      pointerId: event.pointerId
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);
  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = pointerDragRef.current;
    if (drag === undefined || drag.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const localPoint = toViewerStageLocalPoint(event.currentTarget, event.clientX, event.clientY);
    const delta = {
      x: localPoint.x - drag.lastPoint.x,
      y: localPoint.y - drag.lastPoint.y
    };
    pointerDragRef.current = {
      ...drag,
      lastPoint: localPoint
    };
    setView((current) => panViewerStageView(current, delta));
  }, []);
  const finishPointerDrag = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = pointerDragRef.current;
    if (drag === undefined || drag.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    pointerDragRef.current = undefined;
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return (
    <section
      className="flex min-h-0 flex-col overflow-hidden bg-[#111110]"
      data-testid="viewer-clean-stage"
    >
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-neutral-800 px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <IconButton
            className="size-8 shrink-0"
            label="Back to Authoring Workspace"
            onClick={onBackToAuthoringWorkspace}
            tooltipSide="bottom"
          >
            <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.8} />
          </IconButton>
          <div className="h-6 w-px shrink-0 bg-neutral-800" />
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase text-neutral-500">
              Clean Stage
            </div>
            <h2 className="truncate text-sm font-semibold text-neutral-100">
              Finished Model Preview
            </h2>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ViewerStageButton label="Fit artwork" onClick={fitArtwork}>
            <Focus aria-hidden="true" size={15} strokeWidth={1.8} />
          </ViewerStageButton>
          <ViewerStageButton label="Fit canvas" onClick={fitCanvas}>
            <Maximize2 aria-hidden="true" size={15} strokeWidth={1.8} />
          </ViewerStageButton>
          <ViewerStageButton label="1:1" onClick={resetZoom}>
            <Scan aria-hidden="true" size={15} strokeWidth={1.8} />
          </ViewerStageButton>
          <ViewerStageButton label="Zoom out" onClick={zoomOut}>
            <ZoomOut aria-hidden="true" size={15} strokeWidth={1.8} />
          </ViewerStageButton>
          <ViewerStageButton label="Zoom in" onClick={zoomIn}>
            <ZoomIn aria-hidden="true" size={15} strokeWidth={1.8} />
          </ViewerStageButton>
          <span
            className="ml-1 min-w-12 rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-center text-[11px] font-medium text-neutral-300"
            data-testid="viewer-stage-zoom-indicator"
          >
            {formatZoomPercent(view.zoom)}
          </span>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#6b7280]" ref={frameRef}>
        <canvas
          aria-label="Viewer clean stage"
          className={cn(
            "block size-full touch-none outline-none",
            isPanning ? "cursor-grabbing" : "cursor-grab"
          )}
          data-canvas-has-renderable-artwork={String(projection.hasRenderableArtwork)}
          data-deformer-overlay-visible={String(projection.deformerOverlay !== undefined)}
          data-first-drawable-bounds-x={firstDrawableBounds?.x ?? ""}
          data-first-drawable-bounds-y={firstDrawableBounds?.y ?? ""}
          data-mask-relation-count={projection.maskRelations.length}
          data-mesh-overlay-count={projection.meshOverlays?.length ?? 0}
          data-mesh-overlay-visible={String(projection.meshOverlay !== undefined)}
          data-pan-state={isPanning ? "panning" : "idle"}
          data-view-pan-x={view.pan.x}
          data-view-pan-y={view.pan.y}
          data-renderable-drawable-count={renderableDrawableCount}
          data-selected-drawable-count={projection.selectedDrawableIds.size}
          data-testid="viewer-clean-stage-canvas"
          data-visible-drawable-count={visibleDrawableCount}
          data-zoom-percent={formatZoomPercent(view.zoom)}
          onPointerCancel={finishPointerDrag}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishPointerDrag}
          onWheel={onWheel}
          ref={canvasRef}
          tabIndex={0}
        />
        {projection.hasRenderableArtwork ? null : (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="rounded border border-neutral-800 bg-neutral-950/88 px-3 py-2 text-xs font-medium text-neutral-300"
              data-testid="viewer-clean-stage-empty-state"
            >
              No renderable artwork
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

interface ViewerStagePointerDrag {
  readonly lastPoint: CanvasPoint;
  readonly pointerId: number;
}

export function zoomViewerStageViewAtPoint({
  deltaY,
  localPoint,
  view
}: {
  readonly deltaY: number;
  readonly localPoint: CanvasPoint;
  readonly view: CanvasViewState;
}): CanvasViewState {
  const factor = Math.exp(-deltaY * 0.001);

  return zoomViewAtScreenPoint(view, localPoint, view.zoom * factor);
}

export function panViewerStageView(
  view: CanvasViewState,
  delta: CanvasPoint
): CanvasViewState {
  return {
    ...view,
    pan: {
      x: view.pan.x + delta.x,
      y: view.pan.y + delta.y
    }
  };
}

function ViewerStageButton({
  children,
  label,
  onClick
}: {
  readonly children: ReactNode;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <IconButton
      className={cn("size-7")}
      label={label}
      onClick={onClick}
      tooltipSide="bottom"
    >
      {children}
    </IconButton>
  );
}

function toViewerStageLocalPoint(
  element: HTMLElement,
  clientX: number,
  clientY: number
): CanvasPoint {
  const rect = element.getBoundingClientRect();

  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}
