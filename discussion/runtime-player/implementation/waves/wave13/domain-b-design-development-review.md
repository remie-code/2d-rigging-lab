# Runtime Player Wave13 Domain B Design / Development Compliance Review

Date: 2026-06-25
Reviewer: Review-Sylph, design / development compliance lane
Verdict: needs_fix

## Findings

1. needs_fix: Performance Diagnostics capture stores full unsafe status objects instead of a sanitized aggregate capture DTO.
   - Evidence: `apps/runtime-player/src/control/performance-diagnostics-report.ts:20` defines `PerformanceDiagnosticsCaptureSample` with full `RuntimePlayerInputStatus`, `RuntimePlayerStageStateSnapshot`, and `RuntimePlayerBrowserSourceStatus`.
   - Evidence: `apps/runtime-player/src/control/performance-diagnostics-page.tsx:329` creates samples by copying those full objects into the capture draft.
   - Evidence: `apps/runtime-player/src/preload/input-bridge-contract.ts:64` and `apps/runtime-player/src/preload/input-bridge-contract.ts:74` show `RuntimePlayerInputStatus` can include `rawFrameSample`, `trackingFrame`, `iphoneHost`, remote endpoint, and diagnostics.
   - Evidence: `apps/runtime-player/src/preload/browser-source-status-contract.ts:137` shows `RuntimePlayerBrowserSourceStatus` includes `browserSourceUrl`, and `apps/runtime-player/src/preload/browser-source-status-contract.ts:82` includes client diagnostic `source`.
   - Why this matters: the current formatter intentionally omits unsafe values, and tests assert that output does not include token/raw/private strings. However, the diagnostics capture/report boundary is not type-minimal, so future report edits can accidentally leak raw tracking data, Browser Source tokens, or private paths. It also stores repeated full status snapshots during capture. The rubric asks for typed/minimal boundaries and aggregate/safe metrics only.
   - Recommendation: introduce a sanitized `PerformanceDiagnosticsCaptureSample` shape that contains only needed fields: capture time, input `estimatedFps`/packet count, Stage Motion enabled, native render metrics, Browser Source connected count, Browser Source source FPS/render metrics, and safe availability fields. Build that sanitized DTO before storing it in the capture draft or passing it to report aggregation.

2. needs_fix: The UI lacks the required manual clear/reset behavior for Performance Diagnostics capture reports.
   - Evidence: `discussion/runtime-player/implementation/orchestration/player-wave13-plan.md` section 3.2 includes "Start Capture, timed capture, Copy Report, and clear/manual-reset behavior" in scope.
   - Evidence: `apps/runtime-player/src/control/performance-diagnostics-page.tsx:247` renders only Start Capture, Stop Capture, and Copy Report controls; no clear/reset action is present.
   - Why this matters: a new capture can overwrite the previous report, but the user has no explicit way to clear a completed report or reset the capture state. The report preview can remain populated until another capture is run.
   - Recommendation: add a Clear Report or Reset Capture action that cancels any pending timer, clears `draftRef`, returns the UI to idle, and removes the report preview/copy payload. Add a focused test for completed-report reset and running-capture cancellation if supported.

## Compliance Notes

- Runtime Player scope is maintained in the inspected changes. I found no Editor or Runtime Export format changes in `git status --short -uall`.
- No dependency or lockfile changes were present; `git status --short -uall -- package.json pnpm-lock.yaml` was empty.
- Source organization is mostly responsibility-scoped: new files separate page UI, report aggregation/formatting, metrics contract, and main-side validation. No `index.ts` implementation logic was introduced.
- Browser Source diagnostics extend the existing `browser-source-renderer-diagnostics` message with aggregate render metrics only. `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.ts:41` validates the message, and `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:20` only accepts finite counters/timing/canvas metrics.
- The formatted copy report is deterministic and test-covered, but finding 1 means the data boundary should be narrowed before accepting the design.

## Verification Performed

- Read basis docs:
  - `discussion/runtime-player/implementation/orchestration/player-wave13-plan.md`
  - `discussion/runtime-player/screens/control-window-screen-structure.md`
  - `discussion/runtime-player/screens/broadcast-stage-setup-v0.md`
  - `discussion/development_convention/source-file-organization-policy.md`
  - `discussion/development_convention/dependency-policy.md`
  - `discussion/development_convention/operation-policy.md`
- Inspected changed Runtime Player files under `apps/runtime-player/src/control`, `preload`, `main`, `main/broadcast-source`, and `stage`.
- Ran targeted tests:
  - `pnpm.cmd exec vitest run apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts`
  - Result: 7 files / 45 tests passed. Initial sandbox run failed with `spawn EPERM`; rerun with approval passed.
- Ran `pnpm.cmd typecheck`: passed.
- Ran `node scripts/check-source-organization.mjs`: passed.
- Ran `node scripts/check-dependencies.mjs`: passed.
- Ran `git diff --check -- apps/runtime-player/src/control apps/runtime-player/src/preload apps/runtime-player/src/main apps/runtime-player/src/stage`: exit 0, with CRLF conversion warnings only.

## Residual Risks And Decisions

- Native Stage render metrics are currently reported on every renderer metrics change via Stage -> main -> Control IPC (`apps/runtime-player/src/stage/stage-window-app.tsx:339`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:620`). This may be acceptable, but final integration should manually confirm it does not undermine the frame-pacing goal when diagnostics is not being viewed or captured.
- Browser Source p50/p95 report values are derived from sampled latest metrics snapshots, not a complete per-frame histogram. If exact capture-window percentiles are required, the renderer metrics contract needs histogram or ring-buffer summaries rather than only `lastRafDeltaMs` / `lastRenderDurationMs`.

