# Runtime Player Wave13 Domain B Test Adequacy Re-review

> Lane: Test Adequacy re-review for Performance Diagnostics Capture / Report UX.

## Verdict

pass

## Findings

No blocking or needs-fix findings.

The prior lifecycle gap is fixed. `PerformanceDiagnosticsPage` now has direct page-level lifecycle coverage for Start Capture, disabled running state, Stop Capture, Copy Report callback payload, and Clear Report reset in `apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts:42`. Timed completion is covered with fake timers and verifies Copy Report is enabled after the 10 second timeout in `apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts:91`.

The prior malformed metrics validation gap is fixed. Shared metrics validation rejects negative counters, non-integer counters/sample counts, `NaN`/`Infinity`, invalid canvas dimensions, and invalid `devicePixelRatio` in `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:24`. Native Stage IPC rejects malformed `reportRenderMetrics` payloads and does not publish them to Control in `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:162`. Browser Source diagnostics reject malformed nested `renderMetrics`, non-finite JSON values, and unsafe unknown fields in `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts:21`, `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts:48`, and `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts:85`.

## Required Domain B Test Coverage Checked

- Control navigation includes Performance Diagnostics: `apps/runtime-player/src/control/live-controller-page.test.ts:122`.
- Capture start/stop lifecycle: `apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts:42`.
- Timed capture completion: `apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts:91`.
- Clear/manual reset behavior: `apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts:84`; implementation button at `apps/runtime-player/src/control/performance-diagnostics-page.tsx:285`.
- Native Stage report aggregation and distinct source/render FPS: `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:31`.
- Browser Source metrics aggregation when present: `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:140`.
- Copy Report privacy exclusions for token/raw tracking/calibration/private-path fixtures: `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:230`.
- Empty/no-stage/no-browser-source states are understandable: `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:290`.
- Source FPS and render FPS are distinct report fields: `apps/runtime-player/src/control/performance-diagnostics-report.ts:59` and `apps/runtime-player/src/control/performance-diagnostics-report.ts:60`; formatter output at `apps/runtime-player/src/control/performance-diagnostics-report.ts:641` and `apps/runtime-player/src/control/performance-diagnostics-report.ts:642`.
- Native Stage metrics are reported via Stage -> main -> Control bridge: `apps/runtime-player/src/stage/stage-window-app.tsx:339`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:118`, and `apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts:158`.
- Browser Source sends renderer metrics in diagnostics: `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts:79` and `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:592`.
- Sanitized capture DTO excludes full status objects: `apps/runtime-player/src/control/performance-diagnostics-report.ts:37` and `apps/runtime-player/src/control/performance-diagnostics-report.ts:110`.
- No package or lockfile diff was present for `package.json`, `apps/runtime-player/package.json`, or `pnpm-lock.yaml`; no `pnpm install` was run.

## Verification Performed

Static inspection:

- `discussion/runtime-player/implementation/orchestration/player-wave13-plan.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- Domain B implementation and focused tests under `apps/runtime-player/src/control`, `apps/runtime-player/src/main`, `apps/runtime-player/src/preload`, and `apps/runtime-player/src/stage/browser-source`.

Commands:

```text
git status --short -uall
git diff --stat
git status --short -uall package.json pnpm-lock.yaml apps\runtime-player\package.json
git diff -- package.json pnpm-lock.yaml apps\runtime-player\package.json
rg -n "Performance Diagnostics|Start Capture|Copy Report|renderMetrics|NaN|Infinity|devicePixelRatio|diagnostic|sourceFps|renderFps|raw tracking|token|private" apps/runtime-player/src discussion/runtime-player/implementation/waves/wave13
pnpm.cmd exec vitest run apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts
pnpm.cmd exec vitest run apps/runtime-player/src/control/live-controller-page.test.ts
```

The first Vitest attempt failed in the sandbox before tests ran with `spawn EPERM` while loading Vitest/Vite config through esbuild. The same focused tests were rerun with escalation because esbuild needs to spawn a child process.

Focused test results:

- 8 focused Domain B/bridge files passed, 69 tests passed.
- `apps/runtime-player/src/control/live-controller-page.test.ts` passed, 5 tests passed.

## Residual Risks

- The full Runtime Export payload exclusion is primarily enforced by the minimal diagnostics capture DTO and formatter, not by a dedicated test that injects an actual full Runtime Export payload into the report path. Current types make that leak path unlikely because `PerformanceDiagnosticsCaptureSample` stores only packet/FPS, stage availability/motion, render metrics, and Browser Source client count/source FPS/render metrics.
- Browser Source malformed `renderMetrics` coverage verifies invalid nested metrics become `null` at message parsing. It does not assert that a prior valid Browser Source metrics snapshot is preserved after a later diagnostics message with invalid metrics; current implementation records the latest diagnostics with `renderMetrics: null`, which is acceptable for availability reporting but worth noting for future behavior changes.

## User-decision Points

None.

## Review Artifact

`discussion/runtime-player/implementation/waves/wave13/domain-b-test-adequacy-rereview.md`
