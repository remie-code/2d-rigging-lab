# Runtime Player Wave8 Domain C Design/Development Compliance Review

## Verdict

pass

No design/development compliance findings require source changes before Domain C can proceed to integration.

## Basis Used

- `discussion/runtime-player/implementation/orchestration/player-wave8-plan.md`
- `discussion/runtime-player/screens/broadcast-stage-setup-v0.md`
- `discussion/runtime-player/research/broadcast-capture-paths.md`
- `discussion/runtime-player/screens/control-window-screen-structure.md`
- `discussion/runtime-player/screens/tracking-setup-live-mapping.md`
- `discussion/runtime-player/implementation/waves/wave8/runtime-player-wave8-domain-a-control-recovery-tray-explicit-quit-report.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Implementation Reviewed

- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/stage-page.tsx`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.ts`
- `apps/runtime-player/src/main/window-management/browser-window-options.ts`
- `apps/runtime-player/src/main/window-management/runtime-player-windows.ts`
- `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.ts`
- `apps/runtime-player/src/main/window-state/window-state-controller.ts`
- `apps/runtime-player/src/main/window-state/window-state-document.ts`
- `apps/runtime-player/src/preload/stage-view-bridge-channels.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts`
- `apps/runtime-player/src/stage/stage-window-app.tsx`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/styles/global.css`
- Related focused tests for stage bridge, preload contracts, window state, boundary rules, tray/menu, browser-window options, Stage overlay, and Stage renderer interaction.

## Findings

No blocking or non-blocking source-change findings.

## Compliance Notes

### Process Boundary

- Electron API use remains in main/preload. Main owns `ipcMain`, `BrowserWindow`, and clipboard use in `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:1`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:405`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:421`, and `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:432`.
- Control and Stage renderer files do not import Electron/Node directly. The repository boundary test covers this at `apps/runtime-player/src/runtime-player-boundary.test.ts:10`.
- Main does not import React UI modules; the boundary test covers this at `apps/runtime-player/src/runtime-player-boundary.test.ts:89`.

### Stage Preload Boundary

- Stage preload exposes only Runtime Export payload access, sanitized live parameter frames, and Stage view reporting/arrange-state reads in `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts:12` through `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts:43`.
- Stage preload does not expose Control APIs, raw tracking, diagnostics copy, model mapping, or click-through/always-on-top setters. The boundary test checks this at `apps/runtime-player/src/runtime-player-boundary.test.ts:49` through `apps/runtime-player/src/runtime-player-boundary.test.ts:87`.

### State Model

- Arrange mode and click-through are transient in-memory capture state initialized off at `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:39` through `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:42`; click-through is explicitly applied off at startup at `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:68`.
- Always-on-top is persisted as `stageEnvironment.alwaysOnTop` with default `false` at `apps/runtime-player/src/main/window-state/window-state-document.ts:26` through `apps/runtime-player/src/main/window-state/window-state-document.ts:28` and `apps/runtime-player/src/main/window-state/window-state-document.ts:76` through `apps/runtime-player/src/main/window-state/window-state-document.ts:78`.
- Invalid persisted always-on-top values are normalized to `false` and reported as warnings at `apps/runtime-player/src/main/window-state/window-state-document.ts:187` through `apps/runtime-player/src/main/window-state/window-state-document.ts:217`.

### Tray/Menu Refresh

- Domain C wires Domain A recovery by passing `disableClickThrough` into tray/menu registration at `apps/runtime-player/src/main/runtime-player-main.ts:146` through `apps/runtime-player/src/main/runtime-player-main.ts:158`.
- Capture state changes call the tray/menu refresh hook through `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:62` through `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:66`.
- Tray and app menu disable click-through only when active, and re-read state at click time at `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.ts:94` through `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.ts:116`.

### Stage Title

