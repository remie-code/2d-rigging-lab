# Wave66 Domain B Report: Evaluated Canvas Rendering / Overlay / Hit Test Integration

- Verdict recommendation: `ready_for_review`
- Domain: `wave66-evaluated-canvas-rendering-overlay-hit-test`
- Agent: Gnome
- Date: 2026-06-13

## Changed Files

- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
  - Extended `CanvasEvaluatedScene` with evaluated rig overlay data for Warp / Rotation controls.
  - Keeps renderer and hit-test logic out of evaluation; exposes evaluated control point positions / pivot / angle for projection consumption.
- `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
  - Added direct assertion that evaluated Warp rig overlay coordinates follow evaluated offsets.
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
  - Rewired `createCanvasRenderProjection` to consume `createCanvasEvaluatedScene`.
  - Projects evaluated drawable mesh/bounds/opacity/masks, evaluated mesh overlay, evaluated deformer overlay, and evaluated-bounds hit-test data.
  - Keeps bitmap cache content key independent of parameter-scrub bounds/opacity changes.
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
  - Added evaluated mesh triangle texture drawing path with rectangular fallback.
  - Uses the same drawable drawing helper for clipped scratch/mask pass.
- `apps/editor/src/workspace/canvas/canvas-renderer.test.ts`
  - Added non-pixel Canvas2D call-level coverage for evaluated mesh rendering.
  - Asserts triangle rendering uses `clip`, `transform`, and `drawImage(image, 0, 0)`.
  - Asserts `rectFallback` and degenerate-only meshes use rectangular fallback drawing.
- `apps/editor/src/workspace/canvas/canvas-triangle-texture-warp.ts`
  - New Canvas2D affine triangle texture-warp utility.
- `apps/editor/src/workspace/canvas/canvas-triangle-texture-warp.test.ts`
  - New focused tests for affine transform and degenerate triangle rejection.
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
  - Added evaluated Warp geometry, mesh overlay, deformer overlay, hit-test, and control point preview projection tests.
  - Updated Rotation overlay expectation to evaluated bounds.
- `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts`
  - Routes control point drag preview into projection/evaluation so artwork updates live.
  - Keeps exact-keyform edit gate and single commit path intact.
- `apps/editor/src/workspace/canvas/warp-deformer-control-points.ts`
  - Uses evaluated control point positions for overlay hit-test and drawing when available.
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
  - Supplies a projection factory for control point preview evaluation.
  - Uses current render projection for drawable hit-test.
- `discussion/implementation/waves/wave66/wave66-domain-b-evaluated-canvas-rendering-overlay-hit-test-report.md`
  - This report.

## Verification Commands / Results

- `pnpm.cmd --dir apps/editor typecheck`
  - pass.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-renderer.test.ts apps/editor/src/workspace/canvas/canvas-triangle-texture-warp.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/workspace/canvas/canvas-evaluation.test.ts apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts`
  - First sandboxed attempt failed before tests with Windows `spawn EPERM` while loading Vite/Vitest config.
  - Escalated rerun: pass, 5 files passed, 28 tests passed.
- `git diff --check -- apps/editor/src/workspace/canvas apps/editor/src/workspace/panels/canvas-preview-panel.tsx discussion/implementation/waves/wave66`
  - pass. Git emitted LF-to-CRLF working-copy warnings only.

## Fix Loop 1 Test Adequacy Response

- Addressed the Medium review finding by adding `canvas-renderer.test.ts`, which directly executes `renderCanvasProjection` with a fake Canvas2D context.
- The new renderer test proves a non-`rectFallback` evaluated mesh takes the triangle path with semantic Canvas2D calls: `clip`, `transform`, and `drawImage(image, 0, 0)` once per valid triangle.
- The same test file proves fallback behavior for both `rectFallback` meshes and degenerate-only evaluated meshes by asserting rectangular `drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height)` and no triangle `clip` / `transform` calls.
- The Low review finding for pointermove-to-preview projection factory wiring remains a residual low risk. Existing projection tests cover `controlPointPreview` changing drawable geometry, existing interaction tests cover gate/commit/undo behavior, and adding a direct hook/component pointermove test would require a heavier React DOM harness than the narrow fix loop warrants.

## Basis Coverage Self-Report

