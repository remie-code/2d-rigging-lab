import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { ParameterId, RectDto, RigControlId } from "@private-2d-rigging-lab/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { EditorSessionCommandResult } from "../../features/editor-session/model/editor-session-commands";
import {
  createEditorSessionGestureCommitController,
  type EditorSessionGestureCommitController
} from "../../features/editor-session/model/editor-session-gesture-commit";
import {
  createParameterBindingProjection,
  createRigControlParameterBindings,
  type ParameterBindingProjection,
  type ParameterKeyformBindingDescriptor,
  type ParameterValueMap
} from "../../features/editor-session/model/parameter-keyform-state";
import type { CanvasEvaluationControlPointPreview } from "./canvas-evaluation";
import type {
  CanvasDeformerOverlayProjection,
  CanvasPoint,
  CanvasRenderProjection,
  CanvasViewState
} from "./canvas-projection";
import { canvasToScreenPoint, screenToCanvasPoint } from "./canvas-projection";
import type { CanvasWarpDeformerInteractionState } from "./canvas-renderer";
import {
  applyWarpControlPointDragDelta,
  areWarpControlPointOffsetsEqual,
  createWarpControlPointSelection,
  getWarpControlPointCount,
  hitTestWarpControlPoint,
  isWarpControlPointSelectionScoped,
  listWarpControlPointPositions,
  normalizeScreenRect,
  normalizeWarpControlPointOffsets,
  resolveWarpPointDragSelection,
  selectWarpControlPointsInMarquee,
  type WarpControlPointSelectionState
} from "./warp-deformer-control-points";
import {
  canCommitWarpControlPointOffsetUpdate,
  createWarpControlPointOffsetUpdateGesture
} from "./warp-deformer-control-point-gesture";
import {
  computeWarpDeformerScaledControlPointOffsets,
  type WarpDeformerScaleHandle
} from "./warp-deformer-scale";

const POINTER_CLICK_SLOP = 4;
const WARP_SCALE_HANDLE_HIT_TOLERANCE_PX = 12;
const WARP_SCALE_HANDLE_OUTER_OFFSET_PX = 10;
const MIN_WARP_SCALE_HANDLE_ZOOM = 1e-6;

type CommitGestureController = <
  Preview,
  Result extends EditorSessionCommandResult = EditorSessionCommandResult
>(
  controller: EditorSessionGestureCommitController<Preview, Result>
) => Result | null;

type WarpControlPointDragState =
  | {
      readonly mode: "point-drag";
      readonly pointerId: number;
      readonly rigControlId: RigControlId;
      readonly pointCount: number;
      readonly startScreen: CanvasPoint;
      readonly lastScreen: CanvasPoint;
      readonly startCanvas: CanvasPoint;
      readonly selectedIndices: readonly number[];
      readonly baseOffsets: readonly CanvasPoint[];
      readonly nextOffsetsRef: { current: readonly CanvasPoint[] };
      readonly controller?: EditorSessionGestureCommitController<readonly CanvasPoint[]> | undefined;
      readonly editable: boolean;
      readonly moved: boolean;
    }
  | {
      readonly mode: "scale-drag";
      readonly pointerId: number;
      readonly rigControlId: RigControlId;
      readonly startScreen: CanvasPoint;
      readonly lastScreen: CanvasPoint;
      readonly startCanvas: CanvasPoint;
      readonly handle: WarpDeformerScaleHandle;
      readonly latticeColumns: number;
      readonly latticeRows: number;
      readonly restControlPoints: readonly CanvasPoint[];
      readonly baseOffsets: readonly CanvasPoint[];
      readonly nextOffsetsRef: { current: readonly CanvasPoint[] };
      readonly controller: EditorSessionGestureCommitController<readonly CanvasPoint[]>;
      readonly moved: boolean;
    }
  | {
      readonly mode: "marquee";
      readonly pointerId: number;
      readonly rigControlId: RigControlId;
      readonly pointCount: number;
      readonly startScreen: CanvasPoint;
      readonly lastScreen: CanvasPoint;
      readonly moved: boolean;
    };

interface WarpControlPointPreviewState {
  readonly rigControlId: RigControlId;
  readonly offsets: readonly CanvasPoint[];
}

