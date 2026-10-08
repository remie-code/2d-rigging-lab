# Runtime Player Wave10 Domain A Review: Broadcast Performance Foundation

## Verdict

pass

## Loop

1

## Scope Reviewed

- Basis:
  - `discussion/runtime-player/implementation/orchestration/player-wave10-plan.md` section 5.
  - `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`.
  - `discussion/runtime-player/screens/browser-source-output-probe-v0.md`.
  - `discussion/runtime-player/research/broadcast-capture-paths.md`.
  - `discussion/runtime-player/screens/broadcast-stage-setup-v0.md`.
  - Wave9 reports/reviews under `discussion/runtime-player/implementation/waves/wave9/` and `discussion/runtime-player/implementation/reviews/wave9/`.
- Source diff:
  - `apps/runtime-player/src/control/browser-source-output-panel.tsx`
  - `apps/runtime-player/src/control/stage-page.browser-source.test.ts`
  - `apps/runtime-player/src/main/broadcast-source/browser-source-server.ts`
  - `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts`
  - `apps/runtime-player/src/main/live-parameter-bridge-handlers.ts`
  - `apps/runtime-player/src/main/runtime-player-main.ts`
  - `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`
  - `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts`
  - `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- New untracked implementation/test files:
  - `apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts`
  - `apps/runtime-player/src/main/broadcast-source/local-preview-live-render-suspension.test.ts`
  - `apps/runtime-player/src/main/broadcast-source/local-preview-live-render-suspension.ts`
  - `apps/runtime-player/src/main/live-parameter-bridge-handlers.test.ts`
  - `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts`

## Design / Behavior Compliance

Pass.

- Local preview suspension is scoped to native Stage live-frame delivery. `LocalPreviewLiveRenderSuspensionPolicy` suspends immediately at `connectedClientCount > 0`, starts a 2000 ms default resume grace at zero clients, and cancels pending resume on reconnect (`apps/runtime-player/src/main/broadcast-source/local-preview-live-render-suspension.ts:55`).
- Main wiring toggles Stage live-frame delivery and clears/replays only the native Stage live parameter frame; it does not hide, destroy, or stop the Stage Window (`apps/runtime-player/src/main/runtime-player-main.ts:90`, `apps/runtime-player/src/main/runtime-player-main.ts:104`, `apps/runtime-player/src/main/runtime-player-main.ts:109`).
- Live frame production and Browser Source broadcasting continue while native Stage delivery is disabled: `publishFrame` still records the latest frame and the main bridge always calls `browserSourceServer.publishLiveParameterFrame(frame)` (`apps/runtime-player/src/main/live-parameter-bridge-handlers.ts:41`, `apps/runtime-player/src/main/runtime-player-main.ts:123`).
- Native Stage renderer now cancels pending live-frame RAF on clear, while payload and view transform rendering remain active (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:140`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:159`).
- Browser Source status sampling applies only to live-frame status and unchanged renderer diagnostics; connect/disconnect, server state, Runtime Export changes, stage display changes, and renderer error/status changes remain immediate (`apps/runtime-player/src/main/broadcast-source/browser-source-session.ts:214`, `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts:331`, `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts:417`, `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts:470`).
- Browser Source client diagnostics are sampled around 500 ms while every live frame is still applied to the renderer (`apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:463`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:531`).
- Browser Source Runtime Export application de-duplicates identical payload identity/metadata keys and still applies replacement identities (`apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:391`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:651`).
- Control shows local preview suspension when Browser Source clients are connected (`apps/runtime-player/src/control/browser-source-output-panel.tsx:41`, `apps/runtime-player/src/control/browser-source-output-panel.tsx:195`).

## Test Coverage And Verification Reviewed

Pass.

- Suspension policy tests cover active at zero clients, immediate suspend at clients > 0, delayed resume after grace, and reconnect during grace without bounce (`apps/runtime-player/src/main/broadcast-source/local-preview-live-render-suspension.test.ts:10`, `apps/runtime-player/src/main/broadcast-source/local-preview-live-render-suspension.test.ts:77`).
- Live parameter bridge tests cover updating latest frame without native Stage delivery and replaying clear plus latest frame on resume (`apps/runtime-player/src/main/live-parameter-bridge-handlers.test.ts:33`, `apps/runtime-player/src/main/live-parameter-bridge-handlers.test.ts:46`).
- Native Stage renderer test covers pending RAF cancel on clear and continued payload/view rendering while live rendering is cleared (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts:55`).
- Browser Source session tests cover sampled Control-facing live-frame status while broadcasting every live frame, prompt connect/disconnect transitions, and immediate render error diagnostics (`apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts:14`, `apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts:54`, `apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts:78`).
- Browser Source client tests cover diagnostic sampling without throttling renderer frame application and Runtime Export payload deduplication/replacement (`apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts:243`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts:306`).
- Control tests cover suspended/active local preview labels in connected/no-client status (`apps/runtime-player/src/control/stage-page.browser-source.test.ts:23`, `apps/runtime-player/src/control/stage-page.browser-source.test.ts:120`).

Reviewer-run verification:

- `pnpm.cmd exec vitest run -c vitest.config.ts src/main/broadcast-source/local-preview-live-render-suspension.test.ts src/main/broadcast-source/browser-source-session.test.ts src/main/live-parameter-bridge-handlers.test.ts src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts src/stage/browser-source/browser-source-stage-client.test.ts src/control/stage-page.browser-source.test.ts`
  - Result: pass, 6 files / 22 tests.
- `pnpm.cmd typecheck`
  - Result: pass.
- `pnpm.cmd run check:source`
  - Result: pass.
- `git diff --check -- apps/runtime-player/src`
  - Result: pass; only LF-to-CRLF working-copy warnings.
- `rg -n "[ \t]$|<<<<<<<|>>>>>>>"` on the five new untracked source/test files
  - Result: no matches.

Reviewed but not rerun:

- Gnome-reported `pnpm.cmd test:unit`: pass, 64 files / 261 tests.
- Gnome-reported focused Vitest/typecheck/check-source/diff-check evidence matches the reviewer-run focused verification.

## Findings

None.

## Residual Risks / User-Decision Points

- Manual OBS Browser Source verification remains required for alpha preservation, CEF/WebGL2 behavior, live iFacialMocap smoothness, dynamics, Stage transform sync, refresh/reconnect lifecycle, and perceived CPU/GPU improvement.
- Control derives the local preview status row from connected Browser Source client count. During the intentional zero-client resume grace, the implementation may not expose a separate `resumePending` UI state; this is acceptable for Domain A but should be watched in manual refresh/reconnect observation.
- Runtime Export deduplication uses available identity/metadata fields rather than a full payload hash. This is practical for current Runtime Export reload/resync behavior, but a future payload hash would make duplicate/replacement detection stricter.
