# Wave 14 Domain D Completion: Embedded Preview Panel UI

> Wave: `editor-embedded-preview-foundation`
> Domain: `wave14-embedded-preview-panel-ui`
> Verdict: `pass`

## Scope

Domain D added the editor embedded preview panel UI and connected preview-only parameter controls to the workflow preview state and runtime projection.

The UI consumes Domain A `EditorPreviewProjectionDto`, Domain B preview-ready sample data, and Domain C preview parameter controls/actions. No browser sample package, runtime/package contracts, or e2e scripts were edited.

One narrow workflow-controller addition was made for UI integration: a read-only `previewProjection` getter that evaluates the current authoring session with preview-only authored parameter values and projects the runtime snapshot/diff for the panel.

## Files Changed

Production:

- `apps/editor/src/ui/preview-panel/index.ts`
- `apps/editor/src/ui/preview-panel/preview-panel.ts`
- `apps/editor/src/ui/preview-panel/preview-parameter-controls.ts`
- `apps/editor/src/ui/preview-panel/preview-summary.ts`
- `apps/editor/src/ui/preview-panel/preview-visual.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/styles/editor.css`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`

Tests:

- `apps/editor/src/ui/app-shell/app-shell.test.ts`

Reports:

- `discussion/implementation/waves/wave14/wave14-embedded-preview-panel-ui-completion.md`
- `discussion/implementation/reviews/wave14/wave14-embedded-preview-panel-ui-review.md`

## Implementation Summary

- Added a dense `Preview` panel to the editor shell first screen.
- Added SVG visual rendering from projected runtime drawable geometry, opacity, visibility, and canvas size.
- Added preview summary for snapshot identity, drawable counts, keyform samples, diagnostics, and runtime diff counts.
- Added range sliders and reset button from Domain C preview control view model.
- Wired slider changes through `workflow.setPreviewParameterValue(...)` and reset through `workflow.resetPreviewParameterValues()`.
- Added `workflow.previewProjection` to evaluate current preview parameter values through runtime-core, compare them against document defaults, and project the resulting runtime snapshot/diff through Domain A.
- Added responsive CSS for compact preview visual, summary facts, sliders, disabled states, and mobile single-column summary.

## Tests And Verification

Passed:

- `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-state/editor-test-ids.test.ts`
  - 2 test files / 6 tests passed.
- `pnpm.cmd typecheck`
  - root typecheck and editor typecheck passed.
- `pnpm.cmd run check:source`
  - source organization guard passed.
- `git diff --check -- apps/editor/src/ui/preview-panel apps/editor/src/ui/app-shell/app-shell.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/app/editor-app.ts apps/editor/src/styles/editor.css apps/editor/src/editor-state/editor-test-ids.ts apps/editor/src/editor-workflow/workflow-controller.ts`
  - no whitespace errors; Git emitted LF/CRLF working-copy warnings only.

Initial sandbox note:

- The first Vitest sandbox run failed with `EPERM` reading Vitest from `node_modules`.
- Escalated focused Vitest reruns passed.

## Review Findings And Fixes Applied

Independent Review-Sylph verdict: `pass`.

Findings:

- None blocking.

Fix applied before final report:

- Changed preview SVG overflow from `visible` to `hidden` so source-level layout is less likely to create panel overflow before Domain E browser smoke.
- Added an app-shell test assertion that a preview parameter update changes the projected SVG polygon and diff summary.

## Review Lane Results

Runtime Truthfulness: pass.

- Preview projection is created from runtime graph evaluation, runtime snapshot comparison, and Domain A projection.
- UI renders projected drawable geometry/opacity and summary fields; it does not invent renderer semantics or external assets.

Product Workflow: pass.

- Preview panel is visible in the editor workspace.
- Slider input calls the workflow preview parameter action, re-rendering updates the SVG geometry and diff summary.
- Reset control calls the workflow preview reset action.

UI / Accessibility: pass.

- Preview section has an `aria-labelledby` heading.
- SVG visual has image role and accessible label.
- Slider controls have accessible names and disabled state.
- CSS uses constrained grid/flex dimensions, `min-width: 0`, wrapping, and mobile single-column summary.

Development Compliance: pass.

- Preview UI source is split into focused files.
- `apps/editor/src/ui/preview-panel/index.ts` is barrel-only.
- The workflow-controller changes are narrow UI integration additions and reuse Domain C actions.
- No e2e scripts, sample package, runtime/package contracts, or unrelated files were edited.

Test Adequacy: pass.

- Focused tests cover panel rendering, slider callback, reset callback, visual/summary update, no-preview state, disabled-control state, empty state, and test id uniqueness.

## Remaining Issues

- Browser-level desktop/mobile and accessibility smoke are intentionally left to Domain E.
- The preview visual is a simple SVG projection, not a full renderer or texture pipeline.
- `workflow.previewProjection` recomputes projection on render. This is acceptable for the small foundation slice but may need memoization if future packages become large.

## User-Decision Points

- None.

## Provisional Assumptions

- Preview-only parameter values remain session/UI state and are not persisted.
- A simple SVG projection from runtime DTO geometry is sufficient for Wave 14 foundation before a future renderer/texture pipeline.
- Runtime diff against document defaults is the right summary for preview slider movement in this slice.
