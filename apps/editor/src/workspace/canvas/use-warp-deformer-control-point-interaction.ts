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
import { screenToCanvasPoint } from "./canvas-projection";
import type { CanvasWarpDeformerInteractionState } from "./canvas-renderer";
import {
  applyWarpControlPointDragDelta,
  areWarpControlPointOffsetsEqual,
  createWarpControlPointSelection,
  getWarpControlPointCount,
  hitTestWarpControlPoint,
  isWarpControlPointSelectionScoped,
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

const POINTER_CLICK_SLOP = 4;

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
  readonly marqueeRect: RectDto | null;
  readonly previewActive: boolean;
  readonly renderProjection: CanvasRenderProjection;
  readonly rendererState?: CanvasWarpDeformerInteractionState;
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
    setMarqueeRect(null);
    dragRef.current = undefined;
  }, [activePointCount, activeRigControlId]);

  const clearHover = useCallback(() => {
    setHoveredControlPointIndex(undefined);
  }, []);

  const handlePointerDown = useCallback(
    (eventInput: { readonly pointerId: number; readonly screenPoint: CanvasPoint }): boolean => {
      const overlay = getActiveWarpOverlay(input.enabled, renderProjection.deformerOverlay);
      if (overlay === undefined || overlay.rigControlId === undefined) {
        return false;
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
    [editState, input.enabled, input.view, renderProjection.deformerOverlay, selection]
  );

  const handlePointerMove = useCallback(
    (eventInput: { readonly pointerId: number; readonly screenPoint: CanvasPoint }): boolean => {
      const drag = dragRef.current;
      if (drag === undefined) {
        const overlay = getActiveWarpOverlay(input.enabled, renderProjection.deformerOverlay);
        if (overlay === undefined) {
          setHoveredControlPointIndex(undefined);
          return false;
        }

        const hit = hitTestWarpControlPoint({
          overlay,
          view: input.view,
          screenPoint: eventInput.screenPoint
        });
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
    [input.enabled, input.session, input.view, renderProjection.deformerOverlay]
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
      ...(hoveredControlPointIndex === undefined
        ? {}
        : { hoveredControlPointIndex })
    };
  }, [activeRigControlId, editable, hoveredControlPointIndex, selectedControlPointIndices]);

  return {
    ...(activeRigControlId === undefined ? {} : { activeRigControlId }),
    editable,
    ...(hoveredControlPointIndex === undefined ? {} : { hoveredControlPointIndex }),
    marqueeRect,
    previewActive: preview !== null,
    renderProjection,
    ...(rendererState === undefined ? {} : { rendererState }),
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

  return {
    rigControlId: overlay.rigControlId,
    pointCount,
    binding,
    bindingProjection,
    currentOffsets: normalizeWarpControlPointOffsets(displayOffsets, pointCount)
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