interface WarpControlPointEditState {
  readonly rigControlId: RigControlId;
  readonly pointCount: number;
  readonly binding: ParameterKeyformBindingDescriptor;
  readonly bindingProjection: ParameterBindingProjection;
  readonly currentOffsets: readonly CanvasPoint[];
  readonly latticeColumns: number;
  readonly latticeRows: number;
  readonly restControlPoints: readonly CanvasPoint[];
  readonly scaleHandleAvailable: boolean;
}

export interface UseWarpDeformerControlPointInteractionInput {
  readonly activeParameterId: ParameterId | null;
  readonly commitGestureController: CommitGestureController;
  readonly enabled: boolean;
  readonly parameterValues: ParameterValueMap;
  readonly projection: CanvasRenderProjection;
  readonly createPreviewProjection?: (
    preview: CanvasEvaluationControlPointPreview | null
  ) => CanvasRenderProjection;
  readonly session: AuthoringSession;
  readonly view: CanvasViewState;
}

export interface WarpDeformerControlPointInteraction {
  readonly activeRigControlId?: RigControlId;
  readonly editable: boolean;
  readonly hoveredControlPointIndex?: number;
  readonly hoveredScaleHandle?: WarpDeformerScaleHandle;
  readonly marqueeRect: RectDto | null;
  readonly previewActive: boolean;
  readonly renderProjection: CanvasRenderProjection;
  readonly rendererState?: CanvasWarpDeformerInteractionState;
  readonly scaleHandlesVisible: boolean;
  readonly selectedControlPointIndices: readonly number[];
  readonly clearHover: () => void;
  readonly finishPointerDrag: (input: {
    readonly pointerId: number;
    readonly commit: boolean;
  }) => boolean;
  readonly handlePointerDown: (input: {
    readonly pointerId: number;
    readonly screenPoint: CanvasPoint;
  }) => boolean;
  readonly handlePointerMove: (input: {
    readonly pointerId: number;
    readonly screenPoint: CanvasPoint;
  }) => boolean;
}

