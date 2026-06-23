# Runtime Player Wave7 Reports Map

> Runtime Player Wave7: Persistent Mapping + Stage State v0 のdomain report / final integration report入口。

## Files

| Path | Status | Content |
|---|---|---|
| [runtime-player-wave7-domain-a-model-mapping-profile-auto-save-report.md](runtime-player-wave7-domain-a-model-mapping-profile-auto-save-report.md) | Pass | Model Mapping Profile auto-save/restore、Runtime Export identity、Mapping/Profile UI status、focused tests |
| [runtime-player-wave7-domain-b-stage-window-state-auto-save-report.md](runtime-player-wave7-domain-b-stage-window-state-auto-save-report.md) | Pass | Stage page v0、Stage/Control bounds persistence、Stage view pan/zoom persistence、focused tests |
| [runtime-player-wave7-final-integration-report.md](runtime-player-wave7-final-integration-report.md) | Pass | Domain A/B coexistence、source/docs checks、verification結果、manual Electron verification remaining |

## Implementation Facts

- Model Mapping Profile uses `<electron userData>/model-mapping-profiles/<safe-package-id>/<fingerprint>.json`.
- Window State uses `<electron userData>/window-state/runtime-player.json`.
- Mapping/Profile persistence and Window State persistence are separate stores with separate schemas.
- Stage remains model-only and receives Runtime Export payloads plus sanitized live parameter frames with `parameterValues`.
- Control input diagnostics throttling remains `RuntimePlayerInputDiagnosticsThrottle` with default `100ms`; Stage live motion does not depend on the throttled diagnostics stream.

## Remaining Manual Verification

- Mapping/Body Follow tune -> restart/reopen same Runtime Export -> restore.
- Stage move/resize -> restart -> restore.
- Stage pan/zoom -> restart -> restore.
- Stage page Focus/Reset/Center.
- Real iFacialMocap tracking after profile restore.
