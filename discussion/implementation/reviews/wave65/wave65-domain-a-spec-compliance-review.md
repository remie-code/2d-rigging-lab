# Wave65 Domain A Spec Compliance Review

## Metadata

- Review lane: Spec Compliance Review
- Target: Wave65 Domain A, Editor Undo / Redo History Foundation v0
- Verdict: pass
- Reviewer: independent Review-Sylph
- Review phase: final re-review after review-loop fixes

## Findings

No blocking findings.

Previously blocking finding A1 is resolved. `EditorSessionProvider` now stores package session and history together in `EditorSessionState` (`apps/editor/src/features/editor-session/editor-session-context.tsx:123`) and initializes that combined state once (`apps/editor/src/features/editor-session/editor-session-context.tsx:230`). Command commit handling reads `editorStateRef.current`, computes the result once, and calls `setEditorSessionState` with a concrete next state only when committed (`apps/editor/src/features/editor-session/editor-session-context.tsx:337`). I found no remaining `setSession((currentSession) => ...)` history mutation path in the reviewed Domain A source.

## Spec Compliance Evidence

- StrictMode/history mutation fix: `setEditorSessionState` takes a concrete next state and updates the latest-state ref plus React state (`apps/editor/src/features/editor-session/editor-session-context.tsx:235`). Commit paths no longer record history inside React state updater callbacks.
- Existing editor command commits are undoable/redoable: `runCommandWithHistory` wraps current editor session/history through `commitEditorSessionCommandWithHistory` and stores the resulting session/history on committed results (`apps/editor/src/features/editor-session/editor-session-context.tsx:337`; `apps/editor/src/features/editor-session/model/editor-session-history.ts:114`).
- Rejected/no-op operations are not recorded: `commitEditorSessionCommandWithHistory` returns the original history unchanged when `result.committed` is false (`apps/editor/src/features/editor-session/model/editor-session-history.ts:125`).
- Redo clears on new commit: `recordEditorSessionCommit` always returns `redoStack: []` for a new commit (`apps/editor/src/features/editor-session/model/editor-session-history.ts:56`).
- Scrub and non-destructive UI state are not undoable: active parameter scrub/reset only update `parameterValues` (`apps/editor/src/features/editor-session/editor-session-context.tsx:528`, `549`); selection, collapse, editor visibility, draft preview/cancel/update paths do not call history recording (`apps/editor/src/features/editor-session/editor-session-context.tsx:571`, `584`, `616`, `621`, `628`, `637`, `667`, `695`, `710`, `716`, `722`, `728`).
- `1 gesture = 1 undo entry`: gesture commit uses current session/history once and stores one committed outcome (`apps/editor/src/features/editor-session/editor-session-context.tsx:876`); the gesture controller still gates duplicate pointerup commits with `commitOnce` (`apps/editor/src/features/editor-session/model/editor-session-gesture-commit.ts:45`).
- App Bar acceptance remains satisfied: Undo / Redo are icon buttons with disabled state, short labels, click handlers, and bottom tooltips (`apps/editor/src/workspace/app-bar.tsx:70`, `79`).
- Forbidden scope / forbidden approach: reviewed Domain A target source does not add package-wide inverse operations, `modelDiff` inversion, keyboard shortcuts, persistence expansion, Canvas editing body, Mesh V2.5 logic, or package changes. Workspace-wide package/Mesh V2.5 changes exist, but they are outside this Domain A target and were not assessed as Domain A work.

## Test Evidence Inspected

- StrictMode provider integration test verifies one committed provider action creates one Undo entry, then Undo/Redo traverse once (`apps/editor/src/features/editor-session/editor-session-context-history.test.ts:17`).
- Provider integration test verifies active parameter scrub/reset do not dirty history (`apps/editor/src/features/editor-session/editor-session-context-history.test.ts:52`).
- Pure history tests cover bounded stack, redo invalidation, keyform add/update/delete restore, and rejected command no-record behavior (`apps/editor/src/features/editor-session/model/editor-session-history.test.ts:35`, `75`, `116`, `145`).
- Gesture tests cover pointermove preview without commit/history and single-use `commitOnce` (`apps/editor/src/features/editor-session/model/editor-session-gesture-commit.test.ts:31`, `80`).
- App Bar tests cover initial disabled state, enabled state, and Undo/Redo click wiring (`apps/editor/src/workspace/app-bar.test.ts:83`, `92`).

## Verification Run

- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/editor-session-history.test.ts apps/editor/src/features/editor-session/model/editor-session-gesture-commit.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/workspace/app-bar.test.ts apps/editor/src/workspace/parameter-manager/parameter-manager-screen.test.ts`
  - Sandbox run failed with Vite/esbuild `spawn EPERM`.
  - Approved rerun passed: 5 files / 15 tests.
- `pnpm.cmd --dir apps/editor typecheck`
  - Pass.
- `node scripts/check-source-organization.mjs`
  - Pass: `Source organization guard passed.`
- `git diff --check -- apps/editor/src/features/editor-session apps/editor/src/workspace discussion/implementation/waves/wave65/wave65-domain-a-editor-undo-redo-history-foundation-report.md discussion/implementation/reviews/wave65/wave65-domain-a-spec-compliance-review.md`
  - Pass with LF-to-CRLF working-copy warnings on tracked app files only.

## Residual Risks

- Snapshot undo still moves `packageRevision` / `authoringRevision` backward. That matches the accepted editor-local v0 snapshot approach and is not a durable operation-log replay model.
- Undo restores package/model session only. Selection, active tool, scrub value, collapsed state, overlay/editor visibility toggles, and draft previews remain intentionally outside undo history.
- Full root typecheck/full test suites were not run for this lane; verification was scoped to Domain A focused tests, editor typecheck, source organization guard, and scoped diff check.

## Final Verdict

pass
