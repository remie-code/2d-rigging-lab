# Runtime Player Wave19 Domain A Test Adequacy Review

- Verdict: pass
- Review lane: test adequacy
- Reviewer: Review-Sylph
- Date: 2026-06-26

## Scope reviewed

Reviewed Wave19 Domain A test adequacy for the Browser Source rAF cadence diagnostics changes. This review inspected the requested source/test files and their working-tree diff:

- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`
- `apps/runtime-player/src/preload/performance-diagnostics-contract.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`

Additional verification included `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts` because it matches the Gnome-reported focused 5-file / 77-test scope and protects existing coalescing, render duration, and lightweight renderer metrics behavior.

No source files were edited by this review. This report file is the only file written by this reviewer.

## Basis documents used

- `discussion/runtime-player/implementation/orchestration/player-wave19-plan.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md`
- `discussion/runtime-player/implementation/reviews/wave18/_map.md`
- Entry context: `discussion/_conventions.md`, `discussion/_map.md`
- Dirty/pre-existing Wave19 docs/maps were treated as basis context and were not modified.

## Test coverage findings

No blocking test adequacy gaps were found.

- Metrics validation coverage is adequate. `performance-diagnostics-metrics-validation.test.ts` accepts optional `browserRafProbeFrameCount`, `lastBrowserRafProbeDeltaMs`, and `browserRafProbeDeltaSampleCount`, and rejects unsafe malformed forms including negative probe count, NaN probe delta, and non-integer probe sample count. The same file also preserves legacy/optional metric defaults and existing fast-path proof counter validation.
- Browser Source diagnostics payload coverage is adequate. `browser-source-client-message.test.ts` accepts safe renderer diagnostics containing the new probe metrics through `createMetrics()`, drops malformed renderer metrics, drops non-finite diagnostics values, and strips unknown unsafe fields such as token/private path data.
- Browser Source client rAF probe coverage is adequate where deterministic. `browser-source-stage-client.test.ts` adds a manual `requestAnimationFrame` harness and verifies probe metrics are reported after rAF callbacks without any live frames, then verifies `stop()` cancels the pending probe callback.
- Report formatting coverage is adequate. `performance-diagnostics-report.test.ts` asserts Browser Source report output for `browserRafProbeFps`, `browserRafProbeDeltaMs`, `scheduledRafDeltaMs`, `renderDurationMs`, `scheduledFrameDurationMs`, `liveFramesPerAppliedFrame`, and `coalescedLiveFramesPerAppliedFrame`. It also verifies missing metrics are formatted as `unknown`.
- Existing lightweight metrics and fast-path proof counters remain asserted. Report tests still assert distinct input/live/applied/render FPS and counts, coalesced live frames, scaffold cache counters, `compiledEvaluatorFrameCount`, `compiledRenderFrameCount`, transient counters, `publicSnapshotMaterializationCount`, and runtime model instance cache counters.
- Native Stage report behavior remains covered. The native Stage report test still covers Native Stage availability, FPS/count aggregation, rAF delta summary, render duration summary, scheduled frame duration summary, canvas/DPR, Stage Motion, transform counts, coalesced count, and copied-report omission of deep runtime-core timing fields.
- Existing frame-pacing behavior remains covered by the focused static stage renderer frame-pacing test run, including coalescing, render metrics callbacks, render duration sampling, scheduled frame duration sampling, public snapshot materialization proof, and evaluation cache clearing.

## Commands run and results

- `pnpm.cmd exec vitest run apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts apps/runtime-player/src/control/performance-diagnostics-report.test.ts`
  - Sandbox result: failed during Vitest config load with `spawn EPERM` from esbuild.
  - Escalated rerun: passed, 4 files / 65 tests.
- `pnpm.cmd exec vitest run apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts`
  - Escalated exploratory rerun: passed, 5 files / 67 tests.
- `pnpm.cmd exec vitest run apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts`
  - Escalated focused rerun matching the Gnome-reported scope: passed, 5 files / 77 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `git diff --check -- <review-target source/test files>`
  - No whitespace errors. Git reported LF/CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL discussion/runtime-player/implementation/reviews/wave19/domain-a-test-adequacy-review.md`
  - No whitespace errors. Exit code 1 was the normal no-index "files differ" status; Git reported an LF/CRLF working-copy warning only.

`pnpm install` was not run.

## Gaps / residual manual checks

- Automated tests do not prove the real OBS/CEF Browser Source rAF cadence. The expected manual follow-up remains: run Performance Diagnostics against a real OBS Browser Source session, save the copied report to `tmp/report.log`, and compare Browser Source rAF probe FPS/delta, scheduled rAF delta, render duration, live/apply/render FPS, coalescing, and fast-path proof counters.
- The p50/p95/max cadence summaries are lightweight sampled summaries from diagnostics snapshots, not full raw rAF traces. That matches the Wave19 lightweight boundary, but report interpretation should treat them as product diagnostics, not a deep profiler.
- No additional test is required for this pass, but a future minor assertion could explicitly cover an available Browser Source metrics object where only the optional probe fields are absent. Current validation/report paths already handle absent optional fields without throwing and format unavailable values as `unknown`.

## Forbidden-scope check

- No `package.json`, `pnpm-lock.yaml`, or `pnpm-workspace.yaml` diffs were present.
- No `apps/editor`, `packages/package-format`, or `packages/runtime-core` diffs were present.
- Runtime Export format, Editor behavior, package-format schema, dependencies, lockfile, and `pnpm install` remained out of scope.
- Existing untracked Wave19 review artifacts in `discussion/runtime-player/implementation/reviews/wave19/` were not modified.
