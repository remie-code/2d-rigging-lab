# Runtime Player Wave14 Domain B Clean Review

- Verdict: pass
- Reviewer: Review-Sylph
- Domain: Diagnostics Semantics Cleanup
- Date: 2026-06-26

## Review Lanes Covered

- Design/development compliance: pass
- Test adequacy: pass

## Scope Reviewed

- Read the requested basis documents:
  - `discussion/runtime-player/implementation/orchestration/player-wave14-plan.md`
  - `discussion/runtime-player/implementation/orchestration/player-wave13-plan.md`
  - `discussion/runtime-player/implementation/waves/wave13/wave13-final-integration-report.md`
  - `discussion/runtime-player/screens/performance-diagnostics.md`
  - `discussion/runtime-player/screens/browser-source-output-probe-v0.md`
  - `discussion/development_convention/source-file-organization-policy.md`
- Inspected the requested Domain B diff and changed files:
  - `apps/runtime-player/src/control/performance-diagnostics-report.ts`
  - `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`
  - `apps/runtime-player/src/control/performance-diagnostics-page.tsx`
  - `apps/runtime-player/src/control/browser-source-output-panel.tsx`
  - `apps/runtime-player/src/control/stage-page.browser-source.test.ts`
  - `discussion/runtime-player/implementation/waves/wave14/domain-b-diagnostics-semantics-implementation-report.md`

## Findings

No blocking findings.

The report semantics match Wave14 Domain B:

- `[Input]` now reports `inputReceiveFpsLatest` and `inputPacketCount`.
- target sections report `liveFrameMessageFps`, `liveFrameMessageCount`, `appliedLiveFrameFps`, `appliedLiveFrameCount`, `renderFps`, and `renderCount`.
- Browser Source timestamp-derived FPS is kept separate as `liveFrameSourceTimestampFpsLatest`.
- Browser Source Output panel label now says `Live Source Timestamp FPS`.
- Performance Diagnostics page labels separate input receive FPS, input packet count, Native render FPS, Browser render FPS, and Browser Source timestamp FPS.

Applied/evaluated FPS derivation is acceptable for this wave. The report derives `appliedLiveFrameCount` from `liveRenderInputEvaluationDurationSampleCount`; the renderer increments that counter when `applyLatestLiveParameterFrameToRenderInput()` evaluates the latest live frame before render. This matches the Wave14 diagnostic need to distinguish delivered live-frame messages from frames actually evaluated/applied after coalescing. No escalation is needed.

Privacy boundary remains intact:

- copied report text is built from compact aggregate report fields only;
- `createPerformanceDiagnosticsCaptureSample()` copies input packet/FPS, stage state summary, sanitized Browser Source timestamp FPS, and render metrics snapshot only;
- tests still inject unsafe token/raw-frame/calibration/private-path fields and assert they are absent from the stored sample/report text.

Scope and organization are compliant:

- no dependency, lockfile, runtime export format, cache, or hot-path architecture change was introduced by Domain B;
- no `index.ts` or broad catch-all source file was added;
- concurrent Domain A changes are outside this review except where renderer counter semantics were inspected for the applied/evaluated FPS ambiguity check.

## Tests / Verification

Re-ran instead of trusting Gnome's focused test result:

- `pnpm.cmd exec vitest run apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts apps/runtime-player/src/control/stage-page.browser-source.test.ts`
  - sandbox attempt failed with `spawn EPERM` while loading Vitest/esbuild config;
  - elevated rerun passed: 3 files / 12 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `git diff --check -- <Domain B files>`: passed with CRLF normalization warnings only.

## Residual Risks / Manual Checks

- Electron visual QA was not run.
- Real OBS Browser Source capture remains pending.
- If a user toggles active Variant selection during a performance capture, `appliedLiveFrameCount` may include immediate re-evaluation of the latest live frame as well as normal scheduled rAF application. This does not block Domain B, but follow-up analysis should avoid interpreting variant-toggle captures as steady-state FPS captures.