| Basis item | Status | Evidence |
|---|---|---|
| Consume Domain A evaluation boundary | Implemented | `canvas-projection.ts` calls `createCanvasEvaluatedScene`; renderer remains session-free. |
| Evaluated image rendering | Implemented | `canvas-renderer.ts` draws non-fallback evaluated mesh triangles via `canvas-triangle-texture-warp.ts`; `canvas-renderer.test.ts` directly asserts triangle `clip` / `transform` / `drawImage(image, 0, 0)` calls. |
| Meshless / unavailable fallback | Implemented | `rectFallback` meshes and invalid/degenerate triangles fall back to rectangular `drawImage`; non-renderable bytes remain excluded. `canvas-renderer.test.ts` directly asserts `rectFallback` and degenerate-only fallback behavior. |
| Selection bounds follow evaluated coordinates | Implemented | `selectionBounds` is derived from evaluated drawable bounds. |
| Mesh overlay follows evaluated coordinates | Implemented | `CanvasMeshOverlayProjection.mesh` now uses evaluated mesh vertices. |
| Warp lattice overlay follows evaluated coordinates | Implemented | evaluation exposes `evaluatedControlPoints`; overlay/hit-test helper uses them. |
| Rotation guide follows evaluated coordinates | Implemented | evaluation exposes evaluated pivot/angle; projection uses evaluated selected drawable bounds for rotation domain. |
| Grid / origin / canvas bounds stay stage-level | Implemented | renderer grid/origin/canvas bounds code remains stage-bound based. |
| Drawable hit test uses evaluated bounds | Implemented | `hitTestTopmostDrawable` continues bounds hit-test over projection drawables, now evaluated bounds. |
| Deformer control point hit test priority | Preserved | panel still calls `warpControlPoints.handlePointerDown` before drawable selection hit-test. |
| Hidden drawable excluded | Preserved | projection carries evaluated `visible`; hit-test skips invisible/non-renderable drawables. |
| Warp drag preview deforms actual artwork | Implemented | hook passes `controlPointPreview` into preview projection; projection tests assert drawable bounds/mesh change. |
| Pointerup commit / viewport boundary | Preserved | existing gesture controller path is unchanged; panel does not fit view on pointerup. |
| Keyform-position gate | Preserved | `canCommitWarpControlPointOffsetUpdate` gate is unchanged and covered by existing control point editing test. |
| Parent-child deformer chain | Implemented via Domain A | projection consumes evaluated drawable mesh/bounds; Domain A tests cover parent influence. |

## Intentionally Deferred Basis Items

- Full deformed clipping/mask parity remains out of scope. The current scratch/mask pass uses evaluated drawable drawing where possible, but no Photoshop pixel-perfect or full clipping system was introduced.
- Triangle-level drawable hit-test is deferred. v0 acceptance requires evaluated bounds at minimum, which is implemented.
- Exact inverse local-coordinate handling for child Warp control edits under non-linear parent deformation remains a Domain A residual/future runtime alignment item.
- WebGL renderer rewrite, rotate view, rulers, multiselect transform, and general canvas transform tools were not introduced.

## User Workflow Trace

```text
Parameter scrub / keyform interpolation
  -> CanvasPreviewPanel creates a projection
  -> createCanvasRenderProjection calls createCanvasEvaluatedScene
  -> evaluated drawable mesh / opacity / bounds enter CanvasRenderProjection
  -> renderer draws evaluated mesh triangles
  -> selection, mesh overlay, deformer overlay, and hit-test use evaluated coordinates
```

```text
Warp control point drag at editable keyform
  -> pointerdown hits evaluated control point before drawable hit-test
  -> pointermove computes preview offsets without mutating AuthoringSession
  -> preview offsets are passed to createCanvasEvaluatedScene
  -> rendered artwork and Warp overlay update together
  -> pointerup commits through the existing one-shot gesture controller
```

## Must-not Compliance Evidence

- No `packages/**` Mesh V2.6 or package algorithm files were changed by Domain B.
- No renderer import of `AuthoringSession` was added.
- Renderer does not duplicate parameter/deformer evaluation; it only draws projection data.
- Projection consumes `createCanvasEvaluatedScene` instead of reimplementing drawable/deformer evaluation.
- No dependency was added; `apps/editor/package.json` was not changed.
- No WebGL renderer rewrite was introduced.
- No screenshot/pixel oracle was used as a pass condition.
- No save/load format, Viewer/Runtime Preview integration, or external runtime API changes were made.

## Residual Risk Classification

- Residual risk: medium.
- Reason:
  - Focused unit coverage now covers renderer triangle path selection, renderer rectangular fallback, triangle transform, evaluated projection/hit-test, evaluated overlay, and preview projection.
  - Direct hook/component pointermove coverage for `createPreviewProjection` wiring remains intentionally deferred as low residual risk.
  - Canvas2D triangle warp is pragmatic v0 rendering and may show minor seams or interpolation artifacts; no pixel-perfect compositing claim is made.
  - Full deformed clipping/mask support is intentionally deferred.
  - Exact local inverse math for editing child controls under non-linear parents remains a known follow-up.

## Notes for Domain D

- Include both Domain A and Domain B editor canvas tests in final validation.
- Include `canvas-renderer.test.ts` in the Domain B focused renderer validation set.
- Confirm `canvas-renderer.ts` remains `AuthoringSession`-free.
- Confirm Domain B did not touch Mesh V2.6 package files; current package changes belong to Domain C.
- Final integration should decide whether to update `discussion/implementation/waves/wave66/_map.md` with this report path.
