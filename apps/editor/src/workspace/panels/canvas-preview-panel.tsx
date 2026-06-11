import {
  CircleOff,
  Focus,
  Grid3x3,
  Maximize2,
  MousePointer2,
  Move,
  Scan,
  SquareDashed,
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
import { cn } from "../../lib/class-name";
import { IconButton } from "../../ui/icon-button";
import {
  createCanvasRenderProjection,
  canvasToScreenPoint,
  fitArtworkView,
  fitCanvasView,
  formatZoomPercent,
  hasIsolatableCanvasSelection,
  hitTestTopmostDrawable,
  isRenderableDrawable,
  nudgeZoomAtViewportCenter,
  resetOneToOneView,
  screenToCanvasPoint,
  zoomViewAtScreenPoint,
  type CanvasPoint,
  type CanvasViewState,
  type CanvasViewportSize
} from "../canvas/canvas-projection";
import {
  createCanvasBitmapCache,
  renderCanvasProjection,
  type CanvasOverlayState
} from "../canvas/canvas-renderer";
import { WorkspacePanel } from "./panel-frame";

type PointerDragState =
  | {
      readonly mode: "select";
      readonly pointerId: number;
      readonly start: CanvasPoint;
      readonly last: CanvasPoint;
      readonly moved: boolean;
    }
  | {
      readonly mode: "pan";
      readonly pointerId: number;
      readonly last: CanvasPoint;
    };

const DEFAULT_VIEW: CanvasViewState = {
  zoom: 1,
  pan: { x: 0, y: 0 }
};

const DEFAULT_VIEWPORT: CanvasViewportSize = {
  width: 0,
  height: 0
};

const POINTER_CLICK_SLOP = 4;

export function CanvasPreviewPanel() {
  const { editorHiddenPartIds, selectDrawable, selection, session } = useEditorSession();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const bitmapCacheRef = useRef(createCanvasBitmapCache());
  const lastAutoFitKeyRef = useRef<string | undefined>(undefined);
  const pointerDragRef = useRef<PointerDragState | undefined>(undefined);
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);
  const spacePressedRef = useRef(false);
  const [viewport, setViewport] = useState<CanvasViewportSize>(DEFAULT_VIEWPORT);
  const [view, setView] = useState<CanvasViewState>(DEFAULT_VIEW);
  const [spacePressed, setSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [overlays, setOverlays] = useState<CanvasOverlayState>({
    grid: true,
    canvasBounds: true,
    selectionBounds: true,
    isolateSelected: false
  });
  const projection = useMemo(
    () => createCanvasRenderProjection(session, selection, { editorHiddenPartIds }),
    [editorHiddenPartIds, selection, session]
  );
  const selectedDrawableCount = projection.selectedDrawableIds.size;
  const selectedDrawableOpacity = useMemo(
    () => projection.drawables.find((drawable) => drawable.selected)?.opacity,
    [projection]
  );
  const canIsolateSelection = useMemo(
    () => hasIsolatableCanvasSelection(projection),
    [projection]
  );
  const isolateSelectedActive = overlays.isolateSelected && canIsolateSelection;
  const renderableDrawableCount = useMemo(
    () =>
      projection.drawables.filter((drawable) => drawable.visible && isRenderableDrawable(drawable))
        .length,
    [projection]
  );
  const primaryHitScreenPoint = useMemo(() => {
    const candidate = [...projection.drawables]
      .reverse()
      .find((drawable) => drawable.visible && isRenderableDrawable(drawable));
    if (candidate === undefined) {
      return undefined;
    }

    return canvasToScreenPoint(
      {
        x: candidate.bounds.x + candidate.bounds.width / 2,
        y: candidate.bounds.y + candidate.bounds.height / 2
      },
      view
    );
  }, [projection, view]);

  useEffect(() => {
    const frame = frameRef.current;
    if (frame === null || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) {
        return;
      }

      const rect = entry.contentRect;
      setViewport({
        width: Math.max(0, Math.round(rect.width)),
        height: Math.max(0, Math.round(rect.height))
      });
    });
    observer.observe(frame);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    bitmapCacheRef.current.layerCanvases.clear();
  }, [projection.contentKey]);

  useEffect(() => {
    if (viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    if (lastAutoFitKeyRef.current === projection.contentKey) {
      return;
    }

    lastAutoFitKeyRef.current = projection.contentKey;
    setView(fitArtworkView(projection, viewport));
  }, [projection, viewport]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    renderCanvasProjection({
      canvas,
      projection,
      view,
      overlays,
      cache: bitmapCacheRef.current
    });
  }, [overlays, projection, view, viewport]);

  useEffect(() => {
    const setSpaceActive = (active: boolean) => {
      spacePressedRef.current = active;
      setSpacePressed(active);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || isEditableTarget(event.target)) {
        return;
      }

      if (!hoveredRef.current && !focusedRef.current) {
        return;
      }

      event.preventDefault();
      setSpaceActive(true);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") {
        return;
      }

      setSpaceActive(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const fitArtwork = useCallback(() => {
    setView(fitArtworkView(projection, viewport));
  }, [projection, viewport]);

  const fitCanvas = useCallback(() => {
    setView(fitCanvasView(projection, viewport));
  }, [projection, viewport]);

  const resetZoom = useCallback(() => {
    setView(resetOneToOneView(projection, viewport));
  }, [projection, viewport]);

  const zoomIn = useCallback(() => {
    setView((current) => nudgeZoomAtViewportCenter(current, viewport, 1.2));
  }, [viewport]);

  const zoomOut = useCallback(() => {
    setView((current) => nudgeZoomAtViewportCenter(current, viewport, 1 / 1.2));
  }, [viewport]);

  const toggleOverlay = useCallback((key: keyof CanvasOverlayState) => {
    setOverlays((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  const onWheel = useCallback((event: ReactWheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const localPoint = toLocalPoint(event.currentTarget, event.clientX, event.clientY);
    const factor = Math.exp(-event.deltaY * 0.001);
    setView((current) => zoomViewAtScreenPoint(current, localPoint, current.zoom * factor));
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.focus();
    const localPoint = toLocalPoint(event.currentTarget, event.clientX, event.clientY);
    const startsPan = event.button === 1 || (event.button === 0 && spacePressedRef.current);

    if (startsPan) {
      event.preventDefault();
      pointerDragRef.current = {
        mode: "pan",
        pointerId: event.pointerId,
        last: localPoint
      };
      setIsPanning(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (event.button !== 0) {
      return;
    }

    pointerDragRef.current = {
      mode: "select",
      pointerId: event.pointerId,
      start: localPoint,
      last: localPoint,
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = pointerDragRef.current;
    if (drag === undefined || drag.pointerId !== event.pointerId) {
      return;
    }

    const localPoint = toLocalPoint(event.currentTarget, event.clientX, event.clientY);

    if (drag.mode === "pan") {
      const delta = {
        x: localPoint.x - drag.last.x,
        y: localPoint.y - drag.last.y
      };
      pointerDragRef.current = {
        ...drag,
        last: localPoint
      };
      setView((current) => ({
        ...current,
        pan: {
          x: current.pan.x + delta.x,
          y: current.pan.y + delta.y
        }
      }));
      return;
    }

    pointerDragRef.current = {
      ...drag,
      last: localPoint,
      moved:
        drag.moved ||
        Math.abs(localPoint.x - drag.start.x) > POINTER_CLICK_SLOP ||
        Math.abs(localPoint.y - drag.start.y) > POINTER_CLICK_SLOP
    };
  }, []);

  const finishPointerDrag = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = pointerDragRef.current;
    if (drag === undefined || drag.pointerId !== event.pointerId) {
      return;
    }

    pointerDragRef.current = undefined;
    setIsPanning(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (drag.mode !== "select" || drag.moved) {
      return;
    }

    const canvasPoint = screenToCanvasPoint(drag.last, view);
    const hitDrawableId = hitTestTopmostDrawable(projection, canvasPoint);
    if (hitDrawableId !== undefined) {
      selectDrawable(hitDrawableId);
    }
  }, [projection, selectDrawable, view]);

  const toolbar = (
    <>
      <div className="flex items-center gap-1">
        <ToolbarButton label="Fit Artwork" onClick={fitArtwork}>
          <Focus aria-hidden="true" size={15} strokeWidth={1.8} />
        </ToolbarButton>
        <ToolbarButton label="Fit Canvas" onClick={fitCanvas}>
          <Maximize2 aria-hidden="true" size={15} strokeWidth={1.8} />
        </ToolbarButton>
        <ToolbarButton label="1:1" onClick={resetZoom}>
          <Scan aria-hidden="true" size={15} strokeWidth={1.8} />
        </ToolbarButton>
        <ToolbarButton label="Zoom out" onClick={zoomOut}>
          <ZoomOut aria-hidden="true" size={15} strokeWidth={1.8} />
        </ToolbarButton>
        <ToolbarButton label="Zoom in" onClick={zoomIn}>
          <ZoomIn aria-hidden="true" size={15} strokeWidth={1.8} />
        </ToolbarButton>
        <span
          className="ml-1 min-w-12 rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-center text-[11px] font-medium text-neutral-300"
          data-testid="canvas-zoom-indicator"
        >
          {formatZoomPercent(view.zoom)}
        </span>
      </div>
      <div className="h-6 w-px bg-neutral-800" />
      <div className="flex items-center gap-1" data-testid="canvas-toolbar">
        <ToolbarButton
          label="Grid"
          onClick={() => toggleOverlay("grid")}
          pressed={overlays.grid}
        >
          <Grid3x3 aria-hidden="true" size={15} strokeWidth={1.8} />
        </ToolbarButton>
        <ToolbarButton
          label="Canvas bounds"
          onClick={() => toggleOverlay("canvasBounds")}
          pressed={overlays.canvasBounds}
        >
          <SquareDashed aria-hidden="true" size={15} strokeWidth={1.8} />
        </ToolbarButton>
        <ToolbarButton
          label="Selection bounds"
          onClick={() => toggleOverlay("selectionBounds")}
          pressed={overlays.selectionBounds}
        >
          <MousePointer2 aria-hidden="true" size={15} strokeWidth={1.8} />
        </ToolbarButton>
        <ToolbarButton
          disabled={!canIsolateSelection}
          label="Isolate Selected"
          onClick={() => toggleOverlay("isolateSelected")}
          pressed={isolateSelectedActive}
        >
          <CircleOff aria-hidden="true" size={15} strokeWidth={1.8} />
        </ToolbarButton>
      </div>
    </>
  );

  return (
    <WorkspacePanel
      actions={toolbar}
      className="h-full bg-[#141516]"
      overline="Stage"
      title="Canvas / Preview"
    >
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        data-testid="canvas-preview-panel"
      >
        <div
          className="relative min-h-0 flex-1 overflow-hidden bg-[#101110]"
          ref={frameRef}
        >
          <canvas
            aria-label="Canvas preview"
            className={cn(
              "block size-full touch-none outline-none",
              isPanning ? "cursor-grabbing" : spacePressed ? "cursor-grab" : "cursor-crosshair"
            )}
            data-canvas-has-renderable-artwork={String(projection.hasRenderableArtwork)}
            data-mask-relation-count={projection.maskRelations.length}
            data-primary-hit-screen-x={primaryHitScreenPoint?.x ?? ""}
            data-primary-hit-screen-y={primaryHitScreenPoint?.y ?? ""}
            data-renderable-drawable-count={renderableDrawableCount}
            data-selected-drawable-count={selectedDrawableCount}
            data-selected-drawable-opacity={selectedDrawableOpacity?.toFixed(2) ?? ""}
            data-testid="canvas-renderer-surface"
            data-zoom-percent={formatZoomPercent(view.zoom)}
            onBlur={() => {
              focusedRef.current = false;
            }}
            onFocus={() => {
              focusedRef.current = true;
            }}
            onPointerCancel={finishPointerDrag}
            onPointerDown={onPointerDown}
            onPointerEnter={() => {
              hoveredRef.current = true;
            }}
            onPointerLeave={() => {
              hoveredRef.current = false;
            }}
            onPointerMove={onPointerMove}
            onPointerUp={finishPointerDrag}
            onWheel={onWheel}
            ref={canvasRef}
            tabIndex={0}
          />
          {projection.hasRenderableArtwork ? null : (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950/88 px-3 py-2 text-xs font-medium text-neutral-300">
                <Move aria-hidden="true" size={15} strokeWidth={1.8} />
                <span>No renderable artwork</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </WorkspacePanel>
  );
}

function ToolbarButton({
  children,
  disabled,
  label,
  onClick,
  pressed
}: {
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onClick: () => void;
  readonly pressed?: boolean;
}) {
  return (
    <IconButton
      className="size-7 disabled:cursor-not-allowed disabled:border-neutral-900 disabled:bg-neutral-950 disabled:text-neutral-700"
      label={label}
      onClick={onClick}
      tooltipSide="bottom"
      {...(disabled === undefined ? {} : { disabled })}
      {...(pressed === undefined ? {} : { pressed })}
    >
      {children}
    </IconButton>
  );
}

function toLocalPoint(element: HTMLElement, clientX: number, clientY: number): CanvasPoint {
  const rect = element.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}
