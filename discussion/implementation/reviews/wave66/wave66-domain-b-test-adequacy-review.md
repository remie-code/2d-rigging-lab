# Wave66 Domain B Test Adequacy Review

- Review lane: Test Adequacy Review
- Domain: `wave66-evaluated-canvas-rendering-overlay-hit-test`
- Reviewer: Review-Sylph
- Date: 2026-06-13
- Re-review: Fix Loop 1
- Final verdict: `pass`

## Findings

None.

## Fix Loop 1 Finding Resolution

### Fixed: rendererのevaluated mesh描画経路がテストで直接実行されていない

Prior severity: Medium.

The prior gap is fixed. `apps/editor/src/workspace/canvas/canvas-renderer.test.ts` now imports and executes `renderCanvasProjection` (`apps/editor/src/workspace/canvas/canvas-renderer.test.ts:5`, `apps/editor/src/workspace/canvas/canvas-renderer.test.ts:273`) through a fake Canvas2D context. This directly covers the renderer behavior, not only `resolveTriangleTextureWarpTransform`.

The test semantically distinguishes the evaluated triangle path from rectangular fallback without screenshot or pixel oracle:

- Non-`rectFallback` evaluated mesh uses triangle drawing: the test case starts at `apps/editor/src/workspace/canvas/canvas-renderer.test.ts:136` and asserts `clip`, `transform`, and triangle `drawImage(image, 0, 0)` calls (`apps/editor/src/workspace/canvas/canvas-renderer.test.ts:159`-`168`).
- The same non-fallback case asserts the rectangular `drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height)` fallback was not used (`apps/editor/src/workspace/canvas/canvas-renderer.test.ts:172`-`178`).
- `rectFallback` meshes fall back to rectangular drawing and avoid triangle `clip` / `transform` (`apps/editor/src/workspace/canvas/canvas-renderer.test.ts:181`-`217`).
- Degenerate-only evaluated meshes also fall back to rectangular drawing and avoid triangle `clip` / `transform` (`apps/editor/src/workspace/canvas/canvas-renderer.test.ts:221`-`253`).

This matches the implementation branch under review: `drawDrawableImage` returns early when `drawDrawableMeshImage` succeeds (`apps/editor/src/workspace/canvas/canvas-renderer.ts:403`-`423`), and `drawDrawableMeshImage` skips `rectFallback` / empty mesh data, clips each valid triangle, applies the affine transform, draws `image` at texture origin, and returns whether any triangle was drawn (`apps/editor/src/workspace/canvas/canvas-renderer.ts:474`-`541`).

### Accepted residual risk: drag previewのprojection factory wiringはsource inspection頼み

Prior severity: Low.

This remains a real but acceptable residual risk for this lane. The important semantic pieces are covered:

- Projection-level preview input changes actual drawable geometry, evaluated mesh, and evaluated overlay control points (`apps/editor/src/workspace/canvas/canvas-projection.test.ts:438`-`461`).
- Existing interaction tests cover direct drag commit preview data, single Undo boundary, and the keyform-position gate (`apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:124`-`190`).
- `CanvasPreviewPanel` passes the same `createProjection` factory to `useWarpDeformerControlPointInteraction` as `createPreviewProjection` (`apps/editor/src/workspace/panels/canvas-preview-panel.tsx:131`-`153`).
- The hook uses `createPreviewProjection` when preview state exists (`apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:138`-`148`) and pointermove populates preview state from the gesture controller (`apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:297`-`311`).

A hook/component pointermove test would increase confidence, but the wave plan permits focused editor tests and only stable semantic E2E where useful (`discussion/implementation/orchestration/wave66-plan.md:316`-`322`). Requiring a heavier React DOM harness is not warranted for this fix loop because the remaining gap is wiring-only and the projection/interaction contracts on both sides are already covered.

## Coverage Map

