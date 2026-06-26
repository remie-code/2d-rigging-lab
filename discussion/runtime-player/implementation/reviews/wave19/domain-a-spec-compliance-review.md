# Runtime Player Wave19 Domain A Spec Compliance Review

- Verdict: pass
- Review lane: spec compliance
- Reviewer: Review-Sylph
- Date: 2026-06-26

## Scope Reviewed

Reviewed the Wave19 Domain A Browser Source rAF cadence diagnostics implementation and tests in:

- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`
- `apps/runtime-player/src/preload/performance-diagnostics-contract.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`

Also inspected `git diff`/`git diff --name-only` for the target source/test files and forbidden-scope areas.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave19-plan.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md`
- `discussion/runtime-player/implementation/reviews/wave18/_map.md`

## Findings

No spec-compliance findings.

Spec-relevant evidence:

- Browser Source now owns an independent rAF probe loop with injectable animation-frame hooks, reset on `start()`, cancellation on `stop()`, and no renderer invocation in the probe path: `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:112`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:186`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:233`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:245`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:682`.
- The probe records only bounded numeric counters/last delta and merges them into sanitized render metrics snapshots: `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:713`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:730`.
- Report aggregation computes Browser Source rAF probe FPS and delta summary, scheduled rAF delta summary, render duration summary, scheduled frame duration summary, live/applied ratio, and coalesced/applied ratio: `apps/runtime-player/src/control/performance-diagnostics-report.ts:405`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:466`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:469`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:474`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:479`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:560`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:576`.
- Copied report output keeps existing FPS/counter fields and adds Browser Source-only rAF probe lines plus common cadence/duration/coalescing lines: `apps/runtime-player/src/control/performance-diagnostics-report.ts:929`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:938`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:944`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:945`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:955`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:981`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:1019`.
- Contract/validation changes add only optional numeric Browser Source rAF probe fields and reject malformed values: `apps/runtime-player/src/preload/performance-diagnostics-contract.ts:15`, `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:84`, `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:31`, `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:122`.
- Privacy and token boundaries remain covered by validation/report tests that strip unknown unsafe fields and assert copied reports exclude tokens/private paths/raw data/deep runtime-core profile text: `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:12`, `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts:85`, `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:666`.

## Acceptance Criteria Coverage

| Criterion | Status | Evidence |
|---|---|---|
| Browser Source report includes an independent rAF probe metric not dependent on live frame arrival. | Pass | Probe loop is scheduled on Browser Source client start and records rAF callbacks independently of live frame handling; test proves metrics update with zero rendered live frames: `browser-source-stage-client.ts:233`, `browser-source-stage-client.ts:682`, `browser-source-stage-client.test.ts:380`. |
| Report distinguishes OBS/CEF rAF half-rate from renderer/scheduler backlog. | Pass | Report includes `browserRafProbeFps`, `browserRafProbeDeltaMs`, `scheduledRafDeltaMs`, `renderDurationMs`, `scheduledFrameDurationMs`, `liveFramesPerAppliedFrame`, `coalescedLiveFramesPerAppliedFrame`, and `coalescedLiveFrameCount`: `performance-diagnostics-report.ts:466`, `performance-diagnostics-report.ts:469`, `performance-diagnostics-report.ts:955`, `performance-diagnostics-report.ts:1019`. |
| Existing lightweight FPS metrics remain. | Pass | Report still emits `inputReceiveFpsLatest`, `liveFrameMessageFps`, `appliedLiveFrameFps`, `renderFps`, coalescing count, and fast-path proof counters: `performance-diagnostics-report.ts:287`, `performance-diagnostics-report.ts:929`, `performance-diagnostics-report.ts:938`, `performance-diagnostics-report.ts:944`, `performance-diagnostics-report.ts:981`, `performance-diagnostics-report.ts:1025`. |
| Native Stage diagnostics continue to work. | Pass | New Browser rAF probe report lines are gated to `label === "Browser Source"` while common native cadence/duration summaries remain formatted; native report tests assert retained metrics and no deep profile text: `performance-diagnostics-report.ts:945`, `performance-diagnostics-report.ts:955`, `performance-diagnostics-report.test.ts:257`. |
| Browser Source diagnostics are token-safe/privacy-safe. | Pass | Added fields are numeric counters/deltas only; unsafe unknown render metric fields are stripped, and copied-report tests cover token/private/raw/calibration exclusions: `performance-diagnostics-contract.ts:15`, `browser-source-client-message.test.ts:85`, `performance-diagnostics-report.test.ts:666`. |
| Browser Source visual output and scheduler semantics are not changed by default. | Pass | Probe records counters only and does not enqueue/render frames; existing renderer scheduling/coalescing logic is not modified in the reviewed diff. `browser-source-stage-client.ts:713`, `browser-source-stage-client.ts:730`; `git diff --stat` shows no renderer scheduler source file edits. |
| No runtime-core deep profiling is product-reachable. | Pass | Validation strips runtime-core timing fields and report tests assert copied output omits deep profile text/runtime-core timing names: `performance-diagnostics-metrics-validation.test.ts:17`, `performance-diagnostics-metrics-validation.test.ts:25`, `performance-diagnostics-report.test.ts:284`, `performance-diagnostics-report.test.ts:287`. |
| Missing metrics are handled gracefully. | Pass | Unavailable target report initializes unknown/empty summaries; report tests cover unknown Browser Source rAF/duration/ratio lines: `performance-diagnostics-report.ts:617`, `performance-diagnostics-report.test.ts:599`. |
| Focused tests/typecheck were reported passing. | Pass by reported verification | Gnome reported focused Vitest 5 files / 77 tests passed after escalated rerun, `pnpm.cmd typecheck` passed, and `git diff --check` had no whitespace errors except CRLF warnings. This review did not rerun tests. |

## Forbidden-Scope Check

- No Runtime Export format change found in the reviewed diff.
- No Editor changes found.
- No package-format schema changes found.
- No new dependency or lockfile changes found.
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/package-format packages/runtime-core apps/runtime-player/src` showed only the eight reviewed Runtime Player source/test files under `apps/runtime-player/src`.
- Full `git diff --name-only` also showed pre-existing Wave19 docs/maps under `discussion/runtime-player/implementation/**`, which were treated as basis/pre-existing context per assignment.
- `pnpm install` was not run by this reviewer.

## Remaining Manual Checks

Manual OBS/CEF confirmation is still required because this review inspected source/test behavior only:

- Open Runtime Player with a real Runtime Export.
- Connect iFacialMocap.
- Connect OBS Browser Source.
- Set OBS video FPS and Browser Source custom FPS to 60.
- Run Browser Source Performance Diagnostics.
- Save the copied report to `tmp/report.log`.
- Compare `browserRafProbeFps`, `browserRafProbeDeltaMs`, `scheduledRafDeltaMs`, `renderDurationMs`, `scheduledFrameDurationMs`, `liveFrameMessageFps`, `appliedLiveFrameFps`, `renderFps`, `coalescedLiveFrameCount`, `liveFramesPerAppliedFrame`, and `coalescedLiveFramesPerAppliedFrame`.
- Confirm copied reports still exclude raw tracking frames, calibration internals, Browser Source token, private paths, full Runtime Export payload, Runtime Export textures, and Runtime Export mesh data.
