# Wave29 Domain F Editor Canvas Mesh Workflow UX - Test Adequacy Review

verdict: needs_fix

## Findings

1. High - Ready-state canvas nudge is not covered through the operation lifecycle.

   Domain F pass evidence requires Editor UI mesh vertices to move through the operation lifecycle and save/load (`discussion/implementation/orchestration/wave29-plan.md:349`). The current workflow test proves committed canvas drag with save/load and Preview/Viewer geometry (`apps/editor/src/editor-workflow/workflow-controller.test.ts:649`), and it proves locked canvas nudge is blocked without a commit (`apps/editor/src/editor-workflow/workflow-controller.test.ts:722`). It does not prove a ready `nudgeMeshCanvasSelection` commit.

   The UI test named as selected-vertex nudge coverage is a false-positive risk: it asserts the canvas status says `0 selected vertices` (`apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts:157`), then emits a click on the canvas nudge button (`apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts:166`). In the real component, that button is disabled when `canDraftMove` is false (`apps/editor/src/ui/drawable-authoring/mesh-canvas-editor.ts:198`), but the fake `TestElement.emit` ignores disabled browser semantics and still calls the listener (`apps/editor/src/ui/drawable-authoring/mesh-canvas-editor.ts:201`).

   Concrete fix: add a focused workflow test that selects one or more canvas vertices, calls `nudgeMeshCanvasSelection({ x: 1, y: 0 })`, and asserts `status: "committed"`, `moveMeshVertex` operation log entry, changed mesh coordinates, and saved/reloaded coordinates. Update the UI test to render a state with selected vertices, assert the canvas nudge button is enabled before click, and separately assert the no-selection button is disabled.

2. High - SVG pointer drag and modifier-selection wiring are not covered by lower-level UI tests.

   The component implements SVG pointer drag with `pointerdown` / `pointerup` and emits `onDragSelection` only for an already-selected editable target (`apps/editor/src/ui/drawable-authoring/mesh-canvas-editor.ts:133`). It also maps Shift to add and Ctrl/Meta to toggle selection (`apps/editor/src/ui/drawable-authoring/mesh-canvas-editor.ts:235`). The current UI coverage only emits a plain click and a nudge click (`apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts:142`); it does not pass `clientX/clientY`, Shift, Ctrl, or Meta fields through the fake event.

   Because Gnome explicitly skipped browser e2e/mobile/a11y for later Domain G (`discussion/implementation/waves/wave29/wave29-domain-f-editor-canvas-mesh-workflow-ux-gnome-report.md:85`), Domain F needs adequate lower-level coverage for pointer behavior. The workflow controller test proves direct `dragMeshCanvasSelection` commits (`apps/editor/src/editor-workflow/workflow-controller.test.ts:663`), but it does not prove the SVG surface can invoke that path.

   Concrete fix: extend the test element helper to emit event payload fields, then cover selected editable vertex `pointerdown` + `pointerup` producing an `onDragMeshCanvasSelection` delta. Also cover no-drag cases for unselected/disabled targets or zero delta, and cover Shift/Ctrl-or-Meta click modes mapping to `add` / `toggle`.

## Tests Reviewed

- `apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts`: covers projection, hit testing, add/toggle/remove state transitions, drag/nudge draft creation, lock/editor-hidden draft blocking, disabled hit targets, and mesh edit view model projection.
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`: covers row nudge commit and save/load, canvas multi-select drag commit with Preview/Viewer geometry and editor-state save/load, and locked canvas/row movement blocking.
- `apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts`: covers mesh canvas rendering, plain vertex click callback, and nudge callback, but the nudge assertion currently bypasses disabled semantics.
- `apps/editor/src/ui/app-shell/app-shell.test.ts`: callback interface includes mesh canvas handlers, but there is no mesh-canvas-specific wiring assertion.
- `apps/editor/src/editor-preview/preview-mesh-evidence.test.ts`: covers semantic Preview mesh evidence for selected, moved, locked, editor-hidden, runtime-hidden, and texture-backed states.
- `apps/editor/src/editor-session/session-adapter.test.ts` and `apps/editor/src/editor-workflow/viewer-runtime-workflow.test.ts`: adjacent persistence/viewer coverage remains plausible for Domain F.

## Verification Assessment

Gnome's recorded commands are plausible and reproduced in this review:

- `pnpm.cmd exec vitest run apps/editor/src/editor-state/layer-tree-draft-state.test.ts apps/editor/src/editor-state/mesh-canvas-selection-state.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-preview/preview-mesh-evidence.test.ts apps/editor/src/editor-workflow/viewer-runtime-workflow.test.ts`: 8 files / 88 tests passed.
- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/part-texture-layer-workflow.test.ts apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts apps/editor/src/editor-state/layer-tree-view-model.test.ts`: 3 files / 6 tests passed.
- `pnpm.cmd typecheck`: passed root and editor typecheck.
- `git diff --check -- apps/editor/src/editor-state apps/editor/src/editor-workflow apps/editor/src/editor-session apps/editor/src/app/editor-app.ts apps/editor/src/ui discussion/implementation/waves/wave29`: passed with LF-to-CRLF warnings only.

The skipped browser e2e/mobile/a11y smoke is honest and aligned with Domain G. However, the two findings above should be fixed before treating Domain F test adequacy as pass, because they are narrow lower-level tests for Domain F behavior rather than broad Domain G browser smoke.

## User Decision Points

None. These are implementation/test fixes for Gnome; no product decision is required.

## Report Path

`discussion/implementation/reviews/wave29/wave29-domain-f-editor-canvas-mesh-workflow-ux-test-review.md`
