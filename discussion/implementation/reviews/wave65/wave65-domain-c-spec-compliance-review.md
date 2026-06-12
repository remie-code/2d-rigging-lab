# Wave65 Domain C Spec Compliance Review

status: pass

## Findings

- None blocking or needs-fix.

## Re-review Scope

- Re-reviewed after Gnome fix pass 1.
- Main extraction reviewed: `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts`.
- Confirmed `canvas-preview-panel.tsx` now mostly wires projection, generic pan/select, rendering, and semantic data attributes.
- Confirmed the Domain C report and focused test were updated for preview-before-commit behavior.

## Evidence Summary

- Warp control point screen positions and hit tests remain implemented in pure helpers:
  - `apps/editor/src/workspace/canvas/warp-deformer-control-points.ts:40` lists positions from Warp overlay geometry.
  - `apps/editor/src/workspace/canvas/warp-deformer-control-points.ts:68` computes each canvas position from domain bounds plus `controlPointOffsets`.
  - `apps/editor/src/workspace/canvas/warp-deformer-control-points.ts:91` hit-tests by screen-space distance with a 10 px default tolerance.
  - `apps/editor/src/workspace/canvas/warp-deformer-control-points.ts:128` selects control points inside a marquee rectangle.
- Single and marquee selection remain editor-local state after extraction:
  - `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:128` stores drag state in a hook ref.
  - `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:129` stores control point selection in hook state.
  - `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:130` stores preview offsets in hook state.
  - `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:133` stores marquee rectangle in hook state.
  - `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:164` clears stale selection/preview/marquee when the active rig id or point count changes.
- Panel wiring now delegates Warp interaction lifecycle to the hook:
  - `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:139` creates the Warp interaction hook with active parameter/session/projection/view.
  - `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:345` delegates pointerdown to the hook before falling back to generic selection.
  - `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:370` delegates hover/drag pointermove to the hook when no generic pan/select drag is active.
  - `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:414` delegates pointerup/cancel finish to the hook.
  - `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:627` exposes semantic edit/hover/preview/selection data attributes only.
- Drag preview and commit timing still satisfy the contract:
  - `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:280` handles point-drag pointermove.
  - `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:286` requires editable/controller before computing preview offsets.
  - `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:297` sets transient preview offsets.
  - `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:326` handles pointer drag finish.
  - `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:338` gates commit on pointerup/cancel `commit`, editable/controller, movement, and changed offsets.
  - `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:345` is the only hook path that calls `input.commitGestureController(...)`.
- Commit still uses the Wave64 keyform operation and Domain A gesture/history contract:
  - `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:213` creates `createEditorSessionGestureCommitController(...)` only for editable keyform positions.
  - `apps/editor/src/workspace/canvas/warp-deformer-control-point-gesture.ts:23` creates the gesture helper.
  - `apps/editor/src/workspace/canvas/warp-deformer-control-point-gesture.ts:33` routes commit through `commitEditKeyformKey(...)` with `updateCurrent`.
  - `apps/editor/src/features/editor-session/editor-session-context.tsx:917` calls `controller.commitOnce(...)` against current session/history.
- Non-keyform direct drag remains blocked:
  - `apps/editor/src/workspace/canvas/warp-deformer-control-point-gesture.ts:15` requires `projection.canEditValue` and an active parameter.
  - `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:161` derives editability from `canCommitWarpControlPointOffsetUpdate(...)`.
  - `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:213` creates no gesture controller when the binding projection is not editable.
  - `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:286` and `:338` prevent preview/commit without editable/controller.
- Focused test coverage now explicitly covers preview-before-commit:
  - `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:149` calls `controller.preview(...)`.
  - `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:151` verifies preview offsets.
  - `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:152` verifies history is still clean after preview.
  - `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:154` verifies the session keyform offsets are unchanged before commit.
  - `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:156` commits once, `:164` verifies one undo entry, and `:165` verifies a second `commitOnce` returns `null`.

## Acceptance Checklist

- [x] Warp control point screen positions are computable and hit-tested.
- [x] Single selection is editor-local state.
- [x] Marquee range selection is editor-local state.
- [x] Drag moves selected point(s).
- [x] Pointermove is preview-only.
- [x] Pointerup performs one commit.
- [x] Commit uses `createEditorSessionGestureCommitController(...).commitOnce(...)`.
- [x] One gesture produces one undo entry.
- [x] Commit uses Wave64 `editKeyformKey(updateCurrent)` / `controlPointOffsets` contract.
- [x] Direct drag is blocked when current parameter position is not editable keyform.
- [x] No rotation deformer direct editing found.
- [x] No keyboard nudge found.
- [x] No bounding box transform / scale / rotate selected points found.
- [x] No reset selected/all points feature found.
- [x] No manual mesh vertex/edge editing added in Domain C files.
- [x] No persisted UI selection state found.
- [x] No Mesh V2.5 work in Domain C scope.

## Verification Performed

- Re-read the extracted hook, `canvas-preview-panel.tsx`, control-point helpers, gesture helper, renderer interaction state, editor session gesture/history bridge, focused test, and updated Domain C report.
- Searched reviewed implementation files for persisted selection state and forbidden scope terms including keyboard nudge, bounding transforms, reset selected/all, manual mesh vertex/edge editing, rotation direct editing, and Mesh V2.5.
- Interpreted search hits for `nudgeZoomAtViewportCenter`, `resetOneToOneView`, mesh overlay rendering, and fixture vertex IDs as pre-existing/generic Canvas or test-fixture code, not forbidden Domain C control point features.
- Ran focused tests:
  - First sandbox attempt: `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts apps/editor/src/features/editor-session/model/editor-session-gesture-commit.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
  - Result: failed with known Vite/esbuild `spawn EPERM`.
  - Approved rerun: passed, 3 files / 8 tests.
- Ran `pnpm.cmd typecheck`: passed.
- Ran `git diff --check -- ...` for Domain C files/report/review: passed with LF-to-CRLF working-copy warnings only.

## Residual Risks

- Low: The extracted hook itself is not covered by a React hook/component pointer test; the interaction contract is covered by code inspection plus focused helper/gesture/history tests.
- Low: No Playwright pointer path was added for the Canvas drag workflow. This is consistent with the focused-test-first oracle, but leaves browser pointer integration as a later smoke candidate.
- Low: The implementation previews and edits Warp overlay offsets, not full deformed artwork rendering. This matches the current Canvas renderer boundary and Domain C report, but remains a broader UX limitation.
