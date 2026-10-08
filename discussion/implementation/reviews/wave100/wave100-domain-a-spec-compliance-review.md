# Wave100 Domain A Spec Compliance Review

## Verdict

Verdict: `pass`.

No blocking spec-compliance findings were found. The implementation keeps Viewer Variant selection in Viewer-local React state, initializes and resets it from Project default active selection, applies the Variant predicate before render source remap, and does not touch Runtime Player, Runtime Export, package format, Workspace Save, Portable JSON, dependencies, or lockfiles.

## Basis Reviewed

- `discussion/implementation/orchestration/wave100-plan.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/screens/variant-expression-manager.md`
- `discussion/design/screen-design/_map.md`
- `discussion/implementation/orchestration/wave99-plan.md`
- `discussion/implementation/waves/wave99/wave99-final-integration-report.md`
- `discussion/implementation/reviews/wave99/wave99-final-clean-integration-review.md`
- `discussion/implementation/waves/wave100/wave100-domain-a-viewer-variant-switching-integration-report.md`
- Existing predicate behavior in `packages/authoring-core/src/variant-evaluation.ts`

## Scope Reviewed

- `apps/editor/src/workspace/viewer/viewer-variant-selection.ts`
- `apps/editor/src/workspace/viewer/viewer-variant-selection.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- Forbidden-scope status for Runtime Player, Runtime Export/materialization, package format, Workspace Save/Portable JSON-adjacent packages, dependency manifests, and lockfiles.

## Findings

Blocking findings: none.

Non-blocking findings: none.

## Rubric Results

| Rubric item | Result | Evidence |
|---|---|---|
| Viewer initial state uses Project default active selection | `pass` | `createInitialViewerVariantActiveSelections` delegates to default-based reconciliation in `viewer-variant-selection.ts:33`; `ViewerRuntimeScreen` initializes state from it at `viewer-runtime-screen.tsx:127`; default projection test starts at `viewer-runtime-screen.test.ts:367`. |
| Viewer Variant switching is session-only | `pass` | Selection is held in component state at `viewer-runtime-screen.tsx:127`; changes call `setViewerVariantActiveSelections` only at `viewer-runtime-screen.tsx:179`; no Viewer source call to save/export/dirty mutation was found. |
| Viewer Variant switching does not mutate Project default active selection | `pass` | Runtime Controls emits a new active-selection entry via callbacks at `runtime-controls.tsx:326` and `runtime-controls.tsx:347`; Viewer reconciles it into local state at `viewer-runtime-screen.tsx:181`; helper tests assert defaults are unchanged at `viewer-variant-selection.test.ts:78`. |
| Viewer Variant switching does not mark the project dirty | `pass` | Interactive Viewer test asserts `session.dirty === false` and no save call at `viewer-runtime-screen.test.ts:892`; source search found dirty/save references only in tests. |
| Viewer supports `singleSelect` and `multiToggle` groups | `pass` | Runtime controls route single-select and multi-toggle handlers at `runtime-controls.tsx:326` and `runtime-controls.tsx:347`; tests cover both at `runtime-controls-state.test.ts:507` and `viewer-runtime-screen.test.ts:892`. |
| Reset variants restores Project default active selection | `pass` | Reset rebuilds defaults with `createInitialViewerVariantActiveSelections` at `viewer-runtime-screen.tsx:192`; UI reset callback is wired at `viewer-runtime-screen.tsx:375`; interactive reset test starts at `viewer-runtime-screen.test.ts:892`. |
| Variants section is hidden when no groups exist | `pass` | RuntimeControls renders `null` when `variantGroups.length === 0` at `runtime-controls.tsx:134`; no-variant UI tests cover this at `runtime-controls-state.test.ts:356` and `viewer-runtime-screen.test.ts:215`. |
| Variants section is collapsible and active summary remains visible while collapsed | `pass` | Collapse state is local UI state at `runtime-controls.tsx:77`; summary is rendered in the collapsed header at `runtime-controls.tsx:315`; collapsed-summary tests start at `runtime-controls-state.test.ts:405` and `viewer-runtime-screen.test.ts:255`. |
| Runtime Controls order is Render Source, Variants, Parameter Search | `pass` | JSX order is render source, variants, then search at `runtime-controls.tsx:119`, `runtime-controls.tsx:134`, and `runtime-controls.tsx:147`; order tests start at `runtime-controls-state.test.ts:405` and `viewer-runtime-screen.test.ts:255`. |
| Variant predicate applies to both `Original` and `Atlas Runtime`, with predicate before render source remap | `pass` | `createCanvasRenderProjection` receives `variantVisibilityPredicate` before `createViewerRenderSourceProjection` in `viewer-runtime-screen.tsx:439`; the same flow is in `viewer-clean-stage.ts:61`; Atlas Runtime test starts at `viewer-render-source.test.ts:151`. |
| Runtime Player and Runtime Export are not changed | `pass` | `git status --short -uall -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/runtime-player packages/package-format packages/authoring-core/src/runtime-export-materialization.ts packages/operation-core packages/runtime-core packages/render-core packages/render-webgl2` produced no output. |
| Workspace Save / Portable JSON / package format are not changed | `pass` | Implementation/test changes are limited to `apps/editor/src/workspace/viewer/**`; Wave100 discussion artifacts are documentation/review outputs. No dependency or lockfile changes were present. |

## Verification Performed

- Inspected source and tests directly, not only the Domain A implementation report.
- Ran `git status --short -uall`.
- Ran `git diff -- apps/editor/src/workspace/viewer`.
- Ran focused source searches for Variant state, dirty/save/export calls, Runtime Player/Runtime Export/package/dependency terms, and relevant test names.
- Ran focused tests:
  - `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-variant-selection.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/viewer/viewer-render-source.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - Result: pass, 4 files / 61 tests.
- Ran forbidden-scope status check:
  - `git status --short -uall -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/runtime-player packages/package-format packages/authoring-core/src/runtime-export-materialization.ts packages/operation-core packages/runtime-core packages/render-core packages/render-webgl2`
  - Result: no output.

Not run by this review:

- Full repository test suite.
- `pnpm.cmd typecheck`.
- Browser E2E or visual screenshot verification.
- `pnpm install`.

## Residual Risks

- Runtime Controls Variant UI coverage is SSR/fake-DOM focused; no browser visual or accessibility pass was rerun in this review.
- Full repository tests and typecheck were not rerun by this review, though the Domain A report records them as passing.
- Very large Variant Group collections are handled as compact wrapping buttons, not virtualized or popover-based; this is within the accepted v0 scope.

## User-Decision Points

None.