| In-scope requirement | Coverage judgment |
|---|---|
| Domain A evaluation boundaryをDomain B projectionへ接続する | Covered by unit/source evidence. `createCanvasRenderProjection` calls `createCanvasEvaluatedScene` with mesh draft, rig draft, control point preview, parameter values, selection, and hidden-part gates (`apps/editor/src/workspace/canvas/canvas-projection.ts:163`-`172`). Domain A evaluation tests cover scrub, interpolation/clamp, opacity, visibility, parent chain, rotation, draft, and non-mutation (`apps/editor/src/workspace/canvas/canvas-evaluation.test.ts:40`-`302`). |
| Evaluated mesh vertices / bounds / opacity are projected | Covered. Projection copies evaluated bounds, mesh, draw order, visibility, opacity, texture refs, and render bytes (`apps/editor/src/workspace/canvas/canvas-projection.ts:174`-`224`). Tests assert evaluated Warp geometry and selection bounds (`apps/editor/src/workspace/canvas/canvas-projection.test.ts:377`-`411`) and Rotation evaluated domain bounds/opacity (`apps/editor/src/workspace/canvas/canvas-projection.test.ts:345`-`375`). |
| Triangle texture warp utility transform correctness and degenerate rejection | Covered. Utility tests assert affine transform coefficients and both source/destination degenerate rejection (`apps/editor/src/workspace/canvas/canvas-triangle-texture-warp.test.ts:6`-`60`). |
| CanvasRenderer draws bitmap through evaluated triangles | Covered. `canvas-renderer.test.ts` executes `renderCanvasProjection` and asserts non-fallback evaluated mesh uses triangle `clip` / `transform` / `drawImage(image, 0, 0)` while avoiding rectangular fallback (`apps/editor/src/workspace/canvas/canvas-renderer.test.ts:136`-`178`). |
| Meshless / unavailable / fallback behavior | Covered enough for Domain B. Projection keeps hidden/non-renderable rules and render bytes (`apps/editor/src/workspace/canvas/canvas-projection.test.ts:53`-`85`, `177`-`194`), and renderer fallback selection is now directly tested for `rectFallback` and degenerate-only meshes (`apps/editor/src/workspace/canvas/canvas-renderer.test.ts:181`-`253`). |
| Bitmap / source texture cache is not regenerated just because parameter-scrub geometry changes | Covered at projection-content-key level. Content key excludes bounds/opacity and keeps identity/bytes/dimensions (`apps/editor/src/workspace/canvas/canvas-projection.ts:680`-`696`). No pixel/screenshot oracle needed. |
| Selection bounds follow evaluated coordinates | Covered. Projection derives `selectionBounds` from evaluated visible drawables (`apps/editor/src/workspace/canvas/canvas-projection.ts:226`-`232`) and tests evaluated Warp selection bounds (`apps/editor/src/workspace/canvas/canvas-projection.test.ts:400`-`402`). |
| Mesh overlay follows evaluated mesh | Covered. Mesh overlay resolves from evaluated scene and clones evaluated mesh (`apps/editor/src/workspace/canvas/canvas-projection.ts:360`-`382`); test asserts evaluated vertices in mesh overlay (`apps/editor/src/workspace/canvas/canvas-projection.test.ts:424`-`435`). |
| Warp lattice overlay follows evaluated coordinates | Covered. Evaluation exposes evaluated control points (`apps/editor/src/workspace/canvas/canvas-evaluation.ts:489`-`512`), projection carries them (`apps/editor/src/workspace/canvas/canvas-projection.ts:408`-`422`), overlay helper prefers them (`apps/editor/src/workspace/canvas/warp-deformer-control-points.ts:68`-`82`), and tests assert evaluated control point coordinates (`apps/editor/src/workspace/canvas/canvas-projection.test.ts:403`-`409`, `458`-`461`). |
| Rotation pivot / guide follows evaluated coordinates | Covered enough for v0. Projection uses selected evaluated bounds for rotation overlay domain and carries evaluated angle (`apps/editor/src/workspace/canvas/canvas-projection.ts:385`-`405`); test asserts rotated domain bounds and opacity (`apps/editor/src/workspace/canvas/canvas-projection.test.ts:345`-`375`). |
| Drawable hit test uses evaluated bounds, excludes hidden drawables, preserves topmost selection | Covered. `hitTestTopmostDrawable` scans projection drawables back-to-front and skips invisible/non-renderable drawables (`apps/editor/src/workspace/canvas/canvas-projection.ts:425`-`441`). Tests assert ordinary topmost selection, hidden exclusion, and evaluated moved-bounds hit test (`apps/editor/src/workspace/canvas/canvas-projection.test.ts:75`-`80`, `177`-`194`, `410`-`411`). |
| Deformer control point hit test is prioritized over drawable hit test | Covered by source inspection and existing interaction tests. Panel calls `warpControlPoints.handlePointerDown` before starting drawable selection (`apps/editor/src/workspace/panels/canvas-preview-panel.tsx:354`-`372`); control point hit-test behavior is covered in `warp-deformer-control-point-editing.test.ts:55`-`96`. |
| Warp control point drag preview deforms actual artwork | Adequately covered with accepted low residual wiring risk. Projection-level behavior is covered (`apps/editor/src/workspace/canvas/canvas-projection.test.ts:438`-`461`) and hook/panel wiring is present (`apps/editor/src/workspace/panels/canvas-preview-panel.tsx:131`-`156`; `apps/editor/src/workspace/canvas/use-warp-deformer-control-point-interaction.ts:138`-`148`, `297`-`311`). Pointermove-to-preview projection wiring lacks a direct hook/component test, but this is not a blocking gap for this fix loop. |
| Pointermove does not mutate session; pointerup commits one operation; Undo reverts | Covered by Domain A non-mutation tests and existing control point editing tests. Evaluation preview non-mutation is asserted (`apps/editor/src/workspace/canvas/canvas-evaluation.test.ts:220`-`245`); commit-once and Undo behavior are asserted (`apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:124`-`179`). |
| Keyform-position gate remains | Covered. Existing test blocks direct drag commit at interpolated parameter value (`apps/editor/src/workspace/canvas/warp-deformer-control-point-editing.test.ts:181`-`190`). |
| Apply / commit viewport is maintained | Manual/source rationale. Plan requires commit not to auto-fit (`discussion/implementation/orchestration/wave66-plan.md:340`-`342`; design basis `discussion/design/canvas-evaluation/canvas-evaluation-pipeline-v0.md:223`-`239`). Pointerup delegates to warp control point finish/commit and drawable hit-test, with no fit call on this path (`apps/editor/src/workspace/panels/canvas-preview-panel.tsx:419`-`455`); fit remains explicit toolbar action (`apps/editor/src/workspace/panels/canvas-preview-panel.tsx:302`-`312`). |
| Semantic E2E | N/A for this review gate. Wave plan allows minimal E2E only if stable and semantic (`discussion/implementation/orchestration/wave66-plan.md:322`), and preplan says to avoid screenshot/pixel oracle and DOM/CSS visual-layout E2E as the primary test (`discussion/implementation/waves/wave66/wave66-preplan-canvas-evaluation-inventory.md:80`-`84`). Current focused unit coverage is the right main strategy. |
| Triangle hit-test and full deformed clipping/mask parity | Deferred by plan. v0 requires evaluated bounds hit-test, not triangle hit-test (`discussion/implementation/orchestration/wave66-plan.md:335`-`338`); full clipping/mask parity and pixel-perfect Photoshop compositing are forbidden/non-goals (`discussion/implementation/orchestration/wave66-plan.md:354`-`359`). |

