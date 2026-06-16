# Wave77 Domain A Report: Deformer Tree Selection + Pool Tree + Row Cleanup

- Verdict: `pass`
- Domain: `wave77-deformer-tree-selection-pool-tree-row-cleanup`
- Date: 2026-06-16
- Owner: Orch-Sylph
- Implementation delegate: Gnome
- Review lanes: Spec Compliance, Design / Development Compliance, Test Adequacy

## Summary

Domain A implemented the editor-local Deformer Tree selection foundation and rendering cleanup required before Wave77 wrap-selected UX work:

- Deformer Tree now supports mixed selection targets for Deformer rows, bound Drawable refs, and Pool Drawable rows.
- Normal, Ctrl/Meta, and Shift click transitions are implemented through a dedicated Deformer Tree selection target model.
- Drawable Pool now renders unbound Drawables under their Parts hierarchy, prunes empty containers, and keeps container rows display-only.
- Deformer Tree rows no longer show the secondary `control points` / pivot detail line.
- Existing Deformer Tree drag-and-drop routes remain wired through the existing bind/move/reparent commands.

## Changed Files

Implementation source and tests:

- `apps/editor/src/features/editor-session/model/editor-selection.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
- `apps/editor/src/workspace/panels/deformer-tree-view.tsx`
- `apps/editor/e2e/psd-import.e2e.spec.ts`

Persistent artifacts:

- `discussion/implementation/waves/wave77/wave77-domain-a-deformer-tree-selection-pool-tree-row-cleanup-report.md`
- `discussion/implementation/reviews/wave77/wave77-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave77/wave77-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave77/wave77-domain-a-test-adequacy-review.md`
- `discussion/implementation/waves/wave77/_map.md`
- `discussion/implementation/reviews/wave77/_map.md`

Note: the shared worktree already contained broad Wave76 and parallel-domain dirty changes, including `packages/**`. Domain A did not modify package, renderer, mesh generation, or save/load package-format files.

## Basis Coverage Self-Report

Covered basis:

- `discussion/implementation/orchestration/wave77-plan.md`
  - Domain A accepted scope from sections 3.1, 3.2, 3.3, 7.1, 7.2, and 9.
- `discussion/implementation/orchestration/wave76-plan.md`
  - Used for Wave76 Drawable-only Parts Tree multi-select and no-Deformer-Tree-selection baseline.
- `discussion/implementation/waves/wave76/wave76-final-integration-report.md`
  - Used as Wave76 pass baseline.
- `discussion/implementation/reviews/wave76/wave76-final-clean-integration-review.md`
  - Used as clean pass baseline.
- Development policies:
  - `discussion/development_convention/source-file-organization-policy.md`
  - `discussion/development_convention/ux-backed-package-logic-authority.md`
  - `discussion/development_convention/dependency-policy.md`
  - `discussion/development_convention/operation-policy.md`
  - `discussion/development_convention/schema-and-id-conventions.md`

Deferred by Wave77 plan:

- Wrap-selected operation foundation remains Domain B.
- Wrap-selected Rig Tool / Inspector UX remains Domain C.
- Final integration map closeout remains Domain D.

## User-Facing UX Trace

- Deformer Tree clicks now route through `selectDeformerTreeTarget`.
- Normal click replaces selection with the clicked row and updates the Deformer Tree anchor.
- Ctrl/Meta click toggles the clicked selectable row and updates the anchor.
- Shift click selects the visible selectable Deformer Tree range from anchor to clicked target.
- Pool container rows render as non-draggable display rows, while Pool Drawable rows remain selectable and draggable.
- Pool count displays unbound Drawable row count, not Parts container row count.
- Deformer rows now show the display name plus badges only; the old secondary `control points` / pivot text line is not rendered.

## Data / Schema / Operation Contract Trace

- `EditorSelection` gained an editor-local `deformerTreeSet` variant and typed `DeformerTreeSelectionTarget` union.
- Parts Tree `drawableSet` behavior remains separate and is not reused for Deformer Tree range selection.
- Selection and anchors remain React/editor session state and are not written to portable package data.
- Existing DnD behavior still dispatches to the existing editor commands:
  - Pool Drawable bind to Deformer.
  - Bound Drawable move between Deformers.
  - Deformer reparent.
- Domain A did not add operation payloads, package schema fields, dependencies, or package-format changes.

## Must-Not Compliance Evidence

- No Parts Tree `drawableSet` range order reuse for Deformer Tree range selection.
- No Pool Parts Container selection, DnD, or drop target.
- No already-bound Drawable appears in Pool projection.
- No Canvas modifier multi-select was added.
- No editor selection state is persisted into package data.
- No Inspector geometry controls were removed; focused E2E still edits Warp transform control-point inputs.
- No existing-Deformer auto-resize/refit behavior was added to DnD.
- No dependency additions.
- No forbidden package, renderer, mesh, or save/load package-format edits were made by Domain A.

## Verification Performed

Commands run by Orch-Sylph/Gnome:

- `pnpm.cmd typecheck`
  - Passed.
- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
  - Sandbox run failed with `spawn EPERM`.
  - Escalated rerun passed: 1 file, 12 tests.
- From `apps/editor`: `pnpm.cmd exec playwright test -c playwright.config.ts --grep "creates a Warp Deformer draft"`
  - Sandbox run failed when updating `apps/editor/test-results/.last-run.json`.
  - Escalated rerun passed: 1 test.
- `git diff --check -- <Domain A files>`
  - Passed with LF-to-CRLF working-copy warnings only.
- `node scripts/check-source-organization.mjs`
  - Passed, run by Design / Development Review-Sylph.
- `node scripts/check-dependencies.mjs`
  - Passed, run by Design / Development Review-Sylph.

## Review Results

- Spec Compliance Review: `pass`
  - `discussion/implementation/reviews/wave77/wave77-domain-a-spec-compliance-review.md`
- Design / Development Compliance Review: `pass`
  - `discussion/implementation/reviews/wave77/wave77-domain-a-design-development-review.md`
- Test Adequacy Review: `pass`
  - `discussion/implementation/reviews/wave77/wave77-domain-a-test-adequacy-review.md`

No blocking or needs-change findings were returned by any review lane.

## Residual Risk Classification

- Low: Full E2E suite was not run. Focused PSD-import E2E covered row cleanup, modifier selection, Pool container display-only behavior, and Pool Drawable DnD.
- Low: Meta-click is covered by shared Ctrl/Meta source mapping and transition tests, but not separately browser-exercised.
- Low: Bound Drawable ref DnD and Deformer node reparent paths remain source-routed and covered by existing tests/source review, but the focused grep run did not execute every DnD scenario in `psd-import.e2e.spec.ts`.
- Medium for later domains: `editor-session-context.tsx` and `rig-tool-state.ts` are large. Domain C should avoid adding substantial wrap-selected UX derivation directly to those files without considering a focused split.
- Planned follow-up: Domain C must consume `deformerTreeSet` for wrap-selected Inspector/UX; Domain A intentionally leaves mixed-selection Inspector behavior safe but minimal.

## User Decision Points

None.

## Final Recommendation

Wave77 Domain A can be accepted as `pass`. Carry the residual risks above into Domain C and final integration review rather than reopening Domain A.
