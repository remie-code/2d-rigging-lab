# Wave90 Domain B Editor Workspace Integration Report

## Verdict

`pass`

Domain B Fix Loop 2 の narrow in-scope blocker と、後続の escalation-boundary parser/schema-validation blocker は修正済み。Independent re-review lanes は `pass`。Focused authoring-core/editor tests、root typecheck、dependency/source guards は通過している。editor app へ `@private-2d-rigging-lab/package-format` 直接 dependency は追加していない。

## Implementation Summary

- Added app-layer workspace storage under `apps/editor/src/features/workspace-storage/model/`.
  - Browser File System Access capability detection.
  - Directory picker abstraction.
  - permission query/request handling.
  - permission denied/lost error normalization.
  - safe package-relative nested traversal and traversal rejection.
  - text file-set read/write.
  - binary read/write with Domain A save-plan `write` decisions only.
  - fake directory/file handles for deterministic tests.
- Integrated workspace storage into `EditorSessionProvider`.
  - App starts with no open workspace unless tests opt into an initial workspace.
  - `Save Workspace` writes the workspace file-set; it does not trigger Portable JSON download.
  - `Save As`, `Create Workspace`, `Open Workspace`, and Portable JSON import all route through workspace target creation/opening.
  - `Export Portable JSON` remains explicit and separate.
  - `openPsdImport`, PSD commit, Atlas Apply, and editing commands guard/no-op before a workspace exists.
- Reworked app shell routing.
  - Neutral `activeEntry: "workspace"` replaces `activeEntry: "import"` as home state.
  - Workspace Gate renders inside the existing Header shell and hides Toolbox/editing surfaces.
  - Dedicated screens Back/Close return to neutral Authoring Workspace.
- Reworked Header/Toolbox responsibility split.
  - Header owns Create/Open/Save/Save As/Portable JSON import/export and workspace identity/status.
  - Toolbox keeps Import PSD, Parameters, Variants, Texture Atlas, Validate, Viewer.
  - Project Storage was removed from Toolbox.
  - Header no longer duplicates Parameters / Texture Atlas / Validate / Viewer navigation.

## Fix Loop 1

- Added dirty replacement protection before `Open Workspace...` and `Import Portable JSON...`.
  - Dirty replacement now offers only Save-and-Open or Cancel.
  - Cancel preserves the current dirty session and avoids invoking the replacement picker/import path.
  - Save-and-Open persists the current workspace before replacing it.
- Added open-time workspace binary verification.
  - `openEditorWorkspace()` now rejects missing binary references before marking a workspace opened/saved.
  - `openEditorWorkspace()` now rejects digest-mismatched binary bytes when SHA-256 metadata is present.
  - Errors surface through the existing `EditorWorkspaceStorageError` path with explicit `workspace.binary.*` codes.
- Added integrated provider/session write-once coverage.
  - PSD import after a workspace is open writes the raw RGBA package path exactly once.
  - Texture Atlas Apply after a workspace is open writes the generated raw RGBA package path exactly once.
  - Later primary Save skips both verified binary entries instead of rewriting them.
- Kept the parser/schema-validation issue out of scope per Orch-Sylph boundary decision.
  - No app dependency on `@private-2d-rigging-lab/package-format` was added.
  - No package/dependency files or Domain A packages were edited.

## Fix Loop 2

- Narrowed open-time required binary verification to workspace-saved binary candidates only.
  - `texture-raster-v1` refs from the texture atlas remain required and digest-verified on open.
  - `source-original-v1` refs from source assets are still read/hydrated when bytes are present, but absence no longer fails Open Workspace.
- Added focused coverage for the Domain A save-plan behavior.
  - A workspace whose package document contains a source original `binaryAssetRef`, but whose directory intentionally lacks that source original file, now opens successfully when the texture raw RGBA file is present.
  - Existing missing/corrupt texture binary tests remain unchanged and passing.
- Parser/schema-validation boundary was left unresolved in Fix Loop 2 and is addressed by the boundary fix below.
  - No package/dependency edits were made.
  - No editor dependency on `@private-2d-rigging-lab/package-format` was added.

## Boundary Fix: Authoring-core Open Adapter

