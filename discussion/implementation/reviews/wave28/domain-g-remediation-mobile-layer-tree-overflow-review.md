# Wave28 Domain G Remediation R1 Review: Mobile Layer Tree Overflow

## Verdict

pass

## Scope Reviewed

- `apps/editor/src/ui/layer-tree/layer-tree-panel.ts`
- `apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts`
- `discussion/implementation/waves/wave28/domain-g-remediation-mobile-layer-tree-overflow-gnome-report.md`
- Related e2e overflow/test-id context in `apps/editor/e2e/smoke-checks.mjs`, `apps/editor/e2e/test-ids.mjs`, and `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs`

## Findings

- No blocking or major findings.

## Source-Level Overflow Review

- The fix addresses the likely source of the mobile overflow in the layer-tree UI rather than relaxing the e2e oracle. `layer-tree-panel.ts` now constrains the workflow grid with `min-width: 0`, `max-width: 100%`, and `minmax(0, 1fr)` columns at `apps/editor/src/ui/layer-tree/layer-tree-panel.ts:62`.
- Form controls use `grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr))`, allowing fields to shrink to the available mobile column width without forcing horizontal page width at `apps/editor/src/ui/layer-tree/layer-tree-panel.ts:70`.
- Labels and long text use `overflow-wrap: anywhere`, while inputs/selects use `box-sizing: border-box; width: 100%; max-width: 100%; min-width: 0;` at `apps/editor/src/ui/layer-tree/layer-tree-panel.ts:80` and `apps/editor/src/ui/layer-tree/layer-tree-panel.ts:82`.
- The texture `<select>` is constrained through the shared select helper and keeps the currently selected long label available through `title` updates at `apps/editor/src/ui/layer-tree/layer-tree-panel.ts:127` and `apps/editor/src/ui/layer-tree/layer-tree-panel.ts:142`.
- Drawable row action controls wrap instead of forcing a single horizontal line at `apps/editor/src/ui/layer-tree/layer-tree-panel.ts:454`.

## Accessibility / Desktop Behavior

- Existing label-wrapped controls are preserved; the change adds layout constraints and selected-label title metadata without changing form command semantics.
- Action buttons retain `aria-label` and `aria-pressed` state.
- Desktop layout remains a two-column workflow grid with the same forms and callbacks. The source change does not alter part creation/update, drawable reassignment, texture assignment, selection, lock, or editor-hidden behavior.

## E2E Relaxation Check

- I found no relaxation of the horizontal overflow oracle. `apps/editor/e2e/smoke-checks.mjs:83` still captures `post-source-intake` overflow evidence, and `apps/editor/e2e/smoke-checks.mjs:89` still asserts it after the drawable workflow.
- Wave28 e2e adds, rather than removes, overflow checks around the part/texture/layer workflow at `apps/editor/e2e/smoke-checks.mjs:183` and after reset at `apps/editor/e2e/smoke-checks.mjs:186`.
- The standalone part/texture/layer smoke still throws on any detected horizontal overflow at `apps/editor/e2e/part-texture-layer-persistence-smoke.mjs:796`.

## Source Scope / Organization / Dependency Review

- The remediation source scope is appropriate for a focused UI source fix: layer-tree panel source, focused unit test, and implementation report.
- `apps/editor/src/ui/layer-tree/index.ts` remains a barrel export only, satisfying the source-file organization policy for this remediation.
- No dependency manifests, lockfiles, package manager files, external dependencies, parser/file-picker/image-decode paths, renderer work, or Cubism compatibility work were introduced by this remediation.
- The worktree contains broader upstream Wave28 A-G changes, but I did not identify forbidden remediation changes in the reviewed scope.

## Test Adequacy

- `apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts:93` adds focused coverage for the long texture selector case by asserting the responsive form grid, constrained select width, wrapping label, and selected-label title.
- The focused test is adequate for guarding the source-level markup/style regression, but it is not a browser layout engine test. For the original mobile-only failure, full e2e evidence remains the stronger verification.
- I did not rerun full `pnpm.cmd test:e2e` in this review. I treat Gnome's reported full e2e pass as secondary evidence and recommend the integrator keep a final full e2e rerun in the Wave28 gate.

## Verification Run

- Passed: `pnpm.cmd exec vitest run apps/editor/src/ui/layer-tree/layer-tree-panel.test.ts`
  - 1 test file passed.
  - 3 tests passed.

## Remaining Issues

- No remediation-specific issues remain.
- The separate Viewer Drawable Layer Evidence truthfulness concern from the earlier Domain G review is outside this mobile overflow remediation and remains separate from this verdict.

## User-Decision Points

- None.
