# Wave79 Domain C Report: Dedicated Viewer Screen Integration

## Verdict

pass

Domain C connects Viewer v0 as a dedicated screen and integrates Domain A Clean Stage with Domain B Runtime Controls. All required independent review lanes passed. No fix loop was needed.

## Child Agents Started And Closed

| Agent | Role | Result | Closed |
|---|---|---|---|
| `019ed32e-0854-7652-886a-a0ebcf2aa23e` / Gnome the 16th | Implementation | done | yes |
| `019ed33d-14d1-76c0-937c-5b8dfce54ce6` / Sylph the 17th | Spec Compliance Review | pass | yes |
| `019ed33d-8003-7002-8eae-6fa1857980ca` / Sylph the 18th | Design / Development Compliance Review | pass | yes |
| `019ed33d-e847-7102-a027-c9932a7a909b` / Sylph the 19th | Test Adequacy Review | pass | yes |

## Files Changed

Implementation:

- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/workspace/app-bar.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`

Domain C artifacts:

- `discussion/implementation/waves/wave79/wave79-domain-c-dedicated-viewer-screen-integration-report.md`
- `discussion/implementation/waves/wave79/_map.md`
- `discussion/implementation/reviews/wave79/wave79-domain-c-spec-compliance-review.md`
- `discussion/implementation/reviews/wave79/wave79-domain-c-design-development-review.md`
- `discussion/implementation/reviews/wave79/wave79-domain-c-test-adequacy-review.md`
- `discussion/implementation/reviews/wave79/_map.md`

Domain A/B accepted files remained in place and were preserved.

## Basis Coverage Self-Report

Read or delegated as required basis:

- `discussion/implementation/orchestration/wave79-plan.md`
- `discussion/implementation/waves/wave79/wave79-domain-a-clean-stage-render-foundation-report.md`
- `discussion/implementation/waves/wave79/wave79-domain-b-runtime-controls-session-state-ui-foundation-report.md`
- `discussion/implementation/reviews/wave79/_map.md`
- `discussion/implementation/waves/wave79/_map.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/_map.md`
- `discussion/design/screen-design/screens/_map.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

Review lanes inspected the changed source and tests directly rather than relying only on the implementer summary.

## User-Facing UX Trace

- Viewer / Runtime View is now a dedicated screen with header, Back action, model identity label, Reset pose, Clean Stage, and Runtime Controls.
- The main stage is a neutral gray Clean Stage with fit artwork, fit canvas, 1:1, zoom out, and zoom in view controls.
- Runtime Controls appear as the right-side Viewer operation surface with search, sliders, numeric inputs, reset actions, changed indicators, and the non-interactive Future Playback Slot.
- The Future Playback Slot remains a placeholder: `Motion / Physics: Not configured`.
- Authoring `ParameterBar` is hidden while Viewer is active.

## Route / Navigation Trace

- `AuthoringWorkspaceContent` handles `activeEntry === "viewer"` alongside the existing Parameter Manager and Project Storage screen branches.
- The existing `viewer` workspace entry continues to route through the normal `setActiveEntry("viewer")` path.
- The right-side App Bar Viewer icon now calls the same local `activateEntry("viewer")` path as App Bar task/view entries.
- Back calls only `setActiveEntry("import")`, returning to the canonical Authoring Workspace branch without opening the PSD import modal.

## Clean Stage + Runtime Controls Integration Trace

- `ViewerRuntimeScreen` reads `session` and authoring `parameterValues` from `useEditorSession()`.
- Runtime Controls state is local React state initialized with `createInitialRuntimeControlsState()`.
- `createRuntimeParameterValueMap(parameters, runtimeControlsState)` creates normalized session-only runtime overrides.
- Clean Stage parameter values are composed as `{ ...authoringParameterValues, ...runtimeParameterValues }`, so Viewer overrides take precedence without mutating authoring values.
- `createViewerCleanStageProjection(session, { parameterValues })` feeds the merged values into the Domain A Clean Stage projection.
- The canvas render effect calls `renderViewerCleanStageProjection` with Domain A clean overlays and bitmap cache handling.

## Authoring State Preservation / Non-Mutation Evidence

- Viewer open/close changes only `activeEntry`; it does not call `setActiveTool`, selection APIs, active parameter setters, authoring parameter value setters, operation commits, history commits, save/load, or project mutation helpers.
- `EditorSessionProvider` remains mounted above the workspace screen switch, preserving selection, active tool, active parameter, and authoring parameter values.
- Tests assert Back does not call authoring parameter mutation or selection callbacks.
- Tests freeze an authoring parameter value map, apply a Viewer runtime override, and assert Clean Stage output changes while the original authoring map remains unchanged.

## Must-Not Compliance Evidence

- Viewer does not reuse `CanvasPreviewPanel` wholesale.
- Viewer does not reuse or import full `ParameterBar`; Runtime Controls are props/state based.
- Viewer screen tests assert no keyform add/update/delete UI, authoring canvas preview panel, mesh/deformer overlay controls, screenshot/export, Compare, Favorite, or Group UI text.
- Runtime Controls continue to exclude `computedDynamics` through Domain B helpers.
- No edits were made to `packages/runtime-core/**`, package manifests, lockfiles, save/load schemas, mesh/deformer/keyform operation code, or broad canvas renderer/evaluation files.
- No runtime-core full parity, grid2d parity, dynamics playback, export, Compare/Diff, crop/presentation guide, favorites, or parameter group/category filter scope was added.

## Verification Performed

Passed:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - Initial sandbox run failed with esbuild `spawn EPERM`.
  - Escalated rerun passed: 3 test files, 18 tests.
- `pnpm.cmd typecheck`
  - pass.
- `node scripts/check-source-organization.mjs`
  - pass.
- `node scripts/check-dependencies.mjs`
  - pass.
- Touched-file `git diff --check` with temporary intent-to-add for new Domain C files:
  - pass, with Git CRLF normalization warnings only.

## Review Findings And Fix Loops

Review lane results:

- Spec Compliance Review: pass, no blocking or needs-change findings.
- Design / Development Compliance Review: pass, no blocking, major, or minor findings.
- Test Adequacy Review: pass, no blocking or needs-change findings.

Fix loops:

- Loop 0 only. No review finding required implementation changes.

## Residual Risks

- No browser or pixel-level smoke was performed for the final integrated screen.
- No browser-level slider-to-React-state-to-canvas-repaint smoke was run. The current proof is component/state/projection coverage plus focused render foundation tests.
- Back returns to the canonical Authoring Workspace entry `"import"` rather than restoring an arbitrary previous task/view entry. Reviews accepted this as consistent with current Parameter Manager / Project Storage patterns.
- The shared App Bar remains visible in Viewer, including existing global Open/Save/Undo/Redo controls. Reviews treated these as pre-existing shell controls outside Viewer-owned screen semantics.
- Full runtime-core parity, grid2d parity, dynamics playback, export, Compare/Diff, and crop/presentation guide remain out of scope.

## User-Decision Points

None.
