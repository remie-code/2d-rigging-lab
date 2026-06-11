# Wave59 Domain A UX / Source Structure Review

- verdict: `pass`
- target: Wave59 `canvas-renderer-psd-drawable-display-v0`
- reviewer: Review-Sylph 1 - UX / screen-design / source-structure
- report path: `discussion/implementation/reviews/wave59/domain-a-ux-source-structure-review.md`

## Scope Reviewed

Basis documents:

- `discussion/implementation/orchestration/wave59-plan.md`
- `discussion/design/screen-design/components/canvas-preview.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/components/parts-tree.md`
- `discussion/design/screen-design/components/drawable-inspector.md`
- `discussion/design/screen-design/e2e-oracle.md`
- `discussion/design/screen-design/react-editor-foundation-oracle.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/operation-policy.md`
- `.github/skills/implementation-orchestration/SKILL.md`

Implementation evidence:

- `discussion/implementation/waves/wave59/domain-a-gnome-report.md`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`
- related PSD import planner/commit/parser files and package opacity files touched in the current workspace diff
- package/data-contract and test/E2E review reports as secondary evidence, not as substitutes for source inspection

## Findings

No blocking UX or source-structure findings remain for this review lane.

### 1. Prior hidden-only Isolate Selected finding is resolved

Status: resolved; no longer actionable.

The previous pre-fix review found that selecting only hidden drawable content could leave Isolate Selected enabled and dim all visible artwork. Current source fixes that in both the panel and renderer:

- `hasIsolatableCanvasSelection` now requires the selection to contain a selected or subtree-selected drawable that is both visible and renderable (`apps/editor/src/workspace/canvas/canvas-projection.ts:311`).
- `CanvasPreviewPanel` derives `canIsolateSelection` from that helper, reports isolate as pressed only when the helper is true, and disables the button otherwise (`apps/editor/src/workspace/panels/canvas-preview-panel.tsx:103`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:106`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:397`).
- `canvas-renderer.ts` also calls the helper before applying isolate dimming, while hidden/non-renderable drawables are skipped before draw (`apps/editor/src/workspace/canvas/canvas-renderer.ts:84`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:87`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:221`).
- Focused test coverage now checks visible drawable selection, visible part-subtree selection, hidden direct selection, and hidden-only part-subtree selection (`apps/editor/src/workspace/canvas/canvas-projection.test.ts:100`, `apps/editor/src/workspace/canvas/canvas-projection.test.ts:120`, `apps/editor/src/workspace/canvas/canvas-projection.test.ts:128`).

Focused Vitest verification passed after sandbox escalation: `apps/editor/src/workspace/canvas/canvas-projection.test.ts`, 1 file / 3 tests.

## UX Compliance Notes

- Canvas / Preview is no longer a static placeholder. The panel hosts a real `<canvas>` render surface (`apps/editor/src/workspace/panels/canvas-preview-panel.tsx:422`) and shows the empty state only when there is no renderable artwork (`apps/editor/src/workspace/panels/canvas-preview-panel.tsx:448`).
- Toolbar placement and controls match the v0 design shape: compact toolbar under the panel header, icon buttons, Fit Artwork, Fit Canvas, 1:1, zoom out/in, zoom percentage, grid/canvas/selection toggles, and Isolate Selected (`apps/editor/src/workspace/panels/canvas-preview-panel.tsx:351`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:354`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:360`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:363`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:374`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:398`).
- View navigation is implemented in local Canvas state: wheel zoom at pointer, middle/Space pan, fit artwork, fit canvas, and 1:1 reset (`apps/editor/src/workspace/panels/canvas-preview-panel.tsx:244`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:251`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:282`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:319`).
- Renderer overlays are concrete rather than decorative: grid, origin, canvas bounds, drawable stack, and selection overlay are drawn in `canvas-renderer.ts` (`apps/editor/src/workspace/canvas/canvas-renderer.ts:59`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:62`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:65`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:68`, `apps/editor/src/workspace/canvas/canvas-renderer.ts:71`).
- Normal visible UI is not polluted with operation IDs, evidence refs, raw diagnostics, materialized byte details, or test/debug prose. The Canvas includes non-visible `data-*` hooks for E2E observability (`apps/editor/src/workspace/panels/canvas-preview-panel.tsx:416` through `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:422`); this is not user-facing UI pollution, and the test/E2E review lane already accepted them as controlled hooks.