export function useWarpDeformerControlPointInteraction(
  input: UseWarpDeformerControlPointInteractionInput
): WarpDeformerControlPointInteraction {
  const dragRef = useRef<WarpControlPointDragState | undefined>(undefined);
  const [selection, setSelection] = useState<WarpControlPointSelectionState | null>(null);
  const [preview, setPreview] = useState<WarpControlPointPreviewState | null>(null);
  const [hoveredControlPointIndex, setHoveredControlPointIndex] =
    useState<number | undefined>(undefined);
  const [hoveredScaleHandle, setHoveredScaleHandle] =
    useState<WarpDeformerScaleHandle | undefined>(undefined);
  const [marqueeRect, setMarqueeRect] = useState<RectDto | null>(null);
  const renderProjection = useMemo(() => {
    if (preview === null) {
      return input.projection;
    }

    return input.createPreviewProjection?.({
      rigControlId: preview.rigControlId,
      controlPointOffsets: preview.offsets,
      compositionMode: "replaceEvaluated"
    }) ?? applyWarpControlPointPreview(input.projection, preview);
  }, [input.createPreviewProjection, input.projection, preview]);
  const editState = useMemo(
    () =>
      createWarpControlPointEditState({
        activeParameterId: input.activeParameterId,
        parameterValues: input.parameterValues,
        projection: input.projection,
        session: input.session
      }),
    [input.activeParameterId, input.parameterValues, input.projection, input.session]
  );
  const activePointCount = getWarpControlPointCount(renderProjection.deformerOverlay);
  const activeRigControlId =
    renderProjection.deformerOverlay?.kind === "warp" &&
    renderProjection.deformerOverlay.status === "committed"
      ? renderProjection.deformerOverlay.rigControlId
      : undefined;
  const selectedControlPointIndices = isWarpControlPointSelectionScoped(
    selection,
    activeRigControlId,
    activePointCount
  )
    ? selection.indices
    : [];
  const editable =
    editState !== null && canCommitWarpControlPointOffsetUpdate(editState.bindingProjection);
  const scaleHandlesVisible = editable && editState?.scaleHandleAvailable === true;

  useEffect(() => {
    setSelection((current) =>
      isWarpControlPointSelectionScoped(current, activeRigControlId, activePointCount)
        ? current
        : null
    );
    setPreview((current) =>
      current !== null && current.rigControlId === activeRigControlId ? current : null
    );
    setHoveredControlPointIndex(undefined);
    setHoveredScaleHandle(undefined);
    setMarqueeRect(null);
    dragRef.current = undefined;
  }, [activePointCount, activeRigControlId]);

  const clearHover = useCallback(() => {
    setHoveredControlPointIndex(undefined);
    setHoveredScaleHandle(undefined);
  }, []);

  const handlePointerDown = useCallback(
    (eventInput: { readonly pointerId: number; readonly screenPoint: CanvasPoint }): boolean => {
      const overlay = getActiveWarpOverlay(input.enabled, renderProjection.deformerOverlay);
      if (overlay === undefined || overlay.rigControlId === undefined) {
        return false;
      }

      const scaleHit =
        scaleHandlesVisible && editState !== null
          ? hitTestWarpScaleHandle({
              overlay,
              view: input.view,
              screenPoint: eventInput.screenPoint
            })
          : undefined;
      if (
        scaleHit !== undefined &&
        editState !== null &&
        canCommitWarpControlPointOffsetUpdate(editState.bindingProjection)
      ) {
        const nextOffsetsRef = {
          current: editState.currentOffsets
        };
        const controller = createEditorSessionGestureCommitController(
          createWarpControlPointOffsetUpdateGesture({
            binding: editState.binding,
            currentParameterValue: editState.bindingProjection.currentParameterValue,
            getNextOffsets: () => nextOffsetsRef.current,
            parameter: editState.bindingProjection.parameter
          })
        );

        setHoveredScaleHandle(scaleHit.handle);
        setHoveredControlPointIndex(undefined);
        setMarqueeRect(null);
        dragRef.current = {
          mode: "scale-drag",
          pointerId: eventInput.pointerId,
          rigControlId: overlay.rigControlId,
          startScreen: eventInput.screenPoint,
          lastScreen: eventInput.screenPoint,
          startCanvas: screenToCanvasPoint(eventInput.screenPoint, input.view),
          handle: scaleHit.handle,
          latticeColumns: editState.latticeColumns,
          latticeRows: editState.latticeRows,
          restControlPoints: editState.restControlPoints,
          baseOffsets: editState.currentOffsets,
          nextOffsetsRef,
          controller,
          moved: false
        };
        return true;
      }

      const hit = hitTestWarpControlPoint({
        overlay,
        view: input.view,
        screenPoint: eventInput.screenPoint
      });

      if (hit !== undefined && editState !== null) {
        const selectedIndices = resolveWarpPointDragSelection({
          currentSelection: selection,
          rigControlId: overlay.rigControlId,
          pointCount: editState.pointCount,
          hitIndex: hit.index
        });
        setSelection(
          createWarpControlPointSelection({
            rigControlId: overlay.rigControlId,
            pointCount: editState.pointCount,
            indices: selectedIndices
          })
        );

        const nextOffsetsRef = {
          current: editState.currentOffsets
        };
        const controller = canCommitWarpControlPointOffsetUpdate(editState.bindingProjection)
          ? createEditorSessionGestureCommitController(
              createWarpControlPointOffsetUpdateGesture({
                binding: editState.binding,
                currentParameterValue: editState.bindingProjection.currentParameterValue,
                getNextOffsets: () => nextOffsetsRef.current,
                parameter: editState.bindingProjection.parameter
              })
            )
          : undefined;

        dragRef.current = {
          mode: "point-drag",
          pointerId: eventInput.pointerId,
          rigControlId: overlay.rigControlId,
          pointCount: editState.pointCount,
          startScreen: eventInput.screenPoint,
          lastScreen: eventInput.screenPoint,
          startCanvas: screenToCanvasPoint(eventInput.screenPoint, input.view),
          selectedIndices,
          baseOffsets: editState.currentOffsets,
          nextOffsetsRef,
          ...(controller === undefined ? {} : { controller }),
          editable: controller !== undefined,
          moved: false
        };
        return true;
      }

      dragRef.current = {
        mode: "marquee",
        pointerId: eventInput.pointerId,
        rigControlId: overlay.rigControlId,
        pointCount: getWarpControlPointCount(overlay),
        startScreen: eventInput.screenPoint,
        lastScreen: eventInput.screenPoint,
        moved: false
      };
      setMarqueeRect(normalizeScreenRect(eventInput.screenPoint, eventInput.screenPoint));
      return true;
    },
    [
      editState,
      input.enabled,
      input.view,
      renderProjection.deformerOverlay,
      scaleHandlesVisible,
      selection
    ]
  );

  const handlePointerMove = useCallback(
    (eventInput: { readonly pointerId: number; readonly screenPoint: CanvasPoint }): boolean => {
      const drag = dragRef.current;
      if (drag === undefined) {
        const overlay = getActiveWarpOverlay(input.enabled, renderProjection.deformerOverlay);
        if (overlay === undefined) {
          setHoveredControlPointIndex(undefined);
          setHoveredScaleHandle(undefined);
          return false;
        }

        const scaleHit = scaleHandlesVisible
          ? hitTestWarpScaleHandle({
              overlay,
              view: input.view,
              screenPoint: eventInput.screenPoint
            })
          : undefined;
        if (scaleHit !== undefined) {
          setHoveredScaleHandle(scaleHit.handle);
          setHoveredControlPointIndex(undefined);
          return false;
        }

        const hit = hitTestWarpControlPoint({
          overlay,
          view: input.view,
          screenPoint: eventInput.screenPoint
        });
        setHoveredScaleHandle(undefined);
        setHoveredControlPointIndex(hit?.index);
        return false;
      }

      if (drag.pointerId !== eventInput.pointerId) {
        return false;
      }

      if (drag.mode === "point-drag") {
        const moved =
          drag.moved ||
          Math.abs(eventInput.screenPoint.x - drag.startScreen.x) > POINTER_CLICK_SLOP ||
          Math.abs(eventInput.screenPoint.y - drag.startScreen.y) > POINTER_CLICK_SLOP;

        if (drag.editable && drag.controller !== undefined) {
          const currentCanvas = screenToCanvasPoint(eventInput.screenPoint, input.view);
          drag.nextOffsetsRef.current = applyWarpControlPointDragDelta({
            baseOffsets: drag.baseOffsets,
            pointCount: drag.pointCount,
            selectedIndices: drag.selectedIndices,
            deltaCanvas: {
              x: currentCanvas.x - drag.startCanvas.x,
              y: currentCanvas.y - drag.startCanvas.y
            }
          });
          setPreview({
            rigControlId: drag.rigControlId,
            offsets: drag.controller.preview({ currentSession: input.session })
          });
        }

        dragRef.current = {
          ...drag,
          lastScreen: eventInput.screenPoint,
          moved
        };
        return true;
      }

      if (drag.mode === "scale-drag") {
        const moved =
          drag.moved ||
          Math.abs(eventInput.screenPoint.x - drag.startScreen.x) > POINTER_CLICK_SLOP ||
          Math.abs(eventInput.screenPoint.y - drag.startScreen.y) > POINTER_CLICK_SLOP;

        const currentCanvas = screenToCanvasPoint(eventInput.screenPoint, input.view);
        const scaleResult = computeWarpDeformerScaledControlPointOffsets({
          restControlPoints: drag.restControlPoints,
          controlPointOffsets: drag.baseOffsets,
          latticeColumns: drag.latticeColumns,
          latticeRows: drag.latticeRows,
          handle: drag.handle,
          dragDeltaCanvas: {
            x: currentCanvas.x - drag.startCanvas.x,
            y: currentCanvas.y - drag.startCanvas.y
          }
        });
        drag.nextOffsetsRef.current = scaleResult.ok
          ? scaleResult.nextOffsets
          : drag.baseOffsets;
        setPreview(
          scaleResult.ok
            ? {
                rigControlId: drag.rigControlId,
                offsets: drag.controller.preview({ currentSession: input.session })
              }
            : null
        );

        dragRef.current = {
          ...drag,
          lastScreen: eventInput.screenPoint,
          moved
        };
        return true;
      }

      const moved =
        drag.moved ||
        Math.abs(eventInput.screenPoint.x - drag.startScreen.x) > POINTER_CLICK_SLOP ||
        Math.abs(eventInput.screenPoint.y - drag.startScreen.y) > POINTER_CLICK_SLOP;
      dragRef.current = {
        ...drag,
        lastScreen: eventInput.screenPoint,
        moved
      };
      setMarqueeRect(normalizeScreenRect(drag.startScreen, eventInput.screenPoint));
      return true;
    },
    [input.enabled, input.session, input.view, renderProjection.deformerOverlay, scaleHandlesVisible]
  );

  const finishPointerDrag = useCallback(
    (eventInput: { readonly pointerId: number; readonly commit: boolean }): boolean => {
      const drag = dragRef.current;
      if (drag === undefined || drag.pointerId !== eventInput.pointerId) {
        return false;
      }

      dragRef.current = undefined;

      if (drag.mode === "point-drag") {
        setPreview(null);
        setHoveredControlPointIndex(undefined);
        if (
          eventInput.commit &&
          drag.editable &&
          drag.controller !== undefined &&
          drag.moved &&
          !areWarpControlPointOffsetsEqual(drag.baseOffsets, drag.nextOffsetsRef.current)
        ) {
          input.commitGestureController(drag.controller);
        }
        return true;
      }

      if (drag.mode === "scale-drag") {
        setPreview(null);
        setHoveredScaleHandle(undefined);
        if (
          eventInput.commit &&
          drag.moved &&
          !areWarpControlPointOffsetsEqual(drag.baseOffsets, drag.nextOffsetsRef.current)
        ) {
          input.commitGestureController(drag.controller);
        }
        return true;
      }

      setMarqueeRect(null);
      if (eventInput.commit && drag.moved) {
        const rect = normalizeScreenRect(drag.startScreen, drag.lastScreen);
        const selectedIndices = selectWarpControlPointsInMarquee({
          overlay: renderProjection.deformerOverlay,
          view: input.view,
          rect
        });
        setSelection(
          createWarpControlPointSelection({
            rigControlId: drag.rigControlId,
            pointCount: drag.pointCount,
            indices: selectedIndices
          })
        );
      } else if (eventInput.commit) {
        setSelection(null);
      }
      return true;
    },
    [input, renderProjection.deformerOverlay]
  );

  const rendererState = useMemo((): CanvasWarpDeformerInteractionState | undefined => {
    if (activeRigControlId === undefined) {
      return undefined;
    }

    return {
      rigControlId: activeRigControlId,
      editable,
      selectedControlPointIndices,
      scaleHandlesVisible,
      ...(hoveredControlPointIndex === undefined
        ? {}
        : { hoveredControlPointIndex }),
      ...(hoveredScaleHandle === undefined
        ? {}
        : { hoveredScaleHandle })
    };
  }, [
    activeRigControlId,
    editable,
    hoveredControlPointIndex,
    hoveredScaleHandle,
    scaleHandlesVisible,
    selectedControlPointIndices
  ]);

  return {
    ...(activeRigControlId === undefined ? {} : { activeRigControlId }),
    editable,
    ...(hoveredControlPointIndex === undefined ? {} : { hoveredControlPointIndex }),
    ...(hoveredScaleHandle === undefined ? {} : { hoveredScaleHandle }),
    marqueeRect,
    previewActive: preview !== null,
    renderProjection,
    ...(rendererState === undefined ? {} : { rendererState }),
    scaleHandlesVisible,
    selectedControlPointIndices,
    clearHover,
    finishPointerDrag,
    handlePointerDown,
    handlePointerMove
  };
}

