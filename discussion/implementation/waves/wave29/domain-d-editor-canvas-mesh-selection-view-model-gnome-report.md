# Domain D Gnome Report: Editor Canvas Mesh Selection View Model

## Verdict

done

## Files Changed

- `apps/editor/src/editor-state/mesh-edit-state.ts`
- `apps/editor/src/editor-state/mesh-canvas-selection-state.ts`
- `apps/editor/src/editor-state/mesh-edit-view-model.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/index.ts` (barrel export only)
- `apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts`
- `discussion/implementation/waves/wave29/domain-d-editor-canvas-mesh-selection-view-model-gnome-report.md`

## Implementation Summary

- Extended mesh edit state with canvas projection, per-vertex canvas hit targets, selected vertex IDs, and editability flags.
- Added deterministic canvas selection helpers for replace/add/toggle/remove, hit testing, and selected-vertex normalization in mesh vertex order.
- Added pure drag/nudge draft command builders for `moveMeshVertex`-shaped commands without operation commit wiring.
- Projected Wave28 layer semantics into mesh edit state: locked blocks edit/draft, editor-hidden removes canvas hit targets, and runtime-hidden remains separate from editor editability.
- Extended the mesh edit view model with canvas hit target DTOs, selected vertex labels, editability labels, and canvas coordinates while preserving existing row nudge command shape.
- Updated editor-state projection to respect layer-tree selection/lock/editor-hidden state and preserve valid canvas vertex selection across mesh reprojection.

## Fix Loop

- Fixed review Major finding 1 by retaining deterministic `meshTargets` in `MeshEditState` and using `reprojectMeshEditState` for committed summaries that provide `editorState` without `meshes`; editor-state-only layer selection, lock, and editor-hidden changes no longer rebuild against an empty mesh list.
- Fixed review Medium finding 2 by adding focused tests for editor-state-only reprojection, full drawables/meshes/editorState reprojection, equal-distance hit tie-breaking, invalid/blank/trimmed/duplicate target normalization, locked/editor-hidden draft blocking, and locked hit selection with and without `includeDisabledTargets`.

## Tests / Verification Run And Result

- `pnpm.cmd exec vitest run apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts apps/editor/src/editor-state/editor-view-model.test.ts apps/editor/src/editor-state/layer-tree-draft-state.test.ts`
  - pass: 3 files / 14 tests
- `pnpm.cmd exec vitest run apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts`
  - pass: 4 files / 58 tests
- Combined rerun of the two focused Vitest command scopes above
  - pass: 7 files / 72 tests
- Fix loop focused rerun: `pnpm.cmd exec vitest run apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts`
  - pass: 1 file / 10 tests
- Fix loop compatibility rerun: `pnpm.cmd exec vitest run apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts apps/editor/src/editor-state/editor-view-model.test.ts apps/editor/src/editor-state/layer-tree-draft-state.test.ts apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts`
  - pass: 7 files / 78 tests
- `pnpm.cmd typecheck`
  - pass
- `git diff --check -- apps/editor/src/editor-state discussion/implementation/waves/wave29/domain-d-editor-canvas-mesh-selection-view-model-gnome-report.md`
  - pass; Git reported LF-to-CRLF working-copy warnings only.

## Skipped Verification With Reason

- No e2e verification was run for this domain because Domain D intentionally does not wire UI operation lifecycle or browser workflow integration.

## Remaining Issues

- Canvas selection is state/view-model foundation only; no app shell integration or operation commit lifecycle wiring was added by design.

## User-Decision Points

None.
