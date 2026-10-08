# Wave79 Domain B Test Adequacy Review

## Verdict

`pass`

Fix loop 1 resolves the prior blocking test-discoverability finding. The Runtime Controls static UI assertions were moved into `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`, which matches the current root `vitest.config.ts` include pattern. The superseded uncollected `runtime-controls.test.tsx` is absent, and the focused Domain B test command now runs 1 discovered file / 10 tests, including both state and static UI assertions.

## Scope Reviewed

- `apps/editor/src/workspace/viewer/runtime-controls-state.ts`
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- `discussion/implementation/waves/wave79/wave79-domain-b-runtime-controls-session-state-ui-foundation-report.md`
- Relevant test configuration:
  - `vitest.config.ts`
  - `package.json`
  - `apps/editor/package.json`

Domain A canvas/clean-stage files were not reviewed except for repository status awareness.

## Basis Documents Used

- `discussion/implementation/orchestration/wave79-plan.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Findings

No blocking or non-blocking findings remain for Domain B test adequacy.

### Resolved: UI test discovery gap

The previous review found that `runtime-controls.test.tsx` was outside `vitest.config.ts:5` and was not executed by the focused command. That is resolved:

- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:203` now contains the `RuntimeControls UI` suite.
- UI assertions cover search/no authoring UI at `runtime-controls-state.test.ts:219-226`, search placement at `:241`, reset controls at `:262-263`, and Future Playback Slot/no playback controls at `:276-281`.
- `Test-Path apps/editor/src/workspace/viewer/runtime-controls.test.tsx` returned `False`.
- Focused Vitest re-run passed: 1 file, 10 tests.

## Test Coverage Trace

| Required coverage | Evidence | Adequacy |
|---|---|---|
| Search filters by display name and/or id | State test at `runtime-controls-state.test.ts:27`; implementation at `runtime-controls-state.ts:239`; UI search placement at `runtime-controls-state.test.ts:241` | Covered |
| No group/category filter exists | Production grep for `group|category` in Domain B runtime-control source had no matches; UI negative assertion at `runtime-controls-state.test.ts:226` | Covered |
| `computedDynamics` excluded | Implementation at `runtime-controls-state.ts:58`; state tests at `runtime-controls-state.test.ts:27` and `:135`; UI negative assertion via hidden `Hair Sway Output` at `:222` | Covered |
| Slider and numeric input clamp values | State helper clamps at `runtime-controls-state.ts:139`; state test at `runtime-controls-state.test.ts:53`; UI renders range/number inputs at `runtime-controls.tsx:196` and `:207` | Covered for state contract and rendered controls |
| Default-valued rows remove override entries | Implementation at `runtime-controls-state.ts:139-143`; state tests at `runtime-controls-state.test.ts:53` and `:75` | Covered |
| Changed indication appears only for non-default overrides | Projection state at `runtime-controls-state.ts:107` and `:231`; state test at `runtime-controls-state.test.ts:89`; UI assertion at `runtime-controls-state.test.ts:248` | Covered |
| Row reset, reset changed, reset all work | State helpers at `runtime-controls-state.ts:152`, `:167`, and `:187`; state test at `runtime-controls-state.test.ts:89`; UI controls at `runtime-controls.tsx:95-104` and `:214`; UI assertions at `runtime-controls-state.test.ts:262-264` | Covered |
| Controls do not call keyform operations, project mutations, or history commit helpers | Production grep for `useEditorSession`, `ParameterBar`, `editKeyformKey`, operation-core imports, save/open project calls, `setActiveParameterValue`, and `parameterValues` had no matches; component accepts props and calls `onStateChange` at `runtime-controls.tsx:20` and `:42` | Adequate static evidence |
| Authoring `parameterValues` are not changed by Viewer controls, as practical | Runtime value projection is override-only at `runtime-controls-state.ts:194-200`; state test at `runtime-controls-state.test.ts:156`; no production `parameterValues` matches | Adequate for Domain B primitives |
| Focused tests and verification commands are adequate | `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/runtime-controls-state.test.ts --reporter=verbose` passed 1 file / 10 tests | Covered |

## Commands Run / Evidence Checked

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/runtime-controls-state.test.ts --reporter=verbose`
  - Sandbox attempt failed with `spawn EPERM` while loading Vitest config.
  - Escalated rerun passed: 1 file, 10 tests.
- `Test-Path apps/editor/src/workspace/viewer/runtime-controls.test.tsx`
  - Returned `False`.
- `rg -n "filters editable parameters|clamps override|normalizes default|projects changed|ignores direct override|creates runtime parameter values|renders a Viewer runtime|renders parameter name search|marks changed rows|renders the future playback" apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - Confirmed 10 state/UI test cases in the discovered `.test.ts` file.
- `rg -n "useEditorSession|ParameterBar|editKeyformKey|createEditKeyformPayload|@private-2d-rigging-lab/operation-core|commitHistory|commitOperation|saveProject|openProjectFile|setActiveParameterValue|parameterValues" apps/editor/src/workspace/viewer/runtime-controls-state.ts apps/editor/src/workspace/viewer/runtime-controls.tsx`
  - No matches.
- `rg -n "include|test:unit|scripts|test:e2e|build|typecheck" vitest.config.ts package.json apps/editor/package.json`
  - Confirmed `.test.ts` app files match the current Vitest include pattern.

Orch-Sylph also observed, and the Domain B report records, `pnpm.cmd typecheck` passing and scoped `git diff --check` passing. I did not rerun those broader checks in this re-review.

## Residual Risks And Recommended Follow-Up

- Runtime Controls component event wiring is still covered primarily through pure state tests plus static render assertions, not full DOM interaction simulation. This is acceptable for Domain B foundation, but a future interaction harness would improve confidence around slider/input/reset event wiring.
- Domain C must still prove that Viewer-local overrides feed Clean Stage without mutating authoring `parameterValues`.
- Root `package.json` still limits `test:unit` to `packages`; this re-review only verifies the focused Domain B command and current Vitest include behavior for the app test file.
