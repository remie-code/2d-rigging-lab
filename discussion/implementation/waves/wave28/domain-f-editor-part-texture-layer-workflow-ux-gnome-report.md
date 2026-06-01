# Wave28 Domain F Gnome Report: Editor Part / Texture / Layer Workflow UX

## Verdict

done

## Files Changed

Editor session / workflow:

- `apps/editor/src/editor-session/part-texture-layer-command.ts`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-session/index.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/part-texture-layer-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-state-projection.ts`
- `apps/editor/src/editor-workflow/dynamics-preview-workflow.ts`
- `apps/editor/src/editor-workflow/viewer-runtime-workflow.ts`
- `apps/editor/src/editor-workflow/preview-texture-application.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts`

Editor state / UI:

- `apps/editor/src/editor-state/layer-tree-draft-state.ts`
- `apps/editor/src/editor-state/part-texture-workflow-view-model.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/ui/layer-tree/layer-tree-panel.ts`
- `apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/ui/preview-panel/preview-summary.ts`
- `apps/editor/src/ui/preview-panel/preview-visual.ts`
- `apps/editor/src/ui/viewer-runtime/viewer-runtime-summary.ts`
- `apps/editor/src/app/editor-app.ts`

Report:

- `discussion/implementation/waves/wave28/domain-f-editor-part-texture-layer-workflow-ux-gnome-report.md`

## Implementation Summary

- Added Editor request builders and session adapter commits for `createPart`, `updatePart`, `setDrawablePart`, and `setDrawableTexture`, reusing Domain A operations.
- Added workflow controller methods for part creation/update, drawable part assignment, drawable texture assignment, layer selection, lock, and editor-only hide.
- Passed current layer locks into part/texture operation payloads as `lockedTargetIds`, so locked editor layers guard authoring edits without changing runtime visibility.
- Added save/load persistence for `model/editor-state.json` by overlaying `selection`, `lockedIds`, and `editorHiddenIds` into the existing package file-set save path.
- Mounted the Domain D layer tree panel in the app shell and extended it with focused part/texture workflow controls.
- Projected part hierarchy, editor layer state, and texture-backed/unresolved evidence into Preview and Viewer surfaces without runtime/validator/package broad changes.
- Kept public `index.ts` files as barrel-only exports.

## Fix Loop Summary

- Extracted the cohesive Domain F part/texture/layer workflow commit and draft helpers from `workflow-controller.ts` into `part-texture-layer-workflow.ts`.
- Kept `workflow-controller.ts` as wiring/orchestration for Domain F outcomes, state replacement, latest persistence result, and preview invalidation.
- Added workflow-level locked layer guards for `setDrawableRuntimeVisibility`, `toggleDrawableRuntimeVisibility` through the setter helper, and `moveDrawableLayer`.
- Rejected locked runtime visibility and draw-order edits as no-op `locked` workflow results without committing an authoring operation or mutating runtime visibility/draw order.
- Kept editor-only hide as editor draft state and added focused coverage showing it does not mutate runtime visibility.

## Verification

Passed:

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts`
  - 1 file / 2 tests passed after adding locked runtime visibility, draw-order, and editor-hidden separation coverage.
- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts apps/editor/src/editor-preview/preview-projection.test.ts apps/editor/src/editor-preview/texture-preview-resolution.test.ts apps/editor/src/editor-workflow/viewer-runtime-workflow.test.ts`
  - 7 files / 75 tests passed after a temporary unrelated mesh nudge regression from the extraction patch was corrected.
- `pnpm.cmd typecheck`
  - Root and editor typecheck passed.
- `pnpm.cmd exec vitest run apps/editor/src`
  - 31 files / 174 tests passed after the fix-loop extraction.
- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-preview/preview-projection.test.ts apps/editor/src/editor-preview/texture-preview-resolution.test.ts apps/editor/src/editor-workflow/viewer-runtime-workflow.test.ts`
  - 6 files / 35 tests passed.
- `pnpm.cmd typecheck`
  - Root and editor typecheck passed.
- `pnpm.cmd exec vitest run apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-session/viewer-session-adapter.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/editor-workflow/composition-workflow.test.ts apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts apps/editor/src/ui/composition-panel/composition-panel.test.ts apps/editor/src/ui/rig-control-panel/rig-control-panel.test.ts apps/editor/src/ui/source-assets/source-intake-panel.test.ts`
  - 8 files / 75 tests passed.
- `pnpm.cmd exec vitest run apps/editor/src`
  - 31 files / 174 tests passed.
- `git diff --check -- apps/editor/src/editor-state apps/editor/src/editor-workflow apps/editor/src/editor-session apps/editor/src/app/editor-app.ts apps/editor/src/ui discussion/implementation/waves/wave28/domain-f-editor-part-texture-layer-workflow-ux-gnome-report.md`
  - Passed with exit code 0. Git reported existing LF/CRLF normalization warnings for touched Editor files.

## Remaining Issues

- The UI is a minimum form-based workflow, not a drag-and-drop tree editor.
- Texture preview remains semantic/package-local evidence; no image decode, file picker, asset I/O, pixel oracle, or renderer rewrite was added.
- Preview part evidence is enriched from current Editor package state when runtime snapshot part evidence is absent, preserving Domain B projection shape while avoiding forbidden runtime/package edits.

## User-Decision Points

None.
