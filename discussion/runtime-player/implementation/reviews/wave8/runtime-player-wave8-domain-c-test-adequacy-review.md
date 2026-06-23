# Runtime Player Wave8 Domain C Test Adequacy Review

## Verdict

pass

Wave8 Domain C has adequate focused automated coverage for the deterministic parts of Stage capture controls: bridge state/actions, click-through recovery state, preload/channel contracts, always-on-top window state persistence, arrange overlay rendering, pan/zoom isolation during arrange mode, and Stage boundary constraints.

No blocking or needs-changes findings were found. Electron-native behavior still needs manual verification, listed below.

## Basis Used

- `discussion/runtime-player/implementation/orchestration/player-wave8-plan.md`
- `discussion/runtime-player/screens/broadcast-stage-setup-v0.md`
- `discussion/runtime-player/research/broadcast-capture-paths.md`
- `discussion/runtime-player/implementation/waves/wave8/runtime-player-wave8-domain-a-control-recovery-tray-explicit-quit-report.md`
- Reviewed target tests:
  - `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`
  - `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts`
  - `apps/runtime-player/src/main/window-management/browser-window-options.test.ts`
  - `apps/runtime-player/src/main/window-state/window-state-controller.test.ts`
  - `apps/runtime-player/src/main/window-state/window-state-store.test.ts`
  - `apps/runtime-player/src/preload/stage-view-bridge-channels.test.ts`
  - `apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts`
  - `apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts`
  - `apps/runtime-player/src/stage/stage-window-app.test.ts`
  - `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.interaction.test.ts`
  - `apps/runtime-player/src/runtime-player-boundary.test.ts`
- Reviewed related source files under `apps/runtime-player/src/main`, `apps/runtime-player/src/preload`, `apps/runtime-player/src/stage`, `apps/runtime-player/src/control`, and `apps/runtime-player/src/styles`.

## Findings

No blocking findings.

## Coverage Assessment

- Stage-view bridge handlers are covered for arrange mode, click-through, always-on-top, and copy title actions. The tests assert startup click-through Off plus persisted always-on-top application at `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:131`, arrange state publication at `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:150`, click-through applying `setIgnoreMouseEvents(true)` and disabling arrange mode at `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:179`, tray/menu recovery disabling click-through at `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:206`, always-on-top persistence at `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:221`, and stable window title copy at `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:234`.
- The implementation initializes click-through Off regardless of persisted state and applies persisted always-on-top at registration in `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:68`. Capture state exposes `stageUi` as `"arrange-overlay-visible"` only while arrange mode is active in `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:233`.
- Tray/menu recovery is covered with a refreshable menu and real enabled-state hook. `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts:33` proves `Disable Click-through` is enabled only from the recovery hook, and `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts:72` proves `registration.refresh()` rebuilds tray/application menu state. Runtime wiring connects Domain C state to Domain A recovery via `onCaptureStateChanged: () => trayMenu?.refresh()` and `disableClickThrough: () => stageViewBridge.disableClickThrough()` in `apps/runtime-player/src/main/runtime-player-main.ts:51` and `apps/runtime-player/src/main/runtime-player-main.ts:146`.
- Preload/channel contract coverage is adequate for both Control and Stage bridges. Channel constants are asserted in `apps/runtime-player/src/preload/stage-view-bridge-channels.test.ts:6`; Control stageView calls map to IPC channels in `apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts:37`; Stage reporter calls and `arrangeStateChanged` subscription are covered in `apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts:37` and `apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts:104`.
- Window State coverage proves always-on-top default, persistence, loading, and invalid fallback. Defaults are asserted at `apps/runtime-player/src/main/window-state/window-state-store.test.ts:14`, save/load at `apps/runtime-player/src/main/window-state/window-state-store.test.ts:44` and `apps/runtime-player/src/main/window-state/window-state-store.test.ts:102`, corrupt JSON fallback at `apps/runtime-player/src/main/window-state/window-state-store.test.ts:149`, invalid always-on-top reset at `apps/runtime-player/src/main/window-state/window-state-store.test.ts:169`, and controller persistence at `apps/runtime-player/src/main/window-state/window-state-controller.test.ts:172`.
- Stage arrange overlay coverage is adequate for deterministic rendering: normal mode renders no overlay in `apps/runtime-player/src/stage/stage-window-app.test.ts:8`, arrange mode renders only overlay/handle and no button at `apps/runtime-player/src/stage/stage-window-app.test.ts:16`, and the production component applies arrange state to renderer interaction state in `apps/runtime-player/src/stage/stage-window-app.tsx:58`.
- Pan/zoom isolation during arrange mode is covered through `shouldHandleStageViewInteraction`. `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.interaction.test.ts:16` proves interactions are blocked when arrange mode disables view interaction, and the renderer applies that guard to wheel/pointer handlers in `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:299` and `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:320`.
- Boundary coverage still protects the Stage preload and Stage production surface. `apps/runtime-player/src/runtime-player-boundary.test.ts:26` blocks setup/debug controls in Stage production files, `apps/runtime-player/src/runtime-player-boundary.test.ts:38` blocks raw tracking terms, and `apps/runtime-player/src/runtime-player-boundary.test.ts:49` verifies Stage uses the narrow `runtimePlayerStage` bridge rather than the Control API. The Stage bridge contract exposes runtime export payload, live parameters, and limited stageView reporter APIs, not Control input/profile/mapping APIs, at `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts:22`.

## Commands Run

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/main/stage-view-bridge-handlers.test.ts src/main/window-management/runtime-player-tray-menu.test.ts src/main/window-management/browser-window-options.test.ts src/main/window-state/window-state-controller.test.ts src/main/window-state/window-state-store.test.ts src/preload/stage-view-bridge-channels.test.ts src/preload/runtime-player-bridge.stage-view.test.ts src/preload/runtime-player-stage-bridge.test.ts src/stage/stage-window-app.test.ts src/stage/stage-renderer/static-stage-canvas-renderer.interaction.test.ts src/runtime-player-boundary.test.ts`
  - Passed: 11 files, 46 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Passed.

`pnpm install` was not run.

## Remaining Test Gaps / Manual Checks

These are not blockers for Domain C test adequacy because they depend on Electron/native window behavior or external capture tooling:

- Manual Electron check: enable Arrange Stage and confirm the CSS draggable handle actually moves the frameless native Stage Window on Windows. The automated test proves overlay rendering and `app-region: drag` exists in `apps/runtime-player/src/styles/global.css:65`, but not OS-level drag behavior.
- Manual Electron check: enable click-through from Control, confirm Stage ignores mouse input, then disable it from tray/application menu and confirm Control state/menu state refreshes.
- Manual Electron check: toggle always-on-top and confirm native z-order behavior, including startup restore from persisted `stageEnvironment.alwaysOnTop`.
- Manual capture-adjacent check: confirm OBS or similar Window Capture can select the stable `Runtime Player Stage` title and that the Capture Target checklist remains local readiness only, not OBS automation/readiness.

## User Decision Points

None for Domain C test adequacy.
