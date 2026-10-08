# Runtime Player Wave8 Domain A Design / Development Re-review

> Review-Sylph Loop 2 re-review. Source files were inspected read-only; only this report was written.

## Verdict

`pass`

Loop 1の `needs_changes` 2件は、現行source/diff上で解消済み。新しいDomain A design/development blocking findingは見つからなかった。

## Basis Read

- `discussion/runtime-player/implementation/orchestration/player-wave8-plan.md`
- `discussion/runtime-player/screens/broadcast-stage-setup-v0.md`
- `discussion/runtime-player/research/broadcast-capture-paths.md`
- `discussion/runtime-player/screens/control-window-screen-structure.md`
- `discussion/runtime-player/screens/tracking-setup-live-mapping.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- Previous report: `discussion/runtime-player/implementation/reviews/wave8/runtime-player-wave8-domain-a-design-development-review.md`

## Source Inspected

- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/window-management/control-window-recovery.ts`
- `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.ts`
- `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts`
- `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts`

## Loop 1 Finding Status

### 1. Explicit Quit startup ordering race

Status: resolved

Evidence:

- `apps/runtime-player/src/main/runtime-player-main.ts:118` creates `RuntimePlayerQuitController`.
- `apps/runtime-player/src/main/runtime-player-main.ts:131` registers `app.on("before-quit", ...)`.
- `apps/runtime-player/src/main/runtime-player-main.ts:138` registers tray/menu actions after the `before-quit` handler is installed.
- `apps/runtime-player/src/main/runtime-player-main.ts:145` routes tray/menu Quit through `quitController.requestQuit()`.
- `apps/runtime-player/src/main/runtime-player-main.ts:149` awaits `loadRuntimePlayerWindows(windows)` only after quit handling and tray/menu registration order is safe.

The very early explicit Quit path exposed by tray/menu now reaches the existing `RuntimePlayerQuitController.handleBeforeQuit()` flush path for input disconnect, Model Mapping Profile flush, and Window State flush.

The concurrent Domain B startup-state wiring in `runtime-player-main.ts` was observed but does not conflict with Domain A lifecycle/tray/quit behavior.

### 2. Tray icon SVG data URL / missing empty-image guard

Status: resolved

Evidence:

- `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.ts:47` defines a `data:image/png;base64,...` tray icon instead of the previous SVG data URL.
- `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.ts:55` creates the native image from that PNG data URL.
- `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.ts:59` checks `trayIcon.isEmpty()`.
- `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.ts:63` creates the `Tray` only after the empty-image guard passes.
- `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts:103` verifies the PNG data URL.
- `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts:124` verifies an empty tray icon is rejected before tray/menu recovery is exposed.

This removes the prior Windows-first risk from relying on SVG parsing in Electron tray recovery and adds a direct guard for native-image creation failure.

## Remaining Findings

None.

## Verification Performed

- `pnpm.cmd exec vitest run apps/runtime-player/src/main/window-management/control-window-recovery.test.ts apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts`
  - Result: passed, 2 files / 12 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Result: passed.
- `git diff --check -- apps/runtime-player/src/main/runtime-player-main.ts apps/runtime-player/src/main/window-management/control-window-recovery.ts apps/runtime-player/src/main/window-management/runtime-player-tray-menu.ts apps/runtime-player/src/main/window-management/control-window-recovery.test.ts apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts`
  - Result: passed; Git reported only the existing LF-to-CRLF working-copy warning for `runtime-player-main.ts`.
- `rg -n "[ \t]+$" ...Domain A files...`
  - Result: no trailing-whitespace matches.

## Remaining Manual Verification Gaps

- Windows Electron tray icon visibility and context menu behavior in a real dev/packaged app.
- Control Window close -> hide -> tray/application-menu Show Control recovery in a real Electron session.
- Explicit tray/application-menu Quit in the real app, confirming input disconnect and both flushes happen before final quit.
- Focus Stage from tray/menu against minimized and destroyed Stage windows in a real Electron session.
- Domain C must refresh tray/menu enabled state when click-through is implemented.

## User Decision Points

None.
