# Wave100 Domain A Report: Viewer Variant Switching Integration

## Verdict

Verdict: `pass`.

Viewer / Runtime View now owns a session-local Variant active selection, initializes it from Project default active selection, reconciles it when Variant Groups change, and applies the resulting Variant predicate before render source remap. Runtime Controls now shows a collapsible Variants section between Render Source and parameter search when Variant Groups exist.

No forbidden scope was touched.

## Implementation Summary

- Added Viewer-local Variant selection helper functions in `apps/editor/src/workspace/viewer/viewer-variant-selection.ts`.
- Wired `ViewerRuntimeScreen` to:
  - initialize Variant selection from Project defaults;
  - reconcile local selection against `session.graph.variantGroups`;
  - reset local selection to Project defaults;
  - create `createVariantVisibilityPredicate` from Viewer-local selection;
  - pass the predicate into Clean Stage projection before `Original` / `Atlas Runtime` render source handling.
- Extended `viewer-clean-stage.ts` projection options with `variantVisibilityPredicate`.
- Added a collapsible Runtime Controls Variants section:
  - hidden when no Variant Groups exist;
  - initially collapsed;
  - summary visible while collapsed;
  - expanded controls support `singleSelect` and `multiToggle`;
  - reset button restores Project defaults.
- Added focused tests for default selection, single/multi switching, reset, non-dirty behavior, Atlas Runtime remap, Runtime Controls order, collapsed summary, expanded controls, and reconciliation.

## Files Changed

- `apps/editor/src/workspace/viewer/viewer-variant-selection.ts`
- `apps/editor/src/workspace/viewer/viewer-variant-selection.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- `discussion/implementation/waves/wave100/wave100-domain-a-viewer-variant-switching-integration-report.md`

## Behavior Coverage

| Required behavior | Coverage |
|---|---|
| Viewer initial state uses Project default active selection | `viewer-runtime-screen.test.ts` projection and collapsed summary tests. |
| Reconcile Viewer-local selection when `session.graph.variantGroups` changes | `viewer-variant-selection.test.ts` covers removed Variant reconciliation; screen effect uses the same helper. |
| Reset variants restores Project default active selection | `viewer-runtime-screen.test.ts` interactive reset; Runtime Controls reset callback test. |
| Viewer-local selection switches `singleSelect` Groups | `viewer-runtime-screen.test.ts` interactive `Select Sad in Expression`; Runtime Controls callback test. |
| Viewer-local selection toggles `multiToggle` Groups | `viewer-runtime-screen.test.ts` interactive `Toggle Glasses in Accessory`; Runtime Controls callback test. |
| Predicate applies before render source remap | `viewer-render-source.test.ts` confirms `Atlas Runtime` receives the same hidden assigned Drawable after remap. |
| Variants section hidden without Variant Groups | `viewer-runtime-screen.test.ts` and `runtime-controls-state.test.ts`. |
| Variants section order: Render Source, Variants, parameter search | `viewer-runtime-screen.test.ts` and `runtime-controls-state.test.ts`. |
| Initial section collapsed with active summary visible | `viewer-runtime-screen.test.ts`; `runtime-controls-state.test.ts`. |
| Parameter override count remains parameter-only | Runtime Controls state remains parameter-only; Variant state is separate props/internal collapse state; existing parameter override tests still pass. |
| Viewer selection is non-persistent and non-dirty | `viewer-runtime-screen.test.ts` asserts unchanged `session.graph.variantGroups`, `dirty === false`, and no save call. |

## Verification

Commands run without `pnpm install`:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer` | Pass: 5 files / 64 tests. |
| `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts` | Pass: 1 file / 3 tests. |
| `pnpm.cmd exec vitest run packages/authoring-core/src/variant-evaluation.test.ts` | Pass: 1 file / 6 tests. |
| `pnpm.cmd typecheck` | Pass. |
| `node scripts/check-source-organization.mjs` | Pass. |
| `node scripts/check-dependencies.mjs` | Pass. |
| `git diff --check` | Pass; CRLF working-copy warnings only. |

Failure classification during implementation:

- Initial sandboxed Vitest run failed with `spawn EPERM` while loading config through esbuild. Classified as environment/sandbox-related; rerun with approved escalation.
- First escalated Viewer focused run failed 2 new assertions because the fixture textures lacked render bytes, making `renderable` count unsuitable for Variant visibility. Classified as related test assertion issue; fixed by exposing and asserting Viewer visible Drawable count.

## Basis Coverage Self-Report

Read and applied:

- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/screens/variant-expression-manager.md`
- `discussion/design/screen-design/_map.md`
- `discussion/implementation/orchestration/wave100-plan.md`
- `discussion/implementation/orchestration/wave99-plan.md`
- `discussion/implementation/waves/wave99/wave99-final-integration-report.md`
- `discussion/implementation/reviews/wave99/wave99-final-clean-integration-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`

Applied constraints:

- Viewer selection is session-only, non-dirty, and non-persistent.
- Project default active selection is not mutated from Viewer.
- `VariantManagerScreen` is not imported into Viewer.
- Runtime Player UI, hotkeys, Browser Source protocol, package format, Runtime Export, Workspace Save, Texture Atlas stale policy, dependencies, manifests, and lockfile were not changed.
- Existing `Original` / `Atlas Runtime` behavior is preserved outside Variant predicate insertion.

## Deferred Basis Items

- Browser E2E / visual screenshot verification was not run.
- Full repository test suite was not run.
- Runtime Player Variant UI / hotkeys / Browser Source protocol remain explicitly out of scope.
- Wave100 final integration maps and review artifacts are left for Domain B.

## Residual Risks / User-Decision Points

- Residual risk: Runtime Controls Variants UI is covered by SSR/fake DOM tests, not browser visual checks.
- Residual risk: Very large Variant collections use compact wrapping buttons only; no popover or virtualization was added in v0.
- User-decision points: none.
