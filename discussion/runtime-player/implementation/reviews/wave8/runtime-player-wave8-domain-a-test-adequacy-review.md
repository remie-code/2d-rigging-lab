# Runtime Player Wave8 Domain A Test Adequacy Review

- verdict: `pass`
- review lane: Test Adequacy
- reviewer role: Review-Sylph
- report path: `discussion/runtime-player/implementation/reviews/wave8/runtime-player-wave8-domain-a-test-adequacy-review.md`

## Basis

Read directly:

- `discussion/runtime-player/implementation/orchestration/player-wave8-plan.md`
- `discussion/runtime-player/screens/broadcast-stage-setup-v0.md`
- `discussion/runtime-player/research/broadcast-capture-paths.md`
- `discussion/runtime-player/screens/control-window-screen-structure.md`
- `discussion/runtime-player/screens/tracking-setup-live-mapping.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`

Review target source/tests read directly:

- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/window-management/control-window-recovery.ts`
- `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.ts`
- `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts`
- `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts`

Related existing tests inspected as context:

- `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`
- `apps/runtime-player/src/main/window-state/window-state-controller.test.ts`
- `apps/runtime-player/src/main/input-session-state.test.ts`

## Findings

No blocking test-adequacy findings.

The focused Domain A tests cover the minimum deterministic behaviors required by the Wave8 plan: Control close-hide vs explicit quit, Show Control restoration, explicit quit flush operations, tray/menu action wiring, Focus Stage safety, and the Disable Click-through placeholder/hook behavior.

Non-blocking integration coverage gap: `runtime-player-main.ts` wiring is source-checked but not directly protected by a main-level Electron app harness. The actual wiring is small and readable: quit flush owners are passed at `apps/runtime-player/src/main/runtime-player-main.ts:113`, recovery/tray actions at `apps/runtime-player/src/main/runtime-player-main.ts:126`, `before-quit` at `apps/runtime-player/src/main/runtime-player-main.ts:147`, and `window-all-closed` at `apps/runtime-player/src/main/runtime-player-main.ts:156`. The extracted modules are covered, but a later Domain D/final integration pass should still manually or automatically smoke the real Electron event path.

## Coverage Mapping

- Control close-hide vs explicit quit is covered by `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts:13` and `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts:27`, against source behavior in `apps/runtime-player/src/main/window-management/control-window-recovery.ts:80`.
- Show Control restores minimized windows, calls show/focus, and avoids destroyed windows in `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts:48` and `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts:61`, against shared helper behavior in `apps/runtime-player/src/main/window-management/control-window-recovery.ts:109`.
- Focus Stage uses the same destroyed/minimized-safe helper in `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts:74`, against `apps/runtime-player/src/main/window-management/control-window-recovery.ts:103`.
- Explicit Quit triggers the flush path for input disconnect, Model Mapping Profile flush, and Window State flush in `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts:96`; failure-tolerant continuation is covered at `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts:128`. The implementation uses `Promise.allSettled` at `apps/runtime-player/src/main/window-management/control-window-recovery.ts:71`.
- Tray/menu action wiring is covered by `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts:15`, application menu shape by `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts:52`, and tray registration/click/refresh/dispose by `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts:72`.
- Disable Click-through default disabled/no-op behavior is covered at `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts:15`; enabled hook behavior is covered at `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts:33`, against source behavior in `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.ts:108`.
- No `pnpm install` was run during this review.

## Commands Run

| Command | Outcome |
|---|---|
| `pnpm.cmd exec vitest run -c vitest.config.ts src/main/window-management/control-window-recovery.test.ts src/main/window-management/runtime-player-tray-menu.test.ts` from `apps/runtime-player` | Sandboxed run failed during Vite/esbuild config load with `spawn EPERM`. |
| Same Vitest command, rerun with escalation | Passed: 2 files / 11 tests. |
| `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck` | First run failed while concurrent current-workspace Runtime Export contract files were in an inconsistent state, with errors outside Domain A at `apps/runtime-player/src/main/runtime-export-loader/runtime-export-session-state.ts:23`, `:40`, `:60`, and `apps/runtime-player/src/preload/runtime-player-bridge.ts:50`. Immediate rerun after re-reading those files passed. Final observed result: pass. |
| `git diff --check -- apps/runtime-player/src/main/runtime-player-main.ts apps/runtime-player/src/main/window-management/control-window-recovery.ts apps/runtime-player/src/main/window-management/runtime-player-tray-menu.ts apps/runtime-player/src/main/window-management/control-window-recovery.test.ts apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts` | Passed with only the expected LF-to-CRLF working-copy warning for `runtime-player-main.ts`. |
| `git status --short -uall` | Confirmed Domain A files plus other current workspace changes are present; no package install artifacts were created by this review. |

## Remaining Manual Verification Gaps

- Real Electron close/hide/show behavior was not exercised in a running app.
- Windows tray icon, tray context menu, and application menu were not manually exercised; unit coverage uses an injected fake Electron adapter.
- Explicit Quit from the real tray/menu should be manually checked with pending input disconnect, Model Mapping Profile save, and Window State save work.
- Stage minimized/destroyed focus behavior is unit/source checked, but no real Stage destroyed/minimized Electron scenario was manually run.
- The current Disable Click-through action is only a placeholder/hook. Domain C must verify the real click-through disable path once click-through is implemented.

## User Decision Points

None for Domain A test adequacy.
