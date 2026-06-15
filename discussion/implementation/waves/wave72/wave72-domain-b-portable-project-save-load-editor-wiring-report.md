# Wave72 Domain B: Portable Project Save/Load Editor Wiring Report

## Verdict

Implemented and ready for independent review.

## Files Changed

- `packages/authoring-core/src/package-document-from-authoring-session.ts`
- `packages/authoring-core/src/portable-project-bundle.ts`
- `packages/authoring-core/src/portable-project-bundle.test.ts`
- `packages/authoring-core/src/index.ts`
- `apps/editor/e2e/portable-project-save-load.e2e.spec.ts`
- `apps/editor/src/features/project-storage/model/browser-portable-project-transfer.ts`
- `apps/editor/src/features/project-storage/model/editor-project-storage.ts`
- `apps/editor/src/features/project-storage/model/editor-project-storage.test.ts`
- `apps/editor/src/features/project-storage/model/project-storage-state.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/workspace/app-bar.tsx`
- `apps/editor/src/workspace/app-bar.test.ts`
- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/workspace/project-storage/project-storage-screen.tsx`
- `apps/editor/src/workspace/project-storage/project-storage-screen.test.ts`
- `discussion/implementation/waves/wave72/wave72-domain-b-portable-project-save-load-editor-wiring-report.md`

No `apps/editor/package.json` dependency was added. Editor code imports portable project behavior through `@private-2d-rigging-lab/authoring-core`, not directly from `@private-2d-rigging-lab/package-format`.

## Validation Commands and Results

- `pnpm.cmd exec vitest run packages/authoring-core/src/portable-project-bundle.test.ts apps/editor/src/features/project-storage/model/editor-project-storage.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/workspace/app-bar.test.ts apps/editor/src/workspace/project-storage/project-storage-screen.test.ts`
  - First sandbox attempt failed before test collection with esbuild `spawn EPERM`.
  - Fix-loop/review re-run outside the sandbox passed: 5 test files, 24 tests.
- `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/portable-project-save-load.e2e.spec.ts`
  - First sandbox attempt failed with `spawn EPERM`.
  - Early fix-loop runs exposed timing/tool-mode issues in the new spec; after adding review-content waits and returning to Select mode before keyform assertions, the focused portable save/load E2E passed: 1 test.
- `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/psd-import.e2e.spec.ts -g "imports a fixture PSD"`
  - Used as a baseline while debugging the new E2E helper. The script ran the existing PSD import suite under the editor config and passed: 9 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `git diff --check -- apps/editor/e2e/portable-project-save-load.e2e.spec.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/workspace/app-bar.tsx apps/editor/src/workspace/app-bar.test.ts apps/editor/src/workspace/project-storage/project-storage-screen.test.ts discussion/implementation/waves/wave72/wave72-domain-b-portable-project-save-load-editor-wiring-report.md`
  - Passed. Git reported CRLF normalization warnings only.

## Fix Loop 1 Review Findings Addressed

- Spec Compliance: Added focused Playwright E2E evidence for PSD import, mesh generation/apply, drawable opacity keyform authoring, rotation deformer creation, parent warp creation, portable bundle browser download, page reload/reset, hidden file input upload, and restored tree/render/mesh/keyform/deformer assertions.
- Test Adequacy: Added App Bar Open hidden-input handoff coverage by testing the same exported change handler used by the component.
- Test Adequacy: Added Provider invalid bundle, missing payload, and digest mismatch import tests proving current session preservation and storage error classification metadata.
- Test Adequacy: Extended Provider load reset coverage for collapsed parts and editor-hidden parts through public context actions.
- Test Adequacy: Extended Project Storage screen rendering coverage for saved, loaded, and error states, including issue code and target path visibility.
- Deferred/Escalated: Mesh/rig draft and feedback reset branches remain implementation-inspection-only because there is no narrow deterministic public Provider setup path that avoids unrelated mesh/rig UI behavior. The new E2E covers committed mesh and rig state restoration instead.

## Basis Coverage Self-Report

- Reused existing portable bundle v0 APIs through a narrow authoring-core adapter.
- Added authoring-core package document materialization from an `AuthoringSession` for save/export.
- Added authoring-core portable bundle import hydration for materialized binary bytes referenced by source assets and texture atlas textures.
- Added Editor storage service for export/import and explicit invalid bundle, missing bytes, and digest mismatch classification.
- Wired App Bar Open Project to a hidden JSON file input and portable bundle import.
- Wired App Bar Save Project to portable bundle export and browser JSON download.
- Added Project Storage task surface for discoverable status, operation counts, file name, and errors.
- Loading a project replaces the `AuthoringSession`, resets history, and clears transient editor-local state.
- Save status now derives from project identity, dirty state, and storage operation state instead of remaining hardcoded to only `Untitled model`.

## Intentionally Deferred Basis Items

- No rotation deformer editing UI or operation work was implemented in this domain.
- No browser-local save slots, IndexedDB storage, ZIP/archive format, File System Access API, native filesystem picker, directory picker, drag-drop, cloud persistence, cross-profile persistence, Viewer, or Runtime View was added.
- No package-format redesign or new save format was introduced.

## User-Facing UX Trace

- App Bar now displays project identity, save/open status, and surface label.
- App Bar Open Project opens a JSON file picker for portable bundle files.
- App Bar Save Project exports the current project and triggers a browser download.
- Project Storage task surface shows current project name, package id, revision, save state, binary asset count, operation status, file name, bundle payload count, loaded byte count, and validation issues.
- Focused E2E now exercises browser download capture and hidden input upload for the portable project path.

## Portable Bundle Open/Save UX Trace

- Save path: `saveProject` -> `exportEditorProjectBundle` -> `exportAuthoringSessionPortableBundle` -> `exportPortablePackageBundleV0` -> browser download.
- Open path: hidden file input -> `readPortableProjectFileText` -> `openProjectFromPortableBundle` -> `importEditorProjectBundle` -> `importAuthoringSessionPortableBundle` -> `importPortablePackageBundleV0`.
- Browser transfer uses `Blob`, object URL, and a temporary anchor only. It does not use forbidden native filesystem or local slot mechanisms.

## Session Hydration/Load Replacement Trace

- Import creates a clean `AuthoringSession` with `dirty: false`.
- Provider state is replaced with imported session, an empty editor-session history, and the imported package document as the new save base.
- Load clears mesh drafts, rig drafts, rig feedback, parameter feedback, selection, active parameter, preview parameter values, collapsed parts, hidden parts, and PSD import modal state.
- Failed import preserves the current project and updates storage status to an error state.

## Authoring State Preservation Trace

- Authoring-core round-trip test covers texture bytes, mesh, warp deformer, rotation deformer, parameters, and keyforms through package document and portable bundle.
- Editor provider test covers load replacement and transient state clearing.
- Save test verifies dirty state becomes saved after a portable bundle export.
- Playwright E2E verifies authored mesh, rotation+warp deformer hierarchy, opacity keyform state, and renderable artwork survive save, reload, and open.

## Binary Asset Preservation Evidence

- `packages/authoring-core/src/portable-project-bundle.test.ts` verifies imported `binaryAssets.fileEntries` contains the original texture bytes and index metadata after portable bundle import.
- `apps/editor/src/features/project-storage/model/editor-project-storage.test.ts` verifies Editor storage export/import preserves texture bytes and reports one binary payload.
- Missing byte and digest mismatch tests verify user-visible error classification from portable bundle failures.
- Provider-level tests now verify invalid bundle, missing payload, and digest mismatch failures preserve the current session while exposing `projectStorage` error metadata.

## Browser-Local Save Exclusion Evidence

- No IndexedDB, localStorage save slot, cache storage, File System Access API, directory picker, or drag-drop path was added.
- Browser download/upload is limited to portable bundle JSON export and import.

## Must-Not Compliance Evidence

- No rotation deformer editing implementation was added by Domain B.
- No new save format was added; portable bundle v0 is reused.
- No ZIP/archive/native filesystem implementation was added.
- No broad package-format redesign was added.
- No mesh generation algorithm changes were made.
- No direct Editor dependency on package-format was required.

## Residual Risk Classification

- Low: Domain B focused unit/component coverage passes and exercises save, load, error classification, binary preservation, App Bar wiring, and Project Storage rendering.
- Low: Focused browser E2E coverage now passes for download/upload save-load restoration of authored mesh, deformer, keyform, tree, and render state.
- Low: Full repo typecheck passes in the current worktree.
- Medium: Browser E2E uses the existing PSD fixture and UI path, so it is slower and can fail if unrelated PSD import, mesh, rig, or parameter UI contracts regress.
