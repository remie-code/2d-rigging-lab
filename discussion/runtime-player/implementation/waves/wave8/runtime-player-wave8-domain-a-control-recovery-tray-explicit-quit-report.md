# Runtime Player Wave8 Domain A Report: Control Recovery / Tray / Explicit Quit

## Verdict

pass

Domain A completed in 2 implementation/review loops.

Implemented scope:

- Control Window close now hides the Control Window instead of destroying it when explicit quit is not in progress.
- Explicit quit is centralized through `RuntimePlayerQuitController`.
- Explicit quit uses the existing shutdown flush owners:
  - input disconnect
  - Model Mapping Profile pending-save flush
  - Window State flush
- Tray and application menu recovery actions are available:
  - Show Control Window
  - Focus Stage
  - Disable Click-through placeholder hook for Domain C
  - Quit Runtime Player
- Tray icon creation uses a PNG data URL and rejects empty native images before exposing tray/menu recovery.
- `window-all-closed` routes non-Darwin shutdown through the explicit quit controller when quit is not already in progress.
- Stage close/recreate was not implemented. Existing created/destroyed state reporting remains the recovery boundary.

## Implementation Loops

### Loop 1

Gnome implemented the lifecycle/recovery layer and focused tests.

Review results:

- Spec compliance: pass
- Design/development compliance: needs_changes
- Test adequacy: pass

Design/development review requested fixes for:

- Early explicit Quit could bypass the required flush path because tray/menu Quit was exposed before the `before-quit` handler was registered.
- Tray recovery used an SVG data URL for `nativeImage.createFromDataURL()`, which was risky for Windows-first tray recovery.

### Loop 2

Gnome fixed both design/development findings.

Changes:

- Registered `before-quit` immediately after `RuntimePlayerQuitController` creation and before tray/menu Quit is exposed.
- Replaced the tray icon SVG data URL with a PNG data URL.
- Added a `NativeImage.isEmpty()` guard before creating the tray.
- Added focused test coverage for PNG icon use and empty-image rejection.

Re-review result:

- Design/development compliance: pass

## Changed Files

Domain A source:

- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/window-management/control-window-recovery.ts`
- `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.ts`

Domain A tests:

- `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts`
- `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts`

Review/report artifacts:

- `discussion/runtime-player/implementation/reviews/wave8/runtime-player-wave8-domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave8/runtime-player-wave8-domain-a-design-development-review.md`
- `discussion/runtime-player/implementation/reviews/wave8/runtime-player-wave8-domain-a-test-adequacy-review.md`
- `discussion/runtime-player/implementation/waves/wave8/runtime-player-wave8-domain-a-control-recovery-tray-explicit-quit-report.md`

Shared-file note:

- `apps/runtime-player/src/main/runtime-player-main.ts` also contains concurrent Domain B startup-state wiring (`RuntimePlayerStartupStateStore`, `startupStateStore`, and `registerRuntimeExportBridgeHandlers` startup-state integration). Domain A did not revert or rewrite those concurrent changes.

## Verification

Gnome Loop 1:

- `pnpm.cmd exec vitest run -c vitest.config.ts src/main/window-management/control-window-recovery.test.ts src/main/window-management/runtime-player-tray-menu.test.ts`
  - Initial sandbox run failed with `spawn EPERM`.
  - Escalated rerun passed: 2 test files, 11 tests.
  - Final rerun after a small fix passed: 2 test files, 11 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Passed.
- `git diff --check -- apps/runtime-player/src/main/runtime-player-main.ts`
  - Passed; output only had an LF-to-CRLF working-copy warning.

Orch-Sylph Loop 1 confirmation:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/main/window-management/control-window-recovery.test.ts src/main/window-management/runtime-player-tray-menu.test.ts`
  - Passed: 2 test files, 11 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Passed.
- `git diff --check -- apps/runtime-player/src/main/runtime-player-main.ts`
  - Passed; output only had an LF-to-CRLF working-copy warning.
- `rg -n "[ \t]$" apps/runtime-player/src/main/window-management/control-window-recovery.ts apps/runtime-player/src/main/window-management/control-window-recovery.test.ts apps/runtime-player/src/main/window-management/runtime-player-tray-menu.ts apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts`
  - No trailing-whitespace matches.

Gnome Loop 2:

- `pnpm.cmd exec vitest run apps/runtime-player/src/main/window-management/control-window-recovery.test.ts apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts`
  - Initial sandbox run failed with `spawn EPERM`.
  - Escalated rerun passed: 2 test files, 12 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Passed.
- `git diff --check -- apps/runtime-player/src/main/runtime-player-main.ts apps/runtime-player/src/main/window-management/runtime-player-tray-menu.ts apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts`
  - Passed; output only had an LF-to-CRLF working-copy warning.
- `rg -n "[ \t]+$" ...Domain A files...`
  - No trailing-whitespace matches.

Orch-Sylph Loop 2 confirmation:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/main/window-management/control-window-recovery.test.ts src/main/window-management/runtime-player-tray-menu.test.ts`
  - Passed: 2 test files, 12 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Passed.

`pnpm install` was not run.

## Review Results

- Spec compliance review: pass
  - `discussion/runtime-player/implementation/reviews/wave8/runtime-player-wave8-domain-a-spec-compliance-review.md`
- Design/development compliance review: pass after Loop 2
  - `discussion/runtime-player/implementation/reviews/wave8/runtime-player-wave8-domain-a-design-development-review.md`
- Test adequacy review: pass
  - `discussion/runtime-player/implementation/reviews/wave8/runtime-player-wave8-domain-a-test-adequacy-review.md`

## Remaining Issues

- Manual Electron verification was not run in this domain loop.
- Domain C must wire the real click-through state into the existing tray/menu `Disable Click-through` hook and refresh the menu enabled state.
- Domain D / final integration should manually verify:
  - Close Control Window, confirm it hides and Runtime Player continues running.
  - Use tray/application menu to show Control Window again.
  - Use tray/application menu to focus Stage.
  - Use tray/application menu Quit and confirm the app exits after input disconnect, Model Mapping Profile flush, and Window State flush.
  - Confirm Windows tray icon visibility and context menu behavior in a real Electron session.
  - Confirm Stage destroyed/open state is reported accurately if Stage is closed.

## User Decision Points

None for Domain A.
