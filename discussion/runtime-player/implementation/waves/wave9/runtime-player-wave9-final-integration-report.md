# Runtime Player Wave9 Final Integration Report: OBS Browser Source Probe

## Verdict

Pass.

Runtime Player Wave9 A/B/C are reviewed pass, and Domain D final integration found no deterministic source breakage requiring code fixes.

## Basis Consumed

- [player-wave9-plan.md](../../orchestration/player-wave9-plan.md)
- [runtime-player-wave9-domain-a-browser-source-server-transport-report.md](runtime-player-wave9-domain-a-browser-source-server-transport-report.md)
- [runtime-player-wave9-domain-b-browser-source-stage-client-report.md](runtime-player-wave9-domain-b-browser-source-stage-client-report.md)
- [runtime-player-wave9-domain-c-browser-source-control-ux-report.md](runtime-player-wave9-domain-c-browser-source-control-ux-report.md)
- [runtime-player-wave9-domain-a-browser-source-server-transport-review.md](../../reviews/wave9/runtime-player-wave9-domain-a-browser-source-server-transport-review.md)
- [runtime-player-wave9-domain-b-browser-source-stage-client-review.md](../../reviews/wave9/runtime-player-wave9-domain-b-browser-source-stage-client-review.md)
- [runtime-player-wave9-domain-c-browser-source-control-ux-review.md](../../reviews/wave9/runtime-player-wave9-domain-c-browser-source-control-ux-review.md)
- OBS Browser Source docs: https://obsproject.com/kb/browser-source
- OBS Sources Guide: https://obsproject.com/kb/sources-guide

## Domain Results

| Domain | Verdict | Notes |
|---|---|---|
| A: Browser Source server / transport | Pass after fix loop 1 | Loopback HTTP/WS server, token boundary, sanitized Runtime Export/live-frame transport, Control bridge. |
| B: Browser Source Stage client / render pipeline | Pass after fix loop 1 | Transparent model-only browser page, WebGL2/render diagnostics, reconnect/resync, accepted tokenless generated JS/CSS asset boundary. |
| C: Browser Source Control UX | Pass | `Browser Source Output` primary panel, URL copy, diagnostics, setup guidance, native Stage Window demoted to `Local Preview / Fallback`. |
| D: Final integration / docs alignment | Pass | Contracts, boundaries, docs/maps, and verification reconciled. |

## Integration Findings

| Requirement | Status | Evidence |
|---|---|---|
| Reconcile shared main/preload/control/stage contracts | Pass | Main publishes Runtime Export/live frames to Browser Source server; preload exposes only Browser Source status bridge; Control consumes status; Browser Source page uses HTTP/WS config. |
| Browser Source route/client remains model-only and render-focused | Pass | `/stage` shell and Browser Source app render a transparent canvas surface; tests assert no setup/debug UI. |
| Server binds loopback only | Pass | Browser Source bind address type/value is `127.0.0.1`; server listens with that host. |
| Invalid token does not receive model data | Pass | Protected HTTP routes and WebSocket upgrade reject missing/invalid tokens; unit tests cover these paths. |
| Raw tracking/debug data does not cross into Browser Source client | Pass | Browser Source transport carries Runtime Export payload/status and sanitized live parameter frames; tests reject raw/debug/control-only leakage. |
| Native Stage Window remains useful but no longer primary | Pass | Control keeps native Stage controls under `Local Preview / Fallback`; docs demote Window/Game Capture from primary path. |
| Spout2 remains out of scope | Pass | No Spout2 sender implemented; docs/backlog keep it deferred until Browser Source critical failure. |
| Docs/maps match implementation facts | Pass within allowed scope | Updated Browser Source-first research/screen docs, backlog, and runtime-player maps; older Wave8-focused screen docs outside Domain D write scope are marked by `screens/_map.md` as requiring the Wave9 Browser Source doc for current facts. |

## Documentation Updated

- `discussion/runtime-player/research/broadcast-capture-paths.md`
- `discussion/runtime-player/screens/broadcast-stage-setup-v0.md`
- `discussion/runtime-player/screens/browser-source-output-probe-v0.md`
- `discussion/runtime-player/backlog/runtime-player-backlog.md`
- `discussion/runtime-player/_map.md`
- `discussion/runtime-player/research/_map.md`
- `discussion/runtime-player/screens/_map.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/implementation/waves/wave9/_map.md`
- `discussion/runtime-player/implementation/reviews/wave9/_map.md`

## Final Verification

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

## Manual OBS Probe Still Pending

- Add OBS Browser Source.
- Paste Runtime Player Browser Source URL.
- Set width/height.
- Set custom FPS to 30 or 60 for test.
- Keep transparent background/custom CSS behavior enabled.
- Initially leave `Shutdown source when not visible` off.
- Initially leave `Refresh browser source when scene becomes active` off.
- Confirm transparent areas show lower OBS layers.
- Confirm model renders without black/white fill.
- Confirm WebGL2 status appears in Control.
- Confirm connected client and heartbeat appear in Control.
- Move face/head with iFacialMocap and confirm model motion.
- Hide/show scene and manually refresh Browser Source, then confirm reconnect/resync.
- Confirm OBS audio meter does not receive unintended audio.

## Remaining Risks

- OBS Browser Source CEF/WebGL2 behavior, alpha preservation, visibility lifecycle, reload/resync behavior, and performance remain environment-sensitive manual probe risks.
- The Browser Source URL includes the token by design; do not expose Control Window publicly if the URL should stay private.
- Generated Browser Source JS/CSS assets are tokenless by accepted design. This remains acceptable only while static serving stays constrained to generated `.js` / `.css` files with safe filename filtering and path containment.
- Full screen-design docs `control-window-screen-structure.md` and `tracking-setup-live-mapping.md` still contain Wave8-era Stage wording and were outside Domain D's allowed write scope. The screens map now routes current broadcast setup readers to `browser-source-output-probe-v0.md`.

## User Decision Points

- After manual OBS Browser Source probe, decide whether Browser Source is accepted as the primary broadcast path.
- If Browser Source fails a critical manual condition, decide between a narrow Browser Source follow-up and Spout2 feasibility.
