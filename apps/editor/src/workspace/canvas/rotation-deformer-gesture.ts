import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { RigControlId } from "@private-2d-rigging-lab/contracts";

import type { EditorSessionCommandResult } from "../../features/editor-session/model/editor-session-commands";
import {
  commitEditKeyformKey,
  commitUpdateRigControl
} from "../../features/editor-session/model/editor-session-commands";
import {
  createEditorSessionGestureCommit,
  type EditorSessionGestureCommit
} from "../../features/editor-session/model/editor-session-gesture-commit";
import {
  createEditKeyformPayload,
  type EditorParameter,
  type ParameterBindingProjection,
  type ParameterKeyformBindingDescriptor
} from "../../features/editor-session/model/parameter-keyform-state";
import type { CanvasPoint } from "./canvas-projection";

export type RotationAngleEditMode =
  | {
      readonly kind: "restAngle";
    }
  | {
      readonly kind: "keyform";
      readonly binding: ParameterKeyformBindingDescriptor;
      readonly parameter: EditorParameter;
      readonly currentParameterValue: number;
    }
  | {
      readonly kind: "locked";
      readonly reason: "parentedUnsupported" | "missingCurrentKeyform";
    };

export function canCommitRotationAngleKeyformUpdate(
  projection: Pick<ParameterBindingProjection, "canEditValue" | "parameter">
): projection is Pick<ParameterBindingProjection, "canEditValue"> & {
  readonly parameter: EditorParameter;
} {
  return projection.canEditValue && projection.parameter !== null;
}

export function hasRotationAngleKeyforms(
  session: AuthoringSession,
  rigControlId: RigControlId
): boolean {
  return session.graph.keyformSets.some(
    (keyformSet) =>
      keyformSet.target.kind === "rigControl" &&
      keyformSet.target.id === rigControlId &&
      keyformSet.target.property === "angleDegrees"
  );
}

export function createRotationPivotUpdateGesture(input: {
  readonly rigControlId: RigControlId;
  readonly getNextPivot: () => CanvasPoint;
}): EditorSessionGestureCommit<CanvasPoint, EditorSessionCommandResult> {
  return createEditorSessionGestureCommit({
    label: "Edit Rotation pivot",
    preview: () => input.getNextPivot(),
    commit: (currentSession) =>
      commitUpdateRigControl(currentSession, {
        rigControlId: input.rigControlId,
        pivot: input.getNextPivot()
      })
  });
}

export function createRotationRestAngleUpdateGesture(input: {
  readonly rigControlId: RigControlId;
  readonly getNextAngleDegrees: () => number;
}): EditorSessionGestureCommit<number, EditorSessionCommandResult> {
  return createEditorSessionGestureCommit({
    label: "Edit Rotation rest angle",
    preview: () => input.getNextAngleDegrees(),
    commit: (currentSession) =>
      commitUpdateRigControl(currentSession, {
        rigControlId: input.rigControlId,
        restAngleDegrees: input.getNextAngleDegrees()
      })
  });
}

export function createRotationKeyformAngleUpdateGesture(input: {
  readonly binding: ParameterKeyformBindingDescriptor;
  readonly currentParameterValue: number;
  readonly getNextAngleDegrees: () => number;
  readonly parameter: EditorParameter;
}): EditorSessionGestureCommit<number, EditorSessionCommandResult> {
  return createEditorSessionGestureCommit({
    label: "Edit Rotation angle keyform",
    preview: () => input.getNextAngleDegrees(),
    commit: (currentSession) =>
      commitEditKeyformKey(
        currentSession,
        createEditKeyformPayload({
          action: "updateCurrent",
          binding: input.binding,
          currentParameterValue: input.currentParameterValue,
          parameter: input.parameter,
          value: input.getNextAngleDegrees()
        })
      )
  });
}
