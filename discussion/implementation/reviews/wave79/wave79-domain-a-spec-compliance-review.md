# Wave79 Domain A Spec Compliance Review

## Verdict

pass

## Scope Reviewed

- Target wave: Wave79 `viewer-runtime-view-v0`
- Domain: A `wave79-clean-stage-render-foundation`
- Review lane: Spec Compliance Review
- Changed files reviewed:
  - `apps/editor/src/workspace/canvas/canvas-renderer.ts`
  - `apps/editor/src/workspace/canvas/canvas-renderer.test.ts`
  - `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
  - `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts`
  - `discussion/implementation/waves/wave79/wave79-domain-a-clean-stage-render-foundation-report.md`
- Supporting existing files inspected for source-level evidence:
  - `apps/editor/src/workspace/canvas/canvas-projection.ts`
  - `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
  - `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts`
  - `packages/render-webgl2/src/webgl2-renderer.ts`
- Explicitly ignored except for dependency/scope checks: Domain B `runtime-controls*` files.

## Basis Documents Used

- `discussion/implementation/orchestration/wave79-plan.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/_map.md`
- `discussion/design/screen-design/screens/_map.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Findings

No blocking findings.

No needs-fix findings.

## Evidence For Pass Items

Reusable Clean Stage render path exists and reuses the existing Editor Canvas projection/rendering path.

- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:38` defines `createViewerCleanStageProjection`.
- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:42` calls `createCanvasRenderProjection(session, null, ...)`, so the helper uses the lower-level Canvas projection path instead of reusing `CanvasPreviewPanel`.
- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:47` defines `renderViewerCleanStageProjection`.
- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:48` calls `renderCanvasProjection`, preserving the existing Canvas renderer path.

Clean Stage can render committed model projection with no selection, no drafts/previews, and no authoring overlays.

- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:42` passes `selection` as `null`.
- `apps/editor/src/workspace/canvas/canvas-projection.ts:184` calls `createCanvasEvaluatedScene` with draft/preview options defaulted to `null` when omitted.
- `apps/editor/src/workspace/canvas/canvas-projection.ts:213` and `apps/editor/src/workspace/canvas/canvas-projection.ts:216` derive selected and mesh-preview flags from the supplied selection/preview options; the Viewer helper supplies neither.
- `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:56` through `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:63` assert empty selection, no selection bounds, no mesh/deformer overlay, no selected/subtree flags, and no mesh preview.

Mesh/deformer/selection/control-point/scale-handle/layer-bound overlays and origin guide are absent in the Clean Stage render configuration.

- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:28` through `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:36` set `grid`, `originGuide`, `canvasBounds`, `selectionBounds`, `mesh`, `deformer`, and `isolateSelected` to `false`.
- `apps/editor/src/workspace/canvas/canvas-renderer.ts:116` gates `drawOrigin` behind `originGuide`.
- `apps/editor/src/workspace/canvas/canvas-renderer.ts:141` through `apps/editor/src/workspace/canvas/canvas-renderer.ts:156` gate selection, deformer/control-point/scale-handle, and mesh overlay drawing behind the overlay flags.
- `apps/editor/src/workspace/canvas/canvas-renderer.test.ts:483` verifies origin guide and authoring overlay drawing calls are absent for Clean Stage overlay state.

Neutral solid gray Clean Stage background is provided.

- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:26` defines `VIEWER_CLEAN_STAGE_BACKGROUND_COLOR` as `#6b7280`.
- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:53` passes that background to `renderCanvasProjection`.
- `apps/editor/src/workspace/canvas/canvas-renderer.test.ts:529` verifies the supplied clean background color is used.

Clipping/mask rendering is preserved and not bypassed.

- Canvas2D fallback still uses `maskSourceDrawableIds` in `apps/editor/src/workspace/canvas/canvas-renderer.ts:274` through `apps/editor/src/workspace/canvas/canvas-renderer.ts:287`.
- Canvas2D clipping still applies `destination-in` compositing in `apps/editor/src/workspace/canvas/canvas-renderer.ts:895`.
- The WebGL render-scene adapter preserves clipping metadata in `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts:50` through `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts:57`.
- The WebGL renderer consumes clipping masks in `packages/render-webgl2/src/webgl2-renderer.ts:70` through `packages/render-webgl2/src/webgl2-renderer.ts:88`.
- `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:65` verifies the Clean Stage projection retains the mask relation, and `apps/editor/src/workspace/canvas/canvas-renderer.test.ts:570` verifies clipping composition while clean overlays are suppressed.

Parameter override input affects evaluated/rendered projection without mutating session/project state.

- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:42` through `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:44` forward `parameterValues` into the Canvas projection options.
- `apps/editor/src/workspace/canvas/canvas-projection.ts:184` through `apps/editor/src/workspace/canvas/canvas-projection.ts:190` forward those values into Canvas evaluation.
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts:216` through `apps/editor/src/workspace/canvas/canvas-evaluation.ts:219` evaluate keyforms from the supplied parameter values.
- `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:47` through `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:75` assert that a session-only parameter value changes the projected face bounds and that the source session JSON remains unchanged.

Forbidden and out-of-scope areas remain outside Domain A.

- The Domain A changed source files do not import or call Domain B `runtime-controls*`, `ParameterBar`, `CanvasPreviewPanel`, authoring operation/history helpers, runtime-core semantic integration, export/diff/favorite/group/crop-guide code, or Cubism/SDK/formats.
- Parallel Domain B files are present in the workspace, but the reviewed Domain A source/test files do not depend on them.

## Validation

- Initial command: `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-renderer.test.ts apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts`
  - Result: failed in sandbox with `spawn EPERM` while loading Vitest/Vite config through esbuild.
- Approved rerun of the same focused command:
  - Result: pass.
  - Test files: 2 passed.
  - Tests: 13 passed.

## Residual Risks

- Domain A is a render foundation only. Dedicated Viewer screen integration, navigation, Back behavior, and Authoring `ParameterBar` suppression remain Domain C.
- Runtime Controls state, filtering, reset behavior, and the final override map passed into Clean Stage remain Domain B/C.
- No browser or pixel smoke was run in this review lane. The pass is based on source inspection and focused unit tests for projection/render behavior.
- Full runtime-core parity, grid2d parity, dynamics playback, export/diff/favorites/groups/crop guide, and crop/presentation framing remain intentionally out of scope for Domain A.

## User Decision Points

None.