- Added `openAuthoringWorkspaceFromTextFileSet()` in `packages/authoring-core/src/workspace-open.ts`.
  - The adapter calls Domain A `parseWorkspacePackageDocumentFromFileSet()`, which validates `workspace.json` through `WorkspaceMetadataSchema` and delegates package file-set validation to `parsePackageDocumentFromFileSet()`.
  - It returns the parsed package document, hydrated `AuthoringSession`, editor hidden part ids, warnings, and binary registration targets so editor open can proceed without importing `@private-2d-rigging-lab/package-format`.
- Added `hydrateAuthoringWorkspaceSessionBinaryAssets()` and adapter-provided binary registration targets.
  - Source-original refs remain optional to hydrate when bytes exist.
  - Texture/raw RGBA and committed atlas texture refs remain marked `requiredForWorkspaceOpen` and are still verified by the editor open path before saved-state entry.
- Updated `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts`.
  - Removed the app-local `parseWorkspacePackageDocumentFromTextFileSet()` / JSON-map package reconstruction as the authoritative open path.
  - Open Workspace now calls the authoring-core adapter and wraps parser/schema failures as `workspace.invalidFileSet`.
  - Existing open-time missing/corrupt texture binary failures remain intact.
- Added tests for invalid `workspace.json` and invalid package file-set rejection at both the authoring-core adapter boundary and editor workspace-storage boundary.

## Files Changed

- `apps/editor/src/features/workspace-storage/model/fake-workspace-directory.ts`
- `apps/editor/src/features/workspace-storage/model/workspace-directory-io.ts`
- `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts`
- `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts`
- `apps/editor/src/features/workspace-storage/model/workspace-storage-state.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/state/editor-ui-store.ts`
- `apps/editor/src/workspace/app-bar.tsx`
- `apps/editor/src/workspace/app-bar.test.ts`
- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/workspace/authoring-workspace.test.ts`
- `apps/editor/src/workspace/workspace-data.ts`
- `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx`
- `apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`
- `apps/editor/src/workspace/task-view-entry-bar.tsx`
- `apps/editor/src/workspace/project-storage/project-storage-screen.tsx`
- `apps/editor/src/workspace/project-storage/project-storage-screen.test.ts`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
- `apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.ts`
- `apps/editor/src/workspace/diagnostics/diagnostics-screen.tsx`
- `apps/editor/src/workspace/diagnostics/diagnostics-screen.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `apps/editor/src/workspace/parameter-manager/parameter-manager-screen.tsx`
- `apps/editor/src/workspace/parameter-manager/parameter-manager-screen.test.ts`
- `packages/authoring-core/src/workspace-open.ts`
- `packages/authoring-core/src/workspace-open.test.ts`
- `packages/authoring-core/src/index.ts`
- `discussion/implementation/waves/wave90/_map.md`
- `discussion/implementation/waves/wave90/wave90-domain-b-editor-workspace-integration-report.md`

## Tests Run

- `pnpm.cmd exec vitest run apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/workspace/app-bar.test.ts apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts apps/editor/src/workspace/authoring-workspace.test.ts apps/editor/src/workspace/project-storage/project-storage-screen.test.ts apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts apps/editor/src/workspace/diagnostics/diagnostics-screen.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/parameter-manager/parameter-manager-screen.test.ts --reporter=dot`
  - Pass: 10 files, 80 tests.
- `pnpm.cmd exec vitest run apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts --reporter=dot`
  - Pass: 1 file, 10 tests.
- `pnpm.cmd exec vitest run packages/authoring-core/src/workspace-open.test.ts apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts --reporter=dot`
  - Initial sandbox run hit known Vite/esbuild `spawn EPERM`.
  - Escalated rerun passed: 2 files, 15 tests.
- `pnpm.cmd exec vitest run packages/authoring-core/src/workspace-open.test.ts packages/authoring-core/src/workspace-save.test.ts apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/workspace/app-bar.test.ts apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts apps/editor/src/workspace/authoring-workspace.test.ts apps/editor/src/workspace/project-storage/project-storage-screen.test.ts apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts apps/editor/src/workspace/diagnostics/diagnostics-screen.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/parameter-manager/parameter-manager-screen.test.ts --reporter=dot`
  - Pass: 12 files, 86 tests.
- `pnpm.cmd typecheck`
  - Pass.