function applyWarpControlPointPreview(
  projection: CanvasRenderProjection,
  preview: WarpControlPointPreviewState | null
): CanvasRenderProjection {
  if (
    preview === null ||
    projection.deformerOverlay?.kind !== "warp" ||
    projection.deformerOverlay.rigControlId !== preview.rigControlId
  ) {
    return projection;
  }

  return {
    ...projection,
    deformerOverlay: {
      ...projection.deformerOverlay,
      controlPointOffsets: preview.offsets
    }
  };
}

function createWarpControlPointEditState(input: {
  readonly activeParameterId: ParameterId | null;
  readonly parameterValues: ParameterValueMap;
  readonly projection: CanvasRenderProjection;
  readonly session: AuthoringSession;
}): WarpControlPointEditState | null {
  const overlay = input.projection.deformerOverlay;
  if (
    overlay?.kind !== "warp" ||
    overlay.status !== "committed" ||
    overlay.rigControlId === undefined
  ) {
    return null;
  }

  const binding = createRigControlParameterBindings(input.session, overlay.rigControlId).find(
    (candidate) => candidate.targetProperty === "controlPointOffsets"
  );
  if (binding === undefined) {
    return null;
  }

  const bindingProjection = createParameterBindingProjection(
    input.session,
    binding,
    input.activeParameterId,
    input.parameterValues
  );
  const pointCount = getWarpControlPointCount(overlay);
  const displayOffsets = Array.isArray(bindingProjection.displayValue)
    ? bindingProjection.displayValue
    : overlay.controlPointOffsets;
  const restControlPoints =
    overlay.restControlPoints?.length === pointCount
      ? overlay.restControlPoints.map((point) => ({ x: point.x, y: point.y }))
      : [];
  const validScaleLattice =
    Number.isInteger(overlay.transformColumns) &&
    Number.isInteger(overlay.transformRows) &&
    overlay.transformColumns >= 2 &&
    overlay.transformRows >= 2;

  return {
    rigControlId: overlay.rigControlId,
    pointCount,
    binding,
    bindingProjection,
    currentOffsets: normalizeWarpControlPointOffsets(displayOffsets, pointCount),
    latticeColumns: overlay.transformColumns,
    latticeRows: overlay.transformRows,
    restControlPoints,
    scaleHandleAvailable: validScaleLattice && restControlPoints.length === pointCount
  };
}

