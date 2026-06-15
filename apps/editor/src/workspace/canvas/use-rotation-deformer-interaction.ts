import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { ParameterId, RigControlId } from "@private-2d-rigging-lab/contracts";
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
import type { CanvasEvaluationRotationPreview } from "./canvas-evaluation";
import type {
  CanvasDeformerOverlayProjection,
  CanvasPoint,
  CanvasRenderProjection,
  CanvasViewState
} from "./canvas-projection";
import { screenToCanvasPoint } from "./canvas-projection";
import type {
  CanvasRotationDeformerInteractionState
} from "./canvas-renderer";
import {
  areAnglesEqual,
  areCanvasPointsEqual,
  hitTestRotationDeformerHandle,
  getRotationDeformerPivot,
  offsetCanvasPoint,
  resolveRotationAngleDegreesFromScreenPoint,
  type RotationDeformerHandleKind
} from "./rotation-deformer-handles";
import {
  canCommitRotationAngleKeyformUpdate,
  canCommitRotationTranslationKeyformUpdate,
  createRotationKeyformAngleUpdateGesture,
  createRotationKeyformTranslationUpdateGesture,
  createRotationPivotUpdateGesture,
  createRotationRestAngleUpdateGesture,
  createRotationRestTranslationUpdateGesture,
  hasRotationAngleKeyforms,
  hasRotationTranslationKeyforms,
  type RotationAngleEditMode,
  type RotationTranslationEditMode
} from "./rotation-deformer-gesture";

const POINTER_CLICK_SLOP = 4;

type CommitGestureController = <
  Preview,
  Result extends EditorSessionCommandResult = EditorSessionCommandResult
>(
  controller: EditorSessionGestureCommitController<Preview, Result>
) => Result | null;

type RotationDragState =
  | {
      readonly mode: "pivot";
      readonly pointerId: number;
      readonly rigControlId: RigControlId;
      readonly startScreen: CanvasPoint;
      readonly startCanvas: CanvasPoint;
      readonly basePivot: CanvasPoint;
      readonly nextPivotRef: { current: CanvasPoint };
      readonly controller?: EditorSessionGestureCommitController<CanvasPoint> | undefined;
      readonly editable: boolean;
      readonly moved: boolean;
    }
  | {
      readonly mode: "angle";
      readonly pointerId: number;
      readonly rigControlId: RigControlId;
      readonly startScreen: CanvasPoint;
      readonly pivot: CanvasPoint;
      readonly baseAngleDegrees: number;
      readonly nextAngleRef: { current: number };
      readonly controller?: EditorSessionGestureCommitController<number> | undefined;
      readonly editMode: RotationAngleEditMode;
      readonly moved: boolean;
    }
  | {
      readonly mode: "translation";
      readonly pointerId: number;
      readonly rigControlId: RigControlId;
      readonly startScreen: CanvasPoint;
      readonly startCanvas: CanvasPoint;
      readonly baseTranslation: CanvasPoint;
      readonly nextTranslationRef: { current: CanvasPoint };
      readonly controller?: EditorSessionGestureCommitController<CanvasPoint> | undefined;
      readonly editMode: RotationTranslationEditMode;
      readonly moved: boolean;
    };

interface RotationDeformerPreviewState {
  readonly rigControlId: RigControlId;
  readonly pivot?: CanvasPoint;
  readonly translation?: CanvasPoint;
  readonly restAngleDegrees?: number;
  readonly evaluatedAngleDegrees?: number;
}

interface RotationDeformerEditState {
  readonly rigControlId: RigControlId;
  readonly parentedUnsupported: boolean;
  readonly localPivot: CanvasPoint;
  readonly displayPivot: CanvasPoint;
  readonly localTranslation: CanvasPoint;
  readonly displayTranslation: CanvasPoint;
  readonly displayAngleDegrees: number;
  readonly angleEditMode: RotationAngleEditMode;
  readonly translationEditMode: RotationTranslationEditMode;
}

export interface UseRotationDeformerInteractionInput {
  readonly activeParameterId: ParameterId | null;
  readonly commitGestureController: CommitGestureController;
  readonly enabled: boolean;
  readonly parameterValues: ParameterValueMap;
  readonly projection: CanvasRenderProjection;
  readonly createPreviewProjection?: (
    preview: CanvasEvaluationRotationPreview | null
  ) => CanvasRenderProjection;
  readonly session: AuthoringSession;
  readonly view: CanvasViewState;
}

