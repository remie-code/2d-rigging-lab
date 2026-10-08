# Runtime Player Wave19 Domain A Design / Development Compliance Review

- Verdict: pass
- Review lane: design / development compliance
- Reviewer: Review-Sylph
- Date: 2026-06-26

## Scope Reviewed

Reviewed the Domain A Browser Source rAF cadence diagnostics implementation against Wave19 design/development constraints.

Source/test files inspected:

- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`
- `apps/runtime-player/src/preload/performance-diagnostics-contract.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`

Also inspected `git diff` for the target files and checked forbidden-scope paths for package/lockfile, Editor, package-format, runtime-core, and renderer scheduler changes.

No source code was edited by this reviewer.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave19-plan.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md`
- `discussion/runtime-player/implementation/reviews/wave18/_map.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Findings

No blocking design/development compliance findings.

Supporting observations:

- The Browser Source rAF probe is independent of live frame arrival and scheduled render work. It starts with the client, resets counters, schedules a standalone `requestAnimationFrame`, and is not called from live-frame application or renderer scheduling paths: `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:226`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:682`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:713`.
- Probe lifecycle cleanup is explicit. `stop()` cancels the outstanding probe callback, and the unit test verifies there are no pending manual rAF callbacks after stop: `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:240`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:699`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts:380`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts:417`.
- Probe state is bounded to scalar counters and the latest delta. It does not add an unbounded array, ring buffer, timer queue, or runtime-core profiling path: `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:165`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:675`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:730`.
- The diagnostics contract keeps the new Browser Source probe fields optional, preserving backward compatibility for older Native Stage or Browser Source metrics: `apps/runtime-player/src/preload/performance-diagnostics-contract.ts:15`.
- Main-process validation accepts only non-negative finite numeric/counter values for optional probe metrics and keeps malformed metrics out of accepted diagnostics: `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:84`, `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:31`, `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:123`.
- Report logic surfaces the new Browser Source metrics without changing Native Stage semantics: Browser-only probe report lines are gated by the `Browser Source` label, while shared scheduled rAF, render duration, scheduled frame duration, and coalescing ratios are handled as aggregate metrics with unknown fallbacks: `apps/runtime-player/src/control/performance-diagnostics-report.ts:466`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:560`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:947`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:1019`.
- Missing/legacy values are handled as `unknown`, and copied reports retain privacy boundaries and omit deep runtime-core timing fields: `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:564`, `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:601`, `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:666`.
- Browser Source message sanitation remains compact and allowlisted. Unknown unsafe render metrics such as token/private path fields are stripped, and the newly accepted fields are aggregate numeric metrics only: `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts:9`, `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts:85`.

## Development Risk Assessment

- Risk level: low for merged implementation, medium for interpretation until a real OBS Browser Source run is captured.
- The probe is continuous while the Browser Source client is running, but it performs only timestamp arithmetic and scalar counter updates per rAF callback. This matches the Wave19 requirement for a lightweight independent rAF signal and does not reintroduce deep profiling.
- The `p50` / `p95` / `max` summaries use the existing report helper pattern: they summarize the latest metric value observed at diagnostics sample boundaries, not every underlying rAF callback. This is bounded and consistent with existing report summaries, but manual interpretation should treat it as a coarse cadence summary rather than a full jitter distribution.
- Latest-wins coalescing and renderer scheduler behavior appear preserved. The diff does not touch `browser-source-stage-renderer.ts` or `static-stage-canvas-renderer.ts`, and the new probe does not queue live frames or alter pending-render gating.
- The copied report now distinguishes the intended Wave19 cases with `browserRafProbeFps`, `browserRafProbeDeltaMs`, `scheduledRafDeltaMs`, `renderDurationMs`, `scheduledFrameDurationMs`, `liveFramesPerAppliedFrame`, and `coalescedLiveFramesPerAppliedFrame`.

## Forbidden-Scope Check

- No runtime-core deep profiling product path was restored. Existing report tests still assert omitted runtime-core timing/profiling fields.
- No raw tracking frames, raw head position, calibration internals, Browser Source token, private paths, Runtime Export payload, textures, or mesh data are added to the diagnostics payload or copied report.
- No scheduler rewrite, stale-frame queueing, or forced 60fps behavior was introduced.
- No new dependencies, `package.json`, `pnpm-lock.yaml`, or `pnpm-workspace.yaml` changes were found.
- No Editor changes were found.
- No Runtime Export format, package-format schema, or `packages/runtime-core` changes were found.
- No `pnpm install` was run.

## Verification

- `git diff --check -- <review target files>`: no whitespace errors; Git emitted LF/CRLF working-copy warnings only.
- Sandboxed focused Vitest attempt failed before tests with `spawn EPERM` while loading `vitest.config.ts` through esbuild.
- Re-run with elevated permissions passed:
  - `pnpm.cmd exec vitest run apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts apps/runtime-player/src/control/performance-diagnostics-report.test.ts`
  - Result: 4 files / 65 tests passed.
- `pnpm.cmd typecheck` passed.

Gnome reported 5 files / 77 focused tests passed. This reviewer independently re-ran the four changed test files listed above; the additional Gnome-focused file was not identified from the assignment target list.

## Remaining Manual Checks

- Run Runtime Player with a real Runtime Export.
- Connect live iFacialMocap input.
- Connect OBS Browser Source.
- Set OBS video FPS and Browser Source custom FPS to 60, matching the prior investigation setup.
- Run Performance Diagnostics for Browser Source or Both.
- Save copied report to `tmp/report.log`.
- Compare `browserRafProbeFps`, `browserRafProbeDeltaMs`, `scheduledRafDeltaMs`, `renderDurationMs`, `scheduledFrameDurationMs`, `liveFrameMessageFps`, `appliedLiveFrameFps`, `renderFps`, `coalescedLiveFrameCount`, `liveFramesPerAppliedFrame`, and `coalescedLiveFramesPerAppliedFrame`.
- Confirm copied reports remain free of raw tracking frames, calibration internals, Browser Source token, private paths, full Runtime Export payloads, Runtime Export textures, and Runtime Export mesh data.
