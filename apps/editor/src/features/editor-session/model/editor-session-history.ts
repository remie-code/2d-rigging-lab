import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";

import type { EditorSessionCommandResult } from "./editor-session-commands";

export const EDITOR_SESSION_HISTORY_DEFAULT_MAX_DEPTH = 50;

export interface EditorSessionHistoryEntry {
  readonly entryId: string;
  readonly label: string;
  readonly before: AuthoringSession;
  readonly after: AuthoringSession;
}

export interface EditorSessionHistoryState {
  readonly maxDepth: number;
  readonly nextEntryIndex: number;
  readonly undoStack: readonly EditorSessionHistoryEntry[];
  readonly redoStack: readonly EditorSessionHistoryEntry[];
}

export interface EditorSessionHistoryCommitInput {
  readonly before: AuthoringSession;
  readonly after: AuthoringSession;
  readonly label?: string;
}

export interface EditorSessionHistoryTransition {
  readonly history: EditorSessionHistoryState;
  readonly session: AuthoringSession;
  readonly entry: EditorSessionHistoryEntry;
}

export type EditorSessionCommandRunner<
  Result extends EditorSessionCommandResult = EditorSessionCommandResult
> = (currentSession: AuthoringSession) => Result;

export function createEmptyEditorSessionHistory(
  maxDepth = EDITOR_SESSION_HISTORY_DEFAULT_MAX_DEPTH
): EditorSessionHistoryState {
  return {
    maxDepth: normalizeHistoryDepth(maxDepth),
    nextEntryIndex: 1,
    undoStack: [],
    redoStack: []
  };
}

export function canUndoEditorSessionHistory(history: EditorSessionHistoryState): boolean {
  return history.undoStack.length > 0;
}

export function canRedoEditorSessionHistory(history: EditorSessionHistoryState): boolean {
  return history.redoStack.length > 0;
}

export function recordEditorSessionCommit(
  history: EditorSessionHistoryState,
  input: EditorSessionHistoryCommitInput
): EditorSessionHistoryState {
  const entry: EditorSessionHistoryEntry = {
    entryId: `editor_history_${history.nextEntryIndex}`,
    label: input.label ?? "Editor command",
    before: cloneSession(input.before),
    after: cloneSession(input.after)
  };
  const undoStack = [...history.undoStack, entry].slice(-history.maxDepth);

  return {
    ...history,
    nextEntryIndex: history.nextEntryIndex + 1,
    undoStack,
    redoStack: []
  };
}

export function undoEditorSessionHistory(
  history: EditorSessionHistoryState
): EditorSessionHistoryTransition | null {
  const entry = history.undoStack.at(-1);
  if (entry === undefined) {
    return null;
  }

  return {
    entry,
    session: cloneSession(entry.before),
    history: {
      ...history,
      undoStack: history.undoStack.slice(0, -1),
      redoStack: [...history.redoStack, entry]
    }
  };
}

export function redoEditorSessionHistory(
  history: EditorSessionHistoryState
): EditorSessionHistoryTransition | null {
  const entry = history.redoStack.at(-1);
  if (entry === undefined) {
    return null;
  }

  return {
    entry,
    session: cloneSession(entry.after),
    history: {
      ...history,
      undoStack: [...history.undoStack, entry],
      redoStack: history.redoStack.slice(0, -1)
    }
  };
}

export function commitEditorSessionCommandWithHistory<
  Result extends EditorSessionCommandResult
>(input: {
  readonly currentSession: AuthoringSession;
  readonly history: EditorSessionHistoryState;
  readonly command: EditorSessionCommandRunner<Result>;
  readonly label?: string;
}): {
  readonly result: Result;
  readonly history: EditorSessionHistoryState;
} {
  const result = input.command(input.currentSession);
  if (!result.committed) {
    return {
      result,
      history: input.history
    };
  }

  return {
    result,
    history: recordEditorSessionCommit(input.history, {
      before: input.currentSession,
      after: result.session,
      ...(input.label === undefined ? {} : { label: input.label })
    })
  };
}

function normalizeHistoryDepth(maxDepth: number): number {
  if (!Number.isFinite(maxDepth)) {
    return EDITOR_SESSION_HISTORY_DEFAULT_MAX_DEPTH;
  }

  return Math.max(1, Math.floor(maxDepth));
}

function cloneSession(session: AuthoringSession): AuthoringSession {
  return structuredClone(session);
}