function getActiveWarpOverlay(
  enabled: boolean,
  overlay: CanvasDeformerOverlayProjection | undefined
): CanvasDeformerOverlayProjection | undefined {
  if (!enabled || overlay?.kind !== "warp" || overlay.status !== "committed") {
    return undefined;
  }

  return overlay;
}

interface WarpScaleHandlePosition {
  readonly handle: WarpDeformerScaleHandle;
  readonly kind: "corner" | "edge";
  readonly canvasPoint: CanvasPoint;
  readonly screenPoint: CanvasPoint;
}

interface WarpScaleHandleHit extends WarpScaleHandlePosition {
  readonly distancePx: number;
}

function hitTestWarpScaleHandle(input: {
  readonly overlay: CanvasDeformerOverlayProjection | undefined;
  readonly view: CanvasViewState;
  readonly screenPoint: CanvasPoint;
  readonly tolerancePx?: number;
}): WarpScaleHandleHit | undefined {
  if (input.overlay?.kind !== "warp") {
    return undefined;
  }

  const positions = listWarpScaleHandlePositions({
    overlay: input.overlay,
    view: input.view
  });
  const screenBounds = getWarpCurrentControlPointScreenBounds({
    overlay: input.overlay,
    view: input.view
  });
  if (screenBounds === undefined) {
    return undefined;
  }

  const tolerance = Math.max(0, input.tolerancePx ?? WARP_SCALE_HANDLE_HIT_TOLERANCE_PX);
  const outwardPositions = positions.filter((position) =>
    isScreenPointOutwardForWarpScaleHandle({
      handle: position.handle,
      screenPoint: input.screenPoint,
      bounds: screenBounds
    })
  );

  return (
    findNearestWarpScaleHandle({
      positions: outwardPositions.filter((position) => position.kind === "corner"),
      screenPoint: input.screenPoint,
      tolerance
    }) ??
    findNearestWarpScaleHandle({
      positions: outwardPositions.filter((position) => position.kind === "edge"),
      screenPoint: input.screenPoint,
      tolerance
    })
  );
}

