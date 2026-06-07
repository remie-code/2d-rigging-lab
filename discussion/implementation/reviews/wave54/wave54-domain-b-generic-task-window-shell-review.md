# Wave54 Domain B Generic Task Window Shell Review

Verdict: pass

## Findings

- No blocking or needs-change findings for Domain B.

## Scope Reviewed

- `apps/editor/src/ui/app-shell/task-shell.ts`
- `apps/editor/src/ui/app-shell/task-shell.test.ts`
- `apps/editor/src/styles/editor.css` generic `.editor-task-shell` / task shell CSS block only

Basis documents checked:

- `discussion/implementation/orchestration/wave54-plan.md`
- `discussion/implementation/waves/wave54/wave54-domain-a-boundary-current-surface-inventory-report.md`
- `discussion/implementation/reviews/wave54/wave54-domain-a-boundary-current-surface-inventory-review.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Design / Development Compliance

- Pass: a generic workspace-scoped task window shell v0 exists. `createTaskShell()` now marks the root as a workspace task window, adds dialog-like accessibility attributes, focusability, state classes, and stable task-window metadata in `apps/editor/src/ui/app-shell/task-shell.ts:38`.
- Pass: the shell remains generic and PSD-independent. The implementation adds no PSD workflow logic, no PSD content, no parser/scaffold semantics, and no App Shell routing. The only production source changed for the shell is the existing generic task shell module.
- Pass: title/status, close/back affordances, slots, bounded content, stable regions, and state handling are present. The implementation covers title/status and root metadata at `task-shell.ts:50`, navigation controls at `task-shell.ts:150`, action/diagnostics/content slots at `task-shell.ts:223` and `task-shell.ts:289`, loading/error/disabled state at `task-shell.ts:257`, and `data-task-shell-region` / `data-task-window-region` assignment at `task-shell.ts:319`.
- Pass: keyboard/focus basics are appropriate for Domain B. The root is programmatically focusable and Escape invokes enabled close affordance behavior at `task-shell.ts:54` and `task-shell.ts:130`. Final initial-focus placement remains a Domain G integration concern.
- Pass: CSS is modest and scoped to the generic task shell block. The reviewed CSS uses `.editor-task-shell` selectors and responsive adjustments at `apps/editor/src/styles/editor.css:171`, `apps/editor/src/styles/editor.css:1694`, and `apps/editor/src/styles/editor.css:1737`.
- Pass: source organization policy is respected. No broad `index.ts` or non-barrel entrypoint implementation changes were introduced, and the source organization guard passed.

## Test Adequacy

- Pass: focused unit tests cover generic shell metadata, title/status/content, stable regions, slots, native back/close buttons, disabled/busy affordance behavior, Escape behavior, loading/error/disabled state, optional region omission, and a non-PSD Codex Automation surface example.
- Pass: the test scope is adequate for Domain B. App Shell final route wiring, Toolbox launch behavior, PSD task window integration, and desktop/mobile e2e behavior are explicitly Domain G/H responsibilities.

## Boundary Review

- Pass: no PSD semantics or PSD content changes were made by Domain B.
- Pass: no Diagnostics / Evidence or Codex / Automation content implementation was added. Test references to Diagnostics/Codex surfaces are used only as generic shell examples.
- Pass: no final App Shell route integration was performed. Existing `app-shell.ts` remains the consumer and Domain G still owns route state, Toolbox enablement/mapping, and final window wiring.
- Pass: no production behavior reliance on `data-testid` was introduced. The implementation uses generic `dataset` region metadata as observation hooks; tests use those hooks but production logic does not branch on them.

## Verification Performed

- `git diff --check -- apps/editor/src/ui/app-shell/task-shell.ts apps/editor/src/ui/app-shell/task-shell.test.ts apps/editor/src/styles/editor.css`: passed.
- `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/task-shell.test.ts`: passed, 7 tests. Initial sandbox run failed with `spawn EPERM` while starting esbuild; rerun with approved escalation passed.
- `pnpm.cmd run check:source`: passed.
- `pnpm.cmd typecheck`: passed in this review run. Gnome reported an earlier out-of-scope parallel failure in `apps/editor/src/ui/app-shell/codex-automation-view-skeleton.test.ts:88`; that failure was not reproduced here and no Domain B type error was observed.

## Residual Risks

- Domain G must consume this shell by wiring actual task-window routing, Toolbox launch behavior, close/back return behavior, and initial focus placement without moving PSD semantics into the generic shell.
- Domain H should still cover integrated desktop/mobile and focused PSD regression after Domain G, because Domain B tests only the reusable shell in isolation.

Domain G may consume this output.