## Selection / Hit-Test Coherence

- Parts Tree row clicks use the shared editor-session selectors (`apps/editor/src/workspace/panels/structure-tree-panel.tsx:25`, `apps/editor/src/workspace/panels/structure-tree-panel.tsx:29`).
- Canvas consumes the same editor-session selection and selects via `selectDrawable` on hit (`apps/editor/src/workspace/panels/canvas-preview-panel.tsx:78`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:337`, `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:339`).
- Projection resolves direct drawable selection and part-subtree drawable selection outside React (`apps/editor/src/workspace/canvas/canvas-projection.ts:89`, `apps/editor/src/workspace/canvas/canvas-projection.ts:351`).
- Hit testing walks the projected draw stack from front to back and skips hidden or non-renderable drawables (`apps/editor/src/workspace/canvas/canvas-projection.ts:174`, `apps/editor/src/workspace/canvas/canvas-projection.ts:180`).
- The E2E path exercises import, Canvas renderability hooks, toolbar controls, Isolate Selected, Canvas click, and resulting Drawable inspector selection (`apps/editor/e2e/psd-import.e2e.spec.ts:45`, `apps/editor/e2e/psd-import.e2e.spec.ts:49`, `apps/editor/e2e/psd-import.e2e.spec.ts:56`, `apps/editor/e2e/psd-import.e2e.spec.ts:62`, `apps/editor/e2e/psd-import.e2e.spec.ts:77`).

## Source-Structure Notes

- Projection and renderer logic are not embedded in the React panel. `canvas-projection.ts` owns session projection, fit/zoom math, renderability checks, isolate eligibility, and hit testing; `canvas-renderer.ts` owns Canvas 2D drawing and bitmap caching.
- No new `index.ts` implementation file or broad catch-all `types.ts` / `schemas.ts` / `utils.ts` / `helpers.ts` file was added in the reviewed scope.
- `CanvasPreviewPanel` is 454 lines. This is acceptable for the current vertical slice because projection and renderer responsibilities were split out, but future Canvas additions should move toolbar or pointer/view interaction wiring into smaller owned modules/hooks before the panel grows further.
- `node scripts/check-source-organization.mjs` passed.

## Forbidden Scope Check

I did not find a broad GUI rewrite, legacy GUI/debug surface restoration, visual-regression or screenshot oracle, paint/pixel-editing tools, mesh/rig/dynamics/atlas implementation, Cubism/Live2D SDK work, or a new renderer dependency in this review lane. Canvas 2D remains the implementation path.

## Verification / Source Checks Performed

- `git status --short -uall`
- `git diff -- apps/editor/src/workspace/panels/canvas-preview-panel.tsx apps/editor/src/workspace/canvas/canvas-projection.ts apps/editor/src/workspace/canvas/canvas-renderer.ts apps/editor/e2e/psd-import.e2e.spec.ts`
- `git diff -- apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts apps/editor/src/features/psd-import/model/psd-import-commit.ts apps/editor/src/features/psd-import/model/psd-import-planner.ts apps/editor/src/features/psd-import/model/psd-import-types.ts packages/operation-core/src/operations/import-psd-layer-materialization.ts packages/operation-core/src/operations/import-psd-layer-materialization.test.ts`
- `git diff --check -- apps packages discussion`: pass, with CRLF normalization warnings only
- `node scripts/check-source-organization.mjs`: pass
- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-projection.test.ts`: sandbox run failed with esbuild `spawn EPERM`; approved escalation rerun passed, 1 file / 3 tests
- targeted `rg` / `Get-Content` source checks over Canvas, Parts Tree selection, editor-session selection, PSD import touched files, source-organization patterns, forbidden-scope terms, and basis documents

## Residual Risks / Decision Points

- No user-decision point is blocking this UX/source-structure review lane.
- Draw-order wording remains worth keeping aligned across future waves: current Canvas uses model draw-order projection and deterministic front-to-back hit testing, while the screen design describes Parts Tree top rows as frontmost. I did not find a Wave59 blocker after the package and test review lanes passed, but future row reorder/UI work should make the model order, tree visual order, and runtime order naming explicit.
- PSD clipping extraction remains a parser/product boundary item. This UX lane confirms the UI does not fake clipping support or claim Photoshop parity; the package/data-contract lane reviewed renderer-side mask relation behavior.
