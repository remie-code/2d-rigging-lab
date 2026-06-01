# Wave29 Domain D Re-Review: Editor Canvas Mesh Selection View Model

## Verdict

pass

## Initial Findings Fixed

- Major fixed: `applyCommittedOperationSummary` no longer drops mesh edit state for editor-state-only summaries. The projection now derives `layerTreeDraft` first, then calls `reprojectMeshEditState` when `input.meshes` is omitted, preserving existing `meshTargets` and selected vertex IDs while reapplying layer selection, lock, and editor-hidden state (`apps/editor/src/editor-state/editor-state-projections.ts:162`, `apps/editor/src/editor-state/editor-state-projections.ts:166`, `apps/editor/src/editor-state/editor-state-projections.ts:170`; `apps/editor/src/editor-state/mesh-edit-state.ts:133`, `apps/editor/src/editor-state/mesh-edit-state.ts:180`, `apps/editor/src/editor-state/mesh-edit-state.ts:192`).
- Medium fixed: focused tests now cover editor-state-only reprojection, full drawables/meshes/editorState reprojection, runtime-hidden/editor-hidden/locked distinctions, equal-distance hit tie-breaking, invalid/blank/trimmed/duplicate target normalization, locked/editor-hidden draft blocking, and locked hit behavior with and without `includeDisabledTargets` (`apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts:24`, `apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts:101`, `apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts:153`, `apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts:254`, `apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts:264`, `apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts:361`, `apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts:399`).

## New Findings

None.

## Design / Development Compliance

- Domain D scoped source changes are contained to `apps/editor/src/editor-state/**`, plus the Domain D report/review artifacts. The shared worktree still contains package/runtime/validator changes from other Wave29 domains; I treated those as parallel-domain work and did not include them in this Domain D verdict.
- No Domain D changes were found under `apps/editor/src/editor-workflow/**`, `apps/editor/src/editor-session/**`, `apps/editor/src/app/**`, `apps/editor/e2e/**`, package manifests, or lockfiles.
- `apps/editor/src/editor-state/index.ts` remains barrel-only; the change is a single re-export (`apps/editor/src/editor-state/index.ts:17`).
- Canvas drag/nudge helpers produce operation-shaped draft commands only and do not wire commit/session/workflow behavior (`apps/editor/src/editor-state/mesh-canvas-selection-state.ts:137`, `apps/editor/src/editor-state/mesh-canvas-selection-state.ts:147`, `apps/editor/src/editor-state/mesh-canvas-selection-state.ts:170`). A caller search found usage only in the new state helper and focused tests.
- Runtime-hidden, editor-hidden, and locked semantics remain distinct: runtime-hidden targets stay selectable/editable, editor-hidden selected meshes produce no hit targets, and locked meshes keep disabled/read-only hit targets (`apps/editor/src/editor-state/mesh-edit-state.ts:213`, `apps/editor/src/editor-state/mesh-edit-state.ts:298`, `apps/editor/src/editor-state/mesh-edit-state.ts:343`).

## Verification Reviewed / Run

- Reviewed the focused diff and line-numbered source/test context for the Domain D files listed in the assignment.
- Reviewed initial review artifact and Gnome fix-loop report.
- Reviewed Orch-Sylph reported verification:
  - `pnpm.cmd exec vitest run apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts apps/editor/src/editor-state/editor-view-model.test.ts apps/editor/src/editor-state/layer-tree-draft-state.test.ts apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts`
  - pass: 7 files / 78 tests
  - `pnpm.cmd typecheck`
  - pass
  - focused `git diff --check`
  - pass with LF/CRLF warnings only
- Reran during re-review:
  - `pnpm.cmd exec vitest run apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts`
  - pass: 1 file / 10 tests
  - `pnpm.cmd typecheck`
  - pass
  - `git diff --check -- apps/editor/src/editor-state discussion/implementation/waves/wave29/domain-d-editor-canvas-mesh-selection-view-model-gnome-report.md discussion/implementation/reviews/wave29/domain-d-editor-canvas-mesh-selection-view-model-review.md`
  - pass with LF/CRLF warnings only

## Remaining Issues

None for Domain D. App/workflow/session commit wiring remains intentionally out of scope for this domain and belongs to later Wave29 workflow integration.

## User-Decision Points

None.

## Review Artifact

`discussion/implementation/reviews/wave29/domain-d-editor-canvas-mesh-selection-view-model-rereview.md`
