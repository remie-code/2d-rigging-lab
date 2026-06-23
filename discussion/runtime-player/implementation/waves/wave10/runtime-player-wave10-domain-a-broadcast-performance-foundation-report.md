# Runtime Player Wave10 Domain A Report: Broadcast Performance Foundation

## Verdict

pass

## Loop Count

1

## Scope

Implemented Wave10 Domain A from `discussion/runtime-player/implementation/orchestration/player-wave10-plan.md` section 5.

Domain A covered:

- native Stage local live render suspension while Browser Source clients are connected.
- delayed native Stage live render resume after zero connected clients.
- Control-facing Browser Source status/diagnostics sampling.
- Browser Source Runtime Export startup/resync de-duplication.
- focused Runtime Player tests for the above behavior.

## Implementation Summary

- Added a local preview live render suspension policy that suspends immediately when Browser Source connected client count is greater than zero and resumes only after about 2 seconds of continuous zero-client state.
- Kept Browser Source live parameter frame publishing at the existing cadence while disabling only native Stage live frame delivery.
- Kept native Stage Window visible and kept payload, clear, resize, and view transform render paths available.
- Cleared/replayed native Stage live state on resume to avoid stale local dynamics timing.
- Sampled Control-facing Browser Source live-frame status and repeated renderer diagnostics around 500 ms while preserving immediate important transitions.
- Sampled Browser Source client renderer diagnostics without throttling Browser Source frame rendering.
- De-duplicated identical Browser Source Runtime Export payload application during startup/resync while still applying replacement payload identities.
- Added Control UI status indicating local preview live rendering is suspended while Browser Source is connected.

## Changed Files

- `apps/runtime-player/src/control/browser-source-output-panel.tsx`
- `apps/runtime-player/src/control/stage-page.browser-source.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-server.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts`
- `apps/runtime-player/src/main/broadcast-source/local-preview-live-render-suspension.ts`
- `apps/runtime-player/src/main/broadcast-source/local-preview-live-render-suspension.test.ts`
- `apps/runtime-player/src/main/live-parameter-bridge-handlers.ts`
- `apps/runtime-player/src/main/live-parameter-bridge-handlers.test.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts`

## Verification

Gnome reported:

- Focused Vitest: pass, 6 files / 22 tests.
  - Initial sandbox run hit Vitest/esbuild `spawn EPERM`; the same command passed when rerun with approved escalation.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd test:unit`: pass, 64 files / 261 tests.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- apps/runtime-player/src`: pass, LF-to-CRLF warnings only.
- `pnpm install` was not run.

Review-Sylph independently ran/reviewed:

- Focused Vitest: pass, 6 files / 22 tests.
- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- apps/runtime-player/src`: pass, LF-to-CRLF warnings only.
- `rg` whitespace/conflict-marker check on new untracked files: no matches.
- Reviewed Gnome-reported `pnpm.cmd test:unit`: pass, 64 files / 261 tests.

Orch-Sylph also ran:

- `git diff --check -- apps/runtime-player/src`: pass, LF-to-CRLF warnings only.

## Review

Review-Sylph verdict: pass.

Review report:

- `discussion/runtime-player/implementation/reviews/wave10/runtime-player-wave10-domain-a-broadcast-performance-foundation-review.md`

Findings requiring Gnome fixes: none.

## Residual Risks

- Manual OBS Browser Source verification remains required for alpha preservation, CEF/WebGL2 behavior, live iFacialMocap smoothness, dynamics, Stage transform sync, refresh/reconnect lifecycle, and perceived CPU/GPU improvement.
- Control derives the local preview status row from connected Browser Source client count and does not expose a separate resume-grace pending state. This is acceptable for Domain A but should be watched during manual OBS refresh/reconnect checks.
- Runtime Export de-duplication uses available identity/metadata fields rather than a full payload hash. A future payload hash could make replacement detection stricter.

## Domain B Readiness

Domain B can start.

Recommended Domain B focus:

- verify Browser Source remains the primary broadcast path.
- verify native Stage Window remains usable as local preview/fallback when no Browser Source client is connected.
- verify suspension does not regress Browser Source rendering, input processing, mapping, body follow, dynamics, Runtime Export state, or Stage transform sync.
- align Runtime Player docs/maps with the Wave10 implementation facts.
