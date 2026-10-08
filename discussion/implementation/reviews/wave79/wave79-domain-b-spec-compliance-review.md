# Wave79 Domain B Spec Compliance Review

verdict: `pass`

## Scope Reviewed

- Domain: B `wave79-runtime-controls-session-state-ui-foundation`
- Review lane: Spec Compliance Review
- Source reviewed:
  - `apps/editor/src/workspace/viewer/runtime-controls-state.ts`
  - `apps/editor/src/workspace/viewer/runtime-controls.tsx`
  - `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - `discussion/implementation/waves/wave79/wave79-domain-b-runtime-controls-session-state-ui-foundation-report.md`
- Domain C screen routing / Clean Stage integration was treated as future integration scope, per Wave79 plan.

## Basis Documents Used

- `discussion/implementation/orchestration/wave79-plan.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/_map.md`
- `discussion/design/screen-design/screens/_map.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Findings

No blocking or needs-change spec compliance findings.

Informational:

- The previous informational residual risk about the uncollected `.test.tsx` file is resolved. Fix loop 1 moved the static UI assertions into discovered `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts` and removed `apps/editor/src/workspace/viewer/runtime-controls.test.tsx`.

## Spec Compliance Trace

| Requirement | Result | Evidence |
|---|---:|---|
| Runtime Controls for Viewer, not Authoring Parameter Bar | pass | `RuntimeControls` is a standalone Viewer component with props-only state flow and no `ParameterBar` import: `apps/editor/src/workspace/viewer/runtime-controls.tsx:18`, `apps/editor/src/workspace/viewer/runtime-controls.tsx:25`; discovered UI test asserts no Parameter Bar text: `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:223`. |
| Local Viewer session state shaped like `parameterOverrides + search` | pass | `ViewerRuntimeControlsState` contains only `parameterOverrides` and `search`: `apps/editor/src/workspace/viewer/runtime-controls-state.ts:14`. Initial state matches: `apps/editor/src/workspace/viewer/runtime-controls-state.ts:44`. |
| Parameter name search at top | pass | Search input appears before parameter list in component: `apps/editor/src/workspace/viewer/runtime-controls.tsx:71`, `apps/editor/src/workspace/viewer/runtime-controls.tsx:112`; discovered static UI test checks ordering: `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:229`. |
| Search filters by display name and/or id | pass | Search haystack combines display name and parameter id: `apps/editor/src/workspace/viewer/runtime-controls-state.ts:243`; state test covers both name and id matching: `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:24`. |
| Sliders and numeric inputs clamp to min/max | pass | Updates route through `setRuntimeParameterOverride`, which calls `clampParameterValue`: `apps/editor/src/workspace/viewer/runtime-controls-state.ts:122`, `apps/editor/src/workspace/viewer/runtime-controls-state.ts:139`; UI inputs expose `min` and `max`: `apps/editor/src/workspace/viewer/runtime-controls.tsx:189`, `apps/editor/src/workspace/viewer/runtime-controls.tsx:199`; state test verifies 99 clamps to 30: `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:50`. |
| Changed indication for non-default overrides | pass | Rows compute `changed` from current vs default value: `apps/editor/src/workspace/viewer/runtime-controls-state.ts:217`, `apps/editor/src/workspace/viewer/runtime-controls-state.ts:231`; UI renders changed styling and label: `apps/editor/src/workspace/viewer/runtime-controls.tsx:160`, `apps/editor/src/workspace/viewer/runtime-controls.tsx:178`; tests cover changed rows: `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:86`, `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:248`. |
| Row reset, reset changed, reset all | pass | Helpers exist for row, changed, and all resets: `apps/editor/src/workspace/viewer/runtime-controls-state.ts:152`, `apps/editor/src/workspace/viewer/runtime-controls-state.ts:167`, `apps/editor/src/workspace/viewer/runtime-controls-state.ts:187`; component wires all three controls: `apps/editor/src/workspace/viewer/runtime-controls.tsx:93`, `apps/editor/src/workspace/viewer/runtime-controls.tsx:101`, `apps/editor/src/workspace/viewer/runtime-controls.tsx:210`; tests cover reset behavior: `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:86`. |
| Default-valued entries removed from `parameterOverrides` | pass | Normalization omits values equivalent to default: `apps/editor/src/workspace/viewer/runtime-controls-state.ts:84`; setter deletes default-equivalent entries: `apps/editor/src/workspace/viewer/runtime-controls-state.ts:139`; tests cover default removal: `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:50`, `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:72`. |
| `computedDynamics` parameters excluded from editable controls | pass | Editability excludes `valueSource === "computedDynamics"`: `apps/editor/src/workspace/viewer/runtime-controls-state.ts:57`; normalization skips computed rows: `apps/editor/src/workspace/viewer/runtime-controls-state.ts:74`; tests cover exclusion and direct override cleanup: `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:24`, `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:132`. |
| Future Playback Slot placeholder at bottom, non-interactive | pass | Footer renders `Motion / Physics` and `Not configured` with `aria-disabled`: `apps/editor/src/workspace/viewer/runtime-controls.tsx:136`; discovered static UI test checks no play/pause controls: `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:270`. |
| No group/category filter, favorite/pinned UI, keyform add/update/delete, Parameter Manager editing, dynamics playback, screenshot/export, Compare/Diff | pass | `rg` over Domain B source found no forbidden implementation calls or UI terms beyond negative test assertions; discovered static UI test asserts no Parameter Bar, Keyform, Favorite, or Group text: `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:223`. |
| Must not mutate `EditorSessionProvider.parameterValues`, project history, operations, save/load, or keyforms | pass | Component accepts `parameters`, `state`, and `onStateChange` only: `apps/editor/src/workspace/viewer/runtime-controls.tsx:18`; state helpers return new Viewer-local state and do not import session provider or operations: `apps/editor/src/workspace/viewer/runtime-controls-state.ts:1`; `createRuntimeParameterValueMap` creates a derived override map without mutating input state: `apps/editor/src/workspace/viewer/runtime-controls-state.ts:194`; test asserts source state remains unchanged: `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:153`. |

## Checks Performed

- `rg` forbidden-scope scan over the final Domain B source/test/report files for `EditorSessionProvider`, `parameterValues`, `editKeyformKey`, history, save/load, keyform, Parameter Bar, group/category, favorite/pinned, screenshot/export, Compare/Diff, playback, and operation terms. Matches were report prose or negative UI assertions only.
- `rg` usage scan for `RuntimeControls`, `createRuntimeParameterValueMap`, and helper imports under `apps/editor/src`.
- Confirmed `apps/editor/src/workspace/viewer/runtime-controls.test.tsx` no longer exists.
- Verification observed by Orch-Sylph after Fix loop 1:
  - `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`: pass, 1 file / 10 tests.
  - `pnpm.cmd typecheck`: pass.
  - `git diff --check -- <Domain B files/report/map>`: pass.

## Unresolved User-Decision Points

None for Domain B spec compliance.

## Residual Risks

- Domain B provides state and UI primitives only. Domain C still must wire Viewer-local state into the dedicated Viewer screen and Clean Stage; this is outside the Domain B pass/fail boundary.
- Numeric display formatting reuses `formatParameterValue`, which rounds non-integer values to two decimals. This is acceptable for the current spec but may need UX refinement for parameters with finer `recommendedUiStep`.
