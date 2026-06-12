# Wave65 Domain A Report: Editor Undo / Redo History Foundation

## Status

done

## Review Loop 1 Fix Summary

- Spec / design blocking fix:
  - `EditorSessionProvider` の `session` と `history` を combined `EditorSessionState` にまとめた。
  - `setSession((currentSession) => ...)` updater 内で `setHistoryState` や feedback state を mutate していた経路を撤去した。
  - Command / gesture commit は event handler 側で一度だけ評価し、committed result の場合だけ `{ session, history }` を `setEditorSessionState` へ渡す。
  - `StrictMode` 開発時の updater 再実行で history entry が重複するリスクを除去した。
- Test adequacy fixes:
  - App Bar test に Undo / Redo enabled state と click handler wiring を追加した。
  - Provider integration test を追加し、`StrictMode` 下で 1 committed provider action が 1 Undo entry だけを作ることを検証した。
  - Provider integration test で `setActiveParameterValue` と `resetActiveParameterValue` が Undo history を dirty にしないことを検証した。

## Summary

- Editor-local in-memory Undo / Redo v0 を `EditorSessionProvider` 側へ追加した。
- History entry は package/model mutation の前後 `AuthoringSession` snapshot として保持する。`modelDiff` inverse や package-wide inverse operation は作っていない。
- Existing editor command commit result は provider の command wrapper 経由で history に積む。Rejected/no-op result は積まない。
- Parameter scrub / selection / collapse / editor-only visibility / draft preview は history entry を作らない。
- App Bar に Undo / Redo icon button を追加し、初期 disabled state と短い tooltip label を持たせた。
- Domain C 向けに `EditorSessionGestureCommit` と single-use `commitOnce` controller を追加した。Pointermove preview と pointerup commit を別 API にし、1 gesture = 1 history entry の境界を使える。

## Implementation Decisions

- Undo / Redo mechanism:
  - `apps/editor/src/features/editor-session/model/editor-session-history.ts`
  - bounded stack default depth: 50
  - new commit clears redo stack
  - undo restores `entry.before`, redo restores `entry.after`
- Provider integration:
  - `EditorSessionProvider` owns combined `{ session, history }` editor state and an `editorStateRef` for latest event-handler reads.
  - `applyCommand`, `applyRigCommand`, `editKeyformKey`, parameter definition commands, mesh apply, structure move, PSD import success path, and rig/deformer commits record history only on `result.committed`.
  - History recording is no longer a side effect inside React state updater callbacks.
  - Undo / Redo clears transient mesh/rig drafts and feedback, but does not make selection/scrub/panel state itself undoable.
- UI:
  - `apps/editor/src/workspace/app-bar.tsx`
  - Undo / Redo use `Undo2` / `Redo2` from lucide-react.
  - Keyboard shortcuts intentionally not implemented.
- Gesture contract:
  - `apps/editor/src/features/editor-session/model/editor-session-gesture-commit.ts`
  - `previewEditorSessionGesture` does not run commit/history.
  - `commitEditorSessionGestureWithHistory` records one history entry for one committed gesture command.
  - `createEditorSessionGestureCommitController(...).commitOnce(...)` prevents duplicate pointerup commit for a single gesture controller.

## Changed Files

- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/features/editor-session/model/editor-session-history.ts`
- `apps/editor/src/features/editor-session/model/editor-session-history.test.ts`
- `apps/editor/src/features/editor-session/model/editor-session-gesture-commit.ts`
- `apps/editor/src/features/editor-session/model/editor-session-gesture-commit.test.ts`
- `apps/editor/src/workspace/app-bar.tsx`
- `apps/editor/src/workspace/app-bar.test.ts`
- `apps/editor/src/workspace/parameter-manager/parameter-manager-screen.test.ts`
  - Type-only Fake DOM helper casts so `apps/editor` typecheck passes with current React/TS types. Runtime behavior unchanged.

## Acceptance Coverage

- Keyform add/update/delete Undo / Redo:
  - Covered by `editor-session-history.test.ts`.
- Rejected operation does not dirty history:
  - Covered by rejected `updateCurrent` keyform command in `editor-session-history.test.ts`.
- Scrub is not undoable:
  - Provider keeps scrub in `parameterValues`; `setActiveParameterValue` / `resetActiveParameterValue` do not call history recording.
  - Covered by `editor-session-context-history.test.ts`.
- Redo clears on new commit:
  - Covered by `editor-session-history.test.ts`.
- Thin Domain C gesture commit API:
  - Covered by `editor-session-gesture-commit.test.ts`; preview does not commit, `commitOnce` commits one time and creates one entry.
- UI disabled state:
  - Covered by `app-bar.test.ts` for initial disabled Undo / Redo.
- UI enabled state and click wiring:
  - Covered by `app-bar.test.ts` with mocked `useEditorSession` and `IconButton` props.
- StrictMode provider integration:
  - Covered by `editor-session-context-history.test.ts`; one provider commit creates one undo entry, so one Undo leaves `canUndo=false` and `canRedo=true`.

## Verification

- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/editor-session-history.test.ts apps/editor/src/features/editor-session/model/editor-session-gesture-commit.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/workspace/app-bar.test.ts apps/editor/src/workspace/parameter-manager/parameter-manager-screen.test.ts`
  - Pass: 5 files, 15 tests.
  - Note: initial sandbox run hit known Vite/esbuild `spawn EPERM`; approved rerun passed.
- `pnpm.cmd --dir apps/editor typecheck`
  - Pass.
- `node scripts/check-source-organization.mjs`
  - Pass: `Source organization guard passed.`
- `git diff --check -- apps/editor/src/features/editor-session apps/editor/src/workspace discussion/implementation/waves/wave65/wave65-domain-a-editor-undo-redo-history-foundation-report.md`
  - Pass with LF-to-CRLF working-copy warnings only.

## Domain B / C Handoff

- Domain B:
  - Parameter scrub remains preview-only editor-local state and will not create history entries.
  - Keyform marker jump / scrub work should continue to use `setActiveParameterValue` for preview and `editKeyformKey` for committed Add/Update/Delete.
- Domain C:
  - Use `createEditorSessionGestureCommit` for pointer gesture wiring.
  - Use `previewEditorSessionGesture` during pointermove if a model-derived preview helper is needed.
  - Use a per-gesture `createEditorSessionGestureCommitController(...).commitOnce(...)` on pointerup to guarantee one committed gesture produces at most one history entry.
  - The commit callback should still call existing editor command wrappers, especially `editKeyformKey` for Warp `controlPointOffsets`, not mutate package graph directly.

## Residual Risks

- Snapshot history moves `packageRevision` / `authoringRevision` backward on undo. This is accepted for editor-local v0 but is not a durable operation-log replay model.
- Undo restores package/model session only. Selection, active tool, scrub value, collapsed state, and overlay toggles are intentionally not undoable. Stale selection after undoing a create is possible but current projections tolerate missing selected targets.
- PSD import success is recorded as one snapshot entry, but editor-hidden imported part state is editor-local and not restored by undo.
- Full root `pnpm typecheck` and full test suites were not run; verification was scoped to required editor typecheck, focused tests, and source organization guard.
