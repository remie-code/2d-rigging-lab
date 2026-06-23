# Runtime Player Wave7 Domain B Design / Development Compliance Review

- 判定: `pass`
- Target: `runtime-player-wave7-stage-window-state-auto-save`
- Review lane: Design / Development Compliance Review
- Reviewer: Review-Sylph
- Date: 2026-06-23

## Scope Reviewed

Basis docs:

- `discussion/runtime-player/implementation/orchestration/player-wave7-plan.md`
- `discussion/runtime-player/screens/control-window-screen-structure.md`
- `discussion/runtime-player/screens/tracking-setup-live-mapping.md`
- `discussion/runtime-player/backlog/runtime-player-backlog.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`

Source and changed areas inspected directly:

- Control Window shell/app/stage page: `apps/runtime-player/src/control/control-window-app.tsx`, `apps/runtime-player/src/control/control-window-shell.tsx`, `apps/runtime-player/src/control/stage-page.tsx`
- Main process Stage/window-state wiring: `apps/runtime-player/src/main/runtime-player-main.ts`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts`, `apps/runtime-player/src/main/window-management/browser-window-options.ts`, `apps/runtime-player/src/main/window-management/runtime-player-windows.ts`, `apps/runtime-player/src/main/window-state/window-state-controller.ts`, `apps/runtime-player/src/main/window-state/window-state-document.ts`, `apps/runtime-player/src/main/window-state/window-state-store.ts`
- Preload contracts/bridges/channels: `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`, `apps/runtime-player/src/preload/runtime-player-bridge.ts`, `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts`, `apps/runtime-player/src/preload/runtime-player-stage-bridge.ts`, `apps/runtime-player/src/preload/stage-view-bridge-channels.ts`
- Stage renderer/app transform path: `apps/runtime-player/src/stage/stage-window-app.tsx`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`, `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.ts`
- Shared Domain A touchpoints were spot-checked where they share `runtime-player-main`, Control app, bridge contracts, and `userData` persistence paths.

## Findings

### Blocking

None.

### Needs Changes

None.

### Low / Integration Cleanup

- Control preload still exposes Stage reporter-only and legacy reset surfaces that the Control UI does not currently use. `RuntimePlayerStageViewApi` includes `reportStatus`, `reportViewTransform`, `getViewTransform`, `onApplyViewTransformRequested`, and `onResetViewRequested` in `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts:123`; the Control preload exposes them in `apps/runtime-player/src/preload/runtime-player-bridge.ts:145`. The Stage preload has the narrower reporter contract in `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts:21`. This is not a blocking safety issue because the payloads are typed/normalized and no raw Electron object is exposed, but Domain C should consider splitting Control-only commands from Stage-only reporter APIs and removing the stale reset-request alias. Related legacy no-op path: `apps/runtime-player/src/main/placeholder-bridge-handlers.ts:43`.

## Design / Development Compliance Notes

Pass.

- Main owns persistence and debounced disk writes. Startup loads `RuntimePlayerWindowStateStore`, builds a `RuntimePlayerWindowStateController`, restores windows before load/show, and flushes on quit in `apps/runtime-player/src/main/runtime-player-main.ts:23`. The controller normalizes bounds/transform, debounces saves, reports save status, and catches write failures in `apps/runtime-player/src/main/window-state/window-state-controller.ts:74` and `apps/runtime-player/src/main/window-state/window-state-controller.ts:137`.
- Window State storage is separate from Model Mapping Profile storage. Window state writes to `<userData>/window-state/runtime-player.json` in `apps/runtime-player/src/main/window-state/window-state-store.ts:42`; Model Mapping Profile writes under `<userData>/model-mapping-profiles` in `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.ts:47`.
- Stage renderer owns rendering and transform application. Stored transform is read/applied by Stage on init in `apps/runtime-player/src/stage/stage-window-app.tsx:240`; reset/center requests are applied by the Stage renderer via `onApplyViewTransformRequested` in `apps/runtime-player/src/stage/stage-window-app.tsx:113`. Wheel zoom and drag pan remain renderer-local interactions that report only serialized transform back to main in `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:289` and `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:323`.
- Stage page is compact and operational. It adds Stage Window status/bounds, view zoom/pan, Focus Stage, Reset View, Center Model, and autosave status without OBS/broadcast/click-through/always-on-top controls in `apps/runtime-player/src/control/stage-page.tsx:31`.
- Bounds restore accounts for defaults, minimums, and partial persisted state. BrowserWindow options merge restored bounds with default minimums in `apps/runtime-player/src/main/window-management/browser-window-options.ts:64`; partial state parsing preserves valid sections and ignores invalid ones in `apps/runtime-player/src/main/window-state/window-state-document.ts:100` and `apps/runtime-player/src/main/window-state/window-state-document.ts:182`.
- Failure modes are visible without blocking model operation. Read/parse failures fall back to default state with warnings in `apps/runtime-player/src/main/window-state/window-state-store.ts:81`; save failures become `save-failed` with warning text in `apps/runtime-player/src/main/window-state/window-state-controller.ts:140`; Stage page renders persistence warnings in `apps/runtime-player/src/control/stage-page.tsx:102`.
- Stage remains model-only. Stage UI renders only the canvas shell in `apps/runtime-player/src/stage/stage-window-app.tsx:161`; live operation still uses sanitized live parameter frames and `parameterValues` in `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:126` and `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:244`. No raw tracking diagnostics or setup UI were added to Stage.

## Shared-File / Integration Risks

- Shared files contain both Domain A and Domain B changes, especially `runtime-player-main.ts`, `control-window-app.tsx`, and preload contracts. The visible integration keeps ownership separate: Domain A owns Model Mapping Profile and Mapping page status/actions, while Domain B owns window-state and Stage page/state actions.
- `before-quit` now flushes input disconnect, mapping profile save, and window-state save together in `apps/runtime-player/src/main/runtime-player-main.ts:113`. This is architecturally consistent, but manual Electron verification should confirm the app exits normally after pending saves.
- Initial `attachRuntimePlayerWindowStateTracking` records current bounds immediately in `apps/runtime-player/src/main/window-management/runtime-player-windows.ts:58`. This is acceptable for creating the first window-state file, but Domain C/manual testing should verify it does not create surprising save-status noise on startup.
- Display topology/offscreen restore is not explicitly clamped to current monitor work areas. The implementation enforces minimum size but restores `x/y` as persisted. Treat this as a manual/platform verification gap rather than a Wave7 Domain B blocker.

## Residual Risks / Manual Verification Gaps

- I did not run Electron manually. Gnome reported focused Vitest, runtime-player typecheck, boundary test, and `git diff --check` pass; this review inspected source/tests/docs directly.
- Manual checks still needed: move/resize Stage, restart, confirm bounds restore; pan/zoom Stage, restart, confirm transform restore; Focus Stage; Reset View; Center Model preserving zoom; quit with pending debounce saves.
- Transparent/frameless Stage behavior across OS/display setups remains a platform risk, especially multi-monitor and disconnected-monitor restore.
- No screenshot or pixel-level verification was performed for Stage framing after restored pan/zoom.

## Recommendation For Orch-Sylph

Accept Domain B as `pass` for design/development compliance and proceed toward final integration. Ask Domain C to consider tightening the Control/Stage bridge surface and to keep manual Electron verification explicit in closeout.
