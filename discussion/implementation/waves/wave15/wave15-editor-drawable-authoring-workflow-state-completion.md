# Wave 15 Domain C Completion: Editor Drawable Authoring Workflow State

> Wave: `editor-drawable-mesh-authoring-vertical-slice`
> Domain: `wave15-editor-drawable-authoring-workflow-state`
> Verdict: `pass`
> Date: 2026-05-30

## Files Changed

- `apps/editor/src/editor-session/create-drawable-preset-command.ts`
- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-session/index.ts`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/editor-session/session-adapter.test.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/workflow-controller.test.ts`
- `apps/editor/src/editor-workflow/workflow-state-projection.ts`
- `apps/editor/src/editor-state/create-drawable-form-state.ts`
- `apps/editor/src/editor-state/drawable-list-state.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-state-projections.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/editor-view-model.test.ts`
- `apps/editor/src/editor-state/index.ts`
- `apps/editor/src/editor-state/reload-summary.ts`
- `discussion/implementation/waves/wave15/wave15-editor-drawable-authoring-workflow-state-completion.md`
- `discussion/implementation/reviews/wave15/wave15-editor-drawable-authoring-workflow-state-review.md`

## Implementation Summary

- Added an editor-session generated drawable preset command builder.
  - The chosen sequence is `createDrawable` followed by `generateMesh`.
  - This preserves Domain A's runtime-safe manual-empty mesh committed by `createDrawable`, then upgrades the same drawable mesh through `generateMesh` using `auto-grid-v1`.
  - The workflow does not merge the two operations into one operation; both operations remain visible in the operation log and package file set.
- Added `EditorSessionAdapter.commitCreateDrawablePreset`.
  - Commits `createDrawable`, stops before `generateMesh` if create is rejected, and commits `generateMesh` against the current post-create package revision when create succeeds.
  - Rejected operation persistence results now serialize the current authoring session instead of falling back to the original base document, so semantic state does not rewind after duplicate/rejected commands.
- Extended editor evidence collection for `createDrawable` and `generateMesh`.
  - Evidence is built from baseline/candidate runtime graphs and materialized as package-relative runtime/validation artifacts.
- Added workflow controller action `commitCreateDrawablePreset`.
  - Applies both operation results to semantic state on the happy path.
  - Exposes `latestDrawablePresetResult` for UI-independent consumers.
- Added semantic state and view-model support for Domain D.
  - Drawable list state: id, display name, mesh id, visibility, draw order, bounds, vertex count, triangle count.
  - Pending create drawable defaults from loaded source asset/layer, part, canvas, mesh method, density hint, and diagnostics.
  - Command enabled state and summary labels for drawable authoring.
  - Reload summaries now include drawable ids/counts as well as parameter ids/counts.
- Save/load and preview compatibility remain package/runtime backed.
  - Save snapshots include updated drawables/meshes/draw order and operation log entries.
  - Load projection restores drawable list and generated evidence from package file set.
  - Preview projection continues to evaluate `toRuntimeGraph(adapter.authoringSession)`, so created drawable visibility is runtime-derived rather than UI-only state.

## Tests Run

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/editor-state/editor-view-model.test.ts` | initial sandbox fail | Failed with `EPERM` opening `node_modules/.../vitest.mjs`. |
| `pnpm.cmd exec vitest run apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/editor-state/editor-view-model.test.ts` | pass after escalation | Initial focused run passed 3 files / 25 tests before review fix. |
| `pnpm.cmd typecheck` | initial fail, final pass | Initial failure was in new view-model test branded ID literals; fixed by parsing branded ids. Final root + editor typecheck passed. |
| `pnpm.cmd exec vitest run apps/editor/src/editor-session/session-adapter.test.ts apps/editor/src/editor-workflow/workflow-controller.test.ts apps/editor/src/editor-state/editor-view-model.test.ts` | pass after escalation | Final focused run passed 3 files / 27 tests after rejected-duplicate regression was added. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `git diff --check -- apps/editor/src/editor-session apps/editor/src/editor-workflow apps/editor/src/editor-state discussion/implementation/waves/wave15 discussion/implementation/reviews/wave15` | pass | LF/CRLF working-copy warnings only. |

## Review Findings And Fixes Applied

- Independent Review-Sylph returned `needs_changes` for rejected drawable workflow state.
  - Finding: duplicate or post-create rejected operations could project semantic state from the original base document while the adapter authoring session still contained committed drawable state.
  - Fix: rejected persistence results now serialize the current authoring session and generated artifact entries into a package file set, then reload from that file set.
  - Regression: added session and workflow tests for duplicate `commitCreateDrawablePreset` after a successful create/generate, asserting committed drawable state, operation log, package files, and preview remain coherent.
- The final review verdict is `pass`; the review report records the fixed finding.

## Remaining Issues

- No visible UI was added by design; Domain D must connect controls to the new view-model fields/action.
- The multi-operation convenience command is not transactional. If `generateMesh` rejects after `createDrawable` commits, the created drawable remains committed with Domain A's runtime-safe manual-empty mesh. This is an intentional provisional behavior for Domain C, not a rollback workflow.
- The command supports `auto-grid-v1` and `manual-empty` through Domain A, but the view-model defaults expose `auto-grid-v1` only for the generated preset vertical slice.

## User-Decision Points

- None blocking for Domain C.
- Future product decision remains: whether generated drawable preset creation should eventually be a transaction/compound operation, or remain explicitly logged as two operations.

## Provisional Assumptions

- Domain A's `createDrawable` runtime-safe manual mesh plus `generateMesh` upgrade is the accepted dependency baseline.
- Domain D can build UI from `commitCreateDrawablePreset`, `state.drawables`, `state.pendingCreateDrawable`, and `viewModel.drawableAuthoring` without source redesign.
- Rejected operations should not erase or rewind existing committed editor semantic state.
