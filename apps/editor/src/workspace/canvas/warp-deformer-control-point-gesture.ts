import type { EditorSessionCommandResult } from "../../features/editor-session/model/editor-session-commands";
import { commitEditKeyformKey } from "../../features/editor-session/model/editor-session-commands";
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

export function canCommitWarpControlPointOffsetUpdate(
  projection: Pick<ParameterBindingProjection, "canEditValue" | "parameter">
): projection is Pick<ParameterBindingProjection, "canEditValue"> & {
  readonly parameter: EditorParameter;
} {
  return projection.canEditValue && projection.parameter !== null;
}

export function createWarpControlPointOffsetUpdateGesture(input: {
  readonly binding: ParameterKeyformBindingDescriptor;
  readonly parameter: EditorParameter;
  readonly currentParameterValue: number;
  readonly getNextOffsets: () => readonly CanvasPoint[];
}): EditorSessionGestureCommit<readonly CanvasPoint[], EditorSessionCommandResult> {
  return createEditorSessionGestureCommit({
    label: "Edit Warp control points",
    preview: () => input.getNextOffsets(),
    commit: (currentSession) =>
      commitEditKeyformKey(
        currentSession,
        createEditKeyformPayload({
          action: "updateCurrent",
          binding: input.binding,
          currentParameterValue: input.currentParameterValue,
          parameter: input.parameter,
          value: input.getNextOffsets()
        })
      )
  });
}
