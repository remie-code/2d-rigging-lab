# Runtime Player Wave11 Domain B Report: Stage Motion Core / Persistence / Transport

- verdict: pass
- domain: runtime-player-wave11-stage-motion-core-persistence-transport
- loop count: 1 implementation loop, 1 review loop, 0 fix loops
- implementation agent: Gnome
- review agent: Review-Sylph
- review report: `discussion/runtime-player/implementation/reviews/wave11/runtime-player-wave11-domain-b-stage-motion-core-persistence-transport-review.md`

## Files Changed

Domain B source/test changes:

- `apps/runtime-player/src/control/stage-page.browser-source.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-server.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/stage-motion/stage-motion-input.ts`
- `apps/runtime-player/src/main/stage-motion/stage-motion-runtime.ts`
- `apps/runtime-player/src/main/stage-motion/stage-motion-runtime.test.ts`
- `apps/runtime-player/src/main/stage-motion/stage-motion-transform.ts`
- `apps/runtime-player/src/main/stage-motion/stage-motion-transform.test.ts`
- `apps/runtime-player/src/main/stage-motion/stage-motion-transport.ts`
- `apps/runtime-player/src/main/stage-motion/stage-motion-transport.test.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`
- `apps/runtime-player/src/main/window-state/window-state-controller.ts`
- `apps/runtime-player/src/main/window-state/window-state-controller.test.ts`
- `apps/runtime-player/src/main/window-state/window-state-document.ts`
- `apps/runtime-player/src/main/window-state/window-state-stage-motion-settings.ts`
- `apps/runtime-player/src/main/window-state/window-state-store.test.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge.ts`
- `apps/runtime-player/src/preload/stage-view-bridge-channels.ts`
- `apps/runtime-player/src/preload/stage-view-bridge-channels.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts`
- `apps/runtime-player/src/stage/stage-window-app.tsx`
- `discussion/runtime-player/implementation/waves/wave11/runtime-player-wave11-domain-b-stage-motion-core-persistence-transport-report.md`

Pre-existing Domain A / discussion work remains in the worktree and was not reverted.

## Implementation Summary

- Added persisted Stage Motion settings to Window State with defaults:
  - `enabled: false`
  - horizontal strength `80 px`, limit `120 px`, invert `false`
  - scale strength `0.06`, limit `0.1`, invert `false`
  - dead zone `0.03`
  - reaction `8`
- Added a Stage View bridge surface for Domain C:
  - `RuntimePlayerStageStateSnapshot.stageMotion.settings`
  - `stageView.updateStageMotionSettings(update)`
- Added focused Stage Motion modules:
  - calibrated head-position horizontal input normalization
  - pure transform composition and smoothing
  - runtime state holder for transient smoothed offset only in memory
  - Browser Source/native transport helper
- Wired main runtime updates so live frames compute composed Stage transform from saved base Stage view transform, active Input Profile calibration, tracking frame, session neutral, settings, and frame elapsed time.
- Browser Source receives only `stageDisplayState.stageView.transform`, the existing sanitized transform payload.
- Native Stage preview receives a separate transient display transform channel so live offsets do not overwrite the saved manual base transform.
- Browser Source Stage display status notifications can be sampled for live updates while WebSocket transform messages still broadcast every update.

## Required Behavior Trace

1. Stage Motion settings with defaults: implemented in `window-state-stage-motion-settings.ts`.
2. Persistence: settings are saved in Window State under `stageMotion.settings`; missing older files load defaults.
3. Main-owned computation: `runtime-player-main.ts` drives `RuntimePlayerStageMotionRuntime` from base transform, tracking frame, active Input Profile, session neutral, settings, and timestamps.
4. Dead zone / invert / strength / limit / reaction: covered by `stage-motion-transform.ts`.
5. Browser Source composed transform only: `stage-motion-transport.ts` and Browser Source session tests send only Stage display transform.
6. Native preview same composed transform when active: Stage Window receives `applyDisplayViewTransformRequested` and renderer applies a transient display transform.
7. Browser Source continues while native preview suspended: transport always publishes Browser Source; native delivery is gated separately.
8. Control churn avoided: live Stage display status notifications use sampled Browser Source session updates; Window State is not updated every frame.
9. Manual pan/zoom remains base transform: saved `stageView.transform` remains unchanged; display transform override is separate and not reported as view changes.
10. Live offset/smoothed state not saved: runtime smoothing state exists only in `RuntimePlayerStageMotionRuntime`; Window State stores settings only.
11. Model Mapping Profile unchanged: no Model Mapping Profile files were modified by Domain B.
12. Raw tracking/debug data not exposed to Browser Source: Browser Source transport payload remains `stageDisplayState` with bounds + transform only.

## Tests / Commands

- `pnpm.cmd run typecheck` from `apps/runtime-player`: passed.
- Focused Vitest from `apps/runtime-player`: initial sandbox run failed with `spawn EPERM`; rerun with elevated permissions passed, 12 files / 49 tests.
- `node scripts/check-source-organization.mjs`: passed.
- `pnpm.cmd run test:unit` from `apps/runtime-player`: final run passed, 68 files / 285 tests.
- `git diff --check -- apps/runtime-player/src discussion/runtime-player/implementation/waves/wave11`: passed; Git printed CRLF normalization warnings only.
- PowerShell trailing-whitespace scan for new Domain B files: passed.
- `pnpm install`: not run.

## Source Organization Notes

- No `index.ts` implementation logic was added.
- Stage Motion runtime logic is split by responsibility under `apps/runtime-player/src/main/stage-motion/`.
- Window State Stage Motion settings normalization lives under `apps/runtime-player/src/main/window-state/` because persistence owns default/save/load semantics and the runtime-player boundary guard forbids main/window-state importing sibling paths that match Stage renderer/UI boundaries.
- No source organization exception is requested.

## Risks / User Decision Points

- Review-Sylph verdict: pass.
- Blocking or major review findings: none.
- Non-blocking review note: `startRuntimePlayerMain` orchestration is not directly unit-tested; lower-level Stage Motion math/runtime/transport/session/persistence/native override paths are covered.
- Real-device tuning for horizontal strength, depth scale, dead zone, and reaction still needs manual validation.
- Stage Motion defaults are conservative: settings exist and persist, but `enabled` defaults to `false` so Domain C UI must enable it explicitly.
- No user/product decision is required for Domain C from Domain B.

## Domain C Gate

Domain C can start.

The bridge/settings surface is stable enough for UI work:

- read current settings from `stageView.getState().stageMotion.settings`
- update with `stageView.updateStageMotionSettings(partialUpdate)`
- settings auto-save through Window State
- live transform transport and Browser Source sampling are already implemented behind the bridge
