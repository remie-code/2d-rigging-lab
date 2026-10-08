# Wave79 Domain B Design / Development Compliance Review

- verdict: `pass`
- target wave: Wave79 `viewer-runtime-view-v0`
- domain: B `wave79-runtime-controls-session-state-ui-foundation`
- review lane: Design / Development Compliance Review
- date: 2026-06-17
- re-review: Fix loop 1 narrow re-review, production implementation unchanged

## Scope Reviewed

Reviewed current Domain B implementation and report/map artifacts:

- `apps/editor/src/workspace/viewer/runtime-controls-state.ts`
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- `discussion/implementation/waves/wave79/wave79-domain-b-runtime-controls-session-state-ui-foundation-report.md`
- `discussion/implementation/waves/wave79/_map.md`

Fix loop 1 moved static UI assertions from the uncollected `runtime-controls.test.tsx` into the discovered `runtime-controls-state.test.ts`; `runtime-controls.test.tsx` is no longer present.

Ignored unrelated and parallel Domain A work except where dependency or shared coupling evidence could affect Domain B.

## Basis Documents Used

- `discussion/implementation/orchestration/wave79-plan.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

## Read-only Checks

- `Test-Path apps/editor/src/workspace/viewer/runtime-controls.test.tsx` returned `False`.
- `git status --short -uall -- <current Domain B files + package manifests/lockfile + review artifact>` showed current Domain B source/test/report/map/review files as untracked; `package.json`, `apps/editor/package.json`, and `pnpm-lock.yaml` were not changed in this scoped check.
- `rg` over the current Domain B source/test files for forbidden authoring or persistence terms found no production usage of `useEditorSession`, `ParameterBar`, keyform operations, operation-core, history/save/load helpers, `parameterValues`, category UI, or favorite/pinned UI.
- `rg "lucide-react" package.json apps/editor/package.json pnpm-lock.yaml` confirmed `lucide-react` was already present in `apps/editor/package.json:25` and the lockfile; Domain B did not add a dependency.
- File size/readability check after Fix loop 1: `runtime-controls-state.ts` is 220 lines, `runtime-controls.tsx` is 241 lines, and `runtime-controls-state.test.ts` is 268 nonblank/content lines by `Measure-Object -Line`.
- Verification observed by Orch-Sylph: `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/runtime-controls-state.test.ts` passed with 1 file / 10 tests, `pnpm.cmd typecheck` passed, and `git diff --check -- <Domain B files/report/map>` passed.

## Findings

No blocking or warning findings.

## Design / Development Compliance Trace

### Write Scope And Dependencies

- Domain B files are isolated under `apps/editor/src/workspace/viewer/` plus the Domain B report/map artifacts. No package manifest or lockfile change was detected in the scoped status check.
- The UI imports `lucide-react` icons in `runtime-controls.tsx:1`, and that dependency is pre-existing in `apps/editor/package.json:25`.
- Source organization is compliant: state/projection logic is in `runtime-controls-state.ts`, UI primitive logic is in `runtime-controls.tsx`, and the current discovered test file keeps state and static UI assertions separated by `describe` blocks. No `index.ts` implementation logic or broad catch-all source file was introduced.
- The post-fix test artifact layout remains acceptable. Co-locating the small static UI assertions in `runtime-controls-state.test.ts` is a pragmatic discoverability fix for the current root Vitest include pattern, not a production responsibility merge. It should be split again or the test include pattern should be updated if UI coverage grows beyond this narrow static surface.

### Viewer-local State Contract

- The state shape is the planned session-local primitive: `RuntimeParameterOverrides` and `ViewerRuntimeControlsState` define `parameterOverrides` plus `search` in `runtime-controls-state.ts:12` and `runtime-controls-state.ts:14`.
- Initial state is local and empty in `runtime-controls-state.ts:44`.
- Projection normalizes state, filters editable parameters, applies search, and reports changed/hidden counts in `runtime-controls-state.ts:93`.
- `createRuntimeParameterValueMap` exports the Domain C integration primitive for feeding normalized overrides into rendering without exposing authoring session mutation in `runtime-controls-state.ts:194`.

### Session-only And No Authoring Mutation

- `setRuntimeParameterOverride` returns a new Viewer controls state and removes default-valued overrides in `runtime-controls-state.ts:122` and `runtime-controls-state.ts:139`.
- Row reset, reset changed, and reset all are pure state helpers in `runtime-controls-state.ts:152`, `runtime-controls-state.ts:167`, and `runtime-controls-state.ts:187`.
- `RuntimeControlsProps` accepts only `parameters`, `state`, and `onStateChange` in `runtime-controls.tsx:18`; the component commits normalized local state through `onStateChange` in `runtime-controls.tsx:42`.
- No `useEditorSession`, operation-core mutation, history commit, save/load, Parameter Manager, or authoring `parameterValues` mutation path is present in the reviewed Domain B files.

### Parameter Bar And Keyform Boundary

- Runtime Controls are a props-based Viewer primitive, not a full Authoring `ParameterBar` reuse. The UI imports only the Domain B state helpers from `./runtime-controls-state` in `runtime-controls.tsx:7`.
- The state file reuses existing parameter math/type helpers (`clampParameterValue`, `formatParameterValue`, `EditorParameter`, `ParameterValueMap`) from `parameter-keyform-state` in `runtime-controls-state.ts:4`; these are value-formatting/projection primitives, not keyform operation calls.
- Negative UI tests now assert no `Parameter Bar`, `Keyform`, `Favorite`, or `Group` text in the discovered test file at `runtime-controls-state.test.ts:223`.

### Runtime Controls Semantics

- `computedDynamics` parameters are excluded by `isEditableRuntimeParameter` in `runtime-controls-state.ts:57`, dropped during normalization in `runtime-controls-state.ts:75`, and removed on direct override attempts in `runtime-controls-state.ts:131`.
- Search is top-of-surface UI with screen-reader label and visible placeholder in `runtime-controls.tsx:73`, `runtime-controls.tsx:81`, and `runtime-controls.tsx:86`.
- Reset changed and reset all controls are present in `runtime-controls.tsx:95` and `runtime-controls.tsx:103`.
- Rows include changed indication and range/number inputs in `runtime-controls.tsx:167`, `runtime-controls.tsx:181`, `runtime-controls.tsx:196`, and `runtime-controls.tsx:207`.
- Future Playback Slot is a non-interactive placeholder in `runtime-controls.tsx:139`, with the accepted `Motion / Physics` and `Not configured` text in `runtime-controls.tsx:142`.
- UI copy stays within labels, controls, counts, and empty states; it does not add tutorial, diagnostics, export, compare/diff, playback transport, or authoring-operation explanatory text.

### Test And Report Alignment

- State tests cover search/computed exclusion, clamp/default cleanup, reset behavior, direct computed override exclusion, and non-mutation projection in `runtime-controls-state.test.ts:27`, `runtime-controls-state.test.ts:53`, `runtime-controls-state.test.ts:75`, `runtime-controls-state.test.ts:89`, `runtime-controls-state.test.ts:135`, and `runtime-controls-state.test.ts:156`.
- Static UI tests cover provider-free rendering, top search, absence of authoring UI labels, changed/reset UI, and non-interactive future playback placeholder in the discovered `runtime-controls-state.test.ts` at `runtime-controls-state.test.ts:203`, `runtime-controls-state.test.ts:223`, `runtime-controls-state.test.ts:229`, `runtime-controls-state.test.ts:248`, and `runtime-controls-state.test.ts:270`.
- The Domain B report accurately describes the implemented state contract, UI primitive, forbidden-scope evidence, Fix loop 1 test relocation, and Domain C residual integration responsibility.

## Unresolved User-decision Points

None for Domain B.

## Residual Risks

- Domain C must wire this local state into the dedicated Viewer screen and Clean Stage without persisting overrides or mutating authoring session state.
- The helper reuse from `parameter-keyform-state.ts` is acceptable for Domain B because only value math/types are imported, but that source module also owns authoring keyform helpers. If Viewer runtime controls grow beyond these primitives, a neutral parameter-value helper module should be extracted to avoid future authoring coupling.
- The number input is controlled through formatted projection and normalizes on change in `runtime-controls.tsx:204`; if later interaction testing shows awkward decimal/intermediate typing, that is a UX refinement risk rather than a current design/development compliance blocker.
- The single discovered test file now covers both state/projection and static UI assertions. This remains acceptable at current size and scope, but future broader UI behavior tests should move to a discoverable UI test file or the repository test include pattern should be adjusted.
