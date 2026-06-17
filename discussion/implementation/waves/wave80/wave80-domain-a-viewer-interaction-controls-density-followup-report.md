# Wave80 Domain A Report: Viewer Interaction + Runtime Controls Density Follow-up

## Status

- Verdict candidate: pass
- Orch-Sylph final result: pass
- Domain: `wave80-viewer-interaction-controls-density-followup`
- Scope: Viewer-only source follow-up plus this report.
- Review gate: pass across Spec Compliance, Design / Development Compliance, and Test Adequacy lanes.

## Basis Coverage Self-Report

Read before implementation:

- `discussion/implementation/orchestration/wave80-plan.md`
- `discussion/implementation/orchestration/wave79-plan.md`
- `discussion/implementation/waves/wave79/wave79-final-integration-report.md`
- `discussion/implementation/reviews/wave79/wave79-final-clean-integration-review.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/e2e-oracle.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`

Deferred basis items: none for this domain. Broader runtime-core parity, dynamics, export, screenshot, parameter grouping, favorite parameters, mesh/deformer/keyform authoring, and save/load schema were treated as explicit non-goals.

## User-Facing UX Trace

- Viewer remains a dedicated finished-model confirmation screen.
- Clean Stage now supports mouse wheel zoom and left-button drag pan directly on the stage.
- Existing Fit artwork, Fit canvas, 1:1, Zoom out, and Zoom in controls remain.
- Runtime Controls panel width is widened at desktop layout from `360px` to `440px` to support dense horizontal rows.
- Runtime parameter rows now read as compact horizontal rows: name, slider, numeric input, row reset icon.
- `Reset changed` is removed from visible UI.
- Global `Reset all` is an icon-only button with `title="Reset all"` and `aria-label="Reset all parameter overrides"`.

## Viewer Visibility Parity Trace

- `ViewerRuntimeScreen` now reads `editorHiddenPartIds` from `useEditorSession()`.
- `createViewerRuntimeCleanStageProjection` passes `editorHiddenPartIds` into `createViewerCleanStageProjection`.
- `createViewerCleanStageProjection` forwards `editorHiddenPartIds` to `createCanvasRenderProjection`.
- Existing Canvas evaluation already gates Drawables by direct part and ancestor part hidden state, so Viewer now matches that path.
- Added tests cover:
  - visible ancestor Parts Containers plus visible Drawable remains visible/renderable;
  - hidden direct Parts Container hides descendant Drawables;
  - hidden ancestor Parts Container hides descendant Drawables;
  - Drawable `runtimeVisibility=false` still hides only that Drawable while visible sibling/mask Drawable remains visible.

## Clean Stage Interaction Trace

- Added Viewer-local wheel zoom handler on the Clean Stage canvas.
- Wheel zoom uses the current pointer-local point and `zoomViewAtScreenPoint`, preserving pointer anchoring through the existing projection helper.
- Wheel handling calls `event.preventDefault()` to avoid panel/page scroll while zooming.
- Added Viewer-local left-button drag pan:
  - left pointer down starts panning;
  - pointer capture is set on the canvas;
  - pointer move adjusts `CanvasViewState.pan`;
  - pointer up/cancel clears panning and releases capture when held.
- Added `cursor-grab` / `cursor-grabbing` affordance and observable `data-pan-state`, `data-view-pan-x`, and `data-view-pan-y` attributes.
- Added pure helper tests for `zoomViewerStageViewAtPoint` and `panViewerStageView`; they verify zoom changes, pointer anchoring, pan delta application, no input view mutation, and no project/session mutation.

## Runtime Controls Density Trace

- Header changed-count text now uses `override(s)` instead of a visible `Changed` label.
- Search remains at the top.
- Reset area is now search plus one icon-only reset-all button.
- Parameter row min/max text was removed.
- The visible `Changed` badge was removed.
- Changed state remains observable via `data-changed="true"` and row accent border/inset styling.
- Numeric input is shorter and narrower (`h-7`, `4rem` row track).
- Row reset remains per-parameter and retains `aria-label="Reset <parameter>"`.
- `resetChangedRuntimeParameterOverrides` and the unused `hasChangedParameters` projection flag were removed from Viewer runtime controls state.

## Must-not Compliance Evidence

- No files under `packages/**` were edited.
- No `package.json`, lockfile, dependency, save/load schema, portable project format, runtime-core, mesh generation, deformer authoring, keyform authoring, dynamics, export, screenshot, diff/compare, crop guide, favorite parameter, or parameter grouping changes were made.
- No `CanvasPreviewPanel` wholesale reuse was introduced.
- No full `ParameterBar` reuse was introduced.
- Viewer pan/zoom stays in `ViewerCleanStageCanvas` React local state.
- Runtime parameter overrides stay in Viewer local state.
- No operation/history/project mutation APIs were added to Viewer pan/zoom or Runtime Controls.
- Conditional write scope was not used.

## Residual Risk Classification

- Low: No browser/pixel smoke was run for the final Viewer screen; evidence is focused unit/component/static markup coverage.
- Low: `git diff --check` has limited coverage for already-untracked Wave79 Viewer files in this dirty workspace because Git does not include untracked file content in normal diff checks.
- Medium, pre-existing outside this domain: `pnpm.cmd --dir apps/editor typecheck` still fails on existing non-Viewer app type errors in editor-session, mesh-tool, project-storage, and canvas render scene adapter files. After fixing Viewer test type issues, no Viewer file appeared in the failing app typecheck output.

## Changed Files

- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
- `apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls-state.ts`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- `discussion/implementation/waves/wave80/wave80-domain-a-viewer-interaction-controls-density-followup-report.md`

## Verification Commands and Results

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - Initial sandbox run failed with Vitest/esbuild `spawn EPERM`.
  - Approved escalated run after implementation found one fixture issue: `hasRenderableArtwork` was false because test texture bytes were `10x10` while mesh/render dimensions were `100x100`.
  - Fixture corrected to `100x100`.
  - Final approved escalated run passed: 3 files / 21 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `pnpm.cmd --dir apps/editor typecheck`
  - Failed on pre-existing non-Viewer errors after Viewer-local type fixes; no Viewer errors remained in the second run.

- `git diff --check -- apps/editor/src/workspace/viewer discussion/implementation/waves/wave80`
  - Passed, exit 0.

Orch-Sylph final verification:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - Sandbox run failed with Vitest/esbuild `spawn EPERM`.
  - Approved escalated rerun passed: 3 files / 21 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `git diff --check -- apps/editor/src/workspace/viewer discussion/implementation/waves/wave80 discussion/implementation/reviews/wave80`
  - Passed, exit 0.

## Review Results

- `discussion/implementation/reviews/wave80/wave80-domain-a-spec-compliance-review.md`: pass.
- `discussion/implementation/reviews/wave80/wave80-domain-a-design-development-review.md`: pass.
- `discussion/implementation/reviews/wave80/wave80-domain-a-test-adequacy-review.md`: pass.

## Remaining Issues / User-Decision Points

- None requiring user decision for Domain A.
- Optional future hardening: browser-level smoke for actual wheel/pan event handling and visual row density, if Domain B wants stronger integrated UX evidence.
