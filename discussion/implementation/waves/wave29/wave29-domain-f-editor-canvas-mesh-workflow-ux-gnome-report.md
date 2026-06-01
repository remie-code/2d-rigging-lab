# Wave29 Domain F Editor Canvas Mesh Workflow UX - Gnome Report

Date: 2026-06-02

## Verdict

done

## Scope

- Target: `wave29-editor-canvas-mesh-workflow-ux`
- Implemented the minimum Editor canvas/SVG mesh editing workflow on top of Wave29 Domains A-E.
- Kept the implementation inside the allowed Editor state/workflow/session/app/UI scope plus this report.
- Treated package/runtime/validator/fixture changes already present from Wave29 A-E as upstream state and did not revert them.

## Files Changed

- `apps/editor/src/editor-state/editor-state-file.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/index.ts` (barrel export only)
- `apps/editor/src/editor-state/layer-tree-draft-state.ts`
- `apps/editor/src/editor-state/layer-tree-draft-state.test.ts`
- `apps/editor/src/editor-state/mesh-edit-state.ts`
- `apps/editor/src/editor-session/mesh-vertex-command.ts`
- `apps/editor/src/editor-workflow/mesh-canvas-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`
- `apps/editor/src/editor-workflow/part-texture-layer-workflow.ts`
- `apps/editor/src/editor-workflow/dynamics-preview-workflow.ts`
- `apps/editor/src/editor-workflow/viewer-runtime-workflow.ts`
- `apps/editor/src/editor-workflow/index.ts` (barrel export only)
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/ui/drawable-authoring/mesh-canvas-editor.ts`
- `apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.ts`
- `apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts`
- `apps/editor/src/ui/preview-panel/preview-summary.ts`
- `apps/editor/src/ui/viewer-runtime/viewer-runtime-summary.ts`
- `discussion/implementation/waves/wave29/wave29-domain-f-editor-canvas-mesh-workflow-ux-gnome-report.md`

## Implementation Summary

- Added a focused SVG mesh canvas in Drawable Authoring:
  - renders semantic mesh vertex hit targets from the Domain D view model;
  - supports single/add/toggle vertex selection through SVG vertex targets;
  - exposes selected-vertex nudge buttons;
  - supports pointer drag commit for already-selected editable vertices.
- Added canvas mesh workflow wiring:
  - selection updates `meshEdit.selectedVertexIds` and keeps the selected drawable aligned with layer draft selection;
  - drag/nudge drafts are committed through the existing `moveMeshVertex` operation lifecycle;
  - multi-vertex movement uses the existing `vertexDeltas` payload;
  - `lockedTargetIds` are passed from Editor layer draft state into the operation request.
- Preserved and tightened lock/editor-hide semantics:
  - locked mesh targets now block canvas move drafts before commit;
  - existing row nudge also returns `not_editable` for locked selected meshes without committing;
  - layer draft select/lock/editor-hide changes reproject mesh edit state so mesh editability stays current.
- Added save/load of minimum mesh selection state without package schema changes:
  - `activeTool: "meshEdit"` plus `selection: vertexStableIds[]` persists mesh vertex selection;
  - layer selection ignores vertex IDs when `activeTool` is meshEdit;
  - load restores selected mesh by matching persisted vertex IDs to mesh targets.
- Wired Preview / Viewer inputs to use the editor-state file projection so mesh-edit selection/lock/editor-hide evidence is supplied consistently.
- Added minimal Preview / Viewer UI summaries for mesh evidence:
  - Preview summary reports drawable mesh evidence, selected vertices when vertex detail exists, moved vertex refs when comparison evidence exists, and topology summary count;
  - Viewer runtime summary lists mesh evidence with topology/hash and selected/moved refs when present.

## Review Fix Pass - 2026-06-02

- Addressed test adequacy review findings for Domain F.
- Added workflow-controller coverage proving a ready/editable selected mesh can commit `nudgeMeshCanvasSelection` through the existing `moveMeshVertex` operation lifecycle.
- Split the UI canvas selection/nudge coverage so the unselected state asserts the nudge button is disabled, while the selected state performs the nudge callback from an enabled button.
- Added lower-level UI coverage for SVG vertex click modifier selection modes:
  - Shift -> `add`
  - Ctrl -> `toggle`
  - Meta -> `toggle`
- Added lower-level UI coverage for selected SVG pointer drag wiring into `onDragMeshCanvasSelection`.

Fix pass files changed:

- `apps/editor/src/editor-workflow/workflow-controller.test.ts`
- `apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts`
- `discussion/implementation/waves/wave29/wave29-domain-f-editor-canvas-mesh-workflow-ux-gnome-report.md`

## Verification

Passed:

- `pnpm.cmd exec vitest run apps/editor/src/editor-state/layer-tree-draft-state.test.ts apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-preview/preview-mesh-evidence.test.ts apps/editor/src/editor-workflow/viewer-runtime-workflow.test.ts`
  - 8 files passed
  - 88 tests passed
- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts apps/editor/src/editor-state/layer-tree-view-model.test.ts`
  - 3 files passed
  - 6 tests passed
- `pnpm.cmd typecheck`
  - root typecheck passed
  - editor typecheck passed
- `git diff --check -- apps/editor/src/editor-state apps/editor/src/editor-workflow apps/editor/src/editor-session apps/editor/src/app/editor-app.ts apps/editor/src/ui discussion/implementation/waves/wave29`
  - passed
  - Git emitted LF-to-CRLF working-copy warnings only.

Review fix pass passed:

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts`
  - 2 files passed
  - 43 tests passed
- `pnpm.cmd typecheck`
  - root typecheck passed
  - editor typecheck passed
- `git diff --check -- apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts discussion/implementation/waves/wave29/wave29-domain-f-editor-canvas-mesh-workflow-ux-gnome-report.md`
  - passed
  - Git emitted LF-to-CRLF working-copy warnings only.

## Skipped Verification

- Browser e2e and mobile/a11y smoke were not run. Those belong to later Wave29 Domain G; this pass covered focused state/workflow/session/UI tests and typecheck.
- No pixel-renderer or screenshot oracle was added or run. The workflow remains semantic SVG/DTO evidence only.

## Remaining Issues / Risks

- Focused automated coverage now proves workflow drag/nudge commits through the controller and lower-level SVG click/modifier/pointer-drag callback wiring. Browser-level pointer interaction remains Domain G.
- Preview / Viewer current projections truthfully show moved mesh coordinates. `movedVertexRefs` appear when runtime comparison evidence has a baseline/candidate delta; current-session preview may have no moved refs if its baseline is already the current graph.
- No topology editing, UV editing, triangulation, renderer rewrite, file picker, parser, image decode, archive I/O, external dependency, or Cubism compatibility work was introduced.

## User Decision Points

None.

## Report Path

`discussion/implementation/waves/wave29/wave29-domain-f-editor-canvas-mesh-workflow-ux-gnome-report.md`
