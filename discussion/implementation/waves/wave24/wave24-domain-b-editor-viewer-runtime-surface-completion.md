# Wave 24 Domain B Completion: Editor Viewer Runtime Surface

> Target: `wave24-editor-viewer-runtime-surface`  
> Date: 2026-06-01  
> Role: Gnome implementation  
> Status: `implemented`

## Summary

Domain B added an in-editor `Viewer / Runtime` surface that is separate from the existing embedded `Preview` panel. The surface opens from the editor app bar, keeps parameter overrides as viewer session state, evaluates runtime snapshots through the Domain A viewer session adapter, and displays package state, runtime snapshot summary, runtime diff, validation diagnostics, and viewer parameter sliders.

The implementation does not add a standalone viewer app, renderer backend, parser, file picker, image decode, archive I/O, external dependency, or runtime/validator broad implementation.

## Changed Files

Editor state:

- `apps/editor/src/editor-state/viewer-runtime-state.ts`
- `apps/editor/src/editor-state/viewer-runtime-state.test.ts`
- `apps/editor/src/editor-state/viewer-runtime-view-model.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/editor-state/index.ts`

Editor workflow:

- `apps/editor/src/editor-workflow/viewer-runtime-workflow.ts`
- `apps/editor/src/editor-workflow/viewer-runtime-workflow.test.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/index.ts`

Editor UI:

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`
- `apps/editor/src/ui/viewer-runtime/index.ts`
- `apps/editor/src/ui/viewer-runtime/viewer-runtime-panel.ts`
- `apps/editor/src/ui/viewer-runtime/viewer-runtime-parameter-controls.ts`
- `apps/editor/src/ui/viewer-runtime/viewer-runtime-summary.ts`

This report:

- `discussion/implementation/waves/wave24/wave24-domain-b-editor-viewer-runtime-surface-completion.md`

## Evidence

- User can open Viewer / Runtime surface inside editor: `app-shell` renders an app-bar open button, opens a distinct `Viewer / Runtime` panel, and wires close behavior.
- Parameter slider changes update viewer snapshot summary: `viewer-runtime-state` applies session-only overrides, and `viewer-runtime-workflow.test.ts` verifies `param_preview_body_yaw` changes to `viewerOverride` and increases runtime diff parameter changes.
- Snapshot / diff / diagnostics are visible and truthful: the panel renders Domain A viewer snapshot evidence, summarized runtime diff from the existing diff summarizer, and `validatePackageRuntime` diagnostics for the evaluated viewer snapshot.
- Package identity / save-load state is visible: the panel displays package ID/revision, reload status, and latest browser-local project storage result.
- Desktop/mobile layout and accessible labels remain coherent: no app-shell redesign or CSS change was introduced; controls reuse existing responsive panel/slider classes, and tests assert viewer slider `aria-label` wiring.

## Verification

| Check | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/editor-state/viewer-runtime-state.test.ts apps/editor/src/editor-workflow/viewer-runtime-workflow.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts` | pass; 3 files / 24 tests |
| `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/ui/dynamics-panel/dynamics-panel.test.ts apps/editor/src/editor-state/preview-parameter-state.test.ts apps/editor/src/editor-session/viewer-session-adapter.test.ts` | pass; 4 files / 31 tests |
| Combined focused rerun for all 7 focused files | pass; 55 tests |
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd test:e2e` | pass; existing desktop and mobile editor smoke passed |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `git diff --check -- apps/editor discussion/implementation/waves/wave24 discussion/implementation/reviews/wave24` | pass; LF/CRLF working-copy warnings only |
| Dependency manifest diff check | pass; no output |
| Targeted forbidden-scope scan over Domain B changed files | pass; no matches |

## Residual Risks

- Viewer-specific browser save/load smoke is not implemented in Domain B; that remains Domain E scope.
- Validation display uses the existing `validatePackageRuntime` report over the evaluated viewer snapshot. Viewer-specific validator/report additions remain Domain C scope.
- The surface displays runtime inspection data and existing SVG-style preview projection summaries, not a new full renderer or standalone viewer.
- Viewer parameter values reset to package defaults when the package parameter list changes; this keeps authoring edits from silently carrying stale viewer overrides.

## Review Handoff Notes

Review-Sylph should inspect:

- Viewer state/session separation from preview state: `apps/editor/src/editor-state/viewer-runtime-state.ts`.
- Runtime projection path and Domain A adapter usage: `apps/editor/src/editor-workflow/viewer-runtime-workflow.ts`.
- App-shell integration and non-confusion with embedded Preview: `apps/editor/src/ui/app-shell/app-shell.ts`, `apps/editor/src/ui/viewer-runtime/**`.
- Test coverage for open/close, slider callback, viewer override diff, validation report display, and save/load recomputation: `viewer-runtime-state.test.ts`, `viewer-runtime-workflow.test.ts`, `app-shell.test.ts`.
- Barrel-only changes: `apps/editor/src/editor-state/index.ts` and `apps/editor/src/editor-workflow/index.ts`.
