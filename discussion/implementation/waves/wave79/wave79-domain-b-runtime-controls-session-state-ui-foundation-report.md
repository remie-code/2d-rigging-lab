# Wave79 Domain B Report: Runtime Controls Session State + UI Foundation

## Verdict Recommendation

`pass`

## Files Changed

- `apps/editor/src/workspace/viewer/runtime-controls-state.ts`
  - Viewer-local runtime controls state contract, projections, clamp/default normalization, reset helpers, and authoring-value merge helper.
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
  - Props-based Viewer Runtime Controls UI primitive.
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - Focused state/projection coverage and static UI coverage discoverable by the root Vitest include pattern.
- `discussion/implementation/waves/wave79/wave79-domain-b-runtime-controls-session-state-ui-foundation-report.md`
  - This completion report.
- `discussion/implementation/waves/wave79/_map.md`
  - Minimal Wave79 map entry for this Domain B report.

Fix loop 1 removed the superseded uncollected `apps/editor/src/workspace/viewer/runtime-controls.test.tsx` after moving its UI assertions into `runtime-controls-state.test.ts`.

No edits were made to `parameter-bar.tsx`, `parameter-keyform-state.ts`, package manifests, package source, operation code, authoring workspace, app bar, editor UI store, canvas, or Clean Stage files.

## Basis Coverage Self-Report

- Read and applied `discussion/implementation/orchestration/wave79-plan.md`.
- Read and applied `discussion/design/screen-design/screens/viewer-runtime-view.md`.
- Read and applied screen design maps:
  - `discussion/design/screen-design/_map.md`
  - `discussion/design/screen-design/screens/_map.md`
- Read and applied development policies:
  - source file organization
  - UX-backed package logic authority
  - dependency policy
  - operation policy
  - schema and ID conventions
- Also checked `discussion/_conventions.md` and `discussion/_map.md` for discussion artifact placement.

Deferred basis items: none for Domain B. Domain C still owns screen routing and Clean Stage integration.

## User-Facing UX Trace

- Runtime Controls render as a Viewer-specific side surface, not the Authoring Parameter Bar.
- Top control is parameter name search.
- Rows expose editable parameters with slider, numeric value input, changed indication, and row reset.
- Top actions expose `Reset changed` and `Reset all`.
- `computedDynamics` parameters are excluded from editable rows.
- Bottom placeholder is present as non-interactive Future Playback Slot: `Motion / Physics: Not configured`.
- No group/category filter, favorite/pinned UI, keyform add/update/delete, Parameter Manager editing, transport, export, or playback buttons were added.

## Runtime Controls State Contract Trace

- Local state shape:

```ts
{
  parameterOverrides: Partial<Record<ParameterId, number>>,
  search: string
}
```

- `setRuntimeParameterOverride` clamps values to parameter min/max.
- Default-equivalent values are removed from `parameterOverrides`.
- `normalizeRuntimeParameterOverrides` drops default-valued entries and excludes `computedDynamics`.
- `createRuntimeControlsProjection` returns filtered editable rows, changed count, hidden computed count, and normalized override map.
- `resetRuntimeParameterOverride`, `resetChangedRuntimeParameterOverrides`, and `resetAllRuntimeParameterOverrides` only return new Viewer-local state.
- `createRuntimeParameterValueMap` projects normalized Viewer overrides into a parameter value map without reading or mutating authoring parameter values.

## Must-Not Compliance Evidence

- Runtime Controls component consumes only `parameters`, `state`, and `onStateChange` props.
- No `useEditorSession` import or usage in Viewer Runtime Controls.
- No operation-core mutation calls, history commits, save/load calls, keyform payloads, or parameter definition commands.
- No `ParameterBar` import or component reuse.
- No dependency additions.
- No forbidden-scope files modified.

## Verification Performed

Passed:

- `pnpm exec vitest run apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - Sandbox run failed with `spawn EPERM` while starting esbuild.
  - Escalated rerun passed with root `vitest.config.ts`: 1 test file, 10 tests.
  - The single discovered `.test.ts` now covers both state and static UI assertions.
- `pnpm typecheck`
  - Passed for root repository script.
- `pnpm exec tsc --noEmit -p <temporary wave79-domain-b-fix1-editor-tsconfig.json>`
  - Passed for the Domain B source files and discovered test file only.
- `pnpm --dir apps/editor typecheck`
  - Earlier full editor app typecheck was attempted before fix loop 1 and failed on pre-existing unrelated app errors outside Domain B scope:
    - `src/features/editor-session/editor-session-context-history.test.ts`
    - `src/features/editor-session/model/mesh-tool-state.test.ts`
    - `src/features/project-storage/model/editor-project-storage.test.ts`
    - `src/workspace/canvas/canvas-render-scene-adapter.ts`
    - `src/workspace/panels/mesh-tool-inspector.test.ts`
    - `src/workspace/project-storage/project-storage-screen.test.ts`
- `git diff --check -- apps/editor/src/workspace/viewer/runtime-controls-state.ts apps/editor/src/workspace/viewer/runtime-controls.tsx apps/editor/src/workspace/viewer/runtime-controls-state.test.ts apps/editor/src/workspace/viewer/runtime-controls.test.tsx discussion/implementation/waves/wave79/wave79-domain-b-runtime-controls-session-state-ui-foundation-report.md discussion/implementation/waves/wave79/_map.md`
  - Passed.
- `rg "useEditorSession|ParameterBar|editKeyformKey|createEditKeyformPayload|operation-core|saveProject|openProjectFile|setActiveParameterValue|parameterValues" apps/editor/src/workspace/viewer/runtime-controls-state.ts apps/editor/src/workspace/viewer/runtime-controls.tsx apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - No matches.

## Child Agents Started And Closed

Domain B's original report did not preserve historical child agent IDs or nicknames. Closure status is recorded here for final integration review traceability.

| Agent ID / Nickname | Role | Result | Closed |
|---|---|---|---|
| not preserved in report | Gnome implementation agent | done | yes |
| not preserved in report | Review-Sylph Spec Compliance | pass after fix loop 1 re-review | yes |
| not preserved in report | Review-Sylph Design / Development Compliance | pass after fix loop 1 re-review | yes |
| not preserved in report | Review-Sylph Test Adequacy | pass after fix loop 1 re-review | yes |

## Review Findings And Fix Loops

Fix loop 1:

- Finding: `runtime-controls.test.tsx` was not discoverable by current root Vitest include patterns.
- Fix: moved static Runtime Controls UI assertions into discovered `runtime-controls-state.test.ts` and removed the superseded `.test.tsx` file.
- Verification: focused Vitest passed with 1 discovered file / 10 tests; `pnpm typecheck` passed; scoped `git diff --check` passed.
- Result: findings shrank to zero; no fix loop 2 was needed.

## Residual Risks

- Domain B only provides Runtime Controls primitives. Domain C must wire Viewer-local state into the dedicated Viewer screen and Clean Stage.
- `reset changed` currently resets all known editable changed overrides in the Viewer controls state; there is no separate selected-row batch concept in v0.
- Styling is Tailwind-class based and will inherit final Viewer layout constraints from Domain C.

## User-Decision Points

None for Domain B.
