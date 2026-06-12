# Wave65 Domain C Report: Warp Deformer Canvas Control Point Editing

## Status

implemented

## Summary

- Warp Deformer の committed transform control points を Canvas 上で hit test / select / marquee select / drag edit できるようにした。
- Control point selection と drag preview は editor-local UI state として Canvas interaction hook 内に保持し、package model へ永続化していない。
- Pointermove は transient preview offsets を Canvas projection に重ねるだけで、pointerup のみ Domain A gesture controller の `commitOnce` 経由で `editKeyformKey(updateCurrent)` を commit する。
- keyform 位置では direct drag 可能、interpolated / non-keyform 位置では readonly 表示のまま direct drag commit を作らない。

## Fix Pass 1 Summary

- Design Development review 対応として、Warp control-point interaction/controller lifecycle を `use-warp-deformer-control-point-interaction.ts` に抽出した。
- `canvas-preview-panel.tsx` は Canvas projection creation、generic pan/select wiring、rendering/data attributes に責務を戻した。
- Test Adequacy review 対応として、gesture `preview` が history/session/keyform offsets を汚さないこと、最初の `commitOnce` だけが undo entry を作り、2回目が `null` になることを focused test に追加した。

## Changed Files

- `apps/editor/src/workspace/canvas/warp-deformer-control-points.ts`
  - Warp control point geometry, hit test, marquee selection, selection normalization, drag delta patch helpers.
- `apps/editor/src/workspace/canvas/warp-deformer-control-point-gesture.ts`
  - `editKeyformKey(updateCurrent)` gesture helper and keyform editability guard.
- `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts`
  - React interaction/controller hook for Warp point selection, marquee, drag preview, and pointerup commit lifecycle.
- `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts`
  - Focused tests for hit test, marquee, multi-point drag preview isolation, commitOnce, non-keyform block, and undo integration.
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
  - Selected / hovered / readonly Warp control point rendering support.
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
  - Consumes the Warp interaction hook, keeps generic Canvas pan/select wiring, and exposes semantic Canvas data attributes.
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
  - Thin `commitGestureController(...)` entry that invokes Domain A `controller.commitOnce(...)` with current session/history.
- `discussion/implementation/waves/wave65/wave65-domain-c-warp-deformer-canvas-control-point-editing-report.md`

## Design Notes

- Geometry logic is split from React so tests can prove screen-space hit testing, marquee containment, and offset patching without Canvas pixels.
- Warp pointer interaction/controller logic is isolated in a named Canvas hook; the panel no longer owns Warp-specific drag unions or commit lifecycle.
- Renderer uses the same control point position helper as hit testing, avoiding drift between visible points and interaction points.
- Drag preview is a `CanvasRenderProjection` override for the selected Warp overlay only. It does not mutate `AuthoringSession`.
- Drag commit uses `createWarpControlPointOffsetUpdateGesture(...)`, which routes to existing `commitEditKeyformKey(...)` and preserves the Wave64 keyform operation contract.
- Direct drag editability is derived from `createParameterBindingProjection(...).canEditValue`; the Canvas therefore shares the Inspector's keyform-position gate.

## Basis Coverage Self-Report

- Hit testing: implemented by `listWarpControlPointPositions(...)` and `hitTestWarpControlPoint(...)`.
- Selection: implemented as editor-local Canvas hook state with single-point selection, marquee replacement selection, selected point retention, and clear on click/background or stale scope.
- Drag editing: implemented for single selected point and multiple selected points; pointermove previews only, pointerup commits once.
- Editability gate: implemented through existing parameter binding projection; non-keyform positions cannot create drag commits.
- Undo: committed drag gestures enter Domain A history as one entry through `commitOnce`; focused test verifies Undo restores previous offsets.

## Intentionally Deferred Basis Items

- Rotation Deformer direct Canvas editing: not implemented.
- Keyboard nudge: not implemented.
- Bounding box transform / scale / rotate selected points: not implemented.
- Reset selected points / reset all points: not implemented.
- Manual mesh vertex / edge editing and Mesh V2.5: not touched.
- Package persistence of control point UI selection state: intentionally not added.
- Full deformed artwork rendering remains outside this Domain C scope; this work edits and previews the overlay offsets.

## User Workflow Trace

1. User selects a committed Warp Deformer in Rig Tool.
2. User chooses an active parameter and moves to an existing keyform marker/value.
3. Canvas shows Warp control points as editable.
4. User clicks a point to select it, drags it, and sees a transient overlay preview.
5. Pointerup commits one `editKeyformKey(updateCurrent)` operation and one undo entry.
6. User can drag a marquee over multiple points, then drag any selected point to move the selection together.
7. Undo restores the previous `controlPointOffsets`.
8. At a non-keyform parameter value, Canvas shows readonly points and drag does not commit.

## Must-Not Compliance Evidence

- No package/model schema, mesh algorithm, operation semantics, or runtime package files were changed.
- No Rotation Deformer direct manipulation was added.
- No keyboard, bounding-box transform, reset, mesh vertex/edge editing, or UI selection persistence was added.
- Existing unrelated worktree changes were not reverted.
- Source organization guard passed; new source files are responsibility-specific, not catch-all files.

## Verification Commands / Results

- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts`
  - Fix pass 1 sandbox attempt failed with known Vite/esbuild `spawn EPERM`.
  - Approved rerun passed: 1 file, 4 tests.
- `pnpm.cmd --dir apps/editor typecheck`
  - Pass in fix pass 1.
- `node scripts/check-source-organization.mjs`
  - Pass in fix pass 1: `Source organization guard passed.`
- `git diff --check -- apps/editor/src/workspace/canvas apps/editor/src/workspace/panels/canvas-preview-panel.tsx apps/editor/src/features/editor-session/editor-session-context.tsx discussion/implementation/waves/wave65/wave65-domain-c-warp-deformer-canvas-control-point-editing-report.md`
  - Pass with LF-to-CRLF working-copy warnings only.

## Residual Risk Classification

- Low: Canvas pointer event wiring is covered indirectly by extracted logic and typecheck, but not by a React component or Playwright pointer test.
- Low: Semantic Canvas data attributes were added for future smoke tests, but no E2E path was added in Domain C to avoid broadening the test surface.
- Medium: Canvas still renders deformer overlay preview rather than full deformed artwork; this matches the current Canvas renderer boundary but remains a broader UX limitation.

## Domain E Handoff Notes

- Domain E should verify that Domain B's custom slider/current-parameter contract still feeds the same `activeParameterId` and `parameterValues` consumed here.
- Domain E can use `data-warp-control-point-editable`, `data-warp-control-point-selected-count`, `data-warp-control-point-preview-active`, and first-offset data attributes for a small Playwright smoke if needed.
- Cross-domain Undo/Redo validation should include one committed Warp point drag followed by Undo/Redo.
