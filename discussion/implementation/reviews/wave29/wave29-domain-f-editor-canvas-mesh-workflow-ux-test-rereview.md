# Wave29 Domain F Editor Canvas Mesh Workflow UX - Test Adequacy Re-review

verdict: pass

## Findings

None.

## Prior Finding Closure

1. Ready-state canvas nudge coverage is now adequate.

   The workflow test selects two real mesh canvas vertices, calls `nudgeMeshCanvasSelection({ x: 1, y: 0 })`, and asserts the result is committed through `moveMeshVertex`, updates `latestSessionPersistenceResult`, records the expected operation log chain, preserves selected vertex IDs, and changes both vertex coordinates (`apps/editor/src/editor-workflow/workflow-controller.test.ts:722`). This exercises the controller path that delegates to `commitWorkflowMeshCanvasMove` and then `adapter.commitMoveMeshVertex` (`apps/editor/src/editor-workflow/workflow-controller.ts:652`, `apps/editor/src/editor-workflow/mesh-canvas-workflow.ts:96`).

   The UI nudge test has also been split into realistic states: the empty selection case asserts the nudge button is disabled and does not click it (`apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts:142`), while the selected state asserts the same button is enabled before emitting the click and checking `onNudgeMeshCanvasSelection` (`apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts:174`). The selected UI fixture is not an impossible state: it is built through `projectLoadedPackageState` with `editorState.activeTool: "meshEdit"` and vertex IDs (`apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts:347`), and the projection path normalizes those IDs into `meshEdit.selectedVertexIds` and `canDraftCanvasMeshMove` (`apps/editor/src/editor-state/editor-state-projections.ts:113`, `apps/editor/src/editor-state/mesh-edit-state.ts:192`).

2. SVG pointer drag and modifier-selection wiring are now covered.

   The UI test now sends Shift, Ctrl, and Meta click payloads to SVG vertex targets and verifies the emitted selection modes are `add`, `toggle`, and `toggle` (`apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts:201`). That maps directly to the component's `resolveSelectionMode` logic (`apps/editor/src/ui/drawable-authoring/mesh-canvas-editor.ts:235`).

   Pointer drag callback wiring is covered by a selected SVG vertex test that emits `pointerdown` and `pointerup` with client coordinates and verifies the resulting drag delta (`apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts:236`). The fake DOM was extended to carry modifier and pointer fields into event listeners (`apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts:510`), and the implementation computes the pointer delta only when the target is selected and editable (`apps/editor/src/ui/drawable-authoring/mesh-canvas-editor.ts:133`).

## Verification Assessment

Reproduced Gnome's focused verification:

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts`: passed, 2 files / 43 tests.
- `pnpm.cmd typecheck`: passed root and editor typecheck.
- `git diff --check -- apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts discussion/implementation/waves/wave29/wave29-domain-f-editor-canvas-mesh-workflow-ux-gnome-report.md`: passed with LF-to-CRLF working-copy warnings only.

Domain G browser/mobile/a11y remains a stated residual risk, but it is outside this Domain F re-review gate. No new unacceptable test gap was found in the Gnome fix pass.

## User Decision Points

None.

## Report Path

`discussion/implementation/reviews/wave29/wave29-domain-f-editor-canvas-mesh-workflow-ux-test-rereview.md`
