# Runtime Player Wave9 Final Clean Integration Review

## Verdict

Pass.

No blocking, medium, or minor findings requiring source changes were found in final integration.

## Scope Reviewed

- Wave9 plan, Domain A/B/C reports, and Domain A/B/C reviews.
- Runtime Player Browser Source server/session/token/static asset boundaries.
- Runtime Player Browser Source Stage client/parser/renderer boundary.
- Runtime Player preload/control Browser Source status bridge.
- Stage page Browser Source Output and Local Preview / Fallback UI.
- Updated Runtime Player research/screen/backlog/maps documents.
- Final verification results.

## Spec Compliance

Pass.

- Browser Source URL is loopback and tokenized.
- Missing/invalid token is rejected for protected routes and WebSocket upgrade.
- Browser Source page is separate from Electron Stage Window and remains model-only by default.
- Browser Source receives Runtime Export payload/status plus sanitized live parameter frames only.
- Raw tracking/debug/calibration data and private paths are not exposed to Browser Source.
- Control reports Browser Source server/client/renderer diagnostics, including WebGL2, heartbeat, latest frame, frame age, and FPS.
- Native Stage Window controls remain available as local preview/fallback.
- Window/Game Capture is not presented as the primary broadcast setup path.
- Spout2, obs-websocket, and automatic OBS source creation remain out of scope.

## Design / Development Compliance

Pass.

- Main process integration is narrow: existing sanitized live parameter publishing fans out to native Stage and Browser Source server.
- Preload contract remains narrow: Control gets Browser Source status and status-change subscription only.
- Browser Source Stage client has no Electron preload/IPC/Node dependency.
- Tokenless static JS/CSS asset serving is documented as an accepted production-split-chunk design assumption and constrained by allowlist/path containment.
- Control URL copy shows the full tokenized URL because OBS setup needs it; no separate raw token control was added.
- Docs now describe Browser Source as a probe and do not overclaim OBS readiness.

## Test Adequacy

Pass.

Existing Wave9 tests cover:

- loopback URL construction and token generation/rejection.
- missing/invalid token rejection on HTTP and WebSocket.
- Runtime Export payload/status shape and no private path/control/debug leakage.
- arbitrary file and raw tracking/debug route rejection.
- WebSocket connect/disconnect, heartbeat, diagnostics, resync, live frame, and clear behavior.
- Browser Source static JS/CSS asset serving and disallowed asset/path traversal.
- Browser Source client fetch/connect/resync/live-frame/clear behavior.
- Browser Source server message sanitization.
- model-only Browser Source DOM assumptions.
- no Electron preload/Node dependency in Browser Source entry.
- Control Browser Source URL/status/client diagnostics and Copy URL behavior.

The remaining OBS behavior is manual by nature and is correctly listed as pending.

## Docs / Map Alignment

Pass within Domain D allowed write scope.

- `broadcast-capture-paths.md` now records Browser Source as the primary probe, Stage Window as fallback, and Spout2 as deferred.
- `broadcast-stage-setup-v0.md` now demotes native Stage Window setup to local preview/fallback and points to the Browser Source probe doc.
- `browser-source-output-probe-v0.md` captures the current screen/transport/data-boundary facts and manual OBS checklist.
- Runtime Player backlog and maps now point future agents to Wave9 final report/review and Browser Source docs.
- Older Wave8-focused screen docs outside the allowed write scope are not rewritten; `screens/_map.md` marks them as Wave9 follow-up pending and routes current broadcast setup readers to the new Browser Source doc.

## Verification Reviewed

From `apps/runtime-player`:

- `pnpm.cmd typecheck`
  - Result: pass.
- `pnpm.cmd test:unit`
  - Result: pass, 59 files / 225 tests.

From repository root:

- `pnpm.cmd run check:source`
  - Result: pass.
- `git diff --check -- apps/runtime-player/src apps/runtime-player/electron.vite.config.ts discussion/runtime-player`
  - Result: pass; Git reported only existing LF-to-CRLF working-copy warnings.
- Untracked Wave9 file sweep with `git diff --check --no-index -- NUL <file>`
  - Result: pass; no whitespace errors in untracked Wave9 files.

`pnpm install` was not run.

## Residual Risks

- Manual OBS Browser Source probe remains pending for alpha, WebGL2, live motion, lifecycle/reload, performance, and audio meter behavior.
- The tokenized Browser Source URL is visible in Control by design.
- Tokenless generated JS/CSS asset serving must remain narrow.

## User Decision Points

- Accept Browser Source as primary after manual probe, or choose follow-up/Spout2 feasibility if the probe fails.
