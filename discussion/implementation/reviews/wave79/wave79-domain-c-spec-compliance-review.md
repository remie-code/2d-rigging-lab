# Wave79 Domain C Spec Compliance Review

## Verdict

pass

## Findings

No blocking or needs-change spec compliance findings were found.

## Scope Reviewed

- Domain C changed files:
  - `apps/editor/src/workspace/authoring-workspace.tsx`
  - `apps/editor/src/workspace/app-bar.tsx`
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- Accepted dependency files inspected as needed:
  - `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
  - `apps/editor/src/workspace/viewer/runtime-controls.tsx`
  - `apps/editor/src/workspace/viewer/runtime-controls-state.ts`
- Supporting route/state context:
  - `apps/editor/src/state/editor-ui-store.ts`
  - `apps/editor/src/workspace/workspace-data.ts`
  - `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx`
  - `apps/editor/src/app/editor-app.tsx`

## Basis Used

- `discussion/implementation/orchestration/wave79-plan.md`
- `discussion/implementation/waves/wave79/wave79-domain-a-clean-stage-render-foundation-report.md`
- `discussion/implementation/waves/wave79/wave79-domain-b-runtime-controls-session-state-ui-foundation-report.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/_map.md`
- `discussion/design/screen-design/screens/_map.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

## Spec Compliance Notes

- Dedicated Viewer branch exists: `activeEntry === "viewer"` is handled alongside Parameter Manager and Project Storage, and renders `ViewerRuntimeScreen` instead of the authoring workspace panels (`apps/editor/src/workspace/authoring-workspace.tsx:32`, `apps/editor/src/workspace/authoring-workspace.tsx:40`, `apps/editor/src/workspace/authoring-workspace.tsx:42`).
- Existing Viewer workspace entry and right-side App Bar Viewer icon both activate `activeEntry = "viewer"` through the UI store (`apps/editor/src/workspace/workspace-data.ts:53`, `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx:19`, `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx:20`, `apps/editor/src/workspace/app-bar.tsx:32`, `apps/editor/src/workspace/app-bar.tsx:137`).
- Back returns to the normal Authoring Workspace branch by setting `activeEntry` to `"import"` (`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:96`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:156`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:159`). This matches the existing Parameter Manager / Project Storage back pattern.
- Authoring context is not reset by Viewer open/close. `EditorSessionProvider` wraps `FoundationWorkspace` (`apps/editor/src/app/editor-app.tsx:8`), and Viewer back only calls `setActiveEntry`; it does not call `setActiveTool`, selection APIs, active parameter setters, or authoring parameter value setters (`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:70`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:71`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:159`).
- Authoring `ParameterBar` is suppressed while Viewer is active (`apps/editor/src/workspace/authoring-workspace.tsx:83`).
- Viewer uses Domain A Clean Stage helpers and Domain B Runtime Controls (`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:41`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:48`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:120`).
- Runtime Controls session overrides feed Clean Stage rendering by merging runtime override values into the parameter value map passed to `createViewerCleanStageProjection` (`apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:130`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:140`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:144`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:152`).
- Runtime Controls state is Viewer-local, excludes `computedDynamics`, normalizes default-valued overrides out of the map, and exposes reset helpers without operation/history/save calls (`apps/editor/src/workspace/viewer/runtime-controls-state.ts:14`, `apps/editor/src/workspace/viewer/runtime-controls-state.ts:57`, `apps/editor/src/workspace/viewer/runtime-controls-state.ts:68`, `apps/editor/src/workspace/viewer/runtime-controls-state.ts:122`, `apps/editor/src/workspace/viewer/runtime-controls-state.ts:187`).
- Clean Stage uses existing Canvas projection/rendering with neutral gray background and overlays disabled, including origin guide suppression (`apps/editor/src/workspace/viewer/viewer-clean-stage.ts:26`, `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:28`, `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:38`, `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:47`).
- Future Playback Slot is present as a non-interactive placeholder, with no play/pause/step controls (`apps/editor/src/workspace/viewer/runtime-controls.tsx:136`, `apps/editor/src/workspace/viewer/runtime-controls.tsx:137`, `apps/editor/src/workspace/viewer/runtime-controls.tsx:142`).

## Must-Not Compliance

- No Viewer reuse of `CanvasPreviewPanel` as the primary Viewer surface; the Viewer branch renders `ViewerRuntimeScreen` and the authoring panels are outside that branch (`apps/editor/src/workspace/authoring-workspace.tsx:40`, `apps/editor/src/workspace/authoring-workspace.tsx:42`, `apps/editor/src/workspace/authoring-workspace.tsx:50`).
- No Viewer import of `ParameterBar`; Runtime Controls are props-based and do not use `useEditorSession` or authoring mutation APIs (`apps/editor/src/workspace/viewer/runtime-controls.tsx:18`, `apps/editor/src/workspace/viewer/runtime-controls.tsx:25`).
- Static source inspection found no user-facing Viewer UI for keyform add/update/delete, authoring overlay toggles, mesh/deformer editing, Parameter Manager definition editing, screenshot/export, Compare/Diff, parameter group/category filter, favorite parameters, crop guide, or functional playback.
- No dependency additions, Cubism SDK/Core usage, runtime-core parity expansion, grid2d parity implementation, dynamics playback, export, Compare/Diff, or crop/presentation guide implementation were found in the reviewed Domain C source.

## Verification Considered / Performed

Considered Orch-Sylph verification:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts` passed: 3 files / 18 tests. Initial sandbox run hit esbuild `spawn EPERM`; escalated rerun passed.
- `pnpm.cmd typecheck` passed.
- `node scripts/check-source-organization.mjs` passed.
- `node scripts/check-dependencies.mjs` passed.
- Touched-file `git diff --check` with temporary intent-to-add for new Domain C files passed, with CRLF warnings only.

Performed in this review:

- Read the Wave79 plan, Viewer screen spec, screen maps, Domain A/B reports, and listed development policies.
- Inspected Domain C source and test files directly, including untracked new source files rather than relying on summary text.
- Ran static searches over reviewed files for activation paths, state mutation calls, Clean Stage / Runtime Controls wiring, forbidden UI labels, overlay controls, operation/save/history calls, and out-of-scope feature terms.

## Residual Risks / Test Gaps

- No browser or pixel-level smoke was considered here; Clean Stage visual correctness still relies on the existing renderer tests plus later integrated visual checks.
- The Back action returns to the canonical Authoring Workspace entry `"import"` rather than restoring the previous task/view entry. This is consistent with the existing Parameter Manager / Project Storage back pattern and does not reset `activeTool`, selection, active parameter, or parameter values, but it is worth keeping as a UX observation for any later "return to previous view" decision.
- Runtime-core full parity, grid2d parity, dynamics playback, export, Compare/Diff, and crop/presentation guide remain intentionally out of scope.

## User-Decision Points

None. No spec ambiguity blocks Domain C acceptance.
