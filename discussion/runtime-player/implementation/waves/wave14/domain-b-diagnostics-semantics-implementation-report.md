# Wave14 Domain B Diagnostics Semantics Implementation Report

- Domain: Performance Diagnostics semantics cleanup
- Agent: Gnome
- Verdict: needs_review
- Date: 2026-06-26

## Scope Completed

- Updated Performance Diagnostics report semantics so `[Input]` now reports:
  - `inputReceiveFpsLatest`
  - `inputPacketCount`
- Updated target report sections to distinguish:
  - `liveFrameMessageFps`
  - `liveFrameMessageCount`
  - `appliedLiveFrameFps`
  - `appliedLiveFrameCount`
  - `renderFps`
  - `renderCount`
- Kept Browser Source source timestamp FPS as a separate diagnostic named `liveFrameSourceTimestampFpsLatest`.
- Removed report/UI wording that labeled Browser Source source timestamp FPS as raw input/source input FPS.
- Updated Performance Diagnostics page labels and Browser Source Output panel label.

## Implementation Notes

- `inputReceiveFpsLatest` is derived from `RuntimePlayerInputStatus.estimatedFps`.
- `inputPacketCount` is derived from the input packet counter delta during capture.
- `liveFrameMessageCount` is derived from `liveFrameMessageCount` counter delta.
- `appliedLiveFrameCount` is derived from `liveRenderInputEvaluationDurationSampleCount` counter delta. This counter increments when the renderer applies/evaluates a pending live frame.
- `renderCount` remains derived from actual render counter delta.

## Files Changed

- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-page.tsx`
- `apps/runtime-player/src/control/browser-source-output-panel.tsx`
- `apps/runtime-player/src/control/stage-page.browser-source.test.ts`
- `discussion/runtime-player/implementation/waves/wave14/domain-b-diagnostics-semantics-implementation-report.md`

## Verification

- `pnpm.cmd exec vitest run apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts apps/runtime-player/src/control/stage-page.browser-source.test.ts`
  - Initial sandbox run failed before tests with `spawn EPERM` while loading Vitest config through esbuild.
  - Elevated rerun passed: 3 files, 12 tests passed.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `git diff --check -- apps/runtime-player/src/control/performance-diagnostics-report.ts apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/control/performance-diagnostics-page.tsx apps/runtime-player/src/control/browser-source-output-panel.tsx apps/runtime-player/src/control/stage-page.browser-source.test.ts`: passed with CRLF normalization warnings only.

## Required Scenario Covered

Added a 10 second Browser Source capture regression test with:

- input receive FPS: 60
- input packet delta: 600
- Browser Source source timestamp FPS: 27
- live frame messages delivered: 598, reported as 59.8 fps
- applied/evaluated live frames: 96, reported as 9.6 fps
- actual renders: 96, reported as 9.6 fps
- coalesced live frames: 500

The test asserts the report does not contain the old `sourceInputFps` or `liveMessageCount:` labels.

## Residual Risks

- Manual UI verification in Electron was not run.
- Browser Source contract field names still include existing `fps` / `sourceFps`; this implementation changes report/UI semantics without changing the transport contract to avoid broad compatibility churn.
- Concurrent Domain A changes are present in the worktree under stage renderer/runtime evaluation files. They were not edited by this Domain B implementation.
