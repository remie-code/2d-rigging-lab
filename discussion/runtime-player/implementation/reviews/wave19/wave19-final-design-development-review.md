# Runtime Player Wave19 Final Design / Development Review

- Verdict: pass
- Review lane: final design / development review
- Reviewer: Review-Sylph clean-context reviewer
- Date: 2026-06-26

## Scope Reviewed

Reviewed Runtime Player Wave19 final integration from the requested design/development compliance angle:

- lightweight Browser Source independent rAF probe behavior;
- diagnostics/report privacy and sanitization boundaries;
- absence of product runtime-core deep profiling transport/report restoration;
- preservation of Browser Source latest-wins coalescing and normal Native Stage / Browser Source rendering semantics;
- documentation wording for coarse sampled/counter summaries;
- forbidden-scope boundaries for Runtime Export, Editor, package-format, dependencies, lockfile, and broad source changes.

Source, test, and docs inspected:

- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`
- `apps/runtime-player/src/preload/performance-diagnostics-contract.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- Runtime Player Wave19 maps and Domain A review/report artifacts under `discussion/runtime-player/implementation/**/wave19/`

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave19-plan.md`
- `discussion/runtime-player/implementation/waves/wave19/domain-a-browser-source-raf-cadence-metrics-report.md`
- `discussion/runtime-player/implementation/reviews/wave19/domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave19/domain-a-design-development-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave19/domain-a-test-adequacy-review.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/implementation/waves/wave19/_map.md`
- `discussion/runtime-player/implementation/reviews/wave19/_map.md`

## Findings

No blocking findings.

## Development / Design Risk Assessment

Risk level: low for source integration; medium for real OBS / CEF interpretation until the manual Browser Source capture is run.

Supporting observations:

- The Browser Source rAF probe is independent from live frame arrival and render scheduling. `BrowserSourceStageClient.start()` resets/schedules the probe, `stop()` cancels it, and the probe loop only records rAF timestamp deltas and scalar counters before rescheduling itself: `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:233`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:245`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:682`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:713`.
- Probe state is bounded to numeric scalars: frame count, last timestamp, last delta, and delta sample count. It is merged into renderer metrics snapshots as optional numeric fields and does not create raw arrays/traces or send diagnostics per rAF callback: `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:165`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:730`.
- Live frame handling remains separate. `#applyLiveParameterFrame()` still records Browser Source source metrics, calls `renderer.setLiveParameterFrame(frame)`, updates snapshot metrics, and sends diagnostics through the existing sampled path: `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:521`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:589`.
- Existing latest-wins coalescing remains in the shared renderer: when a pending live frame exists, `coalescedLiveFrameCount` increments, the latest frame replaces the pending frame, and only one scheduled rAF render is requested. That file was not changed in the Wave19 diff: `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:276`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:486`.
- Validation allows only finite/non-negative numeric probe fields and strips unknown fields by reconstructing the metrics object. Browser Source diagnostics ingestion uses that validator for `renderMetrics`: `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:84`, `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.ts:58`.
- Copied reports expose aggregate/counter summaries only: `browserRafProbeFps`, `browserRafProbeDeltaMs`, `scheduledRafDeltaMs`, `renderDurationMs`, `scheduledFrameDurationMs`, `liveFramesPerAppliedFrame`, and `coalescedLiveFramesPerAppliedFrame`: `apps/runtime-player/src/control/performance-diagnostics-report.ts:466`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:469`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:560`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:576`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:947`.
- Product deep runtime-core profiling remains absent from copied reports. Tests explicitly keep runtime-core timing field names and `runtimeModelCompileDurationMs` out of report text: `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:30`, `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:284`, `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:557`.
- The screen doc describes Wave19 metrics as sampled/counter summaries, not raw rAF traces or deep profiling, and states latest-wins coalescing remains intentional: `discussion/runtime-player/screens/performance-diagnostics.md:141`, `discussion/runtime-player/screens/performance-diagnostics.md:151`, `discussion/runtime-player/screens/performance-diagnostics.md:174`.

Interpretation note: the p50 / p95 / max values in the copied report summarize values observed at diagnostics sample boundaries. They are useful coarse product diagnostics, not a raw full rAF trace or profiler-grade jitter distribution. The docs now say this explicitly enough for Wave19.

## Privacy / Diagnostics Boundary

Pass.

- New rAF probe fields are aggregate numeric counters/deltas only.
- Report privacy exclusions still list raw tracking frames, calibration internals, Browser Source token, private paths, full Runtime Export payload, Runtime Export textures, and Runtime Export mesh data: `apps/runtime-player/src/control/performance-diagnostics-report.ts:258`.
- Focused privacy tests cover token/private path stripping from Browser Source render metrics and copied reports, and raw frame/calibration text exclusion: `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts:85`, `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:666`.
- `rg` found texture/path terms in the Browser Source client only in the Runtime Export payload identity key, not in diagnostics/report output. The copied report path remains allowlisted through metrics-copy/report formatting.

## Verification Performed

Commands run and results:

- `Get-Content -Encoding UTF8 <basis docs>` for the Wave19 plan, Domain A report/reviews, planning conventions, performance diagnostics screen doc, and Wave19 maps.
  - Result: basis docs read successfully.
- `Get-Content -Encoding UTF8 <source/test files>` for the target Runtime Player source/test files and Browser Source message reader.
  - Result: implementation and tests read successfully.
- `git diff --name-only -- apps/runtime-player/src discussion/runtime-player package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/package-format packages/runtime-core`
  - Result: only Domain A Runtime Player source/test files plus Wave19 discussion docs/maps were listed; no package, lockfile, Editor, package-format, or runtime-core paths.
- `git diff --name-only -- apps/runtime-player/src/stage/browser-source/browser-source-stage-renderer.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts apps/editor packages/package-format packages/runtime-core package.json pnpm-lock.yaml pnpm-workspace.yaml`
  - Result: no output. Renderer scheduler files and forbidden-scope paths had no tracked diff.
- `git ls-files -m -o --exclude-standard -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/package-format packages/runtime-core apps/runtime-player/src discussion/runtime-player`
  - Result: listed Wave19 discussion artifacts and the expected Domain A Runtime Player source/test files only; no forbidden-scope files.
- `rg -n "browserRafProbe|scheduledRafDeltaMs|renderDurationMs|scheduledFrameDurationMs|liveFramesPerAppliedFrame|coalescedLiveFramesPerAppliedFrame|diagnosticScope|privacy|excludes|runtimeModelCompileDurationMs|deep-runtime-core|runtimeCore" ...`
  - Result: confirmed report fields, documentation language, and tests that omit deep runtime-core profiling fields.
- `rg -n "token|privatePath|private path|rawFrame|trackingFrame|calibrationInternals|Runtime Export textures|Runtime Export mesh|full Runtime Export payload|bytesBase64|texturePage|artifacts" ...`
  - Result: only privacy docs/tests and the Browser Source payload identity key matched in implementation; no copied-report exposure path found.
- `rg -n -C 8 "setLiveParameterFrame\\(|coalescedLiveFrameCount|scheduleRender\\(|renderScheduled" apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
  - Result: confirmed existing latest-wins coalescing/pending rAF behavior.