- The shared TS title constant is `runtimePlayerStageWindowTitle` at `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts:10`.
- BrowserWindow creation uses the constant at `apps/runtime-player/src/main/window-management/browser-window-options.ts:54`.
- Capture status and Copy Window Title use the same constant at `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:244` and `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:405`.
- Static HTML also has a matching document title at `apps/runtime-player/src/stage/index.html:9`; this is consistent now, but future title changes should update both the TS constant and static HTML.

### Arrange Overlay / Native Drag Region

- Stage initializes arrange mode off at `apps/runtime-player/src/stage/stage-window-app.tsx:27`.
- Arrange state disables normal Stage pan/zoom through `renderer.setViewInteractionEnabled(!state.arrangeModeEnabled)` at `apps/runtime-player/src/stage/stage-window-app.tsx:58` through `apps/runtime-player/src/stage/stage-window-app.tsx:65`.
- The overlay is rendered only while arrange mode is enabled at `apps/runtime-player/src/stage/stage-window-app.tsx:200` through `apps/runtime-player/src/stage/stage-window-app.tsx:216`.
- Normal canvas is explicitly no-drag, overlay is no-drag, and only the handle is native drag at `apps/runtime-player/src/styles/global.css:43` through `apps/runtime-player/src/styles/global.css:80`.
- Stage renderer interaction guard requires `viewInteractionEnabled` at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:394` through `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:403`.

### UI Contract

- Stage page exposes the required local Capture Target checklist without claiming OBS readiness at `apps/runtime-player/src/control/stage-page.tsx:134` through `apps/runtime-player/src/control/stage-page.tsx:198`.
- Runtime Export startup restore remains represented on Stage page at `apps/runtime-player/src/control/stage-page.tsx:221` through `apps/runtime-player/src/control/stage-page.tsx:263`.
- Boolean IPC payloads are rejected unless they are real booleans at `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:435` through `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:441`.

## Source Organization Notes

- `apps/runtime-player/src/main/stage-view-bridge-handlers.ts` is now 454 lines. It is still cohesive enough for this wave because it owns the Stage view bridge boundary, Stage state snapshot, capture controls, and native Stage window effects in one IPC registration surface.
- This is not a blocking source organization issue, and `node scripts/check-source-organization.mjs` passed.
- Recommendation for future waves: if more broadcast modes or Stage native controls are added, split capture-specific state/actions into a named main-side module, for example a Stage capture controller, while keeping `stage-view-bridge-handlers.ts` as IPC registration/coordinator.

## Verification Performed

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/main/stage-view-bridge-handlers.test.ts src/preload/runtime-player-bridge.stage-view.test.ts src/preload/runtime-player-stage-bridge.test.ts src/preload/stage-view-bridge-channels.test.ts src/stage/stage-window-app.test.ts src/stage/stage-renderer/static-stage-canvas-renderer.interaction.test.ts src/main/window-state/window-state-controller.test.ts src/main/window-state/window-state-store.test.ts src/runtime-player-boundary.test.ts src/main/window-management/runtime-player-tray-menu.test.ts src/main/window-management/browser-window-options.test.ts`
  - Passed: 11 test files, 46 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- ...Domain C reviewed files...`
  - Passed; output only contained LF-to-CRLF working-copy warnings.
- Static searches confirmed no renderer Electron/Node imports and no forbidden Stage preload raw tracking/debug/control API exposure.

## Remaining Risks / Manual Checks

- Manual Electron verification was not run in this review lane.
- Domain D should manually verify on Windows:
  - Arrange Stage handle moves the frameless native Stage Window.
  - Arrange overlay disappears when arrange mode is disabled.
  - Normal Stage mode remains model-only and pan/zoom works after leaving arrange mode.
  - Click-through can be enabled from Control and disabled from tray/application menu even if Control is hidden.
  - Always-on-top toggles and persists across restart.
  - OBS Window Capture can target the stable `Runtime Player Stage` title and preserves transparent background as expected for the user's OBS configuration.

## User Decision Points

None for Domain C design/development compliance.
