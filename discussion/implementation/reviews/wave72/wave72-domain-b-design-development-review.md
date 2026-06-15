# Wave72 Domain B Design / Development Compliance Review

## Verdict

pass

Re-review after Gnome fix loop 1: pass.

## Scope Reviewed

Domain reviewed: `wave72-portable-project-save-load-editor-wiring`.

Reviewed independently from:

- `discussion/implementation/orchestration/wave72-plan.md` sections 3, 5, 7.3, 7.4, 10, 14, 15, 16.
- `discussion/development_convention/ux-backed-package-logic-authority.md`.
- `discussion/development_convention/source-file-organization-policy.md`.
- `discussion/development_convention/dependency-policy.md`.
- `discussion/development_convention/operation-policy.md`.
- `discussion/development_convention/schema-and-id-conventions.md`.
- `discussion/design/screen-design/screens/project-storage-task.md`.
- `discussion/design/screen-design/screens/authoring-workspace.md`.
- `discussion/design/screen-design/components/toolbox.md`.
- `discussion/implementation/waves/wave72/wave72-domain-b-portable-project-save-load-editor-wiring-report.md`.
- Domain B source and tests listed in the Orch-Sylph review assignment, including fix-loop changes in `apps/editor/e2e/portable-project-save-load.e2e.spec.ts`, `apps/editor/src/workspace/app-bar.tsx`, `apps/editor/src/workspace/app-bar.test.ts`, `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`, and `apps/editor/src/workspace/project-storage/project-storage-screen.test.ts`.

Parallel Domain A rotation-edit changes were not reviewed except where they affect shared build/typecheck and save/load preservation.

## Findings

No blocking findings.

## Compliance Notes

- Architecture and module boundaries comply. Editor storage code depends on `@private-2d-rigging-lab/authoring-core` in `apps/editor/src/features/project-storage/model/editor-project-storage.ts:1`, while the `package-format` portable bundle dependency stays inside the authoring-core adapter at `packages/authoring-core/src/portable-project-bundle.ts:1`. I found no direct `apps/editor` dependency on `@private-2d-rigging-lab/package-format`.
- Package-format scope is narrow. Domain B adds authoring-core adapter files and barrel exports only; `packages/authoring-core/src/index.ts:6` and `packages/authoring-core/src/index.ts:7` are re-exports, not implementation logic.
- Operation policy is respected for this domain. Save/export materializes package data without editing the active model, and load/import replaces the session at `apps/editor/src/features/editor-session/editor-session-context.tsx:548` rather than applying GUI model edits outside Operation Core.
- Load reset invariants are covered in code: imported session replacement occurs at `apps/editor/src/features/editor-session/editor-session-context.tsx:554`, history reset at `apps/editor/src/features/editor-session/editor-session-context.tsx:556`, and transient editor-local reset at `apps/editor/src/features/editor-session/editor-session-context.tsx:559`.
- Binary byte preservation is handled through the existing portable bundle path. Export builds the bundle from registered authoring-session binary file entries in `packages/authoring-core/src/portable-project-bundle.ts:56`, and import hydrates session binary assets from verified imported entries in `packages/authoring-core/src/portable-project-bundle.ts:106`.
- Error classification is structured and user-visible. The editor storage service maps invalid JSON/schema, missing bytes, and digest/byte-length failures at `apps/editor/src/features/project-storage/model/editor-project-storage.ts:143`, and Project Storage renders `errorCode` / issue details at `apps/editor/src/workspace/project-storage/project-storage-screen.tsx:131`.
- UI responsibility split is acceptable for v0. App Bar exposes Open/Save via icon buttons and a plain JSON file input at `apps/editor/src/workspace/app-bar.tsx:114`; the Project Storage task exposes status and errors without raw file-set/evidence overload at `apps/editor/src/workspace/project-storage/project-storage-screen.tsx:23`.
- Forbidden scope was not found in the reviewed files: no ZIP/archive/native FS/File System Access API/directory picker/drag-drop/browser-local save slot/cloud/viewer/runtime/mesh algorithm implementation was introduced.
- Dependency policy is satisfied: no manifest or lockfile drift was found, and `node scripts/check-dependencies.mjs` passed.
- Schema/ID conventions are acceptable for new local state/error values. New machine-readable statuses and error codes contain no spaces and are localized to the editor storage model.

## Fix Loop 1 Re-review Notes

- The new Playwright spec uses acceptable browser-transfer test paths: app Save through the existing browser download surface at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:61`, Playwright `download.saveAs` only for test artifact capture at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:65`, and upload through the existing hidden file input with `setInputFiles` at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:71`. I found no File System Access API, directory picker, drag-drop, browser-local slot, IndexedDB, localStorage, ZIP/archive, or cloud persistence.
- Exporting `createOpenProjectFileChangeHandler` from `apps/editor/src/workspace/app-bar.tsx:141` is acceptable for this loop. It is a small UI event adapter that clears the file input and forwards one selected `File` to the provider action; it contains no portable bundle parsing, package mutation, browser persistence, or package-format dependency. A separate model/helper module would be warranted only if more file-intake policy or storage behavior moves into it.
- The added Provider tests strengthen deterministic state invariants: load clears selection, parameter previews, collapsed/hidden part state, and history; failed invalid/missing/digest-mismatch imports preserve the current session and surface structured `projectStorage` error metadata.
- The extended Project Storage tests remain UI-surface checks over status, file name, byte counts, error code, issue code, and target path. They do not expose raw package file-set or evidence dumps in the normal UI.
- The optional `initialSession` Provider prop in `apps/editor/src/features/editor-session/editor-session-context.tsx:317` is acceptable as initial state injection for tests/bootstrap. It does not add a test-only runtime branch, bypass operations for GUI edits, or affect load/import replacement semantics.

## Warnings / Residual Risks

- Non-blocking hardening risk: `triggerPortableProjectDownload` can return `false` when browser download primitives are unavailable, but `saveProject` ignores that return value at `apps/editor/src/features/editor-session/editor-session-context.tsx:525` and still records saved status at `apps/editor/src/features/editor-session/editor-session-context.tsx:540`. This is not blocking for the current browser-based v0 path, but a later hardening pass should surface download-trigger failure as a save error.
- Project Storage close returns to the main workspace by setting the active entry to `import` in `apps/editor/src/workspace/project-storage/project-storage-screen.tsx:71`. It does not open the PSD import modal from this path, so it is not a functional blocker, but a future UX pass may want a neutral workspace entry for closing task screens.
- The new e2e path depends on existing PSD import, mesh, rig, and parameter UI surfaces. That is acceptable integration evidence for this wave, but unrelated UI regressions can make this save/load coverage noisy.

## Verification

- `pnpm.cmd exec vitest run packages/authoring-core/src/portable-project-bundle.test.ts apps/editor/src/features/project-storage/model/editor-project-storage.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/workspace/app-bar.test.ts apps/editor/src/workspace/project-storage/project-storage-screen.test.ts`
  - First sandbox run failed before collection with esbuild `spawn EPERM`.
  - Fix-loop re-run outside the sandbox passed in this review: 5 test files, 24 tests.
- `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/portable-project-save-load.e2e.spec.ts`
  - First sandbox run failed with `spawn EPERM`.
  - Re-run outside the sandbox passed: 1 test.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- <Fix loop 1 paths>`: passed; Git emitted CRLF normalization warnings only.

## User-Decision Points

None.