- `rg -n -C 6 "#scheduleBrowserRafProbe|#cancelBrowserRafProbe|#recordBrowserRafProbeFrame|#getRenderMetricsSnapshot|#applyLiveParameterFrame" apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts`
  - Result: confirmed independent probe lifecycle and separation from live-frame rendering.
- `git diff --check -- <review target source/test/docs/map files>`
  - Result: no whitespace errors. Git emitted LF/CRLF working-copy warnings only.

Tests/typecheck not run by this final reviewer. Reason: the requested final lane called for focused file/diff/rg checks and reuse of Domain A verification unless a concrete design risk required a focused test. No such risk was found. Domain A evidence already reports focused Vitest passing, including 5 files / 77 tests, and `pnpm.cmd typecheck` passing; the Domain A design/development and test-adequacy reviews also reran focused tests/typecheck successfully.

## Forbidden-Scope Confirmation

Confirmed:

- No product runtime-core deep profiling path or transport was restored.
- No raw tracking/debug/calibration data, Browser Source token, private paths, full Runtime Export payload, textures, or mesh data are exposed by the new metrics/report fields.
- No scheduler rewrite, stale-frame queueing, forced 60fps behavior, or default Browser Source / Native Stage rendering semantic change was found.
- No Runtime Export format changes were found.
- No Editor changes were found.
- No package-format schema changes were found.
- No `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, or dependency changes were found.
- `pnpm install` was not run.
- This reviewer wrote only this report file.

## Remaining Manual Checks

Manual OBS / CEF confirmation remains pending and should not be recorded as passed from source review alone:

- Open Runtime Player with a real Runtime Export.
- Connect iFacialMocap.
- Connect OBS Browser Source.
- Set OBS video FPS and Browser Source custom FPS to 60.
- Run Performance Diagnostics for Browser Source or Both.
- Save copied report to `tmp/report.log`.
- Compare `browserRafProbeFps`, `browserRafProbeDeltaMs`, `scheduledRafDeltaMs`, `renderDurationMs`, `scheduledFrameDurationMs`, `liveFrameMessageFps`, `appliedLiveFrameFps`, `renderFps`, `coalescedLiveFrameCount`, `liveFramesPerAppliedFrame`, and `coalescedLiveFramesPerAppliedFrame`.
