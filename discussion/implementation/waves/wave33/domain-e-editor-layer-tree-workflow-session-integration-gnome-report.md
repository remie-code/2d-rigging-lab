# Wave33 Domain E Gnome Report: Editor Layer Tree Workflow / Session Integration

Date: 2026-06-02

Verdict: `done`

## Scope

Implemented the production Editor commit path for Domain D layer-tree direct manipulation drafts:

- part rename and reparent through `updatePart`
- empty-leaf part delete through `deletePart`
- drawable reassignment through `setDrawablePart`
- texture assignment through `setDrawableTexture`
- app-shell wiring for row draft callbacks plus explicit batch commit / clear controls
- Preview / Viewer / validation evidence refresh through the existing editor session persistence and evidence provider path

No operation, runtime, validator, dependency, manifest, lockfile, native drag-and-drop, multi-select, recursive delete, renderer, pixel oracle, PSD/image decode, archive, or File System Access scope was added.

## Files Changed By Domain E

- `apps/editor/src/editor-session/part-texture-layer-command.ts`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-session/session-adapter.test.ts`
- `apps/editor/src/editor-workflow/layer-tree-direct-manipulation-workflow.ts`
- `apps/editor/src/editor-workflow/part-texture-layer-workflow.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/ui/layer-tree/layer-tree-panel.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `discussion/implementation/waves/wave33/domain-e-editor-layer-tree-workflow-session-integration-gnome-report.md`

Note: the workspace already contained dirty Wave33 Domain A-D files, including Domain D editor-state and layer-tree UI draft files. Those were not reverted.

## Implementation Decisions

- Added `EditorDeletePartCommand` and `createDeletePartOperationRequest` in the editor session part/texture command module, then exposed `commitDeletePart` on `EditorSessionAdapter`.
- Added deletePart evidence support in the editor evidence provider so committed empty-leaf delete operations generate runtime and validation artifacts like other editor operations.
- Kept direct manipulation batch planning in a dedicated `layer-tree-direct-manipulation-workflow.ts` file to avoid further growing `part-texture-layer-workflow.ts`.
- Coalesced rename and reparent drafts for the same part into one `updatePart` operation.
- Committed direct drafts in this order: part updates, drawable part assignments, drawable texture assignments, empty-leaf deletes. Deletes run last so preceding reparent/reassignment drafts can make a part empty.
- Skipped no-op / reverted drafts before commit and cleared direct drafts when all operations commit or when only no-op drafts remain.
- Preserved selection, lock, and editor-hide state. Browser-local save/load continues to serialize only persisted editor state, not transient direct drafts.

## Verification

- `pnpm.cmd exec vitest run apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts`
  - Pass: 3 files / 40 tests.
- Loop 1: `pnpm.cmd exec vitest run apps/editor/src/editor-state/layer-tree-view-model.test.ts apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts`
  - Pass: 4 files / 44 tests.
- `pnpm.cmd typecheck`
  - Pass: root typecheck and editor typecheck.
- `git diff --check -- apps/editor/src/editor-session apps/editor/src/editor-workflow apps/editor/src/app apps/editor/src/ui/app-shell apps/editor/src/editor-state apps/editor/src/ui/layer-tree`
  - Pass; Git reported only LF-to-CRLF working-copy warnings.
- Loop 1: `git diff --check -- apps/editor/src/editor-session apps/editor/src/editor-workflow apps/editor/src/app apps/editor/src/ui/app-shell apps/editor/src/editor-state apps/editor/src/ui/layer-tree discussion/implementation/waves/wave33 discussion/implementation/reviews/wave33`
  - Pass; Git reported only LF-to-CRLF working-copy warnings.
- `git diff --check --no-index -- NUL apps/editor/src/editor-workflow/layer-tree-direct-manipulation-workflow.ts`
  - No whitespace errors; exit code 1 is expected for a no-index diff against a new file. Git reported only LF-to-CRLF warning.
- Loop 1 no-index checks for untracked `layer-tree-direct-manipulation-workflow.ts`, `layer-tree-direct-manipulation-view-model.ts`, and this report:
  - No whitespace errors; exit code 1 is expected for no-index diffs against new files. Git reported only LF-to-CRLF warnings.

## Evidence Added

- Session adapter test now proves empty-leaf `deletePart` commits, reloads `model/graph.json`, records operation log evidence, and emits validation report artifact paths.
- Workflow test now proves direct draft commit for rename/reparent, drawable reassignment, texture assignment, empty-leaf delete, no-op skip, Preview part projection, Viewer drawable layer evidence, operation log order, and browser-local save/load.
- App-shell test now proves row-level direct draft controls and batch commit / clear buttons route through production shell callbacks.

## Needs-Fix Loop 1

Review finding fixed: a direct manipulation batch could reparent a part or assign a drawable to a part that was also pending empty-leaf delete, then fail the later delete operation and leave a partial committed mutation.

Loop 1 changes:

- Added deterministic batch preflight issues in `layer-tree-direct-manipulation-workflow.ts` for reparent-to-pending-delete and drawable-assignment-to-pending-delete drafts.
- Batch preflight rejection returns `status: "rejected"`, `committedCount: 0`, no operation results, no latest session persistence result, and leaves the draft state unchanged for correction.
- Disabled pending-delete parts in direct manipulation parent options and drawable part options in `layer-tree-direct-manipulation-view-model.ts`.
- Added regression tests proving no operation log/session mutation occurs for both reparent-to-deleted-part and drawable-assign-to-deleted-part batches.
- Added view-model coverage that pending-delete parts remain visible but disabled as parent/drawable part targets.

Loop 1 files changed:

- `apps/editor/src/editor-workflow/layer-tree-direct-manipulation-workflow.ts`
- `apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts`
- `apps/editor/src/editor-state/layer-tree-direct-manipulation-view-model.ts`
- `apps/editor/src/editor-state/layer-tree-view-model.test.ts`
- `discussion/implementation/waves/wave33/domain-e-editor-layer-tree-workflow-session-integration-gnome-report.md`

## Remaining Issues / User Decision Points

- No Domain E user-decision points.
- Domain F should add fixture/e2e smoke coverage for the same production path.
- Batch commit remains sequential for unrelated operation-level rejections, matching existing multi-operation editor workflow behavior. Pending-delete target references are now rejected before any operation is committed.