## Verification Evidence Reviewed

- Implementation report records `pnpm.cmd --dir apps/editor typecheck` as pass (`discussion/implementation/waves/wave66/wave66-domain-b-evaluated-canvas-rendering-overlay-hit-test-report.md:46`-`47`).
- Implementation report records focused Vitest as pass after escalated rerun: 5 files, 28 tests (`discussion/implementation/waves/wave66/wave66-domain-b-evaluated-canvas-rendering-overlay-hit-test-report.md:48`-`50`).
- Implementation report records `git diff --check` as pass with LF-to-CRLF warnings only (`discussion/implementation/waves/wave66/wave66-domain-b-evaluated-canvas-rendering-overlay-hit-test-report.md:51`-`52`).
- Review-Sylph did not rerun tests; this lane reviewed source, tests, reports, and search evidence.

## Forbidden Oracle Check

No pass condition relies on screenshot or pixel oracle. The renderer fix uses semantic Canvas2D call-level assertions, which is aligned with the Wave66 forbidden oracle rule (`discussion/implementation/orchestration/wave66-plan.md:354`-`357`).

## Final Verdict

`pass`

Reason: the prior Medium test adequacy gap is fixed by direct non-pixel renderer coverage, and the remaining drag-preview projection factory wiring gap is acceptable low residual risk for this fix loop.
