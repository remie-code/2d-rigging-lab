# Wave 14 Domain A Review: Preview Runtime Projection Foundation

> Wave: `editor-embedded-preview-foundation`
> Domain: `wave14-preview-runtime-projection-foundation`
> Final review verdict: `pass`

## Basis

- `discussion/implementation/orchestration/wave14-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- Changed files under `apps/editor/src/editor-preview/**`

## Independent Review Loop

### Review 1

Verdict: `needs_changes`

Finding:

- Top-level preview diagnostics omitted `snapshot.dynamics[].diagnostics`, which meant runtime dynamics diagnostics could be hidden from later preview UI.

Applied fix:

- `apps/editor/src/editor-preview/preview-projection.ts` now aggregates snapshot, dynamics, and drawable diagnostics.
- `apps/editor/src/editor-preview/preview-projection.test.ts` now includes a dynamics diagnostic fixture and assertion.

### Review 2

Verdict: `pass`

Findings:

- None.

Evidence reviewed:

- Runtime projection remains DTO-only and DOM-free.
- Draw order, visibility, opacity, bounds, geometry, keyform summary, diagnostics, and diff summary derive from runtime snapshot/diff inputs.
- Source organization is split across focused files under `apps/editor/src/editor-preview/**`.
- No public `index.ts` or broad catch-all source file was added.

## Review Lanes

Runtime Truthfulness: pass.

- The preview DTO uses `RuntimeSnapshotDto` and optional `RuntimeDiffDto` as source inputs.
- It does not recompute runtime semantics or introduce fake UI-side runtime state.

Development Compliance: pass.

- Allowed write scope was respected.
- Files are small and responsibility-scoped.
- No forbidden app shell, UI, CSS, e2e, sample package, package/runtime contract, or public index edits were made.

Test Adequacy: pass.

- Tests cover stable ordering by runtime draw list, hidden drawable retention, opacity, bounds, polygon points, keyform sample summaries, runtime diagnostics including dynamics diagnostics, and runtime diff summaries.

## Verification Reviewed

Passed:

- `pnpm.cmd exec vitest run apps/editor/src/editor-preview/preview-projection.test.ts`
- `pnpm.cmd typecheck`
- `pnpm.cmd run check:source`
- Untracked `apps/editor/src/editor-preview` whitespace check with `git diff --check --no-index`

Known non-domain test note:

- The editor package `test` script did not narrow when passed `-- src/editor-preview/preview-projection.test.ts`; it ran broader editor tests. The preview test passed in that run, but unrelated existing path-sensitive tests failed with ENOENT errors.

## Remaining Issues

- None for Domain A.

## User-Decision Points

- None.

## Provisional Assumptions

- Optional canvas size and drawable display names may be supplied by later UI/workflow domains because current runtime snapshot DTOs do not carry those values.
- Runtime diff correspondence to the projected snapshot is a caller responsibility.
