import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";

import type { EditorSessionCommandResult } from "./editor-session-commands";
import {
  commitEditorSessionCommandWithHistory,
  type EditorSessionHistoryState
} from "./editor-session-history";

export interface EditorSessionGestureCommit<
  Preview,
  Result extends EditorSessionCommandResult = EditorSessionCommandResult
> {
  readonly label?: string;
  readonly preview: (currentSession: AuthoringSession) => Preview;
  readonly commit: (currentSession: AuthoringSession) => Result;
}

export interface EditorSessionGestureCommitOutcome<
  Result extends EditorSessionCommandResult = EditorSessionCommandResult
> {
  readonly result: Result;
  readonly history: EditorSessionHistoryState;
}

export interface EditorSessionGestureCommitController<
  Preview,
  Result extends EditorSessionCommandResult = EditorSessionCommandResult
> {
  readonly preview: (input: { readonly currentSession: AuthoringSession }) => Preview;
  readonly commitOnce: (input: {
    readonly currentSession: AuthoringSession;
    readonly history: EditorSessionHistoryState;
  }) => EditorSessionGestureCommitOutcome<Result> | null;
  readonly hasCommitted: () => boolean;
}

export function createEditorSessionGestureCommit<
  Preview,
  Result extends EditorSessionCommandResult
>(
  input: EditorSessionGestureCommit<Preview, Result>
): EditorSessionGestureCommit<Preview, Result> {
  return input;
}

export function createEditorSessionGestureCommitController<
  Preview,
  Result extends EditorSessionCommandResult
>(
  gesture: EditorSessionGestureCommit<Preview, Result>
): EditorSessionGestureCommitController<Preview, Result> {
  let hasCommitted = false;

  return {
    preview: (input) =>
      previewEditorSessionGesture({
        gesture,
        currentSession: input.currentSession
      }),
    commitOnce: (input) => {
      if (hasCommitted) {
        return null;
      }

      hasCommitted = true;
      return commitEditorSessionGestureWithHistory({
        gesture,
        currentSession: input.currentSession,
        history: input.history
      });
    },
    hasCommitted: () => hasCommitted
  };
}

export function previewEditorSessionGesture<
  Preview,
  Result extends EditorSessionCommandResult
>(input: {
  readonly gesture: EditorSessionGestureCommit<Preview, Result>;
  readonly currentSession: AuthoringSession;
}): Preview {
  return input.gesture.preview(input.currentSession);
}

export function commitEditorSessionGestureWithHistory<
  Preview,
  Result extends EditorSessionCommandResult
>(input: {
  readonly gesture: EditorSessionGestureCommit<Preview, Result>;
  readonly currentSession: AuthoringSession;
  readonly history: EditorSessionHistoryState;
}): EditorSessionGestureCommitOutcome<Result> {
  const baseInput = {
    currentSession: input.currentSession,
    history: input.history,
    command: input.gesture.commit
  };

  return commitEditorSessionCommandWithHistory(
    input.gesture.label === undefined
      ? baseInput
      : {
          ...baseInput,
          label: input.gesture.label
        }
  );
}
