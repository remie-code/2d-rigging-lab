# Wave78 Domain B Test Adequacy Review

- date: 2026-06-16
- lane: `wave78-domain-b-test-adequacy-review`
- target: `wave78-canvas-keyed-warp-scale-handles-gesture-integration`
- verdict: pass

## Scope Reviewed

Reviewed Domain B test adequacy from basis documents, source, tests, and focused verification. The Domain B implementation report was used as orientation only; evidence below was checked directly against source/tests.

Basis documents read:

- `discussion/implementation/orchestration/wave78-plan.md`
- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/implementation/waves/wave78/wave78-domain-a-warp-scale-geometry-keyform-safety-model-report.md`
- `discussion/implementation/reviews/wave78/wave78-domain-a-test-adequacy-review.md`
- `discussion/implementation/waves/wave78/wave78-domain-b-canvas-keyed-warp-scale-handles-gesture-integration-report.md`

Source/tests inspected:

- `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.test.ts`
- `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`

## Adequacy Matrix

| Required evidence | Review result | Direct evidence |
|---|---|---|
| Scale handles hidden/unavailable off-key | adequate | `scaleHandlesVisible` is gated by exact editable keyform state in `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:202`; scale hit testing only runs when visible/editable in `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:233`. The test covers exact-key visible and off-key hidden states in `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:205`. |
| Scale handles appear at exact editable keyform positions | adequate | The exact-key hook test exposes `rendererState.scaleHandlesVisible` in `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:219`. Position-sensitive pointer tests hit top-left corner at `{x:0,y:0}` and top edge at `{x:50,y:0}` in `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:286` and `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:338`. Source positions are derived from current control point bounds in `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:709` and renderer draws the same bounds-derived positions in `apps/editor/src/workspace/canvas/canvas-renderer.ts:432`. |
| Hit priority covers corner/edge before point drag | adequate | Pointerdown checks scale handles before `hitTestWarpControlPoint` in `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:233` and `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:280`; corner handles are tried before edge handles in `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:695`. Tests assert corner and edge drags do not select control points in `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:297` and `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:351`. |
| Pointermove preview updates full `controlPointOffsets` | adequate | Scale pointermove computes full offsets and previews the controller result in `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:424`. Tests assert a full 4-point corner preview and a full 9-point edge preview in `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:300` and `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:350`. |
| Pointerup commits once | adequate | Scale finish clears preview and commits only when `commit`, moved, and changed in `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:501`. The test asserts one commit, one undo entry, and second finish returns false in `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:305`. |
| Pointercancel discards preview | adequate | `finishPointerDrag({ commit: false })` clears preview and bypasses commit through the same scale finish path in `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:501`. The cancel test asserts no commit, empty undo stack, unchanged key offsets, and inactive preview in `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:404`. |
| Existing Warp point drag and marquee tests remain passing | adequate | Existing marquee coverage remains in `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:110`; point drag commit/undo regression remains in `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:136`; off-key point drag commit block remains in `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:193`. Focused Vitest run passed. |
| Canvas/evaluation projection shows scaled preview affects evaluated geometry | adequate | Projection carries `restControlPoints`, `controlPointOffsets`, and `evaluatedControlPoints` in `apps/editor/src/workspace/canvas/canvas-projection.ts:454`. Evaluation replaces evaluated offsets for preview in `apps/editor/src/workspace/canvas/canvas-evaluation.ts:392` and `apps/editor/src/workspace/canvas/canvas-evaluation.ts:899`. The scaled preview test asserts changed evaluated drawable bounds/mesh in `apps/editor/src/workspace/canvas/canvas-projection.test.ts:656`; existing evaluation preview test asserts preview changes geometry without mutating the session in `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts:418`. |
| Existing Rotation Deformer interaction priority remains intact or covered | adequate | `CanvasPreviewPanel` still delegates pointerdown/move/finish to Rotation before Warp in `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:379`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:415`, and `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:467`. Focused rotation lifecycle tests pass, including preview/commit/cancel coverage starting at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:372`. |
| Playwright smoke run or documented reason if not practical | adequate by documented reason | Not run. `apps/editor/e2e/psd-import.e2e.spec.ts` contains Warp overlay creation/committed smoke in `apps/editor/e2e/psd-import.e2e.spec.ts:430` and Rotation handle authoring smoke in `apps/editor/e2e/psd-import.e2e.spec.ts:657`, but no Warp scale handle gesture path. Focused hook/projection/renderer/evaluation Vitest coverage is more relevant for this domain. |
| Tests guard no rest/domain/lattice mutation indirectly where relevant | adequate with residual risk | Scale commit uses the existing `editKeyformKey(updateCurrent)` gesture for `controlPointOffsets` only in `apps/editor/src/workspace/canvas/warp-deformer-control-point-gesture.ts:23`; Domain B hook passes `restControlPoints` and lattice dimensions into pure scale math and commits only offsets in `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:249`. Tests assert committed keyform offsets and cancel non-mutation in `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:316` and `apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:411`. There is no explicit post-commit assertion for unchanged `domainBounds` / `restControlPoints`, so this remains a low residual test gap rather than a blocker. |

## Findings

No blocking test adequacy findings.

Low residual: renderer scale handle drawing is source-reviewed, but not directly asserted in `canvas-renderer.test.ts`. The implementation draws only when `interaction.scaleHandlesVisible` is true and the overlay is committed in `apps/editor/src/workspace/canvas/canvas-renderer.ts:352`, with positions derived from current control point bounds in `apps/editor/src/workspace/canvas/canvas-renderer.ts:432`. A focused renderer assertion would reduce visual-regression risk, but the hook position/visibility tests and renderer source are sufficient for this lane.

Low residual: tests indirectly protect `domainBounds` / `restControlPoints` by exercising the `controlPointOffsets` keyform gesture path, but they do not explicitly compare the rig control's rest/domain/lattice fields before and after a scale commit. Source review shows Domain B does not mutate those fields.

## Commands Run

- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/workspace/canvas/canvas-evaluation.test.ts apps/editor/src/workspace/canvas/canvas-renderer.test.ts`
  - sandbox result: failed during Vitest config load with esbuild `spawn EPERM`.
  - escalated rerun result: pass, 4 files / 44 tests.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts`
  - escalated run result: pass, 1 file / 10 tests.

## Residual Risks / Test Gaps

- No Playwright smoke was run because the available `psd-import.e2e.spec.ts` does not exercise Warp scale handle gestures. This is documented and acceptable for Domain B, but a future real browser gesture smoke would improve end-to-end confidence once the UI exposes stable test coordinates for scale handles.
- `canvas-renderer.test.ts` has no scale-handle-specific draw assertion. The rendering path is simple and source-reviewed, but pixel/call-level coverage would catch accidental removal of the handle draw call.
- Rotation priority evidence is source-reviewed at `CanvasPreviewPanel` plus focused Rotation hook tests; there is no mixed Rotation-vs-Warp pointer priority integration test. Since Domain B did not change the panel ordering, this is not a blocker.
