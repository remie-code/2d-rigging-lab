# Runtime Player Wave9 Domain C Report: Browser Source Control UX

## Verdict

Pass.

Domain C completed in one implementation pass. No required review/fix loop was needed.

Domain D final integration can safely start.

## Scope Implemented

- Added `Browser Source Output` as the primary broadcast setup/status section on the Runtime Player Stage page.
- Wired Control Window state to the existing Browser Source bridge:
  - `window.runtimePlayer.browserSource.getStatus()`
  - `window.runtimePlayer.browserSource.onStatusChanged(callback)`
- Added Browser Source URL display and `Copy URL`.
- Added server status display:
  - state/status label.
  - bind address.
  - port.
  - token availability as `Included in URL`, without exposing a separate raw token control.
  - server error details when present.
- Added Browser Source client diagnostics display:
  - connected client count.
  - latest live frame sequence/timestamp.
  - client heartbeat.
  - server heartbeat.
  - renderer status/message.
  - WebGL2 availability.
  - Browser Source-side Runtime Export loaded/not-loaded state.
  - frame age.
  - FPS.
- Added concise OBS Browser Source setup guidance.
- Demoted Wave8 native Stage Window capture controls into `Local Preview / Fallback`.
- Preserved Stage Window local preview controls:
  - Focus Stage.
  - Arrange Stage.
  - Reset View.
  - Center Model.
  - Click-through toggle.
  - Always-on-top toggle.
  - Copy Window Title.

No restart/reload/resync control was added because Domain A/B did not expose a safe Control bridge action for it.

## Changed Files

Control UX:

- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/stage-page.tsx`
- `apps/runtime-player/src/control/browser-source-output-panel.tsx`
- `apps/runtime-player/src/control/browser-source-control-actions.ts`

Focused tests:

- `apps/runtime-player/src/control/browser-source-control-actions.test.ts`
- `apps/runtime-player/src/control/stage-page.browser-source.test.ts`

Reports/maps:

- `discussion/runtime-player/implementation/waves/wave9/_map.md`
- `discussion/runtime-player/implementation/waves/wave9/runtime-player-wave9-domain-c-browser-source-control-ux-report.md`
- `discussion/runtime-player/implementation/reviews/wave9/_map.md`
- `discussion/runtime-player/implementation/reviews/wave9/runtime-player-wave9-domain-c-browser-source-control-ux-review.md`

## Boundaries Preserved

- Spout sender was not implemented.
- `obs-websocket` and automatic OBS source creation were not implemented.
- Window/Game Capture is not presented as the primary broadcast setup path.
- No parameter sliders or editor-style controls were added.
- The UI does not claim OBS is capturing, streaming, or ready.
- Raw tracking/debug data is not exposed.
- `pnpm install` was not run.

## Review / Fix Loop

Implementation:

- Gnome `019ef323-58ea-7590-9ff9-561dfa7d4b24`
  - Status: completed and closed.
  - Result: implemented Domain C source and focused tests.

Review lanes:

- Design / Development Compliance Review: Review-Sylph `019ef32b-4212-7783-a89c-083c43cd7c3f`
  - Status: completed and closed.
  - Verdict: pass.
- Test Adequacy Review: Review-Sylph `019ef32b-a1c1-7062-ad29-70524d0ebfa8`
  - Status: completed and closed.
  - Verdict: pass.

Post-review integration:

- Added two non-blocking heartbeat timestamp assertions to `stage-page.browser-source.test.ts` after the test adequacy reviewer identified that direct heartbeat assertions would be a useful hardening. This was test-only tightening; no source behavior changed.

## Verification

From `apps/runtime-player`:

- `pnpm.cmd exec vitest run -c vitest.config.ts src/control/browser-source-control-actions.test.ts src/control/stage-page.browser-source.test.ts`
  - Result: pass, 2 files / 6 tests.
- `pnpm.cmd typecheck`
  - Result: pass.

From repository root:

- `pnpm.cmd run check:source`
  - Result: pass.
- `git diff --check -- apps/runtime-player/src/control`
  - Result: pass; Git reported only existing LF-to-CRLF working-copy warnings for touched existing files.

## Residual Risks

- Manual OBS Browser Source verification remains pending for the broader Wave9 probe.
- The full tokenized Browser Source URL is visible in Control because the user needs to paste it into OBS. Do not show Control Window in a public capture if the URL should remain private.
- Multiple Browser Source clients are represented by aggregate count plus latest renderer diagnostics. Per-client diagnostics remain future scope if needed.

## User Decision Points

None for Domain C.

## Domain D Readiness

Domain D final integration can safely start after this Domain C pass.
