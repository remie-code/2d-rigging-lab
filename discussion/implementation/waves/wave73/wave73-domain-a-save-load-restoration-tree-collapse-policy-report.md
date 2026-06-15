# Wave73 Domain A Report: Save/Load Restoration + Parts Tree Collapse Policy

- Verdict: `done`
- Domain: `wave73-save-load-restoration-tree-collapse-policy`
- Date: 2026-06-15
- Implementer: Gnome

## Files Changed

- `packages/authoring-core/src/package-document-editor-state.ts`
- `packages/authoring-core/src/package-document-manifest.ts`
- `packages/authoring-core/src/package-document-model-files.ts`
- `packages/authoring-core/src/package-document-from-authoring-session.ts`
- `packages/authoring-core/src/to-package-document.ts`
- `packages/authoring-core/src/portable-project-bundle.ts`
- `packages/authoring-core/src/portable-project-bundle.test.ts`
- `packages/authoring-core/src/index.ts`
- `apps/editor/src/features/project-storage/model/editor-project-storage.ts`
- `apps/editor/src/features/project-storage/model/editor-project-storage.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/features/editor-session/model/part-tree-collapse-state.ts`
- `apps/editor/src/features/editor-session/model/part-tree-collapse-state.test.ts`
- `apps/editor/e2e/portable-project-save-load.e2e.spec.ts`

No `packages/package-format/**` changes were needed; the existing `model.editorState.editorHiddenIds` schema was sufficient.

## Validation Commands and Results

- `pnpm.cmd exec vitest run packages/authoring-core/src/portable-project-bundle.test.ts apps/editor/src/features/project-storage/model/editor-project-storage.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/features/editor-session/model/part-tree-collapse-state.test.ts`
  - First sandbox run failed before collection with esbuild `spawn EPERM`.
  - Escalated rerun passed: 4 files, 19 tests.
- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
  - Fix-loop sandbox run failed before config load with esbuild `spawn EPERM`.
  - Escalated fix-loop rerun passed: 1 file, 9 tests.
  - Final escalated rerun after test-output cleanup passed: 1 file, 9 tests.
- `pnpm.cmd exec vitest run packages/authoring-core/src/portable-project-bundle.test.ts apps/editor/src/features/project-storage/model/editor-project-storage.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/features/editor-session/model/part-tree-collapse-state.test.ts`
  - Escalated fix-loop rerun passed: 4 files, 19 tests.
  - Final escalated rerun after test-output cleanup passed: 4 files, 19 tests.
- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/part-tree-collapse-state.test.ts`
  - Escalated focused rerun after test naming cleanup passed: 1 file, 3 tests.
- `pnpm.cmd exec vitest run packages/authoring-core/src/portable-project-bundle.test.ts`
  - Escalated focused rerun after manifest cleanup passed: 1 file, 2 tests.
- `pnpm.cmd typecheck`
  - Passed before and after final manifest cleanup.
- `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/portable-project-save-load.e2e.spec.ts`
  - First sandbox run failed with `spawn EPERM`.
  - Escalated rerun passed: 1 Playwright test.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `git diff --check -- apps/editor packages/authoring-core packages/package-format discussion/implementation/waves/wave73`
  - Passed with CRLF normalization warnings only.

## Fix Loop 1: TA-001 Closure

- Extended `apps/editor/src/features/editor-session/editor-session-context-history.test.ts` so the portable bundle load/reset test now creates `meshDraft` through `previewMeshDraft(...)` and `rigDraft` through `startWarpDeformerDraftForDrawable(...)` before load, then asserts both are `null` after load.
- The same provider test now creates provider-owned operation feedback through public context actions: missing Drawable Rotation Deformer creation for `rigOperationFeedback`, and duplicate preset parameter creation for `parameterOperationFeedback`. Both are asserted present before load and cleared after load.
- Direct provider coverage for in-progress gesture preview state is N/A for Domain A: `EditorSessionProvider` exposes commit methods but does not own a durable "gesture in progress" slot. The controller state is closure-local in `editor-session-gesture-commit.ts`, while pointer drag preview state is owned by canvas interaction hooks outside the save/load provider boundary. Domain A therefore records the structural evidence and keeps direct provider assertions focused on provider-owned transient state cleared by `clearTransientCommitState()`.

## Parts Visibility Persistence Trace

- Save path now passes current `editorHiddenPartIds` from `EditorSessionProvider.saveProject` into `exportEditorProjectBundle`.
- Editor storage passes those IDs into `exportAuthoringSessionPortableBundle`.
- Authoring Core writes a focused `model/editor-state.json` with `schemaVersion: editor-state-v1`, empty `selection`, empty `lockedIds`, and graph-ordered `editorHiddenIds`.
- Load path returns `editorHiddenPartIds` from `importAuthoringSessionPortableBundle` / `importEditorProjectBundle`.
- Provider load reset now restores the imported hidden Part IDs instead of blindly clearing them.
- E2E hides `sample_model import`, saves, reloads, opens the bundle, verifies the Parts Tree shows `Show part container`, verifies Canvas has no renderable artwork while hidden, then shows the container and verifies renderability returns.

## Editor-State Package / Hydration Trace

- `package-document-editor-state.ts` owns editor-state normalization.
- Export normalization validates IDs with `PartIdSchema`, dedupes them, and orders them by current `session.graph.parts`.
- Import hydration reads `packageDocument.model.editorState?.editorHiddenIds`, validates against the loaded `AuthoringSession` Part Container IDs, and deterministically drops invalid, duplicate, or stale IDs.
- Tests cover stale and invalid saved IDs by mutating a portable bundle to include missing and invalid hidden IDs; import returns only the valid current Part ID.

## Round-Trip Assertion Hardening Trace

- Authoring Core portable bundle test now explicitly asserts:
  - Parts Container hidden editor state;
  - Part hierarchy and drawable reparenting;
  - drawable `runtimeVisibility`, `defaultOpacity`, and draw order;
  - mesh vertices, UVs, triangles, and generation provenance;
  - texture binary byte preservation;
  - Warp numeric state and keyed control-point offsets;
  - Rotation pivot, rest angle, child hierarchy, and keyed angle;
  - parameters and keyform sets.
- Editor storage service test now asserts package editor-state export and import result hydration.
- Provider test now distinguishes persisted hidden Part IDs from transient selection, active parameter values, PSD modal state, undo/redo history, and manual collapsed state.
- Playwright save/load test now uses explicit Parts Tree expansion helpers and asserts hidden Part Container restoration plus Canvas effective visibility.

## Parts Tree Initial Collapse Policy Trace

- New policy helper: `createInitialCollapsedPartIds`.
- Initial policy:
  - root Part Containers remain expanded;
  - non-root Part Containers with children initialize collapsed;
  - manual expand/collapse remains only React session state.
- PSD import path uses `mergeNewPartInitialCollapsedPartIds`:
  - existing manual collapsed state is preserved;
  - newly imported Part Containers get default collapse;
  - the newly imported root path is deterministically expanded for immediate task continuity.
- Load path regenerates collapsed state from the loaded session; no collapsed IDs are saved into the portable bundle.

## Basis Coverage Self-Report

- Wave73 7.1 Parts Container visibility persistence: implemented.
- Wave73 7.2 save/load assertion hardening: implemented with focused unit/provider/service/E2E assertions.
- Wave73 7.3 Parts Tree initial collapse policy: implemented and tested.
- Wave72 portable bundle foundation: preserved; no new format was introduced.
- UX-backed package logic authority: used narrowly to add package editor-state adapter behavior needed by accepted UX.
- Source organization policy: complied; new files have focused responsibilities and source organization guard passed.
- Dependency policy: complied; no dependency changes and dependency guard passed.
- Operation policy: model mutations remain through existing operations; this change serializes editor project state during save/load and does not add operation types.
- Schema/ID conventions: existing editor-state schema path and machine-readable IDs are used; no new package-format schema was invented.

## Intentionally Deferred Basis Items

- Rotation Deformer translation exposure is deferred to Wave73 Domain B.
- Selection, active tool, canvas view, current parameter values, undo history, drafts, selected control point, in-progress gestures, and manual collapsed tree state remain non-persisted.
- Browser-local save slots, IndexedDB/localStorage UI, ZIP/archive/native filesystem/File System Access API/directory picker/drag-drop, cloud persistence, and cross-profile persistence remain out of scope.

## User-Facing UX Trace

- Saving and opening a portable bundle now restores hidden Part Container state visible in the Parts Tree and effective on Canvas.
- Loaded projects start with a more scannable Parts Tree: root-level containers are visible while nested/container contents start collapsed.
- Existing tests and E2E use explicit expand actions instead of relying on all descendants being visible.
- PSD import seeded hidden groups continue to become editor-hidden Part Containers and now persist through save/load.

## Operation / Package Contract Trace

- Package contract uses the existing optional `model/editor-state.json` file and `editorHiddenIds` field.
- Manifest `schemaVersions.editorState` and `modelFiles.editorState` are added only when editor state is present or explicitly exported.
- Exported editor-state intentionally contains only hidden IDs plus empty legacy editor-state arrays; it does not carry active tool or canvas view.
- No new operation payload, package format version, runtime/viewer behavior, dependency, or mesh-generation behavior was added.

## Save/Load State Preservation Trace

- Persisted: Part Container editor visibility, model graph, drawables, draw order, meshes, texture refs and bytes, Warp/Rotation deformers, parameters, keyforms, provenance, rights metadata already represented by the package.
- Cleared on load: selection, active parameter, current parameter values, mesh/rig drafts, operation feedback, PSD import modal state, undo/redo history.
- Regenerated on load: Parts Tree collapsed state from the initial collapse policy.

## Must-Not Compliance Evidence

- No Rotation translation implementation was added.
- No browser-local save slot, IndexedDB UI, ZIP/archive/native filesystem/File System Access API/directory picker/drag-drop, cloud/cross-profile persistence, new package format, Viewer/Runtime View, or mesh generation algorithm change was added.
- No selection, active tool, canvas view, current parameter value, undo history, draft, selected control point, in-progress gesture, or manual collapsed tree state persistence was added.
- No unrelated user/other-agent changes were reverted.

## Residual Risk Classification

- Low: package/editor-state save-load behavior has unit, provider, storage-service, and E2E coverage.
- Low: stale ID filtering is deterministic and directly tested.
- Medium: the Playwright portable save/load test remains broad and can fail from unrelated PSD import, mesh, rig, parameter, or UI regressions.
- Low: collapse policy is intentionally simple; future UX may choose more auto-expand cases, but no user decision is needed for this domain.