export interface RotationDeformerInteraction {
  readonly activeRigControlId?: RigControlId;
  readonly angleEditMode: RotationAngleEditMode["kind"] | "none";
  readonly angleLockReason?: Extract<RotationAngleEditMode, { readonly kind: "locked" }>["reason"];
  readonly translationEditMode: RotationTranslationEditMode["kind"] | "none";
  readonly translationLockReason?: Extract<RotationTranslationEditMode, { readonly kind: "locked" }>["reason"];
  readonly hoveredHandle?: RotationDeformerHandleKind;
  readonly previewActive: boolean;
  readonly renderProjection: CanvasRenderProjection;
  readonly rendererState?: CanvasRotationDeformerInteractionState;
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

export function useRotationDeformerInteraction(
  input: UseRotationDeformerInteractionInput
): RotationDeformerInteraction {
  const dragRef = useRef<RotationDragState | undefined>(undefined);
  const [preview, setPreview] = useState<RotationDeformerPreviewState | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<RotationDeformerHandleKind | undefined>(
    undefined
  );
  const renderProjection = useMemo(() => {
    if (preview === null) {
      return input.projection;
    }

    return input.createPreviewProjection?.(preview) ??
      applyRotationPreview(input.projection, preview);
  }, [input.createPreviewProjection, input.projection, preview]);
  const editState = useMemo(
    () =>
      createRotationDeformerEditState({
        activeParameterId: input.activeParameterId,
        parameterValues: input.parameterValues,
        projection: input.projection,
        session: input.session
      }),
    [input.activeParameterId, input.parameterValues, input.projection, input.session]
  );
  const activeRigControlId =
    renderProjection.deformerOverlay?.kind === "rotation" &&
    renderProjection.deformerOverlay.status === "committed"
      ? renderProjection.deformerOverlay.rigControlId
      : undefined;

  useEffect(() => {
    setPreview((current) =>
      current !== null && current.rigControlId === activeRigControlId ? current : null
    );
    setHoveredHandle(undefined);
    dragRef.current = undefined;
  }, [activeRigControlId]);

  const clearHover = useCallback(() => {
    setHoveredHandle(undefined);
  }, []);

  const handlePointerDown = useCallback(
    (eventInput: { readonly pointerId: number; readonly screenPoint: CanvasPoint }): boolean => {
      const overlay = getActiveRotationOverlay(input.enabled, renderProjection.deformerOverlay);
      if (overlay === undefined || overlay.rigControlId === undefined) {
        return false;
      }

      const hit = hitTestRotationDeformerHandle({
        overlay,
        view: input.view,
        screenPoint: eventInput.screenPoint
      });
      if (hit === undefined || editState === null) {
        return false;
      }

      if (hit.kind === "pivot") {
        const nextPivotRef = {
          current: editState.localPivot
        };
        const controller = editState.parentedUnsupported
          ? undefined
          : createEditorSessionGestureCommitController(
              createRotationPivotUpdateGesture({
                rigControlId: overlay.rigControlId,
                getNextPivot: () => nextPivotRef.current
              })
            );

        dragRef.current = {
          mode: "pivot",
          pointerId: eventInput.pointerId,
          rigControlId: overlay.rigControlId,
          startScreen: eventInput.screenPoint,
          startCanvas: screenToCanvasPoint(eventInput.screenPoint, input.view),
          basePivot: editState.localPivot,
          nextPivotRef,
          ...(controller === undefined ? {} : { controller }),
          editable: controller !== undefined,
          moved: false
        };
        return true;
      }

      if (hit.kind === "translation") {
        const nextTranslationRef = {
          current: editState.displayTranslation
        };
        const controller = createTranslationGestureController({
          editMode: editState.translationEditMode,
          getNextTranslation: () => nextTranslationRef.current,
          rigControlId: overlay.rigControlId
        });

        dragRef.current = {
          mode: "translation",
          pointerId: eventInput.pointerId,
          rigControlId: overlay.rigControlId,
          startScreen: eventInput.screenPoint,
          startCanvas: screenToCanvasPoint(eventInput.screenPoint, input.view),
          baseTranslation: editState.displayTranslation,
          nextTranslationRef,
          ...(controller === undefined ? {} : { controller }),
          editMode: editState.translationEditMode,
          moved: false
        };
        return true;
      }

      const nextAngleRef = {
        current: editState.displayAngleDegrees
      };
      const controller = createAngleGestureController({
        editMode: editState.angleEditMode,
        getNextAngleDegrees: () => nextAngleRef.current,
        rigControlId: overlay.rigControlId
      });

      dragRef.current = {
        mode: "angle",
        pointerId: eventInput.pointerId,
        rigControlId: overlay.rigControlId,
        startScreen: eventInput.screenPoint,
        pivot: editState.displayPivot,
        baseAngleDegrees: editState.displayAngleDegrees,
        nextAngleRef,
        ...(controller === undefined ? {} : { controller }),
        editMode: editState.angleEditMode,
        moved: false
      };
      return true;
    },
    [editState, input.enabled, input.view, renderProjection.deformerOverlay]
  );

  const handlePointerMove = useCallback(
    (eventInput: { readonly pointerId: number; readonly screenPoint: CanvasPoint }): boolean => {
      const drag = dragRef.current;
      if (drag === undefined) {
        const overlay = getActiveRotationOverlay(input.enabled, renderProjection.deformerOverlay);
        if (overlay === undefined) {
          setHoveredHandle(undefined);
          return false;
        }

        const hit = hitTestRotationDeformerHandle({
          overlay,
          view: input.view,
          screenPoint: eventInput.screenPoint
        });
        setHoveredHandle(hit?.kind);
        return false;
      }

      if (drag.pointerId !== eventInput.pointerId) {
        return false;
      }

      const moved =
        drag.moved ||
        Math.abs(eventInput.screenPoint.x - drag.startScreen.x) > POINTER_CLICK_SLOP ||
        Math.abs(eventInput.screenPoint.y - drag.startScreen.y) > POINTER_CLICK_SLOP;

      if (drag.mode === "pivot") {
        if (drag.editable && drag.controller !== undefined) {
          const currentCanvas = screenToCanvasPoint(eventInput.screenPoint, input.view);
          drag.nextPivotRef.current = offsetCanvasPoint(drag.basePivot, {
            x: currentCanvas.x - drag.startCanvas.x,
            y: currentCanvas.y - drag.startCanvas.y
          });
          setPreview({
            rigControlId: drag.rigControlId,
            pivot: drag.controller.preview({ currentSession: input.session })
          });
        }

        dragRef.current = {
          ...drag,
          moved
        };
        return true;
      }

      if (drag.mode === "translation") {
        if (drag.controller !== undefined) {
          const currentCanvas = screenToCanvasPoint(eventInput.screenPoint, input.view);
          drag.nextTranslationRef.current = offsetCanvasPoint(drag.baseTranslation, {
            x: currentCanvas.x - drag.startCanvas.x,
            y: currentCanvas.y - drag.startCanvas.y
          });
          const nextTranslation = drag.controller.preview({ currentSession: input.session });
          setPreview(createTranslationPreview({
            rigControlId: drag.rigControlId,
            nextTranslation
          }));
        }

        dragRef.current = {
          ...drag,
          moved
        };
        return true;
      }

      if (drag.controller !== undefined) {
        drag.nextAngleRef.current = resolveRotationAngleDegreesFromScreenPoint({
          fallbackAngleDegrees: drag.baseAngleDegrees,
          pivot: drag.pivot,
          screenPoint: eventInput.screenPoint,
          view: input.view
        });
        const nextAngle = drag.controller.preview({ currentSession: input.session });
        setPreview(createAnglePreview({
          editMode: drag.editMode,
          rigControlId: drag.rigControlId,
          nextAngleDegrees: nextAngle
        }));
      }

      dragRef.current = {
        ...drag,
        moved
      };
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
      setPreview(null);
      setHoveredHandle(undefined);

      if (!eventInput.commit || !drag.moved || drag.controller === undefined) {
        return true;
      }

      if (
        drag.mode === "pivot" &&
        !areCanvasPointsEqual(drag.basePivot, drag.nextPivotRef.current)
      ) {
        input.commitGestureController(drag.controller);
        return true;
      }

      if (
        drag.mode === "angle" &&
        !areAnglesEqual(drag.baseAngleDegrees, drag.nextAngleRef.current)
      ) {
        input.commitGestureController(drag.controller);
      }

      if (
        drag.mode === "translation" &&
        !areCanvasPointsEqual(drag.baseTranslation, drag.nextTranslationRef.current)
      ) {
        input.commitGestureController(drag.controller);
      }

      return true;
    },
    [input]
  );

  const rendererState = useMemo((): CanvasRotationDeformerInteractionState | undefined => {
    if (activeRigControlId === undefined || editState === null) {
      return undefined;
    }

    return {
      rigControlId: activeRigControlId,
      pivotEditable: !editState.parentedUnsupported,
      angleEditable: editState.angleEditMode.kind !== "locked",
      translationEditable: editState.translationEditMode.kind !== "locked",
      ...(hoveredHandle === undefined ? {} : { hoveredHandle })
    };
  }, [activeRigControlId, editState, hoveredHandle]);

  return {
    ...(activeRigControlId === undefined ? {} : { activeRigControlId }),
    angleEditMode: editState?.angleEditMode.kind ?? "none",
    ...(editState?.angleEditMode.kind === "locked"
      ? { angleLockReason: editState.angleEditMode.reason }
      : {}),
    translationEditMode: editState?.translationEditMode.kind ?? "none",
    ...(editState?.translationEditMode.kind === "locked"
      ? { translationLockReason: editState.translationEditMode.reason }
      : {}),
    ...(hoveredHandle === undefined ? {} : { hoveredHandle }),
    previewActive: preview !== null,
    renderProjection,
    ...(rendererState === undefined ? {} : { rendererState }),
    clearHover,
    finishPointerDrag,
    handlePointerDown,
    handlePointerMove
  };
}

function createAngleGestureController(input: {
  readonly editMode: RotationAngleEditMode;
  readonly getNextAngleDegrees: () => number;
  readonly rigControlId: RigControlId;
}): EditorSessionGestureCommitController<number> | undefined {
  if (input.editMode.kind === "restAngle") {
    return createEditorSessionGestureCommitController(
      createRotationRestAngleUpdateGesture({
        rigControlId: input.rigControlId,
        getNextAngleDegrees: input.getNextAngleDegrees
      })
    );
  }

  if (input.editMode.kind === "keyform") {
    return createEditorSessionGestureCommitController(
      createRotationKeyformAngleUpdateGesture({
        binding: input.editMode.binding,
        currentParameterValue: input.editMode.currentParameterValue,
        getNextAngleDegrees: input.getNextAngleDegrees,
        parameter: input.editMode.parameter
      })
    );
  }

  return undefined;
}

function createTranslationGestureController(input: {
  readonly editMode: RotationTranslationEditMode;
  readonly getNextTranslation: () => CanvasPoint;
  readonly rigControlId: RigControlId;
}): EditorSessionGestureCommitController<CanvasPoint> | undefined {
  if (input.editMode.kind === "restTranslation") {
    return createEditorSessionGestureCommitController(
      createRotationRestTranslationUpdateGesture({
        rigControlId: input.rigControlId,
        getNextTranslation: input.getNextTranslation
      })
    );
  }

  if (input.editMode.kind === "keyform") {
    return createEditorSessionGestureCommitController(
      createRotationKeyformTranslationUpdateGesture({
        binding: input.editMode.binding,
        currentParameterValue: input.editMode.currentParameterValue,
        getNextTranslation: input.getNextTranslation,
        parameter: input.editMode.parameter
      })
    );
  }

  return undefined;
}

function createAnglePreview(input: {
  readonly editMode: RotationAngleEditMode;
  readonly rigControlId: RigControlId;
  readonly nextAngleDegrees: number;
}): RotationDeformerPreviewState {
  if (input.editMode.kind === "restAngle") {
    return {
      rigControlId: input.rigControlId,
      restAngleDegrees: input.nextAngleDegrees,
      evaluatedAngleDegrees: input.nextAngleDegrees
    };
  }

  return {
    rigControlId: input.rigControlId,
    evaluatedAngleDegrees: input.nextAngleDegrees
  };
}

function createTranslationPreview(input: {
  readonly rigControlId: RigControlId;
  readonly nextTranslation: CanvasPoint;
}): RotationDeformerPreviewState {
  return {
    rigControlId: input.rigControlId,
    translation: input.nextTranslation
  };
}

function createRotationDeformerEditState(input: {
  readonly activeParameterId: ParameterId | null;
  readonly parameterValues: ParameterValueMap;
  readonly projection: CanvasRenderProjection;
  readonly session: AuthoringSession;
}): RotationDeformerEditState | null {
  const overlay = input.projection.deformerOverlay;
  if (
    overlay?.kind !== "rotation" ||
    overlay.status !== "committed" ||
    overlay.rigControlId === undefined
  ) {
    return null;
  }

  const rigControl = input.session.graph.rigControls.find(
    (candidate) => candidate.rigControlId === overlay.rigControlId
  );
  if (rigControl?.kind !== "rotation2d") {
    return null;
  }

  const parentedUnsupported = rigControl.parentId !== undefined;
  const bindings = createRigControlParameterBindings(input.session, overlay.rigControlId);
  const angleBinding = bindings.find(
    (candidate) => candidate.targetProperty === "angleDegrees"
  );
  const angleBindingProjection =
    angleBinding === undefined
      ? undefined
      : createParameterBindingProjection(
          input.session,
          angleBinding,
          input.activeParameterId,
          input.parameterValues
        );
  const translationBinding = bindings.find(
    (candidate) => candidate.targetProperty === "translation"
  );
  const translationBindingProjection =
    translationBinding === undefined
      ? undefined
      : createParameterBindingProjection(
          input.session,
          translationBinding,
          input.activeParameterId,
          input.parameterValues
        );
  const angleEditMode = resolveAngleEditMode({
    binding: angleBinding,
    bindingProjection: angleBindingProjection,
    hasAngleKeyforms: hasRotationAngleKeyforms(input.session, overlay.rigControlId),
    parentedUnsupported
  });
  const translationEditMode = resolveTranslationEditMode({
    binding: translationBinding,
    bindingProjection: translationBindingProjection,
    hasTranslationKeyforms: hasRotationTranslationKeyforms(input.session, overlay.rigControlId),
    parentedUnsupported
  });
  const localTranslation = {
    x: rigControl.restTranslation?.x ?? 0,
    y: rigControl.restTranslation?.y ?? 0
  };

  return {
    rigControlId: overlay.rigControlId,
    parentedUnsupported,
    localPivot: {
      x: rigControl.pivot.x,
      y: rigControl.pivot.y
    },
    displayPivot: getRotationDeformerPivot(overlay),
    localTranslation,
    displayTranslation: overlay.translation ?? localTranslation,
    displayAngleDegrees: overlay.evaluatedAngleDegrees ?? overlay.restAngleDegrees ?? 0,
    angleEditMode,
    translationEditMode
  };
}

function resolveAngleEditMode(input: {
  readonly binding: ParameterKeyformBindingDescriptor | undefined;
  readonly bindingProjection: ParameterBindingProjection | undefined;
  readonly hasAngleKeyforms: boolean;
  readonly parentedUnsupported: boolean;
}): RotationAngleEditMode {
  if (input.parentedUnsupported) {
    return {
      kind: "locked",
      reason: "parentedUnsupported"
    };
  }

  if (
    input.binding !== undefined &&
    input.bindingProjection !== undefined &&
    canCommitRotationAngleKeyformUpdate(input.bindingProjection)
  ) {
    return {
      kind: "keyform",
      binding: input.binding,
      currentParameterValue: input.bindingProjection.currentParameterValue,
      parameter: input.bindingProjection.parameter
    };
  }

  if (!input.hasAngleKeyforms) {
    return {
      kind: "restAngle"
    };
  }

  return {
    kind: "locked",
    reason: "missingCurrentKeyform"
  };
}

function resolveTranslationEditMode(input: {
  readonly binding: ParameterKeyformBindingDescriptor | undefined;
  readonly bindingProjection: ParameterBindingProjection | undefined;
  readonly hasTranslationKeyforms: boolean;
  readonly parentedUnsupported: boolean;
}): RotationTranslationEditMode {
  if (input.parentedUnsupported) {
    return {
      kind: "locked",
      reason: "parentedUnsupported"
    };
  }

  if (
    input.binding !== undefined &&
    input.bindingProjection !== undefined &&
    canCommitRotationTranslationKeyformUpdate(input.bindingProjection)
  ) {
    return {
      kind: "keyform",
      binding: input.binding,
      currentParameterValue: input.bindingProjection.currentParameterValue,
      parameter: input.bindingProjection.parameter
    };
  }

  if (!input.hasTranslationKeyforms) {
    return {
      kind: "restTranslation"
    };
  }

  return {
    kind: "locked",
    reason: "missingCurrentKeyform"
  };
}

function applyRotationPreview(
  projection: CanvasRenderProjection,
  preview: RotationDeformerPreviewState | null
): CanvasRenderProjection {
  if (
    preview === null ||
    projection.deformerOverlay?.kind !== "rotation" ||
    projection.deformerOverlay.rigControlId !== preview.rigControlId
  ) {
    return projection;
  }

  return {
    ...projection,
    deformerOverlay: {
      ...projection.deformerOverlay,
      ...(preview.pivot === undefined ? {} : { pivot: preview.pivot }),
      ...(preview.translation === undefined ? {} : { translation: preview.translation }),
      ...(preview.restAngleDegrees === undefined
        ? {}
        : { restAngleDegrees: preview.restAngleDegrees }),
      ...(preview.evaluatedAngleDegrees === undefined
        ? {}
        : { evaluatedAngleDegrees: preview.evaluatedAngleDegrees })
    }
  };
}

function getActiveRotationOverlay(
  enabled: boolean,
  overlay: CanvasDeformerOverlayProjection | undefined
): CanvasDeformerOverlayProjection | undefined {
  if (!enabled || overlay?.kind !== "rotation" || overlay.status !== "committed") {
    return undefined;
  }

  return overlay;
}
