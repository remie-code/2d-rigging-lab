# Wave79 Domain C Test Adequacy Review

## Findings

- Blocking: none.
- Needs changes: none.
- Non-blocking residual risk: no browser/E2E smoke directly exercises a real slider input through React state into a repainted canvas. For this Domain C scope, the combination of source inspection, Runtime Controls state tests, Clean Stage projection tests, and the integrated projection helper test is adequate because the screen wiring is local `activeEntry` branching plus Viewer-local state projection.

## Verdict

pass

## Scope Reviewed

Domain C source and tests:

- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/workspace/app-bar.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`

Accepted Domain A/B files inspected as supporting evidence:

- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
- `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts`
- `apps/editor/src/workspace/viewer/runtime-controls-state.ts`
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- `vitest.config.ts`

Additional routing/store files inspected:

- `apps/editor/src/workspace/workspace-data.ts`
- `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx`
- `apps/editor/src/workspace/task-view-entry-bar.tsx`
- `apps/editor/src/state/editor-ui-store.ts`

## Basis Used

- `discussion/implementation/orchestration/wave79-plan.md`
- `discussion/implementation/waves/wave79/wave79-domain-a-clean-stage-render-foundation-report.md`
- `discussion/implementation/waves/wave79/wave79-domain-b-runtime-controls-session-state-ui-foundation-report.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`

## Verification Considered / Performed

Considered Orch-Sylph post-implementation verification:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts` passed: 3 files / 18 tests. Initial sandbox run hit esbuild `spawn EPERM`; escalated rerun passed.
- `pnpm.cmd typecheck` passed.
- `node scripts/check-source-organization.mjs` passed.
- `node scripts/check-dependencies.mjs` passed.
- Touched-file `git diff --check` with temporary intent-to-add for new Domain C files passed, CRLF warnings only.

Performed in this review:

- Read basis documents and inspected source/test files directly.
- Inspected the Domain C diff for `authoring-workspace.tsx` and `app-bar.tsx`.
- Checked root Vitest discovery: `vitest.config.ts:5` includes `apps/*/src/**/*.test.ts`, so `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts` is discoverable as a `.test.ts` file.

## Coverage Matrix

| Required Domain C coverage | Evidence | Assessment |
|---|---|---|
| Viewer entry opens dedicated screen | `AuthoringWorkspaceContent` branches on `activeEntry === "viewer"` and renders `ViewerRuntimeScreen` at `apps/editor/src/workspace/authoring-workspace.tsx:34`, `apps/editor/src/workspace/authoring-workspace.tsx:40`, `apps/editor/src/workspace/authoring-workspace.tsx:43`. The test renders `activeEntry: "viewer"` and asserts the Viewer screen at `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:158`. | Covered. |
| App Bar Viewer icon opens same screen / same activation path | App Bar task entries use `activateEntry` at `apps/editor/src/workspace/app-bar.tsx:32` and `apps/editor/src/workspace/app-bar.tsx:72`; the right-side Viewer icon uses the same helper at `apps/editor/src/workspace/app-bar.tsx:137`. The test asserts `setActiveEntry("viewer")` at `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:197` and `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:205`. | Covered. |
| Back action returns to Authoring Workspace | Back button calls `returnToAuthoringWorkspace` at `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:96`; helper sets `activeEntry` to `"import"` at `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:159`. Tests assert the Back click and helper behavior at `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:183`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:190`, and `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:245`. | Covered. |
| Authoring `ParameterBar` suppressed while Viewer active | `ParameterBar` is rendered only when `showViewer` is false at `apps/editor/src/workspace/authoring-workspace.tsx:83`. The screen test asserts the Viewer markup does not contain `Parameter Bar` at `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:169`. | Covered. |
| Runtime Controls override affects Clean Stage output or projection props | Viewer screen merges authoring values and runtime override values before creating the Clean Stage projection at `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:140`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:144`, and `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:152`. The test asserts drawable bounds change from `-12` to `12` and authoring values remain unchanged at `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:218`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:239`, and `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:242`. | Covered. |
| No authoring keyform operation UI appears in Viewer | Viewer markup test asserts absence of keyform action text at `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:171`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:172`, and `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:173`. Runtime Controls UI test also asserts no `Keyform` text at `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:224`. | Covered for practical component-level oracle. |
| No authoring overlay toggles / forbidden UI surface appears where practical | Viewer screen test asserts no Canvas Preview panel and no mesh/deformer overlay labels at `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:170`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:174`, and `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:175`. Domain A overlay state suppresses origin, selection, mesh, deformer, and isolate-selected at `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:30` through `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:35`, with test coverage at `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:80`. | Covered. |
| Authoring selection/tool/active parameter/parameterValues preservation and non-mutation | Back test asserts no calls to active-parameter mutation or selection callbacks at `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:192` through `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:194`. Projection test freezes authoring parameter values and verifies they remain unchanged at `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:221` and `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:242`. Store source shows `setActiveEntry` mutates only `activeEntry`, not `activeTool`, at `apps/editor/src/state/editor-ui-store.ts:33` and `apps/editor/src/state/editor-ui-store.ts:34`. | Covered as practical. |
| Future Playback Slot present and non-interactive | Viewer screen test asserts `Motion / Physics` and `Not configured` at `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:167` and `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:168`. Runtime Controls test asserts `aria-disabled="true"` and no Play/Pause at `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:276` through `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:281`. | Covered. |
| Forbidden extra Viewer v0 scope absent | Viewer screen test asserts no Screenshot, Export, Compare, Favorite, or Group text at `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:176` through `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:180`. Runtime Controls test asserts no Favorite or Group at `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:225` and `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:226`. | Covered for UI-surface leakage. |

## Domain A/B Focused Test Preservation

- Domain A Clean Stage tests remain present and cover no-selection projection, session-only parameter override, mask relation preservation, and clean overlay state at `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:43`, `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:65`, and `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts:80`.
- Domain B Runtime Controls tests remain present and cover search, computedDynamics exclusion, clamp/default normalization, reset behavior, authoring-value non-mutation, static UI forbidden text, and Future Playback Slot at `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:27`, `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:53`, `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:89`, `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:156`, `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:204`, and `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:270`.
- Orch-Sylph reran Domain A/B/C focused tests together and reported pass: 3 files / 18 tests.

## Residual Risks / Acceptable Gaps

- No Playwright/pixel smoke validates the final rendered canvas visually. This is acceptable for Domain C because Domain A covers the clean projection/overlay contract and Domain C uses a component-level projection oracle.
- No test simulates actual range/number input events in a browser. Domain B covers the state transitions and UI surface, while Domain C source wires `RuntimeControls.onStateChange` to `setRuntimeControlsState` at `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:120` and `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:121`; this is a residual integration risk, not a blocking gap.
- Back preservation is proven by no mutation calls and by source showing `setActiveEntry` does not touch `activeTool`; there is no full-store round-trip assertion for an arbitrary preexisting tool/selection. This is acceptable given the small source path and existing store shape.

## User-Decision Points

None.
