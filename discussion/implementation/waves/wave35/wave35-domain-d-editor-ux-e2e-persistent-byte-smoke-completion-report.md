# Wave35 Domain D Completion Report: Editor UX and E2E Persistent Byte Smoke

Date: 2026-06-03

verdict: `done`

## Files Changed

- `apps/editor/e2e/byte-intake-smoke.mjs`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/editor-state/binary-byte-intake-state.ts`
- `apps/editor/src/editor-state/source-intake-view-model.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`
- `apps/editor/src/ui/project-persistence/project-persistence-panel.ts`
- `apps/editor/src/ui/source-assets/source-intake-form.ts`
- `apps/editor/src/ui/source-assets/source-intake-panel.test.ts`
- `discussion/implementation/waves/wave35/wave35-domain-d-editor-ux-e2e-persistent-byte-smoke-completion-report.md`

## Implementation Summary

- Wired the app `Load saved` button through `loadProjectWithPersistentBytes()` so user-facing browser-local load uses the async IndexedDB restore path instead of staying metadata-only.
- Preserved hydrated AI transcript state during async persistent-byte load; the first existing e2e suite run exposed that the load projection was overwriting loaded AI transcript state.
- Updated source intake and binary availability labels to describe same-origin browser-local IndexedDB as best-effort byte storage and to avoid portable archive/filesystem persistence claims.
- Added project persistence summary text for persistent byte restore outcomes: restored count, checked count, backend states, and `persistentByteStorage.*` issue codes.
- Strengthened `byte-intake-smoke.mjs` to run desktop and mobile real-browser checks for:
  - file intake with actual bytes,
  - IndexedDB persistent byte record creation,
  - browser-local save/load restoring bytes without reupload,
  - saved project JSON excluding raw bytes/base64 sentinel and raw payload fields,
  - corrupt IndexedDB bytes falling back to `requiresReupload` with `persistentByteStorage.digest.mismatch`,
  - missing IndexedDB record falling back to `requiresReupload` with `persistentByteStorage.record.missing`,
  - unavailable/unsupported IndexedDB falling back to `requiresReupload` with `persistentByteStorage.backend.unavailable`,
  - validator-facing UI observation via `validator bytesAvailability=available` or `requiresReupload`.

## Verification

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts apps/editor/src/ui/source-assets/source-intake-panel.test.ts apps/editor/src/editor-state/binary-byte-intake-state.test.ts`
  - pass, 4 files / 63 tests
- `pnpm.cmd typecheck`
  - pass
- `node apps\editor\e2e\byte-intake-smoke.mjs`
  - pass; desktop and mobile persistent byte smoke completed
- `pnpm.cmd test:e2e`
  - pass; desktop and mobile editor smoke completed
- `git diff --check -- apps\editor\e2e\byte-intake-smoke.mjs apps\editor\src\app\editor-app.ts apps\editor\src\editor-state\binary-byte-intake-state.ts apps\editor\src\editor-state\source-intake-view-model.ts apps\editor\src\editor-workflow\workflow-controller.ts apps\editor\src\editor-workflow\workflow-controller.test.ts apps\editor\src\ui\project-persistence\project-persistence-panel.ts apps\editor\src\ui\source-assets\source-intake-form.ts apps\editor\src\ui\source-assets\source-intake-panel.test.ts`
  - pass; Git emitted LF-to-CRLF working-copy warnings only
- `git status --short -uall package.json pnpm-lock.yaml pnpm-workspace.yaml apps\editor\package.json packages\package-format\package.json packages\validator-core\package.json packages\contracts\package.json`
  - empty; no dependency manifest or lockfile changes
- Forbidden-scope scan over Domain D changed files:
  - hits were limited to negative assertions and truthful non-goal wording such as no parser/decode/archive/full renderer/pixel oracle claims.
  - no File System Access API, drag-drop, archive/export/import, parser, image decode, external dependency, Cubism compatibility, full renderer, or pixel oracle implementation was introduced.

Environment note: sandboxed PowerShell startup failed earlier with `windows sandbox: spawn setup refresh`, so inspection and verification commands were run through the approved escalated command path.

## Forbidden Scope / Dependency Confirmation

- No `packages/**` source was edited by this Domain D implementation.
- Existing package-format and validator-core dirty/untracked files remain from Wave35 Domains A/C and were not modified here.
- No package manifest, workspace manifest, or lockfile was changed.
- No archive persistence, File System Access API, directory picker, drag-drop, parser, image decode, Cubism SDK/Core, Cubism compatibility claim, full renderer behavior, pixel oracle, cloud persistence, or external dependency was added.
- UI text continues to scope persistence to same-origin browser-local IndexedDB and best-effort restore after verification.

## Remaining Issues

- Review-Sylph should still run independent design/development compliance and test adequacy review.
- IndexedDB persistence remains browser-local and best-effort; it is not portable project archive persistence or filesystem persistence.
- `git diff --check` produced LF-to-CRLF working-copy warnings on checked files, but no whitespace errors.

## Fix Loop 1

- Updated binary byte availability wording so initial file intake reports only current-session byte availability plus possible best-effort same-origin IndexedDB persistence, without claiming a reload restore was already verified.
- Kept browser-local load wording explicit that restored IndexedDB bytes were verified during load before being shown as available.
- Strengthened focused unit/e2e assertions to distinguish current-session availability from browser-local restored availability.

Verification:

- `pnpm.cmd exec vitest run apps/editor/src/editor-state/binary-byte-intake-state.test.ts`
  - pass, 1 file / 4 tests
- `node apps\editor\e2e\byte-intake-smoke.mjs`
  - pass, desktop and mobile persistent byte smoke completed
- `pnpm.cmd typecheck`
  - pass
- `git diff --check -- apps\editor\src\editor-state\binary-byte-intake-state.ts apps\editor\src\editor-state\binary-byte-intake-state.test.ts apps\editor\e2e\byte-intake-smoke.mjs discussion\implementation\waves\wave35\wave35-domain-d-editor-ux-e2e-persistent-byte-smoke-completion-report.md`
  - pass; Git emitted LF-to-CRLF working-copy warnings only
- `git status --short -uall package.json pnpm-lock.yaml pnpm-workspace.yaml apps\editor\package.json packages\package-format\package.json packages\validator-core\package.json packages\contracts\package.json`
  - empty; no dependency manifest or lockfile changes

## User Decision Points

None.

Escalation would be needed only if later work expands into archive import/export, File System Access API, drag-drop, parser/image decode dependencies, cross-browser-profile guarantees, cloud persistence, Cubism compatibility, full renderer behavior, or pixel oracle claims.
