# Wave 14 Domain A Completion: Preview Runtime Projection Foundation

> Wave: `editor-embedded-preview-foundation`
> Domain: `wave14-preview-runtime-projection-foundation`
> Verdict: `pass`

## Scope

Domain A added a DOM-free editor preview projection under `apps/editor/src/editor-preview/**`. The projection converts runtime snapshot, runtime diff, and runtime diagnostics into a compact preview DTO for later UI rendering.

No app shell UI, workflow wiring, CSS, browser sample package, package/runtime contracts, or public `index.ts` files were edited.

## Files Changed

Production:

- `apps/editor/src/editor-preview/preview-dto.ts`
- `apps/editor/src/editor-preview/diagnostics-summary.ts`
- `apps/editor/src/editor-preview/keyform-sample-summary.ts`
- `apps/editor/src/editor-preview/runtime-diff-summary.ts`
- `apps/editor/src/editor-preview/preview-projection.ts`

Tests:

- `apps/editor/src/editor-preview/preview-projection.test.ts`

Reports:

- `discussion/implementation/waves/wave14/wave14-preview-runtime-projection-foundation-completion.md`
- `discussion/implementation/reviews/wave14/wave14-preview-runtime-projection-foundation-review.md`

## Implementation Summary

- Added `EditorPreviewProjectionDto` with snapshot identity, optional canvas size, draw list, drawable counts, ordered drawable DTOs, keyform sample summary, diagnostics summary, and optional runtime diff summary.
- Added drawable DTO state derived from runtime evaluated drawables: drawable id, name fallback, mesh id, visibility, opacity, base/evaluated draw order, projection order, draw list index, bounds, vertex hash/count, and polygon points when runtime vertices are present.
- Ordered visible drawables by runtime `drawList` and retained hidden/unlisted drawables using evaluated draw order, base draw order, and drawable id as deterministic tie-breakers.
- Summarized keyform samples by evaluator and target.
- Summarized diagnostics from snapshot-level, dynamics-level, and drawable-level runtime diagnostics.
- Summarized runtime diff counts and affected drawables from `RuntimeDiffDto`.

## Tests And Verification

Passed:

- `pnpm.cmd exec vitest run apps/editor/src/editor-preview/preview-projection.test.ts`
  - 1 test file / 4 tests passed.
- `pnpm.cmd typecheck`
  - root typecheck and editor typecheck passed.
- `pnpm.cmd run check:source`
  - source organization guard passed.
- Untracked whitespace check:
  - checked 6 new `apps/editor/src/editor-preview` files with `git diff --check --no-index`; no whitespace errors.

Attempted but not used as final focused evidence:

- `pnpm.cmd --filter @private-2d-rigging-lab/editor test -- src/editor-preview/preview-projection.test.ts`
  - Initial sandbox run failed with `EPERM` reading Vitest from `node_modules`.
  - Escalated rerun executed the editor package script, but the script did not narrow to only the requested file and ran broader editor tests. The new preview test passed, while unrelated existing path-sensitive tests failed with missing fixture/path ENOENT errors.

## Review Findings And Fixes Applied

First independent review verdict: `needs_changes`.

- Finding: top-level preview diagnostics summarized snapshot and drawable diagnostics but omitted `snapshot.dynamics[].diagnostics`.
- Fix: `preview-projection.ts` now includes dynamics diagnostics in the top-level diagnostics summary.
- Test fix: `preview-projection.test.ts` now includes a dynamics diagnostic fixture and verifies it appears in the projected diagnostics summary.

Second independent review verdict: `pass`.

- Findings: none.

## Review Lane Results

Runtime Truthfulness: pass.

- Projection derives drawable order, renderable state, keyform summary, diagnostics, and diff summary from runtime snapshot/diff inputs.
- No DOM or UI rendering semantics are introduced.

Development Compliance: pass.

- Source files are responsibility-scoped.
- No catch-all source file or implementation-heavy `index.ts` was added.
- All source writes stayed inside `apps/editor/src/editor-preview/**`.

Test Adequacy: pass.

- Focused tests cover draw list ordering, hidden drawable retention, opacity, bounds, polygon points, keyform sample summary, diagnostics including dynamics and drawable diagnostics, and runtime diff summary.

## Remaining Issues

- None blocking for Domain A.
- `canvasSize` is optional because current `RuntimeSnapshotDto` does not carry canvas dimensions.
- Drawable `name` falls back to `drawableId` unless a caller provides names; current runtime snapshot carries drawable id and mesh id, not display names.

## User-Decision Points

- None.

## Provisional Assumptions

- Later UI/workflow domains will provide optional canvas size and drawable display names if those values are available from package/editor state.
- Callers that pass `runtimeDiff` are responsible for passing a diff corresponding to the projected snapshot.