function listWarpScaleHandlePositions(input: {
  readonly overlay: CanvasDeformerOverlayProjection;
  readonly view: CanvasViewState;
}): readonly WarpScaleHandlePosition[] {
  const bounds = getWarpCurrentControlPointBounds(input);
  if (bounds === undefined) {
    return [];
  }

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const offset = getWarpScaleHandleCanvasOffset(input.view.zoom);
  const leftX = bounds.x - offset;
  const rightX = bounds.x + bounds.width + offset;
  const topY = bounds.y - offset;
  const bottomY = bounds.y + bounds.height + offset;
  const rawPositions: readonly Omit<WarpScaleHandlePosition, "screenPoint">[] = [
    {
      handle: "topLeftCorner",
      kind: "corner",
      canvasPoint: { x: leftX, y: topY }
    },
    {
      handle: "topRightCorner",
      kind: "corner",
      canvasPoint: { x: rightX, y: topY }
    },
    {
      handle: "bottomLeftCorner",
      kind: "corner",
      canvasPoint: { x: leftX, y: bottomY }
    },
    {
      handle: "bottomRightCorner",
      kind: "corner",
      canvasPoint: { x: rightX, y: bottomY }
    },
    {
      handle: "leftEdge",
      kind: "edge",
      canvasPoint: { x: leftX, y: centerY }
    },
    {
      handle: "rightEdge",
      kind: "edge",
      canvasPoint: { x: rightX, y: centerY }
    },
    {
      handle: "topEdge",
      kind: "edge",
      canvasPoint: { x: centerX, y: topY }
    },
    {
      handle: "bottomEdge",
      kind: "edge",
      canvasPoint: { x: centerX, y: bottomY }
    }
  ];

  return rawPositions.map((position) => ({
    ...position,
    screenPoint: canvasToScreenPoint(position.canvasPoint, input.view)
  }));
}

