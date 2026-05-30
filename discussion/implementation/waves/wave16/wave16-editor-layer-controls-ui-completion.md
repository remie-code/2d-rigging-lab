# Wave 16 Domain D Completion: Editor Layer Controls UI

> Wave: `drawable-layer-controls-and-visibility-authoring`
> Domain: `wave16-editor-layer-controls-ui`
> Date: 2026-05-30

## Verdict

`pass`

Domain D added drawable list controls for runtime visibility and draw-order movement, wired them through the app shell to Domain C workflow actions, and verified the focused UI/app-shell behavior.

## Files Changed

Editor UI:

- `apps/editor/src/ui/drawable-authoring/drawable-list.ts`
- `apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/app/editor-app.ts`

Editor state / test IDs:

- `apps/editor/src/editor-state/editor-test-ids.ts`

Styles:

- `apps/editor/src/styles/editor.css`

Focused tests:

- `apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts`
- `apps/editor/src/ui/app-shell/app-shell.test.ts`

Reports:

- `discussion/implementation/waves/wave16/wave16-editor-layer-controls-ui-completion.md`
- `discussion/implementation/reviews/wave16/wave16-editor-layer-controls-ui-review.md`

## Implementation Summary

- Added row-level runtime visibility toggle controls to the existing drawable list.
- Added row-level move up / move down controls to the existing drawable list.
- Used Domain C view-model labels and enabled state for layer controls.
- Routed UI events through callbacks only:
  - `onToggleDrawableRuntimeVisibility(drawableId)`;
  - `onMoveDrawableLayer(drawableId, "up" | "down")`.
- Wired `editor-app.ts` callbacks to Domain C workflow actions:
  - `workflow.toggleDrawableRuntimeVisibility(drawableId)`;
  - `workflow.moveDrawableLayer(drawableId, direction)`.
- Kept the preview panel and drawable authoring panel in the same existing app shell workspace.
- Added stable test IDs for Domain E:
  - `drawable.layer.status`;
  - `drawable.visibility.<drawableId>`;
  - `drawable.moveUp.<drawableId>`;
  - `drawable.moveDown.<drawableId>`.
- Added compact CSS for the new controls and preserved the existing responsive table/card behavior.

## Tests Run

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.test.ts apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-state/editor-test-ids.test.ts` | pass after sandbox escalation | Initial sandbox run failed with `EPERM` reading Vitest from `node_modules`; final run passed 3 files / 17 tests. |
| `pnpm.cmd typecheck` | pass after sandbox escalation and one Domain D fixture fix | Initial sandbox run failed with `EPERM` reading TypeScript from `node_modules`; first escalated run caught a tuple typing issue in the new UI test fixture, then passed after fix. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `git diff --check -- apps/editor/src/ui/drawable-authoring apps/editor/src/ui/app-shell/app-shell.ts apps/editor/src/app/editor-app.ts apps/editor/src/styles apps/editor/src/editor-state/editor-test-ids.ts discussion/implementation/waves/wave16/wave16-editor-layer-controls-ui-completion.md discussion/implementation/reviews/wave16/wave16-editor-layer-controls-ui-review.md` | pass | LF/CRLF warnings only; no whitespace errors. |

## Review Findings And Fixes Applied

Independent Review-Sylph verdict: `pass`.

Findings:

- No blocking or medium findings.

Fixes applied before review:

- Corrected the new UI test mesh triangle fixture to use tuple typing accepted by editor typecheck.

## Remaining Issues

- Browser/mobile visual smoke and full E2E workflow are intentionally left for Domain E.
- The visibility toggle uses action labels (`Hide` / `Show`) with `aria-pressed`; this is acceptable for the current focused UI scope, but a later a11y pass may choose a more explicit current-state control label.

## User-Decision Points

- None.

## Provisional Assumptions

- Domain C's `moveDrawableLayer(..., "up")` means moving toward the higher/front layer position.
- Domain E will mirror the new dynamic test ID helpers in its E2E layer-control workflow.
