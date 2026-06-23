# Runtime Player Wave8 Reports Map

> Runtime Player Wave8: Broadcast Stage Setup v0 のdomain report / final integration report入口。

## Files

| Path | Status | Content |
|---|---|---|
| [runtime-player-wave8-domain-a-control-recovery-tray-explicit-quit-report.md](runtime-player-wave8-domain-a-control-recovery-tray-explicit-quit-report.md) | Pass | Control Window close-hide, tray/application menu recovery, explicit quit controller, shutdown flush path |
| [runtime-player-wave8-domain-b-runtime-export-auto-restore-report.md](runtime-player-wave8-domain-b-runtime-export-auto-restore-report.md) | Pass | Startup State store, last successful Runtime Export path, startup/retry restore, non-crashing invalid path status |
| [runtime-player-wave8-domain-c-stage-capture-controls-report.md](runtime-player-wave8-domain-c-stage-capture-controls-report.md) | Pass | Stage Arrange mode, click-through, always-on-top, Capture Target checklist, stable Stage title |
| [runtime-player-wave8-final-integration-report.md](runtime-player-wave8-final-integration-report.md) | Pass | A/B/C coexistence, docs/map alignment, verification results, manual Electron/OBS verification remaining |

## Implementation Facts

- Runtime Export startup restore uses `<electron userData>/startup-state/runtime-player-startup.json` and does not auto-connect Input Source.
- Control Window close hides the window; tray/application menu can show Control, focus Stage, disable click-through, and quit.
- Explicit Quit flushes input disconnect, Model Mapping Profile, and Window State through the quit controller.
- Stage Arrange mode is temporary and disables normal Stage pan/zoom while active.
- click-through starts Off on startup, is not persisted, and has Control plus tray/application menu recovery.
- always-on-top defaults Off and is persisted in Window State as `stageEnvironment.alwaysOnTop`.
- Stage remains model-only in normal mode.
- Capture Target checklist is local readiness only and does not claim OBS integration/readiness.
- Spout sender, OBS automation/source creation, Input Source auto-connect, Stage Motion, and near/far response remain out of scope.

## Remaining Manual Verification

- Control close hides/reopens from tray/menu.
- Explicit Quit flushes and exits.
- Runtime Export valid/invalid startup restore.
- Stage Arrange drag handle moves the native Stage Window.
- Click-through toggle and tray recovery.
- Always-on-top toggle and persistence.
- Capture Target checklist and Copy Window Title.
- OBS Window Capture title/alpha smoke check.
