import {
  cloneAuthoringSessionForGraphEdit,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import {
  isLive2dPerformanceEnabled,
  recordLive2dPerformanceCounter
} from "@private-2d-rigging-lab/render-core";

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

  const nextHistory = {
    ...history,
    nextEntryIndex: history.nextEntryIndex + 1,
    undoStack,
    redoStack: []
  };
  recordHistoryBinaryMemoryCounters(nextHistory, input.after);
  return nextHistory;
}

export function undoEditorSessionHistory(
  history: EditorSessionHistoryState
): EditorSessionHistoryTransition | null {
  const entry = history.undoStack.at(-1);
  if (entry === undefined) {
    return null;
  }

  const nextHistory = {
    ...history,
    undoStack: history.undoStack.slice(0, -1),
    redoStack: [...history.redoStack, entry]
  };
  const session = cloneSession(entry.before);
  recordHistoryBinaryMemoryCounters(nextHistory, session);

  return {
    entry,
    session,
    history: nextHistory
  };
}

export function redoEditorSessionHistory(
  history: EditorSessionHistoryState
): EditorSessionHistoryTransition | null {
  const entry = history.redoStack.at(-1);
  if (entry === undefined) {
    return null;
  }

  const nextHistory = {
    ...history,
    undoStack: [...history.undoStack, entry],
    redoStack: history.redoStack.slice(0, -1)
  };
  const session = cloneSession(entry.after);
  recordHistoryBinaryMemoryCounters(nextHistory, session);

  return {
    entry,
    session,
    history: nextHistory
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
  return cloneAuthoringSessionForGraphEdit(session);
}

function recordHistoryBinaryMemoryCounters(
  history: EditorSessionHistoryState,
  currentSession: AuthoringSession
): void {
  if (!isLive2dPerformanceEnabled()) {
    return;
  }

  const current = summarizeSessionBinaryAssets(currentSession);
  const historyEstimate = estimateHistoryBinaryMemory(history);
  const avoidedBytes = Math.max(
    0,
    historyEstimate.deepClonedBytes - historyEstimate.retainedSharedBytes
  );
  const retainedRatioBasisPoints =
    historyEstimate.deepClonedBytes === 0
      ? 0
      : Math.round(
          (historyEstimate.retainedSharedBytes / historyEstimate.deepClonedBytes) * 10_000
        );

  recordLive2dPerformanceCounter("editorHistory.samples");
  recordLive2dPerformanceCounter("editorHistory.undoDepth", history.undoStack.length);
  recordLive2dPerformanceCounter("editorHistory.redoDepth", history.redoStack.length);
  recordLive2dPerformanceCounter("editorHistory.currentBinaryAssetCount", current.count);
  recordLive2dPerformanceCounter("editorHistory.currentBinaryBytes", current.bytes);
  recordLive2dPerformanceCounter(
    "editorHistory.estimatedDeepClonedHistoryBinaryBytes",
    historyEstimate.deepClonedBytes
  );
  recordLive2dPerformanceCounter(
    "editorHistory.estimatedRetainedSharedHistoryBinaryBytes",
    historyEstimate.retainedSharedBytes
  );
  recordLive2dPerformanceCounter(
    "editorHistory.estimatedAvoidedDuplicateHistoryBinaryBytes",
    avoidedBytes
  );
  recordLive2dPerformanceCounter(
    "editorHistory.retainedSharingRatioBasisPoints",
    retainedRatioBasisPoints
  );
}

function summarizeSessionBinaryAssets(session: AuthoringSession): {
  readonly count: number;
  readonly bytes: number;
} {
  const fileEntries = session.binaryAssets?.fileEntries ?? [];
  return {
    count: fileEntries.length,
    bytes: fileEntries.reduce((total, entry) => total + entry.bytes.byteLength, 0)
  };
}

function estimateHistoryBinaryMemory(history: EditorSessionHistoryState): {
  readonly deepClonedBytes: number;
  readonly retainedSharedBytes: number;
} {
  const uniqueBytes = new Set<Uint8Array>();
  let deepClonedBytes = 0;
  let retainedSharedBytes = 0;

  for (const entry of [...history.undoStack, ...history.redoStack]) {
    for (const session of [entry.before, entry.after]) {
      for (const fileEntry of session.binaryAssets?.fileEntries ?? []) {
        deepClonedBytes += fileEntry.bytes.byteLength;
        if (!uniqueBytes.has(fileEntry.bytes)) {
          uniqueBytes.add(fileEntry.bytes);
          retainedSharedBytes += fileEntry.bytes.byteLength;
        }
      }
    }
  }

  return {
    deepClonedBytes,
    retainedSharedBytes
  };
}
