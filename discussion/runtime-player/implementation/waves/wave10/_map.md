# Runtime Player Wave10 Report Map

> Broadcast Performance Foundation implementation reports.

## Files

| Path | Status | Content |
|---|---|---|
| [runtime-player-wave10-domain-a-broadcast-performance-foundation-report.md](runtime-player-wave10-domain-a-broadcast-performance-foundation-report.md) | Pass | Domain A local preview live render suspension, Control diagnostics/status sampling, Browser Source Runtime Export resync de-duplication, and focused tests |
| [runtime-player-wave10-final-integration-report.md](runtime-player-wave10-final-integration-report.md) | Pass after closeout loop 3 | Domain B final integration, docs/maps alignment, preserved Domain A evidence, loop 2 screens/research map alignment fix, loop 3 review-completion map closeout, manual OBS checklist, and residual risks |

## Implementation Facts

- Browser Source remains the fixed primary broadcast path.
- Native Stage Window remains visible and usable as local preview/fallback when no Browser Source client is connected.
- Browser Source client connection suspends only native Stage local live rendering.
- Browser Source rendering, live parameter frame production, input processing, mapping, body follow, dynamics, Runtime Export state, and Stage transform sync remain active while native local preview live rendering is suspended.
- Native Stage local live rendering resumes after the zero-client grace period.
- Control reports local preview suspension while Browser Source is connected.
- Control-facing live-frame status and repeated renderer diagnostics are sampled without hiding important server/client/export/render transitions.
- Browser Source resync de-duplicates identical Runtime Export payload application while preserving reload/reconnect and replacement payload application.
- Raw tracking/debug/calibration data and private paths do not cross into Browser Source.

## Remaining Manual Verification

- OBS Browser Source URL load, alpha preservation, and WebGL2/model rendering.
- Real iFacialMocap live motion, body follow, and dynamics in OBS Browser Source.
- Stage size/pan/zoom sync in OBS Browser Source.
- Control connected/heartbeat/render status and local preview suspension status.
- OBS hide/show, manual refresh, reconnect/resync, and native preview resume after disconnect.
- CPU/GPU usage or perceived smoothness compared with the Wave9 duplicate-render baseline.
- OBS audio meter does not receive unintended audio.
