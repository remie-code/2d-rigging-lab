import {
  CircleOff,
  Focus,
  Grid3x3,
  Maximize2,
  MousePointer2,
  Move,
  Scan,
  Spline,
  SquareDashed,
  Triangle,
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
import { useEditorUiStore } from "../../state/editor-ui-store";
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
  const {
    editorHiddenPartIds,
    meshDraft,
    parameterValues,
    rigDraft,
    selectDrawable,
    selection,
    session
  } = useEditorSession();
  const activeTool = useEditorUiStore((state) => state.activeTool);
  const meshOverlayVisible = useEditorUiStore((state) => state.meshOverlayVisible);
  const deformerOverlayVisible = useEditorUiStore((state) => state.deformerOverlayVisible);
  const setDeformerOverlayVisible = useEditorUiStore((state) => state.setDeformerOverlayVisible);
  const setMeshOverlayVisible = useEditorUiStore((state) => state.setMeshOverlayVisible);
  const toggleDeformerOverlayVisible = useEditorUiStore((state) => state.toggleDeformerOverlayVisible);
  const toggleMeshOverlayVisible = useEditorUiStore((state) => state.toggleMeshOverlayVisible);
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
  const [overlays, setOverlays] = useState<Omit<CanvasOverlayState, "mesh" | "deformer">>({
    grid: true,
    canvasBounds: true,
    selectionBounds: true,
    isolateSelected: false
  });
  const renderOverlays = useMemo<CanvasOverlayState>(
    () => ({
      ...overlays,
      mesh: meshOverlayVisible,
      deformer: deformerOverlayVisible
    }),
    [deformerOverlayVisible, meshOverlayVisible, overlays]
  );
  const projection = useMemo(
    () =>
      createCanvasRenderProjection(session, selection, {
        editorHiddenPartIds,
        meshDraft,
        deformerDraft: rigDraft,
        parameterValues,
        ...(activeTool === "mesh" && selection?.kind === "drawable"
          ? { meshPreviewDrawableId: selection.id }
          : {})
      }),
    [activeTool, editorHiddenPartIds, meshDraft, parameterValues, rigDraft, selection, session]
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
  const meshOverlayActive = meshOverlayVisible && projection.meshOverlay !== undefined;
  const deformerOverlayActive = deformerOverlayVisible && projection.deformerOverlay !== undefined;
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
      overlays: renderOverlays,
      cache: bitmapCacheRef.current
    });
  }, [projection, renderOverlays, view, viewport]);

  useEffect(() => {
    if (activeTool === "mesh") {
      setMeshOverlayVisible(true);
    }
  }, [activeTool, setMeshOverlayVisible]);

  useEffect(() => {
    if (activeTool === "rig") {
      setDeformerOverlayVisible(true);
    }
  }, [activeTool, setDeformerOverlayVisible]);

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

  const toggleOverlay = useCallback((key: keyof Omit<CanvasOverlayState, "mesh" | "deformer">) => {
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
        <ToolbarButton
          disabled={projection.selectedDrawableIds.size !== 1}
          label="Mesh overlay"
          onClick={toggleMeshOverlayVisible}
          pressed={meshOverlayActive}
        >
          <Triangle aria-hidden="true" size={15} strokeWidth={1.8} />
        </ToolbarButton>
        <ToolbarButton
          disabled={projection.deformerOverlay === undefined}
          label="Deformer overlay"
          onClick={toggleDeformerOverlayVisible}
          pressed={deformerOverlayActive}
        >
          <Spline aria-hidden="true" size={15} strokeWidth={1.8} />
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
            data-mesh-overlay-status={meshOverlayActive ? projection.meshOverlay?.status ?? "" : ""}
            data-mesh-overlay-triangle-count={
              meshOverlayActive ? String(projection.meshOverlay?.mesh.triangles.length ?? 0) : "0"
            }
            data-mesh-overlay-vertex-count={
              meshOverlayActive ? String(projection.meshOverlay?.mesh.vertices.length ?? 0) : "0"
            }
            data-mesh-overlay-visible={String(meshOverlayActive)}
            data-mesh-preview-drawable-visible={String(
              projection.drawables.some((drawable) => drawable.meshPreview && drawable.visible)
            )}
            data-deformer-overlay-bezier-columns={
              deformerOverlayActive ? String(projection.deformerOverlay?.bezierColumns ?? 0) : "0"
            }
            data-deformer-overlay-bezier-rows={
              deformerOverlayActive ? String(projection.deformerOverlay?.bezierRows ?? 0) : "0"
            }
            data-deformer-overlay-child-drawable-count={
              deformerOverlayActive
                ? String(projection.deformerOverlay?.childDrawableIds.length ?? 0)
                : "0"
            }
            data-deformer-overlay-kind={
              deformerOverlayActive ? projection.deformerOverlay?.kind ?? "" : ""
            }
            data-deformer-overlay-pivot-x={
              deformerOverlayActive ? String(projection.deformerOverlay?.pivot?.x ?? "") : ""
            }
            data-deformer-overlay-pivot-y={
              deformerOverlayActive ? String(projection.deformerOverlay?.pivot?.y ?? "") : ""
            }
            data-deformer-overlay-rest-angle={
              deformerOverlayActive
                ? String(projection.deformerOverlay?.restAngleDegrees ?? "")
                : ""
            }
            data-deformer-overlay-evaluated-angle={
              deformerOverlayActive
                ? String(projection.deformerOverlay?.evaluatedAngleDegrees ?? "")
                : ""
            }
            data-deformer-overlay-control-point-offset-count={
              deformerOverlayActive
                ? String(projection.deformerOverlay?.controlPointOffsets?.length ?? 0)
                : "0"
            }
            data-deformer-overlay-status={
              deformerOverlayActive ? projection.deformerOverlay?.status ?? "" : ""
            }
            data-deformer-overlay-transform-columns={
              deformerOverlayActive ? String(projection.deformerOverlay?.transformColumns ?? 0) : "0"
            }
            data-deformer-overlay-transform-rows={
              deformerOverlayActive ? String(projection.deformerOverlay?.transformRows ?? 0) : "0"
            }
            data-deformer-overlay-visible={String(deformerOverlayActive)}
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
