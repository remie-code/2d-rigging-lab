# Wave36 Domain D Review-Sylph Re-review

Date: 2026-06-03
Target: `wave36-editor-bundle-export-import-workflow`
Verdict: `pass`

Clean-context re-review after Undine authorized the narrow Domain D scope expansion for `apps/editor/src/app/editor-app.ts`.

Review used basis docs, Domain A/B/C final/review artifacts, package/validator contracts, policy docs, fixture/traceability docs, current changed files, and current diffs directly. It did not rely on Gnome/Orch summary as the sole source.

## Scope Reviewed

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/editor-session/imported-portable-bundle-byte-registration.ts`
- `apps/editor/src/editor-session/persistent-byte-restore.ts`
- `apps/editor/src/editor-session/index.ts`
- `apps/editor/src/editor-workflow/portable-bundle-workflow.ts`
- `apps/editor/src/editor-workflow/portable-bundle-workflow.test.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/ui/project-persistence/project-persistence-panel.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/viewer-runtime/viewer-runtime-summary.ts`

## Findings

Blocking: none.

Warning: none.

Advisory:

- Browser-level download/file-input smoke is still deferred to Domain E. Domain D now wires the mounted app callback path (`apps/editor/src/app/editor-app.ts:188`, `apps/editor/src/app/editor-app.ts:199`) and the focused tests cover workflow/session/UI surfaces, but no desktop/mobile e2e in this domain proves the actual browser download and selected-file import gesture.

## Lane Results

Design / Development Compliance: `pass`

- Scope is now valid: `apps/editor/src/app/editor-app.ts` was explicitly authorized; `git diff -- apps/editor/src/styles/editor.css` remains empty; no manifest/lockfile diff was found.
- Export uses Domain B `exportPortablePackageBundleV0` without package-format redesign (`apps/editor/src/editor-workflow/portable-bundle-workflow.ts:75`). The Domain D `requiresReupload` predicate rejects refs missing from current-session package-local byte evidence before any bundle is returned (`apps/editor/src/editor-workflow/portable-bundle-workflow.ts:78`).
- Export failure is a truthful `portableExportFailed` result (`apps/editor/src/editor-workflow/portable-bundle-workflow.ts:90`), and the mounted app triggers Blob/object URL download only after `portableExported` (`apps/editor/src/app/editor-app.ts:192`, `apps/editor/src/app/editor-app.ts:271`).
- Import verifies through Domain B first (`apps/editor/src/editor-workflow/portable-bundle-workflow.ts:101`), then registers verified bytes into current-session authoring bytes and persistent byte storage (`apps/editor/src/editor-session/imported-portable-bundle-byte-registration.ts:69`, `apps/editor/src/editor-session/imported-portable-bundle-byte-registration.ts:78`).
- Failed import does not replace project metadata/session state because controller state replacement is gated on `portableImported` (`apps/editor/src/editor-workflow/workflow-controller.ts:1277`).
- `index.ts` changes are barrel-only (`apps/editor/src/editor-session/index.ts:10`, `apps/editor/src/editor-workflow/index.ts:10`). New source files have single responsibilities.

Test Adequacy: `pass`

- Successful export/import covers current-session byte availability and persistent byte storage (`apps/editor/src/editor-workflow/portable-bundle-workflow.test.ts:22`).
- Metadata-only / requires-reupload export failure is covered and preserves current workflow state (`apps/editor/src/editor-workflow/portable-bundle-workflow.test.ts:78`).
- Invalid import failure is covered with no state replacement and no persistent byte write (`apps/editor/src/editor-workflow/portable-bundle-workflow.test.ts:103`).
- Focused tests passed locally: `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/portable-bundle-workflow.test.ts apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-state/editor-test-ids.test.ts` -> 4 files / 35 tests passed.

UI / Accessibility Truthfulness: `pass`

- Mounted app now passes `onExportPortableBundle` and `onImportPortableBundleText` callbacks to the shell (`apps/editor/src/app/editor-app.ts:188`, `apps/editor/src/app/editor-app.ts:199`), and the shell passes them to the project persistence panel (`apps/editor/src/ui/app-shell/app-shell.ts:324`, `apps/editor/src/ui/app-shell/app-shell.ts:327`).
- Export is disabled when no package is loaded or callback is absent; import is disabled only when callback is absent (`apps/editor/src/ui/project-persistence/project-persistence-panel.ts:50`, `apps/editor/src/ui/project-persistence/project-persistence-panel.ts:56`).
- UI wording stays truthful: `Export bundle`, `Import bundle JSON`, `Portable JSON bundle v0`, and `same-origin browser-local IndexedDB` (`apps/editor/src/ui/project-persistence/project-persistence-panel.ts:48`, `apps/editor/src/ui/project-persistence/project-persistence-panel.ts:101`, `apps/editor/src/ui/project-persistence/project-persistence-panel.ts:284`, `apps/editor/src/ui/project-persistence/project-persistence-panel.ts:291`).
- Reviewed UI text does not imply PSD parse, image decode, ZIP/archive standard, filesystem persistence, full renderer, pixel guarantee, or Cubism compatibility.

Orchestration Compliance: `pass`

- Reviewer stayed source read-only and updated only this review artifact.
- The previous escalation condition was resolved by Undine's explicit `apps/editor/src/app/editor-app.ts` scope expansion.
- No broad redesign, forbidden CSS edit, dependency expansion, package-format contract redesign, validator broad implementation, parser/decode, File System Access API, drag-drop, or ZIP/archive dependency was found in the reviewed Domain D diff.

## Verification Performed

- `git status --short -uall`: confirmed mixed Wave36 worktree; Domain D review scoped to listed files.
- `git diff -- apps/editor/src/styles/editor.css`: empty.
- `git diff --check -- apps/editor/src/app/editor-app.ts apps/editor/src/editor-session apps/editor/src/editor-workflow apps/editor/src/editor-state apps/editor/src/ui`: pass with LF/CRLF warnings only.
- Focused forbidden API/dependency scan: no `jszip`/archive dependency, File System Access API, image decode API, or new manifest/lockfile diff in reviewed scope.
- Focused vitest command above: pass, 4 files / 35 tests.
- `pnpm.cmd typecheck`: pass.

## Remaining Issues

- No Domain D fix-required issues.
- Domain E should still provide desktop/mobile e2e evidence for actual browser export/download and import after file selection, as Wave36 planned.

## User-Decision Points

None.

Review artifact updated: `discussion/implementation/reviews/wave36/wave36-domain-d-review-sylph.md`
