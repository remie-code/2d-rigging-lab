# Wave28 Domain D Completion: Editor Layer Tree Draft State / View Model

## Status

- Verdict: done
- Target: `wave28-editor-layer-tree-draft-state-view-model`
- Implementer: Gnome

## Scope Changed

- Added editor-only layer tree draft state for drawable selection, lock, and editor-only hide.
- Added deterministic draft actions for selecting a drawable, clearing selection, toggling/updating lock, and toggling/updating editor-hidden state.
- Added a part-grouped layer tree view model under `EditorWorkflowViewModel`.
- Added truthful texture state projection:
  - `resolved` when the drawable texture id matches a texture atlas entry.
  - `missing` when a drawable texture id has no matching texture atlas entry.
  - `unassigned` only for an empty texture id.
- Added a focused, standalone `ui/layer-tree` draft component for display/control callbacks only.
- Did not wire operation commit workflow, app shell integration, editor workflow integration, persistence, or package schema changes.

## Files Changed

- `apps/editor/src/editor-state/layer-tree-draft-state.ts`
- `apps/editor/src/editor-state/layer-tree-draft-state.test.ts`
- `apps/editor/src/editor-state/layer-tree-view-model.ts`
- `apps/editor/src/editor-state/layer-tree-view-model.test.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/ui/layer-tree/layer-tree-panel.ts`
- `apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts`
- `apps/editor/src/ui/layer-tree/index.ts`
- `discussion/implementation/waves/wave28/domain-d-editor-layer-tree-draft-state-view-model-completion.md`

## Verification

- `pnpm.cmd exec vitest run apps/editor/src/editor-state/layer-tree-draft-state.test.ts apps/editor/src/editor-state/layer-tree-view-model.test.ts apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts`
  - Passed: 3 files, 4 tests.
- `pnpm.cmd exec vitest run apps/editor/src/editor-state/editor-view-model.test.ts apps/editor/src/editor-state/editor-test-ids.test.ts apps/editor/src/editor-state/layer-tree-draft-state.test.ts apps/editor/src/editor-state/layer-tree-view-model.test.ts apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts`
  - Passed: 5 files, 13 tests.
- `pnpm.cmd exec vitest run apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts apps/editor/src/ui/composition-panel/composition-panel.test.ts apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts apps/editor/src/ui/source-assets/source-intake-panel.test.ts`
  - Passed: 4 files, 30 tests.
- `git diff --check -- apps/editor/src/editor-state apps/editor/src/ui discussion/implementation/waves/wave28 discussion/implementation/reviews/wave28`
  - Passed with CRLF conversion warnings only.

## Typecheck

- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`
  - Failed due out-of-scope existing/parallel changes after Domain D local type errors were fixed.
  - Remaining reported files are outside Domain D write scope:
    - `apps/editor/src/editor-preview/preview-projection.ts`
    - `packages/operation-core/src/operations/create-part.ts`
    - `packages/operation-core/src/operations/set-drawable-part.ts`
    - `packages/operation-core/src/operations/update-part.ts`
    - `packages/runtime-core/src/snapshot-comparison.ts`
- `pnpm.cmd typecheck`
  - Failed for the same out-of-scope package/editor-preview issues.

## Remaining Issues

- Layer tree UI is a focused draft component and is not mounted into the app shell in this domain.
- Save/load workflow wiring for `model/editor-state.json` remains a later integration task.
- Editor-only state is projected from optional `editorState` input, but current editor workflow does not yet update or persist it.

## Review Focus

- Confirm `editorHiddenIds` remains editor-only and is not confused with drawable `runtimeVisibility`.
- Confirm missing texture state is represented only from actual texture atlas entry resolution, not inferred from file availability.
- Confirm `index.ts` changes are barrel-only.
- Confirm no edits touched forbidden `editor-workflow`, `editor-session`, `app`, `packages`, or e2e files for this domain.