function findNearestWarpScaleHandle(input: {
  readonly positions: readonly WarpScaleHandlePosition[];
  readonly screenPoint: CanvasPoint;
  readonly tolerance: number;
}): WarpScaleHandleHit | undefined {
  const toleranceSquared = input.tolerance * input.tolerance;
  let best: WarpScaleHandleHit | undefined;

  for (const position of input.positions) {
    const distanceSquared =
      (position.screenPoint.x - input.screenPoint.x) ** 2 +
      (position.screenPoint.y - input.screenPoint.y) ** 2;
    if (distanceSquared > toleranceSquared) {
      continue;
    }

    const distancePx = Math.sqrt(distanceSquared);
    if (best === undefined || distancePx < best.distancePx) {
      best = {
        ...position,
        distancePx
      };
    }
  }

  return best;
}

interface WarpControlPointScreenBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

function getWarpCurrentControlPointScreenBounds(input: {
  readonly overlay: CanvasDeformerOverlayProjection;
  readonly view: CanvasViewState;
}): WarpControlPointScreenBounds | undefined {
  const bounds = getWarpCurrentControlPointBounds(input);
  if (bounds === undefined) {
    return undefined;
  }

  const topLeft = canvasToScreenPoint({ x: bounds.x, y: bounds.y }, input.view);
  const bottomRight = canvasToScreenPoint(
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    input.view
  );

  return {
    minX: Math.min(topLeft.x, bottomRight.x),
    maxX: Math.max(topLeft.x, bottomRight.x),
    minY: Math.min(topLeft.y, bottomRight.y),
    maxY: Math.max(topLeft.y, bottomRight.y)
  };
}

function isScreenPointOutwardForWarpScaleHandle(input: {
  readonly handle: WarpDeformerScaleHandle;
  readonly screenPoint: CanvasPoint;
  readonly bounds: WarpControlPointScreenBounds;
}): boolean {
  switch (input.handle) {
    case "leftEdge":
      return input.screenPoint.x < input.bounds.minX;
    case "rightEdge":
      return input.screenPoint.x > input.bounds.maxX;
    case "topEdge":
      return input.screenPoint.y < input.bounds.minY;
    case "bottomEdge":
      return input.screenPoint.y > input.bounds.maxY;
    case "topLeftCorner":
      return input.screenPoint.x < input.bounds.minX && input.screenPoint.y < input.bounds.minY;
    case "topRightCorner":
      return input.screenPoint.x > input.bounds.maxX && input.screenPoint.y < input.bounds.minY;
    case "bottomLeftCorner":
      return input.screenPoint.x < input.bounds.minX && input.screenPoint.y > input.bounds.maxY;
    case "bottomRightCorner":
      return input.screenPoint.x > input.bounds.maxX && input.screenPoint.y > input.bounds.maxY;
  }
}

function getWarpScaleHandleCanvasOffset(zoom: number): number {
  return WARP_SCALE_HANDLE_OUTER_OFFSET_PX / Math.max(Math.abs(zoom), MIN_WARP_SCALE_HANDLE_ZOOM);
}

function getWarpCurrentControlPointBounds(input: {
  readonly overlay: CanvasDeformerOverlayProjection;
  readonly view: CanvasViewState;
}): RectDto | undefined {
  const positions = listWarpControlPointPositions(input);
  const first = positions[0]?.canvasPoint;
  if (first === undefined) {
    return undefined;
  }

  let minX = first.x;
  let maxX = first.x;
  let minY = first.y;
  let maxY = first.y;
  for (const position of positions.slice(1)) {
    minX = Math.min(minX, position.canvasPoint.x);
    maxX = Math.max(maxX, position.canvasPoint.x);
    minY = Math.min(minY, position.canvasPoint.y);
    maxY = Math.max(maxY, position.canvasPoint.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}