- `pnpm.cmd --dir apps/editor typecheck`
  - Fail: remaining errors are existing app-level type errors in dynamics/editor-diagnostics model/project-storage test/canvas/panels/viewer fixture areas; no workspace-storage Fix Loop 2 errors were reported.
- `pnpm.cmd run check:deps`
  - Pass.
- `pnpm.cmd run check:source`
  - Pass.
- `git diff --check -- apps/editor/src/features/editor-session apps/editor/src/features/project-storage apps/editor/src/features/psd-import apps/editor/src/features/workspace-storage apps/editor/src/workspace apps/editor/src/state discussion/implementation/waves/wave90`
  - Pass; Git reported LF/CRLF working-copy warnings only.
- `git diff --check -- packages/authoring-core/src apps/editor/src/features/workspace-storage/model`
  - Pass; Git reported LF/CRLF working-copy warnings only.
- `git diff --check --no-index -- NUL <boundary-fix new/untracked files>`
  - Checked `packages/authoring-core/src/workspace-open.ts`, `packages/authoring-core/src/workspace-open.test.ts`, `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts`, `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts`, and this report.
  - No whitespace errors; commands exit 1 because the file differs from `NUL`, with LF/CRLF working-copy warnings only.

## Basis Coverage Self-Report

- FSA / directory I/O under app layer only: covered by `workspace-directory-io.ts`; no browser handles or FSA types were added to packages.
- Fake-handle test surface: covered by `fake-workspace-directory.ts` and workspace storage tests.
- Create/open/save/save-as primitives: implemented and covered by fake directory roundtrip and Save As tests.
- Permission denied/lost: implemented and covered by tests.
- Safe nested paths and traversal rejection: implemented and covered by tests.
- Text file-set read/write and binary read/write/skip: implemented and covered by binary skip/rewrite tests.
- Workspace storage/session statuses: implemented with `unsupported`, `no-workspace`, `creating`, `opening`, `saving`, `saved`, `save-failed`, `permission-denied`, and `permission-lost`.
- Dirty replacement guard: implemented for Open Workspace and Portable JSON import; covered by provider/session tests.
- Open-time binary verification: implemented for missing and SHA-256 digest-mismatched workspace-saved texture binary refs; covered by workspace storage tests.
- Source original open behavior: source original binary refs are optional during Open Workspace and hydrate only when present; covered by workspace storage test.
- Workspace open parser/schema boundary: implemented through authoring-core `openAuthoringWorkspaceFromTextFileSet()`, which consumes Domain A package-format parser/schema validation without adding a package-format dependency to the editor app.
- Workspace Gate: implemented in `AuthoringWorkspaceContent` with AppBar shell and no editing surfaces before workspace open; covered by test.
- Header workspace actions: implemented in `AppBar`; covered by AppBar tests.
- Portable JSON separation: save no longer downloads Portable JSON; export remains explicit; covered by AppBar/session tests.
- Toolbox cleanup: Project Storage removed; Import PSD remains; Header duplicate navigation removed; covered by Toolbox/AppBar/Viewer tests.
- Routing cleanup: neutral `workspace` entry replaces `import` sentinel; Back/Close from Atlas/Validate/Viewer/Parameters return to workspace; covered by focused tests.
- Guards: PSD import and editing commands reject before workspace open with `workspace.required`; covered by session guard test.
- PSD/Atlas workspace persistence after workspace open: integrated by persisting after PSD commit and Atlas Apply; covered by provider/session write-once tests.

## Deferred Basis Items

- Browser-level/e2e File System Access test was not added. The directory behavior is covered through fake handles at model/session level.
- Unsupported FSA fallback is represented in state and Header gating, but no browser-level unsupported fallback workflow was added.

## Remaining Risks

- App-level `pnpm --dir apps/editor typecheck` still fails due pre-existing exact optional/branded ID/test fixture errors outside this Domain B change. Root `pnpm typecheck` passes.
- Open-time binary digest verification remains in the app storage adapter while parsing/schema validation and binary target classification now come from authoring-core. This preserves current behavior but may be worth moving fully behind authoring-core in a future cleanup.
- Legacy `ProjectStorageScreen` remains in source as a Portable JSON screen but is no longer routed from Toolbox/Header. It was relabeled to explicit Portable JSON actions where touched.
